/**
 * Unit tests for datapoints/dp_delete tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpDelete } from "./dp-delete.js";

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

describe("datapoints.dp_delete", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named datapoints/dp_delete", () => {
    const { fakeServer } = buildServer();
    registerDpDelete(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("datapoints.dp_delete", expect.any(Object), expect.any(Function));
  });

  it("calls dpDelete with the given dpName", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpDelete(fakeServer);

    await invoke({ dpName: "OldSensor" });

    expect(mockWinccoa.dpDelete).toHaveBeenCalledWith("OldSensor");
  });

  it("returns success with dpName after deletion", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpDelete(fakeServer);

    const result = (await invoke({ dpName: "OldSensor" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.dpName).toBe("OldSensor");
  });

  it("returns errorContent when dpDelete throws (not found)", async () => {
    vi.mocked(mockWinccoa.dpDelete).mockRejectedValue(new Error("Datapoint does not exist"));

    const { fakeServer, invoke } = buildServer();
    registerDpDelete(fakeServer);

    const result = (await invoke({ dpName: "GhostDp" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("returns errorContent when dpDelete throws (no privileges)", async () => {
    vi.mocked(mockWinccoa.dpDelete).mockRejectedValue(new Error("Insufficient privileges"));

    const { fakeServer, invoke } = buildServer();
    registerDpDelete(fakeServer);

    const result = (await invoke({ dpName: "ProtectedDp" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("privileges");
  });

  it("supports system-prefixed DP names", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpDelete(fakeServer);

    await invoke({ dpName: "System1:myDp" });

    expect(mockWinccoa.dpDelete).toHaveBeenCalledWith("System1:myDp");
  });
});
