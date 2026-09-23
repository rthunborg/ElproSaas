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
---

# Test Design: Epic 13 - Notifications and Email Infrastructure

**Date:** 2026-09-23  
**Author:** Rasmus  
**Status:** Draft for implementation and team review  
**Design level:** Epic-level, covering Epic 13 and Stories 13.1–13.4

---

## Executive Summary

Epic 13 introduces the first privileged background-execution path in Phase B, a manifest-derived notification system, a concurrent email outbox, and the first activated public email-token surface. Story 13.4 proves sending with synthetic recipients in a sandbox or mock while real-recipient delivery remains disabled until a separate recorded owner go-live under ADR-B011.

The central test problem is the boundary between provider acceptance and durable outbox state. A crash or retry there can duplicate a customer message or record false success. This is the sole score-9 risk and requires provider-call counting plus fault injection at every state boundary. Security coverage also treats forged runner credentials, service-role containment, explicit tenant iteration, entitlement-safe content, the unsubscribe capability, quote-PDF currentness, and the default-off release control as release gates.

**Risk summary:**

- Total risks: **16**
- High-priority risks (score ≥6): **13**
- Automatic blocker (score 9): **R-1303 — duplicate send / false sent state**
- Critical categories: **Security, data integrity, operations, and customer trust**

**Coverage summary:**

- P0: **31 atomic scenario groups**, ~80–130 hours
- P1: **15 atomic scenario groups**, ~40–70 hours
- P2: **4 atomic scenario groups**, ~10–20 hours
- P3: **1 measurement baseline**, ~3–8 hours
- Total: **51 groups**, ~133–228 hours, roughly **4–7 weeks** for one test owner spread across the four stories with provider and operations support

---

## Not in Scope

| Item | Reasoning | Risk Handling |
| --- | --- | --- |
| Real-recipient email go-live | ADR-B011 requires a separate recorded owner decision after implementation and sandbox proof. | Release-control tests require default-off/no-call behavior; sandbox uses synthetic recipients only. |
| Customer portal, public quote view, or online accept/reject | Phase C exclusion; quote mail carries the current valid PDF only. | Static/public-surface scans and quote-mail content assertions fail on any public quote capability. |
| Producers or sends for pending modules | Manifest governance activates producers only with their owning module. | Registry derivation and active-flow allow-list tests reject pending/placeholder categories. |
| Invoice or marketing email | Fortnox owns invoice mail; marketing is modeled as a class but has no sending path. | Forbidden-flow source/runtime tests and provider call counters. |
| A second background runtime | ADR-B002 sanctions only Vercel Cron → `POST /api/jobs/run`. | Static scans reject pg_cron, Edge Functions, or an alternate privileged runner. |
| Provider dependency before Story 13.4 | Story 13.3 is a queued/non-sending dark pipeline. | Lockfile/source scan proves only the provider seam exists before 13.4. |
| Live supplier APIs, AI flows, broader bookkeeping integrations | Phase C ledger and Phase B hard exclusions. | Scope-manifest and forbidden-surface guardrails remain cumulative. |

---

## Risk Assessment

Probability and impact use the TEA 1–3 scales. Score = probability × impact. Scores 6–8 require mitigation; score 9 blocks release until resolved or formally waived.

### High-Priority Risks

