---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-06-30'
workflowType: testarch-atdd
storyId: 3-1-tenant-owned-crm-data-model-and-commands
tddPhase: RED
inputDocuments:
  - _bmad-output/implementation-artifacts/3-1-tenant-owned-crm-data-model-and-commands.md
  - _bmad-output/test-artifacts/test-design-epic-3.md
  - _bmad-output/test-artifacts/atdd-checklist-2-2-tenant-membership-schema-rls-helpers-and-two-tenant-fixtures.md
  - _bmad/tea/config.yaml
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/rls/cross-tenant-isolation.rls.test.ts
  - tests/integration/rls/anon-path-isolation.rls.test.ts
  - tests/integration/rls/migration-reset.int.test.ts
  - tests/integration/commands/envelope-audit-write.int.test.ts
  - tests/factories/tenants.ts
  - tests/factories/audit-events.ts
  - src/server/commands/envelope.ts
  - src/server/commands/command-errors.ts
  - supabase/migrations/20260625122433_tenant_foundation.sql
---

# ATDD Checklist: Story 3.1 — Tenant-Owned CRM Data Model And Commands

**Role:** Master Test Architect · **Mode:** Create · **TDD Phase:** RED (failing scaffolds before implementation)
**Generated:** 2026-06-30

---

## Step 1 — Preflight & Context

**Stack detection (`test_stack_type: auto`):** the load-bearing surface of Story 3.1 is the
Postgres schema + RLS layer (`customers`/`facilities`/`contacts`, composite same-tenant FKs,
own-tenant policies) exercised through the Supabase client + the server-command envelope — a
**backend** (database/RLS + server-command) story. There is NO UI in 3.1 (`nav-items.ts` stays
seven; CRM UX is Story 3.2). Per the backend path the ATDD output is **integration / RLS-negative /
migration-reset** scaffolds, NOT Playwright E2E. The skill's frontend API/E2E subagent split is
therefore not applicable; scaffolds were generated **sequentially and directly** (the documented
backend resolution, matching the Story 2.2/2.3/2.4 ATDD convention).

**Prerequisite reality (the gating fact — by design, no HALT):** unlike Story 2.2 (which had no
runner and no stack), Story 3.1 inherits a COMPLETE foundation — Vitest 4.1.9, the local Supabase
stack, the two-tenant factories, the command envelope (`defineCommand`/`runCommand`), the
append-only `audit_events` + `writeAuditEvent` DEFINER, and the H4 RLS inventory gate all EXIST and
are green in `main`. What does NOT exist yet is the Story 3.1 DEV work: the `crm_data_model`
migration (Task 1), the nine CRM commands (Task 2), and the factory CRM seed helpers (Task 3). The
ATDD phase therefore does NOT write the migration, the commands, or `src/**`; it writes
**failing acceptance scaffolds** that the dev phase un-skips and greens. Every scaffold here is
EXPECTED to be skipped/red until the dev phase lands the migration + commands.

**Inputs loaded:** the 3.1 story file (AC1-AC7, Tasks 1-5), `test-design-epic-3.md` (P0/P1 tables +
risks R-001/R-002/R-005/R-006/R-009/R-010), the Story 2.2 ATDD checklist (red-phase convention to
match), the authoritative inherited harness (`tenant-table-inventory.ts` with the six metadata
helpers + `assertNever` + the H4 gate + the STANDING CONTRACT), the existing cross-tenant + anon
negative suites (the data-driven pattern the three CRM tables enroll into), the existing
`migration-reset.int.test.ts` (the exact-policy enumeration Task 5.2 mandates extending), an existing
command INT test (`envelope-audit-write.int.test.ts` — the `runCommand`/audit-row assertion shape),
`tenants.ts` + `audit-events.ts` factories (the additive B1 seed pattern), `envelope.ts` +
`command-errors.ts` (the command authority surface + the stable `CommandErrorCode` union),
`tenant_foundation.sql` (the GRANT/RLS/policy/trigger template), `tea/config.yaml`.

**Knowledge fragments (conceptual, applied):** data-factories (additive B1 CRM seed helpers,
per-run unique ids), test-quality (assert-the-mechanism; no vacuous disjunctions; no placeholder
assertions), test-levels-framework (RLS-negative vs INT-command vs migration-reset discipline; no
duplicate coverage), test-priorities-matrix (P0/P1), test-healing-patterns. (TEA Playwright-utils
fragments are not materially applicable — no browser surface in this story.)

---

## Step 2 — Generation Mode

