---
runScope: 'epic-level'
runKey: 'epic-14'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-29'
inputDocuments:
  - 'AGENTS.md'
  - '_bmad/tea/config.yaml'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/planning-artifacts/ux-design-specification-phase-b.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - 'src/scope/manifest.ts'
  - 'docs/process/local-setup.md'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/tea-index.csv'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/library-integration-mandate.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/nfr-criteria.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-cli.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-mandate.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/pact-mcp.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/fixture-architecture.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/network-first.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/data-factories.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/test-quality.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/selector-resilience.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/confidence-gate.md'
  - 'C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-design/resources/knowledge/evidence-integrity.md'
---

# Epic 14 Test Design Progress

- Mode: Epic-level test design
- Epic: 14 — Resource and Scheduling Foundation
- Source scope: Epic 14 and Stories 14.1–14.4 in the approved Phase B epic set
- Prerequisites: Epic/story requirements and Phase B architecture context are available
- Checkpoint state: Fresh run; no earlier Epic 14 checkpoint existed

## Step 2 — Loaded Context

### Configuration and stack

- `tea_use_playwright_utils: true`, but `@seontechnologies/playwright-utils` is not installed. Per the library mandate, its substitutions are advisory and this design follows the repository's existing native Playwright patterns.
- `tea_use_pactjs_utils: true`, but neither Pact package nor an independently deployed consumer/provider boundary exists. Contract scaffolding is out of scope for this monolithic Next.js + Supabase epic.
- `tea_pact_mcp: mcp`; one tool-list probe found no SmartBear Pact MCP tools, so `pact_mcp_reachable: false`. No broker call or retry was made.
- Detected stack: full stack TypeScript (Next.js/React frontend, Supabase/Postgres backend), with Node `--test` for pure logic, Vitest for DB/RLS integration, and Playwright for browser E2E.
- Test artifacts root: `_bmad-output/test-artifacts`.

### Epic 14 requirements and boundaries

- Story 14.1 activates the manifest module `resources` in the same PR as the first Epic 14 schema surface. The separate `scheduling` manifest module belongs to Epic 15 and remains pending throughout Epic 14.
- Story 14.1 introduces the single `person_profiles` record (1:1 with membership), weekly work-hour templates/exceptions, tenant calendar days, default-work-role reuse, capacity inputs, admin maintenance, and deactivated-user semantics.
- Story 14.2 introduces standalone or optionally connected bookings, multi-assignees, composite same-tenant foreign keys, UTC instants, and SECURITY INVOKER transactional commands that atomically write booking, assignees, derived conflicts, and audit/idempotency state.
- Story 14.3 provides one pure, clock-free conflict engine shared by preview and authoritative server save. It covers double booking, capacity, outside-work-hours, access-window, and competence conflicts, including Europe/Stockholm DST policy and N-9 golden rule packs.
- Story 14.4 provides the responsive booking editor, live warnings, explicit `Boka ändå` with required reason, accepted/open conflict persistence, audit evidence, dirty-state protection, retained unsent form state after request failure, explicit retry, and server-confirmed success.
- Epic 15 recurrence, five scheduling views/nav, resolver workflow, time reporting, calendar feed, and associated notification categories/public surfaces remain outside this plan except where Epic 14 must preserve forward-compatible fields or prevent premature exposure.

### Existing coverage and patterns

- No Epic 14 production feature, migration, fixture, unit, integration, RLS, or E2E coverage exists yet; references to scheduling are governance placeholders only.
- Reusable infrastructure exists: unique two-tenant factories, tenant-table inventory with cross-tenant/anon/H4 gates, role harness, audit-event helpers, local-stack reachability gating, Node pure-logic suites, Vitest integration suites, and production-server Playwright E2E.
- Current Playwright config is Chromium desktop by default and serial over one seeded fixture. Epic 14 needs explicit 360×640 viewport cases and retry-safe booking fixtures.
- DB/RLS suites can skip when local Supabase is unavailable unless `SUPABASE_TEST_REQUIRED=1`; later execution evidence must report executed/skipped counts. This design run executed no tests.
- Browser exploration was skipped: the Epic 14 surface does not exist and no service launch is needed for design.
- Prior system-level test designs remain useful for RLS, atomic-command, audit, deterministic pure-logic, and thin-E2E patterns, but their Phase A Playwright Utils examples are superseded by the current dependency manifest and repository-native test stack.

## Step 3 — Risk and NFR Assessment

### Risk matrix

Probability and impact use the TEA 1–3 scale; score is probability × impact. Scores 6–8 require mitigation and score 9 blocks an evidence-based release decision until mitigated.

