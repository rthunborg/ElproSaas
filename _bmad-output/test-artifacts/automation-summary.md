---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-03'
workflowType: testarch-automate
story: 5.2 Calculation Editor UX For Sections And Rows
detectedStack: fullstack
executionMode: sequential (pure-unit coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/5-2-calculation-editor-ux-for-sections-and-rows.md
  - src/features/calculations/totals.ts
  - src/features/calculations/form-parsing.ts
  - src/features/calculations/money-input.ts
  - src/features/calculations/ordering.ts
  - src/features/calculations/action-state.ts
---

# Test Automation Expansion — Story 5.2 (Calculation Editor UX)

## Preflight & Context

- **Mode:** BMad-Integrated (story file provided). Create mode.
- **Stack:** fullstack (Next 16 / React 19 frontend + Supabase). Frameworks verified: Playwright
  (`playwright.config.ts`) + Vitest (`vitest.config.ts`) + `node --test` unit runner.
- **Story surface reviewed:** pure editor logic (`totals.ts`, `ordering.ts`, `money-input.ts`,
  `form-parsing.ts`, `action-state.ts`), `"use server"` actions (`actions.ts`), read layer
  (`read.ts`), client island(s). Existing tests already present for all five pure modules plus
  an E2E spec (`tests/e2e/calculations/calculations.e2e.spec.ts`).

## Identify Targets — Coverage Gaps

Expansion focused on the fast `node --test` unit gate (pure, I/O-free logic — the money +
ordering + parsing CONTRACT). I/O-bound `actions.ts`/`read.ts` are covered by the story's E2E
and are not appropriate for pure units. Gaps filled (all P0–P2, aligned with story Task 5.1):

| Module | Gap (previously untested) | Priority |
| --- | --- | --- |
| `totals.ts` | Engine-failure propagation — overflow/malformed-quantity → typed `{ok:false,code}`, never NaN | P0 |
| `totals.ts` | Excluded (unselected-option) overflow row does NOT poison a valid section sum | P1 |
| `totals.ts` | Empty row list / sections-with-no-rows → zero total (not a failure) | P2 |
| `totals.ts` | A HIDDEN row's öre actually LANDS in the section sum (inclusion pin, integrated) | P1 |
| `totals.ts` | `computeLineVat` byte-parity with `lineVatOre` + failure propagation | P2 |
| `form-parsing.ts` | AC2 `values` echo-back (preserve-input on failure) — row + calc forms | P1 |
| `form-parsing.ts` | UPDATE-row money boundary (kronor→öre/percent→bp) + malformed rejection + empty-patch | P1 |
| `form-parsing.ts` | Missing required section_id/unit; missing id on update-calc/section | P2 |
| `form-parsing.ts` | Row free-text attach + empty-drop; reorder trailing-comma/blank filtering | P2 |
| `money-input.ts` | `MARKUP_BP_MAX` ceiling boundary (accept-at / reject-above); `NaN`→""; whitespace tolerance | P2 |
| `ordering.ts` | `moveDown` negative/out-of-range no-op; append-to-empty; remove-only-element; reorderTo identity | P2 |

## Generate — Result

Extended the four existing calc unit test files in place (no duplicate parallel files):

- `tests/unit/features/calculations/totals.test.ts` (+10 cases)
- `tests/unit/features/calculations/form-parsing.test.ts` (+13 cases)
- `tests/unit/features/calculations/money-input.test.ts` (+4 cases)
- `tests/unit/features/calculations/ordering.test.ts` (+6 cases)

**+33 new test declarations** (net +30 executed tests over the whole suite: 717 → 747).

## Verification

- Calc unit subset: 85 pass / 0 fail (was 55).
- Full unit suite (`pnpm run test:unit`): **747 pass / 0 fail**.
- `pnpm typecheck`: clean.
- `pnpm lint`: 0 errors (1 pre-existing warning in `tests/unit/lib/money/vat.test.ts`,
  unrelated to this story — already documented in the story Debug Log).

All new tests are pure `node --test` (fast gate on every PR). No new dependency, no framework
change, no production code touched.
