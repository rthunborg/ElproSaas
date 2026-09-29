---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-23'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-13-2-in-app-notifications-bell-center-and-preferences.md'
  - '_bmad-output/test-artifacts/test-design-epic-13.md'
  - '_bmad/tea/config.yaml'
  - 'playwright.config.ts'
  - 'tests/integration/rls/role-harness.atdd.int.test.ts'
  - 'tests/e2e/auth/login-and-tenant-context.e2e.spec.ts'
---

# ATDD Checklist — Epic 13, Story 13.2: In-App Notifications

**Date:** 2026-09-23  
**Author:** Rasmus  
**Primary test levels:** integration/RLS and E2E

## Story summary

Create a tenant- and recipient-isolated in-app notification contract for active categories, the contained quote-follow-up producer, personal read actions, and profile preferences. Every valid tenant role receives a personal bell and center; all routes are entitlement-projected and persisted at emission time.

## Acceptance criteria coverage

| AC | Red-phase coverage |
| --- | --- |
| Recipient projection and stored route | `13.2-INT-001`; E2E stored-link journey |
| Deduplicated terminal-safe producer | `13.2-INT-002`; terminal suppression contract |
| All-role personal bell with isolation | RLS boundary contract; four role bell journeys |
| Read actions, filters, route and rollback | mark-one/all contracts; center/filter/rollback E2E |
| Preference matrix and inactive email | defaults/essential/email integration contracts; settings E2E |
| Fresh schema, manifest, accurate honest states | migration/schema contract; empty, never-run, stale and accessibility E2E |

## Failing tests created — RED phase

### API / integration / RLS (10 tests)

- [notifications.atdd.int.test.ts](C:/DEV/ElproSaas/tests/integration/notifications/notifications.atdd.int.test.ts) — all tests use `test.skip()`.
- Covers recipient-projected emission, stored routes, unique due reminders, terminal suppression, own-user and tenant RLS, direct-write and escalation negatives, idempotent reads, preference defaults, essential protection, inactive email, and fresh schema constraints.

### E2E (16 tests)

- [notifications.atdd.e2e.spec.ts](C:/DEV/ElproSaas/tests/e2e/notifications/notifications.atdd.e2e.spec.ts) — all tests use `test.skip()`.
- Covers every valid role, `9+` bell count, popover, center, no navigation item, stored links, filters, reads, rollback, preferences, keyboard focus return, and honest empty/never-run/stale states.

## Data and fixtures

No generic fixture was created: the project has an existing two-tenant database factory and an authenticated E2E fixture. Implementation must extend those established factories with a notification seed that contains distinct recipient, same-tenant other-user, and foreign-tenant rows, plus a stored entitled quote route. It must clean up after each test and never seed by browser UI.

## Required stable UI contracts

- A `Notiser` bell button with an accessible unread count.
- A `Notiser` dialog/popover, semantic notification list, `Visa alla`, and `Markera alla som lästa`.
- `/notifications` with accessible module/category, read-state, and date filter labels.
- Profile entry `Notisinställningar`; settings heading and grouped category controls.
- Swedish inactive-email text: `e-postutskick aktiveras senare`.
- An alert for recoverable read failures and status text for honest last-scan information.

## Green-phase implementation checklist

- [ ] Activate the manifest in the schema/nav change and add only active categories/tables/routes.
- [ ] Implement constrained `notifications` and `notification_preferences` migrations, RLS, grants, indexes, dedupe, and H4 inventory.
- [ ] Implement server-only projected emission and the existing runner producer; persist the route at emission and suppress terminal follow-ups.
- [ ] Implement current-user mark-one/all and preference commands with idempotency, essential-category protection, and no email mutation.
- [ ] Implement bell, popover, personal center, preferences, focus behavior, and truthful state copy without adding center navigation.
- [ ] Extend the existing two-tenant and browser fixtures, remove only the relevant `test.skip()` calls, then run the focused commands below.

## Execution commands

```powershell
pnpm test:unit -- --test-name-pattern="notification|producer|manifest|authz"
$env:SUPABASE_TEST_REQUIRED='1'; pnpm test:int -- tests/integration/notifications tests/integration/rls tests/integration/jobs
pnpm test:e2e -- tests/e2e/notifications
```

## Red-green-refactor status

**RED complete:** both handoff JSON files were validated as successful, their generated files exist, all 26 cases are individually skipped, and no placeholder `expect(true).toBe(true)` assertion exists. Tests were intentionally not executed: skipped red scaffolds would report skipped rather than demonstrate a meaningful implementation failure, and the required local Supabase stack was not started for this test-authoring task.

**GREEN next:** wire the tests to the actual server/read-model/UI contracts, remove their skips selectively, and run the focused required-stack suite. **REFACTOR:** consolidate only after those focused tests pass while preserving the RLS and stored-route negative coverage.

## Assumptions and deferred work

- The exact notification fixture shape and implemented Swedish labels may be finalized with the UI; semantic role/name contracts must remain accessible.
- Numeric runner SLA, batch, fairness, backlog-age, and freshness thresholds remain owner-pending. Tests assert elapsed/run state and prohibit real-time claims rather than invent a threshold.
- No Pact consumer contract was generated: Story 13.2 is an in-process Next.js/Supabase boundary with no separate provider deployment contract.

## Knowledge applied

The strategy applied factory and fixture isolation, network-first rollback injection before interaction, resilient role/name selectors, deterministic waits, TDD red-phase skipping, test-level selection, and P0-first risk coverage. Pact utilities were configured but not applicable to this same-deploy story.

