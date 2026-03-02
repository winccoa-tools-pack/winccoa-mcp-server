/**
 * Unit tests for manager/manager_restart tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerManagerRestart } from "./manager-restart.js";

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

describe("manager.manager_restart", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
    process.argv = ["node", "index.js"];
    delete process.env.MCP_MANAGER_NUM;
  });

  it("registers a tool named manager/manager_restart", () => {
    const { fakeServer } = buildServer();
    registerManagerRestart(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("manager.manager_restart", expect.any(Object), expect.any(Function));
  });

  it("returns error when manager DP does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    const { fakeServer, invoke } = buildServer();
    registerManagerRestart(fakeServer);

    const result = (await invoke({ managerNum: 99, waitSeconds: 0 })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("prevents restarting own manager when MCP_MANAGER_NUM matches", async () => {
    process.env.MCP_MANAGER_NUM = "5";
    vi.resetModules();

    const { registerManagerRestart: reg } = await import("./manager-restart.js");
    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerNum: 5, waitSeconds: 0 })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("own manager");

    delete process.env.MCP_MANAGER_NUM;
  });

  it("calls dpSetWait for Stop then Start", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl"]);

    const { fakeServer, invoke } = buildServer();
    registerManagerRestart(fakeServer);

    await invoke({ managerNum: 3, waitSeconds: 0 });

    expect(mockWinccoa.dpSetWait).toHaveBeenCalledTimes(2);
    expect(mockWinccoa.dpSetWait).toHaveBeenNthCalledWith(1, ["_pmon:_pmon.Managers.3.Stop"], [1]);
    expect(mockWinccoa.dpSetWait).toHaveBeenNthCalledWith(2, ["_pmon:_pmon.Managers.3.Start"], [1]);
  });

  it("returns confirmation message with manager name", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl"]);

    const { fakeServer, invoke } = buildServer();
    registerManagerRestart(fakeServer);

    const result = (await invoke({ managerNum: 3, waitSeconds: 0 })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("restarted");
    expect(result.content[0]!.text).toContain("WCCOActrl");
    expect(result.content[0]!.text).toContain("3");
  });

  it("allows restarting a different manager when own num is known", async () => {
    process.env.MCP_MANAGER_NUM = "5";
    vi.resetModules();

    const { registerManagerRestart: reg } = await import("./manager-restart.js");
    const { setWinccoaInstance: set } = await import("../../winccoa-client.js");
    set(mockWinccoa);

    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl"]);

    const { fakeServer, invoke } = buildServer();
    reg(fakeServer);

    const result = (await invoke({ managerNum: 6, waitSeconds: 0 })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBeUndefined();

    delete process.env.MCP_MANAGER_NUM;
  });

  it("returns errorContent when dpSetWait throws", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl"]);
    vi.mocked(mockWinccoa.dpSetWait).mockRejectedValue(new Error("pmon error"));

    const { fakeServer, invoke } = buildServer();
    registerManagerRestart(fakeServer);

    const result = (await invoke({ managerNum: 3, waitSeconds: 0 })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("pmon error");
  });
});