| Risk ID | Category | Risk | P | I | Score | Mitigation and planned evidence | Owner / timing |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R14-DATA-01 | DATA | The pure engine misses a real collision or reports a phantom collision across overlap boundaries, multiple assignees, optional links, or rule combinations. | 3 | 3 | **9** | Table-driven and golden unit packs for every conflict type, exact-boundary cases, permutation/property checks, and a regression fixture for every discovered miss/phantom. | Dev + test owner / Story 14.3 before merge |
| R14-DATA-02 | DATA | Live preview and authoritative save disagree because of duplicated rules, stale inputs, or another writer committing between preview and save. | 3 | 3 | **9** | Import the same pure engine at both call sites; integration tests mutate competing bookings after preview and prove the transaction re-runs detection against current rows; never trust a client-supplied conflict result. | Dev + test owner / Stories 14.2–14.4 |
| R14-DATA-03 | DATA | `createBooking` or `updateBooking` partially writes booking, assignees, conflicts, acceptance state, or audit rows; retries/concurrency create duplicates or lose assignees. | 3 | 3 | **9** | SECURITY INVOKER RPC integration tests for rollback at each fault boundary, same-key replay, changed-payload key conflict, concurrent Promise-based races, exact post-state, and one committed audit event. | Dev + test owner / Story 14.2, extended in 14.4 |
| R14-DATA-04 | DATA | Europe/Stockholm conversion, all-day bounds, DST policy, actual-weekly-schedule capacity, holidays/closed days, absence, breaks, buffers, or overtime rules produce wrong availability. | 3 | 3 | **9** | Golden-pinned N-9 packs for spring/fall boundary weeks, four-full-days vs five-short-days equivalence checks, formula component isolation, tenant calendar layering, and explicit authorized-overtime inputs. | Dev + test owner / Stories 14.1 and 14.3 |
| R14-SEC-01 | SEC | A tenant or role reads/mutates another tenant's person, hours, calendar, booking, assignee, or conflict rows; composite child references mix tenants. | 2 | 3 | **6** | Enroll every new tenant-owned table in `TENANT_TABLES`; cross-tenant SELECT/INSERT/UPDATE/DELETE, parent-spoof, anon, disabled-membership, and same-tenant role-negative tests; H4 inventory must fail if enrollment is missing. | Dev + test owner / each migration PR |
| R14-SEC-02 | SEC | Montör own-booking scope, scheduling capabilities, route authorization, and command authorization diverge; UI hiding becomes the only guard. | 2 | 3 | **6** | Per-role matrix tests at DB/read/command/route layers; Montör can see only bookings joined to their person and cannot use planner/admin mutations; direct URLs and forged command bodies remain denied. | Dev + test owner / Stories 14.1, 14.2, 14.4 |
| R14-DATA-05 | DATA | Schema constraints admit invalid windows, duplicate assignees, orphaned profiles, cross-tenant optional connections, or a second person record for one membership. | 2 | 3 | **6** | Migration/DB negatives for `end > start`, 1:1 membership uniqueness, assignee uniqueness, composite same-tenant FKs, valid status/type domains, and nullable standalone booking links. | Dev + test owner / Stories 14.1–14.2 |
| R14-BUS-01 | BUS | Conflict override is silently accepted, lacks a reason/actor, stores `open` instead of `accepted`, or a changed collision inherits stale acceptance. | 2 | 3 | **6** | Integration/E2E prove `Boka ändå` requires a nonblank reason, persists accepted rows and audit atomically, unacknowledged conflicts stay open, and changing the natural key reopens the conflict. | Dev + test owner / Story 14.4 |
| R14-TECH-01 | TECH | Epic 14 activates the wrong manifest module or exposes Epic 15 nav, tables, categories, public feed, recurrence, resolver, or time-report surfaces early. | 2 | 3 | **6** | Manifest coherence/derivation tests prove `resources` flips active with E14 tables/matrix rows while `scheduling` remains pending with empty live surfaces; deferred-scope scans cover E15-only artifacts. | Dev + test owner / Story 14.1 and every Epic 14 PR |
| R14-OPS-01 | OPS | Required DB/RLS evidence silently skips when the local stack is unavailable, yielding a false-green story gate. | 2 | 3 | **6** | Completion runs set `SUPABASE_TEST_REQUIRED=1`, report executed/skipped counts, reconcile discovered files with executed tests, and treat explicit skips as gaps. No hosted/demo test target. | Story author + reviewer / every story gate |
| R14-DATA-06 | DATA | Deactivating a user leaves future assignments incorrectly actionable or permits new assignments, while historical booking records are lost or reassigned without evidence. | 2 | 2 | 4 | Story 11.3 carry-forward integration and UI states: prevent new assignment, preserve history, surface needs-reassignment semantics, and assert no destructive cascade. | Dev + test owner / Stories 14.1–14.2 |
| R14-OPS-02 | OPS | On a connected phone, a failed save loses suitable form input, shows success before persistence, duplicates a booking on retry, or leaves stale warnings. | 2 | 2 | 4 | 360×640 Playwright failure injection with retry-safe fixtures: retain draft, label unsent state, explicit retry, no success before server response, idempotent final state, refreshed warnings. | Dev + test owner / Story 14.4 |
| R14-PERF-01 | PERF | Live conflict feedback or transactional saves become too slow with realistic booking and work-hour volumes. Approved documents give no numeric latency or volume target. | 2 | 2 | 4 | Mark thresholds **UNKNOWN**; capture query/engine baselines with named fixture sizes, inspect query plans/index use, and obtain an owner-approved target before an NFR PASS claim. | Architect/product + test owner / before Story 14.4 exit |

