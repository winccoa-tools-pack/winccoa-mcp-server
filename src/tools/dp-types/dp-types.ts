/**
 * Tool: dp_types/dp_types
 *
 * List all datapoint types matching a pattern.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerDpTypes(server: McpServer): void {
  server.registerTool(
    "dp_types.dp_types",
    {
      title: "List Datapoint Types",
      description: `List all WinCC OA datapoint types that match a pattern.

Args:
  - pattern (string):      Wildcard pattern for matching type names.
                           Default: "" (all types).
  - systemId (number):     Optional system ID to query another system.
  - includeEmpty (boolean): If false, types without existing DPs are excluded.
                           Default: true.

Returns:
  JSON object with:
  - "pattern":  string
  - "count":    number
  - "dpTypes":  string[]`,
      inputSchema: {
        pattern: z
          .string()
          .default("")
          .describe('Wildcard pattern for type names (default: "" = all)'),
        systemId: z
          .number()
          .int()
          .optional()
          .describe("System ID for querying remote systems (optional)"),
        includeEmpty: z
          .boolean()
          .default(true)
          .describe("Include types without existing DPs (default: true)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pattern, systemId, includeEmpty }) => {
      try {
        const winccoa = getWinccoa();
        const dpTypes = winccoa.dpTypes(pattern, systemId, includeEmpty);

        const output = {
          pattern,
          count: dpTypes.length,
          dpTypes,
        };
        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
