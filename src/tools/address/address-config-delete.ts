/**
 * Tool: address/address_config_delete
 *
 * Remove peripheral address configuration from one or more DPEs
 * by setting their config type to DPCONFIG_NONE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { DPCONFIG_NONE } from "../../constants/dp-configs.js";

export function registerAddressConfigDelete(server: McpServer): void {
  server.registerTool(
    "address.address_config_delete",
    {
      title: "Delete Address Configuration",
      description: `Remove the peripheral address configuration from one or more WinCC OA
datapoint elements (DPEs) by setting their address config type to DPCONFIG_NONE.

Args:
  - dpeNames (string[]): DPE names whose address config should be removed.
    E.g. ["Tank1.level", "Pump1.speed"]

Returns:
  JSON object mapping each DPE name to a result:
  {
    "Tank1.level": { "success": true },
    "Pump1.speed": { "success": false, "error": "..." }
  }

  Each DPE is processed individually so a failure on one does not abort the rest.`,
      inputSchema: {
        dpeNames: z
          .array(z.string().min(1))
          .min(1, "At least one DPE name is required")
          .describe("Datapoint element name(s) to remove address config from"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeNames }) => {
      const winccoa = getWinccoa();

      const results: Record<string, { success: boolean; error?: string }> = {};

      for (const dpe of dpeNames) {
        try {
          await winccoa.dpSetWait(`${dpe}:_address.._type`, DPCONFIG_NONE);
          results[dpe] = { success: true };
        } catch (error: unknown) {
          results[dpe] = { success: false, error: handleWinccoaError(error) };
        }
      }

      return textContent(safeJsonStringify(results));
    },
  );
}
