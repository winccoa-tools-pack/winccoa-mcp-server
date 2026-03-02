/**
 * Phase-2 integration setup — runs after setup-argv.ts has already pushed
 * the WinCC OA command-line flags into process.argv.
 *
 * Starts the WinCC OA dispatch loop and waits for the connection to be fully
 * established before any test's beforeAll hooks run.
 *
 * argv flags and env-var validation are handled by setup-argv.ts (listed first
 * in vitest.integration.config.ts setupFiles) so that winccoa-manager is only
 * imported here, AFTER the flags are in place.
 */

import { beforeAll } from "vitest";
import { WinccoaError } from "winccoa-manager";
import { getWinccoa } from "../winccoa-client.js";

const project = process.env["WINCCOA_PROJECT"]!;
const host    = process.env["WINCCOA_HOST"] ?? "localhost";
const port    = process.env["WINCCOA_PORT"] ?? "4999";
const num     = process.env["WINCCOA_NUM"]  ?? "50";

console.log(`[integration-setup] Connecting to WinCC OA project "${project}" at ${host}:${port} (manager #${num})`);

// ---------------------------------------------------------------------------
// Start the WinCC OA dispatch loop and wait for the connection to be ready.
//
// In normal WinCC OA operation, bootstrap.js calls ConnectionBinding.start()
// before any user code runs.  In the test context we must replicate this:
//   1. Create the WinccoaManager singleton (same instance the tools will use).
//   2. Start the dispatch loop via the internal winccoaManagerConnection property
//      (ConnectionBinding is not part of the public winccoa-manager API).
//   3. Poll with an async dpGet until the DM handshake completes.
//      - Error code 32 means "connection not yet established" → retry.
//      - Any other response (success or different error) → handshake done.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const winccoa = getWinccoa();

  // ConnectionBinding.start() must be called exactly once; it is idempotent
  // (returns false if the loop is already running).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connBinding = (winccoa as any).winccoaManagerConnection as { start(): boolean };
  connBinding.start();

  // Poll until an async API call succeeds (or fails with a non-connection error),
  // which proves the Data Manager handshake has completed.
  const TIMEOUT_MS = 30_000;
  const POLL_MS    = 200;
  const deadline   = Date.now() + TIMEOUT_MS;

  for (;;) {
    try {
      // dpGet is async and needs the dispatch loop — perfect connection probe.
      // _System_0 is a standard internal DP present in every WinCC OA project;
      // if it doesn't exist we get a non-32 error which still means "connected".
      await winccoa.dpGet(["_System_0.._state"]);
      break; // success — connection established
    } catch (e: unknown) {
      if (!(e instanceof WinccoaError && e.code === 32)) {
        break; // non-connection error → DM handshake is done, proceed
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `[integration-setup] WinCC OA connection timed out after ${TIMEOUT_MS / 1_000} s. ` +
          `Check that project "${project}" is running at ${host}:${port}.`,
        );
      }
      // Yield to the event loop so the dispatch loop can process DM events.
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS));
    }
  }

  console.log("[integration-setup] WinCC OA connection established — running tests.");
}, 60_000);
