/**
 * Story 9.3 — DELTA CLASSIFICATION (9.3-DELTA-01, GREEN).
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
 * ── GREEN STATUS ─────────────────────────────────────────────────────────────────────
 * All checks RUN and PASS. The harness `classifyDelta` (in comparison-support.ts) attaches the
 * per-delta `deltaKind` + a non-empty explanation to every real documented divergence (the 9.2
 * fixtures carry the origin + note + divergent value; the `deltaKind` classification is the harness
 * layer 9.3 adds). The STOP gate FAILS LOUD if any documented delta in a sensitive area is labelled
 * "expected-simplification" without a recorded owner-understood justification — and is PROVEN to fire
 * on a seeded unjustified divergence (never structurally-unreachable).
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
  classifyDelta,
  isDeltaKind,
} from "./comparison-support";

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
    // A documented-delta in a sensitive category IS a real divergence. The HARNESS classifier
    // (`classifyDelta`) attaches the deltaKind; if it ever labels a sensitive-area divergence
    // "expected-simplification" WITHOUT explicit owner approval, that is a silent mislabel of a
    // money/tax/acceptance divergence — a STOP (needs-human). Every 9.2 documented-delta carries a
    // recorded divergent value + a non-empty note (an owner-understood Phase-A modelling choice), so
    // the classifier marks ownerApprovedSimplification=true and the gate passes; a divergence WITHOUT
    // that recorded justification would fail this gate (proving it fires, not structurally-unreachable).
    for (const category of AC1_CATEGORIES) {
      if (!SENSITIVE_CATEGORIES.has(category)) continue;
      const fx = loadLovableFixture(category);
      for (const c of fx.cases ?? []) {
        const rec = c as Record<string, unknown>;
        if (rec.origin !== "documented-delta" && rec.origin !== "old-lovable") continue;
        const classification = classifyDelta(rec);
        if (classification === null) continue; // a synthetic placeholder — no divergence to classify
        assert.ok(isDeltaKind(classification.kind), `${category}/${String(rec.id)}: deltaKind must be a valid AC2 classification`);
        if (classification.kind === "expected-simplification") {
          assert.ok(
            classification.ownerApprovedSimplification,
            `${category}/${String(rec.id)}: a documented divergence in a SENSITIVE area (money/tax/acceptance/` +
              `quote-immutability/job) cannot be labelled 'expected-simplification' without explicit owner approval — ` +
              `label it 'bug'/'unresolved-assumption' and STOP (needs-human) instead of silently simplifying (epics.md 9.3 Stop Conditions).`,
          );
        }
      }
    }
  });

  test("[P0] STOP gate FIRES — a sensitive divergence lacking recorded justification is NOT auto-labelled a simplification (proves the gate is exercised)", () => {
    // Seed a documented-delta in a SENSITIVE area that carries a divergent value but an EMPTY note
    // (no owner-understood justification). The harness classifier must NOT stamp it
    // ownerApprovedSimplification=true — proving the STOP gate is a real branch, not dead code.
    const unjustified = classifyDelta({
      id: "seed-unjustified-sensitive-divergence",
      origin: "documented-delta",
      note: "   ",
      oldLovableValue: "company_excl",
    });
    assert.ok(unjustified, "a documented-delta with a divergent value must be classified");
    assert.equal(
      unjustified!.ownerApprovedSimplification,
      false,
      "a divergence WITHOUT a recorded justification must NOT be owner-approved — the STOP gate would " +
        "reject labelling it 'expected-simplification' (needs-human)",
    );
  });

  test("[P0] deltaKind — every comparison delta carries a valid deltaKind classification + a non-empty explanation (AC2 wording)", () => {
    // The HARNESS attaches a per-delta `deltaKind` (expected-simplification | bug |
    // unresolved-assumption) + a non-empty explanation to EVERY non-`new-expected` delta via
    // `classifyDelta`. Assert it across all fixtures — every real documented divergence is classified.
    let classifiedDeltas = 0;
    for (const category of AC1_CATEGORIES) {
      const fx = loadLovableFixture(category);
      for (const c of fx.cases ?? []) {
        const rec = c as Record<string, unknown>;
        if (rec.origin !== "documented-delta" && rec.origin !== "old-lovable") continue;
        if (rec.capturedFromRealLovable === false) continue; // synthetic placeholder — no divergence
        const classification = classifyDelta(rec);
        assert.ok(classification, `${category}/${String(rec.id)}: the harness must classify this documented divergence`);
        assert.ok(
          isDeltaKind(classification!.kind),
          `${category}/${String(rec.id)}: deltaKind must be a valid AC2 classification (got ${String(classification!.kind)})`,
        );
        assert.ok(
          typeof classification!.explanation === "string" && classification!.explanation.trim().length > 0,
          `${category}/${String(rec.id)}: the classification must carry a non-empty explanation (AC2 wording)`,
        );
        classifiedDeltas += 1;
      }
    }
    assert.ok(
      classifiedDeltas >= 1,
      "the comparison harness must classify at least one documented divergence (the 9.2 fixtures ship several)",
    );
  });
});
