---
workflowStatus: completed
runScope: epic-level
runKey: epic-15
epic: 15
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: step-05-generate-output
nextStep: ''
lastSaved: 2026-10-09
inputDocuments:
  - _bmad-output/planning-artifacts/epics-phase-b.md
  - _bmad-output/planning-artifacts/prd-phase-b.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
  - _bmad-output/implementation-artifacts/epic-14-retro-2026-10-08.md
  - docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md
  - _bmad-output/test-artifacts/test-design-epic-14.md
  - src/scope/manifest.ts
  - _bmad/tea/config.yaml
---

# Test Design: Epic 15 — Scheduling Views, Time Reporting, and Calendar Feeds

**Date:** 2026-10-09  
**Author:** BMAD TEA delegate for Rasmus  
**Status:** Draft planning deliverable complete; approval and execution remain pending.  
**Scope:** Epic-level, Stories 15.1–15.6; FR87–92, AC-B1b-1/2/7, NFR46/48/53.

## Executive Summary

The plan covers five projections of shared bookings, bounded materialized recurrence, conflict resolution, submitted-only time reports, a minimal personal iCalendar capability feed, and connected Min Dag. It defines 54 named scenario families: 20 P0, 28 P1, 5 P2 and 1 P3. Parameterized fixture cases extend those families; these counts are planning inventory, not executed tests or coverage credit. Estimated test development and fixture work is 102–170 hours, roughly 3–5 engineer-weeks including coordination.

There are 13 risks, 10 high (score 6), three medium (score 4), and no asserted critical score-9 risk. Security and transactional risks receive Sol High planning. Actual real-host click/drag acceptance is mandatory before Story 15.1 exposure/completion. UXB-A9 is resolved for Epic 15 by the direct owner disposition on 2026-10-09: proceed with product recommendations and best practices without further Lovable observation. Recommended Team grouping is arbetsroll, consistent with the existing PRD; no named-team entity or new scope is authorized. There are zero oracle observations and no legacy parity claim.

The October 8 Epic 14 retrospective is accepted-with-open-items. Its source-head execution establishes resource/editor foundations but does not prove Epic 15 behavior. The October 7 rejected retrospective remains historical. Representative performance targets, manual accessibility/daylight/exploration, and 44 maintenance advisories remain open; this plan does not relabel them as complete.

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Phase C AI/optimization, native mobile, durable offline/PWA/queues, portal/customer signing, live vendor APIs | Hard ledger exclusions; architecture §10.5A also excludes automatic optimization | Manifest and deferred-scope regressions; connected behavior only |
| Hard time-report approval workflow or monetary report columns | Architecture §10.6 reserves B1b→B2 decision; only `submitted` ships | Domain/UI/schema negative tests; E17/E26 read seams only |
| Jobs activation, economy valuation, billing UI | Owned by E16/E17/E26 | Existing optional links and stable duration/booking/job seams; inactive `Mina jobb` contributes nothing |
| Hosted migrations/tests, production feed enablement, email go-live | Planning task authorizes no environment action | Local isolated verification later; E13 release control remains authoritative |
| Pact scaffolding | No independently deployed consumer/provider boundary or Pact package | Use existing integration tests; do not add dependencies for a flag |

## Risk Assessment

Probability: 1 unlikely, 2 plausible, 3 likely; impact: 1 limited, 2 material recoverable workflow harm, 3 isolation/data-integrity or core functionality harm. Score = P × I. All are OPEN/planned until actual mitigation evidence exists. Score ≥6 requires mitigation before relevant story release; score 9 would block positive release acceptance.

### High-Priority Risks

