---
title: 'Prerequisite: Integration Gate Privilege Baseline and Local Reliability'
type: 'bugfix'
created: '2026-10-02'
status: 'completed'
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
- [x] `supabase/migrations/20261002150000_approved_successor_acl_and_rls_batch_repair.sql` — applies only the owner-approved two exact service-role wrapper revokes and the membership column UPDATE grant; it does not change any other ACL or RLS policy.
- [x] `src/server/read-models/pagination.ts` — reduces the shared RLS ID batch size from 100 to 50.
- [x] `tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts`, `tests/integration/rls/onboarding-checklist.rls.test.ts`, `tests/integration/rls/membership-self-grant.rls.test.ts`, and `tests/integration/rls/admin-user-management.rls.test.ts` — prove the exact wrapper revokes and protected membership-column denial. The existing 101-ID pipeline and 501-ID list regressions execute through the 50-ID helper.
- [x] `supabase/migrations/` — created CLI-generated forward migrations that revoke table privileges from `PUBLIC`, `anon`, and `authenticated`, then grant `authenticated` select-only access for the confirmed quote-follow-up, CRM, and audit paths; retained service-role and function authorization.
- [x] `tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts` — asserts the complete effective table-privilege matrix with `has_table_privilege` and preserves direct-denial coverage.
- [x] `tests/integration/rls/crm-tables-migration-reset.int.test.ts` and `tests/integration/commands/audit-anon-isolation.int.test.ts` — assert the complete effective table-privilege matrix with `has_table_privilege` for the confirmed CRM and audit paths.
- [x] `vitest.config.ts` — retained file parallelism because the bounded serial required gate did not prove it resolves the observed failure category.
- [x] `docs/decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md` — records the exact applied repairs and evidence limits without changing Story 14.1 results.
- [x] `supabase/migrations/20261002141141_approved_inherited_public_acl_repair.sql` — applied only the owner-approved 22-table/two-helper `PUBLIC`/`anon` revoke matrix, preserving explicit retained grants, column grants, RLS, wrappers, and `membership_roles` exclusion.

**Acceptance Criteria:**
- Given a documented active tenant-table access contract and a confirmed inherited excess grant, when its forward migration applies, then only documented direct access remains and unauthorized anon/direct DML is denied while existing RLS, downstream validators, and wrappers continue to authorize intended commands.
- Given the verified local loopback stack, when the required integration gate runs with `SUPABASE_TEST_REQUIRED=1`, then every included test executes against that target with recorded passed, failed, and skipped counts.
- Given a serial full gate proves the parallel failure mode, when the shared runner executes future gates, then test files do not run concurrently and no test is removed, skipped, or weakened.

## Spec Change Log

- 2026-10-02 — Owner approved this successor scope before implementation: revoke `service_role` EXECUTE only for `public.create_quote_version_from_calculation(uuid, uuid, timestamptz, uuid, uuid)` and `public.mark_quote_version_lifecycle(uuid, uuid, text, timestamptz, uuid, uuid)`; revoke authenticated table UPDATE on `tenant_memberships` and restore only `UPDATE (onboarding_checklist_dismissed_at)`; reduce shared RLS ID batches from 100 to 50 to repair the demonstrated 101-ID pipeline and 501-ID quote-list failures. Preserve SELECT, service-role table access, RLS, checked wrappers, and existing product behavior outside those three repairs.

## Design Notes

ACL repairs are forward-only because production authorization must be correct on already-migrated databases. The owner expanded this task after serial classification confirmed CRM and audit effective-ACL defects; each remains individually provenance-checked rather than receiving a blanket revoke. Revoking from `PUBLIC` is required before granting the narrow authenticated read capability; inspecting effective privileges prevents the test from missing inherited grants. File serialization is conditional on evidence so the repair does not treat a performance preference as a security or product change.

## Verification

