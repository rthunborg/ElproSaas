---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-02'
workflowType: testarch-atdd
storyId: 5-1-tenant-owned-calculation-schema-and-server-commands
tddPhase: RED
inputDocuments:
  - _bmad-output/implementation-artifacts/5-1-tenant-owned-calculation-schema-and-server-commands.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - _bmad-output/test-artifacts/atdd-checklist-3-1-tenant-owned-crm-data-model-and-commands.md
  - _bmad/tea/config.yaml
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/rls/migration-reset.int.test.ts
  - tests/integration/commands/crm-customer-commands.int.test.ts
  - tests/integration/commands/crm-parent-ownership.int.test.ts
  - tests/factories/tenants.ts
  - tests/factories/audit-events.ts
  - tests/factories/admin-sql.ts
  - tests/unit/server/commands/crm-validation.test.ts
  - src/server/commands/envelope.ts
  - src/lib/money/ore.ts
  - supabase/migrations/20260630120000_crm_data_model.sql
---

# ATDD Checklist: Story 5.1 — Tenant-Owned Calculation Schema And Server Commands

**Role:** Master Test Architect · **Mode:** Create · **TDD Phase:** RED (failing scaffolds before implementation)
**Generated:** 2026-07-02

---

## Step 1 — Preflight & Context

**Stack detection (`test_stack_type: auto`):** the load-bearing surface of Story 5.1 is the
Postgres schema + RLS layer (`calculations`/`calculation_sections`/`calculation_rows`, direct
`tenant_id`, composite same-tenant parent FKs, own-tenant policies) plus the server-command
envelope + a narrow atomic RPC — a **backend** (database/RLS + server-command) story. There is NO
UI in 5.1 (`nav-items.ts` stays seven; the calc editor is Story 5.2). Per the backend path the ATDD
output is **integration / RLS-negative / migration-reset / pure-validator** scaffolds, NOT Playwright
E2E. The skill's frontend API/E2E subagent split is therefore not applicable; scaffolds were
generated **sequentially and directly** (the documented backend resolution — the same convention
Stories 2.2–3.1 used).

**Prerequisite reality (the gating fact — by design, no HALT):** Story 5.1 inherits a COMPLETE
foundation — Vitest 4.1.9, the local Supabase stack + loopback-gated factories, the command envelope
(`defineCommand`/`runCommand`), the injectable `CommandClock`, the append-only `audit_events` +
`writeAuditEvent` DEFINER, the frozen `@/lib/money` engine (`isOreAmount`/`ORE_AMOUNT_MAX`), the H4
RLS inventory gate, and the `node --test` unit runner all EXIST and are green in `main`. What does
NOT exist yet is the Story 5.1 DEV work: the `calculation_data_model` migration (Task 1), the narrow
atomic RPC (Task 2), the calc server commands + pure validators (Task 3), and the factory calc seed
helpers (Task 4). The ATDD phase therefore does NOT write the migration, the RPC, the commands, or
`src/**`; it writes **failing acceptance scaffolds** that the dev phase un-skips and greens. Every
scaffold here is EXPECTED to be skipped/red until the dev phase lands the migration + RPC + commands.

**Inputs loaded:** the 5.1 story file (AC1–AC7, Tasks 1–6, Open Questions 1–3), `test-design-epic-5.md`
(P0/P1 rows 5.1-INT-01/02/03/04, 5.1-RLS-01/02, 5.1-UNIT-01/02, P1 5.1-INT-05; risks
R-501/R-502/R-503/R-504/R-506/R-511), the Story 3.1 ATDD checklist (the near-identical
backend-schema+command red-phase convention to match), the inherited harness
(`tenant-table-inventory.ts` six-helper metadata + `assertNever` + H4 gate + STANDING CONTRACT), the
existing `migration-reset.int.test.ts` (the exact-policy enumeration Task 6.1 extends), the existing
CRM command + parent-ownership INT scaffolds (the `runCommand`/audit-row/`TENANT_ACCESS_DENIED`
shapes), `crm-validation.test.ts` (the `node --test` pure-validator + `assertRejected`-no-echo
shape), `tenants.ts` + `audit-events.ts` + `admin-sql.ts` factories, `envelope.ts`, `ore.ts` (the
canonical öre authority), `tea/config.yaml`, `20260630120000_crm_data_model.sql` (the
GRANT/RLS/policy/trigger/composite-FK template).

