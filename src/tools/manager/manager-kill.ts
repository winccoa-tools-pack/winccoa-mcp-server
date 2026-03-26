/**
 * Tool: manager/manager_kill
 *
 * Force-kill a WinCC OA manager via PMON TCP (SIGKILL).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { getOwnManagerNum } from "../../utils/manager-num.js";

export function registerManagerKill(server: McpServer): void {
  server.registerTool(
    "manager.manager_kill",
    {
      title: "Kill WinCC OA Manager",
      description: `Force-kill a WinCC OA manager (SIGKILL) by its PMON index.

Sends a SINGLE_MGR:KILL command to PMON via TCP. This is a destructive operation
that immediately terminates the process without allowing graceful shutdown.

Safety: This tool prevents you from killing the manager that is running
the MCP server itself to avoid self-termination.

Args:
  - managerIndex (integer >= 1): The PMON index to kill. Use
    manager.manager_list to discover available indices.

Returns:
  Confirmation message.

Notes:
  - Prefer manager.manager_stop for graceful shutdown.
  - Use this only when a manager is unresponsive to SIGTERM.
  - Index 0 is PMON itself and cannot be killed this way.`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .positive()
          .describe("PMON index to kill (use manager.manager_list to find indices)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ managerIndex }) => {
      try {
        const pmon = getPmonClient();

        // Self-kill prevention
        const ownManagerNum = getOwnManagerNum();
        if (ownManagerNum !== null) {
          const status = await pmon.getManagerStati();
          const target = status.managers.find((m) => m.index === managerIndex);
          if (target && target.manNum === ownManagerNum) {
            return errorContent(
              `Cannot kill manager at index ${managerIndex}: that is the MCP server's own manager ` +
              `(manager number ${ownManagerNum}). Killing it would terminate this connection.`,
            );
          }
        }

        const result = await pmon.killManager(managerIndex);

        if (!result.success) {
          return errorContent(`Failed to kill manager ${managerIndex}: ${result.error}`);
        }

        return textContent(
          `Manager ${managerIndex} kill command sent successfully (SIGKILL). ` +
          `Use manager.manager_status to check the current state.`,
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
