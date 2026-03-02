/**
 * Tool: manager/system_info
 *
 * Return WinCC OA project and runtime information using synchronous manager API calls.
 * No DP reads or network I/O are involved.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerSystemInfo(server: McpServer): void {
  server.registerTool(
    "manager.system_info",
    {
      title: "Get WinCC OA System Information",
      description: `Return WinCC OA project and runtime information.

All data is read from the local manager context — no datapoint reads or network
calls are made.

Returns:
  {
    "version": {
      "version": string,    // WinCC OA version, e.g. "3.20.0.0"
      "os": string,         // Operating system
      "patches": string[]   // Applied patches
    },
    "paths": {
      "projPath": string,   // Absolute path to the WinCC OA project
      "binPath": string,    // WinCC OA binary directory
      "scriptPath": string, // Default script search path
      ...                   // Additional path entries returned by the manager
    },
    "projectLangs": string[], // Configured project language codes, e.g. ["en_US","de_DE"]
    "systemId": number,       // Numeric ID of this WinCC OA system
    "systemName": string      // Name of this WinCC OA system
  }

Notes:
  - This is a read-only, side-effect-free call.
  - Use manager.manager_list to inspect running managers.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const winccoa = getWinccoa();

        const result = {
          version: winccoa.getVersionInfo(),
          paths: winccoa.getPaths(),
          projectLangs: winccoa.getProjectLangs(),
          systemId: winccoa.getSystemId(),
          systemName: winccoa.getSystemName(),
        };

        return textContent(safeJsonStringify(result));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
