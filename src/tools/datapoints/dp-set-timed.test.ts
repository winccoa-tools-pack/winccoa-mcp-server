/**
 * Unit tests for datapoints/dp_set_timed tool (dp-set-timed.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpSetTimed } from "./dp-set-timed.js";

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

describe("datapoints.dp_set_timed", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("returns errorContent when dpeNames and values have different lengths", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpSetTimed(fakeServer);

    const result = (await invoke({
      time: "2024-01-15T10:00:00.000Z",
      dpeNames: ["Dp1.value", "Dp2.value"],
      values: [1],
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("same length");
  });

  it("calls dpSetTimedWait with a Date object", async () => {
    vi.mocked(mockWinccoa.dpSetTimedWait).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerDpSetTimed(fakeServer);

    const timeStr = "2024-01-15T10:30:00.000Z";
    await invoke({
      time: timeStr,
      dpeNames: ["Dp1.value"],
      values: [42],
    });

    expect(mockWinccoa.dpSetTimedWait).toHaveBeenCalledWith(
      new Date(timeStr),
      ["Dp1.value"],
      [42],
    );
  });

  it("returns success=true with count and time on success", async () => {
    vi.mocked(mockWinccoa.dpSetTimedWait).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerDpSetTimed(fakeServer);

    const result = (await invoke({
      time: "2024-06-01T00:00:00.000Z",
      dpeNames: ["Dp1.value", "Dp2.value"],
      values: [1, 2],
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.count).toBe(2);
    expect(parsed.time).toBe("2024-06-01T00:00:00.000Z");
  });

  it("returns errorContent when dpSetTimedWait throws", async () => {
    vi.mocked(mockWinccoa.dpSetTimedWait).mockRejectedValue(new Error("DP not found"));

    const { fakeServer, invoke } = buildServer();
    registerDpSetTimed(fakeServer);

    const result = (await invoke({
      time: "2024-01-15T10:00:00.000Z",
      dpeNames: ["Missing.value"],
      values: [0],
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("DP not found");
  });
});
