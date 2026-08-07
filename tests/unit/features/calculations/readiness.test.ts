/**
 * Story 5.4 — UNIT tests for the PURE readiness classifier (`src/features/calculations/
 * readiness.ts`) + the pure VAT-posture helper (`vat-posture.ts`). The headline coverage target:
 * the classifier is the coverage-shape extraction R-509 requires (a pure function unit-pinned; the
 * E2E only proves blockers GATE the affordance).
 *
 * Coverage (mapped to the epic test design):
 *   - 5.4-UNIT-01 (P0, AC1): ONE case PER rule-table condition asserting its blocker-vs-warning
 *     classification — the classifier separates blockers from warnings DETERMINISTICALLY.
 *   - 5.4-UNIT-02 (P0, AC1): a ROT/grön assumption yields a warning carrying the sign-off /
 *     non-final framing; NO code path renders a deduction approved/legally-final.
 *   - 5.4-UNIT-04 (P1, AC1): the empty-section / zero-price edge classification (warning, at the
 *     boundary — an all-excluded section, a 0-sell counted row).
 *   - VAT posture UNIT (the 5.2 deferral): `resolveVatDisplayPosture` — private→private invariant;
 *     non-private→tenant default AS-IS (company_togglable AND company_excl); brf/public→tenant
 *     default (NOT hard-coded togglable).
 *
 * Driven with fabricated in-memory calc shapes — NO DB, NO PII (R-516). Runs under `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyReadiness,
  PILOT_LOW_MARGIN_THRESHOLD,
  type ReadinessCode,
  type ReadinessInput,
  type ReadinessRowInput,
} from "@/features/calculations/readiness";
import {
  resolveVatDisplayPosture,
  DEFAULT_TENANT_VAT_DISPLAY,
} from "@/features/calculations/vat-posture";

// ─────────────────────────────────────────────────────────────────────────────
// Builders — a fully-valid calc (no issues except the always-present deferral) that
// each case perturbs to trigger exactly one rule.
// ─────────────────────────────────────────────────────────────────────────────

function row(overrides: Partial<ReadinessRowInput> = {}): ReadinessRowInput {
  // Use `in` checks so an EXPLICIT null override (e.g. unit_sell_ore/vat_rate_bp = null) is
  // preserved rather than collapsed to the default by `??`.
  return {
    quantity: "quantity" in overrides ? (overrides.quantity as number) : 1,
    unit_sell_ore: "unit_sell_ore" in overrides ? (overrides.unit_sell_ore as number | null) : 100000, // 1000,00 kr
    unit_cost_ore: "unit_cost_ore" in overrides ? (overrides.unit_cost_ore as number | null) : 50000, // 500,00 kr → TB% 50%
    vat_rate_bp: "vat_rate_bp" in overrides ? (overrides.vat_rate_bp as number | null) : 2500,
    vat_type: overrides.vat_type ?? "STANDARD_VAT_25",
    included_in_invoice_total:
      "included_in_invoice_total" in overrides
        ? (overrides.included_in_invoice_total as boolean)
        : true,
    deduction_classification: overrides.deduction_classification ?? "NONE",
    is_hidden: overrides.is_hidden ?? false,
    is_optional: overrides.is_optional ?? false,
    is_selected: "is_selected" in overrides ? (overrides.is_selected as boolean | null) : null,
    row_type: overrides.row_type ?? "material",
    source_kind: "source_kind" in overrides ? (overrides.source_kind as "work_role" | "article" | null) : null,
  };
}

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    customer: overrides.customer ?? {
      customer_id: "cust-1",
      customer_display_name: "Acme AB",
      customer_type: "company",
      facility_name: "Huvudkontor",
      contact_name: "Erik Kontakt",
    },
    sections: overrides.sections ?? [{ rows: [row()] }],
    vatPostureResolved: overrides.vatPostureResolved ?? true,
    tax: overrides.tax ?? { hasDeductionAssumption: false },
  };
}

/** Collect the codes of all warnings. */
function warningCodes(input: ReadinessInput): ReadinessCode[] {
  return classifyReadiness(input).warnings.map((i) => i.code);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.4-UNIT-01 — one case PER rule-table condition; blocker vs warning.
// ─────────────────────────────────────────────────────────────────────────────

test("5.4-UNIT-01: a fully-valid company calc has NO blockers and can create a quote", () => {
  const report = classifyReadiness(baseInput());
  assert.equal(report.blockers.length, 0);
  assert.equal(report.canCreateQuote, true);
  // The always-present documented deferral is a WARNING, never a blocker.
  assert.ok(report.warnings.some((w) => w.code === "REQUIRED_FILES_DEFERRED"));
});

test("5.4-UNIT-01: MISSING_CUSTOMER is a BLOCKER and gates quote creation", () => {
  const input = baseInput({
    customer: {
      customer_id: null,
      customer_display_name: null,
      customer_type: null,
      facility_name: null,
      contact_name: null,
    },
  });
  const report = classifyReadiness(input);
  assert.ok(report.blockers.some((i) => i.code === "MISSING_CUSTOMER" && i.severity === "blocker"));
  assert.equal(report.canCreateQuote, false);
});

test("5.4-UNIT-01: TOTAL_UNCOMPUTABLE is a BLOCKER (an engine {ok:false} total)", () => {
  // An overflowing sell × quantity forces the engine to reject the total.
  const huge = row({ unit_sell_ore: Number.MAX_SAFE_INTEGER, quantity: 1000, unit_cost_ore: 0 });
  const input = baseInput({ sections: [{ rows: [huge] }] });
  const report = classifyReadiness(input);
  assert.ok(report.blockers.some((i) => i.code === "TOTAL_UNCOMPUTABLE" && i.severity === "blocker"));
  assert.equal(report.canCreateQuote, false);
});

test("5.4-UNIT-01: MISSING_FACILITY is a WARNING (does not gate)", () => {
  const input = baseInput({
    customer: {
      customer_id: "cust-1",
      customer_display_name: "Acme AB",
      customer_type: "company",
      facility_name: null,
      contact_name: "Erik",
    },
  });
  assert.ok(warningCodes(input).includes("MISSING_FACILITY"));
  assert.equal(classifyReadiness(input).canCreateQuote, true);
});

test("5.4-UNIT-01: MISSING_CONTACT is a WARNING (does not gate)", () => {
  const input = baseInput({
    customer: {
      customer_id: "cust-1",
      customer_display_name: "Acme AB",
      customer_type: "company",
      facility_name: "HK",
      contact_name: null,
    },
  });
  assert.ok(warningCodes(input).includes("MISSING_CONTACT"));
  assert.equal(classifyReadiness(input).canCreateQuote, true);
});

test("5.4-UNIT-01: EMPTY_SECTION is a WARNING (a section with zero counted rows)", () => {
  const input = baseInput({ sections: [{ rows: [] }, { rows: [row()] }] });
  assert.ok(warningCodes(input).includes("EMPTY_SECTION"));
  assert.equal(classifyReadiness(input).canCreateQuote, true);
});

test("5.4-UNIT-01: ZERO_PRICE_ROW is a WARNING (a counted null/0-sell row)", () => {
  const input = baseInput({ sections: [{ rows: [row({ unit_sell_ore: 0 })] }] });
  assert.ok(warningCodes(input).includes("ZERO_PRICE_ROW"));
  const nullPrice = baseInput({ sections: [{ rows: [row({ unit_sell_ore: null })] }] });
  assert.ok(warningCodes(nullPrice).includes("ZERO_PRICE_ROW"));
});

test("5.4-UNIT-01: MISSING_WORK_ROLE is a WARNING (a labor row with no work_role source)", () => {
  const input = baseInput({
    sections: [{ rows: [row({ row_type: "labor", source_kind: null })] }],
  });
  assert.ok(warningCodes(input).includes("MISSING_WORK_ROLE"));
  // A labor row WITH a work_role source does NOT warn.
  const withRole = baseInput({
    sections: [{ rows: [row({ row_type: "labor", source_kind: "work_role" })] }],
  });
  assert.ok(!warningCodes(withRole).includes("MISSING_WORK_ROLE"));
});

test("5.4-UNIT-01: LOW_MARGIN is a WARNING (a counted row TB% below the pilot threshold)", () => {
  // sell 100000, cost 95000 → TB% = 5% < 15% pilot threshold.
  const input = baseInput({
    sections: [{ rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 95000 })] }],
  });
  assert.ok(warningCodes(input).includes("LOW_MARGIN"));
  // A healthy margin (50%) does NOT warn.
  assert.ok(!warningCodes(baseInput()).includes("LOW_MARGIN"));
});

