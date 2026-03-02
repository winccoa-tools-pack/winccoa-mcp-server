/**
 * Tool: opcua/opcua_browse
 *
 * Browse an OPC UA server's node namespace via a WinCC OA CTRL script.
 * Executes an opcUaGetNodes-based browse from within the WinCC OA runtime
 * so no separate OPC UA client connection is needed.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WinccoaCtrlScript, WinccoaCtrlType } from "winccoa-manager";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

/** Maximum browse depth allowed by this tool. */
const MAX_DEPTH = 5;

/** Maximum number of nodes returned by this tool. */
const MAX_NODES = 500;

/**
 * CTRL script that browses OPC UA nodes via the WinCC OA OPC UA driver API.
 * The script returns a JSON string of the browse result tree.
 *
 * Note: OPC UA browse is available in WinCC OA 3.18+ via the CTRL OPC UA functions.
 * The driver number is derived from the connection name (the _OpcUAConnections DP).
 */
function buildBrowseScript(connectionName: string, nodeId: string, maxDepth: number, maxNodes: number): string {
  return `
#uses "CtrlOpcUa"

dyn_anytype browseResult;
int nodeCount;

void main() {
  // Find the driver number for the given connection
  int drvNum = 0;
  dyn_string conns = dpNames("*", "_OpcUAConnections");
  for (int i = 1; i <= dynlen(conns); i++) {
    if (conns[i] == "${connectionName}") {
      // The driver number is typically the DP index + the OPC UA base driver offset
      // In practice, use dpGet on the driver system DP to find the driver number
      string drvDp = "_Driver" + i + ".";
      if (dpExists(drvDp)) {
        drvNum = i;
      }
      break;
    }
  }

  if (drvNum == 0) {
    browseResult[1] = "error";
    browseResult[2] = "OPC UA connection not found or driver not initialised: ${connectionName}";
    return;
  }

  dyn_anytype nodes;
  int rc = opcUaGetNodes(drvNum, "${nodeId}", ${maxDepth}, nodes, ${maxNodes});
  if (rc != 0) {
    browseResult[1] = "error";
    browseResult[2] = "opcUaGetNodes failed with code " + rc;
    return;
  }

  browseResult[1] = "ok";
  browseResult[2] = jsonEncode(nodes);
  nodeCount = dynlen(nodes);
}
`;
}

export function registerOpcUaBrowse(server: McpServer): void {
  server.registerTool(
    "opcua.opcua_browse",
    {
      title: "Browse OPC UA Namespace",
      description: `Browse the node namespace of an OPC UA server connected to WinCC OA.

Uses the WinCC OA CTRL OPC UA API (opcUaGetNodes) to traverse the OPC UA address
space of the specified connection. The browse is executed inside the WinCC OA
runtime — no separate OPC UA client is needed.

Args:
  - connectionName (string): Name of the OPC UA connection DP to browse.
    Use opcua/opcua_connection_list to see available connections.
  - nodeId (string, default: "ns=0;i=84"): OPC UA node ID to start browsing from.
    The default is the OPC UA Objects folder (RootFolder/Objects). Use standard
    OPC UA node ID syntax: "ns=<namespace>;i=<numeric>" or "ns=<ns>;s=<string>".
  - maxDepth (integer, default: 2, max: 5): Maximum recursion depth.
  - maxNodes (integer, default: 200, max: 500): Maximum number of nodes to return.

Returns:
  {
    "connectionName": string,
    "nodeId": string,
    "nodes": array of node objects with nodeId, browseName, displayName, nodeClass
  }

Notes:
  - Requires WinCC OA 3.18+ with the CTRL OPC UA extension (CtrlOpcUa library).
  - Deep browses on large namespaces may be slow — use maxDepth=1 or 2 for initial exploration.
  - Results are truncated to the character limit if the namespace is very large.
  - Use opcua/opcua_address_set to map discovered node IDs to WinCC OA DPEs.`,
      inputSchema: {
        connectionName: z
          .string()
          .min(1)
          .describe("Name of the OPC UA connection DP to browse (from opcua/opcua_connection_list)"),
        nodeId: z
          .string()
          .default("ns=0;i=84")
          .describe('OPC UA node ID to start browsing from (default: "ns=0;i=84" = Objects folder)'),
        maxDepth: z
          .number()
          .int()
          .min(1)
          .max(MAX_DEPTH)
          .default(2)
          .describe(`Maximum recursion depth (default: 2, max: ${MAX_DEPTH})`),
        maxNodes: z
          .number()
          .int()
          .min(1)
          .max(MAX_NODES)
          .default(200)
          .describe(`Maximum number of nodes to return (default: 200, max: ${MAX_NODES})`),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ connectionName, nodeId, maxDepth, maxNodes }) => {
      try {
        const winccoa = getWinccoa();

        // Pre-flight: verify the connection DP exists
        if (!winccoa.dpExists(connectionName)) {
          return errorContent(
            `OPC UA connection "${connectionName}" does not exist. ` +
            `Use opcua/opcua_connection_list to see available connections.`,
          );
        }

        const dpTypeName = winccoa.dpTypeName(connectionName);
        if (dpTypeName !== "_OpcUAConnections") {
          return errorContent(
            `Datapoint "${connectionName}" is not an OPC UA connection DP ` +
            `(type: ${dpTypeName ?? "unknown"}).`,
          );
        }

        const ctrlCode = buildBrowseScript(connectionName, nodeId, maxDepth, maxNodes);
        const script = new WinccoaCtrlScript(winccoa, ctrlCode, "main");

        const rawResult = await Promise.race([
          script.start("main", [], [] as WinccoaCtrlType[]),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("OPC UA browse timed out after 30 seconds")), 30_000),
          ),
        ]);

        const result = rawResult as unknown[];

        if (!Array.isArray(result) || result.length < 2) {
          return errorContent("Unexpected response from OPC UA browse CTRL script.");
        }

        const status = result[0] as string;
        const payload = result[1] as string;

        if (status === "error") {
          return errorContent(`OPC UA browse failed: ${payload}`);
        }

        // Parse the JSON nodes returned by the CTRL script
        let nodes: unknown;
        try {
          nodes = JSON.parse(payload);
        } catch {
          nodes = payload;
        }

        return textContent(
          safeJsonStringify({
            connectionName,
            nodeId,
            nodes,
          }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
