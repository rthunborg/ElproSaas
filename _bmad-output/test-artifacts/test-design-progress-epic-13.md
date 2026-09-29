---
runScope: 'epic-level'
runKey: 'epic-13'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-23'
inputDocuments:
  - _bmad/tea/config.yaml
  - _bmad-output/planning-artifacts/epics-phase-b.md
  - _bmad-output/planning-artifacts/prd-phase-b.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
  - docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md
  - docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
  - src/scope/manifest.ts
  - package.json
  - playwright.config.ts
  - vitest.config.ts
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/library-integration-mandate.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/nfr-criteria.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-cli.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-mandate.md
  - .agents/skills/bmad-testarch-test-design/resources/knowledge/pact-mcp.md
---

# Step 1: Mode and Prerequisites

- **Mode:** Epic-level test design
- **Epic:** Epic 13, Notifications and Email Infrastructure
- **Run identity:** `epic-13`
- **Requirements source:** `_bmad-output/planning-artifacts/epics-phase-b.md`, including Stories 13.1 through 13.4 and their acceptance criteria
- **Architecture context:** `_bmad-output/planning-artifacts/architecture-phase-b.md` and `docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md`
- **Prerequisite result:** Satisfied
- **Checkpoint disposition:** Fresh run; no prior `test-design-progress-epic-13.md` existed

# Step 2: Loaded Context

## Configuration and Stack

- `tea_use_playwright_utils: true`, but `@seontechnologies/playwright-utils` is absent from `package.json` and the lockfile. The two-gate mandate therefore does not bind generated tests; existing vanilla Playwright patterns require the established one-line deviation note where applicable.
- `tea_use_pactjs_utils: true`, but neither Pact package/artifacts nor an independently deployable consumer/provider boundary exists. Contract scaffolding is outside this epic plan.
- `tea_pact_mcp: mcp`; one tool-list probe found no SmartBear Pact MCP tools, so `pact_mcp_reachable: false`. No broker call was attempted.
- `tea_browser_automation: auto`; `playwright-cli` is unavailable. Browser exploration was skipped because the Epic 13 surface is not implemented and there was no feature URL to inspect.
- Detected stack: full-stack Next.js/React/TypeScript with Supabase Postgres/Auth/Storage, Node test for pure unit suites, Vitest for DB/RLS integration, and Playwright for browser journeys.
- Test artifact root: `_bmad-output/test-artifacts`.

## Requirements and Integration Points

- Story 13.1: one `POST /api/jobs/run` front door; timing-safe current/previous `CRON_SECRET`; permanent forged/unsigned/none-alg JWT, garbage, missing, and wrong-secret zero-side-effect negatives; bounded chunking; explicit per-tenant iteration; system-actor audits; `job_runs`; Admin visibility.
- Story 13.2: manifest-derived category/producer registry; `quote.follow_up_due`; tenant/user-scoped notifications and preferences; server-enforced essential categories; persisted deep links; bell/popover/center/preferences UI; run-log freshness; entitlement-projected content.
- Story 13.3: tenant-scoped outbox, append-only delivery events, suppression, SKIP LOCKED claiming, dedupe, retry/backoff, and an enforced queued/non-sending posture with no provider dependency.
- Story 13.4: provider adapter with sandbox/mock proof; fail-closed default-off real-recipient gate; active-module flow allow-list; no duplicate Supabase Auth mail; current valid quote PDF attachment through the ADR-B008 narrow path; five reminder stop conditions; no invoice/marketing/public quote path; ADR-B004 unsubscribe token surface and abuse suite.
- Governing NFRs: NFR45 background authentication, NFR46 closed-set public token safety, and NFR47 reliable/idempotent entitlement-safe notification/email delivery.
- Existing dependencies: Epic 10 quote follow-up and PDF/currentness seams; Epic 11 Auth invitation/security mail and Admin surfaces; scope manifest coherence; command/audit envelope; tenant factories and table-inventory RLS gates.

## Existing Coverage and Gaps

