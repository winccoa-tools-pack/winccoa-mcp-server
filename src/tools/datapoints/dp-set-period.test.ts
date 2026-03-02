/**
 * Unit tests for datapoints/dp_set_period tool (dp-set-period.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpSetPeriod } from "./dp-set-period.js";

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

/** Build N valid entries for testing. */
function makeEntries(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    time: new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString(),
    dpeName: `Dp${i}.value`,
    value: i,
  }));
}

describe("datapoints.dp_set_period", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("processes all entries and returns one result per entry", async () => {
    vi.mocked(mockWinccoa.dpSetTimedWait).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerDpSetPeriod(fakeServer);

    const entries = makeEntries(3);
    const result = (await invoke({ entries })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].success).toBe(true);
    expect(parsed[1].success).toBe(true);
    expect(parsed[2].success).toBe(true);
    expect(mockWinccoa.dpSetTimedWait).toHaveBeenCalledTimes(3);
  });

  it("isolates per-entry errors — other entries still processed", async () => {
    vi.mocked(mockWinccoa.dpSetTimedWait).mockImplementation(async (_time: Date | number, dpeName: string | string[], _values: unknown): Promise<boolean> => {
      if (dpeName === "Dp1.value") throw new Error("Write failed");
      return true;
    });

    const { fakeServer, invoke } = buildServer();
    registerDpSetPeriod(fakeServer);

    const entries = makeEntries(3); // Dp0, Dp1, Dp2
    const result = (await invoke({ entries })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed[0].success).toBe(true);  // Dp0
    expect(parsed[1].success).toBe(false); // Dp1 — error
    expect(parsed[1].error).toContain("Write failed");
    expect(parsed[2].success).toBe(true);  // Dp2 — still processed
    expect(mockWinccoa.dpSetTimedWait).toHaveBeenCalledTimes(3);
  });

  it("includes index, time, and dpeName in each result", async () => {
    vi.mocked(mockWinccoa.dpSetTimedWait).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerDpSetPeriod(fakeServer);

    const entries = [
      { time: "2024-03-01T00:00:00.000Z", dpeName: "Tank1.level", value: 5.5 },
    ];
    const result = (await invoke({ entries })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed[0].index).toBe(0);
    expect(parsed[0].time).toBe("2024-03-01T00:00:00.000Z");
    expect(parsed[0].dpeName).toBe("Tank1.level");
  });
});
