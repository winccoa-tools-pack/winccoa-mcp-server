/**
 * Unit tests for opcua/opcua_connection_delete tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerOpcUaConnectionDelete } from "./opcua-connection-delete.js";

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

describe("opcua.opcua_connection_delete", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers tool with correct name", () => {
    const { fakeServer } = buildServer();
    registerOpcUaConnectionDelete(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith(
      "opcua.opcua_connection_delete",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns error when connection DP does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    const { fakeServer, invoke } = buildServer();
    registerOpcUaConnectionDelete(fakeServer);

    const result = (await invoke({ connectionName: "NonExistentConn" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("returns error when DP is not an _OpcUAConnections type", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_pmon_Manager");

    const { fakeServer, invoke } = buildServer();
    registerOpcUaConnectionDelete(fakeServer);

    const result = (await invoke({ connectionName: "SomeOtherDp" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("not an OPC UA connection DP");
  });

  it("calls dpDelete when connection exists and has correct type", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_OpcUAConnections");

    const { fakeServer, invoke } = buildServer();
    registerOpcUaConnectionDelete(fakeServer);

    const result = (await invoke({ connectionName: "PlcOpcUa" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(mockWinccoa.dpDelete).toHaveBeenCalledWith("PlcOpcUa");
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("deleted successfully");
  });
});
