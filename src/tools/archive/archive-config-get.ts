/**
 * Tool: archive/archive_config_get
 *
 * Read the current archive configuration for one or more DPEs.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { DPCONFIG_NONE } from "../../constants/dp-configs.js";

export function registerArchiveConfigGet(server: McpServer): void {
  server.registerTool(
    "archive.archive_config_get",
    {
      title: "Get Archive Configuration",
      description: `Read the archive (historian) configuration for one or more WinCC OA
datapoint elements (DPEs).

Args:
  - dpeNames (string[]): DPE names whose archive config to read.
    E.g. ["Tank1.level", "Pump1.speed"]

Returns:
  JSON array, one entry per DPE:
  {
    "dpeName": string,
    "enabled": boolean,      // false if archiving is disabled (DPCONFIG_NONE)
    "archiveClass": string,  // e.g. "_NGA_G_EVENT", "_NGA_G_1S"  (present if enabled)
    "smooth": number         // smoothing type constant              (present if enabled)
  }

Notes:
  - Use archive.archive_config_set to enable archiving on a DPE.
  - Archiving is only possible on DPEs whose datapoint type supports it.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to read archive config for"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeNames }) => {
      try {
        const winccoa = getWinccoa();

        // Build a flat list of attribute DPE paths, 3 per requested DPE
        const attrPaths = dpeNames.flatMap((dpe) => [
          `${dpe}:_archive.._type`,
          `${dpe}:_archive.._archive`,
          `${dpe}:_archive.._smooth`,
        ]);

        const raw = (await winccoa.dpGet(attrPaths)) as unknown[];

        const result = dpeNames.map((dpeName, i) => {
          const configType = raw[i * 3] as number;
          const archiveClass = raw[i * 3 + 1] as string;
          const smooth = raw[i * 3 + 2] as number;

          if (configType === DPCONFIG_NONE || configType === undefined) {
            return { dpeName, enabled: false };
          }
          return { dpeName, enabled: true, archiveClass, smooth };
        });

        return textContent(safeJsonStringify(result));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