| ID | Category | Reachable failure | P | I | Score | Mitigation and verification | Owner | Deadline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | BUS | Empty-slot host opens editor with wrong interval/person; existing seam test masks failure | 2 | 3 | 6 | Real Schema and Resurser pointer click/drag plus keyboard/dialog; assert exact context and persisted result | 15.1 delivery + QA | Before entry exposure/15.1 completion |
| R-002 | DATA | Five views/filter read models disagree on one booking or authorized visibility | 2 | 3 | 6 | Shared fixture and expected IDs across views, reload, filters and role negatives | 15.1 delivery | 15.1 gate |
| R-003 | DATA | Capacity derives from employment percentage or double-counts reductions | 2 | 3 | 6 | Independent expected minutes from actual weekly schedule and §10.5A boundary packs | 15.1 delivery | 15.1 gate |
| R-004 | DATA | Series replay/split/cancel partially writes or duplicates/resurrects occurrences | 2 | 3 | 6 | Concurrent replay, injected rollback, tombstone and stable-ID assertions | 15.2 delivery + High review | 15.2 gate |
| R-005 | DATA | DST/recurrence preview produces different instants from server/conflict/feed | 2 | 3 | 6 | Fixed tenant-TZ goldens and preview/materialization equality using independent expected UTC instants | 15.2 delivery | 15.2 gate |
| R-006 | DATA | Resolver accepts stale/unrelated/partial logical conflicts or loses audit/outcome | 2 | 3 | 6 | Current authority/re-detection, exact natural keys, selected groups, rollback and concurrency tests | 15.3 delivery + High review | 15.3 gate |
| R-007 | SEC | Own-row time report command or review aggregate exposes another user/tenant | 2 | 3 | 6 | JWT role/tenant matrix through commands, direct DB and read model; composite references | 15.4 delivery + security | 15.4 gate |
| R-008 | SEC | Public feed exposes other people/money or grants privileged access | 2 | 3 | 6 | ADR-B004 minimal-field allowlist, cross-tenant/subject probes, shell/bundle containment | 15.5 delivery + security | Before feed ship |
| R-009 | SEC | Rotation/revocation races or public abuse bypass counters; plaintext leaks | 2 | 3 | 6 | Atomic lifecycle, hash-only storage/log probes, every-request revocation, both rate-limit axes | 15.5 delivery + security | Before feed ship |
| R-010 | DATA | Time-report or field UI labels failed/unconfirmed write as submitted/saved | 2 | 3 | 6 | Response loss/failure/retry with DB assertion; unsent input retained and explicit retry | 15.4/15.6 delivery | Receiving story gates |

### Medium-Priority Risks

| ID | Category | Failure/uncertainty | P | I | Score | Mitigation | Owner/deadline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-011 | BUS | Team grouping diverges from owner-selected role-grouped planning | 2 | 2 | 4 | Use recommended arbetsroll grouping under the October9 owner disposition; assert board reflects job roles and preserve no-oracle/no-parity statement | 15.1 delivery/QA before Team completion |
| R-012 | PERF | Month/capacity/series/feed degrade at representative load; target undefined | 2 | 2 | 4 | Approve workload, p95/resource/throughput thresholds then measure full surfaces | Product/Architect before performance certification |
| R-013 | OPS | Skipped DB/browser tests, reused evidence or fixture races yield false green | 2 | 2 | 4 | REQUIRED mode, counts, exact-head receipts, isolated fixtures, own-action settlement and failure retention | QA at each gate |

### Low-Priority Risks

None identified separately. Cosmetic/exploratory checks below do not dilute consequential risks. Category legend: TECH architecture, SEC authorization/exposure, PERF latency/resource limits, DATA integrity, BUS workflow output, OPS execution/operations.

## NFR Planning

| Category | Requirement / threshold | Risk | Planned validation | Evidence needed |
| --- | --- | --- | --- | --- |
| Security | ADR-B004 §6: 256-bit CSPRNG, SHA-256 storage, immediate revoke, atomic audited rotate, minimal own-booking feed, no privileged capability; role matrix | R-007/8/9 | RLS/commands, public HTTP abuse suite, static shell and bundle guards | Exact-head required DB/API report, redacted HTTP observations, audit assertions |
| Correctness | NFR48; UTC storage, tenant IANA TZ with Europe/Stockholm default; nonexistent local time shifts first valid, ambiguous time chooses earlier instant | R-003/4/5/6 | Independent calendar/DST/capacity goldens + transactional integration | Golden diffs and DB outcomes, preview equality |
| Reliability | NFR53/ADR-B009; server-confirmed success; explicit failure/retry, suitable unsent form retention; no stale/offline list fallback | R-010 | Inject request rejection/lost response; assert durable rows and correct unsent labels | Browser trace + authoritative row verification |
| Usability/accessibility | 360×640 connected floor, keyboard/dialog parity, number + color for capacity; filing ≤30 seconds one-hand | R-001/10/11 | Production-web-server desktop/phone E2E plus timed manual one-hand and assistive-tech/daylight checks | Screenshots/traces; timed manual record with device/method/results |
| Performance/scalability | Representative scheduling volumes and latency/resource/throughput targets UNKNOWN; numeric limiter budgets/window UNKNOWN until story configuration | R-012 | Approve workloads and thresholds before load runs; test configured limiter at limit/limit+1/window reset | Approved fixture/threshold contract + load outputs, no proxy timing certification |
| Maintainability/operations | Manifest-derived nav/H4/public inventory, one engine and one expansion function; skipped tests are not coverage | R-013 | Existing coherence/containment checks, empty migration/seed and REQUIRED execution; no broad maintenance rewrite | CI receipt with head/counts, review and trace records |