- Reusable coverage exists for quote follow-up lifecycle and UI, quote-PDF validity/immutability and narrow byte authority, Auth invitation/recovery mail, service-role source/bundle containment, manifest/public-surface coherence, local-only two-tenant factories, and production-server Playwright journeys.
- No Epic 13 implementation or direct tests exist for runner authentication, producers, notifications/preferences, job runs, outbox concurrency, suppression, delivery events, provider release control, sandbox sending, or unsubscribe behavior. The `notifications` manifest module is still `pending` with empty live-surface arrays.
- DB/RLS suites visibly skip when the local stack is unavailable and hard-fail under `SUPABASE_TEST_REQUIRED=1`; Epic 13 release evidence must use the required mode and report executed/skipped counts.
- Existing flaky/deferred areas include retry-specific quote E2E specs and historical red-phase skips outside Epic 13. Epic 13 should keep async logic below the UI, use deterministic clocks/backoff seams, unique per-test tenants/entities, and thin serial E2E coverage.
- Playwright uses a production build, one worker, retry-on-CI, and shared seeded fixtures. Unit and integration coverage should carry concurrency, idempotency, and security proofs so E2E remains limited to user-visible wiring.

# Step 3: Risk and NFR Assessment

## Risk Matrix

Probability and impact use the TEA 1–3 scales. Scores 6–8 require mitigation; score 9 blocks release until resolved or formally waived.

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| R-1301 | SEC | A forged/unverified token, weak cron comparison, alternate execution lane, or client-reachable service credential reaches privileged background execution. | 2 | 3 | 6 | Permanent NFR45 zero-side-effect negative suite; timing-safe current/previous secret tests; reject all JWT anti-patterns; source/bundle containment and one-lane scans. | Dev + QA + Security | Story 13.1, before merge |
| R-1302 | SEC | Service-context producers read or write across tenants because an unscoped query bypasses explicit tenant iteration. | 2 | 3 | 6 | Two-tenant producer fixtures, per-query tenant assertions/canaries, foreign-row before/after proofs, system-actor audit assertions, and review/static checks around the jobs boundary. | Dev + QA + Security | Stories 13.1–13.3 |
| R-1303 | DATA | A crash/retry around provider acceptance and outbox state causes duplicate customer mail or a false `sent` state. | 3 | 3 | 9 | Unique dedupe keys, concurrent claim tests, fault injection before/after provider acceptance and message-id persistence, response-loss replay, one-call counters, and exact state/event assertions. | Dev + QA | Stories 13.3–13.4; release blocker |
| R-1304 | OPS | Missing or malformed release configuration enables real-recipient delivery in preview or production without the separate owner go-live. | 2 | 3 | 6 | Fail-closed default-off control tested across absent/invalid/false config; synthetic-recipient allow-list in sandbox; provider-spy proof of zero calls; deployment-config matrix and go-live evidence outside story completion. | Dev + Ops + QA | Story 13.4 and later go-live |
| R-1305 | SEC | Unsubscribe tokens leak scope, permit tenant enumeration, accept revoked/unknown tokens differently, or bypass rate limits. | 2 | 3 | 6 | 256-bit generation/hash-only persistence proofs; valid/reuse/revoked/unknown/rotated uniformity; cross-tenant probes; per-token/per-IP-hash rate-limit trip; minimal public-shell import scan. | Dev + QA + Security | Story 13.4 |
| R-1306 | SEC | Notification or email content exposes Admin-only/customer money or other tenant data to an unentitled recipient. | 2 | 3 | 6 | Role/tenant canaries; build bodies from recipient entitlement projections; exact DTO/key allow-lists; cross-role/cross-tenant negatives for in-app and email render paths. | Dev + QA + Security | Stories 13.2–13.4 |
| R-1307 | DATA | Quote delivery attaches a stale/invalid PDF, uses elevated Storage access, or introduces a public quote view/accept path. | 2 | 3 | 6 | Reuse ADR-B008 currentness/attestation authority; authorized narrow byte-access tests; stale/invalidated/archive negatives; attachment byte/hash assertions; service-role/public-route scans. | Dev + QA + Security | Story 13.4 |
| R-1308 | BUS | Quote reminders continue after accept, reject, withdrawal, supersession, or expiry and repeatedly contact a customer. | 2 | 3 | 6 | One deterministic test per stop condition plus retry/time-boundary cases; eligibility rechecked at claim/send time; dedupe and cancellation events asserted. | Dev + QA + Product | Story 13.4 |
| R-1309 | BUS | Scope drift activates a pending-module producer, duplicates Supabase Auth mail, or introduces invoice/marketing mail. | 2 | 3 | 6 | Manifest-derived registry tests, active-flow allow-list, forbidden-flow source/runtime scans, provider call counts around Auth invitation, and explicit invoice/marketing negatives. | Dev + QA + Scope reviewer | Stories 13.1–13.4 |
| R-1310 | DATA | Suppression, unsubscribe, channel preference, or essential-category rules diverge across enqueue, UI, and send time. | 2 | 3 | 6 | Server-authoritative preference matrix; essential-disable rejection; suppression recheck immediately before provider call; end-to-end preference/unsubscribe/suppression combinations. | Dev + QA | Stories 13.2–13.4 |
| R-1311 | OPS | Concurrent claims, exhausted retries, or process interruption strand rows in `sending` or hide failures from Admin. | 2 | 3 | 6 | Real-Postgres SKIP LOCKED tests; deterministic clock/backoff; stale-claim recovery contract; retry exhaustion and admin visibility; job/outbox event correlation. | Dev + QA + Ops | Story 13.3 |
| R-1312 | PERF | An unbounded cross-tenant scan exceeds the scheduler invocation budget, starves tenants, or creates backlog. | 2 | 3 | 6 | Injectable work budget; chunk/cursor boundary unit and integration tests; fair tenant iteration; backlog/freshness metrics. Resolve numeric batch/runtime/backlog thresholds before exit. | Dev + Ops + QA | Stories 13.1–13.3 |
| R-1313 | DATA | Delivery events or job/audit logs are mutable, incomplete, or contain secrets/raw tokens while still failing to provide the required trace. | 2 | 3 | 6 | Append-only DB negatives; required-field contract tests; secret/token/copy scans; provider error sanitization; correlation across job, outbox, and delivery events. | Dev + QA + Security | Stories 13.1, 13.3, 13.4 |
| R-1314 | TECH | Time, schedules, retry windows, reminder eligibility, and freshness copy become flaky or disagree at Europe/Stockholm boundaries. | 2 | 2 | 4 | Injected clock; UTC instants plus explicit business-date conversion; frozen boundary fixtures; no sleep-based tests. | Dev + QA | Stories 13.1–13.4 |
| R-1315 | BUS | Bell count, read flips, filters, stored deep links, or freshness labels diverge from persisted server state. | 2 | 2 | 4 | Pure view-model tests, integration tests for mark-one/mark-all and stored routes, thin E2E for every role, retry/reconciliation after optimistic failure. | Dev + QA | Story 13.2 |
| R-1316 | OPS | Provider-specific limits/errors, bounce semantics, or sandbox behavior differ from the adapter assumptions. | 2 | 2 | 4 | Select provider before adapter contract finalization; characterize retryable/non-retryable responses and message ids; sandbox contract tests with synthetic recipients; retain provider-neutral state transitions. | Dev + Ops + QA | Story 13.4 |

