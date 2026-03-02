/**
 * Tool: manager/manager_restart
 *
 * Stop then start a WinCC OA manager, waiting between the two operations.
 * Uses the native WinCC OA DP fabric — no TCP connection to PMON is opened.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { getOwnManagerNum } from "../../utils/manager-num.js";

export function registerManagerRestart(server: McpServer): void {
  server.registerTool(
    "manager.manager_restart",
    {
      title: "Restart WinCC OA Manager",
      description: `Restart a WinCC OA manager (stop, wait, start) by its manager number.

Sends stop then start commands via the _pmon datapoint attributes. A configurable
wait period between stop and start ensures the process has time to terminate
before relaunching.

Safety: This tool prevents you from restarting the manager that is running
the MCP server itself to avoid self-termination.

Args:
  - managerNum (integer ≥ 1): The manager number to restart.
  - waitSeconds (integer, default 10, range 1–120): Seconds to wait between
    stop and start commands.

Returns:
  Confirmation message after both commands have been sent.

Notes:
  - Use manager.manager_list to find available manager numbers.
  - Use manager.manager_status to check the run state after restarting.
  - The actual restart time depends on the manager's KillTime setting.
  - RunState values: 0=Unknown, 1=Starting, 2=Running, 3=Stopping, 4=Stopped,
    5=Error, 6=Waiting.`,
      inputSchema: {
        managerNum: z
          .number()
          .int()
          .positive()
          .describe("Manager number to restart"),
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
        openWorldHint: false,
      },
    },
    async ({ managerNum, waitSeconds }) => {
      try {
        const winccoa = getWinccoa();

        // Self-stop prevention
        const ownManagerNum = getOwnManagerNum();
        if (ownManagerNum !== null && managerNum === ownManagerNum) {
          return errorContent(
            `Cannot restart manager ${managerNum}: that is the MCP server's own manager. ` +
            `Restarting it would terminate this connection.`,
          );
        }

        const dpName = `_pmon:_pmon.Managers.${managerNum}`;

        if (!winccoa.dpExists(dpName)) {
          return errorContent(
            `Manager number ${managerNum} does not exist. Use manager.manager_list to see available managers.`,
          );
        }

        const [managerName] = (await winccoa.dpGet([`${dpName}.Name`])) as [unknown];
        const nameStr = String(managerName);

        // Stop
        await winccoa.dpSetWait([`${dpName}.Stop`], [1]);

        // Wait between stop and start
        await new Promise<void>((resolve) => setTimeout(resolve, waitSeconds * 1000));

        // Start
        await winccoa.dpSetWait([`${dpName}.Start`], [1]);

        return textContent(
          `Manager ${managerNum} ("${nameStr}") restarted successfully ` +
          `(waited ${waitSeconds}s between stop and start). ` +
          `Use manager.manager_status to check the current run state.`,
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
