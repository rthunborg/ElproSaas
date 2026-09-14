---
workflowType: 'testarch-test-review'
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-09-11'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '.agents/skills/bmad-testarch-test-review/resources/tea-index.csv'
  - '.agents/skills/bmad-testarch-test-review/resources/knowledge/{library-integration-mandate,playwright-utils-mandate,test-quality,data-factories,test-levels-framework,selective-testing,test-healing-patterns,selector-resilience,timing-debugging,fixture-architecture,network-first}.md'
  - '_bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md'
  - '_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - '_bmad-output/implementation-artifacts/spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md'
---

# Test Quality Review: Epic 11 Wave B1a RBAC

**Quality Score**: 75/100 (C - Acceptable)
**Review Date**: 2026-09-11
**Review Scope**: supplied authoritative 14-file suite
**Reviewer**: BMad TEA Agent

This is a construction-quality audit, not coverage analysis; use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Needs Improvement

**Recommendation**: Request Changes

**Context Basis**: pr_diff

**Context Waivers Applied**: 0

### Key Strengths

✅ No disabled/focused tests, hard waits, tautologies, assertion-free test bodies, mock-self assertions, or unawaited async work were found.

✅ Integration/RLS tests explicitly clean up state, and unavailable-stack guards call `ctx.skip` instead of passing vacuously.

✅ The role harness uses generated role-by-obligation assertions and explicit denied-command checks.

### Key Weaknesses

❌ A live-clock retry scheduling fixture can vary at date boundaries.

❌ Two support files exceed the registry’s absolute 1,000-line ceiling.

❌ Two browser specs navigate to data-dependent Roles content without a pre-navigation readiness signal.

### Summary

The supplied specs establish a server-authoritative five-role matrix, lifecycle-safe role presentation, generic denials, and a generated role-by-table/command harness. The reviewed tests are aligned with that work. The audit found three concrete reliability/maintainability HIGH findings, four MEDIUM findings, and two LOW naming findings. The recommendation is computed from the fixed registry ledger: any HIGH finding is **Request Changes**.

The convention baseline sampled 40 of 297 files outside the review set (308 test files total): priority markers 20/40, test IDs 27/40, behavioral naming 40/40, fixtures 40/40, assertion style 40/40, network-first 1/40, data factories 13/40, and Playwright Utils 0/40. The configured Playwright/Pact utility packages are absent, so their per-file adoption rows are closed and receive no deduction.

## Quality Criteria Assessment

| Criterion | Status | Violations | Basis | Notes |
| --- | --- | ---: | --- | --- |
| BDD Format | ⚠️ WARN | 2 | Convention: bddNaming (40 of 40 sampled) | Two names expose an implementation method. |
| Test IDs | ✅ PASS | 0 | Convention: testIds (27 of 40 sampled) | Browser locators use stable roles/labels. |
| Priority Markers | ✅ PASS | 0 | Convention: priorityMarkers (20 of 40 sampled) | Reviewed test cases use the established form. |
| Disabled or Focused Tests | ✅ PASS | 0 | Absolute | None found. |
| Hard Waits | ✅ PASS | 0 | Absolute | None found. |
| Determinism | ❌ FAIL | 1 | Applicability: time-bounded fixture | Live clock controls retry scheduling. |
| Isolation | ✅ PASS | 0 | Absolute | No H4/C5 violation. |
| Test Suite Structure | ⚠️ WARN | 2 | Absolute | Two unit files lack `describe` grouping. |
| Fixture Patterns | ✅ PASS | 0 | Applicability | No M2/M5 finding. |
| Data Factories | ✅ PASS | 0 | Applicability | No M2 finding. |
| Network-First Pattern | ⚠️ WARN | 2 | Applicability: data-dependent navigation | Two Roles specs lack a readiness signal. |
| Playwright Utils Adoption | ✅ PASS (n/a) | 0 | Run-level precondition closed | Flag enabled, package absent. |
| Pact.js Utils Adoption | ✅ PASS (n/a) | 0 | Run-level precondition closed | Package and Pact artifacts absent. |
| Explicit Assertions | ✅ PASS | 0 | Absolute + Applicability | No C3/C4/C6/M6 finding. |
| Test Length (≤1000 lines) | ❌ FAIL | 2 | Absolute | Two files exceed the ceiling. |
| Test Duration (≤1.5 min) | ⚠️ WARN | 2 | Applicability | Missing readiness may become timeout-driven. |
| Flakiness Patterns | ❌ FAIL | 3 | Absolute + Applicability | One clock dependency and two readiness gaps. |

**Total Violations**: 0 Critical, 3 High, 4 Medium, 2 Low

**Convention Baseline**: 40 test files sampled outside the review set

## Quality Score Breakdown

```
Starting Score:          100
Critical Violations:     -0 × 10 = -0
High Violations:         -3 × 5 = -15
Medium Violations:       -4 × 2 = -8
Low Violations:          -2 × 1 = -2

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +0
  Perfect Isolation:     +0
  All Test IDs:          +0
                         --------
Total Bonus:             +0

Final Score:             75/100
Grade:                   C
```

## Critical Issues (Must Fix)

No critical issues detected. ✅

## Recommendations (Should Fix)

### 1. Freeze the retry scheduling clock

**Severity**: P1 (High)  
**Location**: `tests/e2e/global-setup.ts:719`  
**Row**: H2  
**Criterion**: Determinism