No final NFR PASS/CONCERNS/FAIL is claimed; later `nfr-assess` consumes actual evidence. Missing performance contracts remain UNKNOWN, not borrowed from Epic 11 pilot/helper timings. Full-release legal/GDPR work remains Phase C.

## Entry Criteria

- Approved story/ADR-backed scope before implementation; refine these epic sketches into atomic final ACs without weakening inherited obligations.
- Scheduling stays pending with empty live surfaces until first Epic 15 schema/nav activation in the same PR. Register each later surface/table/category when shipped; preserve `resources` ownership.
- Apply October9 owner disposition: Team view groups by arbetsroll using product recommendations; no oracle target is required, zero observations recorded, no named-team entity without separate scope approval.
- Local isolated environment/factories available for execution later; use `SUPABASE_TEST_REQUIRED=1`, actual migration-derived ACLs and configured production Playwright web server. This design starts no resource.
- E14 resource/editor/detector foundation, E13 registry, role matrix, and current Contract D are preserved.

## Exit Criteria and Quality Gates

- P0 100% pass, security 100% pass, no unmitigated high risks or consequential findings. P1 ≥95% is the minimum generic threshold, but every declared story AC must be executed and satisfied before marking that story done; triage alone does not close an AC.
- ≥80% measurable changed-logic coverage when tooling can measure it; 100% declared acceptance trace mapping and all security/transaction boundaries. Do not invent percentages from scenario inventory.
- Contract D real-host pointer and keyboard/dialog evidence passes before applicable entry exposure and before 15.1 completion. Preserve original source test identity in trace.
- Full ADR-B004 validity/revoke/rotate/uniformity/rate/cross-tenant/shell suite green before 15.5/feed ship (AC-B1b-7). Rate configuration must be defined to test its boundaries.
- All planned NFR evidence collected or explicit open concern retained for later `nfr-assess`; manual/performance claims require their own evidence. Owner-disposed UXB-A9 is documented; Contract D remains mandatory without waiver.
- Report exact head, executed/passed/failed/skipped/flaky counts, environment and command per suite; unexecuted bodies have NONE coverage. Preserve failures, independent review and source-head CI separately from final metadata readiness.

## Test Coverage Plan

P0–P3 indicate priority, not execution timing. Rows are named scenario families; each count is one family. Owners are story delivery + QA, with security/transaction work independently reviewed at High. Unit goldens own algorithm boundaries, DB/API owns authority and atomic state, components own local interaction, and E2E owns actual wiring/host behavior. Reused foundations are regressions, not duplicated new evidence.

### P0 — Critical (20 families)

