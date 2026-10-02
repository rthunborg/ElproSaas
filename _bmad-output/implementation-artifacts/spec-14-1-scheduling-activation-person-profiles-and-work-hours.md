---
title: 'Story 14.1: Resource Activation — Person Profiles and Work Hours'
type: 'feature'
created: '2026-09-29'
status: 'in-review'
baseline_revision: '93dbf8432d420ecf6fcd29e732be7ca136801534'
review_loop_iteration: 3
followup_review_recommended: true
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

Status: done

Implementation result: the nav-less `resources` foundation remains active and `scheduling` remains pending. The final constrained repair preserves PostgreSQL `time` seconds and microseconds through the compact minute controls, the read model, the validated command payload, and both audited RPCs. It retains a hidden later same-day shift and its containing break when a rendered first interval is cleared during a partial edit, assigns split-shift breaks only to their containing shift, and fails closed on an invalid hidden preservation baseline. The exception selector now snapshots the current complete form so an explicit clear cannot resurrect a stale exception kind.

Schema and focused acceptance: SQL-only loopback push applied `20261002171427_resource_command_only_write_acl.sql` and `20261002171855_resource_explicit_clear_form_inputs.sql`, including seed, to the retained local schema. The final required focused resource command/RLS run exited natively 0 with 4 files and 196 passed tests (0 skipped). Focused resource form units passed 7/7; `pnpm run typecheck` passed; `pnpm run lint` passed with 0 errors and 13 pre-existing warnings. The completed ADR-B012 prerequisite normal gate passed with `SUPABASE_TEST_REQUIRED=1`: 125 actual files, 124 passed and 1 intentional physical-loader skip; 1,243 assertions, 1,242 passed and 1 skipped. The earlier misbound attempt could not establish fixture cleanup on default 54321/54322; it was neither queried nor reset and is not current acceptance evidence.

Follow-up schema and focused acceptance: SQL-only loopback push applied `20261002190000_resource_time_precision_preservation.sql` to the retained 55422 schema after a native-zero dry run. Focused resource units passed 18/18; `pnpm typecheck` and `pnpm lint` passed. The required direct resource integration file ran with all local URL/key aliases bound explicitly and passed 6/6, including a `HH:MM:SS.ffffff` shift, break, and exception round trip. A mistaken wrapper command, `pnpm test:int -- tests/integration/commands/resources.int.test.ts`, ignored the target and exited 1 after 1,243 passes, one intentional skip, and one timeout in an unchanged role-harness test. Its bounded isolated reproduction passed 5/5 in 26.73 seconds; neither result establishes a full-gate pass, and the wrapper run is not acceptance evidence.

Guarded browser acceptance: after root rebuilt the production bundle, the project-pinned command exited natively 0 with 4/4 scenarios passed against root-owned app `b95629c8-276b-4f5f-828c-ba3ec93c4362` on loopback 3100 and root-owned Chromium CDP loopback 59391. The fixture attached only a dedicated context/page and closed those child objects. Along with persistence/reload, explicit clears, deactivated history, and 360×640 server-observable failure/retry, the added regression seeds a first shift/break, a hidden later split shift/break, and a timed fractional-second exception; it saves an unrelated profile field, reloads, then clears only the rendered first interval while asserting exact retained database values.

Review result: all three broad review rounds remain complete; this was the permitted constrained follow-up over latest fixes, Phase 6 coverage, and unresolved serious findings. Required independent Luna/xhigh external CLI review completed natively 0 after two failed/incomplete recovery attempts; the successful read-only pass confirmed the hidden-shift partial-edit loss. Supplemental Luna evidence and focused security review confirmed the PostgreSQL time-shape, split-break association, and timed-exception preservation defects; security found no additional reachable authorization issue. The canonical follow-up triage is patch 4, bad_spec 0, defer 0, dismissed 0. `review_loop_iteration` remains 3, `baseline_revision` remains `93dbf8432d420ecf6fcd29e732be7ca136801534`, and `followup_review_recommended` remains true.

Blocking condition: none.
## Review Triage Log

