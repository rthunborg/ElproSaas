/**
 * Story 9.2 — LOVABLE-PACK SHAPE / SCHEMA GUARD (RED-PHASE SCAFFOLD)
 * Covers 9.2-SHAPE-01 (AC1) + R-911 (business-shape preservation) + R-913 (number|classification-code
 * documented-delta widening) + R-903 (fictional ReadinessCode ban) + R-921 (structured category match).
 *
 * This is the AC1 backstop: over-anonymizing away the load-bearing structure the 9.3 comparison
 * depends on is an epic blocker (R-911). This guard FAILS LOUD on a half-authored / over-anonymized
 * fixture, verifies each AC1 category is represented by a STRUCTURED shape match (not a substring
 * token), pins the three-way origin discipline (all three labels exercised), and — the epic-9 retro
 * widening — accepts a `documented-delta` whose divergent old value is a CLASSIFICATION CODE (a VAT
 * posture / ReadinessCode label), not forced to a bare number (R-913).
 *
 * ── GREEN PHASE (Story 9.2 dev) ─────────────────────────────────────────────────────────
 * The committed `lovable/**` fixtures now exist, so this suite RUNS (no longer skipped). The
 * assertions are UNCHANGED from the red-phase scaffold — HARD assertions (fail if a required
 * fixture/key/export is absent), NOT a self-disabling precondition that vacuously green-passes (R-904).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AC1_CATEGORIES,
  FICTIONAL_READINESS_CODES,
  ORIGINS,
  REAL_READINESS_CODES,
  isValidOrigin,
  listLovableFixtureFiles,
  lovableFixtureDirPresent,
  readJson,
} from "./lovable-pack-support";

// Green phase: the surface is present. A HARD guard fails loud if the fixtures were ever removed, so
// this executing suite can never silently green on nothing (R-904).
if (!lovableFixtureDirPresent()) {
  throw new Error(
    "Story 9.2 lovable shape guard: the tests/fixtures/golden/lovable/** fixtures are missing — this suite must not run vacuously green (R-904).",
  );
}

/** Collect every `origin`-bearing case across all fixtures (cases may nest under category keys). */
function collectCases(): { file: string; cases: Record<string, unknown>[] }[] {
  return listLovableFixtureFiles().map((file) => {
    const parsed = readJson(file) as Record<string, unknown>;
    const cases: Record<string, unknown>[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === "object" && "origin" in (item as object)) cases.push(item as Record<string, unknown>);
          else walk(item);
        }
      } else if (v && typeof v === "object") {
        for (const val of Object.values(v as Record<string, unknown>)) walk(val);
      }
    };
    walk(parsed);
    return { file, cases };
  });
}

/** Recursively collect every string leaf so we can scan for readiness-code usage across a fixture. */
function stringLeaves(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const i of v) stringLeaves(i, out);
  else if (v && typeof v === "object") for (const val of Object.values(v as Record<string, unknown>)) stringLeaves(val, out);
  return out;
}