**Mode: AI generation** (clear ACs; standard DB/RLS isolation, parent-ownership, constraint,
migration-reset, and command-envelope scenarios). Recording mode **skipped** — backend story, no UI
to record. The skill's parallel API/E2E subagent dispatch presumes a frontend runner + live browser;
for this backend/pre-feature story scaffolds were generated **sequentially and directly** (the
documented sequential resolution path), honoring the red-phase contract.

---

## Step 3 — Test Strategy (AC → level → priority)

Test-level discipline (no duplicate coverage):
- **Cross-tenant + anon SELECT/INSERT/UPDATE/DELETE** isolation is NOT a new parallel suite — it is
  carried by ENROLLING `customers`/`facilities`/`contacts` in the SHARED `TENANT_TABLES` inventory
  (`tenant-table-inventory.ts`) with BOTH metadata seams. The existing data-driven
  `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts` + the H4 gate then cover
  the three tables automatically. This enrollment is a **DEV-phase** edit (Task 4.1), because the
  `assertNever` exhaustiveness guard + the live introspection require the tables to EXIST; doing it
  in the ATDD phase (before the migration lands) would turn the existing green H4 gate + negative
  suites RED for the wrong reason. The ATDD deliverable for AC4/AC5/AC6 is therefore the **checklist
  contract + the dev-phase enrollment recipe below**, not a duplicated suite.
- **Migration-reset schema proof** (the three tables exist with FKs / composite same-tenant FKs /
  CHECKs / RLS forced / policies / GRANTs / no-supplier-scope / personnummer-only-on-customers) is a
  NEW dedicated INT scaffold (`crm-tables-migration-reset.int.test.ts`).
- **CRM command-envelope** happy/failure paths (create/update/archive, validation, audit-row,
  archive-soft-delete, cross-tenant parent link) are NEW DB-backed INT scaffolds under
  `tests/integration/commands/`.

| AC | Scenario | Level | Priority | Risk | Status here |
| --- | --- | --- | --- | --- | --- |
| AC1 | `customers`/`facilities`/`contacts` exist; `tenant_id` NOT NULL FK→tenants ON DELETE CASCADE | INT (migration-reset) | P0 | R-001 | **Scaffolded (gated)** |
| AC1 | Composite same-tenant parent FKs: facilities(customer_id,tenant_id)→customers; contacts→customers + optional→facilities | INT (migration-reset) | P0 | R-002 | **Scaffolded (gated)** |
| AC1 | Soft-delete `archived_at` + created_at/updated_at + `set_updated_at` trigger per table | INT (migration-reset) | P0 | R-001 | **Scaffolded (gated)** |
| AC2 | `customer_type` CHECK ∈ (private,company,brf,public) + identifier-by-type CHECK | INT (migration-reset) | P0 | R-009 | **Scaffolded (gated)** |
| AC2 | `private` ⇒ personnummer present & org_nr absent; non-`private` ⇒ org_nr present & personnummer absent | INT (command) | P0 | R-009 | **Scaffolded (gated)** |
| AC2 | personnummer exists ONLY on `customers` (not facilities/contacts) | INT (migration-reset) | P0 | R-009 | **Scaffolded (gated)** |
| AC3 | createCustomer happy-path → persisted row + EXACTLY ONE audit row, all snake_case cols correct | INT (command) | P1 | R-001,R-010 | **Scaffolded (gated)** |
| AC3 | Deterministic command timestamp (injected clock), audit `created_at` == the single instant | INT (command) | P1 | R-010 | **Scaffolded (gated)** |
| AC3 | Audit metadata carries NO PII (personnummer/org_nr/name/email) | INT (command) | P1 | R-010 | **Scaffolded (gated)** |
| AC3 | VALIDATION_FAILED for bad customer_type / missing-or-mismatched identifier / bad email / empty name | INT (command) | P0/P1 | R-001 | **Scaffolded (gated)** |
| AC3 | archiveCustomer sets `archived_at` (soft-delete, NOT hard delete) | INT (command) | P1 | R-001 | **Scaffolded (gated)** |
| AC4 | Tenant-A createFacility/createContact with a Tenant-B parent id → TENANT_ACCESS_DENIED | INT (command) | P0 | R-002 | **Scaffolded (gated)** |
| AC4 | Cross-tenant facility_id link rejected (composite same-tenant FK / VALIDATION_FAILED) | INT (command) | P0 | R-002 | **Scaffolded (gated)** |
| AC4 | Client-supplied `tenant_id` ignored — resolved-tenant authority | INT (command) | P0 | R-002 | **Scaffolded (gated)** |
| AC4 | Cross-tenant SELECT/INSERT/UPDATE/DELETE on each CRM table denied (42501 + BYPASSRLS re-read) | RLS | P0 | R-001 | **Enrollment recipe (dev Task 4.1)** |
| AC5 | H4 gate green; all three CRM tables enrolled in `TENANT_TABLES` (both seams) | INT (gate) | P0 | R-005 | **Enrollment recipe (dev Task 4.1)** |
| AC5 | Per-table GRANTs (authed SELECT/INSERT/UPDATE; service_role DML; anon none) + RLS forced + policies | INT (migration-reset) | P0 | R-001 | **Scaffolded (gated)** |
| AC6 | Anon SELECT/INSERT/UPDATE/DELETE on each CRM table denied (42501) | RLS | P0 | R-001 | **Enrollment recipe (dev Task 4.1)** |
| AC7 | No supplier/credential/sync/import/external-mapping column on any CRM table | INT (migration-reset) | P0 | R-007 | **Scaffolded (gated)** |

