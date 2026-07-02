/**
 * Story 4.4 — EXPANDED automation coverage for the money & tax golden-master PACK
 * (test-automation expansion over `golden-pack.test.ts`; test IDs 4.4-GOLDEN-01 / 4.4-GOLDEN-02 /
 * 4.4-UNIT-02, risks R-408 / R-410).
 *
 * `golden-pack.test.ts` already provides the four pack-level guards (coverage manifest, labelling,
 * behavioral golden, schema-shape) + the pack-wide privacy scan. This companion file EXPANDS
 * coverage of the two NEW 4.4 fixtures by turning fixture FIELDS that were previously only asserted
 * as static schema into LIVE-engine negative/positive oracles, and by pinning internal-consistency
 * invariants that keep the oracle un-rottable:
 *
 *   GAP-1 (R-408 negative oracle) — the options/tillval VAT case declares `unselectedOptionVatWouldAdd`
 *         (3750 öre) but nothing DROVE the engine to prove that summing the unselected option's VAT
 *         would actually change the section total. Here we compute the unselected option's per-line
 *         VAT via the REAL `lineVatOre`, confirm it equals the pinned `unselectedOptionVatWouldAdd`,
 *         and confirm the section VAT total WITH it wrongly summed differs from the pinned total — so
 *         the exclusion rule is a live negative oracle, not a static number.
 *
 *   GAP-2 (R-408) — the options/tillval selected-net case only summed the pre-joined `includedLinesOre`.
 *         Here we reconstruct the included set from `baseLinesOre` + `selectedOptionOre` and prove it
 *         equals `includedLinesOre` (so the fixture's own decomposition is self-consistent), then drive
 *         `sumOre` on the reconstructed set — the selected option genuinely COUNTS.
 *
 *   GAP-3 (R-408) — the hidden-row deduction case's `eligibleBasisLines` sum is verified INDEPENDENTLY
 *         via `sumOre` (not only trusted through `estimateDeduction`'s internal sum), and the estimate
 *         is asserted to carry NO POSTURE_NOT_ELIGIBLE warning for the `private` posture (the hidden
 *         row counting must not silently flip eligibility).
 *
 *   GAP-4 (R-410, the load-bearing one) — the accepted-price `round-at-end-vs-sum-of-rounded-delta`
 *         documented-delta case claims `newExpectedOre = 69` from a 3×(0.5×45→23) sum-of-rounded chain,
 *         but the ENGINE never produced that 69 — the migration-delta claim was prose, not a live
 *         oracle. Here we drive the REAL `lineNetOre` + `sumOre` to reproduce 69 and assert it equals
 *         the fixture's `newExpectedOre`, so the NEW side of the documented delta is engine-verified.
 *
 *   GAP-5 (R-410) — internal consistency of EVERY documented-delta case: for a delta whose recalculated
 *         side equals `newExpectedOre` and whose accepted side equals `oldLovableWouldGive`, assert
 *         `newExpectedOre - oldLovableWouldGive === expectedDeltaOre` — so a mislabelled documented
 *         delta (wrong old/new pairing) fails loud.
 *
 * CONSUMES the frozen 4.1/4.2/4.3 `@/lib/money` primitives ONLY (`lineNetOre` / `lineVatOre` /
 * `sumOre`) — adds NO engine symbol, forks NO primitive, re-pins NO existing numeric authority, and
 * marks NOTHING production-approved. Pure `node --test` (`pnpm run test:unit`); fixtures under
 * tests/fixtures/golden/money/ (anonymized; öre/rate numbers only).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as money from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");

type OkLike = { ok: true } & Record<string, unknown>;
function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
function okOre(r: OkLike): number {
  const v = (r as Record<string, unknown>).value;
  assert.equal(typeof v, "number", "ok OreResult must carry a numeric value");
  return v as number;
}

type MoneyOracle = {
  sumOre: (values: readonly number[]) => OkLike | { ok: false };
  lineVatOre: (lineNetOre: number, vatRateBp: number) => OkLike | { ok: false };
  lineNetOre: (quantity: number, unitPriceOre: number) => OkLike | { ok: false };
  estimateDeduction: (input: Record<string, unknown>) => OkLike | ({ ok: false } & Record<string, unknown>);
};
const engine = money as unknown as MoneyOracle & Record<string, unknown>;

const CAPTURED_AT = "2026-07-02T00:00:00.000Z";

interface InclusionCase {
  readonly id: string;
  readonly baseLinesOre?: readonly number[];
  readonly selectedOptionOre?: number;
  readonly unselectedOptionOre?: number;
  readonly includedLinesOre?: readonly number[];
  readonly expectedIncludedNetOre?: number;
  readonly excludedWouldGive?: number;
  readonly vatRateBp?: number;
  readonly expectedSectionVatOre?: number;
  readonly unselectedOptionVatWouldAdd?: number;
  readonly deductionType?: string;
  readonly eligibleBasisLines?: readonly number[];
  readonly posture?: string;
  readonly persons?: number;
  readonly expectedEligibleBasisOre?: number;
  readonly expectedDeductionOre?: number;
}
interface OptionsFixture {
  readonly inclusionCases: readonly InclusionCase[];
}
interface DeltaCase {
  readonly id: string;
  readonly origin: string;
  readonly acceptedTotalOre: number;
  readonly recalculatedTotalOre: number;
  readonly expectedDeltaOre: number;
  readonly oldLovableWouldGive?: number;
  readonly newExpectedOre?: number;
}
interface DeltaFixture {
  readonly deltaCases: readonly DeltaCase[];
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, name), "utf8")) as T;
}
function loadOptions(): OptionsFixture {
  return readJson<OptionsFixture>("options-tillval.json");
}
function loadDeltas(): DeltaFixture {
  return readJson<DeltaFixture>("accepted-price-deltas.json");
}
function findCase<T extends { id: string }>(cases: readonly T[], id: string): T {
  const c = cases.find((x) => x.id === id);
  assert.ok(c, `fixture case '${id}' must be present`);
  return c;
}

describe("Story 4.4 — expanded golden-pack coverage (live-oracle gaps in the two NEW fixtures)", () => {
  // GAP-2 — the SELECTED option genuinely counts: the fixture's own base+option decomposition is
  // self-consistent AND sums (via the real sumOre) to the pinned net.
  test("[P0] options/tillval — reconstruct included set from base + SELECTED option; sumOre yields the pinned net (R-408)", () => {
    const c = findCase(loadOptions().inclusionCases, "selected-option-counts-toward-net");
    assert.ok(c.baseLinesOre && typeof c.selectedOptionOre === "number" && c.includedLinesOre, "case must carry base + selected option + included set");
    const reconstructed = [...c.baseLinesOre!, c.selectedOptionOre!];
    assert.deepEqual(
      reconstructed,
      [...c.includedLinesOre!],
      "the fixture's includedLinesOre must equal base lines + the SELECTED option (self-consistent decomposition)",
    );
    const net = engine.sumOre(reconstructed);
    assert.ok(isOk(net));
    assert.equal(okOre(net), c.expectedIncludedNetOre, "the SELECTED option must COUNT toward the section net");
  });

  // GAP-1 — the negative oracle for the VAT exclusion: drive the REAL engine to prove the unselected
  // option's per-line VAT equals the pinned `unselectedOptionVatWouldAdd`, and that summing it in
  // would CHANGE the section VAT total (so exclusion is behaviorally load-bearing, not just a number).
  test("[P0] options/tillval — the UNSELECTED option's VAT (via lineVatOre) would change the section total if wrongly summed (R-408 negative oracle)", () => {
    const vatCase = findCase(loadOptions().inclusionCases, "selected-option-counts-toward-vat");
    const unselectedCase = findCase(loadOptions().inclusionCases, "unselected-option-excluded-from-net");
    assert.ok(typeof vatCase.vatRateBp === "number" && typeof vatCase.expectedSectionVatOre === "number", "VAT case must carry rate + expected section VAT");
    assert.ok(typeof vatCase.unselectedOptionVatWouldAdd === "number", "VAT case must declare unselectedOptionVatWouldAdd");
    assert.ok(typeof unselectedCase.unselectedOptionOre === "number", "the unselected-net case must carry the unselected option öre");

    // The unselected option's per-line VAT, computed by the REAL engine, must equal the pinned add.
    const unselectedVat = engine.lineVatOre(unselectedCase.unselectedOptionOre!, vatCase.vatRateBp!);
    assert.ok(isOk(unselectedVat), "lineVatOre for the unselected option must be ok");
    assert.equal(
      okOre(unselectedVat),
      vatCase.unselectedOptionVatWouldAdd,
      "the pinned unselectedOptionVatWouldAdd must equal the engine's per-line VAT for that option",
    );

    // Summing it into the section VAT would produce a DIFFERENT total than the pinned exclusion result.
    const wouldBeTotal = vatCase.expectedSectionVatOre! + okOre(unselectedVat);
    assert.notEqual(
      wouldBeTotal,
      vatCase.expectedSectionVatOre,
      "if the unselected option's VAT were summed in, the section VAT total would change — exclusion is behaviorally load-bearing",
    );
  });

  // GAP-3 — the hidden-row basis is verified INDEPENDENTLY via sumOre, and the private-posture estimate
  // carries NO eligibility warning (hidden-row counting must not silently flip eligibility).
  test("[P0] options/tillval — hidden-row eligibleBasisLines sum independently via sumOre; private posture carries NO POSTURE_NOT_ELIGIBLE (R-408)", () => {
    const c = findCase(loadOptions().inclusionCases, "hidden-row-counts-toward-deduction-basis");
    assert.ok(c.eligibleBasisLines && typeof c.expectedEligibleBasisOre === "number", "hidden-row case must carry basis lines + expected basis");

    const independentSum = engine.sumOre(c.eligibleBasisLines!);
    assert.ok(isOk(independentSum));
    assert.equal(
      okOre(independentSum),
      c.expectedEligibleBasisOre,
      "the hidden row must be INCLUDED in an independent sumOre of the eligible basis lines",
    );

    const r = engine.estimateDeduction({
      deductionType: c.deductionType,
      eligibleBasisOre: c.eligibleBasisLines,
      posture: c.posture,
      persons: c.persons,
      capturedAt: CAPTURED_AT,
    });
    assert.ok(isOk(r), `estimateDeduction must be ok, got ${JSON.stringify(r)}`);
    const warnings = (r as Record<string, unknown>).warnings as { code?: string }[];
    assert.ok(Array.isArray(warnings), "estimate must carry a warnings array");
    assert.ok(
      !warnings.some((w) => w.code === "POSTURE_NOT_ELIGIBLE"),
      "a 'private' posture must NOT carry POSTURE_NOT_ELIGIBLE — hidden-row inclusion must not flip eligibility",
    );
    assert.ok(
      !warnings.some((w) => w.code === "DEDUCTION_CLAMPED_TO_CAP"),
      "the 90000-öre basis is well under the cap — no clamp warning expected",
    );
  });

  // GAP-4 (load-bearing, R-410) — the documented migration delta's NEW side (sum-of-rounded = 69) is
  // reproduced by the REAL engine from the 3×(0.5×45→23) chain, so the documented delta is a live
  // oracle on BOTH sides, not prose.
  test("[P0] accepted-price delta — the sum-of-rounded NEW side (69 öre) is reproduced by the real lineNetOre+sumOre chain (R-410)", () => {
    const c = findCase(loadDeltas().deltaCases, "round-at-end-vs-sum-of-rounded-delta");
    assert.equal(c.origin, "documented-delta", "the round-at-end case must be a documented-delta");
    assert.equal(typeof c.newExpectedOre, "number", "the case must carry the NEW sum-of-rounded expected öre");

    // Three lines of 0.5 × 45 öre = 22.5 → round-half-away-from-zero → 23 öre each; sum-of-rounded = 69.
    const perLine = [0, 1, 2].map(() => {
      const line = engine.lineNetOre(0.5, 45);
      assert.ok(isOk(line), "lineNetOre(0.5, 45) must be ok");
      return okOre(line);
    });
    assert.deepEqual(perLine, [23, 23, 23], "each 0.5×45 line must round-half-away-from-zero to 23 öre");
    const sumOfRounded = engine.sumOre(perLine);
    assert.ok(isOk(sumOfRounded));
    assert.equal(
      okOre(sumOfRounded),
      c.newExpectedOre,
      "the engine's sum-of-rounded (69) must equal the fixture's NEW side — the migration delta is engine-verified, not prose",
    );
    // And the NEW side differs from the old round-at-end value it diverges from (the +1 öre delta).
    assert.equal(okOre(sumOfRounded), c.recalculatedTotalOre, "recalculatedTotalOre must equal the sum-of-rounded NEW side");
  });

  // GAP-5 (R-410) — internal consistency of EVERY documented-delta: when the case pairs an accepted
  // side = oldLovableWouldGive and a recalculated side = newExpectedOre, the signed delta must equal
  // newExpectedOre − oldLovableWouldGive, so a mislabelled old/new pairing fails loud.
  test("[P0] accepted-price delta — every documented-delta's old/new pairing is internally consistent with the signed delta (R-410)", () => {
    const documented = loadDeltas().deltaCases.filter((c) => c.origin === "documented-delta");
    assert.ok(documented.length >= 1, "the pack must exercise at least one documented-delta case");
    for (const c of documented) {
      assert.equal(typeof c.oldLovableWouldGive, "number", `${c.id}: documented-delta must carry oldLovableWouldGive`);
      if (typeof c.newExpectedOre === "number") {
        // When both old and new sides are stated, the fixture's own delta must reconcile them.
        assert.equal(
          c.newExpectedOre - c.oldLovableWouldGive!,
          c.expectedDeltaOre,
          `${c.id}: newExpectedOre − oldLovableWouldGive must equal expectedDeltaOre (mislabelled old/new pairing)`,
        );
        // And the accepted/recalculated sides must match the documented old/new numbers.
        assert.equal(c.acceptedTotalOre, c.oldLovableWouldGive, `${c.id}: acceptedTotalOre must equal the documented old-Lovable value`);
        assert.equal(c.recalculatedTotalOre, c.newExpectedOre, `${c.id}: recalculatedTotalOre must equal the documented new-expected value`);
      }
    }
  });
});
