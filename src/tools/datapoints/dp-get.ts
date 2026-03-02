/**
 * Tool: datapoints/dp_get
 *
 * Read current values of one or more datapoint elements.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerDpGet(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_get",
    {
      title: "Get Datapoint Values",
      description: `Read the current value(s) of one or more WinCC OA datapoint elements.

Args:
  - dpeNames (string[]): One or more datapoint element names to read.
    Each name follows the WinCC OA naming convention, e.g. "ExampleDP_Arg1." or
    "System1:ExampleDP_Arg1.".
    NOTE: Wildcards (* or ?) are not supported. Use datapoints/dp_names to list DPs first.
  - includeTimestamp (boolean): If true, fetches the online timestamp (:_online.._stime)
    for each DPE alongside its value. Default: false.
  - includeUnit (boolean): If true, fetches the configured unit for each DPE.
    Default: false.

Returns:
  JSON object with:
  - "dpeNames": string[]  – the requested DPE names
  - "values":   unknown[] – the corresponding current values
  - "timestamps": string[] | undefined – ISO timestamps if includeTimestamp=true
  - "units":    unknown[] | undefined  – units if includeUnit=true

Examples:
  - Read a single DPE:            dpeNames = ["ExampleDP_Arg1."]
  - Read multiple DPEs:           dpeNames = ["ExampleDP_Arg1.", "ExampleDP_Arg2."]
  - Read values with timestamps:  dpeNames = ["ExampleDP_Arg1."], includeTimestamp = true

Error Handling:
  - Returns error if any DPE name contains wildcards (use datapoints/dp_names instead).
  - Returns error if any DPE does not exist.
  - Returns error if the current user has no read access.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to read (no wildcards)"),
        includeTimestamp: z
          .boolean()
          .default(false)
          .describe("If true, also fetches the online timestamp for each DPE"),
        includeUnit: z
          .boolean()
          .default(false)
          .describe("If true, also fetches the configured unit for each DPE"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeNames, includeTimestamp, includeUnit }) => {
      try {
        // Guard against wildcards — dpGet does not support pattern matching
        if (dpeNames.some((n) => n.includes("*") || n.includes("?"))) {
          return errorContent(
            "dpGet does not support wildcards. Use datapoints.dp_names to list DPs first, then pass exact names.",
          );
        }

        const winccoa = getWinccoa();

        // Fetch values (and optionally timestamps) in a single dpGet call
        let fetchNames = dpeNames;
        if (includeTimestamp) {
          const sTimeNames = dpeNames.map((n) => `${n}:_online.._stime`);
          fetchNames = [...dpeNames, ...sTimeNames];
        }

        const raw = await winccoa.dpGet(fetchNames);
        const allValues = fetchNames.length === 1 ? [raw] : (raw as unknown[]);

        const values = allValues.slice(0, dpeNames.length);
        const rawTimestamps = includeTimestamp
          ? allValues.slice(dpeNames.length)
          : undefined;

        // Serialise timestamps to ISO strings
        const timestamps = rawTimestamps?.map((t) =>
          t instanceof Date ? t.toISOString() : typeof t === "number" ? new Date(t).toISOString() : String(t),
        );

        // Optionally fetch units (one call per DPE — only if requested)
        let units: unknown[] | undefined;
        if (includeUnit) {
          units = dpeNames.map((dpe) => {
            try {
              return winccoa.dpGetUnit(dpe);
            } catch {
              return null;
            }
          });
        }

        const output: Record<string, unknown> = { dpeNames, values };
        if (timestamps) output["timestamps"] = timestamps;
        if (units) output["units"] = units;

        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}

