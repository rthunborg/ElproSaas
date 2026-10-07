---
workflowStatus: 'completed'
runScope: 'epic-level'
runKey: 'epic-14'
epic: '14 — Resource and Scheduling Foundation'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-10-06'
---

# Test Design: Epic 14 — Resource and Scheduling Foundation

**Date:** 2026-09-29  
**Author:** Rasmus  
**Status:** Draft test plan; implementation evidence is not yet available  
**Scope:** Epic 14 and Stories 14.1–14.4

## Executive Summary

This epic-level design covers person profiles and work hours, bookings and assignees, deterministic conflict detection, and the responsive booking editor with audited overrides. It plans 77 named checks: 8 P0, 66 P1, 2 P2, and 1 P3. Owner-approved contract C splits three combined foundation/conflict scenarios for explicit story ownership while retaining every original acceptance obligation. This design does not claim executed coverage; implementation evidence is recorded separately in the story and progress artifacts.

The assessment identifies 13 risks. Ten are high risks with scores of 6 or 9. The leading risks are missed or phantom conflicts, preview/save disagreement, partial transactional writes, and incorrect Europe/Stockholm or capacity calculations. Tenant isolation, audited overrides, manifest scope, and false-green skipped integration suites are also release-critical.

The governing scope boundary is explicit: Story 14.1 activates the manifest module `resources` with its first Epic 14 schema surface. The separate `scheduling` manifest module belongs to Epic 15 and remains pending throughout Epic 14.

## Owner-approved acceptance ownership — 2026-10-06

[Contract C](../../docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md) preserves order 14.1 → 14.2 → 14.3 → 14.4. Story 14.2 retains schema, RLS, authorization, idempotency, rollback and booking-assignee-audit atomicity. Story 14.3 owns the sole pure engine, authoritative current-row transaction integration and derived-conflict persistence/refresh. No stub or duplicated conflict rules are permitted.

| Original obligation | Foundation check in 14.2 | Engine-dependent check in 14.3 | Priority retained |
| --- | --- | --- | --- |
| 14.2-INT-001 | 14.2-INT-001 | 14.3-INT-003 | P0 |
| 14.2-INT-002 | 14.2-INT-002 | 14.3-INT-004 | P1 |
| 14.2-INT-007 | 14.2-INT-007 | 14.3-INT-005 | P1 |
| 14.2-INT-008 | None; transferred in full | 14.3-INT-006 | P0 |

All four transferred checks, including equivalent mandatory P0 evidence, must pass before any Story 14.4 work and before the Epic PR. No user-facing booking entry point is permitted before the detector is integrated into the authoritative transaction. Story 14.2 completion provides foundation evidence only; conflict evidence cannot be claimed until 14.3 executes it. Every existing Epic gate remains required.

## Scope

### In Scope

- Story 14.1: one person profile per membership, default work-role reuse, weekly work templates and exceptions, tenant calendar days, capacity inputs, admin maintenance, deactivated-user semantics, and `resources` activation.
- Story 14.2: standalone or optionally connected bookings, multi-assignees, composite same-tenant references, UTC instants, conflict-workflow schema, and transactional SECURITY INVOKER create/update foundation commands with RLS, authorization, idempotency, rollback and booking-assignee-audit atomicity; no user-facing booking entry.
- Story 14.3: one pure, clock-free conflict engine shared by preview and authoritative save, integrated into the write transaction with current-row recheck and atomic conflict persistence/refresh, covering double booking, over-capacity, outside-work-hours, access-window, and competence conflicts.
- Story 14.4: responsive booking editor, live warnings, explicit review via `Boka ändå`, required nonblank reason, selected reviewed candidate-related logical conflicts accepted and other reviewed conflicts open, audit evidence, dirty-state protection, retained unsent state, explicit retry, and server-confirmed success. [Contract D](../../docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md) transfers only the empty-slot click/drag portion of 14.4-E2E-006 to Story 15.1; all other 14.4 acceptance remains.
- Existing Phase B guardrails for tenant isolation, role/capability enforcement, audit, manifest coherence, H4 tenant-table enrollment, service-role exclusion, and cumulative regression.

### Out of Scope

| Excluded area | Reason and guard |
| --- | --- |
| Epic 15 scheduling surfaces | Recurrence/series commands, five scheduling views and nav, resolver workflow, time reporting, booking notification categories, and calendar feed remain pending. Static manifest/deferred-scope tests fail if exposed early. |
| Phase C capabilities | AI flows, live supplier APIs, customer portal/online acceptance, public anonymous suggestion, native mobile, offline/PWA queues, and other Phase C ledger items remain excluded. |
| Hosted environment actions | No hosted tests, migrations, deployments, provisioning or email activation, or flag changes are part of this design or later story verification. |
| Existing populated local DB maintenance | This plan assumes isolated test fixtures and migrations. It does not prescribe reset or maintenance of a user-populated database. |
| Final performance certification | Numeric live-warning/save latency and representative volume targets are not approved. Baselines may be collected, but PASS cannot be claimed until owners approve thresholds. |
| Contract scaffolding | Epic 14 has no independently deployed consumer/provider boundary. Pact packages are absent and the SmartBear Pact tool-list probe found no Pact MCP tools, so no provider states or contracts are planned. |

## Risk Assessment

