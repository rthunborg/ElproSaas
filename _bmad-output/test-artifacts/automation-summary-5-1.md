---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-03'
workflowType: testarch-automate
story: 5.1 Tenant-Owned Calculation Schema And Server Commands
detectedStack: backend (Next.js server commands + Supabase/Postgres; Vitest INT + node --test unit)
executionMode: sequential (coverage expansion on a review-status, already-green story)
inputDocuments:
  - _bmad-output/implementation-artifacts/5-1-tenant-owned-calculation-schema-and-server-commands.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - src/server/commands/calculations/validation.ts
  - src/server/commands/calculations/{calculations,sections,rows}.ts
  - tests/unit/server/commands/calc-validation.test.ts
  - tests/integration/commands/calculation-commands.int.test.ts
  - tests/integration/commands/calculation-parent-ownership.int.test.ts
  - src/lib/money/{ore,vat}.ts
---

# Test Automation Expansion — Story 5.1

## Framework / stack
- INT/RLS: Vitest 4.1.9 against local Supabase (`pnpm run test:int`).
- Pure logic: `node --test` (`pnpm run test:unit`).
- Framework already scaffolded — no framework/CI setup needed here.

## Existing coverage (baseline, all green in the story dev run)
- INT: `calculation-commands.int.test.ts` (happy create calc/row + one audit row, sort_order,
  6 VALIDATION_FAILED paths, archive soft-delete, reorder rows/sections commit + rollback R-503).
- INT: `calculation-parent-ownership.int.test.ts` (cross-tenant customer/facility/contact link
  → TENANT_ACCESS_DENIED; client tenant_id ignored).
- RLS: three calc tables enrolled in the H4 inventory → cross-tenant + anon negatives + gate
  are data-driven green (`tenant-table-inventory.ts`, `cross-tenant-isolation`, `anon-path-isolation`).
- Migration: `calc-tables-migration-reset.int.test.ts` + extended `migration-reset.int.test.ts`.
- Unit: `calc-validation.test.ts` — covers `validateCreateRow` + `validateUpdateCalculation` only.

## Coverage gaps identified (targets)
The INT/RLS seams are comprehensively covered. The concrete gap is at the **pure-validator unit
level** — six exported validators have NO test anywhere (confirmed by grep across `tests/`):
`validateCreateCalculation`, `validateCreateSection`, `validateUpdateSection`, `validateUpdateRow`,
`validateReorderRows`, `validateReorderSections`. These are the fast per-PR gate for the
command-layer contract (row_type/qty/unit/öre/VAT/markup/lifecycle/UUID-shape) and are cheap,
deterministic, DB-free.

## Coverage plan
| Target | Level | Priority | Justification |
| --- | --- | --- | --- |
| `validateCreateCalculation` (customer UUID required, optional facility/contact UUID guard, title required, tenant_id stripped) | Unit | P1 | Untested; guards the parent-link + no-tenant-echo contract |
| `validateCreateSection` / `validateUpdateSection` (optional title, `display_mode` enum, id UUID) | Unit | P1 | Untested; pins the section display-mode closed set |
| `validateUpdateRow` (patch-optional VAT, per-field öre/qty/type/markup guards, id UUID) | Unit | P1 | Untested; update semantics differ from create (VAT optional) |
| `validateReorderRows` / `validateReorderSections` (non-empty UUID array, bound, section/calc UUID) | Unit | P1 | Untested; the atomic-reorder input contract |
| `markup_bp` bp-shape + `is_hidden/is_optional/is_selected` bool guards on rows | Unit | P2 | Untested branch of `validateRowCommonFields` |
| `validateUpdateCalculation` additional legal/illegal transitions (ready→archived, ready→draft, same-state no-op, absent currentStatus default) | Unit | P2 | Rounds out the lifecycle state-machine matrix |

Scope: **selective** — one new unit file expanding validator coverage. No new dependency, no DB
schema change, no INT duplication (the INT suite already exercises the envelope+RLS seams).

## Output
- New: `tests/unit/server/commands/calc-validation-coverage.test.ts` (29 tests, all green).

## Validation
- New file: 29/29 pass under `pnpm run test:unit`.
- Full unit suite: 658 pass / 0 fail (was 629 baseline; +29, no regressions).
- `pnpm typecheck`: exit 0. `pnpm lint`: exit 0 (the sole warning is the pre-existing
  unused `ORE_AMOUNT_MAX` in `tests/unit/lib/money/vat.test.ts`, unrelated to this change).
- Pure `node --test` units — no DB / local Supabase required; INT/RLS suites untouched
  (already green in the story dev run).

## Notes / non-obvious findings
- Two initial test assumptions were wrong and corrected to match REAL validator behavior:
  an EMPTY-STRING `title`/`unit` on an update patch is treated as ABSENT (dropped) by the
  empty-patch-friendly `isPresent("")===false` convention, whereas a WHITESPACE-ONLY value
  is present-but-blank and rejected. Tests now pin both branches (empty → dropped;
  whitespace → VALIDATION_FAILED). No code change — the validators are correct.
