/**
 * Tool: manager/manager_start
 *
 * Start a WinCC OA manager via PMON TCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerManagerStart(server: McpServer): void {
  server.registerTool(
    "manager.manager_start",
    {
      title: "Start WinCC OA Manager",
      description: `Start a stopped WinCC OA manager by its PMON index.

Sends a SINGLE_MGR:START command to PMON via TCP.

Args:
  - managerIndex (integer >= 1): The PMON index to start. Use
    manager.manager_list to discover available indices.

Returns:
  Confirmation message.

Notes:
  - Use manager.manager_list to find available manager indices.
  - Use manager.manager_status to check the manager state after starting.
  - PMON may take a few seconds to bring the manager online.
  - Index 0 is PMON itself and cannot be started this way.`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .positive()
          .describe("PMON index to start (use manager.manager_list to find indices)"),
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
        const result = await pmon.startManager(managerIndex);

        if (!result.success) {
          return errorContent(`Failed to start manager ${managerIndex}: ${result.error}`);
        }

        return textContent(
          `Manager ${managerIndex} start command sent successfully. ` +
          `Use manager.manager_status to check the current state.`,
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
