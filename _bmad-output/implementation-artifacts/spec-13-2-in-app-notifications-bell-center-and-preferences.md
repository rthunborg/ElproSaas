---
title: 'Story 13.2: In-App Notifications — Bell, Center, and Preferences'
type: 'feature'
created: '2026-09-23'
status: 'in-progress'
baseline_revision: '343245be72246ab034ff56b9b979a9c648e39a13'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-13-context.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/planning-artifacts/ux-design-specification-phase-b.md'
  - 'docs/process/review-order.md'
warnings:
  - oversized
deferred:
  - 'Numeric runner SLA, batch-size, fairness, backlog-age, and freshness thresholds remain owner-pending. Show only honest elapsed-time/run-state information and do not claim a production target.'
---

<intent-contract>

## Intent

**Problem:** Users have no tenant-isolated in-app notification surface, so scheduled follow-up reminders and active-module events cannot be seen, acknowledged, or configured without risking unentitled content and fabricated deep links.

**Approach:** Build the active-scope notification data and emission contract on Story 13.1's authenticated runner, then provide every valid tenant role a bell, filtered center, and profile preference matrix with server-enforced personal boundaries.

## Boundaries & Constraints

**Always:** Keep categories as the unique active-module registry union: B1a includes `quote.follow_up_due` plus sanctioned admin/user events only; store a recipient-entitlement-projected title/body and emit-time route; constrain rows to tenant plus recipient user; enforce RLS, explicit grants, and H4 enrollment for both tables; allow optimistic UI only for read flips and reconcile failure to server truth. The bell is available to every valid tenant role, while `job_runs` failure/freshness visibility remains administrator-scoped. Render Swedish email controls inactive with `e-postutskick aktiveras senare`; absent preferences use category defaults and essential categories cannot be disabled server-side.

**Block If:** A required category, producer, surface, or data field belongs to a pending module; a new execution lane, client-reachable service context, real email send/outbox/provider/public route, unverified entitlement projection, or deployment secret is required.

**Never:** Reconstruct links in the client, expose another user's/tenant's row or source data, permit authenticated raw notification inserts/arbitrary-recipient writes/preference privilege escalation, create a notification navigation item, add placeholder categories, claim real-time freshness, or add email/unsubscribe functionality from Stories 13.3–13.4.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Entitled emission | Due active quote follow-up or sanctioned active command event | Exactly one user notification per logical subject/period, with stored safe route and unread state | Retry/concurrency remains deduplicated; no email side effect |
| Personal read action | Current recipient opens, deep-links, marks one/all read | Bell/center count and row state update, replay is idempotent | On injected command failure, restore/reload server truth and present retry |
| Preference update | Essential, non-essential, or missing user × category × channel preference | Missing row resolves default; allowed in-app choice persists per user | Server rejects essential disablement and unavailable email changes without a false success |
| Empty or stale producer state | No rows, no successful scan, failed run, or elapsed run | Accessible bell/center uses empty/loading/stale copy and elapsed run evidence | Never imply real-time delivery or hide an actionable retry/read failure |

</intent-contract>

## Code Map