Probability and impact use the TEA 1–3 scale. Score is probability × impact. Scores 6–8 require mitigation; score 9 blocks a positive release decision until mitigated.

### High Risks

| Risk ID | Category | Risk | P | I | Score | Planned mitigation | Owner / timing |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R14-DATA-01 | DATA | The engine misses a real collision or reports a phantom collision across boundaries, multiple assignees, optional links, or rule combinations. | 3 | 3 | 9 | Table-driven and golden unit packs for every conflict type, boundary/permutation checks, and a permanent regression fixture for each discovered defect. | Dev + test owner / Story 14.3 before merge |
| R14-DATA-02 | DATA | Live preview and authoritative save disagree because of duplicate rules, stale inputs, or a concurrent writer. | 3 | 3 | 9 | Import the same pure engine at both call sites and prove save re-runs it inside the transaction against current rows. | Dev + test owner / Story 14.3 authoritative integration before any 14.4 work; 14.4 editor proof |
| R14-DATA-03 | DATA | Create/update partially writes booking, assignees, conflicts, acceptance, idempotency, or audit data; retries or concurrency duplicate state. | 3 | 3 | 9 | Fault-boundary rollback, same-key replay, changed-payload conflict, concurrent races, exact post-state, and one-audit assertions. | Dev + test owner / Story 14.2 foundation, 14.3 conflict integration, extended in 14.4 |
| R14-DATA-04 | DATA | Europe/Stockholm conversion, DST, all-day bounds, actual-schedule capacity, holidays, absence, breaks, buffers, or overtime rules are wrong. | 3 | 3 | 9 | Golden N-9 packs, spring/fall fixtures, formula component isolation, calendar layering, and explicit overtime inputs. | Dev + test owner / Stories 14.1 and 14.3 |
| R14-SEC-01 | SEC | A tenant or role reaches another tenant's person, hours, calendar, booking, assignee, or conflict data, or child rows mix tenants. | 2 | 3 | 6 | Enroll every table in `TENANT_TABLES`; cover cross-tenant CRUD, parent spoofing, anon, disabled membership, and same-tenant role negatives. | Dev + test owner / each migration PR |
| R14-SEC-02 | SEC | Montör own-booking scope, capability, route, and command authorization diverge. | 2 | 3 | 6 | Per-role tests at DB/read/command/route layers; prove Montör sees only joined own-person bookings and cannot invoke planner/admin mutations. | Dev + test owner / Stories 14.1, 14.2, 14.4 |
| R14-DATA-05 | DATA | Constraints admit invalid windows, duplicate assignees, orphaned profiles, cross-tenant links, or multiple profiles per membership. | 2 | 3 | 6 | DB negatives for interval, uniqueness, domain, 1:1, and composite same-tenant invariants. | Dev + test owner / Stories 14.1–14.2 |
| R14-BUS-01 | BUS | Conflict override is silently accepted, lacks reason/actor, leaves a selected logical conflict open, or carries stale acceptance to a changed collision. | 2 | 3 | 6 | Require nonblank reason; atomically persist accepted conflicts and audit; keep reviewed but unselected candidate conflicts open; exclude unrelated tenant acceptance; reopen changed natural keys. | Dev + test owner / Story 14.4 |
| R14-TECH-01 | TECH | Epic 14 activates the wrong module or exposes Epic 15 nav, tables, categories, public feed, recurrence, resolver, or time reports. | 2 | 3 | 6 | Prove `resources` active with E14 surfaces and `scheduling` pending with empty live surfaces; run manifest-derived and deferred scans. | Dev + test owner / Story 14.1 and every Epic 14 PR |
| R14-OPS-01 | OPS | Required DB/RLS evidence skips when local Supabase is unavailable and produces a false-green gate. | 2 | 3 | 6 | Set `SUPABASE_TEST_REQUIRED=1`, report executed/skipped counts, reconcile discovery with execution, and treat explicit skips as gaps. | Story author + reviewer / every story gate |

### Medium Risks

| Risk ID | Category | Risk | P | I | Score | Planned mitigation | Owner / timing |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R14-DATA-06 | DATA | Deactivation permits new assignments, leaves future work actionable, or destroys/reassigns history without evidence. | 2 | 2 | 4 | Prevent new assignment, preserve history, surface needs-reassignment state, and prove no destructive cascade. | Dev + test owner / Stories 14.1–14.2 |
| R14-OPS-02 | OPS | Phone save failure loses draft data, shows premature success, duplicates on retry, or leaves stale warnings. | 2 | 2 | 4 | 360×640 failure injection with draft retention, unsent state, explicit retry, no early success, idempotent post-state, and refreshed warnings. | Dev + test owner / Story 14.4 |
| R14-PERF-01 | PERF | Live conflict feedback or saves are too slow at realistic volumes; no numeric target or approved volume exists. | 2 | 2 | 4 | Mark thresholds UNKNOWN; baseline declared fixture sizes and query plans; obtain approved targets before an NFR PASS claim. | Architect/product + test owner / before Story 14.4 exit |

No low risks were retained in this epic plan. Low-impact presentation checks are covered by the broader P1/P2 scenarios rather than recorded as separate release risks.

All scores are pre-mitigation. Residual risk remains unassessed until the planned evidence executes; performance and scalability specifically remain UNKNOWN until owners approve targets.

### Risk Category Legend