describe("Story 9.2 — Lovable-pack shape/schema guard (9.2-SHAPE-01 / R-911)", () => {
  // ── 9.2-SHAPE-01a — every AC1 category is represented by a STRUCTURED shape match (R-921) ──
  // The GREEN dev ships a category manifest that binds each AC1 category to a fixture + a
  // per-category REQUIRED-KEY set (a structured shape match), NOT a raw `raw.includes(token)`.
  // This scaffold asserts the manifest exists, covers every category, and each category's fixture
  // actually carries the declared structural keys.
  test("[P0] every AC1 category is represented by a structured shape match (not a substring token)", () => {
    const files = listLovableFixtureFiles();
    assert.ok(files.length >= 1, "the lovable pack must carry >=1 committed fixture");
    // The dev's manifest lives in a fixture or a co-located module. Minimal contract asserted here:
    // for EACH AC1 category, at least one committed fixture declares `category: <name>` AND carries
    // the category-appropriate load-bearing keys. A category with no representing fixture FAILS.
    const declared = new Map<string, Record<string, unknown>>();
    for (const file of files) {
      const parsed = readJson(file) as Record<string, unknown>;
      const cat = parsed.category;
      if (typeof cat === "string") declared.set(cat, parsed);
    }
    for (const category of AC1_CATEGORIES) {
      assert.ok(
        declared.has(category),
        `AC1 category '${category}' has no representing fixture (declare category:'${category}' — over-thin pack = R-911 failure)`,
      );
    }
  });

  // ── 9.2-SHAPE-01b — per-category load-bearing structure is present (R-911) ──
  // A fixture that drops the very structure 9.3 needs (calc rows, hidden-row flags, option selection,
  // VAT posture, accepted-price delta) is an R-911 failure. Assert category-specific required keys.
  test("[P0] each category fixture carries its load-bearing structure (R-911 over-anonymization guard)", () => {
    const required: Record<string, string[]> = {
      crm: ["customer_type"], // + identifier-by-type placeholder, facility binding, primary-contact flag
      "settings-pricing": ["companySettings"], // + quote terms + work_roles
      calculations: ["rows"], // labor/material/etc rows, fractional qty, margin, hidden-row flag, option selection
      quotes: ["lines"], // quote-version-visible lines
      pdfs: ["mustNotAppear"], // the 6.3 leakage discipline — a hidden row/unselected option must NOT appear
      acceptance: ["acceptedPriceOre"], // unchanged AND adjusted accepted-price
      files: ["fileLinks"], // link/type/purpose metadata (NEVER a raw blob)
      "accepted-quote-to-job": ["jobSource"], // job source references
    };
    for (const file of listLovableFixtureFiles()) {
      const parsed = readJson(file) as Record<string, unknown>;
      const cat = parsed.category;
      if (typeof cat !== "string" || !(cat in required)) continue;
      for (const key of required[cat]) {
        assert.ok(
          keyExistsDeep(parsed, key),
          `${file} (category '${cat}'): missing load-bearing key '${key}' — over-anonymized shape (R-911)`,
        );
      }
    }
  });

  // ── 9.2-SHAPE-01c — the PDF fixture carries a NON-EMPTY mustNotAppear (6.3 leakage discipline) ──
  test("[P1] a PDF-shape fixture carries a non-empty mustNotAppear (hidden row / unselected option leakage)", () => {
    for (const file of listLovableFixtureFiles()) {
      const parsed = readJson(file) as Record<string, unknown>;
      if (parsed.category !== "pdfs") continue;
      const mna = findDeep(parsed, "mustNotAppear");
      assert.ok(Array.isArray(mna) && (mna as unknown[]).length >= 1, `${file}: mustNotAppear must be a NON-EMPTY array (an empty mustNotAppear guards nothing)`);
    }
  });

  // ── 9.2-SHAPE-01d — every case carries a valid origin + non-empty note; all three exercised ──
  test("[P0] every case carries a valid origin + non-empty note; the pack exercises all three origins", () => {
    const all = collectCases();
    const seenOrigins = new Set<string>();
    let total = 0;
    for (const { file, cases } of all) {
      for (const c of cases) {
        total++;
        assert.ok(isValidOrigin(c.origin), `${file}: case has invalid origin (got ${String(c.origin)})`);
        assert.ok(typeof c.note === "string" && (c.note as string).trim().length > 0, `${file}: case missing a non-empty note`);
        seenOrigins.add(c.origin as string);
      }
    }
    assert.ok(total >= 1, "the pack must carry >=1 origin-bearing case");
    for (const required of ORIGINS) {
      assert.ok(seenOrigins.has(required), `the pack must EXERCISE the '${required}' origin label (three-way union genuinely used)`);
    }
  });

  // ── 9.2-SHAPE-01e (R-913 widening) — a documented-delta divergent value may be number OR code ──
  // The money-pack documented-delta guard requires a NUMERIC divergent value, which cannot express a
  // classification delta (a VAT posture / ReadinessCode label). Widen: accept number | classification-code.
  test("[P0] documented-delta carries a divergent old value that is a number OR a classification-code (R-913)", () => {
    for (const { file, cases } of collectCases()) {
      for (const c of cases) {
        if (c.origin !== "documented-delta") continue;
        const divergent = c.oldLovableValue ?? c.oldLovableWouldGive ?? c.documentedDeltaOldLovableValue;
        const ok = typeof divergent === "number" || (typeof divergent === "string" && divergent.trim().length > 0);
        assert.ok(ok, `${file}: a documented-delta case must carry a divergent old value (number OR classification-code) — not forced to a bare number (R-913)`);
      }
    }
  });

  // ── 9.2-SHAPE-01f (R-903) — every readiness/warning code is a REAL member; NO fictional code ──
  test("[P0] every readiness/warning code in a fixture is a REAL ReadinessCode member; no fictional code (R-903)", () => {
    const realSet = new Set<string>(REAL_READINESS_CODES);
    const fictionalSet = new Set<string>(FICTIONAL_READINESS_CODES);
    for (const file of listLovableFixtureFiles()) {
      const parsed = readJson(file) as Record<string, unknown>;
      const leaves = stringLeaves(parsed);
      for (const leaf of leaves) {
        assert.ok(
          !fictionalSet.has(leaf),
          `${file}: fictional ReadinessCode '${leaf}' — 9.2 must NOT propagate the R-903 trap into lovable/** (alignment is 9.3)`,
        );
        // Only assert membership for tokens that LOOK like a readiness code (SCREAMING_SNAKE) to avoid
        // false positives on unrelated uppercase prose.
        if (/^[A-Z][A-Z_]{4,}$/.test(leaf) && (leaf.includes("MISSING") || leaf.includes("VAT") || leaf.includes("MARGIN") || leaf.includes("SECTION") || leaf.includes("ROW") || leaf.includes("SIGN_OFF") || leaf.includes("HIDDEN") || leaf.includes("REQUIRED") || leaf.includes("UNCOMPUTABLE") || leaf.includes("CUSTOMER") || leaf.includes("FACILITY") || leaf.includes("CONTACT") || leaf.includes("WORK_ROLE"))) {
          assert.ok(realSet.has(leaf), `${file}: '${leaf}' is not a member of the real ReadinessCode union (verify against src/features/calculations/readiness.ts)`);
        }
      }
    }
  });

  // ── 9.2-SHAPE-01g (R-914) — every öre integer stays < 10 digits (orgnr-scan false-positive guard) ──
  test("[P1] every numeric öre value stays < 1,000,000,000 (under 10 digits — orgnr-scan safe, R-914)", () => {
    for (const file of listLovableFixtureFiles()) {
      const parsed = readJson(file);
      assertOreDigits(parsed, file);
    }
  });
});

