---
title: 'Story 14.1: Resource Activation — Person Profiles and Work Hours'
type: 'feature'
created: '2026-09-29'
status: 'blocked'
baseline_revision: '93dbf8432d420ecf6fcd29e732be7ca136801534'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'docs/process/review-order.md'
warnings: []
deferred:
  - summary: 'Quote-follow-up bootstrap privilege expectation remains unmet outside Story 14.1 scope.'
    evidence: 'The corrected-target required integration sweep retained a serial 9/11 quote-follow-ups migration-reset failure: a pre-Story migration lacks bootstrap privilege revocations. Story 14.1 does not modify quote-follow-ups; no downstream bypass was asserted.'
    location: 'supabase/migrations/20260719130000_quote_follow_ups.sql'
    severity: 'medium'
---

<intent-contract>

## Intent

**Problem:** The product has tenant users and pricing work roles but no tenant-isolated person record, actual weekly availability, exception calendar, or capacity inputs. Epic 14 must open that resource foundation without prematurely exposing the separate Epic 15 scheduling module.

**Approach:** Activate only `resources` with the three foundational tables, role-gated admin maintenance in the existing user-management surface, and pure schedule/capacity input modelling. Reuse membership and work-role authorities, and make the manifest, RLS inventory, policies, and permission matrix agree in the same change.

## Boundaries & Constraints

**Always:** Keep one `person_profiles` record per membership at most, link a supplied default work role to the same-tenant Phase A `work_roles` catalog, and preserve deactivated users' profiles and hours. Model actual weekly shifts, breaks, exceptions, and tenant calendar-day reductions in Europe/Stockholm; employment percentage is a check value and never derives availability. Use the command envelope, request-bound RLS client, explicit grants, FORCE RLS, composite same-tenant relationships, H4 enrollment, exact-policy enumeration, audit metadata limited to target IDs, and role-negative tests. New profiles inherit the tenant default schedule as copied template rows; later changes are explicit profile changes.

**Block If:** A required schema choice would add an employee/HR parallel record, derive availability from employment percentage, introduce a hardcoded company weekday/hours rule, or requires a decision about overtime authorization, booking conflicts, recurrence, or optimization.

**Never:** Activate `scheduling`, add `/scheduling`, bookings, assignees, conflicts, recurrence, time reports, calendar feeds, notification categories, public surfaces, job assignment, HR-depth data, PWA/offline behavior, a service-role path, or hosted/demo changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Maintain profile | Entitled same-tenant admin or planner selects a membership, same-tenant work role, weekly shifts and breaks | Profile and normalized hours persist; reload shows the server state and the real weekly template | Generic Swedish retry message on a failed command; no success before persistence |
| Invalid or foreign reference | Duplicate profile, foreign membership/work role, malformed/overlapping shift or break, or invalid calendar-day reduction | No profile/hour/calendar write is committed | Return stable validation or tenant-access error without raw SQL or identifiers |
| Deactivated member | Existing profile and hours belong to a deactivated membership | History remains visible with `Inaktiverad`; no destructive cascade or future-booking behavior is invented | The UI states that reassignment is deferred until booking work exists |

</intent-contract>

## Code Map

- `src/scope/manifest.ts:247` -- `resources` is the pending E14 module; `scheduling` starts at line 262 and must remain pending with every surface array empty.
- `src/scope/manifest-schema.ts:278` -- coherence requires active-module matrix rows and activation metadata and rejects live surface on pending modules.
- `src/server/authz/permission-matrix.ts:18` and `src/server/commands/envelope-core.ts:150` -- matrix capability authority and command gate order to extend for resource maintenance.
- `src/features/admin-users/read-model.ts:35` and `src/components/admin-users/UserDetailPanel.tsx:8` -- existing tenant user-detail read and panel provide the admin-only person-maintenance entry point.
- `src/features/pricing/read.ts:25` and `src/server/commands/pricing/work-roles.ts:45` -- same-tenant active work-role selection and envelope-command precedent; do not alter the pricing catalogue model.
- `src/lib/datetime/business-date.ts:6` -- explicit `Europe/Stockholm` date convention to reuse for local calendar-day semantics.
- `tests/integration/rls/tenant-table-inventory.ts:175` and `tests/integration/rls/rls-inventory-gate.int.test.ts:1` -- all new resource tables require exhaustive cross-tenant and anonymous metadata plus the H4 gate.
- `tests/e2e/support/active-admin-navigation.ts:5` -- active manifest/nav agreement; this story adds no top-level nav item.
- `_bmad-output/test-artifacts/test-design-epic-14.md:25` -- approved test-design boundary: activate `resources`, retain pending `scheduling`, and cover profiles, hours, calendar days, and negative RLS cases.

