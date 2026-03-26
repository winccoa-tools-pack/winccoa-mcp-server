/**
 * Unit tests for manager.manager_stop tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerStop } from "./manager-stop.js";

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

describe("manager.manager_stop", () => {
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
    process.argv = ["node", "index.js"];
    delete process.env.MCP_MANAGER_NUM;
  });

  it("sends stop command and returns confirmation", async () => {
    mockPmon.stopManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerStop(fakeServer);

    const result = (await invoke({ managerIndex: 3 })) as { content: Array<{ text: string }> };
    expect(mockPmon.stopManager).toHaveBeenCalledWith(3);
    expect(result.content[0]!.text).toContain("stop command sent");
  });

  it("returns error when PMON reports failure", async () => {
    mockPmon.stopManager.mockResolvedValue({ success: false, error: "Manager not running" });

    const { fakeServer, invoke } = buildServer();
    registerManagerStop(fakeServer);

    const result = (await invoke({ managerIndex: 3 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Manager not running");
  });

  it("prevents self-stop when own manager num matches", async () => {
    process.env.MCP_MANAGER_NUM = "7";
    vi.resetModules();

    const { registerManagerStop: reg } = await import("./manager-stop.js");
    const { setPmonClientInstance: setPmon } = await import("../../pmon/pmon-client-accessor.js");
    setPmon(mockPmon as unknown as PmonClient);

    mockPmon.getManagerStati.mockResolvedValue({
      managers: [
        { index: 3, state: 2, pid: 200, startMode: 2, startTime: "", manNum: 7 },
      ],
      modeNumeric: 1,
      modeString: "MONITOR",
      emergencyActive: 0,
      demoModeActive: 0,
    });

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerIndex: 3 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("own manager");

    delete process.env.MCP_MANAGER_NUM;
  });

  it("allows stopping a different manager when own num is known", async () => {
    process.env.MCP_MANAGER_NUM = "7";
    vi.resetModules();

    const { registerManagerStop: reg } = await import("./manager-stop.js");
    const { setPmonClientInstance: setPmon } = await import("../../pmon/pmon-client-accessor.js");
    setPmon(mockPmon as unknown as PmonClient);

    mockPmon.getManagerStati.mockResolvedValue({
      managers: [
        { index: 3, state: 2, pid: 200, startMode: 2, startTime: "", manNum: 5 },
      ],
      modeNumeric: 1,
      modeString: "MONITOR",
      emergencyActive: 0,
      demoModeActive: 0,
    });
    mockPmon.stopManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerIndex: 3 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("stop command sent");

    delete process.env.MCP_MANAGER_NUM;
  });
});
