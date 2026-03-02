/**
 * Unit tests for datapoints/dp_get tool (dp-get.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpGet } from "./dp-get.js";

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

describe("datapoints.dp_get", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named datapoints/dp_get", () => {
    const { fakeServer } = buildServer();
    registerDpGet(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("datapoints.dp_get", expect.any(Object), expect.any(Function));
  });

  it("returns errorContent when a DPE name contains a wildcard (*)", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Pump*.value"],
      includeTimestamp: false,
      includeUnit: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("wildcard");
  });

  it("returns errorContent when a DPE name contains a wildcard (?)", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Pump?.value"],
      includeTimestamp: false,
      includeUnit: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
  });

  it("reads single DPE value successfully", async () => {
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(42);

    const { fakeServer, invoke } = buildServer();
    registerDpGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["ExampleDP.value"],
      includeTimestamp: false,
      includeUnit: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.values[0]).toBe(42);
  });

  it("calls dpGetUnit for each DPE when includeUnit=true", async () => {
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue([10, 20]);
    vi.mocked(mockWinccoa.dpGetUnit).mockReturnValue("m/s");

    const { fakeServer, invoke } = buildServer();
    registerDpGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Dp1.value", "Dp2.value"],
      includeTimestamp: false,
      includeUnit: true,
    })) as { content: Array<{ text: string }> };

    expect(mockWinccoa.dpGetUnit).toHaveBeenCalledTimes(2);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.units).toEqual(["m/s", "m/s"]);
  });

  it("includes timestamps when includeTimestamp=true", async () => {
    const ts = new Date("2024-01-15T10:00:00.000Z");
    // Mock returns [value, stime] when fetched together
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue([99, ts]);

    const { fakeServer, invoke } = buildServer();
    registerDpGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Dp1.value"],
      includeTimestamp: true,
      includeUnit: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.timestamps).toBeDefined();
    expect(parsed.timestamps[0]).toContain("2024-01-15");
  });

  it("does not include units key when includeUnit=false", async () => {
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(5);

    const { fakeServer, invoke } = buildServer();
    registerDpGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Dp1.value"],
      includeTimestamp: false,
      includeUnit: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.units).toBeUndefined();
  });
});
