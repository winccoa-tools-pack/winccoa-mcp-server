/**
 * Tools: manager/manager_properties_get / manager/manager_properties_set
 *
 * Read and write operational properties of a WinCC OA manager via PMON TCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerManagerPropertiesGet(server: McpServer): void {
  server.registerTool(
    "manager.manager_properties_get",
    {
      title: "Get Manager Properties",
      description: `Read operational properties of a WinCC OA manager via PMON TCP.

Args:
  - managerIndex (integer >= 1): The PMON index. Use manager.manager_list
    to discover available indices.

Returns:
  {
    "index": number,
    "startMode": string,       // "manual", "once", or "always"
    "secKill": number,         // seconds before force-kill on stop
    "restartCount": number,    // automatic restart attempts
    "resetMin": number,        // minutes before restart counter resets
    "options": string          // command-line options
  }`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .positive()
          .describe("PMON index (use manager.manager_list to find indices)"),
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
        const props = await pmon.getManagerProperties(managerIndex);

        return textContent(
          safeJsonStringify({
            index: managerIndex,
            ...props,
          }),
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}

export function registerManagerPropertiesSet(server: McpServer): void {
  server.registerTool(
    "manager.manager_properties_set",
    {
      title: "Set Manager Properties",
      description: `Write operational properties of a WinCC OA manager via PMON TCP.

All property fields are required because PMON replaces the entire property set
with SINGLE_MGR:PROP_PUT.

Args:
  - managerIndex (integer >= 1): The PMON index. Use manager.manager_list
    to discover available indices.
  - startMode (string): "manual", "once", or "always"
  - secKill (integer >= 0): Seconds before force-kill on stop.
  - restartCount (integer >= 0): Automatic restart attempts.
  - resetMin (integer >= 0): Minutes before restart counter resets.
  - options (string, optional): Command-line options (default: "").

Returns:
  Confirmation of the update.`,
      inputSchema: {
        managerIndex: z
          .number()
          .int()
          .positive()
          .describe("PMON index (use manager.manager_list to find indices)"),
        startMode: z
          .enum(["manual", "once", "always"])
          .describe("Start mode: manual, once, or always"),
        secKill: z
          .number()
          .int()
          .min(0)
          .describe("Seconds before force-kill on stop"),
        restartCount: z
          .number()
          .int()
          .min(0)
          .describe("Automatic restart attempts"),
        resetMin: z
          .number()
          .int()
          .min(0)
          .describe("Minutes before restart counter resets"),
        options: z
          .string()
          .default("")
          .describe("Command-line options (default: empty)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ managerIndex, startMode, secKill, restartCount, resetMin, options }) => {
      try {
        const pmon = getPmonClient();
        const result = await pmon.setManagerProperties(
          managerIndex,
          startMode,
          secKill,
          restartCount,
          resetMin,
          options,
        );

        if (!result.success) {
          return errorContent(`Failed to set properties for manager ${managerIndex}: ${result.error}`);
        }

        return textContent(
          `Manager ${managerIndex}: properties updated (startMode=${startMode}, ` +
          `secKill=${secKill}, restartCount=${restartCount}, resetMin=${resetMin}).`,
        );
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