- **TECH:** architecture, integration, or maintainability
- **SEC:** authorization, tenant isolation, or data exposure
- **PERF:** latency, throughput, or scale
- **DATA:** integrity, determinism, atomicity, or time calculation
- **BUS:** user-visible business-rule harm
- **OPS:** execution, environment, or evidence reliability

## NFR Planning

| NFR | Threshold or invariant | Risk link | Planned evidence | Status before implementation |
| --- | --- | --- | --- | --- |
| Security / tenant isolation | Forced RLS on every tenant-owned table; anon denied; no client service-role path; capability plus row scope; complete H4 inventory. | R14-SEC-01/02 | Migration reset, parameterized Vitest RLS/anon/role negatives, service-role source/bundle gates, command/route authorization. | Defined, unexecuted |
| Data integrity / determinism | One pure no-I/O/no-clock engine; save re-runs it in transaction; UTC storage; Europe/Stockholm interpretation; approved DST disambiguation. | R14-DATA-01..05 | Node unit/golden packs, repeated-input determinism, Vitest preview/save equivalence, concurrency/fault tests, constraints. | Defined, unexecuted |
| Connected field reliability | Suitable unsent state survives failure; explicit retry; success after server confirmation; no offline queue/sync. | R14-OPS-02, R14-DATA-03 | 360×640 Playwright failure/retry report, trace on failure, and post-retry DB state. | Defined, unexecuted |
| Accessibility / responsive UX | Usable at 360×640; keyboard/dialog parity; focus/dirty-state controls; live-region announcements; approved touch-target floors; non-color status. | R14-OPS-02 | Playwright viewport, keyboard, focus, accessible-name/live-region, bounding-box assertions; manual contrast/daylight record. | Defined, unexecuted |
| Maintainability | Capacity rules remain config/data; preview and save share the engine; no E15/Phase C surface. | R14-TECH-01, R14-DATA-02/04 | Static import/call-site proof, golden config packs, manifest/deferred scans, review. | Defined, unexecuted |
| Operational evidence | Required DB/RLS run uses `SUPABASE_TEST_REQUIRED=1`; tests target only authorized local infrastructure. | R14-OPS-01 | CI/local report with executed/skipped counts and endpoint attestation. | Defined, unexecuted |
| Performance | No Epic 14 latency or representative-volume target is approved. | R14-PERF-01 | Baseline/query-plan artifact at declared fixture sizes, followed by NFR assessment after approval. | UNKNOWN |
| Scalability | No maximum persons, horizon bookings, assignees, or calendar exceptions is approved. | R14-PERF-01 | Volume matrix and explain/baseline artifact after product assumptions are approved. | UNKNOWN |
| Audit / compliance | Conflict acceptance includes reason, actor, state, and audit in one transaction. | R14-BUS-01, R14-DATA-03 | Vitest success/rollback report and correlated audit rows. | Defined within Phase B, unexecuted |

## Entry Criteria

- The implementing story is approved and its schema/command contract is final enough to derive fixtures. Before any 14.4 work, 14.3 detector integration and transferred 14.3-INT-003/004/005/006 evidence must pass.
- Story 14.1 changes `resources` from pending to active in the same PR as the first E14 schema surface; `scheduling` remains pending.
- New tables and permission rows are declared in the manifest-derived inventories before integration evidence is accepted.
- Existing tenant, membership, role, audit, and idempotency factories are extended with deterministic Epic 14 builders.
- Any local database or browser resource needed during implementation is acquired through the trusted resource guard; hosted demo infrastructure remains untouched.

## Exit Criteria

- All P0 scenarios pass and at least 95% of P1 scenarios pass, with every failure triaged and owned.
- All score-9 and score-6 mitigations have executed evidence; no unmitigated high risk remains.
- No open severity-P0 or severity-P1 defect remains; any exception requires a recorded owner decision and residual-risk acceptance.
- Every Epic 14 tenant table is enrolled in H4/RLS inventory and exact-policy checks, with zero unexplained required-suite skips.
- Preview/save equivalence, current-row server re-check, rollback, idempotency, cross-tenant/role negatives, DST/N-9 packs, and phone failure/retry have evidence.
- `resources` is active; `scheduling` remains pending; no E15 or Phase C live surface is introduced.
- Performance/scalability remain UNKNOWN until approved thresholds and volume assumptions exist; they cannot be reported as PASS from functional evidence.

## Test Coverage Plan

Priorities describe release criticality, not execution timing. Every row is an atomic planned scenario. Parameterized tests must report each data row separately.

### P0 — Critical (8 checks)

**Criteria:** Critical security, data-integrity, scope, or business authority with no safe workaround. Risk score supports but does not determine priority.

