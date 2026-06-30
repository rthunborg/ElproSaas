---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-06-30'
inputDocuments:
  - _bmad-output/implementation-artifacts/3-2-crm-tenant-admin-ux-and-lifecycle-context.md
  - src/components/crm/customer-presentation.ts
  - src/features/crm/form-parsing.ts
  - src/features/crm/action-state.ts
  - src/features/crm/read.ts
  - src/features/crm/actions.ts
  - src/server/commands/crm/validation.ts
  - src/server/commands/command-errors.ts
  - tests/unit/components/crm/customer-presentation.test.ts
  - tests/unit/features/crm/form-parsing.test.ts
  - tests/support/register.mjs
---

# Test Automation Expansion — Story 3.2 (CRM Tenant-Admin UX And Lifecycle Context)

## Mode & Stack

- **Mode:** BMad-Integrated (story 3.2 loaded). Create mode (expand after implementation).
- **Detected stack:** frontend/fullstack — Next 16 App Router UI over the Story 3.1
  server commands. This story already ships 12 Playwright e2e specs (the browser surface)
  plus node --test units for the pure presentation/parsing helpers. This run targets the
  PURE-FUNCTION gaps the e2e happy paths skip, preferring fast `node --test` units over
  more e2e (per the task brief and the project two-runner split).
- **Baseline (before this run):** unit 208 green.

## Scope

Expanded fast `node --test` unit coverage for the pure modules implemented in 3.2,
focusing on branches/edge-cases NOT exercised by the existing happy-path units or the
e2e specs:

- `src/features/crm/action-state.ts` — was UNTESTED. New file
  `tests/unit/features/crm/action-state.test.ts`: the pristine `CRM_ACTION_INITIAL`
  contract, and `isRetryableError` (true ONLY for an error-status `SERVER_ERROR`; false
  for denial/validation/auth/idle/success and for a stale `SERVER_ERROR` code on a
  non-error status — the AC4 "transient ≠ permanent denial" rule).
- `src/features/crm/form-parsing.ts` — expanded `form-parsing.test.ts`: the previously
  untested `parseUpdateFacilityForm` / `parseUpdateContactForm`; brf+public org_nr
  requiredness; private stray-org_nr drop; whitespace-only display_name trim;
  optional-field trim+omit; update forwards BOTH identifiers (no type-driven filtering
  on update); is_primary boolean parsing (on/true/1 → true; off/false/0/no → false;
  absent → key omitted); values-echo only collects string entries.
- `src/components/crm/customer-presentation.ts` — expanded
  `customer-presentation.test.ts`: undefined-optional-column normalization to null;
  unknown customer_type raw-string fallback; matchesQuery identifier-only match, null
  fields not coerced to 'null', query trim, partial substring; maskPersonnummer
  exactly-4-char boundary (fully masked), surrounding-whitespace trim, whitespace-only
  no-leak; findDuplicateLikeNames all-matches + substring-superset-is-not-a-match +
  whitespace candidate + empty list.

## Deliberately NOT unit-tested here

- `src/features/crm/read.ts` and `src/features/crm/actions.ts` are I/O-bound
  (cookie-bound RLS Supabase client / envelope round-trip) — not pure functions. Their
  contracts (personnummer-excluded list projection, generic not-found with no
  cross-tenant leakage, Result→UI mapping, envelope-only writes) are exercised at the
  e2e/integration level where the real RLS client runs, which is the correct level.

## Result

- **Unit suite:** 208 → 239 green (+31 tests). typecheck + lint clean.
- No existing test weakened; no implementation changed. One authored assertion was
  corrected to match the real (safe) `maskPersonnummer` behavior for a whitespace-only
  input (returns a bullet, never the raw spaces) rather than weakening it.
