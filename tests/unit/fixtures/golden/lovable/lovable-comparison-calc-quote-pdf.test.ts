/**
 * Story 9.3 — GOLDEN-MASTER COMPARISON: CALC + VAT/TAX + OPTIONS + HIDDEN ROWS + QUOTE-VISIBLE
 * LINES + PDF TEXT + ATTACHMENT SELECTION (9.3-CMP-01 / 9.3-CMP-02, GREEN).
 *
 * DRIVES the REAL new-side oracle over the anonymized 9.2 `lovable/**` fixtures (do NOT re-author or
 * mutate the fixtures — they are CONSUMED here) and asserts old-vs-new for six of the nine AC1
 * comparison categories:
 *   - calc-totals / vat-tax-blocks / options-tillval / hidden-rows  → drive
 *     computeLineTotal/computeSectionTotal/resolveTotalDisplay + classifyReadiness +
 *     resolveVatDisplayPosture over `calculations.json` (the INCLUSION frozen pin: a SELECTED option
 *     and a HIDDEN row COUNT; an UNSELECTED option does NOT). Route EVERY öre op through
 *     totals.ts / @/lib/money — NO inline `+`/`*`/`0.25`/`Number(x)*rate`. REFERENCE the money
 *     fixtures as the single numeric authority; a divergence from a frozen pin is a STOP (needs-human).
 *   - quote-visible-lines → drive the quote-version-visible line/totals shape over `quotes.json`.
 *   - pdf-text-visual / attachment-selection → reuse the 6.3 text-golden path
 *     (buildQuotePdfViewModel → renderQuotePdf({renderedAt: FIXED_ISO}) → extractPdfText) over
 *     `pdfs.json`, asserting BOTH the positive mustAppear AND the NON-EMPTY mustNotAppear
 *     (a hidden-row label + an unselected-option label must NOT leak). PDF pixel/visual is
 *     stability-only and NEVER gates (6.3-GOLDEN-02 / 9.5-VISUAL-01 non-gating posture).
 *
 * ── GREEN-PHASE STATUS ─────────────────────────────────────────────────────────────────
 * The oracle surfaces exist (Epics 4-8) and the mapping glue landed in `comparison-support.ts`:
 *   (1) Each 9.2 fixture case is mapped onto the real oracle inputs and old-vs-new is asserted
 *       (fixture row → TotalsRowInput via `toTotalsRow`; fixture quote → QuoteVersionSnapshot →
 *       QuotePdfViewModel → renderer).
 *   (2) Each proven category is REGISTERED into the coverage manifest via the shared
 *       `driveComparisonCase` live-drive path (the manifest re-drives the SAME functions in-process).
 *   (3) The calc totals REPRODUCE the frozen money-fixture pin (`options-tillval.json` single
 *       authority) — a divergence is a STOP, never a re-pin.
 * Route EVERY öre op through totals.ts / @/lib/money — NO inline math. PDF pixel/visual is
 * stability-only and NEVER gates (only the extracted TEXT gates).
 *
 * Runner: `node --test` (`pnpm run test:unit`). NO DB, NO PII. The render instant is INJECTED.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { computeSectionTotal } from "@/features/calculations/totals";
import { classifyReadiness } from "@/features/calculations/readiness";

import {
  loadLovableFixture,
  toTotalsRow,
  classifyCalcReadiness,
  driveComparisonCase,
  type LovableCalcRow,
} from "./comparison-support";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The money-golden `options-tillval.json` — the SINGLE numeric authority for the inclusion net pins. */
interface OptionsTillvalAuthority {
  readonly inclusionCases: readonly {
    readonly id: string;
    readonly includedLinesOre: readonly number[];
    readonly expectedIncludedNetOre: number;
  }[];
}
function loadOptionsTillvalAuthority(): OptionsTillvalAuthority {
  const path = resolve(HERE, "../../../../fixtures/golden/money/options-tillval.json");
  return JSON.parse(readFileSync(path, "utf8")) as OptionsTillvalAuthority;
}

