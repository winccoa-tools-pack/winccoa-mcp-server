/**
 * Response formatting helpers.
 */

import { CHARACTER_LIMIT } from "../constants.js";

/** Safely serialises a value to JSON, truncating if necessary. */
export function safeJsonStringify(value: unknown, indent = 2): string {
  const json = JSON.stringify(value, replacer, indent);
  if (json.length <= CHARACTER_LIMIT) {
    return json;
  }
  return (
    json.slice(0, CHARACTER_LIMIT) +
    `\n\n… [truncated – response exceeded ${CHARACTER_LIMIT} characters]`
  );
}

/**
 * Standard MCP text content helper.
 */
export function textContent(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text }] };
}

/**
 * Standard MCP error content helper.
 */
export function errorContent(text: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return { content: [{ type: "text", text }], isError: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** JSON replacer that handles BigInt and Date. */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}
