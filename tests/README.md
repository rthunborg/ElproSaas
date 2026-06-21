# Tests

This directory holds the first acceptance-test scaffolds for the project. They were
authored ATDD-style (red phase) during **Story 2.1 — Tenant Admin Login And Tenant
Context Resolution** and pin Story 2.1's acceptance criteria *before* implementation.

## Important: there is no test runner yet

`pnpm test` is still the documented placeholder (`package.json`). The real test runner
is chosen and wired by the TEA `testarch-framework` step (lands in **Epic 2** — Story 2.2
or a dedicated pre-2.4 task), **not** by these scaffolds. Vitest is the documented
likely choice (`test-design-epic-2.md` → Resource Estimates / Prerequisites). Browser
E2E uses Playwright, which is **not configured yet** either.

These files are therefore **specs to run, not yet runnable**. They are written against a
Vitest-style global API (`describe`/`it`/`expect`) and Playwright-style `page` calls.
When the framework decision lands, the assertions are the contract to satisfy; the
harness call shape adapts to whatever runner is selected. **Do not add a test framework
or dependency as a side effect of touching these files** — that is a separate, gated step.

## Layout

| Path | Level | Status | Runs when |
| --- | --- | --- | --- |
| `unit/server/auth/resolve-tenant-context.test.ts` | Unit (pure logic, mocked Supabase) | RED scaffold | As soon as the runner lands + Story 2.1 resolver is implemented |
| `unit/scripts/verify/service-role-containment.test.ts` | Unit (R-002 guard proof) | RED scaffold | After Story 2.1 Task 5 guard is implemented |
| `integration/server/auth/resolve-tenant-context.int.test.ts` | Integration (DB-backed) | **GATED on Story 2.2** | Story 2.2 local Supabase stack + two-tenant factories |
| `e2e/auth/login-and-tenant-context.e2e.spec.ts` | E2E (browser) | **GATED on framework + Story 2.2** | Playwright configured + 2.2 seeded users |

## Red-phase convention

- Every suite is `describe.skip(...)` so it cannot fail CI before its dependencies
  exist. The implementer removes `.skip` when wiring the real code (green phase).
- Assertions encode **expected behavior** — no placeholder `expect(true).toBe(true)`.
- Authoritative DB-backed isolation/RLS tests are **owned by Story 2.2's stack**
  (`test-design-epic-2.md` "Critical Prerequisite"); the gated files here are the
  red-phase spec carried forward so Story 2.2/2.4 can confirm nothing fell through
  (Story 2.1 Task 6.2 hand-off).

See `_bmad-output/test-artifacts/atdd-checklist-2-1-tenant-admin-login-and-tenant-context-resolution.md`
for the full acceptance-criteria → test mapping and green-phase steps.
