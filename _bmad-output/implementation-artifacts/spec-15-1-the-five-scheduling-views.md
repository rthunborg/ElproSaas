---
title: '15.1 — The Five Scheduling Views'
type: 'feature'
created: '2026-10-09'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '45a64853fa55af349bd7cc7ccb38e9886dd31d0b'
context:
  - docs/process/review-order.md
  - docs/process/agent-model-routing.md
  - docs/process/local-setup.md
  - docs/decisions/epic-14-story-ownership-contract-d-2026-10-07.md
  - docs/decisions/epic-15-scheduling-ux-disposition-2026-10-09.md
  - _bmad-output/test-artifacts/test-design-epic-15.md
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Resource bookings and the responsive editor exist, but planners lack the five approved live scheduling projections and their actual calendar entry hosts.

**Approach:** Activate `Planering` at `/scheduling` with one authorized booking/filter model, shared toolbar and five role-appropriate projections. Reuse the existing editor for creation and proposed move/resize changes; the server remains the sole persistence and conflict authority.

## Boundaries & Constraints

**Always:** Phase B FR87 and the five-view portion of AC-B1b-2; scheduling activation and nav land in the same implementation PR. Existing tables remain owned by `resources`. Admin/Projektledare see planner views; Montör receives only the existing own-booking RLS slice in Min kalender, without resource roster/hours/peer identities. Multi-role grants remain union-based. Store UTC instants, interpret dates in Europe/Stockholm; capacity comes from actual schedules and the existing capacity engine. Preserve Contract D's current reviewed-warning/selected-conflict acceptance, stable request identity, retry and atomic server-save behavior. Connected 360×640 UX shows saved only after server persistence. Use Swedish UI and existing design primitives.

**Block If:** A required behavior needs new role grants, RLS widening, a privileged identity reader, detector/transaction-authority changes, missing capacity facts represented as zero, or out-of-scope product functionality. Escalate sensitive implementation/review to explicit Sol High; halt if approved scope cannot resolve the boundary. Do not infer performance certification or manual accessibility results.

**Never:** Named teams, new person/HR records, recurrence implementation (15.2), conflict resolver (15.3), time reports (15.4), feed controls/public tokens (15.5), Min dag/landing changes (15.6), notification producers, job/economy depth, AI/optimization, PWA/offline queues, hosted actions or Lovable inspection/code copying. No new table, persistence migration, dependency or permission grant is needed by this plan.

## I/O & Edge-Case Matrix

| State/input | Expected behavior | Failure handling |
| --- | --- | --- |
| Planned booking overlaps half-open selected period | Include if start < period end and end > period start; clip display at period/day edges while keeping original editor instants | Invalid interval rejected generically |
| Shared filters person/booking arbetsroll/job/customer | AND across categories; same eligible booking set in every projection; personal subset additionally intersects authenticated own assignment | Invalid/restored unavailable values reset visibly to valid defaults |
| Multi-assignee or inactive assignee | Same booking ID may appear in several resource rows; unique count elsewhere; needs-reassignment lane retains affected bookings | Predicate: any current assignee has archived profile, non-active membership or a missing current profile; do not infer this from active picker absence |
| Capacity with zero or negative effective budget | Show booked minutes, available balance and explicit zero/no-capacity text; no Infinity/NaN; positive demand at zero capacity is overbooked and drillable | Missing/incomplete facts show unavailable/retry, never 0% |
| Failed/later-page read | Show generic Swedish failure and retry; no false empty state, zero conflict count or previous stale list fallback | Keep toolbar state, do not expose partial data |
| Click/drag/reverse drag/cancel | Exact selected positive interval and supplied person enter same editor; cancel writes nothing and restores focus | Invalid/nonpositive selection cannot submit |
| Storage denied/corrupt or actor/tenant switch | Versioned user+tenant+view toolbar preferences only; safe defaults; no booking records/drafts stored by this feature | Persistence failure does not block connected read |

</intent-contract>

## Code Map

