/**
 * Unit tests for manager/manager_properties_get / _set tools
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
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
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers tool with correct name", () => {
    const { fakeServer } = buildServer();
    registerManagerPropertiesGet(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith(
      "manager.manager_properties_get",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns error when manager does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesGet(fakeServer);

    const result = (await invoke({ managerNum: 99 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("returns properties as JSON on success", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue(["WCCOActrl", 2, 10, 5, 3]);

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesGet(fakeServer);

    const result = (await invoke({ managerNum: 3 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.managerNum).toBe(3);
    expect(parsed.name).toBe("WCCOActrl");
    expect(parsed.startMode).toBe(2);
    expect(parsed.killTime).toBe(10);
  });
});

describe("manager.manager_properties_set", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers tool with correct name", () => {
    const { fakeServer } = buildServer();
    registerManagerPropertiesSet(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith(
      "manager.manager_properties_set",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns error when no properties are provided", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesSet(fakeServer);

    const result = (await invoke({ managerNum: 3 })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("No properties specified");
  });

  it("calls dpSetWait with only the provided properties", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesSet(fakeServer);

    await invoke({ managerNum: 3, killTime: 15, startMode: 2 });

    const call = vi.mocked(mockWinccoa.dpSetWait).mock.calls[0];
    const dpes = call?.[0] as string[];
    const vals = call?.[1] as number[];

    // Both attributes should be set (order may vary by insertion order)
    expect(dpes).toContain("_pmon:_pmon.Managers.3.StartMode");
    expect(dpes).toContain("_pmon:_pmon.Managers.3.KillTime");
    expect(vals).toContain(2);
    expect(vals).toContain(15);
  });

  it("returns confirmation message with changed properties", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);

    const { fakeServer, invoke } = buildServer();
    registerManagerPropertiesSet(fakeServer);

    const result = (await invoke({ managerNum: 3, resetStartCount: 5 })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("ResetStartCount=5");
  });
});
