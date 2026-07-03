---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-03'
workflowType: testarch-atdd
storyId: 5.5
storyKey: 5-5-calculation-golden-tests-for-options-hidden-rows-and-tax-warnings
storyFile: _bmad-output/implementation-artifacts/5-5-calculation-golden-tests-for-options-hidden-rows-and-tax-warnings.md
atddChecklistPath: _bmad-output/test-artifacts/atdd-checklist-5-5-calculation-golden-tests-for-options-hidden-rows-and-tax-warnings.md
tddPhase: SCAFFOLD-NO-RED (golden pack over an existing engine — authored + greened in ONE pass)
generatedTestFiles:
  - tests/unit/features/calculations/calc-golden-pack.test.ts
inputDocuments:
  - _bmad-output/implementation-artifacts/5-5-calculation-golden-tests-for-options-hidden-rows-and-tax-warnings.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - _bmad-output/test-artifacts/atdd-checklist-5-3-pricing-source-selection-and-row-snapshots.md
  - _bmad/tea/config.yaml
  - tests/unit/lib/money/golden-pack.test.ts
  - tests/unit/features/calculations/readiness-inclusion.golden.test.ts
  - src/features/calculations/totals.ts
  - src/features/calculations/readiness.ts
  - src/features/calculations/vat-posture.ts
  - tests/fixtures/golden/money/options-tillval.json
  - tests/fixtures/golden/money/rot-gron-deductions.json
  - tests/fixtures/golden/money/vat-rates.json
  - tests/fixtures/golden/money/rounding-mode.json
---

# ATDD Checklist: Story 5.5 — Calculation Golden Tests For Options, Hidden Rows, And Tax Warnings

**Role:** Master Test Architect · **Mode:** Create
**TDD Phase:** SCAFFOLD (NO conventional RED phase — see below) · **Generated:** 2026-07-03
**Primary Test Level:** UNIT / GOLDEN (`node --test` fast gate) — NO E2E, NO DB, NO API

---

## Story Summary

Story 5.5 authors the **FULL calc golden PACK**: a new anonymized calc-row fixture
(`tests/fixtures/golden/money/calc-rows.json`) + a live-oracle pack test
(`tests/unit/features/calculations/calc-golden-pack.test.ts`) that DRIVES the real
`totals.ts` / `readiness.ts` / `vat-posture.ts` / `@/lib/money` primitives across every AC1
calc category, REFERENCES the existing per-category numeric authorities (never re-pins them),
labels old/new deltas with a three-way `origin`, and enforces fixture privacy. It ships NO
product code, NO schema, NO migration, NO UI, NO command, NO E2E.

**As a** pilot operator
**I want** calculation golden tests for representative edge cases
**So that** changes to totals, visibility, and warning behavior are caught before pilot use.

---

## Acceptance Criteria (from the story)

1. **AC1 — full pack coverage:** golden tests COVER every AC1 calc category at the CALC-ROW layer,
   driving the REAL `totals.ts` + frozen `@/lib/money`: five row types (labor/material/
   subcontractor/machinery/other), fractional quantities, margins (TB% vs the 0.15 pilot threshold),
   options/tillval (selected count, unselected never summed), hidden rows (count), section display
   modes (detailed/summary/text_only), VAT display (excl/incl/both per posture), ROT/grön warnings
   (`requiresSignOff`, estimate-not-final), attachment-readiness flags (`REQUIRED_FILES_DEFERRED`).
   A pack-level COVERAGE manifest FAILS if any category is unpinned.
2. **AC2 — documented old/new delta:** every NEW case carries a three-way `origin`
   (`old-lovable`/`new-expected`/`documented-delta`) + a non-empty `note`; a `documented-delta`
   records the divergent old-Lovable value. NOTHING is production-approved
   (`signOff: pending-owner-accounting-legal`; rates stay Epic-4 UNAPPROVED placeholders).
3. **AC3 — fixture privacy:** the pack REUSES + EXTENDS the money-golden PII/secret scan over the
   DATA payload of every calc golden fixture; NO PII path into `@/lib/money` or a calc row (the
   engine takes a POSTURE, never a personnummer).

---

## ⚠️ Why there is NO conventional ATDD RED phase (honoring the story's own directives)

This is a **tests-only golden-fixture-pack story over an ENGINE THAT ALREADY EXISTS**. The story
is explicit and repeated (Dev Notes §"Epic-5 retro-note constraints", line 58; Task 4.1 note;
Critical Constraints §5):

> "5.5 has NO ATDD red phase (the engine + calc surface already EXIST — the pack is authored +
> greened in ONE pass, exactly like the 4.4 pack). … a skipped golden is a vacuous pass on the
> exact oracle this story exists to build."

