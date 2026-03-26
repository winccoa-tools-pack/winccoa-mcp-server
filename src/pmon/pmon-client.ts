/**
 * PMON TCP Client
 *
 * Communicates with the WinCC OA Process Monitor (PMON) via TCP.
 * Each command opens a fresh socket (connect-on-demand, no persistent connection).
 * No npm dependencies — uses Node.js built-in `net` module.
 */

import * as net from "net";
import type {
  PmonConfig,
  PmonCommandResult,
  PmonManagerEntry,
  PmonManagerProperties,
  PmonStatus,
} from "./pmon-types.js";
import { PmonError } from "./pmon-types.js";
import {
  parseManagerList,
  parseManagerProperties,
  parseManagerStati,
  parseProjectName,
} from "./pmon-parser.js";

export class PmonClient {
  private readonly host: string;
  private readonly port: number;
  private readonly user: string;
  private readonly password: string;
  private readonly timeoutMs: number;

  constructor(config: PmonConfig = {}) {
    this.host = config.host ?? "localhost";
    this.port = config.port ?? 4999;
    this.user = config.user ?? "";
    this.password = config.password ?? "";
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Get status of all managers (state, PID, start mode, etc.). */
  async getManagerStati(): Promise<PmonStatus> {
    const raw = await this.sendCommand("MGRLIST:STATI");
    return parseManagerStati(raw);
  }

  /** Get configuration list of all managers. */
  async getManagerList(): Promise<PmonManagerEntry[]> {
    const raw = await this.sendCommand("MGRLIST:LIST");
    return parseManagerList(raw);
  }

  /** Start a manager by its 1-based index. */
  async startManager(index: number): Promise<PmonCommandResult> {
    return this.singleManagerCommand("START", index);
  }

  /** Stop a manager (SIGTERM) by its 1-based index. */
  async stopManager(index: number): Promise<PmonCommandResult> {
    return this.singleManagerCommand("STOP", index);
  }

  /** Force-kill a manager (SIGKILL) by its 1-based index. */
  async killManager(index: number): Promise<PmonCommandResult> {
    return this.singleManagerCommand("KILL", index);
  }

  /**
   * Add a new manager to the PMON configuration.
   *
   * @param index Position (1-based) where to insert.
   * @param manager Manager executable name (without .exe).
   * @param startMode "manual" | "once" | "always"
   * @param secKill Seconds before SIGKILL (default 30).
   * @param restartCount Automatic restart attempts (default 3).
   * @param resetMin Minutes before restart counter resets (default 5).
   * @param options Command-line options (default "").
   */
  async addManager(
    index: number,
    manager: string,
    startMode: string = "always",
    secKill: number = 30,
    restartCount: number = 3,
    resetMin: number = 5,
    options: string = "",
  ): Promise<PmonCommandResult> {
    if (index < 1 || index > 100) {
      return { success: false, error: "Manager index must be between 1 and 100" };
    }
    if (!manager || manager.trim() === "") {
      return { success: false, error: "Manager name is required" };
    }
    const cmd = `SINGLE_MGR:INS ${index} ${manager} ${startMode} ${secKill} ${restartCount} ${resetMin} ${options}`;
    return this.executeCommand(cmd);
  }

  /** Remove a manager from the PMON configuration by its 1-based index. */
  async removeManager(index: number): Promise<PmonCommandResult> {
    if (index < 1) {
      return { success: false, error: "Manager index must be at least 1 (cannot remove PMON itself)" };
    }
    return this.executeCommand(`SINGLE_MGR:DEL ${index}`);
  }

  /** Get properties for a specific manager. */
  async getManagerProperties(index: number): Promise<PmonManagerProperties> {
    if (index < 1) {
      throw new PmonError("PROTOCOL_ERROR", "Manager index must be at least 1");
    }
    const raw = await this.sendCommand(`SINGLE_MGR:PROP_GET ${index}`);
    return parseManagerProperties(raw);
  }

  /**
   * Update properties for a specific manager.
   *
   * @param index 1-based manager index.
   * @param startMode "manual" | "once" | "always"
   * @param secKill Seconds before SIGKILL.
   * @param restartCount Automatic restart attempts.
   * @param resetMin Minutes before restart counter resets.
   * @param options Command-line options.
   */
  async setManagerProperties(
    index: number,
    startMode: string,
    secKill: number,
    restartCount: number,
    resetMin: number,
    options: string = "",
  ): Promise<PmonCommandResult> {
    if (index < 1) {
      return { success: false, error: "Manager index must be at least 1" };
    }
    const cmd = `SINGLE_MGR:PROP_PUT ${index} ${startMode} ${secKill} ${restartCount} ${resetMin} ${options}`;
    return this.executeCommand(cmd);
  }

  /** Get the project name from PMON. */
  async getProjectName(): Promise<string> {
    const raw = await this.sendCommand("SYS:PROJ_NAME");
    return parseProjectName(raw);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async singleManagerCommand(action: string, index: number): Promise<PmonCommandResult> {
    if (index < 1) {
      return { success: false, error: "Manager index must be at least 1" };
    }
    return this.executeCommand(`SINGLE_MGR:${action} ${index}`);
  }

  private async executeCommand(command: string): Promise<PmonCommandResult> {
    try {
      const raw = await this.sendCommand(command);
      return { success: true, data: raw.trim() };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }

  /**
   * Open a TCP socket to PMON, send an authenticated command, and collect the response.
   *
   * Protocol:
   *   Send: `<user>#<password>#<command>\n`
   *   Recv: response terminated by `\n;` or `;` (for list commands), or server closes connection.
   */
  private sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let response = "";
      let dataReceived = false;

      // Auth prefix: "user#password#" or "##" when no credentials
      const authPrefix =
        this.user || this.password
          ? `${this.user}#${this.password}#`
          : "##";

      const fullCommand = authPrefix + command;

      const timeoutHandle = setTimeout(() => {
        client.destroy();
        if (dataReceived && response.length > 0) {
          resolve(response);
        } else {
          reject(new PmonError("TIMEOUT", `PMON connection timeout after ${this.timeoutMs}ms`));
        }
      }, this.timeoutMs);

      client.connect(this.port, this.host, () => {
        client.write(fullCommand + "\n");
      });

      client.on("data", (data) => {
        dataReceived = true;
        response += data.toString();

        // Response is complete when it contains "\n;" or ends with ";"
        if (response.includes("\n;") || response.endsWith(";")) {
          clearTimeout(timeoutHandle);
          client.end();
          resolve(response);
        }
      });

      client.on("end", () => {
        clearTimeout(timeoutHandle);
        if (dataReceived) {
          resolve(response);
        }
      });

      client.on("error", (err) => {
        clearTimeout(timeoutHandle);
        if (err.message.includes("ECONNREFUSED")) {
          reject(new PmonError("CONNECTION_REFUSED", `PMON connection refused at ${this.host}:${this.port}`));
        } else {
          reject(new PmonError("PROTOCOL_ERROR", `PMON connection error: ${err.message}`));
        }
      });
    });
  }
}
