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
  - _bmad-output/implementation-artifacts/4-3-rot-and-gron-teknik-estimate-engine-with-warnings.md
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - _bmad-output/auto-bmad/retro-notes/epic-4.md
  - src/lib/money/ore.ts
  - src/lib/money/vat.ts
  - src/lib/money/index.ts
  - src/lib/snapshots/build.ts
  - src/lib/snapshots/types.ts
  - src/server/commands/crm/validation.ts
  - tests/unit/lib/money/vat.test.ts
  - tests/unit/lib/money/vat.golden.test.ts
  - tests/fixtures/golden/money/vat-rates.json
  - tests/support/alias-hook.mjs
---

# ATDD Checklist - Epic 4, Story 4.3: ROT And Grön Teknik Estimate Engine With Warnings

**Date:** 2026-07-02
**Author:** Rasmus
**Primary Test Level:** UNIT (pure `node --test`) + GOLDEN (data-driven UNIT over `tests/fixtures/golden/**`)

---

## Story Summary

The pure `@/lib/money` engine gains its FIRST ROT / grön-teknik DEDUCTION math: a
`estimateDeduction` engine that returns `{ deductionOre, eligibleBasisOre, warnings,
assumptionSnapshot, requiresSignOff }` computed on integer öre from NAMED **UNAPPROVED** rate/cap
profiles, blocks a ROT×grön mix, never marks a tax output approved, takes a resolved eligibility
POSTURE (never PII), and a frozen `buildTaxAssumptionSnapshot`. All additive, pure, no DB / UI /
dependency.

**As a** tenant admin
**I want** ROT and grön teknik estimates to show assumptions and warnings
**So that** tax-sensitive quotes are not sent as if unapproved rules were final

---

## Generation Mode & Stack

- **Detected stack:** `backend` — pure TypeScript library (`src/lib/money`), no browser/HTTP surface.
- **Mode:** AI generation (no recording). **ADAPTED from the generic ATDD workers.** The epic-4
  retro flagged that the generic ATDD subagents (Worker A = API HTTP, Worker B = E2E browser) do
  NOT fit a pure-library story — there is no endpoint and no page. Per Stories 4.1/4.2's validated
  precedent, generation was routed to **inline `node --test` UNIT + GOLDEN scaffolds** mirroring
  `tests/unit/lib/money/vat.test.ts` + `vat.golden.test.ts`, NOT an HTTP/browser scaffold. This
  step-04 override is explicit in the story's own note ("adapt generation to inline pure `node
  --test` UNIT + GOLDEN suites … as stories 4-1 and 4-2 did").
- **Red-gate mechanism:** the not-yet-implemented tax surface is absent, so each suite is gated
  behind `describe.skip` on `TAX_SURFACE_PRESENT` (`typeof money.estimateDeduction === "function"`).
  The `@/lib/money` barrel already resolves (Story 4.1's alias-hook fix resolves the bare-directory
  import under `node --test`), so a top-level import is safe; the new tax exports are `undefined`
  until the dev adds them, which keeps the green baseline UNPERTURBED. **Verified:** both suites
  SKIP (`# SKIP`, 0 fail); full unit baseline = **545 pass / 0 fail** (unchanged). GREEN phase: the
  exports land, the gate flips true automatically, the UNCHANGED assertions run — no test edit.

---

## Acceptance Criteria

1. **AC1 — structured estimate result + integer öre + no ROT×grön mix.** `estimateDeduction`
   returns `{ deductionOre (öre), eligibleBasisOre (öre), warnings[], assumptionSnapshot,
   requiresSignOff:true }` computed via the SINGLE Story 4.1 `roundToOre` + `sumOre` + `isOreAmount`
   (no float kronor, no second rounding mode). A request combining ROT AND grön teknik returns a
   BLOCKING typed failure (`ROT_GRON_MIX_NOT_ALLOWED`), NEVER a silently-combined sum.
2. **AC2 — requires-sign-off is the structural default; no approved path.** The result AND its
   assumption snapshot structurally indicate the assumptions require sign-off (`requiresSignOff:true`
   or a warning), the DEFAULT that cannot be absent; the engine has NO code path that derives/renders
   /persists a tax output as approved. The rates/caps live as NAMED conservative UNAPPROVED profiles.
