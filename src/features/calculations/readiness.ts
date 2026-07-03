/**
 * PURE calculation-readiness classifier (Story 5.4, Task 1 / AC1) — the headline deliverable.
 *
 * READINESS IS A RULE TABLE, NOT PROSE (R-509). This module separates BLOCKING issues from
 * WARNINGS via a PURE, I/O-free classifier — extracted from any `"use client"` component so the
 * `node --test` fast gate protects it (the coverage-shape lesson: a blocker that only warns, or a
 * tax warning that reads as legally final, is the core risk — a classification regression that
 * lived inline in a client island would escape the fast unit gate and could silently misclassify,
 * so an unsafe customer commitment gets versioned). Mirrors `totals.ts` — the model of a pure
 * extracted contract protected by the fast gate.
 *
 * PURITY: NO `"use client"`, NO DB, NO clock, NO network, NO PII. It takes the already-read calc
 * detail (header + sections + rows + resolved customer context + resolved VAT posture + resolved
 * tax posture) as plain in-memory values and returns a typed `ReadinessReport`. Personnummer NEVER
 * enters this classifier (the customer context carries display fields + a TYPE only; R-516).
 *
 * MONEY DISCIPLINE (R-505): every öre op DELEGATES to `@/lib/money` via `totals.ts`. The classifier
 * calls `computeCalcTotal` to detect an engine-REJECTED total (an `{ok:false}` → a BLOCKER) and to
 * detect the frozen-inclusion state, and computes TB% as a pure ratio of already-öre values (integer
 * öre in, a ratio out — no öre arithmetic invented). There is NO inline `+`/`*`/`0.25` here.
 *
 * INCLUSION (frozen 2026-06-18, R-508): hidden rows + selected tillval COUNT toward totals; an
 * unselected option does NOT (`totals.ts#rowCountsTowardTotal` already implements it). The readiness
 * surface adds an INFORMATIONAL disclosure warning that hidden rows COUNT (a disclosure, NOT a
 * defect); it does NOT re-decide the inclusion rule.
 *
 * TAX (R-509/R-512/R-516): a ROT/grön assumption present on the calc surfaces the engine's
 * `requiresSignOff: true` posture with NON-FINAL "estimate requiring sign-off" framing — a deduction
 * is NEVER rendered approved/legally-final. The eligibility POSTURE feeding any deduction is the
 * resolved posture (`private`-only per 2026-06-18), NEVER a personnummer. `persons` stays a flat-cap
 * placeholder (R-512) — the classifier NEVER asserts a per-person-scaled cap.
 *
 * BLOCKER vs WARNING split (conservative default, Open Question 2 / Sign-Off Q2 owner-pending):
 * BLOCKERS (hard, GATE quote creation) = MISSING CUSTOMER + an ENGINE-REJECTED total (`{ok:false}`).
 * EVERYTHING ELSE is a WARNING (soft, does NOT gate) — fail-open on classification is safer than a
 * spurious hard gate for a pilot. A DIFFERENT split treated as production-approved is a STOP.
 *
 * [Source: epics.md#Story 5.4 AC1 (the full warning list); test-design-epic-5.md#5.4-UNIT-01/02/04,
 *  Testability Notes 4, R-508/R-509/R-512/R-513/R-516; owner-decisions-applied-2026-06-18.md#Epic
 *  5·5.4/5.5 (margin = TB% vs threshold; hidden rows DO count); ux-design-specification.md#Readiness
 *  and safety; src/features/calculations/totals.ts (the totals + inclusion authority to REUSE);
 *  src/lib/money#estimateDeduction/requiresSignOff/EligibilityPosture]
 */
import {
  computeCalcTotal,
  rowCountsTowardTotal,
  type TotalsRowInput,
} from "./totals";

/**
 * The CLOSED union of readiness rule-table codes — ONE code per rule-table condition. A stable,
 * machine-assertable discriminant a UNIT case pins its blocker-vs-warning classification against
 * (5.4-UNIT-01 enumerates one case per condition). Adding a condition adds a code here; removing
 * one is a contract change.
 */