**Knowledge fragments (conceptual, applied):** data-factories (additive B1 calc seed helpers,
per-run unique ids), test-quality (assert-the-mechanism; no vacuous disjunctions; no placeholder
assertions), test-levels-framework (RLS-negative vs INT-command vs migration-reset vs
pure-validator discipline; no duplicate coverage), test-priorities-matrix (P0/P1),
test-healing-patterns. (TEA Playwright-utils fragments are not materially applicable — no browser
surface in this story.)

---

## Step 2 — Generation Mode

**Mode: AI generation** (clear ACs; standard DB/RLS isolation, parent-ownership, constraint,
migration-reset, command-envelope, atomic-rollback, and pure-validator scenarios). Recording mode
**skipped** — backend story, no UI to record. The skill's parallel API/E2E subagent dispatch presumes
a frontend runner + live browser; for this backend/pre-feature story scaffolds were generated
**sequentially and directly** (the documented sequential resolution path), honoring the red-phase
contract.

---

## Step 3 — Test Strategy (AC → level → priority)

Test-level discipline (no duplicate coverage):

- **Cross-tenant + anon SELECT/INSERT/UPDATE/DELETE isolation (AC3/AC4/AC5, 5.1-RLS-01/02)** is NOT a
  new parallel suite — it is carried by ENROLLING `calculations`/`calculation_sections`/
  `calculation_rows` in the SHARED `TENANT_TABLES` inventory (`tenant-table-inventory.ts`) with BOTH
  metadata seams (all six `switch (table)` helpers). The existing data-driven
  `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts` + the H4 gate
  (`rls-inventory-gate.int.test.ts`) then cover the three tables automatically. This enrollment is a
  **DEV-phase** edit (Task 5.1), because the `assertNever` exhaustiveness guard + the live
  `introspectTenantOwnedTables` introspection require the tables to EXIST; doing it in the ATDD phase
  (before the migration lands) would turn the existing green H4 gate + negative suites RED for the
  wrong reason. The ATDD deliverable for these ACs is therefore the **checklist contract + the
  dev-phase enrollment recipe below**, not a duplicated suite.
- **Migration-reset schema proof** (the three tables exist with direct-tenant FKs / composite
  same-tenant FKs incl. the additive `contacts_id_tenant_unique` / row_type + qty>0 + öre CHECKs /
  bigint-öre-not-numeric / RLS forced / SELECT-INSERT-UPDATE-only policies / GRANTs / no-deferred-table
  / no-supplier-scope) is a NEW dedicated INT scaffold (`calc-tables-migration-reset.int.test.ts`).
- **Calc command-envelope** happy/failure/atomic paths (create calc/section/row + audit-row,
  validation matrix, archive-soft-delete, atomic-reorder rollback) are NEW DB-backed INT scaffolds
  under `tests/integration/commands/`.
- **Cross-tenant PARENT-link** command negative is a NEW dedicated INT scaffold
  (`calculation-parent-ownership.int.test.ts`).
- **Pure calc validators** (closed row-type union, qty>0/unit, canonical öre, VAT bp, lifecycle state
  machine, no-echo) are a NEW `node --test` UNIT scaffold — the fast gate on every PR.

