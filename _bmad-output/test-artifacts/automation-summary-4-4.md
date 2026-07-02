---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate']
lastStep: 'step-03c-aggregate'
lastSaved: '2026-07-02'
inputDocuments:
  - _bmad-output/implementation-artifacts/4-4-money-and-tax-golden-master-fixture-pack.md
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - tests/unit/lib/money/golden-pack.test.ts
  - tests/fixtures/golden/money/options-tillval.json
  - tests/fixtures/golden/money/accepted-price-deltas.json
  - src/lib/money/index.ts
  - src/lib/money/tax.ts
  - src/lib/money/ore.ts
---

# Test Automation Expansion — Story 4.4 (Money & Tax Golden-Master Fixture Pack)

## Step 1 — Preflight & Context

- **Stack:** backend / pure-library (`node --test` unit runner; no browser/DB/Vitest). Framework
  present: `package.json` `test:unit` = `node --experimental-strip-types --import
  ./tests/support/register.mjs --test "tests/unit/**/*.test.ts"`. No Playwright/Cypress needed —
  this is a pure integer-öre library + golden-fixture surface.
- **Mode:** BMad-Integrated (story + test-design-epic-4.md present).
- **Target of expansion:** the two NEW fixtures this story added
  (`options-tillval.json`, `accepted-price-deltas.json`) and the behaviors they pin, consumed
  through the frozen `@/lib/money` primitives (`sumOre`, `lineVatOre`, `lineNetOre`,
  `estimateDeduction`, `vatBreakdown`).

## Step 2 — Automation Targets & Coverage Plan

Existing `golden-pack.test.ts` already delivers the four pack guards (coverage manifest, labelling,
behavioral golden, schema-shape) + the pack-wide privacy scan. Expansion focused on **live-oracle
gaps** — fixture FIELDS previously asserted only as static schema, turned into engine-driven
positive/negative oracles, plus internal-consistency invariants. All UNIT-level (P0), no new test
level introduced, no duplicate coverage of the 4.1/4.2/4.3 category oracles.

| # | Gap | Level / Priority | Risk |
| - | --- | ---------------- | ---- |
| GAP-1 | Unselected-option VAT (`unselectedOptionVatWouldAdd`) never engine-verified as a negative oracle | Unit / P0 | R-408 |
| GAP-2 | Selected-option net only summed pre-joined `includedLinesOre`; base+option decomposition unverified | Unit / P0 | R-408 |
| GAP-3 | Hidden-row basis sum only trusted via estimateDeduction internal sum; eligibility-warning absence unasserted | Unit / P0 | R-408 |
| GAP-4 | Documented-delta `newExpectedOre` (69) never reproduced by the real engine — prose, not oracle | Unit / P0 | R-410 (load-bearing) |
| GAP-5 | Documented-delta old/new pairing internal consistency (`new − old === delta`) unasserted | Unit / P0 | R-410 |

## Step 3 — Generated Tests (aggregation)

**New file:** `tests/unit/lib/money/golden-pack-coverage.test.ts` — 5 P0 tests, all driving the real
`@/lib/money` engine. No new engine symbol, no fork, no re-pin of an existing numeric authority,
nothing marked production-approved.

- Runner: `pnpm run test:unit` (the new file is on the `tests/unit/**/*.test.ts` glob).
- **Non-vacuous verified:** mutating the documented-delta `newExpectedOre` 69→70 fails GAP-4 + GAP-5;
  fixture restored (no residual diff).

## Full CI verify-job gate (run locally, in order)

- `verify:lockfiles` ✅
- `verify:service-role-containment` ✅
- `typecheck` ✅ (0 errors)
- `lint` ✅ (0 errors; 1 pre-existing unrelated warning in `vat.test.ts`)
- `test:unit` ✅ **612 pass / 0 fail / 0 skipped** (was 607 → +5 new)
- `build` ✅
- `verify:bundle-containment` ✅

DB/int/e2e gates unchanged — this expansion adds NO migration, DB surface, route/UI, or int/e2e
reference (pure `node --test` unit + golden, consistent with the story scope and the epic-4 test
design).