- `src/features/resources/bookings-read.ts:104` — `readBookingHost`: existing cookie/RLS/permission boundary; scopes only job/customer/booking, so a bounded period read is new. `readBookingPeople`:26 is manager-only; paged `readRows`:34 is a completeness precedent; `openBookingConflictCounts`:48 preserves logical association identities.
- `src/components/resources/BookingEntry.tsx:19` — new-draft pattern; `bookingSummaryDraft`:27 strips metadata before edit. `src/components/resources/BookingEditor.tsx:14` — `BookingPrefill`; mount a fresh editor for each selection so initial state is not stale. `src/features/resources/booking-actions.ts:34,71,94` — current preview/save/reload seams, read-only authority contracts.
- `src/features/resources/booking-action-state.ts:20` — current summary lacks labels/profile lifecycle. `src/features/resources/read.ts:13` and `schedule-read.ts:26` — schedule/break shaping precedent; single-person read is not a complete roster API.
- `src/features/scheduling/capacity.ts:88` — `prepareDailyCapacity` uses only rules/calendarDays/person; narrow its input type without changing arithmetic. `time-zone.ts` — exact UTC/local-day/DST helpers. `types.ts` — existing rules/terms; no fake candidate or detector snapshot for display.
- `src/server/authz/permission-matrix.ts:30` — resources View/Manage authority; scheduling nav needs its own module row referencing the same single `Bookings.View` row. `src/scope/manifest.ts:263` — pending scheduling, no live surface; `src/components/app-shell/nav-items.ts` and `src/components/app-shell/NavIcon.tsx` — current authored nav/icons.
- `src/server/bookings/conflict-facts.ts:74` — server transaction facts authority, read-only; not a calendar read API. Existing SQL/RLS/person identity wrappers remain unchanged.
- `tests/e2e/booking-editor.e2e.spec.ts`, `tests/e2e/support/booking-editor-atdd.ts` — reusable editor fixtures, response settlement and retained acceptance tests. `_bmad-output/test-artifacts/test-design-epic-15.md` — scenario IDs and inherited Contract D trace.

## Tasks & Acceptance

**Execution (dependency order; 9 tasks):**

- [ ] `src/server/authz/permission-matrix.ts`, `src/scope/manifest.ts`, `src/components/app-shell/nav-items.ts`, `tests/unit/scope/manifest-coherence.test.ts`, `tests/unit/scope/manifest-derivations.test.ts`, `tests/unit/server/authz/permission-matrix.test.ts`, `tests/unit/server/authz/phase-a-surface.test.ts` — factor one shared Bookings.View row and reference it under resources and scheduling, retaining exact role grants; activate scheduling with only `/scheduling` Planering nav and current date/epic metadata. Keep resources tables, no future feed/report/category surface. Update affected coherence/nav/permission expectations without parallel inventories. Sensitive Sol High author/reviewer owns this task.
- [ ] `src/features/scheduling/view-types.ts`, `view-model.ts`, `view-preferences.ts` (new) — define one client-safe model and validated period/filter preferences; pure projection/slot functions with stable start/id ordering, Monday weeks, half-open overlap, Stockholm day/month boundaries, role lanes and no duplicate booking counts. Default planner Schema/week, personal agenda/week; Schema day/week/month, Resurser day/week, Team week, Beläggning day/week/month person-by-local-day cells, Min kalender day/week agenda (desktop week grid).
- [ ] `src/server/read-models/scheduling.ts` (new), `src/features/resources/bookings-read.ts` — request-bound authorized read returning the established { data, entitlements: { withheld } } descriptor, with restricted fields absent and listed, and explicit safe projections and complete 500-row pages/stable ID ordering for every booking, conflict, roster, shift, exception and calendar input. Validate period/filter inputs; planned bookings by default, optional cancelled filter. Managers receive lifecycle roster facts, safe existing identity labels, authorized job/customer/work-role labels and self IDs from current membership/profile mapping. Montör reads only existing RLS own bookings/assignees, labels self `Du`, calls neither identity picker nor profile/hours/calendar tables, and receives no peer/options/money payload. RLS-visible association IDs define own assignment; never trust requested person ID. Preserve generic retryable error separate from denial. Sol High owns read boundary.
- [ ] `src/features/scheduling/capacity.ts`, `view-capacity.ts` (new), `src/server/read-models/scheduling.ts` — narrow prepareDailyCapacity input to the consumed rules/calendar fields only; map validated manager facts and clipped additive noncancelled demand. Reuse current reductions/breaks/holiday/buffer/overtime rules unchanged. Effective budget is availableMinutes + existingBookingMinutes; occupancy is demand/budget for positive budget, balance remains budget−demand. Capacity uses all authorized demand for selected persons/period, even when job/customer/role filters hide blocks; label this and make overbook drilldown show the full affected authorized booking set with restrictive filters cleared. No engine/detector policy change or invented overtime.
- [ ] `src/app/(app)/scheduling/page.tsx`, `src/app/(app)/scheduling/layout.tsx` (new), `src/components/scheduling/SchedulingWorkspace.tsx`, `SchedulingToolbar.tsx` (new) — force-dynamic authorized entry using existing RouteAccessBoundary, hydrated per-user/tenant/view preference restore followed by current server read, accessible view switcher/navigation/filter/reset/retry, manager-only Ny bokning in every view using the same editor, and persistent open-conflict chip. Managers get five tabs; own-only callers get Min kalender and no planner gestures or filters. Chip retains current count-only behavior; do not open an unimplemented resolver. Refresh after server-confirmed editor close/save; do not claim success from draft placement.
- [ ] `src/components/scheduling/SchemaView.tsx`, `ResourcesView.tsx`, `TeamView.tsx`, `CapacityView.tsx`, `PersonalCalendarView.tsx`, `BookingBlock.tsx` (new) — implement live projections: day/week grid and accessible month density drilldown; person timeline/reassignment lane with row person/work-role labels and numeric capacity hints; booking-role week board with Ingen arbetsroll; number+color capacity/drilldown; own agenda and desktop week. Show assignees, safe job/customer context, work-role text/icon plus tint and logical open-conflict glyphs. On phone Schema becomes agenda, capacity has readable summary; long labels and multi-assignee cards remain usable at 360×640.
- [ ] `src/components/scheduling/SchedulingWorkspace.tsx`, `BookingBlock.tsx`, `IntervalSelectionDialog.tsx` (new) — actual empty-slot pointer click/drag in Schema and Resurser; 30-minute grid slots, click prefills that slot, drag normalizes selected slot boundaries and resource person. Keyboard slot activation and click/tap interval dialog reach same existing BookingEditor. Existing block move/resize proposals open editor with exact proposed instants/current assignees; resource move replaces only moved row assignee, preserves other assignees without duplicates. No gesture writes directly. Cancel/dirty guard/focus/retry use existing editor semantics.
- [ ] `tests/unit/features/scheduling/views.test.ts`, `capacity-view.test.ts`, `preferences.test.ts` (new), `tests/integration/scheduling/scheduling-read.int.test.ts` (new) — test matrix and independent expected IDs/minutes, 501/1001 booking and 500+ ancillary rows, final-page failure, DST/midnight/month boundaries, lifecycle lane, filtering/capacity honesty, persistence isolation. High integration coverage: Admin/PL positive, Montör own-only, Säljare/Ekonomi denied unless union grants, cross-tenant/filter/person tamper, stale permission, no identity/peer resource payload, no mutation authority from gestures. Preserve existing detector/editor integration negatives.
- [ ] `tests/e2e/scheduling-views.e2e.spec.ts` (new), `_bmad-output/implementation-artifacts/spec-15-1-the-five-scheduling-views.md` — implement every 15.1 scenario from test design, including real mouse operations and reload-persisted bounds/assignees. Execute required gates, record counts/head/limitations and author final Suggested Review Order only after implementation evidence exists. Do not expose calendar entries in deployment or mark done before all Contract D host cases pass.

