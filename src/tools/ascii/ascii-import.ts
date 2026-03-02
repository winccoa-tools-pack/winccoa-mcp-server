/**
 * Tool: ascii/ascii_import
 *
 * Import WinCC OA datapoints / types from a DPL file using the WCCOAascii manager.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";
import { AsciiManagerClient } from "../../utils/ascii-manager-client.js";

export function registerAsciiImport(server: McpServer): void {
  server.registerTool(
    "ascii.ascii_import",
    {
      title: "ASCII Import (DPL)",
      description: `Import WinCC OA datapoints and/or datapoint types from a DPL file
using the WCCOAascii manager (child process).

⚠️  This operation modifies the WinCC OA project data. Use dryRun=true first
to validate the file before committing the import.

The WCCOAascii binary must be reachable. Configure its path via the
WINCCOA_ASCII_BINARY environment variable (default: "WCCOAascii").

Args:
  - inputFile (string): Absolute path to the DPL file to import.
    The file must exist and be readable.
  - dryRun (boolean, default false): When true, performs a check-only run
    without actually writing data to the project. Reports what would be imported.
  - inactivateAlert (boolean, default false): Temporarily deactivate alerts
    during import to avoid false alarms on intermediate states.
  - localTime (boolean, default false): Treat timestamps in the file as local time
    instead of UTC/GMT.

Returns:
  {
    "stdout": string,    // output from WCCOAascii
    "stderr": string,    // error output from WCCOAascii
    "exitCode": number,  // 0 = success
    "dryRun": boolean
  }

A non-zero exitCode indicates the import failed or produced warnings.
Inspect stdout and stderr for details.

Notes:
  - The process runs with a 60-second timeout.
  - Set WINCCOA_PROJ to specify the project name passed via the -proj flag.
  - Use ascii/ascii_export to create a DPL file for import.`,
      inputSchema: {
        inputFile: z
          .string()
          .min(1)
          .describe("Absolute path to the DPL file to import."),
        dryRun: z
          .boolean()
          .default(false)
          .describe(
            "When true, validate the file without writing to the project (default: false).",
          ),
        inactivateAlert: z
          .boolean()
          .default(false)
          .describe("Deactivate alerts during import to suppress false alarms (default: false)."),
        localTime: z
          .boolean()
          .default(false)
          .describe("Treat timestamps as local time instead of UTC/GMT (default: false)."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ inputFile, dryRun, inactivateAlert, localTime }) => {
      try {
        // Verify the file exists before spawning
        try {
          await fs.access(inputFile);
        } catch {
          return errorContent(`Input file not found or not readable: "${inputFile}"`);
        }

        const client = new AsciiManagerClient();

        const result = await client.import(inputFile, {
          wait: true,
          yes: !dryRun,     // omit -yes for dry run so ASCII manager prompts (then we pass dryRun=false)
          inactivateAlert,
          localTime,
        });

        return textContent(
          safeJsonStringify({
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            dryRun,
          }),
        );
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      }
    },
  );
}
