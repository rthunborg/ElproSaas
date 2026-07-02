---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-02'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-3-rot-and-gron-teknik-estimate-engine-with-warnings.md'
  - '_bmad-output/test-artifacts/test-design-epic-4.md'
  - 'src/lib/money/tax.ts'
  - 'src/lib/money/ore.ts'
  - 'src/lib/money/index.ts'
  - 'tests/unit/lib/money/tax.test.ts'
  - 'tests/unit/lib/money/tax.golden.test.ts'
  - 'tests/fixtures/golden/money/rot-gron-deductions.json'
---

# Test Automation Expansion — Story 4.3 (ROT / grön-teknik estimate engine)

## Mode & Stack

- **Mode:** BMad-Integrated (story + epic-4 test-design present).
- **Detected stack:** backend/pure-library slice — `src/lib/money` is pure TS logic. No browser/DB
  surface (Epic 4 is primitives; DB/UI consumers are Epics 5-6). Two-runner stack: pure logic on
  `node --test`; the coverage expansion adds ZERO Vitest/Playwright tests, per the test design.
- **Framework verified:** `node --test` unit runner (`pnpm run test:unit` →
  `--experimental-strip-types --import ./tests/support/register.mjs`), `@/lib/money` bare-directory
  alias resolves via `tests/support/alias-hook.mjs`. No `framework` scaffold needed.

## Existing coverage (baseline, authored by dev-story)

- `tests/unit/lib/money/tax.test.ts` — 4.3-UNIT-01..07 (engine shape/values, mix block, no-approval,
  hidden-row basis, no-PII posture, frozen snapshot, unknown-type DX).
- `tests/unit/lib/money/tax.golden.test.ts` + `tests/fixtures/golden/money/rot-gron-deductions.json`
  — 4.3-GOLDEN-01/02 (cap boundaries, half-mode pin, mix block, private/company/brf/public
  eligibility, no-hidden-literal source grep, anonymized-fixture PII scan).

These cover the AC-level behaviour thoroughly. The expansion targets the reachable-but-un-asserted
BRANCHES of `src/lib/money/tax.ts` so a future refactor cannot silently move a guard.

## Coverage plan — targets, levels, priorities

All targets are **Unit** level (pure logic; no integration/E2E is in scope for Epic 4 primitives).

| # | Target branch in `tax.ts` | Priority | Gap vs baseline |
|---|---------------------------|----------|-----------------|
| 1 | `INVALID_QUANTITY` on malformed `persons`; fractional persons accepted; persons omitted | P1 | Not exercised anywhere |
| 2 | Multi-line basis `sumOre` → empty→0, invalid element → `INVALID_ORE_AMOUNT`, sum overflow → `ORE_OVERFLOW` | P1 | Baseline tests single-value/valid arrays only |
| 3 | Warning CODES: `UNAPPROVED_PROFILE` first; `DEDUCTION_CLAMPED_TO_CAP` code on above-cap; at-cap emits no clamp; `POSTURE_NOT_ELIGIBLE` code | P1 | Golden asserted messages via regex, not stable codes/order |
| 4 | Exported `ROT_/GRON_` profiles are `Object.frozen`, `approved:false`, pinned bp/cap (live exports) | P2 | Golden reads fixture copies, not the live exports |
| 5 | Embedded `assumptionSnapshot` on an ok estimate: frozen, echoes basis/persons/capturedAt, warnings mirror | P1 | Baseline tested the standalone builder, not the embedded one |
| 6 | `buildTaxAssumptionSnapshot` standalone: label→profileId fallback, persons omitted (not undefined), deep-frozen warnings copied-by-value, state-only/no-isApproved | P1 | Baseline covered rate-mutation + freeze only |
| 7 | Mix-block symmetry (`gron_teknik`+co-present `rot`), single-type list not a mix, missing type → `UNKNOWN_DEDUCTION_TYPE`, mix precedence over bad basis | P1 | Baseline tested one mix direction + an out-of-set string only |

**Justification:** comprehensive branch-coverage of a load-bearing money/tax engine that carries
NON-NEGOTIABLE epic blockers (R-405 no-approval, R-406 mix block, R-407 caps, R-408 hidden-row
basis, R-409 snapshot freeze, R-412 no-PII). Every added case pins a stable typed outcome.

## Generated tests

- **`tests/unit/lib/money/tax.edges.test.ts`** — 24 unit tests across 7 describe blocks, mirroring
  the existing `node --test` + `@/lib/money` barrel conventions (matches the `ore-edges.test.ts` /
  `vat.coverage.test.ts` sibling-file naming already in the directory). No fixture change, no new
  dependency, no PII. The primary ATDD contract files (`tax.test.ts`, `tax.golden.test.ts`) are
  left UNCHANGED.

## Verification

- New file: `tax.edges.test.ts` → **24 pass / 0 fail**.
- Full unit suite (`tests/unit/**/*.test.ts`) → **596 pass / 0 fail** (was 572; +24 additive).
- `tsc --noEmit` → exit 0. `eslint tax.edges.test.ts` → exit 0.

## Notes / deferred

- Two `tax.ts` guards are DEFENSE-IN-DEPTH and not reachable through the public profiles:
  `INVALID_VAT_RATE_BP` (a malformed profile rate — the two exported profiles are valid) and the
  `rateApplied` `ORE_OVERFLOW` (rate ≤ basis, so a valid basis cannot overflow the rate application).
  These are intentionally NOT tested via the public API — they would require constructing an
  invalid profile the type system forbids. Documented, not a coverage gap.
- Two STANDING NFR concerns persist from the epic: no `pnpm audit` dependency-scan CI gate and no
  coverage reporter (owner-pending; flag at the epic gate, not this task's to fix).