## Tasks & Acceptance

**Execution:**
- `src/scope/manifest.ts`, `src/server/authz/permission-matrix.ts`, `tests/unit/scope/manifest-coherence.test.ts`, `tests/unit/scope/manifest-derivations.test.ts`, and `tests/unit/scope/manifest-invariants.test.ts` -- activate E14 `resources` with `activatedAt`, its three tenant tables, and explicit resource-maintenance capabilities for the owner-approved admin/planner roles; retain no resource nav item and leave E15 `scheduling` fully pending.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql` -- add `person_profiles`, `person_work_hours`, and `tenant_calendar_days` with tenant IDs, profile-to-membership uniqueness, same-tenant work-role linkage, normalized weekly/template/exception and shift/break constraints, structured calendar-day capacity variants, appropriate indexes, archive-preserving lifecycle, paired grants, FORCE RLS, and policy/helper use. Seed or expose a central Swedish-holiday input seam without treating it as tenant data or a hardcoded weekday rule.
- `src/features/resources/work-hours.ts` and `src/features/resources/capacity-inputs.ts` -- define client-safe validated schedule, break, exception, inherited-template, calendar-day, and injected-rule inputs. Compute scheduled availability only from actual template rows; provide pure fixtures for four-full-day versus five-short-day 80-percent examples without implementing booking/conflict detection.
- `src/server/commands/resources/person-profiles.ts`, `src/server/commands/resources/work-hours.ts`, `src/server/commands/resources/calendar-days.ts`, and `src/features/resources/read.ts` -- implement envelope-backed, auditable create/update/read operations that resolve tenant identity from membership, verify same-tenant parents, reject inactive/missing references safely, and avoid client-supplied tenant IDs.
- `src/components/resources/PersonSchedulePanel.tsx`, `src/components/admin-users/UserDetailPanel.tsx`, and `src/app/(app)/admin/users/[membershipId]/page.tsx` -- add responsive admin maintenance for a person's default work role, inherited/individual weekly schedule, breaks, exceptions, and tenant calendar inputs; bind pending/error state, retain unsent input only for transient failure, and label a deactivated profile without a booking affordance.
- `tests/unit/features/resources/work-hours.test.ts`, `tests/unit/features/resources/capacity-inputs.test.ts`, `tests/integration/commands/resources.int.test.ts`, `tests/integration/rls/tenant-table-inventory.ts`, `tests/integration/rls/resources.rls.test.ts`, `tests/integration/rls/resource-tables-migration-reset.int.test.ts`, and `tests/e2e/resources-person-profile.e2e.spec.ts` -- cover actual-schedule capacity inputs, inheritance, invalid time/break bounds, calendar variants, manifest/module separation, RLS/anon/disabled-member/per-role negatives, policy enumeration, and an admin persistence path.

**Acceptance Criteria:**
- Given the initial E14 migration, when the manifest is evaluated with the permission matrix, then `resources` is active with its three tables and E14 provenance while `scheduling` remains pending with no routes, tables, widgets, categories, public surfaces, or file owner types.
- Given a tenant membership, when an entitled maintainer creates or edits its person profile, then at most one profile exists for that membership and any default work role is an existing work role from the same tenant.
- Given two people each recorded as 80 percent, when one has four full scheduled days and the other five shorter scheduled days, then capacity input preserves their different daily availability and never synthesizes hours from the percentage.
- Given valid weekly shifts, breaks, individual absence/blocked-time exceptions, and tenant calendar-day reductions, when they are saved, then each remains data/config driven for later capacity calculation; invalid windows, overlaps, or invalid reductions are rejected with no partial persistence.
- Given a cross-tenant, anonymous, invited, disabled, or role-ineligible caller, when it reads or mutates resource rows directly or through a command/route, then it receives no data or mutation; H4, exact-policy, and matrix-derived negative tests include every new table.
- Given an existing deactivated member profile, when an admin opens it, then its historical person and schedule data remains available with an inactive marker and no destructive cascade, booking creation, or reassignment mutation occurs.
- Given a successful admin schedule edit at 360×640 or desktop width, when the page reloads, then the persisted server state is rendered; a transient failure retains suitable unsent input, offers retry, and never claims success before the server confirms the write.

## Design Notes

`resources` is deliberately a nav-less active module. The nested user-detail panel is a maintenance surface under an existing protected route; `Planering` remains the later E15 module and navigation destination. Calendar days are in this story because the approved E14 data model requires tenant closures and reduced-capacity periods, while holiday interpretation and booking subtraction remain inputs for the later pure conflict/capacity engine.

## Verification

**Commands:**
- `pnpm run typecheck` -- expected: strict TypeScript passes with new manifest/table inventory cases.
- `pnpm run lint` -- expected: no lint errors in resource, auth, UI, or test changes.
- `pnpm run test:unit` -- expected: manifest coherence plus pure resource schedule/capacity-input fixtures pass.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` -- expected: migrations, policy enumeration, H4, command and RLS-negative resource suites execute with no unexplained skips.
- `pnpm run test:e2e` -- expected: entitled admin persistence and responsive failure/retry path pass against the configured production web server.

