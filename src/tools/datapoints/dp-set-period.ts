/**
 * Tool: datapoints/dp_set_period
 *
 * Batch time-series write: write multiple datapoint values each with its own
 * explicit timestamp. Useful for back-filling a series of historical values.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent } from "../../utils/formatters.js";

export function registerDpSetPeriod(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_set_period",
    {
      title: "Set Datapoint Values for a Period (Batch)",
      description: `Write multiple datapoint element values each with its own explicit
timestamp. Entries are processed in array order — one dpSetTimedWait call per entry.

A failure on one entry is captured and reported; the remaining entries are still
processed (per-entry error isolation — the batch is never aborted on a single error).

For more than 500 points, call repeatedly with non-overlapping time windows.

Args:
  - entries (array): Array of up to 500 objects, each with:
    - time (string):    ISO 8601 timestamp for this value.
    - dpeName (string): Datapoint element name to write.
    - value (unknown):  Value to set.

Returns:
  Array of result objects, one per input entry:
  - "index":   number   – position in the input array (0-based)
  - "time":    string   – the entry's timestamp as supplied
  - "dpeName": string   – the entry's DPE name
  - "success": boolean  – whether the write succeeded
  - "error":   string?  – error message if success is false

Error Handling:
  - Returns error if entries array is empty or exceeds 500 elements.
  - Individual entry errors appear in the per-entry result, not as a top-level error.`,
      inputSchema: {
        entries: z
          .array(
            z.object({
              time: z.string().datetime().describe("ISO 8601 timestamp for this value"),
              dpeName: z.string().min(1).describe("Datapoint element name"),
              value: z.unknown().describe("Value to set"),
            }),
          )
          .min(1, "At least one entry is required")
          .max(500, "Maximum 500 entries per call — use multiple calls for larger datasets")
          .describe("Array of timestamped writes to perform"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ entries }) => {
      const winccoa = getWinccoa();

      const results: {
        index: number;
        time: string;
        dpeName: string;
        success: boolean;
        error?: string;
      }[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        try {
          await winccoa.dpSetTimedWait(new Date(entry.time), entry.dpeName, entry.value);
          results.push({ index: i, time: entry.time, dpeName: entry.dpeName, success: true });
        } catch (err: unknown) {
          results.push({
            index: i,
            time: entry.time,
            dpeName: entry.dpeName,
            success: false,
            error: handleWinccoaError(err),
          });
        }
      }

      return textContent(safeJsonStringify(results));
    },
  );
}