export type ReadinessCode =
  // ── BLOCKERS (hard, GATE quote creation) ──
  /** No customer linked to the calc — a quote genuinely cannot be created without one. */
  | "MISSING_CUSTOMER"
  /** The whole-calc total could not be computed (an engine `{ok:false}` — overflow / invalid row). */
  | "TOTAL_UNCOMPUTABLE"
  // ── WARNINGS (soft, do NOT gate) ──
  /** A counted row/section/calc TB% is below the pilot low-margin threshold. */
  | "LOW_MARGIN"
  /** No facility linked (a warning — a facility is not always required). */
  | "MISSING_FACILITY"
  /** No contact linked (a warning — a contact is not always required). */
  | "MISSING_CONTACT"
  /** A section has zero COUNTED rows (empty / all-excluded). */
  | "EMPTY_SECTION"
  /** A counted row has a null/zero sell price. */
  | "ZERO_PRICE_ROW"
  /** A labor row has no `source_kind='work_role'` (no work role attached). */
  | "MISSING_WORK_ROLE"
  /** The tenant VAT posture is unresolved (settings read fault / no row), or a counted row's VAT bp is missing. */
  | "UNRESOLVED_VAT"
  /** A ROT/grön assumption is present → the deduction is an ESTIMATE requiring sign-off (never final). */
  | "TAX_SIGN_OFF_REQUIRED"
  /** INFORMATIONAL: hidden rows COUNT toward totals (a disclosure per the 2026-06-18 pin — NOT a defect). */
  | "HIDDEN_ROWS_INCLUDED"
  /** DOCUMENTED DEFERRAL: required-file checking is not yet available (Story 8.1 has not landed, R-513). */
  | "REQUIRED_FILES_DEFERRED";

/** Severity of a readiness issue — a `blocker` GATES quote creation; a `warning` does not. */
export type ReadinessSeverity = "blocker" | "warning";

/** A single classified readiness issue: a stable code + a severity + a generic Swedish message. */
export interface ReadinessIssue {
  readonly code: ReadinessCode;
  readonly severity: ReadinessSeverity;
  /**
   * A GENERIC Swedish message (kronor/percent at the boundary — NO öre/basis-point jargon). Tax
   * messages are framed as an ESTIMATE requiring sign-off; a deduction is NEVER rendered final.
   */
  readonly message: string;
}

/** The classified readiness report — blockers separated from warnings + the gate flag. */
export interface ReadinessReport {
  readonly blockers: readonly ReadinessIssue[];
  readonly warnings: readonly ReadinessIssue[];
  /** `true` iff there are NO blockers (the create-quote affordance gate). */
  readonly canCreateQuote: boolean;
}

/**
 * The pilot LOW-MARGIN threshold as a CONSTANT (Open Question 1 / conservative default). The
 * 2026-06-18 owner decision says "margin warning = TB% vs a global threshold in settings" — but NO
 * `company_settings.margin_threshold_bp` column exists yet (adding one is a GATED migration +
 * settings-UI expansion, arguably beyond the readiness-classifier scope). Until the per-tenant
 * setting lands, the low-margin warning uses this documented UNAPPROVED/pilot default. The warning
 * is SOFT (never a blocker), so a conservative constant is safe. TB% = (sell − cost) / sell; a
 * counted row/section/calc TB% strictly below this warns. Expressed as a fraction (0.15 = 15%).
 *
 * DEFERRED: the configurable per-tenant `margin_threshold` (a `company_settings` column + editor)
 * is a documented follow-up — owner "Story 5.4 / margin-threshold-setting-when-approved".
 */
export const PILOT_LOW_MARGIN_THRESHOLD = 0.15;

/** The customer-context slice the classifier reads (display fields + a TYPE only — NEVER a personnummer). */
export interface ReadinessCustomerContext {
  readonly customer_id: string | null;
  readonly customer_display_name: string | null;
  readonly customer_type: string | null;
  readonly facility_name: string | null;
  readonly contact_name: string | null;
}

