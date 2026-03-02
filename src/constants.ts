/**
 * Shared constants for the WinCC OA MCP server.
 *
 * Values can be overridden via environment variables (see .env file).
 */

/** Maximum response size in characters to prevent overwhelming the LLM context. */
export const CHARACTER_LIMIT = process.env.MCP_CHARACTER_LIMIT
  ? Number(process.env.MCP_CHARACTER_LIMIT)
  : 25_000;

/** Server metadata. */
export const SERVER_NAME = "winccoa-mcp-server";
export const SERVER_VERSION = "0.1.0";

/** Default HTTP port when using Streamable HTTP transport. */
export const DEFAULT_HTTP_PORT = 3000;

/**
 * Optional tool filter from the TOOLS environment variable.
 * Comma-separated list of category names and/or tool names.
 * null = load all tools.
 */
export const ENABLED_TOOLS: string[] | null = process.env.TOOLS
  ? process.env.TOOLS.split(",").map((s) => s.trim()).filter(Boolean)
  : null;