### NFR planning

| NFR category | Approved threshold or invariant | Planned evidence | Gap status |
| --- | --- | --- | --- |
| Security / tenant isolation | RLS forced on every tenant-owned table; anon denied; no service-role client path; role capability plus row scope; 100% enrollment in the H4 tenant-table inventory. | Migration reset, parameterized RLS/anon/role negatives, service-role source/bundle gates, command/route authorization cases. | Defined |
| Data integrity / determinism | One pure no-I/O/no-clock conflict engine; server re-runs it inside the transaction; all instants stored UTC; tenant interpretation defaults to Europe/Stockholm; spring-forward uses first valid instant, fall-back uses earlier instant. | Pure unit/golden packs, repeated-input determinism, preview/save equivalence, transactional concurrency/fault tests, DB constraints. | Defined |
| Reliability / connected field UX | Suitable unsent state survives request failure; explicit retry; success only after server-confirmed persistence; no offline/PWA queue or sync. | 360×640 Playwright network/server-failure cases plus post-retry DB assertion and no-duplicate proof. | Defined |
| Accessibility / responsive UX | Booking editor usable at 360×640; keyboard/dialog parity; focus-trapped sheet and dirty-state guard; live warnings/save confirmations announced; touch targets at least 44 px and field primary actions target 48 px; status is not color-only. | Playwright viewport, keyboard, focus, accessible-name/live-region, and computed bounding-box checks; manual daylight/readability review remains supplementary. | Defined |
| Maintainability | Capacity rules are config/data rather than schema; client and server share the pure engine; no E15 or Phase C surface in E14. | Import/call-site tests, manifest/deferred scans, code review, golden rule packs versioned with config. | Defined |
| Operational evidence | Required integration/RLS runs use `SUPABASE_TEST_REQUIRED=1`; tests target only the authorized local stack; hosted demo is excluded. | CI logs with executed/skipped counts and local endpoint attestation. | Defined |
| Performance | Existing browser suite has a global five-minute CI budget, but no Epic 14 preview/save latency target or representative data-volume target is approved. | Baseline measurements and query plans using declared fixture sizes; later NFR assessment after thresholds are approved. | **UNKNOWN** |
| Scalability | No approved maximum persons, bookings per horizon, assignees per booking, or calendar exceptions per tenant. | Volume matrix and explain/baseline evidence after product scale assumptions are approved. | **UNKNOWN** |
| Audit / compliance | Conflict acceptance requires reason, actor, state, and an audit event in the same transaction; tenant scheduling data remains authenticated and tenant-scoped. | Integration rollback/success assertions and audit-event correlation; no final Phase C GDPR/retention claims. | Defined within Phase B scope |

### Risk summary

- Immediate mitigation priority: deterministic conflict/capacity correctness, transaction atomicity/idempotency, and authoritative server re-checks.
- Security priority: enroll all Epic 14 tables in the existing RLS inventory and prove Montör row scope plus planner/admin capability gates at every boundary.
- Scope priority: activate `resources`, keep `scheduling` and all Epic 15 surfaces pending, and fail loud on any early surface.
- NFR clarification priority: approve measurable latency and volume targets before implementation can claim performance or scalability readiness. Their absence does not block this design document.

## Step 4 — Coverage and Execution Plan

### Coverage matrix

Each ID is an atomic planned scenario. Parameterized rows must report each data row separately so one passing case cannot hide a failed edge.

#### Story 14.1 — Resource activation, person profiles, and work hours

