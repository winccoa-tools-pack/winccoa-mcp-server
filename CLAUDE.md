# CLAUDE.md — AI Contributor Guide

This file describes the architecture, patterns, and quality standards for `winccoa-mcp-server`. Read this before making changes.

---

## Commands

```bash
npm run build          # esbuild → dist/index.js (CJS bundle)
npm run typecheck      # tsc --noEmit (zero errors required)
npm test               # vitest run
npm run test:coverage  # vitest run --coverage
npm run dev            # vitest watch (no build step)
npm run inspect        # MCP Inspector against stdio transport
```

Always run `npm run typecheck` and `npm test` after any change.

---

## Architecture

- **Entry point**: `src/index.ts` — transport setup (stdio or HTTP with security middleware)
- **Server factory**: `src/server.ts` — `createServer()` builds the `McpServer`, registers tools and 4 resources
- **Tool orchestrator**: `src/tools/register-all.ts` — maps category names to tool names; respects `ENABLED_TOOLS` filter
- **Config**: `src/config/server-config.ts` — `loadConfig()` + `validateConfig()` for HTTP security
- **WinCC OA singleton**: `src/winccoa-client.ts` — `getWinccoa()` / `setWinccoaInstance(mock)`
- **Native add-on**: `winccoa-manager` (local path, not on npm) — never import directly; always use `getWinccoa()`

See `docs/ARCHITECTURE.md` for diagrams, detailed component descriptions, and build system notes.

---

## Adding a New Tool

1. Create `src/tools/<category>/your-tool.ts` using the standard pattern (see below).
2. Add your registration function import and call in `src/tools/register-all.ts`.
3. Add the tool name (`"<category>/your_tool"`) to the correct category in the `CATEGORIES` map in `register-all.ts`.
4. Create `src/tools/<category>/your-tool.test.ts` (see Testing section below).
5. Run `npm run typecheck && npm test` — both must pass.
6. Add a row to the tool table in `README.md` and a full section in `docs/TOOLS.md`.

### Tool file pattern

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWinccoa } from "../../winccoa-client.js";
import { errorContent, safeJsonStringify, textContent } from "../../utils/formatters.js";
import { handleWinccoaError } from "../../utils/error-handler.js";

export function registerMyTool(server: McpServer): void {
  server.registerTool(
    "mycategory/my_tool",
    {
      title: "Short Human Title",
      description: "LLM-facing description. Be specific about what this does, what it returns, and any caveats.",
      inputSchema: z.object({
        dpeName: z.string().describe("The DPE to operate on."),
        optional: z.number().optional().describe("Optional parameter. Default: 42."),
      }),
      annotations: { readOnlyHint: true },  // or: destructiveHint: true, openWorldHint: true
    },
    async ({ dpeName, optional = 42 }) => {
      try {
        const winccoa = getWinccoa();
        const result = await winccoa.dpGet([`${dpeName}:_online.._value`]);
        return textContent(safeJsonStringify({ dpeName, value: result[0], optional }));
      } catch (e) {
        return errorContent(handleWinccoaError(e));
      }
    },
  );
}
```

**Annotation guidelines:**
- `readOnlyHint: true` — tool only reads data
- `destructiveHint: true` — tool deletes or permanently modifies data
- `openWorldHint: true` — tool makes external network calls (OPC UA, ASCII binary)
- Omit annotations that don't apply; never set `readOnlyHint: true` on a write tool

---

## Testing

Tests live alongside tool files (`src/tools/<category>/your-tool.test.ts`). The native `winccoa-manager` add-on is never loaded in tests — use the mock injection pattern.

### Standard test pattern

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setWinccoaInstance } from "../../winccoa-client.js";
import { registerMyTool } from "./my-tool.js";

describe("mycategory/my_tool", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWinccoa: any;
  let invoke: (args: unknown) => Promise<unknown>;

  beforeEach(() => {
    mockWinccoa = {
      dpGet: vi.fn(),
      dpSetWait: vi.fn(),
      // add other methods your tool uses
    };
    setWinccoaInstance(mockWinccoa);

    const server = new McpServer({ name: "test", version: "0.0.0" });
    let capturedHandler: Function | undefined;
    vi.spyOn(server, "registerTool").mockImplementation((_name, _meta, handler) => {
      capturedHandler = handler as Function;
      return server;  // return value is unused but satisfies the type
    });
    registerMyTool(server);
    invoke = (args) => capturedHandler!(args);
  });

  it("returns the value for a valid DPE", async () => {
    mockWinccoa.dpGet.mockResolvedValue([42]);
    const result = await invoke({ dpeName: "TestDP.value" });
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("42") }],
    });
  });

  it("returns error content when dpGet throws", async () => {
    mockWinccoa.dpGet.mockRejectedValue(new Error("DP not found"));
    const result = await invoke({ dpeName: "Missing.value" });
    expect(result).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("DP not found") }],
      isError: true,
    });
  });
});
```

