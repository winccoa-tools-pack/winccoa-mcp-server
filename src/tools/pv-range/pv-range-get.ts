/**
 * Tool: pv_range/pv_range_get
 *
 * Read the process value range (_pv_range) configuration for a single DPE.
 * Only valid for numeric DPEs (Int, UInt, Long, ULong, Float, and Dyn variants).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WinccoaElementType } from "winccoa-manager";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { isNumericElementType } from "../../utils/type-guards.js";
import { DPCONFIG_NONE } from "../../constants/dp-configs.js";

export function registerPvRangeGet(server: McpServer): void {
  server.registerTool(
    "pv_range.pv_range_get",
    {
      title: "Get PV Range Configuration",
      description: `Read the process value range (_pv_range) configuration for a
WinCC OA datapoint element (DPE).

Only numeric DPEs are supported (Int, UInt, Long, ULong, Float, and their
dynamic variants). Returns an error for Bool, String, or other non-numeric types.

Args:
  - dpeName (string): The DPE to read PV range config from. E.g. "Tank1.level"

Returns one of:
  { "dpeName": string, "enabled": false }
  — when no PV range is configured.

  {
    "dpeName": string,
    "enabled": true,
    "min": number,
    "max": number,
    "correction": number | undefined,
    "norm": number | undefined
  }
  — when PV range is configured.

Notes:
  - Use pv_range.pv_range_set to enable or update PV range configuration.
  - Use pv_range.pv_range_delete to remove PV range configuration.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to read PV range config from"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName }) => {
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

        const attrs = [
          `${dpeName}:_pv_range.._type`,
          `${dpeName}:_pv_range.._min`,
          `${dpeName}:_pv_range.._max`,
          `${dpeName}:_pv_range.._correction`,
          `${dpeName}:_pv_range.._norm`,
        ];
        const raw = (await winccoa.dpGet(attrs)) as unknown[];
        const configType = raw[0] as number;

        if (configType === DPCONFIG_NONE || configType === undefined || configType === null) {
          return textContent(safeJsonStringify({ dpeName, enabled: false }));
        }

        const result: Record<string, unknown> = {
          dpeName,
          enabled: true,
          min: raw[1],
          max: raw[2],
        };

        if (raw[3] !== undefined && raw[3] !== null) {
          result["correction"] = raw[3];
        }
        if (raw[4] !== undefined && raw[4] !== null) {
          result["norm"] = raw[4];
        }

        return textContent(safeJsonStringify(result));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