**Commands:**
- Final root-bound required `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` after the bounded readiness repair — native exit 0; started 2026-10-02T18:18:57+02:00 and completed 2026-10-02T18:19:35+02:00. The private metadata records API `127.0.0.1:55421`, database loopback `127.0.0.1:55422`, and PostgreSQL server `10.240.8.2:5432`. Results: 124 passed and 1 intentionally skipped file; 1,242 passed and 1 intentionally skipped test. The sole skip remains the isolated physical-loader proof.
- Readiness fault injection — passed: 5 unit tests cover HTTP failure diagnostics, timeout-only retry recovery, persistent timeout fail-closed behavior without negative caching, and timeout-to-401 fail-closed behavior. The root-bound concurrent affected command suite passed 3 files and 42 tests.
- SQL-only loopback `supabase db push --include-seed --skip-vault --yes` — passed; applied only `20261002150000_approved_successor_acl_and_rls_batch_repair.sql`, with seeds current and no reset or migration-ledger action.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run` for quote wrapper ACL, onboarding checklist, 101-ID pipeline, and 501-ID quote-list regressions with serial files — passed: 4 files, 26 passed, 0 failed, 0 skipped.
- Focused root-bound membership protected-column regression run — passed: 3 files, 14 passed, 0 failed, 0 skipped. The child process set `SUPABASE_TEST_URL` from the private root runtime and `SUPABASE_TEST_DB_URL` to loopback 55422 without exposing credentials.
- Root-bound required normal `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` — native exit 1; started 2026-10-02T17:59:05+02:00 and completed 2026-10-02T17:59:43+02:00. The persisted metadata records API `127.0.0.1:55421` and DB `127.0.0.1:55422`; results were 125 files (119 passed, 5 failed, 1 skipped) and 1,243 tests (1,192 passed, 50 failed, 1 skipped). The five failed files contain only required-stack or required-Storage reachability failures from test gates; they do not establish a product assertion failure.
- Bounded root-runtime binding probe — `SUPABASE_TEST_REQUIRED=1`, API `127.0.0.1:55421`, and both private test-key aliases were set; Auth and Storage returned HTTP 200. The resolved DB alias connected to PostgreSQL server `10.240.8.2:5432`, database `postgres`, through loopback `127.0.0.1:55422`. This confirms the declared aliases and direct probe target, but does not itself establish why Vitest’s reachability gates failed.
- Exact request diagnosis — the runtime anon/service keys hash-match the corrected stack without exposing key material. The gate sends `GET /auth/v1/health` with `apikey` and `GET /storage/v1/bucket` with `apikey` plus Bearer service-role authorization, each with a 2-second timeout. Under the root aliases they returned HTTP 200 in 58 ms and 11 ms. A selected `settings-rls` reachability-gated test then passed (1 passed, 14 filter-skipped). The full-gate failure therefore does not show an authorization, TLS, route, or persistent timeout defect. Transient worker/load behavior is a plausible explanation only: the current catch-all probe drops the underlying error, so it does not prove timeout, rate limiting, or backpressure.
- Required normal `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` — completed with native exit 1: 125 files, 105 passed, 19 failed, 1 skipped; 1,024 passed, 36 failed, 183 skipped tests. The persisted private stdout/stderr logs show that `SUPABASE_TEST_URL` and `SUPABASE_TEST_DB_URL` were unset, so this run used the harness defaults (54321/54322), not the approved root runtime (55421/55422). Its 32 non-membership failures and 182 setup-abort skips therefore do not classify product behavior on the root stack. Four membership expectation failures were caused by the approved column-grant repair and are resolved by the focused root-bound run; the one remaining skip is the intentional physical-loader proof.
- `supabase --version` and `supabase migration --help` — passed with CLI `2.115.0`; generated `20261002121425_quote_follow_ups_privilege_baseline.sql`.
- SQL-only loopback `supabase db push --include-seed --skip-vault --yes` — passed; applied only the forward ACL migration, with seed files already current and no reset or ledger repair.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts --no-file-parallelism` — passed: 1 file, 10 passed, 0 failed, 0 skipped.
- SQL-only loopback `supabase db push --include-seed --skip-vault --yes` — passed again; applied only `20261002122535_crm_and_audit_privilege_baseline.sql`, with seed files already current and no reset or ledger repair.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/rls/crm-tables-migration-reset.int.test.ts tests/integration/commands/audit-anon-isolation.int.test.ts --no-file-parallelism` — passed: 2 files, 14 passed, 0 failed, 0 skipped.
- `SUPABASE_TEST_REQUIRED=1 node_modules/.bin/vitest.cmd run --no-file-parallelism tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts tests/integration/rls/crm-tables-migration-reset.int.test.ts tests/integration/commands/audit-anon-isolation.int.test.ts` — passed after the complete-privilege matrix repair: 3 files, 24 passed, 0 failed, 0 skipped.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- --no-file-parallelism --reporter=json --outputFile <private-temp-path>` — completed with exit 1: 106 passed, 17 failed, and 1 skipped files; 1,116 passed, 122 failed, and 1 skipped tests. pnpm forwarded a literal `--`, so neither file serialization nor reporter output was proven for this run. It remains corrected-target full-gate evidence only. The retained skip is the isolated recovery physical-loader proof, gated by `ISOLATED_RECOVERY_STORAGE_PROOF=1`, and is unrelated to required DB/RLS coverage.
- Direct installed Vitest with `--no-file-parallelism --reporter=json --outputFile <private-temp-path>` — exit 1 with persisted output. `testResults.length` was 124: 112 passed and 12 failed files, with no skipped file status. Assertion totals were 1,126 passed, 112 failed, and 1 skipped (1,239 total). The preserved skip is `recovery-storage-immutability.int.test.ts`, gated by `ISOLATED_RECOVERY_STORAGE_PROOF=1`; it is isolated recovery infrastructure proof, not required DB/RLS coverage.
- Read-only loopback catalog provenance for the approved 22 tables and two helpers — 44 authenticated/service-role table ACL entries and 4 function ACL entries were direct, with no gaps; removing `PUBLIC` did not require replacement grants. The approved `PUBLIC`/`anon` matrix is applied; named-role grants remain outside that approval.
- Root-owned guarded loopback stack (`http://127.0.0.1:55421`, `127.0.0.1:55422`) — the approved migration was already applied before this verification run; no reset, migration-ledger action, hosted access, or resource lifecycle action occurred in this run.
- `SUPABASE_TEST_REQUIRED=1 node_modules/.bin/vitest.cmd run tests/integration/rls/approved-public-acl-repair.int.test.ts tests/integration/rls/cross-tenant-isolation.rls.test.ts tests/integration/rls/anon-path-isolation.rls.test.ts --no-file-parallelism` — passed: 3 files, 359 passed, 0 failed, 0 skipped.
- `SUPABASE_TEST_REQUIRED=1 node_modules/.bin/vitest.cmd run tests/integration/rls/approved-public-acl-repair.int.test.ts tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts tests/integration/rls/crm-tables-migration-reset.int.test.ts tests/integration/commands/audit-anon-isolation.int.test.ts --no-file-parallelism` — passed: 4 files, 27 passed, 0 failed, 0 skipped.
- `pnpm run typecheck` and `git diff --check` — passed.

