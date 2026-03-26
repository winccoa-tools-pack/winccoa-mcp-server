/**
 * Tool: manager/manager_remove
 *
 * Remove a manager from the PMON configuration via TCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { getOwnManagerNum } from "../../utils/manager-num.js";

export function registerManagerRemove(server: McpServer): void {
  server.registerTool(
    "manager.manager_remove",
    {
      title: "Remove WinCC OA Manager",
      description: `Remove a manager from the PMON configuration.

Sends a SINGLE_MGR:DEL command to PMON via TCP. This permanently removes the
manager entry from the PMON configuration.

Safety: This tool prevents you from removing the manager that is running
the MCP server itself to avoid self-termination.

Args:
  - managerIndex (integer >= 1): The PMON index to remove. Use
    manager.manager_list to discover available indices.

Returns:
  Confirmation message.

Notes:
  - The manager should be stopped before removal.
  - Index 0 is PMON itself and cannot be removed.
  - This operation shifts indices of managers that follow.`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .positive()
          .describe("PMON index to remove (use manager.manager_list to find indices)"),
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

        // Self-removal prevention
        const ownManagerNum = getOwnManagerNum();
        if (ownManagerNum !== null) {
          const status = await pmon.getManagerStati();
          const target = status.managers.find((m) => m.index === managerIndex);
          if (target && target.manNum === ownManagerNum) {
            return errorContent(
              `Cannot remove manager at index ${managerIndex}: that is the MCP server's own manager ` +
              `(manager number ${ownManagerNum}). Removing it would terminate this connection.`,
            );
          }
        }

        const result = await pmon.removeManager(managerIndex);

        if (!result.success) {
          return errorContent(`Failed to remove manager ${managerIndex}: ${result.error}`);
        }

        return textContent(
          `Manager at index ${managerIndex} removed from PMON configuration. ` +
          `Use manager.manager_list to verify.`,
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
