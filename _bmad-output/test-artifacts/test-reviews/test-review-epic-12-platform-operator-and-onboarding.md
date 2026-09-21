---
workflowType: 'testarch-test-review'
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: '2026-09-21'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - 'C:/Users/Rasmus/.agents/skills/bmad-testarch-test-review/resources/tea-index.csv'
  - 'C:/Users/Rasmus/.agents/skills/bmad-testarch-test-review/resources/knowledge/{test-quality,data-factories,test-levels-framework,selective-testing,test-healing-patterns,selector-resilience,timing-debugging,overview,api-request,network-recorder,auth-session,intercept-network-call,recurse,log,file-utils,burn-in,network-error-monitor,fixtures-composition,playwright-cli}.md'
  - '_bmad-output/implementation-artifacts/spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md'
  - '_bmad-output/implementation-artifacts/spec-12-2-operator-console.md'
  - '_bmad-output/implementation-artifacts/spec-12-3-first-admin-onboarding-checklist.md'
reviewScope: 'authoritative Epic 12 29-file test suite'
executionMode: 'bounded local fallback (four worker slots unavailable while concurrent epic NFR/security audits were active)'
---

# Test Quality Review: Epic 12 — Platform Operator, Console, and First-Admin Onboarding

**Quality Score**: 96/100 (A — Good)

**Review Date**: 2026-09-21  
**Review Scope**: supplied authoritative 29-file suite  
**Reviewer**: BMad TEA Agent

This is a construction-quality audit. It does not score coverage or replace the independent Epic 12 trace result (24/24 FULL after `2a021bf12f2474bc01a369eba84e9bce67e31d3d`). The three story specifications were context only and did not waive findings.

## Executive Summary

**Overall Assessment**: Good  
**Recommendation**: Request Changes (advisory)

### Key Strengths

✅ The 92 discovered test cases have no focused tests, serial suite declarations, or `waitForTimeout` calls. Browser interaction uses role/label locators and condition-based Playwright assertions.

✅ Database tests consistently create scoped fixtures and clean them in `finally` or suite teardown. The operator factory handles partial provisioning failures with nested `finally` cleanup, and the RLS/read-model suites use required-stack gates rather than passing as if an unavailable database had executed.

✅ Tests make the security properties observable: generic denials, foreign-row non-disclosure, no-effect checks, immutable safe DTOs, fixed checklist predicates, and persisted dismissal audit metadata are asserted directly.

### Key Weaknesses

❌ Epic 12 grew `tests/e2e/global-setup.ts` from 927 to 1,016 lines, crossing the project’s 1,000-line support-file ceiling.

❌ Most new Story 12.3 tests use only a priority marker and prose title, so their stable story/level identifiers are inconsistent with the Epic 12.1 and 12.2 test inventory.

### Summary

The suite uses suitable levels: pure contract/predicate checks stay in fast unit tests; RLS, RPC, and read-model boundaries run against the local stack; and the two browser flows cover the operator and dashboard affordances. Live time and entropy occur only in fixture identity generation, expiry-boundary construction, or cryptographic expiry tests; no assertion depends on an exact wall-clock value. The recorded evidence is consistent with that design: focused unit, required integration/RLS, and production-browser runs passed with no skips where required.