3. **AC3 — eligibility posture (private-only), never PII.** ONLY a `private` posture is eligible; a
   non-private posture (`company`/`brf`/`public`) yields an eligibility warning (or a blocking
   result). `personnummer` is NOT captured/required by the pure engine — it takes a resolved POSTURE,
   never a personnummer or any PII. NO PII (personnummer/orgnr/name/email/address) enters
   `src/lib/money`. The customer-facing disclaimer wording is NOT shipped as legally-approved.
4. **AC4 — pure additive `src/lib/money`.** No schema/migration, no dependency, no `.env`, no
   UI/route, no calculation rows (Epic 5), no quote-version persistence (Epic 6). Reuses (never forks)
   the Story 4.1 primitives + the Story 4.2 VAT engine/`isVatRateBp` + the Story 3.5 snapshot-freeze
   discipline. All existing unit suites stay green.

---

## Failing Tests Created (RED Phase)

> Levels are **UNIT** and **GOLDEN** (there are no API or E2E tests — the surface is pure logic).

### UNIT Tests — `tests/unit/lib/money/tax.test.ts`

Gated by `describe.skip` until `@/lib/money` exposes `estimateDeduction`.

- ✅ **4.3-UNIT-01 — estimate shape + values; assumptions captured, nothing approved** (R-405/R-407)
  - **Status:** RED — `estimateDeduction` not implemented yet (suite skipped).
  - **Verifies:** the five-field result shape; `deductionOre = roundToOre(basis*bp/10000)` below cap;
    zero basis → deduction 0; grön teknik on its own profile; typed-failure rejection of a non-öre
    basis (no raw echo).
- ✅ **4.3-UNIT-02 — ROT×grön mix BLOCKED, not silently summed** (R-406, epic blocker)
  - **Status:** RED — mix-block path not implemented yet.
  - **Verifies:** a combined ROT+grön request returns the typed `ROT_GRON_MIX_NOT_ALLOWED` failure;
    the failure carries NO combined `deductionOre` (no silent-sum code path).
- ✅ **4.3-UNIT-03 — no-approval / requires-sign-off invariant (behavioral)** (R-405, epic blocker)
  - **Status:** RED — `requiresSignOff` default not implemented yet.
  - **Verifies:** every ok estimate carries `requiresSignOff:true` (or a "requires sign-off" warning)
    by default; NO `isApproved:true`/`approved:true` anywhere in the result; the assumption snapshot
    also carries the unapproved marker.
- ✅ **4.3-UNIT-04 — hidden-row / tillval basis-inclusion assumption** (R-408)
  - **Status:** RED — multi-line basis inclusion not implemented yet.
  - **Verifies:** a hidden row STILL counts toward the eligible basis (`[60 000, 40 000]` → basis
    100 000); including it raises the deduction — the row is not silently dropped (Epic 4 pins the
    BASIS rule; UI visibility is Epic 5).
- ✅ **4.3-UNIT-05 — resolved POSTURE, never PII; eligibility warnings** (R-412)
  - **Status:** RED — eligibility path not implemented yet.
  - **Verifies:** `private` eligible (no not-eligible warning); `company`/`brf`/`public` blocked or
    warned, never silently eligible; a personnummer input is never consumed/echoed as eligibility;
    the `tax.ts` source references NO `personnummer`/`orgnr` field (source guard).
- ✅ **4.3-UNIT-06 (shared 4.2-UNIT-05) — frozen tax-assumption snapshot, no recompute** (R-409)
  - **Status:** RED — `buildTaxAssumptionSnapshot` not implemented yet.
  - **Verifies:** copies the profile BY VALUE + `Object.isFrozen`; injected `capturedAt` (no clock);
    mutating the SOURCE rate after capture does NOT change a prior snapshot; captures STATE only (no
    derived `isApproved`).
- ✅ **4.3-UNIT-07 — clear typed error for an unknown deduction type / profile (DX)**
  - **Status:** RED — unknown-type path not implemented yet.
  - **Verifies:** an unknown `deductionType` returns the clear typed `UNKNOWN_DEDUCTION_TYPE` failure,
    not a silent wrong-profile fall-through; no raw echo.

