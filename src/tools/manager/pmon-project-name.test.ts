/**
 * Unit tests for manager.project_name tool (PMON TCP).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setPmonClientInstance } from "../../pmon/pmon-client-accessor.js";
import type { PmonClient } from "../../pmon/pmon-client.js";
import { registerProjectName } from "./pmon-project-name.js";

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

describe("manager.project_name", () => {
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

  it("returns project name from PMON", async () => {
    mockPmon.getProjectName.mockResolvedValue("MyProject");

    const { fakeServer, invoke } = buildServer();
    registerProjectName(fakeServer);

    const result = (await invoke({})) as { content: Array<{ text: string }> };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.projectName).toBe("MyProject");
  });

  it("returns error on PMON failure", async () => {
    mockPmon.getProjectName.mockRejectedValue(new Error("Connection refused"));

    const { fakeServer, invoke } = buildServer();
    registerProjectName(fakeServer);

    const result = (await invoke({})) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Connection refused");
  });
});
