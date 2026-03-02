/**
 * Tool: datapoints/dp_set
 *
 * Write values to one or more datapoint elements with per-DP error isolation.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerDpSet(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_set",
    {
      title: "Set Datapoint Values",
      description: `Write value(s) to one or more WinCC OA datapoint elements.

When writing to multiple DPEs, each write is isolated — a failure on one DPE
does not abort the others. The response contains a per-DPE result map.

Args:
  - dpeNames (string[]):  Datapoint element name(s) to write.
  - values (unknown[]):   Values to set – must match dpeNames in length and order.
  - wait (boolean):       If true (default), waits for the database to confirm each
                          write (dpSetWait). If false, fires and forgets (dpSet).

Returns:
  JSON object with:
  - "results": Record<string, { success: boolean; error?: string }>
               A map from each DPE name to its write result.
  - "waited":  boolean – whether dpSetWait was used

Examples:
  - Set one value:       dpeNames = ["ExampleDP_Arg1."], values = [42]
  - Set multiple values: dpeNames = ["ExampleDP_Arg1.", "ExampleDP_DDE.b1"],
                         values = [123.456, false]

Error Handling:
  - Returns error if array sizes mismatch.
  - Individual DPE failures are captured in the results map, not as a top-level error.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to write"),
        values: z
          .array(z.unknown())
          .min(1, "At least one value is required")
          .describe("Values to set – must match dpeNames in length and order"),
        wait: z
          .boolean()
          .default(true)
          .describe(
            "If true, waits for the value to be confirmed in the database (dpSetWait). " +
            "If false, fires and forgets (dpSet). Default: true.",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeNames, values, wait }) => {
      if (dpeNames.length !== values.length) {
        return errorContent(
          `dpeNames (${dpeNames.length}) and values (${values.length}) must have the same length.`,
        );
      }

      const winccoa = getWinccoa();
      const results: Record<string, { success: boolean; error?: string }> = {};

      if (wait) {
        // Per-DP isolated writes with dpSetWait
        for (let i = 0; i < dpeNames.length; i++) {
          try {
            await winccoa.dpSetWait(dpeNames[i]!, values[i]!);
            results[dpeNames[i]!] = { success: true };
          } catch (e: unknown) {
            results[dpeNames[i]!] = { success: false, error: handleWinccoaError(e) };
          }
        }
      } else {
        // Fire-and-forget: batch call, then mark all as success
        try {
          winccoa.dpSet(dpeNames, values);
          for (const dpe of dpeNames) {
            results[dpe] = { success: true };
          }
        } catch (e: unknown) {
          const msg = handleWinccoaError(e);
          for (const dpe of dpeNames) {
            results[dpe] = { success: false, error: msg };
          }
        }
      }

      return textContent(safeJsonStringify({ results, waited: wait }));
    },
  );
}

