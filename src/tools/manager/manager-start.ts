/**
 * Tool: manager/manager_start
 *
 * Start a WinCC OA manager by writing to its _pmon Start DP attribute.
 * Uses the native WinCC OA DP fabric — no TCP connection to PMON is opened.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerManagerStart(server: McpServer): void {
  server.registerTool(
    "manager.manager_start",
    {
      title: "Start WinCC OA Manager",
      description: `Start a stopped WinCC OA manager by its manager number.

Writes a start command to the _pmon.Managers.<num>.Start datapoint attribute.
The start command is handled by the Process Monitor (PMON) — no external TCP
connection to PMON is opened.

Args:
  - managerNum (integer ≥ 1): The manager number to start. Use
    manager.manager_list to discover available manager numbers.

Returns:
  Confirmation message with the manager name and its new run state.

Notes:
  - Use manager.manager_list to find available manager numbers.
  - Use manager.manager_status to check the manager state after starting.
  - PMON may take a few seconds to bring the manager online.
  - RunState values: 0=Unknown, 1=Starting, 2=Running, 3=Stopping, 4=Stopped,
    5=Error, 6=Waiting.`,
      inputSchema: {
        managerNum: z
          .number()
          .int()
          .positive()
          .describe("Manager number to start (use manager/manager_list to find manager numbers)"),
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
        const dpName = `_pmon:_pmon.Managers.${managerNum}`;

        if (!winccoa.dpExists(dpName)) {
          return errorContent(
            `Manager number ${managerNum} does not exist. Use manager.manager_list to see available managers.`,
          );
        }

        // Read manager name for the confirmation message
        const [managerName] = (await winccoa.dpGet([`${dpName}.Name`])) as [unknown];

        // Write Start = 1 to trigger PMON start command
        await winccoa.dpSetWait([`${dpName}.Start`], [1]);

        return textContent(
          `Manager ${managerNum} ("${String(managerName)}") start command sent successfully. ` +
          `Use manager.manager_status to check the current run state.`,
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
