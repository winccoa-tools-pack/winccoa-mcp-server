/**
 * Unit tests for manager.manager_add tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerAdd } from "./manager-add.js";

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

describe("manager.manager_add", () => {
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

  it("adds a manager and returns confirmation", async () => {
    mockPmon.addManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerAdd(fakeServer);

    const result = (await invoke({
      managerIndex: 5,
      managerName: "WCCOActrl",
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "-num 2",
    })) as { content: Array<{ text: string }> };

    expect(mockPmon.addManager).toHaveBeenCalledWith(5, "WCCOActrl", "always", 30, 3, 5, "-num 2");
    expect(result.content[0]!.text).toContain("added at index 5");
  });

  it("strips .exe extension from manager name", async () => {
    mockPmon.addManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerAdd(fakeServer);

    await invoke({
      managerIndex: 3,
      managerName: "WCCOActrl.exe",
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "",
    });

    expect(mockPmon.addManager).toHaveBeenCalledWith(3, "WCCOActrl", "always", 30, 3, 5, "");
  });

  it("returns error when PMON reports failure", async () => {
    mockPmon.addManager.mockResolvedValue({ success: false, error: "Index out of range" });

    const { fakeServer, invoke } = buildServer();
    registerManagerAdd(fakeServer);

    const result = (await invoke({
      managerIndex: 1,
      managerName: "WCCOActrl",
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "",
    })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Index out of range");
  });
});
