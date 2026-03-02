/**
 * Unit tests for alarms/alarm_config_get tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerAlarmConfigGet } from "./alarm-config-get.js";

// Config type constants (from dp-configs.ts)
const DPCONFIG_NONE = 0;
const DPCONFIG_ALERT_BINARYSIGNAL = 23;
const DPCONFIG_ALERT_NONBINARYSIGNAL = 19;

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

describe("alarms.alarm_config_get", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("registers a tool named alarms/alarm_config_get", () => {
    const { fakeServer } = buildServer();
    registerAlarmConfigGet(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("alarms.alarm_config_get", expect.any(Object), expect.any(Function));
  });

  it("returns enabled=false when config type is DPCONFIG_NONE", async () => {
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue([DPCONFIG_NONE, "", false]);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigGet(fakeServer);

    const result = (await invoke({ dpeName: "Tank1.level" })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.enabled).toBe(false);
    expect(parsed.dpeName).toBe("Tank1.level");
  });

  it("returns binary alarm config when type is DPCONFIG_ALERT_BINARYSIGNAL", async () => {
    // First dpGet returns [type, class, activeState]
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue([DPCONFIG_ALERT_BINARYSIGNAL, "_warning", true]);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigGet(fakeServer);

    const result = (await invoke({ dpeName: "Motor1.running" })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.enabled).toBe(true);
    expect(parsed.alarmType).toBe("binary");
    expect(parsed.alertClass).toBe("_warning");
    expect(parsed.activeState).toBe(true);
    expect(parsed.dpeName).toBe("Motor1.running");
  });

  it("returns nonBinary alarm config with thresholds", async () => {
    // First dpGet for base attrs, second for level attrs
    vi.mocked(mockWinccoa.dpGet)
      .mockResolvedValueOnce([DPCONFIG_ALERT_NONBINARYSIGNAL, "_warning", false])
      .mockResolvedValueOnce([
        // Level 1: lowerLimit, upperLimit, class
        0, 80, "_warning",
        // Level 2:
        80, 100, "_alert",
        // Levels 3-8: all null/undefined
        null, null, null,
        null, null, null,
        null, null, null,
        null, null, null,
        null, null, null,
        null, null, null,
      ]);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigGet(fakeServer);

    const result = (await invoke({ dpeName: "Tank1.level" })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.enabled).toBe(true);
    expect(parsed.alarmType).toBe("nonBinary");
    expect(parsed.alertClass).toBe("_warning");
    expect(parsed.thresholds).toHaveLength(2);
    expect(parsed.thresholds[0]).toMatchObject({ level: 1, lowerLimit: 0, upperLimit: 80, alertClass: "_warning" });
    expect(parsed.thresholds[1]).toMatchObject({ level: 2, lowerLimit: 80, upperLimit: 100, alertClass: "_alert" });
  });

  it("filters out unconfigured threshold levels (null limits and empty class)", async () => {
    vi.mocked(mockWinccoa.dpGet)
      .mockResolvedValueOnce([DPCONFIG_ALERT_NONBINARYSIGNAL, "_warning", false])
      .mockResolvedValueOnce([
        // Level 1 configured
        0, 100, "_warning",
        // Levels 2-8 all null/empty
        null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null,
        null, null, null,
      ]);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigGet(fakeServer);

    const result = (await invoke({ dpeName: "Tank1.level" })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.thresholds).toHaveLength(1);
    expect(parsed.thresholds[0].level).toBe(1);
  });

  it("returns unknown alarmType for unrecognized config type", async () => {
    vi.mocked(mockWinccoa.dpGet).mockResolvedValue([99, "", false]);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigGet(fakeServer);

    const result = (await invoke({ dpeName: "Tank1.level" })) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.enabled).toBe(true);
    expect(parsed.alarmType).toBe("unknown");
    expect(parsed.rawConfigType).toBe(99);
  });

  it("returns errorContent when dpGet throws", async () => {
    vi.mocked(mockWinccoa.dpGet).mockRejectedValue(new Error("read failed"));

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigGet(fakeServer);

    const result = (await invoke({ dpeName: "Tank1.level" })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("read failed");
  });
});
