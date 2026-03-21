/**
 * Tool: distrib/distrib_config_set
 *
 * Enable or update distribution configuration on a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { checkDpesExist } from "../../utils/dp-exists-guard.js";
import { DPCONFIG_DISTRIB } from "../../constants/dp-configs.js";

export function registerDistribConfigSet(server: McpServer): void {
  server.registerTool(
    "distrib.distrib_config_set",
    {
      title: "Set Distribution Configuration",
      description: `Enable or update the distribution configuration on a WinCC OA
datapoint element (DPE).

Args:
  - dpeName (string): The DPE to configure. E.g. "Tank1.level"
  - driverNumber (number): Driver number (1–255) that owns this DPE
    in a distributed system.

Returns:
  { "success": true, "dpeName": string, "driverNumber": number }

Notes:
  - If distribution is already configured on the DPE, this call updates it.
  - Use distrib.distrib_config_delete to remove distribution from a DPE.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to configure"),
        driverNumber: z
          .number()
          .int()
          .min(1)
          .max(255)
          .describe("Driver number (1–255)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, driverNumber }) => {
      const existError = checkDpesExist([dpeName]);
      if (existError) return existError;

      try {
        const winccoa = getWinccoa();

        const dpeAttrNames: string[] = [
          `${dpeName}:_distrib.._type`,
          `${dpeName}:_distrib.._driver`,
        ];
        const dpeAttrValues: unknown[] = [DPCONFIG_DISTRIB, driverNumber];

        await winccoa.dpSetWait(dpeAttrNames, dpeAttrValues);

        return textContent(
          JSON.stringify({ success: true, dpeName, driverNumber }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
