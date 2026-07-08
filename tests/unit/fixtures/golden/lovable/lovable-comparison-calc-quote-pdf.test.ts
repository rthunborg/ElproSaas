/**
 * Story 9.3 — GOLDEN-MASTER COMPARISON: CALC + VAT/TAX + OPTIONS + HIDDEN ROWS + QUOTE-VISIBLE
 * LINES + PDF TEXT + ATTACHMENT SELECTION (9.3-CMP-01 / 9.3-CMP-02, RED-PHASE SCAFFOLD).
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
 * ── RED-PHASE STATUS ─────────────────────────────────────────────────────────────────
 * The oracle surfaces exist (Epics 4-8). The dev must, per Task 2:
 *   (1) Map each 9.2 fixture case onto the real oracle inputs and assert old-vs-new — the mapping
 *       glue (fixture row → TotalsRowInput; fixture quote → QuotePdfViewModel) is the GREEN work.
 *   (2) REGISTER each proven category into the coverage manifest's EXECUTED set
 *       (lovable-comparison-guards.test.ts) so GUARD 2 turns green.
 *   (3) Where a calc total is compared, prove it reproduces the frozen money-fixture pin (single
 *       authority) — a divergence is a STOP, never a re-pin.
 * The `assert.fail(...)` markers below are the RED signals for the not-yet-implemented mappings; the
 * dev replaces each with the real live-driven assertion. The INCLUSION invariant and the PDF
 * mustAppear/mustNotAppear checks that DON'T need new glue are authored to run now.
 *
 * Runner: `node --test` (`pnpm run test:unit`). NO DB, NO PII. The render instant is INJECTED.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  computeSectionTotal,
  type TotalsRowInput,
} from "@/features/calculations/totals";
import { classifyReadiness } from "@/features/calculations/readiness";

import { loadLovableFixture } from "./comparison-support";

const FIXED_ISO = "2026-07-07T12:00:00.000Z"; // the INJECTED render instant (determinism)

interface LovableCalcRow {
  readonly row_type: string;
  readonly quantity: number;
  readonly unit_cost_ore: number | null;
  readonly unit_sell_ore: number;
  readonly vat_rate_bp: number;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean;
}

/** Map a 9.2 lovable calc row onto the REAL totals-engine row input (no inline money math). */
function toTotalsRow(r: LovableCalcRow): TotalsRowInput {
  return {
    quantity: r.quantity,
    unit_sell_ore: r.unit_sell_ore,
    vat_rate_bp: r.vat_rate_bp,
    is_hidden: r.is_hidden,
    is_optional: r.is_optional,
    is_selected: r.is_optional ? r.is_selected : null,
  };
}

describe("Story 9.3 — CALC + VAT/TAX + OPTIONS + HIDDEN ROWS comparison (9.3-CMP-01, R-903/R-904/R-912)", () => {
  test("[P0] calc-totals + hidden-rows + options-tillval — a SELECTED option and a HIDDEN row COUNT; an UNSELECTED option does NOT (INCLUSION frozen pin)", () => {
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
    // GREEN: register "calc-totals", "hidden-rows", "options-tillval" into the coverage manifest's
    //        EXECUTED set (lovable-comparison-guards.test.ts) and REFERENCE the options-tillval.json
    //        pin as the single numeric authority for the included net.
  });

  test("[P0] vat-tax-blocks — the readiness classification over the calc fixture emits only REAL union codes; HIDDEN_ROWS_INCLUDED is disclosed", () => {
    const fx = loadLovableFixture("calculations");
    const c = (fx.cases ?? []).find(
      (x) => (x as Record<string, unknown>).id === "mixed-rows-with-hidden-and-option-selection",
    ) as { rows: LovableCalcRow[]; readinessWarnings: string[] } | undefined;
    assert.ok(c, "calculations.json must carry the mixed-rows case");
    assert.ok(typeof classifyReadiness === "function", "the real readiness oracle must be present");
    // GREEN (Task 2.1): build the ReadinessInput from the fixture rows + a synthetic customer,
    //        classifyReadiness, and assert the emitted warning codes MATCH the fixture's
    //        readinessWarnings (HIDDEN_ROWS_INCLUDED disclosed; MISSING_WORK_ROLE for the
    //        subcontractor/other rows; LOW_MARGIN for the low-margin row). Then REGISTER
    //        "vat-tax-blocks" into the coverage manifest EXECUTED set.
    assert.fail(
      "RED PHASE (Task 2.1): drive classifyReadiness over calculations.json rows and assert the emitted " +
        "warning codes equal the fixture's readinessWarnings; then register 'vat-tax-blocks' into the manifest.",
    );
  });
});

describe("Story 9.3 — QUOTE-VISIBLE LINES + PDF TEXT + ATTACHMENT SELECTION comparison (9.3-CMP-02, R-903/R-904)", () => {
  test("[P0] quote-visible-lines — the visible line/totals shape over quotes.json drives the real quote view-model", () => {
    const fx = loadLovableFixture("quotes");
    assert.ok((fx.cases ?? []).length >= 1, "quotes.json must carry >=1 quote-visible case");
    // GREEN (Task 2.2): map the quotes.json base/option/vat/deduction totals shape onto the real
    //        quote-version-visible view-model, assert the visible lines + totals shape, and REFERENCE
    //        the money fixtures as single authority (a divergence from a frozen pin is a STOP).
    //        Then register "quote-visible-lines" into the coverage manifest EXECUTED set.
    assert.fail(
      "RED PHASE (Task 2.2): drive the real quote view-model over quotes.json and assert the visible line/totals shape; register 'quote-visible-lines'.",
    );
  });

  test("[P0] pdf-text-visual + attachment-selection — mustAppear AND a NON-EMPTY mustNotAppear (a hidden row + an unselected option must NOT leak)", () => {
    const fx = loadLovableFixture("pdfs");
    const c = (fx.cases ?? [])[0] as { mustAppear: string[]; mustNotAppear: string[] } | undefined;
    assert.ok(c, "pdfs.json must carry a text-shape case");
    // A leakage-sensitive PDF case MUST carry a NON-EMPTY mustNotAppear (an empty one guards nothing).
    assert.ok(Array.isArray(c!.mustAppear) && c!.mustAppear.length > 0, "the PDF case must carry a non-empty mustAppear");
    assert.ok(
      Array.isArray(c!.mustNotAppear) && c!.mustNotAppear.length > 0,
      "the PDF case MUST carry a NON-EMPTY mustNotAppear (6.3 leakage discipline — an empty mustNotAppear guards nothing)",
    );
    void FIXED_ISO;
    // GREEN (Task 2.2): buildQuotePdfViewModel from the quote shape → renderQuotePdf({renderedAt:
    //        FIXED_ISO}) → extractPdfText → assert EVERY mustAppear substring is present AND EVERY
    //        mustNotAppear substring is ABSENT (the hidden-row label + the unselected-option label do
    //        NOT leak). PDF pixel/visual is stability-only and NEVER gates. Then register
    //        "pdf-text-visual" AND "attachment-selection" into the coverage manifest EXECUTED set.
    assert.fail(
      "RED PHASE (Task 2.2): render the quote PDF, extract text, assert mustAppear present + mustNotAppear absent; register 'pdf-text-visual' + 'attachment-selection'.",
    );
  });
});