**Rules:**
- Every tool must have at least one happy-path test and one error-path test.
- For destructive tools, add a test for the pre-flight safety check (e.g., self-stop prevention).
- Mock only the `WinccoaManager` methods the tool actually calls — do not add unused mocks.
- `dpGet` returns an array; mock it as `mockResolvedValue([value])` for a single read.

---

## Key Patterns

### Error handling

All tools use inline try/catch — do **not** use `wrapToolHandler()` (it was removed as dead code):

```typescript
try {
  // ... WinCC OA calls ...
  return textContent(safeJsonStringify(result));
} catch (e) {
  return errorContent(handleWinccoaError(e));
}
```

### Response formatting

- `textContent(str)` — success response: `{ content: [{ type: "text", text: str }] }`
- `errorContent(str)` — error response: `{ content: [{ type: "text", text: str }], isError: true }`
- `safeJsonStringify(obj, limit?)` — JSON.stringify with truncation at `MCP_CHARACTER_LIMIT`

### Manager number detection

For self-stop/self-restart prevention in manager tools:

```typescript
import { getOwnManagerNum } from "../utils/manager-num.js";
const ownNum = getOwnManagerNum(); // reads -num argv or MCP_MANAGER_NUM env; returns null if unknown
if (ownNum !== null && args.managerNum === ownNum) {
  return errorContent("Cannot stop/restart the MCP server's own manager.");
}
```

### WinCC OA API quick reference

| Method | Signature | Notes |
|--------|-----------|-------|
| `dpGet` | `(attrs: string[]) => Promise<unknown[]>` | Returns array matching input length |
| `dpSet` | `(dpes: string[], values: unknown[]) => void` | Fire-and-forget |
| `dpSetWait` | `(dpes: string[], values: unknown[]) => Promise<void>` | Confirmed write |
| `dpSetTimedWait` | `(time: Date, dpes: string[], values: unknown[]) => Promise<void>` | Timed write |
| `dpCreate` | `(name: string, type: string, sysId?: number, dpId?: number) => Promise<void>` | |
| `dpDelete` | `(name: string) => Promise<void>` | |
| `dpCopy` | `(src: string, dst: string, driver?: number) => Promise<void>` | |
| `dpNames` | `(pattern: string, type?: string) => Promise<string[]>` | |
| `dpExists` | `(name: string) => Promise<boolean>` | |
| `dpQuery` | `(query: string) => Promise<unknown[][]>` | |
| `dpTypeName` | `(dpName: string) => string` | Synchronous |
| `dpTypeGet` | `(typeName: string) => Promise<DpTypeNode>` | |
| `dpTypeCreate` | `(node: DpTypeNode) => Promise<void>` | |
| `dpTypeChange` | `(node: DpTypeNode) => Promise<void>` | |
| `dpTypeDelete` | `(typeName: string) => Promise<void>` | |
| `dpTypes` | `(pattern?: string, sysId?: number) => Promise<string[]>` | |
| `WinccoaCtrlScript` | `(managerNum: number, code: string, funcName: string, params?: unknown[], types?: string[]) => Promise<unknown>` | Inline CTRL execution |

---

## Quality Standards

- **TypeScript**: strict mode + `noUncheckedIndexedAccess`. Zero type errors required.
- **No `any`**: use proper types or `unknown` with narrowing.
- **No dynamic `import()`**: keep all imports static for esbuild tree-shaking.
- **No new runtime dependencies** without strong justification — the add-on has no npm fallback.
- **No `wrapToolHandler`**: it was removed; inline try/catch is the pattern.
- **Destructive tools** must set `destructiveHint: true` in annotations.
- **TOOLS filter**: any new tool must be added to `CATEGORIES` in `register-all.ts`.
- **Documentation**: update `README.md` tool table and `docs/TOOLS.md` for every new tool.

---

## CI

GitHub Actions runs on every push/PR:
- `typecheck` — `tsc --noEmit` (Node 20)
- `test` — `vitest run --coverage` (Node 18, 20, 22)
- `build` — `npm run build` (Node 20)

The native `winccoa-manager` add-on is stubbed in CI via `.github/ci-stubs/winccoa-manager/`.

All three jobs must pass before merging.
