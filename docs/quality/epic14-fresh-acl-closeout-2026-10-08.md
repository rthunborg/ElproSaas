# Epic 14 fresh-schema ACL regression closeout — 2026-10-08

Author: `/root/kernel_fix`, explicitly routed to `gpt-6.1-sol` High before this sensitive tenant/security diagnosis and test repair. Scope: approved, bounded test-only reconciliation of the current migration/caller contract. The working-tree patch is over `e1e663ce`. No migrations, product privileges, RLS policies, application code, shared Vitest configuration, services, timeout/retry changes or skipped tests were introduced by this author.

## Diagnosis and fixed contract

The fresh CI database gate reported **1,466 total / 1,437 passed / 28 failed / 1 inherited skip**, native failure, approximately 262.12 seconds for the invocation. Source inspection of the retained log identifies 24 historical ACL expectation failures and four booking-editor fault-hook bootstrap failures. All four rollback cases report `40P01` while installing test triggers, before their booking saves; the cached rejected bootstrap promise repeats the same error. The parent/coordinator owns that independent DDL scheduling repair. No product rollback or detector defect is established by those four setup failures.

The ACL tests previously expected retained direct authenticated DELETE grants from an older local bootstrap. The fresh canonical migration chain has no authenticated direct DELETE grant for those tables. `tenants` and `membership_admin_operations` likewise have SELECT-only authenticated grants, so UPDATE is denied at the privilege layer. Exact intended denial is authored from migrations and current callers, never selected from the observed mutation result or introspected ACL.

The reset checks now use `has_table_privilege` for every role/table/DML cell, including inherited PUBLIC privileges. Four authored matrices replace pooled `information_schema.role_table_grants` assertions, which could let one table's grant satisfy another table's assertion:

| Tables | Authenticated effective DML | Proven source contract |
| --- | --- | --- |
| `company_settings`, `quote_terms` | SELECT only | Original `20260630130000` grants; `20260907171252` revokes direct INSERT/UPDATE; `20261002141141` removes PUBLIC/anon inheritance. |
| `work_roles`, `articles` | SELECT only | Original `20260630140000` grants; `20260907171252` revokes direct INSERT/UPDATE; approved PUBLIC/anon repair. |
| `files`, `file_links` | SELECT only | Original `20260704120000` grants; `20260907171252` closes direct mutation; approved PUBLIC/anon repair. |
| `calculations` | SELECT, UPDATE | Original `20260702120000`; `20260907171252` revokes root INSERT and retains UPDATE. |
| `calculation_sections`, `calculation_rows` | SELECT, INSERT, UPDATE | Explicit edit grants in `20260702120000`, preserved by subsequent caller hardening. |

For all nine tables, anon has none of SELECT/INSERT/UPDATE/DELETE and service_role retains all four fixture/privileged DML grants. Non-DML privileges are outside this narrow matrix. The cross-tenant inventory pins authenticated DELETE to `42501`, and moves tenant/admin-operation UPDATE to `42501`. Existing own-tenant reads, calculation edit positives, current wrappers and foreign-target checks remain in their existing suites.

Full privileged foreign-row snapshots are compared before and after UPDATE/DELETE. All original UPDATE RLS-invisible targets retain their nonempty control; the 17 existing seeded targets formerly checked through DELETE invisibility also retain that control. Permission-only paths with no seeded target may compare empty snapshots, but must still return `42501`; they establish lack of write capability, not materialized-row fixture coverage. Snapshot ordering uses complete row JSON text instead of assuming every table has an `id` column.

## Retained local baseline limitation

