---
title: 'Prerequisite: Integration Gate Privilege Baseline and Local Reliability'
type: 'bugfix'
created: '2026-10-02'
status: 'blocked'
review_loop_iteration: 0
baseline_commit: '63f223614d3caa59fec0bb292d919f383b9a378d'
context:
  - '_bmad-output/project-context.md'
  - 'docs/process/review-order.md'
  - 'docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md'
---

<frozen-after-approval reason="owner approval recorded in ADR-B012 on 2026-10-02">

## Intent

**Problem:** The required local integration/RLS gate is blocked by inherited effective table privileges beyond checked command boundaries, including confirmed quote-follow-up, CRM, and audit defects plus the documented active tenant-table ACL/RLS inventory, and a suspected parallel-file Auth-readiness failure despite a healthy retained stack. The latest corrected-target run recorded 1,081 passed, 156 failed, and 1 skipped across 124 files.

**Approach:** Establish each confirmed path's intended effective ACL with narrow forward migrations and prove it through effective privilege and direct-RLS assertions. Establish whether file parallelism causes the reliability failure with one bounded serial full-gate run; if proven, use the shared Vitest configuration to serialize files while retaining all suites and in-file behavior.

## Boundaries & Constraints

**Always:** For each verified path, preserve only its intended authenticated tenant-scoped reads and checked writes; deny unauthorized anonymous and direct DML; retain service-role DML and checked/audited command wrappers. Execute only against the verified loopback API and database with private child-process configuration. Keep every integration test enabled and preserve `SUPABASE_TEST_REQUIRED=1` hard-failure semantics.

**Ask First:** Stop and ask if a failure requires changing RLS policies, function authorization, service-role grants, test assertions, CI capacity policy beyond file serialization, or a database reset/ledger action.

**Never:** Do not edit applied migrations, repair migration history, reset data, call hosted services, introduce public flags, change Story 14.1 acceptance status, weaken ACL/RLS expectations, or use a broad schema snapshot.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Effective ACL | Existing `PUBLIC` or bootstrap grant on a confirmed path | Only documented direct access remains; anonymous and direct DML are denied where wrappers own writes | Forward migration is additive and preserves wrappers/RLS |
| Local gate | Healthy loopback stack with cross-file contention | Serial file execution completes the same complete required suite | If failures persist, retain evidence and diagnose the concrete category |
| Target failure | Missing or incorrect private local target | Required run fails rather than silently skipping or calling hosted services | Stop before changing product or security policy |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260719130000_quote_follow_ups.sql:99` — original bootstrap grants authenticated direct write access while enabling/forcing RLS.
- `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql:2007` — later command migration revokes only authenticated insert/update and leaves effective inherited ACLs incomplete.
- `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts:160` — quote-follow-up ACL expectation now needs effective inherited-privilege coverage.
- `tests/integration/rls/crm-tables-migration-reset.int.test.ts:222` — authenticated CRM effective DELETE classification requiring caller/RLS provenance before repair.
- `tests/integration/commands/audit-anon-isolation.int.test.ts:46` — anonymous audit SELECT classification requiring intended public/read-path verification before repair.
- `tests/integration/rls/quote-follow-ups.rls.test.ts:75` — direct own/cross-tenant write negatives that must remain denied.
- `tests/integration/rls/tenant-table-inventory.ts:1619` — shared anon direct-mutation denial for this tenant table.
- `tests/support/test-env.ts:103` — independent two-second Auth reachability probe used by DB suites.
- `vitest.config.ts:38` — shared cross-file parallelism setting for the required gate.
- `docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md` — owner approval and fixed security/reliability boundary.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/` — created CLI-generated forward migrations that revoke table privileges from `PUBLIC`, `anon`, and `authenticated`, then grant `authenticated` select-only access for the confirmed quote-follow-up, CRM, and audit paths; retained service-role and function authorization.
- [x] `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts` — asserts the complete effective table-privilege matrix with `has_table_privilege` and preserves direct-denial coverage.
- [x] `tests/integration/rls/crm-tables-migration-reset.int.test.ts` and `tests/integration/commands/audit-anon-isolation.int.test.ts` — assert the complete effective table-privilege matrix with `has_table_privilege` for the confirmed CRM and audit paths.
- [x] `vitest.config.ts` — retained file parallelism because the bounded serial required gate did not prove it resolves the observed failure category.
- [x] `docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md` — records the exact applied repairs and evidence limits without changing Story 14.1 results.