## NFR Planning

| Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| --- | --- | --- | --- | --- |
| Security | `CRON_SECRET` is at least 256 bits, server-only, timing-safe, supports bounded current/previous rotation; named bad credentials return generic 401 with zero side effects. | R-1301 | Unit comparison/rotation tests, route integration negatives, source and built-bundle containment. | CI reports plus before/after DB snapshots for every negative. |
| Security / Isolation | Every producer explicitly iterates tenants and every notification/outbox row remains tenant/user scoped; public unsubscribe has no privileged capability. | R-1302, R-1305, R-1306 | Two-tenant RLS/producer integration, foreign-canary checks, ADR-B004 abuse suite. | Required local-stack report with zero skipped RLS cases. |
| Reliability | One logical event yields at most one provider send; suppression is rechecked; retries are bounded; failures remain inspectable. | R-1303, R-1310, R-1311 | Postgres concurrency, fault injection, deterministic backoff/exhaustion, provider call counters, append-only event checks. | Repeatable integration/sandbox reports and persisted event snapshots. |
| Release Safety | Real delivery is default-off in every deployment and invalid config makes zero real-provider calls while work stays queued. | R-1304 | Config matrix and provider spy at unit/integration levels; isolated sandbox uses synthetic recipients only. | CI matrix plus separately recorded go-live evidence before any real recipient. |
| Performance / Scalability | Work is chunked and bounded per invocation. Numeric max runtime, batch size, tenant fairness, acceptable backlog age, and freshness SLO are **UNKNOWN**. | R-1312 | Budget/cursor tests now; measured local/staging baseline and threshold assertion after Product/Ops set targets. | Timing/backlog metrics and approved thresholds. |
| Privacy / Compliance | Email/notification content is entitlement-projected; non-essential email honors unsubscribe/suppression; no marketing path; public responses minimize data. | R-1305, R-1306, R-1309, R-1310 | Role projection matrix, token uniformity, exact response/DTO allow-lists, forbidden-path scans. | Automated reports and inspected delivery event samples with synthetic data. |
| Data Integrity | Quote mail uses the current valid snapshot-derived PDF; five terminal/superseding conditions stop reminders. | R-1307, R-1308 | ADR-B008 integration/storage tests; five explicit stop-condition tests; claim/send-time revalidation. | Attachment hash/currentness evidence and reminder call counts. |
| Observability | `job_runs`, Admin queue/failure state, delivery events, and freshness stamps expose execution without leaking secrets. Alert threshold, delivery-event retention, and stale-`sending` recovery timing are **UNKNOWN**. | R-1311, R-1313 | Required-field/append-only tests, sanitized error tests, admin read-model/UI tests, operational threshold review. | DB snapshots, UI evidence, logs/metrics with approved thresholds. |
| Maintainability | One execution lane, typed manifest-derived producer/category registry, and cumulative permanent negative suites. | R-1301, R-1309 | Manifest coherence/derivation, source ownership, dependency timing, containment and forbidden-surface scans. | Unit/static CI reports and final dependency diff. |