// ── local structural helpers ──
function keyExistsDeep(v: unknown, key: string): boolean {
  if (Array.isArray(v)) return v.some((i) => keyExistsDeep(i, key));
  if (v && typeof v === "object") {
    if (key in (v as Record<string, unknown>)) return true;
    return Object.values(v as Record<string, unknown>).some((val) => keyExistsDeep(val, key));
  }
  return false;
}
function findDeep(v: unknown, key: string): unknown {
  if (v && typeof v === "object" && !Array.isArray(v) && key in (v as Record<string, unknown>)) return (v as Record<string, unknown>)[key];
  if (Array.isArray(v)) for (const i of v) { const r = findDeep(i, key); if (r !== undefined) return r; }
  else if (v && typeof v === "object") for (const val of Object.values(v as Record<string, unknown>)) { const r = findDeep(val, key); if (r !== undefined) return r; }
  return undefined;
}
function assertOreDigits(v: unknown, file: string): void {
  if (typeof v === "number" && Number.isInteger(v)) {
    assert.ok(Math.abs(v) < 1_000_000_000, `${file}: integer ${v} has >= 10 digits — would trip the ORGNR scan (keep öre < 1,000,000,000 or scope the scan, R-914)`);
  } else if (Array.isArray(v)) for (const i of v) assertOreDigits(i, file);
  else if (v && typeof v === "object") for (const val of Object.values(v as Record<string, unknown>)) assertOreDigits(val, file);
}
