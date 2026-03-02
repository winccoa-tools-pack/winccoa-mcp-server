import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    // Redirect the native addon to the typed Vitest mock so tests never
    // load the real WinCC OA binary (which requires the OA Manager runtime).
    alias: {
      "winccoa-manager": resolve(__dirname, "src/__mocks__/winccoa-manager.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/__mocks__/**"],
    },
  },
});
