/**
 * Centralised error handling for WinCC OA and PMON operations.
 */

import { WinccoaError } from "winccoa-manager";
import { PmonError } from "../pmon/pmon-types.js";

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

/**
 * Converts a PMON-related error into a human-readable message.
 * Separate from handleWinccoaError to avoid importing PmonError into WinCC OA tools.
 */
export function handlePmonError(error: unknown): string {
  if (error instanceof PmonError) {
    return `PMON Error (${error.code}): ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: ${String(error)}`;
}

