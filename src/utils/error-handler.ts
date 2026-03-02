/**
 * Centralised error handling for WinCC OA operations.
 */

import { WinccoaError } from "winccoa-manager";

/**
 * Converts an unknown error into a human-readable, actionable message that is
 * safe to return to the MCP client.
 */
export function handleWinccoaError(error: unknown): string {
  if (error instanceof WinccoaError) {
    const code = error.code != null ? ` (code ${error.code})` : "";
    const details = error.details != null ? `\nDetails: ${JSON.stringify(error.details)}` : "";
    return `WinCC OA Error${code}: ${error.message}${details}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: ${String(error)}`;
}