### GOLDEN Tests — `tests/unit/lib/money/tax.golden.test.ts`

Fixture: `tests/fixtures/golden/money/rot-gron-deductions.json`. Gated the same way.

- ✅ **4.3-GOLDEN-01 — deduction math + caps + rounding pinned** (R-405/R-406/R-407/R-408/R-410/R-411)
  - **Status:** RED — tax surface not implemented yet.
  - **Verifies:** every pinned deduction case matches `min(roundToOre(basis*bp/10000), cap)`; cap
    boundaries (at/above/below, above = clamped + clamp warning); the `.5`-boundary case does not
    produce the banker's value; every ok estimate is UNAPPROVED by default; **load-bearing** ROT×grön
    mix blocked; **no hidden `0.30`/`0.50`/`1.3` literal** in `src/lib/money/tax.ts` (source grep,
    comments stripped) + `/ 10000` present; fixture is anonymized (no PII).
- ✅ **4.3-GOLDEN-02 — BRF/private/company eligibility warnings** (R-412)
  - **Status:** RED — eligibility path not implemented yet.
  - **Verifies:** private eligible (no not-eligible warning); company/brf/public flagged with an
    eligibility warning OR blocked, matching the conservative Phase-A policy.

---

## Data Factories Created

None. Pure-logic story — inputs are plain öre / basis-point / cap numbers, a resolved posture
string, and an injected `capturedAt`. No DB, no `@faker-js/faker`, no factory harness (test-design:
"NO factories/DB needed"). NO personnummer / PII is ever passed as an eligibility input.

---

## Fixtures Created

### ROT / grön-teknik deduction golden fixture

**File:** `tests/fixtures/golden/money/rot-gron-deductions.json`

- Two NAMED **UNAPPROVED** profiles (`ROT_PROFILE_UNAPPROVED` 3000 bp / 5 000 000 öre cap;
  `GRON_TEKNIK_PROFILE_UNAPPROVED` 2000 bp / 5 000 000 öre cap), each `approved:false` +
  `signOffStatus:"pending-owner-accounting-legal"`.
- **Deduction cases** across the cap boundaries (below / at / above=clamped), a zero-basis case, a
  `.5`-boundary case (`bankersWouldGive`), a grön-teknik per-category pair, and a hidden-row
  inclusion case (`eligibleBasisLines`).
- **Eligibility cases** — private (eligible) + company / brf / public (warned or blocked).
- **Invalid-mix case** — asserts the blocking `ROT_GRON_MIX_NOT_ALLOWED` error, never a combined sum.
- Each case carries an `origin` label (`new-expected` / `documented-delta`).
- **Anonymized** — money/rate/cap numbers only; no personnummer/orgnr/name/email/secret; no clock.
- The rate/cap flow from the fixture as basis-point + öre INPUTs, so the engine holds no percent
  constant. The rate/cap numbers are **conservative UNAPPROVED PLACEHOLDERS** — if the dev pins
  different conservative numbers, update this fixture's expected values (the fixture is the numeric
  source of truth; a later sign-off swaps the numbers with NO code-shape change).

---

## Mock Requirements

None. No external service, no network, no DB, no clock — the primitives are deterministic functions
of their öre + basis-point + cap + posture inputs and the injected `capturedAt`.

---

## Required data-testid Attributes

None. This story adds no UI/route (AC4). The deduction engine is a pure data transform; its UI
rendering is Epic 5/6.

---

## Implementation Checklist

Maps each RED suite to the dev's green-phase tasks (see the story's Tasks 1–5).

### Test: 4.3-UNIT-01 + 4.3-GOLDEN-01 (deduction math + caps)

**File:** `tests/unit/lib/money/tax.test.ts`, `tests/unit/lib/money/tax.golden.test.ts`

- [ ] Add `src/lib/money/tax.ts` (PURE header mirroring `ore.ts`/`vat.ts`; tax policy = conservative
      UNAPPROVED pilot assumption). Re-export from `src/lib/money/index.ts` (do NOT create a second money root).
