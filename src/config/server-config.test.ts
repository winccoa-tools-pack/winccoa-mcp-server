/**
 * Unit tests for src/config/server-config.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, validateConfig } from "./server-config.js";

describe("loadConfig", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    // Clear all MCP env vars before each test
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("MCP_") || key.startsWith("WINCCOA_")) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("returns safe defaults when no env vars are set", () => {
    const config = loadConfig();
    expect(config.http.port).toBe(3000);
    expect(config.http.host).toBe("127.0.0.1");
    expect(config.http.authType).toBe("bearer");
    expect(config.http.token).toBeUndefined();
    expect(config.cors.enabled).toBe(false);
    expect(config.ssl.enabled).toBe(false);
    expect(config.rateLimit.enabled).toBe(false);
    expect(config.ipFilter.enabled).toBe(false);
  });

  it("parses MCP_HTTP_PORT", () => {
    process.env.MCP_HTTP_PORT = "4000";
    expect(loadConfig().http.port).toBe(4000);
  });

  it("parses MCP_HTTP_HOST", () => {
    process.env.MCP_HTTP_HOST = "0.0.0.0";
    expect(loadConfig().http.host).toBe("0.0.0.0");
  });

  it("parses MCP_AUTH_TYPE=apikey", () => {
    process.env.MCP_AUTH_TYPE = "apikey";
    expect(loadConfig().http.authType).toBe("apikey");
  });

  it("parses MCP_AUTH_TYPE=none", () => {
    process.env.MCP_AUTH_TYPE = "none";
    expect(loadConfig().http.authType).toBe("none");
  });

  it("defaults authType to bearer for unknown value", () => {
    process.env.MCP_AUTH_TYPE = "something-unknown";
    expect(loadConfig().http.authType).toBe("bearer");
  });

  it("parses MCP_API_TOKEN", () => {
    process.env.MCP_API_TOKEN = "secret123";
    expect(loadConfig().http.token).toBe("secret123");
  });

  it("parses MCP_CORS_ENABLED=true", () => {
    process.env.MCP_CORS_ENABLED = "true";
    expect(loadConfig().cors.enabled).toBe(true);
  });

  it("parses MCP_CORS_ORIGINS as list", () => {
    process.env.MCP_CORS_ORIGINS = "https://a.com, https://b.com";
    const config = loadConfig();
    expect(config.cors.origins).toEqual(["https://a.com", "https://b.com"]);
  });

  it("parses MCP_RATE_LIMIT_ENABLED=true with custom values", () => {
    process.env.MCP_RATE_LIMIT_ENABLED = "true";
    process.env.MCP_RATE_LIMIT_WINDOW_MS = "30000";
    process.env.MCP_RATE_LIMIT_MAX = "50";
    const config = loadConfig();
    expect(config.rateLimit.enabled).toBe(true);
    expect(config.rateLimit.windowMs).toBe(30000);
    expect(config.rateLimit.max).toBe(50);
  });

  it("parses MCP_IP_WHITELIST and MCP_IP_BLACKLIST", () => {
    process.env.MCP_IP_FILTER_ENABLED = "true";
    process.env.MCP_IP_WHITELIST = "127.0.0.1,10.0.0.1";
    process.env.MCP_IP_BLACKLIST = "192.168.1.100";
    const config = loadConfig();
    expect(config.ipFilter.enabled).toBe(true);
    expect(config.ipFilter.whitelist).toEqual(["127.0.0.1", "10.0.0.1"]);
    expect(config.ipFilter.blacklist).toEqual(["192.168.1.100"]);
  });

  it("parses MCP_SSL_ENABLED with cert/key", () => {
    process.env.MCP_SSL_ENABLED = "true";
    process.env.MCP_SSL_CERT = "C:/certs/server.crt";
    process.env.MCP_SSL_KEY = "C:/certs/server.key";
    const config = loadConfig();
    expect(config.ssl.enabled).toBe(true);
    expect(config.ssl.certPath).toBe("C:/certs/server.crt");
    expect(config.ssl.keyPath).toBe("C:/certs/server.key");
  });
});

describe("validateConfig", () => {
  it("throws when authType is bearer and no token is set", () => {
    const config = loadConfig();
    expect(() => validateConfig(config)).toThrow("MCP_API_TOKEN");
  });

  it("does not throw when authType is none", () => {
    process.env.MCP_AUTH_TYPE = "none";
    const config = loadConfig();
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("does not throw when token is provided", () => {
    process.env.MCP_AUTH_TYPE = "bearer";
    process.env.MCP_API_TOKEN = "my-token";
    const config = loadConfig();
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("throws when SSL enabled but cert path missing", () => {
    process.env.MCP_AUTH_TYPE = "none";
    process.env.MCP_SSL_ENABLED = "true";
    process.env.MCP_SSL_KEY = "C:/certs/server.key";
    const config = loadConfig();
    expect(() => validateConfig(config)).toThrow("MCP_SSL_CERT");
  });

  it("throws when SSL enabled but key path missing", () => {
    process.env.MCP_AUTH_TYPE = "none";
    process.env.MCP_SSL_ENABLED = "true";
    process.env.MCP_SSL_CERT = "C:/certs/server.crt";
    delete process.env.MCP_SSL_KEY; // ensure not leaking from a prior test
    const config = loadConfig();
    expect(() => validateConfig(config)).toThrow("MCP_SSL_KEY");
  });
});