| Test ID | Requirement | Test level | Risk link | Notes |
| --- | --- | --- | --- | --- |
| 14.1-RLS-001 | Cross-tenant profile, hours, calendar CRUD and parent-spoof denial. | RLS integration | R14-SEC-01 | Covers all Story 14.1 tables. |
| 14.1-GOV-001 | `resources` activates with E14 metadata/tables/permissions and derived guardrails agree. | Static/unit | R14-TECH-01 | Same PR as first schema surface. |
| 14.1-GOV-002 | `scheduling` remains pending with empty live surfaces. | Static/unit | R14-TECH-01 | Exact E14/E15 boundary. |
| 14.2-INT-001 | Create atomically commits one booking, assignees, idempotency outcome and one audit event. | Command integration | R14-DATA-03 | Foundation exact post-state; derived-conflict portion is 14.3-INT-003. |
| 14.3-INT-003 | Create atomically commits server-derived conflicts with booking, assignees, idempotency outcome and one audit event. | Command integration | R14-DATA-03 | Transferred P0 conflict portion of 14.2-INT-001; exact post-state. |
| 14.3-INT-006 | Conflict committed after preview is detected inside authoritative save against current rows. | Command integration | R14-DATA-02 | Transferred P0 14.2-INT-008; client preview is not authority. |
| 14.2-RLS-001 | Cross-tenant booking, assignee, and conflict reads/writes fail. | RLS integration | R14-SEC-01 | Direct and command paths. |
| 14.4-INT-002 | Explicit review plus nonblank reason atomically accepts selected candidate-related whole logical conflict groups with actor/reason/audit; never unrelated tenant conflicts. | Command integration | R14-BUS-01 | Contract D selective transactional override, including aggregate associations. |

### P1 — High (66 checks)

**Criteria:** Core, frequent, or complex behavior with material user reach and a limited workaround. Risk score supports but does not determine priority.