| Test ID | Priority | Level | Atomic scenario | Risk / requirement |
| --- | --- | --- | --- | --- |
| 14.1-UNIT-001 | P0 | Unit | Capacity for an 80% person follows four full scheduled days and does not synthesize five shorter days from the percentage. | FR86, R14-DATA-04 |
| 14.1-UNIT-002 | P0 | Unit | Capacity for an 80% person follows five explicitly short scheduled days and differs from the four-day template at day granularity. | FR86, R14-DATA-04 |
| 14.1-UNIT-003 | P0 | Unit | Breaks reduce scheduled working time exactly once and never become available capacity. | N-9, R14-DATA-04 |
| 14.1-UNIT-004 | P0 | Unit | Swedish public holiday plus tenant closed/reduced day layering yields the configured local-day capacity without double subtraction. | N-9, R14-DATA-04 |
| 14.1-UNIT-005 | P0 | Unit | Individual vacation, sickness, leave, training, and blocked-time inputs subtract only their overlapping scheduled portions. | N-9, R14-DATA-04 |
| 14.1-UNIT-006 | P0 | Unit | Optional planning buffer subtracts according to injected rule config; no buffer is hardcoded. | N-9, R14-DATA-04 |
| 14.1-UNIT-007 | P0 | Unit | Overtime contributes zero ordinary capacity unless an explicit authorized overtime input is supplied. | FR86, R14-DATA-04 |
| 14.1-DB-001 | P0 | DB integration | A membership can own exactly one person profile; a second profile fails with no mutation. | PB-D13, R14-DATA-05 |
| 14.1-DB-002 | P0 | DB integration | A default work role must be a same-tenant row from the existing work_roles catalog; foreign-tenant and missing roles fail. | PB-A8, R14-SEC-01 |
| 14.1-DB-003 | P1 | DB integration | Weekly template and exception rows accept valid shifts/breaks and reject invalid/overlapping bounds according to the story schema contract. | FR86, R14-DATA-05 |
| 14.1-DB-004 | P1 | DB integration | Tenant calendar days persist closed, half-day, bridge-day, company-activity, and reduced-capacity variants without adding rule-specific schema. | N-9, maintainability |
| 14.1-RLS-001 | P0 | RLS integration | Tenant A cannot select or mutate Tenant B person profile, work-hour, or calendar-day rows, including parent-ID spoof attempts. | R14-SEC-01 |
| 14.1-RLS-002 | P0 | RLS integration | Tenant admin/planner capabilities can maintain person scheduling basics while each non-entitled role is denied at DB/command/route boundaries. | R14-SEC-02 |
| 14.1-RLS-003 | P0 | RLS integration | Anonymous, no-membership, invited, and disabled-membership callers receive no Epic 14 data or mutations. | R14-SEC-01 |
| 14.1-GOV-001 | P0 | Static/unit | The resources module becomes active with E14 metadata and the new tenant-table/permission rows; all manifest-derived guardrails agree. | FR129, R14-TECH-01 |
| 14.1-GOV-002 | P0 | Static/unit | The scheduling module remains pending with empty nav, tenant tables, widgets, categories, public surfaces, and file-owner types through Epic 14. | FR129/130, R14-TECH-01 |
| 14.1-GOV-003 | P0 | Integration gate | Every new tenant-owned table is enrolled in TENANT_TABLES and exact-policy enumeration; a deliberately omitted table makes H4 fail. | R14-SEC-01 |
| 14.1-E2E-001 | P1 | E2E | An entitled admin creates and edits a person's default role and weekly schedule, reloads, and sees server-persisted values. | Story 14.1 |
| 14.1-E2E-002 | P1 | E2E | A deactivated user cannot be newly assigned while their historical person/booking identity remains visible and future work is marked for reassignment. | Story 11.3 carry, R14-DATA-06 |

#### Story 14.2 — Bookings, assignees, and transactional commands

