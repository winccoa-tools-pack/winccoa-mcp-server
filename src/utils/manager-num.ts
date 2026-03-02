/**
 * Utility to determine the own WinCC OA manager number at runtime.
 *
 * WinCC OA launches JavaScript managers with a `-num <n>` argument.
 * This module parses that from process.argv so we can prevent self-stop.
 *
 * Also respects the MCP_MANAGER_NUM environment variable as an override
 * (useful when running without the standard WinCC OA process invocation).
 */

let cached: number | null | undefined;

/**
 * Returns the manager number for the current process, or null if not determinable.
 *
 * Detection order:
 *  1. MCP_MANAGER_NUM environment variable (explicit override)
 *  2. `-num <n>` in process.argv (standard WinCC OA invocation)
 *  3. null (not running as a WinCC OA manager, or detection failed)
 */
export function getOwnManagerNum(): number | null {
  if (cached !== undefined) return cached;

  // 1. Environment variable override
  if (process.env.MCP_MANAGER_NUM) {
    const n = parseInt(process.env.MCP_MANAGER_NUM, 10);
    cached = Number.isFinite(n) && n > 0 ? n : null;
    return cached;
  }

  // 2. Parse -num <n> from process.argv
  const idx = process.argv.indexOf("-num");
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const n = parseInt(process.argv[idx + 1]!, 10);
    cached = Number.isFinite(n) && n > 0 ? n : null;
    return cached;
  }

  cached = null;
  return null;
}
