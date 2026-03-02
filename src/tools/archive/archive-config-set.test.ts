/**
 * Unit tests for archive/archive_config_set tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerArchiveConfigSet } from "./archive-config-set.js";

const DPCONFIG_ARCHIVE = 9;

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

describe("archive.archive_config_set", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
  });

  it("registers a tool named archive/archive_config_set", () => {
    const { fakeServer } = buildServer();
    registerArchiveConfigSet(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("archive.archive_config_set", expect.any(Object), expect.any(Function));
  });

  it("returns error when DPE does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      archiveClass: "_NGA_G_EVENT",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("calls dpSetWait with _type and _archive attributes", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    await invoke({ dpeName: "Tank1.level", archiveClass: "_NGA_G_EVENT" });

    const [attrs, vals] = vi.mocked(mockWinccoa.dpSetWait).mock.calls[0] as [string[], unknown[]];
    expect(attrs).toContain("Tank1.level:_archive.._type");
    expect(attrs).toContain("Tank1.level:_archive.._archive");
    expect(vals).toContain(DPCONFIG_ARCHIVE);
    expect(vals).toContain("_NGA_G_EVENT");
  });

  it("includes smooth in dpSetWait when provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    await invoke({ dpeName: "Tank1.level", archiveClass: "_NGA_G_1S", smooth: 1 });

    const [attrs, vals] = vi.mocked(mockWinccoa.dpSetWait).mock.calls[0] as [string[], unknown[]];
    expect(attrs).toContain("Tank1.level:_archive.._smooth");
    expect(vals).toContain(1);
  });

  it("includes correction in dpSetWait when provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    await invoke({ dpeName: "Tank1.level", archiveClass: "_NGA_G_1S", correction: 1.5 });

    const [attrs, vals] = vi.mocked(mockWinccoa.dpSetWait).mock.calls[0] as [string[], unknown[]];
    expect(attrs).toContain("Tank1.level:_archive.._correction");
    expect(vals).toContain(1.5);
  });

  it("includes deadband in dpSetWait when provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    await invoke({ dpeName: "Tank1.level", archiveClass: "_NGA_G_EVENT", deadband: 0.1 });

    const [attrs, vals] = vi.mocked(mockWinccoa.dpSetWait).mock.calls[0] as [string[], unknown[]];
    expect(attrs).toContain("Tank1.level:_archive.._deadband");
    expect(vals).toContain(0.1);
  });

  it("omits optional attributes when not provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    await invoke({ dpeName: "Tank1.level", archiveClass: "_NGA_G_EVENT" });

    const [attrs] = vi.mocked(mockWinccoa.dpSetWait).mock.calls[0] as unknown as [string[]];
    expect(attrs).not.toContain("Tank1.level:_archive.._smooth");
    expect(attrs).not.toContain("Tank1.level:_archive.._correction");
    expect(attrs).not.toContain("Tank1.level:_archive.._deadband");
  });

  it("returns success with dpeName and archiveClass", async () => {
    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      archiveClass: "_NGA_G_1M",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.dpeName).toBe("Tank1.level");
    expect(parsed.archiveClass).toBe("_NGA_G_1M");
  });

  it("returns errorContent when dpSetWait throws", async () => {
    vi.mocked(mockWinccoa.dpSetWait).mockRejectedValue(new Error("write error"));

    const { fakeServer, invoke } = buildServer();
    registerArchiveConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      archiveClass: "_NGA_G_EVENT",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("write error");
  });
});
