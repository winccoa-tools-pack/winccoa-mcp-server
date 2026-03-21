/**
 * Tool: smooth/smooth_config_set
 *
 * Enable or update smoothing configuration on a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { checkDpesExist } from "../../utils/dp-exists-guard.js";

export function registerSmoothConfigSet(server: McpServer): void {
  server.registerTool(
    "smooth.smooth_config_set",
    {
      title: "Set Smoothing Configuration",
      description: `Enable or update the smoothing configuration on a WinCC OA
datapoint element (DPE).

Args:
  - dpeName (string): The DPE to configure. E.g. "Tank1.level"
  - smoothType (number): Smoothing type constant.
    48 = Standard, 49 = Derivative, 50 = Flicker suppression.
  - stdType (number, optional): Standard smoothing sub-type.
  - stdTime (number, optional): Time window for smoothing.
  - stdTol (number, optional): Tolerance value for smoothing.

Returns:
  { "success": true, "dpeName": string, "smoothType": number }

Notes:
  - If smoothing is already configured on the DPE, this call updates the configuration.
  - Use smooth.smooth_config_delete to remove smoothing from a DPE.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to configure"),
        smoothType: z
          .number()
          .int()
          .refine((v) => v === 48 || v === 49 || v === 50, {
            message: "smoothType must be 48 (Standard), 49 (Derivative), or 50 (Flicker suppression)",
          })
          .describe("Smoothing type: 48 = Standard, 49 = Derivative, 50 = Flicker suppression"),
        stdType: z
          .number()
          .int()
          .optional()
          .describe("Standard smoothing sub-type"),
        stdTime: z
          .number()
          .optional()
          .describe("Time window for smoothing"),
        stdTol: z
          .number()
          .optional()
          .describe("Tolerance value for smoothing"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, smoothType, stdType, stdTime, stdTol }) => {
      const existError = checkDpesExist([dpeName]);
      if (existError) return existError;

      try {
        const winccoa = getWinccoa();

        const dpeAttrNames: string[] = [
          `${dpeName}:_smooth.._type`,
        ];
        const dpeAttrValues: unknown[] = [smoothType];

        if (stdType !== undefined) {
          dpeAttrNames.push(`${dpeName}:_smooth.._std_type`);
          dpeAttrValues.push(stdType);
        }
        if (stdTime !== undefined) {
          dpeAttrNames.push(`${dpeName}:_smooth.._std_time`);
          dpeAttrValues.push(stdTime);
        }
        if (stdTol !== undefined) {
          dpeAttrNames.push(`${dpeName}:_smooth.._std_tol`);
          dpeAttrValues.push(stdTol);
        }

        await winccoa.dpSetWait(dpeAttrNames, dpeAttrValues);

        return textContent(
          JSON.stringify({ success: true, dpeName, smoothType }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
