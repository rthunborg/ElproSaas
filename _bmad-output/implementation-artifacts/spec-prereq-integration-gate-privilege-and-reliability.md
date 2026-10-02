---
title: 'Prerequisite: Integration Gate Privilege Baseline and Local Reliability'
type: 'bugfix'
created: '2026-10-02'
status: 'ready-for-dev'
review_loop_iteration: 0
context:
  - '_bmad-output/project-context.md'
  - 'docs/process/review-order.md'
  - 'docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md'
---

<frozen-after-approval reason="owner approval recorded in ADR-B012 on 2026-10-02">

## Intent

**Problem:** The required local integration/RLS gate is blocked by two inherited prerequisites: `quote_follow_ups` retains effective direct table privileges beyond its checked command boundary, and parallel files independently fail a short local Auth readiness probe despite a healthy retained stack. The latest corrected-target run recorded 1,081 passed, 156 failed, and 1 skipped across 124 files.

**Approach:** Establish the intended effective quote-follow-up ACL with a forward migration and prove it through effective privilege and direct-RLS assertions. Establish whether file parallelism causes the reliability failure with one bounded serial full-gate run; if proven, use the shared Vitest configuration to serialize files while retaining all suites and in-file behavior.

## Boundaries & Constraints

**Always:** Preserve authenticated tenant-scoped `SELECT` through RLS; deny anonymous and direct authenticated DML; retain service-role DML and checked/audited command wrappers. Execute only against the verified loopback API and database with private child-process configuration. Keep every integration test enabled and preserve `SUPABASE_TEST_REQUIRED=1` hard-failure semantics.

**Ask First:** Stop and ask if a failure requires changing RLS policies, function authorization, service-role grants, test assertions, CI capacity policy beyond file serialization, or a database reset/ledger action.

**Never:** Do not edit applied migrations, repair migration history, reset data, call hosted services, introduce public flags, change Story 14.1 acceptance status, weaken ACL/RLS expectations, or use a broad schema snapshot.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Effective ACL | Existing `PUBLIC` or bootstrap grant | Authenticated retains only select; anon and direct DML are denied | Forward migration is additive and preserves wrappers/RLS |
| Local gate | Healthy loopback stack with cross-file contention | Serial file execution completes the same complete required suite | If failures persist, retain evidence and diagnose the concrete category |
| Target failure | Missing or incorrect private local target | Required run fails rather than silently skipping or calling hosted services | Stop before changing product or security policy |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260719130000_quote_follow_ups.sql:99` — original bootstrap grants authenticated direct write access while enabling/forcing RLS.
- `supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql:2007` — later command migration revokes only authenticated insert/update and leaves effective inherited ACLs incomplete.
- `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts:160` — migration-reset ACL expectation currently checks roles without proving inherited `PUBLIC` privileges.
- `tests/integration/rls/quote-follow-ups.rls.test.ts:75` — direct own/cross-tenant write negatives that must remain denied.
- `tests/integration/rls/tenant-table-inventory.ts:1619` — shared anon direct-mutation denial for this tenant table.
- `tests/support/test-env.ts:103` — independent two-second Auth reachability probe used by DB suites.
- `vitest.config.ts:38` — shared cross-file parallelism setting for the required gate.
- `docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md` — owner approval and fixed security/reliability boundary.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/` — create one CLI-generated forward migration that revokes table privileges from `PUBLIC`, `anon`, and `authenticated`, then grants `authenticated` select-only access; retain service-role and function authorization.
- [ ] `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts` — assert effective select/DML privileges with `has_table_privilege` and preserve direct-denial coverage.
- [ ] `vitest.config.ts` — serialize test files only if the bounded serial required gate proves the existing parallel setting is the identified reliability cause.
- [ ] `docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md` — record exact applied repair and evidence without changing Story 14.1 results.

**Acceptance Criteria:**
- Given an inherited bootstrap grant, when the forward migration applies, then authenticated has select-only access and anon/direct authenticated DML remains denied while existing RLS and wrappers continue to authorize intended commands.
- Given the verified local loopback stack, when the required integration gate runs with `SUPABASE_TEST_REQUIRED=1`, then every included test executes against that target with recorded passed, failed, and skipped counts.
- Given a serial full gate proves the parallel failure mode, when the shared runner executes future gates, then test files do not run concurrently and no test is removed, skipped, or weakened.

## Spec Change Log

## Design Notes

The ACL repair is forward-only because production authorization must be correct on already-migrated databases. Revoking from `PUBLIC` is required before granting the narrow authenticated read capability; inspecting effective privileges prevents the test from missing inherited grants. File serialization is conditional on evidence so the repair does not treat a performance preference as a security or product change.

## Verification

**Commands:**
- `supabase --version` and `supabase migration --help` — expected: installed CLI supports a CLI-generated forward migration.
- SQL-only loopback `supabase db push --include-seed --skip-vault --yes` — expected: forward migration applies without reset or ledger repair.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts --no-file-parallelism` — expected: effective ACL and retained RLS negatives execute with zero skips.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` with corrected private local target — expected: all required integration/RLS suites execute and report counts; rerun only after a concrete repair.
- `pnpm run typecheck` and `git diff --check` — expected: source/configuration and migration artifacts remain valid.
