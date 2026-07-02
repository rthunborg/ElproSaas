/**
 * Story 4.3 — COVERAGE-EXPANSION unit tests for the ROT / grön-teknik ESTIMATE ENGINE
 * (`@/lib/money` — `estimateDeduction`, `buildTaxAssumptionSnapshot`, the named UNAPPROVED
 * profiles). These EXTEND the primary `tax.test.ts` (4.3-UNIT-01..07) + `tax.golden.test.ts`
 * (4.3-GOLDEN-01/02) with the negative / boundary / defensive branches those two suites do
 * NOT already exercise — the goal is to drive every reachable branch of `src/lib/money/tax.ts`
 * to a pinned, asserted outcome so a future refactor cannot silently change a guard.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO browser, NO network, NO clock.
 * Imports the tax surface via the `@/lib/money` barrel (Story 4.1 alias-hook resolves the bare
 * directory import). NO PII, NO fixture change, NO new dependency.
 *
 * Gaps closed here (each maps to a `tax.ts` branch the primary suites leave un-asserted):
 *   - INVALID_QUANTITY: a malformed `persons` count is a typed failure (float-NaN/∞/negative/
 *     string/null), while a fractional finite `persons` is ACCEPTED (isQuantity contract);
 *   - ORE_OVERFLOW / INVALID_ORE_AMOUNT propagated from a multi-line eligible-basis array
 *     (sumOre element-validation + accumulator overflow), and an empty basis array → 0;
 *   - the DEDUCTION_CLAMPED_TO_CAP warning CODE (not just a /cap|clamp/ message) on above-cap;
 *   - the UNAPPROVED_PROFILE warning CODE is ALWAYS the first warning (R-405 structural default);
 *   - buildTaxAssumptionSnapshot STANDALONE: label→profileId fallback, persons OMITTED (not
 *     `undefined`) when absent, warnings DEEP-frozen + copied-by-value (source-array mutation
 *     after capture cannot reach the snapshot), captures STATE (no arithmetic, no isApproved);
 *   - the estimate's EMBEDDED assumptionSnapshot is frozen, echoes basis/persons/capturedAt;
 *   - the exported ROT_/GRON_ profiles are Object.frozen DATA marked approved:false with the
 *     pinned bp/cap (the live exports, not just the fixture copies);
 *   - the mix-block is SYMMETRIC (gron_teknik primary + co-present rot sub-request also blocks)
 *     and a single-type `deductionTypes:["rot"]` is NOT a mix; a missing/undefined deductionType
 *     is UNKNOWN_DEDUCTION_TYPE (not just an out-of-set string).
 *
 * Risks reinforced: R-405 (unapproved-tax-as-fact), R-406 (ROT×grön mix), R-407 (caps),
 * R-408 (hidden-row/tillval basis), R-409 (snapshot recompute), R-412 (no PII).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  estimateDeduction,
  buildTaxAssumptionSnapshot,
  ROT_PROFILE_UNAPPROVED,
  GRON_TEKNIK_PROFILE_UNAPPROVED,
  ORE_AMOUNT_MAX,
  type DeductionInput,
  type DeductionResult,
  type DeductionEstimate,
  type TaxAssumptionSource,
  type TaxAssumptionResult,
  type TaxAssumptionSnapshot,
} from "@/lib/money";

const CAPTURED_AT = "2026-07-02T00:00:00.000Z";

function assertOk(r: DeductionResult): DeductionEstimate {
  assert.ok(r.ok === true, `expected ok estimate, got ${JSON.stringify(r)}`);
  return r;
}
function warningCodes(r: DeductionEstimate): string[] {
  return r.warnings.map((w) => w.code);
}
/** A base valid private ROT estimate input, spreadable with overrides. */
function baseInput(overrides: Partial<DeductionInput> = {}): DeductionInput {
  return {
    deductionType: "rot",
    eligibleBasisOre: 100_000,
    posture: "private",
    persons: 1,
    capturedAt: CAPTURED_AT,
    ...overrides,
  };
}

