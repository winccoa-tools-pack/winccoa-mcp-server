/**
 * Tool: pv_range/pv_range_delete
 *
 * Disable the process value range (_pv_range) configuration on one or more DPEs
 * by setting their config type to DPCONFIG_NONE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent } from "../../utils/formatters.js";
import { DPCONFIG_NONE } from "../../constants/dp-configs.js";

export function registerPvRangeDelete(server: McpServer): void {
  server.registerTool(
    "pv_range.pv_range_delete",
    {
      title: "Delete PV Range Configuration",
      description: `Disable the process value range (_pv_range) configuration on one or
more WinCC OA datapoint elements (DPEs) by setting their config type to DPCONFIG_NONE.

Args:
  - dpeNames (string[]): DPE names whose PV range config should be disabled.
    E.g. ["Tank1.level", "Tank2.level"]

Returns:
  JSON object mapping each DPE name to a result:
  {
    "Tank1.level": { "success": true },
    "Tank2.level": { "success": false, "error": "..." }
  }

  Each DPE is processed individually so a failure on one does not abort the rest.

Notes:
  - Use pv_range.pv_range_set to re-enable or change PV range configuration.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to disable PV range on"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeNames }) => {
      const winccoa = getWinccoa();

      const results: Record<string, { success: boolean; error?: string }> = {};

      for (const dpe of dpeNames) {
        try {
          await winccoa.dpSetWait(`${dpe}:_pv_range.._type`, DPCONFIG_NONE);
          results[dpe] = { success: true };
        } catch (error: unknown) {
          results[dpe] = { success: false, error: handleWinccoaError(error) };
        }
      }

      return textContent(safeJsonStringify(results));
    },
  );
}
