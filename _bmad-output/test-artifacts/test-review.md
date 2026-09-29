---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: 2026-09-24
workflowType: testarch-test-review
inputDocuments:
  - C:\DEV\ElproSaas\_bmad\tea\config.yaml
  - C:\DEV\ElproSaas\_bmad-output\implementation-artifacts\spec-13-1-authenticated-background-runner-and-producer-registry.md
  - C:\DEV\ElproSaas\_bmad-output\implementation-artifacts\spec-13-2-in-app-notifications-bell-center-and-preferences.md
  - C:\DEV\ElproSaas\_bmad-output\implementation-artifacts\spec-13-3-email-outbox-pipeline-queued-non-sending.md
  - C:\DEV\ElproSaas\_bmad-output\implementation-artifacts\spec-13-4-email-sending-activation.md
  - C:\Users\Rasmus\.agents\skills\bmad-testarch-test-review\resources\tea-index.csv
  - C:\Users\Rasmus\.agents\skills\bmad-testarch-test-review\resources\knowledge\test-quality.md
  - C:\Users\Rasmus\.agents\skills\bmad-testarch-test-review\resources\knowledge\data-factories.md
  - C:\Users\Rasmus\.agents\skills\bmad-testarch-test-review\resources\knowledge\test-levels-framework.md
  - C:\Users\Rasmus\.agents\skills\bmad-testarch-test-review\resources\knowledge\selector-resilience.md
  - C:\Users\Rasmus\.agents\skills\bmad-testarch-test-review\resources\knowledge\timing-debugging.md
reviewScope: suite (Epic 13 authoritative changed-test set, 41 files)
executionMode: headless / sequential fallback
---

# Test Quality Review: Epic 13 Jobs, Notifications, and Email

**Quality Score:** 87/100 (B — Good)
**Review Date:** 2026-09-24
**Review Scope:** The authoritative set of 41 Epic 13 changed or added test/support files supplied by the requester.
**Reviewer:** BMad TEA Agent

This review audits test quality only. It does not score coverage or make a coverage-gate decision; route those questions to `trace`.

## Executive Summary

**Overall assessment:** Good

**Recommendation:** Approve with comments

The suite has strong acceptance evidence at the appropriate levels: focused pure-unit checks, required integration/RLS proofs for database authority, and browser tests for user-facing behavior. It consistently avoids hard waits, uses semantic locators, keeps security negatives explicit, and uses controlled clocks in the jobs and email paths.

The main weaknesses are contained in shared E2E setup and one time-sensitive P0 unit test. Shared setup creates identifiers with `Date.now()`, `Math.random()`, and `randomInt`, which prevents a failed run from being reproduced from the same inputs. The previous-secret test marks a fixed 2026-10-01 expiry as future while production code reads the live clock, so it will become a false failure after that date.

### Key strengths

- Event-driven Playwright synchronization (`waitForResponse`, rendered-state assertions, and semantic locators); zero `waitForTimeout` or sleep calls in scope.
- Strong RLS and database-authority evidence, including concrete cross-tenant rows, vacuity guards, forced-RLS catalog checks, and direct trigger probes where application grants intentionally deny raw DML.
- Focused integration fixtures with fixed command clocks, unique record ownership, and `try/finally` cleanup in the new notification/email cases.
- Clear P0/P1/P2 priority labelling and acceptance-oriented names across the Epic 13 specifications.

### Key weaknesses