## Auto Run Result

Status: blocked

Implementation result: activated the nav-less `resources` foundation, repaired the Story migration declaration and composite date-regex handling, and added forward migration `20261002113000_resource_profile_form_date_regex_fix.sql` for already-migrated databases. The protected admin-user panel persists profile, schedule, exception, and calendar input through the envelope-backed composite RPC. Browser fixtures now include active and deactivated profile histories; the retry seam is server-only/default-off and the guarded-CDP fixture attaches only to loopback endpoints.

Schema and scoped acceptance: direct SQL-only loopback push with seed applied the Story migration and forward correction without a reset or ledger edit; migration list was local=remote. Focused command/RLS integration passed 6/6 with `SUPABASE_TEST_REQUIRED=1`; the inventory policy test passed 11/11; focused seam/CDP units passed 2/2; full unit passed 1,928/1,929 with 1 existing skip; lint had 0 errors and 13 existing warnings; Next 16.3.6 production build and typecheck passed. A foreground existing-server browser run passed all 3 scenarios before the final guarded-CDP attachment patches, so it is diagnostic evidence only and is not final guarded-browser acceptance.

Review result: security and independent reviews completed. Their production-reachable seam, RPC/RLS negative-coverage, deactivated-history, retry-persistence, and guarded-CDP findings were patched; targeted security follow-up found no actionable regression. `Suggested Review Order` validates with 34 references. The review patch score is medium 4 and low 1 (13), so `followup_review_recommended` is true.

Blocking condition: finalization is blocked by both the required full `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` gate and final guard-owned browser admission. The last corrected-target integration sweep, before the final inventory and review patches, reported 1,081 passed, 156 failed, and 1 skipped across 124 files; serial diagnosis proved one reachability-affected file passes 12/12, the Story inventory ordering repair passes 11/11, and an unrelated `quote_follow_ups` grant test remains 9/11 because a pre-Story migration lacks bootstrap privilege revocations. The complete required gate was not rerun after final patches because no remaining Story correction addressed those inherited failures. The final guard-owned browser run is unexecuted because Chromium lifecycle `e2f5bdd8-7619-4fe3-97da-413fc2a5b445` returned `START_NOT_CREATED`, with its exact Job verified empty; the guard later recorded legacy `inspect_only` and no safe corrected input or retry route.

Guarded-browser evidence: the lifecycle was later stopped after the verified-empty Job. No unmanaged-browser workaround was used. The installed Playwright 1.61.1 CDP implementation was inspected: a CDP-attached `browser.close()` closes its WebSocket transport, but the fixture no longer calls it and closes only its page and context, leaving root-owned Chromium lifecycle control with the guard. Root accepted Stop acknowledgments for app `8eb8ee65` and Compose `06ea959a` (`native=0`, `ok=true`, `stop_requested`, `verified=false`); no shutdown polling was performed.

## Review Triage Log