describe("Story 4.3 — estimateDeduction persons/count validation (INVALID_QUANTITY branch)", () => {
  test("a malformed persons count is a typed INVALID_QUANTITY failure (no throw, no raw echo)", () => {
    for (const badPersons of [-1, Number.NaN, Number.POSITIVE_INFINITY, "1", null, {}]) {
      const r = estimateDeduction(
        baseInput({ persons: badPersons as unknown as number }),
      );
      assert.ok(r.ok === false, `expected failure for persons=${String(badPersons)}`);
      assert.equal(r.code, "INVALID_QUANTITY", `persons=${String(badPersons)} → INVALID_QUANTITY`);
      assert.ok(!/NaN|Infinity/.test(JSON.stringify(r)), "must not leak NaN/Infinity");
    }
  });

  test("a fractional-but-finite persons count is ACCEPTED (isQuantity allows a decimal quantity)", () => {
    const r = estimateDeduction(baseInput({ persons: 1.5 }));
    const ok = assertOk(r);
    // persons does not scale the flat placeholder cap, but a valid decimal count must not be rejected
    // and must be captured verbatim into the assumption snapshot.
    assert.equal(ok.assumptionSnapshot.persons, 1.5, "fractional persons captured verbatim");
  });

  test("persons omitted entirely is valid (the per-person count is optional)", () => {
    const r = estimateDeduction(baseInput({ persons: undefined }));
    const ok = assertOk(r);
    assert.equal(ok.deductionOre, 30_000, "no persons → estimate still computes");
    assert.equal(
      Object.prototype.hasOwnProperty.call(ok.assumptionSnapshot, "persons"),
      false,
      "absent persons is OMITTED from the snapshot, never carried as undefined",
    );
  });
});

describe("Story 4.3 — multi-line eligible-basis array validation (sumOre propagation)", () => {
  test("an empty basis array sums to 0 → deduction 0 (valid, not a rejection)", () => {
    const r = estimateDeduction(baseInput({ eligibleBasisOre: [] }));
    const ok = assertOk(r);
    assert.equal(ok.eligibleBasisOre, 0, "empty basis array → 0");
    assert.equal(ok.deductionOre, 0, "zero basis → deduction 0");
  });

  test("an invalid line in the basis array is a typed INVALID_ORE_AMOUNT failure (per-element validated)", () => {
    for (const badLine of [850.5, -1, Number.POSITIVE_INFINITY]) {
      const r = estimateDeduction(
        baseInput({ eligibleBasisOre: [60_000, badLine as number] }),
      );
      assert.ok(r.ok === false, `expected failure for basis line ${String(badLine)}`);
      assert.equal(r.code, "INVALID_ORE_AMOUNT", `line ${String(badLine)} → INVALID_ORE_AMOUNT`);
    }
  });

  test("a basis-array sum past the öre ceiling is a typed ORE_OVERFLOW failure, not a silent unsafe integer", () => {
    // Two lines each valid on their own but summing past ORE_AMOUNT_MAX.
    const half = Math.floor(ORE_AMOUNT_MAX / 2) + 2;
    const r = estimateDeduction(baseInput({ eligibleBasisOre: [half, half] }));
    assert.ok(r.ok === false, "an overflowing basis sum must be a typed failure");
    assert.equal(r.code, "ORE_OVERFLOW", "overflow → ORE_OVERFLOW, never a wrapped/unsafe integer");
  });
});