## Highest-Risk Summary

- **R-1303 (score 9)** is the only automatic blocker: provider acceptance plus process/state failure can duplicate a real customer message. Its fault-injection and one-call proofs must land before sandbox activation.
- Security isolation, the default-off live-delivery gate, unsubscribe abuse resistance, entitlement projection, quote-PDF currentness, reminder cancellation, and scope allow-listing all score 6 and require completed automated mitigations before Epic 13 exits.
- Numeric runtime/backlog/freshness targets, stale-claim recovery timing, delivery-event retention, and provider-specific retry/bounce behavior remain explicit unknowns. The stories can build deterministic seams now, but exit requires recorded thresholds/contracts where the acceptance criteria depend on them.

# Step 4: Coverage and Execution Plan

## P0 — Critical

| Test ID | Requirement / Atomic Scenario | Level | Risk Link | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 13.1-UNIT-001 | Secret verifier accepts current/previous only during the configured rotation window, compares timing-safe, rejects malformed configuration, and never logs/returns secret material. | Unit | R-1301 | Dev + QA | Inject config and clock. |
| 13.1-API-001 | Missing secret, wrong secret, garbage bearer, forged signed-looking JWT, unsigned JWT, and `alg:none` JWT each return the same generic 401 with zero `job_runs`, audits, notification, or outbox effects. | Route integration | R-1301 | Dev + QA + Security | Permanent NFR45 parameterized suite with before/after counts. |
| 13.1-API-002 | Current secret and rotation-window previous secret invoke exactly one runner dispatch; expired previous secret is rejected. | Route integration | R-1301 | Dev + QA | Provider/producer spies remain server-side. |
| 13.1-UNIT-002 | Due-work selection, chunk cursor, budget stop, resume, and fair tenant iteration are deterministic and never assume a full scan finishes in one invocation. | Unit | R-1312, R-1314 | Dev + QA | No wall-clock sleeps. |
| 13.1-INT-001 | A producer explicitly iterates two tenants, emits only tenant-scoped queries/writes, and leaves foreign canary rows byte-unchanged. | DB integration | R-1302 | Dev + QA + Security | Service context is setup authority, not assertion shortcut. |
| 13.1-INT-002 | Producer writes create system-actor audits with null actor plus exact producer command and correlation; user-actor semantics remain unchanged. | DB integration | R-1302, R-1313 | Dev + QA | Assert rollback with domain failure. |
| 13.1-INT-003 | `job_runs` records producer/window/start/finish/outcome/sanitized error for success, partial chunk, and failure without secrets. | DB integration | R-1311, R-1313 | Dev + QA | Append-only or otherwise mutation-protected per final schema. |
| 13.1-STATIC-001 | Exactly one background front door exists; no unverified JWT decode, `verify_jwt=false` privileged path, pg_cron, Edge Function, alternate runner, or client import of `src/server/jobs/**` exists. | CI/static/bundle | R-1301 | Dev + Security | Red/green canaries required. |
| 13.1-MIG-001 | Fresh reset creates and enrolls `job_runs` with exact constraints, grants, policies, indexes, H4 inventory, and active manifest activation in the same change. | Migration/catalog | R-1301, R-1302 | Dev + QA + Scope reviewer | `SUPABASE_TEST_REQUIRED=1`, zero skip. |
| 13.2-UNIT-001 | Producer/category union is derived from manifest-active modules plus sanctioned command emitters; pending/duplicate/placeholder categories fail; essential/default semantics are single-source. | Unit/manifest | R-1309, R-1310 | Dev + QA + Scope reviewer | Includes `quote.follow_up_due`. |
| 13.2-INT-001 | Emit stores tenant, recipient user, category, title/body, route computed at emit time, and unread state from the recipient entitlement projection. | Command/DB | R-1306, R-1315 | Dev + QA | Seed role-specific money canaries. |
| 13.2-RLS-001 | Own-user/own-tenant reads and authorized emit/mark operations work; other user, other tenant, anonymous, raw direct writes, and privilege escalation are denied with unchanged foreign rows. | RLS integration | R-1302, R-1306 | Dev + QA + Security | Extend table inventory and role matrix. |
| 13.2-INT-002 | Follow-up scan retry/concurrency produces one due notification per logical subject/period and preserves terminal follow-up behavior. | DB/concurrency | R-1303 | Dev + QA | Consume Epic 10 data; no email side effect. |
| 13.2-INT-003 | Server rejects disabling essential categories, persists non-essential channel preferences per user, and resolves absent-row defaults consistently. | Command/DB | R-1310 | Dev + QA | UI disablement is secondary evidence. |
| 13.2-INT-004 | Mark-one and mark-all mutate only the current user's rows; replay is idempotent and an injected failure reconciles optimistic state to DB truth. | Command/DB | R-1315 | Dev + QA | Exact unread-count transitions. |
| 13.2-MIG-001 | Fresh reset creates/enrolls notification tables, constraints and policies; manifest activation includes `/notifications`, active categories, and no undeclared live surface. | Migration/manifest | R-1302, R-1309 | Dev + QA + Scope reviewer | Same-change activation gate. |
| 13.3-MIG-001 | Fresh reset creates/enrolls outbox, delivery-event, suppression, and optional dark unsubscribe-token schema with exact state/unique/FK/index/grant/policy contracts. | Migration/catalog | R-1303, R-1310, R-1313 | Dev + QA | No public unsubscribe route yet. |
| 13.3-INT-001 | Concurrent workers using real Postgres `FOR UPDATE SKIP LOCKED` claim disjoint rows and process every eligible row once. | DB/concurrency | R-1303, R-1311 | Dev + QA | Barrier-controlled, repeated/burn-in capable. |
| 13.3-INT-002 | Dedupe key uniqueness holds for category + subject + period under replay/concurrency; collisions map to deterministic reconciliation instead of a second row/send. | DB/concurrency | R-1303 | Dev + QA | Same and different tenant cases. |
| 13.3-INT-003 | Suppressed recipients/categories become `suppressed` before any provider seam invocation and append a delivery event; removal affects only later eligible work. | Command/DB | R-1310 | Dev + QA | Provider spy call count zero. |
| 13.3-INT-004 | Retryable failure schedules bounded exponential backoff, terminal failure exhausts deterministically, and Admin/job-run visibility shows sanitized cause. | Integration/fake clock | R-1311, R-1314 | Dev + QA | Numeric retry contract must be recorded by story. |
| 13.3-INT-005 | Dark pipeline leaves eligible rows `queued`, never transitions to `sent`, has no provider call/dependency path, and still renders entitlement-safe template input. | Integration/static | R-1304, R-1306 | Dev + QA | Story 13.3 release posture. |
| 13.3-STATIC-001 | Story 13.3 dependency/source graph contains only the provider seam: no SDK/SMTP package, live credential name, public unsubscribe route, or real-recipient call. | CI/static/lockfile | R-1304, R-1309 | Dev + QA | Bite test catches a seeded forbidden import. |
| 13.4-UNIT-001 | Release-control matrix defaults off and treats missing, malformed, preview, or unapproved deployment/flow/recipient config as disabled. | Unit | R-1304 | Dev + QA + Ops | No permissive fallback. |
| 13.4-INT-001 | Disabled/malformed release config makes zero real-provider calls and leaves work queued with truthful status/event output. | Integration/provider spy | R-1304 | Dev + QA | Every deployment mode represented. |
| 13.4-INT-002 | Sandbox/mock synthetic send proves queued→sending→sent, persists provider message ID before sent, and records one complete delivery event; injected failures at each boundary never duplicate a provider call or claim false success. | Fault-injection integration | R-1303, R-1311, R-1313 | Dev + QA | Score-9 release blocker. |
| 13.4-INT-003 | Quote mail reads only the current valid snapshot PDF through the ADR-B008 narrow byte path, attaches matching bytes/hash, and rejects invalidated, stale, archived, missing, mismatched, or elevated-access attempts with no send. | Storage/command integration | R-1307 | Dev + QA + Security | Body contains no public quote/accept/reject URL. |
| 13.4-INT-004 | Accept, reject, withdrawal, superseding version, and expiry each independently cancel reminder eligibility before claim and again before provider call; boundary races still send zero reminders. | Integration/fake clock | R-1308 | Dev + QA + Product | Five named cases are individually visible. |
| 13.4-INT-005 | Unsubscribe valid/reuse/revoked/rotated/unknown tokens, cross-tenant probes, uniform responses, hash-only storage, resubscribe, and per-token/per-IP-hash rate-limit trip satisfy ADR-B004. | Public route/DB integration | R-1305, R-1310 | Dev + QA + Security | Synthetic tokens; exact body override rejection. |
| 13.4-STATIC-001 | Provider-call allow-list includes only active-module flows; no pending producer, duplicate Supabase Auth mail, invoice/marketing send, fourth public surface, public quote route, or service-role Storage bypass ships. | CI/static/manifest/bundle | R-1307, R-1309 | Dev + QA + Scope reviewer | Source and runtime registry assertions. |
| 13.4-MIG-001 | Fresh reset activates `unsubscribe` in the manifest and creates any deferred token objects with exact grants/policies/indexes while the public-surface union remains the ADR-B004 closed set. | Migration/manifest | R-1305, R-1309 | Dev + QA + Scope reviewer | Required stack, zero skip. |

