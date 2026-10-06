# Story 14.3 author verification — 2026-10-06

Current R1 patch verification is incomplete: complete eight-worker required integration returned native 1, 1,366 total / 1,362 passed / 3 failed / 1 intentional recovery skip. Both subsequent bounded three-suite diagnostics returned native 1, 102 total / 101 passed / 1 failed / 0 skipped; the final sampler proves six DB wall-clock reversals during that workload. First independent full-diff review completed; the scoped fixes and refreshed author trail require follow-up inspection. All historical failures remain preserved with their evidence limits; no gate waiver or system/security-bound change is made.

Implementation author: `/root/build_14_3/author_14_3`, gpt-6.1-sol High, selected for transactional integrity, critical conflicts, authentication/RLS and DST correctness. One authorized context-free gpt-6.1-sol High worker owned only the pure scheduling modules, fixtures and unit activation; High reason: transactional/DST conflict integrity. First independent review completed before R1; follow-up review is pending and is not substituted by author checks.

Tested state: uncommitted R1 fix working tree on `codex/epic14-resume`, HEAD `5d61f44c30bbd6eb9e659966b50b69c4dd377d7d`; full implementation/review baseline remains `2a6c9e6d6859987590f2e875f695a75c16125af6`. The author performed no commit, branch, push, PR, hosted change, reset or resource deletion. R1 changes repair participant associations, genuine proof expiry, invitation operation-lock expiry and regression collection/assertions. Opt-in diagnostic observers preserve actual RPC replies and emit only fixed safe booleans/time deltas.

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

## Historical executed checks before diagnostic continuation

**R1 collection correction:** the two additional AC10 cases (three-stale-attempt exhaustion and distinct-key simultaneous writes) were absent from every pre-R1 report, including all 49-case runs. They were unregistered, not skipped. Historical claims of executing those two cases are withdrawn; all original reports/counts, other named cases and unknown failures remain intact. Current registration/status evidence is in [case audit](story14-3-r1-case-registration-audit.json). The historical tables and continuation sections below describe their respective past executions, not the current patch gate.

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
| AC8 replacement/peer refresh/accepted-key preservation/cancellation | Transferred INT-004 P1; current complete full workload passes; historical failure remains recorded with unknown cause |
| AC9 post-conflict and audit rollback | Transferred INT-005 P1; create/update exact pre/post durable equality |
| AC10 current facts and post-wait authority | Distinct-key booking race; eight individual schedule/profile/calendar/combined/work-role-upsert/work-role-active/membership/invitation races; create/update replay revocation; three-attempt retry; expiry-during-wait case |
| AC11 proof/ACL/tenancy/read scope | 13-field proof tampering, missing/forged/malformed/expired/version proof, valid-signed malformed rows, direct/legacy/private denials, own-assignment reads, cross-language UTF-8/microsecond proof vector, exact 2 checked / 8 private ACL/search-path inventory |
| AC12 permanent fixtures and scope | UNIT-014 six named regression cases; all 14 unit and 6 integration IDs executed; manifest/source/bundle gates retained |

Each UNIT-001..014 has its own named test in the three scheduling unit files. All INT-001..006 are named actual-command cases. Transferred INT-003/004/005/006 P0/P1 all pass in the latest complete full workload; earlier failed workloads and unknown causes remain recorded separately.

## Historical remaining limits at the prior HALT

Root directed canonical Step 03 `blocked: implementation verification failed` after the unexplained owned INT-004 result. The build delegate owns the terminal HALT/status write; this author does not change terminal metadata or start another broad retry. Implementation and the 20-stop author trail are preserved for checkpointing. Root will request Stop for the shared lifecycle after return; this author does not stop another actor's resource.