- **2026-10-02 — patched:** Security and independent review findings led to a server-only, default-off retry seam; actual command/RLS negative coverage; valid deactivated-profile history fixtures; reload-after-retry persistence proof; and a loopback-only optional CDP attachment fixture.
- **2026-10-02 — patched:** Follow-up review removed `browser.close()` from the CDP-attached fixture and requires the runner retry-seam flag whenever CDP attachment is configured. Installed Playwright 1.61.1 source confirms the close path releases the CDP WebSocket transport; the final fixture avoids that path and retains guard lifecycle ownership.
- **2026-10-02 — deferred:** The serial quote-follow-ups grant expectation failure is in pre-Story migration bootstrap provenance and remains outside the authorized Story 14.1 scope. It blocks the required full integration gate but was not repaired here.
- **2026-10-02 — rejected as stale:** Earlier claims that the date-regex forward migration and focused resource coverage were unexecuted are superseded by the SQL-only application, aligned migration ledger, and current focused command/RLS, inventory, and unit evidence above. Final guard-owned browser acceptance remains unexecuted.

## Historical Run Evidence

Status: blocked

Planning result: Resolved the activation correction from the manifest and current Epic 14 test-design authority: Story 14.1 activates `resources` with `person_profiles`, `person_work_hours`, and `tenant_calendar_days`; `scheduling` remains pending for Epic 15. The plan confines the maintenance surface to existing admin-user details and defers bookings, conflicts, views, recurrence, time reports, notifications, and public feeds.

Blocking condition: HOOK_CONTEXT_UNAVAILABLE / The explicit subagent lifecycle context is not registered.

Implementation result: Activated the nav-less `resources` module; added the resource migration, permission and RLS inventory enrollment, envelope-backed profile/schedule/calendar persistence, read model, nested admin-user panel, Stockholm schedule/capacity helpers, and the protected retry seam. `scheduling` remains pending. The author supplied one refreshed Suggested Review Order, and its checker accepted 16 references.

Verification: `pnpm run typecheck` passed. `pnpm run lint` passed with 0 errors and 13 existing warnings. `pnpm run test:unit` passed 1,927 tests with 1 unrelated skipped test. `pnpm exec playwright test tests/e2e/resources-person-profile.e2e.spec.ts --list` discovered 3 scenarios; the persistence/reload and retry scenarios are enabled, while the deactivation booking/reassignment scaffold remains skipped because that is outside the active resource surface. `docker compose --env-file .env.test -f compose.test.yaml config --quiet` passed. Required `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` and browser execution did not receive clean-stack evidence: the stale user-owned local database lacks the migration and was not reset, while guarded ComposeUp was rejected before resource creation. No containers, lifecycle resource IDs, migrations, integration runs, browser runs, or Stop operations occurred on the proposed isolated stack.

### Resumed run — 2026-09-29

Status: blocked

Blocking condition: isolated Compose test stack cannot apply historical migration chain: storage schema absent (`storage.buckets` does not exist).

Implementation result: The resumed run consolidated the admin form into one database RPC so profile, copied tenant-template rows, schedule replacement, exceptions, optional calendar input, and their audit entries share one transaction. It added tenant default templates as `person_work_hours` rows with no profile, persisted individual exceptions, expanded the form to seven weekdays, and corrected the profile update path so an existing membership does not attempt a duplicate insert. The isolated stack was admitted and reached active state, but the historical migration chain stopped at the pre-existing file-storage migration because the Compose database lacks the required `storage` schema. The owned resource received a Stop request; no shutdown polling was used.

Verification: `pnpm run typecheck` passed. `pnpm run lint` passed with 0 errors and 13 existing warnings. `pnpm run test:unit` passed 1,928 tests with 1 skipped. `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` and enabled browser execution were not run because the isolated empty database could not complete migrations. The direct `supabase db push` attempt reached the historical file-storage migration and failed with `relation "storage.buckets" does not exist`; no Story 14.1 migration, integration suite, or browser scenario ran on that database.

Limits: Resource command/RLS test scaffolds remain skipped, so they cannot satisfy the required evidence. The resume loop stopped before review because required integration and browser verification is unavailable.

## Suggested Review Order

Author: implementation author.
Refreshed against the current working tree after the inherited-template copy ordering correction, migration CHECK and composite date-regex repairs, browser-fixture correction, deactivation-test enablement, browser server-action failure and draft-retention repairs, the private runtime gate plus authorization-negative test repairs, production-server fixture/reload acceptance repairs, and optional root-guard Chromium CDP attachment.

