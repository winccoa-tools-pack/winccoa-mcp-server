/**
 * Tool: dp_types/dp_type_change
 *
 * Modify an existing datapoint type – change element data types or rename elements.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { jsonToNode, validElementTypeNames, DpTypeNodeInput } from "../../utils/dp-type-helpers.js";

// ---------------------------------------------------------------------------
// Recursive zod schema for a DPT node (change – newName is allowed)
// ---------------------------------------------------------------------------

const dpTypeNodeSchema: z.ZodType<DpTypeNodeInput> = z.lazy(() =>
  z.object({
    name: z.string().min(1).describe("Current element name"),
    elementTypeName: z
      .string()
      .describe(
        `Element data type. Valid values: ${validElementTypeNames().join(", ")}`,
      ),
    refName: z
      .string()
      .optional()
      .describe('Referenced DPT name – required when elementTypeName is "Typeref"'),
    newName: z
      .string()
      .optional()
      .describe("New name for this element (renames the element if provided)"),
    children: z
      .array(dpTypeNodeSchema)
      .optional()
      .describe("Child elements (for Struct nodes)"),
  }),
);

export function registerDpTypeChange(server: McpServer): void {
  server.registerTool(
    "dp_types.dp_type_change",
    {
      title: "Change Datapoint Type",
      description: `Modify an existing WinCC OA datapoint type – change element data types or rename elements.

The structure must mirror the existing DPT hierarchy. Only the fields you want to
change need differ from the current definition. Set "newName" on any node to rename
that element.

Args:
  - structure (object): Root node matching the existing DPT. The root node "name"
      must be the existing DPT name.
      Node fields:
        - name (string):            Current element name (root name = DPT name).
        - elementTypeName (string): Data type: ${validElementTypeNames().join(", ")}.
        - refName (string?):        Referenced DPT – for "Typeref" elements.
        - newName (string?):        Renames this element when provided.
        - children (array?):        Child nodes for "Struct" elements.

Returns:
  JSON object with:
  - "success":  boolean
  - "typeName": string – the root node name (= modified DPT name)

Examples:
  Change element type (regratio from Float to Int):
    structure = { name: "valve", elementTypeName: "Struct", children: [
      { name: "defaults", elementTypeName: "Struct", children: [
        { name: "regratio", elementTypeName: "Int" }
      ]}
    ]}

  Rename an element:
    structure = { name: "valve", elementTypeName: "Struct", children: [
      { name: "defaults", elementTypeName: "Struct",
        newName: "defaults_renamed", children: [
        { name: "regratio", elementTypeName: "Float", newName: "regratio_renamed" }
      ]}
    ]}

Error Handling:
  - Returns error if the specified DPT does not exist.
  - Returns error if an unknown elementTypeName is specified.`,
      inputSchema: {
        structure: dpTypeNodeSchema.describe(
          "Root node of the existing datapoint type with desired changes",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ structure }) => {
      try {
        const winccoa = getWinccoa();
        const rootNode = jsonToNode(structure);
        await winccoa.dpTypeChange(rootNode);

        const output = { success: true, typeName: structure.name };
        return textContent(JSON.stringify(output, null, 2));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
