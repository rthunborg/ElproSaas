# Story 14.3 author verification — 2026-10-06

Implementation author: `/root/build_14_3/author_14_3`, gpt-6.1-sol High, selected for transactional integrity, critical conflicts, authentication/RLS and DST correctness. One authorized context-free gpt-6.1-sol High worker owned only the pure scheduling modules, fixtures and unit activation; High reason: transactional/DST conflict integrity. Independent review is pending and is not substituted by author checks.

Tested state: uncommitted Story 14.3 working tree on `codex/epic14-resume`, based on `2a6c9e6d6859987590f2e875f695a75c16125af6`. No Git commit, branch, push, PR, hosted change, reset or resource deletion was performed by the author. The final code-only diagnostic changes add a typed command error-code assertion context and opt-in test-only actual-RPC error-code observation; no assertions or production behavior change. The representative run executes those diagnostics.

## Implemented authority and scope

Actual `createBooking`/`updateBooking` commands now use the cookie-bound snapshot → sole pure detector → exact signed output → checked finalize path. SQL rechecks current authority after the common first tenant gate, compares a complete current fact digest, and commits booking, exact assignments, complete tenant derived conflicts, durable outcome and target-only audit together. A stale attempt changes nothing and retries at most three times under the original command UUID. Fresh legacy writes and direct/private paths remain denied; authorized canonical replay preserves its historical outcome without new detection writes.

The complete post-command result refreshes peer-owned conflicts and preserves workflow evidence only for an identical natural key. Rules are versioned; UTC microseconds, Stockholm gap/fold policy, actual weekly shifts/breaks, Swedish holidays, overlapping absence/blocked/calendar layers, explicit buffer and injected overtime are covered. Optional production job-depth inputs are explicitly unavailable. Resources stays active, scheduling pending; no UI/action/route, override, recurrence, AI or job-depth capability was added.

### Exhaustive normal-tenant consumed writer inventory

| Consumed facts | Actual production writers | Gate evidence |
| --- | --- | --- |
| Booking windows/status/assignees | Fresh/replayed `create_booking`, `update_booking`; checked snapshot/finalize; private commit | New common first gate, create-key/update-row serialization and current authority; legacy fresh path sealed |
| Person schedule | `save_person_schedule` | Gate before template/exception row changes |
| Person profile/default role/archive state | `upsert_person_profile` | Gate before profile lock/write |
| Tenant calendar | `upsert_tenant_calendar_day` | Gate before calendar changes |
| Combined profile/schedule/calendar form, including clears | `save_resource_person_form` | Gate before nested writers and clears; full precision preserved |
| Work-role identity/active state | `upsert_work_role`, `set_work_role_active` | Gate before role row changes; money fields are excluded from facts |
| Membership lifecycle/current roles | Existing `admin_manage_user` | Existing first tenant gate retained before row locks |
| Invitation preparation/resend | Existing `admin_prepare_invitation` | Existing first tenant gate retained |
| Invitation acceptance | `admin_accept_membership_invitation` | Unlocked tenant discovery → common gate → locked reload and identity/status/token/email/expiry revalidation |

Direct scheduling/resource/role/bookings DML remains revoked. Mutable CRM/basic-job descriptive fields and onboarding-dismissed state are excluded from the detector bundle; existing parent checks/SHARE locks remain. Adding newly consumed job/CRM facts later requires enrolling their writers as well. New-tenant provisioning is not an existing-tenant scheduling mutation.

Two CLI-generated immutable forward migrations were applied incrementally: `20261006122441_booking_conflict_detection_integration.sql` and `20261006124954_booking_invitation_post_gate_expiry.sql`. The second corrects inherited request-start expiry evaluation after a gate/row wait to the actual database clock; a deterministic real invitation test proves an invitation expiring during the wait is denied without booking-state changes.

## Local infrastructure and ledger

Only the root-authorized isolated API `http://127.0.0.1:55421` and DB `127.0.0.1:55422/postgres` were mutated/tested. Auth/REST/Storage/schema readiness and the prior ledger were checked before incremental application. Root lifecycle `79338b7b-db58-4a1a-85a2-5d877d3d45e3`, Compose project `rg-f58d95e0aa76f813445d407dfe410638d75a0041`, uses the preserved corrected private `guard-compose-01a0ecb9-r4/compose.ready.test.yaml`. Root owns Stop and keeps this resource for shared verification/review; this author holds no independently acquired lifecycle. Its own guard List failed with native 2 / `HOOK_CONTEXT_UNAVAILABLE`; it did not borrow another actor's guard context or launch/stop resources.