| Risk ID | Category | Description | P | I | Score | Mitigation Summary | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| R-1301 | SEC | Forged/unverified credentials, weak secret handling, a second execution lane, or client-reachable service credentials reach privileged background work. | 2 | 3 | 6 | Permanent NFR45 negatives, timing-safe rotation tests, one-lane and source/bundle containment scans. | Dev + QA + Security | Story 13.1 |
| R-1302 | SEC | Service-context producers read or write across tenants because a query bypasses explicit tenant iteration. | 2 | 3 | 6 | Two-tenant canaries, query/write scoping assertions, foreign-row digests, system-actor audit checks. | Dev + QA + Security | Stories 13.1–13.3 |
| R-1303 | DATA | Provider acceptance plus crash/retry creates duplicate customer mail or a false `sent` state. | 3 | 3 | **9** | Unique dedupe, disjoint claims, provider call counters, response-loss/fault matrix, exact state/event assertions. | Dev + QA | Stories 13.3–13.4; blocker |
| R-1304 | OPS | Missing or malformed release configuration enables live delivery in preview or production without owner go-live. | 2 | 3 | 6 | Fail-closed default-off matrix, synthetic-recipient sandbox, provider-spy zero-call proofs. | Dev + Ops + QA | Story 13.4 + go-live |
| R-1305 | SEC | Unsubscribe tokens expose scope, allow enumeration/cross-tenant use, or bypass revocation/rate limits. | 2 | 3 | 6 | 256-bit/hash-only proofs, uniform responses, cross-tenant probes, per-token/IP rate-limit tests, public-shell isolation. | Dev + QA + Security | Story 13.4 |
| R-1306 | SEC | Notification/email bodies expose Admin-only, money, or foreign-tenant content to an unentitled recipient. | 2 | 3 | 6 | Recipient entitlement projections, exact DTO allow-lists, role/tenant canaries, cross-role negatives. | Dev + QA + Security | Stories 13.2–13.4 |
| R-1307 | DATA | Quote delivery sends a stale/invalid PDF, uses elevated Storage access, or adds a public quote link. | 2 | 3 | 6 | ADR-B008 narrow byte/currentness tests, stale/archive negatives, attachment hash, service-role/public-route scans. | Dev + QA + Security | Story 13.4 |
| R-1308 | BUS | Quote reminders continue after accept, reject, withdrawal, supersession, or expiry. | 2 | 3 | 6 | One test per stop condition, claim/send-time eligibility recheck, race/boundary coverage. | Dev + QA + Product | Story 13.4 |
| R-1309 | BUS | Scope drift activates a pending producer, duplicates Supabase Auth mail, or adds invoice/marketing delivery. | 2 | 3 | 6 | Manifest-derived registry, active-flow allow-list, forbidden-flow scans, Auth provider call counts. | Dev + QA + Scope reviewer | Stories 13.1–13.4 |
| R-1310 | DATA | Suppression, unsubscribe, preference, and essential-category rules diverge across enqueue, UI, and send. | 2 | 3 | 6 | Server-authoritative matrix, essential-disable rejection, send-time suppression check, combined-path tests. | Dev + QA | Stories 13.2–13.4 |
| R-1311 | OPS | Concurrent claims, retry exhaustion, or interruption strand work or hide failures from Admin. | 2 | 3 | 6 | Real-Postgres claim tests, fake-clock retries, stale-claim recovery contract, Admin/job correlation. | Dev + QA + Ops | Story 13.3 |
| R-1312 | PERF | An unbounded cross-tenant scan exceeds scheduler runtime, starves tenants, or creates backlog. | 2 | 3 | 6 | Work-budget/chunk/cursor/fairness tests and backlog/freshness metrics; approve numeric thresholds. | Dev + Ops + QA | Stories 13.1–13.3 |
| R-1313 | DATA | Job/audit/delivery logs are mutable, incomplete, or leak secrets/tokens while failing traceability. | 2 | 3 | 6 | Append-only/required-field tests, provider-error sanitization, secret scans, correlation checks. | Dev + QA + Security | Stories 13.1, 13.3, 13.4 |

### Medium-Priority Risks

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R-1314 | TECH | Time, schedules, retry windows, eligibility, and freshness copy become flaky or disagree at Europe/Stockholm boundaries. | 2 | 2 | 4 | Inject clocks; store UTC instants; freeze business-date boundaries; prohibit sleep-based tests. | Dev + QA |
| R-1315 | BUS | Bell count, read flips, filters, stored links, or freshness labels diverge from persisted state. | 2 | 2 | 4 | Pure view-model tests, command/read integration, and thin role-aware E2E. | Dev + QA |
| R-1316 | OPS | Provider limits/errors, bounce semantics, or sandbox behavior differ from adapter assumptions. | 2 | 2 | 4 | Select provider before final contract; characterize outcomes in sandbox; preserve provider-neutral states. | Dev + Ops + QA |