- Non-repeatable E2E seed IDs use the wall clock and random number generators.
- The auth rotation positive case has a calendar-expiring fixture.
- The shared global seed and RLS inventory are large enough to make fixture failures slower to diagnose; scanner test directories are not removed after use.

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
| --- | --- | ---: | --- |
| BDD / acceptance structure | ✅ PASS | 0 | Tests state user or authority behavior clearly; formal Given/When/Then text is not required for this TypeScript suite. |
| Test IDs | ⚠️ WARN | 0 | Epic 13 ATDD/RLS tests carry IDs; several inherited support and unit tests use descriptive names only. |
| Priority markers | ⚠️ WARN | 0 | Priority markers are strong in Epic 13 ATDD coverage; inherited support tests are intentionally unprioritized. |
| Hard waits | ✅ PASS | 0 | No `waitForTimeout`, sleep, or fixed delay was found. |
| Determinism | ⚠️ WARN | 4 | Two shared E2E seed files use random/current-time identifiers; one integration write uses real time; one auth fixture expires on the calendar. |
| Isolation and cleanup | ⚠️ WARN | 3 | Database cleanup is strong; temporary scanner-fixture roots remain after test runs. |
| Fixture and factory patterns | ✅ PASS | 0 | Two-tenant fixtures, factory helpers, direct DB authority paths, and explicit cleanup are appropriate for the security-sensitive scope. |
| Network-first pattern | ✅ PASS | 0 | The one fault-injection route is installed before its UI action; browser flows otherwise wait on durable UI or response events. |
| Explicit assertions | ✅ PASS | 0 | Assertions check persisted records, response boundaries, RLS errors, and durable UI results rather than implementation-only signals. |
| Test length | ⚠️ WARN | 3 | `global-setup.ts` (1,073 lines), `tenant-table-inventory.ts` (1,993), and `accepted-record-lock.int.test.ts` (782) are maintenance hotspots. |
| Test duration | ✅ PASS | 0 observed | No runtime measurement was run in this headless review. Static analysis found no fixed sleeps or unnecessary serial mode. |
| Flakiness patterns | ⚠️ WARN | 3 | The random/time seed inputs and calendar-expiring auth case are the credible future flake sources. |

**Total quality findings:** 0 critical, 2 high, 3 medium, 8 low.

## Quality Score Breakdown

| Dimension | Weight | Score | Grade |
| --- | ---: | ---: | --- |
| Determinism | 30% | 78 | C+ |
| Isolation | 30% | 94 | A- |
| Maintainability | 25% | 84 | B |
| Performance | 15% | 93 | A- |

`78 × 0.30 + 94 × 0.30 + 84 × 0.25 + 93 × 0.15 = 86.55`, rounded to **87/100 (B)**.

## Critical Issues

No P0 test-quality blocker was found. The following high-priority corrections should be made soon because they affect repeatability and the reliability of release evidence.

## Recommendations

### 1. Replace non-repeatable shared E2E fixture identifiers

**Severity:** P1
**Locations:** `tests/e2e/global-setup.ts:60`; `tests/e2e/seed-epic-12-browser-fixtures.ts:21`; `tests/e2e/seed-epic-12-browser-fixtures.ts:41`
**Criterion:** Determinism
**Knowledge base:** `test-quality.md`, `data-factories.md`

The global fixture token combines the live clock and `Math.random()`. The Epic 12 seed also derives organization numbers from `randomInt` and the current clock. This makes failed fixture state difficult to reproduce and has an unnecessary collision risk under rapid restart or concurrent execution.

Use a run UUID (or an injected deterministic seed) as the identifier source. Preserve the organization number check digit calculation, but derive its numeric input from the supplied fixture ID rather than a random generator.

```ts
function token(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
```

### 2. Make the previous-secret test independent of the calendar

**Severity:** P2
**Location:** `tests/unit/server/jobs/route-auth.test.ts:7`
**Criterion:** Determinism
**Knowledge base:** `test-quality.md`, `timing-debugging.md`

`isAuthorizedCronRequest` compares its rotation expiry to `new Date()` and the test calls a hard-coded `2026-10-01` value future. The positive test will fail after that day even if authorization behavior is unchanged.

Inject a clock into the authorization function (defaulting to the real clock in production) and pin it in tests, or build the test expiry relative to a controlled test time.

```ts
const now = new Date("2026-09-24T12:00:00.000Z");
assert.equal(
  isAuthorizedCronRequest(`Bearer ${previous}`, env, () => now),
  true,
);
```

