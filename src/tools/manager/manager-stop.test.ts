/**
 * Unit tests for manager/manager_stop tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
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
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
    // No -num in argv by default
    process.argv = ["node", "index.js"];
    delete process.env.MCP_MANAGER_NUM;
  });

  it("registers a tool named manager/manager_stop", () => {
    const { fakeServer } = buildServer();
    registerManagerStop(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("manager.manager_stop", expect.any(Object), expect.any(Function));
  });

  it("returns error when manager DP does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    const { fakeServer, invoke } = buildServer();
    registerManagerStop(fakeServer);

    const result = (await invoke({ managerNum: 99 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("calls dpSetWait with Stop=1 when manager exists", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl"]);

    const { fakeServer, invoke } = buildServer();
    registerManagerStop(fakeServer);

    await invoke({ managerNum: 5 });

    expect(mockWinccoa.dpSetWait).toHaveBeenCalledWith(
      ["_pmon:_pmon.Managers.5.Stop"],
      [1],
    );
  });

  it("returns confirmation message on success", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOAui"]);

    const { fakeServer, invoke } = buildServer();
    registerManagerStop(fakeServer);

    const result = (await invoke({ managerNum: 5 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("stop command sent");
    expect(result.content[0]!.text).toContain("WCCOAui");
  });

  it("prevents self-stop when MCP_MANAGER_NUM matches", async () => {
    process.env.MCP_MANAGER_NUM = "4";
    vi.resetModules();

    // Re-import after changing env
    const { registerManagerStop: reg } = await import("./manager-stop.js");

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerNum: 4 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("own manager");

    delete process.env.MCP_MANAGER_NUM;
  });

  it("allows stopping a different manager when own num is known", async () => {
    process.env.MCP_MANAGER_NUM = "4";
    vi.resetModules();

    const { registerManagerStop: reg } = await import("./manager-stop.js");
    // Re-inject mock after module reset
    const { setWinccoaInstance: set } = await import("../../winccoa-client.js");
    set(mockWinccoa);

    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOAui"]);

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerNum: 5 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBeUndefined();

    delete process.env.MCP_MANAGER_NUM;
  });
});
