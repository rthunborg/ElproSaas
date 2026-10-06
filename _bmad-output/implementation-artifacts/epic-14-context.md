# Epic 14 Context: Resource and Scheduling Foundation

<!-- Generated from planning artifacts; minimally reconciled with owner-approved contract C on 2026-10-06. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the tenant-isolated scheduling foundation: people have practical weekly availability, work-role defaults, calendar exceptions, and capacity; users can create standalone or connected bookings; and every conflict is detected consistently, explained in the editor, and recorded when deliberately overridden. This provides a reliable base for later scheduling views, recurrence, time reporting, and job depth while remaining usable in connected field workflows.

## Stories

- Story 14.1: Scheduling Activation — Person Profiles and Work Hours
- Story 14.2: Bookings and Assignees — Schema and Transactional Commands
- Story 14.3: Deterministic Conflict Engine (Detection Core)
- Story 14.4: Booking Editor with Live Conflict Warnings and Audited Override

## Requirements & Constraints

- Story 14.1 activates `resources` through the scope manifest with its first schema surface and required matrix/role-negative coverage. Epic 14 tables/capabilities belong to active `resources`; `scheduling` remains pending with empty live surfaces until Epic 15.
- Model one person profile per tenant membership. Reuse the existing work-role catalogue for a person’s default scheduling role; do not introduce a separate employee or work-role model. Carry existing deactivated-user semantics into scheduling.
- Availability must come from each person’s actual recurring weekly schedule, including shifts and breaks, rather than employment percentage. Support individual exceptions such as vacation, sick leave, leave, training, and blocked time; provide an inheritable tenant default schedule.
- Calculate available capacity as scheduled working time less Swedish public holidays and tenant closed or reduced-capacity days, absences, existing bookings, blocked internal time, and any configured planning buffer. Overtime requires an authorized explicit decision. Overbooking remains possible but always warns.
- Bookings support UTC instants, all-day events, work role, status, series linkage, multiple assignees, and optional job, customer, site, and contact connections. A booking must remain valid without a connection and may connect to the existing basic job model.
- Detect double booking, over-capacity, and outside-work-hours conflicts. Include access-window and competence conflicts when job data supplies those inputs. Treat missed and phantom conflicts as correctness defects and add regression fixtures.
- Booking create and update operations must be idempotent where required, tenant-isolated, role-gated, row-scoped for field workers’ own bookings, and atomic: booking, assignees, detected conflicts, accepted state, and audit records commit together.
- Conflicts warn instead of blocking. Deliberately saving with conflicts requires an explicit acknowledgment and reason; persist accepted conflicts with actor and audit evidence. Persist unacknowledged detected conflicts as open workflow records for later resolution.
- Cover multi-assignee, capacity and work-hours edge cases, Europe/Stockholm timezone behavior, and both DST transition weeks. Recurrence is implemented later, but current conflict identity and data structures must accommodate materialized occurrences.

## Technical Decisions

- Keep conflict detection in one pure, I/O-free, clock-free engine shared by editor preview and the server write transaction. Supply schedules and rules as inputs so preview and persistence cannot disagree.
- Store booking instants as UTC `timestamptz`; interpret work hours, capacity windows, recurrence boundaries, and all-day events in the tenant timezone, initially Europe/Stockholm. A nonexistent spring-forward local time moves to the first valid instant; an ambiguous fall-back time selects the earlier instant.
- Keep capacity and conflict rules in configurable data and injectable rule configuration, never schema or hardcoded weekday assumptions. Use golden-pinned fixtures for the capacity formula, holiday layering, warning thresholds, and DST boundaries.
- Persist conflict workflow state separately from the derived detection result. A conflict record carries type, participants, time window, status, acceptance reason, and eventual resolution outcome and actor. A changed collision must be detected anew rather than inheriting acceptance for a prior natural conflict identity.
- Use composite same-tenant relationships for booking assignees and connected entities. Apply server-side authorization and RLS as the security boundary; client visibility controls do not grant access.

## UX & Interaction Patterns

- Use a side-sheet booking editor on desktop and a full-screen sheet on phone. It includes multi-assignee selection with availability hints, work role, time, optional connections, description, and a dirty-state guard.
- Recalculate and show a live inline conflict panel after assignee or time changes. Each violation explains the rule, affected people or bookings, and a small collision timeline. The editor offers an explicit `Boka ändå` action only after collecting the required reason.
- Field interactions work as connected responsive web from 360×640. On a transient submission failure, retain suitable unsent form state, clearly show that nothing was saved, provide explicit retry, and show success only after server confirmation. Phase B has no offline queue, synchronization, or installable-app behavior.

## Owner-approved Story Ownership — 2026-10-06

[Contract C](../../docs/decisions/epic-14-story-ownership-contract-c-2026-10-06.md) preserves 14.1 → 14.2 → 14.3 → 14.4 and all Epic acceptance. Story 14.2 supplies schema/RLS/authorization/idempotency/rollback and booking-assignee-audit atomicity; conflict workflow schema remains there. Story 14.3 solely supplies the pure engine, authoritative current-row transaction integration, derived-conflict persistence/refresh, and transferred 14.3-INT-003/004/005/006 checks (from the conflict portions of 14.2-INT-001/002/007 and full 14.2-INT-008). All transferred checks, including mandatory P0 evidence, complete before any 14.4 work and the Epic PR. No user-facing booking entry before detector integration; no stub or duplicated rules. Story 14.2 foundation completion cannot claim conflict acceptance.

## Cross-Story Dependencies

- RBAC and the permission-matrix foundation from Epic 11 must be available before resource activation and its role-scoped policies.
- Epic 13 provides the notification infrastructure later conflict resolution will use for affected-assignee booking-change notices.
- Epic 15 adds scheduling projections, recurrence, and the resolver on top of this booking and conflict foundation; its recurrence expansion must use the same conflict rules and timezone policy.
- Epic 16 deepens jobs after scheduling starts. This epic binds optionally to the existing basic job container and must preserve that connection as jobs evolve.
