# Tests

This directory holds the first acceptance tests for the project. They were authored
ATDD-style (red phase) during **Story 2.1 — Tenant Admin Login And Tenant Context
Resolution** and pin Story 2.1's acceptance criteria.

## Runner: dependency-free `node --test` for unit suites; INT/E2E gated on Story 2.2

`pnpm test` now runs the platform unit suites via **`node --test`** with
`--experimental-strip-types` (Node's built-in test runner + native TS type-stripping —
**no test-framework dependency added**, consistent with the project's bare-Node
`scripts/verify/*.mjs` pattern). The `@/*` alias and extensionless TS imports are resolved
by `tests/support/alias-hook.mjs` (registered via `tests/support/register.mjs`). Only
`tests/unit/**/*.test.ts` is collected.

The **authoritative DB-backed INT tests and the browser E2E** are **GATED on Story 2.2's
local Supabase stack + two-tenant factories** (and, for E2E, a browser runner such as
Playwright). Those scaffolds (`tests/integration/**`, `tests/e2e/**`) are written against
a `describe`/`it`/`page` API and are **excluded from `tsconfig`** until that runner +
types land — they are the red-phase spec carried forward (Story 2.1 Task 6.2 hand-off).
**Do not add a heavier test framework or a browser runner as a side effect of touching
these files** — that is a separate, gated step owned by the TEA `testarch-framework`
decision / Story 2.2.

## Layout

| Path | Level | Status | Runs when |
| --- | --- | --- | --- |
| `unit/resolve-tenant-context-core.test.ts` | Unit (pure decision core, no I/O) | **GREEN — runs in `pnpm test`** | Now (`node --test`) |
| `unit/server/auth/resolve-tenant-context.test.ts` | Unit (resolver, faked Supabase client injected) | **GREEN — runs in `pnpm test`** | Now (`node --test`) |
| `unit/scripts/verify/service-role-containment.test.ts` | Unit (R-002 guard bite proof) | **GREEN — runs in `pnpm test`** | Now (`node --test`) |
| `integration/server/auth/resolve-tenant-context.int.test.ts` | Integration (DB-backed) | **GATED on Story 2.2** (`.skip`, excluded from tsconfig) | Story 2.2 local Supabase stack + two-tenant factories |
| `e2e/auth/login-and-tenant-context.e2e.spec.ts` | E2E (browser) | **GATED on framework + Story 2.2** (`.skip`, excluded from tsconfig) | Playwright configured + 2.2 seeded users |

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