describe("Story 4.3 — warning codes are stable + ordered (R-405, R-407)", () => {
  test("UNAPPROVED_PROFILE is ALWAYS present and is the FIRST warning (structural default, R-405)", () => {
    const ok = assertOk(estimateDeduction(baseInput()));
    assert.equal(ok.warnings[0]?.code, "UNAPPROVED_PROFILE", "the unapproved marker leads the warnings");
    assert.ok(ok.requiresSignOff === true, "requiresSignOff is the default");
  });

  test("above-cap carries the DEDUCTION_CLAMPED_TO_CAP warning CODE (not merely a cap-ish message)", () => {
    const ok = assertOk(estimateDeduction(baseInput({ eligibleBasisOre: 30_000_000 })));
    assert.equal(ok.deductionOre, ROT_PROFILE_UNAPPROVED.capOre, "above-cap clamps to the cap");
    assert.ok(
      warningCodes(ok).includes("DEDUCTION_CLAMPED_TO_CAP"),
      "the clamp is surfaced with the stable DEDUCTION_CLAMPED_TO_CAP code",
    );
  });

  test("exactly-at-cap does NOT emit a clamp warning (only above-cap clamps)", () => {
    // 16 666 667 öre @ 3000 bp = round(5 000 000.1) = 5 000 000 = the cap exactly.
    const ok = assertOk(estimateDeduction(baseInput({ eligibleBasisOre: 16_666_667 })));
    assert.equal(ok.deductionOre, ROT_PROFILE_UNAPPROVED.capOre, "at-cap deduction equals the cap");
    assert.ok(
      !warningCodes(ok).includes("DEDUCTION_CLAMPED_TO_CAP"),
      "at-cap (equal, not exceeding) emits no clamp warning",
    );
  });

  test("a non-private posture carries POSTURE_NOT_ELIGIBLE (code), alongside the unapproved marker", () => {
    const ok = assertOk(estimateDeduction(baseInput({ posture: "brf" })));
    const codes = warningCodes(ok);
    assert.ok(codes.includes("UNAPPROVED_PROFILE"), "still unapproved");
    assert.ok(codes.includes("POSTURE_NOT_ELIGIBLE"), "non-private surfaces POSTURE_NOT_ELIGIBLE");
  });
});

describe("Story 4.3 — the exported profiles are frozen UNAPPROVED DATA (the live exports)", () => {
  test("ROT_PROFILE_UNAPPROVED is Object.frozen, approved:false, 3000 bp / 5 000 000 öre cap", () => {
    assert.ok(Object.isFrozen(ROT_PROFILE_UNAPPROVED), "ROT profile is frozen");
    assert.equal(ROT_PROFILE_UNAPPROVED.approved, false, "ROT profile is marked approved:false");
    assert.equal(ROT_PROFILE_UNAPPROVED.deductionPercentBp, 3000, "ROT rate is basis points");
    assert.equal(ROT_PROFILE_UNAPPROVED.capOre, 5_000_000, "ROT per-person cap in öre");
    assert.equal(ROT_PROFILE_UNAPPROVED.signOffStatus, "pending-owner-accounting-legal");
  });

  test("GRON_TEKNIK_PROFILE_UNAPPROVED is Object.frozen, approved:false, 2000 bp / 5 000 000 öre cap", () => {
    assert.ok(Object.isFrozen(GRON_TEKNIK_PROFILE_UNAPPROVED), "grön profile is frozen");
    assert.equal(GRON_TEKNIK_PROFILE_UNAPPROVED.approved, false, "grön profile is marked approved:false");
    assert.equal(GRON_TEKNIK_PROFILE_UNAPPROVED.deductionPercentBp, 2000, "grön rate is basis points");
    assert.equal(GRON_TEKNIK_PROFILE_UNAPPROVED.capOre, 5_000_000, "grön per-category cap in öre");
  });
});

