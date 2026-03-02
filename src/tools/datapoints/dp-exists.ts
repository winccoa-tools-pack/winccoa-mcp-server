/**
 * Tool: datapoints/dp_exists
 *
 * Check whether a datapoint (element) exists.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerDpExists(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_exists",
    {
      title: "Check Datapoint Exists",
      description: `Check whether a WinCC OA datapoint identifier exists.

The identifier can be a system, DPT, DP, DPE, config, detail, or attribute.
Returns true if at least one part of the identifier can be resolved.

Args:
  - dpeName (string): A datapoint identifier to check.

Returns:
  JSON object with:
  - "dpeName": string
  - "exists":  boolean`,
      inputSchema: {
        dpeName: z.string().min(1, "Datapoint identifier is required").describe("Datapoint identifier to check"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName }) => {
      try {
        const winccoa = getWinccoa();
        const exists = winccoa.dpExists(dpeName);

        const output = { dpeName, exists };
        return textContent(JSON.stringify(output, null, 2));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
