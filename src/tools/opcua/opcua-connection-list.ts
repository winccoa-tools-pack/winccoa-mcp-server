/**
 * Tool: opcua/opcua_connection_list
 *
 * List all OPC UA connections configured in the WinCC OA project.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerOpcUaConnectionList(server: McpServer): void {
  server.registerTool(
    "opcua.opcua_connection_list",
    {
      title: "List OPC UA Connections",
      description: `List all OPC UA client connections configured in the WinCC OA project.

OPC UA connections are stored as datapoints of type _OpcUAConnections. This tool
retrieves all such datapoints and reads their Address and Active attributes.

Returns:
  Array of connection objects:
  [
    {
      "name": string,       // DP name, e.g. "MyOpcUaServer"
      "address": string,    // OPC UA endpoint URL, e.g. "opc.tcp://192.168.1.10:4840"
      "active": boolean     // whether the connection is enabled
    },
    ...
  ]

An empty array is returned when no OPC UA connections are configured.

Notes:
  - Use opcua/opcua_connection_add to create a new connection.
  - Use opcua/opcua_address_set to map a DPE to an OPC UA node ID.
  - OPC UA address space browsing is not available via this MCP server
    (the browse API is not exposed by the winccoa-manager package).`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const winccoa = getWinccoa();

        const connDps = winccoa.dpNames("*", "_OpcUAConnections");

        if (connDps.length === 0) {
          return textContent(safeJsonStringify([]));
        }

        const results = await Promise.all(
          connDps.map(async (name) => {
            try {
              const values = (await winccoa.dpGet([
                `${name}.Address`,
                `${name}.Active`,
              ])) as unknown[];
              return {
                name,
                address: values[0] as string,
                active: values[1] as boolean,
              };
            } catch {
              return { name, address: null, active: null };
            }
          }),
        );

        return textContent(safeJsonStringify(results));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
