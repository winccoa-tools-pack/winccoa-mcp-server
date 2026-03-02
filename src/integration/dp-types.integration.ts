/**
 * Integration tests: DP type tools cross-verified against each other.
 *
 * Flow:
 *   dp_type_create → dp_types (type appears)
 *               → dp_type_get (structure matches)
 *               → dp_create (DP of that type)
 *                   → dp_exists (DP present)
 *                   → dp_type_name (reports correct type)
 *                   → dp_delete (remove DP)
 *               → dp_type_delete (remove type)
 *               → dp_types (type gone)
 *
 * Run with:  npm run test:integration
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerDpTypeCreate } from "../tools/dp-types/dp-type-create.js";
import { registerDpTypeDelete } from "../tools/dp-types/dp-type-delete.js";
import { registerDpTypeGet } from "../tools/dp-types/dp-type-get.js";
import { registerDpTypes } from "../tools/dp-types/dp-types.js";
import { registerDpTypeName } from "../tools/dp-types/dp-type-name.js";
import { registerDpCreate } from "../tools/datapoints/dp-create.js";
import { registerDpDelete } from "../tools/datapoints/dp-delete.js";
import { registerDpExists } from "../tools/datapoints/dp-exists.js";
import { assertSuccess, captureHandler, makePrefix, parseResult } from "./helpers.js";

// ---------------------------------------------------------------------------
// Tool invokers
// ---------------------------------------------------------------------------
const dpTypeCreate = captureHandler(registerDpTypeCreate);
const dpTypeDelete = captureHandler(registerDpTypeDelete);
const dpTypeGet    = captureHandler(registerDpTypeGet);
const dpTypes      = captureHandler(registerDpTypes);
const dpTypeName   = captureHandler(registerDpTypeName);
const dpCreate     = captureHandler(registerDpCreate);
const dpDelete     = captureHandler(registerDpDelete);
const dpExists     = captureHandler(registerDpExists);

// ---------------------------------------------------------------------------

describe("dp-types — cross-tool integration", () => {
  const PREFIX    = makePrefix();
  const TYPE_NAME = `${PREFIX}Type`;
  const DP_NAME   = `${PREFIX}Dp`;

  // ── Setup ──────────────────────────────────────────────────────────────
  beforeAll(async () => {
    assertSuccess(await dpTypeCreate({
      structure: {
        name: TYPE_NAME,
        elementTypeName: "Struct",
        children: [
          { name: "speed",  elementTypeName: "Float" },
          { name: "active", elementTypeName: "Bool"  },
        ],
      },
    }));
  });

  // ── Teardown ───────────────────────────────────────────────────────────
  afterAll(async () => {
    // DPs must be deleted before their type
    try { await dpDelete({ dpName: DP_NAME }); } catch { /* may already be gone */ }
    try { await dpTypeDelete({ typeName: TYPE_NAME }); } catch { /* may already be gone */ }
  });

  // ── dp_types: newly created type appears in the listing ────────────────
  it("dp_type_create → dp_types: new type appears in list", async () => {
    const result = await dpTypes({ pattern: `${PREFIX}*` });
    assertSuccess(result);
    const parsed = parseResult(result) as { dpTypes: string[] };
    expect(parsed.dpTypes).toContain(TYPE_NAME);
  });

  // ── dp_type_get: returned structure matches what was created ────────────
  it("dp_type_create → dp_type_get: element names match the creation input", async () => {
    const result = await dpTypeGet({ typeName: TYPE_NAME, includeSubTypes: false });
    assertSuccess(result);
    const parsed = parseResult(result) as {
      typeName: string;
      structure: { children?: Array<{ name: string; elementTypeName: string }> };
    };

    expect(parsed.typeName).toBe(TYPE_NAME);
    const childNames = (parsed.structure.children ?? []).map((c) => c.name);
    expect(childNames).toContain("speed");
    expect(childNames).toContain("active");
  });

  // ── dp_create with the new type → dp_exists confirms the DP is present ─
  it("dp_type_create → dp_create → dp_exists: DP of new type is found", async () => {
    const createResult = await dpCreate({ dpName: DP_NAME, dpType: TYPE_NAME });
    assertSuccess(createResult);
    expect((parseResult(createResult) as { success: boolean }).success).toBe(true);

    const existsResult = await dpExists({ dpeName: DP_NAME });
    assertSuccess(existsResult);
    expect((parseResult(existsResult) as { exists: boolean }).exists).toBe(true);
  });

  // ── dp_type_name: confirms the DP reports the correct type ──────────────
  it("dp_create → dp_type_name: DP reports the correct type name", async () => {
    const result = await dpTypeName({ dpName: DP_NAME });
    assertSuccess(result);
    const parsed = parseResult(result) as { dpTypeName: string };
    expect(parsed.dpTypeName).toBe(TYPE_NAME);
  });

  // ── dp_delete DP then dp_type_delete → dp_types confirms type is gone ──
  it("dp_delete + dp_type_delete → dp_types: type no longer listed", async () => {
    // Must delete the DP before its type
    const delDpResult = await dpDelete({ dpName: DP_NAME });
    assertSuccess(delDpResult);

    const delTypeResult = await dpTypeDelete({ typeName: TYPE_NAME });
    assertSuccess(delTypeResult);
    expect((parseResult(delTypeResult) as { success: boolean }).success).toBe(true);

    const typesResult = await dpTypes({ pattern: `${PREFIX}*` });
    assertSuccess(typesResult);
    const parsed = parseResult(typesResult) as { dpTypes: string[] };
    expect(parsed.dpTypes).not.toContain(TYPE_NAME);
  });
});