No original `54321/54322` mutation, business seed/reset or existing-data cleanup occurred. Only matching explicitly synthetic local Vault material and the new owner-only, correlation-scoped fault-fixture seed block were installed. Existing matching material was reused; no real secret or raw proof was logged/committed. Test cleanup targets fixture-owned rows.

The final ledger contains 94 records; all 92 prior complete records retain SHA-256 `9a7fa3a7b1a5ece3fe93153197448b21c12b48e7bc17f72313acf6ad4c6e7338`. See [before](story14-3-ledger-before.json) and [final](story14-3-ledger-final.json). This proves incremental application, not an empty-chain reset. Empty DB → all migrations → seed → required integration remains mandatory in Epic CI before merge.

## Executed checks

All integration runs set `SUPABASE_TEST_REQUIRED=1`. Counts below are tests, not assertions; filtered skips are never acceptance coverage.

| Check | Native exit / executed result | Evidence and limits |
| --- | --- | --- |
| 14 named pure scheduling obligations | 0; 14 passed, 0 failed/skipped | Worker execution; UTC, America/Los_Angeles and Asia/Tokyo each repeat 14/14 (42 repeated cases) |
| Focused scheduling plus proof units | 0; 30 passed, 0 failed/skipped | 14 scheduling plus 16 proof/configuration tests |
| Full unit | 0; 1,992 passed, 0 failed, 1 skipped (1,993 total) | `story14-3-unit-final.log`; inherited Windows xattr file-backend case requires Linux CI |
| Current focused conflict/admin/invitation/migration suites | 0; 73 passed, 0 failed/skipped | [report](story14-3-focused-final.json): conflict 49, admin management 6, invitation retry 6, migration/ACL 12; all four transfers execute |
| Corrected booking/retained writer checks | 0; 51 passed, 0 failed/skipped | [report](story14-3-writers-retained.json); all 32 retained booking cases preserved |
| First default-worker cumulative integration (concurrent build) | 1; 1,318 passed, 35 failed, 1 skipped (1,354 total) | 33 inherited Storage health timeouts (~4.07 seconds), 2 inherited quote issued-in-future proof failures; transcript evidence, no JSON report because initial argument forwarding placed a literal `--` |
| Second default-worker cumulative integration (alone) | 1; 1,346 passed, 7 failed, 1 skipped (1,354 total) | [report](story14-3-full-integration-final.json); own fault-fixture DDL deadlock plus subsequent setup failure; four role-harness reserved-connection failures on 100-slot DB, one CRM auth failure |
| Bounded parallel after owned harness correction, before expiry correction | 0; 1,353 passed, 0 failed, 1 skipped (1,354 total) | [report](story14-3-full-integration-bounded.json); invocation-only `--maxWorkers=8`, `fileParallelism=true`, unchanged config/CI/assertions/timeouts |
| Current full bounded parallel after expiry correction | 1; 1,353 passed, 1 failed, 1 skipped (1,355 total) | [report](story14-3-full-integration-current.json); sole INT-004 third CREATE returned `ok=false`; report lacked underlying typed error; unresolved cumulative-suite failure |
| Isolated diagnostic INT-004 after current full failure | 0; 1 passed, 0 failed, 48 filtered skips | [report](story14-3-transfer004-diagnostic.json); does not explain the cumulative failure or establish broad green |
| Authorized representative parallel diagnostic | 0; 146 passed, 0 failed/skipped | [report](story14-3-representative-diagnostic.json): complete 49 conflict cases plus resources, pricing, admin management/invitation, role harness, CRM customer, quote send/PDF; eight workers, file parallelism true; no typed failure emitted |
| Typecheck / final changed-test lint / whitespace | 0 | Latest diagnostic change checked; changed-file ESLint 0 warnings |
| Complete source/test ESLint fallback | 0; 13 inherited warnings | Invocation-only `--ignore-pattern '_bmad/render/**'`; canonical `pnpm lint` hit actor EPERM reading generated `_bmad/render/.../e6a13b3d7c7bd496edc3`; no lint/CI configuration weakened; parent canonical lint remains pending |
| Lockfiles / source service-role containment / build / bundle containment | 0 each | Production build completed; no new route; `story14-3-build.log` |
| Dependency audit high threshold | 0 | 2 moderate, 0 high findings |
| Local CLI security advisors | 0; no issues | [report](story14-3-advisors.json), before expiry-only correction; discovered CLI help first |

