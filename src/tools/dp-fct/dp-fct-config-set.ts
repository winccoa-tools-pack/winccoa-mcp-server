/**
 * Tool: dp_fct/dp_fct_config_set
 *
 * Enable or update datapoint function configuration on a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { checkDpesExist } from "../../utils/dp-exists-guard.js";

export function registerDpFctConfigSet(server: McpServer): void {
  server.registerTool(
    "dp_fct.dp_fct_config_set",
    {
      title: "Set DP Function Configuration",
      description: `Enable or update the datapoint function configuration on a WinCC OA
datapoint element (DPE).

Args:
  - dpeName (string): The DPE to configure. E.g. "Tank1.level"
  - fctType (number): Function type constant.
    60 = DP function, 63 = Statistical function.
  - fct (string, optional): Formula expression.
  - global (string, optional): Global variables.
  - param (string, optional): Parameters.
  - day (number, optional): Stat: day.
  - dayOfWeek (number, optional): Stat: day of week.
  - month (number, optional): Stat: month.
  - time (number, optional): Stat: time.
  - delay (number, optional): Stat: delay.
  - interval (number, optional): Stat: interval.
  - oldNewCompare (boolean, optional): Stat: old/new comparison.
  - statType (number[], optional): Stat: statistical function types.
  - readArchive (number, optional): Stat: read archive flag.
  - intermRes (boolean, optional): Stat: calculate intermediate results.
  - intermResCyc (number, optional): Stat: intermediate result cycle time.

Returns:
  { "success": true, "dpeName": string, "fctType": number }

Notes:
  - If a DP function config is already configured on the DPE, this call updates it.
  - Use dp_fct.dp_fct_config_delete to remove the function config from a DPE.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to configure"),
        fctType: z
          .number()
          .int()
          .refine((v) => v === 60 || v === 63, {
            message: "fctType must be 60 (DP function) or 63 (Statistical function)",
          })
          .describe("Function type: 60 = DP function, 63 = Statistical function"),
        fct: z
          .string()
          .optional()
          .describe("Formula expression"),
        global: z
          .string()
          .optional()
          .describe("Global variables"),
        param: z
          .string()
          .optional()
          .describe("Parameters"),
        day: z
          .number()
          .int()
          .optional()
          .describe("Stat: day"),
        dayOfWeek: z
          .number()
          .int()
          .optional()
          .describe("Stat: day of week"),
        month: z
          .number()
          .int()
          .optional()
          .describe("Stat: month"),
        time: z
          .number()
          .int()
          .optional()
          .describe("Stat: time"),
        delay: z
          .number()
          .int()
          .optional()
          .describe("Stat: delay"),
        interval: z
          .number()
          .int()
          .optional()
          .describe("Stat: interval"),
        oldNewCompare: z
          .boolean()
          .optional()
          .describe("Stat: old/new comparison"),
        statType: z
          .array(z.number().int())
          .optional()
          .describe("Stat: statistical function types"),
        readArchive: z
          .number()
          .int()
          .optional()
          .describe("Stat: read archive flag"),
        intermRes: z
          .boolean()
          .optional()
          .describe("Stat: calculate intermediate results"),
        intermResCyc: z
          .number()
          .int()
          .optional()
          .describe("Stat: intermediate result cycle time"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({
      dpeName, fctType, fct, global, param,
      day, dayOfWeek, month, time, delay, interval,
      oldNewCompare, statType, readArchive, intermRes, intermResCyc,
    }) => {
      const existError = checkDpesExist([dpeName]);
      if (existError) return existError;

      try {
        const winccoa = getWinccoa();

        const dpeAttrNames: string[] = [
          `${dpeName}:_dp_fct.._type`,
        ];
        const dpeAttrValues: unknown[] = [fctType];

        if (fct !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._fct`);
          dpeAttrValues.push(fct);
        }
        if (global !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._global`);
          dpeAttrValues.push(global);
        }
        if (param !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._param`);
          dpeAttrValues.push(param);
        }
        if (day !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._day`);
          dpeAttrValues.push(day);
        }
        if (dayOfWeek !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._day_of_week`);
          dpeAttrValues.push(dayOfWeek);
        }
        if (month !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._month`);
          dpeAttrValues.push(month);
        }
        if (time !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._time`);
          dpeAttrValues.push(time);
        }
        if (delay !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._delay`);
          dpeAttrValues.push(delay);
        }
        if (interval !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._interval`);
          dpeAttrValues.push(interval);
        }
        if (oldNewCompare !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._old_new_compare`);
          dpeAttrValues.push(oldNewCompare);
        }
        if (statType !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._stat_type`);
          dpeAttrValues.push(statType);
        }
        if (readArchive !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._read_archive`);
          dpeAttrValues.push(readArchive);
        }
        if (intermRes !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._interm_res`);
          dpeAttrValues.push(intermRes);
        }
        if (intermResCyc !== undefined) {
          dpeAttrNames.push(`${dpeName}:_dp_fct.._interm_res_cyc`);
          dpeAttrValues.push(intermResCyc);
        }

        await winccoa.dpSetWait(dpeAttrNames, dpeAttrValues);

        return textContent(
          JSON.stringify({ success: true, dpeName, fctType }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
