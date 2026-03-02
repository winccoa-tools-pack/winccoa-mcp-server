/**
 * Unit tests for manager/manager_start tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
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
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named manager/manager_start", () => {
    const { fakeServer } = buildServer();
    registerManagerStart(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("manager.manager_start", expect.any(Object), expect.any(Function));
  });

  it("returns error when manager DP does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    const { fakeServer, invoke } = buildServer();
    registerManagerStart(fakeServer);

    const result = (await invoke({ managerNum: 99 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("calls dpSetWait with Start=1 when manager exists", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl"]);

    const { fakeServer, invoke } = buildServer();
    registerManagerStart(fakeServer);

    await invoke({ managerNum: 3 });

    expect(mockWinccoa.dpSetWait).toHaveBeenCalledWith(
      ["_pmon:_pmon.Managers.3.Start"],
      [1],
    );
  });

  it("returns confirmation message on success", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl"]);

    const { fakeServer, invoke } = buildServer();
    registerManagerStart(fakeServer);

    const result = (await invoke({ managerNum: 3 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("start command sent");
    expect(result.content[0]!.text).toContain("WCCOActrl");
  });
});