| AC | Scenario | Level | Priority | Test ID | Risk | Status here |
| --- | --- | --- | --- | --- | --- | --- |
| AC1 | 3 calc tables exist; direct `tenant_id` NOT NULL FK→tenants ON DELETE CASCADE | INT (migration-reset) | P0 | 5.1-INT-01 | R-501 | **Scaffolded (gated)** |
| AC1 | Composite same-tenant parent FKs (calc→customers/facilities/contacts; section→calc; row→section) + additive `contacts_id_tenant_unique` + calc/section `id_tenant_unique` targets | INT (migration-reset) | P0 | 5.1-INT-01 | R-501,R-502 | **Scaffolded (gated)** |
| AC1 | `row_type` CHECK (closed 5), `quantity > 0`, öre `CHECK >= 0`, bigint-öre (no numeric/double/real) | INT (migration-reset) | P0 | 5.1-INT-01 | R-506 | **Scaffolded (gated)** |
| AC1 | `archived_at` + created_at/updated_at + REUSED `set_updated_at` trigger; `sort_order` on section/row | INT (migration-reset) | P0 | 5.1-INT-01 | R-501 | **Scaffolded (gated)** |
| AC1 | NO deferred job/project/field-worker table created | INT (migration-reset) | P0 | 5.1-INT-01 | R-511 | **Scaffolded (gated)** |
| AC2 | createRow re-validates row_type/qty/unit/öre/VAT → VALIDATION_FAILED; raw value never echoed | INT (command) | P0 | 5.1-INT-04 | R-504 | **Scaffolded (gated)** |
| AC2 | createCalculation/createRow happy-path persists + EXACTLY ONE calc-lifecycle audit row (deterministic clock) | INT (command) | P1 | 5.1-INT-04 | R-501 | **Scaffolded (gated)** |
| AC2 | Pure validators: closed row-type union, qty>0, unit required, canonical öre (float/neg/overflow/locale-comma), VAT bp, lifecycle transition legality, no-echo | UNIT (node --test) | P0 | 5.1-UNIT-01/02 | R-504,R-506 | **Scaffolded (gated)** |
| AC2 | illegal lifecycle transition / unknown status → VALIDATION_FAILED | INT (command) + UNIT | P0 | 5.1-INT-04, 5.1-UNIT-01 | R-504 | **Scaffolded (gated)** |
| AC3 | Tenant-A createCalculation with a Tenant-B customer/facility/contact parent id → TENANT_ACCESS_DENIED; client `tenant_id` ignored | INT (command) | P0 | 5.1-INT-02 | R-502 | **Scaffolded (gated)** |
| AC3 | Cross-tenant SELECT/INSERT/UPDATE/DELETE on each calc table denied (42501 + BYPASSRLS re-read; UPDATE = rls-invisible) | RLS | P0 | 5.1-RLS-01 | R-501 | **Enrollment recipe (dev Task 5.1)** |
| AC4 | H4 gate green; all 3 calc tables enrolled in `TENANT_TABLES` (both seams, six helpers) | INT (gate) | P0 | 5.1-RLS-02 | R-501 | **Enrollment recipe (dev Task 5.1)** |
| AC4 | Per-table GRANTs (authed SELECT/INSERT/UPDATE; service_role DML; anon none) + RLS enable+force + `is_tenant_admin` policies | INT (migration-reset) | P0 | 5.1-INT-01 | R-501 | **Scaffolded (gated)** |
| AC5 | Anon SELECT/INSERT/UPDATE/DELETE on each calc table denied (42501) | RLS | P0 | 5.1-RLS-01 | R-501 | **Enrollment recipe (dev Task 5.1)** |
| AC6 | Atomic multi-row reorder/save: mid-transaction failure rolls back FULLY — no partial order/rows (narrow RPC / server txn) | INT (command) | P0 | 5.1-INT-03 | R-503 | **Scaffolded (gated)** |
| AC7 | archive sets `archived_at` (soft-delete, no hard delete); no DELETE grant/policy | INT (command + migration-reset) | P1/P0 | 5.1-INT-05 | R-501 | **Scaffolded (gated)** |
| AC7 | No supplier/credential/sync/import/external-mapping/API column on any calc table | INT (migration-reset) | P0 | 5.1-INT-01 | R-511 | **Scaffolded (gated)** |
| AC7 | migration-reset exact per-table policy enumeration EXTENDED (no DELETE policy anywhere) | INT (migration-reset) | P0 | 5.1-INT-01 | R-501 | **Extension recipe (dev Task 6.1)** |

**Red-phase requirement confirmed:** every scenario asserts EXPECTED behavior (no
`expect(true).toBe(true)`); every command negative asserts the typed `CommandErrorCode`
(`VALIDATION_FAILED` / `TENANT_ACCESS_DENIED`); every RLS negative asserts the DENIAL MECHANISM
(`42501` + independent BYPASSRLS re-read via the inherited inventory), never a vacuous
empty-set/null disjunction; the atomic-rollback negative asserts the ORDERING IS UNCHANGED via an
independent BYPASSRLS re-read (no partial commit). All scaffolds are designed to FAIL before the
Story 5.1 dev migration + RPC + commands exist, and are kept `describe.skip` / `node --test`
`{ skip }` so they cannot false-red CI before then.

