/**
 * Tool: script/script_execute
 *
 * Execute a WinCC OA CTRL script — inline code or a named .ctl file.
 * Captures log output written during execution.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { openSync, readSync, closeSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { WinccoaCtrlScript, WinccoaCtrlType } from "winccoa-manager";
import { getWinccoa } from "../../winccoa-client.js";
import { handleWinccoaError } from "../../utils/error-handler.js";
import { safeJsonStringify, textContent, errorContent } from "../../utils/formatters.js";

// ---------------------------------------------------------------------------
// CTRL type map — string enum values → WinccoaCtrlType enum
// ---------------------------------------------------------------------------

const CTRL_TYPE_MAP: Record<string, WinccoaCtrlType> = {
  void: WinccoaCtrlType.void,
  anytype: WinccoaCtrlType.anytype,
  int: WinccoaCtrlType.int,
  uint: WinccoaCtrlType.uint,
  long: WinccoaCtrlType.long,
  ulong: WinccoaCtrlType.ulong,
  float: WinccoaCtrlType.float,
  bool: WinccoaCtrlType.bool,
  bit32: WinccoaCtrlType.bit32,
  string: WinccoaCtrlType.string,
  time: WinccoaCtrlType.time,
  langString: WinccoaCtrlType.langString,
  blob: WinccoaCtrlType.blob,
};

// ---------------------------------------------------------------------------
// Log file helper
// ---------------------------------------------------------------------------

/**
 * Finds the most recently modified .log file in <projPath>/log/ that is
 * likely to contain CTRL manager output (PVSS_II.log or WCCOActrl*.log).
 * Returns the absolute path, or null if none found.
 */
