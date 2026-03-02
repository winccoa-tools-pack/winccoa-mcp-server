/**
 * Unit tests for archive/archive_get tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerArchiveGet } from "./archive-get.js";

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

describe("archive.archive_get", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named archive/archive_get", () => {
    const { fakeServer } = buildServer();
    registerArchiveGet(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("archive.archive_get", expect.any(Object), expect.any(Function));
  });

  it("returns error when startTime >= endTime", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Tank1.level"],
      startTime: "2025-01-02T00:00:00.000Z",
      endTime: "2025-01-01T00:00:00.000Z",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
  });

  it("returns error when startTime equals endTime", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Tank1.level"],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-01T00:00:00.000Z",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
  });

  it("calls dpGetPeriod with Date objects", async () => {
    vi.mocked(mockWinccoa.dpGetPeriod).mockResolvedValue([
      { times: [], values: [] },
    ]);

    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    await invoke({
      dpeNames: ["Tank1.level"],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-02T00:00:00.000Z",
    });

    expect(mockWinccoa.dpGetPeriod).toHaveBeenCalledWith(
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-01-02T00:00:00.000Z"),
      ["Tank1.level"],
      undefined,
    );
  });

  it("passes count parameter to dpGetPeriod when provided", async () => {
    vi.mocked(mockWinccoa.dpGetPeriod).mockResolvedValue([
      { times: [], values: [] },
    ]);

    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    await invoke({
      dpeNames: ["Tank1.level"],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-02T00:00:00.000Z",
      count: 100,
    });

    expect(mockWinccoa.dpGetPeriod).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      ["Tank1.level"],
      100,
    );
  });

  it("returns formatted result with ISO timestamps", async () => {
    const ts = new Date("2025-01-01T10:30:00.000Z");
    vi.mocked(mockWinccoa.dpGetPeriod).mockResolvedValue([
      { times: [ts], values: [42.5] },
    ]);

    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Tank1.level"],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-02T00:00:00.000Z",
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].dpeName).toBe("Tank1.level");
    expect(parsed[0].values).toEqual([42.5]);
    expect(parsed[0].times[0]).toContain("2025-01-01");
  });

  it("handles empty result per DPE gracefully", async () => {
    vi.mocked(mockWinccoa.dpGetPeriod).mockResolvedValue([]);

    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Tank1.level"],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-02T00:00:00.000Z",
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed[0].times).toEqual([]);
    expect(parsed[0].values).toEqual([]);
  });

  it("returns multiple DPE results in order", async () => {
    vi.mocked(mockWinccoa.dpGetPeriod).mockResolvedValue([
      { times: [], values: [1] },
      { times: [], values: [2] },
    ]);

    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Dp1.value", "Dp2.value"],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-02T00:00:00.000Z",
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].dpeName).toBe("Dp1.value");
    expect(parsed[1].dpeName).toBe("Dp2.value");
  });

  it("returns errorContent when dpGetPeriod throws", async () => {
    vi.mocked(mockWinccoa.dpGetPeriod).mockRejectedValue(new Error("archive error"));

    const { fakeServer, invoke } = buildServer();
    registerArchiveGet(fakeServer);

    const result = (await invoke({
      dpeNames: ["Tank1.level"],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-02T00:00:00.000Z",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("archive error");
  });
});