### Risk Category Legend

- **TECH:** architecture and integration fragility
- **SEC:** authentication, authorization, tenant isolation, and data exposure
- **PERF:** runtime, backlog, fairness, and scalability
- **DATA:** duplication, state integrity, artifact validity, and trace completeness
- **BUS:** customer-visible harm and scope/product correctness
- **OPS:** configuration, provider, monitoring, and recovery behavior

---

## NFR Planning

This section plans evidence for later `nfr-assess`; it does not assign final PASS/CONCERNS/FAIL status.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence for `nfr-assess` |
| --- | --- | --- | --- | --- |
| Security | `CRON_SECRET` ≥256 bits, timing-safe, current/previous rotation; all named invalid credentials return generic 401 with zero effects. | R-1301 | Unit rotation/comparison, route negatives, source/bundle containment. | CI report plus before/after DB snapshots. |
| Tenant isolation | Explicit tenant iteration; tenant/user-scoped rows; unsubscribe carries no privileged capability. | R-1302, R-1305, R-1306 | Two-tenant producer/RLS tests, foreign canaries, ADR-B004 abuse suite. | Required-stack report with zero skipped isolation cases. |
| Reliability | At most one send per logical event; suppression rechecked; retries bounded; failures recoverable and visible. | R-1303, R-1310, R-1311 | Concurrency, fault injection, fake-clock retry/exhaustion, provider counters, append-only events. | Repeat/burn-in output and persisted event snapshots. |
| Release safety | Real delivery is default-off everywhere; invalid config makes zero real-provider calls and leaves work queued. | R-1304 | Unit config matrix and integration provider spy; protected synthetic sandbox. | CI matrix and separate owner go-live record before live use. |
| Performance/scalability | Work is chunked and bounded. **UNKNOWN:** max runtime, batch size, fairness, backlog age, freshness SLO. | R-1312 | Budget/cursor tests now; measured baseline and threshold assertion after approval. | Timing/backlog metrics and approved target record. |
| Privacy/compliance | Entitlement-projected content; unsubscribe/suppression for non-essential mail; no marketing; minimal public responses. | R-1305, R-1306, R-1309, R-1310 | Role projection matrix, token uniformity, DTO allow-lists, forbidden-path scans. | Automated reports and synthetic delivery samples. |
| Data integrity | Current valid quote PDF only; each of five stop conditions blocks reminders. | R-1307, R-1308 | ADR-B008 storage/command tests and five explicit stop tests. | Attachment hash/currentness and zero-call evidence. |
| Observability | `job_runs`, Admin state, delivery events, freshness, and sanitized failures. **UNKNOWN:** alerts, event retention, stale-claim recovery time. | R-1311, R-1313 | Required-field/append-only tests, UI/read-model tests, operational threshold review. | DB snapshots, UI evidence, logs/metrics, approved thresholds. |
| Maintainability | One execution lane; manifest-derived typed registry; permanent cumulative negative suites. | R-1301, R-1309 | Manifest coherence, source ownership, lockfile timing, static/bundle/migration guards. | Unit/static CI reports and dependency diff. |

### Missing NFR Contracts

1. Maximum runner duration, chunk/batch size, per-tenant fairness rule, acceptable backlog age, and freshness/staleness thresholds.
2. Stale `sending` claim lease and recovery timing.
3. Delivery-event retention and any operational alert thresholds.
4. Selected provider's retryable/permanent response classes, idempotency facility, and delivered/bounced event contract.
5. Exact release-control configuration shape and synthetic-recipient sandbox allow-list.

---

## Entry Criteria