`retryDueDate` derives from `Date.now()` plus 30 days. This concrete time-boundary dependency can seed a different schedule at a date boundary. Inject a fixed clock/instant into the fixture.

### 2. Split oversized support files

**Severity**: P1 (High)  
**Location**: `tests/e2e/global-setup.ts:1178`, `tests/factories/tenants.ts:2662`  
**Row**: H5  
**Criterion**: Test Length

The files are 1,178 and 2,662 lines respectively. Split setup/factory responsibilities by domain while retaining small public facades. This is a structural maintainability rule; it is not evidence of a current functional defect.

### 3. Register readiness before opening Roles

**Severity**: P2 (Medium)  
**Location**: `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts:41`, `tests/e2e/auth/role-catalogue-contract.e2e.spec.ts:39`  
**Row**: M1  
**Criterion**: Network-First Pattern

Both specs navigate to `/admin/users` and consume server-derived Roles content without a pre-navigation response/readiness signal. Register and await the relevant signal around the navigation.

### 4. Group unit-test subjects

**Severity**: P2 (Medium)  
**Location**: `tests/unit/server/authz/role-catalogue.test.ts:8`, `tests/unit/server/authz/role-harness.test.ts:7`  
**Row**: M4  
**Criterion**: Test Suite Structure

Add one `describe` block to each file. This is a diagnostic/organization heuristic, not a behavior failure.

### 5. Use behavior-shaped names

**Severity**: P3 (Low)  
**Location**: `tests/integration/commands/disabled-membership-no-access.int.test.ts:112`, `tests/integration/commands/server-error-vs-no-access.int.test.ts:135`  
**Row**: L5  
**Criterion**: BDD Format

Rename the tests around their observable outcomes, such as “an inactive membership is denied with TENANT_MEMBERSHIP_REQUIRED” and “a transient membership read error returns SERVER_ERROR.”

## Best Practices Found

- `tests/integration/rls/role-harness.atdd.int.test.ts:121` uses explicit `ctx.skip` before returning when infrastructure is unavailable; the supplied required integration evidence reports zero skips.
- `tests/integration/rls/role-harness.atdd.int.test.ts:145` asserts generated role-harness cardinality and explicit `PERMISSION_DENIED` outcomes.

## Context and Integration

The four supplied Story 11.1–11.4 specifications were read as context only. They corroborate the intended matrix, roles presentation, tenant isolation, and generated harness responsibilities; they did not waive or alter any quality finding. The separately recorded invitation-RPC identity-binding audit is out of this test-quality scope.

## Next Steps

1. Resolve H2, H5, and M1 findings, then re-run this advisory review. Priority: P1.
2. Consider the `framework` workflow if the enabled Playwright Utils flag is intended to become an installed project standard. Priority: P3.

## Decision

**Recommendation**: Request Changes

**Rationale**: The deterministic ledger yields 75/100. The live-clock fixture is a concrete reliability risk; the two oversized files are maintainability findings; the readiness and organization/naming items are advisory quality debt. No coverage decision or product behavior claim is made here.

## Appendix

| Location | Severity | Row | Issue | Fix |
| --- | --- | --- | --- | --- |
| `tests/e2e/global-setup.ts:719` | P1 | H2 | Live clock controls retry due date | Inject/freeze clock |
| `tests/e2e/global-setup.ts` | P1 | H5 | 1,178 lines | Split setup responsibilities |
| `tests/factories/tenants.ts` | P1 | H5 | 2,662 lines | Split factory domains |
| `tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts:41` | P2 | M1 | No pre-navigation readiness signal | Register then await readiness |
| `tests/e2e/auth/role-catalogue-contract.e2e.spec.ts:39` | P2 | M1 | No pre-navigation readiness signal | Register then await readiness |
| `tests/unit/server/authz/role-catalogue.test.ts:8` | P2 | M4 | Three ungrouped tests | Add describe block |
| `tests/unit/server/authz/role-harness.test.ts:7` | P2 | M4 | Four ungrouped tests | Add describe block |
| `tests/integration/commands/disabled-membership-no-access.int.test.ts:112` | P3 | L5 | Implementation-shaped name | Name observable denial |
| `tests/integration/commands/server-error-vs-no-access.int.test.ts:135` | P3 | L5 | Implementation-shaped name | Name observable result |

## Reviewed Files

- tests/e2e/auth/admin-user-management-roles.atdd.e2e.spec.ts
- tests/e2e/auth/role-catalogue-contract.e2e.spec.ts
- tests/e2e/global-setup.ts
- tests/factories/tenants.ts
- tests/integration/commands/audit-metadata-hygiene-e2e.int.test.ts
- tests/integration/commands/disabled-membership-no-access.int.test.ts
- tests/integration/commands/envelope-audit-write.int.test.ts
- tests/integration/commands/envelope-failure-modes.int.test.ts
- tests/integration/commands/server-error-vs-no-access.int.test.ts
- tests/integration/rls/admin-user-detail-isolation.rls.test.ts
- tests/integration/rls/role-harness.atdd.int.test.ts
- tests/support/authz/role-harness.ts
- tests/unit/server/authz/role-catalogue.test.ts
- tests/unit/server/authz/role-harness.test.ts

## Review Context

- _bmad-output/implementation-artifacts/spec-11-1-role-storage-and-permission-matrix-mechanism.md
- _bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md
- _bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md
- _bmad-output/implementation-artifacts/spec-11-4-roles-surface-effective-permissions-and-the-per-role-test-harness.md
