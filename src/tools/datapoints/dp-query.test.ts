/**
 * Unit tests for datapoints/dp_query tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerDpQuery } from "./dp-query.js";

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

describe("datapoints.dp_query", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named datapoints/dp_query", () => {
    const { fakeServer } = buildServer();
    registerDpQuery(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("datapoints.dp_query", expect.any(Object), expect.any(Function));
  });

  it("passes query string to dpQuery", async () => {
    vi.mocked(mockWinccoa.dpQuery).mockResolvedValue([]);

    const { fakeServer, invoke } = buildServer();
    registerDpQuery(fakeServer);

    const query = "SELECT '_original.._value' FROM 'ExampleDP_Arg*'";
    await invoke({ query });

    expect(mockWinccoa.dpQuery).toHaveBeenCalledWith(query);
  });

  it("returns query, rowCount, and rows in result", async () => {
    const rows = [["Tank1.level", 42], ["Tank2.level", 55]];
    vi.mocked(mockWinccoa.dpQuery).mockResolvedValue(rows);

    const { fakeServer, invoke } = buildServer();
    registerDpQuery(fakeServer);

    const result = (await invoke({
      query: "SELECT '_online.._value' FROM 'Tank*'",
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.rowCount).toBe(2);
    expect(parsed.rows).toEqual(rows);
    expect(parsed.query).toContain("SELECT");
  });

  it("returns rowCount=0 for empty result", async () => {
    vi.mocked(mockWinccoa.dpQuery).mockResolvedValue([]);

    const { fakeServer, invoke } = buildServer();
    registerDpQuery(fakeServer);

    const result = (await invoke({ query: "SELECT '_online.._value' FROM 'NoMatch*'" })) as {
      content: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.rowCount).toBe(0);
    expect(parsed.rows).toEqual([]);
  });

  it("includes the executed query string in the response", async () => {
    vi.mocked(mockWinccoa.dpQuery).mockResolvedValue([]);

    const { fakeServer, invoke } = buildServer();
    registerDpQuery(fakeServer);

    const query = "SELECT '_online.._value' FROM '*'";
    const result = (await invoke({ query })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.query).toBe(query);
  });

  it("returns errorContent when dpQuery throws", async () => {
    vi.mocked(mockWinccoa.dpQuery).mockRejectedValue(new Error("invalid query syntax"));

    const { fakeServer, invoke } = buildServer();
    registerDpQuery(fakeServer);

    const result = (await invoke({ query: "INVALID QUERY" })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("invalid query syntax");
  });
});
