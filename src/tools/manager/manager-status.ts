/**
 * Tool: manager/manager_status
 *
 * Read detailed status attributes for a specific WinCC OA manager from the _pmon DPs.
 * Uses the native WinCC OA DP fabric — no TCP connection to PMON is opened.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

/** Attributes read from each _pmon_Manager DP. */
const MANAGER_ATTRS = [
  "Name",
  "State",
  "RunState",
  "StartCount",
  "Options",
  "StartMode",
  "KillTime",
  "ResetTime",
  "ResetStartCount",
  "Pid",
] as const;

export function registerManagerStatus(server: McpServer): void {
  server.registerTool(
    "manager.manager_status",
    {
      title: "Get Manager Status",
      description: `Read detailed status information for a specific WinCC OA manager
identified by its manager number.

Retrieves attributes from the _pmon datapoint system — no external PMON TCP
connection is used.

Args:
  - managerNum (integer ≥ 1): The manager number to query. Use manager.manager_list
    to discover available manager numbers.

Returns:
  {
    "managerNum": number,
    "dpName": string,          // e.g. "_pmon:_pmon.Managers.2"
    "name": string,            // manager executable name, e.g. "WCCOActrl"
    "state": number,           // internal state value
    "runState": number,        // 0=Unknown 1=Starting 2=Running 3=Stopping 4=Stopped 5=Error 6=Waiting
    "startCount": number,      // how many times this manager has been started
    "options": string,         // command-line options
    "startMode": number,       // 0=Manual 1=Once 2=Always
    "killTime": number,        // seconds before force-kill on stop
    "resetTime": number,       // minutes before allowing restart
    "resetStartCount": number, // max automatic restart attempts
    "pid": number | undefined  // OS process ID when running
  }

Notes:
  - Use manager.manager_list to get an overview of all managers.
  - Manager stop/start operations are not available via this MCP server to prevent
    accidental process termination.`,
      inputSchema: {
        managerNum: z
          .number()
          .int()
          .positive()
          .describe("Manager number to query (use manager/manager_list to find manager numbers)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ managerNum }) => {
      try {
        const winccoa = getWinccoa();

        const dpName = `_pmon:_pmon.Managers.${managerNum}`;

        // Verify the manager DP exists
        if (!winccoa.dpExists(dpName)) {
          return errorContent(
            `Manager number ${managerNum} does not exist. Use manager.manager_list to see available managers.`,
          );
        }

        const attrDpes = MANAGER_ATTRS.map((attr) => `${dpName}.${attr}`);
        const values = (await winccoa.dpGet(attrDpes)) as unknown[];

        const result: Record<string, unknown> = { managerNum, dpName };
        MANAGER_ATTRS.forEach((attr, i) => {
          // Use camelCase keys: "Name" → "name", "RunState" → "runState", etc.
          const key = attr.charAt(0).toLowerCase() + attr.slice(1);
          result[key] = values[i];
        });

        return textContent(safeJsonStringify(result));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
