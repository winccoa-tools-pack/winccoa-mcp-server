/**
 * Tool: datapoints/dp_names
 *
 * List datapoints or datapoint elements matching a pattern, with pagination.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

/** Maximum result set size at which enrichment (dpTypeName, dpGetDescription) is allowed. */
const ENRICHMENT_LIMIT = 50;

export function registerDpNames(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_names",
    {
      title: "List Datapoint Names",
      description: `List WinCC OA datapoints or datapoint elements that match a pattern.

Results are returned in alphabetical order. Pagination is supported via limit and offset.
Enrichment (type name or description) is available only when the paginated result set
contains ≤ ${ENRICHMENT_LIMIT} DPs (to prevent excessive API calls on large result sets).

Args:
  - dpPattern (string):          Wildcard pattern for matching DP names.
                                 Supports: * (any chars), ? (single char),
                                 [0,3,5-7] (ranges), {opt1,opt2} (alternatives).
                                 Default: "*" (all datapoints).
  - dpType (string):             Filter by datapoint type (optional).
  - ignoreCase (boolean):        Case-insensitive matching (default: false).
  - limit (number):              Maximum number of DP names to return (1–500, default: 200).
  - offset (number):             Zero-based index to start from (default: 0).
  - includeTypeName (boolean):   If true and result ≤ ${ENRICHMENT_LIMIT} DPs, adds type name
                                 for each DP (default: false).
  - includeDescription (boolean):If true and result ≤ ${ENRICHMENT_LIMIT} DPs, adds description
                                 for each DP (default: false).

Returns:
  JSON object with:
  - "pattern":      string
  - "dpType":       string | null
  - "total":        number  – total matching DPs before pagination
  - "offset":       number
  - "limit":        number
  - "count":        number  – DPs returned in this page
  - "dpNames":      string[]
  - "typeNames":    Record<string,string> | undefined  – if includeTypeName=true
  - "descriptions": Record<string,unknown> | undefined – if includeDescription=true`,
      inputSchema: {
        dpPattern: z
          .string()
          .default("*")
          .describe('Wildcard pattern for DP names (default: "*" = all)'),
        dpType: z
          .string()
          .optional()
          .describe("Filter by datapoint type (optional)"),
        ignoreCase: z
          .boolean()
          .default(false)
          .describe("Case-insensitive matching (default: false)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(500)
          .default(200)
          .describe("Maximum number of results to return (1–500, default: 200)"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Zero-based offset to start from (default: 0)"),
        includeTypeName: z
          .boolean()
          .default(false)
          .describe(`Include DP type name for each result (only when result set ≤ ${ENRICHMENT_LIMIT})`),
        includeDescription: z
          .boolean()
          .default(false)
          .describe(`Include DP description for each result (only when result set ≤ ${ENRICHMENT_LIMIT})`),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpPattern, dpType, ignoreCase, limit, offset, includeTypeName, includeDescription }) => {
      try {
        const winccoa = getWinccoa();
        const allNames = winccoa.dpNames(dpPattern, dpType ?? "", ignoreCase);

        const total = allNames.length;
        const page = allNames.slice(offset, offset + limit);
        const count = page.length;

        const output: Record<string, unknown> = {
          pattern: dpPattern,
          dpType: dpType ?? null,
          total,
          offset,
          limit,
          count,
          dpNames: page,
        };

        // Enrichment: only apply if the page is small enough to avoid O(n) overhead
        if ((includeTypeName || includeDescription) && count > 0) {
          if (count > ENRICHMENT_LIMIT) {
            output["enrichmentSkipped"] =
              `Enrichment is only available when the result set has ≤ ${ENRICHMENT_LIMIT} DPs. ` +
              `Current page has ${count} DPs. Use a more specific pattern or reduce the limit.`;
          } else {
            if (includeTypeName) {
              const typeNames: Record<string, string> = {};
              for (const dp of page) {
                try {
                  typeNames[dp] = winccoa.dpTypeName(dp);
                } catch {
                  typeNames[dp] = "";
                }
              }
              output["typeNames"] = typeNames;
            }

            if (includeDescription) {
              const descriptions: Record<string, unknown> = {};
              for (const dp of page) {
                try {
                  descriptions[dp] = winccoa.dpGetDescription(dp);
                } catch {
                  descriptions[dp] = null;
                }
              }
              output["descriptions"] = descriptions;
            }
          }
        }

        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}

