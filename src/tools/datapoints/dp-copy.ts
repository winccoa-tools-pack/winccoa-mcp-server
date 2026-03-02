/**
 * Tool: datapoints/dp_copy
 *
 * Copy an existing datapoint (including its configuration) to a new name.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerDpCopy(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_copy",
    {
      title: "Copy Datapoint",
      description: `Copy an existing WinCC OA datapoint (including its configuration) to a new name.

Args:
  - source (string):      Name of the source datapoint to copy.
  - destination (string): Name for the new copy. Must not already exist.
  - driver (number):      Optional driver number (default 1).

Returns:
  JSON object with:
  - "success":     boolean
  - "source":      string
  - "destination": string

Examples:
  - Copy a DP: source = "ExampleDP_Arg1", destination = "ExampleDP_Arg1_Copy"

Error Handling:
  - Returns error if the source datapoint does not exist.
  - Returns error if the destination already exists.
  - Returns error if source and destination are the same.`,
      inputSchema: {
        source: z.string().min(1, "Source datapoint name is required").describe("Name of the datapoint to copy"),
        destination: z
          .string()
          .min(1, "Destination datapoint name is required")
          .describe("Name for the new copied datapoint (must not exist yet)"),
        driver: z
          .number()
          .int()
          .optional()
          .describe("Driver number (optional, default 1)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ source, destination, driver }) => {
      try {
        const winccoa = getWinccoa();
        await winccoa.dpCopy(source, destination, driver);

        const output = { success: true, source, destination };
        return textContent(JSON.stringify(output, null, 2));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
