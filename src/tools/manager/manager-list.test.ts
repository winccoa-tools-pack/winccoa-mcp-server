/**
 * Unit tests for manager.manager_list tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerList } from "./manager-list.js";

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

describe("manager.manager_list", () => {
  let mockPmon: { [K in keyof PmonClient]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
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
  });

  it("registers a tool named manager.manager_list", () => {
    const { fakeServer } = buildServer();
    registerManagerList(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith(
      "manager.manager_list",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns merged list with status when includeStatus is true", async () => {
    mockPmon.getManagerList.mockResolvedValue([
      { index: 0, manager: "WCCOApmon", startMode: "always", secKill: 30, restartCount: 3, resetMin: 5, options: "" },
      { index: 1, manager: "WCCOActrl", startMode: "always", secKill: 30, restartCount: 3, resetMin: 5, options: "-num 1" },
    ]);
    mockPmon.getManagerStati.mockResolvedValue({
      managers: [
        { index: 0, state: 2, pid: 100, startMode: 2, startTime: "", manNum: 0 },
        { index: 1, state: 2, pid: 101, startMode: 2, startTime: "", manNum: 1 },
      ],
      modeNumeric: 1,
      modeString: "MONITOR",
      emergencyActive: 0,
      demoModeActive: 0,
    });

    const { fakeServer, invoke } = buildServer();
    registerManagerList(fakeServer);

    const result = (await invoke({ includeStatus: true })) as { content: Array<{ text: string }> };
    const data = JSON.parse(result.content[0]!.text);
    expect(data).toHaveLength(2);
    expect(data[0].state).toBe("Running");
    expect(data[0].pid).toBe(100);
    expect(data[1].manager).toBe("WCCOActrl");
  });

  it("returns list without status when includeStatus is false", async () => {
    mockPmon.getManagerList.mockResolvedValue([
      { index: 0, manager: "WCCOApmon", startMode: "always", secKill: 30, restartCount: 3, resetMin: 5, options: "" },
    ]);

    const { fakeServer, invoke } = buildServer();
    registerManagerList(fakeServer);

    const result = (await invoke({ includeStatus: false })) as { content: Array<{ text: string }> };
    const data = JSON.parse(result.content[0]!.text);
    expect(data).toHaveLength(1);
    expect(data[0].state).toBeUndefined();
  });

  it("returns error content on PMON failure", async () => {
    mockPmon.getManagerList.mockRejectedValue(new Error("Connection refused"));

    const { fakeServer, invoke } = buildServer();
    registerManagerList(fakeServer);

    const result = (await invoke({ includeStatus: false })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Connection refused");
  });
});