The recommendation is advisory because the findings concern test maintainability and trace navigation, not a demonstrated application, authorization, tenant-isolation, or data-integrity defect. No remediation was performed by this audit.

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
| --- | --- | ---: | --- |
| BDD / behavioral titles | ✅ PASS | 0 | Assertions are described in observable terms; Given/When comments clarify the browser and RLS paths. |
| Test IDs | ⚠️ WARN | 1 | Story 12.3 IDs are inconsistent across its newly added tests. |
| Priority markers | ✅ PASS | 0 | All discovered executable tests carry `[P0]`, `[P1]`, or `[P2]`. |
| Disabled or focused tests | ✅ PASS | 0 | No `.only`; stack gates are explicit infrastructure skips. |
| Hard waits | ✅ PASS | 0 | No `waitForTimeout`, sleep, or interval polling. |
| Determinism | ✅ PASS | 0 | Time/entropy uses are deliberate fixture or expiry inputs, not exact-value assertions. |
| Isolation and cleanup | ✅ PASS | 0 | Scoped fixture creation plus `finally`/teardown prevents cross-test state coupling; Playwright is configured for one worker because it intentionally shares its global fixture. |
| Fixture patterns | ✅ PASS | 0 | Operator and tenant factories create real authenticated/RLS boundaries and clean partial failures. |
| Data factories | ✅ PASS | 0 | UUID-backed data and typed fixture helpers avoid parallel identity collisions. |
| Network-first / selector resilience | ✅ PASS | 0 | E2E tests use semantic locators and assertion-driven readiness; no fragile class selectors or fixed sleeps. |
| Explicit assertions | ✅ PASS | 0 | Test bodies assert observable DTO, DOM, error, audit, and no-effect outcomes. |
| Test length | ❌ FAIL | 1 | Epic 12 pushed the shared global setup past the enforced 1,000-line support-file limit. Individual test bodies remain below the 300-line guideline. |
| Test duration and flakiness | ✅ PASS | 0 | No new duration risk was identified from static review; existing recorded focused browser evidence passed. |

**Total Violations**: 0 Critical, 1 High, 1 Medium, 0 Low

## Quality Score Breakdown

| Dimension | Weight | Score | Rationale |
| --- | ---: | ---: | --- |
| Determinism | 30% | 100 | No hard waits, accidental wall-clock assertions, or unbounded test-order dependency. |
| Isolation | 30% | 100 | The serial browser setting is intentional and cleanup remains scoped to the generated fixture. |
| Maintainability | 25% | 85 | One over-limit setup file and one story-level identifier consistency gap. |
| Performance | 15% | 100 | No repeated navigation/setup anti-pattern or hard wait was identified in the reviewed additions. |

Weighted score: `100×0.30 + 100×0.30 + 85×0.25 + 100×0.15 = 96.25`, rounded to **96/100 (A)**.

## Critical Issues (Must Fix)

No critical issues detected. ✅

## Recommendations (Should Fix)

### 1. Split the now-over-limit Playwright global setup

**Severity**: P1 (High)  
**Location**: `tests/e2e/global-setup.ts:1`  
**Criterion**: Test length / maintainability

The Epic 12 additions increase this shared setup from 927 to 1,016 lines. It now owns baseline fixture creation plus operator allow-listing, console handoff state, onboarding state, and the existing cross-epic browser seeds. The project’s prior TEA review treats 1,000 lines as the absolute support-file ceiling.

Extract the Epic 12 seed responsibilities into a focused fixture helper (for example, operator/onboarding browser seeds) and retain a short global setup coordinator. This makes failures in the platform and onboarding setup easier to locate without changing the runtime fixtures.

### 2. Give Story 12.3 tests stable IDs

**Severity**: P2 (Medium)  
**Locations**: `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts:8`; `tests/integration/read-models/onboarding-checklist.int.test.ts:109`; `tests/integration/rls/onboarding-checklist.rls.test.ts:4`; `tests/unit/onboarding/checklist-state.test.ts:11`; `tests/unit/onboarding/onboarding-actions.test.ts:9`  
**Criterion**: Test IDs / trace navigation

The Story 12.1 and 12.2 tests consistently use identifiers such as `12.1-INT-003` and `12.2-E2E-001`, while most Story 12.3 tests have only `[P0]` plus prose. The current trace still passed, so this is not a coverage finding. It does make a future failure harder to map to the Story 12.3 acceptance and RLS cases.

Add the established stable IDs to the affected Story 12.3 test titles while retaining the existing behavioral prose.

## Best Practices Found

1. **Scoped failure-safe provisioning fixture** — `tests/factories/platform-operators.ts:579` cleans provisioned tenant, Auth user, and operator fixture state even when a setup step fails. This is a strong reference for integration fixtures that cross database and Auth boundaries.

