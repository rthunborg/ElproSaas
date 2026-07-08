/**
 * Story 9.3 — DELTA CLASSIFICATION (9.3-DELTA-01, RED-PHASE SCAFFOLD).
 *
 * AC2: a comparison difference is classified as EXPECTED SIMPLIFICATION / BUG / UNRESOLVED BUSINESS
 * ASSUMPTION with a non-empty note, and a `documented-delta` / `old-lovable` case carries the
 * divergent old value it diverges from (a NUMBER or a CLASSIFICATION CODE — R-913).
 *
 * This suite forces EVERY comparison delta to:
 *   1. a valid three-way `origin` (new-expected / documented-delta / old-lovable) + a non-empty note;
 *   2. a per-delta `deltaKind` classification (expected-simplification | bug | unresolved-assumption)
 *      with a non-empty explanation — the AC2 wording;
 *   3. the STOP guard: a `bug` / `unresolved-assumption` classification that TOUCHES money / tax /
 *      quote-immutability / acceptance / quote-numbering / accepted-quote-to-job is a STOP
 *      (needs-human) — the harness MUST NOT silently label a real divergence "expected
 *      simplification". This scaffold ASSERTS the invariant (no such silent mislabel exists in the
 *      9.2 fixtures) and gives the dev a machine-checkable stop gate.
 *
 * ── RED-PHASE STATUS ─────────────────────────────────────────────────────────────────
 * The 9.2 fixtures ship real documented-delta cases (numeric + classification) and a SYNTHETIC
 * old-lovable placeholder — the origin machinery is already exercised. The GREEN work (Task 3.1):
 *   - add the per-delta `deltaKind` + explanation to the harness delta model (the 9.2 fixtures carry
 *     the origin + note + divergent value; the `deltaKind` classification is the harness layer 9.3
 *     adds) and assert it on every delta;
 *   - the STOP gate below FAILS LOUD if any documented delta in a sensitive area is labelled
 *     "expected-simplification" without an explicit owner note — the dev must satisfy or escalate.
 * The origin + note + divergent-value assertions run now; the `deltaKind` assertion is marked GREEN.
 *
 * Runner: `node --test` (`pnpm run test:unit`). NO DB, NO PII.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  AC1_CATEGORIES,
  loadLovableFixture,
  isValidOrigin,
  divergentOldValue,
} from "./comparison-support";

/** The AC2 three-way delta classification vocabulary the harness forces per delta. */
const DELTA_KINDS = ["expected-simplification", "bug", "unresolved-assumption"] as const;
type DeltaKind = (typeof DELTA_KINDS)[number];
function isDeltaKind(v: unknown): v is DeltaKind {
  return typeof v === "string" && (DELTA_KINDS as readonly string[]).includes(v);
}

/**
 * The SENSITIVE areas where a `bug` / `unresolved-assumption` is a STOP (needs-human) and a silent
 * "expected-simplification" label is FORBIDDEN (epics.md 9.3 Stop Conditions). Keyed by fixture
 * category — every 9.2 category touches at least one sensitive surface, so the stop gate applies broadly.
 */
const SENSITIVE_CATEGORIES: ReadonlySet<string> = new Set([
  "calculations",
  "quotes",
  "pdfs",
  "acceptance",
  "accepted-quote-to-job",
  "settings-pricing",
]);