| Test ID | Priority | Level | Atomic scenario | Risk / requirement |
| --- | --- | --- | --- | --- |
| 14.2-DB-001 | P0 | DB integration | A standalone booking with all optional job/customer/facility/contact links null is valid. | FR84, PB-D12 |
| 14.2-DB-002 | P0 | DB integration | Each optional connection accepts a same-tenant existing target and rejects a foreign-tenant or mismatched parent target. | R14-SEC-01, R14-DATA-05 |
| 14.2-DB-003 | P0 | DB integration | Booking end must be after start; invalid and zero-length windows write nothing. | R14-DATA-05 |
| 14.2-DB-004 | P1 | DB integration | Timed and all-day bookings store UTC instants and preserve the approved Europe/Stockholm display interval. | FR83, NFR48 |
| 14.2-DB-005 | P0 | DB integration | A booking cannot contain the same assignee twice and cannot reference a person from another tenant. | R14-DATA-05 |
| 14.2-INT-001 | P0 | Command integration | createBooking commits exactly one booking, the requested assignee set, current derived conflict rows, and one correlated audit event. | R14-DATA-03 |
| 14.2-INT-002 | P0 | Command integration | updateBooking atomically replaces the intended mutable fields/assignees and re-derives conflicts without stale rows. | R14-DATA-02/03 |
| 14.2-INT-003 | P0 | Command integration | Repeating createBooking with the same command key and identical canonical request returns the existing result without duplicate rows/audit. | R14-DATA-03 |
| 14.2-INT-004 | P0 | Command integration | Reusing a command key with changed canonical content returns the stable conflict error and changes nothing. | R14-DATA-03 |
| 14.2-INT-005 | P0 | Command integration | Concurrent identical creates resolve to one durable booking; every loser reconciles or fails cleanly, never duplicating assignees/conflicts. | R14-DATA-03 |
| 14.2-INT-006 | P0 | Command integration | Forced failure after booking insert rolls back booking, assignees, conflicts, idempotency state, and audit. | R14-DATA-03 |
| 14.2-INT-007 | P0 | Command integration | Forced failure after assignee/conflict preparation still leaves zero partial business state. | R14-DATA-03 |
| 14.2-INT-008 | P0 | Command integration | A conflict introduced after a client preview is detected from current rows inside save and cannot be bypassed by the stale preview payload. | R14-DATA-02 |
| 14.2-RLS-001 | P0 | RLS integration | Tenant A cannot read or mutate Tenant B bookings, assignees, or conflicts through direct tables, reads, or commands. | R14-SEC-01 |
| 14.2-RLS-002 | P0 | RLS integration | A Montör reads only bookings joined to their own person profile and cannot infer co-worker-only booking details. | R14-SEC-02 |
| 14.2-RLS-003 | P0 | RLS integration | A Montör cannot call planner/admin create or update authority unless the final Story 14.2 matrix explicitly grants it. | R14-SEC-02 |
| 14.2-RLS-004 | P0 | RLS integration | An entitled planner/admin can read/write within their tenant, and direct route/command requests still enforce authorization when UI controls are absent. | R14-SEC-02 |
| 14.2-INT-009 | P1 | Command integration | Booking binding to an existing Phase A basic job succeeds and leaves the job ID stable for later additive job depth. | FR84 |
| 14.2-INT-010 | P1 | Command integration | A deactivated person cannot be newly assigned; existing historical assignment rows are preserved rather than cascaded away. | R14-DATA-06 |

#### Story 14.3 — Deterministic conflict engine

| Test ID | Priority | Level | Atomic scenario | Risk / requirement |
| --- | --- | --- | --- | --- |
| 14.3-UNIT-001 | P0 | Unit | Overlapping intervals for one shared assignee produce exactly one double_booking conflict with stable natural-key fields. | FR85, R14-DATA-01 |
| 14.3-UNIT-002 | P0 | Unit | Adjacent half-open intervals where one ends exactly when another starts do not conflict. | FR85 boundary |
| 14.3-UNIT-003 | P0 | Unit | With multiple assignees, only the colliding person is reported and permutation of assignee/input order does not change output. | R14-DATA-01 |
| 14.3-UNIT-004 | P0 | Unit | Booked time above available actual-schedule capacity emits over_capacity at the injected warning threshold. | FR85/86 |
| 14.3-UNIT-005 | P0 | Unit | A booking wholly or partly outside a person's scheduled shift emits outside_work_hours with the violating window. | FR85 |
| 14.3-UNIT-006 | P0 | Unit | A booking during a break or individual absence emits outside_work_hours without double-counting capacity conflict identity. | N-9 |
| 14.3-UNIT-007 | P1 | Unit | A job-bound candidate outside every supplied access window emits outside_access_window; a standalone booking with no window constraint does not. | N-9 |
| 14.3-UNIT-008 | P1 | Unit | A candidate whose assignee lacks the supplied required work role/competence emits competence_missing; matching input clears it. | N-9 |
| 14.3-UNIT-009 | P0 | Unit | Spring-forward nonexistent local time maps to the first valid Europe/Stockholm instant and produces stable conflicts/capacity. | NFR48, R14-DATA-04 |
| 14.3-UNIT-010 | P0 | Unit | Fall-back ambiguous local time maps to the earlier instant and remains stable across host timezones. | NFR48, R14-DATA-04 |
| 14.3-UNIT-011 | P0 | Unit | The same frozen input evaluated repeatedly returns byte-equivalent sorted conflict output and never reads wall clock or I/O. | Determinism |
| 14.3-UNIT-012 | P0 | Unit | Central holiday, tenant day, individual exception, booking, blocked time, and buffer each affect only their named term in the six-term golden formula. | N-9 golden pack |
| 14.3-UNIT-013 | P1 | Unit | Authorized overtime is an explicit injected decision; changing rule config changes the result without schema/input-shape changes. | FR86, maintainability |
| 14.3-INT-001 | P0 | Integration | Editor preview and server save fed the same frozen facts produce the same normalized conflict set. | R14-DATA-02 |
| 14.3-INT-002 | P0 | Integration | A competing committed booking between preview and save causes the server result to add the new conflict; the stale preview cannot suppress it. | R14-DATA-02 |
| 14.3-UNIT-014 | P1 | Unit/golden | Each corrected missed or phantom conflict is added as a named immutable regression fixture. | NFR48 |

