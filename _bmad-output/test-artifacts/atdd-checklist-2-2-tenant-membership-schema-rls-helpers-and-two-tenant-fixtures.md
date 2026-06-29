---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-06-23'
workflowType: testarch-atdd
storyId: 2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures
tddPhase: RED
inputDocuments:
  - _bmad-output/implementation-artifacts/2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - _bmad-output/test-artifacts/atdd-checklist-2-1-tenant-admin-login-and-tenant-context-resolution.md
  - _bmad/tea/config.yaml
  - package.json
  - tsconfig.json
  - tests/README.md
  - tests/integration/server/auth/resolve-tenant-context.int.test.ts
  - tests/unit/scripts/verify/service-role-containment.test.ts
---

# ATDD Checklist: Story 2.2 — Tenant Membership Schema, RLS Helpers, And Two-Tenant Fixtures

**Role:** Master Test Architect · **Mode:** Create · **TDD Phase:** RED (failing scaffolds before implementation)
**Generated:** 2026-06-23

---

## Step 1 — Preflight & Context

**Stack detection (`test_stack_type: auto`):** the load-bearing surface of THIS story is the
Postgres schema + RLS layer (`tenants`, `tenant_memberships`, helper predicates) exercised through
the Supabase client — i.e. a **backend** (database/RLS) story. No browser journeys are in scope for
2.2 (the UI acceptance for the auth flow was Story 2.1's E2E scaffold). Per the backend path, the
ATDD output is **integration / RLS-negative** scaffolds, not Playwright E2E.

**Prerequisite reality (the gating fact for this whole scaffold — by design, no HALT):**

- This is the FIRST story to create `supabase/` and a real test runner; NEITHER exists yet. The real
  runner (Vitest) and the local Supabase stack are stood up by the **Story 2.2 dev phase**, which is
  approval-gated (story Task 1.1 is an explicit Stop Condition / gated action). The ATDD phase does
  **NOT** install the runner, stand up Docker/Supabase, create any `supabase/migrations/**`, or
  modify `package.json` / `pnpm-lock.yaml` / `src/**` / `tsconfig.json`.
- Therefore every scaffold here is **EXPECTED to be red/pending** until the dev phase lands the stack.
  This matches the orchestrating instruction and `test-design-epic-2.md` "Critical Prerequisite".

**Inputs loaded:** the 2.2 story file (ACs 1-6, Tasks 1-8), `test-design-epic-2.md` (P0/P1/P2 tables
+ risks R-001/R-005/R-006/R-007/R-012), the Story 2.1 ATDD checklist (red-phase convention to match),
the existing gated 2.1 INT scaffold (`resolve-tenant-context.int.test.ts` — the exact factory API
`createTwoTenantFixture` / `makeAuthedServerClient` / `makeAnonServerClient` it imports),
`tests/README.md` (runner-absence + `describe.skip` convention), `tsconfig.json` (`exclude` of
`tests/integration/**` + `tests/e2e/**`), `tea/config.yaml`.

**Knowledge fragments (conceptual, applied):** data-factories (per-worker two-tenant pair, B1/H5),
test-quality (no placeholder assertions; expected-behavior only), test-levels-framework (RLS-negative
vs INT vs UNIT discipline), test-priorities-matrix (P0/P1/P2), test-healing-patterns. (The TEA
Playwright-utils fragments are not materially applicable — no browser surface in this story.)

---

## Step 2 — Generation Mode

**Mode: AI generation** (clear ACs; standard DB/RLS isolation, constraint, and migration-reset
scenarios). Recording mode **skipped** — backend/RLS story, no live UI to record against, and the
Supabase stack does not exist yet. The skill's parallel API/E2E subagent dispatch presumes a
configured runner + live app; with no runner and no stack, scaffolds were generated **sequentially
and directly** (the documented "sequential" resolution path, adapted to a pre-runner project),
honoring the red-phase contract.

---

## Step 3 — Test Strategy (AC → level → priority)

Test-level discipline (no duplicate coverage): cross-tenant DB isolation + self-grant denial +
search-path-hijack + migration-reset at **RLS/INT** (against the local stack, gated on the dev
phase); role/status CHECK enforcement at the **DB-constraint** level via the admin path; resolver
branch logic stays at **unit** (already GREEN from Story 2.1 — not re-scaffolded here). The `node
--test` lockfile-guard regression unit test (Task 4.3) is a **dev-phase** deliverable, not an ATDD
acceptance scaffold — noted in "Out of ATDD scope" below.

| AC | Scenario | Level | Priority | Risk | Status here |
| --- | --- | --- | --- | --- | --- |
| AC2 | Cross-tenant SELECT denied on `tenants` + `tenant_memberships` (zero rows, no leak) | RLS | P0 | R-001 | **Scaffolded (gated)** |
| AC2 | Cross-tenant INSERT denied (no spoofed Tenant B ownership) | RLS | P0 | R-001 | **Scaffolded (gated)** |
| AC2 | Cross-tenant UPDATE denied | RLS | P0 | R-001 | **Scaffolded (gated)** |
| AC2 | Cross-tenant DELETE denied | RLS | P0 | R-001 | **Scaffolded (gated)** |
| AC3 | Self-INSERT own membership denied (app/anon path) | RLS | P0 | R-005 | **Scaffolded (gated)** |
| AC3 | Self-UPDATE own role / status / tenant_id denied (app/anon path) | RLS | P0 | R-005 | **Scaffolded (gated)** |
| AC1 | `role` CHECK admits only `tenant_admin`; other value rejected (admin path) | RLS/UNIT | P0 | R-005 | **Scaffolded (gated)** |
| AC1 | `status` CHECK admits only ('active','invited','disabled'); other rejected | RLS/UNIT | P0 | R-005 | **Scaffolded (gated)** |
| AC4 | `SECURITY DEFINER` helper resists search_path hijack (or N/A if INVOKER) | INT | P0 | R-006 | **Scaffolded (gated)** |
| AC1 | `supabase db reset` from empty → objects present (tables/helpers/CHECKs/RLS/`name` NOT NULL) | INT | P0 | R-007 | **Scaffolded (gated)** |
| AC5 | Per-worker two-tenant pair isolation under parallel run (no shared mutable fixture) | INT | P1 | R-012 | **Scaffolded (gated)** |
| AC5 | Story 2.1 INT scaffold un-skipped, wired to factories, GREEN (AC1-AC4 handoff) | INT | P0/P1 | R-003/R-004 | **Un-gate marker (gated)** + existing 2.1 file |
| AC2/B1 | Factory contract pinned (`createTwoTenantFixture`/`makeAuthedServerClient`/`makeAnonServerClient`) | contract | P0 | R-012 | **Contract stub created** |
| AC6/B1 | Factory contract extends to CRM-shaped records without rework (forward-compat smoke) | UNIT/INT | P2 | R-012 | **Scaffolded (gated)** |

**Red-phase requirement confirmed:** every scenario asserts EXPECTED behavior (no placeholder
`expect(true).toBe(true)`) and is designed to fail before the Story 2.2 dev implementation exists.

---

## Step 4 / 4C — Generated Scaffolds (RED PHASE)

**Placement (architecture §3/§22):** all gated DB/RLS scaffolds live under `tests/integration/rls/`
— which is ALREADY in `tsconfig` `exclude` — so they do not break the `typecheck` gate while no
runner/types exist, and so this ATDD phase touches **neither `tsconfig.json` nor `supabase/`** (both
are dev-phase, gated). Architecture §3/§22 permit `supabase/tests/rls/` as the alternative home; the
green-phase implementer may relocate there once the stack + tsconfig re-enrollment land (noted in
each file header). Tests are NOT scattered in UI modules.

**Runner/skip idiom:** the skill's Playwright `test.skip()` red-phase idiom maps to this project's
established convention (from Story 2.1): `describe.skip(...)` + a `gated…()` throwing helper +
commented expected-behavior assertions, TS-only (no runner import) so the files type-check today and
port cleanly when Vitest lands. Each file uses a uniquely-named guard so the trees compile as one
unit after dev-phase tsconfig re-enrollment.

### Files created

| File | Level | Suite state | Gating |
| --- | --- | --- | --- |
| `tests/factories/tenants.ts` | Factory CONTRACT stub (B1) | exported stubs throw `notYetImplemented` | Dev phase builds the real per-worker, admin-created, auto-cleaning fixture. NOT tsconfig-excluded → type-checks now; pins the exact API the 2.1 scaffold imports. |
| `tests/integration/rls/cross-tenant-isolation.rls.test.ts` | RLS negative (SELECT/INSERT/UPDATE/DELETE × `tenants`,`tenant_memberships`) | `describe.skip` | Dev stack (runner + local Supabase + migration + factories). Data-driven over `TABLES` so Story 2.4 can parameterize. |
| `tests/integration/rls/membership-self-grant.rls.test.ts` | RLS self-grant/escalation + role/status CHECK | `describe.skip` | Dev stack. App-path denial + admin-path CHECK-constraint bite. |
| `tests/integration/rls/security-definer-search-path.rls.test.ts` | INT search-path hijack (AC4/R-006) | `describe.skip` | Dev stack + helpers. Carries the DEFINER-vs-INVOKER decision gate + review-note requirement. |
| `tests/integration/rls/migration-reset.int.test.ts` | INT migration-reset green (AC1/R-007) | `describe.skip` | Dev stack. Introspects objects/CHECKs/RLS-forced/`name` NOT NULL after `supabase db reset`. |
| `tests/integration/rls/factory-isolation.int.test.ts` | INT per-worker isolation (R-012) + 2.1 un-gate marker (AC5) | `describe.skip` | Dev stack + factories. |

**Reused, not recreated:** `tests/integration/server/auth/resolve-tenant-context.int.test.ts` — the
authoritative Story 2.1 DB-backed INT scaffold this story OWNS un-gating (Task 6.6). It already
imports the exact factory API; left untouched here so the dev phase removes ITS `.skip`, points its
import at the now-pinned `tests/factories/tenants`, and makes it GREEN. The `factory-isolation`
suite carries an explicit AC5 un-gate marker so the hand-off is tracked.

**TDD red-phase compliance check (Step 4C validation):**

- [x] All new suites use `describe.skip` — cannot fail CI before the dev stack exists.
- [x] All assertions encode expected behavior — no `expect(true).toBe(true)` placeholders.
- [x] All scaffolds are expected-to-fail (the migration, RLS, helpers, runner, and factories do not
      exist yet).
- [x] Gated DB files clearly marked and kept skipped (not stubbed into a hollow green).
- [x] Each gated guard is uniquely named (no duplicate-implementation collision when the dev phase
      enrolls `tests/integration/**` into one compilation).

**Fixtures:** the authoritative fixtures are NOT implemented here — that is the dev phase's gated
work (local stack + admin/service-role user creation + per-worker isolation, B1/B2/H5). Only the
factory CONTRACT (`tests/factories/tenants.ts`, red-phase stub) is created, to pin the exact export
names/signatures the 2.1 scaffold and the new suites reference, so the dev phase fills in the body
without renaming anything.

---

## Acceptance Criteria Coverage Summary

- **AC1** (migration applies cleanly; tables + helpers created; `role` constrained to `tenant_admin`):
  migration-reset + role/status CHECK scaffolds (gated).
- **AC2** (two-tenant cross-tenant SELECT/INSERT/UPDATE/DELETE denied; no spoofed ownership):
  the cross-tenant RLS negative matrix (gated, data-driven).
- **AC3** (self-grant / self-escalation denied through the app path): membership-self-grant scaffold
  (gated).
- **AC4** (`SECURITY DEFINER` helpers have fixed `search_path` + hijack negative + review note; or
  INVOKER N/A): search-path-hijack scaffold with the decision gate (gated).
- **AC5** (per-worker two-tenant fixture; un-gate the 2.1 INT scaffold and make it GREEN):
  factory-isolation scaffold + the 2.1 un-gate marker; the authoritative 2.1 file is reused
  unchanged for the dev phase to un-skip.
- **AC6** (later stories reuse the helper predicates + factory pattern): the factory contract is
  pinned and the cross-tenant suite is written data-drivable; the forward-compat smoke asserts the
  contract is additive. The standing inventory GATE is Story 2.4's scope, not scaffolded here.

---

## Step 5 — Validation & Completion

**Validation checklist:**

- [x] Prerequisites assessed; runner/stack absence handled per instruction (no HALT, no invented
      runner, no Docker/Supabase stand-up, no migration, no dependency add).
- [x] Test files created in the architecture-aligned tree (`tests/integration/rls/`, `tests/factories/`),
      not scattered in UI modules (architecture §22).
- [x] Checklist maps every AC to a level + priority + risk + current status.
- [x] All tests designed to fail before implementation (red phase) and kept `.skip`.
- [x] No CLI/browser sessions opened (no runner); no orphaned browsers.
- [x] Checklist stored under `{test_artifacts}/` (this file); scaffolds under `tests/`.
- [x] **No `package.json` / `pnpm-lock.yaml` / `src/**` / `tsconfig.json` modified; no
      `supabase/migrations/**` created; no `supabase/` directory created.** Verified.
- [x] Gate sweep on the scaffolds: `pnpm typecheck` clean, `pnpm test` 60/60 green (unchanged
      baseline), `pnpm lint` clean.

**Out of ATDD scope (dev-phase / other-story work — intentionally NOT scaffolded here):**

- The `supabase/` init, `config.toml`, the `tenant_foundation` migration, RLS policies, and the
  helper predicates themselves (gated dev work; story Task 1.1 Stop Condition).
- Installing/wiring Vitest + the CI `supabase db reset` stage (Task 4; gated dependency install).
- The `verify:lockfiles` guard failure-path regression unit test (Task 4.3) — a dev-phase unit test,
  not an acceptance scaffold.
- Tasks 7.1/7.2 surgical resolver edits (transient-error code; `active`-first ordering) — dev-phase
  code changes to `src/`, out of bounds for ATDD.
- The H4 inventory GATE + parameterized inventory suite + built-bundle service-role grep — Story 2.4.

**Key assumptions / risks:**

- **Runner = Vitest** assumed (architecture §18 / test-design Assumptions #5; the `testarch-framework`
  decision is owned by the dev phase). The scaffolds are TS-only and runner-agnostic — the assertions
  are the contract; if the dev phase chooses otherwise, the green-phase import line is the only edit.
- **DEFINER vs INVOKER (AC4/R-006)** is a dev-phase decision. The hijack scaffold is written to cover
  the DEFINER case (load-bearing) AND carries the INVOKER N/A fallback + the mandatory review-note
  gate, so whichever way the dev phase goes, the AC4 evidence requirement is pinned.
- **Factory API is the binding contract.** `createTwoTenantFixture` returns
  `{ tenantA, tenantB, adminA, adminB, orphanUser }`; `makeAuthedServerClient(user)` and
  `makeAnonServerClient()` match the 2.1 scaffold's imports exactly — the dev phase must fill the
  body without renaming.

## Next Steps (TDD Green Phase — Story 2.2 dev)

1. **Gated stand-up:** request approval, then `supabase init` + `tenant_foundation` migration (tables,
   role/status CHECKs, RLS enable+force, helpers with pinned `search_path`), and wire Vitest +
   `supabase db reset` into CI (Tasks 1-4). Pin exact versions.
2. **Implement the factories:** fill `tests/factories/tenants.ts` (per-worker, admin-created users,
   auto-clean), service-role confined to `tests/factories/**`.
3. **Green the scaffolds:** swap `gated…()` guards for real factory/client calls, add the runner
   import, remove `.skip` from the six gated suites, and make them GREEN after `supabase db reset`.
4. **Un-gate the 2.1 INT scaffold (Task 6.6):** un-`.skip` `resolve-tenant-context.int.test.ts`, point
   its factory import at `tests/factories/tenants`, remove `tests/integration/**` from `tsconfig`
   `exclude`, make GREEN; record the hand-off in the Dev Agent Record.
5. **Recommended follow-on workflows:** `*automate` after the schema lands to broaden coverage;
   `*trace` at the Epic 2 boundary for the traceability matrix + gate decision; Story 2.4 generalizes
   the cross-tenant suite into the inventory-gated parameterized harness.

---

**Generated by:** BMad TEA Agent — `bmad-testarch-atdd` (Create mode) · TDD RED PHASE