test("5.4-UNIT-01: UNRESOLVED_VAT is a WARNING (unresolved tenant posture OR a missing row VAT bp)", () => {
  assert.ok(warningCodes(baseInput({ vatPostureResolved: false })).includes("UNRESOLVED_VAT"));
  const missingRowVat = baseInput({ sections: [{ rows: [row({ vat_rate_bp: null })] }] });
  assert.ok(warningCodes(missingRowVat).includes("UNRESOLVED_VAT"));
  // A resolved posture + present row VAT does NOT warn.
  assert.ok(!warningCodes(baseInput()).includes("UNRESOLVED_VAT"));
});

test("5.4-UNIT-01: TAX_SIGN_OFF_REQUIRED is a WARNING (a ROT/grön assumption present)", () => {
  const input = baseInput({
    tax: { hasDeductionAssumption: true, deductionType: "rot", eligibilityPosture: "private" },
  });
  assert.ok(warningCodes(input).includes("TAX_SIGN_OFF_REQUIRED"));
  assert.equal(classifyReadiness(input).canCreateQuote, true);
});

test("5.4-UNIT-01: HIDDEN_ROWS_INCLUDED is an INFORMATIONAL WARNING (a counted hidden row)", () => {
  const input = baseInput({ sections: [{ rows: [row({ is_hidden: true })] }] });
  assert.ok(warningCodes(input).includes("HIDDEN_ROWS_INCLUDED"));
  // No hidden counted row → no disclosure.
  assert.ok(!warningCodes(baseInput()).includes("HIDDEN_ROWS_INCLUDED"));
});

