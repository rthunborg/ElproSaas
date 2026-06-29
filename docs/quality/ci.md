# CI And Quality Gates

This document describes the Continuous Integration (CI) pipeline that enforces the
Phase A quality gates. CI is the automated enforcement surface for
[Gate 2 — Static Quality](quality-gates.md) and the staged gate order defined in
architecture §19.

The workflow lives at [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

## Scope And Principles

- **Small but expandable.** Only the gates that are testable today run in CI. The
  heavier gates (migrations, integration, RLS/storage, golden-master, secret scan)
  are documented placeholders that later stories activate when the surfaces they
  guard actually exist. See [Deferred Gates](#deferred-gates).
- **No secrets, no external services.** The current pipeline references no
  `secrets.*`, no environment variables, no external/paid service, no Supabase
  service container, and no deploy step. Adding any of these is a stop condition
  that requires explicit owner approval.
- **One source of truth for versions.** Node is derived from `.nvmrc`
  (`node-version-file: .nvmrc`) and pnpm from the `packageManager` field in
  `package.json` (via `pnpm/action-setup`), so CI versions never drift from the
  repository's pinned toolchain (established in Story 1.1).

## Active Gates

These run on every pull request targeting `main` (and on `push` to `main` as a
post-merge safety net). The `verify` job runs stages 1-5 as ordered steps (one
install, then the gates in sequence). Story 2.2 added a SEPARATE `db` job for the
stack-dependent gates (migration reset + RLS negatives, stages 6 + 8), which need
their own local Supabase service and so cannot share the `verify` install.

| # | Gate | Command | Purpose |
| --- | --- | --- | --- |
| 1 | Install | `pnpm install --frozen-lockfile` | Reproducible install; fails if `pnpm-lock.yaml` is stale. |
| — | Lockfile guard | `pnpm run verify:lockfiles` | Enforces pnpm as the only package manager (AR2); rejects an empty/invalid lockfile. |
| — | Service-role containment | `pnpm run verify:service-role-containment` | Fails if the service-role key is `NEXT_PUBLIC_` or reachable from a `"use client"` path (architecture §6). |
| 2 | Typecheck | `pnpm typecheck` | `tsc --noEmit` — no type errors (now includes the re-enrolled `tests/integration/**`). |
| 3 | Lint | `pnpm lint` | `eslint` — lint clean. |
| 4 | Unit tests | `pnpm run test:unit` | Pure-logic suites on the dependency-free `node --test` runner. |
| 5 | Build | `pnpm build` | `next build` succeeds (fetches a Google font over the network — expected to pass on networked CI). |
| 10 | Built-bundle containment | `pnpm run verify:bundle-containment` | The AUTHORITATIVE R-002 grep — scans the produced `.next` payload for any service-role key name, the `LOCAL_SUPABASE_SERVICE_ROLE_KEY` symbol, a `NEXT_PUBLIC_*SERVICE_ROLE*` name, or a `service_role` JWT value (architecture §9/§20). Runs **after** build (needs `.next`; fails loud if absent). |

The `db` job (separate, with the local Supabase stack):

| # | Gate | Command | Purpose |
| --- | --- | --- | --- |
| 6 | Migration reset | `supabase db reset` | Empty DB → apply migrations → seed; fails on a bad migration (architecture §19 stage 6). |
| 8 | Integration + RLS negatives + H4 inventory gate | `pnpm run test:int` | DB-backed integration + cross-tenant/anonymous RLS-negative suites (Vitest) against the LOCAL stack only, **including the H4 RLS table-inventory gate** that fails CI when a tenant-owned table is not enrolled in the parameterized suite (architecture §18). `SUPABASE_TEST_REQUIRED=1` makes a missing stack a hard failure. |

### Test runners (TEA framework decision, Story 2.2)

The project runs TWO deliberately-separated runners (architecture §18):

- **`node --test`** (dependency-free, Story 2.1) runs the pure-logic unit suites
  under `tests/unit/**` via `pnpm run test:unit` — fast, zero runtime deps.
- **Vitest** (Story 2.2) runs the DB-backed integration + RLS-negative suites
  under `tests/integration/**` via `pnpm run test:int` — they need a real runner,
  async lifecycle, and a live local Supabase stack.

`pnpm test` runs both in order. The `verify` CI job runs only `test:unit` (no DB);
the `db` CI job runs `test:int` after `supabase db reset`. The two runners exist
because subsuming the established `node --test` units into Vitest would mean
rewriting every `node:test`/`node:assert` import for no behavioral gain.

## Deferred Gates

These are required **once the surface they guard is introduced**. They are not run
today because there is nothing for them to check yet. Each maps to the story that
activates it (architecture §19 stages 6–10).

| Gate | Architecture §19 stage | Status |
| --- | --- | --- |
| Supabase migration reset (empty DB → reset → seed) | 6 | **ACTIVE** (Story 2.2 — `db` job, `supabase db reset`). |
| Integration command tests | 7 | Partly active: the DB-backed integration suite runs in the `db` job (Story 2.2). Command-envelope integration tests land with Story 2.3. |
| RLS negative tests (cross-tenant + anonymous) | 8 | **ACTIVE** for `tenants`/`tenant_memberships`/`audit_events`, hardened into the inventory-gated parameterized suite + the H4 table-inventory gate (Story 2.4 RLS coverage gate). |
| Storage negative tests (path spoofing, expired URLs, MIME/size) | 8 | Deferred — Epic 8, Story 8.1 (file-storage foundation). It inherits the SAME inventory-gate mechanism: a storage table enrolls in `tenant-table-inventory.ts` when it lands. |
| Golden-master comparison | 9 | Deferred — Epic 4, Story 4.4; Story 5.5; Story 9.3. |
| Built-bundle service-role containment | 10 | **ACTIVE** (Story 2.4 — `verify:bundle-containment`, after build). The authoritative R-002 payload grep. A broader generic secret scan stays deferred to external-beta hardening (post Phase A). |

**RLS coverage gate (active).** Story 2.2 established the reusable cross-tenant
negative pattern; Story 2.4 generalized it onto one shared tenant-table inventory
(`tests/integration/rls/tenant-table-inventory.ts`) and added the **H4 table-
inventory gate** (`tests/integration/rls/rls-inventory-gate.int.test.ts`) — the
STANDING gate (architecture §18) that fails CI when a tenant-owned table is not
enrolled. A product PR adding/touching a tenant-owned table MUST enroll it before
merge (see [quality-gates.md Gate 4](quality-gates.md)). This is the regression
mechanism every later tenant-owned table (Epics 3-9) plugs into.

## Test Environment Ground Rules

These rules (architecture §18, Test Infrastructure Decisions) apply once test jobs
land in CI:

- **Local Supabase only.** Automated tests run against a local Supabase stack (CLI
  stack with migration reset) — **never** against shared dev, staging, or prod
  projects. No test configuration may point at a remote Supabase project.
- **`seed.sql` is a minimal deterministic baseline only.** It does not hold broad
  business fixtures. Business test data is created by test-only factories
  introduced in Story 2.2 (tenants, auth users, `tenant_admin` memberships, CRM
  records, calculations, quotes, and later files).
- **Parallel safety.** Each test worker provisions its own tenant pair; shared
  mutable tenant fixtures are not used for parallel tests.
- **Test keys stay test-only.** Any admin/service key used for test setup is
  test-only and is never imported into app or client code.

## Docs/Config-Only PRs

Docs/config-only PRs (no product code, schema, or dependency changes) may run
lighter checks than full product PRs. When a product gate is skipped, the PR
**must explicitly state which product gates were skipped** in the
"Tests / Checks Run" section of the PR description (architecture §19;
[quality-gates.md Gate 2](quality-gates.md)). Silent skipping is not allowed.

## References

- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — the workflow.
- [quality-gates.md](quality-gates.md) — Gate 2 (Static Quality) and the phase gate matrix.
- [definition-of-done.md](definition-of-done.md) — Phase A done criteria CI enforces.
- [branching-and-pr-policy.md](../process/branching-and-pr-policy.md) — PR requirements and merge gates.
- architecture.md §18 (Test Strategy + Test Infrastructure Decisions), §19 (CI And Quality Gates).