**Total P0:** 31 atomic scenario groups, ~80–130 hours.

## P1 — High

| Test ID | Requirement / Atomic Scenario | Level | Risk Link | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 13.1-INT-004 | Producer failure and last-run recency are projected to Admin from `job_runs`, including never-run/stale/partial/failure states. | Read-model integration | R-1311, R-1313 | Dev + QA | Threshold-backed stale state once defined. |
| 13.2-UNIT-002 | Bell/center view models cap count at `9+`, order latest items, group/filter categories from the registry, and format deterministic freshness/read state. | Unit | R-1315 | Dev + QA | Pure logic only. |
| 13.2-E2E-001 | Every seeded role sees the bell, correct unread count/latest items, can mark one/all read, and never sees another user/tenant's canary. | E2E | R-1306, R-1315 | QA + Dev | Thin presentation proof. |
| 13.2-E2E-002 | `/notifications` category/read/date filters work and a stored deep link navigates to the intended entitled route while marking read. | E2E | R-1315 | QA + Dev | Never recompute route client-side. |
| 13.2-E2E-003 | Preferences persist by category/channel; essential controls are disabled with explanation; email column is inactive until deployment sending is enabled. | E2E | R-1310 | QA + Dev | Server rejection already covered at integration. |
| 13.2-E2E-004 | Failed optimistic read mutation shows recoverable failure and restores server truth after retry/reload. | E2E | R-1315 | QA + Dev | No hidden false success. |
| 13.3-UNIT-001 | Template builder accepts only entitlement-projected DTOs and emits stable template key/version/params without Admin-only or raw-secret fields. | Unit | R-1306, R-1313 | Dev + QA | Exact-key contract. |
| 13.3-INT-006 | An interrupted/stale `sending` claim recovers once under the recorded lease/timing contract without duplicate provider calls. | Fault-injection integration | R-1303, R-1311 | Dev + QA | Blocked until lease/recovery threshold is recorded. |
| 13.3-E2E-001 | Admin queue/failure view truthfully shows queued/suppressed/failed/retry state and last-run freshness without offering live-send activation. | E2E | R-1311 | QA + Dev | Story 13.3 dark posture. |
| 13.4-UNIT-002 | Sender identity, tenant Reply-To, subject convention, transactional class, template version, and complete delivery metadata are derived deterministically; per-tenant From domain is absent. | Unit | R-1313, R-1316 | Dev + QA | Synthetic tenant identities. |
| 13.4-CONTRACT-001 | Selected provider adapter maps acceptance/message ID, retryable failures, permanent failures, bounce/delivery outcomes, and idempotency header/key according to the provider contract. | Adapter contract/sandbox | R-1303, R-1316 | Dev + QA + Ops | Finalize after provider selection; Pact is not required for this same-deploy seam. |
| 13.4-INT-006 | Delivery events contain every N-6 field, preserve append-only history for sent/failed/delivered/bounced, and sanitize provider error payloads. | DB integration | R-1313, R-1316 | Dev + QA + Security | Define nullable fields per outcome. |
| 13.4-E2E-001 | From the quote UI, an entitled internal user queues one synthetic customer quote mail; sandbox evidence shows current PDF attachment and no public acceptance link or duplicate on retry. | E2E + sandbox | R-1303, R-1307 | QA + Dev | Protected job; synthetic address only. |
| 13.4-E2E-002 | Public unsubscribe and resubscribe presentation is accessible, generic for invalid/revoked tokens, and does not load authenticated shell/tenant navigation. | E2E | R-1305 | QA + Dev | Abuse authority stays at integration level. |
| 13.4-E2E-003 | Enabled email preference round-trip influences later eligible synthetic mail; unsubscribe/suppression wins over the UI preference. | E2E + integration assertion | R-1310 | QA + Dev | Assert persisted result and provider call count. |

