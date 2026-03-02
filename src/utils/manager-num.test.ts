/**
 * Unit tests for src/utils/manager-num.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("getOwnManagerNum", () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset cache between tests by reimporting with fresh module state
    process.argv = [...originalArgv];
    delete process.env.MCP_MANAGER_NUM;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("returns null when no -num arg and no env var", async () => {
    process.argv = ["node", "index.js"];
    const { getOwnManagerNum } = await import("./manager-num.js");
    expect(getOwnManagerNum()).toBeNull();
  });

  it("parses manager number from -num argv", async () => {
    process.argv = ["node", "index.js", "-proj", "Test", "-num", "7"];
    const { getOwnManagerNum } = await import("./manager-num.js");
    expect(getOwnManagerNum()).toBe(7);
  });

  it("prefers MCP_MANAGER_NUM env var over -num argv", async () => {
    process.env.MCP_MANAGER_NUM = "3";
    process.argv = ["node", "index.js", "-num", "7"];
    const { getOwnManagerNum } = await import("./manager-num.js");
    expect(getOwnManagerNum()).toBe(3);
  });

  it("returns null when MCP_MANAGER_NUM is not a valid number", async () => {
    process.env.MCP_MANAGER_NUM = "notanumber";
    const { getOwnManagerNum } = await import("./manager-num.js");
    expect(getOwnManagerNum()).toBeNull();
  });

  it("returns null when -num is present but the value is missing", async () => {
    process.argv = ["node", "index.js", "-num"];
    const { getOwnManagerNum } = await import("./manager-num.js");
    expect(getOwnManagerNum()).toBeNull();
  });
});
