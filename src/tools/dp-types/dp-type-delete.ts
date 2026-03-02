/**
 * Tool: dp_types/dp_type_delete
 *
 * Delete an existing datapoint type (DPT).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerDpTypeDelete(server: McpServer): void {
  server.registerTool(
    "dp_types.dp_type_delete",
    {
      title: "Delete Datapoint Type",
      description: `Delete an existing WinCC OA datapoint type (DPT).

IMPORTANT: All datapoints of this type must be deleted before the type can be
removed. Use datapoints.dp_names to find datapoints of the type, then datapoints.dp_delete
to remove them first.

Args:
  - typeName (string): Name of the datapoint type to delete (e.g. "MyDPType").

Returns:
  JSON object with:
  - "success":  boolean
  - "typeName": string – the deleted DPT name

Examples:
  - Delete a type:  typeName = "ObsoleteType"

Error Handling:
  - Returns error if the DPT does not exist.
  - Returns error if datapoints of this type still exist (delete DPs first).`,
      inputSchema: {
        typeName: z
          .string()
          .min(1, "Datapoint type name is required")
          .describe("Name of the datapoint type to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ typeName }) => {
      try {
        const winccoa = getWinccoa();
        await winccoa.dpTypeDelete(typeName);

        const output = { success: true, typeName };
        return textContent(JSON.stringify(output, null, 2));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