- **2026-10-02 — patched:** Direct `INSERT`/`UPDATE` on resource tables bypassed the audited command and its membership/work-role validation. A forward migration revokes those grants, drops write policies, and focused same/cross-tenant direct-DML negatives assert `42501`; authenticated command RPCs remain the intended path.
- **2026-10-02 — patched:** Explicit clears now reject orphan breaks and partial exception/calendar input, preserve non-rendered stored same-day intervals and later breaks, normalize only read-model `null` full-day times, and suppress an editable form on a controlled resource-read error. Browser evidence exercises populated clear/reload and partial rejection.
- **2026-10-02 — dismissed:** Same-tenant stale-submission conflict detection would add a versioning feature beyond the Story contract; existing composite replacement semantics are last-write-wins.
- **2026-10-02 — dismissed:** Planner access to the admin user-detail route would require a separate resource-only surface because the existing route intentionally exposes membership lifecycle and re-role controls under `Memberships.Manage`; no direct command authorization bypass exists.
- **2026-10-02 — dismissed:** Nullable temporal schema values are defense in depth after command-only writes; the current RPC and command validation reject malformed customer input. It is not deferred Story work or a release blocker.

### 2026-10-02 — Review pass

- patch: 2
- dismissed: none
- findings: direct resource-table DML bypassed audited command authority; anonymous resource mutation RPC calls lacked direct negatives. Both were repaired by the command-only forward migration and focused RLS/command coverage.

### 2026-10-02 — Review pass

- patch: 3
- dismissed: none
- findings: blank schedule, calendar, and personal-exception controls needed explicit clear semantics. The composite RPC and guarded browser coverage now prove clear/reload and partial-input rejection.

### 2026-10-02 — Review pass

- patch: 6
Findings repaired: orphan-break and partial-exception validation, full-day read-model exception history, controlled select clearing, controlled resource-read errors, and non-rendered shift/break preservation. No intent gap or bad-spec finding remained.
- dismissed:
  - Same-tenant stale writes retain the pre-existing last-write-wins composite-command semantics; conflict versioning is outside the Story contract.
  - The planner route candidate requires a new resource-only surface because the existing route includes membership lifecycle and re-role controls under `Memberships.Manage`.
  - Nullable temporal schema hardening is defense in depth after command-only writes, with malformed current customer input rejected by the RPC and command validator.
  - Resource-table DELETE remains RLS-invisible under the retained grant/policy contract; the focused cross-tenant assertion verified zero affected foreign rows.

### 2026-10-02 — Constrained follow-up after review cap

- patch: 4
- bad_spec: 0
- defer: 0
- dismissed: none
- findings repaired: valid PostgreSQL `time` shapes (`HH:MM:SS` and up to microsecond precision) were rejected after read-model serialization; a compact partial edit dropped a hidden later same-day shift and its break; same-weekday breaks were attached to every split shift; and a timed exception was rewritten to minute precision on an unrelated save. The read model, form merge, exception merge, validators, forward RPC migration, unit/integration coverage, and guarded browser regression now preserve the stored values.
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

Author: implementation author. Refreshed against the final constrained Story 14.1 repair after precision-preserving form merges, split-shift read-model shaping, controlled exception clear state, and guarded-CDP acceptance.

### Command authority and tenant boundary

Review the forward ACL repair first. Authenticated callers retain read access and the audited `SECURITY DEFINER` command path, while direct resource-table `INSERT` and `UPDATE` no longer bypass membership/work-role checks, tenant checks, or target-only audit events. Confirm anonymous calls remain denied and cross-tenant writes leave the privileged snapshot unchanged.

- `supabase/migrations/20261002171427_resource_command_only_write_acl.sql:1` — revokes direct writes and removes resource-table write policies without changing the sanctioned command functions.
- `src/server/commands/resources/profile-form.ts:12` — validates the composite form input before the envelope calls the audited RPC.
- `tests/integration/rls/resources.rls.test.ts:10` — covers same/cross-tenant direct write denial and unchanged-resource snapshots.
- `tests/integration/commands/resources.int.test.ts:99` — proves anonymous callers cannot invoke any resource mutation RPC.

### Persisted form inputs and explicit clears

The panel renders only the first interval and break for each weekday. It sends the stored schedule as a hidden preservation baseline, merges edits into that visible interval, and treats an entirely blank rendered schedule as an intentional clear. Malformed hidden exception history is not normalized into valid data; only the read model’s `null` full-day time representation is converted to omitted fields for command validation. The action rejects a break without its shift and every partial exception/calendar form before the RPC receives it.