| ID | Requirement and falsifiable scenario | Level | Risk |
| --- | --- | --- | --- |
| 15.1-E2E-001 | Contract D / `14.4-E2E-006 (empty-slot click/drag portion)`: actual Schema empty-slot click selects interval and any supplied person, opens existing editor, saves correct booking after server confirmation | E2E | R-001 |
| 15.1-E2E-002 | Same source obligation: actual Schema pointer drag selects non-default start/end; editor/persisted interval matches, not merely opens | E2E | R-001 |
| 15.1-E2E-003 | Same source obligation: actual Resurser click proves selected person/start/end through editor and persisted booking | E2E | R-001 |
| 15.1-E2E-004 | Same source obligation: actual Resurser pointer drag proves selected person/start/end through editor and persisted booking | E2E | R-001 |
| 15.1-E2E-005 | Keyboard/dialog equivalents reach same editor/context and current detector boundary in both actual hosts; focus return and cancellation | E2E | R-001 |
| 15.1-INT-001 | Same tenant/authenticated role fixture yields correct allowed booking IDs in shared projections; another-tenant/user tampering blocked | DB/API | R-002 |
| 15.2-INT-001 | Create series materializes bookings, assignees, conflicts, durable outcome and audit atomically; injected failure leaves no partial state | DB/API | R-004 |
| 15.2-INT-002 | Same series request replay/concurrent identical request creates one result; changed payload under same dedupe identity rejected without writes | DB/API | R-004 |
| 15.2-INT-003 | Update/split retains pre-pivot exceptions and unchanged-time occurrence IDs; cancellation tombstone never regenerates | DB/API | R-004 |
| 15.2-UNIT-001 | Expansion and server preview outputs match independent spring/fall expected UTC goldens, including first-valid/earlier ambiguous instants | Unit | R-005 |
| 15.3-INT-001 | All resolver mutations rerun authoritative current detection; stale candidate or changed permission cannot silently resolve/accept | DB/API | R-006 |
| 15.3-INT-002 | Accept requires current review and nonblank reason; only complete selected candidate logical groups accepted; unrelated conflicts and forged actor/time blocked | DB/API | R-006 |
| 15.3-INT-003 | Resolver booking/conflict/outcome/audit/notification writes roll back together; concurrent reviewed mutations preserve invariants | DB/API | R-006 |
| 15.4-RLS-001 | Own filing/direct DB CRUD/command attempts cannot read/write another user/tenant; role-scoped review only per matrix, composite booking/job references reject mismatch | DB/RLS | R-007 |
| 15.4-INT-001 | Report persist/retry/lost-response reconciliation neither duplicates nor falsely acknowledges submitted; audit and duration/link state remain valid | DB/API | R-010 |
| 15.5-INT-001 | Authenticated self lifecycle issues 32-byte random token, stores SHA-256 only, audits; cross-subject/tenant manage denied | DB/API | R-009 |
| 15.5-INT-002 | Rotate atomically revokes old/issues new; revoke checked every feed request, including concurrent lifecycle/fetch boundaries | DB/API | R-009 |
| 15.5-API-001 | Token-A feed exposes only subject A's own bookings and allowed minimal fields; no money/other-person/tenant enumeration or override via URL/input | Public HTTP | R-008 |
| 15.5-API-002 | Revoked/rotated/unknown/malformed tokens yield identical generic response contract; no token/secret in body/log/cache artifact | Public HTTP | R-009 |
| 15.5-API-003 | Per-token and per-IP-hash counters independently trip at configured boundary, concurrent requests cannot bypass; 429/retry-after and abuse admin signal | Public HTTP + DB | R-009 |

### P1 — Core (28 families)