### Admin maintenance entry point and transaction boundary

The protected admin-user detail form validates its complete payload before entering one request-bound envelope command. The database RPC persists the profile, copied/default or explicit schedule, exceptions, optional calendar input, and target-only audit events in its transaction.

- `src/components/resources/PersonSchedulePanel.tsx:7` — `PersonSchedulePanel`: exposes the seven-day, exception, calendar, inactive-state, and retry controls inside the existing protected admin surface.
- `src/features/resources/actions.ts:13` — `saveResourceProfileAction`: retains the submitted form on a transient server-action failure and validates hours and capacity input before command execution.
- `src/server/commands/resources/profile-form.ts:21` — `saveResourceProfileForm`: binds maintenance to the envelope capability and resolved membership ownership.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:222` — `save_resource_profile_form_with_audit`: commits the composite write through one checked RPC.

### Browser fixture and retry seam

The browser path selects the existing tokenized tenant work role instead of assuming an unseeded literal. The failure-once signal requires both the dynamic protected route query and a private server runtime flag; the action independently applies the same server-only predicate before returning a retryable error without constructing a database client or issuing a command. Playwright supplies that private flag only to its disposable production web server. The resource tests optionally attach through a loopback CDP endpoint to a root guard-owned Chromium only when the runner carries the same explicit private flag; they close only their own context and page and let the worker release its transport. The initial action state is client-local so the client does not import a runtime value from the server-action module.

- `tests/e2e/resources-person-profile.e2e.spec.ts:10` — `Fixture`: reads the seeded work-role display name and selects that exact tenant-local option.
- `playwright.config.ts:83` — `E2E_RESOURCE_SAVE_FAILURE_ENABLED`: enables the retry seam only in the configured disposable production test server.
- `tests/e2e/support/resource-cdp-attachment.ts:4` — `RESOURCE_E2E_CDP_ENDPOINT_ENV`: keeps optional guard-CDP attachment test-runner-only and absent by default.
- `tests/e2e/support/resource-cdp-attachment.ts:20` — `requireResourceE2eFailureSeamForCdp`: fails fast when a CDP-attached runner lacks the explicit retry-seam opt-in required to align with the guarded server.
- `tests/e2e/support/resource-cdp-attachment.ts:41` — `connectOverCDP`: attaches only to a validated loopback endpoint and creates a dedicated test context without closing the root-owned browser.
- `tests/e2e/resources-person-profile.e2e.spec.ts:32` — `resourcePage`: routes all three resource scenarios through the optional attachment fixture without changing normal Playwright behavior.
- `src/app/(app)/admin/users/[membershipId]/page.tsx:9` — `AdminUserDetail`: requires `resourceSaveFailure=once` and the private server flag before passing the test seam into the protected panel.
- `src/server/resources/e2e-save-failure.ts:5` — `isResourceE2eSaveFailureEnabled`: defaults the server-only runtime flag to false unless it is exactly `true`.
- `src/components/resources/PersonSchedulePanel.tsx:6` — `RESOURCE_INITIAL`: keeps the `useActionState` initial value in client code.
- `src/components/resources/PersonSchedulePanel.tsx:13` — `retainDraft`: captures every editable form value and binds controls to that draft so a failed server action cannot clear unsent input.
- `src/features/resources/actions.ts:16` — `shouldInjectResourceE2eSaveFailure`: independently rejects direct form/action attempts to enable the seam without the private server flag before any persistence path.

### Resource activation and isolated schedule storage

The manifest activates only the nav-less resource foundation. The migration keeps person records, normalized weekly/exception inputs, and tenant calendar reductions tenant-scoped; `scheduling` retains its pending, surface-free state. New-profile template copy inserts shifts before breaks because the database row trigger requires a containing shift for each break.

- `src/scope/manifest.ts:249` — `id: "resources"`: activates E14 without adding a resource navigation item.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:6` — `create table public.person_profiles`: enforces one profile per membership and same-tenant membership/work-role references.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:77` — `validate_person_work_hour`: rejects overlapping shifts, invalid breaks, and overlapping exceptions for direct entitled writes.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:187` — `Copy shifts before breaks`: makes copied tenant templates satisfy the break-containment trigger deterministically.
- `supabase/migrations/20261002113000_resource_profile_form_date_regex_fix.sql:4` — `save_resource_profile_form_with_audit`: forward-corrects the composite form RPC so ordinary ISO exception and calendar dates pass PostgreSQL regex validation on already-migrated databases.
- `src/features/resources/work-hours.ts:11` — `validateWorkHoursInput`: treats employment percentage as descriptive and derives availability only from actual shifts and breaks.
- `src/features/resources/capacity-inputs.ts:8` — `SWEDISH_HOLIDAY_RULE_SOURCE`: provides the holiday-rule input seam without hardcoded availability rules.

