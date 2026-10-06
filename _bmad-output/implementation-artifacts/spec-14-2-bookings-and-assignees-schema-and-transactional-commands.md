---
title: 'Story 14.2: Bookings and Assignees — Schema and Transactional Commands'
type: 'feature'
created: '2026-10-02'
status: 'draft'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'docs/process/review-order.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The active resource foundation has people and availability but no tenant-safe booking record, multi-assignee relation, or durable command path. Later scheduling views and the booking editor need a stable, idempotent write boundary that can bind to the existing job container without making scheduling a live module.

**Approach:** Add booking, assignee, and conflict-workflow persistence to the already-active `resources` module. Create and update commands use the established envelope and narrow transactional RPCs so the canonical booking, assignees, idempotency outcome, and one audit event succeed or fail together. Story 14.3 integrates the sole detector and derived-conflict persistence/refresh into that authoritative transaction before any 14.4 work or user-facing booking entry.

## Boundaries & Constraints

**Always:** Keep `resources` active and extend its manifest-owned tenant-table inventory with `bookings`, `booking_assignees`, and `booking_conflicts`; retain `scheduling` pending with every live-surface array empty. Store time bounds as UTC `timestamptz`, enforce `ends_at > starts_at`, preserve the approved Europe/Stockholm local interpretation, and allow a fully standalone booking. All optional job, customer, facility, contact, work-role, and profile references must be same-tenant composite relationships. New assignment rejects deactivated people while retaining historical rows. Commands resolve tenant, actor, roles, and correlation server-side; create uses a command UUID plus canonical payload identity, and every mutable write is command-only, RLS-protected, auditable, and atomic.

**Block If:** A schema or command decision would require activating `scheduling`, granting Montör booking mutation, introducing a parallel employee/work-role model, accepting client-supplied conflict results, or defining/conflicting with the shared detection rules that Story 14.3 owns.

**Never:** Add a scheduling route, nav item, calendar/editor UI, recurrence or series command, time reports, notification category/producer, public feed, PWA/offline behavior, service-role path, hosted/demo change, or a second conflict engine. Do not turn an existing basic-job connection into a new job model.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Create standalone booking | Entitled admin/planner, valid UTC range, command key, optional links all absent, distinct active assignees | Exactly one booking and its assignees persist; the transaction records the idempotency result and one target-only audit event; derived-conflict acceptance belongs to 14.3 | Same canonical retry returns the original durable result without another row or audit event |
| Reuse command key | Existing create key with changed canonical payload | No booking, assignee, conflict, idempotency, or audit state changes | Return a stable generic command conflict without echoing payload or tenant data |
| Invalid or foreign relationship | Nonpositive range, duplicate assignee, foreign/mismatched optional parent, or deactivated profile | Transaction writes nothing | Return a typed validation or tenant-access result; never raw SQL or identifiers |
| Transactional update/fault | Existing same-tenant booking with replacement fields/assignees; fault injection after booking or assignee preparation | Successful update replaces mutable booking/assignee state; either injected failure leaves every business, idempotency, and audit row unchanged | Generic retryable server error for unexpected faults; no partial state |
| Role and row scope | Montör reads a booking assigned to their own profile, another worker's booking, or invokes a planner/admin mutation | Own assigned booking is visible; other-worker data and mutation are denied | RLS and command capability both deny without revealing foreign existence |

</intent-contract>

## Code Map