### 3. Clean temporary containment-test roots

**Severity:** P3
**Locations:** `tests/unit/scripts/verify/email-provider-containment.atdd.test.ts:11`; `tests/unit/scripts/verify/jobs-service-role-containment.test.ts:9`
**Criterion:** Isolation
**Knowledge base:** `test-quality.md`, `data-factories.md`

The scanner bite tests correctly use unique `mkdtempSync` roots, so they do not share state. They leave those roots behind after each run. Remove the root in `finally` after the assertion.

### 4. Decompose the shared support hotspots when they are next changed

**Severity:** P3
**Locations:** `tests/e2e/global-setup.ts:1`; `tests/integration/rls/tenant-table-inventory.ts:1`; `tests/integration/commands/accepted-record-lock.int.test.ts:1`
**Criterion:** Maintainability
**Knowledge base:** `fixture-architecture.md`, `test-quality.md`

The contents are purposeful and well documented. Extracting Epic-specific seed modules and manifest-module inventory metadata would make failures and future changes easier to review without changing the underlying authority proofs.

### 5. Consolidate duplicated Playwright sign-in/hydration helpers

**Severity:** P3
**Locations:** Epic 13 notification E2E specifications
**Criterion:** Maintainability
**Knowledge base:** `fixture-architecture.md`, `selector-resilience.md`

The copies are consistent and use a good event-driven hydration pattern. A shared E2E helper or Playwright fixture would reduce maintenance when the authenticated entry flow changes.

## Best Practices Found

### Explicit authority evidence at the right test level

**Locations:** `tests/integration/rls/cross-tenant-isolation.rls.test.ts`; `tests/integration/email/email-delivery-activation.atdd.int.test.ts`; `tests/integration/rls/email-unsubscribe.atdd.rls.test.ts`

The suite seeds concrete foreign rows, verifies unchanged state after denied mutations, and uses direct database probes only where the database trigger is the load-bearing enforcement layer. It avoids treating a disabled UI control as evidence of a security invariant.

### Deterministic worker behavior tests

**Locations:** `tests/unit/server/jobs/runner.test.ts`; `tests/unit/server/jobs/route.test.ts`

The runner tests use injected dependencies, controlled tenant order, fixed timestamps, and explicit cursor assertions. The route test proves invalid credentials return before service-client construction or runner dispatch.

### Resilient browser assertions

**Locations:** `tests/e2e/notifications/notifications.atdd.e2e.spec.ts`; `tests/e2e/notifications/public-unsubscribe-email-activation.atdd.e2e.spec.ts`

The browser specifications use accessible roles, names, scoped list filters, event-based response waits, and durable post-action state. The deliberate fault-injection route is registered before the UI action and is removed before recovery assertions.

## Test File Analysis

The 41 files were all present, readable, and parsed: 5 Playwright specifications, 17 Vitest integration/RLS specifications, 17 Node unit specifications, and 2 E2E/support fixtures. The parsed source contains 176 named test cases plus data-driven role and terminal-state variants.

| Area | Files | Characteristics |
| --- | ---: | --- |
| E2E and fixture support | 7 | Semantic Playwright locators, real local-stack state, persistent-result assertions. |
| Command, email, jobs, notification integration | 9 | Two-tenant fixtures, injected clocks, `try/finally` cleanup, RLS and DB authority checks. |
| RLS and authorization support | 8 | Exhaustive manifest-derived table inventory and concrete cross-tenant canaries. |
| Unit and static guards | 17 | Fast pure checks, containment bite tests, registry and validation boundaries. |

Oversized shared modules are documented above. Individual focused Epic 13 browser/integration tests remain below the 300-line guidance, except where a mature shared RLS or lifecycle suite is deliberately parameterized.

## Context and Knowledge Base

The read-only acceptance context was:

- `spec-13-1-authenticated-background-runner-and-producer-registry.md`
- `spec-13-2-in-app-notifications-bell-center-and-preferences.md`
- `spec-13-3-email-outbox-pipeline-queued-non-sending.md`
- `spec-13-4-email-sending-activation.md`

The review used the TEA index plus `test-quality`, `data-factories`, `test-levels-framework`, `selector-resilience`, `timing-debugging`, applicable Playwright utility guidance, and email-auth guidance. No Pact/contract tests were in scope.

## Validation and Execution Notes

- All 41 requested paths were verified present and parsed for framework, size, structure, priorities, waits, control flow, fixtures, and interception patterns.
- Resolved headless mode excluded browser-session collection. No browser session was opened, so no browser cleanup was required.
- The configured `auto` worker mode fell back to sequential because all agent slots were already occupied by sibling workflow tasks. The required dimension results were written, parsed, and aggregated before this report was generated.
- Workflow JSON intermediates were temporary execution data. This report is the only durable review artifact.

## Next Steps

### Immediate follow-ups

1. Replace shared E2E random/clock identifiers with UUID or injected fixture-seed inputs. Priority: P1.
2. Stabilize the previous-secret expiry test with an injected or controlled clock. Priority: P2; it must be changed before 2026-10-01.

### Future maintenance

1. Add `finally` cleanup to scanner temporary-directory tests. Priority: P3.
2. Split the global E2E fixture, RLS inventory, and duplicated E2E authentication helpers when their next feature change requires it. Priority: P3.

### Re-review needed?

No re-review is required for merge on test-quality grounds. Re-run this review after the P1/P2 repeatability fixes if the team wants the score updated.

## Decision

**Recommendation:** Approve with comments

The Epic 13 test suite provides credible release evidence and has no hard-wait, selector, assertion, database-isolation, or containment-test blocker. The prioritized repeatability corrections are narrow and should be scheduled promptly; the calendar-expiring auth case has a known deadline.

## Appendix: Finding Summary

| Location | Severity | Criterion | Finding | Recommended fix |
| --- | --- | --- | --- | --- |
| `tests/e2e/global-setup.ts:60` | P1 | Determinism | `Date.now()` and `Math.random()` create shared fixture IDs. | UUID or injected deterministic seed. |
| `tests/e2e/seed-epic-12-browser-fixtures.ts:21` | P1 | Determinism | `randomInt` creates organization-number input. | Derive from run UUID/controlled seed. |
| `tests/e2e/seed-epic-12-browser-fixtures.ts:41` | P1 | Determinism | Date-derived organization number. | Derive from controlled identifier. |
| `tests/unit/server/jobs/route-auth.test.ts:7` | P2 | Determinism | Fixed future expiry becomes stale. | Inject/control time. |
| `tests/integration/notifications/notifications.atdd.int.test.ts:105` | P3 | Determinism | Real-time read marker is unnecessary. | Use a fixed timestamp. |
| `tests/unit/scripts/verify/email-provider-containment.atdd.test.ts:11` | P3 | Isolation | Temporary scanner roots persist. | Cleanup in `finally`. |
| `tests/unit/scripts/verify/jobs-service-role-containment.test.ts:9` | P3 | Isolation | Temporary scanner root persists. | Cleanup in `finally`. |
| `tests/e2e/global-setup.ts:1` | P3 | Maintainability/performance | Broad global seed. | Compose smaller epic seed modules. |
| `tests/integration/rls/tenant-table-inventory.ts:1` | P3 | Maintainability | Large centralized inventory. | Partition metadata by scope module. |
| `tests/integration/commands/accepted-record-lock.int.test.ts:1` | P3 | Maintainability/performance | Large lifecycle suite. | Split on next related change. |
| Epic 13 E2E sign-in helpers | P3 | Maintainability | Repeated fixture parsing/login/hydration. | Shared E2E helper or fixture. |

## Review Metadata

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-review`
**Review ID:** `test-review-epic-13-20260924`
**Execution mode:** Headless, sequential fallback
