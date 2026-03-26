/**
 * Unit tests for manager.manager_remove tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerRemove } from "./manager-remove.js";

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

describe("manager.manager_remove", () => {
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

  it("removes a manager and returns confirmation", async () => {
    mockPmon.removeManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerRemove(fakeServer);

    const result = (await invoke({ managerIndex: 4 })) as { content: Array<{ text: string }> };
    expect(mockPmon.removeManager).toHaveBeenCalledWith(4);
    expect(result.content[0]!.text).toContain("removed from PMON");
  });

  it("returns error when PMON reports failure", async () => {
    mockPmon.removeManager.mockResolvedValue({ success: false, error: "Manager still running" });

    const { fakeServer, invoke } = buildServer();
    registerManagerRemove(fakeServer);

    const result = (await invoke({ managerIndex: 4 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Manager still running");
  });

  it("prevents self-removal when own manager num matches", async () => {
    process.env.MCP_MANAGER_NUM = "6";
    vi.resetModules();

    const { registerManagerRemove: reg } = await import("./manager-remove.js");
    const { setPmonClientInstance: setPmon } = await import("../../pmon/pmon-client-accessor.js");
    setPmon(mockPmon as unknown as PmonClient);

    mockPmon.getManagerStati.mockResolvedValue({
      managers: [
        { index: 4, state: 2, pid: 400, startMode: 2, startTime: "", manNum: 6 },
      ],
      modeNumeric: 1,
      modeString: "MONITOR",
      emergencyActive: 0,
      demoModeActive: 0,
    });

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerIndex: 4 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("own manager");

    delete process.env.MCP_MANAGER_NUM;
  });
});