## Suggested Review Order

Author: prerequisite implementation author.
Refreshed against the completed final working tree. The final required normal gate is root-bound and green: native exit 0, 124 passed plus 1 intentionally skipped file, and 1,242 passed plus 1 intentionally skipped test. It does not change Story 14.1 product scope or acceptance status.

### Fail-closed root-bound gate procedure

Before a required local gate, the invoking child process must set `SUPABASE_TEST_REQUIRED=1`, `SUPABASE_TEST_URL`, `SUPABASE_TEST_DB_URL`, `SUPABASE_TEST_ANON_KEY`, and `SUPABASE_TEST_SERVICE_ROLE_KEY` from the approved private runtime/compose configuration. It must parse the resolved API and DB origins and abort before `pnpm run test:int` unless both match the approved loopback API and database endpoints; it must never silently use the test harness defaults. The invocation records only sanitized host/port values, whether the two test-key aliases are set, the actual PostgreSQL server address/port from its resolved DB connection, and its native exit code in private metadata.

- `tests/support/test-env.ts:32` — the harness falls back to API 54321 unless `SUPABASE_TEST_URL` is explicitly set.
- `tests/support/test-env.ts:137` — the harness falls back to DB 54322 unless `SUPABASE_TEST_DB_URL` is explicitly set.
- `tests/support/test-env.ts:277` — `STACK_REQUIRED` derives the hard-fail reachability mode from `SUPABASE_TEST_REQUIRED`.