| Test ID | Requirement | Test level | Risk link | Notes |
| --- | --- | --- | --- | --- |
| 14.1-GOV-003 | Every new tenant table is in H4 and policy inventory; omission fails. | Integration gate | R14-SEC-01 | Fail-loud enrollment. |
| 14.2-INT-003 | Same command key and canonical request replay without duplicates. | Command integration | R14-DATA-03 | Idempotent success. |
| 14.2-INT-005 | Concurrent identical creates yield one durable booking. | Command integration | R14-DATA-03 | Promise-based race. |
| 14.2-RLS-002 | Montör sees only bookings joined to their own person. | RLS integration | R14-SEC-02 | Prevent coworker-only inference. |
| 14.3-UNIT-001 | Shared-assignee overlap emits one stable double-booking conflict. | Unit | R14-DATA-01 | Stable natural key. |
| 14.3-UNIT-004 | Time above actual-schedule capacity emits over-capacity. | Unit | R14-DATA-01/04 | Injected threshold. |
| 14.3-UNIT-012 | Each term of the six-term capacity formula changes only its named term. | Unit/golden | R14-DATA-04 | N-9 golden pack. |
| 14.3-INT-002 | Concurrent committed booking is added by authoritative save. | Integration | R14-DATA-02 | Stale preview cannot suppress. |
| 14.4-E2E-004 | Failed phone save retains suitable draft, marks unsent, offers retry, and shows no success. | E2E | R14-OPS-02 | Exact 360×640. |
| 14.4-E2E-005 | Retry produces one server-confirmed booking and one related state set. | E2E | R14-DATA-03, R14-OPS-02 | No duplicate. |
| 14.4-GOV-001 | No recurrence, E15 nav/views/resolver/time reports/notifications/feed surface ships. | Static/unit | R14-TECH-01 | Fail-loud scope guard. |
| 14.1-UNIT-001 | Capacity follows four full scheduled days for an 80% person. | Unit | R14-DATA-04 | Does not synthesize five short days. |
| 14.1-UNIT-002 | Five explicit short days retain their day-level shape. | Unit | R14-DATA-04 | Differs from four-day template. |
| 14.1-UNIT-003 | Breaks reduce scheduled time exactly once. | Unit | R14-DATA-04 | Never available capacity. |
| 14.1-UNIT-004 | Public holiday and tenant-day layers avoid double subtraction. | Unit | R14-DATA-04 | Closed/reduced variants. |
| 14.1-UNIT-005 | Vacation, sickness, leave, training, and blocked time subtract overlap only. | Unit | R14-DATA-04 | Parameterized rows. |
| 14.1-UNIT-006 | Optional planning buffer follows injected configuration. | Unit | R14-DATA-04 | No hardcoded buffer. |
| 14.1-UNIT-007 | Overtime adds no ordinary capacity without explicit authorization. | Unit | R14-DATA-04 | Decision is an input. |
| 14.1-DB-001 | One membership owns exactly one person profile. | DB integration | R14-DATA-05 | Second insert has no side effect. |
| 14.1-DB-002 | Default work role must exist in the same tenant. | DB integration | R14-SEC-01/05 | Reuses existing catalog. |
| 14.1-DB-003 | Valid shifts/breaks persist; invalid or overlapping bounds fail. | DB integration | R14-DATA-05 | Final schema contract governs overlap. |
| 14.1-DB-004 | Calendar-day variants persist without rule-specific schema expansion. | DB integration | R14-DATA-04 | Data/config driven. |
| 14.1-RLS-002 | Entitled maintainers succeed; non-entitled roles fail at DB/command/route. | RLS integration | R14-SEC-02 | Matrix-derived. |
| 14.1-RLS-003 | Anon, no-membership, invited, and disabled callers get no data or mutations. | RLS integration | R14-SEC-01 | Negative states. |
| 14.1-E2E-001 | Admin edits default role and weekly schedule and sees persisted values after reload. | E2E | Story 14.1 | Thin persistence path. |
| 14.1-E2E-002 | Deactivated person cannot be newly assigned; history remains and future work needs reassignment. | E2E | R14-DATA-06 | No destructive cascade. |
| 14.2-DB-001 | Standalone booking with every optional connection null is valid. | DB integration | R14-DATA-05 | FR84/PB-D12. |
| 14.2-DB-002 | Optional connections accept same-tenant targets and reject foreign/mismatched parents. | DB integration | R14-SEC-01/05 | Each connection parameterized. |
| 14.2-DB-003 | End after start is enforced; zero/negative windows write nothing. | DB integration | R14-DATA-05 | Constraint evidence. |
| 14.2-DB-004 | Timed and all-day bookings store UTC and preserve approved local display interval. | DB integration | R14-DATA-04 | Europe/Stockholm. |
| 14.2-DB-005 | Duplicate assignee or foreign-tenant person fails. | DB integration | R14-DATA-05 | Composite same-tenant reference. |
| 14.2-INT-002 | Update atomically replaces mutable booking fields/assignees with idempotency and audit state. | Command integration | R14-DATA-03 | Foundation update; conflict re-derivation is 14.3-INT-004. |
| 14.3-INT-004 | Update re-derives conflicts and replaces stale derived rows atomically with booking/assignees/idempotency/audit. | Command integration | R14-DATA-02/03 | Transferred conflict portion of 14.2-INT-002. |
| 14.2-INT-004 | Reusing a command key with changed canonical content returns stable conflict and no change. | Command integration | R14-DATA-03 | Negative idempotency. |
| 14.2-INT-006 | Failure after booking insert rolls back all business/idempotency/audit state. | Command integration | R14-DATA-03 | Fault injection. |
| 14.2-INT-007 | Failure after assignee preparation leaves zero partial business/idempotency/audit state. | Command integration | R14-DATA-03 | Foundation fault injection; conflict fault is 14.3-INT-005. |
| 14.3-INT-005 | Failure after conflict preparation rolls back booking/assignee/conflict/idempotency/audit state. | Command integration | R14-DATA-03 | Transferred conflict portion of 14.2-INT-007; exact fault post-state. |
| 14.2-RLS-003 | Montör cannot invoke planner/admin create or update unless final matrix grants it. | RLS integration | R14-SEC-02 | Direct command attempt. |
| 14.2-RLS-004 | Entitled planner/admin succeeds within tenant; direct routes/commands still authorize. | RLS integration | R14-SEC-02 | UI absence irrelevant. |
| 14.2-INT-009 | Booking binds to an existing Phase A basic job and preserves its ID. | Command integration | FR84 | Forward-compatible binding. |
| 14.2-INT-010 | Deactivated person cannot be newly assigned; historical assignment remains. | Command integration | R14-DATA-06 | No cascade. |
| 14.3-UNIT-002 | Adjacent half-open intervals do not conflict. | Unit | R14-DATA-01 | Exact boundary. |
| 14.3-UNIT-003 | Only the colliding assignee is reported and input order does not matter. | Unit | R14-DATA-01 | Permutation check. |
| 14.3-UNIT-005 | Candidate wholly or partly outside shift emits outside-work-hours. | Unit | R14-DATA-01 | Violating window retained. |
| 14.3-UNIT-006 | Break or absence emits outside-work-hours without duplicate identity. | Unit | R14-DATA-01/04 | Capacity interaction. |
| 14.3-UNIT-007 | Job access-window conflict applies when supplied; standalone booking has none. | Unit | R14-DATA-01 | Optional rule input. |
| 14.3-UNIT-008 | Missing required role emits competence-missing; matching input clears it. | Unit | R14-DATA-01 | Supplied requirement. |
| 14.3-UNIT-009 | Spring nonexistent local time maps to first valid instant. | Unit | R14-DATA-04 | Host-timezone stable. |
| 14.3-UNIT-010 | Fall ambiguous local time maps to earlier instant. | Unit | R14-DATA-04 | Host-timezone stable. |
| 14.3-UNIT-011 | Repeated frozen input returns byte-equivalent sorted output with no clock/I/O. | Unit | R14-DATA-01 | Determinism. |
| 14.3-UNIT-013 | Authorized overtime is injected config and needs no schema-shape change. | Unit | R14-DATA-04 | Maintainability. |
| 14.3-INT-001 | Preview and save given identical frozen facts return the same normalized conflicts. | Integration | R14-DATA-02 | Shared engine proof. |
| 14.3-UNIT-014 | Every corrected miss/phantom becomes a named immutable regression fixture. | Unit/golden | R14-DATA-01 | Regression policy. |
| 14.4-COMP-001 | Desktop editor is a focus-trapped side sheet with no recurrence controls. | Component | R14-TECH-01 | Approved E14 fields only. |
| 14.4-E2E-001 | At 360×640 editor is full-screen, scrollable, no overflow, actions reachable. | E2E | R14-OPS-02 | ADR-B009. |
| 14.4-COMP-002 | Assignee, role, time, connection, and description edits preserve draft model. | Component | R14-OPS-02 | Form-state integrity. |
| 14.4-COMP-003 | Assignee/time changes refresh ConflictPanel and remove stale warnings. | Component/integration | R14-DATA-02 | Shared engine. |
| 14.4-COMP-004 | Conflict panel exposes type/person/window/context/timeline without color-only status. | Component | Accessibility | Accessible semantics. |
| 14.4-INT-001 | Conflict save without explicit proof returns BOOKING_CONFLICT_UNACKNOWLEDGED. | Command integration | R14-BUS-01 | Authority cannot be bypassed. |
| 14.4-INT-003 | Blank reason, forged IDs, stale preview, or unauthorized override changes nothing. | Command integration | R14-BUS-01/SEC-02 | Parameterized negatives. |
| 14.4-INT-004 | Reviewed but unselected candidate conflicts stay open; open count excludes accepted/resolved; unrelated conflicts do not inherit acceptance. | Command integration | R14-BUS-01 | Contract D distinguishes review from acceptance. |
| 14.4-INT-005 | Changed collision natural key reopens detection. | Command integration | R14-BUS-01 | Acceptance is not blanket. |
| 14.4-E2E-002 | Conflict count after reload reflects persisted open conflicts only. | E2E | R14-BUS-01 | Accepted excluded. |
| 14.4-E2E-003 | Dirty Escape/back/close warns; cancel retains and confirm discards intentionally. | E2E | R14-OPS-02 | Focus returns predictably. |
| 14.4-E2E-006 | Current toolbar/job/customer entries prefill context without E15 Planering/nav. Only empty-slot click/drag portion transfers to Story 15.1 actual Schema/Resurser hosts. | E2E | R14-TECH-01 | Contract D: both actual click and drag must pass before applicable calendar entry-point exposure and 15.1 completion; prefill-only evidence is insufficient. |
| 14.4-E2E-007 | Keyboard use, focus, live regions, and touch targets meet approved requirements. | E2E | Accessibility | Automated bounds plus semantics. |

