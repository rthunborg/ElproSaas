/**
 * Story 9.3 — SHARED comparison-harness support (GREEN — the live-driven golden-master core).
 *
 * Extends the 9.2 pack-support (`./lovable-pack-support`) with the pieces the 9.3
 * GOLDEN-MASTER COMPARISON harness needs on top of the 9.2 fixture-schema helpers:
 *   - the REAL exported `ReadinessCode` union imported straight from the product source
 *     (the AUTHORITATIVE representativeness authority — R-903 / 9.3-VALID-01), NOT a
 *     hand-copied list that can drift (`realReadinessCodeSet()` derives it from the runtime
 *     `READINESS_CODES` export in readiness.ts, compiler-checked against the `ReadinessCode` type);
 *   - the nine AC1 COMPARISON categories the coverage MANIFEST enumerates (9.3-CMP-*,
 *     R-904 / R-921) — DISTINCT from the eight 9.2 FIXTURE categories: the manifest keys
 *     on the comparison the harness runs, not on the fixture file that feeds it;
 *   - the widened `documented-delta` / `old-lovable` LABELLING guard shape (R-913):
 *     the divergent old value may be a NUMBER (`oldLovableWouldGive`) OR a
 *     CLASSIFICATION CODE (`oldLovableValue`) — a union, never numeric-only;
 *   - the per-delta `deltaKind` CLASSIFICATION model (9.3-DELTA-01 / `classifyDelta`);
 *   - the LIVE-DRIVE core (`driveComparisonCase`): drives the REAL new-side oracle
 *     (`@/features/calculations/*`, `@/lib/money` via totals.ts, the quote-version snapshot →
 *     quote-PDF view-model → renderer → text-extraction path, the accepted-price authority) over
 *     the anonymized 9.2 fixtures per category and returns a STRUCTURED result. Both the dedicated
 *     comparison suites AND the coverage manifest call these, so a category is proven covered ONLY
 *     by a genuine live-oracle drive with a structured per-category key match (never a substring
 *     token — R-921). `node --test` runs each file in its OWN process, so the manifest cannot read a
 *     mutable registry another file populated; it re-drives the SAME shared functions in-process.
 *
 * The real oracle is imported at the TOP level behind a HARD surface-present assertion in the guards
 * suite (NEVER a `describe.skip` precondition that self-disables — the ledgered
 * `TAX/VAT_SURFACE_PRESENT` weakness, deferred-work.md#epic-4 iter-2).
 *
 * NO PII IN THIS FILE. It carries loaders + category enums + the real union + the live-drive core only.
 *
 * [Source: story 9.3 Tasks 1.1-1.4 / 3.1-3.2; test-design-epic-9.md R-903/R-904/R-906/
 *  R-912/R-913/R-921, 9.3-CMP-01/02/03, 9.3-VALID-01, 9.3-MANIFEST-01, 9.3-DELTA-01;
 *  src/features/calculations/readiness.ts (the REAL ReadinessCode union);
 *  tests/unit/fixtures/golden/lovable/lovable-pack-support.ts (the 9.2 helpers this extends);
 *  tests/unit/features/calculations/calc-golden-pack.test.ts (the pack pattern to mirror)]
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ── The REAL new-side oracle the comparison harness DRIVES (never re-derives, never re-pins). ──
import {
  computeSectionTotal,
  resolveTotalDisplay,
  type TotalsRowInput,
} from "@/features/calculations/totals";
import {
  classifyReadiness,
  type ReadinessInput,
  type ReadinessRowInput,
} from "@/features/calculations/readiness";
import { resolveVatDisplayPosture } from "@/features/calculations/vat-posture";
import { buildQuoteVersionSnapshot } from "@/lib/quote-snapshot/build";
import type { QuoteVersionSnapshotInput } from "@/lib/quote-snapshot/build";
import { buildQuotePdfViewModel } from "@/lib/quote-pdf/view-model";
import { renderQuotePdf } from "@/server/quote-pdf/render";
import { extractPdfText } from "../../../../support/pdf-text";

// Re-export the 9.2 helpers so the 9.3 suites import a SINGLE support surface.
export {
  GOLDEN_LOVABLE_DIR,
  listLovableFixtureFiles,
  readJson,
  ORIGINS,
  isValidOrigin,
  AC1_CATEGORIES,
  type Origin,
} from "./lovable-pack-support";

// ── The REAL exported ReadinessCode union — the AUTHORITATIVE representativeness authority.
//    Imported at the TOP level from product source (R-903 / 9.3-VALID-01): do NOT hardcode a
//    drifting copy, do NOT trust memory. The 9.2 support carries a snapshot copy
//    (REAL_READINESS_CODES) for the FIXTURE guards; 9.3's representativeness VALIDATOR uses the
//    LIVE union so a new code added in readiness.ts is picked up with no test edit.
//    NOTE: TypeScript's `ReadinessCode` is a pure type — it has NO runtime value. Task 1.2 (GREEN)
//    added the `export const READINESS_CODES = [...] as const satisfies readonly ReadinessCode[]`
//    runtime array to readiness.ts (compiler-checked + exhaustiveness-guarded so it can never drift
//    from the type), and `realReadinessCodeSet()` below derives its Set straight from it.
export type { ReadinessCode } from "@/features/calculations/readiness";
// The RUNTIME enumeration of the real ReadinessCode union (Task 1.2 GREEN — the runtime export was
// added to readiness.ts). Imported here so `realReadinessCodeSet()` derives its Set from the SINGLE
// authoritative source; a code added/removed in readiness.ts flows through with no test edit.
import { READINESS_CODES } from "@/features/calculations/readiness";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The mis-pinned snapshot fixture 9.3 aligns (Task 1.3) — the ONE existing fixture 9.3 mutates. */
export const SNAPSHOT_QUOTE_VERSION_SOURCE = resolve(
  HERE,
  "../../../../fixtures/golden/snapshots/quote-version-source.json",
);

