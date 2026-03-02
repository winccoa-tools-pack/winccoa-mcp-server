/**
 * Tool: datapoints/dp_query
 *
 * Run a WinCC OA SQL-like query on datapoint attributes.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerDpQuery(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_query",
    {
      title: "Query Datapoints (SQL)",
      description: `Execute a WinCC OA SQL-like query to retrieve datapoint attribute values.

WinCC OA supports a subset of SQL for querying datapoint attributes.

Args:
  - query (string): SQL-like query string.

Returns:
  JSON object with:
  - "query":    string       – the query that was executed
  - "rowCount": number       – number of result rows
  - "rows":     unknown[][]  – the result table (first row contains column headers)

Examples:
  - Get values:
      query = "SELECT '_original.._stime', '_original.._value' FROM 'ExampleDP_Arg*'"
  - With type filter:
      query = "SELECT '_online.._value' FROM '*' WHERE _DPT = \\"ExampleDP_Float\\""

Error Handling:
  - Returns error if the query string is invalid.
  - Large result sets will be truncated to stay within the response size limit.`,
      inputSchema: {
        query: z.string().min(1, "Query string is required").describe("WinCC OA SQL-like query string"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }) => {
      try {
        const winccoa = getWinccoa();
        const rows = await winccoa.dpQuery(query);

        const output = {
          query,
          rowCount: rows.length,
          rows,
        };
        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
