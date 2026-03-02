/**
 * Singleton accessor for the WinCC OA Manager instance.
 *
 * The `winccoa-manager` native add-on is provided at runtime by the WinCC OA
 * JavaScript Manager bootstrap.  During development / testing outside WinCC OA,
 * a mock can be injected via {@link setWinccoaInstance}.
 */

import { WinccoaManager } from "winccoa-manager";

let instance: WinccoaManager | undefined;

/**
 * Returns the shared {@link WinccoaManager} instance.
 * Creates one on first call.
 */
export function getWinccoa(): WinccoaManager {
  if (!instance) {
    instance = new WinccoaManager();
  }
  return instance;
}

/**
 * Replace the shared instance (useful for testing / mocking).
 */
export function setWinccoaInstance(mock: WinccoaManager): void {
  instance = mock;
}
