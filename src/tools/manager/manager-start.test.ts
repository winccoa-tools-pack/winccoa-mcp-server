/**
 * Unit tests for manager.manager_start tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerStart } from "./manager-start.js";

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

describe("manager.manager_start", () => {
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

  it("sends start command and returns confirmation", async () => {
    mockPmon.startManager.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerStart(fakeServer);

    const result = (await invoke({ managerIndex: 3 })) as { content: Array<{ text: string }> };
    expect(mockPmon.startManager).toHaveBeenCalledWith(3);
    expect(result.content[0]!.text).toContain("start command sent");
  });

  it("returns error when PMON reports failure", async () => {
    mockPmon.startManager.mockResolvedValue({ success: false, error: "Manager already running" });

    const { fakeServer, invoke } = buildServer();
    registerManagerStart(fakeServer);

    const result = (await invoke({ managerIndex: 3 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Manager already running");
  });

  it("returns error on connection failure", async () => {
    mockPmon.startManager.mockRejectedValue(new Error("Connection timeout"));

    const { fakeServer, invoke } = buildServer();
    registerManagerStart(fakeServer);

    const result = (await invoke({ managerIndex: 1 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Connection timeout");
  });
});