### Bounded readiness repair

The probe keeps its two-second per-request cap. A timeout receives one 50 ms-backoff retry inside a 4.25-second total readiness budget; HTTP, authorization, and other non-timeout failures retain one-attempt fail-closed behavior. Successful reachability is reusable only within a worker. A false result is never cached.

- `tests/support/test-env.ts:101` — records only surface, method, origin, HTTP status, elapsed time, reason, and attempt count; no headers, body, identities, or credentials enter diagnostics.
- `tests/support/test-env.ts:156` — implements the timeout-only retry and total deadline without changing Vitest file parallelism or test concurrency.
- `tests/unit/support/test-env.test.ts:17` — fault injection verifies timeout-to-200 recovery plus timeout-to-timeout and timeout-to-401 fail-closed behavior.
- `tests/support/global-setup.ts:26` — appends the existing allowlisted reachability diagnostic to the required-stack failure without reading headers, bodies, identities, or credentials.
- `tests/unit/support/global-setup.test.ts:6` — pins the required-stack diagnostic fields and rejects credential-shaped text.

### Owner-approved successor repair

The forward migration changes only the two named service-role wrapper grants and the authenticated membership UPDATE grant. The shared batch limit falls from 100 to 50 because the existing live RLS read-model regressions demonstrate the 101-ID pipeline and 501-ID list failures; their assertions retain complete results across the new batches.