#### Story 14.4 — Booking editor, live warnings, and audited override

| Test ID | Priority | Level | Atomic scenario | Risk / requirement |
| --- | --- | --- | --- | --- |
| 14.4-COMP-001 | P1 | Component | Desktop renders the editor as a focus-trapped side sheet with all approved fields and no recurrence controls. | Story 14.4; E15 exclusion |
| 14.4-E2E-001 | P0 | E2E | At exactly 360×640 the editor is full-screen, scrollable, usable without horizontal overflow, and keeps primary actions reachable. | ADR-B009 |
| 14.4-COMP-002 | P1 | Component | Multi-assignee selection, work-role filter, time, optional connection, and description changes preserve the intended draft model. | Story 14.4 |
| 14.4-COMP-003 | P0 | Component/integration | Every assignee or time change refreshes ConflictPanel from the shared engine and removes stale warning entries. | R14-DATA-02 |
| 14.4-COMP-004 | P1 | Component | ConflictPanel exposes type, person, window, collision context, and mini-timeline with text/icon semantics rather than color alone. | UX accessibility |
| 14.4-INT-001 | P0 | Command integration | Saving a conflicting candidate without the required explicit override proof returns BOOKING_CONFLICT_UNACKNOWLEDGED and cannot bypass authority. | R14-BUS-01 |
| 14.4-INT-002 | P0 | Command integration | Boka ändå with a nonblank reason atomically commits booking state, accepted conflict row(s), actor/reason, and audit correlation. | R14-BUS-01 |
| 14.4-INT-003 | P0 | Command integration | Blank/whitespace override reasons, forged conflict IDs, stale previews, or unauthorized override attempts fail with no partial mutation. | R14-BUS-01/SEC-02 |
| 14.4-INT-004 | P0 | Command integration | Unaccepted detected conflicts remain open and the open count excludes accepted/resolved rows. | Story 14.4 |
| 14.4-INT-005 | P0 | Command integration | Editing the collision window changes its natural key and reopens detection; accepted state never blankets the changed collision. | Architecture §10.2 |
| 14.4-E2E-002 | P1 | E2E | The Konflikter count chip reflects persisted open conflicts after reload and does not count accepted conflicts. | Story 14.4 |
| 14.4-E2E-003 | P1 | E2E | Escape/back/close with a dirty draft warns about unsaved changes; cancel keeps the editor and confirm discards intentionally. | Dirty-state contract |
| 14.4-E2E-004 | P0 | E2E | A forced request failure retains suitable draft input, labels it unsent, exposes explicit retry, and never displays saved success. | ADR-B009, R14-OPS-02 |
| 14.4-E2E-005 | P0 | E2E | Retrying the failed save yields one server-confirmed booking with one assignee/conflict set and then shows success. | Idempotency, R14-OPS-02 |
| 14.4-E2E-006 | P1 | E2E | Supported Epic 14 entry points prefill only approved job/customer/time/person context; no Epic 15 Planering view or nav is introduced. | R14-TECH-01 |
| 14.4-E2E-007 | P1 | E2E | Keyboard-only use reaches all fields/override actions, focus returns predictably, warnings/save confirmations use polite live regions, and touch targets meet the approved floor. | Accessibility NFR |
| 14.4-GOV-001 | P0 | Static/unit | Epic 14 ships no recurrence/series command, scheduling nav, five-view surface, conflict resolver workflow, time-report table, booking notification category, or calendar-feed public surface. | FR129/130, R14-TECH-01 |

### NFR evidence plan

