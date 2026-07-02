/**
 * Story 4.2 — COVERAGE-EXPANSION unit tests for the PURE VAT + quote-total primitives in
 * `@/lib/money` (`src/lib/money/vat.ts`). Runs under `node --test` (`pnpm run test:unit`) —
 * pure, NO DB, NO browser, NO network, NO clock read.
 *
 * These tests are ADDITIVE to the ATDD contract scaffolds (`vat.test.ts` +
 * `vat.golden.test.ts`, which are frozen). They deliberately do NOT re-assert the happy-path /
 * policy contract those scaffolds already pin. Instead they close the coverage gaps the
 * scaffolds leave open — the negative paths, boundary conditions, overflow guards, exact
 * return-shape contracts, and the optional-field / re-export behaviour — so a regression in any
 * of those branches fails loud:
 *
 *   - `lineVatOre`  — the `ORE_OVERFLOW` output guard (large net × large rate); `INVALID_VAT_RATE_BP`
 *                     vs `INVALID_ORE_AMOUNT` discrimination; exact code strings.
 *   - `sumVatOre`   — DIRECT contract (empty → 0; non-öre element → `INVALID_ORE_AMOUNT`; running
 *                     total past the ceiling → `ORE_OVERFLOW`; sum-of-rounded is exact, order-free).
 *   - `vatBreakdown`— invalid net/rate propagate as a typed failure with NO partial breakdown; the
 *                     derived-gross `ORE_OVERFLOW` guard fires when net + VAT exceeds the ceiling.
 *   - `selectVatDisplay` — the FULL `VatDisplayView` shape per posture (primaryOre / togglable /
 *                     net / vat / gross); the unknown-posture → conservative private/gross fallback;
 *                     the returned view carries all three öre unchanged.
 *   - `buildVatAssumptionSnapshot` — the OPTIONAL `sourceId` / `sourceUpdatedAt` are copied when
 *                     present and OMITTED when absent; the frozen snapshot has no live ref to the
 *                     display field either; `capturedAt` is verbatim.
 *   - `isVatRateBp` / `VAT_RATE_BP_MIN` / `VAT_RATE_BP_MAX` — the canonical bp-validity authority:
 *                     boundary acceptance/rejection, integer-only, non-number rejection, and that
 *                     the settings validator re-exports the SAME bounds (one authority, no fork).
 *
 * Coverage → test IDs (test-design-epic-4): 4.2-UNIT-01 (sum-of-rounded totals + overflow),
 * 4.2-UNIT-02/04 (display views + presentation-only), 4.2-UNIT-03/05 (frozen snapshot),
 * 4.2-UNIT-06 (zero-rate). Risks: R-403 (VAT rounding order), R-404 (basis-points authority),
 * R-409 (snapshot recompute), R-401 (öre overflow guard).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ORE_AMOUNT_MAX,
  VAT_RATE_BP_MIN,
  VAT_RATE_BP_MAX,
  isVatRateBp,
  lineVatOre,
  sumVatOre,
  vatBreakdown,
  selectVatDisplay,
  buildVatAssumptionSnapshot,
} from "@/lib/money";
import {
  VAT_RATE_BP_MIN as SETTINGS_BP_MIN,
  VAT_RATE_BP_MAX as SETTINGS_BP_MAX,
} from "@/server/commands/settings/validation";

describe("Story 4.2 coverage — lineVatOre negative + overflow branches (R-401/R-404)", () => {
  test("a bad NET is INVALID_ORE_AMOUNT; a bad RATE is INVALID_VAT_RATE_BP (correct discriminant)", () => {
    const badNet = lineVatOre(-1, 2500);
    assert.equal(badNet.ok, false);
    assert.equal(badNet.ok === false && badNet.code, "INVALID_ORE_AMOUNT");

    const badRate = lineVatOre(85000, 10001);
    assert.equal(badRate.ok, false);
    assert.equal(badRate.ok === false && badRate.code, "INVALID_VAT_RATE_BP");
  });

  test("the NET is validated BEFORE the rate — an invalid net with an invalid rate reports the net", () => {
    // Guards the validation ORDER: net check comes first, so a caller sees the net problem.
    const r = lineVatOre(850.5, 99999);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.code, "INVALID_ORE_AMOUNT");
  });

  test("net at the ceiling × 100% rate stays a VALID öre amount (the output overflow guard is defensive)", () => {
    // With bp ≤ 10000 (≤ 100%) and net ≤ ORE_AMOUNT_MAX, VAT = round(net * bp / 10000) ≤ net ≤ max, so
    // the output overflow guard cannot fire from valid inputs alone — it is a defensive belt on the
    // float product. Assert the ceiling case still returns OK and a safe integer in range (float
    // division may lose the last ulp, so pin only that the result is a valid, in-range öre amount).
    const atCeiling = lineVatOre(ORE_AMOUNT_MAX, VAT_RATE_BP_MAX);
    assert.equal(atCeiling.ok, true);
    const v = atCeiling.ok === true ? atCeiling.value : -1;
    assert.ok(Number.isSafeInteger(v) && v >= 0 && v <= ORE_AMOUNT_MAX, "VAT stays a valid öre amount");
  });

  test("VAT never exceeds the net for a rate ≤ 100% (bp ≤ 10000) — monotonic in the rate", () => {
    const net = 100000;
    const low = lineVatOre(net, 600);
    const mid = lineVatOre(net, 1200);
    const high = lineVatOre(net, 2500);
    assert.ok(low.ok && mid.ok && high.ok);
    const l = low.ok && low.value;
    const m = mid.ok && mid.value;
    const h = high.ok && high.value;
    assert.ok(l <= m && m <= h, "VAT rises with the rate");
    assert.ok(h <= net, "VAT at 25% never exceeds the net");
  });
});

describe("Story 4.2 coverage — sumVatOre DIRECT contract (R-403)", () => {
  test("an EMPTY array of line VAT values sums to 0 (a section with no lines has 0 VAT)", () => {
    const r = sumVatOre([]);
    assert.equal(r.ok, true);
    assert.equal(r.ok === true && r.value, 0);
  });

  test("a single-element array returns that element unchanged", () => {
    const r = sumVatOre([21250]);
    assert.equal(r.ok === true && r.value, 21250);
  });

  test("sum is order-independent (associativity of the öre accumulator)", () => {
    const a = sumVatOre([1, 2, 3, 4]);
    const b = sumVatOre([4, 3, 2, 1]);
    assert.ok(a.ok && b.ok);
    assert.equal(a.ok === true && a.value, b.ok === true && b.value);
    assert.equal(a.ok === true && a.value, 10);
  });

  test("a NON-öre element (float / negative / non-integer) is a typed INVALID_ORE_AMOUNT", () => {
    for (const bad of [3.5, -1, Number.NaN]) {
      const r = sumVatOre([100, bad, 200]);
      assert.equal(r.ok, false, `expected failure for element ${String(bad)}`);
      assert.equal(r.ok === false && r.code, "INVALID_ORE_AMOUNT");
    }
  });

  test("a running total past ORE_AMOUNT_MAX is a typed ORE_OVERFLOW (accumulator guard)", () => {
    // Two elements each within range but whose SUM exceeds the ceiling.
    const half = Math.floor(ORE_AMOUNT_MAX / 2) + 1;
    const r = sumVatOre([half, half, half]);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.code, "ORE_OVERFLOW");
  });
});

describe("Story 4.2 coverage — vatBreakdown propagation + gross overflow guard", () => {
  test("an invalid NET yields a typed failure with NO partial breakdown returned", () => {
    const r = vatBreakdown(-5, 2500);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.code, "INVALID_ORE_AMOUNT");
    // Must not carry a `value` breakdown on the failure arm.
    assert.equal((r as { value?: unknown }).value, undefined);
  });

  test("an invalid RATE yields INVALID_VAT_RATE_BP, not a breakdown", () => {
    const r = vatBreakdown(85000, -1);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.code, "INVALID_VAT_RATE_BP");
  });

  test("the DERIVED gross is guarded — net at the ceiling + non-zero VAT overflows → ORE_OVERFLOW", () => {
    // net = ORE_AMOUNT_MAX (valid), VAT @ 2500 bp is > 0, so gross = net + VAT exceeds the ceiling.
    const r = vatBreakdown(ORE_AMOUNT_MAX, 2500);
    assert.equal(r.ok, false, "net + VAT past the ceiling must be a typed overflow");
    assert.equal(r.ok === false && r.code, "ORE_OVERFLOW");
  });

  test("gross exactly equals net + VAT for an in-range case (derivation is not re-rounded)", () => {
    const r = vatBreakdown(12345, 2500);
    assert.ok(r.ok);
    const v = r.ok && r.value;
    assert.ok(v);
    assert.equal(v.grossOre, v.netOre + v.vatOre);
    assert.equal(v.vatOre, 3086); // round(12345 * 2500 / 10000) = round(3086.25) = 3086
    assert.equal(v.grossOre, 15431);
  });
});

describe("Story 4.2 coverage — selectVatDisplay full return-shape per posture (R-403, AC2)", () => {
  const breakdown = { netOre: 85000, vatOre: 21250, grossOre: 106250 };

  test("company_excl → primary = NET, NOT togglable, carries all three öre unchanged", () => {
    const v = selectVatDisplay("company_excl", breakdown);
    assert.equal(v.posture, "company_excl");
    assert.equal(v.primaryOre, breakdown.netOre);
    assert.equal(v.togglable, false);
    assert.equal(v.netOre, breakdown.netOre);
    assert.equal(v.vatOre, breakdown.vatOre);
    assert.equal(v.grossOre, breakdown.grossOre);
  });

  test("company_togglable → primary = GROSS, IS togglable, all three öre present", () => {
    const v = selectVatDisplay("company_togglable", breakdown);
    assert.equal(v.posture, "company_togglable");
    assert.equal(v.primaryOre, breakdown.grossOre);
    assert.equal(v.togglable, true);
    assert.equal(v.netOre, breakdown.netOre);
    assert.equal(v.grossOre, breakdown.grossOre);
  });

  test("private → primary = GROSS (always incl-VAT invariant), NOT togglable", () => {
    const v = selectVatDisplay("private", breakdown);
    assert.equal(v.posture, "private");
    assert.equal(v.primaryOre, breakdown.grossOre);
    assert.equal(v.togglable, false);
  });

  test("an UNKNOWN posture falls back to the conservative private/gross invariant (no leak)", () => {
    // Guards the defensive default: an unexpected posture must not leak a partial/undefined amount.
    const v = selectVatDisplay("something_else" as never, breakdown);
    assert.equal(v.posture, "private");
    assert.equal(v.primaryOre, breakdown.grossOre);
    assert.equal(v.togglable, false);
  });

  test("the selector returns a FRESH object — mutating the returned view does not touch the input", () => {
    const input = { netOre: 50000, vatOre: 3000, grossOre: 53000 };
    const snapshotBefore = { ...input };
    const v = selectVatDisplay("company_togglable", input) as { netOre: number };
    v.netOre = -999; // mutate the returned view
    assert.deepEqual(input, snapshotBefore, "the source breakdown must be untouched");
  });
});

describe("Story 4.2 coverage — buildVatAssumptionSnapshot optional-field + freeze (R-409)", () => {
  const CAPTURED_AT = "2026-07-02T12:34:56.000Z";

  // The builder returns a discriminated union (frozen snapshot | typed failure). These cases feed
  // it valid rates, so narrow to the OK arm (the bare snapshot) before reading captured fields.
  function okSnap(
    result: ReturnType<typeof buildVatAssumptionSnapshot>,
  ): Extract<typeof result, { vatRateBp: number }> {
    assert.ok(!("ok" in result), "expected a frozen snapshot, not a typed failure");
    return result as Extract<typeof result, { vatRateBp: number }>;
  }

  test("with NO source identity, the frozen snapshot OMITS sourceId / sourceUpdatedAt", () => {
    const snap = okSnap(buildVatAssumptionSnapshot(
      { vatRateBp: 1200, defaultVatDisplay: "company_excl" },
      { capturedAt: CAPTURED_AT },
    ));
    assert.equal(snap.vatRateBp, 1200);
    assert.equal(snap.defaultVatDisplay, "company_excl");
    assert.equal(snap.capturedAt, CAPTURED_AT);
    assert.ok(!("sourceId" in snap), "absent sourceId must be omitted, not undefined");
    assert.ok(!("sourceUpdatedAt" in snap), "absent sourceUpdatedAt must be omitted");
    assert.equal(Object.isFrozen(snap), true);
  });

  test("WITH source identity, both sourceId and sourceUpdatedAt are copied by value", () => {
    const snap = okSnap(buildVatAssumptionSnapshot(
      {
        vatRateBp: 2500,
        defaultVatDisplay: "company_togglable",
        sourceId: "settings-row-1",
        sourceUpdatedAt: "2026-06-30T00:00:00.000Z",
      },
      { capturedAt: CAPTURED_AT },
    ));
    assert.equal(snap.sourceId, "settings-row-1");
    assert.equal(snap.sourceUpdatedAt, "2026-06-30T00:00:00.000Z");
    assert.equal(Object.isFrozen(snap), true);
  });

  test("with ONLY sourceId (no updated_at), sourceUpdatedAt stays omitted", () => {
    const snap = okSnap(buildVatAssumptionSnapshot(
      { vatRateBp: 600, defaultVatDisplay: "company_excl", sourceId: "row-x" },
      { capturedAt: CAPTURED_AT },
    ));
    assert.equal(snap.sourceId, "row-x");
    assert.ok(!("sourceUpdatedAt" in snap));
  });

  test("mutating the source DISPLAY field after capture does not change the frozen snapshot", () => {
    const source: { vatRateBp: number; defaultVatDisplay: "company_togglable" | "company_excl" } = {
      vatRateBp: 2500,
      defaultVatDisplay: "company_togglable",
    };
    const snap = okSnap(buildVatAssumptionSnapshot(source, { capturedAt: CAPTURED_AT }));
    source.defaultVatDisplay = "company_excl";
    assert.equal(snap.defaultVatDisplay, "company_togglable", "no live reference to the source");
  });

  test("an INVALID/float/out-of-range source vatRateBp returns a typed INVALID_VAT_RATE_BP failure (not a frozen snapshot)", () => {
    for (const badBp of [2500.5, -1, 10001, Number.NaN]) {
      const result = buildVatAssumptionSnapshot(
        { vatRateBp: badBp, defaultVatDisplay: "company_excl" },
        { capturedAt: CAPTURED_AT },
      );
      assert.ok("ok" in result && result.ok === false, `expected a typed failure for bp=${String(badBp)}`);
      if ("ok" in result) {
        assert.equal(result.code, "INVALID_VAT_RATE_BP");
      }
      // The invalid rate must never be echoed back into a frozen assumption.
      assert.ok(!("vatRateBp" in result), "an invalid rate must not be frozen into a snapshot");
    }
  });
});

describe("Story 4.2 coverage — isVatRateBp canonical authority + settings re-export parity", () => {
  test("the bp bounds are 0 and 10000 (the [0%, 100%] basis-point range)", () => {
    assert.equal(VAT_RATE_BP_MIN, 0);
    assert.equal(VAT_RATE_BP_MAX, 10000);
  });

  test("boundary values 0 and 10000 are ACCEPTED; -1 and 10001 are REJECTED", () => {
    assert.equal(isVatRateBp(0), true);
    assert.equal(isVatRateBp(10000), true);
    assert.equal(isVatRateBp(-1), false);
    assert.equal(isVatRateBp(10001), false);
  });

  test("the pilot Swedish rates (600 / 1200 / 2500 bp) are all valid", () => {
    for (const bp of [600, 1200, 2500]) assert.equal(isVatRateBp(bp), true);
  });

  test("a FLOAT bp is rejected — basis points are integers, never fractional", () => {
    for (const bp of [25.5, 2500.1, 0.5]) assert.equal(isVatRateBp(bp), false);
  });

  test("non-numbers (string / null / undefined / NaN / Infinity) are all rejected", () => {
    for (const v of ["2500", null, undefined, Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      assert.equal(isVatRateBp(v), false, `expected rejection for ${String(v)}`);
    }
  });

  test("the settings validator re-exports the SAME bp bounds (ONE authority, no fork)", () => {
    assert.equal(SETTINGS_BP_MIN, VAT_RATE_BP_MIN);
    assert.equal(SETTINGS_BP_MAX, VAT_RATE_BP_MAX);
  });
});
