/**
 * Tool: opcua/opcua_address_set
 *
 * Configure the _address config on a DPE to map it to an OPC UA node ID.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { DPCONFIG_ADDRESS } from "../../constants/dp-configs.js";

/** Map direction string to WinCC OA peripheral address direction constant. */
const DIRECTION: Record<string, number> = {
  output: 1,       // writeable (output to device)
  input: 2,        // spontaneous input from device
  "input-output": 3, // bidirectional
};

export function registerOpcUaAddressSet(server: McpServer): void {
  server.registerTool(
    "opcua.opcua_address_set",
    {
      title: "Set OPC UA Address",
      description: `Configure the peripheral address (_address config) on a WinCC OA datapoint
element (DPE) to map it to an OPC UA node ID on a remote OPC UA server.

After this configuration the OPC UA driver will read or write the mapped node
automatically according to the configured direction.

Args:
  - dpeName (string): The DPE to configure an OPC UA address on.
    E.g. "Pump1.speed"
  - connectionName (string): Name of an existing OPC UA connection datapoint
    (_OpcUAConnections type). E.g. "PlcOpcUaServer"
  - nodeId (string): The OPC UA node ID on the remote server.
    E.g. "ns=2;s=Pump1.Speed" or "ns=2;i=1001"
  - direction (string): Data flow direction.
    "input"        — data flows from device into WinCC OA (read)
    "output"       — data flows from WinCC OA to device (write)
    "input-output" — bidirectional
  - driverNum (number, default 1): WinCC OA driver manager number for the OPC UA driver.

Returns:
  { "success": true, "dpeName": string, "nodeId": string, "direction": string }

Notes:
  - The connection identified by connectionName must exist (verified before writing).
  - OPC UA address space browsing is not available via this MCP server.
  - Use opcua/opcua_connection_list to find existing connection names.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to configure OPC UA address on"),
        connectionName: z
          .string()
          .min(1)
          .describe("Name of an existing _OpcUAConnections datapoint"),
        nodeId: z
          .string()
          .min(1)
          .describe('OPC UA node ID on the remote server, e.g. "ns=2;s=MyVariable"'),
        direction: z
          .enum(["input", "output", "input-output"])
          .describe("Data direction: input (read), output (write), or input-output"),
        driverNum: z
          .number()
          .int()
          .positive()
          .default(1)
          .describe("WinCC OA OPC UA driver manager number (default: 1)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, connectionName, nodeId, direction, driverNum }) => {
      try {
        const winccoa = getWinccoa();

        if (!winccoa.dpExists(dpeName)) {
          return errorContent(`Datapoint element "${dpeName}" does not exist.`);
        }

        if (!winccoa.dpExists(connectionName)) {
          return errorContent(
            `OPC UA connection "${connectionName}" does not exist. ` +
              `Use opcua/opcua_connection_list to view existing connections.`,
          );
        }

        const connType = winccoa.dpTypeName(connectionName);
        if (connType !== "_OpcUAConnections") {
          return errorContent(
            `"${connectionName}" is of type "${connType}", not "_OpcUAConnections". ` +
              `Provide the name of an OPC UA connection datapoint.`,
          );
        }

        const dirConst = DIRECTION[direction];

        await winccoa.dpSetWait(
          [
            `${dpeName}:_address.._type`,
            `${dpeName}:_address.._reference`,
            `${dpeName}:_address.._direction`,
            `${dpeName}:_address.._drv_ident`,
          ],
          [DPCONFIG_ADDRESS, nodeId, dirConst, driverNum],
        );

        return textContent(
          safeJsonStringify({
            success: true,
            dpeName,
            nodeId,
            direction,
            driverNum,
            connectionName,
          }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