### Acceptance evidence and current limits

The named tests exercise the manifest boundary, preserved 80-percent schedule shape, invalid time windows, and data-driven capacity inputs. Database/RLS and browser paths remain required evidence and are not credited by these pure tests.

- `tests/unit/scope/resources-activation.atdd.test.ts:10` — `activates resources`: proves E14/E15 manifest separation.
- `tests/unit/features/resources/work-hours.test.ts:7` — `preserves different daily availability`: proves schedule shape is not synthesized from employment percentage.
- `tests/unit/features/resources/work-hours.test.ts:57` — `rejects overlapping breaks`: proves a break cannot be double-counted inside one actual shift.
- `tests/unit/features/resources/capacity-inputs.test.ts:7` — `retains data-driven absences`: proves valid exception and calendar input acceptance.
- `tests/integration/commands/resources.int.test.ts:33` — `saves the browser form's profile`: exercises the composite RPC with the browser's profile, schedule, full-day exception, and calendar input shape.
- `tests/integration/commands/resources.int.test.ts:51` — `composite form RPC rejects foreign tenants`: asserts tenant-B and forged-actor calls fail with `42501` and leave profile, work-hour, and calendar tables unchanged.
- `tests/integration/rls/resources.rls.test.ts:10` — `tenant B cannot read or mutate tenant A resource rows`: asserts cross-tenant profile, work-hour, and calendar updates leave stored values unchanged.
- `tests/unit/server/resources/e2e-save-failure.test.ts:8` — `resource E2E failure seam requires`: proves a form request alone cannot enable the retry seam; only the exact private runtime opt-in can, and retry disables its one-time branch.
- `tests/unit/e2e/resource-cdp-attachment.test.ts:15` — `guarded CDP attachment requires`: proves attached execution fails without the explicit runner retry-seam opt-in.
- `tests/e2e/global-setup.ts:907` — `person_profiles`: seeds a real profile before its membership is disabled, preserving a historical schedule for the deactivation path.
- `tests/e2e/resources-person-profile.e2e.spec.ts:55` — `admin sees a deactivated profile as Inaktiverad`: asserts the preserved historical weekday value as well as the absence of booking and reassignment affordances.
- `tests/e2e/resources-person-profile.e2e.spec.ts:66` — `server-observable transient save failure`: reloads after retry success and asserts the 08:00 value came from server persistence.

Evidence: in this refresh, the focused `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/e2e/resource-cdp-attachment.test.ts` run passed 2/2, the earlier focused retry-seam unit run passed 1/1, and `pnpm run typecheck` plus `git diff --check` passed after the CDP lifecycle and runner-alignment repair. The earlier composite-RPC failure safely identified `23514` (`resource exception invalid`) before partial persistence and led to the forward corrective migration; the authorized direct loopback migration and focused database tests have since executed, as recorded by the workflow owner. Earlier evidence: `pnpm run test:unit -- --testNamePattern=resources` completed 1,929 tests: 1,928 passed and 1 skipped; the migration ledger was locally and remotely aligned; and the enabled focused Vitest command/RLS run passed 6/6 tests, covering profile/schedule persistence, overlap rollback, forged-tenant and invalid-calendar rejection, manifest/H4 enrollment, and direct tenant-B read/update denial. The migration's unclosed `person_work_hours` CHECK is corrected at line 39. Earlier lint completed with 0 errors and 13 existing warnings, and Playwright discovery found three resource scenarios.
Limits: The optional attached-browser fixture is unit-verified but did not connect to a guard-owned Chromium: its required guard lifecycle failed closed with `START_NOT_CREATED`, a verified-empty Job, and no safe retry route. The clean-reset migration/H4 gates were deliberately not run because the retained-stack directive prohibits reset. The focused browser persistence, deactivation, and retry acceptance remain to run through the root guard-owned Chromium.