**Total P1:** 15 atomic scenario groups, ~40–70 hours.

## P2 — Medium

| Test ID | Requirement / Atomic Scenario | Level | Risk Link | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 13.2-E2E-005 | Bell popover shows approximately the latest ten with `Visa alla`, semantic labels, keyboard operation, focus return, and non-color read state. | E2E/accessibility | R-1315 | QA + Dev | Logic counts stay in unit tests. |
| 13.2-E2E-006 | Empty, never-run, loading, and stale-freshness presentation uses honest copy and does not imply realtime processing. | E2E | R-1311 | QA + Dev | Exact wording follows implemented Swedish copy. |
| 13.4-E2E-004 | Disabled delivery explains unavailability consistently in settings, Admin queue, and send entry points; no success copy appears. | E2E | R-1304 | QA + Dev | Presentation only. |
| 13.4-E2E-005 | Sender/Reply-To/tenant identity/subject/template rendering is readable in sandbox output across representative tenant names and Unicode addresses. | Sandbox presentation | R-1316 | QA + Dev | No real recipients. |

**Total P2:** 4 atomic scenario groups, ~10–20 hours.

## P3 — Low / Measurement

| Test ID | Requirement / Atomic Scenario | Level | Owner | Notes |
| --- | --- | --- | --- | --- |
| 13.X-PERF-001 | Measure runner throughput, per-tenant fairness, outbox claim latency, backlog age, and Admin freshness at a documented pilot dataset. | Performance baseline | QA + Ops + Architect | No PASS/FAIL claim until numeric thresholds are approved. |

