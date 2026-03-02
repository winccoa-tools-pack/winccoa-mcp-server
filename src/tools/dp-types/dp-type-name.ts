/**
 * Tool: dp_types/dp_type_name
 *
 * Returns the datapoint type name for a given datapoint.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

export function registerDpTypeName(server: McpServer): void {
  server.registerTool(
    "dp_types.dp_type_name",
    {
      title: "Get Datapoint Type Name",
      description: `Returns the datapoint type name for a given WinCC OA datapoint.

This is useful when you need to know the type of a DP before deciding what
configuration to apply (e.g. alarm type, PV range). Call this before
alarms.alarm_config_set or pv_range.pv_range_set to verify the DP type.

Args:
  - dpName (string): The datapoint name (without element suffix), e.g. "ExampleDP_Arg1".

Returns:
  JSON object with:
  - "dpName":     string  – the input datapoint name
  - "dpTypeName": string  – the type name of the datapoint

Examples:
  - Get type of a DP: dpName = "ExampleDP_Arg1"

Error Handling:
  - Returns error if the datapoint does not exist.`,
      inputSchema: {
        dpName: z.string().min(1).describe("Datapoint name to look up the type for"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpName }) => {
      try {
        const winccoa = getWinccoa();
        const dpTypeName = winccoa.dpTypeName(dpName);
        const output = { dpName, dpTypeName };
        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
