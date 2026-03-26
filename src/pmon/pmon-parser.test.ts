/**
 * Unit tests for PMON response parsers.
 */

import { describe, it, expect } from "vitest";
import {
  parseManagerStati,
  parseManagerList,
  parseManagerProperties,
  parseProjectName,
} from "./pmon-parser.js";
import { PmonError, PmonState, PmonStartMode } from "./pmon-types.js";

describe("parseManagerStati", () => {
  it("parses a typical MGRLIST:STATI response", () => {
    const raw = [
      "LIST:3",
      "2;12345;2;2025.01.23 10:30:15.123;0",
      "2;12346;2;2025.01.23 10:30:16.000;1",
      "0;0;0;;2",
      "1 MONITOR 0 0;",
    ].join("\n");

    const result = parseManagerStati(raw);

    expect(result.managers).toHaveLength(3);
    expect(result.managers[0]).toEqual({
      index: 0,
      state: PmonState.Running,
      pid: 12345,
      startMode: PmonStartMode.Always,
      startTime: "2025.01.23 10:30:15.123",
      manNum: 0,
    });
    expect(result.managers[2]).toEqual({
      index: 2,
      state: PmonState.Stopped,
      pid: 0,
      startMode: PmonStartMode.Manual,
      startTime: "",
      manNum: 2,
    });
    expect(result.modeNumeric).toBe(1);
    expect(result.modeString).toBe("MONITOR");
    expect(result.emergencyActive).toBe(0);
    expect(result.demoModeActive).toBe(0);
  });

  it("throws on invalid response format", () => {
    expect(() => parseManagerStati("INVALID")).toThrow(PmonError);
  });

  it("handles response with no trailing status line", () => {
    const raw = [
      "LIST:1",
      "2;100;2;2025.01.23 10:00:00;5",
    ].join("\n");

    const result = parseManagerStati(raw);
    expect(result.managers).toHaveLength(1);
    expect(result.modeString).toBe("UNKNOWN");
  });
});

describe("parseManagerList", () => {
  it("parses a typical MGRLIST:LIST response", () => {
    const raw = [
      "LIST:2",
      "WCCOApmon;always;30;3;5;",
      "WCCOActrl;always;30;3;5;-num 1 -f main.ctl",
      ";",
    ].join("\n");

    const result = parseManagerList(raw);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      index: 0,
      manager: "WCCOApmon",
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "",
    });
    expect(result[1]).toEqual({
      index: 1,
      manager: "WCCOActrl",
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "-num 1 -f main.ctl",
    });
  });

  it("throws on invalid response format", () => {
    expect(() => parseManagerList("GARBAGE")).toThrow(PmonError);
  });

  it("handles options containing semicolons", () => {
    const raw = [
      "LIST:1",
      "WCCOActrl;always;30;3;5;-opt1;-opt2",
      ";",
    ].join("\n");

    const result = parseManagerList(raw);
    expect(result[0]!.options).toBe("-opt1;-opt2");
  });
});

describe("parseManagerProperties", () => {
  it("parses a PROP_GET response", () => {
    const result = parseManagerProperties("always 30 3 5 -num 1 -f main.ctl");

    expect(result).toEqual({
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "-num 1 -f main.ctl",
    });
  });

  it("parses response with no options", () => {
    const result = parseManagerProperties("manual 60 2 10");

    expect(result).toEqual({
      startMode: "manual",
      secKill: 60,
      restartCount: 2,
      resetMin: 10,
      options: "",
    });
  });

  it("throws on too-short response", () => {
    expect(() => parseManagerProperties("always 30")).toThrow(PmonError);
  });
});

describe("parseProjectName", () => {
  it("parses a project name response", () => {
    expect(parseProjectName("MyProject;\n")).toBe("MyProject");
  });

  it("handles response without trailing semicolon", () => {
    expect(parseProjectName("  TestProject  ")).toBe("TestProject");
  });
});