- `src/scope/manifest.ts:231` — active `notifications` module currently owns only `job_runs`; add this story's tables, `/notifications` route, and concrete active-category declarations in the same manifest change.
- `src/scope/manifest-schema.ts:178` — preserves active-surface derivations and duplicate/orphan category coherence checks.
- `src/server/jobs/producers.ts:3` and `src/server/jobs/runner.ts:38` — Story 13.1's sole contained producer contract and tenant-explicit execution lane; add the follow-up producer here, never another scheduler path.
- `src/server/jobs/service-client.ts:4` and `scripts/verify/check-service-role-containment.mjs:60` — service context remains jobs-private and containment guards must continue to reject client reachability.
- `src/server/commands/quotes/follow-ups.ts:62` — command-envelope, actor/audit, validation, and RLS ownership-probe precedent for mark-read and preference mutations.
- `src/server/read-models/quote-pipeline.ts:207` — preserves terminal quote/follow-up behavior; the reminder scan must not notify stale terminal work.
- `src/components/app-shell/AppShell.tsx:239` — client-shell primary-action area and existing focus-management patterns for the bell popover/profile entry.
- `src/app/(app)/layout.tsx:41` — resolves tenant/auth before shell mounting; notification server reads must independently resolve authority.
- `src/server/authz/permission-matrix.ts:27` and `tests/support/authz/role-harness.ts:13` — add a distinct all-tenant-role personal-notification capability without widening administrator-only operational-log access.
- `tests/integration/rls/tenant-table-inventory.ts:98` and `tests/integration/jobs/job-runs.int.test.ts:11` — exhaustive new-table RLS enrollment and fresh-schema inspection pattern.
- `_bmad-output/test-artifacts/test-design-epic-13.md:178` — required 13.2 unit, integration/RLS, migration, presentation, and accessibility evidence.

## Tasks & Acceptance

**Execution:**

- `supabase/migrations/`, `src/scope/manifest.ts`, and `tests/integration/rls/tenant-table-inventory.ts` — create `notifications` and `notification_preferences` with constrained user/category/channel/read contracts, forced RLS, explicit grants, command-owned mutation boundaries, indexes/dedupe protection, and same-change active manifest/H4 enrollment.
- `src/server/notifications/**`, `src/server/commands/**`, `src/server/read-models/**`, and `src/server/authz/permission-matrix.ts` — provide the typed active category/default/essential authority, recipient-entitlement-safe emitter, stored-route read model, current-user mark-one/all and preference commands, and distinct personal capability for every valid tenant role.
- `src/server/jobs/producers.ts`, `src/server/jobs/**`, and quote-follow-up integration points — implement the active quote follow-up due producer through the existing runner, tenant-explicit terminal-safe scan, and retry/concurrency idempotency without email work.
- `src/components/app-shell/AppShell.tsx`, `src/components/notifications/**`, `src/app/(app)/notifications/**`, and profile settings components — mount the accessible capped bell/popover, stable center filters, honest freshness status, and profile-menu `Notisinställningar` matrix; keep the center off navigation and use stored routes only.
- `tests/unit/**`, `tests/integration/**`, and `tests/e2e/**` — cover manifest/category/default/essential derivation, entitlement-safe emission and stored links, own-user/tenant/raw-write RLS negatives, producer dedupe, idempotent reads and optimistic rollback, migration catalog, all-role UI isolation, filters/deep links/preferences, keyboard/focus/empty/stale states.

**Acceptance Criteria:**

- Given an active producer or command emitter, when it notifies an entitled recipient, then a tenant/user/category/title/body/stored-route/read-state row is created from the recipient projection and no client computes its destination.
- Given retries or concurrent scans for a due open follow-up, when the producer runs through Story 13.1's lane, then only one logical reminder exists and terminal quote/follow-up states create none.
- Given every valid tenant role, when it opens the shell, then it sees its own capped `9+` bell and latest notifications; another user, tenant, anonymous caller, direct writer, or privilege escalation attempt cannot read or mutate protected rows.
- Given a recipient uses the popover or `/notifications`, when it marks one/all read, follows a stored link, or filters by module/category, read state, and date, then visible state is personal, idempotent, and failure reconciles to persisted truth.
- Given profile preferences, when a user views or changes the active-category matrix, then categories group by module, absent rows resolve defaults, essential in-app controls remain required and server-protected, and email remains inactive with the Swedish explainer.
- Given a fresh database and producer history states, when schema/manifest and bell/center surfaces are exercised, then the tables, policies, H4/category derivations, accessibility, and empty/never-run/stale copy are accurate without a real-time claim.

## Design Notes

The notification module owns its tables and UI surface; event categories remain owned by their active domain modules so `producersFromManifest` continues to reject cross-scope placeholders. Use a dedicated personal-notification permission rather than widening the current administrator-only `Notifications.View`; direct `/notifications` authorization must not depend on the nav-derived `RouteAccessBoundary` because the center is intentionally not a navigation item.

