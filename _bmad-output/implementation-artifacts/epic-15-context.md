# Epic 15 Context: Scheduling Views, Time Reporting, and Calendar Feeds

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver five coherent planning views, recurrence, conflict resolution, time reporting and a personal calendar feed over shared bookings. Support planners' staffing decisions and field workers' connected daily workflows while preserving authoritative conflict detection and onward data reuse.

## Stories

- Story 15.1: The Five Scheduling Views
- Story 15.2: Recurring Bookings — Series, Materialized Occurrences, Exceptions
- Story 15.3: Conflict Resolver
- Story 15.4: Time Reporting — Filing, Timesheet, Review
- Story 15.5: Personal Calendar Feed (ADR-B004 Surface #1)
- Story 15.6: Min Dag — the Field Landing

## Requirements & Constraints

- Phase B scope remains manifest-governed: scheduling activation, first schema/nav surface, permission rows and guardrails land together. Pending modules expose no live surfaces. No AI, automatic optimisation, named-team domain, PWA, native app or durable offline/queue functionality.
- The [2026-10-09 scheduling UX disposition](../../docs/decisions/epic-15-scheduling-ux-disposition-2026-10-09.md) resolves UXB-A9 and removes further Lovable observation as a prerequisite. Use approved repository requirements and recommended interactions; zero new observations and no verified legacy-parity claim.
- Capacity comes from actual weekly schedules, never employment percentage or globally assumed hours. Deduct holidays/closed days, absence, existing bookings, blocked time and optional buffer. Preserve central Swedish holidays plus tenant/person exceptions; overtime requires explicit authorized decision and overbooking always warns.
- Authorization remains server-side with RLS and activation negatives for seeded roles. Unauthorized payloads omit sensitive fields; field-worker surfaces/report rows carry no money. Route sensitive implementation/review judgments to Sol High.
- Connected phone flows work at 360×640. Transient failures retain suitable unsent input with honest failure state and explicit retry; saved/submitted appears only after confirmed persistence. Unreachable data says `Anslutning krävs`; empty states require successful reads.
- Deterministic fixtures cover multi-assignee conflicts, capacity/work-hours, recurrence and Europe/Stockholm DST. Required integration/RLS evidence executes with `SUPABASE_TEST_REQUIRED=1`; skips are not coverage. Browser checks use the configured production server.
- Feed exposure requires the green ADR-B004 validity, rotation, revocation, uniform-response, rate-limit, cross-tenant and public-shell abuse suite.

## Technical Decisions

- Reuse Epic 14's sole pure detector, checked commands and responsive editor. Preview/save share the engine; server detection inside the write transaction remains authoritative. Dragging and suggested free slots propose changes, never confer persistence authority.
- Conflicted saves require current-warning review and nonblank reason. Only selected reviewed candidate-related complete logical groups become accepted; other reviewed conflicts remain open and unrelated tenant conflicts are excluded. Booking, assignments, detection refresh, acceptance, durable outcome and audit commit atomically. Stale preview requires renewed review. Preserve accepted state only for unchanged natural keys; changed collision identity reopens detection.
- Bounded recurrence presets materialize real booking occurrences through one pure preview/server expansion function. Edits preserve exceptions; cancellation tombstones prevent regeneration. “This and following” splits series, preserves pre-pivot exceptions and keeps IDs where times remain unchanged. Occurrences fully participate in detection.
- Store UTC instants; interpret recurrence, schedules and day boundaries in tenant timezone, default Europe/Stockholm. Use local date arithmetic; spring gaps advance to first valid instant, autumn ambiguity chooses earlier instant, golden-pinned.
- Resolution re-detects after edit and records outcome/actor/time with history and assignee notifications. Accepted conflicts remain inspectable outside the default open queue.
- Own-row time filing and role-scoped review ship `submitted` only, with annotation rather than approval states. Economy consumers value hours separately; approval requirements await the billing checkpoint.
- Feed tokens are hashed 256-bit capabilities with audited create/rotate/revoke and last-use visibility. Regenerate minimal own-booking iCalendar per request, omit money/other people's data, enforce token/IP-hash limits and generic invalid-token responses. Preserve existing public-token boundaries and grant no privileged capability.

## UX & Interaction Patterns

- Keyboard-reachable Planering switcher: Schema day/week grid and month density; Resurser person timeline with reassignment lane; Team weekly day-column board; Beläggning capacity matrix; Min kalender personal agenda. One booking/filter model powers all views; shared date/granularity/person/work-role/job/customer controls persist per user per view.
- Team groups by displayed booking arbetsroll, including a clearly labelled no-work-role group. Person default roles remain resource context, not grouping authority. No named-team entity, membership or administration.
- Blocks show assignees, connection context and conflict glyphs. Every drag operation has click/tap editor controls and separately verified keyboard/dialog parity. Capacity displays number plus color; >100% links to affected bookings.
- Reuse desktop side-sheet/phone full-screen editor. Resolver offers grouped master-detail queue, plain-language violations, collision timelines, move/reassign/adjust/accept actions and last-checked empty-state recency.
- Booking-prefilled or standalone time filing targets a one-hand 30-second flow. Personal weeks show missing-day nudges; planner/admin review supplies filters, sums and booked-versus-reported deltas.
- Min dag shows ordered bookings, map address, job/time actions, schedule-change notices and refresh. Feed controls explain URL read access.

## Cross-Story Dependencies

- Epics 13/14 supply notifications, resource/capacity inputs, detector and editor. Register booking reminders/changes and report nudges through Epic 13 only when their module activates.
- Contract D assigns `14.4-E2E-006 (empty-slot click/drag portion)` to 15.1: actual browser click AND drag in BOTH Schema and Resurser open the same editor with selected interval and any supplied person; Resurser proves person/start/end. Keyboard/dialog parity remains mandatory. Evidence precedes applicable entry exposure and completion; prefill-seam tests provide no host execution credit.
- Epic 14's October 8 acceptance retains open quality advisories, unapproved performance workloads/thresholds and unexecuted manual accessibility/daylight checks. This context supplies no waiver or completion claim.
- Min dag activates Montör landing; Mina jobb contributes nothing before Epic 16 activation and creates no reverse dependency. Epics 17/26 consume booking/time data without re-entry.