- [ ] Stories 13.1–13.4, ADR-B002/B004/B008/B011, and manifest scope are the accepted implementation authority.
- [ ] Epic 10 quote follow-up/PDF seams and Epic 11 Auth invitation/Admin surfaces are green and available to extend.
- [ ] The `notifications` module activates in the same change as its first live schema surface; later category/public-surface changes stay manifest-coherent.
- [ ] Local Supabase is available for required DB/RLS evidence; `SUPABASE_TEST_REQUIRED=1` reports executed/skipped counts.
- [ ] Two-tenant factories cover users, follow-ups, job runs, notifications, outbox rows, suppressions, and delivery events with cleanup.
- [ ] An injected clock, deterministic claim barrier, provider spy/fault adapter, and synthetic-recipient sandbox configuration exist.
- [ ] Provider selection and its outcome contract are recorded before 13.4 adapter tests are finalized.

## Exit Criteria

- [ ] P0 pass rate is 100%; P1 pass rate is at least 95% with explicit triage/waiver for any failure.
- [ ] R-1303's at-most-one-send/fault matrix is complete; all other score ≥6 mitigations are complete or formally waived.
- [ ] NFR45 credentials, tenant isolation, release-control no-call matrix, ADR-B004 abuse, quote-PDF currentness, five reminder stops, and forbidden-flow scans pass 100%.
- [ ] Required DB/RLS execution has zero required skips and fresh-reset catalog/manifest gates are green.
- [ ] Critical requirement and branch coverage is at least 80%; named security/release/token/reminder state matrices are fully covered.
- [ ] No open P0/P1 defect affects security, tenant isolation, duplicate delivery, PDF validity, release gating, or reminder cancellation.
- [ ] Synthetic sandbox evidence exists; real-recipient delivery remains disabled unless the separate owner go-live is recorded.
- [ ] Each in-scope NFR has an identified evidence artifact; full NFR status is deferred to `nfr-assess`.

---

## Test Coverage Plan

**P0/P1/P2/P3 indicate test priority, not execution timing.** Run all functional coverage in PRs when it stays within the target; defer only expensive sandbox, burn-in, performance, or long fault campaigns.

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

---

## Mitigation Plans

All score-6-or-higher mitigations are planned and remain release gates until their verification evidence passes or an owner records a waiver. Residual risk is low after the listed evidence passes, except R-1303, whose residual risk remains medium until repeated sandbox fault injection confirms provider behavior.

### R-1301: Privileged runner compromise (Score: 6)

**Strategy:** 1. Implement a timing-safe current/previous secret verifier with fail-closed configuration. 2. Keep the route server-only and reject every named forged credential before work begins. 3. Enforce one execution lane and scan client bundles/source for privileged credentials.  
**Owner:** Dev + Security; QA verifies. **Timeline:** Story 13.1, before merge. **Status:** Planned.  
**Verification:** `13.1-UNIT-001`, `13.1-API-001`, `13.1-API-002`, and `13.1-STATIC-001`.

### R-1302: Cross-tenant producer access (Score: 6)

**Strategy:** 1. Require explicit tenant identifiers for every service-context query/write. 2. Seed foreign-tenant canaries and capture before/after digests. 3. Assert system-actor audit attribution without granting user access.  
**Owner:** Dev + Security; QA verifies. **Timeline:** Stories 13.1–13.3, before each producer merges. **Status:** Planned.  
**Verification:** `13.1-INT-001`, `13.2-RLS-001`, and two-tenant producer suites.

### R-1303: Duplicate send or false sent state (Score: 9)

**Strategy:** 1. Enforce a durable logical-event dedupe key and disjoint database claims. 2. Persist state transitions and delivery events around the provider boundary. 3. Inject failure before, during, and after provider acceptance while counting calls. 4. Repeat the matrix under concurrency and sandbox behavior.  
**Owner:** Dev + QA. **Timeline:** Story 13.3 before dark-pipeline merge; Story 13.4 before sandbox activation. **Status:** Planned; release blocker.  
**Verification:** `13.3-INT-001`, `13.3-INT-002`, `13.3-INT-006`, `13.4-INT-002`, and `13.4-E2E-001`.