**Red-phase requirement confirmed:** every scenario asserts EXPECTED behavior (no
`expect(true).toBe(true)`); every negative asserts the DENIAL MECHANISM (typed `CommandErrorCode`
for commands; `42501` + independent BYPASSRLS re-read for RLS — inherited from the data-driven
inventory), never a vacuous empty-set/null disjunction. All scaffolds are designed to FAIL before
the Story 3.1 dev migration + commands exist, and are kept `describe.skip` so they cannot false-red
CI before then.

---

## Step 4 / 4C — Generated Scaffolds (RED PHASE)

**Placement (architecture §3/§22):** command scaffolds under `tests/integration/commands/`;
migration-reset scaffold under `tests/integration/rls/` — both already enrolled in `typecheck` and
the Vitest INT runner. Tests are NOT scattered in UI modules.

**Runner/skip idiom:** the skill's Playwright `test.skip()` red-phase idiom maps to this project's
established `describe.skip(...)` convention. Each scaffold imports the EXISTING factories + envelope
(so it type-checks today) and declares the not-yet-built CRM commands / factory seeds via a LOCAL
`notYetImplemented()` placeholder that THROWS — so a mistakenly un-skipped run fails loud rather than
green-by-accident. The dev phase swaps the placeholders for real imports and removes `.skip`.

### Files created

| File | Level | Suite state | Gating |
| --- | --- | --- | --- |
| `tests/integration/commands/crm-customer-commands.int.test.ts` | INT (command envelope) — happy-path + audit-row + validation matrix + archive-soft-delete + foreign-id deny | `describe.skip` (9 tests) | Dev Tasks 1-2 (migration + commands) + Task 3.1 (`adminSelectCustomerById` read helper). |
| `tests/integration/commands/crm-parent-ownership.int.test.ts` | INT (command) — cross-tenant PARENT-link → TENANT_ACCESS_DENIED (R-002) | `describe.skip` (4 tests) | Dev Tasks 1-2 + Task 3.1 (`adminInsertCustomer`/`adminInsertFacility` Tenant-B seeds). |
| `tests/integration/rls/crm-tables-migration-reset.int.test.ts` | INT (migration-reset) — tables/FKs/composite-FKs/CHECKs/RLS-forced/policies/GRANTs/no-supplier-scope/personnummer-only-on-customers | `describe.skip` (10 tests) | Dev Task 1 (the `crm_data_model` migration). |

**Verified state:** `pnpm typecheck` clean, `pnpm lint` clean, and a targeted Vitest run reports
**3 files skipped / 23 tests skipped** (0 failed, 0 errored) — the scaffolds compile and register as
red-phase pending without perturbing the green baseline.

### NOT created here (deliberate — see Step 3 rationale)

- **No new cross-tenant or anon RLS suite.** Those are DATA-DRIVEN over the shared `TENANT_TABLES`
  inventory. Enrolling the three CRM tables is a DEV-phase edit (Task 4.1), not an ATDD scaffold,
  because the `assertNever` exhaustiveness guard + the live H4 introspection require the tables to
  exist; pre-enrolling now would turn the green H4 gate + negative suites red for the wrong reason.
- **No migration, no commands, no factory bodies, no `TENANT_TABLES` edit, no `tsconfig`/`.env`/
  dependency change** — all DEV-phase / gated work. `nav-items.ts` untouched (stays seven).

### Dev-phase enrollment recipe (Task 4.1 — pin so the hand-off is mechanical)

