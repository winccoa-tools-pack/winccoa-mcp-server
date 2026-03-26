/**
 * Tool: manager/manager_status
 *
 * Read detailed status for a specific WinCC OA manager via PMON TCP.
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

const START_MODE_NAMES: Record<number, string> = {
  0: "Manual",
  1: "Once",
  2: "Always",
};

export function registerManagerStatus(server: McpServer): void {
  server.registerTool(
    "manager.manager_status",
    {
      title: "Get Manager Status",
      description: `Read detailed status information for a specific WinCC OA manager
identified by its PMON index.

Retrieves status and configuration from PMON via TCP.

Args:
  - managerIndex (integer >= 0): The 0-based PMON index. Use manager.manager_list
    to discover available indices.

Returns:
  {
    "index": number,
    "manager": string,           // manager executable name
    "state": string,             // "Stopped", "Initializing", "Running", or "Blocked"
    "stateCode": number,         // numeric state (0-3)
    "pid": number,               // OS process ID (0 when not running)
    "startMode": string,         // "Manual", "Once", or "Always"
    "startTime": string,         // when the manager was started
    "manNum": number,            // manager number assigned by Data manager
    "secKill": number,           // seconds before force-kill
    "restartCount": number,      // automatic restart attempts
    "resetMin": number,          // minutes before restart counter resets
    "options": string            // command-line options
  }

Notes:
  - Use manager.manager_list to get an overview of all managers.
  - Index 0 is PMON itself.`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .min(0)
          .describe("0-based PMON index (use manager.manager_list to find indices)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ managerIndex }) => {
      try {
        const pmon = getPmonClient();

        const [statusResult, listResult] = await Promise.all([
          pmon.getManagerStati(),
          pmon.getManagerList(),
        ]);

        const statusEntry = statusResult.managers.find((m) => m.index === managerIndex);
        const listEntry = listResult.find((m) => m.index === managerIndex);

        if (!statusEntry && !listEntry) {
          return errorContent(
            `Manager index ${managerIndex} does not exist. Use manager.manager_list to see available managers.`,
          );
        }

        const result = {
          index: managerIndex,
          manager: listEntry?.manager ?? "unknown",
          state: statusEntry ? (STATE_NAMES[statusEntry.state] ?? String(statusEntry.state)) : "unknown",
          stateCode: statusEntry?.state ?? -1,
          pid: statusEntry?.pid ?? 0,
          startMode: statusEntry
            ? (START_MODE_NAMES[statusEntry.startMode] ?? String(statusEntry.startMode))
            : (listEntry?.startMode ?? "unknown"),
          startTime: statusEntry?.startTime ?? "",
          manNum: statusEntry?.manNum ?? 0,
          secKill: listEntry?.secKill ?? 0,
          restartCount: listEntry?.restartCount ?? 0,
          resetMin: listEntry?.resetMin ?? 0,
          options: listEntry?.options ?? "",
        };

        return textContent(safeJsonStringify(result));
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
