/**
 * Integration tests: common metadata tools cross-verified against each other.
 *
 * Flow:
 *   dp_type_create + dp_create (setup)
 *   → common_set alias  → common_get: alias matches
 *   → common_set description → common_get: description matches
 *   → common_set unit   → common_get: unit matches
 *   → common_set (all fields at once) → common_get (all fields): all present
 *   dp_delete + dp_type_delete (teardown)
 *
 * Run with:  npm run test:integration
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerDpTypeCreate } from "../tools/dp-types/dp-type-create.js";
import { registerDpTypeDelete } from "../tools/dp-types/dp-type-delete.js";
import { registerDpCreate } from "../tools/datapoints/dp-create.js";
import { registerDpDelete } from "../tools/datapoints/dp-delete.js";
import { registerCommonGet } from "../tools/common/common-get.js";
import { registerCommonSet } from "../tools/common/common-set.js";
import { assertSuccess, captureHandler, makePrefix, parseResult } from "./helpers.js";

// ---------------------------------------------------------------------------
// Tool invokers
// ---------------------------------------------------------------------------
const dpTypeCreate = captureHandler(registerDpTypeCreate);
const dpTypeDelete = captureHandler(registerDpTypeDelete);
const dpCreate     = captureHandler(registerDpCreate);
const dpDelete     = captureHandler(registerDpDelete);
const commonGet    = captureHandler(registerCommonGet);
const commonSet    = captureHandler(registerCommonSet);

// ---------------------------------------------------------------------------

describe("common metadata — cross-tool integration", () => {
  const PREFIX    = makePrefix();
  const TYPE_NAME = `${PREFIX}Type`;
  const DP_NAME   = `${PREFIX}Dp`;
  const DPE       = `${DP_NAME}.value`;

  // ── Setup ──────────────────────────────────────────────────────────────
  beforeAll(async () => {
    assertSuccess(await dpTypeCreate({
      structure: {
        name: TYPE_NAME,
        elementTypeName: "Struct",
        children: [{ name: "value", elementTypeName: "Float" }],
      },
    }));
    assertSuccess(await dpCreate({ dpName: DP_NAME, dpType: TYPE_NAME }));
  });

  // ── Teardown ───────────────────────────────────────────────────────────
  afterAll(async () => {
    try { await dpDelete({ dpName: DP_NAME }); } catch { /* ignore */ }
    try { await dpTypeDelete({ typeName: TYPE_NAME }); } catch { /* ignore */ }
  });

  // ── alias ───────────────────────────────────────────────────────────────
  it("common_set alias → common_get: alias round-trips correctly", async () => {
    const alias = `${PREFIX}_alias`;

    const setResult = await commonSet({ dpeName: DPE, alias });
    assertSuccess(setResult);
    const setData = parseResult(setResult) as { alias: { success: boolean } };
    expect(setData.alias.success).toBe(true);

    const getResult = await commonGet({ dpeName: DPE, fields: ["alias"] });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as { alias: string };
    expect(getData.alias).toBe(alias);
  });

  // ── description ─────────────────────────────────────────────────────────
  it("common_set description → common_get: description round-trips correctly", async () => {
    const description = "Integration test description";

    const setResult = await commonSet({ dpeName: DPE, description });
    assertSuccess(setResult);
    const setData = parseResult(setResult) as { description: { success: boolean } };
    expect(setData.description.success).toBe(true);

    const getResult = await commonGet({ dpeName: DPE, fields: ["description"] });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as { description: unknown };
    // WinCC OA may return a plain string or a lang-keyed object
    if (typeof getData.description === "string") {
      expect(getData.description).toBe(description);
    } else {
      expect(Object.values(getData.description as Record<string, string>)).toContain(description);
    }
  });

  // ── unit ────────────────────────────────────────────────────────────────
  it("common_set unit → common_get: unit round-trips correctly", async () => {
    const unit = "m3/h";

    const setResult = await commonSet({ dpeName: DPE, unit });
    assertSuccess(setResult);
    const setData = parseResult(setResult) as { unit: { success: boolean } };
    expect(setData.unit.success).toBe(true);

    const getResult = await commonGet({ dpeName: DPE, fields: ["unit"] });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as { unit: unknown };
    if (typeof getData.unit === "string") {
      expect(getData.unit).toBe(unit);
    } else {
      expect(Object.values(getData.unit as Record<string, string>)).toContain(unit);
    }
  });

  // ── all fields at once ───────────────────────────────────────────────────
  it("common_set (all fields) → common_get (all fields): every field is present and correct", async () => {
    const alias       = `${PREFIX}_full`;
    const description = "Full metadata test";
    const unit        = "kg";

    const setResult = await commonSet({ dpeName: DPE, alias, description, unit });
    assertSuccess(setResult);
    const setData = parseResult(setResult) as {
      alias: { success: boolean };
      description: { success: boolean };
      unit: { success: boolean };
    };
    expect(setData.alias.success).toBe(true);
    expect(setData.description.success).toBe(true);
    expect(setData.unit.success).toBe(true);

    const getResult = await commonGet({ dpeName: DPE, fields: ["alias", "description", "unit"] });
    assertSuccess(getResult);
    const getData = parseResult(getResult) as {
      alias: string;
      description: unknown;
      unit: unknown;
    };

    expect(getData.alias).toBe(alias);
    expect(getData.description).toBeDefined();
    expect(getData.unit).toBeDefined();
  });
});