| NFR | Planned scenario/evidence | Later evidence artifact |
| --- | --- | --- |
| Tenant isolation and authorization | 14.1-RLS-001..003 and 14.2-RLS-001..004 plus H4/anon/service-role gates. | Required Vitest log with executed/skipped counts, migration reset log, source/bundle guard output. |
| Deterministic correctness | 14.1-UNIT-001..007 and 14.3-UNIT-001..014 golden fixtures. | Unit runner report plus committed N-9/DST fixture pack and failure diff. |
| Atomicity and idempotency | 14.2-INT-001..010 and 14.4-INT-001..005. | Vitest report, exact row/audit assertions, fault-injection and concurrency output. |
| Connected responsive reliability | 14.4-E2E-001, 004, 005 at 360×640. | Playwright HTML/trace artifacts on failure and DB post-state assertion. |
| Accessibility | 14.4-COMP-004 and 14.4-E2E-007. | Playwright assertions plus a short manual contrast/daylight review record if performed. |
| Scope/governance | 14.1-GOV-001..003 and 14.4-GOV-001. | Manifest coherence, nav/table/deferred-token guard output. |
| Performance/scalability | Baseline pure-engine and booking-save measurements at declared fixture sizes; no gate value until product thresholds exist. | Benchmark/query-plan artifact consumed by nfr-assess; status remains unknown until approved targets exist. |
| Maintainability | Shared-engine import/call-site proof and rule-config golden packs. | Unit/static report and review evidence; no duplicate client rule implementation. |
| Audit/compliance | 14.2 command success/rollback and 14.4 accepted-override audit assertions. | Correlated audit-event rows and negative logs; no Phase C GDPR/retention claim. |

### Execution strategy

- **PR:** run scope/manifest guards, all pure unit/golden packs, the full required DB/RLS suite with SUPABASE_TEST_REQUIRED=1, and focused Epic 14 Playwright cases. Keep the existing cumulative regression gates. If the combined functional run remains under 15 minutes, keep all Epic 14 functional cases in PR.
- **Nightly:** burn in changed concurrency, fault-injection, DST, and 360×640 cases; run representative larger fixture baselines and retain traces/query plans on regressions.
- **Weekly / pre-release:** run the agreed volume/performance profile once thresholds are approved, an exploratory scheduling correctness charter, and manual contrast/daylight checks that automation cannot prove.
- Required evidence uses only the authorized local test infrastructure and CI. No hosted demo tests, migrations, deployment, email/provisioning activation, or flag changes are part of this plan.

### Resource estimate

| Priority | Estimated test-design/implementation effort |
| --- | --- |
| P0 | ~40–65 hours |
| P1 | ~35–55 hours |
| P2 | ~15–30 hours |
| P3 / exploratory | ~4–10 hours |
| **Total** | **~95–160 hours, approximately 2.5–4.5 focused test-owner weeks spread across the four stories** |

Assumptions: existing factories, RLS inventory, command/audit helpers, local stack, and Playwright harness are extended rather than replaced; estimates exclude product implementation and later NFR threshold negotiation.

### Quality gates

- P0 pass rate is 100%; no waiver is implicit.
- P1 pass rate is at least 95%, with every failure triaged and owned.
- All score-9 and score-6 mitigations are implemented and evidenced before Epic 14 release.
- Every Epic 14 tenant-owned table is in the RLS/H4 inventory and exact-policy enumeration; zero unexplained required-suite skips.
- Pure conflict/capacity modules target at least 80% line and branch coverage once measurable. The repository currently lacks an approved line-coverage reporter, so scenario/golden completeness is required and no numeric coverage achievement may be claimed until measurement exists.
- Preview/save equivalence, server re-check under concurrency, atomic rollback, same-key idempotency, cross-tenant/role negatives, DST/N-9 golden packs, and 360×640 failure/retry are mandatory evidence.
- resources is active and scheduling remains pending; any Epic 15 or Phase C live surface fails the gate.
- An evidence source is identified for every in-scope NFR. Final PASS/CONCERNS/FAIL assessment is deferred to bmad-testarch-nfr after implementation evidence exists.

## Step 5 — Output and Validation

- Final artifact: `C:/Users/Rasmus/.codex/worktrees/epic14-scheduling/ElproSaas/_bmad-output/test-artifacts/test-design-epic-14.md`
- Final priority calibration: 7 P0, 64 P1, 2 P2, and 1 P3 atomic planned scenarios (74 total).
- Risk coverage: 10 high risks and 3 medium risks; every high risk has mitigation, owner, timing, planned status, and verification evidence.
- Scope validation: `resources` activates in Story 14.1; `scheduling` and Epic 15 live surfaces remain pending/excluded.
- Structural validation: all required sections present, 74 unique test IDs with no duplicates, all 13 risk rows present, and all 10 high-risk mitigation rows present.
- Execution mode: sequential single-worker, as required for the single epic-level artifact.
- Cleanup validation: no browser or managed service was started; no CLI session or temp artifact remains.
- Evidence statement: this workflow executed no tests and claims no implemented coverage.
- Completion customization resolver succeeded and returned an empty `workflow.on_complete`; no hook was run.
- Workflow result: completed.