2. **No-existence-disclosure assertions** — `tests/integration/read-models/onboarding-authorization-boundaries.int.test.ts:104` compares active-non-admin and anonymous results and verifies zero mutation, rather than merely checking one denial code.

3. **Server-derived browser state** — `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts:8` reloads after dismiss and restore, then changes an existing fact and verifies both onboarding affordances disappear. It avoids treating local browser state as authoritative.

4. **Stateful security test cleanup** — `tests/integration/rls/security-definer-search-path.rls.test.ts:126` makes the hostile search-path setup observable while suite teardown removes the temporary schema and tenant fixture.

## Test File Analysis

| Group | Files | Cases | Framework / role |
| --- | ---: | ---: | --- |
| Browser | 4 | 6 | Playwright E2E plus global setup/teardown; semantic UI assertions against the production server configuration. |
| Factories and support | 4 | 0 | Typed test data, tenant/role harness, and environment gates. |
| Integration, RLS, and read-model | 13 | 47 | Vitest against local Supabase authorization, RPC, migration, and read-model boundaries. |
| Unit and static checks | 8 | 39 | Node strip-types pure contracts, manifest rules, and static operator-surface checks. |
| **Total** | **29** | **92** | Full-stack Epic 12 quality scope. |

Large support files are evaluated as support code rather than individual test bodies. `tests/integration/rls/tenant-table-inventory.ts` is 1,862 lines but predates this epic’s small inventory update; it is recorded as context, not counted as an Epic 12-introduced quality finding.

## Context and Recorded Execution Evidence

- **Story context**: the three supplied Epic 12 specifications were read only to understand intended operator, console, and onboarding behaviors.
- **Trace boundary**: traceability and coverage are out of scope. The supplied independent trace result was 24/24 FULL after `2a021bf12f2474bc01a369eba84e9bce67e31d3d`.
- **Recorded verification reused**: the Story 12.3 record reports focused units 8/8, required RLS/read-model integration 10/10 with zero skips, and production onboarding browser E2E 1/0/0; it also records clean production build and scope/lint checks. This audit did not rerun those checks because it found no concrete execution concern requiring another resource-backed run.
- **Utility applicability**: configured Playwright/Pact utility packages are not present in the repository dependencies and no Pact tests are in the review set. Their adoption rows are therefore N/A and carry no deduction.

## Next Steps

### Immediate actions

1. Split the Epic 12 portions of the global E2E seed into a focused helper. Priority: P1. Owner: implementation author. Estimated effort: small refactor.

2. Add stable Story 12.3 IDs to the identified test titles. Priority: P2. Owner: implementation author. Estimated effort: mechanical cleanup.

### Follow-up actions

No coverage work is requested by this review. Route any coverage question to the completed trace workflow.

### Re-review Needed?

⚠️ A narrow re-review of the two maintainability changes is appropriate if they are taken before merge. The present audit does not require rerunning the broad implementation review.

## Decision

**Recommendation**: Request Changes (advisory)

**Rationale**: The runtime tests have strong deterministic, isolation, and assertion practices, and no critical reliability issue was found. The new global setup crosses an existing maintainability ceiling, and Story 12.3 title identifiers should match the established Epic 12 trace convention. Addressing those two items improves future diagnosis without changing product behavior.

## Follow-up Resolution — 2026-09-21

This is a narrow follow-up to the two advisories above. It does not replace the
original 96/100 score, Request Changes recommendation, scope, or findings at
the time of the original audit, and it does not rescore the suite.

### Resolution evidence

1. **Global setup length — resolved.** At frozen commit
   `fa76fedea678bd0455fce15906eb4c127da5f848`, the Epic 12 browser seed moved
   from `tests/e2e/global-setup.ts` into the focused
   `tests/e2e/seed-epic-12-browser-fixtures.ts` helper. The coordinator is now
   959 lines, below the 1,000-line support-file ceiling; the new helper is 88
   lines. The coordinator imports and invokes the helper, while the existing
   global fixture remains responsible for cleanup. This closes the P1
   maintainability advisory without changing browser fixture ownership.