---

## Step 4 / 4C — Generated Scaffolds (RED PHASE)

**Placement (architecture §3/§22):** command scaffolds under `tests/integration/commands/`;
migration-reset scaffold under `tests/integration/rls/`; pure validators under
`tests/unit/server/commands/` — all already enrolled in `typecheck` and the respective runners.
Tests are NOT scattered in UI modules.

**Runner/skip idiom:** the skill's Playwright `test.skip()` red-phase idiom maps to this project's
established `describe.skip(...)` convention for Vitest INT files and the `test(name, { skip }, …)`
option for the `node --test` unit file. Each scaffold imports the EXISTING factories + envelope + öre
authority (so it type-checks today) and declares the not-yet-built calc commands / factory seeds /
validators via a LOCAL `notYetImplemented()` placeholder that THROWS — so a mistakenly un-skipped run
fails loud rather than green-by-accident. The unit placeholder is TYPED as the green-phase validator
surface (so destructured calls type-check) but still throws at call time. The dev phase swaps the
placeholders for real imports and removes the skips.

### Files created

| File | Level | Suite state | Gating |
| --- | --- | --- | --- |
| `tests/integration/rls/calc-tables-migration-reset.int.test.ts` | INT (migration-reset) — tables exist / direct-tenant FK cascade / composite same-tenant FKs + additive `contacts_id_tenant_unique` / row_type+qty+öre CHECKs / bigint-öre-not-numeric / archive+timestamps+trigger+sort_order / RLS forced / SELECT-INSERT-UPDATE-only policies on `is_tenant_admin` / GRANTs / no-deferred-table / no-supplier-scope | `describe.skip` (15 tests) | Dev Task 1 (the `calculation_data_model` migration). |
| `tests/integration/commands/calculation-commands.int.test.ts` | INT (command envelope) — happy-path create calc/section/row + one audit row + deterministic clock; validation matrix (row_type/qty/unit/float-öre/neg-öre/VAT/lifecycle → VALIDATION_FAILED); archive-soft-delete; atomic-reorder rollback | `describe.skip` (14 tests) | Dev Tasks 1–3 + Task 4.1 seeds (`adminInsertCalculation`/`adminInsertSection`/`adminInsertRow`). |
| `tests/integration/commands/calculation-parent-ownership.int.test.ts` | INT (command) — cross-tenant customer/facility/contact PARENT-link + client-`tenant_id`-ignored → TENANT_ACCESS_DENIED (R-502) | `describe.skip` (4 tests) | Dev Tasks 1–3 + Task 4.1 Tenant-B seeds (`adminInsertCustomer`/`adminInsertFacility`/`adminInsertContact`). |
| `tests/unit/server/commands/calc-validation.test.ts` | UNIT (`node --test`) — closed row-type union, qty>0/unit, canonical öre (float/neg/overflow/locale-comma), VAT bp shape, lifecycle transition legality, raw-value-never-echoed | `{ skip }` (16 tests) | Dev Task 3.2 (`calculations/validation.ts` pure validators). |

**Verified state:** `pnpm typecheck` clean; `pnpm lint` clean (the single pre-existing warning is in
the unrelated `tests/unit/lib/money/vat.test.ts`); a targeted Vitest run reports **3 files skipped /
29 tests skipped** (0 failed, 0 errored); the `node --test` unit scaffold reports **16 skipped / 0
fail**. The scaffolds compile and register as red-phase pending without perturbing the green baseline.

### NOT created here (deliberate — see Step 3 rationale)

- **No new cross-tenant or anon RLS suite.** Those are DATA-DRIVEN over the shared `TENANT_TABLES`
  inventory. Enrolling the three calc tables is a DEV-phase edit (Task 5.1), not an ATDD scaffold,
  because the `assertNever` exhaustiveness guard + the live H4 introspection require the tables to
  exist; pre-enrolling now would turn the green H4 gate + negative suites red for the wrong reason.
- **No migration, no atomic RPC, no commands, no validators, no factory seed bodies, no
  `TENANT_TABLES` edit, no `migration-reset.int.test.ts` extension, no `tsconfig`/`.env`/dependency
  change** — all DEV-phase / gated work. `nav-items.ts` untouched (stays seven); `src/lib/money/**`
  untouched (consume, do not edit).