## Story 14.3 implementation-author execution — 2026-10-06

Historical design statements above describe their original run. Current implementation execution is recorded in [Story 14.3 author verification](story14-3-verification.md), at the uncommitted `codex/epic14-resume` working tree based on `2a6c9e6d6859987590f2e875f695a75c16125af6`.

- Implemented sole pure engine and real cookie-bound snapshot/sign/finalize authority; all 14 named unit and six named integration obligations execute. Current focused run passes 73/73 with no skip, including transferred INT-003 P0, INT-004 P1, INT-005 P1 and INT-006 P0. Eight consumed-writer race classes, proof/ACL negatives, current-authority replay, exact peer refresh and rollback are actual SQL/command tests.
- Pure units pass 14/14 under UTC, America/Los_Angeles and Asia/Tokyo. Full units pass 1,992/0 failed/one inherited Windows xattr skip. All 32 retained booking cases remain covered.
- Prior authorized eight-worker normal-parallel full integration passed 1,353/0 failed/one opt-in recovery Storage skip. Current full integration after the invitation expiry correction returns native 1: 1,353 passed/one INT-004 failure/one recovery skip. Isolated INT-004 passes; authorized nine-suite representative parallel diagnostics pass 146/146 including all 49 conflicts, peak 30 PostgreSQL client connections. These diagnostic passes do not explain or waive the current full-run failure. Unlimited default-worker results and exact infrastructure errors are preserved in the verification record.
- Author verification remains blocked by the unexplained current cumulative failure. Canonical lint hit generated-snapshot actor EPERM; complete source/test fallback lint and changed-file checks pass without configuration changes. Typecheck, lockfile/service-role/bundle guards, production build, high-level audit and local security advisors pass.
- Two forward migrations applied to root-owned isolated 55421/55422; all 92 previous complete ledger records are unchanged, final count 94. No reset or original-stack mutation. Empty-chain CI remains required before Epic merge. Root retains lifecycle `79338b7b-db58-4a1a-85a2-5d877d3d45e3` for shared verification/review.
- Exactly one author-written Suggested Review Order exists in the spec; 20 stops/anchors validate. Independent review and reviewer trail reconciliation remain pending. No Story 14.4/browser/override, hosted/external or performance/coverage readiness is claimed.

### Authorized Story 14.3 diagnostic continuation — 2026-10-06

At clean resume baseline `a9e2838e80afbd9718c6d907c5518a152b286b1f`, root-owned new lifecycle `730ffa3c-8fe8-4b93-b5b8-4da0f9e61cee` passed isolated Auth/REST/Storage/schema and unchanged 94-record ledger readiness. First current full diagnostic returned native 1: 1,353 passed/one retained INT-009 failure/one recovery skip; all 49 conflict cases passed. Peak 44 client connections is observed, not a causal explanation. JSON-only reporting suppressed safe diagnostic console output.

The concrete reporter defect was corrected invocation-only with default plus JSON reporters, preserving eight-worker file parallelism, required flag, all tests/assertions/config/timeouts. Current complete integration then returned **native 0: 1,355 total / 1,354 passed / 0 failed / 1 intentional recovery skip**, including all 49 conflicts, all 32 retained bookings and exact ACL/inventory cases. Expected real fault/authority codes were observable; no unexpected code or production defect was identified. Historical INT-004 and first-resume INT-009 failures remain recorded with unknown causes; current full execution is not a filtered retry or waiver. Canonical lint and first independent full-implementation review remain pending; its review baseline is original `2a6c9e6d6859987590f2e875f695a75c16125af6`, including `c8d0a881`. See [author evidence](story14-3-verification.md#authorized-diagnostic-continuation--2026-10-06).

Canonical lint EPERM was resolved by root-authorized `eslint.config.mjs` globalIgnore `_bmad/render/**` for immutable generated Markdown/JSON cache only. All source/test coverage and the canonical command are preserved. Build-actor `pnpm run lint` now passes **native 0, 0 errors / 13 inherited warnings**. No DB rerun for this cache-only change; first full-diff independent review remains pending and includes it. The refreshed single author trail validates all 20 stops/anchors.
