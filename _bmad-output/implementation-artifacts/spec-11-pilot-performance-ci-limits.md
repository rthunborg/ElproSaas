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

Bounded query/fix-author refresh: `/root/kernel_fix`, `gpt-6.1-sol` High, 2026-10-08, over `765ee0f35ac02766dfb324d03f3a20adc40b5d58`. Original implementation attribution and evidence remain historical. This approved successor meets the unchanged three-request ceiling alongside ADR-B012's shared50-ID cap; frozen intent, thresholds, profile, budgets, status and prior history remain unchanged.

### Real tenant-scoped performance boundary

The existing authenticated RLS workload remains the authority. It now seeds and asserts the exact two-tenant profile (including all 40 secondary-role members), assesses every approved local-pilot limit, records an ignored result before failing, and retains cleanup in `finally` so a regression cannot leak its disposable accounts.

- `scripts/nfr/epic-11-pilot-limits.ts:4` — `EPIC11_PILOT_LIMITS`: defines the sole approved profile and measurement ceilings.
- `scripts/nfr/epic-11-pilot-limits.ts:68` — `assessEpic11PilotFixtureProfile`: rejects an incomplete role distribution before the timed measurements begin.
- `scripts/nfr/epic-11-r1108-baseline.ts:109` — `seedAdminSecondaryRole`: makes the built-in Tenant A admin the first of the 40 every-third secondary-role holders.
- `scripts/nfr/epic-11-r1108-baseline.ts:122` — `assertExactPilotFixture`: verifies 120/24 membership counts, five even primary-role groups, 40 secondary-role members, and 160 assignments.
- `scripts/nfr/epic-11-r1108-baseline.ts:205` — `assessment`: assesses the measured p95 values and authenticated request count before writing the local result.
- `scripts/nfr/epic-11-r1108-baseline.ts:262` — `Epic 11 pilot performance gate failed`: fails CI only after the private result is persisted.

### Full tenant-role paging meets both existing contracts

The complete Admin catalogue now pages its authenticated RLS child stream by resolved tenant instead of repeating50-ID URL batches. Stable membership_id/role ordering, visible-root Set intersection, scalar fallback/no-child-query for empty valid roots, and generic rows[] on every page error preserve its existing authority/output contract. The shared50-ID cap and pilot≤3request ceiling are both unchanged.

- `src/features/admin-users/read-model.ts:47` — `visibleMembershipIds`: restricts role projection to visible root identities.
- `src/features/admin-users/read-model.ts:57` — `eq("tenant_id", tenantId)`: retains explicit current-tenant child scope under RLS.
- `src/features/admin-users/read-model.ts:61` — `pageResult.error`: refuses all partial authority after any page failure.
- `tests/unit/admin-users/read-pagination.test.ts:141` — `101-root later child page failure`: proves later-page failure after500successful child rows.
- `tests/unit/admin-users/read-pagination.test.ts:185` — `120-member 160-role pilot`: models the unchanged pilot in exactly two reads.
- `tests/integration/rls/admin-users-current-tenant-counts.rls.test.ts:78` — `worker own-child RLS`: proves actual helper own-child/foreign isolation and retained route denial when executed.

### Execution-only CI budgets

Unit and DB lanes use a terminating process-tree budget after installs and setup. The database lane retains `test:int` as the Phase A command and invokes the NFR probe directly in the same 300-second wrapper, avoiding a false claim that the new probe historically passed Phase A. Browser accounting runs inside Playwright and sums test attempts, leaving its configured production build and web-server bootstrap outside the approved browser ceiling.

- `scripts/verify/run-with-time-budget.mjs:36` — `treeTerminationCommand`: uses Windows `taskkill /T` while Linux signals the detached process group.
- `scripts/verify/run-with-time-budget.mjs:70` — `runWithTimeBudget`: retains child exit failures and terminates an overrun with its descendants.
- `.github/workflows/ci.yml:96` — `run-with-time-budget.mjs`: wraps the unit runner with its 180-second ceiling.
- `.github/workflows/ci.yml:190` — `Integration, RLS, and Epic 11 pilot performance gates`: applies one 300-second database budget to the retained `test:int` gate and direct NFR probe.
- `playwright.config.ts:43` — `ci-duration-budget-reporter.ts`: enables the five-minute test-attempt budget only in CI.
- `tests/e2e/ci-duration-budget-reporter.ts:25` — `onEnd`: converts an otherwise completed browser run to failure when accumulated attempts exceed the ceiling.

