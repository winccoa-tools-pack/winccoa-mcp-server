/**
 * Unit tests for opcua/opcua_browse tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerOpcUaBrowse } from "./opcua-browse.js";

// Hoist the ctrl script start mock so it is available inside the vi.mock factory
const mockCtrlStart = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock("winccoa-manager", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    WinccoaCtrlScript: class {
      start = mockCtrlStart;
      stop = vi.fn();
      openPromiseCount = vi.fn().mockReturnValue(0);
      constructor(_m?: unknown, _c?: string, _n?: string) {}
    },
  };
});

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

type ToolResult = { isError?: boolean; content: Array<{ text: string }> };

describe("opcua.opcua_browse", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
    mockCtrlStart.mockResolvedValue(null); // restore safe default after clearAllMocks
  });

  it("registers tool with correct name", () => {
    const { fakeServer } = buildServer();
    registerOpcUaBrowse(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith(
      "opcua.opcua_browse",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns error when connection DP does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);
    const { fakeServer, invoke } = buildServer();
    registerOpcUaBrowse(fakeServer);
    const result = (await invoke({ connectionName: "NonExistentConn" })) as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("returns error when DP is not an _OpcUAConnections type", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_pmon_Manager");
    const { fakeServer, invoke } = buildServer();
    registerOpcUaBrowse(fakeServer);
    const result = (await invoke({ connectionName: "NotOpcUaDp" })) as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("not an OPC UA connection DP");
  });

  it("returns error when CTRL script returns non-array response", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_OpcUAConnections");
    // mockCtrlStart already returns null by default — not an array
    const { fakeServer, invoke } = buildServer();
    registerOpcUaBrowse(fakeServer);
    const result = (await invoke({ connectionName: "PlcOpcUa" })) as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Unexpected response");
  });

  it("returns error when CTRL script reports an error status", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_OpcUAConnections");
    mockCtrlStart.mockResolvedValue(["error", "opcUaGetNodes failed with code 5"]);
    const { fakeServer, invoke } = buildServer();
    registerOpcUaBrowse(fakeServer);
    const result = (await invoke({ connectionName: "PlcOpcUa" })) as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("OPC UA browse failed");
    expect(result.content[0]!.text).toContain("opcUaGetNodes failed with code 5");
  });

  it("returns parsed nodes on successful browse", async () => {
    const nodes = [
      { nodeId: "ns=1;i=1001", browseName: "Temperature", displayName: "Temperature", nodeClass: "Variable" },
      { nodeId: "ns=1;i=1002", browseName: "Pressure", displayName: "Pressure", nodeClass: "Variable" },
    ];
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_OpcUAConnections");
    mockCtrlStart.mockResolvedValue(["ok", JSON.stringify(nodes)]);
    const { fakeServer, invoke } = buildServer();
    registerOpcUaBrowse(fakeServer);
    const result = (await invoke({
      connectionName: "PlcOpcUa",
      nodeId: "ns=0;i=84",
      maxDepth: 1,
      maxNodes: 50,
    })) as ToolResult;
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as { connectionName: string; nodeId: string; nodes: unknown[] };
    expect(parsed.connectionName).toBe("PlcOpcUa");
    expect(parsed.nodeId).toBe("ns=0;i=84");
    expect(parsed.nodes).toHaveLength(2);
  });

  it("returns raw payload string when CTRL script returns invalid JSON", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_OpcUAConnections");
    mockCtrlStart.mockResolvedValue(["ok", "not-valid-json"]);
    const { fakeServer, invoke } = buildServer();
    registerOpcUaBrowse(fakeServer);
    const result = (await invoke({ connectionName: "PlcOpcUa" })) as ToolResult;
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as { nodes: unknown };
    expect(parsed.nodes).toBe("not-valid-json");
  });

  it("returns error when CTRL script throws an exception", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("_OpcUAConnections");
    mockCtrlStart.mockRejectedValue(new Error("Script execution failed"));
    const { fakeServer, invoke } = buildServer();
    registerOpcUaBrowse(fakeServer);
    const result = (await invoke({ connectionName: "PlcOpcUa" })) as ToolResult;
    expect(result.isError).toBe(true);
  });
});