- `src/scope/manifest.ts:249` — active `resources` is the owner for the three new tables; `scheduling` at line 262 remains E15/pending and empty.
- `src/server/authz/permission-matrix.ts:31` and `src/server/commands/envelope.ts:51` — add resource-owned booking view/manage capabilities and closed command-capability enrollment; preserve the admin/planner mutation and Montör own-read boundary.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:15` — reuse person-profile composite same-tenant FK and deactivation conventions; `20260709120000_acceptance_to_job_model.sql:193` is the existing job composite-FK precedent.
- `supabase/migrations/20260710120000_accept_quote_and_create_job.sql:75` and `:117` — transactional RPC, fault-injection, hardened SQL, and grant/revoke precedent; do not copy quote-specific authorization or lifecycle semantics.
- `tests/integration/rls/tenant-table-inventory.ts:120` and `tests/support/authz/role-harness.ts:13` — exhaustive active-table, cross-tenant, anonymous, and per-role enrollment must grow with the manifest tables.
- `_bmad-output/test-artifacts/test-design-epic-14.md:133` and `:170` — authoritative booking atomicity, current-row recheck, idempotency, fault, parent-link, time, assignment, and RLS evidence matrix.
- `_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md:209` — completed resource behavior retains deactivated historical profiles; this story adds the first assignment rejection without destructive cleanup.

## Tasks & Acceptance

**Execution:**
- `src/scope/manifest.ts`, `src/server/authz/permission-matrix.ts`, `src/server/commands/envelope.ts`, `tests/unit/scope/manifest-{coherence,derivations,shape}.test.ts`, and `tests/unit/scope/resources-activation.atdd.test.ts` — enroll the three E14 tables and resource-owned booking capabilities while pinning the active-resources/pending-scheduling boundary.
- `supabase/migrations/20261002*_bookings_and_assignees.sql` — add `bookings`, `booking_assignees`, and `booking_conflicts` with UTC/all-day/status/forward-compatible series-linkage facts, nullable composite optional connections, uniqueness and time constraints, active-profile assignment checks, conflict workflow fields, indexes, explicit grants, FORCE RLS, role-plus-own-assignment read policy, command-only writes, and hardened `SECURITY INVOKER` create/update RPCs.
- `src/server/commands/bookings/{validation,booking-db,create-booking,update-booking}.ts` and `src/server/commands/command-errors.ts` — validate canonical request data, map stable DB outcomes, invoke the RPCs through the envelope, and provide the internal transaction foundation for Story 14.3 detector integration without a stub, empty-conflict success claim, duplicated rules, or client-supplied conflict authority. No booking route, UI, or user-facing action is exposed in this story. Canonical-key replay must be race-safe; changed content under a reused key must change nothing.
- `tests/integration/commands/bookings.int.test.ts`, `tests/integration/rls/bookings.rls.test.ts`, `tests/integration/rls/tenant-table-inventory.ts`, `tests/support/authz/role-harness.ts`, and relevant manifest/authz units — prove standalone and same-tenant links, UTC boundaries, duplicate/deactivated assignment rejection, exact atomic post-state, rollback after booking/assignee preparation, idempotent/concurrent create, atomic update replacement, direct/command cross-tenant and anon denial, Montör own-row visibility, and admin/planner success.

**Acceptance Criteria:**
- Given the Story 14.2 migration, when manifest derivations and the live schema are checked, then all three booking tables are owned by active `resources`, are H4/exact-policy enrolled, and `scheduling` remains pending with no live surface.
- Given an entitled admin or planner creates or updates a booking, when all supplied parents and assignees are active and same-tenant, then the UTC booking, replacement assignees, idempotency state, and exactly one audit event commit atomically. Current server-derived conflict persistence/refresh is accepted in 14.3 after detector integration.
- Given a standalone booking or a booking bound to an existing Phase A job, when it persists and reloads, then every optional connection remains nullable or preserves the existing job ID; a foreign or mismatched parent cannot be attached.
- Given duplicate, foreign, deactivated, zero-length, or reversed assignment/time input, when a command or direct table path receives it, then no partial durable state exists and a safe typed failure is returned.
- Given a replay or concurrent create with the same key and canonical request, when it completes, then one durable booking/audit result exists; changed canonical content under that key is rejected without mutation.
- Given a Montör, cross-tenant caller, anonymous caller, or nonmember, when it reads or mutates booking data, then RLS permits only the Montör's own assigned booking read and otherwise returns no data or mutation; planner/admin commands remain server-authorized.

## Design Notes

`booking_conflicts` schema remains in 14.2 as workflow persistence infrastructure. This draft must be re-planned under owner-approved contract C: 14.2 proves foundation atomicity only; 14.3 solely implements the pure detector, current-row authoritative transaction integration and atomic conflict persistence/refresh. No placeholder detector or duplicated rules may fill the gap. Internal foundation commands have no user-facing booking entry before 14.3 integration.

Retain 14.2-INT-001 foundation atomicity, 14.2-INT-002 booking/assignee replacement, and 14.2-INT-007 assignee fault rollback. The conflict portions transfer respectively to 14.3-INT-003/004/005; 14.2-INT-008 transfers in full to 14.3-INT-006. All transferred checks, including equivalent mandatory P0 checks, complete before any 14.4 work and the Epic PR. No acceptance is waived.

## Spec Change Log

- 2026-10-06: Owner-approved contract C resolves the prior sequencing intent gap. Restored this existing spec to `draft` for Step 2 re-planning; aligned acceptance ownership and preserved the original blocked result below as historical evidence. This preparation does not mark the story ready for development, run ATDD/build/review, or satisfy implementation gates.

## Verification

**Commands:**
- `pnpm run typecheck` — expected: strict command, manifest, and inventory types pass.
- `pnpm run lint` — expected: no new lint errors.
- `pnpm run test:unit` — expected: manifest, validation, canonicalization, and capability units pass.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` — expected: migration-reset, booking command/rollback/idempotency, H4, exact-policy, cross-tenant, anonymous, and role-negative suites execute with no unexplained skips.

## Auto Run Result

### Historical planning halt — 2026-10-02

Status: blocked

Blocking condition: intent gap

Evidence: the current codebase has no `src/features/scheduling/conflicts.ts`, booking command, booking table, or conflict detector. The authoritative Epic breakdown assigns the only pure, clock-free detector and its in-transaction recheck to Story 14.3 (`_bmad-output/planning-artifacts/epics-phase-b.md:1536`), while the approved Epic 14 test design assigns Story 14.2 P0 acceptance for current-row save detection and atomically persisted derived conflicts (`_bmad-output/test-artifacts/test-design-epic-14.md:133-134`, `:175`, `:299`). Implementing that detector here would consume Story 14.3 scope; omitting it leaves required Story 14.2 P0 criteria unimplemented.

Unanswered decision: choose one recorded sequencing contract before implementation: (1) move the pure detector and server recheck into Story 14.2, then narrow Story 14.3; (2) make Story 14.3 a prerequisite and run it before resuming Story 14.2; or (3) revise the Story 14.2 acceptance/test-design entries so it supplies only schema and transaction plumbing, with no claimed derived-conflict/current-row evidence until Story 14.3. The current sources do not select among these outcomes.

Resolved planning facts: `resources` owns the new tables because it is already active; `scheduling` remains pending. The existing matrix and test design establish admin/projektledare mutation with Montör own-assignment read only, so capability names are an implementation choice under deny-by-default rather than a blocker.

### Planning recovery — 2026-10-06

Status: draft (re-planning input)

Resolved blocking condition: the owner explicitly selected contract C in `docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md`; the authoritative Epic sketches, test design, and cached context now record the revised acceptance ownership. The historical unanswered decision above is superseded by that approval.

The installed `bmad-build-auto` Step 1 routes an explicitly supplied `draft` spec to Step 2 planning and rejects a `blocked` spec. Reuse this same file; do not treat this recovery as ready-for-dev or as implementation evidence. The root must first commit the preparation and satisfy its clean-tree gate, then resume normal re-planning and remaining quality gates. No build workflow, product code, tests, migrations, local resources, or hosted actions were executed in this preparation.