function findMostRecentLogFile(projPath: string): string | null {
  const logDir = join(projPath, "log");
  try {
    const files = readdirSync(logDir)
      .filter(
        (f) =>
          f.endsWith(".log") &&
          (f.startsWith("PVSS_II") || f.startsWith("WCCOActrl")),
      )
      .map((f) => ({ f, mtime: statSync(join(logDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length ? join(logDir, files[0]!.f) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the delta portion of a log file between two byte offsets.
 * If the delta exceeds 5 000 characters, returns only the last N lines that fit,
 * with a truncation notice prepended.
 */
function readLogDelta(
  logFile: string,
  offsetBefore: number,
  maxChars = 5_000,
): string[] {
  try {
    const offsetAfter = statSync(logFile).size;
    if (offsetAfter <= offsetBefore) return [];

    const len = offsetAfter - offsetBefore;
    const fd = openSync(logFile, "r");
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, offsetBefore);
    closeSync(fd);

    const raw = buf.toString("utf8");
    const lines = raw.split("\n").filter((l) => l.trim());

    if (raw.length <= maxChars) return lines;

    // Truncate: take lines from the end that fit within maxChars
    const truncated: string[] = [];
    let chars = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      chars += lines[i]!.length + 1;
      if (chars > maxChars) break;
      truncated.unshift(lines[i]!);
    }
    return [
      `[Log truncated — showing last ${truncated.length} of ${lines.length} lines]`,
      ...truncated,
    ];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Cached paths
// ---------------------------------------------------------------------------

let cachedProjPath: string | null = null;

function getProjPath(): string {
  if (!cachedProjPath) {
    cachedProjPath = getWinccoa().getPaths()["projPath"] ?? "";
  }
  return cachedProjPath;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerScriptExecute(server: McpServer): void {
  server.registerTool(
    "script.script_execute",
    {
      title: "Execute CTRL Script",
      description: `Execute a WinCC OA CTRL (Control Language) script and return the result.

Supports two modes — provide exactly ONE of:
  - code (string):     Inline CTRL code to execute.
  - filePath (string): Path or name of a .ctl script file to load.
                       WinccoaCtrlScript.fromFile searches WinCC OA script directories
                       and appends .ctl automatically if omitted.

The functionName parameter specifies which function inside the script to call.
The function's return value is captured and returned.

Log output (DebugN, throwError) written during execution is captured from the
most recently modified PVSS_II.log or WCCOActrl*.log file in <projPath>/log/.

Args:
  - code (string):           Inline CTRL code (mutually exclusive with filePath).
  - filePath (string):       Script file path or name (mutually exclusive with code).
  - functionName (string):   Function to call inside the script.
  - params (unknown[]):      Parameters to pass to the function (default: []).
  - paramTypes (string[]):   CTRL types for each parameter — must match params length.
                             Allowed values: void, anytype, int, uint, long, ulong,
                             float, bool, bit32, string, time, langString, blob.
  - timeoutMs (number):      Maximum execution time in ms (1–30000, default: 5000).
  - captureLog (boolean):    Whether to capture log delta (default: true).

Returns:
  JSON object with:
  - "result":          unknown   – return value from the CTRL function
  - "executionTimeMs": number    – actual execution time in milliseconds
  - "logLines":        string[]  – lines appended to log during execution
  - "logFile":         string|null – absolute path of the captured log file

Error Handling:
  - Returns error if neither code nor filePath is provided.
  - Returns error if both code and filePath are provided.
  - Returns error if execution times out or the script throws.`,
      inputSchema: {
        code: z.string().optional().describe("Inline CTRL code to execute"),
        filePath: z.string().optional().describe("CTRL script file path or name"),
        functionName: z.string().min(1).describe("Function name to call inside the script"),
        params: z.array(z.unknown()).default([]).describe("Parameters for the function"),
        paramTypes: z
          .array(
            z.enum([
              "void",
              "anytype",
              "int",
              "uint",
              "long",
              "ulong",
              "float",
              "bool",
              "bit32",
              "string",
              "time",
              "langString",
              "blob",
            ]),
          )
          .default([])
          .describe("CTRL type for each parameter — must match params in length"),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(30_000)
          .default(5_000)
          .describe("Execution timeout in milliseconds (max: 30000)"),
        captureLog: z
          .boolean()
          .default(true)
          .describe("Whether to capture log output written during execution"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ code, filePath, functionName, params, paramTypes, timeoutMs, captureLog }) => {
      // Validate mutual exclusion
      if (!code && !filePath) {
        return errorContent("Provide either code or filePath — neither was supplied.");
      }
      if (code && filePath) {
        return errorContent("Provide only one of code or filePath — both were supplied.");
      }

      const winccoa = getWinccoa();

      // Optional log capture — record offset before execution
      const projPath = getProjPath();
      const logFile = captureLog ? findMostRecentLogFile(projPath) : null;
      const offsetBefore = logFile ? (() => { try { return statSync(logFile).size; } catch { return 0; } })() : 0;

      // Map string paramTypes → WinccoaCtrlType[]
      const mappedTypes = paramTypes.map((t) => CTRL_TYPE_MAP[t]!);

      let script: InstanceType<typeof WinccoaCtrlScript> | null = null;
      const startMs = Date.now();

      try {
        // Create script instance
        if (code) {
          script = new WinccoaCtrlScript(winccoa, code, functionName);
        } else {
          script = await WinccoaCtrlScript.fromFile(winccoa, filePath!);
        }

        // Execute with timeout
        const execution = script.start(functionName, params, mappedTypes);
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Script execution timed out after ${timeoutMs} ms`)), timeoutMs),
        );

        const result = await Promise.race([execution, timeout]);
        const executionTimeMs = Date.now() - startMs;

        // Capture log delta
        const logLines = logFile
          ? readLogDelta(logFile, offsetBefore)
          : [];

        const output = {
          result,
          executionTimeMs,
          logLines,
          logFile,
        };
        return textContent(safeJsonStringify(output));
      } catch (error: unknown) {
        return errorContent(handleWinccoaError(error));
      } finally {
        script?.stop();
      }
    },
  );
}
