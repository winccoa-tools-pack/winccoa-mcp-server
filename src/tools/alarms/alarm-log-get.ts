/**
 * Tool: alarms/alarm_log_get
 *
 * Query historical alarm (alert) events for one or more DPEs over a time range.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { toIsoString, validateTimeRange } from "../../utils/time-helpers.js";
import type { WinccoaAlertTime } from "winccoa-manager";

export function registerAlarmLogGet(server: McpServer): void {
  server.registerTool(
    "alarms.alarm_log_get",
    {
      title: "Get Alarm Log",
      description: `Query historical alarm (alert) events for one or more WinCC OA
datapoint elements (DPEs) over a given time range.

Args:
  - dpeNames (string[]): DPE names whose alarm history to query.
    E.g. ["Tank1.level", "Motor1.running"]
  - startTime (string): ISO 8601 start of the time range (inclusive).
    E.g. "2025-01-01T00:00:00.000Z"
  - endTime (string): ISO 8601 end of the time range (exclusive).
  - count (number, optional, default 200, max 1000):
    Maximum number of alarm events to return in total.

Returns:
  {
    "alertEvents": [
      {
        "time": string,   // ISO 8601 timestamp of the alarm event
        "count": number,  // alert count at this time
        "dpe": string     // DPE that triggered the alarm
      }
    ],
    "values": unknown[]   // corresponding alarm values (acknowledged state, etc.)
  }

Notes:
  - Only DPEs with alarm configuration will have alarm history.
  - Use alarms.alarm_config_get to check whether alarms are configured.
  - Use the count parameter to limit the response size for busy alarm sources.
  - The response may be truncated if it exceeds the size limit; reduce the
    time range or lower count to avoid truncation.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to query alarm events for"),
        startTime: z
          .string()
          .datetime()
          .describe("Start of time range (ISO 8601)"),
        endTime: z
          .string()
          .datetime()
          .describe("End of time range (ISO 8601)"),
        count: z
          .number()
          .int()
          .positive()
          .max(1000)
          .optional()
          .default(200)
          .describe("Maximum number of alarm events to return (default: 200, max: 1000)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeNames, startTime, endTime, count }) => {
      const rangeError = validateTimeRange(startTime, endTime);
      if (rangeError) {
        return errorContent(rangeError);
      }

      try {
        const winccoa = getWinccoa();
        const start = new Date(startTime);
        const end = new Date(endTime);

        const raw = await winccoa.alertGetPeriod(start, end, dpeNames, count);

        const alertEvents = (raw.alertTimes ?? []).map(
          (at: WinccoaAlertTime) => ({
            time: toIsoString(at.time),
            count: at.count,
            dpe: at.dpe,
          }),
        );

        return textContent(
          safeJsonStringify({ alertEvents, values: raw.values ?? [] }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
