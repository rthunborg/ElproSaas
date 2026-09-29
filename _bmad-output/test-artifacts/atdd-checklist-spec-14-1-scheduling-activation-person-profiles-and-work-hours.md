---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-29'
workflowType: 'testarch-atdd'
storyId: '14.1'
storyKey: 'spec-14-1-scheduling-activation-person-profiles-and-work-hours'
storyFile: 'C:\\Users\\Rasmus\\.codex\\worktrees\\epic14-scheduling\\ElproSaas\\_bmad-output\\implementation-artifacts\\spec-14-1-scheduling-activation-person-profiles-and-work-hours.md'
atddChecklistPath: 'C:\\Users\\Rasmus\\.codex\\worktrees\\epic14-scheduling\\ElproSaas\\_bmad-output\\test-artifacts\\atdd-checklist-spec-14-1-scheduling-activation-person-profiles-and-work-hours.md'
generatedTestFiles:
  - 'tests/unit/scope/resources-activation.atdd.test.ts'
  - 'tests/unit/features/resources/work-hours.test.ts'
  - 'tests/unit/features/resources/capacity-inputs.test.ts'
  - 'tests/integration/commands/resources.int.test.ts'
  - 'tests/integration/rls/resources.rls.test.ts'
  - 'tests/e2e/resources-person-profile.e2e.spec.ts'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md'
  - '_bmad-output/implementation-artifacts/epic-14-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-14.md'
  - 'playwright.config.ts'
  - 'tests/e2e/auth/admin-user-management.atdd.e2e.spec.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
---

# ATDD Checklist — Story 14.1: Resource Activation — Person Profiles and Work Hours

## Preflight and context

- Story status is `ready-for-dev`; all seven acceptance criteria are explicit and testable.
- Detected stack: frontend (Next.js and Playwright are configured). The story also requires Vitest integration/RLS evidence; this is covered by the project's existing integration harness, without reclassifying the detected stack.
- Existing patterns reviewed: admin-user Playwright journeys, manifest-derived navigation, tenant-table inventory/H4 gate, and local-stack-only integration suites.
- `tea_use_playwright_utils` is enabled in TEA configuration, but `@seontechnologies/playwright-utils` is absent from `package.json`; the library mandate does not apply. The generated Playwright scaffold uses the established project runner and fixtures.
- Pact is not relevant: Story 14.1 introduces no independently deployed consumer/provider boundary, and no Pact packages are installed.
- The approved Epic 14 test-design artifact is planning context only; it supplies no executed evidence.

## Generation mode

AI generation was selected. The feature surface does not exist, so selector recording would not produce reliable selectors. Stable accessible labels and test IDs are specified as implementation requirements for the later UI work.

## Test strategy

| Acceptance criterion | Primary coverage | Priority | Red-phase scaffold |
| --- | --- | --- | --- |
| `resources` activates while `scheduling` stays pending | Unit manifest invariants | P0 | `tests/unit/scope/resources-activation.atdd.test.ts` |
| Profile is one-per-membership and default role is same tenant | Integration command and RLS | P0 | `tests/integration/commands/resources.atdd.int.test.ts` |
| Actual weekly schedules retain distinct 80-percent patterns | Unit pure work-hours | P0 | `tests/unit/features/resources/work-hours.atdd.test.ts` |
| Shifts, breaks, exceptions, and calendar reductions validate atomically | Unit validation plus integration rollback | P0 | `tests/unit/features/resources/capacity-inputs.atdd.test.ts`, `tests/integration/commands/resources.atdd.int.test.ts` |
| Cross-tenant, anonymous, invited, disabled, and ineligible callers are blocked | Integration RLS and command roles | P0 | `tests/integration/rls/resources.atdd.rls.test.ts` |
| Deactivated profile stays readable and marked inactive | E2E | P1 | `tests/e2e/resources-person-profile.atdd.e2e.spec.ts` |
| Admin persistence and 360×640 retry behavior | E2E | P0 | `tests/e2e/resources-person-profile.atdd.e2e.spec.ts` |

Red phase rule: every generated scenario remains `test.skip()` until its implementation task is active. No database, browser, hosted service, or migration was started for scaffold generation.

## Red-phase scaffolds created

