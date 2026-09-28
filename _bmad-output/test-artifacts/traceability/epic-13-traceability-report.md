---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-09-28'
tempCoverageMatrixPath: 'C:\Users\Rasmus\AppData\Local\Temp\tea-trace-coverage-matrix-2026-09-28T09-40-49-285Z.json'
workflowType: 'testarch-trace'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-13-1-authenticated-background-runner-and-producer-registry.md'
  - '_bmad-output/implementation-artifacts/spec-13-2-in-app-notifications-bell-center-and-preferences.md'
  - '_bmad-output/implementation-artifacts/spec-13-3-email-outbox-pipeline-queued-non-sending.md'
  - '_bmad-output/implementation-artifacts/spec-13-4-email-sending-activation.md'
  - '_bmad-output/implementation-artifacts/epic-13-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-13.md'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - 'docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md'
  - 'docs/quality/epic-13-convergence-review-2026-09-27.md'
  - 'docs/quality/epic-13-independent-luna-convergence-2026-09-27.md'
  - 'docs/quality/epic-13-reviewbot-convergence-2026-09-28.md'
  - '_bmad-output/implementation-artifacts/epic-13-retro-2026-09-28.md'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'high'
oracleResolutionMode: 'formal_requirements'
oracleSources:
  - '_bmad-output/implementation-artifacts/spec-13-1-authenticated-background-runner-and-producer-registry.md'
  - '_bmad-output/implementation-artifacts/spec-13-2-in-app-notifications-bell-center-and-preferences.md'
  - '_bmad-output/implementation-artifacts/spec-13-3-email-outbox-pipeline-queued-non-sending.md'
  - '_bmad-output/implementation-artifacts/spec-13-4-email-sending-activation.md'
externalPointerStatus: 'not_used'
collectionStatus: 'COLLECTED'
sourceSha: 'ed439335c585bcb80e97b808d35b2378e7525e6e'
---

# Traceability Matrix & Gate Decision — Epic 13

**Target:** Epic 13 — Notifications and Email Infrastructure

**Date:** 2026-09-28

**Evaluator:** Rasmus / BMad TEA

**Coverage Oracle:** Final formal acceptance criteria for Stories 13.1–13.4

**Oracle Confidence:** High

## Step 1 — Coverage Oracle and Context

Create mode uses the four completed Epic 13 story specifications as the formal coverage oracle. Each specification is marked `done` and contains the final intent contract, acceptance criteria, implementation map, review history, and recorded verification evidence. The epic context, planning epic, ADR-B011, and epic test design supply scope, architecture, and risk priorities; they do not replace the final story acceptance wording.

This is the final deterministic re-gate after the approved `quote.delivery` preference remediation, the bounded-runner, durable-failure-cursor, recovery-attestation, UUID-canonicalization, exact-send-role, and request-bound PDF-read repairs, and the final ReviewBot authentication, business-date, schedule/continuation, and cursor-scan budget repairs through product code head `ed439335c585bcb80e97b808d35b2378e7525e6e`. The oracle remains the same 26 final acceptance criteria. Metadata head `54181ab7cf352b1255c61f57f859c9db9a19e977` adds only the refreshed Story 13.1 specification and convergence record after `ed43933`, so it does not change the product source under trace.

The selected oracle is high confidence because the four final story specifications cover the full epic sequence: the authenticated background runner and producer registry, in-app notifications and preferences, the dark email outbox, and sandbox-only email activation with the narrow public unsubscribe surface. Formal requirements are therefore available and take precedence over contract inference or a synthetic source oracle.

No external requirement pointer is needed. External-provider behavior and real-recipient delivery remain outside the implemented oracle: ADR-B011 keeps real-recipient delivery disabled until a separate owner go-live record. Story 13.4 also records two provider-contract follow-ups that apply before that later go-live; the present gate evaluates the authorized Epic 13 sandbox-only release surface.

The loaded TEA knowledge base defines P0–P3 priorities, risk and gate thresholds, probability/impact scoring, test quality, and selective execution. Recorded command results in the final specifications are treated as execution evidence; planned commands or historical blocked runs are context only.

## Step 2 — Test Discovery and Catalogue

Static discovery found Epic 13 evidence at unit/static, integration/API/RLS, and production-server browser levels. The containing evidence set spans 34 files and 189 declared cases: the prior 34-file/176-case inventory plus 13 new executing cases in three existing Story 13.1 unit files. Several shared manifest and containment files include older-epic cases; only assertions that exercise an Epic 13 requirement are credited in the matrix.

