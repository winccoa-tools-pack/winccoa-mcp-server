/**
 * Tool: manager/project_name
 *
 * Get the project name from PMON via TCP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPmonClient } from "../../pmon/pmon-client-accessor.js";
import { handlePmonError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerProjectName(server: McpServer): void {
  server.registerTool(
    "manager.project_name",
    {
      title: "Get Project Name",
      description: `Get the WinCC OA project name from PMON via TCP.

No arguments required.

Returns:
  { "projectName": string }

Notes:
  - This is a lightweight query to verify PMON connectivity and project identity.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const pmon = getPmonClient();
        const projectName = await pmon.getProjectName();
        return textContent(safeJsonStringify({ projectName }));
      } catch (error: unknown) {
        return errorContent(handlePmonError(error));
      }
    },
  );
}
