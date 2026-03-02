/**
 * Tool: datapoints/dp_create
 *
 * Create a new datapoint.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";

export function registerDpCreate(server: McpServer): void {
  server.registerTool(
    "datapoints.dp_create",
    {
      title: "Create Datapoint",
      description: `Create a new WinCC OA datapoint of the given type.

Args:
  - dpName (string):      Name of the datapoint to create (e.g. "myNewDp").
  - dpType (string):      Datapoint type name (e.g. "ExampleDP_Float").
                          The type must already exist in the project.
  - systemId (number):    Optional system number for distributed systems.
  - dpId (number):        Optional datapoint ID. If a DP with that ID exists,
                          a random ID is chosen instead.

Returns:
  JSON object with:
  - "success": boolean
  - "dpName":  string  – name of the created datapoint

Examples:
  - Create a simple DP: dpName = "newSensor", dpType = "ExampleDP_Float"
  - On remote system:   dpName = "remoteSensor", dpType = "ExampleDP_Float", systemId = 2

Error Handling:
  - Returns error if dpType does not exist.
  - Returns error if a datapoint with dpName already exists.
  - Returns error if dpName contains invalid characters.`,
      inputSchema: {
        dpName: z.string().min(1, "Datapoint name is required").describe("Name of the new datapoint"),
        dpType: z.string().min(1, "Datapoint type is required").describe("Existing datapoint type name"),
        systemId: z
          .number()
          .int()
          .optional()
          .describe("System number for distributed systems (optional)"),
        dpId: z
          .number()
          .int()
          .optional()
          .describe("Desired datapoint ID (optional – a random ID is used if taken)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ dpName, dpType, systemId, dpId }) => {
      try {
        const winccoa = getWinccoa();
        await winccoa.dpCreate(dpName, dpType, systemId, dpId);

        const output = { success: true, dpName };
        return textContent(JSON.stringify(output, null, 2));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
