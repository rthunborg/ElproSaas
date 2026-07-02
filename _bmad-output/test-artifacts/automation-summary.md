---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-02'
inputDocuments:
  - _bmad-output/implementation-artifacts/4-1-integer-ore-money-and-rounding-primitives.md
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - src/lib/money/ore.ts
  - src/lib/money/index.ts
  - src/features/pricing/money-display.ts
  - src/server/commands/pricing/validation.ts
  - tests/unit/lib/money/ore.test.ts
  - tests/unit/lib/money/rounding.golden.test.ts
  - tests/unit/lib/money/roundtrip.test.ts
---

# Test Automation Expansion — Story 4.1 (Integer Öre Money & Rounding Primitives)

## Mode & Stack

- **Mode:** BMad-Integrated (story 4.1 + epic-4 test design present). Create mode (expand after implementation).
- **Detected stack:** `backend` — a pure `src/lib/money` logic module. NO browser/API/E2E
  surface. Framework present: `node --test` unit runner (`pnpm run test:unit`) + Playwright
  (unused here). Execution: sequential, single worker (one small pure module; the subagent
  API/E2E dispatch matrix does not apply to pure-logic unit expansion).
- **Test level:** UNIT only (`node --test`), matching the epic-4 test-design Execution Strategy
  (Epic 4 = pure unit + golden; no DB/browser/network).

## Coverage baseline (already present before this run)

The story's ATDD scaffolds + dev-story work already pinned the AC contract:
`ore.test.ts` (4.1-UNIT-01..07), `rounding.golden.test.ts` (4.1-GOLDEN-01, R-402 mode pin),
`roundtrip.test.ts` (P3 boundary agreement), plus `isOreAmount` exercised via
`pricing-validation*.test.ts` (the re-export). Full unit suite baseline: 463 pass.

## Gaps identified (Step 2) → tests generated (Step 3)

New file: **`tests/unit/lib/money/ore-edges.test.ts`** (27 tests, mirrors the repo
`*-edges.test.ts` supplemental-coverage convention). Targets surfaces/branches reached only
indirectly before:

| Gap | Priority | Coverage added |
| --- | --- | --- |
| `isQuantity` — direct predicate (0, fractional, `-0`, negatives, `NaN`/±∞, non-number, bigint) | P2 | 5 tests |
| `validateQuantity` — the exported typed-result wrapper (OK carries value; ERR carries `INVALID_QUANTITY`, no raw echo; no throw) | P1 | 3 tests |
| Canonical `isOreAmount` / `ORE_AMOUNT_MAX` exported DIRECTLY from `@/lib/money` (only the re-export was exercised) + ceiling boundary | P1 | 3 tests |
| **Typed-failure CODE specificity** — pins WHICH `MoneyErrorCode` each rejection carries (`INVALID_QUANTITY` vs `INVALID_ORE_AMOUNT` vs `ORE_OVERFLOW`); quantity-before-price ordering; overflow via a valid-input product | P0 | 5 tests |
| `sumOre` — non-öre element mid-array → `INVALID_ORE_AMOUNT`; empty array → 0; single element; ceiling-equal accepted | P1 | 4 tests |
| `formatOreAsKronor` — defensive sign / truncate branches (negative sign, non-integer truncation toward zero, `-0`, öre-remainder padding, `ORE_AMOUNT_MAX`) that back the pricing-UI delegate | P2 | 5 tests |
| `roundToOre` — documented non-finite passthrough + extra half-away-from-zero boundaries | P2 | 2 tests |

**Rationale (scope):** selective/targeted expansion of the EXISTING pure module. No new test
level, no DB/browser/E2E (out of scope per epic-4 test design). No duplicate coverage — the new
file asserts the error *codes* and predicate/wrapper *surfaces* the primary suites deliberately
left shape-agnostic, plus the defensive formatter branches the golden/roundtrip suites do not pin.

## Validation (Step 4)

- `tests/unit/lib/money/ore-edges.test.ts` — **27 pass / 0 fail**.
- Full unit suite (`pnpm run test:unit`) — **490 pass / 0 fail / 0 skipped** (463 → +27, exactly the new file; no regressions).
- `pnpm typecheck` — clean. `pnpm lint` — clean.
- DB/int/e2e gates unchanged: this expansion adds NO migration, dependency, DB or UI surface
  (pure unit only), consistent with the story's inherited-regression posture.

## Notes carried forward

- The golden-pinned rounding policy (line-level, half-away-from-zero, sum-of-rounded) remains a
  CONSERVATIVE PILOT ASSUMPTION pending owner/accounting sign-off (test-design Sign-Off Q1). Not
  re-opened here — coverage pins the *current* policy so an accidental mode flip fails loud.
- Two standing NFR concerns (no `pnpm audit` CI gate; no coverage reporter) are owner-pending at
  the epic level — not addressed by this coverage expansion.
