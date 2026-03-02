/**
 * Unit tests for script/script_execute tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager, WinccoaCtrlScript } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerScriptExecute } from "./script-execute.js";

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

describe("script.script_execute", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named script/script_execute", () => {
    const { fakeServer } = buildServer();
    registerScriptExecute(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("script.script_execute", expect.any(Object), expect.any(Function));
  });

  it("returns error when neither code nor filePath is provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    const result = (await invoke({
      functionName: "main",
      params: [],
      paramTypes: [],
      timeoutMs: 5000,
      captureLog: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("neither");
  });

  it("returns error when both code and filePath are provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    const result = (await invoke({
      code: "void main() {}",
      filePath: "myScript.ctl",
      functionName: "main",
      params: [],
      paramTypes: [],
      timeoutMs: 5000,
      captureLog: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("both");
  });

  it("executes inline code and returns result", async () => {
    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    const result = (await invoke({
      code: "void main() { return 42; }",
      functionName: "main",
      params: [],
      paramTypes: [],
      timeoutMs: 5000,
      captureLog: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toHaveProperty("result");
    expect(parsed).toHaveProperty("executionTimeMs");
    expect(typeof parsed.executionTimeMs).toBe("number");
    expect(parsed.logFile).toBeNull();
  });

  it("calls WinccoaCtrlScript.fromFile when filePath is provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    await invoke({
      filePath: "myScript.ctl",
      functionName: "main",
      params: [],
      paramTypes: [],
      timeoutMs: 5000,
      captureLog: false,
    });

    expect(WinccoaCtrlScript.fromFile).toHaveBeenCalledWith(mockWinccoa, "myScript.ctl");
  });

  it("returns result and executionTimeMs from filePath execution", async () => {
    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    const result = (await invoke({
      filePath: "compute.ctl",
      functionName: "compute",
      params: [],
      paramTypes: [],
      timeoutMs: 5000,
      captureLog: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toHaveProperty("executionTimeMs");
    expect(Array.isArray(parsed.logLines)).toBe(true);
  });

  it("returns logLines as empty array when captureLog=false", async () => {
    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    const result = (await invoke({
      code: "void main() {}",
      functionName: "main",
      params: [],
      paramTypes: [],
      timeoutMs: 5000,
      captureLog: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.logLines).toEqual([]);
    expect(parsed.logFile).toBeNull();
  });

  it("returns errorContent when script execution throws", async () => {
    vi.mocked(WinccoaCtrlScript.fromFile).mockRejectedValue(new Error("Script not found"));

    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    const result = (await invoke({
      filePath: "missing.ctl",
      functionName: "main",
      params: [],
      paramTypes: [],
      timeoutMs: 5000,
      captureLog: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Script not found");
  });

  it("returns errorContent when execution times out", async () => {
    // Make start() never resolve to simulate timeout
    const neverResolve = new Promise<never>(() => undefined);
    vi.mocked(WinccoaCtrlScript.fromFile).mockResolvedValue({
      start: vi.fn().mockReturnValue(neverResolve),
      stop: vi.fn(),
      openPromiseCount: vi.fn().mockReturnValue(0),
    } as unknown as InstanceType<typeof WinccoaCtrlScript>);

    const { fakeServer, invoke } = buildServer();
    registerScriptExecute(fakeServer);

    const result = (await invoke({
      filePath: "slow.ctl",
      functionName: "main",
      params: [],
      paramTypes: [],
      timeoutMs: 1,
      captureLog: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("timed out");
  });
});