/** The minimal row shape the classifier reads (a superset of `TotalsRowInput` with the classify fields). */
export interface ReadinessRowInput extends TotalsRowInput {
  readonly row_type: "labor" | "material" | "subcontractor" | "machinery" | "other";
  /** Unit COST öre (for the TB% ratio; null → cost UNKNOWN → no defined margin, never 0-cost). */
  readonly unit_cost_ore: number | null;
  /** The FROZEN pricing-source kind (a labor row with `work_role` has a work role attached). */
  readonly source_kind: "work_role" | "article" | null;
}

/** A section as the classifier reads it. */
export interface ReadinessSectionInput {
  readonly rows: readonly ReadinessRowInput[];
}

/** The resolved tax posture the classifier reads — is a ROT/grön assumption in play, and its eligibility. */
export interface ReadinessTaxContext {
  /** True iff a ROT or grön-teknik deduction assumption is present on the calc. */
  readonly hasDeductionAssumption: boolean;
  /** The deduction category, when a deduction is present (for the message framing). */
  readonly deductionType?: "rot" | "gron_teknik";
  /** The resolved eligibility posture (`private` is the only eligible one per 2026-06-18). NEVER a personnummer. */
  readonly eligibilityPosture?: "private" | "company" | "brf" | "public";
}

/** The full classifier input — the already-read calc detail + resolved postures. */
export interface ReadinessInput {
  readonly customer: ReadinessCustomerContext;
  readonly sections: readonly ReadinessSectionInput[];
  /** Whether the tenant VAT posture resolved from settings (false → a "VAT unresolved" warning). */
  readonly vatPostureResolved: boolean;
  /** The resolved tax context (a ROT/grön assumption + its eligibility posture). */
  readonly tax: ReadinessTaxContext;
}

/**
 * The pure ROW-inclusion predicate reused from `totals.ts` — a row COUNTS unless it is an UNSELECTED
 * option (the frozen 2026-06-18 inclusion pin). The classifier reasons ONLY about counted rows for
 * every totals-facing condition (empty section, zero-price, low margin, hidden-rows-included), so an
 * unselected option never triggers a spurious warning.
 */
function counts(row: ReadinessRowInput): boolean {
  return rowCountsTowardTotal(row);
}

/**
 * The per-line TB% (contribution margin ratio) from integer öre: `(sell − cost) / sell`. A pure
 * ratio of already-öre PER-UNIT values — integer öre in, a ratio out (no öre arithmetic invented,
 * R-505). Computed PER-UNIT: `quantity` cancels out of the ratio entirely, so multiplying both
 * terms by it is dead arithmetic that only pushes the operands toward `Number.MAX_SAFE_INTEGER`
 * (the same overflow class 5.4-E2E-01 seeds) — it is deliberately dropped here.
 *
 * NULL-COST POLICY (integration review): a counted row with a genuinely unknown/unset cost
 * (`unit_cost_ore = null`) has NO defined margin → returns `null` (the low-margin gate skips it),
 * NOT a treat-as-zero-cost that reads as a false 100% margin and silently suppresses LOW_MARGIN —
 * a fail-OPEN that hides a pricing risk. An unknown cost is "cost unknown", not "cost is 0".
 *
 * A zero (or absent) sell price also has NO defined margin → `null` (the ZERO_PRICE_ROW rule owns
 * that condition; a 0-sell row must not read as a divide-by-zero -Infinity margin). Non-finite /
 * unsafe-integer operands (a crafted overflow) → `null` rather than a corrupted ratio.
 */
function rowMarginRatio(row: ReadinessRowInput): number | null {
  // A null cost is UNKNOWN, not zero — no defined margin (do not fail open to 100%).
  if (row.unit_cost_ore === null) return null;
  const sell = row.unit_sell_ore ?? 0;
  const cost = row.unit_cost_ore;
  // A 0/absent sell price has no defined margin (ZERO_PRICE_ROW owns it).
  if (sell <= 0) return null;
  // Guard against non-finite / out-of-safe-range operands corrupting the ratio.
  if (!Number.isSafeInteger(sell) || !Number.isSafeInteger(cost)) return null;
  return (sell - cost) / sell;
}

