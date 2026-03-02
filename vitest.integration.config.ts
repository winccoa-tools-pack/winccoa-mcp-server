/**
 * Vitest config for integration tests.
 *
 * Key differences from vitest.config.ts:
 *  - NO winccoa-manager alias  → loads the real native add-on
 *  - Only includes src/integration/** files
 *  - Longer timeouts for real WinCC OA I/O
 *
 * Run inside a WinCC OA Node.js Manager context (native add-on must be available):
 *   npm run test:integration
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/integration/**/*.integration.ts"],
    // setup-argv.ts MUST be listed first: it pushes process.argv flags before
    // winccoa-manager is imported. setup.ts imports winccoa-manager and must
    // run after argv is in place (ConnectionBinding reads argv at construction).
    setupFiles: ["src/integration/setup-argv.ts", "src/integration/setup.ts"],
    // Real I/O can be slow; give each test/hook plenty of time
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Run files sequentially — integration tests share the WinCC OA database
    sequence: { concurrent: false },
  },
});
