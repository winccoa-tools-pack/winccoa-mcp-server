/**
 * Tool: opcua/opcua_connection_delete
 *
 * Delete an OPC UA connection datapoint from the WinCC OA project.
 * Uses dpDelete with a pre-flight existence check.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerOpcUaConnectionDelete(server: McpServer): void {
  server.registerTool(
    "opcua.opcua_connection_delete",
    {
      title: "Delete OPC UA Connection",
      description: `Delete an OPC UA connection datapoint from the WinCC OA project.

This removes the _OpcUAConnections datapoint and all its attributes. Any DPEs
that were mapped to OPC UA node IDs via this connection will lose their mapping.

Args:
  - connectionName (string): Name of the OPC UA connection DP to delete.
    Use opcua/opcua_connection_list to see available connections.

Returns:
  Confirmation that the connection was deleted.

Notes:
  - This action is irreversible. Export the DP first if you need a backup
    (use ascii/ascii_export).
  - The OPC UA driver should be restarted after deleting a connection to
    release the associated driver resources.
  - Active DPE-to-node mappings for this connection will become orphaned.`,
      inputSchema: {
        connectionName: z
          .string()
          .min(1)
          .describe("Name of the OPC UA connection DP to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ connectionName }) => {
      try {
        const winccoa = getWinccoa();

        if (!winccoa.dpExists(connectionName)) {
          return errorContent(
            `OPC UA connection "${connectionName}" does not exist. ` +
            `Use opcua/opcua_connection_list to see available connections.`,
          );
        }

        // Verify it is actually an _OpcUAConnections DP
        const dpTypeName = winccoa.dpTypeName(connectionName);
        if (dpTypeName !== "_OpcUAConnections") {
          return errorContent(
            `Datapoint "${connectionName}" is not an OPC UA connection DP ` +
            `(type: ${dpTypeName ?? "unknown"}). Only _OpcUAConnections DPs can be deleted via this tool.`,
          );
        }

        await winccoa.dpDelete(connectionName);

        return textContent(
          `OPC UA connection "${connectionName}" deleted successfully.`,
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