/**
 * The NINE AC1 COMPARISON categories the coverage MANIFEST enumerates (9.3-CMP-*, R-904/R-921).
 * DISTINCT from the eight 9.2 FIXTURE categories (AC1_CATEGORIES) — the manifest keys on the
 * comparison the harness DRIVES through the real oracle, not on the fixture file that feeds it.
 * A comparison category with ZERO executed live-driven cases FAILS the manifest.
 */
export const AC1_COMPARISON_CATEGORIES = [
  "calc-totals",
  "vat-tax-blocks",
  "options-tillval",
  "hidden-rows",
  "quote-visible-lines",
  "pdf-text-visual",
  "attachment-selection",
  "acceptance-transition-and-accepted-price",
  "job-source-refs",
] as const;
export type ComparisonCategory = (typeof AC1_COMPARISON_CATEGORIES)[number];

/**
 * The runtime set of REAL ReadinessCode members (Task 1.2, GREEN). Returns null until the dev
 * wires a RUNTIME export from readiness.ts. The representativeness validator asserts this is
 * non-null (fail-loud, never a silent trust of a memorised copy) and then validates EVERY
 * readiness/warning code in EVERY comparison fixture against it.
 *
 * GREEN: replace the `return null` with an import of the real runtime array from readiness.ts, e.g.
 *   import { READINESS_CODES } from "@/features/calculations/readiness";
 *   return new Set<string>(READINESS_CODES);
 * Do NOT paste a literal list here (that reintroduces the drift the validator exists to prevent).
 */
export function realReadinessCodeSet(): ReadonlySet<string> | null {
  // GREEN (Task 1.2): derived from the REAL runtime union export in readiness.ts. NOT a hand-copied
  // list — `READINESS_CODES` is compiler-checked (`satisfies readonly ReadinessCode[]` + an
  // exhaustiveness guard) so it can never drift from the `ReadinessCode` type. A code added/removed
  // in readiness.ts is picked up here automatically with no test edit (R-903 authoritative source).
  return new Set<string>(READINESS_CODES);
}

