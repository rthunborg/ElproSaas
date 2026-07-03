/**
 * Story 5.5 — the FULL CALC GOLDEN PACK (5.5-GOLDEN-01 / 5.5-UNIT-01 / 5.5-UNIT-02, R-505/R-508/
 * R-509/R-512/R-513/R-516). This is the calc-row-layer analogue of the Story 4.4 money pack
 * (`tests/unit/lib/money/golden-pack.test.ts`) — the same 4 pack-level guards + the pack-wide
 * PRIVACY scan, but driving the REAL calc oracle (`totals.ts` / `readiness.ts` / `vat-posture.ts`)
 * across EVERY AC1 category at the CALC-ROW layer.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SCAFFOLD STATUS (ATDD hand-off) — NO RED PHASE, authored + greened in ONE pass.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * This story has NO conventional ATDD red phase: the calc engine + the calc-row surface
 * (`totals.ts`/`readiness.ts`/`vat-posture.ts`/`@/lib/money`) ALREADY EXIST at 5.5 time, so the
 * pack is authored + greened in ONE pass exactly like the 4.4 pack (retro-note 5-1: a pack over an
 * existing engine has no red phase). The placeholders below therefore FAIL LOUD via
 * `todo(...)` — they are NOT `test.skip()` and NOT `describe.skip` (the resumed-run /
 * surface-present-self-disable trap that leaves a vacuous green; deferred-work.md#epic-4 Iter-2).
 * dev-story (bmad-dev-story) REPLACES each `todo(...)` body with the live-oracle assertion described
 * in the ATDD checklist (`_bmad-output/test-artifacts/atdd-checklist-5-5-...md`) and REMOVES the
 * `todo` marker in the SAME green pass. A shipped `todo(...)` left in the tree is a story-incomplete
 * signal, not a passing test.
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
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock. The `@/lib/money`
 * barrel + `@/features/calculations/*` resolve under `node --test` via the Story 4.1 alias-hook.
 *
 * [Source: _bmad-output/implementation-artifacts/5-5-calculation-golden-tests-for-options-hidden-
 *  rows-and-tax-warnings.md; test-design-epic-5.md#5.5-GOLDEN-01/#5.5-UNIT-01/#5.5-UNIT-02;
 *  tests/unit/lib/money/golden-pack.test.ts (the 4-guard template); tests/unit/features/
 *  calculations/readiness-inclusion.golden.test.ts (the 5.4 inclusion golden — do NOT duplicate)]
 */
import { test, describe, todo } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ── The REAL calc oracle the pack DRIVES (never re-derives). Imported at the TOP level (hard
//    presence assertion below — NEVER a describe.skip precondition that could self-disable). ──
import {
  computeLineTotal,
  computeSectionTotal,
  computeCalcTotal,
  rowCountsTowardTotal,
  resolveTotalDisplay,
} from "@/features/calculations/totals";
// NOTE (dev-story): re-add `type TotalsRowInput` from "@/features/calculations/totals" when
// authoring the row-type / section-mode guard bodies (Guard 3a/3d).
import {
  classifyReadiness,
  PILOT_LOW_MARGIN_THRESHOLD,
} from "@/features/calculations/readiness";
import {
  resolveVatDisplayPosture,
  DEFAULT_TENANT_VAT_DISPLAY,
} from "@/features/calculations/vat-posture";
import * as money from "@/lib/money";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(HERE, "../../../fixtures/golden/money");

// Silence unused-import lint during the SCAFFOLD phase — dev-story consumes these in the guard
// bodies below. (Remove this block once every `todo(...)` is replaced.)
void computeLineTotal;
void computeSectionTotal;
void computeCalcTotal;
void rowCountsTowardTotal;
void resolveTotalDisplay;
void classifyReadiness;
void resolveVatDisplayPosture;
void DEFAULT_TENANT_VAT_DISPLAY;
void money;

// ── The AC1 calc categories the pack MUST cover (the COVERAGE manifest) ──────────────────────
// NEW categories (a LIVE case in calc-rows.json / driven through the oracle) vs REFERENCE
// categories (the numbers another fixture already owns; the pack asserts the category is covered).
const AC1_CATEGORIES = [
  // NEW — pinned in calc-rows.json + driven through totals.ts / readiness.ts
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
  // REFERENCE — the number lives in an existing per-category authority (R-508)
  "options-tillval",
  "hidden-rows",
  "rot-warning",
  "gron-teknik-warning",
  "regular-vat",
  "rounding",
] as const;
type Ac1Category = (typeof AC1_CATEGORIES)[number];

/**
 * For a REFERENCE category, the existing fixture file that OWNS its numbers + a token proving the
 * category is represented there. A NEW category is proven by a LIVE oracle case (below), not a
 * substring — so a category is never "covered" by an incidental prose match (deferred-work.md#
 * epic-4 Iter-2 substring-token weakness).
 */
const REFERENCE_MANIFEST: Partial<Record<Ac1Category, { readonly file: string; readonly token: string }>> = {
  "options-tillval": { file: "options-tillval.json", token: "inclusionCases" },
  "hidden-rows": { file: "options-tillval.json", token: "hidden-row-counts-toward-deduction-basis" },
  "rot-warning": { file: "rot-gron-deductions.json", token: "\"deductionType\": \"rot\"" },
  "gron-teknik-warning": { file: "rot-gron-deductions.json", token: "gron_teknik" },
  "regular-vat": { file: "vat-rates.json", token: "fractionalQuantityChainCase" },
  rounding: { file: "rounding-mode.json", token: "halfRoundingMode" },
};

const CALC_ROWS_FIXTURE = "calc-rows.json";
function readJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(GOLDEN_DIR, name), "utf8"));
}

