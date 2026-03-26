/**
 * Unit tests for manager.manager_kill tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerKill } from "./manager-kill.js";

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

describe("manager.manager_kill", () => {
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

  it("sends kill command and returns confirmation", async () => {
    mockPmon.killManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerKill(fakeServer);

    const result = (await invoke({ managerIndex: 5 })) as { content: Array<{ text: string }> };
    expect(mockPmon.killManager).toHaveBeenCalledWith(5);
    expect(result.content[0]!.text).toContain("kill command sent");
  });

  it("returns error when PMON reports failure", async () => {
    mockPmon.killManager.mockResolvedValue({ success: false, error: "Not running" });

    const { fakeServer, invoke } = buildServer();
    registerManagerKill(fakeServer);

    const result = (await invoke({ managerIndex: 5 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Not running");
  });

  it("prevents self-kill when own manager num matches", async () => {
    process.env.MCP_MANAGER_NUM = "9";
    vi.resetModules();

    const { registerManagerKill: reg } = await import("./manager-kill.js");
    const { setPmonClientInstance: setPmon } = await import("../../pmon/pmon-client-accessor.js");
    setPmon(mockPmon as unknown as PmonClient);

    mockPmon.getManagerStati.mockResolvedValue({
      managers: [
        { index: 5, state: 2, pid: 500, startMode: 2, startTime: "", manNum: 9 },
      ],
      modeNumeric: 1,
      modeString: "MONITOR",
      emergencyActive: 0,
      demoModeActive: 0,
    });

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerIndex: 5 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("own manager");

    delete process.env.MCP_MANAGER_NUM;
  });
});
