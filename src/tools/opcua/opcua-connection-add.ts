/**
 * Tool: opcua/opcua_connection_add
 *
 * Create and configure a new OPC UA client connection in the WinCC OA project.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

/** Map security mode string to WinCC OA numeric value. */
const SECURITY_MODE: Record<string, number> = {
  None: 0,
  Sign: 1,
  SignAndEncrypt: 2,
};

export function registerOpcUaConnectionAdd(server: McpServer): void {
  server.registerTool(
    "opcua.opcua_connection_add",
    {
      title: "Add OPC UA Connection",
      description: `Create and configure a new OPC UA client connection in the WinCC OA project.

OPC UA connections are represented as datapoints of type _OpcUAConnections.
This tool creates the DP and sets its core attributes (Address, Active, SecurityMode).

Args:
  - connectionName (string): Name for the new connection DP.
    Must not already exist. E.g. "PlcOpcUaServer"
  - serverAddress (string): Full OPC UA endpoint URL of the remote server.
    Must start with "opc.tcp://". E.g. "opc.tcp://192.168.1.10:4840"
  - active (boolean, default true): Enable the connection immediately after creation.
  - securityMode (string, default "None"): Message security mode.
    One of: "None", "Sign", "SignAndEncrypt"

Returns:
  {
    "success": true,
    "connectionName": string,
    "serverAddress": string,
    "active": boolean,
    "securityMode": string
  }

Notes:
  - Client-certificate and user/password authentication must be configured manually
    in the WinCC OA console (not supported via this tool).
  - After creating the connection, use opcua/opcua_address_set to map DPEs to OPC UA node IDs.
  - The OPC UA driver must be restarted (or a hotload must be triggered) for the
    new connection to become active, unless the driver supports runtime connection add.`,
      inputSchema: {
        connectionName: z
          .string()
          .min(1)
          .describe("Name for the new connection datapoint (must not already exist)"),
        serverAddress: z
          .string()
          .min(1)
          .refine((v) => v.startsWith("opc.tcp://"), {
            message: 'OPC UA server address must start with "opc.tcp://"',
          })
          .describe('OPC UA endpoint URL, e.g. "opc.tcp://192.168.1.10:4840"'),
        active: z
          .boolean()
          .default(true)
          .describe("Enable the connection immediately (default: true)"),
        securityMode: z
          .enum(["None", "Sign", "SignAndEncrypt"])
          .default("None")
          .describe("Message security mode (default: None)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ connectionName, serverAddress, active, securityMode }) => {
      try {
        const winccoa = getWinccoa();

        if (winccoa.dpExists(connectionName)) {
          return errorContent(
            `Datapoint "${connectionName}" already exists. ` +
              `Choose a different name or use opcua/opcua_connection_list to view existing connections.`,
          );
        }

        const created = await winccoa.dpCreate(connectionName, "_OpcUAConnections");
        if (!created) {
          return errorContent(
            `Failed to create datapoint "${connectionName}" of type _OpcUAConnections.`,
          );
        }

        await winccoa.dpSetWait(
          [
            `${connectionName}.Address`,
            `${connectionName}.Active`,
            `${connectionName}.SecurityMode`,
          ],
          [serverAddress, active, SECURITY_MODE[securityMode]],
        );

        return textContent(
          safeJsonStringify({
            success: true,
            connectionName,
            serverAddress,
            active,
            securityMode,
          }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
