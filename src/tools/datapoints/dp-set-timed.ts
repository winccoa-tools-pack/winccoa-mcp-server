/**
 * Tool: datapoints/dp_set_timed
 *
 * Write one or more datapoint values with an explicit timestamp (back-fill).
 * Useful for injecting historical data into the archive or correcting values
 * without rerunning the source process.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerDpSetTimed(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_set_timed",
    {
      title: "Set Datapoint Values with Timestamp",
      description: `Write one or more WinCC OA datapoint element values with an explicit
timestamp. The same timestamp is applied to ALL specified DPEs.

This is used for:
- Back-filling historical values into the archive with the correct original timestamp.
- Testing archive queries by injecting known data at controlled timestamps.
- Correcting values in the historian without re-running the source process.

WinCC OA applies the SAME timestamp to all DPEs in dpeNames. If you need to set
different timestamps per DPE, call this tool once per timestamp.

The write is CONFIRMED — dpSetTimedWait is used internally, not fire-and-forget.

Args:
  - time (string):       ISO 8601 timestamp string, e.g. "2024-01-15T10:30:00.000Z".
  - dpeNames (string[]): Datapoint element name(s) to write.
  - values (unknown[]):  Values to set — must match dpeNames in length and order.

Returns:
  JSON object with:
  - "success": boolean  – always true if no error thrown
  - "time":    string   – the timestamp as supplied
  - "count":   number   – number of DPEs written

Error Handling:
  - Returns error if dpeNames and values have different lengths.
  - Returns error if the timestamp is invalid.
  - Returns error if any DPE does not exist or write is rejected.`,
      inputSchema: {
        time: z
          .string()
          .datetime()
          .describe("ISO 8601 timestamp for the write (e.g. 2024-01-15T10:30:00.000Z)"),
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to write — same timestamp applies to all"),
        values: z
          .array(z.unknown())
          .min(1, "At least one value is required")
          .describe("Values to set — must match dpeNames in length and order"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ time, dpeNames, values }) => {
      try {
        if (dpeNames.length !== values.length) {
          return errorContent(
            `dpeNames (${dpeNames.length}) and values (${values.length}) must have the same length.`,
          );
        }

        const winccoa = getWinccoa();
        const timestamp = new Date(time);

        await winccoa.dpSetTimedWait(timestamp, dpeNames, values);

        const output = { success: true, time, count: dpeNames.length };
        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