**Acceptance Criteria:**

1. Given Admin/Projektledare, when opening Planering and switching all five views over one fixture/period/filter set, then live authorized bookings appear in each corresponding projection, with no inconsistent IDs or lost later-page data; Schema day/week/month, Resurser day/week, Team week, capacity cells and the additional authenticated-self agenda subset are visibly functional (15.1-E2E-006/SCOPE-001).
2. Given manager and own-only/denied role fixtures, when navigating directly or tampering with view/person/tenant/filter inputs, then server payload and UI preserve existing role/RLS boundaries: manager five views, Montör only own agenda, unentitled caller denied; no peer identity/roster/money data or save grant appears (15.1-INT-001).
3. Given distinct users/tenants/views and changed period/filters, when reloading/switching views or restoring corrupt settings, then validated toolbar preferences persist only within their user/tenant/view scope, with correct resets and explicit read failure/retry rather than false emptiness (15.1-COMP-001).
4. Given actual Schema empty slots, when performing real click and real pointer drag at non-default times, then the same 14.4 editor opens with exactly selected interval and any supplied person, and saving/reload proves those bounds and assignees persisted. Repeat actual click and drag on Resurser with a specific row person and prove person/start/end (15.1-E2E-001–004; `14.4-E2E-006 (empty-slot click/drag portion)`). All four cases are mandatory before exposure/completion.
5. Given a manager on any view, either actual slot host and existing BookingBlocks, when opening toolbar Ny bokning or using keyboard/dialog or single-pointer controls for interval selection/move/resize and actual move/resize dragging, then identical proposed context enters existing editor; current conflict review remains required, cancel writes nothing and returns focus, save is server-confirmed (15.1-E2E-005/007).
6. Given role/no-role/multi-assignee and inactive-assignee bookings, when using Team and Resurser, then booking arbetsroll determines day-board lane, missing role shows Ingen arbetsroll, resource row assignment is faithful and needs-reassignment remains visible without named-team entities (15.1-E2E-008). Existing commands still require at least one assignee; an empty lane is truthful when none need reassignment, and this story introduces no zero-assignee save.
7. Given independent four-full-day/five-short-day schedules and breaks/holidays/absence/blocked/buffer/overbooking fixtures, when opening Beläggning, then correct numeric demand/budget/balance and occupancy accompany color, zero budget is explicit, and over 100% or positive zero-budget demand drills to actual affected authorized bookings, including demand hidden by other block filters (15.1-UNIT-001/002, COMP-002).
8. Given connected 360×640 and desktop surfaces, when navigating/filtering/opening/cancelling or retrying editor failure, then agenda/summary fallbacks and controls are usable, focus/dialog behavior is preserved, suitable unsent input survives, and no local draft is presented as saved (15.1-COMP-003, ADR-B009).