**Acceptance Criteria:**
- Given a documented active tenant-table access contract and a confirmed inherited excess grant, when its forward migration applies, then only documented direct access remains and unauthorized anon/direct DML is denied while existing RLS, downstream validators, and wrappers continue to authorize intended commands.
- Given the verified local loopback stack, when the required integration gate runs with `SUPABASE_TEST_REQUIRED=1`, then every included test executes against that target with recorded passed, failed, and skipped counts.
- Given a serial full gate proves the parallel failure mode, when the shared runner executes future gates, then test files do not run concurrently and no test is removed, skipped, or weakened.

## Spec Change Log

## Design Notes

ACL repairs are forward-only because production authorization must be correct on already-migrated databases. The owner expanded this task after serial classification confirmed CRM and audit effective-ACL defects; each remains individually provenance-checked rather than receiving a blanket revoke. Revoking from `PUBLIC` is required before granting the narrow authenticated read capability; inspecting effective privileges prevents the test from missing inherited grants. File serialization is conditional on evidence so the repair does not treat a performance preference as a security or product change.

## Verification

**Commands:**
- `supabase --version` and `supabase migration --help` — passed with CLI `2.115.0`; generated `20261002121425_quote_follow_ups_privilege_baseline.sql`.
- SQL-only loopback `supabase db push --include-seed --skip-vault --yes` — passed; applied only the forward ACL migration, with seed files already current and no reset or ledger repair.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts --no-file-parallelism` — passed: 1 file, 10 passed, 0 failed, 0 skipped.
- SQL-only loopback `supabase db push --include-seed --skip-vault --yes` — passed again; applied only `20261002122535_crm_and_audit_privilege_baseline.sql`, with seed files already current and no reset or ledger repair.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/rls/crm-tables-migration-reset.int.test.ts tests/integration/commands/audit-anon-isolation.int.test.ts --no-file-parallelism` — passed: 2 files, 14 passed, 0 failed, 0 skipped.
- `SUPABASE_TEST_REQUIRED=1 node_modules/.bin/vitest.cmd run --no-file-parallelism tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts tests/integration/rls/crm-tables-migration-reset.int.test.ts tests/integration/commands/audit-anon-isolation.int.test.ts` — passed after the complete-privilege matrix repair: 3 files, 24 passed, 0 failed, 0 skipped.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- --no-file-parallelism --reporter=json --outputFile <private-temp-path>` — completed with exit 1: 106 passed, 17 failed, and 1 skipped files; 1,116 passed, 122 failed, and 1 skipped tests. pnpm forwarded a literal `--`, so neither file serialization nor reporter output was proven for this run. It remains corrected-target full-gate evidence only. The retained skip is the isolated recovery physical-loader proof, gated by `ISOLATED_RECOVERY_STORAGE_PROOF=1`, and is unrelated to required DB/RLS coverage.
- Direct installed Vitest with `--no-file-parallelism --reporter=json --outputFile <private-temp-path>` — exit 1 with persisted output. `testResults.length` was 124: 112 passed and 12 failed files, with no skipped file status. Assertion totals were 1,126 passed, 112 failed, and 1 skipped (1,239 total). The preserved skip is `recovery-storage-immutability.int.test.ts`, gated by `ISOLATED_RECOVERY_STORAGE_PROOF=1`; it is isolated recovery infrastructure proof, not required DB/RLS coverage.
- Read-only loopback catalog provenance for the 22 proposal-only tables and two helpers — 44 authenticated/service-role table ACL entries and 4 function ACL entries were direct, with no gaps; removing `PUBLIC` would not require replacement grants. The proposal remains unapplied after automatic-approval rejection.
- `pnpm run typecheck` and `git diff --check` — passed.

## Suggested Review Order

Author: prerequisite implementation author.
Refreshed against the final working tree based on `63f223614d3caa59fec0bb292d919f383b9a378d`.

### Effective quote-follow-up privilege boundary

ADR-B012 records the required forward-only repair: remove all inherited table access, then restore the authenticated read path while leaving service-role DML and checked wrappers intact.

- `supabase/migrations/20261002121425_quote_follow_ups_privilege_baseline.sql:5` — `revoke all privileges`: removes direct and inherited table privileges from `PUBLIC`, `anon`, and `authenticated`.
- `supabase/migrations/20261002121425_quote_follow_ups_privilege_baseline.sql:6` — `grant select`: restores authenticated tenant reads only.
- `docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md:25` — `forward migration`: records the unchanged service-role, RLS, wrapper, and function boundaries.

### CRM and audit effective privilege boundaries

The CRM audited wrappers own each mutation after the earlier direct INSERT/UPDATE revocation, and audit writes remain confined to the authenticated-only `record_audit_event` path. The second forward migration removes only their confirmed residual effective table access and restores authenticated reads.

- `supabase/migrations/20261002122535_crm_and_audit_privilege_baseline.sql:5` — `revoke all privileges`: removes CRM inherited/direct access before restoring read access.
- `supabase/migrations/20261002122535_crm_and_audit_privilege_baseline.sql:9` — `revoke all privileges`: removes anonymous and direct audit table access while leaving the audit wrapper intact.
- `tests/integration/rls/crm-tables-migration-reset.int.test.ts:209` — `effective ACL`: AC1 asserts all seven PostgreSQL table privileges for CRM paths.
- `tests/integration/commands/audit-anon-isolation.int.test.ts:42` — `effective ACL`: AC1 asserts all seven PostgreSQL table privileges for audit paths.

### Effective privilege and direct-mutation evidence

The migration-reset assertion checks PostgreSQL's effective privileges so a `PUBLIC` grant cannot hide outside the role-grant view; the existing focused RLS suite continues to exercise the direct command bypass boundary.

- `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts:160` — `effective ACL`: AC1 asserts authenticated SELECT-only and denial of all six remaining PostgreSQL table privileges.
- `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts:166` — `has_table_privilege`: AC1 includes inherited `PUBLIC` privileges in each effective ACL result.
- `tests/integration/rls/quote-follow-ups.rls.test.ts:90` — `OWN-TENANT authenticated raw UPDATE`: AC1 retains direct authenticated DML denial before the audit transaction.

### Verification and runner decision

The applied migrations and focused proofs are current run evidence. The corrected-target full gate did not establish that cross-file concurrency is the reliability cause because its serialization flag was not honored, so the shared runner configuration remains unchanged.

- `tests/integration/ops/recovery-storage-immutability.int.test.ts:42` — `const suite = enabled ? describe : describe.skip`: the one preserved out-of-scope recovery proof skip is gated independently of DB/RLS coverage.
- `vitest.config.ts:38` — `fileParallelism: true`: retained because the serial evidence did not prove that changing it repairs the observed failures.

Evidence: SQL-only loopback pushes applied both forward migrations; the quote-follow-up focused ACL/RLS suite passed 10/10, CRM/audit focused proofs passed 14/14, and the refreshed complete-privilege matrix passed 24/24 with `SUPABASE_TEST_REQUIRED=1`. The persisted direct full gate has 124 file results (112 passed, 12 failed) and 1,239 assertions (1,126 passed, 112 failed, 1 skipped). The proposal-only catalog check found direct retained-role ACL entries for all 22 tables and two helpers.
Limits: the persisted full gate remains failing. The automatic approval guard rejected the broader inherited-ACL proposal, so it remains documentation only; no broad repair was split or applied. The retained skip is the isolated recovery physical-loader proof. No file was removed, skipped, or weakened, and no `vitest.config.ts` change is justified by the available evidence.
## Auto Run Result

Status: blocked

Implementation result: SQL-only loopback pushes applied forward effective-ACL repairs for quote-follow-ups, CRM, and audit, plus the seed-only correlation-scoped audit-failure test helper. No reset, migration-ledger repair, hosted access, or rejected broad ACL batch was applied.

Verification: focused required runs passed quote follow-ups 10/10, CRM/audit 14/14, seed-helper/migration-reset/job-runs 13/13, and the refreshed seven-privilege matrix 24/24. pnpm run typecheck, git diff --check, and the prerequisite review-order checker (12 references) passed. The final direct installed-Vitest full gate used verified --no-file-parallelism with a persisted private JSON report: 124 actual files, 112 passed and 12 failed; 1,239 assertions, 1,126 passed, 112 failed, and 1 skipped. The preserved skip is the isolated recovery physical-loader proof gated by ISOLATED_RECOVERY_STORAGE_PROOF=1.

Blocking condition: the required full integration gate remains red because inherited effective-PUBLIC privilege mismatches remain outside the accepted narrow repairs. The reviewable 22-table/two-helper repair plan is documentation only at docs/decisions/ADR-B012-public-inheritance-repair-approval-plan.md: automatic approval rejected broad ACL revocation across nearly the entire tenant-table inventory and then broad 22-table ACL migration submitted immediately after rejection as lacking user approval. Read-only catalog evidence found 44/44 direct authenticated/service-role table ACL entries and 4/4 direct helper-function ACL entries, so no replacement grants are needed if explicit owner approval authorizes the plan. Root requested Compose lifecycle 534d6b00-e76a-4419-a624-9c0b10f7d407 Stop after database work; it returned native 0, ok=true, stop_requested, verified=false, with no shutdown polling.