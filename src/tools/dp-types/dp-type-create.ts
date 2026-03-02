/**
 * Tool: dp_types/dp_type_create
 *
 * Create a new datapoint type (DPT) with a defined element structure.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { jsonToNode, validElementTypeNames, DpTypeNodeInput } from "../../utils/dp-type-helpers.js";

// ---------------------------------------------------------------------------
// Recursive zod schema for a DPT node (create – no newName needed)
// ---------------------------------------------------------------------------

const dpTypeNodeSchema: z.ZodType<DpTypeNodeInput> = z.lazy(() =>
  z.object({
    name: z.string().min(1).describe("Element name"),
    elementTypeName: z
      .string()
      .describe(
        `Element data type. Valid values: ${validElementTypeNames().join(", ")}`,
      ),
    refName: z
      .string()
      .optional()
      .describe('Referenced DPT name – required when elementTypeName is "Typeref"'),
    children: z
      .array(dpTypeNodeSchema)
      .optional()
      .describe("Child elements (for Struct nodes)"),
  }),
);

export function registerDpTypeCreate(server: McpServer): void {
  server.registerTool(
    "dp_types.dp_type_create",
    {
      title: "Create Datapoint Type",
      description: `Create a new WinCC OA datapoint type (DPT) with a hierarchical element structure.

Args:
  - structure (object): Root node definition. The root node name becomes the DPT name.
      Node fields:
        - name (string):            Element name (root name = DPT name).
        - elementTypeName (string): Data type: ${validElementTypeNames().join(", ")}.
        - refName (string?):        Referenced DPT – required for "Typeref" elements.
        - children (array?):        Child nodes for "Struct" elements.

Returns:
  JSON object with:
  - "success":  boolean
  - "typeName": string – the root node name (= created DPT name)

Examples:
  Simple float DPT:
    structure = { name: "MySensor", elementTypeName: "Struct", children: [
      { name: "value", elementTypeName: "Float" }
    ]}

  DPT with Typeref:
    structure = { name: "MyDrive", elementTypeName: "Struct", children: [
      { name: "speed",   elementTypeName: "Float" },
      { name: "setpoint", elementTypeName: "Typeref", refName: "ExampleDP_Float" }
    ]}

Error Handling:
  - Returns error if a type with that name already exists.
  - Returns error if an unknown elementTypeName is specified.
  - Returns error if a Typeref references a non-existent type.`,
      inputSchema: {
        structure: dpTypeNodeSchema.describe("Root node of the new datapoint type"),
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
        await winccoa.dpTypeCreate(rootNode);

        const output = { success: true, typeName: structure.name };
        return textContent(JSON.stringify(output, null, 2));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
