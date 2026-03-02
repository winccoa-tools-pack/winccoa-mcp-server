/**
 * Phase-1 integration setup: injects process.argv flags BEFORE winccoa-manager
 * is imported anywhere.
 *
 * This file MUST NOT import winccoa-manager (directly or transitively).
 * The ConnectionBinding constructor in the native add-on reads process.argv at
 * construction time; if we haven't pushed the flags yet, it throws
 * "Not enough arguments in command line".
 *
 * Vitest runs setupFiles in order — this file is listed first so that
 * setup.ts (which imports winccoa-manager) sees the correct argv.
 *
 * Required environment variable:
 *   WINCCOA_PROJECT   — WinCC OA project name (e.g. "MyProject")
 *
 * Optional environment variables (with defaults):
 *   WINCCOA_HOST      — Event Manager host      (default: "localhost")
 *   WINCCOA_PORT      — Event Manager port      (default: "4999")
 *   WINCCOA_NUM       — Manager number          (default: "50")
 */

const project = process.env["WINCCOA_PROJECT"];
const host    = process.env["WINCCOA_HOST"] ?? "localhost";
const port    = process.env["WINCCOA_PORT"] ?? "4999";
const num     = process.env["WINCCOA_NUM"]  ?? "50";

if (!project) {
  throw new Error(
    "\n\nWINCCOA_PROJECT is required for integration tests.\n" +
    "Set it to your WinCC OA project name before running:\n\n" +
    "  $env:WINCCOA_PROJECT = 'MyProject'   # PowerShell\n" +
    "  WINCCOA_PROJECT=MyProject             # bash\n\n" +
    "Or create a .env.integration file and load it first.\n",
  );
}

// winccoa-manager's ConnectionBinding reads these from process.argv at startup.
// They must be in place before the module is first require()'d.
process.argv.push(
  "-proj", project,
  "-host", host,
  "-port", port,
  "-num",  num,
);

console.log(
  `[integration-setup] Injected WinCC OA argv: project="${project}" host=${host} port=${port} num=${num}`,
);