test("5.4-UNIT-01: REQUIRED_FILES_DEFERRED is ALWAYS a WARNING (documented Story 8.1 deferral)", () => {
  assert.ok(warningCodes(baseInput()).includes("REQUIRED_FILES_DEFERRED"));
  const report = classifyReadiness(baseInput());
  assert.ok(
    report.warnings.find((w) => w.code === "REQUIRED_FILES_DEFERRED")?.severity === "warning",
  );
});

test("5.4-UNIT-01: canCreateQuote is derived SOLELY from blockers (warnings never gate)", () => {
  // A calc with MANY warnings but no blocker can still create a quote.
  const input = baseInput({
    customer: {
      customer_id: "cust-1",
      customer_display_name: "Acme AB",
      customer_type: "company",
      facility_name: null, // MISSING_FACILITY
      contact_name: null, // MISSING_CONTACT
    },
    sections: [{ rows: [row({ unit_sell_ore: 0 })] }], // ZERO_PRICE_ROW + LOW/HIDDEN etc.
    vatPostureResolved: false, // UNRESOLVED_VAT
  });
  const report = classifyReadiness(input);
  assert.ok(report.warnings.length >= 3);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.canCreateQuote, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.4-UNIT-02 — the tax warning carries sign-off / non-final framing; NO path
// renders a deduction approved/legally-final.
// ─────────────────────────────────────────────────────────────────────────────

test("5.4-UNIT-02: a ROT assumption warning is framed as an ESTIMATE requiring sign-off (never final)", () => {
  const input = baseInput({
    tax: { hasDeductionAssumption: true, deductionType: "rot", eligibilityPosture: "private" },
  });
  const report = classifyReadiness(input);
  const tax = report.warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
  assert.ok(tax, "the tax warning must be present");
  // NON-FINAL framing: an estimate requiring sign-off, not a legally-final/approved deduction.
  assert.match(tax!.message, /uppskattning/i);
  assert.match(tax!.message, /kräver godkännande/i);
  assert.match(tax!.message, /inte ett slutgiltigt/i);
});

test("5.4-UNIT-02: NO readiness message renders a deduction as approved / legally-final", () => {
  const input = baseInput({
    tax: { hasDeductionAssumption: true, deductionType: "gron_teknik", eligibilityPosture: "private" },
  });
  const report = classifyReadiness(input);
  const tax = report.warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
  assert.ok(tax);
  // Finality is only ever NEGATED — "inte ett slutgiltigt ... avdrag" — never asserted positively.
  // A positive-finality claim would be the phrase WITHOUT the preceding negation ("inte ...").
  assert.match(tax!.message, /inte ett slutgiltigt eller juridiskt fastställt avdrag/i);
  // No message anywhere claims the deduction IS approved (a positive "är godkänt/godkänd").
  const allMessages = [...report.blockers, ...report.warnings].map((i) => i.message).join(" ");
  assert.doesNotMatch(allMessages, /avdraget är godkänt|godkänt och slutgiltigt/i);
});

test("5.4-UNIT-02: a NON-private eligibility posture surfaces an eligibility note (never PII)", () => {
  const input = baseInput({
    tax: { hasDeductionAssumption: true, deductionType: "rot", eligibilityPosture: "company" },
  });
  const tax = classifyReadiness(input).warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
  assert.ok(tax);
  assert.match(tax!.message, /privatkunder/i);
  // The message NEVER implies a per-person-scaled cap (R-512) and carries no personnummer.
  assert.doesNotMatch(tax!.message, /per person|\bpersonnummer\b|\d{6}-\d{4}/i);
});

test("5.4-UNIT-02: NO deduction assumption → NO tax warning", () => {
  assert.ok(!warningCodes(baseInput()).includes("TAX_SIGN_OFF_REQUIRED"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.4-UNIT-04 — empty-section / zero-price edge classification at the boundary.
// ─────────────────────────────────────────────────────────────────────────────

test("5.4-UNIT-04: an all-EXCLUDED section (only unselected options) classifies as EMPTY_SECTION", () => {
  // The only row is an unselected option → it does NOT count → the section is empty.
  const unselected = row({
    is_optional: true,
    is_selected: false,
    included_in_invoice_total: false,
  });
  const input = baseInput({ sections: [{ rows: [unselected] }] });
  const codes = warningCodes(input);
  assert.ok(codes.includes("EMPTY_SECTION"), "an all-unselected section is empty");
  // The unselected option must NOT trigger a zero-price / low-margin / hidden warning (it is excluded).
  assert.ok(!codes.includes("HIDDEN_ROWS_INCLUDED"));
});

test("5.4-UNIT-04: a SELECTED option in an otherwise-empty section is counted (NOT empty)", () => {
  const selected = row({ is_optional: true, is_selected: true });
  const input = baseInput({ sections: [{ rows: [selected] }] });
  assert.ok(!warningCodes(input).includes("EMPTY_SECTION"), "a selected option counts");
});

test("5.4-UNIT-04: a 0-sell COUNTED row is ZERO_PRICE_ROW and NOT LOW_MARGIN (no divide-by-zero)", () => {
  const input = baseInput({ sections: [{ rows: [row({ unit_sell_ore: 0, unit_cost_ore: 5000 })] }] });
  const codes = warningCodes(input);
  assert.ok(codes.includes("ZERO_PRICE_ROW"));
  assert.ok(!codes.includes("LOW_MARGIN"), "a 0-sell row has no defined margin — ZERO_PRICE owns it");
});

test("5.4-UNIT-04: a margin EXACTLY at the threshold does NOT warn (strictly-below boundary)", () => {
  // Choose sell/cost so TB% == threshold exactly. threshold 0.15 → sell 100000, cost 85000 → 0.15.
  const atThreshold = row({ unit_sell_ore: 100000, unit_cost_ore: 85000 });
  const input = baseInput({ sections: [{ rows: [atThreshold] }] });
  assert.equal(
    Math.round(((100000 - 85000) / 100000) * 100) / 100,
    PILOT_LOW_MARGIN_THRESHOLD,
    "sanity: the fixture margin equals the threshold",
  );
  assert.ok(!warningCodes(input).includes("LOW_MARGIN"), "exactly-at-threshold does not warn");
});

// ─────────────────────────────────────────────────────────────────────────────
// VAT posture helper (the 5.2 deferral) — private→private; non-private→tenant AS-IS.
// ─────────────────────────────────────────────────────────────────────────────

test("resolveVatDisplayPosture: a PRIVATE customer → the 'private' invariant regardless of tenant default", () => {
  assert.equal(resolveVatDisplayPosture("private", "company_togglable"), "private");
  assert.equal(resolveVatDisplayPosture("private", "company_excl"), "private");
});

test("resolveVatDisplayPosture: a COMPANY customer → the tenant default AS-IS (both modes)", () => {
  assert.equal(resolveVatDisplayPosture("company", "company_togglable"), "company_togglable");
  assert.equal(resolveVatDisplayPosture("company", "company_excl"), "company_excl");
});

test("resolveVatDisplayPosture: BRF / PUBLIC → the tenant default AS-IS (NOT hard-coded togglable)", () => {
  assert.equal(resolveVatDisplayPosture("brf", "company_excl"), "company_excl");
  assert.equal(resolveVatDisplayPosture("public", "company_excl"), "company_excl");
  assert.equal(resolveVatDisplayPosture("brf", "company_togglable"), "company_togglable");
});

test("resolveVatDisplayPosture: an absent tenant default → the conservative togglable fallback", () => {
  assert.equal(resolveVatDisplayPosture("company", null), DEFAULT_TENANT_VAT_DISPLAY);
  assert.equal(resolveVatDisplayPosture("company", undefined), "company_togglable");
});

test("resolveVatDisplayPosture: an UNKNOWN/absent customer type is treated as non-private (tenant default)", () => {
  assert.equal(resolveVatDisplayPosture(null, "company_excl"), "company_excl");
  assert.equal(resolveVatDisplayPosture(undefined, "company_togglable"), "company_togglable");
});

test("resolveVatDisplayPosture: an unrecognised NON-EMPTY type string still takes the tenant default (not private)", () => {
  // A future/unknown customer-type value must NOT silently collapse to `private` (which would
  // wrongly hide the incl/excl toggle for a company-shaped customer). It follows the non-private path.
  assert.equal(resolveVatDisplayPosture("foretag", "company_excl"), "company_excl");
  assert.equal(resolveVatDisplayPosture("PRIVATE", "company_excl"), "company_excl"); // case-sensitive: not the literal "private"
  assert.equal(resolveVatDisplayPosture("", "company_togglable"), "company_togglable"); // empty string is non-private
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPANDED COVERAGE (bmad-testarch-automate) — additional branches / contracts of the
// implemented classifier that the headline UNIT cases did not yet pin. All pure, fast-gate.
// ─────────────────────────────────────────────────────────────────────────────

// ── Report-shape contract: blockers and warnings COEXIST; warnings never dropped ──

test("EXPANDED: a blocker and warnings COEXIST — a blocker never suppresses the warning list", () => {
  // A calc that has BOTH a blocker (missing customer) AND several warnings must surface both —
  // the warnings do not silently disappear when a blocker is present (the E2E asserts this at the
  // UI; this pins it at the pure-classifier contract level).
  const input = baseInput({
    customer: {
      customer_id: null, // MISSING_CUSTOMER blocker
      customer_display_name: null,
      customer_type: null,
      facility_name: null, // MISSING_FACILITY warning
      contact_name: null, // MISSING_CONTACT warning
    },
  });
  const report = classifyReadiness(input);
  assert.ok(report.blockers.some((b) => b.code === "MISSING_CUSTOMER"));
  assert.ok(report.warnings.some((w) => w.code === "MISSING_FACILITY"));
  assert.ok(report.warnings.some((w) => w.code === "MISSING_CONTACT"));
  assert.equal(report.canCreateQuote, false);
});

test("EXPANDED: every issue carries a non-empty message and its stated severity matches its group", () => {
  const input = baseInput({
    customer: {
      customer_id: null,
      customer_display_name: null,
      customer_type: null,
      facility_name: null,
      contact_name: null,
    },
    sections: [{ rows: [row({ unit_sell_ore: 0 })] }],
    vatPostureResolved: false,
    tax: { hasDeductionAssumption: true, deductionType: "rot", eligibilityPosture: "private" },
  });
  const report = classifyReadiness(input);
  for (const b of report.blockers) {
    assert.equal(b.severity, "blocker", `blocker ${b.code} must carry severity "blocker"`);
    assert.ok(b.message.trim().length > 0, `blocker ${b.code} must carry a non-empty message`);
  }
  for (const w of report.warnings) {
    assert.equal(w.severity, "warning", `warning ${w.code} must carry severity "warning"`);
    assert.ok(w.message.trim().length > 0, `warning ${w.code} must carry a non-empty message`);
  }
});

test("EXPANDED: NO readiness message anywhere leaks öre / basis-point jargon (kronor/percent at the boundary)", () => {
  // A calc that triggers as many rules as possible; assert no message exposes internal öre/bp units.
  const input = baseInput({
    customer: {
      customer_id: "c1",
      customer_display_name: "Acme",
      customer_type: "company",
      facility_name: null,
      contact_name: null,
    },
    sections: [{ rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 99000 })] }], // LOW_MARGIN
    vatPostureResolved: false,
    tax: { hasDeductionAssumption: true, deductionType: "gron_teknik" },
  });
  const report = classifyReadiness(input);
  const allMessages = [...report.blockers, ...report.warnings].map((i) => i.message).join(" ");
  assert.doesNotMatch(allMessages, /\böre\b/i, "no message may expose öre jargon");
  assert.doesNotMatch(allMessages, /basispunkt|basis point|\bbp\b/i, "no message may expose basis-point jargon");
});

// ── MISSING_CUSTOMER: the OR branch (id present but display name null) ──

test("EXPANDED: MISSING_CUSTOMER also fires when the id is present but the display name is null", () => {
  const input = baseInput({
    customer: {
      customer_id: "cust-1",
      customer_display_name: null, // the OR branch of the blocker predicate
      customer_type: "company",
      facility_name: "HK",
      contact_name: "Erik",
    },
  });
  const report = classifyReadiness(input);
  assert.ok(report.blockers.some((b) => b.code === "MISSING_CUSTOMER"));
  assert.equal(report.canCreateQuote, false);
});

// ── LOW_MARGIN: quantity-invariance + aggregation across sections + negative margin ──

test("EXPANDED: LOW_MARGIN is quantity-invariant (the ratio depends on unit sell/cost, not quantity)", () => {
  // Same unit sell/cost, quantity 7 → the TB% ratio is unchanged; a low-margin unit stays low-margin.
  const lowQ7 = baseInput({
    sections: [{ rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 95000, quantity: 7 })] }],
  });
  assert.ok(warningCodes(lowQ7).includes("LOW_MARGIN"), "quantity does not rescue a low unit margin");
  const healthyQ7 = baseInput({
    sections: [{ rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 20000, quantity: 7 })] }],
  });
  assert.ok(!warningCodes(healthyQ7).includes("LOW_MARGIN"), "quantity does not create a spurious low margin");
});

