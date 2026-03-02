/**
 * Type declarations for the WinCC OA JavaScript Manager for Node.js native add-on.
 *
 * This module is NOT available on npm. It is provided at runtime by the
 * WinCC OA JavaScript Manager bootstrap when running inside a WinCC OA project.
 *
 * @see https://www.winccoa.com/documentation/WinCCOA/3.20/en_US/apis/winccoa-manager/1.3.0/index.html
 */
declare module "winccoa-manager" {

  // ---------------------------------------------------------------------------
  // Enumerations
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

  export enum WinccoaDpSub {
    SYS = 0,
    SYS_DP = 1,
    SYS_DP_EL = 2,
    SYS_DP_EL_CONF = 3,
    SYS_DP_EL_CONF_DET = 4,
    SYS_DP_EL_CONF_DET_ATTR = 5,
    DP = 6,
    DP_EL = 7,
    DP_EL_CONF = 8,
    DP_EL_CONF_DET = 9,
    DP_EL_CONF_DET_ATTR = 10,
    CONF = 11,
    CONF_DET = 12,
    CONF_DET_ATTR = 13,
    DET = 14,
    DET_ATTR = 15,
    ATTR = 16,
  }

  export enum WinccoaConnectUpdateType {
    Answer = 0,
    HotLink = 1,
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
  // Types
  // ---------------------------------------------------------------------------

  export type WinccoaLangString = string | Record<string, string>;
  export type WinccoaTime = Date | number;

  export type WinccoaDpConnectCallback = (
    names: string[],
    values: unknown[],
    type: WinccoaConnectUpdateType,
    error?: WinccoaError,
  ) => void;

  export type WinccoaDpQueryConnectCallback = (
    values: unknown[][],
    type: WinccoaConnectUpdateType,
    error?: WinccoaError,
  ) => void;

  // ---------------------------------------------------------------------------
  // Interfaces
  // ---------------------------------------------------------------------------

  export interface WinccoaOptions {
    userId: number;
    langIdx: number;
    langStringFormat: WinccoaLangStringFormat;
    timeFormat: WinccoaTimeFormat;
    splitTimeout: number;
  }

  export interface WinccoaVersionDetails {
    version: string;
    os: string;
    patches: string[];
  }

  // ---------------------------------------------------------------------------
  // Classes
  // ---------------------------------------------------------------------------

  export class WinccoaError extends Error {
    readonly code: number;
    readonly details?: unknown;
  }

  export class WinccoaDpTypeNode {
    constructor(
      name: string,
      elementType: WinccoaElementType,
      refName?: string,
      children?: WinccoaDpTypeNode[],
      newName?: string,
    );
    readonly name: string;
    readonly elementType: WinccoaElementType;
    readonly refName: string;
    readonly newName: string;
    readonly children: WinccoaDpTypeNode[];
  }

  export class WinccoaAlertTime {
    constructor(time: WinccoaTime, count: number, dpe: string);
    readonly time: WinccoaTime;
    readonly count: number;
    readonly dpe: string;
  }

  export class WinccoaCtrlScript {
    constructor(manager: WinccoaManager, code: string, scriptName?: string);

    /** Start a function in the script. Runs in a new thread each call. */
    start(functionName: string, params?: unknown[], paramTypes?: WinccoaCtrlType[]): Promise<unknown>;

    /** Stop all running threads in this script and release resources. */
    stop(): void;

    /** Returns the number of pending (unresolved) start() calls. */
    openPromiseCount(): number;

    /** Load a script from WinCC OA script directories (appends .ctl if omitted). */
    static fromFile(manager: WinccoaManager, filePath: string): Promise<WinccoaCtrlScript>;
  }

  export class WinccoaManager {
    constructor(options?: Partial<Omit<WinccoaOptions, "userId">>);

    // -- Data Point -----------------------------------------------------------
    dpGet(dpeNames: string | string[]): Promise<unknown>;
    dpSet(dpeNames: string | string[], values: unknown): boolean;
    dpSetWait(dpeNames: string | string[], values: unknown): Promise<boolean>;
    dpSetTimed(time: WinccoaTime, dpeNames: string | string[], values: unknown): boolean;
    dpSetTimedWait(time: WinccoaTime, dpeNames: string | string[], values: unknown): Promise<boolean>;

    dpCreate(dpeName: string, dpType: string, systemId?: number, dpId?: number): Promise<boolean>;
    dpDelete(dpName: string): Promise<boolean>;
    dpCopy(source: string, destination: string, driver?: number): Promise<boolean>;

    dpExists(dpeName: string): boolean;
    dpNames(dpPattern?: string, dpType?: string, ignoreCase?: boolean): string[];
    dpTypes(pattern?: string, systemId?: number, includeEmpty?: boolean): string[];
    dpTypeName(dp: string): string;

    dpQuery(query: string): Promise<unknown[][]>;
    dpQuerySplit(queryOrId: string | number): Promise<{
      answerId: number;
      data?: unknown[][];
      id: number;
      progress: number;
    }>;

    dpConnect(callback: WinccoaDpConnectCallback, dpeNames: string | string[], answer?: boolean): number;
    dpDisconnect(id: number): number;
    dpQueryConnectSingle(callback: WinccoaDpQueryConnectCallback, answer: boolean, query: string, blockingTime?: number): number;
    dpQueryConnectAll(callback: WinccoaDpQueryConnectCallback, answer: boolean, query: string, blockingTime?: number): number;
    dpQueryDisconnect(id: number): number;