describe("Story 4.3 — the embedded assumptionSnapshot on an ok estimate (R-409)", () => {
  test("the estimate's assumptionSnapshot is frozen and echoes basis/persons/capturedAt verbatim", () => {
    const ok = assertOk(estimateDeduction(baseInput({ eligibleBasisOre: 100_000, persons: 2 })));
    const snap = ok.assumptionSnapshot;
    assert.ok(Object.isFrozen(snap), "the embedded snapshot is Object.freeze'd");
    assert.equal(snap.eligibleBasisOre, 100_000, "snapshot carries the eligible basis verbatim");
    assert.equal(snap.persons, 2, "snapshot carries the persons/count");
    assert.equal(snap.capturedAt, CAPTURED_AT, "snapshot carries the injected capturedAt (no clock read)");
    assert.equal(snap.deductionPercentBp, 3000, "snapshot carries the rate as basis points (no arithmetic)");
    assert.equal(snap.requiresSignOff, true, "the snapshot structurally requires sign-off");
    assert.equal(snap.approved, false, "the snapshot never derives approved:true");
  });

  test("the snapshot's warnings mirror the estimate's warnings (copied by value)", () => {
    const ok = assertOk(estimateDeduction(baseInput({ posture: "company" })));
    const snapCodes = ok.assumptionSnapshot.warnings.map((w) => w.code).sort();
    const estCodes = warningCodes(ok).sort();
    assert.deepEqual(snapCodes, estCodes, "the snapshot captures the same warnings as the estimate");
  });
});

describe("Story 4.3 — buildTaxAssumptionSnapshot standalone (freeze / copy-by-value / no clock)", () => {
  function makeSource(overrides: Partial<TaxAssumptionSource> = {}): TaxAssumptionSource {
    return {
      deductionType: "rot",
      deductionPercentBp: 3000,
      capOre: 5_000_000,
      profileId: "ROT_PROFILE_UNAPPROVED",
      eligibleBasisOre: 100_000,
      ...overrides,
    };
  }

  // The builder returns a discriminated union (frozen snapshot | typed failure). These cases feed
  // it a valid capturedAt, so narrow to the OK arm (the bare snapshot) before reading captured fields.
  function okSnap(result: TaxAssumptionResult): TaxAssumptionSnapshot {
    assert.ok(!("ok" in result), "expected a frozen snapshot, not a typed failure");
    return result as TaxAssumptionSnapshot;
  }

  test("label falls back to profileId when the source omits a label", () => {
    const snap = okSnap(buildTaxAssumptionSnapshot(makeSource(), { capturedAt: CAPTURED_AT }));
    assert.equal(snap.label, "ROT_PROFILE_UNAPPROVED", "absent label defaults to the profileId");
  });

  test("an explicit label is preserved verbatim", () => {
    const snap = okSnap(buildTaxAssumptionSnapshot(
      makeSource({ label: "ROT (pilot)" }),
      { capturedAt: CAPTURED_AT },
    ));
    assert.equal(snap.label, "ROT (pilot)", "an explicit label is carried through");
  });

  test("persons is OMITTED (not carried as undefined) when the source has no persons", () => {
    const snap = okSnap(buildTaxAssumptionSnapshot(makeSource(), { capturedAt: CAPTURED_AT }));
    assert.equal(
      Object.prototype.hasOwnProperty.call(snap, "persons"),
      false,
      "absent persons is omitted, never a literal undefined field",
    );
  });

  test("warnings are DEEP-frozen and copied by value — mutating the source array after capture cannot reach the snapshot", () => {
    const sourceWarnings = [{ code: "UNAPPROVED_PROFILE" as const, message: "m" }];
    const snap = okSnap(buildTaxAssumptionSnapshot(
      makeSource({ warnings: sourceWarnings }),
      { capturedAt: CAPTURED_AT },
    ));
    assert.ok(Object.isFrozen(snap.warnings), "the warnings array is frozen");
    assert.ok(Object.isFrozen(snap.warnings[0]), "each warning entry is frozen");
    // Mutate the SOURCE array after capture — the snapshot must not see it.
    sourceWarnings.push({ code: "POSTURE_NOT_ELIGIBLE" as unknown as "UNAPPROVED_PROFILE", message: "late" });
    assert.equal(snap.warnings.length, 1, "the frozen snapshot holds no live reference to the source array");
  });

  test("mutating a source rate/cap after capture does NOT change a prior snapshot (R-409)", () => {
    const source = makeSource();
    const snap = okSnap(buildTaxAssumptionSnapshot(source, { capturedAt: CAPTURED_AT }));
    (source as { deductionPercentBp: number }).deductionPercentBp = 9999;
    (source as { capOre: number }).capOre = 1;
    assert.equal(snap.deductionPercentBp, 3000, "the prior snapshot's rate is unchanged");
    assert.equal(snap.capOre, 5_000_000, "the prior snapshot's cap is unchanged");
  });

  test("the builder captures STATE only — no arithmetic on the öre/bp, no derived isApproved", () => {
    const snap = okSnap(buildTaxAssumptionSnapshot(
      makeSource({ eligibleBasisOre: 12_345 }),
      { capturedAt: CAPTURED_AT },
    ));
    assert.equal(snap.eligibleBasisOre, 12_345, "basis copied verbatim (no arithmetic)");
    assert.equal(snap.capOre, 5_000_000, "cap copied verbatim");
    const serialized = JSON.stringify(snap);
    assert.ok(!/"isApproved"/.test(serialized), "no isApproved flag is derived");
    assert.ok(!/"approved"\s*:\s*true/.test(serialized), "never approved:true");
    assert.equal(snap.requiresSignOff, true, "requiresSignOff:true is the structural default");
  });

  test("a malformed capturedAt (empty string / non-string) is a typed INVALID_CAPTURED_AT failure", () => {
    for (const badAt of ["", undefined, null, 0, 12345, {}]) {
      const result = buildTaxAssumptionSnapshot(makeSource(), {
        capturedAt: badAt as unknown as string,
      });
      assert.ok("ok" in result && result.ok === false, `expected a typed failure for capturedAt=${String(badAt)}`);
      if ("ok" in result) {
        assert.equal(result.code, "INVALID_CAPTURED_AT");
      }
    }
  });
});

