/**
 * Unit tests for register-all.ts (TOOLS env filtering)
 *
 * Uses vi.hoisted + vi.mock to control ENABLED_TOOLS without dynamic imports,
 * avoiding the slow module-reload approach.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";

// Mutable ref controlled per-test; vi.hoisted ensures it's available before vi.mock
const enabledTools = vi.hoisted(() => ({ value: null as string[] | null }));

vi.mock("../constants.js", () => ({
  get ENABLED_TOOLS() {
    return enabledTools.value;
  },
  CHARACTER_LIMIT: 25000,
  SERVER_NAME: "winccoa-mcp-server",
  SERVER_VERSION: "0.1.0",
  DEFAULT_HTTP_PORT: 3000,
}));

import { registerAllTools } from "./register-all.js";
import { setWinccoaInstance } from "../winccoa-client.js";

function buildFakeServer(): { server: McpServer; registeredNames: string[] } {
  const registeredNames: string[] = [];
  const server = {
    registerTool: vi.fn((name: string) => {
      registeredNames.push(name);
    }),
  } as unknown as McpServer;
  return { server, registeredNames };
}

describe("registerAllTools – TOOLS env filter", () => {
  beforeEach(() => {
    enabledTools.value = null;
    setWinccoaInstance(new WinccoaManager());
  });

  it("registers all tools when ENABLED_TOOLS is null", () => {
    enabledTools.value = null;
    const { server, registeredNames } = buildFakeServer();
    registerAllTools(server);
    expect(registeredNames).toContain("datapoints.dp_get");
    expect(registeredNames).toContain("manager.manager_list");
    expect(registeredNames).toContain("ascii.ascii_export");
    expect(registeredNames.length).toBeGreaterThan(30);
  });

  it("registers only manager category tools when filter is ['manager']", () => {
    enabledTools.value = ["manager"];
    const { server, registeredNames } = buildFakeServer();
    registerAllTools(server);

    expect(registeredNames).toContain("manager.manager_list");
    expect(registeredNames).toContain("manager.manager_start");
    expect(registeredNames).toContain("manager.system_info");

    expect(registeredNames).not.toContain("datapoints.dp_get");
    expect(registeredNames).not.toContain("ascii.ascii_export");
  });

  it("registers only specified individual tools by short name", () => {
    enabledTools.value = ["dp-get", "dp-set"];
    const { server, registeredNames } = buildFakeServer();
    registerAllTools(server);

    expect(registeredNames).toContain("datapoints.dp_get");
    expect(registeredNames).toContain("datapoints.dp_set");
    expect(registeredNames).not.toContain("datapoints.dp_create");
    expect(registeredNames).not.toContain("manager.manager_list");
  });

  it("supports mixing category names and short tool names", () => {
    enabledTools.value = ["manager", "dp-get"];
    const { server, registeredNames } = buildFakeServer();
    registerAllTools(server);

    expect(registeredNames).toContain("manager.manager_list");
    expect(registeredNames).toContain("datapoints.dp_get");
    expect(registeredNames).not.toContain("datapoints.dp_set");
    expect(registeredNames).not.toContain("ascii.ascii_export");
  });

  it("registers ascii category tools when filter is ['ascii']", () => {
    enabledTools.value = ["ascii"];
    const { server, registeredNames } = buildFakeServer();
    registerAllTools(server);

    expect(registeredNames).toContain("ascii.ascii_export");
    expect(registeredNames).toContain("ascii.ascii_import");
    expect(registeredNames).not.toContain("datapoints.dp_get");
  });
});
