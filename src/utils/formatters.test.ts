/**
 * Unit tests for formatters.ts
 */

import { describe, it, expect } from "vitest";
import { safeJsonStringify, textContent, errorContent } from "./formatters.js";

describe("safeJsonStringify", () => {
  it("serialises a simple object", () => {
    const result = safeJsonStringify({ a: 1, b: "hello" });
    expect(result).toContain('"a": 1');
    expect(result).toContain('"b": "hello"');
  });

  it("serialises arrays", () => {
    const result = safeJsonStringify([1, 2, 3]);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it("handles BigInt by converting to string", () => {
    const result = safeJsonStringify({ n: BigInt(9007199254740992) });
    expect(result).toContain('"9007199254740992"');
  });

  it("uses the provided indent level", () => {
    const result = safeJsonStringify({ x: 1 }, 0);
    expect(result).toBe('{"x":1}');
  });

  it("truncates when output exceeds CHARACTER_LIMIT", () => {
    // Build a large string that will definitely exceed the limit
    const large = { data: "x".repeat(30_000) };
    const result = safeJsonStringify(large);
    expect(result).toContain("truncated");
    // Ensure we don't exceed the limit plus the truncation notice length
    expect(result.length).toBeLessThan(30_000);
  });

  it("does not truncate output that fits within the limit", () => {
    const small = { name: "Test" };
    const result = safeJsonStringify(small);
    expect(result).not.toContain("truncated");
  });
});

describe("textContent", () => {
  it("returns an object with content array containing a text item", () => {
    const result = textContent("hello world");
    expect(result).toEqual({
      content: [{ type: "text", text: "hello world" }],
    });
  });

  it("does not include isError", () => {
    const result = textContent("ok");
    expect("isError" in result).toBe(false);
  });
});

describe("errorContent", () => {
  it("returns an object with content array and isError: true", () => {
    const result = errorContent("something went wrong");
    expect(result).toEqual({
      content: [{ type: "text", text: "something went wrong" }],
      isError: true,
    });
  });

  it("isError is always true", () => {
    expect(errorContent("any error").isError).toBe(true);
  });
});