test("EXPANDED: a NEGATIVE margin (cost above sell) warns as LOW_MARGIN", () => {
  const loss = baseInput({
    sections: [{ rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 150000 })] }],
  });
  assert.ok(warningCodes(loss).includes("LOW_MARGIN"), "a below-cost sell price is under threshold");
});

test("EXPANDED: LOW_MARGIN aggregates across sections and warns ONCE even with several low-margin rows", () => {
  const input = baseInput({
    sections: [
      { rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 20000 })] }, // healthy
      { rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 96000 })] }, // low margin
      { rows: [row({ unit_sell_ore: 100000, unit_cost_ore: 97000 })] }, // low margin
    ],
  });
  const lowMarginCount = classifyReadiness(input).warnings.filter((w) => w.code === "LOW_MARGIN").length;
  assert.equal(lowMarginCount, 1, "the low-margin warning is aggregated to a single entry");
});

test("EXPANDED: a null unit_cost is 'cost unknown' → no defined margin → NO low-margin warning (NOT a false 100%)", () => {
  // A genuinely unset cost must NOT read as zero-cost / a false 100% margin (a fail-OPEN that
  // would hide a pricing risk). It has no computable margin → the low-margin gate skips it.
  const input = baseInput({
    sections: [{ rows: [row({ unit_sell_ore: 100000, unit_cost_ore: null })] }],
  });
  assert.ok(!warningCodes(input).includes("LOW_MARGIN"), "unknown cost → no computable margin → gate skips it");
});