### R-1304: Unapproved live delivery (Score: 6)

**Strategy:** 1. Make missing, malformed, preview, and non-approved production configuration fail closed. 2. Keep work queued and report truthful disabled state. 3. Prove zero provider calls for every disabled combination. 4. Restrict sandbox proof to synthetic recipients.  
**Owner:** Dev + Ops; QA verifies. **Timeline:** Story 13.4 before merge and again before the separate go-live decision. **Status:** Planned.  
**Verification:** `13.4-UNIT-001`, `13.4-INT-001`, and `13.4-E2E-004`.

### R-1305: Unsubscribe capability abuse (Score: 6)

**Strategy:** 1. Store only token hashes and bind purpose/scope explicitly. 2. Return uniform responses for invalid, expired, revoked, and cross-tenant tokens. 3. Enforce per-token and per-IP limits. 4. Keep the public page outside the authenticated shell and migrate the manifest surface atomically.  
**Owner:** Dev + Security; QA verifies. **Timeline:** Story 13.4 before public route merge. **Status:** Planned.  
**Verification:** `13.4-INT-005`, `13.4-E2E-002`, and `13.4-MIG-001`.

### R-1306: Entitlement or tenant content leakage (Score: 6)

**Strategy:** 1. Build messages only from recipient-entitlement projections. 2. Use exact-field DTO allow-lists for notification and email templates. 3. Exercise every seeded role with foreign-tenant and Admin-only canaries.  
**Owner:** Dev + Security; QA verifies. **Timeline:** Stories 13.2–13.4 before each surface merges. **Status:** Planned.  
**Verification:** `13.2-INT-001`, `13.2-RLS-001`, `13.2-E2E-001`, and `13.3-UNIT-001`.

### R-1307: Invalid quote PDF delivery (Score: 6)

**Strategy:** 1. Resolve bytes through the ADR-B008 authority path at send time. 2. Reject stale, archived, invalidated, or superseded artifacts. 3. Assert attachment hash/currentness and reject public quote links or elevated Storage shortcuts.  
**Owner:** Dev + Security; QA verifies. **Timeline:** Story 13.4 before quote-email sandbox proof. **Status:** Planned.  
**Verification:** `13.4-INT-003`, `13.4-STATIC-001`, and `13.4-E2E-001`.

### R-1308: Reminder after terminal quote state (Score: 6)

**Strategy:** 1. Encode accept, reject, withdrawal, supersession, and expiry as independent stop cases. 2. Recheck eligibility at claim/send time. 3. Exercise the terminal-state race at the scheduling boundary.  
**Owner:** Dev + Product; QA verifies. **Timeline:** Story 13.4 before reminder activation. **Status:** Planned.  
**Verification:** `13.4-INT-004` and provider-spy zero-call assertions.

### R-1309: Phase B scope drift (Score: 6)

**Strategy:** 1. Derive producer/category/public-surface registries from the manifest. 2. Activate only the owning module in the same change as live schema/surface. 3. Scan for pending producers, duplicate Auth mail, invoice/marketing sends, and any fourth anonymous public surface.  
**Owner:** Dev + Scope reviewer; QA verifies. **Timeline:** Every Epic 13 story and final epic gate. **Status:** Planned.  
**Verification:** `13.2-UNIT-001`, `13.3-STATIC-001`, `13.4-STATIC-001`, and `13.4-MIG-001`.

### R-1310: Preference and suppression rule divergence (Score: 6)

**Strategy:** 1. Keep the category registry and essential flag authoritative. 2. Reject attempts to disable essential notifications server-side. 3. Evaluate preference, suppression, unsubscribe, and release state again immediately before sending. 4. Cover combined precedence paths.  
**Owner:** Dev + QA. **Timeline:** Stories 13.2–13.4 before email activation. **Status:** Planned.  
**Verification:** `13.2-INT-003`, `13.3-INT-003`, `13.4-INT-005`, and `13.4-E2E-003`.

### R-1311: Stranded or invisible queued work (Score: 6)

