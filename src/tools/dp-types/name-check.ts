/**
 * Tool: dp_types/name_check
 *
 * Validates a name against WinCC OA naming rules before using it in
 * dpCreate, dpTypeCreate, or other operations that require valid names.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WinccoaNameCheckType } from "winccoa-manager";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

const NAME_TYPE_MAP: Record<string, WinccoaNameCheckType> = {
  Dp: WinccoaNameCheckType.Dp,
  DpType: WinccoaNameCheckType.DpType,
  DpAlias: WinccoaNameCheckType.DpAlias,
  Project: WinccoaNameCheckType.Project,
  SubProject: WinccoaNameCheckType.SubProject,
  Directory: WinccoaNameCheckType.Directory,
  System: WinccoaNameCheckType.System,
};

export function registerNameCheck(server: McpServer): void {
  server.registerTool(
    "dp_types.name_check",
    {
      title: "Validate WinCC OA Name",
      description: `Validates a name against WinCC OA naming rules for the specified context.

Call this BEFORE datapoints.dp_create or dp_types.dp_type_create to catch invalid
characters early and get a clear error message rather than a cryptic native error.

WinCC OA name rules differ by context:
- Dp: datapoint names (no spaces, no special chars except _)
- DpType: datapoint type names
- DpAlias: alias strings (more permissive)
- System: system names (network-level identifiers)

Args:
  - name (string):     The name to validate.
  - nameType (string): The context to validate against. One of:
                       "Dp" (default), "DpType", "DpAlias",
                       "Project", "SubProject", "Directory", "System".

Returns:
  JSON object with:
  - "name":           string   – the input name
  - "nameType":       string   – the validation context
  - "valid":          boolean  – whether the name is valid
  - "normalizedName": string   – the normalized form (may differ from input)

Examples:
  - Check a DP name:      name = "My_Sensor_01", nameType = "Dp"
  - Check a type name:    name = "PumpType_01",  nameType = "DpType"

Error Handling:
  - Returns error if the nameType is not a valid enum value.`,
      inputSchema: {
        name: z.string().min(1).describe("The name to validate"),
        nameType: z
          .enum(["Dp", "DpType", "DpAlias", "Project", "SubProject", "Directory", "System"])
          .default("Dp")
          .describe('Name validation context (default: "Dp")'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ name, nameType }) => {
      try {
        const winccoa = getWinccoa();
        const nameTypeEnum = NAME_TYPE_MAP[nameType]!;
        const result = await winccoa.nameCheck(name, nameTypeEnum);
        const output = {
          name,
          nameType,
          valid: result.valid,
          normalizedName: result.name,
        };
        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
