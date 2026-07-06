/**
 * Story 6.3 — 6.3-UNIT-01 (P0, AC1): the PURE `QuotePdfViewModel` is built SOLELY from the
 * frozen snapshot rows, formats öre→kronor via the SINGLE existing formatter (VERBATIM, no
 * recompute), carries the non-final ROT/grön + `requiresSignOff` framing, and EXCLUDES the
 * internal fields (`unit_cost_ore`/margin/markup/`internal_note`) BY CONSTRUCTION
 * (leakage-by-construction, R-606/R-607). Pure, in-memory, NO DB, NO PII, NO clock.
 *
 * ── GREEN (Story 6.3, Task 2) ────────────────────────────────────────────────────────
 * `buildQuotePdfViewModel` (`src/lib/quote-pdf/**`) has landed; these tests exercise the real
 * builder against a HOSTILE snapshot that carries internal fields at the source and assert they
 * are dropped by construction. Mirrors the 6.2 `view-model.test.ts` R-607 leakage belt.
 *
 * Runner: `node --test` (`pnpm run test:unit`).
 *
 * [Source: test-design-epic-6.md#6.3-UNIT-01, R-606/R-607; story 6.3 Task 2 + Task 6.1;
 *  src/features/quotes/view-model.test.ts (the 6.2 precedent); src/lib/quote-snapshot/types.ts
 *  (the frozen QuoteVersionSnapshot input surface); src/lib/money/ore.ts#formatOreAsKronor
 *  (the single öre→kronor formatter); src/features/calculations/readiness.ts
 *  (the REAL ReadinessCode union — never the fictional 6.1 golden codes)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuotePdfViewModel } from "@/lib/quote-pdf/view-model";

// GREEN (Story 6.3, Task 2): the pure `buildQuotePdfViewModel` (`src/lib/quote-pdf/**`) has
// landed. Its INPUT surface is EXACTLY the frozen snapshot shape (the `QuoteVersionSnapshot`
// row + its line/attachment snapshots) — NOTHING mutable (customer/settings/terms/calc/
// pricing). That type-level constraint is what makes 6.3-UNIT-01 provable.

const GREEN = {} as const;

/**
 * A HOSTILE snapshot-shaped input that ALSO carries internal fields at the SOURCE. The
 * view model's TYPE must forbid them and the builder must drop them by construction — the
 * PDF must NEVER see cost/margin/markup/internal notes (R-607). Shape mirrors
 * `QuoteVersionSnapshot` + its `QuoteVersionLineSnapshot[]` (customer-visible fields only).
 */
const hostileSnapshot = {
  calculationId: "calc-golden-1",
  capturedAt: "2026-07-05T12:00:00.000Z",
  // FULL company identity (all customer-visible).
  companyName: "Test Elfirma AB",
  companyOrgNr: "556000-0000",
  companyAddressLine1: "Testgatan 1",
  companyAddressLine2: null,
  companyPostalCode: "111 11",
  companyCity: "Teststad",
  companyEmail: "kontakt@example.test",
  companyPhone: "+46 00 000 00 00",
  companyLogoUrl: null,
  // Customer/facility/contact DISPLAY names ONLY (never a personnummer).
  customerDisplayName: "Kund Kundsson",
  customerType: "private",
  facilityName: "Anläggning A",
  contactName: "Kontakt K",
  quoteNumberDisplay: null,
  validUntil: "2026-08-05",
  introText: "Tack för förfrågan.",
  customerNotes: "Ring innan besök.",
  termsText: "Betalning 30 dagar netto.",
  termsApprovedAt: null,
  termsApprovedBy: null,
  baseTotalOre: 170000,
  optionTotalOre: 50000,
  vatTotalOre: 42500,
  deductionTotalOre: 0,
  acceptedPriceOre: 212500,
  vatRateBp: 2500,
  vatDisplay: null,
  deductionType: "rot",
  deductionRateBp: null,
  deductionCapOre: null,
  deductionPersons: null,
  requiresSignOff: true,
  displayMode: "detailed",
  lines: [
    {
      rowType: "labor",
      sortOrder: 0,
      label: "Elarbete",
      description: "Installation",
      quoteNote: "Ingår i priset",
      quantity: 2,
      unit: "h",
      unitSellOre: 85000,
      lineNetOre: 170000,
      vatRateBp: 2500,
      isHidden: false,
      isOptional: false,
      isSelected: null,
      // Internal fields that MUST NOT reach the PDF view model (R-607). They are not on
      // the real snapshot row; a hostile caller shoving them in must not leak them through.
      unitCostOre: 45000,
      marginBp: 4700,
      markupBp: 8888,
      internalNote: "Marginal pressad – förhandla",
      unit_cost_ore: 45000,
      internal_note: "leak me",
    },
  ],
  attachments: [{ fileId: "11111111-1111-1111-1111-111111111111", displayName: "Ritning.pdf", sortOrder: 0 }],
  warnings: [
    // The REAL ReadinessCode vocabulary — NEVER the fictional 6.1 golden codes.
    { code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "Skatteantaganden kräver godkännande." },
    { code: "HIDDEN_ROWS_INCLUDED", severity: "info", message: "Dolda rader ingår i totalen." },
  ],
};