2. **Story 12.3 stable IDs — resolved.** The affected Story 12.3 executable
   tests now use the established stable format across all levels: eight
   `12.3-UNIT-*`, eight `12.3-INT-*`, five `12.3-RLS-*`, and one
   `12.3-E2E-*` identifier. The amended locations include the checklist unit,
   action, read-model, journey, migration-reset, RLS, and browser suites. This
   closes the P2 trace-navigation advisory; behavioral prose and priority
   markers remain intact.

### Follow-up verification

- The implementation follow-up reported main units: 1,836 passed, zero failed,
  and one existing explicit skip; focused lint: zero errors and two existing
  warnings.
- Clean-checkout verification at
  `ef1885a53f4aa00b56cde5be08430610cb3094e3`, reported as the same code as the
  frozen commit above apart from root report/state changes, passed typecheck;
  lint for 50 changed TypeScript/TSX files with zero errors and seven existing
  warnings; the required Story 12.3 DB group (five files, 13 passed, zero
  failed, zero skipped); 14 static chunk references with zero missing; and the
  operator-console/onboarding E2E group (six passed, zero failed, zero skipped).
  The E2E resource-guard stop was requested after the run.

### Current follow-up recommendation

Both named test-quality advisories are closed. No further Request Changes item
remains within this follow-up's limited scope. This resolution does not replace
the independent trace, NFR, CI, or final full-diff review gates, and it makes no
claim about checks outside the reported evidence.

## Final follow-up amendment — 2026-09-21

The original 96/100 score, advisory Request Changes recommendation, and
historical findings are preserved. This amendment records final closure; it
does not rescore the suite or restart a broad review.

The two test-quality advisories are closed: the Epic 12 browser seed extraction
keeps `global-setup.ts` below the 1,000-line ceiling while preserving fixture
ordering and teardown ownership, and the Story 12.3 test titles now carry
stable level IDs. The independent in-app Luna/xhigh full Epic 12 review found
four separate actionable issues. Its focused closure reviewed the repairs with
zero new findings or regressions. The two test-harness findings are closed by
the validator-backed browser identity generator and tenant-scoped provisioning
cleanup regression. The two production findings are closed by the
organisation-number and concurrent idempotency repairs; the validator
adjudication is intentionally narrower than the original claim, recording
false rejection of valid legal-entity numbers rather than admission of ordinary
personnummer-shaped values.

Final CI run `35631411549` passed at source
`6edbd2d9021310b202ab0e4fc828522d4bcf20b5`: units 1,838/0/0; required DB/RLS
1,078/0/1; browser 144/0/4; and recovery storage-loader 1/0/0. Skips are
explicit and excluded from coverage. CI executed the new concurrent
same-request-ID/different-content `IDEMPOTENCY_CONFLICT` regression and the
scoped provisioning-cleanup regression, both passing.

The executed local `12.X-PERF-001` baseline remains non-gating NFR evidence.
It neither changes this test-quality score nor supplies a production numeric
target, capacity result, or production-enablement proof.

## Appendix

### Violation Summary by Location

| Location | Severity | Criterion | Issue | Suggested fix |
| --- | --- | --- | --- | --- |
| `tests/e2e/global-setup.ts:1` | P1 | Test length | Epic additions took shared setup to 1,016 lines. | Extract operator/onboarding seed helper. |
| Story 12.3 test locations listed above | P2 | Test IDs | Stable IDs are missing from most newly added Story 12.3 tests. | Add `12.3-<LEVEL>-<NNN>` title IDs. |

### Related Reviews

| Review | Result | Relationship |
| --- | --- | --- |
| Epic 12 trace | 24/24 FULL | Independent coverage/acceptance gate; not rescored here. |
| Epic 12 NFR audit | Concurrent | Separate artifact owner; not read or modified by this audit. |

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)  
**Workflow**: testarch-test-review v4.0  
**Review ID**: test-review-epic-12-20260921  
**Timestamp**: 2026-09-21  
**Version**: 1.0
