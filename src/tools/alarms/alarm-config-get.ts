/**
 * Tool: alarms/alarm_config_get
 *
 * Read the current alarm configuration for a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import {
  DPCONFIG_NONE,
  DPCONFIG_ALERT_BINARYSIGNAL,
  DPCONFIG_ALERT_NONBINARYSIGNAL,
} from "../../constants/dp-configs.js";

/** Maximum number of alarm threshold levels to read for non-binary alarms. */
const MAX_LEVELS = 8;

export function registerAlarmConfigGet(server: McpServer): void {
  server.registerTool(
    "alarms.alarm_config_get",
    {
      title: "Get Alarm Configuration",
      description: `Read the alarm (_alert_hdl) configuration for a WinCC OA datapoint element (DPE).

Args:
  - dpeName (string): The DPE to read alarm config from. E.g. "Tank1.level"

Returns one of:
  { "dpeName": string, "enabled": false }
  — when no alarm is configured.

  {
    "dpeName": string, "enabled": true,
    "alarmType": "binary",
    "alertClass": string,       // e.g. "_warning"
    "activeState": boolean      // true = alarm active when DPE is true
  }
  — for binary (Bool) DPEs.

  {
    "dpeName": string, "enabled": true,
    "alarmType": "nonBinary",
    "alertClass": string,
    "thresholds": [             // up to 8 levels, only configured ones included
      { "level": number, "lowerLimit": number, "upperLimit": number, "alertClass": string }
    ]
  }
  — for numeric DPEs.

Notes:
  - Use alarms.alarm_config_set to enable or update alarm configuration.
  - Use alarms.alarm_config_delete to remove alarm configuration.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to read alarm config from"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName }) => {
      try {
        const winccoa = getWinccoa();

        // Step 1: read _type, _class, _active_state
        const baseAttrs = [
          `${dpeName}:_alert_hdl.._type`,
          `${dpeName}:_alert_hdl.._class`,
          `${dpeName}:_alert_hdl.._active_state`,
        ];
        const baseRaw = (await winccoa.dpGet(baseAttrs)) as unknown[];
        const configType = baseRaw[0] as number;

        if (configType === DPCONFIG_NONE || configType === undefined) {
          return textContent(safeJsonStringify({ dpeName, enabled: false }));
        }

        if (configType === DPCONFIG_ALERT_BINARYSIGNAL) {
          const alertClass = baseRaw[1] as string;
          const activeState = baseRaw[2] as boolean;
          return textContent(
            safeJsonStringify({
              dpeName,
              enabled: true,
              alarmType: "binary",
              alertClass,
              activeState,
            }),
          );
        }

        if (configType === DPCONFIG_ALERT_NONBINARYSIGNAL) {
          const alertClass = baseRaw[1] as string;

          // Step 2: read all threshold levels (1..MAX_LEVELS)
          const levelAttrs = Array.from({ length: MAX_LEVELS }, (_, i) => [
            `${dpeName}:_alert_hdl.${i + 1}._l_limit`,
            `${dpeName}:_alert_hdl.${i + 1}._u_limit`,
            `${dpeName}:_alert_hdl.${i + 1}._class`,
          ]).flat();

          const levelRaw = (await winccoa.dpGet(levelAttrs)) as unknown[];

          const thresholds = [];
          for (let i = 0; i < MAX_LEVELS; i++) {
            const lowerLimit = levelRaw[i * 3] as number | undefined;
            const upperLimit = levelRaw[i * 3 + 1] as number | undefined;
            const lvlClass = levelRaw[i * 3 + 2] as string | undefined;

            // Skip unconfigured levels (null / undefined limits and empty class)
            if (lowerLimit == null && upperLimit == null && !lvlClass) continue;

            thresholds.push({
              level: i + 1,
              lowerLimit: lowerLimit ?? null,
              upperLimit: upperLimit ?? null,
              alertClass: lvlClass ?? "",
            });
          }

          return textContent(
            safeJsonStringify({
              dpeName,
              enabled: true,
              alarmType: "nonBinary",
              alertClass,
              thresholds,
            }),
          );
        }

        // Unknown alarm config type — return raw type for diagnostics
        return textContent(
          safeJsonStringify({ dpeName, enabled: true, alarmType: "unknown", rawConfigType: configType }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
