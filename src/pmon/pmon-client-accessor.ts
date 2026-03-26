/**
 * Singleton accessor for the PMON TCP client.
 *
 * Mirrors the pattern in src/winccoa-client.ts.
 * During testing, inject a mock via {@link setPmonClientInstance}.
 *
 * Configuration is read from environment variables:
 *   MCP_PMON_HOST      (default "localhost")
 *   MCP_PMON_PORT      (default 4999)
 *   MCP_PMON_USER      (default "")
 *   MCP_PMON_PASSWORD   (default "")
 *   MCP_PMON_TIMEOUT_MS (default 5000)
 */

import { PmonClient } from "./pmon-client.js";

let instance: PmonClient | undefined;

/** Returns the shared {@link PmonClient} instance. Creates one on first call. */
export function getPmonClient(): PmonClient {
  if (!instance) {
    instance = new PmonClient({
      host: process.env.MCP_PMON_HOST || "localhost",
      port: process.env.MCP_PMON_PORT ? parseInt(process.env.MCP_PMON_PORT, 10) : 4999,
      user: process.env.MCP_PMON_USER || "",
      password: process.env.MCP_PMON_PASSWORD || "",
      timeoutMs: process.env.MCP_PMON_TIMEOUT_MS
        ? parseInt(process.env.MCP_PMON_TIMEOUT_MS, 10)
        : 5000,
    });
  }
  return instance;
}

/** Replace the shared instance (useful for testing / mocking). */
export function setPmonClientInstance(mock: PmonClient): void {
  instance = mock;
}