The one cumulative integration skip is the existing opt-in isolated recovery Storage physical-loader proof, requiring `ISOLATED_RECOVERY_STORAGE_PROOF`; it is unrelated to booking acceptance. No Story 14.3 acceptance test is deliberately skipped. Unlimited default-worker gates are not green. Root authorized eight workers to fit the local 100-connection target, without disabling file parallelism; the current bounded run also has an unresolved failure. No blind broad retry followed that failure. The explicitly authorized representative diagnostic sampled only aggregate `pg_stat_activity` counts every 500ms: peak 37 total backends / 30 client connections ([samples](story14-3-representative-connections.json)). Its safe wrapper observes unchanged real RPC replies and logs only operation/envelope code/RPC name and code on failure, with no facts, binds, signatures, SQL text or tokens. No failure occurred. This does not prove infrastructure caused the prior INT-004 failure.

The owned test fault harness was corrected by preinstalling owner-only triggers in the safe seed block, checking/reusing them, and serializing fallback setup under one shared advisory key. Test bodies alter only their correlation markers; actual production writes and rollback remain under test.

## Acceptance mapping

| AC / invariant | Executed named evidence |
| --- | --- |
| AC1 half-open pair/person identity | UNIT-001/002/003 |
| AC2 actual capacity, layering and exact outside windows | UNIT-004/005/006/012 |
| AC3 optional typed access/competence and explicit overtime | UNIT-007/008/013; production adapter explicitly unavailable |
| AC4 DST/microseconds, frozen ordering/no I/O/clock | UNIT-009/010/011 plus three host-timezone repetitions |
| AC5 internal preview/save equivalence | INT-001, real commands and sole detector, exact normalized durable rows |
| AC6 stale preview and actual retry | INT-002 and transferred INT-006 P0; zero stale-attempt mutations |
| AC7 atomic actual CREATE | Transferred INT-003 P0; exact booking, assignments, conflicts, outcome and attributable target audit |
| AC8 replacement/peer refresh/accepted-key preservation/cancellation | Transferred INT-004 P1; passed focused and isolated, unresolved failure in current full run |
| AC9 post-conflict and audit rollback | Transferred INT-005 P1; create/update exact pre/post durable equality |
| AC10 current facts and post-wait authority | Distinct-key booking race; eight individual schedule/profile/calendar/combined/work-role-upsert/work-role-active/membership/invitation races; create/update replay revocation; three-attempt retry; expiry-during-wait case |
| AC11 proof/ACL/tenancy/read scope | 13-field proof tampering, missing/forged/malformed/expired/version proof, valid-signed malformed rows, direct/legacy/private denials, own-assignment reads, cross-language UTF-8/microsecond proof vector, exact 2 checked / 8 private ACL/search-path inventory |
| AC12 permanent fixtures and scope | UNIT-014 six named regression cases; all 14 unit and 6 integration IDs executed; manifest/source/bundle gates retained |

Each UNIT-001..014 has its own named test in the three scheduling unit files. All INT-001..006 are named actual-command cases. Transferred INT-003/004/005/006 P0/P1 all pass in current focused execution, but this does not waive the current cumulative INT-004 failure.

## Remaining limits

Root directed canonical Step 03 `blocked: implementation verification failed` after the unexplained owned INT-004 result. The build delegate owns the terminal HALT/status write; this author does not change terminal metadata or start another broad retry. Implementation and the 20-stop author trail are preserved for checkpointing. Root will request Stop for the shared lifecycle after return; this author does not stop another actor's resource.

Independent security/transaction/code review and final review-trail inspection are pending. Current cumulative-suite INT-004 failure needs resolution or an evidence-backed diagnosis; isolated and representative green runs do not explain it. Author verification is blocked by that unresolved full-run failure; no waiver is inferred. Canonical lint under a readable generated-snapshot actor remains pending. Exact empty-chain proof remains Epic CI. No browser/UI coverage is claimed before 14.4; no external vendor/service or hosted secret deployment was tested. Functional fixture correctness does not establish unapproved performance/scalability thresholds or numeric code coverage. This evidence does not advance Story 14.4 or declare the story done.