| ID | Requirement and scenario | Level | Risk |
| --- | --- | --- | --- |
| 15.1-UNIT-001 | Capacity minutes: four-full-day versus five-short-day 80% schedules produce distinct correct availability; no global hours assumption | Unit | R-003 |
| 15.1-UNIT-002 | Capacity combines breaks, employment edges, holidays/closed/half days, absences, blocked time, optional buffer without double subtraction; overtime only explicit authorized input | Unit | R-003 |
| 15.1-E2E-006 | Five real views show expected same booking fixture: Schema day/week/month density, Resurser rows/reassignment lane, Team, Beläggning, Min kalender agenda | E2E | R-002 |
| 15.1-COMP-001 | Per-user per-view toolbar filter/period persistence survives reload and does not leak between views/users | Component | R-002 |
| 15.1-COMP-002 | Capacity numbers + colors, zero-capacity handling, >100% booking drilldown with accessible names | Component | R-003 |
| 15.1-E2E-007 | Existing BookingBlock move/resize actual host gesture and keyboard/dialog equivalents reach authoritative editor; conflict warning remains required | E2E | R-001/6 |
| 15.1-E2E-008 | UXB-A9 owner disposition: Team board groups bookings by arbetsroll; expected role lanes/booking IDs match fixture, no net-new named-team entity | E2E | R-011 |
| 15.1-SCOPE-001 | Manifest activation/nav and active-only tables/public/category inventory coherent in same first schema/nav PR | Unit/static | R-013 |
| 15.2-UNIT-002 | Daily/weekday-weekly/biweekly/monthly rules and until/count ends; invalid/unbounded rules rejected; independent month-end fixtures | Unit | R-004/5 |
| 15.2-INT-004 | Each materialized occurrence participates in sole conflict detector with current work/capacity/access/competence inputs; preview/save equality and rejected cross-tenant series references | DB/API | R-004/5 |
| 15.2-INT-005 | Edited occurrence exception survives future series edits; cancelled tombstone and split ownership boundaries remain stable | DB/API | R-004 |
| 15.2-COMP-001 | Editor next-approximately-10 preview uses shared expansion, correct conflict glyphs and exception label; end condition required | Component | R-005 |
| 15.3-INT-004 | Unchanged natural-key accepted conflict retains acceptance after re-derive; changed window reopens; stable occurrence identity cannot blanket new collisions | DB/API | R-006 |
| 15.3-INT-005 | Free-slot suggestions/available candidates may become stale: final move/reassign/adjust uses current detector and capacity, never trusts suggestion authority | DB/API | R-006 |
| 15.3-INT-006 | Åtgärda hela serien handles sibling occurrences/exception ownership; recorded resolution outcome + actor + SQL timestamp and affected booking.changed recipients | DB/API | R-006 |
| 15.3-E2E-001 | Chip/open count, grouped person/date queue, both-booking timeline/context, move/reassign/adjust/accept and accepted filter wire to correct outcomes | E2E | R-006 |
| 15.3-COMP-001 | Empty state includes last-checked recency and plain-language rule, no false zero during failed read | Component | R-010 |
| 15.4-E2E-001 | Booking-card prefill and standalone Ny tidrapport persist correct submitted row; retry preserves suitable unsent values and never shows success early | E2E | R-010 |
| 15.4-COMP-001 | Personal week timesheet, missing-day nudge and report-vs-booked delta; submitted-only UI with no hard approval | Component | R-007/10 |
| 15.4-INT-002 | PL/Admin person/job/week sums use authorized complete scoped rows; annotate/review without approval-state widening; report rows carry no money | DB/API | R-007 |
| 15.4-INT-003 | E13 time_report.nudge registry/producer respects recipient scope/preferences/idempotency; existing release controls unchanged | DB/API | R-007/13 |
| 15.4-INT-004 | FR92 consumers read stable duration/date/booking/job links without re-entry; no valuation duplicated into report row | DB/API | R-007 |
| 15.5-API-004 | Streaming iCalendar regenerated from live materialized bookings; edited/cancelled/split unchanged-ID cases preserve correct occurrence UID/time semantics and escaping | Public HTTP/parser | R-004/8 |
| 15.5-SCOPE-001 | Public layout imports no AppShell/tenant-context/session/nav; service-role absent in client/bundle; closed three-surface manifest enforced | Unit/static | R-008 |
| 15.5-E2E-001 | Kalenderprenumeration warning/create/rotate/revoke and last-used display wired to authenticated own commands; raw URL shown only as intended issued capability | E2E | R-009 |
| 15.6-E2E-001 | Montör landing /my-day today/week ordered cards, map address, optional job/report actions and booking.changed notices; no money | E2E | R-002/10 |
| 15.6-E2E-002 | 360×640 pull-to-refresh/current connected reads; failed read says Anslutning krävs, never offline/stale job list; empty state only after successful read | E2E | R-010 |
| 15.6-SCOPE-001 | Min Dag redirect activates EB-A6; Mina jobb contributes nothing while E16 pending and remains a one-directional seam | Unit/static | R-013 |

### P2 — Secondary (5 families)

| ID | Scenario | Level | Risk |
| --- | --- | --- | --- |
| 15-X-A11Y-001 | Manual assistive-tech, keyboard, focus, daylight, and phone one-hand checks across views/editor/time filing; record ≤30-second actual filing timing separately | Manual | R-001/10 |
| 15-X-PERF-001 | Approved representative month/resource/capacity/series/resolver/feed workload full-surface latency/resource/throughput measurement | Load/profiling | R-012 |
| 15.1-COMP-003 | Month density and long labels/multi-assignee layout remain usable without color-only meaning | Component/visual | R-002 |
| 15.5-API-005 | last_used_at/usage counters reflect real fetch, no lifecycle-only false fetch date; sanitized monitoring spike projection | DB/API | R-009 |
| 15-X-OPS-001 | Empty migration+seed, required test enrollment/counts, fixture uniqueness/cleanup and no global-DDL races | CI/integration harness | R-013 |