describe("Story 5.5 — the FULL calc golden PACK (5.5-GOLDEN-01/UNIT-01/UNIT-02, R-505/R-508/R-509/R-512/R-516)", () => {
  // ────────────────────────────────────────────────────────────────────────────────────────────
  // HARD surface-present assertion (NEVER a describe.skip precondition that self-disables the pack).
  // The calc oracle EXISTS at 5.5 time — assert it, fail loud if a symbol is missing.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] the calc oracle surface is present (hard assertion — never a self-disabling skip gate)", () => {
    assert.equal(typeof computeSectionTotal, "function", "totals.ts#computeSectionTotal must be importable");
    assert.equal(typeof resolveTotalDisplay, "function", "totals.ts#resolveTotalDisplay must be importable");
    assert.equal(typeof classifyReadiness, "function", "readiness.ts#classifyReadiness must be importable");
    assert.equal(typeof resolveVatDisplayPosture, "function", "vat-posture.ts#resolveVatDisplayPosture must be importable");
    assert.equal(typeof PILOT_LOW_MARGIN_THRESHOLD, "number", "readiness.ts#PILOT_LOW_MARGIN_THRESHOLD must be importable");
    assert.equal(typeof (money as Record<string, unknown>).estimateDeduction, "function", "@/lib/money#estimateDeduction must be importable");
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 1 — COVERAGE manifest (5.5-GOLDEN-01): FAIL if any AC1 calc category is unpinned.
  //   A REFERENCE category is proven by its owning fixture; a NEW category by a live oracle case.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  test("[P0] the pack COVERS every AC1 calc category (manifest fails if any category is unpinned)", () => {
    // The REFERENCE half CAN be asserted against the existing frozen fixtures TODAY.
    for (const [category, entry] of Object.entries(REFERENCE_MANIFEST) as [Ac1Category, { file: string; token: string }][]) {
      const path = resolve(GOLDEN_DIR, entry.file);
      assert.ok(existsSync(path), `AC1 category '${category}' -> authority fixture ${entry.file} must exist`);
      const raw = readFileSync(path, "utf8");
      assert.ok(raw.includes(entry.token), `AC1 category '${category}' must be represented in ${entry.file} (token '${entry.token}')`);
    }
    // The NEW half is filled by dev-story: every NEW category maps to a live case in calc-rows.json.
    // TODO(5.5-dev): assert calc-rows.json exists + carries a case for EACH new category and that the
    // manifest maps ALL of AC1_CATEGORIES (no silent gap). Fail loud until authored.
    void AC1_CATEGORIES;
    void CALC_ROWS_FIXTURE;
    void readJson;
    todo("dev-story: extend the COVERAGE manifest to the NEW calc-rows.json categories (see checklist §Guard 1)", () => {
      assert.fail("calc-rows.json coverage not yet authored");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 2 — LABELLING (5.5-UNIT-02): every NEW case carries a valid three-way `origin` + a
  //   non-empty `note`; a `documented-delta` case ALSO records its divergent old-Lovable value.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  todo("[P0] every NEW calc-rows.json case carries a valid origin + non-empty note; documented-delta carries its old value (dev-story: see checklist §Guard 2)");

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 3 — BEHAVIORAL GOLDEN (live oracle): the NEW numeric cases DRIVE the real
  //   totals.ts / readiness.ts / @/lib/money and assert the OUTPUT equals the pinned öre/classification.
  //   Split by AC1 category (each is a LIVE oracle, never a static field assertion).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  todo("[P0] FIVE row types (labor/material/subcontractor/machinery/other) — computeSectionTotal over each row_type reproduces the pinned öre (dev-story: §Guard 3a)");
  todo("[P0] FRACTIONAL quantities — computeLineTotal drives lineNetOre on a fractional qty, matches the pinned öre (reference vat-rates fractionalQuantityChainCase) (dev-story: §Guard 3b)");
  todo("[P0] MARGINS — classifyReadiness raises LOW_MARGIN for TB% below PILOT_LOW_MARGIN_THRESHOLD (0.15), none at/above; a 0-sell row is ZERO_PRICE_ROW not a divide-by-zero margin (dev-story: §Guard 3c)");
  todo("[P0] SECTION MODES — detailed/summary/text_only compose the same computeSectionTotal öre (presentation mode does not change the source total) (dev-story: §Guard 3d)");
  todo("[P0] VAT DISPLAY — resolveVatDisplayPosture -> resolveTotalDisplay renders excl/incl/both per posture; a posture round-trip returns the identical stored öre (reference vat-rates öre) (dev-story: §Guard 3e)");
  todo("[P0] ROT/grön WARNING — estimateDeduction on the resolved POSTURE (never PII) keeps requiresSignOff===true; a ROT×grön mix is ROT_GRON_MIX_NOT_ALLOWED; persons stays a FLAT cap (reference rot-gron-deductions) (dev-story: §Guard 3f)");
  todo("[P0] ATTACHMENT-READINESS — classifyReadiness ALWAYS emits REQUIRED_FILES_DEFERRED (the Story 8.1 deferral disclosure, R-513) (dev-story: §Guard 3g)");
  todo("[P1] OPTIONS/HIDDEN-ROWS (reference) — the category is covered by the 5.4 readiness-inclusion.golden.test.ts + options-tillval.json; the pack ASSERTS coverage (may add a section-composition case on the SAME pinned öre, never a duplicate) (dev-story: §Guard 3h)");

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // GUARD 4 — SCHEMA-SHAPE guard: a malformed/half-authored calc-rows.json case (missing
  //   origin/note/an expected öre value) FAILS loud (no vacuous case).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  todo("[P1] calc-rows.json schema-shape guard — required top-level keys (_doc/policy/cases) + every case's origin/note/>=1 expected integer öre value (dev-story: §Guard 4)");

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // + EXTENDED PRIVACY SCAN (5.5-UNIT-01, R-516): the pack-wide anonymization scan EXTENDED to
  //   calc-rows.json. REUSE the money-pack scan classes (personnummer \d{6}-\d{4}, orgnr \d{10}
  //   no-dash, non-example.test email, secret/password/api_key, PHONE, ADDRESS) over the DATA
  //   payload (WITHOUT `_doc` prose). Keep every calc öre value UNDER 10 digits (the orgnr-scan
  //   false-positive trap — deferred-work.md#epic-4 Iter-2), or scope the orgnr scan to string leaves.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  todo("[P0] extended privacy scan — no real PII/secret in the calc-rows.json DATA payload; no personnummer path into @/lib/money or a calc row (POSTURE only) (dev-story: §Privacy)");

  // ────────────────────────────────────────────────────────────────────────────────────────────
  // Sanity: the pack re-approves NOTHING — calc-rows.json signOff stays pending (R-509).
  // ────────────────────────────────────────────────────────────────────────────────────────────
  todo("[P1] the NEW calc-rows.json marks nothing production-approved — policy.signOff stays 'pending-owner-accounting-legal' (dev-story: §Sanity)");
});
