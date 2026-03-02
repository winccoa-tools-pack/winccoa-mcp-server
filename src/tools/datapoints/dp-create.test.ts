/**
 * Unit tests for datapoints/dp_create tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpCreate } from "./dp-create.js";

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

describe("datapoints.dp_create", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named datapoints/dp_create", () => {
    const { fakeServer } = buildServer();
    registerDpCreate(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("datapoints.dp_create", expect.any(Object), expect.any(Function));
  });

  it("calls dpCreate with dpName and dpType", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpCreate(fakeServer);

    await invoke({ dpName: "newSensor", dpType: "ExampleDP_Float" });

    expect(mockWinccoa.dpCreate).toHaveBeenCalledWith("newSensor", "ExampleDP_Float", undefined, undefined);
  });

  it("passes optional systemId and dpId to dpCreate", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpCreate(fakeServer);

    await invoke({ dpName: "remoteSensor", dpType: "ExampleDP_Float", systemId: 2, dpId: 42 });

    expect(mockWinccoa.dpCreate).toHaveBeenCalledWith("remoteSensor", "ExampleDP_Float", 2, 42);
  });

  it("returns success with dpName on successful creation", async () => {
    const { fakeServer, invoke } = buildServer();
    registerDpCreate(fakeServer);

    const result = (await invoke({ dpName: "newSensor", dpType: "ExampleDP_Float" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.dpName).toBe("newSensor");
  });

  it("returns errorContent when dpCreate throws (type not found)", async () => {
    vi.mocked(mockWinccoa.dpCreate).mockRejectedValue(new Error("DP type does not exist"));

    const { fakeServer, invoke } = buildServer();
    registerDpCreate(fakeServer);

    const result = (await invoke({ dpName: "newSensor", dpType: "NonExistentType" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("DP type does not exist");
  });

  it("returns errorContent when dpCreate throws (duplicate name)", async () => {
    vi.mocked(mockWinccoa.dpCreate).mockRejectedValue(new Error("Datapoint already exists"));

    const { fakeServer, invoke } = buildServer();
    registerDpCreate(fakeServer);

    const result = (await invoke({ dpName: "existingDp", dpType: "ExampleDP_Float" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("already exists");
  });
});
