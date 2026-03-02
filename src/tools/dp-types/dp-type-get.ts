/**
 * Tool: dp_types/dp_type_get
 *
 * Retrieve the full element structure of a datapoint type.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { nodeToJson, validElementTypeNames } from "../../utils/dp-type-helpers.js";

export function registerDpTypeGet(server: McpServer): void {
  server.registerTool(
    "dp_types.dp_type_get",
    {
      title: "Get Datapoint Type Structure",
      description: `Retrieve the full element structure of a WinCC OA datapoint type (DPT).

Args:
  - typeName (string):          Name of the datapoint type, e.g. "ExampleDP_Float".
  - includeSubTypes (boolean):  When true, referenced sub-types are included in
                                the returned structure. Default: false.

Returns:
  JSON object with:
  - "typeName":  string  – the queried DPT name
  - "structure": object  – recursive node tree with fields:
      - "name":            string  – element name
      - "elementType":     number  – WinccoaElementType enum value
      - "elementTypeName": string  – human-readable type (${validElementTypeNames().join(", ")})
      - "refName":         string? – referenced DPT name (for Typeref elements)
      - "children":        array?  – child nodes (same structure)

Examples:
  - Get type structure: typeName = "ExampleDP_Float"
  - With sub-types:     typeName = "MyComplexType", includeSubTypes = true

Error Handling:
  - Returns error if the named datapoint type does not exist.`,
      inputSchema: {
        typeName: z
          .string()
          .min(1, "Datapoint type name is required")
          .describe("Name of the datapoint type to retrieve"),
        includeSubTypes: z
          .boolean()
          .default(false)
          .describe("Include referenced sub-types in the structure (default: false)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ typeName, includeSubTypes }) => {
      try {
        const winccoa = getWinccoa();
        const node = winccoa.dpTypeGet(typeName, includeSubTypes);

        const output = {
          typeName,
          structure: nodeToJson(node),
        };
        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