### Contract D cross-epic acceptance transfer — 2026-10-07

The 77 named checks and prior evidence are retained; no check is deleted or credited executed by this amendment. `14.4-E2E-006` has explicit ownership portions: Story 14.4 proves its current toolbar/job/customer entries; **Story 15.1: The Five Scheduling Views** owns its original empty-slot click/drag portion in the actual `Schema` and `Resurser` calendar hosts. Both real click and drag must open the same editor with selected interval/person context (Resurser: person/start/end) before those calendar entry points are exposed and before 15.1 completion. Preserve keyboard/dialog parity. Record this portion separately as transferred/pending until actual browser evidence passes; a component or prefill-seam test in 14.4 cannot satisfy it. Story 14.4/Epic 14 may claim only retained acceptance, never execution of the pending transferred portion. No other 14.4 acceptance, Contract C transfer or mandatory gate changes.

### P2 — Medium (2 scenarios)

**Criteria:** Secondary validation with narrower reach or an acceptable temporary workaround.

| Test ID | Requirement | Test level | Risk link | Notes |
| --- | --- | --- | --- | --- |
| 14.NFR-PERF-001 | Benchmark engine and save path at owner-approved representative volumes and latency thresholds. | Performance | R14-PERF-01 | Conditional on approved targets; until then collect non-gating baselines only. |
| 14.NFR-A11Y-001 | Review contrast and daylight readability for conflict states and primary actions. | Manual accessibility | Accessibility | Supplements automated semantic/bounds checks. |

### P3 — Low / Exploratory (1 scenario)

**Criteria:** Rare or exploratory behavior with minimal direct release impact.

| Test ID | Requirement | Test level | Risk link | Notes |
| --- | --- | --- | --- | --- |
| 14.EXP-001 | Explore multi-assignee edits across work-hour, DST, access-window, and retry boundaries. | Exploratory | R14-DATA-01/02/04 | Time-boxed charter after deterministic suites pass. |

### Coverage Summary

| Priority | Count | Focus |
| --- | ---: | --- |
| P0 | 8 | Scope activation, tenant isolation, authoritative save, atomic create, and audited override. |
| P1 | 66 | Full conflict/capacity and command matrix, schema/role negatives, UI reliability, accessibility, and deactivation semantics. |
| P2 | 2 | Approved-target performance and supplementary manual accessibility. |
| P3 | 1 | Cross-rule exploratory charter. |
| **Total** | **77** | Planned checks preserving the original 74 scenario obligations; none executed by this design workflow. |

## Execution Strategy

### Pull Request

- Run manifest/scope guards, pure conflict and capacity unit/golden packs, and the full required DB/RLS suite with `SUPABASE_TEST_REQUIRED=1`.
- Run focused Epic 14 browser scenarios through Playwright's configured production web server, including the 360×640 cases. Do not substitute `next dev`.
- Retain existing cumulative regression gates. Run everything in PRs if the combined functional run remains below 15 minutes; defer only expensive or long-running work.
- The current browser suite is serial because it shares a seeded fixture. Parallel workers or sharding may be enabled only after fixture isolation makes them deterministic; this is the route to keeping a larger suite within the 10–15 minute target.
- Publish executed/skipped counts. A discovered test that is skipped is a test gap, not coverage.

### Nightly

- Burn in concurrency, fault injection, DST, and 360×640 failure/retry scenarios.
- Run declared larger fixture baselines and retain traces/query plans when results regress.
- Re-run any changed regression fixture pack across supported host timezones or an equivalent timezone matrix.

### Weekly / Pre-release

- Run the approved volume/performance profile after owners define targets.
- Execute the cross-rule exploratory charter.
- Record supplementary contrast/daylight review where automation cannot prove the visual result.

Required evidence may use authorized local/CI resources only. Hosted demo tests, migrations, deployments, provisioning or email enablement, and flag changes are excluded.

## Resource Estimates

