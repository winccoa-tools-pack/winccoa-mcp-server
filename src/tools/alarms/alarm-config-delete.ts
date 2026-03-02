/**
 * Tool: alarms/alarm_config_delete
 *
 * Disable alarm configuration on one or more DPEs by setting their
 * _alert_hdl config type to DPCONFIG_NONE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent } from "../../utils/formatters.js";
import { DPCONFIG_NONE } from "../../constants/dp-configs.js";

export function registerAlarmConfigDelete(server: McpServer): void {
  server.registerTool(
    "alarms.alarm_config_delete",
    {
      title: "Delete Alarm Configuration",
      description: `Disable alarm (_alert_hdl) configuration on one or more WinCC OA
datapoint elements (DPEs) by setting their config type to DPCONFIG_NONE.

Args:
  - dpeNames (string[]): DPE names whose alarm config should be removed.
    E.g. ["Tank1.level", "Motor1.running"]

Returns:
  JSON object mapping each DPE name to a result:
  {
    "Tank1.level": { "success": true },
    "Motor1.running": { "success": false, "error": "..." }
  }

  Each DPE is processed individually so a failure on one does not abort the rest.

Notes:
  - This only removes the alarm configuration — it does NOT delete historical
    alarm log data. Use alarms.alarm_log_get to query past alarm events.
  - Use alarms.alarm_config_set to re-enable alarms.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to remove alarm config from"),
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
          await winccoa.dpSetWait(`${dpe}:_alert_hdl.._type`, DPCONFIG_NONE);
          results[dpe] = { success: true };
        } catch (error: unknown) {
          results[dpe] = { success: false, error: handleWinccoaError(error) };
        }
      }

      return textContent(safeJsonStringify(results));
    },
  );
}
