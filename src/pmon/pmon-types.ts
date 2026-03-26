/**
 * Types and error class for PMON TCP protocol communication.
 */

/** Manager state as reported by PMON via MGRLIST:STATI. */
export enum PmonState {
  Stopped = 0,
  Init = 1,
  Running = 2,
  Blocked = 3,
}

/** Manager start mode. */
export enum PmonStartMode {
  Manual = 0,
  Once = 1,
  Always = 2,
}

/** Single manager entry from MGRLIST:LIST. */
export interface PmonManagerEntry {
  /** 0-based index in PMON's manager table (0 = PMON itself). */
  index: number;
  /** Manager executable name, e.g. "WCCOActrl". */
  manager: string;
  /** Start mode as string: "manual", "once", or "always". */
  startMode: string;
  /** Seconds before SIGKILL on stop. */
  secKill: number;
  /** Automatic restart attempts. */
  restartCount: number;
  /** Minutes before restart counter resets. */
  resetMin: number;
  /** Command-line options string. */
  options: string;
}

/** Single manager status from MGRLIST:STATI. */
export interface PmonManagerStatus {
  /** 0-based index in PMON's manager table. */
  index: number;
  /** Current state (0–3). */
  state: PmonState;
  /** OS process ID (0 when not running). */
  pid: number;
  /** Start mode (numeric). */
  startMode: PmonStartMode;
  /** Start time string, e.g. "2025.01.23 10:30:15.123". */
  startTime: string;
  /** Manager number assigned by the Data manager. */
  manNum: number;
}

/** Full PMON status including mode information. */
export interface PmonStatus {
  managers: PmonManagerStatus[];
  modeNumeric: number;
  modeString: string;
  emergencyActive: number;
  demoModeActive: number;
}

/** Manager properties from SINGLE_MGR:PROP_GET. */
export interface PmonManagerProperties {
  startMode: string;
  secKill: number;
  restartCount: number;
  resetMin: number;
  options: string;
}

/** Configuration for the PMON TCP client. */
export interface PmonConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  timeoutMs?: number;
}

/** Result of a single PMON command (start, stop, kill, add, remove, prop_put). */
export interface PmonCommandResult {
  success: boolean;
  data?: string;
  error?: string;
}

/** Error codes for PmonError. */
export type PmonErrorCode =
  | "CONNECTION_REFUSED"
  | "TIMEOUT"
  | "AUTH_FAILED"
  | "PROTOCOL_ERROR";

/** Typed error for PMON client failures. */
export class PmonError extends Error {
  readonly code: PmonErrorCode;

  constructor(code: PmonErrorCode, message: string) {
    super(message);
    this.name = "PmonError";
    this.code = code;
  }
}