| Priority | Estimated test implementation and evidence effort |
| --- | ---: |
| P0 | 40–65 hours |
| P1 | 35–55 hours |
| P2 | 15–30 hours |
| P3 / exploratory | 4–10 hours |
| **Total** | **95–160 hours, approximately 2.5–4.5 focused test-owner weeks across the four stories** |

The estimate assumes existing factories, RLS inventory, command/audit helpers, local stack, and Playwright harness are extended. Product implementation and NFR target negotiation are excluded.

## Prerequisites and Test Data

### Factories and Fixtures

- Unique Tenant A and Tenant B with active, invited, disabled, and no-membership identities.
- Tenant roles/capabilities for admin, planner, Montör, and representative non-entitled roles.
- Existing same-tenant and foreign-tenant work roles, jobs, customers, facilities, contacts, and other optional booking parents.
- Person profiles with four-full-day and five-short-day 80% schedules, breaks, holidays, tenant closed/reduced days, absence, blocked time, buffer, and explicit overtime decisions.
- Timed and all-day bookings with one and multiple assignees, exact-boundary and overlap intervals, access windows, competence requirements, and deactivated people.
- Frozen Europe/Stockholm spring-forward and fall-back fixtures plus immutable N-9 conflict/capacity golden packs.
- Idempotency keys, audit correlation identifiers, injected command fault points, and deterministic retry fixtures.
- Conflict records in open, accepted, and resolved states with natural-key changes.

Factories must generate unique values per run, create only through approved tenant-aware helpers, and clean up only their own isolated records. They must not reset or maintain a populated user database.

### Environment and Tooling

- Node `--test` for pure modules, Vitest for database/RLS/command integration, and Playwright for component/browser E2E using the configured production server.
- Existing native repository helpers are authoritative. `@seontechnologies/playwright-utils` and Pact packages are absent, so their optional utility mandates do not bind this plan.
- Required DB/RLS execution sets `SUPABASE_TEST_REQUIRED=1` and validates the authorized local endpoint before accepting results.
- Later local services are acquired only through the actor's trusted resource-guard context. This design run started no services and executed no tests.

## High-Risk Mitigation Plan

| Risk ID | Mitigation action | Owner | Due | Status | Verification |
| --- | --- | --- | --- | --- | --- |
| R14-DATA-01 | Implement complete table/golden conflict packs and permanent miss/phantom regression fixtures. | Story 14.3 dev + test owner | Before 14.3 merge | Planned | 14.3 unit/golden report; named fixture review. |
| R14-DATA-02 | Share one engine and re-evaluate current rows inside save transaction. | Story 14.3 dev + test owner; 14.4 editor owner | Integration/transferred checks before any 14.4 work and Epic PR; editor proof at 14.4 exit | Planned | 14.3-INT-001/002/004/006, 14.4-COMP-003. |
| R14-DATA-03 | Add rollback, replay, changed-payload, and concurrent-race coverage with exact row/audit counts. | Story 14.2 foundation and 14.3 integration dev + test owners | Foundation at 14.2 exit; conflict checks before any 14.4 work and Epic PR; extend in 14.4 | Planned | 14.2-INT-001..007, 14.3-INT-003/004/005 and 14.4-E2E-005. |
| R14-DATA-04 | Freeze DST and N-9 capacity packs and prove each formula component independently. | Stories 14.1/14.3 dev + test owner | Before 14.3 merge | Planned | 14.1-UNIT-001..007; 14.3-UNIT-009/010/012. |
| R14-SEC-01 | Enroll every table in H4/exact-policy inventory and run cross-tenant/anon/parent-spoof negatives. | Migration author + security test owner | Each schema PR | Planned | 14.1-RLS-001/003, 14.1-GOV-003, 14.2-RLS-001. |
| R14-SEC-02 | Assert the final role matrix across DB, command, route, and direct URL boundaries. | Story authors + security test owner | Stories 14.1, 14.2, 14.4 | Planned | 14.1-RLS-002 and 14.2-RLS-002..004. |
| R14-DATA-05 | Encode and negatively test interval, uniqueness, domain, and same-tenant reference constraints. | Migration author + test owner | Stories 14.1–14.2 | Planned | 14.1-DB-001..004 and 14.2-DB-001..005. |
| R14-BUS-01 | Require reason/actor, atomically persist acceptance/audit, and reopen changed conflict identities. | Story 14.4 dev + test owner | Before 14.4 merge | Planned | 14.4-INT-001..005 and 14.4-E2E-002. |
| R14-TECH-01 | Activate only `resources`; keep `scheduling` pending; enforce manifest-derived and deferred scans. | Story 14.1 author + reviewer | Every Epic 14 PR | Planned | 14.1-GOV-001/002 and 14.4-GOV-001. |
| R14-OPS-01 | Make local stack required and report/reconcile executed and skipped tests. | Story author + reviewer | Every story gate | Planned | CI/local logs show `SUPABASE_TEST_REQUIRED=1`, discovered/executed counts, zero unexplained skips. |

## Quality Gates