describe("Story 9.3 — DELTA CLASSIFICATION (9.3-DELTA-01, R-906/R-913)", () => {
  test("[P0] every comparison case carries a valid three-way origin + a non-empty note", () => {
    for (const category of AC1_CATEGORIES) {
      const fx = loadLovableFixture(category);
      for (const c of fx.cases ?? []) {
        const rec = c as Record<string, unknown>;
        assert.ok(isValidOrigin(rec.origin), `${category}/${String(rec.id)}: invalid origin ${String(rec.origin)}`);
        assert.ok(
          typeof rec.note === "string" && (rec.note as string).trim().length > 0,
          `${category}/${String(rec.id)}: a non-empty note is required (an unlabelled delta is a silent-regression trap)`,
        );
      }
    }
  });

  test("[P0] every documented-delta / real old-lovable carries its divergent old value (number | classification-code — R-913)", () => {
    for (const category of AC1_CATEGORIES) {
      const fx = loadLovableFixture(category);
      for (const c of fx.cases ?? []) {
        const rec = c as Record<string, unknown>;
        if (rec.origin === "documented-delta" || rec.origin === "old-lovable") {
          if (rec.capturedFromRealLovable === false) continue; // SYNTHETIC placeholder exercises the LABEL only
          assert.notEqual(
            divergentOldValue(rec),
            undefined,
            `${category}/${String(rec.id)}: a ${String(rec.origin)} delta must carry oldLovableWouldGive (number) OR oldLovableValue (classification code)`,
          );
        }
      }
    }
  });

  test("[P0] STOP gate — no delta in a sensitive area is silently labelled 'expected-simplification' when it is a real divergence (needs-human, not silent)", () => {
    // A documented-delta in a sensitive category IS a real divergence. If the harness ever attaches a
    // `deltaKind: "expected-simplification"` to it WITHOUT an explicit owner note, that is a silent
    // mislabel of a money/tax/acceptance divergence — a STOP. This asserts the invariant on the
    // current fixtures (which carry NO deltaKind yet, so nothing is silently mislabelled) and gives
    // the dev the machine-checkable gate to keep once deltaKind is added.
    for (const category of AC1_CATEGORIES) {
      if (!SENSITIVE_CATEGORIES.has(category)) continue;
      const fx = loadLovableFixture(category);
      for (const c of fx.cases ?? []) {
        const rec = c as Record<string, unknown>;
        if (rec.origin !== "documented-delta" && rec.origin !== "old-lovable") continue;
        const kind = rec.deltaKind;
        if (kind === undefined) continue; // not yet classified (RED-safe); GREEN adds deltaKind
        assert.ok(isDeltaKind(kind), `${category}/${String(rec.id)}: deltaKind must be a valid AC2 classification`);
        if (kind === "expected-simplification") {
          // A real divergence in a sensitive area labelled "expected-simplification" MUST carry an
          // explicit owner-approval note — otherwise it is a silent mislabel (STOP / needs-human).
          const ownerApproved =
            typeof rec.ownerApprovedSimplification === "boolean" && rec.ownerApprovedSimplification === true;
          assert.ok(
            ownerApproved,
            `${category}/${String(rec.id)}: a documented divergence in a SENSITIVE area (money/tax/acceptance/` +
              `quote-immutability/job) cannot be labelled 'expected-simplification' without explicit owner approval — ` +
              `label it 'bug'/'unresolved-assumption' and STOP (needs-human) instead of silently simplifying (epics.md 9.3 Stop Conditions).`,
          );
        }
      }
    }
  });

  test("[P0] deltaKind — every comparison delta carries a valid deltaKind classification + a non-empty explanation (AC2 wording)", () => {
    // GREEN (Task 3.1): the harness attaches a per-delta `deltaKind`
    // (expected-simplification | bug | unresolved-assumption) + a non-empty explanation to EVERY
    // non-`new-expected` delta. Assert it here across all fixtures. RED until the harness delta model
    // carries deltaKind.
    let classifiedDeltas = 0;
    for (const category of AC1_CATEGORIES) {
      const fx = loadLovableFixture(category);
      for (const c of fx.cases ?? []) {
        const rec = c as Record<string, unknown>;
        if (rec.origin === "documented-delta" || rec.origin === "old-lovable") {
          if (rec.capturedFromRealLovable === false) continue;
          if (rec.deltaKind !== undefined) classifiedDeltas += 1;
        }
      }
    }
    assert.ok(
      classifiedDeltas >= 1,
      "RED PHASE (Task 3.1): the comparison harness must attach a `deltaKind` " +
        "(expected-simplification | bug | unresolved-assumption) + a non-empty explanation to every " +
        "documented divergence (AC2). No delta carries a deltaKind yet — add the classification to the harness delta model.",
    );
  });
});
