/**
 * Tool: datapoints/dp_delete
 *
 * Delete an existing datapoint.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerDpDelete(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_delete",
    {
      title: "Delete Datapoint",
      description: `Delete an existing WinCC OA datapoint.

⚠️  This is a destructive operation – the datapoint and all its configuration
    will be permanently removed.

Args:
  - dpName (string): Name of the datapoint to delete.
                     In a distributed system the name must include the system name
                     (e.g. "System1:myDp").

Returns:
  JSON object with:
  - "success": boolean
  - "dpName":  string  – name of the deleted datapoint

Error Handling:
  - Returns error if the datapoint does not exist.
  - Returns error if the current user has no privileges to delete the DP.`,
      inputSchema: {
        dpName: z.string().min(1, "Datapoint name is required").describe("Name of the datapoint to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ dpName }) => {
      try {
        const winccoa = getWinccoa();
        await winccoa.dpDelete(dpName);

        const output = { success: true, dpName };
        return textContent(JSON.stringify(output, null, 2));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
