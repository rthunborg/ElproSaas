---
title: 'Story 13.2: In-App Notifications — Bell, Center, and Preferences'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_revision: '344f00e01ebd02191ee5c116ff28be15d1c1c604'
baseline_commit: '344f00e01ebd02191ee5c116ff28be15d1c1c604'
review_loop_iteration: 0
followup_review_recommended: true
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

Status: done

Summary: Implemented tenant-isolated in-app notifications: an accessible bell and personal center, stored-route acknowledgement, active quote notification producers, per-user in-app preferences, and database-backed RLS and mutation constraints.

Files changed: Added notification schema and compatibility migrations; activated the quotes notification categories; added notification server read/producer/registry code and job invocation; mounted bell, center, and profile settings surfaces; added deterministic E2E fixtures and integration/RLS coverage; excluded ignored `tmp/**` scratch files from TypeScript and ESLint discovery.

Review findings: 11 patches applied (high 3, medium 5, low 3), 0 newly deferred, and 5 rejected as non-reachable or outside the captured intent. Patches cover existing-schema category compatibility, server-enforced essential preferences, producer opt-out handling, acknowledgement and preference failure recovery, failed-run copy, category labels/filters, deterministic preference assertions, and recipient primary-key immutability.

Follow-up review recommendation: true (score 18: 3 × medium 5 + low 3). The recommendation reflects substantive hardening applied during this pass.

Verification: `pnpm typecheck` passed. Focused ESLint passed for changed notification client/server and E2E files. `$env:SUPABASE_TEST_REQUIRED='1'; pnpm test:int -- tests/integration/notifications/notifications.atdd.int.test.ts` passed 1 file / 6 tests, including essential-preference and immutable-id negatives. The required aggregate passed 43 files / 551 tests with no skips. The configured notification Playwright suite passed all 17 cases in two non-overlapping subsets (11 + 6) after the final browser assertion fixes. `git diff --check` passed.

Residual risk: numeric runner SLA, fairness, backlog-age, and freshness thresholds remain owner-pending as recorded in frontmatter; the center shows only run state/elapsed information.

### 2026-09-23 — Follow-up review result

Summary: Re-reviewed the completed notification surface and removed the unsanctioned `quote.accepted` category, producer, migration, controls, and tests. The follow-up keeps the specified follow-up-due category only, pages producer reads and bounded writes through the established pagination primitives, derives settings from the manifest-filtered registry, serializes read acknowledgements, reloads server truth after failed acknowledgements, removes optimistic preference writes, and corrects freshness/error presentation.

Files changed: Updated notification producer, registry, manifest, schema, settings/bell/center presentation, job dispatch, and focused notification tests. Removed the additive accepted-quote compatibility migration because the category is outside this story's approved producer scope.

Review findings: 7 patches applied (high 1, medium 5, low 1); 0 newly deferred; 7 rejected. Rejected items were duplicate reports, a database constraint already enforcing inactive email, fixture-only data used to exercise the all-role bell, and non-reachable UI/test suggestions after the unsanctioned category was removed.

Follow-up review recommendation: true (score 16: 3 × medium 5 + low 1). The score reflects the substantive fixes made in this pass.

Verification: `pnpm typecheck`, focused ESLint, and `git diff --check` passed. The full unit command remains blocked by the pre-existing `tests/unit/server/jobs/route.test.ts` runner-secret configuration failure (`Background runner is not configured`); the focused notification unit assertions passed within that run.

Residual risk: The required database-backed integration and browser suites were not restarted in this follow-up; the existing recorded evidence remains the last execution evidence.

## Review Triage Log

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 11 (high 3, medium 5, low 3)
- defer: 0
- reject: 5 (medium 2, low 3)
- addressed_findings:
  - `[high] [patch]` Added an additive migration path for the active `quote.accepted` notification category and database enforcement that the essential category stays enabled.
  - `[high] [patch]` Made the recipient acknowledgement guard reject primary-key changes and added an authenticated direct-write negative.
  - `[medium] [patch]` Reconciled failed preference and acknowledgement commands, including rejected fetches, before retaining client state.
  - `[medium] [patch]` Applied allowed in-app preference opt-outs to producer recipients and rendered failed producer runs truthfully.
  - `[low] [patch]` Completed active category labels/filtering and made the browser preference assertion rerun-safe and exact.

