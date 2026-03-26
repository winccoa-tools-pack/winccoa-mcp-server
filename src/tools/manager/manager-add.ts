/**
 * Tool: manager/manager_add
 *
 * Add a new manager to the PMON configuration via TCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerManagerAdd(server: McpServer): void {
  server.registerTool(
    "manager.manager_add",
    {
      title: "Add WinCC OA Manager",
      description: `Add a new manager to the PMON configuration.

Sends a SINGLE_MGR:INS command to PMON via TCP. The manager is inserted at the
specified position in the manager table.

Args:
  - managerIndex (integer, 1-100): Position to insert the manager.
  - managerName (string): Manager executable name, e.g. "WCCOActrl" (without .exe).
  - startMode (string, default "always"): "manual", "once", or "always".
  - secKill (integer >= 0, default 30): Seconds before SIGKILL on stop.
  - restartCount (integer >= 0, default 3): Automatic restart attempts.
  - resetMin (integer >= 0, default 5): Minutes before restart counter resets.
  - options (string, default ""): Command-line options.

Returns:
  Confirmation message.

Notes:
  - Use manager.manager_list to see current managers and find available positions.
  - The new manager is not started automatically unless startMode is "always" or "once".`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .min(1)
          .max(100)
          .describe("Position to insert (1-100)"),
        managerName: z
          .string()
          .min(1)
          .describe("Manager executable name, e.g. 'WCCOActrl' (without .exe)"),
        startMode: z
          .enum(["manual", "once", "always"])
          .default("always")
          .describe("Start mode (default: always)"),
        secKill: z
          .number()
          .int()
          .min(0)
          .default(30)
          .describe("Seconds before SIGKILL on stop (default: 30)"),
        restartCount: z
          .number()
          .int()
          .min(0)
          .default(3)
          .describe("Automatic restart attempts (default: 3)"),
        resetMin: z
          .number()
          .int()
          .min(0)
          .default(5)
          .describe("Minutes before restart counter resets (default: 5)"),
        options: z
          .string()
          .default("")
          .describe("Command-line options (default: empty)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ managerIndex, managerName, startMode, secKill, restartCount, resetMin, options }) => {
      try {
        const pmon = getPmonClient();

        // Strip .exe suffix if provided
        const name = managerName.replace(/\.exe$/i, "");

        const result = await pmon.addManager(
          managerIndex,
          name,
          startMode,
          secKill,
          restartCount,
          resetMin,
          options,
        );

        if (!result.success) {
          return errorContent(`Failed to add manager: ${result.error}`);
        }

        return textContent(
          `Manager "${name}" added at index ${managerIndex} ` +
          `(startMode=${startMode}, secKill=${secKill}, restartCount=${restartCount}, resetMin=${resetMin}). ` +
          `Use manager.manager_list to verify.`,
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