// ── EMPTY_SECTION multiplicity: one warning per empty section ──

test("EXPANDED: TWO empty sections yield TWO EMPTY_SECTION warnings (per-section, not deduped)", () => {
  const input = baseInput({ sections: [{ rows: [] }, { rows: [] }, { rows: [row()] }] });
  const emptyCount = classifyReadiness(input).warnings.filter((w) => w.code === "EMPTY_SECTION").length;
  assert.equal(emptyCount, 2, "each empty section contributes its own EMPTY_SECTION warning");
});

// ── MISSING_WORK_ROLE: only labor, only counted ──

test("EXPANDED: a non-labor row without a work_role source does NOT trigger MISSING_WORK_ROLE", () => {
  const input = baseInput({
    sections: [{ rows: [row({ row_type: "material", source_kind: null })] }],
  });
  assert.ok(!warningCodes(input).includes("MISSING_WORK_ROLE"));
});

test("EXPANDED: an UNSELECTED-option labor row without a work_role is excluded and does NOT warn", () => {
  // The row is not counted (unselected option), so no work-role warning is raised for it.
  const input = baseInput({
    sections: [
      {
        rows: [
          row({
            row_type: "labor",
            source_kind: null,
            is_optional: true,
            is_selected: false,
            included_in_invoice_total: false,
          }),
          row(), // a counted material row keeps the section non-empty
        ],
      },
    ],
  });
  assert.ok(!warningCodes(input).includes("MISSING_WORK_ROLE"), "an excluded row raises no work-role warning");
});