test(
  "6.3-UNIT-01: the view model carries NO internal cost/margin/markup/internal-note keys (R-607)",
  GREEN,
  () => {
    const vm = buildQuotePdfViewModel(hostileSnapshot as never);
    const json = JSON.stringify(vm);
    // No forbidden key or value string is reachable anywhere in the serialized view model.
    for (const forbidden of ["unitCostOre", "unit_cost_ore", "marginBp", "markupBp", "internalNote", "internal_note"]) {
      assert.equal(json.includes(forbidden), false, `forbidden internal key "${forbidden}" leaked into the PDF view model`);
    }
    assert.equal(json.includes("Marginal pressad"), false, "internal note text leaked into the PDF view model");
    assert.equal(json.includes("leak me"), false, "hostile internal note leaked into the PDF view model");
    assert.equal(json.includes("45000"), false, "internal cost öre value leaked into the PDF view model");
  },
);

test(
  "6.3-UNIT-01: money is formatted VERBATIM from the snapshot via the single öre→kronor formatter (no recompute)",
  GREEN,
  () => {
    const vm = buildQuotePdfViewModel(hostileSnapshot as never);
    // The line's SELL öre (85000 = 850,00 kr) must format via oreToKronorString — never the
    // internal cost (45000). Assert the customer-visible formatted string is present and the
    // cost-derived string is not. (Exact kronor formatting is oreToKronorString's contract —
    // this asserts the VALUE routed through it is the snapshot sell öre, not a recompute.)
    const flat = JSON.stringify(vm);
    assert.ok(flat.includes("850") || flat.includes("85000"), "the sell öre must reach the view model (verbatim from the snapshot)");
    // Totals are READ from the frozen row, never re-summed from lines by the view model.
    assert.ok(flat.includes("2125") || flat.includes("212500"), "the accepted-price total must be read verbatim from the snapshot");
  },
);

test(
  "6.3-UNIT-01: the non-final ROT/grön + requiresSignOff framing is present (demo-data-only, never legally-final)",
  GREEN,
  () => {
    const vm = buildQuotePdfViewModel(hostileSnapshot as never);
    // requiresSignOff=true must surface as an explicit non-final / estimate cue on the view
    // model (the PDF is never a legally-final document — MEMORY: keep requiresSignOff framing).
    assert.equal(
      (vm as { requiresSignOff?: boolean }).requiresSignOff,
      true,
      "the view model must carry the requiresSignOff marker so the PDF renders non-final framing",
    );
  },
);

test(
  "6.3-UNIT-01: warnings are DISPLAYED verbatim using the REAL ReadinessCode vocabulary (no re-classification)",
  GREEN,
  () => {
    const vm = buildQuotePdfViewModel(hostileSnapshot as never);
    const flat = JSON.stringify(vm);
    // The captured warning messages/codes are disclosed as-is — the view model NEVER
    // re-runs the classifier and NEVER invents fictional codes (6.1 golden trap).
    assert.ok(flat.includes("TAX_SIGN_OFF_REQUIRED"), "the real TAX_SIGN_OFF_REQUIRED code must survive to the view model");
    assert.equal(flat.includes("REQUIRES_SIGN_OFF"), false, "the FICTIONAL 6.1 golden code must never appear");
    assert.equal(flat.includes("DEDUCTION_ESTIMATE_UNAPPROVED"), false, "the FICTIONAL 6.1 golden code must never appear");
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 6.3-UNIT-01 (extended) — ordering, null-öre, bp→percent formatting, and empty-collection
// edge cases on the PURE builder. These belt the deterministic-projection contract the
// renderer + golden depend on, without a DB or a render pass.
// ─────────────────────────────────────────────────────────────────────────────

/** A minimal well-shaped snapshot; overrides let each edge case tweak a single facet. */
function makeSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...hostileSnapshot,
    lines: [],
    attachments: [],
    warnings: [],
    ...overrides,
  };
}

