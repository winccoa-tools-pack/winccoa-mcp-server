/**
 * Tool: common/common_delete
 *
 * Clear one or more common DPE metadata fields (alias, description, format, unit)
 * by resetting them to an empty string.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent } from "../../utils/formatters.js";

const FIELD_ENUM = ["alias", "description", "format", "unit"] as const;

export function registerCommonDelete(server: McpServer): void {
  server.registerTool(
    "common.common_delete",
    {
      title: "Delete Common DPE Metadata Fields",
      description: `Clear one or more common metadata fields (alias, description, format,
unit) on a WinCC OA datapoint element (DPE) by resetting them to empty string.

Args:
  - dpeName (string): The DPE whose fields should be cleared. E.g. "Tank1.level"
  - fields (string[]): Which fields to clear.
    Allowed values: "alias", "description", "format", "unit"

Returns:
  JSON object with per-field results:
  {
    "dpeName": string,
    "alias":       { "success": true } | { "success": false, "error": string },
    "description": { "success": true } | { "success": false, "error": string },
    ...
  }

  Only the fields listed in the request are included in the response.

Notes:
  - Clearing sets the field to "" (empty string) — WinCC OA treats this as no value.
  - All requested fields are written in parallel.
  - Use common.common_set to restore a value.`,
      inputSchema: {
        dpeName: z.string().min(1).describe("Datapoint element name whose metadata fields to clear"),
        fields: z
          .array(z.enum(FIELD_ENUM))
          .min(1, "At least one field must be specified")
          .describe('Fields to clear. E.g. ["alias","unit"]'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, fields }) => {
      const winccoa = getWinccoa();
      const result: Record<string, unknown> = { dpeName };

      const tasks: Array<Promise<void>> = [];

      const addTask = (fieldName: string, setter: () => Promise<boolean>): void => {
        tasks.push(
          setter()
            .then(() => {
              result[fieldName] = { success: true };
            })
            .catch((err: unknown) => {
              result[fieldName] = { success: false, error: handleWinccoaError(err) };
            }),
        );
      };

      if (fields.includes("alias")) {
        addTask("alias", () => winccoa.dpSetAlias(dpeName, ""));
      }
      if (fields.includes("description")) {
        addTask("description", () => winccoa.dpSetDescription(dpeName, ""));
      }
      if (fields.includes("format")) {
        addTask("format", () => winccoa.dpSetFormat(dpeName, ""));
      }
      if (fields.includes("unit")) {
        addTask("unit", () => winccoa.dpSetUnit(dpeName, ""));
      }

      await Promise.all(tasks);
      return textContent(safeJsonStringify(result));
    },
  );
}
