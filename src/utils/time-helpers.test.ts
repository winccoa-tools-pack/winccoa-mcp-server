/**
 * Unit tests for time-helpers.ts
 */

import { describe, it, expect } from "vitest";
import { toIsoString, validateTimeRange } from "./time-helpers.js";

describe("toIsoString", () => {
  it("converts a Date to an ISO 8601 string", () => {
    const d = new Date("2024-03-15T12:00:00.000Z");
    expect(toIsoString(d)).toBe("2024-03-15T12:00:00.000Z");
  });

  it("converts a numeric millisecond timestamp to an ISO 8601 string", () => {
    const ms = new Date("2024-01-01T00:00:00.000Z").getTime();
    expect(toIsoString(ms)).toBe("2024-01-01T00:00:00.000Z");
  });

  it("handles epoch (0) correctly", () => {
    expect(toIsoString(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("produces strings parseable back to the same date", () => {
    const d = new Date("2023-06-21T15:30:45.123Z");
    const iso = toIsoString(d);
    expect(new Date(iso).getTime()).toBe(d.getTime());
  });
});

describe("validateTimeRange", () => {
  it("returns null when startTime is before endTime", () => {
    expect(validateTimeRange("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z")).toBeNull();
  });

  it("returns an error message when startTime equals endTime", () => {
    const msg = validateTimeRange("2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z");
    expect(msg).toBeTruthy();
    expect(msg).toContain("before");
  });

  it("returns an error message when startTime is after endTime", () => {
    const msg = validateTimeRange("2024-01-02T00:00:00Z", "2024-01-01T00:00:00Z");
    expect(msg).toBeTruthy();
    expect(msg).toContain("before");
  });

  it("returns an error message for an invalid startTime", () => {
    const msg = validateTimeRange("not-a-date", "2024-01-01T00:00:00Z");
    expect(msg).toBeTruthy();
    expect(msg).toContain("ISO 8601");
  });

  it("returns an error message for an invalid endTime", () => {
    const msg = validateTimeRange("2024-01-01T00:00:00Z", "bad-date");
    expect(msg).toBeTruthy();
    expect(msg).toContain("ISO 8601");
  });

  it("accepts time ranges with millisecond precision", () => {
    expect(
      validateTimeRange("2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.001Z"),
    ).toBeNull();
  });
});