// ── HIDDEN_ROWS_INCLUDED: only counted hidden rows disclose ──

test("EXPANDED: a HIDDEN but UNSELECTED-option row is excluded → NO hidden-rows-included disclosure", () => {
  const input = baseInput({
    sections: [
      {
        rows: [
          row({
            is_hidden: true,
            is_optional: true,
            is_selected: false,
            included_in_invoice_total: false,
          }), // excluded → not counted
          row(), // a counted, visible row
        ],
      },
    ],
  });
  assert.ok(
    !warningCodes(input).includes("HIDDEN_ROWS_INCLUDED"),
    "an excluded hidden option is not counted, so it discloses nothing",
  );
});

test("EXPANDED: a HIDDEN SELECTED option IS counted → the hidden-rows-included disclosure fires", () => {
  const input = baseInput({
    sections: [{ rows: [row({ is_hidden: true, is_optional: true, is_selected: true })] }],
  });
  assert.ok(warningCodes(input).includes("HIDDEN_ROWS_INCLUDED"));
});

// ── TAX_SIGN_OFF_REQUIRED: label variants + no spurious eligibility note for private ──

test("EXPANDED: the grön-teknik tax warning uses the 'Grön teknik-avdraget' label", () => {
  const input = baseInput({
    tax: { hasDeductionAssumption: true, deductionType: "gron_teknik", eligibilityPosture: "private" },
  });
  const tax = classifyReadiness(input).warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
  assert.ok(tax);
  assert.match(tax!.message, /Grön teknik-avdraget/);
});

