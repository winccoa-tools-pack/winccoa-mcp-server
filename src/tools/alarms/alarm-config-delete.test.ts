/**
 * Unit tests for alarms/alarm_config_delete tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerAlarmConfigDelete } from "./alarm-config-delete.js";

const DPCONFIG_NONE = 0;

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

describe("alarms.alarm_config_delete", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named alarms/alarm_config_delete", () => {
    const { fakeServer } = buildServer();
    registerAlarmConfigDelete(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("alarms.alarm_config_delete", expect.any(Object), expect.any(Function));
  });

  it("calls dpSetWait with DPCONFIG_NONE for each DPE", async () => {
    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigDelete(fakeServer);

    await invoke({ dpeNames: ["Tank1.level", "Motor1.running"] });

    expect(mockWinccoa.dpSetWait).toHaveBeenCalledTimes(2);
    expect(mockWinccoa.dpSetWait).toHaveBeenCalledWith("Tank1.level:_alert_hdl.._type", DPCONFIG_NONE);
    expect(mockWinccoa.dpSetWait).toHaveBeenCalledWith("Motor1.running:_alert_hdl.._type", DPCONFIG_NONE);
  });

  it("returns success=true for each successfully deleted DPE", async () => {
    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigDelete(fakeServer);

    const result = (await invoke({ dpeNames: ["Tank1.level"] })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed["Tank1.level"]).toEqual({ success: true });
  });

  it("returns success=false with error for a failed DPE", async () => {
    vi.mocked(mockWinccoa.dpSetWait).mockRejectedValue(new Error("permission denied"));

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigDelete(fakeServer);

    const result = (await invoke({ dpeNames: ["Tank1.level"] })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed["Tank1.level"].success).toBe(false);
    expect(parsed["Tank1.level"].error).toContain("permission denied");
  });

  it("processes each DPE independently — failure on one does not abort others", async () => {
    vi.mocked(mockWinccoa.dpSetWait)
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(true);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigDelete(fakeServer);

    const result = (await invoke({ dpeNames: ["Bad.dpe", "Good.dpe"] })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed["Bad.dpe"].success).toBe(false);
    expect(parsed["Good.dpe"].success).toBe(true);
  });

  it("handles single DPE correctly", async () => {
    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigDelete(fakeServer);

    const result = (await invoke({ dpeNames: ["Sensor1.value"] })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(Object.keys(parsed)).toEqual(["Sensor1.value"]);
    expect(parsed["Sensor1.value"].success).toBe(true);
  });
});
