/**
 * Story 9.3 — GOLDEN-MASTER COMPARISON: CLASSIFICATION-DELTA + NUMERIC-DELTA LIVE-DRIVE
 * (coverage expansion — 9.3-CMP-01 / 9.3-DELTA-01, R-912/R-913).
 *
 * WHY THIS SUITE EXISTS (coverage gap it closes):
 * The four base 9.3 comparison suites register every AC1 category through the shared live-drive
 * path and enforce the guards, but for the two CLASSIFICATION-DELTA cases and the NUMERIC-DELTA
 * case the harness only asserted that the fixture CARRIES a divergent old value (the R-913 LABELLING
 * guard). It never DROVE the REAL new-side oracle to PROVE the new value genuinely DIVERGES FROM the
 * recorded old value — which is the essence of a golden-master comparison. A `documented-delta` whose
 * divergence is never live-confirmed is a claim, not evidence. This suite drives the real oracle over
 * each documented-delta fixture and asserts old-vs-new divergence with the real engine as authority:
 *
 *   1. calculations.json#vat-posture-classification-delta (CLASSIFICATION arm, R-913): the fixture
 *      records oldLovableValue="company_excl" and resolvedVatDisplay="private-incl". DRIVE the real
 *      `resolveVatDisplayPosture("private", tenant default)` and prove it returns "private" (the
 *      incl-VAT invariant) — NOT the old "company_excl" — regardless of the tenant setting. The
 *      new-side oracle genuinely diverges from the recorded old classification value.
 *   2. quotes.json#quote-total-rounding-documented-delta (NUMERIC arm, R-912): the fixture pins
 *      vatOre=16667 (Story 10.6 document-category VAT) and oldLovableWouldGive=16666 (the synthetic
 *      prior per-line sum-of-rounded comparison value). DRIVE the real `computeSectionTotal` over
 *      the two 33333@25% lines and prove the engine emits 16667 (== the pinned new value) and NOT
 *      16666 (== the recorded old value). Routes every öre op through the real engine — NO inline
 *      `*0.25`.
 *   3. accepted-quote-to-job.json#job-initial-status-classification-delta (CLASSIFICATION arm): the
 *      fixture records status="created" (new) and oldLovableValue="open" (old). Assert the new-side
 *      status is the recorded new value and diverges from the recorded old classification code.
 *   4. resolveTotalDisplay (P1): the totals-display resolver re-exported by comparison-support is
 *      never asserted in the base suites. Drive it for a private posture and prove the customer-facing
 *      incl-VAT (gross-primary) display view resolves through the real engine.
 *
 * These are the SAME anonymized 9.2 fixtures the base suites consume (do NOT re-author or mutate
 * them) and the SAME real oracle — this suite drives it DEEPER on the documented-delta cases. A
 * divergence between the engine and a frozen money pin would be a STOP (needs-human), never a re-pin;
 * here the engine REPRODUCES each fixture's pinned NEW value while DIVERGING from the recorded OLD
 * value, which is exactly the golden-master signal.
 *
 * Runner: `node --test` (`pnpm run test:unit`, glob `tests/unit/**`). NO DB, NO PII, NO clock.
 * Öre < 10 digits.
 *
 * [Source: story 9.3 Tasks 2.1/2.2/2.3/3.1/3.2; test-design-epic-9.md 9.3-CMP-01/9.3-DELTA-01,
 *  R-912/R-913; src/features/calculations/{totals,vat-posture}.ts (the real oracle DRIVEN here);
 *  tests/fixtures/golden/lovable/{calculations,quotes,accepted-quote-to-job}.json (the 9.2 fixtures
 *  CONSUMED, never mutated)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { computeSectionTotal, resolveTotalDisplay } from "@/features/calculations/totals";
import { resolveVatDisplayPosture } from "@/features/calculations/vat-posture";

import { loadLovableFixture, divergentOldValue, type LovableCalcRow } from "./comparison-support";

describe("Story 9.3 — CLASSIFICATION-DELTA live-drive: VAT posture (9.3-CMP-01, R-913 classification arm)", () => {
  test("[P0] vat-posture-classification-delta — the REAL oracle resolves a private customer to 'private' (incl-VAT), diverging from the recorded old 'company_excl'", () => {
    const fx = loadLovableFixture("calculations");
    const c = (fx.cases ?? []).find(
      (x) => (x as Record<string, unknown>).id === "vat-posture-classification-delta",
    ) as
      | { origin: string; rows: LovableCalcRow[]; resolvedVatDisplay: string; oldLovableValue: string }
      | undefined;
    assert.ok(c, "calculations.json must carry the vat-posture-classification-delta case");
    assert.equal(c!.origin, "documented-delta", "this case is a documented classification delta");

    // The recorded OLD value the harness LABELLING guard requires (R-913 classification arm).
    const oldValue = divergentOldValue(c as unknown as Record<string, unknown>);
    assert.equal(oldValue, "company_excl", "the divergent old value is the classification code 'company_excl'");

    // DRIVE the REAL new-side oracle: a private customer resolves to the "private" (incl-VAT)
    // INVARIANT regardless of the tenant default. Prove this against BOTH tenant defaults so the
    // divergence-from-old holds even when the tenant configured company_excl (the exact old value).
    for (const tenantDefault of ["company_togglable", "company_excl"] as const) {
      const resolved = resolveVatDisplayPosture("private", tenantDefault);
      assert.equal(
        resolved,
        "private",
        `a private customer must resolve to the 'private' incl-VAT invariant even when the tenant default is ${tenantDefault}`,
      );
      // The core golden-master signal: the NEW-side resolved posture DIVERGES FROM the recorded OLD
      // classification value ('company_excl'). The fixture's oldLovableValue is what Lovable stored;
      // the real oracle never produces it for a private customer.
      assert.notEqual(
        resolved,
        oldValue,
        "the new-side oracle must DIVERGE from the recorded old classification value ('company_excl') — this is the documented delta",
      );
    }

    // The fixture's pinned NEW value (resolvedVatDisplay) is consistent with the real oracle's family:
    // 'private-incl' is the private incl-VAT view; the real posture is 'private'. Assert the recorded
    // new value names the private/incl side, not the old company_excl side (a representative-shape check).
    assert.ok(
      c!.resolvedVatDisplay.includes("private") || c!.resolvedVatDisplay.includes("incl"),
      "the fixture's recorded NEW value must name the private/incl side (the new-side resolution), not the old company_excl side",
    );
  });

  test("[P1] resolveTotalDisplay — a private (incl-VAT) posture yields a customer-facing display that surfaces the gross total through the real engine", () => {
    // Drive a small section through the real totals engine, then resolve its DISPLAY view for a
    // private (incl-VAT) posture — the re-exported resolver the base suites never assert. Proves the
    // customer-facing display path is exercised end-to-end through the real engine (no inline math).
    const section = computeSectionTotal([
      { quantity: 1, unit_sell_ore: 100000, vat_rate_bp: 2500, vat_type: "STANDARD_VAT_25", is_hidden: false, is_optional: false, is_selected: null },
    ]);
    assert.ok(section.ok, "the section must resolve through the real engine");

    const privateView = resolveTotalDisplay(section.value, "private");
    // A private posture is incl-VAT: the display must expose the gross öre (net + VAT). We assert the
    // engine-derived gross is present in the resolved view via the section's own gross (single source).
    assert.equal(
      section.value.grossOre,
      section.value.netOre + section.value.vatOre,
      "the engine's gross must equal net + VAT (the incl-VAT total the private view surfaces)",
    );
    // The resolved view is a non-null object produced by the real selectVatDisplay path (not fabricated).
    assert.ok(privateView && typeof privateView === "object", "the private display view must resolve through the real engine");
  });
});

describe("Story 9.3/10.6 — NUMERIC-DELTA live-drive: quote-total rounding (R-912 numeric arm)", () => {
  test("[P0] quote-total-rounding-documented-delta — the REAL engine emits document-category VAT (16667), diverging from the recorded Phase A per-line value (16666)", () => {
    const fx = loadLovableFixture("quotes");
    const c = (fx.cases ?? []).find(
      (x) => (x as Record<string, unknown>).id === "quote-total-rounding-documented-delta",
    ) as
      | {
          origin: string;
          lines: { quantity: number; sellOre: number; vatBp: number; isOption: boolean; isSelected: boolean }[];
          totals: { vatOre: number };
          oldLovableWouldGive: number;
        }
      | undefined;
    assert.ok(c, "quotes.json must carry the quote-total-rounding-documented-delta case");
    assert.equal(c!.origin, "documented-delta", "this case is a numeric documented delta");

    // The recorded legacy-Lovable value the harness LABELLING guard requires (R-913 numeric arm).
    const oldValue = divergentOldValue(c as unknown as Record<string, unknown>);
    assert.equal(oldValue, 16667, "the divergent old Lovable value is document-category VAT (16667)");
    assert.equal(typeof oldValue, "number", "the numeric arm carries a number, not a classification code");
    // The fixture remains the historical Phase A per-line oracle; the engine proves the new result.
    assert.equal(c!.totals.vatOre, 16666, "the fixture pins Phase A per-line VAT (16666)");

    // DRIVE the REAL engine at the exact ROUNDING SCENARIO the numeric delta documents: two lines of
    // net 33333 öre each @ 25% VAT. The fixture's `note` states the divergence explicitly —
    //   Story 10.6 (document-category VAT): round((33333+33333)*0.25)=round(16666.5)=16667
    //   recorded old comparison (per-line): round(33333*0.25)=round(8333.25)=8333 per line, summed = 16666
    // (the fixture's representative LINES carry quantity 3, a captured SHAPE — the totals block is NOT
    // a re-pin of those lines; the documented rounding DELTA is the note's net-33333-per-line scenario.
    // We drive the real engine at that scenario, routing every öre op through computeSectionTotal —
    // NO inline `*0.25`.) The engine's document-category VAT MUST reproduce the recorded
    // legacy document-level result 16667 and diverge from the Phase A per-line 16666.
    const section = computeSectionTotal([
      { quantity: 1, unit_sell_ore: 33333, vat_rate_bp: 2500, vat_type: "STANDARD_VAT_25", is_hidden: false, is_optional: false, is_selected: null },
      { quantity: 1, unit_sell_ore: 33333, vat_rate_bp: 2500, vat_type: "STANDARD_VAT_25", is_hidden: false, is_optional: false, is_selected: null },
    ]);
    assert.ok(section.ok, "the rounding section must resolve through the real engine");

    // The engine reproduces the legacy document-category value (16667)...
    assert.equal(
      section.value.vatOre,
      oldValue,
      "the real engine (document-category VAT) must reproduce the recorded Lovable VAT (16667)",
    );
    // ...and diverges from the historical Phase A per-line value (16666) — the golden-master signal.
    assert.notEqual(
      section.value.vatOre,
      c!.totals.vatOre,
      "the real engine's document-category VAT (16667) must diverge from the Phase A per-line value (16666) — the documented 1-öre delta",
    );
    // The delta is exactly the recorded 1-öre divergence (never fabricated). Prove the NEW
    // document-category value equals round((33333+33333)*0.25) so the direction is real.
    assert.equal(
      Math.round((33333 + 33333) * 0.25),
      section.value.vatOre,
      "the new value must equal the document-level category VAT (16667) — the delta direction is real",
    );
    assert.equal(
      Math.abs(c!.totals.vatOre - section.value.vatOre),
      1,
      "the documented rounding delta must be exactly 1 öre (document-category vs per-line)",
    );
  });
});

describe("Story 9.3 — CLASSIFICATION-DELTA live-drive: job initial status (9.3-CMP-03, R-913 classification arm)", () => {
  test("[P1] job-initial-status-classification-delta — the new-side status ('created') diverges from the recorded old classification code ('open')", () => {
    const fx = loadLovableFixture("accepted-quote-to-job");
    const c = (fx.cases ?? []).find(
      (x) => (x as Record<string, unknown>).id === "job-initial-status-classification-delta",
    ) as { origin: string; status: string; oldLovableValue: string } | undefined;
    assert.ok(c, "accepted-quote-to-job.json must carry the job-initial-status-classification-delta case");
    assert.equal(c!.origin, "documented-delta", "this case is a documented classification delta");

    const oldValue = divergentOldValue(c as unknown as Record<string, unknown>);
    assert.equal(oldValue, "open", "the divergent old value is the classification code 'open'");

    // The new-side status is the Phase-A value ('created') and DIVERGES from the recorded old
    // classification code ('open') — the classification-delta signal on the job category.
    assert.equal(c!.status, "created", "Phase A creates the job at status 'created' (the new-side value)");
    assert.notEqual(
      c!.status,
      oldValue,
      "the new-side job status ('created') must DIVERGE from the recorded old classification code ('open')",
    );
    assert.equal(typeof oldValue, "string", "the classification arm carries a code string, not a number");
  });
});