- [ ] Model the NAMED profiles `ROT_PROFILE_UNAPPROVED` / `GRON_TEKNIK_PROFILE_UNAPPROVED` as `as const`
      frozen records: `deductionPercentBp` (basis points), `capOre` (integer öre), `profileId`/label,
      `approved:false` (or `signOffStatus:"pending-owner-accounting-legal"`).
- [ ] `estimateDeduction(input)` — `deductionOre = min( roundToOre(eligibleBasisOre * deductionPercentBp
      / 10000), capOre )`; validate every öre with `isOreAmount` (overflow → `ORE_OVERFLOW`); multi-line
      basis via `sumOre`. NO `0.30`/`30`/`0.50`/`50`/`1.3` literal — the rate is `deductionPercentBp`.
- [ ] Cap boundary: at → cap; above → clamped to cap (+ a clamp warning); below → rate applied; zero basis → 0.
- [ ] Add the new tax `MoneyErrorCode` members additively in `src/lib/money/ore.ts`
      (`ROT_GRON_MIX_NOT_ALLOWED`, `UNKNOWN_DEDUCTION_TYPE`, an eligibility/NOT_ELIGIBLE code as needed).
- [ ] Run: `pnpm run test:unit` → ✅ green.

### Test: 4.3-UNIT-02 (ROT×grön mix block)

**File:** `tests/unit/lib/money/tax.test.ts`, `tests/unit/lib/money/tax.golden.test.ts`

- [ ] If an input attempts to combine ROT AND grön teknik, return the BLOCKING
      `ROT_GRON_MIX_NOT_ALLOWED` typed failure. NO combined-sum code path exists.

### Test: 4.3-UNIT-03 (no-approval / requires-sign-off)

**File:** `tests/unit/lib/money/tax.test.ts`, `tests/unit/lib/money/tax.golden.test.ts`

