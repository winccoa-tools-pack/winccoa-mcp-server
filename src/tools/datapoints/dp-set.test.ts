/**
 * Unit tests for datapoints/dp_set tool (dp-set.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpSet } from "./dp-set.js";

function buildServer() {
  let capturedHandler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
  const fakeServer = {
    registerTool: vi.fn((_name: string, _config: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
    }),
  } as unknown as McpServer;
  return {
    fakeServer,
    invoke: (args: Record<string, unknown>) => {
      if (!capturedHandler) throw new Error("Tool not registered");
      return capturedHandler(args);
    },
  };
}

describe("datapoints.dp_set", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("returns errorContent when dpeNames and values have different lengths", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpSet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Dp1.value", "Dp2.value"],
      values: [42],
      wait: true,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("same length");
  });

  it("calls dpSetWait for each DPE when wait=true", async () => {
    vi.mocked(mockWinccoa.dpSetWait).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerDpSet(fakeServer);

    await invoke({
      dpeNames: ["Dp1.value", "Dp2.value"],
      values: [1, 2],
      wait: true,
    });

    expect(mockWinccoa.dpSetWait).toHaveBeenCalledTimes(2);
    expect(mockWinccoa.dpSetWait).toHaveBeenCalledWith("Dp1.value", 1);
    expect(mockWinccoa.dpSetWait).toHaveBeenCalledWith("Dp2.value", 2);
  });

  it("isolates per-DP errors — one failure does not abort others (wait=true)", async () => {
    vi.mocked(mockWinccoa.dpSetWait).mockImplementation(async (dpe: string | string[], _values: unknown): Promise<boolean> => {
      if (dpe === "BadDp.value") throw new Error("Write rejected");
      return true;
    });

    const { fakeServer, invoke } = buildServer();
    registerDpSet(fakeServer);

    const result = (await invoke({
      dpeNames: ["GoodDp.value", "BadDp.value", "AnotherGood.value"],
      values: [1, 2, 3],
      wait: true,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.results["GoodDp.value"].success).toBe(true);
    expect(parsed.results["BadDp.value"].success).toBe(false);
    expect(parsed.results["BadDp.value"].error).toContain("Write rejected");
    expect(parsed.results["AnotherGood.value"].success).toBe(true);
    // All three DPEs must be processed
    expect(mockWinccoa.dpSetWait).toHaveBeenCalledTimes(3);
  });

  it("calls dpSet (fire-and-forget) when wait=false", async () => {
    vi.mocked(mockWinccoa.dpSet).mockReturnValue(true);

    const { fakeServer, invoke } = buildServer();
    registerDpSet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Dp1.value"],
      values: [99],
      wait: false,
    })) as { content: Array<{ text: string }> };

    expect(mockWinccoa.dpSet).toHaveBeenCalledTimes(1);
    expect(mockWinccoa.dpSetWait).not.toHaveBeenCalled();

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.waited).toBe(false);
    expect(parsed.results["Dp1.value"].success).toBe(true);
  });

  it("includes waited=true in result when wait=true", async () => {
    vi.mocked(mockWinccoa.dpSetWait).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerDpSet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Dp1.value"],
      values: [0],
      wait: true,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.waited).toBe(true);
  });
});