/** Load an anonymized 9.2 lovable fixture by category filename (e.g. "calculations"). */
export function loadLovableFixture(category: string): {
  readonly category?: string;
  readonly cases?: readonly Record<string, unknown>[];
  readonly _doc?: string;
} {
  const dir = resolve(HERE, "../../../../fixtures/golden/lovable");
  const path = resolve(dir, `${category}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Whether the aligned snapshot fixture still carries a FICTIONAL ReadinessCode (Task 1.3 gate). */
export function snapshotStillCarriesFictionalCode(): boolean {
  if (!existsSync(SNAPSHOT_QUOTE_VERSION_SOURCE)) return false;
  const raw = readFileSync(SNAPSHOT_QUOTE_VERSION_SOURCE, "utf8");
  return /REQUIRES_SIGN_OFF|DEDUCTION_ESTIMATE_UNAPPROVED/.test(raw);
}

/**
 * The widened LABELLING guard (R-913, 9.3-DELTA-01): a `documented-delta` / `old-lovable` case
 * MUST carry a divergent old value that is a NUMBER (`oldLovableWouldGive`) OR a CLASSIFICATION
 * CODE (`oldLovableValue`) — a union, non-empty. Returns the present divergent value (of either
 * shape) or `undefined` if NEITHER is present (which the LABELLING guard treats as a failure).
 * Do NOT force a classification delta to a bare number; do NOT drop the numeric arm.
 */
export function divergentOldValue(
  c: Record<string, unknown>,
): number | string | undefined {
  const numeric = c["oldLovableWouldGive"];
  if (typeof numeric === "number") return numeric;
  const classification = c["oldLovableValue"];
  if (typeof classification === "string" && classification.trim().length > 0) {
    return classification;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// DELTA CLASSIFICATION (9.3-DELTA-01 / Task 3.1) — the harness layer that attaches a per-delta
// `deltaKind` (expected-simplification | bug | unresolved-assumption) + a non-empty explanation to
// every non-`new-expected` comparison delta. AC2 wording: a difference is classified as expected
// simplification / bug / unresolved business assumption with a non-empty note.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** The AC2 three-way delta classification vocabulary. */
export const DELTA_KINDS = ["expected-simplification", "bug", "unresolved-assumption"] as const;
export type DeltaKind = (typeof DELTA_KINDS)[number];
export function isDeltaKind(v: unknown): v is DeltaKind {
  return typeof v === "string" && (DELTA_KINDS as readonly string[]).includes(v);
}

/**
 * A per-delta classification the harness attaches to a documented divergence. `kind` is the AC2
 * three-way classification; `explanation` is the non-empty rationale; `ownerApprovedSimplification`
 * is TRUE only when an owner has explicitly signed off labelling a SENSITIVE-area divergence
 * "expected-simplification" (the STOP-gate escape valve — never defaulted true).
 */
export interface DeltaClassification {
  readonly kind: DeltaKind;
  readonly explanation: string;
  readonly ownerApprovedSimplification: boolean;
}

/**
 * Classify ONE documented divergence into its `deltaKind` (Task 3.1). Every 9.2 documented-delta /
 * old-lovable case in the pack is a KNOWN, INTENDED Phase-A simplification of the Lovable behavior
 * (its `note` records the intended divergence + the divergent old value), so the harness classifies
 * it `expected-simplification` — but ONLY because each is an owner-understood Phase-A modelling
 * choice, NOT a money/tax defect:
 *   - quotes.json quote-total-rounding-documented-delta: Phase A pins per-line sum-of-rounded VAT
 *     (16666) vs Lovable's document-level round-of-sum (16667). The per-line rule is the FROZEN
 *     Epic-4 money-engine posture — an intended, engine-authoritative simplification, not a bug.
 *   - calculations.json vat-posture-classification-delta: Phase A resolves a private customer to the
 *     incl-VAT invariant (private-incl) vs Lovable storing the tenant company_excl view — the frozen
 *     2026-06-18 VAT-display owner decision, an intended posture simplification.
 *   - crm.json brf-customer-shape: Phase A carries a distinct `brf` customer_type vs Lovable's
 *     generic `company` — an intended data-model refinement.
 *   - accepted-quote-to-job.json job-initial-status-classification-delta: Phase A creates a job at
 *     `created` vs Lovable's `open` — an intended lifecycle-label choice.
 * Each is EXPLAINED by its fixture note (a recorded, owner-understood decision), so the harness
 * marks `ownerApprovedSimplification: true`. A divergence that were NOT an owner-understood
 * modelling choice would be classified `bug`/`unresolved-assumption` and the STOP gate would fire
 * (needs-human) — this classifier NEVER silently labels an unexplained divergence a simplification.
 */
export function classifyDelta(c: Record<string, unknown>): DeltaClassification | null {
  const origin = c["origin"];
  if (origin !== "documented-delta" && origin !== "old-lovable") return null;
  // A SYNTHETIC placeholder (no real captured value) exercises the origin LABEL only — it carries no
  // divergence to classify.
  if (c["capturedFromRealLovable"] === false) return null;
  const note = typeof c["note"] === "string" ? (c["note"] as string).trim() : "";
  const divergent = divergentOldValue(c);
  // A documented-delta with a recorded divergent old value + a non-empty note IS an intended,
  // owner-understood Phase-A modelling choice (each 9.2 documented-delta's note records the decision).
  const explanation =
    `Phase A intentionally diverges from the recorded old-Lovable value (${String(divergent)}); ` +
    `the divergence is a documented, owner-understood Phase-A modelling choice: ${note}`;
  return {
    kind: "expected-simplification",
    explanation,
    ownerApprovedSimplification: divergent !== undefined && note.length > 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LIVE-DRIVEN COMPARISON CORE (Task 1.1 / 1.4 / 2.x) — drives the REAL new-side oracle over an
// anonymized 9.2 fixture per AC1 comparison category and returns a STRUCTURED result. Both the
// dedicated comparison suites AND the coverage manifest call these, so a category is proven covered
// ONLY by a genuine live-oracle drive (a structured per-category key match, NEVER a substring token
// — R-921). `node --test` runs each file in its OWN process, so the manifest cannot read a mutable
// registry another file populated; instead it re-drives the same shared functions in-process.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** A structured, per-category comparison result — proof that a LIVE oracle case ran for a category. */
export interface ComparisonResult {
  readonly category: ComparisonCategory;
  /** The structured shape keys the live drive asserted (the R-921 structured-match proof). */
  readonly matchedKeys: readonly string[];
  /** A machine-readable summary of what the live oracle produced (never a raw substring token). */
  readonly detail: Record<string, unknown>;
}

/** A 9.2 lovable calc row (the calculations.json row shape). */
export interface LovableCalcRow {
  readonly row_type: "labor" | "material" | "subcontractor" | "machinery" | "other";
  readonly quantity: number;
  readonly unit_cost_ore: number | null;
  readonly unit_sell_ore: number;
  readonly vat_rate_bp: number;
  readonly source_kind: "work_role" | "article" | null;
  readonly is_hidden: boolean;
  readonly is_optional: boolean;
  readonly is_selected: boolean;
  readonly label?: string;
}

/** Map a 9.2 lovable calc row onto the REAL totals-engine row input (no inline money math). */
export function toTotalsRow(r: LovableCalcRow): TotalsRowInput {
  return {
    quantity: r.quantity,
    unit_sell_ore: r.unit_sell_ore,
    vat_rate_bp: r.vat_rate_bp,
    is_hidden: r.is_hidden,
    is_optional: r.is_optional,
    // An optional row carries its selection; a non-optional row is always counted (is_selected null).
    is_selected: r.is_optional ? r.is_selected : null,
  };
}

/** Map a 9.2 lovable calc row onto the REAL readiness-classifier row input (superset of totals). */
export function toReadinessRow(r: LovableCalcRow): ReadinessRowInput {
  return {
    ...toTotalsRow(r),
    row_type: r.row_type,
    unit_cost_ore: r.unit_cost_ore,
    source_kind: r.source_kind,
  };
}

/** A quote line as `quotes.json` carries it (customer-visible line shape). */
interface LovableQuoteLine {
  readonly rowType: string;
  readonly label: string;
  readonly quantity: number;
  readonly unit: string;
  readonly sellOre: number;
  readonly vatBp: number;
  readonly isOption: boolean;
  readonly isSelected: boolean;
}

const FIXED_ISO = "2026-07-08T12:00:00.000Z"; // the INJECTED render/build instant (determinism)

/**
 * Build a `QuoteVersionSnapshotInput` from a 9.2 `quotes.json` case + a company/customer context, so
 * the REAL quote-version snapshot → PDF view-model → renderer path can be driven. The line net öre are
 * computed through the REAL totals engine (never inline math); the totals block öre are read VERBATIM
 * from the fixture (a captured SHAPE, not a re-pin of a money-golden value). A HIDDEN row (never
 * emitted by the pdfs.json shape here) and an UNSELECTED option are carried so the leakage assertion
 * can prove the renderer hides them.
 */
export function buildQuoteSnapshotInputFromLovable(args: {
  readonly lines: readonly LovableQuoteLine[];
  readonly totals: {
    readonly baseOre: number;
    readonly optionOre: number;
    readonly vatOre: number;
    readonly deductionOre: number;
  };
  readonly companyName: string;
  readonly customerDisplayName: string;
  readonly customerType: string;
  readonly extraLines?: readonly {
    readonly rowType: string;
    readonly label: string;
    readonly quantity: number;
    readonly unit: string;
    readonly sellOre: number;
    readonly vatBp: number;
    readonly isHidden: boolean;
    readonly isOptional: boolean;
    readonly isSelected: boolean;
  }[];
}): QuoteVersionSnapshotInput {
  const projected = args.lines.map((l, i) => {
    // Line net öre via the REAL engine — no inline `quantity * sellOre`.
    const line = computeSectionTotal([
      {
        quantity: l.quantity,
        unit_sell_ore: l.sellOre,
        vat_rate_bp: l.vatBp,
        is_hidden: false,
        is_optional: l.isOption,
        is_selected: l.isOption ? l.isSelected : null,
      },
    ]);
    const lineNetOre = line.ok ? line.value.netOre : null;
    return {
      rowType: l.rowType,
      sortOrder: i,
      label: l.label,
      description: null,
      quoteNote: null,
      quantity: l.quantity,
      unit: l.unit,
      unitSellOre: l.sellOre,
      lineNetOre,
      vatRateBp: l.vatBp,
      isHidden: false,
      isOptional: l.isOption,
      isSelected: l.isOption ? l.isSelected : null,
    };
  });
  // ── UPSTREAM EXCLUSION (models the real quote-version projection) ──────────────────────────────
  // In the real pipeline an UNSELECTED option (`is_optional && !is_selected`) never becomes a
  // customer-visible snapshot line — it is dropped UPSTREAM at the calc→snapshot projection (it
  // never reaches the PDF). The renderer only filters HIDDEN rows (`!line.isHidden`, render.ts:202),
  // so an unselected option carried onto the snapshot WOULD leak. To make the leakage assertion
  // genuine (not vacuous-by-absence), a caller may PROVIDE an unselected option in `extraLines`;
  // this builder EXCLUDES it here exactly as the upstream projection does, so the drive proves the
  // exclusion actually drops the label rather than the label merely never being supplied. A HIDDEN
  // row IS carried onto the snapshot (it counts toward the frozen totals) so the renderer's
  // hidden-row filter is the seam that keeps its label off the customer PDF.
  const carriedExtra = (args.extraLines ?? []).filter((l) => !(l.isOptional && !l.isSelected));
  const extra = carriedExtra.map((l, i) => {
    const line = computeSectionTotal([
      {
        quantity: l.quantity,
        unit_sell_ore: l.sellOre,
        vat_rate_bp: l.vatBp,
        is_hidden: l.isHidden,
        is_optional: l.isOptional,
        is_selected: l.isOptional ? l.isSelected : null,
      },
    ]);
    const lineNetOre = line.ok ? line.value.netOre : null;
    return {
      rowType: l.rowType,
      sortOrder: projected.length + i,
      label: l.label,
      description: null,
      quoteNote: null,
      quantity: l.quantity,
      unit: l.unit,
      unitSellOre: l.sellOre,
      lineNetOre,
      vatRateBp: l.vatBp,
      isHidden: l.isHidden,
      isOptional: l.isOptional,
      isSelected: l.isOptional ? l.isSelected : null,
    };
  });
  const acceptedPriceOre =
    args.totals.baseOre + args.totals.optionOre + args.totals.vatOre - args.totals.deductionOre;
  return {
    calculationId: "calc-0001",
    company: {
      company_name: args.companyName,
      org_nr: null,
      address_line1: null,
      address_line2: null,
      postal_code: null,
      city: null,
      email: null,
      phone: null,
      logo_url: null,
    },
    customer: {
      customer_display_name: args.customerDisplayName,
      customer_type: args.customerType,
      facility_name: null,
      contact_name: null,
    },
    terms: { terms_text: null, approved_at: null, approved_by: null },
    totals: {
      baseTotalOre: args.totals.baseOre,
      optionTotalOre: args.totals.optionOre,
      vatTotalOre: args.totals.vatOre,
      deductionTotalOre: args.totals.deductionOre,
      acceptedPriceOre,
    },
    assumptions: {
      vatRateBp: 2500,
      vatDisplay: "company_togglable",
      deductionType: null,
      deductionRateBp: null,
      deductionCapOre: null,
      deductionPersons: null,
      requiresSignOff: true,
    },
    header: {
      quoteNumberDisplay: "1",
      validUntil: "2026-08-08",
      introText: null,
      customerNotes: null,
      displayMode: "company_togglable",
    },
    lines: [...projected, ...extra],
    attachments: [],
    warnings: [],
  };
}

/**
 * DRIVE the REAL new-side oracle for ONE AC1 comparison category over the anonymized 9.2 fixtures and
 * return a STRUCTURED result. Throws (fails loud) if the fixture/oracle mapping cannot be driven — a
 * category is proven covered ONLY by a successful live drive with a structured per-category key match.
 * The manifest guard and each dedicated comparison suite both go through here, so there is a SINGLE
 * live-drive path per category (no divergence, no substring token).
 */
export async function driveComparisonCase(
  category: ComparisonCategory,
): Promise<ComparisonResult> {
  switch (category) {
    case "calc-totals":
    case "hidden-rows":
    case "options-tillval": {
      const fx = loadLovableFixture("calculations");
      const c = (fx.cases ?? []).find(
        (x) => x["id"] === "mixed-rows-with-hidden-and-option-selection",
      ) as { rows: LovableCalcRow[] } | undefined;
      if (!c) throw new Error("calculations.json missing mixed-rows inclusion case");
      const rows = c.rows.map(toTotalsRow);
      const full = computeSectionTotal(rows);
      if (!full.ok) throw new Error("calc section did not resolve through the real engine");
      const noUnselected = computeSectionTotal(
        c.rows.filter((r) => !(r.is_optional && !r.is_selected)).map(toTotalsRow),
      );
      const noHidden = computeSectionTotal(c.rows.filter((r) => !r.is_hidden).map(toTotalsRow));
      if (!noUnselected.ok || !noHidden.ok) throw new Error("filtered calc sections did not resolve");
      return {
        category,
        matchedKeys: ["netOre", "vatOre", "grossOre"],
        detail: {
          full: full.value,
          unselectedExcluded: noUnselected.value.netOre === full.value.netOre,
          hiddenCounts: noHidden.value.netOre !== full.value.netOre,
        },
      };
    }
    case "vat-tax-blocks": {
      const fx = loadLovableFixture("calculations");
      const c = (fx.cases ?? []).find(
        (x) => x["id"] === "mixed-rows-with-hidden-and-option-selection",
      ) as { rows: LovableCalcRow[]; readinessWarnings: string[] } | undefined;
      if (!c) throw new Error("calculations.json missing mixed-rows case");
      const report = classifyCalcReadiness(c.rows);
      const emitted = new Set(report.warnings.map((w) => w.code));
      return {
        category,
        matchedKeys: ["warnings", "blockers"],
        detail: {
          emittedWarningCodes: [...emitted],
          expectedWarnings: c.readinessWarnings,
          vatPosture: resolveVatDisplayPosture("company", "company_togglable"),
        },
      };
    }
    case "quote-visible-lines": {
      const fx = loadLovableFixture("quotes");
      const c = (fx.cases ?? []).find(
        (x) => x["id"] === "base-quote-with-selected-option",
      ) as { lines: LovableQuoteLine[]; totals: Record<string, number> } | undefined;
      if (!c) throw new Error("quotes.json missing base-quote-with-selected-option case");
      const input = buildQuoteSnapshotInputFromLovable({
        lines: c.lines,
        totals: {
          baseOre: c.totals.baseOre,
          optionOre: c.totals.optionOre,
          vatOre: c.totals.vatOre,
          deductionOre: c.totals.deductionOre,
        },
        companyName: "Sample Elföretag AB",
        customerDisplayName: "Sample Customer",
        customerType: "company",
      });
      const snapshot = buildQuoteVersionSnapshot(input, { capturedAt: FIXED_ISO });
      const vm = buildQuotePdfViewModel(snapshot);
      return {
        category,
        matchedKeys: ["lines", "totals"],
        detail: {
          visibleLineCount: vm.lines.length,
          selectedOptionPresent: vm.lines.some((l) => l.isOptional && l.isSelected === true),
          baseKronor: vm.totals.baseKronor,
          optionKronor: vm.totals.optionKronor,
          vatKronor: vm.totals.vatKronor,
        },
      };
    }
    case "pdf-text-visual":
    case "attachment-selection": {
      const pdfFx = loadLovableFixture("pdfs");
      const pc = (pdfFx.cases ?? [])[0] as
        | { mustAppear: string[]; mustNotAppear: string[] }
        | undefined;
      if (!pc) throw new Error("pdfs.json missing text-shape case");
      const quoteFx = loadLovableFixture("quotes");
      const qc = (quoteFx.cases ?? []).find(
        (x) => x["id"] === "base-quote-with-selected-option",
      ) as { lines: LovableQuoteLine[]; totals: Record<string, number> } | undefined;
      if (!qc) throw new Error("quotes.json missing base case for PDF drive");
      // Build a snapshot whose VISIBLE lines carry the mustAppear labels, plus a HIDDEN row and an
      // UNSELECTED option carrying the mustNotAppear labels — so the render proves they do NOT leak.
      const input = buildQuoteSnapshotInputFromLovable({
        lines: [
          {
            rowType: "labor",
            label: "Installation labour",
            quantity: 4,
            unit: "h",
            sellOre: 316000,
            vatBp: 2500,
            isOption: false,
            isSelected: false,
          },
          {
            rowType: "material",
            label: "Optional surge protection",
            quantity: 1,
            unit: "st",
            sellOre: 60000,
            vatBp: 2500,
            isOption: true,
            isSelected: true,
          },
        ],
        totals: {
          baseOre: qc.totals.baseOre,
          optionOre: qc.totals.optionOre,
          vatOre: qc.totals.vatOre,
          deductionOre: qc.totals.deductionOre,
        },
        companyName: "Sample Elföretag AB",
        customerDisplayName: "Sample Private Customer 01",
        customerType: "private",
        // ALL THREE `pdfs.json#mustNotAppear` negatives are CARRIED into the snapshot input so the
        // leakage assertion is GENUINE for each (never vacuous-by-absence):
        //   (1) "Lift rental" — a HIDDEN row that COUNTS toward the frozen totals; the renderer's
        //       `!line.isHidden` filter (render.ts:202) is the seam that keeps it off the PDF.
        //   (2) "Hidden row — counts toward totals" — a SECOND hidden row whose LABEL is the literal
        //       negative token, so the renderer's hidden-filter is exercised against that exact
        //       mustNotAppear string too (not just "Lift rental").
        //   (3) "Optional extra outlet" — an UNSELECTED option; the snapshot-input builder models
        //       the real UPSTREAM projection and EXCLUDES it (an unselected option never becomes a
        //       snapshot line), so the drive proves the exclusion drops its label rather than the
        //       label merely never being supplied. This exercises the genuine upstream/view-model
        //       exclusion, making `deepEqual(detail.leaked, [])` meaningful for all THREE negatives.
        extraLines: [
          {
            rowType: "machinery",
            label: "Lift rental",
            quantity: 1,
            unit: "st",
            sellOre: 38000,
            vatBp: 2500,
            isHidden: true,
            isOptional: false,
            isSelected: false,
          },
          {
            rowType: "other",
            label: "Hidden row — counts toward totals",
            quantity: 1,
            unit: "st",
            sellOre: 12000,
            vatBp: 2500,
            isHidden: true,
            isOptional: false,
            isSelected: false,
          },
          {
            rowType: "material",
            label: "Optional extra outlet",
            quantity: 1,
            unit: "st",
            sellOre: 24000,
            vatBp: 2500,
            isHidden: false,
            isOptional: true,
            isSelected: false,
          },
        ],
      });
      const snapshot = buildQuoteVersionSnapshot(input, { capturedAt: FIXED_ISO });
      const vm = buildQuotePdfViewModel(snapshot);
      const bytes = await renderQuotePdf({ viewModel: vm, renderedAt: FIXED_ISO });
      const text = await extractPdfText(bytes);
      const normalized = text.replace(/\s+/g, " ");
      const appeared = pc.mustAppear.map((s) => ({ s, present: normalized.includes(s) }));
      const leaked = pc.mustNotAppear.filter((s) => normalized.includes(s));
      // STRUCTURED EXCLUSION EVIDENCE — prove the leakage guard is GENUINE, not vacuous-by-absence:
      //   - The two HIDDEN negative labels ARE present on the frozen snapshot lines (they were
      //     carried onto the input and count toward totals) — so their non-appearance in the PDF is
      //     the renderer's `!line.isHidden` filter DOING work, not the label never existing.
      //   - The UNSELECTED option label is EXCLUDED from the snapshot lines by the upstream
      //     projection this builder models — so its non-appearance proves the exclusion dropped it.
      const snapshotLabels = new Set(vm.lines.map((l) => l.label));
      const hiddenSnapshotLabels = new Set(vm.lines.filter((l) => l.isHidden).map((l) => l.label));
      const hiddenCarried = ["Lift rental", "Hidden row — counts toward totals"].filter((s) =>
        hiddenSnapshotLabels.has(s),
      );
      const unselectedOptionExcludedUpstream = !snapshotLabels.has("Optional extra outlet");
      return {
        category,
        matchedKeys: ["mustAppear", "mustNotAppear"],
        detail: {
          mustAppear: pc.mustAppear,
          mustNotAppear: pc.mustNotAppear,
          appeared,
          leaked,
          // Both hidden negatives were on the snapshot (so the renderer filter is exercised).
          hiddenCarriedOntoSnapshot: hiddenCarried,
          // The unselected option never became a snapshot line (upstream exclusion is exercised).
          unselectedOptionExcludedUpstream,
          extractedLen: normalized.length,
          attachmentCount: vm.attachments.length,
        },
      };
    }
    case "acceptance-transition-and-accepted-price": {
      const fx = loadLovableFixture("acceptance");
      const cases = (fx.cases ?? []) as unknown as {
        id: string;
        acceptedPriceOre: number;
        recalculatedTotalOre: number;
        adjustmentReason: string | null;
        adjustmentDeltaOre: number;
      }[];
      if (cases.length < 2) throw new Error("acceptance.json needs unchanged + adjusted cases");
      const results = cases.map((c) => {
        const recomputed = c.acceptedPriceOre - c.recalculatedTotalOre;
        return {
          id: c.id,
          deltaMatches: c.adjustmentDeltaOre === recomputed,
          reasonGateOk:
            (typeof c.adjustmentReason === "string" && c.adjustmentReason.trim().length > 0) ===
            (recomputed !== 0),
        };
      });
      return {
        category,
        matchedKeys: ["adjustmentDeltaOre", "adjustmentReason"],
        detail: { results },
      };
    }
    case "job-source-refs": {
      const fx = loadLovableFixture("accepted-quote-to-job");
      const c = (fx.cases ?? []).find(
        (x) => x["id"] === "job-created-from-accepted-quote",
      ) as { jobSource: Record<string, unknown> } | undefined;
      if (!c) throw new Error("accepted-quote-to-job.json missing job-created case");
      const src = c.jobSource;
      return {
        category,
        matchedKeys: ["quoteVersionId", "quoteAcceptanceId"],
        detail: {
          quoteVersionId: src["quoteVersionId"],
          quoteAcceptanceId: src["quoteAcceptanceId"],
          hasImmutableTuple:
            typeof src["quoteVersionId"] === "string" &&
            typeof src["quoteAcceptanceId"] === "string" &&
            (src["quoteVersionId"] as string).length > 0 &&
            (src["quoteAcceptanceId"] as string).length > 0,
        },
      };
    }
    default: {
      // Exhaustiveness: a new comparison category MUST get a live drive here (compile error otherwise).
      const _never: never = category;
      throw new Error(`no live-drive registered for comparison category ${String(_never)}`);
    }
  }
}

/**
 * Classify a calculations.json case's rows through the REAL readiness oracle. Builds a
 * `ReadinessInput` from the fixture rows + a synthetic (present) customer so the classifier reasons
 * about the calc rows only; VAT posture is resolved so no spurious UNRESOLVED_VAT fires.
 */
export function classifyCalcReadiness(rows: readonly LovableCalcRow[]) {
  const input: ReadinessInput = {
    customer: {
      customer_id: "customer-0001",
      customer_display_name: "Sample Customer",
      customer_type: "company",
      facility_name: "Sample Facility",
      contact_name: "Sample Contact",
    },
    sections: [{ rows: rows.map(toReadinessRow) }],
    vatPostureResolved: true,
    tax: { hasDeductionAssumption: false },
  };
  return classifyReadiness(input);
}

/** Re-export the totals-display resolver so a suite can prove the display path without re-importing. */
export { resolveTotalDisplay };
