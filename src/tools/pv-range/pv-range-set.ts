/**
 * Tool: pv_range/pv_range_set
 *
 * Enable or update the process value range (_pv_range) configuration on a DPE.
 * Only valid for numeric DPEs (Int, UInt, Long, ULong, Float, and Dyn variants).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WinccoaElementType } from "winccoa-manager";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { checkDpesExist } from "../../utils/dp-exists-guard.js";
import { isNumericElementType } from "../../utils/type-guards.js";
import { DPCONFIG_PV_RANGE } from "../../constants/dp-configs.js";

export function registerPvRangeSet(server: McpServer): void {
  server.registerTool(
    "pv_range.pv_range_set",
    {
      title: "Set PV Range Configuration",
      description: `Enable or update the process value range (_pv_range) configuration
on a WinCC OA datapoint element (DPE).

Only numeric DPEs are supported (Int, UInt, Long, ULong, Float, and their
dynamic variants). Returns an error for Bool, String, or other non-numeric types.

Args:
  - dpeName (string): The DPE to configure. E.g. "Tank1.level"
  - min (number): Minimum process value (engineering range low).
  - max (number): Maximum process value (engineering range high). Must be > min.
  - correction (number, optional): Additive correction applied to raw values.
  - norm (number, optional): Normalisation factor applied to corrected values.

Returns:
  { "success": true, "dpeName": string }

Notes:
  - If a PV range is already configured, this call overwrites it.
  - Use pv_range.pv_range_get to verify the result.
  - Use pv_range.pv_range_delete to remove PV range configuration.`,
      inputSchema: {
        dpeName: z.string().min(1).describe("Datapoint element to configure"),
        min: z.number().describe("Minimum process value (engineering range low)"),
        max: z.number().describe("Maximum process value (engineering range high, must be > min)"),
        correction: z
          .number()
          .optional()
          .describe("Optional additive correction applied to raw values"),
        norm: z
          .number()
          .optional()
          .describe("Optional normalisation factor applied to corrected values"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, min, max, correction, norm }) => {
      if (min >= max) {
        return errorContent(`min (${min}) must be less than max (${max}).`);
      }

      const existError = checkDpesExist([dpeName]);
      if (existError) return existError;

      try {
        const winccoa = getWinccoa();

        // Validate numeric element type
        const elementType = winccoa.dpElementType(dpeName);
        if (!isNumericElementType(elementType)) {
          return errorContent(
            `"${dpeName}" has element type ${WinccoaElementType[elementType] ?? elementType}, ` +
              `which does not support PV range configuration. Only numeric types are supported.`,
          );
        }

        const dpeAttrNames: string[] = [
          `${dpeName}:_pv_range.._type`,
          `${dpeName}:_pv_range.._min`,
          `${dpeName}:_pv_range.._max`,
        ];
        const dpeAttrValues: unknown[] = [DPCONFIG_PV_RANGE, min, max];

        if (correction !== undefined) {
          dpeAttrNames.push(`${dpeName}:_pv_range.._correction`);
          dpeAttrValues.push(correction);
        }
        if (norm !== undefined) {
          dpeAttrNames.push(`${dpeName}:_pv_range.._norm`);
          dpeAttrValues.push(norm);
        }

        await winccoa.dpSetWait(dpeAttrNames, dpeAttrValues);

        return textContent(JSON.stringify({ success: true, dpeName }));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