- `supabase/migrations/20261002150000_approved_successor_acl_and_rls_batch_repair.sql:3` — removes service-role EXECUTE from only the two approved checked wrapper signatures.
- `supabase/migrations/20261002150000_approved_successor_acl_and_rls_batch_repair.sql:6` — restricts authenticated membership writes to `onboarding_checklist_dismissed_at`, retaining SELECT, service-role table access, and the row policy.
- `tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts:113` — proves service-role EXECUTE is denied for exactly those two wrappers while the existing loop keeps authenticated execution and anonymous/PUBLIC denial coverage.
- `tests/integration/rls/onboarding-checklist.rls.test.ts:41` — proves the ready own-membership dismissal set and clear still persist; `:52` and `:82` prove protected status and `disabled_at` PATCHes receive PostgreSQL `42501` and leave rows unchanged.
- `tests/integration/rls/membership-self-grant.rls.test.ts:69` and `tests/integration/rls/admin-user-management.rls.test.ts:22` — align the existing protected role, status, tenant, and lifecycle-field negatives with the approved column-grant boundary and retain independent no-persistence readbacks.
- `src/server/read-models/pagination.ts:15` — sets the shared `.in()` batch limit to 50 for all current read-model consumers.
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:329` and `tests/integration/features/quotes/quote-pipeline-list-filters.int.test.ts:244` — retain the demonstrated 101-ID pipeline and 501-ID list regression inputs and assert complete output.

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

### Owner-approved inherited-PUBLIC repair

The owner-approved matrix is limited to the 22 observed tables and two RLS helpers. It revokes only inherited `PUBLIC` and `anon` access, leaving the catalog-proven direct authenticated and service-role entries, RLS policies, column grants, wrappers, and the unobserved `membership_roles` table unchanged.

- `supabase/migrations/20261002141141_approved_inherited_public_acl_repair.sql:4` — `revoke all privileges on table`: applies the exact 22-table `PUBLIC`/`anon` revoke matrix.
- `supabase/migrations/20261002141141_approved_inherited_public_acl_repair.sql:17` — `revoke execute`: removes inherited anonymous execution from the two tenant-context helpers without changing their direct retained grants.
- `tests/integration/rls/approved-public-acl-repair.int.test.ts:61` — `[P0] denies every effective table privilege`: AC1 verifies all seven effective PostgreSQL table privileges are denied to `anon` for each approved table.
- `tests/integration/rls/approved-public-acl-repair.int.test.ts:91` — `[P0] retains direct authenticated and service_role table ACLs`: AC1 verifies 44 retained direct table ACL entries independently of `PUBLIC`.
- `tests/integration/rls/approved-public-acl-repair.int.test.ts:121` — `[P0] denies anon helper execution`: AC1 verifies both helpers deny `anon` and retain direct `authenticated`/`service_role` execution.

### Corrected retained-ACL test contracts

These seven test-only corrections distinguish an ACL from an RLS mutation authorization result. The retained authenticated DELETE/UPDATE grants reach RLS; the focused tests verify zero affected rows and an independent privileged readback instead of asserting a false privilege error. The test changes do not change an RLS policy, wrapper, grant, migration, or application code.

- `tests/integration/rls/calc-tables-migration-reset.int.test.ts:312` — `GRANTs`: checks catalog-visible historical DELETE and the absence of a DELETE RLS policy.
- `tests/integration/rls/file-tables-migration-reset.int.test.ts:79` — `allowlist`: token-bound expression prevents `person_profiles` from matching the `file` substring; `:315` records retained DELETE separately from RLS.
- `tests/integration/rls/pricing-tables-migration-reset.int.test.ts:204` — `GRANTs`: records the same retained-ACL/no-DELETE-policy invariant for pricing tables.
- `tests/integration/rls/membership-self-grant.rls.test.ts:69` — `self-UPDATE role`: proves this fixture's protected role/status/tenant mutation targets remain unchanged, without claiming complete own-membership UPDATE denial.
- `tests/integration/rls/admin-user-management.rls.test.ts:4` — `independent admin readback`: proves lifecycle and operation records are unchanged after direct authenticated DML attempts.
- `tests/integration/rls/onboarding-checklist.rls.test.ts:4` — `presentation timestamp`: retains the intended ready-tenant own-dismissal path; `:59` proves the protected `disabled_at` PATCH is rejected with `42501`.
- `tests/integration/rls/settings-rls.int.test.ts:188` — `historical SELECT/DELETE ACL`: checks the retained catalog contract while later direct-mutation tests prove RLS denial.

The correction is deliberately limited. `supabase/migrations/20261002150000_approved_successor_acl_and_rls_batch_repair.sql:6` grants authenticated UPDATE only for `onboarding_checklist_dismissed_at`; `tests/integration/rls/onboarding-checklist.rls.test.ts:59` proves a ready-tenant no-dispatch `disabled_at` PATCH is rejected with `42501` and does not persist. `docs/decisions/ADR-B012-public-inheritance-repair-approval-plan.md:82` also records the two service-role wrapper grants and the 100-ID quote REST failure. Neither is changed here.

### Verification and runner decision

The applied migrations and focused proofs are current run evidence. The corrected-target full gate did not establish that cross-file concurrency is the reliability cause because its serialization flag was not honored, so the shared runner configuration remains unchanged.

- `tests/integration/ops/recovery-storage-immutability.int.test.ts:42` — `const suite = enabled ? describe : describe.skip`: the one preserved out-of-scope recovery proof skip is gated independently of DB/RLS coverage.
- `vitest.config.ts:38` — `fileParallelism: true`: retained because the serial evidence did not prove that changing it repairs the observed failures.

Evidence: SQL-only loopback application of the first two forward migrations, their focused proofs (quote follow-ups 10/10; CRM/audit 14/14), and the refreshed complete-privilege matrix (24/24) are historical evidence. In this run, the already-applied approved matrix passed its effective-ACL plus affected cross-tenant/anonymous RLS suites (3 files, 359/359) and its effective-ACL plus focused migration-reset suites (4 files, 27/27), all with `SUPABASE_TEST_REQUIRED=1` and serial files. The exact normal gate `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` completed with 125 files: 114 passed, 10 failed, 1 skipped; 1,242 assertions: 1,226 passed, 15 failed, 1 skipped. The persisted root-bound seven-file reconciliation at `C:\Users\Rasmus\AppData\Local\Temp\elpro-prereq-seven-reconciliation-20261002.json` then completed with 6 files passed, 1 intentionally red file; 68 assertions passed, 1 intentionally red assertion. This final P2 repair passed its focused Node diagnostic tests (6/6) and the required onboarding RLS test (1 file, 6/6) with `SUPABASE_TEST_REQUIRED=1`; `pnpm run typecheck` and `git diff --check` also passed. The reviewer supplied a direct `.cmd` command at approximately 17:13:29 CEST and declared 55421/55422 for its 59-pass/10-fail result, but lacked a durable report and resolved runtime binding; that result is withdrawn and superseded by the reproducible persisted 68-pass/1-intentionally-red result.
Limits: the normal-gate residual includes direct service-role EXECUTE grants on two checked quote wrappers, a 100-ID `quote_acceptances` request that returns HTTP 502 and empties the pipeline aggregate, and the same batch boundary returning an empty quote list. The retained skip is the isolated recovery physical-loader proof. No file was removed, skipped, or weakened, and no `vitest.config.ts` change is justified by the available evidence.
## Auto Run Result

Status: completed

Implementation result: SQL-only loopback pushes applied forward effective-ACL repairs for quote-follow-ups, CRM, and audit, plus the seed-only correlation-scoped audit-failure test helper. The owner-approved `20261002141141_approved_inherited_public_acl_repair.sql` matrix and successor `20261002150000_approved_successor_acl_and_rls_batch_repair.sql` were applied to the root-owned loopback stack. The successor revokes only the two approved service-role wrapper signatures, restricts authenticated membership UPDATE to `onboarding_checklist_dismissed_at`, and reduces shared RLS ID batches to 50. No reset, migration-ledger repair, hosted access, or resource lifecycle action occurred in this verification run.

Verification: the applied matrix passed 3 focused effective-ACL/cross-tenant/anonymous files (359 passed) and 4 focused effective-ACL/migration-reset files (27 passed). The exact normal `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` then completed: 125 files, 114 passed, 10 failed, 1 skipped; 1,242 assertions, 1,226 passed, 15 failed, 1 skipped. The persisted root-bound reconciliation used `SUPABASE_TEST_REQUIRED=1`, API `http://127.0.0.1:55421`, database `127.0.0.1:55422` (server `10.240.8.2:5432`, `postgres`), the exact seven files, serial execution, and `C:\Users\Rasmus\AppData\Local\Temp\elpro-prereq-seven-reconciliation-20261002.json`: 6 files passed, 1 intentionally red file; 68 assertions passed, 1 intentionally red assertion. Its sole failure is the ready-tenant `disabled_at` PATCH regression. pnpm run typecheck, git diff --check, and the refreshed prerequisite review-order checker passed. The reviewer supplied a direct `.cmd` command at approximately 17:13:29 CEST and declared 55421/55422 for its 59-pass/10-fail result, but lacked a durable report and resolved runtime binding; it is withdrawn and superseded by the persisted result.

