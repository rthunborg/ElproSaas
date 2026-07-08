/**
 * Story 9.3 — GOLDEN-MASTER COMPARISON HARNESS: the PACK GUARDS (GREEN).
 *
 * These are the three EPIC-BLOCKER guards + the hard surface probe that make the 9.3 comparison
 * harness trustworthy (test-design-epic-9.md Non-Negotiable Requirements):
 *   GUARD 0 — HARD surface-present assertion (R-904): the real new-side oracle exists at the TOP
 *             level; NEVER a `describe.skip` precondition that self-disables (the ledgered
 *             `TAX/VAT_SURFACE_PRESENT` weakness, deferred-work.md#epic-4 iter-2).
 *   GUARD 1 — REPRESENTATIVENESS validator (9.3-VALID-01, R-903): EVERY readiness/warning/enum code
 *             in EVERY comparison fixture is a member of the REAL exported ReadinessCode union; a
 *             fixture pinning an unknown code FAILS the pack. Also catches the mis-pinned
 *             `snapshots/quote-version-source.json` (fictional REQUIRES_SIGN_OFF /
 *             DEDUCTION_ESTIMATE_UNAPPROVED — Task 1.3 aligns it).
 *   GUARD 2 — COVERAGE manifest (9.3-CMP-*, 9.3-MANIFEST-01, R-904/R-921): FAILS if any of the nine
 *             AC1 comparison categories has ZERO EXECUTED live-driven cases. Proven by a STRUCTURED
 *             per-category key/shape match against a LIVE-driven case, NOT a `raw.includes(token)`
 *             substring (do NOT regress the money-pack substring weakness). The category count is
 *             DERIVED from the manifest, never a self-referential magic constant.
 *   GUARD 3 — WIDENED LABELLING guard (9.3-DELTA-01, R-913): a `documented-delta` / `old-lovable`
 *             case carries a divergent old value that is a NUMBER (`oldLovableWouldGive`) OR a
 *             CLASSIFICATION CODE (`oldLovableValue`) — a union, non-empty. Proven to FIRE on a
 *             seeded malformed case missing its divergent value (never structurally-unreachable).
 *
 * ── GREEN STATUS ─────────────────────────────────────────────────────────────────────
 * All four guards RUN and PASS (the oracle surfaces exist since Epics 4-8):
 *   - GUARD 1: `realReadinessCodeSet()` derives the real union from the runtime `READINESS_CODES`
 *     export in readiness.ts (Task 1.2); `snapshots/quote-version-source.json` is ALIGNED to the real
 *     union (Task 1.3 — the fictional codes are gone).
 *   - GUARD 2: `EXECUTED_COMPARISON_CATEGORIES` is BUILT below by driving every AC1 comparison
 *     category through the shared `driveComparisonCase` live-drive path (a structured per-category key
 *     match, never a substring token — R-921); a broken drive leaves its category out and GUARD 2
 *     fails loud.
 *   - GUARD 3: the widened `number | classification-code` LABELLING guard is the one the harness
 *     enforces (both arms exercised by the 9.2 fixtures; proven to FIRE on a seeded malformed case).
 *
 * Runner: `node --test` (`pnpm run test:unit`, glob `tests/unit/**`). NEVER `tests/golden/**` (the
 * runner-glob trap — an out-of-glob pin is a vacuous green). NO DB, NO PII, NO clock.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeLineTotal,
  computeSectionTotal,
  resolveTotalDisplay,
} from "@/features/calculations/totals";
import { classifyReadiness } from "@/features/calculations/readiness";
import { resolveVatDisplayPosture } from "@/features/calculations/vat-posture";
import * as money from "@/lib/money";

import {
  AC1_COMPARISON_CATEGORIES,
  AC1_CATEGORIES,
  loadLovableFixture,
  realReadinessCodeSet,
  snapshotStillCarriesFictionalCode,
  divergentOldValue,
  isValidOrigin,
  driveComparisonCase,
  type ComparisonResult,
} from "./comparison-support";

// The categories the comparison harness proves by a LIVE-driven case (GUARD 2 / Task 1.4). A category
// is registered ONLY when its real-oracle drive (`driveComparisonCase`) succeeds with a STRUCTURED
// per-category key match — NEVER a substring token (R-921). `node --test` runs each test file in its
// OWN process, so the manifest cannot read a mutable set another file populated; instead it drives the
// SAME shared live-drive functions (the identical path the dedicated comparison suites use) here,
// in-process, so a category cannot be declared covered without a genuine live case behind it. The set
// is BUILT below by driving every AC1 comparison category — a drive that throws (a broken fixture/oracle
// mapping) leaves its category OUT, and GUARD 2 fails loud (never a vacuous green).
const executedCategories = new Set<string>();
const driveResults = new Map<string, ComparisonResult>();
for (const category of AC1_COMPARISON_CATEGORIES) {
  // Sequential drive is intentional: determinism over speed for the coverage manifest.
  const result = await driveComparisonCase(category);
  // A category counts as covered ONLY if the live drive returned a structured result whose
  // matchedKeys are non-empty (a genuine per-category key match, not a token) for THIS category.
  if (result.category === category && result.matchedKeys.length > 0) {
    executedCategories.add(category);
    driveResults.set(category, result);
  }
}
export const EXECUTED_COMPARISON_CATEGORIES: ReadonlySet<string> = executedCategories;

describe("Story 9.3 — comparison-harness PACK GUARDS (9.3-VALID-01 / 9.3-MANIFEST-01 / 9.3-DELTA-01, R-903/R-904/R-906/R-913/R-921)", () => {
  // ── GUARD 0 — HARD surface-present (never a self-disabling describe.skip) ──────────────────
  test("[P0] GUARD 0 — the REAL new-side oracle surface is present (hard assertion, never a skip gate)", () => {
    assert.equal(typeof computeLineTotal, "function", "totals#computeLineTotal must be importable");
    assert.equal(typeof computeSectionTotal, "function", "totals#computeSectionTotal must be importable");
    assert.equal(typeof resolveTotalDisplay, "function", "totals#resolveTotalDisplay must be importable");
    assert.equal(typeof classifyReadiness, "function", "readiness#classifyReadiness must be importable");
    assert.equal(typeof resolveVatDisplayPosture, "function", "vat-posture#resolveVatDisplayPosture must be importable");
    assert.equal(typeof (money as Record<string, unknown>).estimateDeduction, "function", "@/lib/money#estimateDeduction must be importable");
  });

  // ── GUARD 1 — REPRESENTATIVENESS validator (R-903 / 9.3-VALID-01) ─────────────────────────
  test("[P0] GUARD 1a — the REAL ReadinessCode union is wired as a RUNTIME set (no drifting hardcoded copy)", () => {
    const real = realReadinessCodeSet();
    assert.ok(
      real && real.size > 0,
      "realReadinessCodeSet() must return the REAL exported ReadinessCode union as a runtime Set " +
        "(Task 1.2 GREEN: add a runtime union export in src/features/calculations/readiness.ts and " +
        "return it — do NOT hardcode a copy that can drift, do NOT trust memory)",
    );
    // Spot-check a couple of known members so a wrong/empty wiring cannot pass.
    assert.ok(real!.has("TAX_SIGN_OFF_REQUIRED"), "the real union must include TAX_SIGN_OFF_REQUIRED");
    assert.ok(real!.has("HIDDEN_ROWS_INCLUDED"), "the real union must include HIDDEN_ROWS_INCLUDED");
    // And that the fictional 6.1 codes are NOT members (the trap this validator exists to catch).
    assert.ok(!real!.has("REQUIRES_SIGN_OFF"), "REQUIRES_SIGN_OFF is FICTIONAL — must not be a real union member");
    assert.ok(!real!.has("DEDUCTION_ESTIMATE_UNAPPROVED"), "DEDUCTION_ESTIMATE_UNAPPROVED is FICTIONAL — must not be a real union member");
  });

  test("[P0] GUARD 1b — EVERY readiness/warning code in EVERY lovable comparison fixture is a REAL union member", () => {
    const real = realReadinessCodeSet();
    assert.ok(real && real.size > 0, "GUARD 1a must pass first (real union not wired)");
    for (const category of AC1_CATEGORIES) {
      const fx = loadLovableFixture(category);
      const raw = JSON.stringify(fx);
      // Extract any all-caps-underscore token that looks like a readiness code and appears in a
      // `readinessWarnings`/`warnings` position. The GREEN dev walks the structured
      // `readinessWarnings`/`warnings` arrays (not a regex) — this scaffold uses the structured
      // fields where present and falls back to a token sweep only to prove the guard is non-vacuous.
      const codes = collectReadinessCodes(fx);
      for (const code of codes) {
        assert.ok(
          real!.has(code),
          `lovable/${category}.json pins readiness code '${code}' which is NOT a member of the REAL ` +
            `ReadinessCode union — a fixture pinning an unknown code is a MIRAGE of parity (R-903). raw len=${raw.length}`,
        );
      }
    }
  });

  test("[P0] GUARD 1c — the mis-pinned snapshot fixture is ALIGNED to the real union (Task 1.3)", () => {
    assert.equal(
      snapshotStillCarriesFictionalCode(),
      false,
      "tests/fixtures/golden/snapshots/quote-version-source.json still carries a FICTIONAL ReadinessCode " +
        "(REQUIRES_SIGN_OFF / DEDUCTION_ESTIMATE_UNAPPROVED). Task 1.3 GREEN: replace both with the real " +
        "union member TAX_SIGN_OFF_REQUIRED (the deduction-estimate condition IS the tax-sign-off-required " +
        "condition; dedupe if both appear in one warnings array) and confirm the snapshot golden suites " +
        "(tests/unit/lib/quote-snapshot/**) stay green.",
    );
  });

  // ── GUARD 2 — COVERAGE manifest (R-904 / R-921 / 9.3-MANIFEST-01) ─────────────────────────
  test("[P0] GUARD 2 — the manifest COVERS every AC1 comparison category by a LIVE-driven case (fails on any zero-executed category)", () => {
    // The count is DERIVED from the manifest array — NOT a self-referential magic constant
    // (the 5.5 ledgered anti-pattern). A category is covered ONLY if a live oracle case ran for it.
    assert.equal(
      AC1_COMPARISON_CATEGORIES.length,
      new Set(AC1_COMPARISON_CATEGORIES).size,
      "the comparison-category manifest must have no duplicates",
    );
    const missing = AC1_COMPARISON_CATEGORIES.filter((c) => !EXECUTED_COMPARISON_CATEGORIES.has(c));
    assert.deepEqual(
      missing,
      [],
      `every AC1 comparison category must have >=1 EXECUTED live-driven comparison case. Missing (zero executed): ` +
        `${missing.join(", ")}. GREEN: the Task-2 comparison suites register each category as they drive the real ` +
        `oracle over the 9.2 fixture; prove coverage by a STRUCTURED per-category key match, NEVER a raw substring token (R-921).`,
    );
    // R-921 STRUCTURED-MATCH proof: every covered category carries a live-drive result whose
    // structured matchedKeys are non-empty AND whose category tag equals the requested category.
    // A raw substring `raw.includes(token)` coverage claim would carry NO structured keys — this
    // asserts the coverage is behavioral (a real per-category key/shape match), not a grep.
    for (const category of AC1_COMPARISON_CATEGORIES) {
      const result = driveResults.get(category);
      assert.ok(result, `no live-drive result recorded for '${category}' (structured coverage missing)`);
      assert.equal(result!.category, category, `drive result category tag mismatch for '${category}'`);
      assert.ok(
        result!.matchedKeys.length > 0,
        `'${category}' coverage must be proven by a STRUCTURED per-category key match, not a substring token (R-921)`,
      );
    }
  });

  // ── GUARD 3 — WIDENED LABELLING guard (R-913 / 9.3-DELTA-01) ──────────────────────────────
  test("[P0] GUARD 3a — every documented-delta/old-lovable comparison case carries a divergent old value as NUMBER or CLASSIFICATION CODE", () => {
    let numericArm = 0;
    let classificationArm = 0;
    for (const category of AC1_CATEGORIES) {
      const fx = loadLovableFixture(category);
      for (const c of fx.cases ?? []) {
        const origin = (c as Record<string, unknown>).origin;
        assert.ok(isValidOrigin(origin), `lovable/${category}.json case has invalid origin: ${String(origin)}`);
        if (origin === "documented-delta" || origin === "old-lovable") {
          // The SYNTHETIC old-lovable placeholder (capturedFromRealLovable:false) carries no
          // divergent value by design — it exercises the LABEL only. Skip the value requirement
          // there; require it for a documented-delta and a REAL old-lovable capture.
          const synthetic = (c as Record<string, unknown>).capturedFromRealLovable === false;
          if (synthetic) continue;
          const v = divergentOldValue(c as Record<string, unknown>);
          assert.ok(
            v !== undefined,
            `lovable/${category}.json case '${String((c as Record<string, unknown>).id)}' is ${String(origin)} ` +
              `but carries NEITHER a numeric oldLovableWouldGive NOR a non-empty classification oldLovableValue ` +
              `(R-913: the divergent old value is number | classification-code, non-empty)`,
          );
          if (typeof v === "number") numericArm += 1;
          else classificationArm += 1;
        }
      }
    }
    // Prove BOTH arms of the widened union are genuinely EXERCISED by the 9.2 fixtures (the numeric
    // arm from quotes.json#quote-total-rounding-documented-delta; the classification arm from
    // calculations.json / accepted-quote-to-job.json). Neither arm is dead code.
    assert.ok(numericArm >= 1, "the widened guard must exercise the NUMBER arm (a numeric oldLovableWouldGive delta)");
    assert.ok(classificationArm >= 1, "the widened guard must exercise the CLASSIFICATION-CODE arm (a non-numeric oldLovableValue delta) — R-913");
  });

  test("[P0] GUARD 3b — the LABELLING guard FIRES on a seeded malformed documented-delta (not structurally-unreachable)", () => {
    // A documented-delta missing BOTH divergent-value shapes must be rejected — prove the guard is
    // exercised on a negative case (deferred-work.md#epic-5: no structurally-unreachable machinery).
    const malformedNoValue = { id: "seed-missing-value", origin: "documented-delta", note: "seeded" };
    assert.equal(
      divergentOldValue(malformedNoValue),
      undefined,
      "a documented-delta with neither oldLovableWouldGive nor oldLovableValue must yield NO divergent value (guard fires)",
    );
    // An EMPTY-string classification is also rejected (an empty value labels nothing).
    const malformedEmpty = { id: "seed-empty", origin: "old-lovable", note: "seeded", oldLovableValue: "   " };
    assert.equal(
      divergentOldValue(malformedEmpty),
      undefined,
      "an empty/whitespace classification value must be rejected (an empty value labels nothing)",
    );
    // A well-formed classification value passes (the classification arm is real).
    assert.equal(
      divergentOldValue({ id: "seed-ok", origin: "documented-delta", note: "seeded", oldLovableValue: "company_excl" }),
      "company_excl",
      "a non-empty classification code is a valid divergent old value (R-913 classification arm)",
    );
  });
});

/**
 * Collect readiness/warning codes from a lovable fixture by walking the STRUCTURED
 * `readinessWarnings` / `warnings` arrays wherever they appear. This is the structured extraction
 * GUARD 1b uses (NOT a raw substring token — R-921). The GREEN dev may inline this or keep it here.
 */
function collectReadinessCodes(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectReadinessCodes(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((k === "readinessWarnings" || k === "warnings") && Array.isArray(v)) {
        for (const code of v) if (typeof code === "string") out.push(code);
      } else {
        collectReadinessCodes(v, out);
      }
    }
  }
  return out;
}