describe("Story 4.3 — mix-block symmetry + unknown-type edges (R-406, 4.3-UNIT-07)", () => {
  test("the mix block is SYMMETRIC — gron_teknik primary + a co-present rot sub-request is also BLOCKED", () => {
    const r = estimateDeduction({
      deductionType: "gron_teknik",
      rot: { eligibleBasisOre: 50_000 },
      eligibleBasisOre: 200_000,
      posture: "private",
      capturedAt: CAPTURED_AT,
    } as DeductionInput);
    assert.ok(r.ok === false, "gron_teknik + co-present rot must block");
    assert.equal(r.code, "ROT_GRON_MIX_NOT_ALLOWED", "the symmetric mix is the same blocking code");
  });

  test("a single-type deductionTypes array (only rot) is NOT a mix — it resolves normally", () => {
    // The mix guard only fires when BOTH rot AND gron_teknik are present; a single-element list is
    // not a mix. With a primary deductionType present, the estimate computes normally.
    const r = estimateDeduction({
      deductionType: "rot",
      deductionTypes: ["rot"],
      eligibleBasisOre: 100_000,
      posture: "private",
      persons: 1,
      capturedAt: CAPTURED_AT,
    } as DeductionInput);
    const ok = assertOk(r);
    assert.equal(ok.deductionOre, 30_000, "a single-type list is not blocked as a mix");
  });

  test("a missing/undefined deductionType is UNKNOWN_DEDUCTION_TYPE (not a silent wrong-profile)", () => {
    const r = estimateDeduction({
      eligibleBasisOre: 100_000,
      posture: "private",
      capturedAt: CAPTURED_AT,
    } as DeductionInput);
    assert.ok(r.ok === false, "an absent deduction type must be a typed failure");
    assert.equal(r.code, "UNKNOWN_DEDUCTION_TYPE", "absent type → UNKNOWN_DEDUCTION_TYPE");
  });

  test("the mix block is checked BEFORE type/basis resolution — a mix with a bad basis still blocks as a mix", () => {
    const r = estimateDeduction({
      deductionTypes: ["rot", "gron_teknik"],
      eligibleBasisOre: -1, // an invalid basis that must NOT preempt the mix block
      posture: "private",
      capturedAt: CAPTURED_AT,
    } as DeductionInput);
    assert.ok(r.ok === false);
    assert.equal(r.code, "ROT_GRON_MIX_NOT_ALLOWED", "the mix block takes precedence over the basis error");
  });
});