### Dev-phase H4 enrollment recipe (Task 5.1 — pin so the hand-off is mechanical)

In `tests/integration/rls/tenant-table-inventory.ts`:
1. Add `"calculations"`, `"calculation_sections"`, `"calculation_rows"` to `TENANT_TABLES`.
2. Add a matching branch in ALL SIX `switch (table)` helpers — `spoofedRowFor`, `tenantBFilter`,
   `hijackMutationFor` (cross-tenant seam) AND `anonRowFor`, `anonFilterFor`, `anonMutationFor`
   (anon seam). The `assertNever(table)` default makes a missing branch a `pnpm typecheck` error by
   design — enrollment without metadata fails the typecheck.
3. Spoofed/anon INSERT rows use FRESH `crypto.randomUUID()` ids (so denial is the privilege layer
   `42501`, never a `23505` PK collision). The cross-tenant spoof INSERT carries Tenant B's
   `tenant_id` + a parent id pointing at a Tenant B parent (customer for `calculations`; calc for
   `calculation_sections`; section for `calculation_rows`).
4. Because the calc tables GRANT `authenticated → UPDATE`, set `updateDenialKind = "rls-invisible"`
   for all three (the same case the CRM tables use) — the cross-tenant UPDATE denial is
   USING-invisibility (zero rows + BYPASSRLS-unchanged re-read), not a `42501`.
5. The H4 gate (`rls-inventory-gate.int.test.ts`) will FAIL-LOUD on the three new tables the moment
   the migration lands and BEFORE enrollment — that is the EXPECTED "register the table" signal, not
   a bug (esp. the ANON seam — the easiest-to-forget obligation). After steps 1–4 it goes green; the
   data-driven cross-tenant + anon suites then cover the three tables automatically.

### Dev-phase `migration-reset.int.test.ts` extension (Task 6.1 — GUARANTEED break, by design)

The EXISTING `tests/integration/rls/migration-reset.int.test.ts` asserts the COMPLETE `public` policy
set as an EXACT enumeration. The calc SELECT/INSERT/UPDATE policies break it — this WILL fail-loud
when the calc migration lands (the same signal Story 3.1 hit). EXTEND it (do NOT weaken to a loose
superset): add the three calc tables × SELECT/INSERT/UPDATE policies to the expected EXACT set, and
add the three tables to the exists + RLS-enabled-and-forced checks, keeping the "no DELETE policy
anywhere" invariant satisfied (calc tables have none). The new
`calc-tables-migration-reset.int.test.ts` scaffold already pins the calc half of this contract.

**TDD red-phase compliance check (Step 4C validation):**

- [x] All new INT suites use `describe.skip`; the unit tests use `node --test` `{ skip }` — none can
      fail CI before the dev migration + RPC + commands + validators exist.
- [x] All assertions encode expected behavior — no `expect(true).toBe(true)` placeholders.
- [x] All command negatives assert the typed MECHANISM (`VALIDATION_FAILED` / `TENANT_ACCESS_DENIED`);
      the RLS negatives are carried by the inherited `42501` + BYPASSRLS-re-read inventory; the
      atomic-rollback negative asserts the ordering is unchanged via a BYPASSRLS re-read — no vacuous
      empty-set/null disjunction anywhere.
- [x] All scaffolds are expected-to-fail (the migration, the atomic RPC, the calc commands, the
      validators, and the factory calc seeds do not exist yet).
- [x] Each not-yet-built surface is a LOUD `notYetImplemented()` throw, not a hollow green stub; the
      unit placeholder is typed-but-throwing so it neither type-errors nor green-passes.
- [x] `pnpm typecheck` + `pnpm lint` clean; targeted Vitest run = 29 skipped / 0 failed; `node --test`
      unit run = 16 skipped / 0 failed.

---

## Acceptance Criteria Coverage Summary

- **AC1** (3 calc tables; direct `tenant_id` FK cascade; composite same-tenant parent FKs +
  `contacts_id_tenant_unique`; lifecycle/status; ordering; bigint-öre `CHECK >= 0`; qty>0; archive +
  timestamps + reused trigger; NO deferred job/project/field table):
  `calc-tables-migration-reset.int.test.ts` (gated).
