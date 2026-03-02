/**
 * Unit tests for datapoints/dp_names tool (dp-names.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpNames } from "./dp-names.js";

// Helper: capture the registered handler via a fake McpServer
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

describe("datapoints.dp_names", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named datapoints/dp_names", () => {
    const { fakeServer } = buildServer();
    registerDpNames(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith(
      "datapoints.dp_names",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns paginated results with correct metadata", async () => {
    const names = Array.from({ length: 10 }, (_, i) => `Dp${i}.value`);
    vi.mocked(mockWinccoa.dpNames).mockReturnValue(names);

    const { fakeServer, invoke } = buildServer();
    registerDpNames(fakeServer);

    const result = (await invoke({
      dpPattern: "*",
      dpType: undefined,
      ignoreCase: false,
      limit: 5,
      offset: 0,
      includeTypeName: false,
      includeDescription: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.total).toBe(10);
    expect(parsed.count).toBe(5);
    expect(parsed.dpNames).toHaveLength(5);
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBe(5);
  });

  it("respects offset parameter", async () => {
    const names = ["A.v", "B.v", "C.v", "D.v", "E.v"];
    vi.mocked(mockWinccoa.dpNames).mockReturnValue(names);

    const { fakeServer, invoke } = buildServer();
    registerDpNames(fakeServer);

    const result = (await invoke({
      dpPattern: "*",
      dpType: undefined,
      ignoreCase: false,
      limit: 2,
      offset: 2,
      includeTypeName: false,
      includeDescription: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.dpNames).toEqual(["C.v", "D.v"]);
    expect(parsed.offset).toBe(2);
  });

  it("skips enrichment when result set exceeds ENRICHMENT_LIMIT (50)", async () => {
    const names = Array.from({ length: 51 }, (_, i) => `Dp${i}.v`);
    vi.mocked(mockWinccoa.dpNames).mockReturnValue(names);

    const { fakeServer, invoke } = buildServer();
    registerDpNames(fakeServer);

    const result = (await invoke({
      dpPattern: "*",
      dpType: undefined,
      ignoreCase: false,
      limit: 51,
      offset: 0,
      includeTypeName: true,
      includeDescription: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.enrichmentSkipped).toBeTruthy();
    expect(parsed.typeNames).toBeUndefined();
  });

  it("includes typeNames when result ≤ 50 and includeTypeName=true", async () => {
    const names = ["PumpA.value", "PumpB.value"];
    vi.mocked(mockWinccoa.dpNames).mockReturnValue(names);
    vi.mocked(mockWinccoa.dpTypeName).mockReturnValue("Pump");

    const { fakeServer, invoke } = buildServer();
    registerDpNames(fakeServer);

    const result = (await invoke({
      dpPattern: "*",
      dpType: undefined,
      ignoreCase: false,
      limit: 200,
      offset: 0,
      includeTypeName: true,
      includeDescription: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.typeNames).toBeDefined();
    expect(parsed.typeNames["PumpA.value"]).toBe("Pump");
    expect(parsed.typeNames["PumpB.value"]).toBe("Pump");
  });

  it("returns empty dpNames when pattern matches nothing", async () => {
    vi.mocked(mockWinccoa.dpNames).mockReturnValue([]);

    const { fakeServer, invoke } = buildServer();
    registerDpNames(fakeServer);

    const result = (await invoke({
      dpPattern: "NoMatch*",
      dpType: undefined,
      ignoreCase: false,
      limit: 200,
      offset: 0,
      includeTypeName: false,
      includeDescription: false,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.total).toBe(0);
    expect(parsed.dpNames).toEqual([]);
  });
});