### 2026-09-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 1, medium 5, low 1)
- defer: 0
- reject: 7 (medium 4, low 3)
- addressed_findings:
  - `[high] [patch]` Paged producer source reads, bounded quote-version lookups and notification writes with the established PostgREST pagination primitives.
  - `[medium] [patch]` Removed the unsanctioned accepted-quote category, producer, migration, UI controls, and tests so the live surface remains the approved follow-up-due category.
  - `[medium] [patch]` Sourced profile settings from the manifest-filtered category registry and removed optimistic preference writes.
  - `[medium] [patch]` Serialized acknowledgement operations and reloaded persisted notification state after a failure.
  - `[medium] [patch]` Hid producer freshness state when the administrator-only run lookup fails.
  - `[low] [patch]` Rendered sub-hour scan freshness without claiming that a scan is one hour old.

## Suggested Review Order

Author: implementation author.
Refreshed against the current working tree, based on `95e8eebf70193d8cacc933596453d524b8bbc879`, after final review hardening for preference enforcement, acknowledgement mutation authority, and retry-safe browser evidence.

### Personal notification entry and acknowledgement

The shell loads a personal bell and the center consumes persisted routes. Read acknowledgements are optimistic only in the client and restore the prior state when the server rejects the write.

- `src/components/app-shell/AppShell.tsx:276` — `NotificationBell`: mounts the personal entry point outside navigation.
- `src/components/notifications/NotificationBell.tsx:9` — `NotificationBell`: caps the unread presentation and reconciles failed mark-all/read requests.
- `src/app/api/notifications/[id]/read/route.ts:5` — `POST`: scopes acknowledgement to the resolved tenant and recipient.

### Stored data and producer boundary

The migration gives recipients select and acknowledgement authority only; the job service client remains the producer writer. The producer derives the latest quote state and emits the stored quote route only to recipients with `Quotes.View`; content carries no quote price or customer detail.

- `supabase/migrations/20260923170000_in_app_notifications.sql:3` — `create table public.notifications`: declares recipient isolation, read state, and subject-period de-duplication.
- `src/server/notifications/follow-up-producer.ts:5` — `TERMINAL_QUOTE_STATUSES`: suppresses terminal follow-ups after resolving each quote's latest version.
- `src/server/notifications/follow-up-producer.ts:14` — `resolveCapability`: prevents a notification from storing a quote route for an unentitled recipient.
- `src/app/api/jobs/run/route.ts:88` — `emitDueFollowUpNotifications`: keeps the producer on Story 13.1's authenticated runner lane.

### Browser acceptance coverage

The Playwright fixture gives each seeded recipient ten distinct unread rows. This makes the capped-count and popover-list assertions personal and deterministic while leaving database authority to the integration/RLS suite.

- `tests/e2e/global-setup.ts:811` — `notificationUsers`: seeds rows independently for each browser recipient.
- `tests/e2e/global-setup.ts:819` — `index += 1`: supplies the unread cardinality required by AC3's capped `9+` presentation.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:77` — `roleName`: exercises the all-valid-role personal bell and no-nav invariant from AC3.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:97` — `stored notification link`: exercises AC4's persisted destination and acknowledgement journey.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:108` — `filters together`: exercises AC4's category, read-state, and date narrowing.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:141` — `Failed optimistic mark-read`: injects a failed acknowledgement to exercise AC4 rollback and retry presentation.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:155` — `Profile preferences`: exercises AC5's category grouping and persisted in-app preference assertion.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:183` — `keyboard activation`: exercises AC6's bell dialog semantics and focus-return expectation.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:196` — `Empty and never-run states`: exercises AC6's truthful empty-state requirement without a real-time claim.
- `tests/e2e/notifications/notifications.atdd.e2e.spec.ts:204` — `Stale producer state`: exercises AC6's elapsed-scan presentation without a current-delivery claim.

### Category and preference authority

The active quotes-owned category is the registry source for essential/default behavior. Preferences accept only the available in-app channel, and the UI states that email delivery remains unavailable.

- `src/server/notifications/registry.ts:3` — `NOTIFICATION_CATEGORIES`: derives active categories from the manifest and declares the essential default.
- `src/app/api/notifications/preferences/route.ts:15` — `PUT`: rejects email and essential-disable attempts before persistence.
- `tests/unit/server/notifications/registry.test.ts:5` — `13.2 notification category registry derives`: exercises AC5's active/default/essential derivation.
- `tests/unit/scope/manifest-derivations.test.ts:144` — `13.2-UNIT-DERIVE-05`: exercises the manifest-derived H4 table enrollment change.

Evidence: `pnpm typecheck` and focused ESLint pass. Required notification integration evidence passes 1 file / 6 tests after applying the additive migration to the authorized local database; the required aggregate passed 43 files / 551 tests with no skips. The configured notification Playwright suite passed all 17 cases in two non-overlapping subsets after its acknowledgement and preference assertions were made state-stable.
Limits: Numeric runner SLA, batch-size, fairness, backlog-age, and freshness thresholds remain owner-pending; the surface reports only truthful run state and elapsed time.