    dpGetAlias(dpeName: string): string;
    dpSetAlias(dpeName: string, alias: string): Promise<boolean>;
    dpAliasToName(alias: string): string;
    dpGetAllAliases(aliasPattern?: string, dpePattern?: string): { aliases: string[]; dpNames: string[] };

    dpGetDescription(dpeName: string, mode?: number): WinccoaLangString;
    dpSetDescription(dpeName: string, comment: WinccoaLangString): Promise<boolean>;
    dpGetAllDescriptions(descriptionFilter?: string, dpeFilter?: string, mode?: number): { descriptions: WinccoaLangString[]; dpNames: string[] };

    dpGetFormat(dpeName: string): WinccoaLangString;
    dpSetFormat(dpeName: string, format: WinccoaLangString): Promise<boolean>;

    dpGetUnit(dpeName: string): WinccoaLangString;
    dpSetUnit(dpeName: string, unit: WinccoaLangString): Promise<boolean>;

    dpGetId(dpName: string): number[];
    dpGetName(dpId: number, elemId: number, systemId?: number): string;

    dpElementType(dpeName: string): WinccoaElementType;
    dpAttributeType(dpAttributeName: string): WinccoaCtrlType;
    dpSubStr(dp: string, pattern: WinccoaDpSub): string;
    dpGetAllConfigs(dpNameOrType: string | WinccoaElementType): string[];
    dpGetAllAttributes(configName: string): string[];
    dpGetAllDetails(configName: string): string[];

    dpGetMaxAge(age: number, dpeNames: string | string[]): Promise<unknown>;
    dpGetPeriod(startTime: WinccoaTime, endTime: WinccoaTime, dpeList: string[], count?: number): Promise<{ times: WinccoaTime[]; values: unknown[] }[]>;

    dpSetAndWaitForValue(
      dpNamesSet: string[], dpValuesSet: unknown[],
      dpNamesWait: string[], conditions: unknown[],
      dpNamesReturn: string[], timeoutMs?: number,
    ): Promise<unknown>;

    dpWaitForValue(
      dpNamesWait: string[], conditions: unknown[],
      dpNamesReturn: string[], timeoutMs?: number,
    ): Promise<unknown>;

    dpCancelSplitRequest(id: number): boolean;

    nameCheck(name: string, nameType: WinccoaNameCheckType): Promise<{ name: string; valid: boolean }>;

    // -- Data Point Type ------------------------------------------------------
    dpTypeCreate(startNode: WinccoaDpTypeNode): Promise<boolean>;
    dpTypeChange(startNode: WinccoaDpTypeNode): Promise<boolean>;
    dpTypeDelete(dpt: string): Promise<boolean>;
    dpTypeGet(dpt: string, includeSubTypes?: boolean): WinccoaDpTypeNode;
    dpTypeRefName(dpe: string): string;
    dpGetDpTypeRefs(dpt: string): { dpePaths: string[]; refNames: string[] };
    dpGetRefsToDpType(reference: string): { dpePaths: string[]; dptNames: string[] };

    // -- Alert ----------------------------------------------------------------
    alertGet(alertsTime: WinccoaAlertTime | WinccoaAlertTime[], dpeNames: string | string[], alertCount?: number | number[]): Promise<unknown>;
    alertGetPeriod(startTime: WinccoaTime, endTime: WinccoaTime, dpeNames: string[], count?: number): Promise<{ alertTimes: WinccoaAlertTime[]; values: unknown[] }>;
    alertSet(alertTime: WinccoaAlertTime, value: unknown): boolean;
    alertSetWait(alertTime: WinccoaAlertTime, value: unknown): Promise<unknown>;
    alertSetTimed(time: WinccoaTime, alertTime: WinccoaAlertTime, value: unknown): boolean;
    alertSetTimedWait(time: WinccoaTime, alertTime: WinccoaAlertTime, value: unknown): Promise<unknown>;

    // -- Logging --------------------------------------------------------------
    logDebugF(message: string, ...args: unknown[]): void;
    logFatal(message: string, ...args: unknown[]): void;
    logInfo(message: string, ...args: unknown[]): void;
    logSevere(message: string, ...args: unknown[]): void;
    logWarning(message: string, ...args: unknown[]): void;

    // -- Manager --------------------------------------------------------------
    exit(code?: number): void;
    getOptions(): WinccoaOptions;
    setOptions(options: Partial<Omit<WinccoaOptions, "userId">>): boolean;
    getSystemId(systemName?: string): number;
    getSystemName(systemId?: number): string;
    getUserId(userName?: string): number | undefined;
    getUserName(userId?: number): string;
    setUserId(id: number, password?: string): boolean;
    getProjectLangs(): string[];
    getVersionInfo(): WinccoaVersionDetails;
    getPaths(): Record<string, string>;
    findFile(fileName: string): string;
    cfgReadContent(section: string, key: string): string;
    isDbgFlag(flag: number): boolean;
  }

  // ---------------------------------------------------------------------------
  // Standalone functions
  // ---------------------------------------------------------------------------

  export function delay(ms: number): Promise<void>;
  export function isDbgFlag(flag: number): boolean;

  export const log: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warning(message: string, ...args: unknown[]): void;
    severe(message: string, ...args: unknown[]): void;
    fatal(message: string, ...args: unknown[]): void;
  };
}