**Strategy:** 1. Use real-Postgres disjoint claims and bounded fake-clock retries. 2. Record the claim lease and deterministic stale-claim recovery. 3. Correlate retry exhaustion with delivery/job events and the Admin projection.  
**Owner:** Dev + Ops; QA verifies. **Timeline:** Story 13.3 before merge. **Status:** Planned; lease threshold unresolved.  
**Verification:** `13.3-INT-001`, `13.3-INT-004`, `13.3-INT-006`, and `13.3-E2E-001`.

### R-1312: Unbounded or unfair runner work (Score: 6)

**Strategy:** 1. Enforce work budgets, deterministic chunks/cursors, and per-tenant fairness. 2. Publish runner/backlog/freshness metrics. 3. Approve numeric limits before claiming performance compliance. 4. Run a pilot dataset baseline against those limits.  
**Owner:** Dev + Ops + Architect; QA measures. **Timeline:** Stories 13.1–13.3 for mechanics; before epic release for thresholds. **Status:** Planned; numeric contract unresolved.  
**Verification:** `13.1-UNIT-002` and `13.X-PERF-001`.

### R-1313: Incomplete or sensitive operational records (Score: 6)

**Strategy:** 1. Define append-only event states and required correlation fields. 2. Sanitize provider failures and prohibit secret/token fields. 3. Test mutation denial, required metadata, and source/log scans.  
**Owner:** Dev + Security; QA verifies. **Timeline:** Stories 13.1, 13.3, and 13.4 before each audit surface merges. **Status:** Planned.  
**Verification:** `13.1-INT-003`, `13.4-INT-002`, `13.4-INT-006`, and secret-scan gates.

---

## Assumptions and Dependencies

### Assumptions

1. Real-recipient delivery remains disabled throughout Epic 13 implementation and test execution; synthetic sandbox recipients are the only external targets.
2. The current Supabase Auth invitation/reset path remains the sole owner of Auth mail.
3. Business calendar calculations use `Europe/Stockholm`; persisted instants use UTC and tests inject the clock.
4. The notification registry, permissions, tenant-table inventory, and anonymous public-surface set remain manifest-derived.
5. Existing Epic 10 quote follow-up and ADR-B008 PDF authority behavior remains green while Epic 13 adds delivery.

### Dependencies

1. Epic 10 follow-up and quote-PDF seams — required before Story 13.4 integration coverage.
2. Epic 11 Auth invitation and Admin surfaces — required before Epic 13 regression sign-off.
3. Local Supabase with two-tenant factories and required-suite enforcement — required before Stories 13.1–13.4 merge.
4. Provider selection, sandbox credentials, synthetic-recipient allow-list, and documented outcome semantics — required before Story 13.4 adapter/sandbox validation.
5. Owner-approved runner, claim-lease, backlog, freshness, retention, and alert thresholds — required before final performance/operability sign-off.

### Risks to Plan

- **Provider choice or sandbox access is late.** Impact: adapter characterization and sandbox proof cannot complete. Contingency: finish provider-neutral mock/fault coverage, keep delivery disabled, and hold Story 13.4 activation.
- **Runtime and recovery thresholds remain unknown.** Impact: mechanics can be tested, but performance and stale-claim behavior cannot receive a final PASS. Contingency: retain R-1311/R-1312 as open release risks and record CONCERNS in later `nfr-assess`.
- **Required DB/E2E suites exceed the PR time budget.** Impact: feedback slows or teams are tempted to skip evidence. Contingency: optimize shared factories and parallel-safe isolation; move only measured expensive burn-in/sandbox runs to nightly.

---

## Follow-on Workflows (Manual)

- Run `/bmad-testarch-atdd` explicitly for selected P0 scenarios before story implementation.
- Run `/bmad-testarch-automate` explicitly as Epic 13 code lands, preserving the level/priority allocation in this plan.
- Run `/bmad-testarch-nfr` after implementation, thresholds, and evidence exist; this document intentionally makes no final NFR status decision.
- Use `/bmad-testarch-trace` at epic completion to confirm every story criterion, risk, and gate has evidence.

