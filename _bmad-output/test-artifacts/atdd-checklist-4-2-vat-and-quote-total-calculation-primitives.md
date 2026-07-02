---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-02'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/4-2-vat-and-quote-total-calculation-primitives.md
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - _bmad-output/auto-bmad/retro-notes/epic-4.md
  - src/lib/money/ore.ts
  - src/lib/money/index.ts
  - src/lib/snapshots/build.ts
  - src/lib/snapshots/types.ts
  - src/server/commands/settings/validation.ts
  - tests/unit/lib/money/ore.test.ts
  - tests/unit/lib/money/rounding.golden.test.ts
  - tests/unit/lib/snapshots/golden.test.ts
  - tests/fixtures/golden/money/rounding-mode.json
  - tests/support/alias-hook.mjs
---

# ATDD Checklist - Epic 4, Story 4.2: VAT And Quote Total Calculation Primitives

**Date:** 2026-07-02
**Author:** Rasmus
**Primary Test Level:** UNIT (pure `node --test`) + GOLDEN (data-driven UNIT over `tests/fixtures/golden/**`)

---

## Story Summary

The pure `@/lib/money` engine gains its FIRST VAT computation: per-line VAT from a basis-point
rate, sum-of-rounded section/quote totals, excl/incl/both display views, and a frozen
VAT-assumption snapshot. All additive, pure, no DB / UI / dependency.

**As a** tenant admin
**I want** VAT and quote totals calculated from explicit assumptions
**So that** draft calculations and quote snapshots show explainable customer-facing totals

---

## Generation Mode & Stack

- **Detected stack:** `backend` — pure TypeScript library (`src/lib/money`), no browser/HTTP surface.
- **Mode:** AI generation (no recording). **ADAPTED from the generic ATDD workers.** The epic-4
  retro flagged that the generic ATDD subagents (Worker A = API HTTP, Worker B = E2E browser) do
  NOT fit a pure-library story — there is no endpoint and no page. Per Story 4.1's validated
  precedent, generation was routed to **inline `node --test` UNIT + GOLDEN scaffolds** mirroring
  `tests/unit/lib/money/ore.test.ts` + `rounding.golden.test.ts`, NOT an HTTP/browser scaffold.
- **Red-gate mechanism:** the not-yet-implemented VAT surface is absent, so each suite is gated
  behind `describe.skip` on `VAT_SURFACE_PRESENT` (`typeof money.lineVatOre === "function" && …`).
  The `@/lib/money` barrel already resolves (Story 4.1), so a top-level import is safe; the new
  VAT exports are `undefined` until the dev adds them, which keeps the green baseline UNPERTURBED
  (verified: both suites SKIP, 0 fail; full unit baseline = 490 pass / 0 fail). GREEN phase: the
  exports land, the gate flips true automatically, the UNCHANGED assertions run — no test edit.

---

## Acceptance Criteria

1. **AC1 — per-line VAT from basis points + sum-of-rounded totals.** VAT = `roundToOre(lineNetOre *
   vatRateBp / 10000)` rounded PER LINE under the SINGLE Story 4.1 half-away-from-zero mode; section
   /quote totals SUM the already-rounded per-line VAT (`sumOre`, sum-of-rounded, never round-of-sum).
   NO hidden `0.25`/`25`/`1.25` literal — the rate always flows in as basis points.
2. **AC2 — excl / incl / both display views, source totals immutable.** `{ netOre, vatOre, grossOre }`
   with `grossOre = netOre + vatOre`; display mode is a presentation-only transform that re-derives,
   never mutates, the source öre; a round-trip returns identical stored öre. The private-customer →
   always-incl-VAT rule is a documented conservative INVARIANT (Sign-Off Q2), not legally-approved fact.
3. **AC3 — frozen VAT-assumption snapshot.** The exact `vatRateBp` + display mode + capture instant
   are copied BY VALUE and `Object.freeze`d before customer-visible, via the Story 3.5 injected-
   `capturedAt` discipline (no `Date.now()`); mutating the source row after capture does NOT change a
   prior snapshot. Captures STATE only — no computed VAT amount, no derived `isApproved`. Not persisted.
4. **AC4 — pure additive `src/lib/money`.** No schema/migration, no dependency, no `.env`, no UI/route,
   no ROT/grön math (4.3), no calc rows (Epic 5), no quote-version persistence (Epic 6). Reuses the
   Story 4.1 primitives + the ONE `isVatRateBp` bp-validity rule + the ONE öre→kronor formatter. All
   existing unit suites stay green.

---

## Failing Tests Created (RED Phase)

> Levels are **UNIT** and **GOLDEN** (there are no API or E2E tests — the surface is pure logic).

### UNIT Tests — `tests/unit/lib/money/vat.test.ts` (~260 lines)

Gated by `describe.skip` until `@/lib/money` exposes `lineVatOre` + `vatBreakdown`.

