/**
 * Tool: common/common_get
 *
 * Read common DPE metadata (alias, description, format, unit) for a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

const FIELD_ENUM = ["alias", "description", "format", "unit"] as const;

export function registerCommonGet(server: McpServer): void {
  server.registerTool(
    "common.common_get",
    {
      title: "Get Common DPE Metadata",
      description: `Read common metadata fields (alias, description, format, unit) for a
WinCC OA datapoint element (DPE).

Args:
  - dpeName (string): The DPE to query. E.g. "Tank1.level"
  - fields (string[], default all): Which fields to return.
    Allowed values: "alias", "description", "format", "unit"

Returns:
  JSON object:
  {
    "dpeName": string,
    "alias": string | undefined,
    "description": string | Record<string,string> | undefined,
    "format":      string | Record<string,string> | undefined,
    "unit":        string | Record<string,string> | undefined
  }

  Only the requested fields are included in the response.
  Description, format, and unit may be a plain string or a language-keyed
  object (e.g. { "en_US": "Level", "de_DE": "Füllstand" }).

Notes:
  - Use common.common_set to update these fields.
  - Use common.common_delete to clear individual fields.`,
      inputSchema: {
        dpeName: z.string().min(1).describe("Datapoint element name to read metadata for"),
        fields: z
          .array(z.enum(FIELD_ENUM))
          .min(1)
          .default(["alias", "description", "format", "unit"])
          .describe('Fields to retrieve. Defaults to all: ["alias","description","format","unit"]'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, fields }) => {
      try {
        const winccoa = getWinccoa();
        const result: Record<string, unknown> = { dpeName };

        if (fields.includes("alias")) {
          result["alias"] = winccoa.dpGetAlias(dpeName);
        }
        if (fields.includes("description")) {
          result["description"] = winccoa.dpGetDescription(dpeName);
        }
        if (fields.includes("format")) {
          result["format"] = winccoa.dpGetFormat(dpeName);
        }
        if (fields.includes("unit")) {
          result["unit"] = winccoa.dpGetUnit(dpeName);
        }

        return textContent(safeJsonStringify(result));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