## Verification

**Commands:**

- `pnpm typecheck` and `pnpm lint` — expected: manifest, role-harness, command, client/server boundary, and UI types are coherent.
- `pnpm test:unit -- --test-name-pattern="notification|producer|manifest|authz"` — expected: category/default/essential, view-model, entitlement, stored-route, and containment cases pass.
- `$env:SUPABASE_TEST_REQUIRED='1'; pnpm test:int -- tests/integration/notifications tests/integration/rls tests/integration/jobs` — expected: required migration/RLS/emission/dedupe/read/preference evidence executes with no required skip.
- `pnpm test:e2e -- tests/e2e/notifications` — expected: role-isolated bell/center/preferences, deep-link, rollback, focus, and honest-state coverage passes through the configured production web server.
- `pnpm verify:service-role-containment; pnpm build; pnpm verify:bundle-containment` — expected: producer-only service context remains server-contained.

## Auto Run Result

Status: blocked

Summary: Implemented the in-app notification foundation, personal bell and center, preference controls, and contained follow-up producer; required database-backed integration/RLS and Playwright notification verification could not run.

Blocking condition: The required local Supabase stack is stopped, and no supported guarded lifecycle is available in this repository to start it.

## Suggested Review Order

Author: implementation author.
Refreshed against the current working tree based on `343245be72246ab034ff56b9b979a9c648e39a13`.

### Personal notification entry and acknowledgement

The shell loads a personal bell and the center consumes persisted routes. Read acknowledgements are optimistic only in the client and restore the prior state when the server rejects the write.

- `src/components/app-shell/AppShell.tsx:275` — `NotificationBell`: mounts the personal entry point outside navigation.
- `src/components/notifications/NotificationBell.tsx:7` — `NotificationBell`: caps the unread presentation and reconciles failed mark-all/read requests.
- `src/app/api/notifications/[id]/read/route.ts:5` — `POST`: scopes acknowledgement to the resolved tenant and recipient.

### Stored data and producer boundary

The migration gives recipients select and acknowledgement authority only; the job service client remains the producer writer. The producer stores a conservative route and content that carries no quote price or customer detail.

- `supabase/migrations/20260923170000_in_app_notifications.sql:3` — `create table public.notifications`: declares recipient isolation, read state, and subject-period de-duplication.
- `src/server/notifications/follow-up-producer.ts:4` — `emitDueFollowUpNotifications`: inserts a single logical follow-up reminder per recipient and period.
- `src/app/api/jobs/run/route.ts:88` — `emitDueFollowUpNotifications`: keeps the producer on Story 13.1's authenticated runner lane.

### Category, preferences, and evidence

The active quotes-owned category is the registry source for essential/default behavior. Preferences accept only the available in-app channel, and the UI states that email delivery remains unavailable.

- `src/server/notifications/registry.ts:3` — `NOTIFICATION_CATEGORIES`: derives active categories from the manifest and declares the essential default.
- `src/app/api/notifications/preferences/route.ts:15` — `PUT`: rejects email and essential-disable attempts before persistence.
- `tests/unit/server/notifications/registry.test.ts:5` — `13.2 notification category registry derives`: exercises AC5's active/default/essential derivation.
- `tests/unit/scope/manifest-derivations.test.ts:144` — `13.2-UNIT-DERIVE-05`: exercises the manifest-derived H4 table enrollment change.

Evidence: targeted manifest and registry tests passed (16 tests, 0 failures); service-role containment passed. `pnpm typecheck` reaches unrelated errors in tracked `tmp` worktrees, and `pnpm lint` cannot scan an inaccessible `tmp/private` directory.
Limits: no local Supabase migration/RLS run or Playwright notification run was completed in this pass; their ATDD files remain skipped scaffolds, so they are not execution evidence. The center provides module/category, read-state, and date filters; the preference matrix only has the active essential category, leaving no non-essential preference path to exercise.
