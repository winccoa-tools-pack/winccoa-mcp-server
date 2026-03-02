/**
 * Tool: archive/archive_config_set
 *
 * Enable or update archive configuration on a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { checkDpesExist } from "../../utils/dp-exists-guard.js";
import { DPCONFIG_ARCHIVE } from "../../constants/dp-configs.js";

export function registerArchiveConfigSet(server: McpServer): void {
  server.registerTool(
    "archive.archive_config_set",
    {
      title: "Set Archive Configuration",
      description: `Enable or update the archive (historian) configuration on a WinCC OA
datapoint element (DPE).

Args:
  - dpeName (string): The DPE to configure. E.g. "Tank1.level"
  - archiveClass (string): Name of the WinCC OA archive class to use.
    Common values: "_NGA_G_EVENT" (on-change), "_NGA_G_1S" (1-second),
    "_NGA_G_1M" (1-minute), "_NGA_G_1H" (1-hour).
    The available classes depend on your WinCC OA project configuration.
  - smooth (number, optional): Smoothing type constant. Defaults to 0 (none).
  - correction (number, optional): Correction factor applied to archived values.
  - deadband (number, optional): Minimum change required to trigger a new archive entry.

Returns:
  { "success": true, "dpeName": string, "archiveClass": string }

Notes:
  - If archiving is already configured on the DPE, this call updates the configuration.
  - Use archive.archive_config_get to verify the result.
  - Use archive.archive_config_delete to remove archiving from a DPE.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to configure"),
        archiveClass: z
          .string()
          .min(1)
          .describe("Archive class name, e.g. \"_NGA_G_EVENT\""),
        smooth: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Smoothing type constant (default: 0 = none)"),
        correction: z
          .number()
          .optional()
          .describe("Correction factor for archived values"),
        deadband: z
          .number()
          .min(0)
          .optional()
          .describe("Deadband threshold for archive triggering"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, archiveClass, smooth, correction, deadband }) => {
      const existError = checkDpesExist([dpeName]);
      if (existError) return existError;

      try {
        const winccoa = getWinccoa();

        const dpeAttrNames: string[] = [
          `${dpeName}:_archive.._type`,
          `${dpeName}:_archive.._archive`,
        ];
        const dpeAttrValues: unknown[] = [DPCONFIG_ARCHIVE, archiveClass];

        if (smooth !== undefined) {
          dpeAttrNames.push(`${dpeName}:_archive.._smooth`);
          dpeAttrValues.push(smooth);
        }
        if (correction !== undefined) {
          dpeAttrNames.push(`${dpeName}:_archive.._correction`);
          dpeAttrValues.push(correction);
        }
        if (deadband !== undefined) {
          dpeAttrNames.push(`${dpeName}:_archive.._deadband`);
          dpeAttrValues.push(deadband);
        }

        await winccoa.dpSetWait(dpeAttrNames, dpeAttrValues);

        return textContent(
          JSON.stringify({ success: true, dpeName, archiveClass }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
