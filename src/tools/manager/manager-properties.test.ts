/**
 * Unit tests for manager.manager_properties_get / _set tools (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerManagerPropertiesGet, registerManagerPropertiesSet } from "./manager-properties.js";

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

describe("manager.manager_properties_get", () => {
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

  it("returns properties for a valid manager", async () => {
    mockPmon.getManagerProperties.mockResolvedValue({
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "-num 1",
    });

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesGet(fakeServer);

    const result = (await invoke({ managerIndex: 2 })) as { content: Array<{ text: string }> };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.index).toBe(2);
    expect(data.startMode).toBe("always");
    expect(data.secKill).toBe(30);
    expect(data.options).toBe("-num 1");
  });

  it("returns error on PMON failure", async () => {
    mockPmon.getManagerProperties.mockRejectedValue(new Error("Timeout"));

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesGet(fakeServer);

    const result = (await invoke({ managerIndex: 2 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Timeout");
  });
});

describe("manager.manager_properties_set", () => {
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

  it("sets properties and returns confirmation", async () => {
    mockPmon.setManagerProperties.mockResolvedValue({ success: true, data: "OK" });

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesSet(fakeServer);

    const result = (await invoke({
      managerIndex: 2,
      startMode: "manual",
      secKill: 60,
      restartCount: 5,
      resetMin: 10,
      options: "",
    })) as { content: Array<{ text: string }> };

    expect(mockPmon.setManagerProperties).toHaveBeenCalledWith(2, "manual", 60, 5, 10, "");
    expect(result.content[0]!.text).toContain("properties updated");
  });

  it("returns error when PMON reports failure", async () => {
    mockPmon.setManagerProperties.mockResolvedValue({ success: false, error: "Access denied" });

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesSet(fakeServer);

    const result = (await invoke({
      managerIndex: 2,
      startMode: "always",
      secKill: 30,
      restartCount: 3,
      resetMin: 5,
      options: "",
    })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Access denied");
  });
});
