/**
 * Unit tests for manager/system_info tool (system-info.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerSystemInfo } from "./system-info.js";

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

describe("manager.system_info", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named manager/system_info", () => {
    const { fakeServer } = buildServer();
    registerSystemInfo(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith(
      "manager.system_info",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("calls all four synchronous winccoa APIs", async () => {
    const { fakeServer, invoke } = buildServer();
    registerSystemInfo(fakeServer);

    await invoke({});

    expect(mockWinccoa.getVersionInfo).toHaveBeenCalled();
    expect(mockWinccoa.getPaths).toHaveBeenCalled();
    expect(mockWinccoa.getProjectLangs).toHaveBeenCalled();
    expect(mockWinccoa.getSystemId).toHaveBeenCalled();
    expect(mockWinccoa.getSystemName).toHaveBeenCalled();
  });

  it("returns the expected shape with mock data", async () => {
    vi.mocked(mockWinccoa.getVersionInfo).mockReturnValue({
      version: "3.21",
      os: "Windows",
      patches: ["P1"],
    });
    vi.mocked(mockWinccoa.getPaths).mockReturnValue({
      projPath: "C:/Projects/Test",
      binPath: "C:/WinCC_OA/bin",
      scriptPath: "C:/Projects/Test/scripts",
      tmpPath: "C:/temp",
    });
    vi.mocked(mockWinccoa.getProjectLangs).mockReturnValue(["en_US", "de_DE"]);
    vi.mocked(mockWinccoa.getSystemId).mockReturnValue(42);
    vi.mocked(mockWinccoa.getSystemName).mockReturnValue("MySystem");

    const { fakeServer, invoke } = buildServer();
    registerSystemInfo(fakeServer);

    const result = (await invoke({})) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.version.version).toBe("3.21");
    expect(parsed.paths.projPath).toBe("C:/Projects/Test");
    expect(parsed.projectLangs).toEqual(["en_US", "de_DE"]);
    expect(parsed.systemId).toBe(42);
    expect(parsed.systemName).toBe("MySystem");
  });

  it("returns errorContent when getVersionInfo throws", async () => {
    vi.mocked(mockWinccoa.getVersionInfo).mockImplementation(() => {
      throw new Error("Manager not connected");
    });

    const { fakeServer, invoke } = buildServer();
    registerSystemInfo(fakeServer);

    const result = (await invoke({})) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Manager not connected");
  });
});
