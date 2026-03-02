/**
 * Unit tests for datapoints/dp_copy tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpCopy } from "./dp-copy.js";

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

describe("datapoints.dp_copy", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named datapoints/dp_copy", () => {
    const { fakeServer } = buildServer();
    registerDpCopy(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("datapoints.dp_copy", expect.any(Object), expect.any(Function));
  });

  it("calls dpCopy with source, destination, and undefined driver by default", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpCopy(fakeServer);

    await invoke({ source: "ExampleDP_Arg1", destination: "ExampleDP_Arg1_Copy" });

    expect(mockWinccoa.dpCopy).toHaveBeenCalledWith("ExampleDP_Arg1", "ExampleDP_Arg1_Copy", undefined);
  });

  it("passes driver parameter when provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpCopy(fakeServer);

    await invoke({ source: "ExampleDP_Arg1", destination: "ExampleDP_Arg1_Copy", driver: 2 });

    expect(mockWinccoa.dpCopy).toHaveBeenCalledWith("ExampleDP_Arg1", "ExampleDP_Arg1_Copy", 2);
  });

  it("returns success with source and destination on successful copy", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpCopy(fakeServer);

    const result = (await invoke({
      source: "ExampleDP_Arg1",
      destination: "ExampleDP_Arg1_Copy",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.source).toBe("ExampleDP_Arg1");
    expect(parsed.destination).toBe("ExampleDP_Arg1_Copy");
  });

  it("returns errorContent when source does not exist", async () => {
    vi.mocked(mockWinccoa.dpCopy).mockRejectedValue(new Error("Source datapoint does not exist"));

    const { fakeServer, invoke } = buildServer();
    registerDpCopy(fakeServer);

    const result = (await invoke({
      source: "NonExistent",
      destination: "Copy",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Source datapoint does not exist");
  });

  it("returns errorContent when destination already exists", async () => {
    vi.mocked(mockWinccoa.dpCopy).mockRejectedValue(new Error("Destination already exists"));

    const { fakeServer, invoke } = buildServer();
    registerDpCopy(fakeServer);

    const result = (await invoke({
      source: "ExampleDP_Arg1",
      destination: "ExistingDp",
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("already exists");
  });
});