/**
 * Classify a calculation's readiness into blockers + warnings per the explicit rule table.
 *
 * Order is deterministic (blockers first in code order, then warnings) so the report is stable for
 * the UNIT pins. Each condition maps to exactly ONE `ReadinessCode`. `canCreateQuote` is derived
 * SOLELY from `blockers.length === 0` — warnings never gate.
 */
export function classifyReadiness(input: ReadinessInput): ReadinessReport {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  // ── BLOCKER: missing customer ────────────────────────────────────────────────
  // A quote genuinely cannot be created without a customer (Open Question 2 / Sign-Off Q2 — the
  // one condition that is a blocker even when the split is otherwise fail-open to WARNING).
  if (!input.customer.customer_id || !input.customer.customer_display_name) {
    blockers.push({
      code: "MISSING_CUSTOMER",
      severity: "blocker",
      message: "Kalkylen saknar en kund. En offert kan inte skapas utan en kund.",
    });
  }

  // ── BLOCKER: the whole-calc total cannot be computed (an engine {ok:false}) ───
  // Route through the totals engine (never inline math). A rejected total (overflow / invalid row)
  // means no valid quote total can be produced — a hard gate. Also used below to reason about the
  // included rows without re-deriving.
  const calcTotal = computeCalcTotal(
    input.sections.map((s) => ({
      rows: s.rows.map((r) => ({
        quantity: r.quantity,
        unit_sell_ore: r.unit_sell_ore,
        vat_rate_bp: r.vat_rate_bp,
        is_hidden: r.is_hidden,
        is_optional: r.is_optional,
        is_selected: r.is_selected,
      })),
    })),
  );
  if (!calcTotal.ok) {
    blockers.push({
      code: "TOTAL_UNCOMPUTABLE",
      severity: "blocker",
      message:
        "Totalsumman kunde inte beräknas. Kontrollera raderna innan du skapar en offert.",
    });
  }

  // ── WARNING: missing facility / contact (where relevant) ─────────────────────
  if (!input.customer.facility_name) {
    warnings.push({
      code: "MISSING_FACILITY",
      severity: "warning",
      message:
        "Ingen anläggning är kopplad till kalkylen. Kontrollera att detta stämmer.",
    });
  }
  if (!input.customer.contact_name) {
    warnings.push({
      code: "MISSING_CONTACT",
      severity: "warning",
      message:
        "Ingen kontaktperson är kopplad till kalkylen. Kontrollera att detta stämmer.",
    });
  }

  // ── Per-section / per-row scans (counted rows only — the frozen inclusion pin) ─
  let anyHiddenCounted = false;
  let anyLowMargin = false;
  const allRows: ReadinessRowInput[] = [];
  for (const section of input.sections) {
    const counted = section.rows.filter((r) => counts(r));
    // Empty section: zero COUNTED rows (all-excluded or genuinely empty).
    if (counted.length === 0) {
      warnings.push({
        code: "EMPTY_SECTION",
        severity: "warning",
        message:
          "En sektion saknar rader som räknas med. Tomma sektioner tas inte med i summan.",
      });
    }
    for (const row of counted) {
      allRows.push(row);
      // A counted HIDDEN row → the informational disclosure flag (raised once below).
      if (row.is_hidden) anyHiddenCounted = true;
      // Low margin: a counted row TB% strictly below the pilot threshold (skip 0-sell rows — the
      // ZERO_PRICE_ROW rule owns those; a 0-sell row has no defined margin).
      const margin = rowMarginRatio(row);
      if (margin !== null && margin < PILOT_LOW_MARGIN_THRESHOLD) {
        anyLowMargin = true;
      }
    }
  }

  // ── WARNING: zero-price rows (a counted row with null/0 sell) ─────────────────
  const hasZeroPriceRow = allRows.some(
    (r) => r.unit_sell_ore === null || r.unit_sell_ore === 0,
  );
  if (hasZeroPriceRow) {
    warnings.push({
      code: "ZERO_PRICE_ROW",
      severity: "warning",
      message:
        "En eller flera rader har inget pris. Kontrollera att detta är avsiktligt innan du skapar en offert.",
    });
  }

  // ── WARNING: missing work role on a labor row ────────────────────────────────
  const hasLaborWithoutRole = allRows.some(
    (r) => r.row_type === "labor" && r.source_kind !== "work_role",
  );
  if (hasLaborWithoutRole) {
    warnings.push({
      code: "MISSING_WORK_ROLE",
      severity: "warning",
      message:
        "En arbetsrad saknar en kopplad yrkesroll. Kontrollera priset innan du skapar en offert.",
    });
  }

  // ── WARNING: low margin (TB% below the pilot threshold) ──────────────────────
  if (anyLowMargin) {
    const pct = Math.round(PILOT_LOW_MARGIN_THRESHOLD * 100);
    warnings.push({
      code: "LOW_MARGIN",
      severity: "warning",
      message:
        `En eller flera rader har ett täckningsbidrag under ${pct} %. ` +
        "Kontrollera marginalen innan du skapar en offert.",
    });
  }

  // ── WARNING: unresolved VAT / tax assumptions ────────────────────────────────
  // The tenant posture unresolved (settings read fault / no row) OR a counted row's VAT bp missing.
  const hasMissingRowVat = allRows.some((r) => r.vat_rate_bp === null);
  if (!input.vatPostureResolved || hasMissingRowVat) {
    warnings.push({
      code: "UNRESOLVED_VAT",
      severity: "warning",
      message:
        "Momsvisningen kunde inte fastställas fullständigt. En standardvy används tills momsinställningen är klar.",
    });
  }

  // ── WARNING: ROT / grön-teknik sign-off (ESTIMATE, never final) ──────────────
  // NON-FINAL framing (R-509): the deduction is an ESTIMATE requiring sign-off, NEVER approved/
  // legally-final. The eligibility posture is the resolved posture, NEVER a personnummer (R-516);
  // `persons` stays a flat-cap placeholder — this message NEVER implies a per-person-scaled cap
  // (R-512).
  if (input.tax.hasDeductionAssumption) {
    const label =
      input.tax.deductionType === "gron_teknik"
        ? "Grön teknik-avdraget"
        : input.tax.deductionType === "rot"
          ? "ROT-avdraget"
          : "Skatteavdraget";
    const eligibilityNote =
      input.tax.eligibilityPosture !== undefined &&
      input.tax.eligibilityPosture !== "private"
        ? " Endast privatkunder är berättigade enligt den preliminära bedömningen."
        : "";
    warnings.push({
      code: "TAX_SIGN_OFF_REQUIRED",
      severity: "warning",
      message:
        `${label} är en UPPSKATTNING som kräver godkännande — det är inte ett slutgiltigt ` +
        `eller juridiskt fastställt avdrag.${eligibilityNote}`,
    });
  }

  // ── WARNING (informational disclosure): hidden rows COUNT toward totals ───────
  // Per the 2026-06-18 pin, hidden rows COUNT — this is a DISCLOSURE, not a defect.
  if (anyHiddenCounted) {
    warnings.push({
      code: "HIDDEN_ROWS_INCLUDED",
      severity: "warning",
      message:
        "Dolda rader räknas med i summan även om de inte visas för kunden. Detta är avsiktligt.",
    });
  }

  // ── WARNING (documented deferral): required-file check pending Story 8.1 ──────
  // Story 8.1 (file-metadata foundation) has NOT landed (R-513) — surface the required-file check
  // as a DOCUMENTED deferral in the readiness output rather than silently omitting it.
  warnings.push({
    code: "REQUIRED_FILES_DEFERRED",
    severity: "warning",
    message:
      "Kontroll av obligatoriska filer är ännu inte tillgänglig och görs manuellt tills funktionen för filer är på plats.",
  });

  return {
    blockers,
    warnings,
    canCreateQuote: blockers.length === 0,
  };
}
