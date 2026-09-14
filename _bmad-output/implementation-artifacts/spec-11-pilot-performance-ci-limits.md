---
title: 'Epic 11 Pilot Performance and CI Limits'
type: 'chore'
created: '2026-09-14'
status: 'in-review'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-11-context.md'
  - 'docs/process/review-order.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 11 has reproducible local RBAC performance evidence, but its original baseline records observations without enforcing the approved pilot ceilings. CI also has only broad job timeouts, so a slow test suite can consume the whole job allowance before failing.

**Approach:** Make the existing two-tenant local measurement a required database gate with the approved latency and RLS-request ceilings, and bound unit, database, and browser test execution without counting dependency installation, production build, or server startup.

## Boundaries & Constraints

**Always:** Use the local Supabase stack only with `SUPABASE_TEST_REQUIRED=1`. Preserve the exact measured profile: 120 active Tenant A memberships, 24 Tenant B memberships, five roles, and an additional role on every third Tenant A membership. Enforce Admin-users projection p95 ≤250ms, synthetic bulk effective-permissions p95 ≤25ms, and no more than three authenticated RLS requests per read. Enforce unit ≤180s, database ≤300s, and browser test attempts ≤300s. Persist only the existing ignored local evidence file.

**Ask First:** Any new capacity profile, a production/full-page SLO, a threshold change, a remote test target, or a coverage/duplication percentage gate.

**Never:** Do not edit backup, monitoring, evidence assessment, or retrospective materials; add no secrets, service-role client path, hosted target, coverage mandate, or duplicate test suite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pilot measurement passes | Local stack and measured results at ceilings | Ignored result records `passed`; CI continues | Cleanup removes disposable fixtures |
| Pilot regression | Any p95 or request count exceeds its ceiling | Ignored result records all violations; database CI fails | Failure does not suppress fixture cleanup |
| Unit/database overrun | A test command or package-manager descendant exceeds its elapsed ceiling | Wrapper terminates the process tree and fails the step | Child non-zero exit remains a failure |
| Browser overrun | Sum of Playwright test attempts exceeds 300s | Reporter converts an otherwise completed run to failure | Build/web-server bootstrap is excluded |

</frozen-after-approval>

## Code Map

- `scripts/nfr/epic-11-r1108-baseline.ts` -- the existing local-only authenticated RLS measurement, fixture cleanup, and ignored evidence writer; reuse it rather than creating another workload.
- `src/features/admin-users/read-model.ts` -- measured production Admin-users projection; it pages memberships and role batches, determining the request-count ceiling.
- `scripts/nfr/epic-11-pilot-limits.ts` -- small, side-effect-free threshold authority shared with unit boundary tests.
- `scripts/verify/run-with-time-budget.mjs` -- CI command runner that terminates a unit/database execution overrun and preserves child failures.
- `tests/e2e/ci-duration-budget-reporter.ts` -- Playwright-only execution accounting after production build/server startup.
- `.github/workflows/ci.yml` -- applies the approved timing gates to the existing CI lanes without changing local-stack lifecycle steps.

## Tasks & Acceptance

**Execution:**

- [ ] `scripts/nfr/epic-11-pilot-limits.ts` and `scripts/nfr/epic-11-r1108-baseline.ts` -- centralize approved pilot ceilings, write an assessed result before throwing, and fail the real local workload on a measured violation.
- [ ] `scripts/verify/run-with-time-budget.mjs`, `tests/support/ci-duration-budget.ts`, and focused unit tests -- make command-timeout and browser-duration boundary behavior deterministic without timing the test machine in unit tests.
- [ ] `tests/e2e/ci-duration-budget-reporter.ts`, `playwright.config.ts`, `package.json`, and `.github/workflows/ci.yml` -- wire execution-only limits into the existing unit, DB/RLS, and browser lanes; run the performance probe explicitly beside the retained Phase A `test:int` command in the required DB lane.

**Acceptance Criteria:**

- Given the approved local fixture profile, when the measured Admin-users projection or synthetic permission calculation crosses its p95 ceiling, then the result records the violation and CI fails after cleanup.
- Given a complete measured read performs four authenticated RLS requests, when the assessment runs, then it fails; a count of three passes.
- Given a unit or database child process, including a package-manager descendant, exceeds its ceiling, when CI invokes the wrapper, then the process tree is terminated and the step fails; exits before the ceiling retain their original failure status.
- Given Playwright test attempts total more than five minutes, when browser execution completes, then CI fails while production build and web-server bootstrap remain outside that budget.

## Design Notes

The database budget measures the retained Phase A `test:int` command plus the explicit real R-1108 pilot probe after the existing local stack and migration reset have completed. The probe is not a `test:*` package script, so it cannot retrospectively be recorded as a Phase A gate. The browser budget is reporter-based because the production server is intentionally started by Playwright; summing test attempts excludes that required bootstrap while still counting retries.

## Verification

**Commands:**

- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/nfr/epic-11-pilot-limits.test.ts tests/unit/scripts/verify/run-with-time-budget.test.ts tests/unit/support/ci-duration-budget.test.ts` -- approved-boundary and failure behavior passes.
- `pnpm typecheck` -- no TypeScript error in the reporter or evidence gate.
- `SUPABASE_TEST_REQUIRED=1 node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-11-r1108-baseline.ts` -- required real pilot measurement pass, with exact profile and actual counts recorded.

## Suggested Review Order

Author: Epic 11 pilot performance/CI-limit implementation author.
Refreshed against the final uncommitted working tree on `codex/epic-11-pilot-operations` (base `dc83665`).

### Real tenant-scoped performance boundary

The existing authenticated RLS workload remains the authority. It now seeds and asserts the exact two-tenant profile (including all 40 secondary-role members), assesses every approved local-pilot limit, records an ignored result before failing, and retains cleanup in `finally` so a regression cannot leak its disposable accounts.

- `scripts/nfr/epic-11-pilot-limits.ts:4` — `EPIC11_PILOT_LIMITS`: defines the sole approved profile and measurement ceilings.
- `scripts/nfr/epic-11-pilot-limits.ts:68` — `assessEpic11PilotFixtureProfile`: rejects an incomplete role distribution before the timed measurements begin.
- `scripts/nfr/epic-11-r1108-baseline.ts:109` — `seedAdminSecondaryRole`: makes the built-in Tenant A admin the first of the 40 every-third secondary-role holders.
- `scripts/nfr/epic-11-r1108-baseline.ts:122` — `assertExactPilotFixture`: verifies 120/24 membership counts, five even primary-role groups, 40 secondary-role members, and 160 assignments.
- `scripts/nfr/epic-11-r1108-baseline.ts:205` — `assessment`: assesses the measured p95 values and authenticated request count before writing the local result.
- `scripts/nfr/epic-11-r1108-baseline.ts:262` — `Epic 11 pilot performance gate failed`: fails CI only after the private result is persisted.

### Execution-only CI budgets

Unit and DB lanes use a terminating process-tree budget after installs and setup. The database lane retains `test:int` as the Phase A command and invokes the NFR probe directly in the same 300-second wrapper, avoiding a false claim that the new probe historically passed Phase A. Browser accounting runs inside Playwright and sums test attempts, leaving its configured production build and web-server bootstrap outside the approved browser ceiling.

- `scripts/verify/run-with-time-budget.mjs:36` — `treeTerminationCommand`: uses Windows `taskkill /T` while Linux signals the detached process group.
- `scripts/verify/run-with-time-budget.mjs:70` — `runWithTimeBudget`: retains child exit failures and terminates an overrun with its descendants.
- `.github/workflows/ci.yml:96` — `run-with-time-budget.mjs`: wraps the unit runner with its 180-second ceiling.
- `.github/workflows/ci.yml:190` — `Integration, RLS, and Epic 11 pilot performance gates`: applies one 300-second database budget to the retained `test:int` gate and direct NFR probe.
- `playwright.config.ts:37` — `ci-duration-budget-reporter.ts`: enables the five-minute test-attempt budget only in CI.
- `tests/e2e/ci-duration-budget-reporter.ts:25` — `onEnd`: converts an otherwise completed browser run to failure when accumulated attempts exceed the ceiling.

### Boundary evidence

The focused unit assertions cover equality, over-budget values, invalid metrics, argument validation, child failure preservation, termination, and browser-duration failure behavior. The required database lane executes the actual local workload rather than a mocked metric.

- `tests/unit/nfr/epic-11-pilot-limits.test.ts:40` — `Epic 11 pilot fixture profile requires all 40 third-member secondary roles`: proves a 39-member distribution fails.
- `tests/unit/scripts/verify/run-with-time-budget.test.ts:58` — `time-budget runner terminates a command tree`: proves the Linux CI process-group behavior with a real grandchild and pins the Windows `taskkill /T` contract.
- `tests/unit/scripts/verify/epic-11-pilot-ci-gate.test.ts:8` — CI structure test keeps `test:int` visible and forbids the false historical `test:int:pilot` gate.
- `tests/unit/support/ci-duration-budget.test.ts:9` — `CI duration budget fails a late browser test attempt`: pins the strict greater-than boundary.

Evidence: focused unit tests passed 12/12 and `pnpm typecheck` passed. The required local pilot probe ran with `SUPABASE_TEST_REQUIRED=1` and passed the exact 120/24 profile assertion, with Admin-users p95 45.98ms, synthetic p95 2.00ms, and 3 authenticated RLS requests/read.

Evidence: the complete unit suite passed 1,778 tests / 0 failed / 0 skipped in 4.61s. Focused ESLint passed for every changed lintable TypeScript/JavaScript file. Full repository lint cannot traverse the BMAD render directory (`EPERM`). The local gate is not a production capacity, full-page, coverage, or duplication assertion.
