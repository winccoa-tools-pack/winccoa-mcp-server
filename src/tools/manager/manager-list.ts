/**
 * Tool: manager/manager_list
 *
 * List all WinCC OA managers registered in the current project via the _pmon DPs.
 * Uses the native WinCC OA DP fabric — no TCP connection to PMON is opened.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

/**
 * Extract the manager number from a _pmon_Manager DP name.
 * E.g. "_pmon:_pmon.Managers.3" → 3, null if not parseable.
 */
function extractManagerNum(dpName: string): number | null {
  const match = /\.Managers\.(\d+)$/.exec(dpName);
  return match ? parseInt(match[1]!, 10) : null;
}

export function registerManagerList(server: McpServer): void {
  server.registerTool(
    "manager.manager_list",
    {
      title: "List WinCC OA Managers",
      description: `List all managers registered in the current WinCC OA project.

Retrieves manager information from the _pmon datapoint system — no external
PMON TCP connection is used.

Args:
  - includeState (boolean, default true):
      When true, includes the RunState of each manager.

Returns:
  Array of manager objects, sorted by manager number:
  [
    {
      "num": number,           // manager number (1-based)
      "dpName": string,        // _pmon DP name, e.g. "_pmon:_pmon.Managers.1"
      "name": string,          // manager name, e.g. "WCCOActrl"
      "runState": number | undefined  // run state value (if includeState is true)
    },
    ...
  ]

RunState values (WinCC OA): 0=Unknown, 1=Starting, 2=Running, 3=Stopping, 4=Stopped,
5=Error, 6=Waiting.

Notes:
  - Use manager.manager_status for detailed information on a specific manager.
  - Manager stop/start operations are not available via this MCP server to prevent
    accidental process termination.`,
      inputSchema: {
        includeState: z
          .boolean()
          .default(true)
          .describe("Include RunState for each manager (default: true)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ includeState }) => {
      try {
        const winccoa = getWinccoa();

        // Get all _pmon_Manager DPs from the _pmon system
        const managerDps = winccoa.dpNames("_pmon:*", "_pmon_Manager");

        if (managerDps.length === 0) {
          return textContent(safeJsonStringify([]));
        }

        // Build the attribute list to query
        const nameAttrs = managerDps.map((dp) => `${dp}.Name`);
        const stateAttrs = includeState
          ? managerDps.map((dp) => `${dp}.RunState`)
          : [];

        // Fetch name and optionally RunState in parallel
        const [nameValues, stateValues] = await Promise.all([
          winccoa.dpGet(nameAttrs) as Promise<unknown[]>,
          stateAttrs.length > 0
            ? (winccoa.dpGet(stateAttrs) as Promise<unknown[]>)
            : Promise.resolve([]),
        ]);

        const names = Array.isArray(nameValues) ? nameValues : [nameValues];
        const states = Array.isArray(stateValues) ? stateValues : [stateValues];

        const managers = managerDps.map((dp, i) => {
          const num = extractManagerNum(dp);
          const entry: Record<string, unknown> = {
            num,
            dpName: dp,
            name: names[i],
          };
          if (includeState) {
            entry["runState"] = states[i];
          }
          return entry;
        });

        // Sort by manager number
        managers.sort((a, b) => ((a["num"] as number) ?? 0) - ((b["num"] as number) ?? 0));

        return textContent(safeJsonStringify(managers));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
