/**
 * Story 7.1 — 7.1-UNIT-01 (P0, AC2) + 7.1-UNIT-02 (P2, AC2 boundaries): the PURE adjusted-price
 * delta + reason-required decision module, pinned against the CANONICAL @/lib/money öre engine
 * (R-705). This is the fast-gate half of the adjusted-price gate the `captureQuoteAcceptance`
 * command re-validates server-side (7.1-INT-03) — a UI mirror is NOT the guarantee.
 *
 * ── THE RULE (server truth; the UI mirrors it) ────────────────────────────────────────────────
 * Given an accepted price (öre) and the version's frozen source sent total (öre):
 *   - `deltaOre = acceptedPriceOre − sourceSentTotalOre`, computed with INTEGER öre arithmetic /
 *     the canonical engine (NEVER re-derived ad hoc — the coverage-shape lesson: this decision
 *     lives in a sibling `.ts`, NOT inside a `"use client"` component, so `node --test` can gate it).
 *   - `reasonRequired = deltaOre !== 0` — any non-zero delta (over OR under the sent total) REQUIRES
 *     an explicit `adjustment_reason` (or evidence). A zero delta requires none.
 *   - The accepted price is validated with the canonical `isOreAmount` / `ORE_AMOUNT_MAX` (one
 *     authority, no fork) — a float / negative / NaN / overflow öre is a typed rejection, never a
 *     silently-wrong delta.
 *
 * PURE, in-memory, NO DB, NO PII, NO clock — runs under `node --test` (the fast gate). Öre values
 * kept < 10 digits in every case (the orgnr-scan boundary, R-717).
 *
 * ── GREEN PHASE (Story 7.1) ───────────────────────────────────────────────────────────────────
 * `src/features/quotes/acceptance-price.ts` + `computeAcceptanceDelta` are landed. The scaffold's
 * `{ skip }` markers are cleared and the module is imported directly.
 *
 * [Source: test-design-epic-7.md#7.1-UNIT-01/02, R-705/R-717; story 7.1 Task 3 + AC2;
 *  src/lib/money/ore.ts (isOreAmount / ORE_AMOUNT_MAX / sumOre — the canonical öre engine to reuse);
 *  src/features/quotes/send-gate.ts (the sibling-`.ts` pure-decision precedent for the fast gate)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORE_AMOUNT_MAX, isOreAmount } from "@/lib/money/ore";
import { computeAcceptanceDelta } from "@/features/quotes/acceptance-price";

// ── 7.1-UNIT-01 (P0) — the delta + reason-required decision ───────────────────────────────────

test(
  "7.1-UNIT-01: equal accepted price and sent total ⇒ delta 0, no reason required",
  () => {
    const res = computeAcceptanceDelta(125_000, 125_000);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.deltaOre, 0);
      assert.equal(res.reasonRequired, false);
    }
  },
);

test(
  "7.1-UNIT-01: accepted price ABOVE sent total ⇒ positive delta, reason required",
  () => {
    const res = computeAcceptanceDelta(130_000, 125_000);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.deltaOre, 5_000);
      assert.equal(res.reasonRequired, true);
    }
  },
);

test(
  "7.1-UNIT-01: accepted price BELOW sent total ⇒ negative delta, reason required",
  () => {
    const res = computeAcceptanceDelta(120_000, 125_000);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.deltaOre, -5_000);
      assert.equal(res.reasonRequired, true);
    }
  },
);

test(
  "7.1-UNIT-01: the delta is computed with the CANONICAL öre engine (isOreAmount guards inputs)",
  () => {
    // Guard against a re-derived ad-hoc delta: a valid input pair is öre-valid, and the module must
    // reject a non-öre accepted price rather than compute on it.
    assert.equal(isOreAmount(125_000), true);
    const bad = computeAcceptanceDelta(125_000.5, 125_000);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, "INVALID_ORE_AMOUNT");
  },
);

// ── 7.1-UNIT-02 (P2) — boundaries: zero, negative-input, over-sent-total, öre overflow ────────

test(
  "7.1-UNIT-02: a zero accepted price is a valid öre value ⇒ delta = −sent total, reason required",
  () => {
    const res = computeAcceptanceDelta(0, 125_000);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.deltaOre, -125_000);
      assert.equal(res.reasonRequired, true);
    }
  },
);

test(
  "7.1-UNIT-02: a NEGATIVE accepted price öre is rejected by the canonical guard (never a delta)",
  () => {
    const res = computeAcceptanceDelta(-1, 125_000);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "INVALID_ORE_AMOUNT");
  },
);

test(
  "7.1-UNIT-02: an accepted price at ORE_AMOUNT_MAX is accepted; beyond it is guarded",
  () => {
    // At the ceiling with a zero sent total the delta is exactly ORE_AMOUNT_MAX (still öre-valid).
    // NOTE: for a COMMITTED fixture keep öre < 10 digits (R-717); this in-memory boundary case is
    // NOT written to any golden file, so the ceiling constant is allowed here.
    const atMax = computeAcceptanceDelta(ORE_AMOUNT_MAX, 0);
    assert.equal(atMax.ok, true);
    const overMax = computeAcceptanceDelta(ORE_AMOUNT_MAX + 1, 0);
    assert.equal(overMax.ok, false);
  },
);
