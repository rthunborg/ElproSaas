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
post-merge safety net). They execute as ordered steps in a single `verify` job —
one install, then the gates in sequence. A single job avoids re-installing
dependencies once per gate; later stories that need their own service container
(e.g. RLS, golden-master) will add separate jobs.

| # | Gate | Command | Purpose |
| --- | --- | --- | --- |
| 1 | Install | `pnpm install --frozen-lockfile` | Reproducible install; fails if `pnpm-lock.yaml` is stale. |
| — | Lockfile guard | `pnpm run verify:lockfiles` | Enforces pnpm as the only package manager (AR2); rejects an empty/invalid lockfile. |
| 2 | Typecheck | `pnpm typecheck` | `tsc --noEmit` — no type errors. |
| 3 | Lint | `pnpm lint` | `eslint` — lint clean. |
| 4 | Unit tests | `pnpm test` | Placeholder today (see below); becomes the real unit suite from Epic 2. |
| 5 | Build | `pnpm build` | `next build` succeeds (fetches a Google font over the network — expected to pass on networked CI). |

### Unit-test gate (placeholder, by decision)

No test framework or testable product code exists yet. Story 1.1 deferred the
test-framework choice to "the first story that needs it," and the TEA
`testarch-framework` workflow initializes the real harness around Epic 2.

To keep the unit-test gate wired without pre-empting that decision (and without
adding a dependency, per AR28), the `test` script is an honest placeholder: it
prints why no suite exists yet and exits 0. It is **not** a silent false-green —
the script announces its own emptiness, and the real suites land with Epic 2
(command/lifecycle units) and Epic 4 (money/tax units). When the harness is
introduced, replace the placeholder `test` script with the real runner; no CI
workflow change is required because CI already calls `pnpm test`.

## Deferred Gates

These are required **once the surface they guard is introduced**. They are not run
today because there is nothing for them to check yet. Each maps to the story that
activates it (architecture §19 stages 6–10).

| Gate | Architecture §19 stage | Activated by |
| --- | --- | --- |
| Supabase migration reset (empty DB → reset → seed) | 6 | First migration story — Story 2.2 (membership schema, RLS helpers, two-tenant fixtures). |
| Integration command tests | 7 | Story 2.3 (server command envelope) and downstream command stories. |
| RLS negative tests (cross-tenant) | 8 | Story 2.2 (helpers/fixtures), hardened by Story 2.4 (security regression harness; RLS coverage gate). |
| Storage negative tests (path spoofing, expired URLs, MIME/size) | 8 | Epic 8, Story 8.1 (file-storage foundation). |
| Golden-master comparison | 9 | Epic 4, Story 4.4 (money/tax golden fixtures); Story 5.5; Story 9.3. |
| Secret scan (or equivalent) | 10 | External-beta hardening (post Phase A). |

**RLS coverage gate (future).** Once tenant-owned tables exist, every such table
must be enrolled in the parameterized cross-tenant negative suite before merge; CI
fails when a tenant-owned table is not covered (architecture §18). This is
introduced with Story 2.2 / 2.4.

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
