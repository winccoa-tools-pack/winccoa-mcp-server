/**
 * ASCII Manager Client
 *
 * Helper for invoking the WinCC OA ASCII Manager (WCCOAascii) as a child process
 * to export and import datapoints and datapoint types via DPL files.
 */

import { spawn } from "child_process";
import * as os from "os";

/** Result from running WCCOAascii. */
export interface AsciiRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Options for the ASCII Manager export operation. */
export interface AsciiExportOptions {
  /** Filter by datapoint name pattern, e.g. "Pump*;Valve*;" */
  filterDp?: string;
  /** Filter by datapoint type name. */
  filterDpType?: string;
  /**
   * Filter by category flags.
   * T=types, D=datapoints, A=address, O=online, P=parameters, H=history
   */
  filterCategory?: string;
  /** Export timestamps in local time instead of GMT. */
  localTime?: boolean;
  /** Output format version override. */
  outputVersion?: string;
  /** Language list for multilingual exports, e.g. "en_US.utf8,de_DE.utf8". */
  langList?: string;
}

/** Options for the ASCII Manager import operation. */
export interface AsciiImportOptions {
  /** Wait for import confirmation from the Event Manager. */
  wait?: boolean;
  /** Deactivate alerts during import. */
  inactivateAlert?: boolean;
  /** Treat timestamps as local time instead of GMT. */
  localTime?: boolean;
  /** Automatically confirm all prompts (required for non-interactive use). */
  yes?: boolean;
}

/**
 * Client for the WinCC OA ASCII Manager (WCCOAascii).
 *
 * Reads configuration from environment variables:
 *   WINCCOA_ASCII_BINARY  — path to WCCOAascii executable (default: "WCCOAascii")
 *   WINCCOA_ASCII_WORK_DIR — directory for temporary DPL files (default: OS temp dir)
 *   WINCCOA_PROJ          — WinCC OA project name for the -proj flag (optional)
 */
export class AsciiManagerClient {
  private readonly binaryPath: string;
  private readonly projectName: string | undefined;
  readonly workDir: string;

  private static readonly SPAWN_TIMEOUT_MS = 60_000;

  constructor() {
    const base = process.env["WINCCOA_ASCII_BINARY"] ?? "WCCOAascii";
    const suffix = process.platform === "win32" && !base.toLowerCase().endsWith(".exe") ? ".exe" : "";
    this.binaryPath = base + suffix;
    this.projectName = process.env["WINCCOA_PROJ"] ?? undefined;
    this.workDir = process.env["WINCCOA_ASCII_WORK_DIR"] ?? os.tmpdir();
  }

  /**
   * Export datapoints / types to a DPL file.
   * @param outputFile  Absolute path for the output file.
   * @param options  Export filter and format options.
   */
  async export(outputFile: string, options: AsciiExportOptions = {}): Promise<AsciiRunResult> {
    const args: string[] = [];

    if (this.projectName) {
      args.push("-proj", this.projectName);
    }
    if (options.filterCategory) {
      args.push("-filter", options.filterCategory);
    }
    if (options.filterDp) {
      args.push("-filterDp", options.filterDp);
    }
    if (options.filterDpType) {
      args.push("-filterDpType", options.filterDpType);
    }
    if (options.localTime) {
      args.push("-localTime");
    }
    if (options.outputVersion) {
      args.push("-outputVersion", options.outputVersion);
    }
    if (options.langList) {
      args.push("-langList", options.langList);
    }

    args.push("-out", outputFile);

    return this.run(args);
  }

  /**
   * Import datapoints / types from a DPL file.
   * @param inputFile  Absolute path to the input DPL file.
   * @param options  Import behaviour options.
   */
  async import(inputFile: string, options: AsciiImportOptions = {}): Promise<AsciiRunResult> {
    const args: string[] = [];

    if (this.projectName) {
      args.push("-proj", this.projectName);
    }
    if (options.wait) {
      args.push("-wait");
    }
    if (options.inactivateAlert) {
      args.push("-inactivateAlert");
    }
    if (options.localTime) {
      args.push("-localTime");
    }
    if (options.yes) {
      args.push("-yes");
    }

    args.push("-in", inputFile);

    return this.run(args);
  }

  /**
   * Spawn WCCOAascii with the given arguments and collect its output.
   * A hard timeout of 60 s kills the process if it does not terminate.
   */
  private run(args: string[]): Promise<AsciiRunResult> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      const proc = spawn(this.binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        timeout: AsciiManagerClient.SPAWN_TIMEOUT_MS,
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("close", (exitCode: number | null) => {
        resolve({ stdout, stderr, exitCode: exitCode ?? -1 });
      });

      proc.on("error", (err: Error) => {
        reject(new Error(`Failed to spawn '${this.binaryPath}': ${err.message}`));
      });
    });
  }
}