A conventional red phase (`test.skip()` scaffolds that dev un-skips) would be **actively harmful**
here — it is the documented **resumed-run trap** (retro-note 5-1) and the **surface-present
`describe.skip` self-disable trap** (deferred-work.md#epic-4 Iter-2). The calc oracle is present at
5.5 time; the pack asserts it directly.

**What this ATDD run therefore delivers (the sanctioned scaffolding):**

- A **structural pack scaffold** — `tests/unit/features/calculations/calc-golden-pack.test.ts` —
  with imports wired to the REAL oracle, a HARD surface-present assertion (never a skip gate), the
  COVERAGE manifest's **reference half already GREEN** against the frozen fixtures, and every
  remaining guard as a **`todo(...)` placeholder that fails loud** (a tracked TODO in the run output,
  NOT a `test.skip()` and NOT a `describe.skip`). The scaffold is **CI-green (exit 0)** — a failing
  `todo` body is a non-blocking TODO under `node:test` — so it does not red the dev baseline, while
  every dev task is surfaced by name in the run output.
- This **implementation checklist** — mapping every AC1 category → its pack guard → the exact real
  oracle function to drive → the numeric authority to reference (never re-pin).

**dev-story (bmad-dev-story) replaces each `todo(...)` body with the live-oracle assertion below and
REMOVES the `todo` marker in the SAME green pass.** A shipped `todo(...)` is a story-incomplete
signal. Do NOT leave any `test.skip`/`describe.skip`/`notYetImplemented` behind.

---

## Step 1 — Preflight & Context

**Stack detection (`test_stack_type: auto`):** classified **backend/pure-unit** for THIS story —
no `page.goto`/`page.locator`, no DB. The whole deliverable runs on the `node --test` fast gate
(`pnpm run test:unit`), not Vitest/Playwright. Framework prerequisites are already satisfied (the
Story 4.1 alias-hook `tests/support/register.mjs` resolves `@/lib/money` + `@/features/calculations/*`
under `node --test`); no HALT.

**Prerequisite reality (the gating fact — by design, no HALT):** 5.5 inherits a COMPLETE substrate
and COMPOSES it. Already green in `main`: the frozen Epic-4 `@/lib/money` engine + its five
per-category golden fixtures + the 4.4 pack (`tests/unit/lib/money/golden-pack.test.ts` — the exact
4-guard template); the Story 5.1 calc schema/commands; the 5.2 `totals.ts`
(`computeLineTotal`/`computeSectionTotal`/`computeCalcTotal`/`rowCountsTowardTotal`/
`resolveTotalDisplay`); the 5.3 pricing-source snapshots; the 5.4 `readiness.ts`
(`classifyReadiness`/`rowMarginRatio`/`PILOT_LOW_MARGIN_THRESHOLD` + the `LOW_MARGIN`/
`TAX_SIGN_OFF_REQUIRED`/`HIDDEN_ROWS_INCLUDED`/`REQUIRED_FILES_DEFERRED` codes),
`vat-posture.ts` (`resolveVatDisplayPosture`), AND the FIRST calc-row inclusion golden
(`tests/unit/features/calculations/readiness-inclusion.golden.test.ts`). What does NOT exist yet is
the 5.5 DEV work: `calc-rows.json` + the pack test bodies.

**Knowledge fragments (conceptual, applied):** test-quality (drive the MECHANISM — every numeric
case feeds the real engine and asserts the pinned öre; no `assert(true)`, no vacuous field-only
case), test-levels-framework (pure calc/classification ⇒ UNIT/GOLDEN; the arithmetic is Epic-4-pinned
— 5.5 asserts ROUTING + inclusion/readiness classification, never re-derives a total),
data-factories (in-memory JSON fixture only; NO DB seed, NO clock, NO PII).

---

## Step 2 — Generation Mode

**Mode: golden-pack (no red).** Generate ONE pack test file under `tests/unit/features/calculations/**`
(the runner-glob-safe location) mirroring the 4.4 `golden-pack.test.ts` 4-guard structure. Optionally
split the live-oracle expansion into `calc-golden-pack-coverage.test.ts` if the single file grows
large (same runner, same location). NO API/E2E/component scaffolds — none apply to a pure golden pack.

---

## Step 3 — Test Strategy (the pack guards, per the 4.4 template)

| Guard | Purpose | Real oracle driven | Numeric authority (R-508 — reference, do NOT re-pin) |
| --- | --- | --- | --- |
| **Surface-present** | Hard assertion the oracle imports resolve (never a self-disabling skip gate) | all imports | — |
| **1. COVERAGE** | FAIL if any AC1 category is unpinned (NEW = live case; REFERENCE = owning fixture) | manifest | all five money fixtures + `calc-rows.json` |
| **2. LABELLING** | Every NEW case has a valid `origin` + non-empty `note`; `documented-delta` carries its old value | — | `calc-rows.json` |
| **3. BEHAVIORAL** | The NEW numeric cases DRIVE the real engine (live oracle, not static schema) | `totals.ts`/`readiness.ts`/`vat-posture.ts`/`@/lib/money` | per-category fixtures |
| **4. SCHEMA-SHAPE** | A malformed/half-authored case (missing `origin`/`note`/expected öre) fails loud | — | `calc-rows.json` |
| **+ PRIVACY** | No PII/secret in any calc fixture DATA payload; no PII into the engine | — | scans `calc-rows.json` |

---

## Red-Phase Test Scaffolds Created

> **Note:** these are **structural pack scaffolds with failing-loud `todo(...)` placeholders**, NOT
> `test.skip()` red-phase scaffolds (per the story's no-red-phase directive). Two guards are already
> GREEN; the rest are tracked TODOs for the dev green pass.

### Golden / Unit Tests — pack scaffold

**File:** `tests/unit/features/calculations/calc-golden-pack.test.ts` (~230 lines)

- ✅ **Test:** the calc oracle surface is present (hard assertion — never a self-disabling skip gate)
  - **Status:** GREEN (the oracle exists at 5.5 time)
  - **Verifies:** `computeSectionTotal`/`resolveTotalDisplay`/`classifyReadiness`/
    `resolveVatDisplayPosture`/`PILOT_LOW_MARGIN_THRESHOLD`/`estimateDeduction` all importable.
- ✅ **Test:** COVERAGE manifest — REFERENCE half
  - **Status:** GREEN (asserts each reference category's owning fixture + token exists TODAY)
  - **Verifies:** options-tillval / hidden-rows / rot / grön / regular-vat / rounding are pinned in
    their existing frozen fixtures.
- 🔧 **Test:** COVERAGE manifest — NEW half (`todo`) — dev-story authors calc-rows.json coverage.
- 🔧 **Test:** LABELLING (`todo`) — origin + note on every NEW case; documented-delta old value.
- 🔧 **Test:** BEHAVIORAL — 3a five row types; 3b fractional qty; 3c margins; 3d section modes;
  3e VAT display; 3f ROT/grön warning; 3g attachment-readiness; 3h options/hidden-rows reference
  (`todo` × 8).
- 🔧 **Test:** SCHEMA-SHAPE guard (`todo`).
- 🔧 **Test:** EXTENDED PRIVACY scan (`todo`).
- 🔧 **Test:** Sanity — nothing production-approved, `signOff` stays pending (`todo`).

---

## Fixtures Required (dev-story creates)

### `tests/fixtures/golden/money/calc-rows.json` (NEW — dev-story authors)

Anonymized calc-row golden fixture. Öre/rate/qty numbers + policy prose ONLY — **NO PII, NO clock**.

- `_doc` provenance string (scanned SEPARATELY from the data by the privacy scan).
- `policy` block with `signOff: "pending-owner-accounting-legal"` (re-approves nothing).
- `cases` array covering the AC1 categories NOT already owned by an existing money fixture:
  the FIVE row types, FRACTIONAL quantities at the calc-row level, MARGINS (TB% low/at/above 0.15),
  the SECTION DISPLAY MODES (detailed/summary/text_only).
- Each case: an `origin` (`new-expected` / `documented-delta` / `old-lovable`) + a non-empty `note`;
  a `documented-delta` records the divergent old-Lovable value.
- **Every öre value UNDER 10 digits** (`< 1,000,000,000` öre = `< 10,000,000` kr) — the orgnr-scan
  false-positive trap (deferred-work.md#epic-4 Iter-2). If a legitimate large öre is unavoidable,
  scope the orgnr scan to string-typed leaves + record a NEW deferral with an owner.
- Mirror the shape of `options-tillval.json` / `rot-gron-deductions.json`. Do NOT re-pin a number
  another fixture already owns.

**REUSE (drive, do NOT edit):** the existing per-category authorities
`options-tillval.json` / `rot-gron-deductions.json` / `vat-rates.json` / `rounding-mode.json`;
the 5.4 `readiness-inclusion.golden.test.ts` (do NOT duplicate its inclusion cases).

---

## Implementation Checklist (dev-story — one guard at a time, green in one pass)

> **Operating mode:** implementation (a Phase A story authorizes the test-authoring work).
> **Run after each guard:** `pnpm run test:unit` (or narrow to the file — see §Running Tests).

### Guard 1 — COVERAGE manifest (NEW half) — AC1

**File:** `tests/unit/features/calculations/calc-golden-pack.test.ts`

- [ ] Create `tests/fixtures/golden/money/calc-rows.json` (see §Fixtures Required).
- [ ] Replace the `todo(...)` body: assert `calc-rows.json` exists + carries a case for EACH NEW
      category (five row types, fractional-quantities, margins, three section modes, vat-display,
      attachment-readiness); assert the manifest maps ALL of `AC1_CATEGORIES` (no silent gap).
- [ ] Prefer a BEHAVIORAL proof per NEW category (a value driven through `totals.ts`/`readiness.ts`),
      NOT a mere substring token (deferred-work.md#epic-4 Iter-2 substring-token weakness).
- [ ] Remove the `todo` marker.

### Guard 2 — LABELLING — AC2

- [ ] Replace the `todo`: for every `calc-rows.json` case assert a valid three-way `origin`
      (`old-lovable`/`new-expected`/`documented-delta`) + a non-empty trimmed `note`.
- [ ] A `documented-delta` case ALSO carries the divergent old-Lovable value; the failure message
      points at the affected assumption (5.5-UNIT-02). Do NOT fabricate a `documented-delta` if no
      real Lovable oracle example is available — label conservatively `new-expected` (Lovable is a
      BEHAVIORAL ORACLE ONLY; never copy code/data — AGENTS.md).
- [ ] Remove the `todo` marker.

### Guard 3 — BEHAVIORAL live oracle — AC1 (drive the REAL engine; reference authorities)

- [ ] **3a Five row types** — build a `TotalsRowInput`/`ReadinessRowInput` per `row_type`
      (labor/material/subcontractor/machinery/other); `computeSectionTotal` reproduces the pinned
      calc-rows.json öre. (labor without `source_kind='work_role'` also exercises `MISSING_WORK_ROLE`.)
- [ ] **3b Fractional quantities** — `computeLineTotal` on a fractional `quantity` drives
      `lineNetOre`; match the pinned öre. Reference `vat-rates.json#fractionalQuantityChainCase` for
      the underlying VAT chain — do NOT invent VAT numbers.
- [ ] **3c Margins** — `classifyReadiness` raises `LOW_MARGIN` for a counted row TB% strictly BELOW
      `PILOT_LOW_MARGIN_THRESHOLD` (0.15) and NOT at/above. TB% = `(sell − cost)/sell` computed by
      `readiness.ts#rowMarginRatio` (a pure ratio of already-öre values — NO inline money math in the
      test, R-505). A 0-sell row → `ZERO_PRICE_ROW`, NOT a divide-by-zero margin.
- [ ] **3d Section modes** — detailed/summary/text_only compose the SAME `computeSectionTotal` öre
      (presentation mode does NOT change the source total — 5.2-UNIT-04).
- [ ] **3e VAT display** — `resolveVatDisplayPosture(customerType, tenantDefaultVatDisplay)` →
      `resolveTotalDisplay(total, posture)`: `private` → incl (primary gross, not togglable);
      `company_excl` → primary net, not togglable; `company_togglable` → primary gross, togglable +
      both. A posture round-trip returns the IDENTICAL stored öre. Reuse `vat-rates.json` öre for the
      breakdown — do NOT invent VAT numbers.
- [ ] **3f ROT/grön warning** — drive `estimateDeduction` on the resolved POSTURE (never a
      personnummer) via `rot-gron-deductions.json` pinned cases: `requiresSignOff === true` on the
      UNAPPROVED profiles; a ROT×grön mix is the BLOCKING `ROT_GRON_MIX_NOT_ALLOWED`, never a silent
      sum; only `private` is eligible. `persons` stays a FLAT cap — NO per-person multiplier
      asserted (R-512). Also assert `classifyReadiness` emits `TAX_SIGN_OFF_REQUIRED` framed as an
      ESTIMATE (never legally-final, R-509).
- [ ] **3g Attachment-readiness** — `classifyReadiness(...)` on a fabricated calc shape ALWAYS emits
      the `REQUIRED_FILES_DEFERRED` warning (the Story 8.1 deferral disclosure, R-513). Do NOT wire a
      real file check (Epic 8 owns that).
- [ ] **3h Options/hidden-rows (reference)** — assert the category is covered by the 5.4
      `readiness-inclusion.golden.test.ts` + `options-tillval.json`; do NOT duplicate the 5.4
      inclusion cases. Optionally add a section-composition case on the SAME pinned öre.
- [ ] Remove each `todo` marker as its body lands.

### Guard 4 — SCHEMA-SHAPE — AC1

- [ ] Replace the `todo`: assert `calc-rows.json` top-level `_doc`(string)/`policy`(object)/
      `cases`(array); each case has an `id`/valid `origin`/non-empty `note`/≥1 expected INTEGER öre
      value (`Number.isInteger`). A malformed/half-authored case fails loud. Remove the `todo`.

### Privacy scan — AC3

- [ ] Replace the `todo`: EXTEND the money-pack scan classes (personnummer `\b\d{6}-\d{4}\b`, orgnr
      `\b\d{10}\b` no-dash, non-`example.test` email, `secret|password|api_key`, PHONE, ADDRESS) over
      the `calc-rows.json` DATA payload WITHOUT the `_doc` prose (which legitimately names the PII
      rules). Assert the DATA is PII-free and NO personnummer path into `@/lib/money` or a calc row
      (POSTURE only, R-516). Keep every öre value < 10 digits (orgnr-scan trap). Remove the `todo`.

### Sanity — AC2

- [ ] Replace the `todo`: assert `calc-rows.json` `policy.signOff === "pending-owner-accounting-legal"`
      (the pack re-approves nothing). Remove the `todo`.

### Finalize (Task 4)

- [ ] Run the ACTIVE CI gate sequence IN ORDER (clean baseline FIRST):
      `pnpm install --frozen-lockfile` → `verify:lockfiles` → `verify:service-role-containment` →
      `typecheck` → `lint` → `test:unit` → `build` → `verify:bundle-containment`. (UNIT/GOLDEN-only;
      the INT/RLS/E2E DB suites are NOT required by this story's diff but must stay green.)
- [ ] Confirm NO `test.skip`/`describe.skip`/`todo(...)` remains in `calc-golden-pack.test.ts`.
- [ ] Scope-guard sweep: NO `src/**` product code, NO migration, NO command, NO UI, NO `nav-items.ts`
      change (stays seven), NO new dependency, NO `.env` edit, NO inline money math.

**Estimated Effort:** ~3–5 hours (fixture authoring + 12 guard bodies over an existing engine).

---

## STOP conditions (needs-human — do NOT invent, do NOT re-pin)

- A calc-row total DIVERGES from a frozen per-category pin (options-tillval/rot-gron/vat-rates/
  rounding-mode) — a divergence is a STOP, never a silent re-pin or local tweak (R-508).
- A DIFFERENT inclusion rule (hidden/selected/unselected) would be treated as production-approved
  (the frozen 2026-06-18 pin: hidden + selected COUNT; unselected does NOT) — STOP (R-508).
- A real Lovable CUSTOMER-DATA example is required to produce an expected value — STOP (Lovable is a
  behavioral oracle only; capture shapes, never copy data/code — AGENTS.md).
- A document-level rounding / discount / negative-amount row model is needed — STOP (R-511).
- Any new dependency (approval-gated + exact-pinned; none expected), any `.env` edit, any migration.
- The `persons` per-person cap must scale (a multiplier is owner-gated, Sign-Off Q3) — STOP (R-512).

---

## Running Tests

```bash
# The whole fast gate (every PR)
pnpm run test:unit

# Just the calc golden pack (during dev)
node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/features/calculations/calc-golden-pack.test.ts"

# The full active CI gate sequence (finalize)
pnpm install --frozen-lockfile && pnpm run verify:lockfiles   # (run each step separately on Windows — never chain pnpm in a package.json field)
```

---

## Notes

- **Runner-glob trap (5.5-DOCS-03):** the pack test lives under `tests/unit/features/calculations/**`
  (globbed by `node --test`), NEVER `tests/golden/**` (silently never run → vacuous green). The
  FIXTURE stays under `tests/fixtures/golden/money/**` (data, not run by the globber).
- **Single numeric authority per category (R-508):** the pack REFERENCES the existing money fixtures
  and PROVES the calc-row surface reproduces their pinned öre — exactly ONE place each number lives;
  a later owner sign-off swaps numbers in ONE fixture with no code-shape change.
- **Standing NFR concerns are an EPIC-GATE decision (R-510):** do NOT add a `pnpm audit` CI gate or a
  coverage reporter in this story — schedule-or-accept at the Epic 5 trace/gate.
- **Do NOT reopen non-overlapping deferrals** (5.1/5.2/5.3/5.4 product-code/DB niceties) — 5.5 is
  fixtures + golden tests only and touches none of them.

---

**Generated by BMad TEA Agent (bmad-testarch-atdd)** — 2026-07-03