Independent security/transaction/code review and final review-trail inspection are pending. Current cumulative-suite INT-004 failure needs resolution or an evidence-backed diagnosis; isolated and representative green runs do not explain it. Author verification is blocked by that unresolved full-run failure; no waiver is inferred. Canonical lint under a readable generated-snapshot actor remains pending. Exact empty-chain proof remains Epic CI. No browser/UI coverage is claimed before 14.4; no external vendor/service or hosted secret deployment was tested. Functional fixture correctness does not establish unapproved performance/scalability thresholds or numeric code coverage. This evidence does not advance Story 14.4 or declare the story done.

## Authorized diagnostic continuation — 2026-10-06

The user explicitly authorized diagnostic/fix/reverification/independent-review continuation. Build restoration and root's clean gate are at `a9e2838e80afbd9718c6d907c5518a152b286b1f`; the first independent review must cover ALL Story 14.3 implementation from original baseline `2a6c9e6d6859987590f2e875f695a75c16125af6`, including implementation checkpoint `c8d0a881`, rather than only the resume delta. Existing spec context files and review conventions were reloaded and verified unchanged from the original implementation baseline. The approved intent is unchanged.

Root's new lifecycle `730ffa3c-8fe8-4b93-b5b8-4da0f9e61cee` is active and verified on retained project `rg-f58d95e0aa76f813445d407dfe410638d75a0041`, isolated API 55421 and DB 55422. Root owns Stop; old lifecycle `79338b7b-db58-4a1a-85a2-5d877d3d45e3` is stopped. No child launch/stop/adoption, original-stack use, reset, deletion or hosted action occurred. [Readiness](story14-3-resume-readiness.json) proves Auth/REST/Storage each HTTP 200, checked schema ready, ledger count 94, all 92 prior and both Story 14.3 records unchanged.

The owner-authorized current full workload ran with `SUPABASE_TEST_REQUIRED=1`, `STORY143_DIAGNOSTIC=1`, `--maxWorkers=8` and unchanged `fileParallelism=true`. The first JSON-only diagnostic returned native 1: 1,355 total / 1,353 passed / 1 failed / 1 intentional skip ([report](story14-3-resume-full-diagnostic.json)). All 49 conflict cases passed, including historical INT-004. The sole new failure was retained `14.2-INT-009`, linked basic-job CREATE at `bookings.int.test.ts:430`; its `ok=false` assertion lacked the underlying code. Aggregate sampling showed peak 51 total / 44 client PostgreSQL backends ([samples](story14-3-resume-full-connections.json)); this does not prove why that command failed.

Concrete diagnostic-invocation defect: the JSON-only reporter suppressed the existing test-only safe console observer, making the failure code unavailable. A corrected invocation added the default reporter alongside JSON, with no production/test/config/assertion/timeout change: `pnpm run test:int --maxWorkers=8 --reporter=default --reporter=json --outputFile=_bmad-output/test-artifacts/story14-3-resume-full-visible-diagnostic.json`. The observer then exposed expected real fault/replay/permission codes (e.g. finalize `XX000`/`P0001` and replay `BK409`), confirming observability. It never logs facts, proof/secret/token bytes, SQL binds or mutable records.

The corrected complete full workload returned native 0: **1,355 total / 1,354 passed / 0 failed / 1 intentional recovery-loader skip**, 128 files passed and 1 skipped, 80.04 seconds ([report](story14-3-resume-full-visible-diagnostic.json)). All 49 conflict cases, all 32 retained booking cases (16 foundation + 11 replay + 5 RLS), 12 migration/ACL cases and 4 inventory cases execute and pass. This is current full-workload evidence, not a filtered repetition, assertion weakening or skip waiver. No unexpected error code appeared and no scope-bound production defect was identified/fixed. The causes of historical INT-004 and first-resume retained INT-009 failures remain unknown; green execution does not retroactively explain them. No further broad retry is planned absent a new change or diagnosis.

Current full integration is green. Canonical lint is green as recorded below; first independent review/trail inspection remains pending. Empty-chain Epic CI and all earlier external/browser/performance limits remain. Terminal status and advancement remain the build/root delegate's responsibility.

### Authorized canonical lint cache correction

