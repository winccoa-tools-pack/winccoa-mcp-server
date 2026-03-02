/**
 * Tool: alarms/alarm_config_set
 *
 * Enable or update alarm configuration on a single DPE.
 * Supports both binary (Bool) and non-binary (numeric) alarm types.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { checkDpesExist } from "../../utils/dp-exists-guard.js";
import {
  DPCONFIG_ALERT_BINARYSIGNAL,
  DPCONFIG_ALERT_NONBINARYSIGNAL,
} from "../../constants/dp-configs.js";
import { WinccoaElementType } from "winccoa-manager";

const thresholdSchema = z.object({
  lowerLimit: z.number().describe("Lower alarm limit for this level"),
  upperLimit: z.number().describe("Upper alarm limit for this level"),
  alertClass: z
    .string()
    .min(1)
    .describe("Alert class for this level, e.g. \"_warning\", \"_alert\""),
});

export function registerAlarmConfigSet(server: McpServer): void {
  server.registerTool(
    "alarms.alarm_config_set",
    {
      title: "Set Alarm Configuration",
      description: `Enable or update the alarm (_alert_hdl) configuration on a WinCC OA
datapoint element (DPE).

Args:
  - dpeName (string): The DPE to configure. E.g. "Tank1.level" or "Motor1.running"
  - alarmType ("binary" | "nonBinary"):
      "binary"    — for Bool DPEs (on/off alarm)
      "nonBinary" — for numeric DPEs (threshold-based alarm)
  - alertClass (string): Top-level alert class, e.g. "_warning", "_alert", "_error".
  - activeState (boolean, optional, default true):
      For binary alarms only. true = alarm active when DPE value is true.
  - thresholds (array, required for nonBinary):
      Up to 8 threshold levels. Level index is assigned in array order (1-based).
      Each entry: { lowerLimit, upperLimit, alertClass }

Returns:
  { "success": true, "dpeName": string, "alarmType": string }

Notes:
  - alarmType must match the actual DPE element type (Bool ↔ binary, numeric ↔ nonBinary).
    This is validated at runtime; a mismatch returns an error.
  - If an alarm is already configured, this call overwrites it.
  - Use alarms.alarm_config_get to verify the result.
  - Use alarms.alarm_config_delete to remove alarm configuration.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to configure"),
        alarmType: z
          .enum(["binary", "nonBinary"])
          .describe("\"binary\" for Bool DPEs; \"nonBinary\" for numeric DPEs"),
        alertClass: z
          .string()
          .min(1)
          .describe("Top-level alert class, e.g. \"_warning\""),
        activeState: z
          .boolean()
          .optional()
          .default(true)
          .describe("Binary alarms only: true = alarm when DPE is true (default: true)"),
        thresholds: z
          .array(thresholdSchema)
          .min(1)
          .max(8)
          .optional()
          .describe("Non-binary alarms: 1–8 threshold levels (required for nonBinary)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, alarmType, alertClass, activeState, thresholds }) => {
      const existError = checkDpesExist([dpeName]);
      if (existError) return existError;

      try {
        const winccoa = getWinccoa();

        // Validate that the chosen alarmType matches the actual DPE element type
        const elementType = winccoa.dpElementType(dpeName);
        const isBoolDpe = elementType === WinccoaElementType.Bool;

        if (alarmType === "binary" && !isBoolDpe) {
          return errorContent(
            `alarmType "binary" requires a Bool DPE, but "${dpeName}" has element type ${WinccoaElementType[elementType] ?? elementType}.`,
          );
        }
        if (alarmType === "nonBinary" && isBoolDpe) {
          return errorContent(
            `alarmType "nonBinary" cannot be used on a Bool DPE ("${dpeName}"). Use alarmType "binary" instead.`,
          );
        }

        if (alarmType === "binary") {
          await winccoa.dpSetWait(
            [
              `${dpeName}:_alert_hdl.._type`,
              `${dpeName}:_alert_hdl.._class`,
              `${dpeName}:_alert_hdl.._active_state`,
            ],
            [DPCONFIG_ALERT_BINARYSIGNAL, alertClass, activeState],
          );
        } else {
          // nonBinary
          if (!thresholds || thresholds.length === 0) {
            return errorContent(
              "thresholds is required and must have at least one entry for alarmType \"nonBinary\".",
            );
          }

          const dpeAttrNames: string[] = [
            `${dpeName}:_alert_hdl.._type`,
            `${dpeName}:_alert_hdl.._class`,
          ];
          const dpeAttrValues: unknown[] = [
            DPCONFIG_ALERT_NONBINARYSIGNAL,
            alertClass,
          ];

          // Map Zod array index (0-based) to WinCC OA level (1-based)
          for (let i = 0; i < thresholds.length; i++) {
            const level = i + 1;
            const t = thresholds[i];
            dpeAttrNames.push(
              `${dpeName}:_alert_hdl.${level}._l_limit`,
              `${dpeName}:_alert_hdl.${level}._u_limit`,
              `${dpeName}:_alert_hdl.${level}._class`,
            );
            dpeAttrValues.push(t!.lowerLimit, t!.upperLimit, t!.alertClass);
          }

          await winccoa.dpSetWait(dpeAttrNames, dpeAttrValues);
        }

        return textContent(
          JSON.stringify({ success: true, dpeName, alarmType }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
