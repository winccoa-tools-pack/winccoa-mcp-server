/**
 * Tool: common/common_set
 *
 * Write common DPE metadata (alias, description, format, unit) for a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

const langStringSchema = z.union([z.string(), z.record(z.string(), z.string())]);

export function registerCommonSet(server: McpServer): void {
  server.registerTool(
    "common.common_set",
    {
      title: "Set Common DPE Metadata",
      description: `Write common metadata fields (alias, description, format, unit) for a
WinCC OA datapoint element (DPE). At least one field must be provided.

Args:
  - dpeName (string): The DPE to update. E.g. "Tank1.level"
  - alias (string, optional): Plain-text alias string.
  - description (string | object, optional): Plain string or language-keyed object,
      e.g. "Level" or { "en_US": "Level", "de_DE": "Füllstand" }
  - format (string | object, optional): Format string or language-keyed object.
  - unit (string | object, optional): Unit string or language-keyed object,
      e.g. "m³/h" or { "en_US": "m³/h", "de_DE": "m³/h" }

Returns:
  JSON object with per-field success flags:
  {
    "dpeName": string,
    "alias":       { "success": true } | { "success": false, "error": string },
    "description": { "success": true } | { "success": false, "error": string },
    ...
  }

  Only fields that were provided are included in the response.

Notes:
  - All non-undefined fields are written in parallel.
  - Use common.common_get to read current values beforehand.
  - Use common.common_delete to clear individual fields.`,
      inputSchema: {
        dpeName: z.string().min(1).describe("Datapoint element name to update"),
        alias: z.string().optional().describe("Alias string to set"),
        description: langStringSchema
          .optional()
          .describe('Description to set (string or lang-keyed object like {"en_US":"...","de_DE":"..."})'),
        format: langStringSchema.optional().describe("Format to set (string or lang-keyed object)"),
        unit: langStringSchema.optional().describe("Unit to set (string or lang-keyed object)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, alias, description, format, unit }) => {
      // Guard: at least one field must be provided
      if (alias === undefined && description === undefined && format === undefined && unit === undefined) {
        return errorContent("At least one field (alias, description, format, unit) must be provided.");
      }

      const winccoa = getWinccoa();
      const result: Record<string, unknown> = { dpeName };

      // Collect all set operations to run in parallel
      const tasks: Array<Promise<void>> = [];

      if (alias !== undefined) {
        tasks.push(
          winccoa
            .dpSetAlias(dpeName, alias)
            .then(() => {
              result["alias"] = { success: true };
            })
            .catch((err: unknown) => {
              result["alias"] = { success: false, error: handleWinccoaError(err) };
            }),
        );
      }

      if (description !== undefined) {
        tasks.push(
          winccoa
            .dpSetDescription(dpeName, description)
            .then(() => {
              result["description"] = { success: true };
            })
            .catch((err: unknown) => {
              result["description"] = { success: false, error: handleWinccoaError(err) };
            }),
        );
      }

      if (format !== undefined) {
        tasks.push(
          winccoa
            .dpSetFormat(dpeName, format)
            .then(() => {
              result["format"] = { success: true };
            })
            .catch((err: unknown) => {
              result["format"] = { success: false, error: handleWinccoaError(err) };
            }),
        );
      }

      if (unit !== undefined) {
        tasks.push(
          winccoa
            .dpSetUnit(dpeName, unit)
            .then(() => {
              result["unit"] = { success: true };
            })
            .catch((err: unknown) => {
              result["unit"] = { success: false, error: handleWinccoaError(err) };
            }),
        );
      }

      await Promise.all(tasks);
      return textContent(safeJsonStringify(result));
    },
  );
}
