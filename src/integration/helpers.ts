/**
 * Shared utilities for integration tests.
 *
 * Provides `captureHandler` — uses a fake McpServer that captures the tool
 * handler WITHOUT injecting a mock WinccoaManager.  The handler therefore
 * calls getWinccoa() and hits the real WinCC OA native add-on.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolHandler = (args: any) => Promise<unknown>;

export type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

/**
 * Register a single tool on a fake McpServer and return its captured handler.
 * No mock injection — uses the real WinccoaManager singleton.
 */
export function captureHandler(registerFn: (server: McpServer) => void): ToolHandler {
  let capturedHandler: ToolHandler | undefined;

  const fakeServer = {
    registerTool: (_name: string, _config: unknown, handler: ToolHandler) => {
      capturedHandler = handler;
    },
  } as unknown as McpServer;

  registerFn(fakeServer);
  if (!capturedHandler) throw new Error("registerFn did not call server.registerTool");
  return capturedHandler;
}

/** Parse JSON from the first text content block of a tool result. */
export function parseResult(result: unknown): unknown {
  const r = result as ToolResult;
  const text = r.content?.[0]?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Assert that a tool result is not an error.
 * Throws a descriptive error so vitest shows the WinCC OA message in the output.
 */
export function assertSuccess(result: unknown): void {
  const r = result as ToolResult;
  if (r.isError) {
    throw new Error(`Tool returned error: ${r.content?.[0]?.text ?? "(no message)"}`);
  }
}

/**
 * Return a unique string prefix safe for WinCC OA names.
 * Format: "MCPT<timestamp>" — stays within DP name length limits.
 */
export function makePrefix(): string {
  return `MCPT${Date.now()}`;
}