- ✅ **4.2-UNIT-01 — per-line VAT rounding + sum-of-rounded totals** (R-403/R-404)
  - **Status:** RED — `lineVatOre` / `sumVatOre` not implemented yet (suite skipped).
  - **Verifies:** VAT at 25/12/6% from bp input; per-line half-away-from-zero (`x.5 → x+1`);
    section total = sum of rounded line VAT; **load-bearing** sum-of-rounded (3) ≠ round-of-sum (2);
    typed-failure rejection of out-of-range/float/string `vatRateBp` and non-öre net (no raw echo).
- ✅ **4.2-UNIT-02 / 4.2-UNIT-06 — vatBreakdown derives gross; zero-VAT & zero-net rows**
  - **Status:** RED — `vatBreakdown` not implemented yet.
  - **Verifies:** `grossOre = netOre + vatOre`; `vatRateBp = 0` yields VAT 0 cleanly; zero-net → all-zero.
- ✅ **4.2-UNIT-04 — display-mode views are presentation-only + round-trip** (R-403)
  - **Status:** RED — display-mode selector not implemented yet.
  - **Verifies:** selecting excl/togglable/private does NOT mutate the source breakdown; `company_excl`
    surfaces net, the private invariant surfaces gross; a round-trip returns identical stored öre.
- ✅ **4.2-UNIT-03 / 4.2-UNIT-05 — frozen VAT-assumption snapshot, no recompute** (R-409)
  - **Status:** RED — `buildVatAssumptionSnapshot` not implemented yet.
  - **Verifies:** copies `vatRateBp` + display mode BY VALUE; `Object.isFrozen`; injected `capturedAt`
    (no clock); mutating the SOURCE rate after capture does NOT change a prior snapshot; captures STATE
    only (no computed VAT amount, no `isApproved`).

### GOLDEN Tests — `tests/unit/lib/money/vat.golden.test.ts` (~200 lines)

Fixture: `tests/fixtures/golden/money/vat-rates.json`. Gated the same way.

- ✅ **4.2-GOLDEN-01 — VAT rate consumed as basis points; per-line round; sum-of-rounded** (R-404/R-403/R-410/R-411)
  - **Status:** RED — VAT surface not implemented yet.
  - **Verifies:** every pinned per-line VAT case (0/600/1200/2500 bp) matches `roundToOre(net*bp/10000)`;
    gross = net + VAT; the `.5`-boundary case does not produce the banker's value; the fractional-qty →
    line-net → VAT chain matches at each stage; section VAT = sum of rounded lines; **load-bearing**
    sum-of-rounded ≠ round-of-summed-VAT; **no hidden `0.25`/`1.25` literal** in `src/lib/money/vat.ts`
    (source grep, comments stripped) + `/ 10000` present; fixture is anonymized (no PII).

---

## Data Factories Created

None. Pure-logic story — inputs are plain öre / basis-point numbers and a minimal in-test VAT source
object. No DB, no `@faker-js/faker`, no factory harness (test-design: "NO factories/DB needed").

---

## Fixtures Created

### VAT golden fixture

**File:** `tests/fixtures/golden/money/vat-rates.json`

- Pins per-line VAT across **0 / 600 / 1200 / 2500 bp** (0% / 6% / 12% / 25%), plus a zero-net row,
  a `.5`-boundary case (`bankersWouldGive`), a fractional-quantity → line-net → VAT chain, a mixed-rate
  section total, and the **sum-of-rounded ≠ round-of-summed-VAT** divergence case.
- Each case carries an `origin` label (`new-expected` / `documented-delta`); the sum-of-rounded
  divergence is `documented-delta` (intentional divergence from Lovable's implicit round behaviour).
- **Anonymized** — money/rate numbers only; no personnummer/orgnr/name/email/secret; no clock.
- The rate flows from the fixture as a basis-point INPUT, so the engine holds no percent constant.

---

## Mock Requirements

None. No external service, no network, no DB — the primitives are deterministic functions of their
öre + basis-point inputs.

---

## Required data-testid Attributes

None. This story adds no UI/route (AC4). Display-mode VIEWS are pure data transforms; their UI
rendering is Epic 5/6.

---

## Implementation Checklist

Maps each RED suite to the dev's green-phase tasks (see the story's Tasks 1–4).

### Test: 4.2-UNIT-01 + 4.2-GOLDEN-01 (per-line VAT + sum-of-rounded)

**File:** `tests/unit/lib/money/vat.test.ts`, `tests/unit/lib/money/vat.golden.test.ts`

- [ ] Add `src/lib/money/vat.ts` (PURE header mirroring `ore.ts`; VAT policy = conservative pilot assumption).
- [ ] `lineVatOre(lineNetOre, vatRateBp)` = `roundToOre(lineNetOre * vatRateBp / 10000)`; validate
      `isOreAmount(lineNetOre)` + reuse the ONE `isVatRateBp` bp-validity rule; re-check rounded VAT
      with `isOreAmount` (overflow → `ORE_OVERFLOW`); `vatRateBp = 0` → 0. NO `0.25`/`25`/`1.25` literal.
