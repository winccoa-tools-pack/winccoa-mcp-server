/**
 * Unit tests for alarms/alarm_config_set tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager, WinccoaElementType } from "winccoa-manager";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerAlarmConfigSet } from "./alarm-config-set.js";

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

describe("alarms.alarm_config_set", () => {
  let mockWinccoa: WinccoaManager;

  beforeEach(() => {
    mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
    // Default: DPE exists and is Float (non-Bool)
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(true);
    vi.mocked(mockWinccoa.dpElementType).mockReturnValue(WinccoaElementType.Float);
  });

  it("registers a tool named alarms/alarm_config_set", () => {
    const { fakeServer } = buildServer();
    registerAlarmConfigSet(fakeServer);
    expect(fakeServer.registerTool).toHaveBeenCalledWith("alarms.alarm_config_set", expect.any(Object), expect.any(Function));
  });

  it("returns error when DPE does not exist", async () => {
    vi.mocked(mockWinccoa.dpExists).mockReturnValue(false);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      alarmType: "nonBinary",
      alertClass: "_warning",
      activeState: true,
      thresholds: [{ lowerLimit: 0, upperLimit: 100, alertClass: "_warning" }],
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("does not exist");
  });

  it("returns error when alarmType=binary but DPE is not Bool", async () => {
    vi.mocked(mockWinccoa.dpElementType).mockReturnValue(WinccoaElementType.Float);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      alarmType: "binary",
      alertClass: "_warning",
      activeState: true,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("binary");
    expect(result.content[0]!.text).toContain("Bool");
  });

  it("returns error when alarmType=nonBinary but DPE is Bool", async () => {
    vi.mocked(mockWinccoa.dpElementType).mockReturnValue(WinccoaElementType.Bool);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Motor1.running",
      alarmType: "nonBinary",
      alertClass: "_warning",
      activeState: true,
      thresholds: [{ lowerLimit: 0, upperLimit: 1, alertClass: "_warning" }],
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("nonBinary");
  });

  it("returns error when alarmType=nonBinary and no thresholds supplied", async () => {
    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      alarmType: "nonBinary",
      alertClass: "_warning",
      activeState: true,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("thresholds");
  });

  it("calls dpSetWait with correct binary alarm attributes", async () => {
    vi.mocked(mockWinccoa.dpElementType).mockReturnValue(WinccoaElementType.Bool);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    await invoke({
      dpeName: "Motor1.running",
      alarmType: "binary",
      alertClass: "_warning",
      activeState: true,
    });

    expect(mockWinccoa.dpSetWait).toHaveBeenCalledWith(
      [
        "Motor1.running:_alert_hdl.._type",
        "Motor1.running:_alert_hdl.._class",
        "Motor1.running:_alert_hdl.._active_state",
      ],
      [23, "_warning", true],
    );
  });

  it("returns success for binary alarm", async () => {
    vi.mocked(mockWinccoa.dpElementType).mockReturnValue(WinccoaElementType.Bool);

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Motor1.running",
      alarmType: "binary",
      alertClass: "_alert",
      activeState: false,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.dpeName).toBe("Motor1.running");
    expect(parsed.alarmType).toBe("binary");
  });

  it("calls dpSetWait with threshold attributes for nonBinary alarm", async () => {
    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    await invoke({
      dpeName: "Tank1.level",
      alarmType: "nonBinary",
      alertClass: "_warning",
      activeState: true,
      thresholds: [
        { lowerLimit: 0, upperLimit: 80, alertClass: "_warning" },
        { lowerLimit: 80, upperLimit: 100, alertClass: "_alert" },
      ],
    });

    const [attrs, vals] = vi.mocked(mockWinccoa.dpSetWait).mock.calls[0] as [string[], unknown[]];
    expect(attrs).toContain("Tank1.level:_alert_hdl.._type");
    expect(attrs).toContain("Tank1.level:_alert_hdl.._class");
    expect(attrs).toContain("Tank1.level:_alert_hdl.1._l_limit");
    expect(attrs).toContain("Tank1.level:_alert_hdl.1._u_limit");
    expect(attrs).toContain("Tank1.level:_alert_hdl.1._class");
    expect(attrs).toContain("Tank1.level:_alert_hdl.2._l_limit");
    expect(vals).toContain(19); // DPCONFIG_ALERT_NONBINARYSIGNAL
    expect(vals).toContain(0);  // lowerLimit level 1
    expect(vals).toContain(80); // upperLimit level 1
    expect(vals).toContain("_warning");
  });

  it("returns success for nonBinary alarm", async () => {
    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Tank1.level",
      alarmType: "nonBinary",
      alertClass: "_warning",
      activeState: true,
      thresholds: [{ lowerLimit: 0, upperLimit: 100, alertClass: "_warning" }],
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.alarmType).toBe("nonBinary");
  });

  it("returns errorContent when dpSetWait throws", async () => {
    vi.mocked(mockWinccoa.dpElementType).mockReturnValue(WinccoaElementType.Bool);
    vi.mocked(mockWinccoa.dpSetWait).mockRejectedValue(new Error("write failed"));

    const { fakeServer, invoke } = buildServer();
    registerAlarmConfigSet(fakeServer);

    const result = (await invoke({
      dpeName: "Motor1.running",
      alarmType: "binary",
      alertClass: "_warning",
      activeState: true,
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("write failed");
  });
});
