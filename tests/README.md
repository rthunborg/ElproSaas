# Tests

This directory holds the project's automated tests. Two deliberately-separated
runners are used (the TEA `testarch-framework` decision landed in **Story 2.2**;
architecture §18):

- **`node --test`** (dependency-free) — pure-logic unit suites under `tests/unit/**`.
  Run with `pnpm run test:unit`. Uses Node's built-in test runner +
  `--experimental-strip-types`; the `@/*` alias and extensionless TS imports are
  resolved by `tests/support/alias-hook.mjs` (via `tests/support/register.mjs`).
- **Vitest** — DB-backed integration + RLS-negative suites under `tests/integration/**`.
  Run with `pnpm run test:int`. The `@/*` alias is resolved natively by Vite 8
  (`resolve.tsconfigPaths`). These need a live **local Supabase stack**.

`pnpm test` runs both, in order.

## Running the DB-backed suites

```bash
supabase start && supabase db reset   # local stack only — never shared dev/staging/prod
pnpm run test:int
```

The integration suites talk to the **local Supabase stack only** (architecture §18).
When the stack is unreachable they **skip** (so contributors without Docker still get
a green `test:unit`); CI sets `SUPABASE_TEST_REQUIRED=1` so a missing stack is a hard
failure there. Connection/keys come from `tests/support/test-env.ts` (the universal
local-demo defaults; overridable via `SUPABASE_TEST_*` — not real secrets).

For required story-completion evidence, set `SUPABASE_TEST_REQUIRED=1` locally
as well and restore the prior process setting afterward. Explicit skipped tests
still do not execute: record actual executed/pass/skip counts. An ATDD scaffold
is a test plan until its real fixtures and assertions run. Automated agents must
follow the lifecycle/ownership requirements in [local setup](../docs/process/local-setup.md)
before starting, resetting, or stopping test services.

## Test-only service-role usage

The two-tenant factories (`tests/factories/`) create auth users and seed
tenants/memberships via the Supabase admin (service-role) path and a direct `pg`
superuser connection (`admin-sql.ts`). This is **TEST-ONLY** and confined to
`tests/factories/**` — the `check-service-role-containment.mjs` guard scans `tests/`
and would flag any leak into a `src/`/`app/` client path. The app runtime never uses
a service-role or raw-superuser path.

## Layout

| Path | Level | Status |
| --- | --- | --- |
| `unit/**` | Pure-logic units (resolver core/edges, claims, tenant-name, env, Result, the service-role + lockfile guard bite proofs) | **GREEN** (`pnpm run test:unit`, `node --test`) |
| `integration/server/auth/resolve-tenant-context.int.test.ts` | Integration (DB-backed) — Story 2.1 AC1-AC4, un-gated in 2.2 | **GREEN** (`pnpm run test:int`, local stack) |
| `integration/rls/cross-tenant-isolation.rls.test.ts` | RLS negative (SELECT/INSERT/UPDATE/DELETE × `tenants`/`tenant_memberships`) | **GREEN** (local stack) |
| `integration/rls/membership-self-grant.rls.test.ts` | RLS (self-grant/escalation denied + role/status CHECK bite) | **GREEN** (local stack) |
| `integration/rls/security-definer-search-path.rls.test.ts` | INT (SECURITY DEFINER search-path hijack negative, AC4/R-006) | **GREEN** (local stack) |
| `integration/rls/migration-reset.int.test.ts` | INT (`supabase db reset` green + objects present, AC1/R-007) | **GREEN** (local stack) |
| `integration/rls/factory-isolation.int.test.ts` | INT (per-worker fixture isolation R-012 + 2.1 un-gate marker AC5) | **GREEN** (local stack) |
| `factories/tenants.ts` | Two-tenant factory (B1) — `createTwoTenantFixture` / `makeAuthedServerClient` / `makeAnonServerClient` | **IMPLEMENTED** (real, local stack) |
| `factories/admin-sql.ts` | Test-only admin SQL helper (`pg` superuser) for introspection + the R-006 hijack proof | **IMPLEMENTED** |
| `e2e/**/*.e2e.spec.ts` | Playwright browser tests | Runner is configured in `playwright.config.ts`; `pnpm run test:e2e` needs local Supabase and production app startup. Individual ATDD scenarios may still be skipped. |

## Notes

- Playwright uses global setup/teardown and a production `webServer`. Verify each
  story's role fixtures and executed tests; runner availability alone does not
  turn skipped acceptance scaffolds into coverage.
- Per-worker isolation: every `createTwoTenantFixture()` call provisions its own
  tenants/users with globally-unique ids + names (H5 / R-012) — no shared mutable
  fixture. CI also `supabase db reset`s once up-front for a clean baseline.
