/**
 * Tool: manager/manager_list
 *
 * List all WinCC OA managers registered in the current project via PMON TCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { PmonState } from "../../pmon/pmon-types.js";

const STATE_NAMES: Record<number, string> = {
  [PmonState.Stopped]: "Stopped",
  [PmonState.Init]: "Initializing",
  [PmonState.Running]: "Running",
  [PmonState.Blocked]: "Blocked",
};

export function registerManagerList(server: McpServer): void {
  server.registerTool(
    "manager.manager_list",
    {
      title: "List WinCC OA Managers",
      description: `List all managers registered in the current WinCC OA project.

Retrieves manager information from PMON via TCP (port 4999 by default).

Args:
  - includeStatus (boolean, default true):
      When true, also fetches live status (state, PID) for each manager.

Returns:
  Array of manager objects, sorted by index:
  [
    {
      "index": number,           // 0-based PMON index (0 = PMON itself)
      "manager": string,         // manager name, e.g. "WCCOActrl"
      "startMode": string,       // "manual", "once", or "always"
      "secKill": number,         // seconds before SIGKILL
      "restartCount": number,    // automatic restart attempts
      "resetMin": number,        // minutes before restart counter resets
      "options": string,         // command-line options
      "state": string | undefined,   // e.g. "Running" (if includeStatus)
      "pid": number | undefined       // OS process ID (if includeStatus)
    },
    ...
  ]

State values: Stopped, Initializing, Running, Blocked.

Notes:
  - Use manager.manager_status for detailed status of a specific manager.
  - Manager indices are 0-based; index 0 is PMON itself.`,
      inputSchema: {
        includeStatus: z
          .boolean()
          .default(true)
          .describe("Include live status (state, PID) for each manager (default: true)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ includeStatus }) => {
      try {
        const pmon = getPmonClient();
        const list = await pmon.getManagerList();

        if (!includeStatus) {
          return textContent(safeJsonStringify(list));
        }

        // Merge status info
        const status = await pmon.getManagerStati();
        const statusByIndex = new Map(
          status.managers.map((m) => [m.index, m]),
        );

        const merged = list.map((entry) => {
          const s = statusByIndex.get(entry.index);
          return {
            ...entry,
            state: s ? (STATE_NAMES[s.state] ?? String(s.state)) : undefined,
            pid: s?.pid,
          };
        });

        return textContent(safeJsonStringify(merged));
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
