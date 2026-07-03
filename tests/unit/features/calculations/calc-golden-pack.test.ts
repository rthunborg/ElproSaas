/**
 * Story 5.5 — the FULL CALC GOLDEN PACK (5.5-GOLDEN-01 / 5.5-UNIT-01 / 5.5-UNIT-02, R-505/R-508/
 * R-509/R-512/R-513/R-516). This is the calc-row-layer analogue of the Story 4.4 money pack
 * (`tests/unit/lib/money/golden-pack.test.ts`) — the same 4 pack-level guards + the pack-wide
 * PRIVACY scan, but driving the REAL calc oracle (`totals.ts` / `readiness.ts` / `vat-posture.ts`)
 * across EVERY AC1 category at the CALC-ROW layer.
 *
 * The pack provides:
 *   • a HARD surface-present assertion (never a `describe.skip` precondition that self-disables the
 *     pack — deferred-work.md#epic-4 Iter-2);
 *   1. COVERAGE (5.5-GOLDEN-01) — a manifest that FAILS if any AC1 calc category is unpinned. A NEW
 *      category is proven by a LIVE oracle case in `calc-rows.json` driven through the engine; a
 *      REFERENCE category is proven by its owning per-category money fixture (R-508 single authority).
 *   2. LABELLING (5.5-UNIT-02) — every NEW calc-rows.json case carries a valid three-way `origin` +
 *      a non-empty `note`; a `documented-delta` case ALSO records its divergent old-Lovable value.
 *   3. BEHAVIORAL GOLDEN — the NEW numeric cases DRIVE the real `totals.ts`/`readiness.ts`/
 *      `vat-posture.ts`/`@/lib/money` (a LIVE oracle, not static schema): five row types, fractional
 *      qty, margins, section modes, VAT display, ROT/grön warnings, attachment-readiness, and the
 *      options/hidden-rows category (by REFERENCE to the 5.4 inclusion golden — not duplicated).
 *   4. SCHEMA-SHAPE guard — a malformed/half-authored calc-rows.json case (missing `origin`/`note`/an
 *      expected öre value) FAILS loud.
 *   + EXTENDED PRIVACY SCAN (5.5-UNIT-01, R-516) — the money-pack anonymization scan EXTENDED to
 *      calc-rows.json's DATA payload (personnummer, orgnr, non-example.test email, secret, PHONE,
 *      ADDRESS) — a calc fixture carries öre/rate/qty numbers + policy prose ONLY, no PII.
 *
 * RUNNER-GLOB TRAP (5.5-DOCS-03): calc goldens live under `tests/unit/**` (this path), NEVER under
 * `tests/golden/**`. The `node --test` fast gate globs `tests/unit/**`; a golden authored under
 * `tests/golden/**` is silently NEVER RUN (a vacuous green). The FIXTURES stay under
 * `tests/fixtures/golden/money/**` (data, not run by the globber).
 *
 * SINGLE NUMERIC AUTHORITY PER CATEGORY (R-508): the pack REFERENCES the existing per-category money
 * fixtures (options-tillval / rot-gron-deductions / vat-rates / rounding-mode) and PROVES the
 * calc-row surface reproduces their pinned öre — it re-pins NO number. A calc-row total that
 * DIVERGES from a frozen pin is a STOP (needs-human), never a re-pin.
 *
 * NOTHING PRODUCTION-APPROVED (R-509): every ROT/grön/VAT/rounding/inclusion/margin number is a
 * CONSERVATIVE UNAPPROVED PILOT ASSUMPTION (`signOff: "pending-owner-accounting-legal"`;
 * `PILOT_LOW_MARGIN_THRESHOLD`). The new `calc-rows.json` carries the SAME `signOff` marker and a
 * ROT/grön warning golden asserts `requiresSignOff === true` (an ESTIMATE, never legally-final).
 * `persons` stays a FLAT cap — no golden asserts a per-person multiplier (R-512).
 *
 * NO INLINE MONEY MATH (R-505): every öre op routes through `totals.ts` / `@/lib/money`; TB% is a
 * pure ratio of already-öre values done by `readiness.ts#rowMarginRatio` (the classifier), not the
 * test. This pack asserts ROUTING + inclusion/readiness CLASSIFICATION, not the arithmetic (Epic 4
 * pinned the numbers).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. The `@/lib/money`
 * barrel + `@/features/calculations/*` resolve under `node --test` via the Story 4.1 alias-hook.
 *
 * [Source: _bmad-output/implementation-artifacts/5-5-calculation-golden-tests-for-options-hidden-
 *  rows-and-tax-warnings.md; test-design-epic-5.md#5.5-GOLDEN-01/#5.5-UNIT-01/#5.5-UNIT-02;
 *  tests/unit/lib/money/golden-pack.test.ts (the 4-guard template); tests/unit/features/
 *  calculations/readiness-inclusion.golden.test.ts (the 5.4 inclusion golden — do NOT duplicate)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ── The REAL calc oracle the pack DRIVES (never re-derives). Imported at the TOP level (hard
//    presence assertion below — NEVER a describe.skip precondition that could self-disable). ──
import {
  computeLineTotal,
  computeSectionTotal,
  resolveTotalDisplay,
  type TotalsRowInput,
  type SectionTotal,
} from "@/features/calculations/totals";
import {
  classifyReadiness,
  PILOT_LOW_MARGIN_THRESHOLD,
  type ReadinessInput,
  type ReadinessRowInput,
} from "@/features/calculations/readiness";
import { resolveVatDisplayPosture } from "@/features/calculations/vat-posture";
import * as money from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");

// ── The three-way origin discipline (mirrors the 4.4 pack) ───────────────────────────────────
const ORIGINS = ["old-lovable", "new-expected", "documented-delta"] as const;
type Origin = (typeof ORIGINS)[number];
function isValidOrigin(v: unknown): v is Origin {
  return typeof v === "string" && (ORIGINS as readonly string[]).includes(v);
}

// ── The engine oracle for the tax category (drive estimateDeduction directly, mirroring 4.4) ──
type OkLike = { ok: true } & Record<string, unknown>;
function isOk(r: unknown): r is OkLike {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === true;
}
type MoneyOracle = {
  estimateDeduction: (
    input: Record<string, unknown>,
  ) => OkLike | ({ ok: false } & Record<string, unknown>);
};
const engine = money as unknown as MoneyOracle & Record<string, unknown>;
const CAPTURED_AT = "2026-07-03T00:00:00.000Z";

// ── calc-rows.json case typings (the NEW fixture this story authors) ─────────────────────────
interface SectionLine {
  readonly row_type: string;
  readonly quantity: number;
  readonly unit_sell_ore: number;
  readonly vat_rate_bp: number;
}
interface PostureExpectation {
  readonly customerType: string;
  readonly tenantDefaultVatDisplay: "company_togglable" | "company_excl";
  readonly expectedResolvedPosture: string;
  readonly expectedPrimaryOre: number;
  readonly expectedTogglable: boolean;
}
interface CalcRowCase {
  readonly id: string;
  readonly category: string;
  readonly origin: Origin;
  readonly note: string;
  // Single-row line-total cases.
  readonly row_type?: string;
  readonly quantity?: number;
  readonly unit_cost_ore?: number | null;
  readonly unit_sell_ore?: number;
  readonly vat_rate_bp?: number;
  readonly source_kind?: "work_role" | "article" | null;
  readonly expectedLineNetOre?: number;
  readonly expectedLineVatOre?: number;
  readonly expectedLineGrossOre?: number;
  // Section-composition + section-mode cases.
  readonly display_mode?: string;
  readonly sectionLines?: readonly SectionLine[];
  readonly expectedSectionNetOre?: number;
  readonly expectedSectionVatOre?: number;
  readonly expectedSectionGrossOre?: number;
  // Margin cases.
  readonly expectedMarginRatio?: number | null;
  readonly expectLowMarginWarning?: boolean;
  readonly expectZeroPriceRow?: boolean;
  // VAT-display case.
  readonly netOre?: number;
  readonly vatOre?: number;
  readonly grossOre?: number;
  readonly postures?: readonly PostureExpectation[];
  // Attachment-readiness case.
  readonly expectRequiredFilesDeferred?: boolean;
  // documented-delta bookkeeping.
  readonly oldLovableWouldGive?: number;
}
interface CalcRowsFixture {
  readonly _doc?: string;
  readonly policy: Record<string, string>;
  readonly cases: readonly CalcRowCase[];
}

const CALC_ROWS_FIXTURE = "calc-rows.json";
function readJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, name), "utf8"));
}
function loadCalcRows(): CalcRowsFixture {
  return readJson(CALC_ROWS_FIXTURE) as CalcRowsFixture;
}
function findCase(id: string): CalcRowCase {
  const c = loadCalcRows().cases.find((x) => x.id === id);
  assert.ok(c, `calc-rows.json must carry the '${id}' case`);
  return c!;
}

// ── Row builders — drive the REAL engine, never re-derive a total ────────────────────────────
/** A plain (non-optional, visible) totals row at a sell öre + VAT bp. */
function totalsRow(sellOre: number, vatBp: number, quantity = 1): TotalsRowInput {
  return {
    quantity,
    unit_sell_ore: sellOre,
    vat_rate_bp: vatBp,
    is_hidden: false,
    is_optional: false,
    is_selected: null,
  };
}
/** A readiness row (superset of a totals row) at a cost/sell/VAT + row-type/source-kind. */
function readinessRow(over: Partial<ReadinessRowInput>): ReadinessRowInput {
  return {
    quantity: 1,
    unit_cost_ore: 0,
    unit_sell_ore: 0,
    vat_rate_bp: 2500,
    is_hidden: false,
    is_optional: false,
    is_selected: null,
    row_type: "material",
    source_kind: "article",
    ...over,
  };
}
/** A minimal ready-to-classify input (a customer + facility + contact present so no spurious issue). */
function readinessInput(rows: readonly ReadinessRowInput[], over: Partial<ReadinessInput> = {}): ReadinessInput {
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
function warningCodes(input: ReadinessInput): string[] {
  return classifyReadiness(input).warnings.map((w) => w.code);
}
/** Compose a section total over the fixture's `sectionLines` (through the REAL engine). */
function sectionTotalOf(lines: readonly SectionLine[]): SectionTotal {
  const rows = lines.map((l) => totalsRow(l.unit_sell_ore, l.vat_rate_bp, l.quantity));
  const total = computeSectionTotal(rows);
  assert.ok(total.ok, "computeSectionTotal must resolve for a fixture section");
  return total.value;
}

describe("Story 5.5 — the FULL calc golden PACK (5.5-GOLDEN-01/UNIT-01/UNIT-02, R-505/R-508/R-509/R-512/R-516)", () => {
  // ────────────────────────────────────────────────────────────────────────────────────────────
  // HARD surface-present assertion (NEVER a describe.skip precondition that self-disables the pack).
  // The calc oracle EXISTS at 5.5 time — assert it, fail loud if a symbol is missing.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] the calc oracle surface is present (hard assertion — never a self-disabling skip gate)", () => {
    assert.equal(typeof computeLineTotal, "function", "totals.ts#computeLineTotal must be importable");
    assert.equal(typeof computeSectionTotal, "function", "totals.ts#computeSectionTotal must be importable");
    assert.equal(typeof resolveTotalDisplay, "function", "totals.ts#resolveTotalDisplay must be importable");
    assert.equal(typeof classifyReadiness, "function", "readiness.ts#classifyReadiness must be importable");
    assert.equal(typeof resolveVatDisplayPosture, "function", "vat-posture.ts#resolveVatDisplayPosture must be importable");
    assert.equal(typeof PILOT_LOW_MARGIN_THRESHOLD, "number", "readiness.ts#PILOT_LOW_MARGIN_THRESHOLD must be importable");
    assert.equal(typeof engine.estimateDeduction, "function", "@/lib/money#estimateDeduction must be importable");
  });

  // ── The AC1 calc categories the pack MUST cover (the COVERAGE manifest) ──────────────────────
  // NEW categories are proven by a LIVE oracle case in calc-rows.json (a value driven through the
  // engine — not a mere substring token, deferred-work.md#epic-4 Iter-2). REFERENCE categories are
  // proven by their owning per-category money fixture (R-508 single authority).
  const NEW_CATEGORIES = [
    "row-type-labor",
    "row-type-material",
    "row-type-subcontractor",
    "row-type-machinery",
    "row-type-other",
    "fractional-quantities",
    "margins",
    "section-mode-detailed",
    "section-mode-summary",
    "section-mode-text_only",
    "vat-display",
    "attachment-readiness",
  ] as const;
  const REFERENCE_MANIFEST: Record<string, { readonly file: string; readonly token: string }> = {
    "options-tillval": { file: "options-tillval.json", token: "inclusionCases" },
    "hidden-rows": { file: "options-tillval.json", token: "hidden-row-counts-toward-deduction-basis" },
    "rot-warning": { file: "rot-gron-deductions.json", token: "\"deductionType\": \"rot\"" },
    "gron-teknik-warning": { file: "rot-gron-deductions.json", token: "gron_teknik" },
    "regular-vat": { file: "vat-rates.json", token: "fractionalQuantityChainCase" },
    rounding: { file: "rounding-mode.json", token: "halfRoundingMode" },
  };

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 1 — COVERAGE manifest (5.5-GOLDEN-01): FAIL if any AC1 calc category is unpinned.
  //   A REFERENCE category is proven by its owning fixture; a NEW category by a calc-rows.json case.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] the pack COVERS every AC1 calc category (manifest fails if any category is unpinned)", () => {
    // REFERENCE half — each category's owning fixture + token must exist in the frozen fixtures.
    for (const [category, entry] of Object.entries(REFERENCE_MANIFEST)) {
      const path = resolve(GOLDEN_DIR, entry.file);
      assert.ok(existsSync(path), `AC1 category '${category}' -> authority fixture ${entry.file} must exist`);
      const raw = readFileSync(path, "utf8");
      assert.ok(raw.includes(entry.token), `AC1 category '${category}' must be represented in ${entry.file} (token '${entry.token}')`);
    }

    // NEW half — calc-rows.json must exist AND carry a case for EVERY new category (by its `category`
    // field), so a category is pinned by a live case in the fixture the behavioral guards drive.
    const path = resolve(GOLDEN_DIR, CALC_ROWS_FIXTURE);
    assert.ok(existsSync(path), `calc-rows.json must exist (the NEW calc-row authority)`);
    const covered = new Set(loadCalcRows().cases.map((c) => c.category));
    for (const category of NEW_CATEGORIES) {
      assert.ok(covered.has(category), `AC1 NEW category '${category}' must have a calc-rows.json case (found: ${[...covered].join(", ")})`);
    }

    // Guard the manifest itself: every declared category (NEW + REFERENCE) is mapped — no silent gap.
    const REFERENCE_CATEGORIES = Object.keys(REFERENCE_MANIFEST);
    const allDeclared = NEW_CATEGORIES.length + REFERENCE_CATEGORIES.length;
    assert.equal(allDeclared, 18, "the AC1 manifest must declare all 18 calc categories (12 new + 6 reference)");
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 2 — LABELLING (5.5-UNIT-02): every NEW case carries a valid three-way `origin` + a
  //   non-empty `note`; a `documented-delta` case ALSO records its divergent old-Lovable value so a
  //   golden FAILURE points at the affected assumption/delta rather than an unexplained diff.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] every NEW calc-rows.json case carries a valid origin + a non-empty note; documented-delta carries its old value", () => {
    const fx = loadCalcRows();
    assert.ok(fx.cases.length >= 1, "calc-rows.json must carry >=1 case");
    for (const c of fx.cases) {
      assert.ok(isValidOrigin(c.origin), `${c.id}: origin must be one of old-lovable/new-expected/documented-delta (got ${String(c.origin)})`);
      assert.ok(
        typeof c.note === "string" && c.note.trim().length > 0,
        `${c.id}: a non-empty note is required (an unlabelled/note-less golden is a silent-regression trap)`,
      );
      if (c.origin === "documented-delta" || c.origin === "old-lovable") {
        // A documented-delta / old-lovable case MUST record the value it diverges FROM / originates
        // from so a failing golden is explainable, not an unexplained diff (5.5-UNIT-02).
        assert.equal(
          typeof c.oldLovableWouldGive,
          "number",
          `${c.id}: a ${c.origin} case must carry the divergent/captured old-Lovable value (oldLovableWouldGive)`,
        );
      }
    }
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 3 — BEHAVIORAL GOLDEN (live oracle): the NEW numeric cases DRIVE the real
  //   totals.ts / readiness.ts / vat-posture.ts / @/lib/money and assert the OUTPUT equals the
  //   pinned öre/classification. Split by AC1 category — each is a LIVE oracle, never a static field.
  // ────────────────────────────────────────────────────────────────────────────────────────────

  // 3a — FIVE row types: each row_type composes through computeLineTotal/computeSectionTotal
  //      identically (a row type never forks the öre computation).
  test("[P0] 3a FIVE row types — computeLineTotal per row_type reproduces the pinned öre; the section sums to the pinned total", () => {
    for (const id of ["row-type-labor", "row-type-material", "row-type-subcontractor", "row-type-machinery", "row-type-other"]) {
      const c = findCase(id);
      assert.ok(typeof c.unit_sell_ore === "number" && typeof c.vat_rate_bp === "number", `${id}: must carry unit_sell_ore + vat_rate_bp`);
      const line = computeLineTotal(totalsRow(c.unit_sell_ore!, c.vat_rate_bp!, c.quantity ?? 1));
      assert.ok(line.ok, `${id}: computeLineTotal must resolve`);
      assert.equal(line.value.netOre, c.expectedLineNetOre, `${id}: net — ${c.note}`);
      assert.equal(line.value.vatOre, c.expectedLineVatOre, `${id}: VAT — ${c.note}`);
      assert.equal(line.value.grossOre, c.expectedLineGrossOre, `${id}: gross — ${c.note}`);
    }
    // The all-five-row-types section composes through computeSectionTotal to the pinned section total.
    const s = findCase("row-types-section-composition");
    assert.ok(s.sectionLines, "row-types-section-composition must carry sectionLines");
    const total = sectionTotalOf(s.sectionLines!);
    assert.equal(total.netOre, s.expectedSectionNetOre, `section net — ${s.note}`);
    assert.equal(total.vatOre, s.expectedSectionVatOre, `section VAT — ${s.note}`);
    assert.equal(total.grossOre, s.expectedSectionGrossOre, `section gross — ${s.note}`);

    // A labor row WITHOUT source_kind='work_role' also exercises the MISSING_WORK_ROLE warning.
    const laborNoRole = classifyReadiness(readinessInput([readinessRow({ row_type: "labor", source_kind: null, unit_sell_ore: 12000 })]));
    assert.ok(laborNoRole.warnings.some((w) => w.code === "MISSING_WORK_ROLE"), "a labor row without a work role must warn MISSING_WORK_ROLE");
  });

  // 3b — FRACTIONAL quantity: computeLineTotal drives lineNetOre on a fractional qty; matches the
  //      pinned öre. The underlying chain is REFERENCED from vat-rates.json (single authority R-508).
  test("[P0] 3b FRACTIONAL quantities — computeLineTotal on a fractional qty reproduces the vat-rates chain öre", () => {
    const c = findCase("fractional-quantity-calc-row");
    assert.ok(typeof c.quantity === "number" && typeof c.unit_sell_ore === "number", "fractional case must carry qty + sell");
    const line = computeLineTotal(totalsRow(c.unit_sell_ore!, c.vat_rate_bp!, c.quantity!));
    assert.ok(line.ok, "computeLineTotal must resolve for the fractional row");
    assert.equal(line.value.netOre, c.expectedLineNetOre, `fractional net — ${c.note}`);
    assert.equal(line.value.vatOre, c.expectedLineVatOre, `fractional VAT — ${c.note}`);
    assert.equal(line.value.grossOre, c.expectedLineGrossOre, `fractional gross — ${c.note}`);

    // R-508: the referenced authority (vat-rates.json#fractionalQuantityChainCase) OWNS this chain.
    // Prove the calc-row surface reproduces the SAME pinned öre (a divergence is a STOP, not a re-pin).
    const vat = readJson("vat-rates.json") as { fractionalQuantityChainCase: { quantity: number; unitPriceOre: number; expectedLineNetOre: number; expectedLineVatOre: number; expectedGrossOre: number } };
    const ref = vat.fractionalQuantityChainCase;
    assert.equal(c.quantity, ref.quantity, "the calc-row fractional qty must reference the vat-rates authority qty");
    assert.equal(c.unit_sell_ore, ref.unitPriceOre, "the calc-row fractional sell must reference the vat-rates authority unit price");
    assert.equal(line.value.netOre, ref.expectedLineNetOre, "the calc-row net must reproduce the vat-rates pinned net (R-508)");
    assert.equal(line.value.vatOre, ref.expectedLineVatOre, "the calc-row VAT must reproduce the vat-rates pinned VAT (R-508)");
    assert.equal(line.value.grossOre, ref.expectedGrossOre, "the calc-row gross must reproduce the vat-rates pinned gross (R-508)");
  });

  // 3c — MARGINS: classifyReadiness raises LOW_MARGIN for a counted row TB% strictly BELOW
  //      PILOT_LOW_MARGIN_THRESHOLD (0.15) and NOT at/above. A 0-sell row -> ZERO_PRICE_ROW, NOT a
  //      divide-by-zero margin. TB% is computed by readiness.ts#rowMarginRatio — no inline money math.
  test("[P0] 3c MARGINS — LOW_MARGIN below the pilot threshold, none at/above; a 0-sell row is ZERO_PRICE_ROW not a low margin", () => {
    // Below the threshold -> LOW_MARGIN.
    const below = findCase("margin-below-threshold-low-margin");
    const belowWarnings = warningCodes(readinessInput([readinessRow({ unit_cost_ore: below.unit_cost_ore ?? 0, unit_sell_ore: below.unit_sell_ore, vat_rate_bp: below.vat_rate_bp })]));
    assert.ok(belowWarnings.includes("LOW_MARGIN"), `below threshold must warn LOW_MARGIN — ${below.note}`);

    // At the threshold -> NO LOW_MARGIN (the rule is strictly-below).
    const at = findCase("margin-at-threshold-no-warning");
    const atWarnings = warningCodes(readinessInput([readinessRow({ unit_cost_ore: at.unit_cost_ore ?? 0, unit_sell_ore: at.unit_sell_ore, vat_rate_bp: at.vat_rate_bp })]));
    assert.ok(!atWarnings.includes("LOW_MARGIN"), `at threshold (0.15) must NOT warn LOW_MARGIN (strictly-below) — ${at.note}`);

    // Above the threshold -> NO LOW_MARGIN.
    const above = findCase("margin-above-threshold-no-warning");
    const aboveWarnings = warningCodes(readinessInput([readinessRow({ unit_cost_ore: above.unit_cost_ore ?? 0, unit_sell_ore: above.unit_sell_ore, vat_rate_bp: above.vat_rate_bp })]));
    assert.ok(!aboveWarnings.includes("LOW_MARGIN"), `above threshold must NOT warn LOW_MARGIN — ${above.note}`);

    // A 0-sell row -> ZERO_PRICE_ROW, and NO LOW_MARGIN (no divide-by-zero margin).
    const zero = findCase("margin-zero-sell-no-margin-zero-price-row");
    const zeroWarnings = warningCodes(readinessInput([readinessRow({ unit_cost_ore: 0, unit_sell_ore: 0, vat_rate_bp: zero.vat_rate_bp })]));
    assert.ok(zeroWarnings.includes("ZERO_PRICE_ROW"), `a 0-sell row must warn ZERO_PRICE_ROW — ${zero.note}`);
    assert.ok(!zeroWarnings.includes("LOW_MARGIN"), "a 0-sell row must NOT read as a low-margin defect (no divide-by-zero margin)");

    // The threshold the fixture prose asserts against IS the pilot constant (an UNAPPROVED pilot value).
    assert.equal(PILOT_LOW_MARGIN_THRESHOLD, 0.15, "the fixture margin cases assume the pilot 0.15 threshold");
  });

  // 3d — SECTION MODES: detailed/summary/text_only compose the SAME computeSectionTotal öre. The
  //      display mode is PRESENTATION metadata — it does NOT change the source total (5.2-UNIT-04).
  test("[P0] 3d SECTION MODES — detailed/summary/text_only compose the identical computeSectionTotal öre", () => {
    const modes = ["section-mode-detailed", "section-mode-summary", "section-mode-text_only"];
    const totals = modes.map((id) => {
      const c = findCase(id);
      assert.ok(c.sectionLines, `${id}: must carry sectionLines`);
      const total = sectionTotalOf(c.sectionLines!);
      assert.equal(total.netOre, c.expectedSectionNetOre, `${id}: net — ${c.note}`);
      assert.equal(total.vatOre, c.expectedSectionVatOre, `${id}: VAT — ${c.note}`);
      assert.equal(total.grossOre, c.expectedSectionGrossOre, `${id}: gross — ${c.note}`);
      return total;
    });
    // The presentation mode never changes the source total — all three modes yield the identical öre.
    assert.deepEqual(totals[1], totals[0], "summary section total must equal detailed (mode is presentation-only)");
    assert.deepEqual(totals[2], totals[0], "text_only section total must equal detailed (mode is presentation-only)");
  });

  // 3e — VAT DISPLAY: resolveVatDisplayPosture -> resolveTotalDisplay renders excl/incl/both per
  //      posture; a posture round-trip returns the IDENTICAL stored öre. The breakdown is REFERENCED
  //      from vat-rates.json (single authority R-508) — no VAT numbers invented here.
  test("[P0] 3e VAT DISPLAY — resolveVatDisplayPosture/resolveTotalDisplay render per posture; a round-trip returns the identical stored öre", () => {
    const c = findCase("vat-display-posture-round-trip");
    assert.ok(typeof c.netOre === "number" && typeof c.vatOre === "number" && typeof c.grossOre === "number" && c.postures, "VAT-display case must carry net/VAT/gross + postures");

    // R-508: the breakdown öre are REFERENCED from vat-rates.json#vat-25pct-standard — prove they match.
    const vat = readJson("vat-rates.json") as { lineVatCases: { id: string; lineNetOre: number; expectedLineVatOre: number; expectedGrossOre: number }[] };
    const std = vat.lineVatCases.find((x) => x.id === "vat-25pct-standard");
    assert.ok(std, "vat-rates.json must carry the vat-25pct-standard authority case");
    assert.equal(c.netOre, std!.lineNetOre, "the VAT-display net must reference the vat-rates authority net (R-508)");
    assert.equal(c.vatOre, std!.expectedLineVatOre, "the VAT-display VAT must reference the vat-rates authority VAT (R-508)");
    assert.equal(c.grossOre, std!.expectedGrossOre, "the VAT-display gross must reference the vat-rates authority gross (R-508)");

    const total: SectionTotal = { netOre: c.netOre!, vatOre: c.vatOre!, grossOre: c.grossOre! };
    for (const p of c.postures!) {
      const posture = resolveVatDisplayPosture(p.customerType, p.tenantDefaultVatDisplay);
      assert.equal(posture, p.expectedResolvedPosture, `${p.customerType}/${p.tenantDefaultVatDisplay}: resolved posture — ${c.note}`);
      const view = resolveTotalDisplay(total, posture);
      assert.equal(view.primaryOre, p.expectedPrimaryOre, `${p.customerType}/${p.tenantDefaultVatDisplay}: primary öre — ${c.note}`);
      assert.equal(view.togglable, p.expectedTogglable, `${p.customerType}/${p.tenantDefaultVatDisplay}: togglable`);
      // Presentation-only: a posture round-trip returns the IDENTICAL stored net/VAT/gross öre.
      assert.equal(view.netOre, c.netOre, "the view must re-derive the SAME stored net öre (presentation never mutates the source)");
      assert.equal(view.vatOre, c.vatOre, "the view must re-derive the SAME stored VAT öre");
      assert.equal(view.grossOre, c.grossOre, "the view must re-derive the SAME stored gross öre");
    }
  });

  // 3f — ROT/grön WARNING: drive estimateDeduction on the resolved POSTURE (never PII) via the
  //      rot-gron-deductions.json pinned cases: requiresSignOff===true; a ROT×grön mix is the
  //      BLOCKING ROT_GRON_MIX_NOT_ALLOWED; only `private` is eligible; persons stays a FLAT cap.
  //      Also assert classifyReadiness emits TAX_SIGN_OFF_REQUIRED framed as an ESTIMATE (R-509).
  test("[P0] 3f ROT/grön WARNING — estimateDeduction keeps requiresSignOff===true; a mix is blocked; persons is a FLAT cap (R-509/R-512)", () => {
    const rot = readJson("rot-gron-deductions.json") as {
      deductionCases: { id: string; deductionType: string; eligibleBasisOre?: number; posture: string; persons?: number; expectedDeductionOre: number; expectRequiresSignOff?: boolean }[];
      invalidMixCase: { deductionTypes: string[]; eligibleBasisOre: number; posture: string; persons?: number; expectedErrorCode: string };
    };

    // A pinned private ROT case still requires sign-off (an UNAPPROVED estimate, never legally-final).
    const rotCase = rot.deductionCases.find((x) => x.id === "rot-below-cap-private");
    assert.ok(rotCase, "rot-gron-deductions.json must carry the rot-below-cap-private authority case");
    const est = engine.estimateDeduction({
      deductionType: rotCase!.deductionType,
      eligibleBasisOre: rotCase!.eligibleBasisOre,
      posture: rotCase!.posture, // a resolved POSTURE, never a personnummer (R-516)
      persons: rotCase!.persons,
      capturedAt: CAPTURED_AT,
    });
    assert.ok(isOk(est), `estimateDeduction must be ok, got ${JSON.stringify(est)}`);
    assert.equal((est as Record<string, unknown>).deductionOre, rotCase!.expectedDeductionOre, "the deduction reproduces the pinned öre (R-508)");
    assert.equal((est as Record<string, unknown>).requiresSignOff, true, "an UNAPPROVED profile estimate must keep requiresSignOff===true (never legally-final, R-509)");

    // persons stays a FLAT cap: the same basis with a HIGHER persons count yields the SAME deduction
    // (no per-person multiplier, R-512). A per-person scale is owner-gated (Sign-Off Q3).
    const estMorePersons = engine.estimateDeduction({
      deductionType: rotCase!.deductionType,
      eligibleBasisOre: rotCase!.eligibleBasisOre,
      posture: rotCase!.posture,
      persons: 4,
      capturedAt: CAPTURED_AT,
    });
    assert.ok(isOk(estMorePersons), "estimateDeduction with persons=4 must be ok");
    assert.equal(
      (estMorePersons as Record<string, unknown>).deductionOre,
      rotCase!.expectedDeductionOre,
      "persons must NOT scale the deduction — the cap is a FLAT placeholder (R-512, no per-person multiplier)",
    );

    // A ROT×grön mix is the BLOCKING typed failure — never a silent combined sum (R-406).
    const mix = engine.estimateDeduction({
      deductionTypes: rot.invalidMixCase.deductionTypes,
      eligibleBasisOre: rot.invalidMixCase.eligibleBasisOre,
      posture: rot.invalidMixCase.posture,
      persons: rot.invalidMixCase.persons,
      capturedAt: CAPTURED_AT,
    });
    assert.equal(isOk(mix), false, "a ROT×grön mix must NOT succeed");
    assert.equal((mix as Record<string, unknown>).code, rot.invalidMixCase.expectedErrorCode, "a ROT×grön mix is the BLOCKING ROT_GRON_MIX_NOT_ALLOWED, never a silent sum");

    // A calc carrying a ROT assumption surfaces TAX_SIGN_OFF_REQUIRED as an ESTIMATE (never final).
    const readinessWithTax = classifyReadiness(
      readinessInput([readinessRow({ row_type: "labor", source_kind: "work_role", unit_cost_ore: 60000, unit_sell_ore: 100000 })], {
        tax: { hasDeductionAssumption: true, deductionType: "rot", eligibilityPosture: "private" },
      }),
    );
    const taxIssue = readinessWithTax.warnings.find((w) => w.code === "TAX_SIGN_OFF_REQUIRED");
    assert.ok(taxIssue, "a ROT assumption must surface TAX_SIGN_OFF_REQUIRED");
    assert.equal(taxIssue!.severity, "warning", "the tax sign-off issue is a WARNING (soft), never a silent approval");
    assert.match(taxIssue!.message, /UPPSKATTNING|godkännande|inte ett slutgiltigt/i, "the tax message must frame the deduction as an ESTIMATE requiring sign-off, never legally-final (R-509)");
  });

  // 3g — ATTACHMENT-READINESS: classifyReadiness ALWAYS emits REQUIRED_FILES_DEFERRED (the Story 8.1
  //      deferral disclosure, R-513) — a documented deferral, never silently omitted, never a real
  //      file check (Epic 8 owns that).
  test("[P0] 3g ATTACHMENT-READINESS — classifyReadiness ALWAYS emits REQUIRED_FILES_DEFERRED (the Story 8.1 deferral disclosure, R-513)", () => {
    const c = findCase("attachment-readiness-required-files-deferred");
    assert.equal(c.expectRequiredFilesDeferred, true, "the fixture case must assert the deferral is present");
    // A minimal fully-populated calc (no other issue) STILL emits the deferral disclosure.
    const report = classifyReadiness(readinessInput([readinessRow({ row_type: "material", source_kind: "article", unit_cost_ore: 6000, unit_sell_ore: 8000 })]));
    assert.ok(report.warnings.some((w) => w.code === "REQUIRED_FILES_DEFERRED"), "REQUIRED_FILES_DEFERRED must ALWAYS be present (a documented Story 8.1 deferral, R-513)");
    // An empty calc (no rows at all) STILL emits it — it is unconditional, never wired to a file read.
    const empty = classifyReadiness(readinessInput([]));
    assert.ok(empty.warnings.some((w) => w.code === "REQUIRED_FILES_DEFERRED"), "REQUIRED_FILES_DEFERRED must be present even on an empty calc (unconditional deferral, never a real file check)");
  });

  // 3h — OPTIONS / HIDDEN-ROWS (reference): the category is covered by the 5.4
  //      readiness-inclusion.golden.test.ts + options-tillval.json — the pack ASSERTS coverage and
  //      adds a section-composition case on the SAME pinned öre (never a duplicate of the 5.4 cases).
  test("[P1] 3h OPTIONS/HIDDEN-ROWS (reference) — the 5.4 inclusion golden owns the category; a section composition reproduces the SAME pinned öre", () => {
    // The 5.4 calc-row inclusion golden exists and owns the options/tillval + hidden-rows category.
    const inclusionGolden = resolve(HERE, "readiness-inclusion.golden.test.ts");
    assert.ok(existsSync(inclusionGolden), "the 5.4 readiness-inclusion.golden.test.ts must own the options/hidden-rows calc-row category (do NOT duplicate it)");

    // Reference the SAME pinned öre (options-tillval.json) and prove a section composition of a
    // SELECTED option + a HIDDEN row reproduces the pinned included net — using the single authority.
    const opt = readJson("options-tillval.json") as { inclusionCases: { id: string; baseLinesOre?: number[]; selectedOptionOre?: number; expectedIncludedNetOre?: number }[] };
    const selected = opt.inclusionCases.find((x) => x.id === "selected-option-counts-toward-net");
    assert.ok(selected?.baseLinesOre && typeof selected.selectedOptionOre === "number" && typeof selected.expectedIncludedNetOre === "number", "the options authority must carry the selected-option case");

    // Model base rows (one HIDDEN) + a SELECTED option row — a hidden row + a selected option both
    // COUNT (the frozen 2026-06-18 pin); an unselected option would NOT. Uses ONLY the pinned öre.
    const rows: TotalsRowInput[] = [
      ...selected!.baseLinesOre!.map((ore, i) => ({
        quantity: 1,
        unit_sell_ore: ore,
        vat_rate_bp: 0,
        is_hidden: i === 0, // the FIRST base row is HIDDEN — it still counts
        is_optional: false,
        is_selected: null,
      })),
      { quantity: 1, unit_sell_ore: selected!.selectedOptionOre!, vat_rate_bp: 0, is_hidden: false, is_optional: true, is_selected: true }, // SELECTED option — counts
    ];
    const total = computeSectionTotal(rows);
    assert.ok(total.ok, "the composed section must resolve");
    assert.equal(
      total.value.netOre,
      selected!.expectedIncludedNetOre,
      "a HIDDEN base row + a SELECTED option both COUNT — the composed net reproduces the pinned included net (R-508, no re-pin)",
    );
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 4 — SCHEMA-SHAPE: a malformed/half-authored calc-rows.json case (missing origin/note/an
  //   expected öre value) FAILS loud — no vacuous case.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P1] calc-rows.json schema-shape guard — required top-level keys + every case's id/origin/note/>=1 expected integer öre value", () => {
    const raw = readJson(CALC_ROWS_FIXTURE) as Record<string, unknown>;
    assert.equal(typeof raw._doc, "string", "calc-rows.json must carry a _doc provenance string");
    assert.equal(typeof raw.policy, "object", "calc-rows.json must carry a policy block");
    assert.ok(Array.isArray(raw.cases), "calc-rows.json must carry a cases array");

    for (const c of loadCalcRows().cases) {
      assert.equal(typeof c.id, "string", "each case needs an id");
      assert.equal(typeof c.category, "string", `${c.id}: each case needs a category`);
      assert.ok(isValidOrigin(c.origin), `${c.id}: missing/invalid origin`);
      assert.ok(typeof c.note === "string" && c.note.trim().length > 0, `${c.id}: missing note`);

      // Each case must carry AT LEAST one expected numeric öre value OR a boolean classification
      // expectation (a margin/attachment case is a CLASSIFICATION oracle, not an öre one — but it is
      // never vacuous). Collect the expected öre values and assert they are INTEGER öre.
      const oreValues = [
        c.expectedLineNetOre,
        c.expectedLineVatOre,
        c.expectedLineGrossOre,
        c.expectedSectionNetOre,
        c.expectedSectionVatOre,
        c.expectedSectionGrossOre,
        c.netOre,
        c.vatOre,
        c.grossOre,
      ].filter((v): v is number => typeof v === "number");
      const hasClassificationExpectation =
        typeof c.expectLowMarginWarning === "boolean" ||
        typeof c.expectZeroPriceRow === "boolean" ||
        typeof c.expectRequiredFilesDeferred === "boolean" ||
        Array.isArray(c.postures);
      assert.ok(
        oreValues.length >= 1 || hasClassificationExpectation,
        `${c.id}: a case must carry >=1 expected öre value OR a classification expectation (a half-authored case has neither)`,
      );
      for (const v of oreValues) {
        assert.ok(Number.isInteger(v), `${c.id}: every expected öre value must be an integer öre (got ${v})`);
        // Under 10 digits — the orgnr-scan false-positive trap (deferred-work.md#epic-4 Iter-2).
        assert.ok(Math.abs(v) < 1_000_000_000, `${c.id}: every öre value must be < 10 digits (< 1,000,000,000 öre) — the orgnr-scan false-positive trap`);
      }
      // A posture case's expected primary öre are also integers under 10 digits.
      for (const p of c.postures ?? []) {
        assert.ok(Number.isInteger(p.expectedPrimaryOre) && Math.abs(p.expectedPrimaryOre) < 1_000_000_000, `${c.id}: posture primary öre must be an integer < 10 digits`);
      }
    }
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // + EXTENDED PRIVACY SCAN (5.5-UNIT-01, R-516): the pack-wide anonymization scan EXTENDED to
  //   calc-rows.json. REUSE the money-pack scan classes (personnummer \d{6}-\d{4}, orgnr \d{10}
  //   no-dash, non-example.test email, secret/password/api_key, PHONE, ADDRESS) over the DATA
  //   payload (WITHOUT `_doc` prose, which legitimately names the PII rules). A calc fixture carries
  //   öre/rate/qty numbers + policy prose ONLY, never PII — and NO personnummer path into
  //   @/lib/money or a calc row (the engine takes a POSTURE only, R-516).
  //   NOTE: keep every calc öre value UNDER 10 digits or the bare-\d{10} orgnr guard false-positives
  //   on a large öre value (deferred-work.md#epic-4 Iter-2). The schema-shape guard enforces < 10
  //   digits, so the numeric-öre trap cannot trip here.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] extended privacy scan — no real PII/secret in the calc-rows.json DATA payload; the engine takes a POSTURE, never a personnummer (R-516)", () => {
    // The SAME scan classes the money pack uses (tests/unit/lib/money/golden-pack.test.ts) — reused
    // + extended over the calc-rows.json DATA payload.
    const PERSONNUMMER = /\b\d{6}-\d{4}\b/; // YYMMDD-NNNN
    const ORGNR = /\b\d{10}\b/; // orgnr 10-digit no-dash shape — a distinct guard, not a personnummer alias
    const NON_EXAMPLE_EMAIL = /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i;
    const SECRET = /secret|password|api_key/i;
    const PHONE = /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/;
    const ADDRESS = /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i;

    const parsed = readJson(CALC_ROWS_FIXTURE) as Record<string, unknown>;
    // Strip the _doc prose (it legitimately names personnummer/orgnr/phone/address as RULES).
    const { _doc, ...dataOnly } = parsed;
    assert.equal(typeof _doc, "string", "calc-rows.json must carry a _doc note (scanned SEPARATELY from the data)");
    const data = JSON.stringify(dataOnly);
    assert.ok(!PERSONNUMMER.test(data), "calc-rows.json DATA must contain no personnummer shape (\\d{6}-\\d{4})");
    assert.ok(!ORGNR.test(data), "calc-rows.json DATA must contain no organization-number shape (orgnr, 10-digit no-dash \\d{10}) — keep öre < 10 digits");
    assert.ok(!NON_EXAMPLE_EMAIL.test(data), "calc-rows.json DATA must contain no non-example.test email");
    assert.ok(!SECRET.test(data), "calc-rows.json DATA must contain no secret/password/api_key");
    assert.ok(!PHONE.test(data), "calc-rows.json DATA must contain no phone number");
    assert.ok(!ADDRESS.test(data), "calc-rows.json DATA must contain no street address");

    // No PII path into the engine: the ROT/grön engine input is a POSTURE string, never a personnummer.
    // Assert every calc-rows.json case's data carries NO `personnummer`/`pnr` KEY (posture only).
    for (const c of loadCalcRows().cases) {
      const keys = Object.keys(c);
      assert.ok(!keys.some((k) => /personnummer|pnr|orgnr|ssn/i.test(k)), `${c.id}: a calc case must carry NO PII key (personnummer/pnr/orgnr) — the engine takes a POSTURE only (R-516)`);
    }
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // Sanity: the pack re-approves NOTHING — calc-rows.json signOff stays pending (R-509).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P1] the NEW calc-rows.json marks nothing production-approved — policy.signOff stays 'pending-owner-accounting-legal'", () => {
    const fx = loadCalcRows();
    assert.equal(
      fx.policy.signOff,
      "pending-owner-accounting-legal",
      "the pack must not silently re-approve any Epic-4 assumption (rates/caps/thresholds stay UNAPPROVED)",
    );
  });
});