test("6.3-UNIT-01: lines + attachments are ordered by sortOrder (deterministic projection)", GREEN, () => {
  const vm = buildQuotePdfViewModel(
    makeSnapshot({
      lines: [
        { rowType: "labor", sortOrder: 2, label: "C", description: null, quoteNote: null, quantity: null, unit: null, unitSellOre: null, lineNetOre: null, vatRateBp: null, isHidden: false, isOptional: false, isSelected: null },
        { rowType: "labor", sortOrder: 0, label: "A", description: null, quoteNote: null, quantity: null, unit: null, unitSellOre: null, lineNetOre: null, vatRateBp: null, isHidden: false, isOptional: false, isSelected: null },
        { rowType: "labor", sortOrder: 1, label: "B", description: null, quoteNote: null, quantity: null, unit: null, unitSellOre: null, lineNetOre: null, vatRateBp: null, isHidden: false, isOptional: false, isSelected: null },
      ],
      attachments: [
        { fileId: "22222222-2222-2222-2222-222222222222", displayName: "second", sortOrder: 1 },
        { fileId: "11111111-1111-1111-1111-111111111111", displayName: "first", sortOrder: 0 },
      ],
    }) as never,
  );
  assert.deepEqual(vm.lines.map((l) => l.label), ["A", "B", "C"], "lines must be ordered by sortOrder");
  assert.deepEqual(vm.attachments.map((a) => a.displayName), ["first", "second"], "attachments must be ordered by sortOrder");
});

test("6.3-UNIT-01: a null unit-sell / line-net öre projects to a null kronor string (never '0,00' by accident)", GREEN, () => {
  const vm = buildQuotePdfViewModel(
    makeSnapshot({
      lines: [
        { rowType: "text", sortOrder: 0, label: "Rubrik", description: null, quoteNote: null, quantity: null, unit: null, unitSellOre: null, lineNetOre: null, vatRateBp: null, isHidden: false, isOptional: false, isSelected: null },
      ],
    }) as never,
  );
  assert.equal(vm.lines[0].unitSellKronor, null, "a null sell öre stays null (not formatted)");
  assert.equal(vm.lines[0].lineNetKronor, null, "a null net öre stays null (not formatted)");
  assert.equal(vm.lines[0].vatRatePercent, null, "a null vat bp stays null");
});

test("6.3-UNIT-01: basis-points format to a percent string VERBATIM (2500→'25', 2550→'25.5')", GREEN, () => {
  const vm = buildQuotePdfViewModel(
    makeSnapshot({
      vatRateBp: 2500,
      deductionType: "gron_teknik",
      deductionRateBp: 2550,
      lines: [
        { rowType: "labor", sortOrder: 0, label: "L", description: null, quoteNote: null, quantity: null, unit: null, unitSellOre: null, lineNetOre: null, vatRateBp: 1200, isHidden: false, isOptional: false, isSelected: null },
      ],
    }) as never,
  );
  assert.equal(vm.taxAssumptions.vatRatePercent, "25", "2500 bp → '25'");
  assert.equal(vm.taxAssumptions.deductionRatePercent, "25.5", "2550 bp → '25.5'");
  assert.equal(vm.lines[0].vatRatePercent, "12", "a line's 1200 bp → '12'");
});

test("6.3-UNIT-01: empty lines/attachments/warnings project to empty arrays (a valid, minimal view model)", GREEN, () => {
  const vm = buildQuotePdfViewModel(makeSnapshot() as never);
  assert.deepEqual(vm.lines, [], "no lines → empty lines array");
  assert.deepEqual(vm.attachments, [], "no attachments → empty attachments array");
  assert.deepEqual(vm.warnings, [], "no warnings → empty warnings array");
  // Totals are ALWAYS present (read verbatim from the frozen row), even for an empty version.
  assert.equal(typeof vm.totals.acceptedPriceKronor, "string", "totals are always read from the row");
});

test("6.3-UNIT-01: an absent deduction type carries through as null (the PDF omits the ROT/grön block)", GREEN, () => {
  const vm = buildQuotePdfViewModel(
    makeSnapshot({ deductionType: null, deductionRateBp: null, deductionCapOre: null }) as never,
  );
  assert.equal(vm.taxAssumptions.deductionType, null, "a null deduction type stays null");
  assert.equal(vm.taxAssumptions.deductionRatePercent, null, "a null deduction rate stays null");
  assert.equal(vm.taxAssumptions.deductionCapKronor, null, "a null deduction cap stays null");
});