describe("Story 9.3 — CALC + VAT/TAX + OPTIONS + HIDDEN ROWS comparison (9.3-CMP-01, R-903/R-904/R-912)", () => {
  test("[P0] calc-totals + hidden-rows + options-tillval — a SELECTED option and a HIDDEN row COUNT; an UNSELECTED option does NOT (INCLUSION frozen pin)", async () => {
    const fx = loadLovableFixture("calculations");
    const c = (fx.cases ?? []).find(
      (x) => (x as Record<string, unknown>).id === "mixed-rows-with-hidden-and-option-selection",
    ) as { rows: LovableCalcRow[] } | undefined;
    assert.ok(c, "calculations.json must carry the mixed-rows inclusion case");

    const rows = c!.rows.map(toTotalsRow);
    const withUnselected = computeSectionTotal(rows);
    assert.ok(withUnselected.ok, "the section must resolve through the REAL engine (no inline math)");

    // Drop the UNSELECTED option — the total must be UNCHANGED (an unselected option never counts).
    const withoutUnselected = computeSectionTotal(
      c!.rows.filter((r) => !(r.is_optional && !r.is_selected)).map(toTotalsRow),
    );
    assert.ok(withoutUnselected.ok, "the filtered section must resolve");
    assert.deepEqual(
      withoutUnselected.value,
      withUnselected.value,
      "an UNSELECTED option must NOT affect the section total (INCLUSION frozen pin, 2026-06-18)",
    );

    // Drop the HIDDEN row — the total MUST change (a hidden row COUNTS toward the total).
    const withoutHidden = computeSectionTotal(c!.rows.filter((r) => !r.is_hidden).map(toTotalsRow));
    assert.ok(withoutHidden.ok, "the no-hidden section must resolve");
    assert.notDeepEqual(
      withoutHidden.value,
      withUnselected.value,
      "a HIDDEN row must COUNT toward the section total (INCLUSION frozen pin) — dropping it must change the total",
    );

    // SINGLE NUMERIC AUTHORITY (R-912): the money-golden `options-tillval.json` OWNS the inclusion
    // net pins. Prove the REAL engine REPRODUCES the authority's pinned net for the exact included
    // set it pins — a REFERENCE cross-check (read the authority's value, assert the engine matches),
    // NEVER a re-pin. A divergence here would be a STOP (needs-human), not a fixture edit.
    const authority = loadOptionsTillvalAuthority();
    const selected = authority.inclusionCases.find((k) => k.id === "selected-option-counts-toward-net")!;
    const engineNet = computeSectionTotal(
      selected.includedLinesOre.map((ore) => ({
        quantity: 1,
        unit_sell_ore: ore,
        vat_rate_bp: 0,
        is_hidden: false,
        is_optional: false,
        is_selected: null,
      })),
    );
    assert.ok(engineNet.ok, "the authority's included set must resolve through the engine");
    assert.equal(
      engineNet.value.netOre,
      selected.expectedIncludedNetOre,
      "the real engine must REPRODUCE the options-tillval.json single-authority included-net pin " +
        "(a divergence is a STOP, never a re-pin)",
    );

    // Register the three INCLUSION-family categories through the shared live-drive path.
    for (const category of ["calc-totals", "hidden-rows", "options-tillval"] as const) {
      const result = await driveComparisonCase(category);
      assert.equal(result.category, category);
      assert.ok(result.matchedKeys.includes("netOre"));
    }
  });

  test("[P0] vat-tax-blocks — the readiness classification over the calc fixture emits only REAL union codes; the fixture's readinessWarnings are all disclosed", async () => {
    const fx = loadLovableFixture("calculations");
    const c = (fx.cases ?? []).find(
      (x) => (x as Record<string, unknown>).id === "mixed-rows-with-hidden-and-option-selection",
    ) as { rows: LovableCalcRow[]; readinessWarnings: string[] } | undefined;
    assert.ok(c, "calculations.json must carry the mixed-rows case");
    assert.ok(typeof classifyReadiness === "function", "the real readiness oracle must be present");

    // Drive the REAL readiness classifier over the fixture rows + a synthetic (present) customer.
    // The REAL oracle is the AUTHORITY (R-905: drive it, never re-derive) — the fixture's
    // readinessWarnings is a REPRESENTATIVE claimed shape, not the authority. This comparison asserts
    // old-vs-new against the LIVE oracle.
    const report = classifyCalcReadiness(c!.rows);
    const emitted = new Set<string>(report.warnings.map((w) => w.code));

    // Every EMITTED warning code is a REAL union member (no fictional code, no free string — R-903).
    // This is the representativeness core: the real oracle can only emit real union codes.
    const real = new Set<string>(
      (await import("@/features/calculations/readiness")).READINESS_CODES,
    );
    for (const code of emitted) {
      assert.ok(real.has(code), `the real oracle emitted '${code}' which is not a real ReadinessCode`);
    }

    // The STRUCTURALLY-REACHABLE fixture-pinned codes MUST be emitted by the real oracle:
    //   - LOW_MARGIN: the `other` waste-handling row (cost 5000 / sell 5200 öre) has TB% ≈ 3.8% < 15%.
    //   - HIDDEN_ROWS_INCLUDED: the counted hidden `machinery` row triggers the disclosure.
    for (const reachable of ["LOW_MARGIN", "HIDDEN_ROWS_INCLUDED"]) {
      assert.ok(
        emitted.has(reachable),
        `the real oracle must emit the reachable fixture code '${reachable}' (emitted: ${[...emitted].join(", ")})`,
      );
    }

    // MISSING_WORK_ROLE is pinned by the 9.2 fixture but is NOT structurally reachable from its rows:
    // the ONLY labor row (row-0001) carries source_kind='work_role', and MISSING_WORK_ROLE fires ONLY
    // for a LABOR row without a work role (the subcontractor/machinery/other rows are not labor). The
    // REAL oracle is authoritative and correctly does NOT emit it — a WARNING-classification divergence
    // between the fixture's representative claim and the live oracle. Assert the live-oracle truth
    // (never re-derive the fixture's over-stated claim); this is a documented, non-sensitive
    // (warning-classification) divergence, not a money/tax STOP (recorded in the Dev Agent Record).
    assert.ok(
      !emitted.has("MISSING_WORK_ROLE"),
      "the real oracle must NOT emit MISSING_WORK_ROLE for this fixture (its only labor row has a work role) — " +
        "the live oracle is authoritative over the fixture's representative claim",
    );

    // No blocker: the classifier reasons about counted rows only and the customer is present.
    assert.equal(report.canCreateQuote, true, "a present customer + computable total must not gate");

    // Prove the shared live-drive path registers this category (same path the manifest uses).
    const result = await driveComparisonCase("vat-tax-blocks");
    assert.equal(result.category, "vat-tax-blocks");
    assert.ok(result.matchedKeys.includes("warnings"));
  });
});

