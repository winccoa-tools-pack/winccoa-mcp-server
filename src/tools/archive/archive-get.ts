/**
 * Tool: archive/archive_get
 *
 * Query historical (archived) values for one or more datapoint elements
 * over a given time range.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { toIsoString, validateTimeRange } from "../../utils/time-helpers.js";

export function registerArchiveGet(server: McpServer): void {
  server.registerTool(
    "archive.archive_get",
    {
      title: "Get Historical Archive Data",
      description: `Query historical (archived) values for one or more WinCC OA datapoint
elements (DPEs) over a time range.

Args:
  - dpeNames (string[]): One or more DPE names to query. Must have archiving enabled.
    E.g. ["Tank1.level", "Pump1.speed"]
  - startTime (string): ISO 8601 start of the time range (inclusive).
    E.g. "2025-01-01T00:00:00.000Z"
  - endTime (string): ISO 8601 end of the time range (exclusive).
  - count (number, optional): Maximum number of samples to return per DPE.
    Use this to cap result size for heavily archived DPEs.

Returns:
  JSON array, one entry per DPE:
  {
    "dpeName": string,
    "times": string[],    // ISO 8601 timestamps of each sample
    "values": unknown[]   // corresponding archived values
  }

Notes:
  - Only DPEs with an active archive configuration will have data.
  - Use archive.archive_config_get to check whether archiving is enabled.
  - Use the count parameter to reduce response size for long time windows.
  - The response is truncated if it exceeds the character limit; narrow the
    time range or increase count to avoid truncation.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to query"),
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
          .optional()
          .describe("Maximum samples per DPE (optional)"),
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

        const raw = await winccoa.dpGetPeriod(start, end, dpeNames, count);

        const result = dpeNames.map((dpeName, i) => {
          const entry = raw[i] ?? { times: [], values: [] };
          return {
            dpeName,
            times: (entry.times ?? []).map(toIsoString),
            values: entry.values ?? [],
          };
        });

        return textContent(safeJsonStringify(result));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