In `tests/integration/rls/tenant-table-inventory.ts`:
1. Add `"customers"`, `"facilities"`, `"contacts"` to `TENANT_TABLES`.
2. Add a matching branch in ALL SIX `switch (table)` helpers — `spoofedRowFor`, `tenantBFilter`,
   `hijackMutationFor` (cross-tenant seam) AND `anonRowFor`, `anonFilterFor`, `anonMutationFor`
   (anon seam). The `assertNever(table)` default makes a missing branch a `pnpm typecheck` error by
   design — enrollment without metadata fails the typecheck.
3. Spoofed/anon INSERT rows use FRESH `crypto.randomUUID()` ids (so denial is the privilege layer
   `42501`, never a `23505` PK collision). For `facilities`/`contacts`, the spoofed cross-tenant
   INSERT carries Tenant B's `tenant_id` + a parent id pointing at a Tenant B parent.
4. The H4 gate (`rls-inventory-gate.int.test.ts`) will FAIL-LOUD on the three new tables the moment
   the migration lands and BEFORE enrollment — that is the EXPECTED "register the table" signal, not
   a bug. After step 1-3 it goes green; the data-driven cross-tenant + anon suites then cover the
   three tables automatically.

### Dev-phase `migration-reset.int.test.ts` extension (Task 5.2 — GUARANTEED break, by design)

The EXISTING `tests/integration/rls/migration-reset.int.test.ts` (lines ~112-130) asserts the
COMPLETE `public` policy set is EXACTLY `["audit_events.SELECT","tenant_memberships.SELECT",
"tenants.SELECT"]` AND that EVERY policy is SELECT. The CRM INSERT/UPDATE policies break BOTH halves
— this WILL fail-loud when CRM lands. EXTEND it (do NOT weaken to a loose superset): add the CRM
SELECT/INSERT/UPDATE policies to the expected EXACT enumeration, REPLACE the blanket "every policy
is SELECT" invariant with a per-table expectation, and add `customers`/`facilities`/`contacts` to
the exists + RLS-enabled-and-forced checks. The new `crm-tables-migration-reset.int.test.ts`
scaffold already pins the CRM half of this contract.

**TDD red-phase compliance check (Step 4C validation):**

- [x] All new suites use `describe.skip` — cannot fail CI before the dev migration + commands exist.
- [x] All assertions encode expected behavior — no `expect(true).toBe(true)` placeholders.
- [x] All negatives assert the MECHANISM (typed `CommandErrorCode`; or `42501` + BYPASSRLS re-read
      via the inherited inventory) — no vacuous empty-set/null disjunction.
- [x] All scaffolds are expected-to-fail (the migration, the nine commands, and the factory CRM
      seeds do not exist yet).
- [x] Each not-yet-built surface is a LOUD `notYetImplemented()` throw, not a hollow green stub.
- [x] `pnpm typecheck` + `pnpm lint` clean; targeted Vitest run = 23 skipped / 0 failed.

---

## Acceptance Criteria Coverage Summary

- **AC1** (CRM tables exist; direct `tenant_id` FK cascade; archive col; timestamps + trigger;
  composite same-tenant parent FKs): `crm-tables-migration-reset.int.test.ts` (gated).
- **AC2** (4 customer types; identifier-by-type; personnummer for `private`, access-controlled,
  customers-only): migration-reset CHECK + personnummer-placement scaffolds + the command-layer
  identifier-requiredness validation scaffolds (gated).
- **AC3** (nine commands via the envelope; validate; parent ownership; audit on critical changes):
  `crm-customer-commands.int.test.ts` happy-path + audit-row + validation matrix + archive
  (gated); no command invents its own mechanism (all via `defineCommand`/`runCommand`).
- **AC4** (cross-tenant read/write denied + cross-tenant parent link → TENANT_ACCESS_DENIED):
  `crm-parent-ownership.int.test.ts` (gated) for the command parent-link negative; the
  read/write RLS denials are covered by the Task-4.1 inventory enrollment (recipe above).
- **AC5** (H4 gate green; all three enrolled with both seams; per-table GRANTs + RLS forced + helper
  policies): the GRANT/RLS/policy half is in the migration-reset scaffold (gated); the
  enrollment + gate-green half is the Task-4.1 dev recipe (the gate fails-loud until enrolled — the
  STANDING CONTRACT).
- **AC6** (anon SELECT/INSERT/UPDATE/DELETE denied on all three): covered by the anon seam of the
  Task-4.1 inventory enrollment (the easiest-to-forget H4 obligation — pinned in the recipe).
- **AC7** (no deferred-module/supplier/credential/sync/import/external-mapping field; integer-öre if
  money — none here): the no-supplier-scope + personnummer-placement assertions in the migration-
  reset scaffold (gated).

---

## Step 5 — Validation & Completion

**Validation checklist:**