**Total P3:** 1 baseline, ~3–8 hours.

## NFR Coverage and Evidence

- **Security:** P0 route/RLS/storage/public-token/static suites; evidence is required-stack CI output, before/after row digests, containment reports, and ADR-B004 uniform-response/rate-limit results.
- **Reliability/data integrity:** P0 concurrency/fault-injection/dedupe/suppression/reminder/PDF suites; evidence is provider call counts, persisted state/event snapshots, repeat/burn-in results, and sandbox synthetic-message IDs.
- **Release safety:** configuration matrix plus provider-spy no-call proofs in PR, then a protected sandbox job; the later owner go-live record remains separate evidence.
- **Performance/scalability:** deterministic chunk/budget coverage now, `13.X-PERF-001` after numeric limits are set. Unknown runtime, batch, fairness, backlog-age, and freshness targets prevent a final performance PASS claim.
- **Observability:** `job_runs`, outbox state, delivery events, sanitized failures, and Admin surfaces. Alert/stale-claim/retention thresholds remain required contract inputs.
- **Maintainability/scope:** manifest derivation, one-lane/source ownership, dependency timing, migration reset, static/bundle scans, and cumulative permanent security suites.

## Execution Strategy

- **PR (<15 min target):** all unit/static/manifest tests; migration reset and focused DB/RLS/concurrency/fault suites with `SUPABASE_TEST_REQUIRED=1`; provider mock/config matrix; focused thin E2E. Fail if required suites skip.
- **Nightly / protected integration:** concurrency burn-in, full Epic 13 E2E, fault matrix, and selected-provider sandbox against synthetic recipients only. Store sandbox provider/message metadata as evidence.
- **Weekly / pre-go-live:** backlog/fairness/performance baseline, rate-limit/abuse repetition, stale-claim recovery, provider sandbox re-proof, and release-control matrix. No real-recipient test occurs without the separate recorded owner go-live.

