/**
 * Reusable guard that checks whether one or more DPE names exist before a write.
 *
 * Returns an errorContent response if any DPE is missing, or null if all exist.
 */

import { getWinccoa } from "../winccoa-client.js";
import { errorContent } from "./formatters.js";

/**
 * Checks that every name in `dpeNames` exists in the WinCC OA system.
 * Stops at the first missing name.
 *
 * @returns An MCP error content object if any DPE is missing, or `null` if all exist.
 */
export function checkDpesExist(
  dpeNames: string[],
): ReturnType<typeof errorContent> | null {
  const winccoa = getWinccoa();
  for (const dpe of dpeNames) {
    if (!winccoa.dpExists(dpe)) {
      return errorContent(`Datapoint element does not exist: "${dpe}"`);
    }
  }
  return null;
}
