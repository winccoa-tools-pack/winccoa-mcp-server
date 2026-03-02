/**
 * Tool: manager/manager_stop
 *
 * Stop a WinCC OA manager by writing to its _pmon Stop DP attribute.
 * Uses the native WinCC OA DP fabric — no TCP connection to PMON is opened.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { getOwnManagerNum } from "../../utils/manager-num.js";

export function registerManagerStop(server: McpServer): void {
  server.registerTool(
    "manager.manager_stop",
    {
      title: "Stop WinCC OA Manager",
      description: `Stop a running WinCC OA manager by its manager number.

Writes a stop command to the _pmon.Managers.<num>.Stop datapoint attribute.
The stop command is handled by the Process Monitor (PMON) — no external TCP
connection to PMON is opened.

Safety: This tool prevents you from stopping the manager that is running
the MCP server itself to avoid self-termination.

Args:
  - managerNum (integer ≥ 1): The manager number to stop. Use
    manager.manager_list to discover available manager numbers.

Returns:
  Confirmation message with the manager name.

Notes:
  - Use manager.manager_list to find available manager numbers.
  - Use manager.manager_status to check the run state after stopping.
  - PMON respects the manager's configured KillTime before force-killing.
  - RunState values: 0=Unknown, 1=Starting, 2=Running, 3=Stopping, 4=Stopped,
    5=Error, 6=Waiting.`,
      inputSchema: {
        managerNum: z
          .number()
          .int()
          .positive()
          .describe("Manager number to stop (use manager/manager_list to find manager numbers)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ managerNum }) => {
      try {
        const winccoa = getWinccoa();

        // Self-stop prevention: compare target manager num against own manager num
        const ownManagerNum = getOwnManagerNum();
        if (ownManagerNum !== null && managerNum === ownManagerNum) {
          return errorContent(
            `Cannot stop manager ${managerNum}: that is the MCP server's own manager. ` +
            `Stopping it would terminate this connection.`,
          );
        }

        const dpName = `_pmon:_pmon.Managers.${managerNum}`;

        if (!winccoa.dpExists(dpName)) {
          return errorContent(
            `Manager number ${managerNum} does not exist. Use manager.manager_list to see available managers.`,
          );
        }

        const [managerName] = (await winccoa.dpGet([`${dpName}.Name`])) as [unknown];

        // Write Stop = 1 to trigger PMON stop command
        await winccoa.dpSetWait([`${dpName}.Stop`], [1]);

        return textContent(
          `Manager ${managerNum} ("${String(managerName)}") stop command sent successfully. ` +
          `Use manager.manager_status to check the current run state.`,
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