- P0 pass rate: 100%. No implicit waiver. Transferred 14.3-INT-003/004/005/006 checks are mandatory before any 14.4 work and the Epic PR; no user-facing booking entry before authoritative detector integration.
- P1 pass rate: at least 95%, with every failure triaged and owned.
- P2/P3 pass rate: at least 90% when applicable; failures remain informational only after triage.
- High risks: all score-9 and score-6 mitigations implemented and evidenced; no open high risk at epic exit.
- Isolation: every Epic 14 tenant table appears in H4/RLS inventory and exact-policy enumeration; cross-tenant and anonymous negatives pass.
- Evidence integrity: required integration/RLS suites have zero unexplained skips, and discovery counts reconcile with executed counts.
- Determinism: preview/save equivalence, current-row server re-check, DST/N-9 packs, and stable conflict identity all pass.
- Transactions: rollback, same-key replay, changed-payload conflict, and concurrent create/update cases show exact durable state and audit counts.
- Responsive reliability: the 360×640 failed-save/retry path retains draft state, does not show premature success, and does not duplicate data.
- Governance: `resources` is active, `scheduling` is pending, and E15/Phase C surfaces remain absent.
- Coverage measurement: pure conflict/capacity modules target at least 80% line and branch coverage once a repository-approved reporter exists. Until then, scenario/golden completeness is required and no numeric coverage achievement is claimed.
- NFR status: every in-scope NFR has an evidence source; final PASS/CONCERNS/FAIL belongs to `bmad-testarch-nfr` after implementation evidence exists.

## Assumptions and Dependencies

### Assumptions

1. Story 14.1 owns activation of `resources`; it does not activate `scheduling`.
2. The final story permission matrix remains consistent with tenant admin/planner maintenance and Montör own-person read scope. Tests must follow the approved matrix if it becomes more restrictive.
3. Capacity is derived from the actual weekly schedule and exception layers, not directly from employment percentage.
4. The pure engine accepts all time/rule facts as inputs and performs no clock, database, or network access.
5. Existing test helpers will be extended rather than replaced, and test state will remain isolated from user-populated databases.

### Dependencies

1. Existing membership/tenant-role, work-role, job/customer/facility/contact, audit, and idempotency foundations remain stable.
2. Story 14.1 schema and factories precede Story 14.2 foundation command evidence; 14.2 schema/transactions precede 14.3 detector integration. The original story order is retained.
3. Story 14.3 engine and golden packs are shared by preview and server save; authoritative integration and transferred checks must pass before any 14.4 work, user-facing booking entry, and the Epic PR.
4. Owner-approved latency and scale targets are required before performance/scalability can exit UNKNOWN.

### Risks to the Plan

- If the role matrix or schema contract changes materially, affected RLS/DB scenario parameters and estimates must be refreshed without expanding into Epic 15.
- If required local infrastructure is unavailable, DB/RLS evidence is blocked rather than silently skipped; pure design and unit work can continue.
- If the production-server E2E lane exceeds the agreed PR budget, only lower-priority repetition may move to nightly; P0 browser evidence remains a PR gate.

## Interworking and Regression

| Area | Regression obligation |
| --- | --- |
| Membership and deactivation | Preserve Story 11.3 history and deny new assignment without destructive cascades. |
| Work roles | Reuse existing tenant-scoped catalog and prevent cross-tenant role references. |
| Jobs and optional parents | Existing Phase A job IDs remain stable; nullable standalone bookings remain valid. |
| Audit and idempotency | New commands follow existing correlation, rollback, replay, and changed-payload semantics. |
| RLS inventories | New tables join the cumulative H4/anon/exact-policy gates; existing tables stay green. |
| Manifest governance | Existing derived nav/table/widget/category/public/file-owner guards remain fail-loud. |
| Browser shell | Existing route/auth/navigation behavior remains green while no E15 Planering surface appears. |

## Follow-on Workflows

- Run `bmad-testarch-atdd` per story before implementation to turn these scenarios into failing acceptance artifacts.
- Run `bmad-testarch-automate` as implementation lands to fill approved unit/integration/E2E gaps.
- Run `bmad-testarch-trace` and `bmad-testarch-nfr` after evidence exists. This document is planning input and does not substitute for traceability or NFR assessment.

## Approval Record

| Role | Name | Status | Date |
| --- | --- | --- | --- |
| Test design author | Rasmus / TEA workflow | Draft complete | 2026-09-29 |
| Product/architecture owner | TBD | Pending implementation-phase review of latency/scale targets and any matrix changes | — |
| Acceptance ownership owner | Rasmus | Contract C approved; no waiver of Epic acceptance or remaining gates | 2026-10-06 |
| Story reviewers | TBD | Pending per-story implementation and evidence | — |

## References

- `_bmad-output/planning-artifacts/epics-phase-b.md`
- `_bmad-output/planning-artifacts/prd-phase-b.md`
- `_bmad-output/planning-artifacts/architecture-phase-b.md`
- `_bmad-output/planning-artifacts/ux-design-specification-phase-b.md`
- `_bmad-output/project-context.md`
- `src/scope/manifest.ts`
- `docs/process/local-setup.md`
- `AGENTS.md`
- Prior system designs: `_bmad-output/test-artifacts/test-design-architecture.md` and `test-design-qa.md`

## Knowledge Base Applied

- Risk governance and probability-impact scoring.
- Test-level selection and priority classification.
- NFR criteria, fixture architecture, data factories, network-first patterns, selector resilience, confidence gates, evidence integrity, and test quality.
- Repository-native Playwright, Vitest, and Node patterns; optional Playwright Utils and PactJS integrations were unavailable and not required for this epic boundary.
