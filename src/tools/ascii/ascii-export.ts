/**
 * Tool: ascii/ascii_export
 *
 * Export WinCC OA datapoints / types to a DPL file using the WCCOAascii manager.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { AsciiManagerClient } from "../../utils/ascii-manager-client.js";

/** If the combined output exceeds this length, return a file reference instead. */
const INLINE_CHAR_LIMIT = 20_000;

export function registerAsciiExport(server: McpServer): void {
  server.registerTool(
    "ascii.ascii_export",
    {
      title: "ASCII Export (DPL)",
      description: `Export WinCC OA datapoints and/or datapoint types to a DPL file
using the WCCOAascii manager (child process).

The WCCOAascii binary must be reachable. Configure its path via the
WINCCOA_ASCII_BINARY environment variable (default: "WCCOAascii").

Args:
  - dpPattern (string, default "*"): Datapoint name filter. Semicolon-separated
    glob patterns. E.g. "Pump*" or "Pump*;Valve*;Tank*"
  - dpType (string, optional): Filter by datapoint type name.
    E.g. "_ExampleType"
  - outputFile (string, optional): Absolute path for the output DPL file.
    If omitted, a temporary file is created in the work directory
    (WINCCOA_ASCII_WORK_DIR env var, default: OS temp dir).
  - includeConfigs (boolean, default true): Include config attributes
    (address, archive, alert_hdl, pv_range, etc.) in the export.

Returns one of:
  When output ≤ 20,000 characters:
  {
    "file": string,
    "content": string,   // inline DPL content
    "stdout": string,
    "exitCode": number
  }

  When output > 20,000 characters (file reference only):
  {
    "file": string,
    "sizeBytes": number,
    "message": "Output exceeds inline limit — read the file directly."
  }

Notes:
  - The process runs with a 60-second timeout.
  - Set WINCCOA_PROJ to specify the project name passed via the -proj flag.
  - Use ascii/ascii_import to import a previously exported DPL file.`,
      inputSchema: {
        dpPattern: z
          .string()
          .default("*")
          .describe('Datapoint name filter (default "*"). Semicolon-separated globs.'),
        dpType: z
          .string()
          .optional()
          .describe("Filter by datapoint type name (optional)."),
        outputFile: z
          .string()
          .optional()
          .describe("Absolute path for the output DPL file (optional; temp file used if omitted)."),
        includeConfigs: z
          .boolean()
          .default(true)
          .describe(
            "Include config attributes (address, archive, alerts, etc.) in the export (default: true).",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ dpPattern, dpType, outputFile, includeConfigs }) => {
      try {
        const client = new AsciiManagerClient();

        const resolvedOutput =
          outputFile ??
          path.join(
            client.workDir,
            `winccoa_export_${Date.now()}.dpl`,
          );

        // Build category filter: D=datapoints, T=types, A=address, P=parameters, H=history, O=online
        const filterCategory = includeConfigs ? "DTAPHO" : "DT";

        const result = await client.export(resolvedOutput, {
          filterDp: dpPattern !== "*" ? dpPattern : undefined,
          filterDpType: dpType,
          filterCategory,
        });

        if (result.exitCode !== 0) {
          return errorContent(
            `WCCOAascii export failed (exit code ${result.exitCode}).\n` +
              `stderr: ${result.stderr}\nstdout: ${result.stdout}`,
          );
        }

        // Read the output file
        let fileContent: string;
        try {
          fileContent = await fs.readFile(resolvedOutput, "utf-8");
        } catch {
          // File might not have been created (no matching DPs)
          return textContent(
            safeJsonStringify({
              file: resolvedOutput,
              content: "",
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
            }),
          );
        }

        const totalLen = fileContent.length + result.stdout.length;

        if (totalLen > INLINE_CHAR_LIMIT) {
          const stat = await fs.stat(resolvedOutput);
          return textContent(
            safeJsonStringify({
              file: resolvedOutput,
              sizeBytes: stat.size,
              message:
                "Output exceeds inline limit — read the file directly using the path above.",
            }),
          );
        }

        return textContent(
          safeJsonStringify({
            file: resolvedOutput,
            content: fileContent,
            stdout: result.stdout,
            exitCode: result.exitCode,
          }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
