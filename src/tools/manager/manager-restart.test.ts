/**
 * Unit tests for manager.manager_restart tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerRestart } from "./manager-restart.js";

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

describe("manager.manager_restart", () => {
  let mockPmon: { [K in keyof PmonClient]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockPmon = {
      getManagerList: vi.fn(),
      getManagerStati: vi.fn(),
      startManager: vi.fn(),
      stopManager: vi.fn(),
      killManager: vi.fn(),
      addManager: vi.fn(),
      removeManager: vi.fn(),
      getManagerProperties: vi.fn(),
      setManagerProperties: vi.fn(),
      getProjectName: vi.fn(),
    };
    setPmonClientInstance(mockPmon as unknown as PmonClient);
    process.argv = ["node", "index.js"];
    delete process.env.MCP_MANAGER_NUM;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops, waits, then starts the manager", async () => {
    mockPmon.stopManager.mockResolvedValue({ success: true, data: "OK" });
    mockPmon.startManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerRestart(fakeServer);

    const promise = invoke({ managerIndex: 2, waitSeconds: 1 });

    // Advance past the wait
    await vi.advanceTimersByTimeAsync(1000);

    const result = (await promise) as { content: Array<{ text: string }> };
    expect(mockPmon.stopManager).toHaveBeenCalledWith(2);
    expect(mockPmon.startManager).toHaveBeenCalledWith(2);
    expect(result.content[0]!.text).toContain("restarted successfully");
  });

  it("returns error if stop fails", async () => {
    mockPmon.stopManager.mockResolvedValue({ success: false, error: "Not running" });

    const { fakeServer, invoke } = buildServer();
    registerManagerRestart(fakeServer);

    const result = (await invoke({ managerIndex: 2, waitSeconds: 1 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Not running");
    expect(mockPmon.startManager).not.toHaveBeenCalled();
  });

  it("prevents self-restart when own manager num matches", async () => {
    process.env.MCP_MANAGER_NUM = "4";
    vi.resetModules();

    const { registerManagerRestart: reg } = await import("./manager-restart.js");
    const { setPmonClientInstance: setPmon } = await import("../../pmon/pmon-client-accessor.js");
    setPmon(mockPmon as unknown as PmonClient);

    mockPmon.getManagerStati.mockResolvedValue({
      managers: [
        { index: 2, state: 2, pid: 300, startMode: 2, startTime: "", manNum: 4 },
      ],
      modeNumeric: 1,
      modeString: "MONITOR",
      emergencyActive: 0,
      demoModeActive: 0,
    });

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerIndex: 2, waitSeconds: 1 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("own manager");

    delete process.env.MCP_MANAGER_NUM;
  });
});

// Need the import for afterEach
import { afterEach } from "vitest";
