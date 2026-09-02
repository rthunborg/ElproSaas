/**
 * Story 5.5 — EXPANDED automation coverage for the CALC golden PACK (test-automation expansion over
 * `calc-golden-pack.test.ts`; test IDs 5.5-GOLDEN-01 / 5.5-UNIT-03, R-505/R-508/R-509/R-512/R-513).
 *
 * `calc-golden-pack.test.ts` already provides the 4 pack-level guards (coverage manifest, labelling,
 * behavioral golden, schema-shape) + the pack-wide privacy scan, and drives the real calc oracle
 * (`totals.ts` / `readiness.ts` / `vat-posture.ts` / `@/lib/money`) across every AC1 category for
 * the POSITIVE / computable path. This companion file CLOSES the GENUINE residual gaps in that pack —
 * live-oracle NEGATIVE / EDGE branches of the exact modules the pack is chartered to guard, mirroring
 * the Story 4.4 `golden-pack-coverage.test.ts` GAP-1..GAP-5 discipline (turn a static-field / an
 * unpinned branch into a LIVE oracle, never re-pin an existing authority):
 *
 *   GAP-A (R-508 negative oracle, section inclusion) — the pack's section-mode / row-type
 *         COMPOSITION guards only ever feed PLAIN visible counted rows; the `computeSectionTotal`
 *         EXCLUSION branch (an UNSELECTED option DROPPED from a section total) is never exercised by
 *         a 5.5 SECTION case. A regression that wrongly folds an unselected option into a section
 *         total would slip past every 5.5 section guard. Here we compose a section of {plain rows +
 *         a HIDDEN row (counts) + a SELECTED option (counts) + an UNSELECTED option (dropped)}
 *         through the REAL engine and assert the total equals the counted-only sum AND differs from
 *         the "wrongly-included" sum — a live negative oracle. Uses the options-tillval.json pinned
 *         öre (single authority R-508), re-pins nothing.
 *
 *   GAP-B (readiness gate, TOTAL_UNCOMPUTABLE blocker) — the pack's readiness cases all drive
 *         `classifyReadiness` on a COMPUTABLE input; the BLOCKER branch (an engine `{ok:false}`
 *         total → `TOTAL_UNCOMPUTABLE` + `canCreateQuote===false`) — a P0 quote-creation GATE
 *         directly downstream of the totals oracle — is unpinned. Here we drive a row the engine
 *         REJECTS (an overflow-scale qty×sell) through `computeLineTotal` to confirm it is `{ok:false}`,
 *         then through `classifyReadiness` to assert TOTAL_UNCOMPUTABLE is a BLOCKER and the quote
 *         gate closes. No inline money math — the engine decides the rejection (R-505).
 *
 *   GAP-C (readiness gate, MISSING_CUSTOMER blocker + canCreateQuote) — the pack's `readinessInput`
 *         always supplies a full customer, so the ONE hard blocker that gates quote creation and the
 *         `canCreateQuote` derivation are never asserted at 5.5. Here we drive a customer-less input
 *         and assert MISSING_CUSTOMER is a BLOCKER, `canCreateQuote===false`, and — critically — that
 *         a WARNING (REQUIRED_FILES_DEFERRED, always present) NEVER gates (fail-open discipline).
 *
 *   GAP-D (vat-display, the brf/public posture branch) — the pack's VAT-display case pins only
 *         `private` and `company`. `vat-posture.ts#resolveVatDisplayPosture` folds `brf`/`public`
 *         (and an unknown/absent type) into the tenant default AS-IS — a real owner-decision seam
 *         left unpinned by the pack. Here we drive brf + public + an unknown type through
 *         resolveVatDisplayPosture → resolveTotalDisplay on the SAME vat-rates.json referenced öre
 *         (R-508) and assert each takes the tenant default view, and that a posture round-trip
 *         still returns the identical stored öre (presentation never mutates the source).
 *
 *   GAP-E (5.5-UNIT-03 property/invariant, exploratory) — a small deterministic sweep of
 *         qty×unit_sell öre through the REAL `computeLineTotal` asserts the two structural money
 *         invariants the pack asserts only pointwise: gross === net + VAT for EVERY line, and a
 *         section total (`computeSectionTotal`) equals the sum-of-rounded of its included line nets
 *         via the engine's own `sumOre` (never a round-of-sum). No pinned magic number — a pure
 *         engine-vs-engine invariant, so it can never rot against a re-pin.
 *
 * CONSUMES the already-extracted pure modules ONLY (`totals.ts` / `readiness.ts` / `vat-posture.ts` /
 * `@/lib/money`) — re-implements NO logic, adds NO src, forks NO primitive, re-pins NO existing
 * numeric authority, and marks NOTHING production-approved. NO inline money math (R-505): every öre
 * op routes through the engine. Pure `node --test` (`pnpm run test:unit`); fixtures under
 * tests/fixtures/golden/money/ (anonymized; öre/rate numbers only, no PII, no clock).
 *
 * RUNNER-GLOB TRAP (5.5-DOCS-03): this calc-coverage golden lives under `tests/unit/**` (this path),
 * NEVER under `tests/golden/**` (which the `node --test` fast gate does NOT glob → a vacuous green).
 *
 * [Source: _bmad-output/implementation-artifacts/5-5-calculation-golden-tests-for-options-hidden-
 *  rows-and-tax-warnings.md; test-design-epic-5.md#5.5-GOLDEN-01/#5.5-UNIT-03; tests/unit/lib/money/
 *  golden-pack-coverage.test.ts (the 4.4 GAP-1..GAP-5 live-oracle expansion template); src/features/
 *  calculations/{totals,readiness,vat-posture}.ts (the oracle to drive)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  computeLineTotal,
  computeSectionTotal,
  resolveTotalDisplay,
  type TotalsRowInput,
} from "@/features/calculations/totals";
import {
  classifyReadiness,
  type ReadinessInput,
  type ReadinessRowInput,
} from "@/features/calculations/readiness";
import {
  resolveVatDisplayPosture,
  DEFAULT_TENANT_VAT_DISPLAY,
} from "@/features/calculations/vat-posture";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");
function readJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, name), "utf8"));
}

// ── Row builders — drive the REAL engine, never re-derive a total (mirrors the pack) ─────────────
function plainRow(sellOre: number, vatBp: number, quantity = 1): TotalsRowInput {
  const vatType =
    vatBp === 2_500
      ? "STANDARD_VAT_25"
      : vatBp === 600 || vatBp === 1_200
        ? "REDUCED_VAT"
        : vatBp === 0
          ? "ZERO_RATED"
          : null;
  assert.notEqual(vatType, null, "test fixture must name a canonical VAT pair for " + vatBp + " bp");
  return {
    quantity,
    unit_sell_ore: sellOre,
    vat_rate_bp: vatBp,
    vat_type: vatType!,
    is_hidden: false,
    is_optional: false,
    is_selected: null,
  };
}
function readinessRow(over: Partial<ReadinessRowInput>): ReadinessRowInput {
  return {
    quantity: 1,
    unit_cost_ore: 0,
    unit_sell_ore: 8000,
    vat_rate_bp: 2500,
    vat_type: "STANDARD_VAT_25",
    is_hidden: false,
    is_optional: false,
    is_selected: null,
    row_type: "material",
    source_kind: "article",
    ...over,
  };
}
function readinessInput(
  rows: readonly ReadinessRowInput[],
  over: Partial<ReadinessInput> = {},
): ReadinessInput {
  return {
    customer: {
      customer_id: "cust-anon-1",
      customer_display_name: "Anonymized Pilot Customer",
      customer_type: "private",
      facility_name: "Anonymized Facility",
      contact_name: "Anonymized Contact",
    },
    sections: [{ rows }],
    vatPostureResolved: true,
    tax: { hasDeductionAssumption: false },
    ...over,
  };
}

describe("Story 5.5 — EXPANDED calc golden PACK coverage (gap-closing live oracles, R-505/R-508/R-509/R-513)", () => {
  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GAP-A — section INCLUSION negative oracle: the migrated explicit inclusion fact DROPS the
  //   legacy-unselected option even when composed with a HIDDEN included row + an included option. The pack's section
  //   guards only ever feed plain visible rows — this exercises the exclusion branch at the SECTION
  //   layer through the real engine, on the options-tillval.json pinned öre (R-508, no re-pin).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] GAP-A section inclusion — an UNSELECTED option is DROPPED from computeSectionTotal even amid a hidden + a selected row (R-508)", () => {
    const opt = readJson("options-tillval.json") as {
      inclusionCases: {
        id: string;
        baseLinesOre?: number[];
        selectedOptionOre?: number;
        unselectedOptionOre?: number;
        expectedIncludedNetOre?: number;
      }[];
    };
    const selected = opt.inclusionCases.find((x) => x.id === "selected-option-counts-toward-net");
    const unselected = opt.inclusionCases.find((x) => x.id === "unselected-option-excluded-from-net");
    assert.ok(
      selected?.baseLinesOre && typeof selected.selectedOptionOre === "number" && typeof selected.expectedIncludedNetOre === "number",
      "the options authority must carry the selected-option case",
    );
    assert.ok(
      typeof unselected?.unselectedOptionOre === "number",
      "the options authority must carry an unselected-option case (the öre that must NOT be summed)",
    );

    // Compose {base rows (first HIDDEN + included) + included selected option + explicitly excluded
    // unselected option}. VAT bp = 0 so the net is a clean inclusion oracle.
    const rows: TotalsRowInput[] = [
      ...selected!.baseLinesOre!.map((ore, i) => ({
        quantity: 1,
        unit_sell_ore: ore,
        vat_rate_bp: 0,
        vat_type: "ZERO_RATED" as const,
        included_in_invoice_total: true,
        is_hidden: i === 0, // HIDDEN base row — still counts (frozen 2026-06-18 pin)
        is_optional: false,
        is_selected: null,
      })),
      { quantity: 1, unit_sell_ore: selected!.selectedOptionOre!, vat_rate_bp: 0, vat_type: "ZERO_RATED" as const, included_in_invoice_total: true, is_hidden: false, is_optional: true, is_selected: true }, // persisted inclusion → counts
      { quantity: 1, unit_sell_ore: unselected!.unselectedOptionOre!, vat_rate_bp: 0, vat_type: "ZERO_RATED" as const, included_in_invoice_total: false, is_hidden: false, is_optional: true, is_selected: false }, // persisted exclusion → dropped
    ];
    const total = computeSectionTotal(rows);
    assert.ok(total.ok, "the composed section must resolve");

    // The composed net EQUALS the pinned included net (hidden + selected count; unselected dropped)…
    assert.equal(
      total.value.netOre,
      selected!.expectedIncludedNetOre,
      "a hidden base row + a selected option COUNT; an unselected option is DROPPED — the section net reproduces the pinned included net (R-508, no re-pin)",
    );
    // …and is STRICTLY LESS than the total the engine would give if the unselected option WRONGLY
    // counted — so this is a LIVE negative oracle, not a static field.
    const wronglyIncluded = computeSectionTotal(
      rows.map((r) =>
        r.is_optional && r.is_selected === false
          ? { ...r, included_in_invoice_total: true }
          : r,
      ),
    );
    assert.ok(wronglyIncluded.ok);
    assert.notEqual(
      total.value.netOre,
      wronglyIncluded.value.netOre,
      "flipping the unselected option to selected MUST change the section net — proves the exclusion is genuinely enforced (not a no-op)",
    );
    assert.equal(
      wronglyIncluded.value.netOre - total.value.netOre,
      unselected!.unselectedOptionOre!,
      "the delta between the wrong and the correct section net is exactly the dropped unselected option's öre",
    );
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GAP-B — readiness GATE (TOTAL_UNCOMPUTABLE blocker): an engine-REJECTED total is a hard BLOCKER
  //   that closes the create-quote gate. The pack never drives the {ok:false} branch. The engine
  //   decides the rejection (no inline math, R-505).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] GAP-B readiness gate — an engine-REJECTED total is a TOTAL_UNCOMPUTABLE BLOCKER; canCreateQuote closes", () => {
    // A qty×sell scaled past the engine's safe integer öre bound — the engine REJECTS it ({ok:false}).
    // We let the engine be the authority on what overflows (never assert a specific bound inline).
    const overflowRow = plainRow(9_000_000_000_000, 2500, 9_000_000);
    const line = computeLineTotal(overflowRow);
    assert.equal(line.ok, false, "the engine must REJECT an overflow-scale line (a {ok:false}, never a NaN)");

    // Feed the SAME rejected row through the readiness classifier — it must be a hard BLOCKER.
    const report = classifyReadiness(
      readinessInput([readinessRow({ quantity: 9_000_000, unit_sell_ore: 9_000_000_000_000, unit_cost_ore: 0 })]),
    );
    const blockerCodes = report.blockers.map((b) => b.code);
    assert.ok(blockerCodes.includes("TOTAL_UNCOMPUTABLE"), "an engine-rejected total must raise the TOTAL_UNCOMPUTABLE blocker");
    assert.equal(report.canCreateQuote, false, "a TOTAL_UNCOMPUTABLE blocker must CLOSE the create-quote gate (a blocker gates)");
    assert.equal(
      report.blockers.find((b) => b.code === "TOTAL_UNCOMPUTABLE")!.severity,
      "blocker",
      "TOTAL_UNCOMPUTABLE is a BLOCKER severity, never a soft warning",
    );
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GAP-C — readiness GATE (MISSING_CUSTOMER blocker + fail-open canCreateQuote): the one hard
  //   blocker that gates quote creation, and the discipline that a WARNING NEVER gates.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] GAP-C readiness gate — a customer-less calc is a MISSING_CUSTOMER BLOCKER; a warning never gates (fail-open)", () => {
    const noCustomer = classifyReadiness(
      readinessInput([readinessRow({ unit_sell_ore: 8000 })], {
        customer: {
          customer_id: null,
          customer_display_name: null,
          customer_type: null,
          facility_name: null,
          contact_name: null,
        },
      }),
    );
    const blockerCodes = noCustomer.blockers.map((b) => b.code);
    assert.ok(blockerCodes.includes("MISSING_CUSTOMER"), "a calc with no customer must raise the MISSING_CUSTOMER blocker");
    assert.equal(noCustomer.canCreateQuote, false, "MISSING_CUSTOMER must CLOSE the create-quote gate");

    // A fully-populated computable calc has NO blockers → the gate is OPEN even though warnings exist
    // (e.g. REQUIRED_FILES_DEFERRED is always present). A warning NEVER gates — the fail-open pin.
    const okReport = classifyReadiness(readinessInput([readinessRow({ unit_sell_ore: 8000 })]));
    assert.equal(okReport.blockers.length, 0, "a fully-populated computable calc has NO blockers");
    assert.ok(okReport.warnings.length >= 1, "…yet it carries >=1 warning (REQUIRED_FILES_DEFERRED is unconditional)");
    assert.equal(okReport.canCreateQuote, true, "warnings must NEVER gate — canCreateQuote is derived SOLELY from blockers (fail-open)");
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GAP-D — VAT display for the brf/public/unknown branch: resolveVatDisplayPosture folds every
  //   NON-private type into the tenant default AS-IS. The pack pins only private + company; this
  //   pins the owner-decision seam for brf/public/unknown. References vat-rates.json öre (R-508).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P1] GAP-D VAT display — brf/public/unknown customers fold into the tenant default AS-IS; a round-trip returns the identical stored öre", () => {
    // Reference the SAME breakdown öre the pack's VAT-display case references (vat-rates.json, R-508).
    const vat = readJson("vat-rates.json") as {
      lineVatCases: { id: string; lineNetOre: number; expectedLineVatOre: number; expectedGrossOre: number }[];
    };
    const std = vat.lineVatCases.find((x) => x.id === "vat-25pct-standard");
    assert.ok(std, "vat-rates.json must carry the vat-25pct-standard authority case");
    const total = { netOre: std!.lineNetOre, vatOre: std!.expectedLineVatOre, grossOre: std!.expectedGrossOre };

    // A non-private type takes the tenant default AS-IS. Under a company_excl tenant → net-primary,
    // not togglable; under a company_togglable tenant → gross-primary, togglable.
    const nonPrivateTypes = ["brf", "public", "cooperative", null, undefined];
    for (const ct of nonPrivateTypes) {
      // company_excl tenant → posture company_excl → primary = net, not togglable.
      const exclPosture = resolveVatDisplayPosture(ct, "company_excl");
      assert.equal(exclPosture, "company_excl", `${String(ct)} + company_excl tenant → company_excl posture (non-private takes tenant default AS-IS)`);
      const exclView = resolveTotalDisplay(total, exclPosture);
      assert.equal(exclView.primaryOre, total.netOre, `${String(ct)}/company_excl: primary = net (excl-VAT)`);
      assert.equal(exclView.togglable, false, `${String(ct)}/company_excl: not togglable`);

      // company_togglable tenant → posture company_togglable → primary = gross, togglable.
      const togPosture = resolveVatDisplayPosture(ct, "company_togglable");
      assert.equal(togPosture, "company_togglable", `${String(ct)} + company_togglable tenant → company_togglable posture`);
      const togView = resolveTotalDisplay(total, togPosture);
      assert.equal(togView.primaryOre, total.grossOre, `${String(ct)}/company_togglable: primary = gross (incl-VAT)`);
      assert.equal(togView.togglable, true, `${String(ct)}/company_togglable: togglable`);

      // Presentation-only round-trip: BOTH views re-derive the IDENTICAL stored net/VAT/gross öre.
      for (const view of [exclView, togView]) {
        assert.equal(view.netOre, total.netOre, "the view must re-derive the SAME stored net öre (presentation never mutates the source)");
        assert.equal(view.vatOre, total.vatOre, "the view must re-derive the SAME stored VAT öre");
        assert.equal(view.grossOre, total.grossOre, "the view must re-derive the SAME stored gross öre");
      }
    }

    // An absent tenant default degrades to the conservative togglable default (never a hard failure).
    assert.equal(
      resolveVatDisplayPosture("brf", null),
      DEFAULT_TENANT_VAT_DISPLAY,
      "an absent tenant default degrades to the conservative DEFAULT_TENANT_VAT_DISPLAY (company_togglable)",
    );
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GAP-E — 5.5-UNIT-03 property/invariant (exploratory): the two STRUCTURAL money invariants the
  //   pack asserts only pointwise, swept over a deterministic set through the REAL engine. A pure
  //   engine-vs-engine invariant (no pinned magic number) — it can never rot against a re-pin.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P3] GAP-E invariants — gross === net + VAT per line; a section total equals the engine sum-of-rounded of its included line nets", () => {
    // A deterministic sweep (no RNG → reproducible). Fractional qty included; öre kept < 10 digits.
    const quantities = [1, 2, 2.5, 3, 10];
    const sells = [1, 333, 8000, 12345, 99999];
    const rates = [0, 600, 1200, 2500];

    const lineNets: number[] = [];
    for (const q of quantities) {
      for (const s of sells) {
        for (const bp of rates) {
          const line = computeLineTotal(plainRow(s, bp, q));
          assert.ok(line.ok, `computeLineTotal must resolve for qty=${q} sell=${s} bp=${bp}`);
          // Invariant 1: gross === net + VAT for EVERY line (the engine derives gross, never a fork).
          assert.equal(
            line.value.grossOre,
            line.value.netOre + line.value.vatOre,
            `gross must equal net + VAT (qty=${q} sell=${s} bp=${bp})`,
          );
          assert.ok(Number.isInteger(line.value.netOre) && Number.isInteger(line.value.vatOre), "every öre value stays an integer öre");
          lineNets.push(line.value.netOre);
        }
      }
    }

    // Invariant 2: a section total's net equals the engine sum-of-rounded of its included line nets.
    // Compose the swept lines into one section and drive computeSectionTotal — its net must equal the
    // engine's own sumOre over the same rounded line nets (sum-of-rounded, never a round-of-sum).
    const rows: TotalsRowInput[] = [];
    for (const q of quantities) for (const s of sells) rows.push(plainRow(s, 2500, q));
    const section = computeSectionTotal(rows);
    assert.ok(section.ok, "the composed sweep section must resolve");
    const perLineNets = rows.map((r) => {
      const l = computeLineTotal(r);
      assert.ok(l.ok);
      return l.value.netOre;
    });
    const engineSum = perLineNets.reduce((a, b) => a + b, 0); // integer öre addition (values < 10 digits) — a reference sum, not a money rule
    assert.equal(section.value.netOre, engineSum, "the section net equals the sum-of-rounded of its included line nets (the engine never round-of-sums)");
  });
});
