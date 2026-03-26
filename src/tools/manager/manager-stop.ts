/**
 * Tool: manager/manager_stop
 *
 * Stop a WinCC OA manager via PMON TCP (SIGTERM).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { getOwnManagerNum } from "../../utils/manager-num.js";

export function registerManagerStop(server: McpServer): void {
  server.registerTool(
    "manager.manager_stop",
    {
      title: "Stop WinCC OA Manager",
      description: `Stop a running WinCC OA manager by its PMON index.

Sends a SINGLE_MGR:STOP command (SIGTERM) to PMON via TCP.

Safety: This tool prevents you from stopping the manager that is running
the MCP server itself to avoid self-termination.

Args:
  - managerIndex (integer >= 1): The PMON index to stop. Use
    manager.manager_list to discover available indices.

Returns:
  Confirmation message.

Notes:
  - Use manager.manager_list to find available manager indices.
  - Use manager.manager_status to check the run state after stopping.
  - PMON respects the manager's configured KillTime before force-killing.
  - Index 0 is PMON itself and cannot be stopped this way.`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .positive()
          .describe("PMON index to stop (use manager.manager_list to find indices)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ managerIndex }) => {
      try {
        const pmon = getPmonClient();

        // Self-stop prevention: check if this manager's manNum matches ours
        const ownManagerNum = getOwnManagerNum();
        if (ownManagerNum !== null) {
          const status = await pmon.getManagerStati();
          const target = status.managers.find((m) => m.index === managerIndex);
          if (target && target.manNum === ownManagerNum) {
            return errorContent(
              `Cannot stop manager at index ${managerIndex}: that is the MCP server's own manager ` +
              `(manager number ${ownManagerNum}). Stopping it would terminate this connection.`,
            );
          }
        }

        const result = await pmon.stopManager(managerIndex);

        if (!result.success) {
          return errorContent(`Failed to stop manager ${managerIndex}: ${result.error}`);
        }

        return textContent(
          `Manager ${managerIndex} stop command sent successfully. ` +
          `Use manager.manager_status to check the current state.`,
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
