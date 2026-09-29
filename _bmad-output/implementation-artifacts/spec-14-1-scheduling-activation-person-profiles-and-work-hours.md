---
title: 'Story 14.1: Resource Activation — Person Profiles and Work Hours'
type: 'feature'
created: '2026-09-29'
status: 'blocked'
baseline_revision: '93dbf8432d420ecf6fcd29e732be7ca136801534'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'docs/process/review-order.md'
warnings: []
deferred: []
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

Blocking condition: isolated Compose test stack cannot apply historical migration chain: storage schema absent (`storage.buckets` does not exist).

Implementation result: The resumed run consolidated the admin form into one database RPC so profile, copied tenant-template rows, schedule replacement, exceptions, optional calendar input, and their audit entries share one transaction. It added tenant default templates as `person_work_hours` rows with no profile, persisted individual exceptions, expanded the form to seven weekdays, and corrected the profile update path so an existing membership does not attempt a duplicate insert.

Verification: `pnpm run typecheck` passed. `pnpm run lint` passed with 0 errors and 13 existing warnings. `pnpm run test:unit` passed 1,928 tests with 1 skipped. The isolated stack was admitted and reached active state, but `supabase db push` stopped at the historical file-storage migration with `relation "storage.buckets" does not exist`; no Story 14.1 migration, integration suite, or browser scenario ran. The owned resource received a Stop request without shutdown polling.

Limits: `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` and browser execution remain unrun. Resource command/RLS scaffolds remain skipped and cannot satisfy the required evidence. `followup_review_recommended` remains false because the workflow stopped before review.

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
Refreshed against the current working tree after the weekly-input and database-integrity corrections, typecheck, lint, and unit verification.

### Resource activation and tenant-scoped storage

The manifest activates only the nav-less resource foundation. The migration stores profiles, normalized time inputs, and calendar reductions with same-tenant relationships and forced RLS; scheduling stays pending.

- `src/scope/manifest.ts:249` — `id: "resources"`: activates E14 with no navigation surface.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:6` — `create table public.person_profiles`: enforces the one-profile-per-membership root record.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:57` — `force row level security`: applies the storage isolation boundary.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:77` — `validate_person_work_hour`: protects direct entitled table writes from overlapping shifts and invalid breaks.
- `supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql:117` — `save_person_schedule_with_audit`: validates the JSON schedule before deleting and replacing template rows.

### Capacity inputs and maintenance entry point

Actual shift rows and breaks determine availability; employment percentage is validated descriptive input. The admin-user detail panel hosts the initial connected maintenance form.

- `src/features/resources/work-hours.ts:11` — `validateWorkHoursInput`: rejects invalid ranges and overlapping same-day shifts.
- `src/features/resources/capacity-inputs.ts:8` — `SWEDISH_HOLIDAY_RULE_SOURCE`: exposes an injected holiday-rule seam without hard-coded availability rules.
- `src/server/commands/resources/person-profiles.ts:14` — `createOrUpdatePersonProfile`: resolves the tenant via the envelope and never accepts a tenant id.
- `src/features/resources/actions.ts:13` — `saveResourceProfileAction`: validates the complete submitted weekly template and calendar reduction before the profile command runs.
- `src/features/resources/read.ts:11` — `readResourceForMembership`: reads the RLS-visible profile, weekly shift/break rows, active work roles, and tenant calendar reductions for the protected detail route.
- `src/components/resources/PersonSchedulePanel.tsx:7` — `PersonSchedulePanel`: renders all seven weekly shift and break inputs, persisted calendar input, inactive state, and retry control.
- `compose.test.yaml:1` — isolated image-based Auth, PostgREST, Storage, and gateway definition uses only default Compose networking, named volumes, and configurable loopback ports.

### Evidence and current limits

ACs for resource activation, distinct 80-percent daily templates, invalid shift/break bounds, and invalid capacity inputs are exercised by the named unit tests below.

- `tests/unit/scope/resources-activation.atdd.test.ts:10` — `activates resources`: proves E14/E15 manifest separation.
- `tests/unit/features/resources/work-hours.test.ts:7` — `preserves different daily availability`: proves schedule shape is not synthesized from employment percentage.
- `tests/unit/features/resources/work-hours.test.ts:57` — `rejects overlapping breaks`: proves a break cannot be double-counted inside one actual shift.
- `tests/unit/features/resources/capacity-inputs.test.ts:7` — `retains data-driven absences`: proves valid exception and calendar input acceptance.

Evidence: `pnpm run typecheck` passed; `pnpm run lint` completed with 0 errors and 13 existing warnings; `pnpm run test:unit` passed 1,929 tests with 1 skipped. `pnpm exec playwright test tests/e2e/resources-person-profile.e2e.spec.ts --list` discovered three scenarios. `node scripts/verify/check-review-order.mjs` passes after this refresh. The browser seam uses `?resourceSaveFailure=once`: the first protected form submission receives a server-action error before persistence, and the rendered retry button submits the actual protected write path. The persistence/reload and retry scenarios are enabled but have not been browser-executed.
Limits: required migration-reset/H4 enrollment and resource command/RLS negative integration coverage could not be credited. The available local database is a stale user-owned instance without these resource tables; it was not reset or adopted. The isolated Compose definition could not be launched because the subagent lifecycle context was unavailable, so migration application, `SUPABASE_TEST_REQUIRED=1 pnpm run test:int`, and protected-route Playwright execution could not begin. The deactivation scenario remains skipped because it asserts booking and reassignment affordances outside the active resource surface. The server action validates input before profile persistence, but separate successful profile, schedule, and calendar commands are still not one transaction. More materially, the current three-table schema has no tenant-default schedule storage and the panel does not submit individual person exceptions; the required copied inherited template and persisted exception flow remain incomplete.