The final ReviewBot/convergence delta adds 13 directly mapped unit cases: UTF-8 byte-length authentication at the verifier and route boundary; Stockholm winter, summer, and DST business-date handoff; injected-clock due selection and invalid-schedule rejection; off-schedule partial/failed/legacy cursor authority; repeated budgeted scan progress; boundary checkpoint resume; newly due tenant-zero restart; carried due-ID retention across repeated deadlines and irrelevant lookups; and later-tenant fairness. No new test file is introduced. The deduplicated mapped inventory is therefore 63 cases across 20 files: 28 unit/static, 33 API/integration/RLS, and two E2E.

| Level | Primary Epic 13 evidence | Recorded execution evidence |
| --- | --- | --- |
| Unit/static | jobs auth/route/runner/registry, bounded follow-up producer, notification and preference-eligibility registry/presentation, email outbox/provider/unsubscribe, quote-recipient validation and UUID canonicalization, recovery attestation, manifest derivation/shape/coherence, and service/email containment bite tests | The exact Story 13.1 convergence selection at product source `ed43933` records 30 passed, zero failed/skipped; typecheck, changed-file ESLint, and the 12-reference review-order check also pass. The latest prior full CI run [`36398591011`](https://github.com/rthunborg/ElproSaas/actions/runs/36398591011) at `71fa10a` records 1,904 unit passes and green static/build checks for the unchanged wider surface. Full CI at `ed43933` is the later root gate and is not claimed here. |
| Integration/API/RLS | `job-runs.int.test.ts`, notification emission/dedupe/preference eligibility/RLS, five terminal reminder states at the producer boundary, outbox concurrency/retry/suppression/RLS, activated delivery, quote artifact/currentness/recipient correction, attested finalization recovery across exact send roles, and public unsubscribe capability | Prior full CI run `36398591011` performs the required database/RLS lane and records 1,206 passed with one explicit loader skip; that isolated recovery-loader proof passes separately 1/1. The `ed43933` delta changes no schema, RLS, or database behavior. |
| E2E | notification bell/center/preferences, dark Admin outbox, removed quote-delivery preference controls, and public unsubscribe | Prior run `36398591011` records 172 passed, four explicit skips, and zero failures. The focused public unsubscribe and preference-absence journeys are present in the suite; `ed43933` changes no browser surface. |
| Component | None | Presentation helpers are unit tested and the user-visible journeys have browser coverage. |
| Live | None | `live-verification-results.json` is absent. Static collection remains `COLLECTED`; no live-only coverage is claimed. |

### Execution-state findings

- No committed `.only`, `.fixme`, or skip was found in the directly selected Epic 13 test files.
- The main database suite's one explicit skip is `tests/integration/ops/recovery-storage-immutability.int.test.ts`; the dedicated `recovery-storage-loader` job executes that case and passes 1/1. It does not cover an Epic 13 acceptance criterion.
- Historical blocked runs in the story specifications were superseded by the final successful reset, required integration, build, unit, and Playwright evidence and are not counted as current failures.
- Story 13.4's synthetic sandbox adapter is the authorized provider evidence for this epic. Real-recipient provider behavior remains gated by ADR-B011 and is not credited as implemented coverage.

### Live Verification Results

```json
{
  "liveManifestHeader": {
    "present": false,
    "results_file": "C:\\DEV\\ElproSaas\\_bmad-output\\test-artifacts\\live-verification-results.json",
    "source_sha": "",
    "observed_at": "",
    "producer": "",
    "read_error": "",
    "current_source_sha": "ed439335c585bcb80e97b808d35b2378e7525e6e"
  },
  "liveRecords": []
}
```

### Coverage heuristics inventory

- **Endpoint/API:** `GET` and `POST /api/jobs/run` have direct route-level authentication and dispatch tests. Notification read/preference and acknowledgement behavior is covered through registry, command/database, and browser evidence; the supported preference projection excludes legacy `quote.delivery` rows and rejects new writes. The public unsubscribe route has browser coverage and direct token/RLS integration. Quote-delivery command behavior has validation and database integration evidence; there is no dedicated quote-send browser journey.
- **Authentication/authorization:** Missing, wrong, garbage, forged, unsigned, and `alg:none` scheduler credentials; current/previous rotation; service/client containment; personal notification RLS; Admin-only outbox projection; cross-tenant queue isolation; and public token isolation/rate limiting are covered.
- **Error paths:** Deterministic deadline/chunk resume, budgeted off-schedule cursor discovery, repeated-deadline due-ID retention, newly due tenant-zero restart, legacy/partial/failed cursor authority, bounded follow-up and recipient pages, retained checkpoints after producer failure, later-tenant progress, producer failure sanitization, notification optimistic-read recovery, concurrent dedupe, stale-claim recovery, retry exhaustion, suppression, closed release posture, rejected ineffective preference writes, missing/changed/stale quote artifacts, five independently stored terminal reminder states before producer enqueue, pending-recipient cancellation and authorized reissue, claimed-send terminal recheck, malformed delivery bytes, forced finalization rollback, HMAC-bound orphaned/invalidated recovery evidence, direct-forgery and wrong-role denial, UUID canonicalization, request-bound PDF reads with constrained broker fallback, unknown/revoked/rate-limited tokens, and forbidden import/provider paths are represented.
- **UI journeys:** The bell, center, filters, stored deep link, mark-one/all, supported preferences, failure recovery, absent `quote.delivery` controls, Admin dark queue, and public unsubscribe journeys have E2E coverage. The sender's quote-recipient selection/finalization journey relies on unit and integration evidence rather than a dedicated Epic 13 browser test.
- **UI states:** Empty, never-run, failed/stale freshness, unread/read, optimistic failure recovery, unavailable/required email preference, redacted Admin queue, public inactive-token, and rate-limit states are asserted.

## Step 3 — Requirements-to-Tests Matrix

Coverage is credited only when current committed evidence exercises the final acceptance wording. Historical runs are execution evidence for still-present tests, not a substitute for a missing current test. Later Epic 13 stories intentionally supersede earlier transitional posture where stated, such as Story 13.4 activating synthetic-sandbox email preferences after Story 13.2's initial inactive state.

| Requirement | Pri | Coverage | Primary mapped evidence and rationale |
| --- | --- | --- | --- |
| 13.1-AC1 Named invalid scheduler credentials return one generic 401 with zero side effects | P0 | FULL | `13.1-ROUTE-NEG` — `tests/unit/server/jobs/route.test.ts:15` rejects every named form before client/runner construction; `13.1-AUTH-NEG` — `tests/unit/server/jobs/route-auth.test.ts:10` covers the verifier set. `13.1-AUTH-UTF8` at `route-auth.test.ts:25` and `route.test.ts:60` proves an equal-character/mismatched-byte multibyte bearer cannot throw and still receives the same side-effect-free 401 for current or previous-secret comparison. |
| 13.1-AC2 Current and eligible previous rotation secrets dispatch once; expired previous is denied | P0 | FULL | `13.1-AUTH-ROTATION` — `tests/unit/server/jobs/route-auth.test.ts:16` freezes the clock and proves an expired previous secret is rejected while current and relatively future credentials remain accepted; `13.1-ROUTE-CURRENT` — `tests/unit/server/jobs/route.test.ts:81` exercises the scheduler boundary; `13.1-ROUTE-EXPIRED` — same file `:34` proves pre-dispatch denial. The byte-safe negative at `:60` covers both previous-secret expiry states. |
| 13.1-AC3 Registry contract derives only active-module producers and rejects pending/placeholder categories | P0 | FULL | `13.1-REGISTRY-ACTIVE` — `tests/unit/server/jobs/producer-registry.test.ts:5`; `13.1-REGISTRY-PLACEHOLDER` — same file `:9`; active category ownership is also pinned in `tests/unit/server/notifications/registry.test.ts:5`. `13.1-SCHEDULE-DUE` and `13.1-SCHEDULE-INVALID` at `tests/unit/server/jobs/runner.test.ts:178,437` prove the registered five-field UTC schedules are evaluated against the injected clock and unsupported declarations fail before tenant work or misleading records. |
| 13.1-AC4 Tenant-explicit, bounded/resumable runs persist attributable sanitized run/audit state | P0 | FULL | Existing chunk/deadline/failure/sanitization evidence remains at `tests/unit/server/jobs/runner.test.ts:7,15,47,58` and composed persistence at `tests/unit/server/jobs/route.test.ts:94`. Route deadline, failed-cursor loading, and Stockholm business-date handoff are covered at `route.test.ts:160,205,228`; large-tenant progress, retained failure checkpoints, and inter-producer resume remain at `runner.test.ts:68,103,143`; bounded off-schedule scan progress, boundary checkpoint resume, newly due restart, legacy authority, repeated-deadline due-ID retention, carried-work fairness, and failed/partial continuation are covered at `runner.test.ts:202,247,289,306,324,355,378,415`. Convergent bounded producer paging remains at `tests/unit/server/notifications/follow-up-producer.test.ts:10`. |
| 13.1-AC5 Fresh `job_runs` schema has exact constraints/grants/RLS/manifest/H4 protections with required evidence | P0 | FULL | `13.1-JOB-RUNS-SCHEMA` — `tests/integration/jobs/job-runs.int.test.ts:12` checks the fresh catalog and now asserts that partial requires a cursor, failed may retain one, and running/completed forbid one; manifest/H4 pins remain in `manifest-shape.test.ts:158` and `manifest-derivations.test.ts:150`. Latest prior full CI required-database evidence executes this case within 1,206 passes. |
| 13.1-AC6 Source and built-output containment rejects alternate lanes, unverified JWT patterns, and client-reachable jobs service context | P0 | FULL | `13.1-JOBS-CONTAINMENT` — `tests/unit/scripts/verify/jobs-service-role-containment.test.ts:8`; `13.1-BUNDLE-JOBS` — `tests/unit/scripts/verify/bundle-containment.test.ts:92`; the authoritative source and post-build scripts are recorded passing. |
| 13.2-AC1 Entitlement-projected notification stores tenant/user/category/content/route/read state and clients use the stored destination | P0 | FULL | `13.2-INT-001` — `tests/integration/notifications/notifications.atdd.int.test.ts:29`; stored-link browser path — `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:97`. |
| 13.2-AC2 Concurrent/retried due scans deduplicate and terminal work emits nothing | P0 | FULL | `13.2-INT-002` — `notifications.atdd.int.test.ts:44` runs six concurrent scans; the five database-backed terminal cases at `:55` independently prove accepted, rejected, lost/withdrawn, superseded, and expired work emits nothing. |
| 13.2-AC3 Every tenant role gets its own capped bell; foreign user/tenant/anonymous/raw-write paths deny | P0 | FULL | `13.2-RLS-001` — `notifications.atdd.int.test.ts:98`; raw/cross-tenant/anon denial `:114`; all-role capped bell — `notifications.atdd.e2e.spec.ts:78` (runtime matrix over five roles); count helper — `tests/unit/components/notifications/notification-presentation.test.ts:25`. |
| 13.2-AC4 Personal mark-one/all, stored links, combined filters, idempotency, and failure reconciliation | P0 | FULL | Popover/center `notifications.atdd.e2e.spec.ts:87`; link/read `:97`; filters `:108`; mark-one `:122`; mark-all/reload `:132`; injected failure recovery `:141`; replay-safe DB acknowledgement `notifications.atdd.int.test.ts:59`. |
| 13.2-AC5 Active-category preferences resolve defaults, enforce essential state, and reflect deployment email availability | P0 | FULL | Server enforcement/default rows plus authenticated rejection of ineffective `quote.delivery` writes — `notifications.atdd.int.test.ts:126`; preference-eligible active-category derivation — `tests/unit/server/notifications/registry.test.ts:12`; module grouping, essential UI, and absence of the ineligible row — `notifications.atdd.e2e.spec.ts:155,165,174` and `tests/e2e/notifications/email-preferences-email-activation.atdd.e2e.spec.ts:13`. |
| 13.2-AC6 Fresh schema/manifest/H4 plus accessible empty/never-run/stale presentation remain truthful | P0 | FULL | Forced-RLS schema `notifications.atdd.int.test.ts:143`; keyboard/focus `notifications.atdd.e2e.spec.ts:184`; empty/never-run `:197`; elapsed stale state `:205`; manifest coherence suite supplies the active-surface guard. |
| 13.3-AC1 Tenant-local enqueue persists one safe queued row/event and reconciles replay/concurrency | P0 | FULL | `13.3-UNIT-001` — `tests/unit/server/email/outbox.atdd.test.ts:5`; `13.3-INT-001` — `tests/integration/email/outbox.atdd.int.test.ts:14`; safe DTO mismatch rejection — `tests/unit/server/email/outbox.test.ts:32`. |
| 13.3-AC2 SKIP LOCKED claims are disjoint; stale leases recover; fixed retries exhaust visibly with sanitized events | P0 | FULL | `13.3-UNIT-002` — `outbox.atdd.test.ts:12`; real Postgres `13.3-INT-002` — `outbox.atdd.int.test.ts:27`; retry/exhaustion `13.3-INT-003` — same file `:41`. |
| 13.3-AC3 Matching suppression wins before delivery, appends an event, and remains tenant/category scoped | P0 | FULL | `13.3-UNIT-003` — `outbox.atdd.test.ts:21`; atomic DB `13.3-INT-004` — `outbox.atdd.int.test.ts:61`; RLS scope `13.3-RLS-003` — `tests/integration/rls/email-outbox.rls.atdd.int.test.ts:32`. |
| 13.3-AC4 Dark processor leaves safe-rendered work queued and has no provider dependency/call path | P0 | FULL | `13.3-UNIT-004` — `outbox.atdd.test.ts:27`; `13.3-INT-005` — `outbox.atdd.int.test.ts:74`; provider/source guard bites — `tests/unit/scripts/verify/email-provider-containment.atdd.test.ts:9,19`; sole scheduler seam — `tests/unit/server/jobs/route.test.ts:113`. |
| 13.3-AC5 Admin-only redacted queue is truthful; other roles/tenants and direct mutation deny | P0 | FULL | `13.3-RLS-002/004` — `email-outbox.rls.atdd.int.test.ts:20,41`; Admin states/redaction/non-admin/foreign tenant — `tests/e2e/notifications/email-outbox.atdd.e2e.spec.ts:69,93,104,111`. |
| 13.3-AC6 Fresh schema/manifest/H4 covers all three outbox tables and append-only/state protections | P0 | FULL | `13.3-RLS-001/002` — `email-outbox.rls.atdd.int.test.ts:14,20`; active 40-table pins — `manifest-shape.test.ts:158` and `manifest-derivations.test.ts:150`; required run recorded 578/578. |
| 13.4-AC1 Synthetic sandbox delivery records one server-only provider-backed sent outcome | P0 | FULL | `13.4-UNIT-001` — `tests/unit/server/email/provider.atdd.test.ts:10`; artifact-backed DB outcome `13.4-INT-001` — `tests/integration/email/email-delivery-activation.atdd.int.test.ts:29`; server-only adapter containment — `tests/unit/scripts/verify/email-delivery-containment.atdd.test.ts:10`. |
| 13.4-AC2 Missing/malformed/preview/unapproved real-recipient states make no call and leave queued truth | P0 | FULL | `13.4-UNIT-002` — `provider.atdd.test.ts:31`; `13.4-INT-002` — `email-delivery-activation.atdd.int.test.ts:46`. |
| 13.4-AC3 Activated processing preserves dedupe, disjoint claims, lease recovery, retries, and suppression-before-send | P0 | FULL | Existing real-Postgres invariants — `outbox.atdd.int.test.ts:14,27,41,61`; activated suppression/provider-zero-call proof — `email-delivery-activation.atdd.int.test.ts:60`. |
| 13.4-AC4 Authorized email preference/unsubscribe suppresses future non-essential delivery without widening essential/tenant/category scope | P0 | FULL | The preference-eligibility registry keeps `quote.delivery` active as outbox metadata while excluding it from personal preferences — `tests/unit/server/notifications/registry.test.ts:12`; direct authenticated insert/upsert rejection — `notifications.atdd.int.test.ts:126`; both ineffective controls absent — `email-preferences-email-activation.atdd.e2e.spec.ts:13`; scoped token and no-reactivation proofs — `tests/integration/rls/email-unsubscribe.atdd.rls.test.ts:15,30`; matching tenant/category/recipient suppression before provider work — `email-delivery-activation.atdd.int.test.ts:60`. |
| 13.4-AC5 Unknown/revoked/rate-limited public tokens stay generic, narrow, and outside the authenticated shell | P0 | FULL | `13.4-RLS-002` — `email-unsubscribe.atdd.rls.test.ts:43`; route IP validation — `tests/unit/server/email/unsubscribe.test.ts:4`; public-shell containment — `email-delivery-containment.atdd.test.ts:17`; browser inactive/rate-limit states — `tests/e2e/notifications/public-unsubscribe-email-activation.atdd.e2e.spec.ts:19,32`. |
| 13.4-AC6 Quote recipient is selected from linked records, normalized/frozen, immune to later CRM edits, and recipient changes cancel/re-authorize | P0 | FULL | Mandatory linked-recipient validation and lower-case normalization of case-insensitive UUID input — `tests/unit/server/commands/mark-quote-version-sent-validation.test.ts:43,57`; the real command receives uppercase quote/recipient IDs and freezes the linked address across a later CRM edit — `tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts:32`; tenant-scoped queued cancellation, old-artifact invalidation, new delivery sequence, fresh recipient snapshot, and correlated audit — same file `:95`; project-manager and sales-role authorization through `Quotes.Send` — same file `:248`. |
| 13.4-AC7 Current private PDF only, revalidated before submit, no public link, and all five terminal reminder conditions stop enqueue/send | P0 | FULL | Current/no-public-link and stale/missing/checksum/currentness rejection remain in `tests/integration/email/quote-delivery-attachment.atdd.int.test.ts:9,20,29`; terminal reminder cases remain at `tests/integration/notifications/notifications.atdd.int.test.ts:55`; and the final claimed-send terminal recheck remains at `tests/integration/email/email-delivery-activation.atdd.int.test.ts:100`. The final source uses the request-bound exact-object read first and a broker fallback only after a classified denial; the focused salesperson case `tests/integration/commands/quote-pdf-validity.int.test.ts:427` proves reserved-PDF authority while raw/general/arbitrary/cross-tenant access stays denied, and the exact checkpoint required suite passed after the ordinary Administrator request-bound regression was reversed. |
| 13.4-AC8 Prepared artifact plus quote finalization/outbox enqueue is atomic; failures leave auditable recoverable truth and never false sent | P0 | FULL | Existing success, artifact consume, malformed-byte rollback, finalization rollback, and orphaned recovery cases remain current. `tests/unit/server/email/recovery-attestation.test.ts:23,41` proves the five-minute HMAC binds every provenance field and derives independently of a malformed PDF key ID; `tests/integration/email/quote-delivery-finalization-failure.int.test.ts:269` rejects cross-tenant, spoofed-actor, and direct invalid-signature forgery, while `:320` proves tenant admin, project manager, and salesperson command failures each persist attributable recovery evidence without false send state. |

### Coverage logic validation

- All 26 final acceptance criteria have mapped current evidence and are FULL.
- P0 FULL coverage is 26/26 (100%). No criterion is credited from live evidence.
- Overlap between unit/static, database integration, and browser evidence is retained where the levels prove different boundaries: authority/state invariants, durable database effects, and user-visible isolation.
- The final ReviewBot/convergence delta contributes 13 directly mapped executing unit cases in three existing files. Mapped totals are 63 cases across 20 files: 28 unit/static, 33 API/integration/RLS, and two E2E.
- Exact focused Story 13.1 evidence at `ed43933` is 30/30 passed with zero failures/skips, plus passing typecheck, changed-file ESLint, and review-order validation. Latest prior full CI run [`36398591011`](https://github.com/rthunborg/ElproSaas/actions/runs/36398591011) at `71fa10a` remains green for the unchanged wider surface; current-source full CI is the later root gate and is not claimed here.
- The absence of a dedicated quote-send browser journey is a low-priority confidence opportunity; command/database coverage exercises every named P0 branch, so it does not reduce acceptance coverage.

## Step 4 — Coverage Gap Analysis

This final Create-mode re-gate verified the existing 26-criterion formal oracle against product source `ed439335c585bcb80e97b808d35b2378e7525e6e`, the persisted final ReviewBot convergence evidence, and the exact 30-case focused Story 13.1 execution at that source. Latest prior full CI run [`36398591011`](https://github.com/rthunborg/ElproSaas/actions/runs/36398591011) at `71fa10a` supplies broader historical regression evidence for the unchanged Epic 13 surface. Full CI at `ed43933` remains the later root gate and is not claimed as executed here.

### Coverage summary

| Priority | Total | FULL | PARTIAL | FULL coverage |
| --- | ---: | ---: | ---: | ---: |
| P0 | 26 | 26 | 0 | 100% |
| P1 | 0 | 0 | 0 | N/A |
| P2 | 0 | 0 | 0 | N/A |
| P3 | 0 | 0 | 0 | N/A |
| **Overall** | **26** | **26** | **0** | **100%** |

There are no `PARTIAL`, `NONE`, `UNIT-ONLY`, or `INTEGRATION-ONLY` matrix statuses and no uncounted live records. Every P0 acceptance criterion has direct executing evidence at the appropriate boundary.

### P0 closure evidence

1. **13.1-AC1/AC3/AC4/AC5 — byte-safe authentication and bounded, durable producer progress.** Route, auth, and runner cases prove generic side-effect-free 401 handling for multibyte mismatches, Stockholm business-date handoff, injected-clock schedule enforcement, an internal deadline around cursor discovery, exact scan and tenant/producer resume, due-ID retention across repeated deadlines, newly due tenant-zero restart, bounded follow-up and recipient pages, later-tenant fairness, retained input checkpoints on failed pages, and database lifecycle coherence for partial/failed/completed cursor states.
2. **13.4-AC6 — recipient identity and correction.** The real command accepts uppercase UUID input only after canonicalization, freezes the linked recipient, and keeps tenant-scoped cancel/reissue plus both non-admin `Quotes.Send` roles covered.
3. **13.4-AC7 — exact PDF read authority.** Current/private artifact and terminal-state checks remain current; focused evidence proves the request-bound exact-object path, the denial-only server broker fallback, and continued denial of raw/general/arbitrary/cross-tenant salesperson access.
4. **13.4-AC8 — attested durable recovery evidence.** Recovery uses a five-minute domain-separated HMAC over exact provenance, direct forgery fails, and tenant administrator, project manager, and salesperson command failures each persist attributable evidence while finalization state rolls back.

### Heuristic findings

- Endpoints without evidence: **0**.
- Auth/authz negative-path gaps: **0**.
- Happy-path/error-boundary gaps: **0**.
- Missing dedicated browser journeys: **1**, the quote-send journey spanning recipient selection through durable queued state. This is a low-priority confidence opportunity because the acceptance branches have current unit and real-database evidence.
- Missing UI states: **0**.
- Live evidence: absent and not required for this `contract_static` collection; zero live-only requirements and zero live blockers.

### Recommendations

1. Keep the AC6 recipient-correction, AC7 claimed-send recheck, and AC8 recovery-ledger cases in the required database suite when their RPC ordering changes.
2. Optionally add one production-server browser journey from linked recipient selection through truthful queued state.
3. Keep real-recipient delivery disabled until ADR-B011's separate owner go-live record and provider-contract follow-ups are complete.

### Merge-gate and advisory classification

- **Sandbox implementation trace gate:** PASS at 26/26 P0 FULL. The changed Story 13.1 boundary has 30/30 focused current-source passes plus passing static checks; broader full CI evidence is historical and current-source full CI remains the root's later gate.
- **Clock regression:** resolved. `route-auth.test.ts` now freezes time and derives expired/future values relative to that clock; the former 2026-10-01 false-failure deadline is closed. Shared E2E random fixture identifiers remain non-blocking repeatability work.
- **Convergence evidence:** the persisted Luna/xhigh re-review at `d770780` remains valid for unchanged story boundaries. The 2026-09-28 final ReviewBot convergence record covers only the changed Story 13.1 authentication/date/schedule/budget boundaries and reports PASS after the budget bypass and direct cursor regressions were repaired. This does not invent the unavailable historical whole-epic cross-model output.
- **Operational advisory:** deterministic budget/chunk/cursor mechanics, tenant ordering, queue recovery, and the AC8 recovery ledger are implemented. Numeric runtime, batch-size, fairness, backlog-age, freshness, concurrency/capacity, retention/cleanup, stale-claim timing, alerting, RTO/RPO, and backup/restore targets remain owner-pending.
- **Go-live gate:** the Vercel Pro plan and production `CRON_SECRET` prerequisites are recorded, but the deployed production revision still predates Epic 13 and has no cron definition. Post-merge scheduled-run evidence and the separate ADR-B011 real-recipient owner record remain required. See `docs/quality/epic-13-followup-gates-2026-09-27.md`.

### Phase 1 evidence summary

- Formal oracle: 26 final acceptance criteria in Stories 13.1–13.4, high confidence.
- Requirements: 26 total, 26 FULL, zero PARTIAL, zero NONE.
- Current story parsing reports all four stories and Epic 13 `done`; the accepted 2026-09-28 retrospective has zero new action items. Its older source/count snapshot is retained as historical evidence and is superseded here by the `ed43933` trace refresh.
- Final ReviewBot/convergence delta: 13 mapped executing unit cases add byte-safe cron authentication, Stockholm business-date handoff, injected-clock schedule enforcement, bounded off-schedule cursor discovery, scan-position resume, carried due-ID retention, newly due restart, partial/failed continuation, and later-tenant fairness.
- Current-source focused evidence at `ed43933`: 30 passed, zero failed/skipped; typecheck, changed-file ESLint, and review-order validation passed. Latest prior full CI run `36398591011` at `71fa10a` records 1,904 unit passes, 1,206 required integration/RLS passes plus one explicit recovery-loader skip separately covered 1/1, 172 E2E passes with four explicit skips, and successful Vercel checks. Current-source full CI is pending the root gate.
- Static containing inventory: 34 files and 189 declarations.
- Deduplicated mapped inventory: 63 active cases across 20 files; 28 unit/static, 33 API/integration/RLS, two E2E, with no mapped skip, fixme, or pending case.
- Machine-readable outputs: `_bmad-output/test-artifacts/e2e-trace-summary.json` and `_bmad-output/test-artifacts/gate-decision.json`.

## Phase 2 — Quality Gate Decision

**Gate Type:** epic

**Decision Mode:** deterministic

### GATE DECISION: PASS

**Rationale:** P0 coverage is 100% and overall coverage is 100% (minimum: 80%). No P1 requirements detected.

### Decision criteria

| Criterion | Threshold | Actual | Status |
| --- | ---: | ---: | --- |
| P0 coverage | 100% | 100% (26/26 FULL) | MET |
| P1 coverage | 90% target / 80% minimum | 100% effective because no P1 criteria exist | MET |
| Overall coverage | 80% | 100% | MET |

The gate is eligible because `allow_gate=true` and collection status is `COLLECTED`. It passes because P0 FULL coverage reaches 100% and all remaining deterministic thresholds are met. Live evidence does not affect the decision because no requirement depends on live-only verification.

### Blocking partial requirements

None.

### Final evidence summary

- Final product source: `ed439335c585bcb80e97b808d35b2378e7525e6e`; metadata head `54181ab7cf352b1255c61f57f859c9db9a19e977` adds only the refreshed Story 13.1 spec and convergence record.
- Formal P0 oracle: 26 acceptance criteria; 26 FULL, zero PARTIAL, zero NONE.
- Current-source focused execution: 30 Story 13.1 route/auth/runner cases passed with zero failures/skips; typecheck, changed-file ESLint, and review-order validation also passed.
- Latest prior full CI run [`36398591011`](https://github.com/rthunborg/ElproSaas/actions/runs/36398591011) at `71fa10a` is green across `verify`, `db`, `recovery-storage-loader`, `e2e`, and Vercel: 1,904 unit passed; 1,206 required integration/RLS passed plus one explicit recovery-loader skip separately covered 1/1; 172 E2E passed with four explicit skips. Full CI at `ed43933` is pending the root gate.
- Deduplicated mapped evidence: 63 active cases across 20 files; static containing inventory is 189 declarations across 34 files.
- Machine-readable outputs: `_bmad-output/test-artifacts/e2e-trace-summary.json` and `_bmad-output/test-artifacts/gate-decision.json`.
- Limitation: this trace PASS does not establish a post-merge production scheduled run or authorize real-recipient delivery; ADR-B011's separate go-live gate remains closed.

### Next actions

1. Preserve the AC6–AC8 regression cases in required CI.
2. Add the optional quote-send browser journey when prioritised.
3. Record the post-merge production scheduler run, approve the owner-pending operating targets, and satisfy the separate ADR-B011 go-live record before any real-recipient release.

## Workflow Completion Summary

**Gate decision:** PASS

**Coverage:** P0 26/26 FULL (100%); P1 has no criteria; overall 26/26 FULL (100%).

**Inventory:** 63 active mapped cases across 20 files (28 unit/static, 33 API/integration/RLS, two E2E); static containing inventory is 189 declarations across 34 files.

**Rationale:** P0 coverage is 100% and overall coverage is 100% (minimum: 80%). No P1 requirements detected.

**Critical gaps:** 0. The one missing dedicated quote-send browser journey remains a low-priority confidence opportunity because its acceptance branches have unit and required-database evidence.