Both author and build actors hit canonical ESLint `EPERM scandir` on an immutable generated `_bmad/render` snapshot. The build actor identified the cache as generated `outputs.md`/`manifest.json`, with no lintable application/test source. Root explicitly authorized the narrow global ignore `_bmad/render/**`; this author added only that pattern and its rationale comment at `eslint.config.mjs:19`. All source/tests coverage and the canonical unmodified `pnpm run lint` command remain intact. No concurrency/assertion/timeout or CI weakening was made. The build actor executed canonical `pnpm run lint` after the correction and reported **native 0, 0 errors / 13 inherited warnings**; the author records that actual delegated execution rather than claiming a separate author run. Another DB rerun is unnecessary for this cache-only change. First independent review includes this config delta as well as the complete original Story 14.3 implementation and the historical intermittent fail-closed paths. Final review-order reference checker passes exactly one section and all 20 stops/anchors; whitespace validation passes.

## R1 integrity fixes and current verification — 2026-10-06

The first full-diff independent review completed; this author implemented the accepted scope-bound patch batch without changing frozen intent. The build delegate owns canonical triage, follow-up metadata and terminal status.

- Aggregate capacity retains the established first-pair row/key and adds stable supplemental association rows for each remaining participant. Four bookings produce three rows whose booking/related IDs cover all four bookings; booking-specific reads retrieve every participant. Identical established keys retain accepted metadata; changed full participant identity removes old rows and opens the new keys. Engine version `booking-conflicts-v2` rejects older incomplete fresh authority, while currently authorized durable replay still precedes proof/version validation.
- Genuine otherwise valid expired HMAC authority returns `kind:stale` after binding/HMAC/current-facts/output checks. Actual save retries under the same UUID at most three times and then uses the existing `SERVER_ERROR` code contract. Forged/missing/cross-actor/future/oversized/invalid proofs remain denied; no `retryable` wire field was added.
- Invitation expiry and confirmed identity are checked after the operation-row lock, immediately before activation. The deterministic real RPC operation-lock test leaves membership expired/user null and booking/audit state unchanged; the earlier membership-row wait case remains.
- Both extra AC10 tests now use actual Vitest registration. Independent literal assertions cover persisted absence/blocked exceptions through the real resource writer and booking command, four-participant refresh/readback, valid signed expired/future/oversized windows, v1 rejection and actual one/three expired gate-wait attempts. Private fixture signing shortens the otherwise valid production-issued window to two seconds only for the bounded expiry barriers; actual SQL HMAC/clock/authorization verification is never replaced.

### R1 forward application and preservation

CLI-generated immutable forward migration `20261006144057_booking_conflict_review_integrity_fixes.sql` was syntax-validated inside a rolled-back transaction and applied incrementally with native 0. Prior applied migration files were not edited. The ledger is now 95 records; all 94 prior complete records retain SHA-256 `4ee8170645ea6bf45d11d79dfcda08fa83fe1b32e920905650bbd0e1c47e3d00`, and the sole addition is `20261006144057` ([ledger](story14-3-r1-ledger-final.json)). No reset, destructive seed or original-stack mutation occurred. Root-owned lifecycle `730ffa3c-8fe8-4b93-b5b8-4da0f9e61cee` remains active at API55421/DB55422 for shared work; root owns Stop, this actor owns no launch/stop reference. This proves forward application, not empty-chain CI.

### Actual executed R1 checks

All integration runs use `SUPABASE_TEST_REQUIRED=1`; all parallel runs retain `fileParallelism=true` and owner-authorized eight workers. Default plus JSON reporters expose safe diagnostics.

