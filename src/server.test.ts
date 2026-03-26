/**
 * Integration test for createServer()
 *
 * Verifies that the MCP server is built with the expected number of tools
 * and resource URIs without invoking any WinCC OA runtime.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { setWinccoaInstance } from "./winccoa-client.js";

vi.mock("winccoa-manager");

describe("createServer", () => {
  beforeEach(() => {
    const mockWinccoa = new WinccoaManager();
    setWinccoaInstance(mockWinccoa);
    vi.clearAllMocks();
  });

  it("returns a McpServer instance", async () => {
    const { createServer } = await import("./server.js");
    const server = createServer();
    expect(server).toBeInstanceOf(McpServer);
  });

  it("registers exactly 51 tools", async () => {
    const registerToolSpy = vi.spyOn(McpServer.prototype, "registerTool");

    const { createServer } = await import("./server.js");
    createServer();

    expect(registerToolSpy).toHaveBeenCalledTimes(59);
    registerToolSpy.mockRestore();
  });

  it("registers exactly 4 resources", async () => {
    const resourceSpy = vi.spyOn(McpServer.prototype, "resource");

    const { createServer } = await import("./server.js");
    createServer();

    expect(resourceSpy).toHaveBeenCalledTimes(4);
    resourceSpy.mockRestore();
  });

  it("registers the expected resource URIs", async () => {
    const resourceSpy = vi.spyOn(McpServer.prototype, "resource");

    const { createServer } = await import("./server.js");
    createServer();

    const registeredUris = resourceSpy.mock.calls.map((call) => call[0] as string);
    expect(registeredUris).toContain("instructions://system");
    expect(registeredUris).toContain("instructions://conventions");
    expect(registeredUris).toContain("instructions://field");
    expect(registeredUris).toContain("instructions://project");

    resourceSpy.mockRestore();
  });

  it("registers known tools by name", async () => {
    const registerToolSpy = vi.spyOn(McpServer.prototype, "registerTool");

    const { createServer } = await import("./server.js");
    createServer();

    const toolNames = registerToolSpy.mock.calls.map((call) => call[0] as string);
    expect(toolNames).toContain("datapoints.dp_get");
    expect(toolNames).toContain("datapoints.dp_set");
    expect(toolNames).toContain("manager.manager_start");
    expect(toolNames).toContain("manager.manager_stop");
    expect(toolNames).toContain("manager.manager_restart");
    expect(toolNames).toContain("opcua.opcua_browse");
    expect(toolNames).toContain("script.script_execute");
    expect(toolNames).toContain("alarms.alarm_config_set");

    registerToolSpy.mockRestore();
  });
});
