/**
 * Tool: manager/manager_restart
 *
 * Stop then start a WinCC OA manager via PMON TCP, waiting between operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { getOwnManagerNum } from "../../utils/manager-num.js";

export function registerManagerRestart(server: McpServer): void {
  server.registerTool(
    "manager.manager_restart",
    {
      title: "Restart WinCC OA Manager",
      description: `Restart a WinCC OA manager (stop, wait, start) by its PMON index.

Sends stop then start commands to PMON via TCP. A configurable wait period
between stop and start ensures the process has time to terminate before
relaunching.

Safety: This tool prevents you from restarting the manager that is running
the MCP server itself to avoid self-termination.

Args:
  - managerIndex (integer >= 1): The PMON index to restart.
  - waitSeconds (integer, default 10, range 1-120): Seconds to wait between
    stop and start commands.

Returns:
  Confirmation message after both commands have been sent.

Notes:
  - Use manager.manager_list to find available manager indices.
  - Use manager.manager_status to check the run state after restarting.
  - Index 0 is PMON itself and cannot be restarted this way.`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .positive()
          .describe("PMON index to restart"),
        waitSeconds: z
          .number()
          .int()
          .min(1)
          .max(120)
          .default(10)
          .describe("Seconds to wait between stop and start (default: 10, max: 120)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ managerIndex, waitSeconds }) => {
      try {
        const pmon = getPmonClient();

        // Self-restart prevention
        const ownManagerNum = getOwnManagerNum();
        if (ownManagerNum !== null) {
          const status = await pmon.getManagerStati();
          const target = status.managers.find((m) => m.index === managerIndex);
          if (target && target.manNum === ownManagerNum) {
            return errorContent(
              `Cannot restart manager at index ${managerIndex}: that is the MCP server's own manager ` +
              `(manager number ${ownManagerNum}). Restarting it would terminate this connection.`,
            );
          }
        }

        // Stop
        const stopResult = await pmon.stopManager(managerIndex);
        if (!stopResult.success) {
          return errorContent(`Failed to stop manager ${managerIndex}: ${stopResult.error}`);
        }

        // Wait
        await new Promise<void>((resolve) => setTimeout(resolve, waitSeconds * 1000));

        // Start
        const startResult = await pmon.startManager(managerIndex);
        if (!startResult.success) {
          return errorContent(
            `Manager ${managerIndex} was stopped but failed to start: ${startResult.error}`,
          );
        }

        return textContent(
          `Manager ${managerIndex} restarted successfully ` +
          `(waited ${waitSeconds}s between stop and start). ` +
          `Use manager.manager_status to check the current state.`,
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