| Check | Native / actual counts | Evidence and limits |
| --- | --- | --- |
| Initial affected ten suites | 1; 143 total / 142 passed / 1 failed / 0 skipped | [report](story14-3-r1-focused.json); AC10 historical UPDATE replay setup failed `TENANT_ACCESS_DENIED`/finalize42501 before coworker move/deactivation; no guard reason was captured, cause unknown |
| Affected ten suites after safe observer | 0; 143 passed / 0 failed/skipped | [report](story14-3-r1-focused-diagnostic.json); all60 conflict cases, both corrected AC10 names and all nine new cases execute |
| Current complete required integration | **1; 1,366 total / 1,362 passed / 3 failed / 1 skipped** | [report](story14-3-r1-full.json); 129 files, 103.26s; all four transferred IDs and both corrected AC10 names pass; gate remains failed |
| Bounded three-path diagnostic | **1; 102 total / 101 passed / 1 failed / 0 skipped** | [report](story14-3-r1-three-path-diagnostic.json); all three prior failing names pass, but AC10 exhaustion fails with genuine future-issued proof readback; does not explain or waive original full failures |
| Final authorized receipt workload | **1; 102 total / 101 passed / 1 failed / 0 skipped** | [report](story14-3-r1-receipt-workload.json);74.55s, valid control of keyId-tampering case denied42501; six actual DB wall-clock reversals, no same-proof pre/post receipt available; no further tests |
| Isolated issuance-path diagnostic | 0; 1 passed / 0 failed / 59 filtered skips | [report](story14-3-r1-issuance-path-diagnostic.json); no proof rejection captured, diagnostic only |
| Full unit | 0; 1,993 total / 1,992 passed / 0 failed / 1 skipped | `story14-3-r1-unit.log`; inherited Windows xattr case needs Linux CI |
| Scheduling under UTC / America/Los_Angeles / Asia/Tokyo | 0 each; 14 passed / 0 failed/skipped each | `story14-3-r1-zone-*.log`; every UNIT-001..014 named test repeats |
| Canonical typecheck / lint | 0 each; lint 0 errors / 13 inherited warnings | `story14-3-r1-typecheck.log`, `story14-3-r1-lint.log`; narrow generated-cache ignore preserves sources/tests |
| Lockfiles / service-role / production build / bundle | 0 each | `story14-3-r1-*.log`; build completed before full integration, no overlap |
| Audit high / local advisors | 0 each; 2 moderate / 0 high; no advisor issues | `story14-3-r1-audit.log`, `story14-3-r1-advisors.log` |
| Final current typecheck / canonical lint | 0 each; lint0errors/13inherited warnings | `story14-3-r1-final-typecheck.log`, `story14-3-r1-final-lint.log`; includes receipt and direct-RPC observers |

The sole full-run skip is the existing opt-in isolated recovery Storage physical-loader proof. No owned acceptance test is skipped in the full run. Filtered diagnostic skips never count as coverage.

### Exact failing-path evidence and remaining uncertainty

The three full failures are: retained 7.4-INT-02 quote-acceptance immutability setup mark-sent `VALIDATION_FAILED`; owned AC11 missing-proof valid control direct finalize `kind:denied/code:42501`; retained14.2-INT-003 primary+secondary role-revocation UPDATE replay setup actual authoritative RPC `42501/message:booking proof denied`. The last two direct RPC paths originally lacked safe guard readback; the shared observer now covers them. All original failed reports remain unchanged.

Quote full-run readback: `PFD10`, HMAC/fingerprint/Storage/binding/shape guards true, `issued_not_future=false`, `time_current=false`, issued-versus-statement delta -830.251ms, prepare-to-finalization 57.525ms. This is post-rejection readback, not the exact rejection snapshot; no unrelated quote product change is made.

The later102-case diagnostic catches AC10 exhaustion with finalize42501/proof: identity/version/config/HMAC/candidate/output/lifetime guards true, expiry future, expected changed facts false, but `issued_not_future=false`. Issued-versus-DBclock delta -673.906ms, statement -673.922ms, transaction -675.302ms; statement age0.021ms/transaction1.401ms; Node-before/after-issued -682/-676ms. That proves a genuine signed issue time ahead of the postfailure DB readback; it does not identify the original full failures' causes. Strict future issuance rejection stays unchanged, preceding CAS.

