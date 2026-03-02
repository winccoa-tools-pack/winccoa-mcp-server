/**
 * Unit tests for dp-exists-guard.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../winccoa-client.js";
import { checkDpesExist } from "./dp-exists-guard.js";

describe("checkDpesExist", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("returns null when all DPEs exist", () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);

    const result = checkDpesExist(["System1:Dp1.value", "System1:Dp2.value"]);
    expect(result).toBeNull();
    expect(mockWinccoa.dpExists).toHaveBeenCalledTimes(2);
  });

  it("returns an error content object when a DPE does not exist", () => {
    vi.mocked(mockWinccoa.dpExists).mockImplementation((name: string) => {
      return name !== "System1:Missing.value";
    });

    const result = checkDpesExist(["System1:Dp1.value", "System1:Missing.value"]);
    expect(result).not.toBeNull();
    expect(result!.isError).toBe(true);
    expect(result!.content[0]!.text).toContain("System1:Missing.value");
  });

  it("stops at the first missing DPE", () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    checkDpesExist(["A.v", "B.v", "C.v"]);
    // Should stop after the first missing DP
    expect(mockWinccoa.dpExists).toHaveBeenCalledTimes(1);
  });

  it("returns null for an empty list", () => {
    const result = checkDpesExist([]);
    expect(result).toBeNull();
    expect(mockWinccoa.dpExists).not.toHaveBeenCalled();
  });

  it("the error message includes the missing DPE name", () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);
    const result = checkDpesExist(["MyDp.status"]);
    expect(result!.content[0]!.text).toContain("MyDp.status");
  });
});