## Spec Change Log

## Review Triage Log

## Design Notes

Owner disposition 2026-10-09 removes further Lovable observations as a prerequisite; zero observations and no verified parity claim. UXB-A9 resolves to approved arbetsroll grouping; dated decision above controls superseded oracle wording. Read-only map and sensitive boundary assessment use Sol Low and explicit context-free Sol High respectively. High confirms no RLS widening/migration is necessary: scheduling nav reuses exact Bookings.View grants, resource management authority remains unchanged. A display adapter narrows the existing capacity helper type without modifying arithmetic or server detection.

Epic 14 October 8 accepted-with-open-items supplies foundation only. Its 44 retained advisories, unapproved representative performance workloads/thresholds and unexecuted manual accessibility/daylight/exploration remain open. Historical October 7 rejection remains historical. Contract D evidence is new receiving-story work, never credited from editor seam tests. Recurring-data portion of AC-B1b-2 belongs 15.2; no feed subscription, resolver action or Min dag placeholder ships here.

## Verification

Planning performs no product execution. Implementation must run the current CI commands/order in `.github/workflows/ci.yml`, including lockfile/audit, typecheck/lint/unit/build, source and built-bundle containment, empty database migration/seed, REQUIRED integration/RLS, independent recovery and configured production-server browser lanes. Follow resource guard/local setup; never use demo as a test target or native Supabase lifecycle commands as teardown.

- `pnpm run test:unit` — matrix/projection/capacity/preferences and manifest/permission guards pass.
- `$env:SUPABASE_TEST_REQUIRED='1'; pnpm run test:int` — full required integration/RLS executes; publish actual passed/failed/skipped counts and relevant scheduling negatives. Skips give no coverage.
- `pnpm run test:e2e -- tests/e2e/scheduling-views.e2e.spec.ts` — all 15.1 P0/P1 ACs execute on configured production web server, including actual Schema/Resurser clicks/drags, persisted readbacks and move/resize parity. Run retained editor regression suite and full configured required browser gates after focused success.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm run verify:service-role-containment`, `pnpm run verify:bundle-containment` — required gates pass in their authoritative CI order.
- `node scripts/verify/check-review-order.mjs _bmad-output/implementation-artifacts/spec-15-1-the-five-scheduling-views.md` — after implementation only, verify author trail against actual final files/evidence.

Manual assistive-tech/daylight/exploration and representative performance certification need their own observed/approved evidence; retain open status until obtained. WCAG pointer alternatives are grounded in the primary guidance linked by the dated disposition. Report exact tested revision/worktree, counts, screenshots/traces and limitations; no invented coverage percentages or parity certification.



## Auto Run Result

Status: ready-for-dev

HALT after planning as requested; implementation was not started.

Validation: self-review against the rendered Build Auto readiness standard and independent context-free gpt-6.1-sol High specification validation by /root/story15_1_plan/validate15 on 2026-10-09 recommend ready-for-dev with no remaining blockers. The High route was selected for actual new permission enrollment and role-scoped read projection, not tenancy boilerplate. Independent Sol High boundary assessment /root/story15_1_plan/boundary15 confirmed preserved RLS/permission grants and detector/editor authority. Ordinary context compilation and code-map exploration used Sol Low. All delegates were awaited in this run.

Inventory: 9 actionable ordered tasks; 8 surface-anchored Given/When/Then ACs. Validation repaired omitted manager toolbar creation and resource-row hints; final disk was reread. Oversized warning retained for cohesive cross-layer/Contract D detail. Code-review rounds remain 0; this was specification validation, with no runtime tests, resources, code, migrations, dependencies, enrollment changes, sprint/state transitions, commits or publication performed by this delegate.

Owner disposition: further Lovable observation is no prerequisite; zero observations, no verified parity claim, arbetsroll grouping and no named-team feature. Shared governance edits are coordinator-serialized and are not this author's writes. Epic 14 quality/performance/manual obligations remain open, and actual Contract D host execution remains mandatory before exposure/completion.

Completion hook: planning exit preserved; no completed author review trail manufactured and no implementation-only trail check claimed.