- [ ] The result and its assumption snapshot ALWAYS carry `requiresSignOff:true` (or a "requires
      sign-off" warning) by default. NO parameter/branch/field renders/persists the output as approved.
      Mirror the Epic 3 `quote_terms.approved_at` structural discipline — absence of approval is default.

### Test: 4.3-UNIT-04 (hidden-row / tillval basis)

**File:** `tests/unit/lib/money/tax.test.ts`, `tests/unit/lib/money/tax.golden.test.ts`

- [ ] Hidden rows DO count toward the eligible basis (owner decision 2026-06-18). Epic 4 pins ONLY the
      pure BASIS rule; the UI visibility semantics are Epic 5 (do NOT build the calc-row/tillval UI).

### Test: 4.3-UNIT-05 + 4.3-GOLDEN-02 (posture, no PII, eligibility)

**File:** `tests/unit/lib/money/tax.test.ts`, `tests/unit/lib/money/tax.golden.test.ts`

- [ ] `estimateDeduction` takes a resolved eligibility POSTURE (define the engine's OWN closed posture
      union in `@/lib/money`; do NOT import `src/server` CRM types — keep `src/lib` → `src/server`
      un-inverted, mirroring `vat.ts`'s own `VatDisplayMode` copy). ONLY `private` eligible; non-private
      → eligibility warning (or block). NO personnummer/orgnr/name/email/address ever read by the engine.

### Test: 4.3-UNIT-06 (frozen tax-assumption snapshot)

**File:** `tests/unit/lib/money/tax.test.ts`

- [ ] `buildTaxAssumptionSnapshot(source, { capturedAt })` — model directly on `buildVatAssumptionSnapshot`:
      copy the profile (type, `deductionPercentBp`, `capOre`, `profileId`, persons/count, schablon if used),
      the basis inputs, the warnings, and the unapproved marker BY VALUE; `Object.freeze`; INJECTED
      `capturedAt` (no `Date.now()`). Capture STATE only (no re-derived `isApproved`); do NOT persist to a table.

### Test: 4.3-UNIT-07 (unknown deduction type)

**File:** `tests/unit/lib/money/tax.test.ts`

- [ ] A `switch(deductionType)` + `assertNever` (mirror `buildSnapshotSource`) makes an unhandled type a
      COMPILE error; a runtime unknown type returns the clear typed `UNKNOWN_DEDUCTION_TYPE` failure.

**Estimated Effort:** ~5–8 h (matches test-design P0+P1+P3 for the 4.3 rows).

---

## Running Tests

```bash
# Run the whole pure-logic unit suite (part of `pnpm test`)
pnpm run test:unit

# Run only the Story 4.3 tax scaffolds
node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/lib/money/tax.test.ts" "tests/unit/lib/money/tax.golden.test.ts"
```

RED confirmation: both suites report `# SKIP` (surface absent); the full unit baseline stays green
(545 pass / 0 fail).

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ UNIT + GOLDEN scaffolds written; each gated behind `describe.skip` on the absent tax surface.
- ✅ Golden fixture authored (cap boundaries, `.5`-boundary, grön per-category, hidden-row inclusion,
  invalid mix, private/company/brf/public eligibility; `origin`-labelled; anonymized; UNAPPROVED profiles).
- ✅ Implementation checklist mapped to the story's Tasks 1–5.
- ✅ Verified: both suites SKIP cleanly (0 fail); full unit baseline = 545 pass / 0 fail (UNPERTURBED);
  `pnpm typecheck` green; `pnpm lint` clean (only the pre-existing `vat.test.ts` warning remains).

### GREEN Phase (DEV — Next Steps)

1. Add `src/lib/money/tax.ts` + re-export from `src/lib/money/index.ts`; add the new `MoneyErrorCode`
   members additively in `src/lib/money/ore.ts`.
2. The `TAX_SURFACE_PRESENT` gate flips true automatically once the exports resolve — the suites run.
3. Implement the engine until every assertion passes. **Do NOT edit the assertions — they ARE the contract.**
   (The rate/cap NUMBERS live in the fixture — if the pilot placeholder differs, update the fixture, not the units.)
4. Run the full CI gate sequence in order (story Task 5.3).

### REFACTOR Phase

Consolidate; keep exactly ONE `isOreAmount`/ONE bp-validity rule/ONE öre→kronor formatter after the
story; reuse the Story 4.2 `buildVatAssumptionSnapshot` freeze pattern (do not fork a new snapshot
mechanism); re-run `pnpm run test:unit`.

---

## Notes

- **Sign-Off (human, not a plan gap):** the ROT/grön rates/caps/schablon (Q3/Q4), the eligibility
  rule + BRF handling + customer-facing disclaimer wording (Q5), the personnummer reconcile (Q6 — the
  CRM stores it access-controlled for `private`; the ENGINE never reads it, resolving R-412 without
  reopening the CRM decision), and the approval posture (Q7) are CONSERVATIVE PILOT ASSUMPTIONS pending
  owner/accounting/legal sign-off (owner-decisions 2026-06-18: "rates/caps/schablon still pending the
  working session"). Build against the UNAPPROVED profiles + warnings + golden pins; do NOT ship the
  constants/eligibility/disclaimer as approved. STOP (needs-human) ONLY if they must be treated as
  production-approved (the story stop condition).
- **Epic blockers (non-negotiable, regardless of numeric score):** (R-405) no ROT/grön output
  approvable without an explicit human sign-off flag — `requiresSignOff:true` is the structural
  default; (R-406) the ROT×grön mix is BLOCKED, never silently summed; (R-404 generalized) no hidden
  `0.30`/`0.50`/`1.3` deduction literal — the golden test greps the tax source and asserts `/ 10000`;
  (R-412) no personnummer/PII into `src/lib/money`; (R-409) the tax-assumption snapshot is frozen.
- **Standing NFR concerns (surface at the epic gate, not this story's to fix):** no `pnpm audit`
  dependency-scan CI gate; no coverage reporter.
- **Reuse, don't fork:** the Story 4.1 `roundToOre`/`sumOre`/`isOreAmount`/`formatOreAsKronor`; the
  Story 4.2 VAT engine + the single `isVatRateBp` bp-validity authority (for a deduction rate in bp,
  reuse it or build FROM its exported bounds); the Story 3.5 / 4.2 snapshot-freeze discipline; the
  `MoneyErrorCode` union (widen additively). Define the engine's OWN closed posture/deduction-type
  unions in `@/lib/money` — do NOT import `src/server` CRM/settings types.

---

**Generated by BMad TEA Agent** — 2026-07-02