| Level | File | Scenarios | Status |
| --- | --- | ---: | --- |
| Unit | `tests/unit/scope/resources-activation.atdd.test.ts` | 1 | RED / skipped |
| Unit | `tests/unit/features/resources/work-hours.test.ts` | 2 | RED / skipped |
| Unit | `tests/unit/features/resources/capacity-inputs.test.ts` | 2 | RED / skipped |
| Integration | `tests/integration/commands/resources.int.test.ts` | 3 | RED / skipped |
| Integration | `tests/integration/rls/resources.rls.test.ts` | 3 | RED / skipped |
| E2E | `tests/e2e/resources-person-profile.e2e.spec.ts` | 3 | RED / skipped |

The command and UI contracts do not yet exist. Dynamic imports defer their resolution until a developer activates the applicable scenario, so the green baseline does not acquire imports for unimplemented modules. The command names and UI test IDs are explicit scaffolding contracts to reconcile in the implementation task before removing `test.skip()`.

## Fixtures and test data needed for green phase

- Extend the existing two-tenant and role-aware local-only factories with two same-tenant memberships: one active editable member and one deactivated member, plus a same-tenant active work role.
- Extend the existing E2E fixture JSON with `resourceProfileMembershipId` and `deactivatedResourceProfileMembershipId`; use the existing tenant-admin credentials.
- Add a server-observable one-time command failure seam for the narrow-screen retry scenario. It must not replace the successful persistence assertion with a client-only network mock.
- Enroll all three tables in `TENANT_TABLES`, both inventory metadata branches, the H4 gate, and the exact policy/reset suite.

## Required UI test IDs

- `resource-default-work-role`, `resource-weekday-1-start`, `resource-weekday-1-end`
- `resource-break-1-start`, `resource-break-1-end`, `resource-exception-date`
- `resource-calendar-day-reduction`, `resource-save`, `resource-save-status`, `resource-save-error`, `resource-retry-save`
- `resource-profile-status`, `resource-booking-action`, `resource-reassignment-action`

These are scoped to the existing `/admin/users/[membershipId]` maintenance panel. Story 14.1 creates no `/resources` route, navigation item, booking control, or reassignment action.

## Activation checklist

1. Implement the migration, manifest/matrix activation, command envelope contracts, pure resource modules, and admin-user detail panel.
2. Replace each dynamic scaffold contract with the final typed import only after the exported command/module contract is implemented.
3. Remove `test.skip()` one scenario at a time, confirm an initial failure, and then implement the smallest change that makes it pass.
4. Run `pnpm run typecheck`, the focused unit files, `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/resources.int.test.ts tests/integration/rls/resources.rls.test.ts`, and the focused Playwright file against the configured local production server.
5. Record actual integration/RLS executed and skipped counts. Explicit skips do not satisfy the acceptance criteria.

## Red-phase verification evidence

| Check | Result |
| --- | --- |
| Static scaffold audit | 14 `test.skip()` calls across six files; no `test.only` or `test.todo` calls found. |
| Focused Node unit scaffold run | 0 passed, 0 failed, 5 skipped. The runner parsed all three unit files and did not resolve deferred feature modules. |
| Typecheck | Passed after the isolated worktree received the existing frozen-lockfile dependencies. |
| Focused integration/RLS run | `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run tests/integration/commands/resources.int.test.ts tests/integration/rls/resources.rls.test.ts`: 2 files skipped, 6 tests skipped, 0 executed. This is scaffold verification only and does not satisfy required integration/RLS evidence. |
| Focused E2E listing | Playwright discovered 3 red-phase E2E scenarios in one file. They were not executed because all are intentionally skipped and executing the configured production web-server path is not needed to validate scaffolding. |
| Infrastructure | No local stack, browser server, migration, or hosted service was started or changed. |

## Handoff

The requested story specification is intentionally unchanged. This checklist is the artifact-link handoff source for the implementing workflow.

## Open implementation contracts

- The final exported command function names and exact validated input/result shapes must be chosen with the Story 14.1 command implementation, then reconciled in the skipped command scaffolds before activation.
- The exact Swedish labels are deliberately left to the approved UI implementation; the generated E2E tests use the listed test IDs for stable selection.
