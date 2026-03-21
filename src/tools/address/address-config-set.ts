/**
 * Tool: address/address_config_set
 *
 * Enable or update peripheral address configuration on a single DPE.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { textContent, errorContent } from "../../utils/formatters.js";
import { checkDpesExist } from "../../utils/dp-exists-guard.js";
import { DPCONFIG_ADDRESS } from "../../constants/dp-configs.js";

export function registerAddressConfigSet(server: McpServer): void {
  server.registerTool(
    "address.address_config_set",
    {
      title: "Set Address Configuration",
      description: `Enable or update the peripheral address configuration on a WinCC OA
datapoint element (DPE).

Args:
  - dpeName (string): The DPE to configure. E.g. "Tank1.level"
  - reference (string): The peripheral address reference string.
  - direction (number): Address mode constant (DPATTR_ADDR_MODE_*).
    0 = Undefined, 1 = Output, 2 = Input spontaneous, 4 = Input poll, etc.
  - drvIdent (string): Driver identifier string, e.g. "S7", "OPC UA", "Modbus".
  - datatype (number): Driver-specific transformation type constant.
  - subindex (number, optional): Subindex within the peripheral address.
  - offset (number, optional): Byte offset within the peripheral address.
  - connection (string, optional): Connection name for the driver.
  - pollGroup (string, optional): Poll group name for cyclic polling.

Returns:
  { "success": true, "dpeName": string }

Notes:
  - If an address is already configured on the DPE, this call updates it.
  - Use address.address_config_delete to remove the address from a DPE.`,
      inputSchema: {
        dpeName: z
          .string()
          .min(1)
          .describe("Datapoint element to configure"),
        reference: z
          .string()
          .min(1)
          .describe("Peripheral address reference string"),
        direction: z
          .number()
          .int()
          .min(0)
          .describe("Address mode constant (DPATTR_ADDR_MODE_*)"),
        drvIdent: z
          .string()
          .min(1)
          .describe("Driver identifier, e.g. \"S7\", \"OPC UA\""),
        datatype: z
          .number()
          .int()
          .describe("Driver-specific transformation type constant"),
        subindex: z
          .number()
          .int()
          .optional()
          .describe("Subindex within the peripheral address"),
        offset: z
          .number()
          .int()
          .optional()
          .describe("Byte offset within the peripheral address"),
        connection: z
          .string()
          .optional()
          .describe("Connection name for the driver"),
        pollGroup: z
          .string()
          .optional()
          .describe("Poll group name for cyclic polling"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ dpeName, reference, direction, drvIdent, datatype, subindex, offset, connection, pollGroup }) => {
      const existError = checkDpesExist([dpeName]);
      if (existError) return existError;

      try {
        const winccoa = getWinccoa();

        const dpeAttrNames: string[] = [
          `${dpeName}:_address.._type`,
          `${dpeName}:_address.._reference`,
          `${dpeName}:_address.._direction`,
          `${dpeName}:_address.._drv_ident`,
          `${dpeName}:_address.._datatype`,
        ];
        const dpeAttrValues: unknown[] = [
          DPCONFIG_ADDRESS,
          reference,
          direction,
          drvIdent,
          datatype,
        ];

        if (subindex !== undefined) {
          dpeAttrNames.push(`${dpeName}:_address.._subindex`);
          dpeAttrValues.push(subindex);
        }
        if (offset !== undefined) {
          dpeAttrNames.push(`${dpeName}:_address.._offset`);
          dpeAttrValues.push(offset);
        }
        if (connection !== undefined) {
          dpeAttrNames.push(`${dpeName}:_address.._connection`);
          dpeAttrValues.push(connection);
        }
        if (pollGroup !== undefined) {
          dpeAttrNames.push(`${dpeName}:_address.._poll_group`);
          dpeAttrValues.push(pollGroup);
        }

        await winccoa.dpSetWait(dpeAttrNames, dpeAttrValues);

        return textContent(
          JSON.stringify({ success: true, dpeName }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