## Resource Estimate

| Priority | Groups | Effort Range | Main Work |
| --- | ---: | --- | --- |
| P0 | 31 | ~80–130 hours | Security/RLS/migration harness, Postgres concurrency, fault injection, release gate, token abuse, PDF/reminder/scope proofs. |
| P1 | 15 | ~40–70 hours | User/Admin journeys, recovery, provider adapter contract, complete event metadata, sandbox quote flow. |
| P2 | 4 | ~10–20 hours | Accessibility and truthful secondary presentation. |
| P3 | 1 | ~3–8 hours | Pilot-scale measurement after thresholds are approved. |
| **Total** | **51** | **~133–228 hours** | Roughly 4–7 weeks for one test owner, spread across four implementation stories and provider/ops support. |

## Quality Gates

- P0 pass rate: **100%**; P1 pass rate: **≥95%** with explicit triage/waiver for any failure.
- R-1303 fault-injection and at-most-one-send mitigation: **100% complete** before sandbox activation; every other score ≥6 mitigation complete or formally waived before epic release.
- NFR45 invalid-credential suite, tenant-isolation/RLS, release-control no-call matrix, ADR-B004 abuse suite, quote-PDF currentness, five reminder-stop tests, and forbidden-flow/surface scans: **100% pass**.
- Critical requirement/branch coverage target: **≥80%**, with 100% scenario coverage for named security credentials, public-token states, release-control states, and reminder stop conditions.
- Required DB/RLS runs report executed/skipped counts with **zero required skips**.
- No real-recipient call is admissible as test evidence before the separate owner go-live; sandbox uses synthetic recipients.
- Final NFR PASS/CONCERNS/FAIL is deferred to `nfr-assess` after implementation evidence and missing thresholds exist.

# Step 5: Output and Validation

- **Mode:** Sequential epic-level generation; one coupled output document.
- **Output:** `C:\DEV\ElproSaas\_bmad-output\test-artifacts\test-design-epic-13.md`
- **Result:** Complete risk matrix, NFR plan, P0–P3 coverage, mitigation ownership/timelines, assumptions/dependencies, execution strategy, quality gates, regression map, and handoff notes.
- **Key release gates:** score-9 R-1303 duplicate-send fault matrix; all score ≥6 mitigations; NFR45 credentials; two-tenant isolation; default-off provider no-call matrix; ADR-B004 token abuse; current quote PDF; five reminder stop states; manifest/scope scans; zero required test skips.
- **Open contracts:** numeric runner/batch/fairness/backlog/freshness thresholds; stale-claim lease; event retention/alerts; selected-provider outcome/idempotency contract; exact release-control and synthetic-recipient configuration.
- **Tooling decisions:** browser exploration skipped because the UI is not implemented and `playwright-cli` is unavailable; Playwright-utils mandate did not bind because the package is absent; Pact was not applicable to a same-deployment adapter seam and Pact MCP was unavailable.
- **Validation:** Epic-level single artifact uses the workflow template structure, links each risk to planned evidence, preserves priority/execution separation, uses range estimates, and defers final NFR status to `nfr-assess`.
- **Completion date:** 2026-09-23.