[ADR-B012's approved repair plan](../decisions/ADR-B012-public-inheritance-repair-approval-plan.md) explicitly preserved catalog-observed direct authenticated/service_role grants on the retained local stack. Its historical direct DELETE grants therefore differ from a fresh canonical migration baseline. These stricter tests must honestly expose that retained drift; this patch neither changes those privileges nor branches its expected outcome to accommodate them. The exact upstream bootstrap cause is unproven. `ops/test/roles.sql` only sets role passwords; source inspection alone does not establish the historical grant origin.

The existing local database is not reset, altered, or relabeled as fresh CI evidence. A local drift failure is not a fresh-schema PASS, and a future fresh CI result must be reported independently.

## Executed evidence and remaining gates

- Author's focused ESLint on the seven changed test/helper files: native 0.
- Author's direct TypeScript checker `node node_modules/typescript/bin/tsc --noEmit`: native 0 after the final readback repair.
- Parent's intermediate required focused run on the retained stack: **244 total / 198 passed / 46 failed / 0 skipped**, native 1. Besides the expected retained ACL mismatch, the first patch incorrectly imposed nonempty targets on permission-only paths and assumed `row.id` for every snapshot. This failed intermediate result is preserved; it is not final correctness evidence. The author corrected those assertions and generic ordering while preserving original nonempty controls.
- Parent's corrected required retained-stack run: **244 total / 220 passed / 24 failed / 0 skipped**, five files, native 1, **4.826 seconds for the invocation**. All remaining failures match the preserved legacy direct ACL difference: 19 cross-tenant failures (17 DELETE, two UPDATE), four exact effective-matrix failures and the settings DELETE failure. No missing-row positive-control or assumed-ID snapshot failure remains. Exact report/log: `tmp/epic14-closeout-stack/integration-fresh-acl-retained-final.json` / `.log`. This is an actual failed retained-baseline diagnostic, not a PASS or fresh CI result; no test was unexecuted or skipped.
- No database, browser, service or native full-suite command was run by this author. Parent owns the independent High review, fresh canonical CI and any final completion decision. No prospective PASS is claimed.

Review limits remain unchanged: Story 14.1 has completed its original three broad rounds; Stories 14.2, 14.3 and 14.4 each have two completed broad rounds. This work is narrow CI regression diagnosis/repair and latest-fix verification only. It adds no broad review round, alters no story/epic acceptance status, and preserves all prior failed runs and causal limitations.

## Suggested Review Order

Author: `/root/kernel_fix`, actual test-fix author; current test-only working-tree patch over `e1e663ce`.

### Fresh migration denial replaces historical bootstrap assumptions

The data-driven request tests keep exact denial mechanisms from the current migration/caller contract. Neither ACL observations nor mutation responses determine which result will be accepted.

- `tests/integration/rls/tenant-table-inventory.ts:322` — `updateDenialKind`: tenant/admin-operation UPDATE remains privilege-denied.
- `tests/integration/rls/tenant-table-inventory.ts:393` — `deleteDenialKind`: fresh-schema authenticated DELETE is privilege-denied.
- `tests/integration/rls/settings-rls.int.test.ts:316` — `DELETE: authenticated`: exact denial plus existing independent row readback.

### Per-table effective matrices preserve permitted edit and fixture paths

The new query/assertion helper compares all effective cells to authored lists, so PUBLIC inheritance or a peer table's grants cannot hide a mismatch. Root calculation creation stays wrapper-owned while permitted section/row editing and service-role fixture access remain explicit positive controls.

- `tests/support/effective-table-privileges.ts:11` — `expectEffectiveTableDml`: exact three-role/four-DML effective cells.
- `tests/integration/rls/calc-tables-migration-reset.int.test.ts:317` — `expectEffectiveTableDml`: distinct root and child editing subsets.
- `tests/integration/rls/file-tables-migration-reset.int.test.ts:320` — `expectEffectiveTableDml`: authenticated file SELECT only.
- `tests/integration/rls/pricing-tables-migration-reset.int.test.ts:209` — `expectEffectiveTableDml`: authenticated pricing SELECT only.

### Readbacks preserve actual rows without inventing fixture coverage

Snapshot checks retain original nonempty controls and add full-state preservation to privilege denials. Unseeded permission-only paths remain explicitly limited to capability denial; all snapshots sort by complete row content.

- `tests/integration/rls/cross-tenant-isolation.rls.test.ts:487` — `seededMutationTargets`: retained concrete target controls.
- `tests/integration/rls/cross-tenant-isolation.rls.test.ts:556` — `requireRows`: existing UPDATE invisibility still requires real rows.
- `tests/integration/rls/cross-tenant-isolation.rls.test.ts:718` — `snapshotForeignRows`: complete independent DELETE readback.
- `tests/integration/rls/cross-tenant-isolation.rls.test.ts:754` — `to_jsonb(row)`: deterministic ordering without an ID assumption.

Evidence: actual static successes and both failed retained runtime diagnostics above. Limits: strict fresh canonical CI remains pending; the corrected retained run still fails on all 24 legacy ACL differences, which cannot be waived by changing the oracle. Parent owns independent High review and final integration evidence.