test("EXPANDED: a deduction assumption with NO deductionType uses the generic 'Skatteavdraget' label", () => {
  const input = baseInput({ tax: { hasDeductionAssumption: true } });
  const tax = classifyReadiness(input).warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
  assert.ok(tax);
  assert.match(tax!.message, /Skatteavdraget/);
  // Still framed non-final.
  assert.match(tax!.message, /uppskattning/i);
});

test("EXPANDED: a PRIVATE eligibility posture adds NO 'endast privatkunder' note (only non-private does)", () => {
  const input = baseInput({
    tax: { hasDeductionAssumption: true, deductionType: "rot", eligibilityPosture: "private" },
  });
  const tax = classifyReadiness(input).warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
  assert.ok(tax);
  assert.doesNotMatch(tax!.message, /privatkunder/i, "no eligibility caveat is added for an already-private posture");
});

// ── ROT × grön mix caution: the classifier never asserts a per-person cap regardless of type ──

test("EXPANDED: no tax message implies a per-person-scaled cap for ANY deduction type (R-512)", () => {
  for (const deductionType of ["rot", "gron_teknik"] as const) {
    const input = baseInput({
      tax: { hasDeductionAssumption: true, deductionType, eligibilityPosture: "private" },
    });
    const tax = classifyReadiness(input).warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
    assert.ok(tax);
    assert.doesNotMatch(tax!.message, /per person|per capita|antal personer/i);
  }
});

