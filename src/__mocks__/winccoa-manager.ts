/**
 * Vitest auto-mock for the winccoa-manager native add-on.
 *
 * Placed in src/__mocks__/ so that Vitest resolves it automatically when
 * tests import "winccoa-manager" and vi.mock("winccoa-manager") is used,
 * or when the module is injected via setWinccoaInstance().
 *
 * Extend this mock as new WinccoaManager methods are added to the type declarations.
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Enumerations (must match winccoa-manager.d.ts values exactly)
// ---------------------------------------------------------------------------

export enum WinccoaElementType {
  Struct = 23,
  Bool = 22,
  Int = 21,
  UInt = 20,
  Long = 26,
  ULong = 27,
  Float = 19,
  String = 25,
  Time = 18,
  Bit32 = 17,
  Blob = 42,
  LangString = 41,
  DynBool = 46,
  DynInt = 45,
  DynUInt = 44,
  DynLong = 55,
  DynULong = 56,
  DynFloat = 43,
  DynString = 49,
  DynTime = 48,
  DynBit32 = 47,
  DynBlob = 57,
  DynLangString = 58,
  Typeref = 50,
}

export enum WinccoaCtrlType {
  void = 0,
  anytype = 1,
  int = 2,
  uint = 3,
  long = 4,
  ulong = 5,
  float = 6,
  bool = 7,
  bit32 = 8,
  string = 9,
  time = 10,
  langString = 11,
  blob = 12,
}

export enum WinccoaNameCheckType {
  Dp = 0,
  DpType = 1,
  DpAlias = 2,
  Project = 3,
  SubProject = 4,
  Directory = 5,
  System = 6,
}

export enum WinccoaConnectUpdateType {
  Answer = 0,
  HotLink = 1,
}

export enum WinccoaLangStringFormat {
  Object = 0,
  StringFixed = 1,
  StringVariable = 2,
}

export enum WinccoaTimeFormat {
  Date = 0,
  Number = 1,
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class WinccoaError extends Error {
  readonly code: number;
  readonly details?: unknown;
  constructor(message: string, code = 0, details?: unknown) {
    super(message);
    this.name = "WinccoaError";
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Helper classes
// ---------------------------------------------------------------------------

export class WinccoaAlertTime {
  constructor(
    public readonly time: Date | number,
    public readonly count: number,
    public readonly dpe: string,
  ) {}
}

export class WinccoaDpTypeNode {
  constructor(
    public readonly name: string,
    public readonly elementType: WinccoaElementType,
    public readonly refName: string = "",
    public readonly children: WinccoaDpTypeNode[] = [],
    public readonly newName: string = "",
  ) {}
}

// ---------------------------------------------------------------------------
// WinccoaCtrlScript mock
// ---------------------------------------------------------------------------

export class WinccoaCtrlScript {
  start = vi.fn().mockResolvedValue(null);
  stop = vi.fn();
  openPromiseCount = vi.fn().mockReturnValue(0);

  static fromFile = vi.fn().mockImplementation(
    (_manager: unknown, _filePath: string) => Promise.resolve(new WinccoaCtrlScript()),
  );

  constructor(_manager?: unknown, _code?: string, _scriptName?: string) {}
}

// ---------------------------------------------------------------------------
// WinccoaManager mock — all methods are vi.fn() by default
// ---------------------------------------------------------------------------

export class WinccoaManager {
  // Data Point read
  dpGet = vi.fn().mockResolvedValue([]);
  dpExists = vi.fn().mockReturnValue(true);
  dpNames = vi.fn().mockReturnValue([]);
  dpTypes = vi.fn().mockReturnValue([]);
  dpTypeName = vi.fn().mockReturnValue("ExampleType");
  dpElementType = vi.fn().mockReturnValue(WinccoaElementType.Float);
  dpQuery = vi.fn().mockResolvedValue([]);

  // Data Point write
  dpSet = vi.fn().mockReturnValue(true);
  dpSetWait = vi.fn().mockResolvedValue(true);
  dpSetTimed = vi.fn().mockReturnValue(true);
  dpSetTimedWait = vi.fn().mockResolvedValue(true);

  dpCreate = vi.fn().mockResolvedValue(true);
  dpDelete = vi.fn().mockResolvedValue(true);
  dpCopy = vi.fn().mockResolvedValue(true);

  // Metadata
  dpGetUnit = vi.fn().mockReturnValue("");
  dpGetDescription = vi.fn().mockReturnValue("");
  dpGetAlias = vi.fn().mockReturnValue("");
  dpGetFormat = vi.fn().mockReturnValue("");
  dpSetUnit = vi.fn().mockResolvedValue(true);
  dpSetDescription = vi.fn().mockResolvedValue(true);
  dpSetAlias = vi.fn().mockResolvedValue(true);
  dpSetFormat = vi.fn().mockResolvedValue(true);

  dpAliasToName = vi.fn().mockReturnValue("");
  dpGetAllAliases = vi.fn().mockReturnValue({ aliases: [], dpNames: [] });
  dpGetAllDescriptions = vi.fn().mockReturnValue({ descriptions: [], dpNames: [] });

  // History
  dpGetPeriod = vi.fn().mockResolvedValue([]);
  dpGetMaxAge = vi.fn().mockResolvedValue(null);

  // Alert
  alertGetPeriod = vi.fn().mockResolvedValue({ alertTimes: [], values: [] });
  alertGet = vi.fn().mockResolvedValue(null);
  alertSet = vi.fn().mockReturnValue(true);
  alertSetWait = vi.fn().mockResolvedValue(null);
  alertSetTimed = vi.fn().mockReturnValue(true);
  alertSetTimedWait = vi.fn().mockResolvedValue(null);

  // Type management
  dpTypeCreate = vi.fn().mockResolvedValue(true);
  dpTypeChange = vi.fn().mockResolvedValue(true);
  dpTypeDelete = vi.fn().mockResolvedValue(true);
  dpTypeGet = vi.fn().mockReturnValue(null);
  dpTypeRefName = vi.fn().mockReturnValue("");
  dpGetDpTypeRefs = vi.fn().mockReturnValue({ dpePaths: [], refNames: [] });
  dpGetRefsToDpType = vi.fn().mockReturnValue({ dpePaths: [], dptNames: [] });

  // Misc
  dpSubStr = vi.fn().mockReturnValue("");
  dpGetAllConfigs = vi.fn().mockReturnValue([]);
  dpGetAllAttributes = vi.fn().mockReturnValue([]);
  dpGetAllDetails = vi.fn().mockReturnValue([]);
  dpGetId = vi.fn().mockReturnValue([0, 0]);
  dpGetName = vi.fn().mockReturnValue("");
  dpAttributeType = vi.fn().mockReturnValue(WinccoaCtrlType.float);

  // Name check
  nameCheck = vi.fn().mockResolvedValue({ name: "MyDp", valid: true });

  // Subscribe
  dpConnect = vi.fn().mockReturnValue(1);
  dpDisconnect = vi.fn().mockReturnValue(0);
  dpQueryConnectSingle = vi.fn().mockReturnValue(1);
  dpQueryConnectAll = vi.fn().mockReturnValue(1);
  dpQueryDisconnect = vi.fn().mockReturnValue(0);
  dpQuerySplit = vi.fn().mockResolvedValue({ answerId: 1, id: 1, progress: 100 });
  dpCancelSplitRequest = vi.fn().mockReturnValue(true);

  dpWaitForValue = vi.fn().mockResolvedValue(null);
  dpSetAndWaitForValue = vi.fn().mockResolvedValue(null);

  // System / Manager
  getVersionInfo = vi.fn().mockReturnValue({ version: "3.21", os: "Windows", patches: [] });
  getPaths = vi.fn().mockReturnValue({
    projPath: "C:/Projects/Test",
    binPath: "C:/WinCC_OA/bin",
    scriptPath: "C:/Projects/Test/scripts",
    tmpPath: "C:/temp",
  });
  getProjectLangs = vi.fn().mockReturnValue(["en_US"]);
  getSystemId = vi.fn().mockReturnValue(1);
  getSystemName = vi.fn().mockReturnValue("System1");
  getUserId = vi.fn().mockReturnValue(1);
  getUserName = vi.fn().mockReturnValue("admin");
  setUserId = vi.fn().mockReturnValue(true);
  getOptions = vi.fn().mockReturnValue({});
  setOptions = vi.fn().mockReturnValue(true);
  findFile = vi.fn().mockReturnValue("");
  cfgReadContent = vi.fn().mockReturnValue("");
  isDbgFlag = vi.fn().mockReturnValue(false);
  exit = vi.fn();

  // Logging (no-ops in tests)
  logDebugF = vi.fn();
  logFatal = vi.fn();
  logInfo = vi.fn();
  logSevere = vi.fn();
  logWarning = vi.fn();
}

// ---------------------------------------------------------------------------
// Standalone
// ---------------------------------------------------------------------------

export const delay = vi.fn().mockResolvedValue(undefined);
export const isDbgFlag = vi.fn().mockReturnValue(false);
export const log = {
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  severe: vi.fn(),
  fatal: vi.fn(),
};
