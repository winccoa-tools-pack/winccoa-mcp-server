/**
 * Unit tests for type-guards.ts
 */

import { describe, it, expect } from "vitest";
import { WinccoaElementType } from "winccoa-manager";
import { isNumericElementType, isBooleanElementType } from "./type-guards.js";

describe("isNumericElementType", () => {
  it.each([
    WinccoaElementType.Int,
    WinccoaElementType.UInt,
    WinccoaElementType.Long,
    WinccoaElementType.ULong,
    WinccoaElementType.Float,
    WinccoaElementType.DynInt,
    WinccoaElementType.DynUInt,
    WinccoaElementType.DynLong,
    WinccoaElementType.DynULong,
    WinccoaElementType.DynFloat,
  ])("returns true for numeric type %i", (type: WinccoaElementType) => {
    expect(isNumericElementType(type)).toBe(true);
  });

  it.each([
    WinccoaElementType.Bool,
    WinccoaElementType.DynBool,
    WinccoaElementType.String,
    WinccoaElementType.Time,
    WinccoaElementType.Struct,
    WinccoaElementType.Blob,
  ])("returns false for non-numeric type %i", (type: WinccoaElementType) => {
    expect(isNumericElementType(type)).toBe(false);
  });
});

describe("isBooleanElementType", () => {
  it("returns true for Bool", () => {
    expect(isBooleanElementType(WinccoaElementType.Bool)).toBe(true);
  });

  it("returns true for DynBool", () => {
    expect(isBooleanElementType(WinccoaElementType.DynBool)).toBe(true);
  });

  it.each([
    WinccoaElementType.Int,
    WinccoaElementType.Float,
    WinccoaElementType.String,
    WinccoaElementType.Time,
    WinccoaElementType.Struct,
  ])("returns false for non-boolean type %i", (type: WinccoaElementType) => {
    expect(isBooleanElementType(type)).toBe(false);
  });
});