### P3 — Exploratory (1 family)

| ID | Scenario | Level | Risk |
| --- | --- | --- | --- |
| 15-X-EXP-001 | Bounded exploratory transitions among views, dense schedules and responsive orientation; record observations and regressions without claiming automatic/manual completion beforehand | Manual exploratory | R-011/12 |

## Execution Strategy

Run everything functional in PRs if under 15 minutes; defer only expensive/long work. Existing configured production Playwright server is mandatory; never substitute `next dev`. Run unit/static first, required DB/API/RLS next, actual E2E host/phone/public shell last, retaining cumulative E14 regressions. Parallelize worker-owned fixtures where safe; do not run shared fault-hook DDL concurrently or mutate a user database. Fixture scoping determines concurrency, not test count alone. No runtime duration guarantee is invented.

Nightly: expensive representative data and concurrency/burn-in packs if PR duration requires splitting, with required pre-release result for the same head. Weekly: approved performance/load and manual accessibility/daylight/one-hand/exploration. Calendar host and ADR-B004 gates remain required PR/release evidence and cannot be deferred by schedule priority. Smoke subset can aid diagnostics but never replaces the full functional gate. Gate receipts store head, commands, configuration, pass/fail/skip/flaky counts and artifacts; keep failed runs distinct.

## Resource Estimates and Prerequisites

| Priority | Families | Development including fixture/setup range |
| --- | --- | --- |
| P0 | 20 | 45–70 hours |
| P1 | 28 | 40–65 hours |
| P2 | 5 | 15–30 hours |
| P3 | 1 | 2–5 hours |
| Total | 54 | 102–170 hours, roughly 3–5 engineer-weeks |

Factories must own isolated tenant A/B, own/other memberships and PL/Admin/Montör role combinations, different actual schedules at equal employment percentage, fixed-clock UTC/TZ/DST fixtures, holiday/exception packs, multi-assignee bookings, materialized series/exception/tombstone/split identities, submitted reports and hashed feed tokens. Seed via authorized fixture helpers before UI; cleanup only owned fixtures, no resource deletion. Expected golden outputs remain independent of implementation output. Database-relative expiry/counter clocks and explicit barriers make race tests deterministic.

Use existing Node unit, Vitest component/DB and Playwright tooling. Playwright Utils flag is true but package absent: mandate's two gates do not bind; do not add imports/dependencies here. Future framework adoption can wire one merged fixture entry. No generated test code or guessed selectors/endpoints are supplied. Pact broker: unreachable (SmartBear MCP tools not available); no relevant independent-provider contract and no provider states planned. No broker retry or credentials probe. No browser exploration/resource launched; Owner explicitly removed further oracle dependency; zero observations and no parity claim are recorded.

## Mitigation Plans and Residual Risk

- **R-001/2/3:** 15.1 owner must execute non-default host intervals/person selections and independent view/capacity fixture assertions. Original `14.4-E2E-006` transfer is not consumed by a component prefill assertion. Residual risk stays open until actual outer-surface evidence passes.
- **R-004/5/6:** 15.2/15.3 owners preserve sole engine/expander and current-transaction authority. Require independent goldens, concurrent replay, unchanged/new natural keys, injected zero-partial-write rollback and audit/outcome assertions. High review is mandatory for authority/transaction changes. Residual risk includes unmeasured representative series scale.
- **R-007/8/9:** security owner requires negative JWT/direct RLS tests with positive controls, minimal field allowlist, 32-byte random/hash-only lifecycle and full ADR-B004 suite. Derive tenant/subject from authenticated/token authority, never supplied override. Plaintext is a capability, and redacted artifacts must not record issued secrets. No service-role client access or privileged public wrapper.
- **R-010:** 15.4/15.6 owner must prove durable row existence before submitted/saved UX and preserve appropriate unsent input on failure with explicit retry. Failed read must be visibly connection-required. Residual manual one-hand timing remains open until measured.
- **R-011/12/13:** QA verifies owner-recommended Team role grouping; Product/Architect approves representative workload/thresholds; QA retains exact-head execution/counts and original failures. Unknowns are documented, not inferred completion.

## Assumptions and Dependencies

