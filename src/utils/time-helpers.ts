/**
 * Shared time utility helpers for archive and alarm tools.
 */

import { WinccoaTime } from "winccoa-manager";

/**
 * Converts a WinccoaTime (Date | number) to an ISO 8601 string.
 * Numbers are treated as milliseconds since epoch.
 */
export function toIsoString(t: WinccoaTime): string {
  return (t instanceof Date ? t : new Date(t as number)).toISOString();
}

/**
 * Validates that startTime < endTime.
 * Returns an error message string on failure, or null if valid.
 * Use in Zod .refine() or as a pre-call guard.
 */
export function validateTimeRange(start: string, end: string): string | null {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) {
    return "startTime and endTime must be valid ISO 8601 strings";
  }
  if (s >= e) {
    return "startTime must be before endTime";
  }
  return null;
}