Remaining condition: the owner approved and the successor repair passed focused root-bound regressions. The default-endpoint normal run is invalid evidence for the approved root stack: it exited 1 with 19 failed files, 36 failed tests, and 183 skipped tests because its test aliases were absent. Thirty-two failed tests and 182 skips arise from that schema/API target mismatch; four membership expectation failures were repaired within the approved successor scope. The correctly endpoint-bound normal run also exits 1, with 5 failed files and 50 failed tests from required Auth/Storage reachability gates. Its resolved aliases, direct Auth/Storage HTTP 200 probe, and actual DB server binding are recorded, but the cause of Vitest’s gate failures remains unresolved. The one remaining skip is the isolated physical-loader proof. The possibility that test alias/runtime handling explains another reviewer result is an inference only. Both private log sets and the root-bound metadata preserve the evidence.

No runner or serialization change is justified by the available evidence. A future local-reliability repair must first preserve the gate's fail-closed semantics while recording the caught request failure category and elapsed time, then reproduce a correlation between bounded worker load and failed readiness before changing concurrency or caching.

## Final prerequisite result

The owner-approved successor repair and local readiness repair are complete. The SQL forward migration was applied with seed on the root-owned loopback stack, all successor and readiness focused regressions passed, and the final required normal integration gate passed with its single pre-existing isolated physical-loader skip. This resolves the integration/RLS prerequisite blocker only; it does not alter Story 14.1 product acceptance, browser evidence, or Phase B scope.