Bounded read-only180 consecutive clock samples show no backward DB sample, statement age0.110–0.860ms, pinned transaction age1.950→11865.800ms over11196ms Node elapsed. DB-to-Node offset varies, but those samples do not establish causation ([clock deltas](story14-3-r1-clock-samples.json)). Deployed function definitions contain no epoch extraction or numeric-to-bigint/integer cast in snapshot/finalize/quote prepare/quote ISO issuance.100 materialized same-call samples show booking issued/expiry serialization exactly0ms; quote millisecond serialization truncates -0.984…-0.006ms and never advances; same-call elapsed0.015…0.081ms ([format deltas](story14-3-r1-timestamp-format-samples.json)). No host/Docker/WSL/time-sync change or security-clock-bound weakening occurred. Exact receipt-to-failure monotonic/DB delta instrumentation is observational only; absence of a failure leaves diagnosis incomplete.

### Final authorized receipt diagnostic and stop

One complete102-case representative workload with new receipt/monotonic command-path instrumentation and one bounded READ ONLY DB sampler returned native1:101passed/1failed/0skipped. The sole failure is the **original valid signed control** of AC11 keyId tampering, at actual direct finalize:42501/message-class proof. Identity/version/config/HMAC/candidate/facts/output/lifetime guards all true, expiry future, but issued_not_future false. Issued-versus-clock -772.641ms, statement -772.654ms, transaction -773.730ms; statement age0.016ms/transaction1.092ms; Node-before/after-issued -776/-770ms. The first intentionally invalid-key denial separately reports readback unavailable, so it is not mistaken for this unexpected valid-control rejection.

The concurrent sampler recorded1210 observations and **six actual backward database wall-clock steps**, each with positive monotonic elapsed. Largest reversal -827.780ms over62.090ms monotonic; maximum statement age0.750ms ([samples](story14-3-r1-receipt-clock-samples.json)). This establishes DB wall-clock regression during the workload independently of Node comparison or timestamp rounding. It does not establish the operating-system/virtualization cause or retroactively explain earlier failed runs. The failed direct-binding path has postfailure readback but no same-proof receipt instrument; command receipt data from expected fault cases cannot substitute for that missing evidence. No claim of before/after validity for the exact failed proof is made.

The previously failed AC10 exhaustion, missing-proof valid control, quote immutability and revoked-role replay names pass in this diagnostic; that does not waive either failed102 workload or the full1366/1362/3/1 result. Tests and sampler have ended; no further run follows. Root directs the build delegate to record blocked:patch verification failed. This author preserves status/frontmatter and reports incomplete verification; no additional independent-review credit, Story14.4 advancement, system change or future-time guard relaxation is inferred.

### Current AC evidence and limits

AC1–4/12 retain every named pure/golden unit. AC2 now additionally asserts independent literal persisted exception UTC windows and a capacity warning. AC5–9 retain all six named actual-command obligations and all four transfers; AC8 additionally verifies four-participant association retrieval, exact accepted-key preservation and changed-identity reopen after full refresh. AC10 now actually registers/executed both missing tests, retains all eight consumed-writer races, operation/membership invitation lock-expiry cases and one/three genuine expiry retries. Current full report passes both corrected names; the later bounded diagnostic exhaustion failure remains consequential and unwaived. AC11 adds isolated properly signed valid expired/future/oversized windows, old engine rejection and positive controls, retaining malformed/HMAC/tenancy/ACL negatives. [Case registration audit](story14-3-r1-case-registration-audit.json) distinguishes absent historical cases from current passed/failed/filtered states.

Current cumulative verification remains unsatisfied. Follow-up review of the scoped high fixes and final author trail is required; no Story14.4 advancement, completed status or gate waiver is claimed. Exact empty-chain Epic CI, browser/editor/override14.4, hosted/external deployment and numeric coverage/performance/scalability targets remain outside current evidence. Historical unexplained CREATE/replay failures remain unknown.