- [x] Prerequisites assessed; the inherited foundation (runner/stack/factories/envelope/H4 gate)
      confirmed present — only the Story 3.1 migration + commands + factory seeds are absent, so
      scaffolds are gated on the dev phase (no HALT, no invented runner, no migration written here).
- [x] Test files created in the architecture-aligned tree (`tests/integration/commands/`,
      `tests/integration/rls/`), not scattered in UI modules (architecture §22).
- [x] Checklist maps every AC (1-7) to a level + priority + risk + current status.
- [x] All tests designed to fail before implementation (red phase) and kept `describe.skip`.
- [x] No browser/CLI sessions opened (backend story); no orphaned browsers.
- [x] Checklist stored under `{test_artifacts}/` (this file); scaffolds under `tests/`.
- [x] **No migration, no `src/**`, no `tsconfig.json`, no `.env`, no dependency, no
      `TENANT_TABLES` edit, no `nav-items.ts` change.** Verified — all are DEV-phase/gated.
- [x] Gate sweep on the scaffolds: `pnpm typecheck` clean, `pnpm lint` clean, targeted Vitest run
      = 3 files / 23 tests skipped, 0 failed/errored (green baseline unperturbed).

**Out of ATDD scope (dev-phase / other-story work — intentionally NOT scaffolded here):**

- The `crm_data_model` migration, the nine CRM commands, and the factory CRM seed helpers (Story 3.1
  dev Tasks 1-3) — the scaffolds' green-phase counterparts.
- `TENANT_TABLES` enrollment of the three tables + the six metadata branches (dev Task 4.1; the
  recipe is pinned above) — must be a dev edit because of the `assertNever` typecheck guard + live
  H4 introspection.
- Extending the existing `migration-reset.int.test.ts` exact-policy enumeration (dev Task 5.2; the
  break is GUARANTEED and the extension is pinned above).
- CRM UI/route tests (Story 3.2); money/VAT/snapshot tests (Epics 4-6, Story 3.5); quote-terms/
  sign-off tests (Story 3.3); settings/pricing tables (Stories 3.3/3.4); `tests/e2e/**` browser
  runner.

**Key assumptions / risks:**

- **Command names / shapes** (`customer.create`/`customer.created`/`target_type: "customer"`, the
  `targetId`-carrying result, `archiveCustomer` taking `{ id }`) are the SCAFFOLD'S assumed contract,
  drawn from the architecture §5 command table + the existing `envelope-audit-write.int.test.ts`
  shape. If the dev phase chooses different literals, the assertion strings are the only edit — the
  behavior contract (one audit row, typed error codes, soft-delete, foreign-id deny) is unchanged.
- **Identifier-by-type split**: the migration carries the table CHECK (private⇒no org_nr;
  non-private⇒no personnummer); REQUIREDNESS (private⇒personnummer present) is COMMAND-layer
  (owner: configurable business rule). The scaffolds assert requiredness at the command level
  accordingly.
- **Customer-type list + no-enforced-primary-contact** are owner-decided defaults pending final
  sign-off (epic-3 retro Open Question). The scaffolds assert the conservative 4-type model; a
  material change would be a stop-condition surfaced to the owner, not a silent test rewrite.

## Next Steps (TDD Green Phase — Story 3.1 dev)

1. **Land the migration (Task 1):** `supabase/migrations/<ts>_crm_data_model.sql` per the template;
   `supabase db reset` from empty must succeed → un-skip `crm-tables-migration-reset.int.test.ts`.
2. **Enroll in the H4 inventory (Task 4.1):** add the three tables + the six metadata branches to
   `tenant-table-inventory.ts` (recipe above) → the H4 gate + cross-tenant + anon suites go green for
   the three tables automatically (the gate fails-loud until enrolled — expected).
3. **Extend `migration-reset.int.test.ts` (Task 5.2):** add the CRM policies to the EXACT
   enumeration + the three tables to the exists/RLS checks; replace the "every policy is SELECT"
   invariant (the GUARANTEED break).
4. **Implement the nine commands (Task 2) + factory seeds (Task 3.1):** then swap the
   `notYetImplemented()` placeholders for real `@/server/commands/crm/*` + `adminInsertCustomer`/
   `adminInsertFacility`/`adminSelectCustomerById` imports, remove `.skip`, make GREEN.
5. **Recommended follow-on workflows:** `*automate` after the schema lands to broaden coverage;
   `*trace` at the Epic 3 boundary for the traceability matrix + gate decision.

---

**Generated by:** BMad TEA Agent — `bmad-testarch-atdd` (Create mode) · TDD RED PHASE