test("a calculation with more than 500 active rows is blocked before quote creation", () => {
  const input = baseInput({
    sections: [{ rows: Array.from({ length: 501 }, () => row()) }],
  });
  const report = classifyReadiness(input);
  assert.ok(
    report.blockers.some(
      (issue) => issue.code === "CALCULATION_ROW_LIMIT_EXCEEDED" && issue.severity === "blocker",
    ),
  );
  assert.equal(report.canCreateQuote, false);
});

test("10.6-UNIT: every tax-answer failure category is a quote-creation blocker", () => {
  const codes = [
    "MISSING_TAX_INPUT",
    "MISSING_BUYER_VAT_NUMBER",
    "MISSING_TAX_RESOLVING_DATE",
    "MISSING_TAX_RESOLVING_PROFILE",
    "INVALID_DEDUCTION_CLASSIFICATION",
    "INSUFFICIENT_PERSON_ALLOWANCE",
    "INCOMPLETE_FIXED_PRICE_CATEGORY_SPLIT",
    "INVALID_FIXED_PRICE_SCHABLON",
    "INCOMPLETE_VAT_INPUT",
  ] as const;
  const report = classifyReadiness(
    baseInput({
      tax: { hasDeductionAssumption: true, blockingCodes: codes },
    }),
  );
  assert.deepEqual(report.blockers.map((issue) => issue.code), codes);
  assert.equal(report.canCreateQuote, false);
  assert.ok(report.blockers.every((issue) => issue.severity === "blocker"));
});

test("10.6-UNIT: an explicitly excluded overflow row cannot poison readiness totals", () => {
  const report = classifyReadiness(
    baseInput({
      sections: [
        {
          rows: [
            row({
              quantity: Number.MAX_SAFE_INTEGER,
              unit_sell_ore: Number.MAX_SAFE_INTEGER,
              included_in_invoice_total: false,
              is_optional: false,
              is_selected: null,
            }),
          ],
        },
      ],
    }),
  );
  assert.equal(
    report.blockers.some((issue) => issue.code === "TOTAL_UNCOMPUTABLE"),
    false,
  );
});