- [ ] `sumVatOre` (or reuse `sumOre`) so section/quote VAT = sum-of-rounded per-line VAT.
- [ ] Re-export the VAT surface from `src/lib/money/index.ts` (do NOT create a second money root).
- [ ] Run: `pnpm run test:unit` → ✅ green.

### Test: 4.2-UNIT-02 / 4.2-UNIT-06 (vatBreakdown + zero rows)

**File:** `tests/unit/lib/money/vat.test.ts`

- [ ] `vatBreakdown(netOre, vatRateBp)` → `{ netOre, vatOre, grossOre }`, `grossOre = netOre + vatOre`
      (guarded against `ORE_AMOUNT_MAX`); gross is DERIVED, never an independent stored total.
- [ ] Reuse `formatOreAsKronor` for any kronor string the views expose (no second formatter).

### Test: 4.2-UNIT-04 (display-mode views)

**File:** `tests/unit/lib/money/vat.test.ts`

- [ ] Pure display-mode selector over `{ netOre, vatOre, grossOre }` + `VatDisplayMode`/private posture:
      `company_excl` → net; `company_togglable` → both; PRIVATE → always gross (documented Sign-Off Q2
      assumption, not legally-final). Presentation-only: re-derive, never mutate; round-trip returns
      identical öre.

### Test: 4.2-UNIT-03 / 4.2-UNIT-05 (frozen VAT-assumption snapshot)

**File:** `tests/unit/lib/money/vat.test.ts`

- [ ] `buildVatAssumptionSnapshot(source, { capturedAt })` — copy `vatRateBp` + `defaultVatDisplay`
      (+ source id/`sourceUpdatedAt` if a row is passed) BY VALUE; `Object.freeze`; INJECTED `capturedAt`
      (no `Date.now()`). Reuse the Story 3.5 `src/lib/snapshots` freeze discipline; build from the VAT
      half of `CompanySettingsSnapshot` (identity-PARTIAL — do NOT extend with PDF-identity fields).
      Capture STATE only (no VAT amount into itself, no derived `isApproved`). Do NOT persist to a table.

**Estimated Effort:** ~4–7 h (matches test-design P0+P1 for the 4.2 rows).

---

## Running Tests

```bash
# Run the whole pure-logic unit suite (part of `pnpm test`)
pnpm run test:unit

# Run only the Story 4.2 VAT scaffolds
node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/lib/money/vat.test.ts" "tests/unit/lib/money/vat.golden.test.ts"
```

RED confirmation: both suites report `# SKIP` (surface absent); the full unit baseline stays green.

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ UNIT + GOLDEN scaffolds written; each gated behind `describe.skip` on the absent VAT surface.
- ✅ Golden fixture authored (0/6/12/25% + zero rows + fractional-qty chain + sum-of-rounded divergence,
  `origin`-labelled, anonymized).
- ✅ Implementation checklist mapped to the story's Tasks 1–4.
- ✅ Verified: both suites SKIP cleanly (0 fail); full unit baseline = 490 pass / 0 fail (UNPERTURBED).

### GREEN Phase (DEV — Next Steps)

1. Add `src/lib/money/vat.ts` + re-export from `src/lib/money/index.ts`.
2. The `VAT_SURFACE_PRESENT` gate flips true automatically once the exports resolve — the suites run.
3. Implement the primitives until every assertion passes. **Do NOT edit the assertions — they ARE the contract.**
4. Run the full CI gate sequence in order (story Task 4.3).

### REFACTOR Phase

Consolidate, keep exactly ONE `isVatRateBp` bp-validity rule + ONE öre→kronor formatter after the story;
re-run `pnpm run test:unit`.

---

## Notes

- **Sign-Off (human, not a plan gap):** the per-line VAT rounding policy (Q1) and the VAT display
  policy incl. private-always-incl (Q2) are CONSERVATIVE PILOT ASSUMPTIONS pending owner/accounting/
  legal sign-off. Build against them + golden pins; do NOT ship the VAT policy or customer-facing VAT
  wording as approved. STOP (needs-human) if accounting requires DOCUMENT-LEVEL VAT rounding.
- **Epic blocker (R-404):** no hidden `0.25`/`25`/`1.25` VAT literal — the golden test greps the VAT
  source (comments stripped) and asserts `/ 10000` basis-point division.
- **Standing NFR concerns (surface at the epic gate, not this story's to fix):** no `pnpm audit`
  dependency-scan CI gate; no coverage reporter.
- **Reuse, don't fork:** the Story 4.1 `roundToOre`/`sumOre`/`isOreAmount`/`formatOreAsKronor` and the
  single `isVatRateBp` bp-validity authority; the Story 3.5 snapshot freeze discipline.

---

**Generated by BMad TEA Agent** — 2026-07-02