- `src/components/resources/PersonSchedulePanel.tsx:21` — supplies stored schedule/exception/calendar baselines and records controlled select changes.
- `src/features/resources/actions.ts:21` — rejects partial input and prepares the intentional-clear command payload.
- `src/features/resources/schedule-form-merge.ts:20` — preserves non-rendered intervals and breaks while allowing a full clear.
- `src/features/resources/resource-form-inputs.ts:7` — converts only authoritative full-day null time fields and retains malformed entries for rejection.
- `src/features/resources/capacity-inputs.ts:15` — rejects malformed exception entries rather than throwing.
- `supabase/migrations/20261002171855_resource_explicit_clear_form_inputs.sql:46` — implements schedule, exception, and calendar clear behavior atomically with target-only audit metadata.
- `tests/unit/features/resources/schedule-form-merge.test.ts:5` — proves hidden intervals/breaks survive a visible edit and a blank schedule is an explicit clear.
- `tests/unit/features/resources/resource-form-inputs.test.ts:6` — proves the read-model full-day shape is accepted and malformed history is rejected.

### Read-model precision and hidden split shifts

The browser deliberately renders minute-granular native time controls. It retains the authoritative hidden read-model baseline when the rendered value is unchanged, so PostgreSQL seconds and microseconds are neither rejected nor truncated during an unrelated profile save. A partial edit that clears a rendered first interval preserves later same-day shifts and their own breaks; only a wholly blank schedule clears all weekly rows. The server rejects a malformed preservation baseline instead of turning it into a destructive replacement.

- `src/components/resources/PersonSchedulePanel.tsx:6` — renders native minute values while retaining the full authoritative schedule and exception payload at line 28.
- `src/features/resources/actions.ts:41` — treats an unreadable schedule baseline as an error and merges it before command validation.
- `src/features/resources/schedule-form-merge.ts:30` — preserves precise unchanged values, hidden later shifts, and a safe explicit-clear distinction.
- `src/features/resources/resource-form-inputs.ts:21` — preserves an unchanged timed exception’s exact read-model value.
- `src/features/resources/schedule-read.ts:20` — assigns a break only to the split shift which contains it, in deterministic order.
- `src/features/resources/work-hours.ts:6` and `src/features/resources/capacity-inputs.ts:18` — accept the supported PostgreSQL time shape consistently in schedule and exception validation.
- `supabase/migrations/20261002190000_resource_time_precision_preservation.sql:4` — extends both audited RPC validators to the supported precision without weakening authorization or overlap checks.
- `tests/integration/commands/resources.int.test.ts:40` — proves an actual fractional-second schedule, break, and exception RPC round trip.
- `tests/e2e/resources-person-profile.e2e.spec.ts:119` — proves browser save/reload and partial-clear preservation of the hidden split shift, break, and timed exception.

### Failure behavior and browser ownership

A resource read failure must not expose an editable blank form. The pinned test fixture connects to the root-owned guarded Chromium only with the explicit runner seam flag, creates a test context/page, and closes neither the root browser nor its lifecycle. Review the three browser scenarios after the source and migration paths.

- `src/components/admin-users/UserDetailPanel.tsx:32` — renders the controlled read error instead of a writable schedule panel.
- `tests/e2e/support/resource-cdp-attachment.ts:41` — attaches a dedicated context/page over loopback CDP without closing the root browser.
- `tests/e2e/resources-person-profile.e2e.spec.ts:32` — covers persistence/reload, populated clear/reload, and partial-input rejection.
- `tests/e2e/resources-person-profile.e2e.spec.ts:89` — verifies preserved deactivated history without booking/reassignment affordances.
- `tests/e2e/resources-person-profile.e2e.spec.ts:100` — proves server-observable transient failure retains draft input and persists only after retry.

### Final evidence

- Focused required resource command/RLS coverage: 4 files, 196 passed, 0 skipped.
- Constrained preservation units: 18 passed, 0 skipped. Direct required resource integration: 6 passed, 0 skipped.
- TypeScript: passed. Lint: 0 errors and 13 existing warnings.
- Guarded production browser acceptance: 4 passed, 0 failed, 0 skipped; root-owned app `b95629c8-276b-4f5f-828c-ba3ec93c4362`, root-owned Chromium CDP loopback 59391. The author did not own or stop either lifecycle.
- ADR-B012 prerequisite normal required gate: 125 files, 124 passed, 1 intentional physical-loader skip; 1,243 assertions, 1,242 passed, 1 skipped.