### Boundary evidence

The focused unit assertions cover equality, over-budget values, invalid metrics, argument validation, child failure preservation, termination, and browser-duration failure behavior. The required database lane executes the actual local workload rather than a mocked metric.

- `tests/unit/nfr/epic-11-pilot-limits.test.ts:40` — `Epic 11 pilot fixture profile requires all 40 third-member secondary roles`: proves a 39-member distribution fails.
- `tests/unit/scripts/verify/run-with-time-budget.test.ts:58` — `time-budget runner terminates a command tree`: proves the Linux CI process-group behavior with a real grandchild and pins the Windows `taskkill /T` contract.
- `tests/unit/scripts/verify/epic-11-pilot-ci-gate.test.ts:8` — CI structure test keeps `test:int` visible and forbids the false historical `test:int:pilot` gate.
- `tests/unit/support/ci-duration-budget.test.ts:9` — `CI duration budget fails a late browser test attempt`: pins the strict greater-than boundary.

Evidence: focused unit tests passed 12/12 and `pnpm typecheck` passed. The required local pilot probe ran with `SUPABASE_TEST_REQUIRED=1` and passed the exact 120/24 profile assertion, with Admin-users p95 45.98ms, synthetic p95 2.00ms, and 3 authenticated RLS requests/read.

Evidence: the complete unit suite passed 1,778 tests / 0 failed / 0 skipped in 4.61s. Focused ESLint passed for every changed lintable TypeScript/JavaScript file. Full repository lint cannot traverse the BMAD render directory (`EPERM`). The local gate is not a production capacity, full-page, coverage, or duplication assertion.

### Bounded successor author evidence — 2026-10-08

Fresh `765ee0f35ac02766dfb324d03f3a20adc40b5d58` run37783736560 executes REQUIRED integration1477total/1476passed/0failed/1preservedskip in207.67s, then the unchanged pilot fails because4authenticated requests exceed3; the combined step took216.00s. The old query reads one membership page plus three50/50/20-ID child batches for120memberships. ADR-B012 approved shared50-ID reliability but no pilot threshold amendment; this successor therefore optimizes that complete tenant catalogue while retaining all existing contracts. Frozen AskFirst threshold rules are not bypassed and no threshold/fixture/latency/time budget is changed.

Author focused pagination units pass10/0failed/0skipped,native0,202.5633ms; focused lint/typecheck/whitespace checks pass native0. Original501roots×5roles and51roots×5roles are preserved; the51fixture now tests first-child failure while a new literal101×5fixture proves actual later-page failure after500children. Exact500boundary, empty/invalid roots, absent-root children and full120/160projection in two modeled reads are covered. Source inspection verifies composite FK/forced RLS/unchanged route capability gate; actual runtime is separately attributed below. [This fix author's current evidence and verified stops](../../docs/quality/epic14-admin-pilot-closeout-2026-10-08.md) retain the failed pilot separately from passed integration and distinguish model/source/runtime evidence. No source service-role, grant, schema/cache/env, official completion, frozen intent/frontmatter/status or prior author/history change.

Parent's current complete three-file REQUIRED RLS/read-model pack passes11total/11passed/0failed/0skipped,native0,16.510s, including actual worker own-role/other/foreign controls and the retained multi-tenant Admin proof. Whole units pass2159total/2158passed/0failed/1preserved Windows xattr skip,native0,10.181s. The unchanged live pilot passes native0: exact120/24/five evenly distributed primary roles/40secondary holders/160TenantA assignments asserted,5warmups/25measured reads,50total requests=2/read (25membership+25role pages), Admin p9529.9952ms≤250/synthetic p952.9717ms≤25, violations[]. Harness3868.645ms is separate from projection latency. Author read-only inspection of `admin-pilot-current.json` confirms dirty working-tree base765ee0f35ac02766dfb324d03f3a20adc40b5d58; source/unit/RLS hashes and separately attributed High no-findings source review are retained in the linked author record. Post-pack SQL reports0editor markers/3hooks. Parent's final production build passes native0 (`build-admin-pilot-final.log`); after consumers finished, the parent-owned guard Stop was accepted as stop_requested/verifiedfalse with saved state preserved, without claiming verified shutdown. This is local retained-stack projection evidence, not reset/hosted/full-page/production-capacity or broader Epic14 performance acceptance. Final author-trail review/fresh five-job CI remain pending; no skipped case is coverage and the earlier765pilot4>3failure remains preserved. This author ran no runtime/resource/Git/state operation.