- **AC2** (server commands validate membership / CRM parent ownership / row_type / qty+unit / öre via
  canonical `isOreAmount` / VAT bp / lifecycle as typed `Result`; invalid ⇒ `VALIDATION_FAILED`, raw
  value never echoed): `calc-validation.test.ts` pure validators (gated) + `calculation-commands.int.test.ts`
  command-layer validation matrix + happy-path audit row (gated); every command via
  `defineCommand`/`runCommand` (no bespoke mechanism).
- **AC3** (cross-tenant read/write denied + cross-tenant parent link → `TENANT_ACCESS_DENIED`):
  `calculation-parent-ownership.int.test.ts` (gated) for the command parent-link negative +
  client-`tenant_id`-ignored; the read/write RLS denials are covered by the Task-5.1 inventory
  enrollment (recipe above).
- **AC4** (H4 gate green; all 3 enrolled with both seams; per-table GRANTs + RLS forced + helper
  policies): the GRANT/RLS/policy half is in the migration-reset scaffold (gated); the enrollment +
  gate-green half is the Task-5.1 dev recipe (the gate fails-loud until enrolled — the STANDING
  CONTRACT).
- **AC5** (anon SELECT/INSERT/UPDATE/DELETE denied on all three): covered by the anon seam of the
  Task-5.1 inventory enrollment (the easiest-to-forget H4 obligation — pinned in the recipe).
- **AC6** (atomic multi-row reorder/save via narrow RPC — full rollback on mid-transaction failure,
  no partial order/rows): the atomic-reorder-rollback scaffold in `calculation-commands.int.test.ts`
  (gated), asserting the ordering is unchanged via a BYPASSRLS re-read.
- **AC7** (migration-reset proof extended; NO deferred/supplier/credential/sync/import/external field;
  archive via `archived_at` UPDATE, no hard-delete grant/policy): the no-deferred-table +
  no-supplier-scope + no-DELETE-policy + bigint-öre assertions in the migration-reset scaffold + the
  archive-soft-delete assertion in the command scaffold (gated); the exact-policy enumeration
  extension is the Task-6.1 dev recipe (the break is GUARANTEED and pinned above).

---

## Step 5 — Validation & Completion

**Validation checklist:**

- [x] Prerequisites assessed; the inherited foundation (runner/stack/factories/envelope/clock/money
      engine/H4 gate/unit runner) confirmed present — only the Story 5.1 migration + RPC + commands +
      validators + factory seeds are absent, so scaffolds are gated on the dev phase (no HALT, no
      invented runner, no migration written here).
- [x] Test files created in the architecture-aligned tree (`tests/integration/commands/`,
      `tests/integration/rls/`, `tests/unit/server/commands/`), not scattered in UI modules (§22).
- [x] Checklist maps every AC (1–7) to a level + priority + test ID + risk + current status.
- [x] All tests designed to fail before implementation (red phase) and kept skipped.
- [x] No browser/CLI sessions opened (backend story); no orphaned browsers.
- [x] Checklist stored under `{test_artifacts}/` (this file); scaffolds under `tests/`.
- [x] **No migration, no atomic RPC, no `src/**`, no `tsconfig.json`, no `.env`, no dependency, no
      `TENANT_TABLES` edit, no `migration-reset.int.test.ts` extension, no `nav-items.ts` change.**
      Verified — all are DEV-phase/gated.
- [x] Gate sweep on the scaffolds: `pnpm typecheck` clean, `pnpm lint` clean, targeted Vitest run =
      3 files / 29 tests skipped, `node --test` unit = 16 skipped, 0 failed/errored (green baseline
      unperturbed).

**Out of ATDD scope (dev-phase / other-story work — intentionally NOT scaffolded here):**

- The `calculation_data_model` migration, the narrow atomic RPC (ADR-A009), the calc commands + pure
  validators, and the factory calc seed helpers (Story 5.1 dev Tasks 1–4) — the scaffolds' green-phase
  counterparts.
- `TENANT_TABLES` enrollment of the three tables + the six metadata branches + `updateDenialKind`
  (dev Task 5.1; the recipe is pinned above) — must be a dev edit because of the `assertNever`
  typecheck guard + live H4 introspection.
- Extending the existing `migration-reset.int.test.ts` exact-policy enumeration (dev Task 6.1; the
  break is GUARANTEED and the extension is pinned above).
