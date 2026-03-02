/**
 * Tools: manager/manager_properties_get / manager/manager_properties_set
 *
 * Read and write operational properties of a WinCC OA manager via _pmon DPs.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

/** Properties that can be read and written via _pmon DPs. */
const PROPERTIES = ["StartMode", "KillTime", "ResetTime", "ResetStartCount"] as const;
type ManagerProperty = (typeof PROPERTIES)[number];

export function registerManagerPropertiesGet(server: McpServer): void {
  server.registerTool(
    "manager.manager_properties_get",
    {
      title: "Get Manager Properties",
      description: `Read operational properties of a WinCC OA manager from its _pmon DP.

Args:
  - managerNum (integer ≥ 1): The manager number. Use manager.manager_list
    to discover available manager numbers.

Returns:
  {
    "managerNum": number,
    "name": string,
    "startMode": number,       // 0=Manual, 1=Once, 2=Always
    "killTime": number,        // seconds before force-kill on stop
    "resetTime": number,       // minutes before allowing automatic restart
    "resetStartCount": number  // max automatic restart attempts before giving up
  }`,
      inputSchema: {
        managerNum: z
          .number()
          .int()
          .positive()
          .describe("Manager number (use manager/manager_list to find manager numbers)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ managerNum }) => {
      try {
        const winccoa = getWinccoa();
        const dpName = `_pmon:_pmon.Managers.${managerNum}`;

        if (!winccoa.dpExists(dpName)) {
          return errorContent(
            `Manager number ${managerNum} does not exist. Use manager/manager_list to see available managers.`,
          );
        }

        const attrs = ["Name", ...PROPERTIES].map((a) => `${dpName}.${a}`);
        const values = (await winccoa.dpGet(attrs)) as unknown[];

        const [name, startMode, killTime, resetTime, resetStartCount] = values;

        return textContent(
          safeJsonStringify({
            managerNum,
            name,
            startMode,
            killTime,
            resetTime,
            resetStartCount,
          }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}

export function registerManagerPropertiesSet(server: McpServer): void {
  server.registerTool(
    "manager.manager_properties_set",
    {
      title: "Set Manager Properties",
      description: `Write operational properties of a WinCC OA manager via its _pmon DP.

Only the provided fields are written. Omitted fields are not changed.

Args:
  - managerNum (integer ≥ 1): The manager number. Use manager.manager_list
    to discover available manager numbers.
  - startMode (integer, optional): 0=Manual, 1=Once, 2=Always
  - killTime (integer ≥ 0, optional): Seconds before force-kill on stop.
  - resetTime (integer ≥ 0, optional): Minutes before allowing restart.
  - resetStartCount (integer ≥ 0, optional): Max automatic restart attempts.

Returns:
  Confirmation of which properties were updated.`,
      inputSchema: {
        managerNum: z
          .number()
          .int()
          .positive()
          .describe("Manager number (use manager/manager_list to find manager numbers)"),
        startMode: z
          .number()
          .int()
          .min(0)
          .max(2)
          .optional()
          .describe("Start mode: 0=Manual, 1=Once, 2=Always"),
        killTime: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Seconds before force-kill on stop"),
        resetTime: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Minutes before allowing automatic restart"),
        resetStartCount: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Max automatic restart attempts"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ managerNum, startMode, killTime, resetTime, resetStartCount }) => {
      try {
        const winccoa = getWinccoa();
        const dpName = `_pmon:_pmon.Managers.${managerNum}`;

        if (!winccoa.dpExists(dpName)) {
          return errorContent(
            `Manager number ${managerNum} does not exist. Use manager/manager_list to see available managers.`,
          );
        }

        // Build the list of attributes and values to write
        const propMap: Partial<Record<ManagerProperty, number>> = {};
        if (startMode !== undefined) propMap["StartMode"] = startMode;
        if (killTime !== undefined) propMap["KillTime"] = killTime;
        if (resetTime !== undefined) propMap["ResetTime"] = resetTime;
        if (resetStartCount !== undefined) propMap["ResetStartCount"] = resetStartCount;

        const entries = Object.entries(propMap) as [ManagerProperty, number][];
        if (entries.length === 0) {
          return errorContent("No properties specified. Provide at least one of: startMode, killTime, resetTime, resetStartCount.");
        }

        const dpes = entries.map(([attr]) => `${dpName}.${attr}`);
        const vals = entries.map(([, v]) => v);

        await winccoa.dpSetWait(dpes, vals);

        const updated = entries.map(([attr, val]) => `${attr}=${val}`).join(", ");
        return textContent(`Manager ${managerNum}: updated ${updated}.`);
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