Six epic sketches are available; final story-specific ACs/specs are not yet available. This plan is the epic planning baseline, to be reconciled with approved story detail and test IDs. Existing resources are active; scheduling is pending. E13 registry and release controls are reused; producer activation requires manifest/category coherence. Job links stay optional and no E16 technical prerequisite is introduced. Employment timezone seam defaults Europe/Stockholm without B1 UI.

Open questions: approve representative scheduling volumes/latency/resources/throughput; define rate-limit count/window configuration in the feed story. The direct owner update on October9 states that further Lovable comparison is unnecessary and work should proceed using recommendations/best practices. This replaces the earlier unresolved oracle prerequisite for Epic15 only. Team uses recommended arbetsroll grouping within the PRD; zero oracle observations, no legacy parity claim, no net-new named-team entity without scope approval.

The October 8 retrospective's performance/manual/quality actions remain under their existing owners and selectors. Earlier failures/October 7 rejected verdict are historical, not overwritten. This plan neither changes sprint/state/ledger nor grants publication/production readiness.

## Interworking and Regression

| Component | Impact | Required existing regression |
| --- | --- | --- |
| E14 resources/booking editor | New real calendar hosts and recurrence/resolution reuse foundation | person/resource suites; booking editor component/E2E, boundary, replay-authority, review round-fix and RLS suites |
| Sole conflict engine | Expanded occurrences and resolver reuse authoritative detector | booking-conflicts and attestation suites; all work/capacity/DST packs |
| E13 notifications | booking.changed/time_report.nudge activation | registry, scope/preferences/idempotency and fail-closed delivery-control tests |
| Manifest/nav/public shell | Scheduling activation and first feed | coherence, derived nav/H4/public/deferred scope, service-role/bundle containment |
| Auth/roles/read models | Own report versus reviewer and minimal field projections | shared tenant and per-role negative suites; aggregate honesty |
| E17/E26 future consumers | Stable hour/link seam | schema/read-contract assertions only; no future-module live surface |

## Follow-on Workflows and Approval

Run ATDD for approved story P0 acceptance and later automate/review/trace/NFR assessment as separate workflows. No such workflow was auto-run by this design. Product/Tech/QA approval remains unrecorded; this document does not invent sign-off. No human waiver is issued.

## Appendix: Sources and Validation

Authority: `epics-phase-b.md` Epic15; PRD FR87–92/NFR46/NFR48/NFR53/AC-B1b-7; architecture §§6 (ADR-B004 is inline, no separate file),10–10.6; Contract D; current manifest; October8 Epic14 retrospective and Epic14 test plan. Phase B UX is the story-design companion; October9 owner disposition resolves UXB-A9 via recommended arbetsroll grouping; oracle evidence is zero and no legacy parity claim is made.

Knowledge applied: risk-governance, probability-impact, test-levels-framework, test-priorities-matrix, nfr-criteria, test-quality, evidence-integrity, fixture-architecture, network-first, data-factories, selector-resilience, test-healing-patterns, library/playwright-utils mandates, overview/api-request/auth-session, playwright-cli and pact-mcp. No snippets violate library mandates because no test code is generated.

Checklist review: all template sections populated or marked not applicable; unique risk/scenario IDs; scores equal P×I; high risks have role owner and receiving-story deadline; every epic sketch maps to scenario families; no final NFR verdict/executed coverage claim; range estimates; simple PR/nightly/weekly strategy; owner-disposed UXB-A9 and unresolved performance/rate configuration explicit. Story markdown prerequisite is satisfied at epic sketch level only; detailed story acceptance remains a downstream entry criterion. No CLI sessions or orphan resources were created. Artifact path matches runKey. Planning completion is distinct from release acceptance.

**Generated by:** BMAD TEA — `bmad-testarch-test-design`, Create / Epic-level 15.

## Sensitive planning handoff
Context-free gpt-6.1-sol High delegate completed read-only planning for recurrence/transactional acceptance, time-report RLS and public tokens. Incorporated authority obligations above; role review must use the matrix’s actual scope (no invented PL company-wide or economy-role review). Include inactive membership/anon negatives, retry after permission loss, direct token-table mutations, atomic failed rotation and resolver replay without duplicate outcomes/notifications in the parameterized boundary packs. New booking_series/time_reports/calendar_feed_tokens tables join manifest/H4/exact-policy tests when shipped. No new privilege or numeric threshold is granted.