- Calc EDITOR UI/E2E (Story 5.2); pricing-source row snapshot + freeze (Story 5.3); readiness
  classifier + snapshot preview (Story 5.4); the calc golden pack + inclusion goldens (Story 5.5;
  goldens go under `tests/unit/**`, never `tests/golden/**`); the money arithmetic itself (Epic 4
  pinned it — this story asserts routing/validation, not numbers); `tests/e2e/**` browser runner.

**Key assumptions / risks:**

- **Command / input shapes** (`createCalculation({ customer_id, title })`, `createRow({ section_id,
  row_type, quantity, unit, unit_cost_ore, unit_sell_ore, vat_rate_bp })`, `targetType: "calculation"`,
  the `targetId`-carrying result, `archiveCalculation({ id })`, `reorderRows({ section_id,
  ordered_row_ids })`) are the SCAFFOLD'S assumed contract, drawn from architecture §5 (command table
  lists `createCalculation` + `updateCalculationRows`) + the existing CRM command shapes + the story's
  column names. If the dev phase chooses different literals, the assertion strings / input keys are the
  only edit — the behavior contract (one audit row, typed error codes, canonical öre, soft-delete,
  foreign-parent deny, full atomic rollback) is unchanged.
- **Lifecycle `status` set + transitions (Open Question 1)** — the scaffolds assume the conservative
  default `draft → ready → archived` (forward-only + `archived` reachable from any active state), and
  assert that an UNKNOWN status and an illegal transition (`archived → draft`) are rejected. A
  materially different lifecycle that changes the data model is a Stop Condition surfaced to the owner,
  not a silent test rewrite.
- **öre / VAT-bp shape** — the öre reject cases (float/negative/overflow/locale-comma) are pinned to
  the CANONICAL `isOreAmount`/`ORE_AMOUNT_MAX` contract in `@/lib/money/ore.ts` (no fork); `vat_rate_bp`
  is asserted as a required integer basis-points value (`2500` = 25.00%).
- **Section display-mode + row flags (Open Question 2)** and **margin/markup representation (Open
  Question 3)** are deliberately NOT pinned in these scaffolds — this story persists the row inputs;
  the flag/enum names and markup representation are confirmed with the owner at the Epic 5 session and
  are 5.2/5.4/5.5 concerns. No inclusion/total math is scaffolded here (Epic 4 owns the engine).

## Next Steps (TDD Green Phase — Story 5.1 dev)

1. **Land the migration (Task 1):** `supabase/migrations/<ts>_calculation_data_model.sql` per the CRM
   template; ADD `contacts_id_tenant_unique` + calc/section `id_tenant_unique` BEFORE the composite
   FKs; `supabase db reset` from empty must succeed → un-skip `calc-tables-migration-reset.int.test.ts`.
2. **Land the narrow atomic RPC (Task 2)** + the calc commands + pure validators (Task 3) → swap the
   `notYetImplemented()` placeholders for real `@/server/commands/calculations/*` imports, remove the
   skips on `calculation-commands.int.test.ts` + `calculation-parent-ownership.int.test.ts` +
   `calc-validation.test.ts`, make GREEN.
3. **Extend the factories (Task 4.1):** add `adminInsertCalculation`/`adminInsertSection`/
   `adminInsertRow` (+ a calc BYPASSRLS read helper) → replace the `seedTenantA*`/`seedTenantB*`
   placeholders.
4. **Enroll in the H4 inventory (Task 5.1):** add the three tables + the six metadata branches +
   `updateDenialKind = "rls-invisible"` to `tenant-table-inventory.ts` (recipe above) → the H4 gate +
   cross-tenant + anon suites go green for the three tables automatically (the gate fails-loud until
   enrolled — expected, esp. the anon seam).
5. **Extend `migration-reset.int.test.ts` (Task 6.1):** add the calc policies to the EXACT enumeration
   + the three tables to the exists/RLS checks (the GUARANTEED break).
6. **Recommended follow-on workflows:** `*automate` after the schema + commands land to broaden
   coverage; `*trace` at the Epic 5 boundary for the traceability matrix + gate decision (and surface
   the two standing NFR concerns — dependency-scan gate + coverage reporter — as schedule-or-accept).

---

**Generated by:** BMad TEA Agent — `bmad-testarch-atdd` (Create mode) · TDD RED PHASE
