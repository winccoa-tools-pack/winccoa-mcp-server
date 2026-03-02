/**
 * Integration tests: datapoint tools cross-verified against each other.
 *
 * Each test calls one tool and verifies the side-effect using a different tool,
 * proving that the tools work end-to-end against a real WinCC OA project.
 *
 * Setup:
 *   - Creates a minimal DP type (one Float element named "value")
 *   - Creates test DPs using that type
 * Teardown:
 *   - Deletes all test DPs then the test type (best-effort; tolerates missing items)
 *
 * Run with:  npm run test:integration
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerDpCreate } from "../tools/datapoints/dp-create.js";
import { registerDpDelete } from "../tools/datapoints/dp-delete.js";
import { registerDpExists } from "../tools/datapoints/dp-exists.js";
import { registerDpGet } from "../tools/datapoints/dp-get.js";
import { registerDpSet } from "../tools/datapoints/dp-set.js";
import { registerDpNames } from "../tools/datapoints/dp-names.js";
import { registerDpCopy } from "../tools/datapoints/dp-copy.js";
import { registerDpTypeCreate } from "../tools/dp-types/dp-type-create.js";
import { registerDpTypeDelete } from "../tools/dp-types/dp-type-delete.js";
import { assertSuccess, captureHandler, makePrefix, parseResult } from "./helpers.js";

// ---------------------------------------------------------------------------
// Tool invokers — all backed by the real WinccoaManager (no mock)
// ---------------------------------------------------------------------------
const dpTypeCreate = captureHandler(registerDpTypeCreate);
const dpTypeDelete = captureHandler(registerDpTypeDelete);
const dpCreate     = captureHandler(registerDpCreate);
const dpDelete     = captureHandler(registerDpDelete);
const dpExists     = captureHandler(registerDpExists);
const dpGet        = captureHandler(registerDpGet);
const dpSet        = captureHandler(registerDpSet);
const dpNames      = captureHandler(registerDpNames);
const dpCopy       = captureHandler(registerDpCopy);

// ---------------------------------------------------------------------------

describe("datapoints — cross-tool integration", () => {
  const PREFIX    = makePrefix();
  const TYPE_NAME = `${PREFIX}Type`;
  const DP_MAIN   = `${PREFIX}Main`;
  const DP_COPY   = `${PREFIX}Copy`;
  const DPE_MAIN  = `${DP_MAIN}.value`;
  const DPE_COPY  = `${DP_COPY}.value`;

  // ── Setup: create a minimal DP type + primary test DP ──────────────────
  beforeAll(async () => {
    assertSuccess(await dpTypeCreate({
      structure: {
        name: TYPE_NAME,
        elementTypeName: "Struct",
        children: [{ name: "value", elementTypeName: "Float" }],
      },
    }));
    assertSuccess(await dpCreate({ dpName: DP_MAIN, dpType: TYPE_NAME }));
  });

  // ── Teardown: remove DPs then the type ─────────────────────────────────
  afterAll(async () => {
    for (const dp of [DP_MAIN, DP_COPY]) {
      try { await dpDelete({ dpName: dp }); } catch { /* already deleted by a test */ }
    }
    try { await dpTypeDelete({ typeName: TYPE_NAME }); } catch { /* ignore */ }
  });

  // ── dp_exists: DP created in beforeAll is visible ──────────────────────
  it("dp_create → dp_exists: created DP is found", async () => {
    const result = await dpExists({ dpeName: DP_MAIN });
    assertSuccess(result);
    const parsed = parseResult(result) as { exists: boolean };
    expect(parsed.exists).toBe(true);
  });

  // ── dp_set → dp_get: written value round-trips correctly ───────────────
  it("dp_set → dp_get: value written with wait=true is read back", async () => {
    const testValue = 3.14;

    const setResult = await dpSet({ dpeNames: [DPE_MAIN], values: [testValue], wait: true });
    assertSuccess(setResult);
    const setData = parseResult(setResult) as { results: Record<string, { success: boolean }> };
    expect(setData.results[DPE_MAIN]?.success).toBe(true);

    const getResult = await dpGet({ dpeNames: [DPE_MAIN] });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as { values: unknown[] };
    expect(getData.values[0] as number).toBeCloseTo(testValue);
  });

  // ── dp_set overwrite → dp_get: second write supersedes first ───────────
  it("dp_set (overwrite) → dp_get: only the latest value is returned", async () => {
    await dpSet({ dpeNames: [DPE_MAIN], values: [1.0], wait: true });
    await dpSet({ dpeNames: [DPE_MAIN], values: [99.5], wait: true });

    const getResult = await dpGet({ dpeNames: [DPE_MAIN] });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as { values: unknown[] };
    expect(getData.values[0] as number).toBeCloseTo(99.5);
  });

  // ── dp_set with includeTimestamp → timestamp present and plausible ──────
  it("dp_set → dp_get with includeTimestamp: timestamp is a recent ISO string", async () => {
    const before = Date.now();
    await dpSet({ dpeNames: [DPE_MAIN], values: [42.0], wait: true });

    const getResult = await dpGet({ dpeNames: [DPE_MAIN], includeTimestamp: true });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as { values: unknown[]; timestamps: string[] };
    expect(getData.timestamps).toBeDefined();
    const ts = new Date(getData.timestamps[0]!).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 5_000); // allow 5 s clock skew
    expect(ts).toBeLessThanOrEqual(Date.now() + 5_000);
  });

  // ── dp_names: created DP appears in pattern search ──────────────────────
  it("dp_names → includes the created DP when queried by prefix pattern", async () => {
    const result = await dpNames({ dpPattern: `${PREFIX}*` });
    assertSuccess(result);
    const parsed = parseResult(result) as { dpNames: string[] };
    expect(parsed.dpNames).toContain(DP_MAIN);
  });

  // ── dp_names: deleted DP is no longer listed ────────────────────────────
  // (runs after dp_copy which creates DP_COPY; DP_MAIN deletion tested separately)
  it("dp_names → does not include a non-existent DP name", async () => {
    const result = await dpNames({ dpPattern: `${PREFIX}NoSuchDPxyz*` });
    assertSuccess(result);
    const parsed = parseResult(result) as { dpNames: string[] };
    expect(parsed.dpNames).toHaveLength(0);
  });

  // ── dp_copy → dp_exists + dp_get: copy has the same value as source ────
  it("dp_copy → dp_exists + dp_get: copied DP exists and shares the source value", async () => {
    const testValue = 7.77;
    await dpSet({ dpeNames: [DPE_MAIN], values: [testValue], wait: true });

    const copyResult = await dpCopy({ source: DP_MAIN, destination: DP_COPY });
    assertSuccess(copyResult);
    const copyData = parseResult(copyResult) as { success: boolean; source: string; destination: string };
    expect(copyData.success).toBe(true);
    expect(copyData.destination).toBe(DP_COPY);

    // Copy must exist
    const existsResult = await dpExists({ dpeName: DP_COPY });
    assertSuccess(existsResult);
    expect((parseResult(existsResult) as { exists: boolean }).exists).toBe(true);

    // Copy must carry the same value
    const getResult = await dpGet({ dpeNames: [DPE_COPY] });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as { values: unknown[] };
    expect(getData.values[0] as number).toBeCloseTo(testValue);
  });

  // ── dp_delete → dp_exists: DP is gone after deletion ───────────────────
  it("dp_delete → dp_exists: deleted DP is no longer found", async () => {
    const deleteResult = await dpDelete({ dpName: DP_MAIN });
    assertSuccess(deleteResult);
    expect((parseResult(deleteResult) as { success: boolean }).success).toBe(true);

    const existsResult = await dpExists({ dpeName: DP_MAIN });
    assertSuccess(existsResult);
    expect((parseResult(existsResult) as { exists: boolean }).exists).toBe(false);
  });

  // ── dp_delete copy → dp_names: copy is gone from listing ───────────────
  it("dp_delete copy → dp_names: only the expected DPs remain under the prefix", async () => {
    await dpDelete({ dpName: DP_COPY });

    const result = await dpNames({ dpPattern: `${PREFIX}*` });
    assertSuccess(result);
    const parsed = parseResult(result) as { dpNames: string[] };
    // Both test DPs deleted — nothing with our prefix should remain
    expect(parsed.dpNames).not.toContain(DP_MAIN);
    expect(parsed.dpNames).not.toContain(DP_COPY);
  });
});
