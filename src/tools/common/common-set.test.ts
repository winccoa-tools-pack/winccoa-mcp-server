/**
 * Unit tests for common/common_set tool (common-set.ts)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerCommonSet } from "./common-set.js";

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

describe("common.common_set", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("returns errorContent when no fields are provided", async () => {
    const { fakeServer, invoke } = buildServer();
    registerCommonSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      alias: undefined,
      description: undefined,
      format: undefined,
      unit: undefined,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("At least one field");
  });

  it("calls dpSetAlias when alias is provided", async () => {
    vi.mocked(mockWinccoa.dpSetAlias).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerCommonSet(fakeServer);

    await invoke({
      dpeName: "Tank1.level",
      alias: "TankLevel",
      description: undefined,
      format: undefined,
      unit: undefined,
    });

    expect(mockWinccoa.dpSetAlias).toHaveBeenCalledWith("Tank1.level", "TankLevel");
  });

  it("calls dpSetUnit when unit is provided", async () => {
    vi.mocked(mockWinccoa.dpSetUnit).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerCommonSet(fakeServer);

    await invoke({
      dpeName: "Tank1.level",
      alias: undefined,
      description: undefined,
      format: undefined,
      unit: "m³/h",
    });

    expect(mockWinccoa.dpSetUnit).toHaveBeenCalledWith("Tank1.level", "m³/h");
  });

  it("calls dpSetDescription when description is provided as string", async () => {
    vi.mocked(mockWinccoa.dpSetDescription).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerCommonSet(fakeServer);

    await invoke({
      dpeName: "Tank1.level",
      alias: undefined,
      description: "Tank level sensor",
      format: undefined,
      unit: undefined,
    });

    expect(mockWinccoa.dpSetDescription).toHaveBeenCalledWith("Tank1.level", "Tank level sensor");
  });

  it("includes only provided fields in the result", async () => {
    vi.mocked(mockWinccoa.dpSetAlias).mockResolvedValue(true);

    const { fakeServer, invoke } = buildServer();
    registerCommonSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      alias: "TankLevel",
      description: undefined,
      format: undefined,
      unit: undefined,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.alias).toBeDefined();
    expect(parsed.description).toBeUndefined();
    expect(parsed.unit).toBeUndefined();
  });

  it("reports success: false for a individual field failure", async () => {
    vi.mocked(mockWinccoa.dpSetAlias).mockRejectedValue(new Error("Permission denied"));

    const { fakeServer, invoke } = buildServer();
    registerCommonSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      alias: "TankLevel",
      description: undefined,
      format: undefined,
      unit: undefined,
    })) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.alias.success).toBe(false);
    expect(parsed.alias.error).toContain("Permission denied");
  });
});
