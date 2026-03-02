/**
 * WinCC OA MCP Server – Entry point.
 *
 * Supports two transports:
 *   1. stdio  (default)  – communicates over stdin / stdout.
 *   2. http              – Streamable HTTP transport via Express.
 *
 * All configuration is done via an `.env` file (or environment variables)
 * because the WinCC OA Node.js Manager does not support command-line arguments.
 *
 * Environment variables (set in .env):
 *   MCP_TRANSPORT       – "stdio" | "http"
 *   MCP_HTTP_PORT       – port number for HTTP transport
 *   MCP_CHARACTER_LIMIT – max response size in characters
 */

import dotenv from "dotenv";
import path from "node:path";
// Load .env relative to the bundle file so WinCC OA's Node.js Manager (which
// may have a different cwd) still finds the config next to dist/index.js.
dotenv.config({ path: path.join(__dirname, ".env") });
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "./server.js";
import { SERVER_NAME, SERVER_VERSION, DEFAULT_HTTP_PORT } from "./constants.js";

// ── Parse configuration ──────────────────────────────────────────────

function resolveConfig(): { transport: "stdio" | "http"; port: number } {
  const envTransport = process.env.MCP_TRANSPORT?.toLowerCase();
  const envPort = process.env.MCP_HTTP_PORT ? Number(process.env.MCP_HTTP_PORT) : undefined;

  const transport: "stdio" | "http" = envTransport === "http" ? "http" : "stdio";
  const port = envPort ?? DEFAULT_HTTP_PORT;

  return { transport, port };
}

// ── Stdio transport ──────────────────────────────────────────────────

async function startStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

// ── HTTP (Streamable) transport ──────────────────────────────────────

async function startHttp(port: number): Promise<void> {
  const app = express();

  // Track sessions for stateful mode (one server per session)
  const sessions = new Map<string, { server: ReturnType<typeof createServer>; transport: StreamableHTTPServerTransport }>();

  // POST /mcp – main request endpoint
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let entry = sessionId ? sessions.get(sessionId) : undefined;

    if (!entry) {
      // New session
      const newSessionId = randomUUID();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        enableDnsRebindingProtection: true,
      });
      const server = createServer();

      entry = { server, transport };
      sessions.set(newSessionId, entry);
      await server.connect(transport);
    }

    await entry.transport.handleRequest(req, res);
  });

  // GET /mcp – SSE stream for server-initiated messages
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const entry = sessionId ? sessions.get(sessionId) : undefined;
    if (!entry) {
      res.status(400).json({ error: "No active session. POST to /mcp first." });
      return;
    }
    await entry.transport.handleRequest(req, res);
  });

  // DELETE /mcp – close session
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const entry = sessionId ? sessions.get(sessionId) : undefined;
    if (!entry) {
      res.status(400).json({ error: "No active session." });
      return;
    }
    await entry.transport.handleRequest(req, res);
    sessions.delete(sessionId!);
  });

  app.listen(port, () => {
    console.error(`${SERVER_NAME} v${SERVER_VERSION} 222 listening on http://localhost:${port}/mcp`);
  });
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = resolveConfig();

  if (config.transport === "http") {
    await startHttp(config.port);
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