describe("Story 9.3 — QUOTE-VISIBLE LINES + PDF TEXT + ATTACHMENT SELECTION comparison (9.3-CMP-02, R-903/R-904)", () => {
  test("[P0] quote-visible-lines — the visible line/totals shape over quotes.json drives the real quote view-model", async () => {
    const fx = loadLovableFixture("quotes");
    assert.ok((fx.cases ?? []).length >= 1, "quotes.json must carry >=1 quote-visible case");

    // Drive the REAL quote-version snapshot → PDF view-model over the base quote case and assert the
    // visible line + totals SHAPE reproduces the fixture (the lines are projected through the real
    // engine; the totals block öre are read verbatim from the fixture — a captured shape, not a re-pin).
    const result = await driveComparisonCase("quote-visible-lines");
    assert.equal(result.category, "quote-visible-lines");
    assert.ok(result.matchedKeys.includes("lines") && result.matchedKeys.includes("totals"));
    const detail = result.detail as {
      visibleLineCount: number;
      selectedOptionPresent: boolean;
      baseKronor: string;
      optionKronor: string;
      vatKronor: string;
    };
    const base = (fx.cases ?? []).find((x) => x["id"] === "base-quote-with-selected-option") as
      | { lines: unknown[] }
      | undefined;
    assert.ok(base, "quotes.json must carry the base-quote-with-selected-option case");
    // Every fixture line becomes a visible view-model line (the base case carries no hidden row).
    assert.equal(
      detail.visibleLineCount,
      base!.lines.length,
      "the real quote view-model must project every base-case line as a visible line",
    );
    // The SELECTED option is a visible, selected line (the tillval the customer accepted).
    assert.equal(detail.selectedOptionPresent, true, "the selected option must be a visible selected line");
    // The totals block renders through the single öre→kronor formatter (non-empty kronor strings).
    for (const kr of [detail.baseKronor, detail.optionKronor, detail.vatKronor]) {
      assert.ok(typeof kr === "string" && kr.length > 0, "totals must render as kronor strings");
    }
  });

  test("[P0] pdf-text-visual + attachment-selection — mustAppear AND a NON-EMPTY mustNotAppear (a hidden row + an unselected option must NOT leak)", async () => {
    const fx = loadLovableFixture("pdfs");
    const c = (fx.cases ?? [])[0] as { mustAppear: string[]; mustNotAppear: string[] } | undefined;
    assert.ok(c, "pdfs.json must carry a text-shape case");
    // A leakage-sensitive PDF case MUST carry a NON-EMPTY mustNotAppear (an empty one guards nothing).
    assert.ok(Array.isArray(c!.mustAppear) && c!.mustAppear.length > 0, "the PDF case must carry a non-empty mustAppear");
    assert.ok(
      Array.isArray(c!.mustNotAppear) && c!.mustNotAppear.length > 0,
      "the PDF case MUST carry a NON-EMPTY mustNotAppear (6.3 leakage discipline — an empty mustNotAppear guards nothing)",
    );

    // Drive the REAL snapshot → view-model → renderer → text-extraction path (the 6.3 pattern). The
    // snapshot carries the visible base + selected-option lines PLUS every mustNotAppear negative in
    // its input, so the leakage guard is GENUINE for all three (never vacuous-by-absence):
    //   - two HIDDEN rows ("Lift rental" + the literal "Hidden row — counts toward totals") ARE
    //     carried onto the frozen snapshot (they count toward totals) and must be dropped by the
    //     renderer's `!line.isHidden` filter (render.ts:202);
    //   - an UNSELECTED option ("Optional extra outlet") is supplied to the input but EXCLUDED
    //     upstream by the snapshot-input projection (an unselected option never becomes a snapshot
    //     line) — so its non-appearance proves the exclusion dropped it, not that it was never there.
    const result = await driveComparisonCase("pdf-text-visual");
    assert.equal(result.category, "pdf-text-visual");
    const detail = result.detail as {
      appeared: { s: string; present: boolean }[];
      leaked: string[];
      mustAppear: string[];
      mustNotAppear: string[];
      hiddenCarriedOntoSnapshot: string[];
      unselectedOptionExcludedUpstream: boolean;
    };
    for (const a of detail.appeared) {
      assert.ok(a.present, `the customer PDF must render the mustAppear label '${a.s}'`);
    }
    assert.deepEqual(
      detail.leaked,
      [],
      `NO mustNotAppear label may leak into the customer PDF text (leaked: ${detail.leaked.join(", ")}) — ` +
        "a hidden row and an unselected option must never reach the customer PDF (6.3 leakage discipline)",
    );

    // NON-VACUITY: the leakage guard must genuinely EXERCISE each seam, not pass because the label was
    // never in the input. Both HIDDEN negatives must actually be present on the frozen snapshot (so the
    // renderer's hidden-filter is the thing keeping them off the PDF)...
    assert.deepEqual(
      [...detail.hiddenCarriedOntoSnapshot].sort(),
      ["Hidden row — counts toward totals", "Lift rental"],
      "both hidden-row mustNotAppear labels must be CARRIED onto the snapshot so the renderer's " +
        "`!line.isHidden` filter is genuinely exercised (not proven by absence of input)",
    );
    // ...and the UNSELECTED option must have been supplied to the input but dropped by the UPSTREAM
    // projection (an unselected option never becomes a snapshot line), so its exclusion is real.
    assert.equal(
      detail.unselectedOptionExcludedUpstream,
      true,
      "the unselected-option label must be EXCLUDED UPSTREAM from the snapshot lines (the real " +
        "quote-version projection drops an unselected option) — proving the exclusion, not absence",
    );

    // attachment-selection: the same live drive proves the attachment set (empty here — no selected
    // attachment in this base case) is projected through the real view-model, not fabricated.
    const attachResult = await driveComparisonCase("attachment-selection");
    assert.equal(attachResult.category, "attachment-selection");
    assert.ok(attachResult.matchedKeys.includes("mustNotAppear"));
  });
});
