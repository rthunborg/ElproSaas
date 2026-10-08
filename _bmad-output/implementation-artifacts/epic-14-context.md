# Epic 14 Context: Resource and Scheduling Foundation

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Provide tenant-isolated people schedules/capacity, standalone or connected bookings, and consistent conflict detection with explained, audited decisions. Support connected field use while preserving later scheduling boundaries.

## Stories

- Story 14.1: Scheduling Activation — Person Profiles and Work Hours
- Story 14.2: Bookings and Assignees — Schema and Transactional Commands
- Story 14.3: Deterministic Conflict Engine (Detection Core)
- Story 14.4: Booking Editor with Live Conflict Warnings and Audited Override

## Requirements & Constraints

- This is Phase B legacy parity. Active `resources` owns Epic 14 schema/capabilities; `scheduling` remains pending with empty live surfaces until Epic 15. Retain manifest, permissions and tenant-table gates.
- Extend each tenant membership with one bookable person profile, reusing the existing work-role catalogue. No parallel employee or work-role model. Preserve deactivated-user history while preventing invalid new assignments.
- Availability comes from actual weekly shifts/breaks, inheritable tenant defaults and individual exceptions: vacation, sickness, leave, training and blocked time. Employment percentage never substitutes for a schedule; do not assume a universal work week.
- Capacity accounts for scheduled time less Swedish holidays, tenant closures/reductions, absence, existing bookings, blocked internal time and optional planning buffer. Overtime requires an authorized explicit decision; overbooking always warns. Rules remain configurable data.
- Bookings support multiple assignees, time range/all-day, work role, description/status and optional job/customer/facility/contact connections. Standalone bookings are valid; references remain compatible and same-tenant. Basic jobs suffice before later job depth.
- Detect double booking, excess capacity and outside-work-hours violations. Access-window/competence checks use available job inputs; do not manufacture unavailable facts. Missed/phantom conflicts require permanent multi-assignee/calendar regressions.
- Conflicted save requires explicit review of the current candidate warning set plus nonblank reason. Only selected reviewed candidate-related logical conflicts become accepted; other reviewed candidate conflicts remain open. Review does not accept all warnings or permit accepting unrelated tenant conflicts.
- Enforce server/database role and row authority: admin/planner writes and Montör own-booking reads must agree across surfaces. Booking, assignments, detection, selected acceptance, idempotent outcome and audit commit together or leave no partial state. Required integration/RLS tests actually execute; skips are not acceptance evidence.

## Technical Decisions

- One pure deterministic, I/O-free, clock-free engine serves preview and authoritative save. Inject facts/versioned rules; no duplicated rules or fixed schedules.
- Store UTC instants; evaluate working hours, capacity and all-day boundaries in Europe/Stockholm. Spring gaps choose the first valid instant; autumn ambiguity chooses the earlier instant. Golden-pin both DST weeks and capacity edges.
- Derived detection and persisted workflow are separate. Natural identity binds type, complete participants/person and exact window. Retain acceptance only for identical current identity; changed collisions reopen. Selected logical groups include all persisted associations, not partial aggregate acceptance.
- Before acceptance, revalidate current authorization, facts and reviewed identities. Preserve reviewed create identity across preview/save. Stale preview requires refreshed warnings and renewed review; actor/time/audit come from trusted server/database authority.
- Use same-tenant relationships, RLS and checked transactional commands. No privileged client credentials, client detection authority or booking acceptance flag. Authorized retries deduplicate; changed decisions cannot replay another outcome.

## UX & Interaction Patterns

- Desktop side sheet; phone full-screen sheet. Include multi-person selection with availability hints/work-role filtering, time/all-day, optional connections and description. Live inline warnings explain rule, people/collision context and a mini-timeline. `Boka ändå` collects explicit review, reason and selective acceptance; the persistent count includes open conflicts only.
- Retain current toolbar and pre-connected job/customer entries plus a reusable person/time-prefill seam. Epic 14 introduces no scheduling nav/view/calendar slot host; actual empty-slot click/drag belongs to later scheduling views.
- Connected responsive web works at 360×640. Retain unsent input after failure, explain errors/connectivity, offer explicit retry, and show success only after server confirmation. No offline queue, synchronization or PWA delivery.
- Trap/restore focus, support keyboard interaction and dirty close/Escape/back guards, keep errors visible inside the sheet, use text beyond color, and preserve usable touch targets/reachable actions.

## Cross-Story Dependencies

- Preserve 14.1 → 14.2 → 14.3 → 14.4. Contract C leaves transactional schema/authorization/replay/rollback foundations in 14.2 and sole detector integration/derived refresh in 14.3. All four transferred current-row create/update/rollback/concurrent-detection obligations pass before any 14.4 work or Epic PR; no booking entry precedes detector integration.
- Contract D settles selective acceptance and transfers only empty-slot click/drag entry acceptance to Story 15.1, The Five Scheduling Views. Real Schema/Resurser click/drag must prefill the same editor before entry exposure/story completion. Editor-prefill/component evidence cannot satisfy this future host obligation; all other editor acceptance stays in Epic 14.
- Epic 11 supplies membership/permission foundations; Epic 13 supplies later notification infrastructure. Epic 15 adds views, recurrence, resolver, time reports and feeds; Epic 16 deepens existing jobs without breaking connections. No notification producer, these later surfaces, optimizer, AI, supplier APIs, portal/online acceptance, native mobile, PWA/offline or new public/privileged surface belongs here.
- Preserve independent review, cumulative regression and the complete empty-database migration/seed/integration gate before merge; historical runs provide no new editor acceptance.
