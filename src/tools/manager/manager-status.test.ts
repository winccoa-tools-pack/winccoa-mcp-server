/**
 * Unit tests for manager.manager_status tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerStatus } from "./manager-status.js";

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

describe("manager.manager_status", () => {
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

  it("returns detailed status for a valid manager", async () => {
    mockPmon.getManagerStati.mockResolvedValue({
      managers: [
        { index: 1, state: 2, pid: 200, startMode: 2, startTime: "2025.01.01 00:00:00", manNum: 5 },
      ],
      modeNumeric: 1,
      modeString: "MONITOR",
      emergencyActive: 0,
      demoModeActive: 0,
    });
    mockPmon.getManagerList.mockResolvedValue([
      { index: 1, manager: "WCCOActrl", startMode: "always", secKill: 30, restartCount: 3, resetMin: 5, options: "-num 1" },
    ]);

    const { fakeServer, invoke } = buildServer();
    registerManagerStatus(fakeServer);

    const result = (await invoke({ managerIndex: 1 })) as { content: Array<{ text: string }> };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.manager).toBe("WCCOActrl");
    expect(data.state).toBe("Running");
    expect(data.pid).toBe(200);
    expect(data.manNum).toBe(5);
    expect(data.options).toBe("-num 1");
  });

  it("returns error when manager index not found", async () => {
    mockPmon.getManagerStati.mockResolvedValue({
      managers: [],
      modeNumeric: 0,
      modeString: "UNKNOWN",
      emergencyActive: 0,
      demoModeActive: 0,
    });
    mockPmon.getManagerList.mockResolvedValue([]);

    const { fakeServer, invoke } = buildServer();
    registerManagerStatus(fakeServer);

    const result = (await invoke({ managerIndex: 99 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });
});
