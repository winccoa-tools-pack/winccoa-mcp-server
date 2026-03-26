/**
 * Pure response parsers for PMON TCP protocol responses.
 *
 * Protocol format reverse-engineered from the original winccoa-ae-js-mcpserver repo.
 */

import type {
  PmonManagerEntry,
  PmonManagerStatus,
  PmonManagerProperties,
  PmonStatus,
} from "./pmon-types.js";
import { PmonError, PmonStartMode, PmonState } from "./pmon-types.js";

/**
 * Parse a MGRLIST:STATI response.
 *
 * Format:
 * ```
 * LIST:<count>
 * <state>;<PID>;<startMode>;<startTime>;<manNum>
 * ...
 * <modeNumeric> <modeString> <emergencyActive> <demoModeActive>;
 * ```
 */
export function parseManagerStati(raw: string): PmonStatus {
  const lines = raw.trim().split("\n");
  const managers: PmonManagerStatus[] = [];

  if (!lines[0] || !lines[0].startsWith("LIST:")) {
    throw new PmonError(
      "PROTOCOL_ERROR",
      `Invalid MGRLIST:STATI response: expected "LIST:<count>", got ${JSON.stringify(lines[0])}`,
    );
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    // Final status line ends with ";"
    if (line.endsWith(";")) {
      const parts = line.slice(0, -1).trim().split(/\s+/);
      return {
        managers,
        modeNumeric: parseInt(parts[0] || "0", 10),
        modeString: parts[1] || "UNKNOWN",
        emergencyActive: parseInt(parts[2] || "0", 10),
        demoModeActive: parseInt(parts[3] || "0", 10),
      };
    }

    // Manager line: <state>;<PID>;<startMode>;<startTime>;<manNum>
    const parts = line.split(";");
    if (parts.length >= 5) {
      managers.push({
        index: i - 1,
        state: parseInt(parts[0] || "0", 10) as PmonState,
        pid: parseInt(parts[1] || "0", 10),
        startMode: parseInt(parts[2] || "0", 10) as PmonStartMode,
        startTime: parts[3] || "",
        manNum: parseInt(parts[4] || "0", 10),
      });
    }
  }

  // Fallback if no trailing status line was found
  return {
    managers,
    modeNumeric: 0,
    modeString: "UNKNOWN",
    emergencyActive: 0,
    demoModeActive: 0,
  };
}

/**
 * Parse a MGRLIST:LIST response.
 *
 * Format:
 * ```
 * LIST:<count>
 * <manager>;<startMode>;<secKill>;<restartCount>;<resetMin>;<options>
 * ...
 * ;
 * ```
 */
export function parseManagerList(raw: string): PmonManagerEntry[] {
  const lines = raw.trim().split("\n");
  const managers: PmonManagerEntry[] = [];

  if (!lines[0] || !lines[0].startsWith("LIST:")) {
    throw new PmonError(
      "PROTOCOL_ERROR",
      `Invalid MGRLIST:LIST response: expected "LIST:<count>", got ${JSON.stringify(lines[0])}`,
    );
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line || line === ";") continue;

    // <manager>;<startMode>;<secKill>;<restartCount>;<resetMin>;<options>
    const parts = line.split(";");
    if (parts.length >= 5) {
      managers.push({
        index: i - 1,
        manager: parts[0] || "",
        startMode: parts[1] || "",
        secKill: parseInt(parts[2] || "0", 10),
        restartCount: parseInt(parts[3] || "0", 10),
        resetMin: parseInt(parts[4] || "0", 10),
        options: parts.slice(5).join(";"), // options may contain semicolons
      });
    }
  }

  return managers;
}

/**
 * Parse a SINGLE_MGR:PROP_GET response.
 *
 * Format: `<startMode> <secKill> <restartCount> <resetMin> [options...]`
 */
export function parseManagerProperties(raw: string): PmonManagerProperties {
  const parts = raw.trim().split(/\s+/);

  if (parts.length < 4) {
    throw new PmonError(
      "PROTOCOL_ERROR",
      `Invalid PROP_GET response: expected at least 4 fields, got ${parts.length}`,
    );
  }

  return {
    startMode: parts[0] || "",
    secKill: parseInt(parts[1] || "0", 10),
    restartCount: parseInt(parts[2] || "0", 10),
    resetMin: parseInt(parts[3] || "0", 10),
    options: parts.slice(4).join(" "),
  };
}

/**
 * Parse the project name response from PMON.
 */
export function parseProjectName(raw: string): string {
  return raw.trim().replace(/;$/, "").trim();
}