---

## Approval

This artifact is ready for implementation planning and team review. Approval remains to be recorded by Product, Tech Lead, QA, Security, and Operations, including the numeric NFR contracts. Real-recipient go-live is a separate owner decision under ADR-B011 and is not approved by this test design.

---

## Interworking & Regression

| Service / Component | Impact | Regression Scope |
| --- | --- | --- |
| Vercel Cron and `/api/jobs/run` | Adds the single privileged background lane and job observability. | Route auth negatives, one-lane scans, job-run persistence, bounded tenant iteration. |
| Supabase Postgres / RLS | Adds notification, preference, outbox, suppression, and delivery-event data. | Fresh migration reset, table/RLS inventory, two-tenant canaries, append-only/state constraints, grants. |
| Scope manifest and permissions | Activates notification/public surfaces and derives registries/guardrails. | Manifest coherence, active/pending producer set, public-surface closed set, nav/permission/category derivation. |
| Epic 10 quote lifecycle and Storage | Supplies reminder eligibility and current PDF bytes. | Existing follow-up rules, ADR-B008 artifact validity, archive/supersede/expiry races, attachment hash. |
| Epic 11 Auth and Admin | Retains Supabase Auth mail and extends Admin operational views. | Invitation/reset mail ownership, role access, Admin queue/job state, no client service-role path. |
| Email provider adapter | Adds sandbox delivery semantics only after Story 13.4. | Config fail-closed matrix, provider contract, retry/failure/bounce mapping, synthetic-recipient allow-list. |
| Public route shell | Adds unsubscribe as an ADR-B004 anonymous surface. | Uniform token responses, rate limits, cross-tenant/replay/revocation, no authenticated shell or fourth surface. |
| CI and test harness | Adds required security, DB, fault, static, and focused E2E evidence. | Zero required skips, executed/skipped counts, existing scope/security suites, PR timing measurement. |

Cross-team coordination is required between Product (essential categories and reminder rules), Architecture/Security (runner/token/storage invariants), Operations (release control, thresholds, provider sandbox), and QA/Development (fault harness, fixtures, evidence retention).

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk taxonomy, ownership, and mitigation rules
- `probability-impact.md` — probability/impact scoring model
- `test-levels-framework.md` — lowest-effective-level selection
- `test-priorities-matrix.md` — P0–P3 classification
- `nfr-criteria.md` — NFR planning and evidence expectations
- `library-integration-mandate.md`, `playwright-utils-mandate.md`, and `pactjs-utils-mandate.md` — conditional library gates
- `playwright-cli.md` and `pact-mcp.md` — optional exploration/contract tooling rules

### Related Documents

- `_bmad-output/planning-artifacts/epics-phase-b.md` — Epic 13 and Stories 13.1–13.4
- `_bmad-output/planning-artifacts/prd-phase-b.md` — FR77–FR81, NFR45–NFR47, AC-B1a-4
- `_bmad-output/planning-artifacts/architecture-phase-b.md` — background runner, notification, outbox, and public-token architecture
- `docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md`
- `docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md`
- `_bmad-output/test-artifacts/test-design-architecture.md` and `_bmad-output/test-artifacts/test-design-qa.md`

### Workflow Notes

- Execution used sequential mode because Epic 13 produces one tightly coupled artifact.
- Browser exploration was skipped because no Epic 13 UI exists yet and `playwright-cli` is unavailable.
- `@seontechnologies/playwright-utils` is absent, so the configured preference did not bind under the two-gate mandate; this plan contains no replacement code examples.
- No external consumer contract or Pact boundary exists for this same-deployment provider seam. Pact MCP was unavailable, so no broker call or contract artifact was produced.
- No managed services, branch, commit, push, or pull request were created.

---

**Generated by:** BMad TEA Agent — Test Architect Module  
**Workflow:** `bmad-testarch-test-design`  
**Version:** 4.0 (BMad v6)
