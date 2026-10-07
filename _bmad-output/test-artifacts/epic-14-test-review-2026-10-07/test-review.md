---
workflowType: testarch-test-review
stepsCompleted: [step-01-load-context, step-02-discover-tests, step-03-quality-evaluation, step-03f-aggregate-scores, step-04-generate-report]
lastStep: step-04-generate-report
lastSaved: 2026-10-07
headless: true
inputDocuments:
  - C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md
  - C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md
  - C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md
  - C:/DEV/ElproSaas/_bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md
---

# Epic 14 Test Quality Review

**Quality Score**: 0/100 (F)
**Review Date**: 2026-10-07
**Review Scope**: Authoritative 85-file Epic 14 set from the supplied main...HEAD manifest.

## Executive Summary

**Overall Assessment**: Critical Issues (rubric grade F)
**Recommendation**: Request Changes
**Context Basis**: pr_diff
**Context Waivers Applied**: 0

All 85 supplied artifacts were examined: 60 TypeScript test-body files, two mirrored mechanical Python test files, 17 code helpers/fixtures, four golden JSON fixtures and two infrastructure configuration files. The 79 code/test artifacts have applicable ledger predicates; the six data/configuration artifacts were inspected as support and are explicitly unscorable. Helpers do not acquire a passing body score by having no tests. All four supplied approved story specs were read only and never reviewed, scored or used to waive findings.

The deterministic, unweighted run-level ledger yields **0/F and Request Changes**: 7 HIGH and 41 MEDIUM findings after deduplication. This number reflects complete-file structural findings across a large audit set as well as four consequential oracle/timing/isolation findings. It is not a coverage score, statistical flake rate, production defect count, release decision or BMAD review-round clearance. No Critical test that cannot fail was established.

### Key Strengths

- Actual resource and booking boundary assertions exercise checked commands/RPCs, concrete role/tenant fixtures, exact durable snapshots and attributable audit effects. The five new resource cases have recorded required execution.
- Concurrency tests observe database lock barriers; retained futures are awaited and settled in cleanup. Polling real conditions was distinguished from arbitrary hard waits.
- Mounted/browser and actual database evidence remains separate from structural/mocked helpers. Scope and calendar ownership transfers remain explicit.

### Key Weaknesses

- One finalize oracle chooses committed/stale expectations from the observed output.
- Invitation lifetime setup retains a cross-clock fixture and a two-second pre-barrier deadline.
- A shared quote-pipeline fixture creates order and standalone-test dependence.
- Three oversized files, 16 ungrouped suites, six deep nesting sites, 18 repeated domain-payload families and one navigation-readiness pattern fire the assigned structural rubric rows.

## Scope and Applicability

| Category | Examined | Scorable | Body credit |
|---|---:|---:|---|
| TypeScript test-body files | 60 | 60 | Actual registered bodies, no runtime invented |
| Mechanical Python routing copies | 2 | 2 | Mechanical tooling only; no product acceptance |
| Code helpers and fixtures | 17 | 17 | Only relevant code predicates; no body score by absence |
| Golden JSON fixtures | 4 | 0 | Supporting expected data, unscorable format |
| Env/Compose configuration | 2 | 0 | Supporting infrastructure, unscorable format |
| Total | 85 | 79 | Six explicit exclusions |

Every dimension retains a file-by-file applicability manifest covering all 85 paths. No missing/unparseable file was dropped. Source/metadata hashes and the complete measured baseline are in context.json. The requested review set was not widened to a suite or narrowed to a sample.

## Quality Criteria Assessment

| Criterion | Status | Violations | Basis | Notes |
|---|---|---:|---|---|
| BDD naming | PASS | 0 | Convention: bddNaming (40 of 40 sampled) | Assigned L5 found no drift; universal bonus not asserted |
| Stable test IDs | PASS (n/a) | 0 | Convention: testIds (0 of 40 sampled) | No test-ID convention; role/label satisfies selector row |
| Priority markers | Not scored | 0 | Convention: priorityMarkers (37 of 40 sampled) | L2 is not assigned by any installed dimension step; explicit workflow limitation |
| Disabled/focused/tautological/unreachable/no-assertion tests | PASS | 0 | Absolute | No C1-C6 firing predicate established; helpers not scored by body absence |
| Hard waits | PASS | 0 | Absolute | H1: observed bounded condition polls are not arbitrary ordering timers |
| Wall-clock fixtures | FAIL | 2 | Applicability: time-bounded invitation lifetime | H2 Node/DB clock fixture and pre-barrier short expiry |
| Conditional assertions | FAIL | 1 | Absolute | H3 output selects expected finalize kind |
| Shared mutable state | FAIL | 1 | Absolute | H4 pipeline fixture order/standalone dependency |
| Suite grouping | WARN | 16 | Absolute | M4 no subject grouping in files with at least three bodies |
| Repeated domain payloads | WARN | 18 | Applicability: constructs domain payloads | M2 excludes expected outputs and ordinary factory overrides |
| Nesting | WARN | 6 | Absolute | M7 exceeds three control blocks |
| Network-first | WARN | 1 | Applicability: navigates to data-dependent content | Resource browser missing prearmed signal; booking fixture preregisters real route |
| Awaited asynchronous effects | PASS | 0 | Absolute | M6 no floating effect established; implicit returns, future settlement and lazy builders accounted for |
| File length | FAIL | 3 | Absolute | H5 sole threshold >1000; includes two large supporting code files |
| Selectors/user-event | PASS or n/a | 0 | Applicability: DOM locators/installed user API | No assigned L1/M5 predicate established; CSS overflow had no available semantic alternative |
| Assertion dialect | PASS | 0 | Convention: assertionStyle (40 of 40 sampled) | Runner-specific dialect, aliases preserved |
| Playwright/Pact utilities | Disabled for run | 0 | Run precondition | Flags true, both packages absent; M9/M10/L9 do not exist for this run |
| Test duration | Not newly measured | 0 | Recorded runner evidence only | No independent duration row; 40.545s targeted body is not HTTP latency or universal performance proof |

**Total Violations**: 0 Critical, 7 High, 41 Medium, 0 Low
**Convention Baseline**: 40 test files sampled outside the review set

The outside-set corpus contains 369 files; the 40-file nearest-directory sample and exact hashes are retained in context.json. Other mechanical adoption signals: dataFactories 37/40, fixtures 35/40, networkFirst 0/40, playwrightUtils 0/40. The current rubric did not invent extra convention rows for these signals. Missing configured utility packages are one framework recommendation, never per-file deductions. Pact/Maestro artifacts are absent; no broker/browser action was needed.

## Quality Score Breakdown

```text
Starting Score:          100
Critical Violations:     -0 × 10 = -0
High Violations:         -7 × 5 = -35
Medium Violations:       -41 × 2 = -82
Low Violations:          -0 × 1 = -0

Bonus Points:
  Excellent BDD:         +0
  Comprehensive Fixtures: +0
  Data Factories:        +0
  Network-First:         +0
  Perfect Isolation:     +0
  All Test IDs:          +0
                         --------
Total Bonus:             +0

Final Score:             0/100
Grade:                   F
```

Unclamped arithmetic is 100−35−82=−17; the required max(0,min(100,...)) clamp gives 0. No universal positive bonus predicate was established across the complete artifact set; shared-state, payload, readiness and locator findings also preclude their corresponding bonuses. The recommendation is mechanically Request Changes because HIGH findings exist and the score is below 70; no context waiver or judgment adjustment applies.

## Dimension Results

| Dimension | Informational score | Findings before cross-dimension dedup | Execution |
|---|---:|---|---|
| determinism | 70/C | {'CRITICAL': 0, 'HIGH': 3, 'MEDIUM': 0, 'LOW': 0} | Independent context-free Sol 6.1 High child |
| isolation | 10/F | {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 16, 'LOW': 0} | Independent context-free Sol 6.1 High child |
| maintainability | 0/F | {'CRITICAL': 0, 'HIGH': 3, 'MEDIUM': 40, 'LOW': 0} | Independent context-free Sol 6.1 High child |
| performance | 65/D | {'CRITICAL': 0, 'HIGH': 3, 'MEDIUM': 1, 'LOW': 0} | Sequential capability fallback |

67 raw findings become 48 after merging the 16 shared M4 locations and three H5 file-level duplicates. Dimension scores use their worker weights and are informational; no average or per-file mean replaced the authoritative run ledger.

## Critical Issues (Must Fix)

No Critical rubric findings were established. No production authorization, tenant-isolation or transactional bypass is claimed by this audit.

## Recommendations (Should Fix)

### 1. H3 — conditional-assertion

**Severity**: P1 (High)
**Location**: `C:/DEV/ElproSaas/tests/integration/commands/booking-conflicts.int.test.ts:290`
**Row**: H3
**Criterion**: conditional-assertion
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The same work_role_upsert fixture accepts either committed or stale based on finalizeResult.kind. The observed result selects the oracle, so a regression that changes whether this specific writer invalidates detection facts can remain green.

**Evidence**: if (writer === "work_role_upsert" && finalizeResult.kind === "committed") { ... return; } ... expect(finalizeResult).toEqual({ kind: "stale" });

**Recommended improvement**: Split display-name-only and consumed-fact changes into named cases with fixed expected outcomes. Independently assert whether a fresh digest is equal or different and retain exact durable booking/assignee/conflict/outcome/audit checks.

```text
// Named display-name-only fixture, after independently proving unchanged digest:
expect(current.factDigest).toBe(snapshot.factDigest);
expect(finalizeResult).toEqual({ kind: "committed", bookingId: snapshot.bookingId });
// Separate consumed-fact mutation fixture:
expect(current.factDigest).not.toBe(snapshot.factDigest);
expect(finalizeResult).toEqual({ kind: "stale" });
```

### 2. H2 — wall-clock-fixture

**Severity**: P1 (High)
**Location**: `C:/DEV/ElproSaas/tests/support/booking-conflict-attestation.ts:186`
**Row**: H2
**Criterion**: wall-clock-fixture
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The invitation fixture supplies an expiry derived from the live Node clock, while the actual invitation RPC validates a PostgreSQL clock boundary. This is a security lifetime, not an opaque timestamp or diagnostic. Its one-hour margin reduces ordinary timing exposure but does not remove the uncontrolled cross-clock dependency.

**Evidence**: p_token_hash: tokenHash, p_expiry: new Date(Date.now() + 3600_000).toISOString()

**Recommended improvement**: Derive the initial valid invitation expiry from the authoritative database clock through the existing read-only admin fixture query, or use an existing injected clock. Keep the later explicit expiry/revocation barriers and real RPC validation; do not globally fake or manipulate the database clock.

```text
const { adminQuery } = await import("../factories/admin-sql");
const [window] = await adminQuery<{ expires_at: string }>(
  `select to_char((clock_timestamp()+interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as expires_at`
);
// In the existing invitation RPC argument object:
p_expiry: window.expires_at
```

### 3. H2 — wall-clock-fixture

**Severity**: P1 (High)
**Location**: `C:/DEV/ElproSaas/tests/integration/commands/booking-conflicts.int.test.ts:565`
**Row**: H2
**Criterion**: wall-clock-fixture
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Both invitation-expiry races arm a two-second live database expiry before creating the pending RPC and observing its lock wait, then require the RPC query_start to precede expiry. A slow scheduling/connection interval can consume that fixture validity window before the intended race begins. Later observed-expiry polling correctly replaces a hard wait but cannot recover this pre-barrier deadline.

**Evidence**: update public.tenant_memberships set invitation_expires_at=clock_timestamp()+interval '2 seconds' where id=$1; ... accept = writer.invoke(); await h.waitForBlocked(owner.pid, 1); ... expect(started.live_at_start).toBe(true);

**Recommended improvement**: Move expiry arming behind an independently witnessed attempt/lock barrier when the intended post-wait current-time invariant can be preserved, or use an existing explicit clock seam. Keep a positive still-valid start witness, an explicit expired witness, and unchanged durable-state assertions. Do not loosen assertions or change the production security verifier.

```text
// Suggested structure, using the existing operation-row barrier where possible:
// 1. Prepare a valid invitation and acquire its controlled lock.
// 2. Start the real acceptance RPC and await the observed blocked session.
// 3. Establish/record the authoritative deadline and valid-start witness.
// 4. Await the database expired predicate, release the lock, and assert rejection.
// Preserve the gate-row variant separately if moving the deadline would alter its invariant.
```

### 4. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/e2e/resources-person-profile.e2e.spec.ts:32`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 4 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [32, 89, 100, 119], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 5. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/admin-users/read-pagination.test.ts:54`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 4 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [54, 74, 99, 117], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 6. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/booking-attempt-transport.test.ts:7`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 3 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [7, 15, 20], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 7. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/booking-editor-input.test.ts:13`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 13 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [13, 22, 30, 38, 44, 52, 58, 65, 75, 83, 90, 97, 104], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 8. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/capacity-inputs.test.ts:7`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 5 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [7, 23, 38, 46, 53], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 9. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/resource-form-inputs.test.ts:6`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 3 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [6, 12, 18], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 10. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/schedule-form-merge.test.ts:5`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 5 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [5, 20, 24, 40, 46], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 11. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/work-hours.test.ts:7`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 4 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [7, 38, 57, 73], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 12. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/scheduling/capacity.golden.test.ts:7`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 3 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [7, 35, 76], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 13. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/scheduling/conflicts.test.ts:9`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 9 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [9, 17, 22, 36, 48, 59, 70, 82, 105], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 14. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/scope/manifest-derivations.test.ts:107`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 6 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [107, 118, 131, 140, 154, 171], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 15. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/scope/manifest-shape.test.ts:126`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 8 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [126, 143, 154, 162, 176, 184, 197, 206], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 16. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/server/authz/permission-matrix.test.ts:9`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 6 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [9, 16, 23, 32, 52, 57], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 17. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/server/bookings/conflict-attestation.test.ts:12`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 3 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [12, 23, 27], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 18. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/server/commands/bookings-validation.test.ts:9`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 8 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [9, 14, 31, 37, 41, 45, 50, 63], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 19. M4 — ungrouped-suite

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/support/test-env.test.ts:24`
**Row**: M4
**Criterion**: ungrouped-suite
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The file registers at least 5 test declarations without describe/context subject grouping.

**Evidence**: {'declaration_lines': [24, 50, 77, 92, 106], 'grouping_count': 0, 'predicate': 'three or more tests and no subject grouping', 'basis': 'full-file structural inspection, not convention adoption'}

**Recommended improvement**: Import describe from the existing runner and wrap the tests in a named suite for their subject.

```text
import { describe, test } from '<existing runner>';
describe('<behavior subject>', () => {
  // Move the existing test registrations here without changing their bodies.
});
```

### 20. H4 — unreset-shared-state

**Severity**: P1 (High)
**Location**: `C:/DEV/ElproSaas/tests/integration/rls/quote-pipeline-read-model.rls.test.ts:165`
**Row**: H4
**Criterion**: unreset-shared-state
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The pipeline suite shares one tenant fixture and accumulates lifecycle events across test bodies without per-test reset; order changes the zero-count result, and the seller test relies on an earlier body to seed its sent event.

**Evidence**: {'setup': 'fixture created once in beforeAll84-106', 'cleanup': 'afterAll108-110 only, no beforeEach/afterEach', 'writer': 'test151 seeds tenant A sent quote/event at159-165', 'reader': 'test125 reads tenant A143 and asserts sentCount0 at144', 'counterexample': 'Run test151 before test125: the fresh fixture now contains one tenant A sent event, so the expected zero becomes one.', 'standalone': 'test239 calls seller pipeline242-246 and asserts sentCount>0 at250 before seeding any sent event in that body262-286.', 'basis': 'Static successful-path data-flow proof; no shuffle/standalone execution claimed'}

**Recommended improvement**: Move tenant/client fixture creation and cleanup to beforeEach/afterEach; seed the seller-visible sent event before its first pipeline read. Keep every aggregate expectation local to its body.

```text
beforeEach(async () => {
  // Create fixture, clients, and role memberships currently allocated in beforeAll.
});
afterEach(async () => {
  if (fixture) await cleanupFixture(fixture);
});
// In the seller test, create its own sent quote/event before reading sellerResult.
```

### 21. H5 — oversize-test-file

**Severity**: P1 (High)
**Location**: `C:/DEV/ElproSaas/tests/e2e/global-setup.ts:1`
**Row**: H5
**Criterion**: oversize-test-file
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Reviewed file is 1102 lines, exceeding the registry's sole 1000-line threshold.

**Evidence**: Metadata and full-source read: 1102 lines.

**Recommended improvement**: Extract feature-specific fixture seeders, leaving the global setup to compose and persist fixture metadata.

```text
// Keep each resulting source file <= 1000 lines; preserve every registered case and inventory entry.
```

### 22. H5 — oversize-test-file

**Severity**: P1 (High)
**Location**: `C:/DEV/ElproSaas/tests/integration/commands/quote-pdf-validity.int.test.ts:1`
**Row**: H5
**Criterion**: oversize-test-file
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Reviewed file is 1590 lines, exceeding the registry's sole 1000-line threshold.

**Evidence**: Metadata and full-source read: 1590 lines.

**Recommended improvement**: Split reserved identity/attestation, invalidation, Storage immutability and send checks into focused suites, sharing only the setup fixture.

```text
// Keep each resulting source file <= 1000 lines; preserve every registered case and inventory entry.
```

### 23. H5 — oversize-test-file

**Severity**: P1 (High)
**Location**: `C:/DEV/ElproSaas/tests/integration/rls/tenant-table-inventory.ts:1`
**Row**: H5
**Criterion**: oversize-test-file
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Reviewed file is 2074 lines, exceeding the registry's sole 1000-line threshold.

**Evidence**: Metadata and full-source read: 2074 lines.

**Recommended improvement**: Move module-specific payload builders and mutation patches to separate inventory modules; retain one manifest-derived registry and its fail-loud coherence checks.

```text
// Keep each resulting source file <= 1000 lines; preserve every registered case and inventory entry.
```

### 24. M7 — excessive-nesting

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/commands/booking-conflicts.int.test.ts:812`
**Row**: M7
**Criterion**: excessive-nesting
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Test control blocks nest more than three levels below the test callback/method; the callback root is excluded. Chain: fixture callback â†’ proxy get method â†’ rpc callback â†’ finalize condition â†’ expiry condition â†’ adminSession callback â†’ try â†’ poll loop.

**Evidence**: for (let attempt = 0; attempt < 100 && !expired; attempt++) {

**Recommended improvement**: Extract a withExpiredFinalizeBarrier(...) helper accepting the authenticated RPC closure, issued snapshot and expiry; leave command UUID, stale result and unchanged snapshot assertions in the case.

```text
// Extract the named barrier/expectation helper described above; keep scenario-specific assertions in the outer body.
```

### 25. M7 — excessive-nesting

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/commands/bookings-replay-authority.int.test.ts:115`
**Row**: M7
**Criterion**: excessive-nesting
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Test control blocks nest more than three levels below the test callback/method; the callback root is excluded. Chain: fixture callback â†’ try/finally â†’ status condition â†’ role restoration loop.

**Evidence**: for (const row of secondaryRoles) {

**Recommended improvement**: Extract restoreMembershipAuthority(membership, secondaryRoles) and invoke it from finally, retaining unconditional restoration and denied replay assertions.

```text
// Extract the named barrier/expectation helper described above; keep scenario-specific assertions in the outer body.
```

### 26. M7 — excessive-nesting

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/commands/bookings.int.test.ts:71`
**Row**: M7
**Criterion**: excessive-nesting
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Test control blocks nest more than three levels below the test callback/method; the callback root is excluded. Chain: fixture callback â†’ contender loop â†’ adminSession callback â†’ try â†’ lock-observation loop.

**Evidence**: for (let attempt = 0; attempt < 100 && blocked < inputs.length; attempt++) {

**Recommended improvement**: Extract a withHeldBookingLock(...) barrier that owns begin/commit/rollback and blocked-session observation; keep winner/outcome/audit assertions visible.

```text
// Extract the named barrier/expectation helper described above; keep scenario-specific assertions in the outer body.
```

### 27. M7 — excessive-nesting

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/rls/bookings.rls.test.ts:222`
**Row**: M7
**Criterion**: excessive-nesting
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Test control blocks nest more than three levels below the test callback/method; the callback root is excluded. Chain: fixture callback â†’ primitive loop â†’ role loop/adminSession callback â†’ try/finally.

**Evidence**: try { await query(`set local role ${role}`); await expect(query(`select ${primitive.invocation}`)).rejects.toMatchObject({ code: "42501" }); }

**Recommended improvement**: Extract a role-scoped invocation adapter with transaction cleanup; return the invocation promise so each outer case retains explicit 42501 expectations.

```text
// Extract the named barrier/expectation helper described above; keep scenario-specific assertions in the outer body.
```

### 28. M7 — excessive-nesting

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/.agents/skills/auto-bmad/scripts/tests/test_routing_migration.py:46`
**Row**: M7
**Criterion**: excessive-nesting
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Test control blocks nest more than three levels below the test callback/method; the callback root is excluded. Chain: mock.patch context â†’ route loop â†’ subTest context â†’ tool branch â†’ optional argument branch.

**Evidence**: def test_cli_resolve_all_configured_phases_tools_and_errors(self):

**Recommended improvement**: Move expected CLI argument construction into a pure runner-keyed expectation builder; retain subTest labels and independent expected argv/result assertions.

```text
// Extract the named barrier/expectation helper described above; keep scenario-specific assertions in the outer body.
```

### 29. M7 — excessive-nesting

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/.claude/skills/auto-bmad/scripts/tests/test_routing_migration.py:46`
**Row**: M7
**Criterion**: excessive-nesting
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Test control blocks nest more than three levels below the test callback/method; the callback root is excluded. Chain: mock.patch context â†’ route loop â†’ subTest context â†’ tool branch â†’ optional argument branch.

**Evidence**: def test_cli_resolve_all_configured_phases_tools_and_errors(self):

**Recommended improvement**: Mirror the same expectation-builder refactor as the .agents installation, retaining exact mirror checks.

```text
// Extract the named barrier/expectation helper described above; keep scenario-specific assertions in the outer body.
```

### 30. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/factories/tenants/core.ts:236`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Membership seed construction repeats across two-tenant and role-aware setup while seedMembership already builds that shape.

**Evidence**: Shape {role,status,tenant_id,user_id} at source lines 236, 242, 288, 289, 290, 291, 293, 294. { tenant_id: tenantA.id, user_id: adminA.id, role: "tenant_admin", status: "active", }

**Recommended improvement**: Use seedMembership({tenant,user,role,status}) for ordinary rows; keep the invited_email union special case explicit.

```text
await seedMembership({ tenant: tenantA, user: adminA, role: "tenant_admin", status: "active" });
```

### 31. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/commands/resources.int.test.ts:40`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The full resource form RPC payload is reconstructed four times.

**Evidence**: Shape {p_actor_user_id,p_calendar_day,p_correlation_id,p_employment_percentage,p_exceptions,p_membership_id,p_schedule,p_tenant_id,p_work_role_id} at source lines 40, 63, 71, 108. { p_tenant_id: fixture.tenantA.id, p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_membership_id: membership.id, p_work_role_id: nu

**Recommended improvement**: Add a test-owned resourceFormArgs(identity, overrides) builder; preserve empty arrays, explicit clears, anonymous identity and direct checked RPC calls.

```text
const args = resourceFormArgs(identity, { p_schedule: [], p_exceptions: [], p_calendar_day: { date, variant: "clear" } });
```

### 32. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/components/booking-editor.test.ts:28`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The complete editor options read model is rebuilt five times.

**Evidence**: Shape {canManage,contacts,customers,error,facilities,jobs,people,workRoles} at source lines 20, 28, 34, 41, 53. {canManage:true,error:null,people:[],workRoles:[],jobs:[],customers:[],facilities:[],contacts:[]}

**Recommended improvement**: Use editorOptions(overrides) for fresh option lists, keeping each archived/missing authority scenario override explicit.

```text
options: editorOptions({ canManage: true, people: [], workRoles: [] })
```

### 33. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts:64`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Recipient command payloads repeat nine inline constructions independently of CRM seed factories.

**Evidence**: Shape {quote_version_id,recipient_source_id,recipient_source_type} at source lines 64, 146, 159, 172, 186, 232, 279, 288, 295. { quote_version_id: quoteVersionId.toUpperCase(), recipient_source_type: "customer", recipient_source_id: customerId.toUpperCase(), }

**Recommended improvement**: Create recipientInput(quoteVersionId, sourceType, sourceId); pass it through the existing real command envelope, preserving the chosen user and uppercase/foreign variations.

```text
input: recipientInput(quoteVersionId, "contact", contactId)
```

### 34. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/rls/settings-rls.int.test.ts:269`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Complete company settings DML payloads repeat three times.

**Evidence**: Shape {company_name,default_vat_display,tenant_id,vat_rate_bp} at source lines 269, 276, 357. { tenant_id: fixture.tenantA.id, company_name: "own-tenant-direct-write", default_vat_display: "company_togglable", vat_rate_bp: 2500, }

**Recommended improvement**: Introduce a pure companySettingsPayload(tenantId, overrides) builder; retain the raw authenticated/anonymous .insert caller so privilege testing remains unchanged.

```text
a.from("company_settings").insert(companySettingsPayload(fixture.tenantA.id, { company_name: "own-tenant-direct-write" }))
```

### 35. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/integration/rls/tenant-table-inventory.ts:502`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The complete review-authorization row repeats in three inventory branches.

**Evidence**: Shape {actor_user_id,correlation_id,expires_at,id,issued_at,purpose,quote_id,source_revision,target_quote_version_id,tenant_id} at source lines 502, 776, 1442. { id: crypto.randomUUID(), tenant_id: fixture.tenantB.id, actor_user_id: fixture.adminA.id, purpose: "final_send", quote_id: requireCrmId(ctx.tenantBQuoteId, "t

**Recommended improvement**: Use a pure reviewAuthorizationRow(identities, overrides) constructor; retain each foreign/anonymous operation and the manifest-owned inventory mapping.

```text
return reviewAuthorizationRow({ tenantId, actorId, quoteId, versionId });
```

### 36. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/support/booking-conflicts-atdd.ts:80`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The full weekly shift shape is reconstructed in initial fixture setup and two writer variants.

**Evidence**: Shape {breaks,end,start,weekday} at source lines 80, 139, 142. { weekday, start: "08:00", end: "16:00", breaks: [] }

**Recommended improvement**: Create a pure shift(weekday,start,end,breaks) constructor and use it for the fixture map and checked schedule/form writers.

```text
p_schedule: [shift(1, "09:00", "12:00")]
```

### 37. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/admin-users/read-pagination.test.ts:57`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Full read-side membership rows repeat five constructions.

**Evidence**: Shape {created_at,id,invited_email,role,status,tenant_id} at source lines 57, 58, 75, 100, 118. { id: "a-member", tenant_id: "tenant-a", invited_email: "a@example.test", status: "active", role: "saljare", created_at: "2026-01-02T00:00:00Z" }

**Recommended improvement**: Use membershipRow(overrides) for fresh fake read rows, keeping pagination cardinalities and foreign tenant values explicit.

```text
memberships: [membershipRow({ id: "a-member", tenant_id: "tenant-a" }), membershipRow({ id: "b-member", tenant_id: "tenant-b" })]
```

### 38. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/booking-editor-input.test.ts:15`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The full endpoint-edit request repeats seven times.

**Evidence**: Shape {allDay,endChanged,endsAtLocal,original,startChanged,startsAtLocal} at source lines 15, 18, 77, 84, 91, 98, 105. {original,startChanged:false,endChanged:true,allDay:false, startsAtLocal:"2026-10-25T02:30",endsAtLocal:"2026-10-25T05:00"}

**Recommended improvement**: Add timesRequest(overrides) beside these cases, returning a fresh request based on booking(); keep every fold/gap/microsecond override literal.

```text
prepareBookingTimes(timesRequest({ original, startChanged: false, endChanged: true, endsAtLocal: "2026-10-25T05:00" }))
```

### 39. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/capacity-inputs.test.ts:15`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Timed exception input records repeat three times.

**Evidence**: Shape {date,end,kind,start} at source lines 15, 28, 50. { kind: "blocked_time", date: "2026-10-16", start: "09:00", end: "12:00" }

**Recommended improvement**: Use timedException(overrides) for actual inputs, preserving invalid and PostgreSQL precision values at call sites.

```text
exceptions: [timedException({ start: "13:00", end: "09:00" })]
```

### 40. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/resource-form-inputs.test.ts:7`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Three complete timed-exception input records are rebuilt; expected output literals are excluded.

**Evidence**: Shape {date,end,kind,start} at source lines 7, 19, 20. { kind: "blocked_time", date: "2026-10-16", start: null, end: null }

**Recommended improvement**: Use timedException(overrides) for persisted/rendered inputs; retain the independent expected normalized output.

```text
const existing = [timedException({ start: "09:00:30.123456", end: "12:00:30.123456" })];
```

### 41. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/schedule-form-merge.test.ts:7`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The full shift shape repeats at least eleven input construction sites; independent expected arrays are excluded.

**Evidence**: Shape {breaks,end,start,weekday} at source lines 7, 9, 10, 21, 26, 28, 29, 30, 41, 42, 47. { weekday: 1, start: "08:00", end: "16:00", breaks: [{ start: "12:00", end: "12:30" }] }

**Recommended improvement**: Use a fresh shift(...) constructor for input schedules, retaining each explicit shift/break time and all expected result literals.

```text
mergeRenderedSchedule([shift(1, "08:00", "16:00", [breakWindow("12:00", "12:30")])], stored);
```

### 42. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/schedule-read.test.ts:7`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Four persisted work-hour input rows share the same complete shape.

**Evidence**: Shape {ends_at,entry_kind,starts_at,weekday} at source lines 7, 8, 9, 10. { entry_kind: "weekly_break", weekday: 1, starts_at: "14:00:00", ends_at: "14:15:00" }

**Recommended improvement**: Add workHourRow(kind,weekday,start,end) for input rows; leave the expected split-shift output literal.

```text
workHourRow("weekly_break", 1, "14:00:00", "14:15:00")
```

### 43. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/resources/work-hours.test.ts:16`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Fourteen full shift input records are constructed inline.

**Evidence**: Shape {breaks,end,start,weekday} at source lines 16, 17, 18, 19, 25, 26, 27, 28, 29, 45, 46, 50, 62, 78. { weekday: 1, start: "07:00", end: "16:00", breaks: [] }

**Recommended improvement**: Use shift(...) for actual input records and a weekday map for the four-/five-day templates; preserve explicit 80-percent and invalid-window facts.

```text
shifts: [1, 2, 3, 4].map(day => shift(day, "07:00", "16:00"))
```

### 44. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/scheduling/capacity.golden.test.ts:8`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Nine complete shift inputs are reconstructed around the existing facts() factory.

**Evidence**: Shape {breaks,end,start,weekday} at source lines 8, 14, 28, 39, 47, 55, 61, 62, 77. { weekday: 1, start: "10:00", end: "10:30", breaks: [] }

**Recommended improvement**: Add a pure shift(...) builder to scheduling-atdd; keep deliberate microsecond/buffer/reduction boundaries explicit and golden expected terms independent.

```text
input.people[0].shifts = [shift(1, "10:00", "10:30")];
```

### 45. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/features/scheduling/conflicts.test.ts:45`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Three complete shift input records repeat inline without a shared shift constructor; expected conflict payloads are excluded.

**Evidence**: Shape {breaks,end,start,weekday} at source lines 45, 50, 50. { weekday: 1, start: "bad", end: "17:00", breaks: [] }

**Recommended improvement**: Use the same fresh scheduling shift(...) builder for malformed/split shifts, preserving the malformed start literal as an explicit override.

```text
shifts: [shift(1, "07:00", "12:00", [breakWindow("10:00", "10:30")]), shift(1, "13:00", "17:00")]
```

### 46. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/server/authz/permission-matrix.test.ts:11`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

Nine complete permission-decision request objects repeat the same shape.

**Evidence**: Shape {capability,module,roles} at source lines 11, 17, 18, 25, 26, 27, 28, 59, 60. { roles: ["tenant_admin"], module: "foundation", capability: "Memberships.Manage" }

**Recommended improvement**: Add permissionRequest(roles,module,capability) that performs no validation or authorization; keep malformed matrix cases and every role input explicit.

```text
resolveCapability(permissionRequest(["tenant_admin"], "foundation", "Memberships.Manage"))
```

### 47. M2 — repeated-literal-payload

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/unit/server/commands/bookings-validation.test.ts:52`
**Row**: M2
**Criterion**: repeated-literal-payload
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The complete editorReview receipt/decision payload is constructed four times; base input factory use is not deducted.

**Evidence**: Shape {decision,receipt} at source lines 52, 53, 57, 59. {receipt:"receipt-one",decision}

**Recommended improvement**: Add editorReview(receipt,decision) as a pure test builder; preserve malformed signature/actor additions and the distinct receipt values.

```text
editorReview: editorReview("receipt-one", decision)
```

### 48. M1 — network-first-violated

**Severity**: P2 (Medium)
**Location**: `C:/DEV/ElproSaas/tests/e2e/resources-person-profile.e2e.spec.ts:35`
**Row**: M1
**Criterion**: network-first-violated
**Knowledge Base**: [Criteria registry](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/steps-c/criteria-registry.md)

The resource browser suite navigates to data-dependent user-detail content without installing an intercept or explicit readiness signal before those navigations. Its CDP fixture supplies a context/page but no such registration. Native awaited navigation and later locator assertions do not match the registry’s before-navigation predicate.

**Evidence**: await page.goto(`/admin/users/${fixture.adminUserManagement.resourceProfileMembershipId}`); followed by resource-role/schedule field interaction; resource-cdp-attachment fixture only attaches/provides/closes the owned context/page.

**Recommended improvement**: Register observation of the real navigation/read response before each data-dependent navigation, then await it before interacting. Keep real server data and durable persistence checks.

```text
const target = `/admin/users/${fixture.adminUserManagement.resourceProfileMembershipId}`;
const ready = page.waitForResponse((response) =>
  response.request().isNavigationRequest() &&
  new URL(response.url()).pathname === target && response.status() === 200);
await page.goto(target);
await ready;
```

## Best Practices Found

- resources-boundaries.int.test.ts uses actual checked resource denials, real foreign references and independent two-tenant unchanged snapshots; recorded focused5/affected47/full1465 passes provide execution evidence separately from this static audit.
- booking-editor-atdd.ts:178-182 registers a real Next transport route before test use, awaits routeWork and releases owned routes/holds in disposal. This preserves genuine server responses.
- The booking concurrency families await stored futures and use finally settlement rather than assuming sleep-based ordering.
- quote-send-diagnostics.test.ts:27-31 proves lazy builder identity and execution-on-await; an unconsumed lazy identity assertion is not a floating asynchronous effect.

## Test File Analysis

The following metadata was read from each complete file. Lexical registration/expect counters in context.json are discovery aids, not runtime body/assertion counts: generated cases, node:test/assert and aliased assertions differ. Actual recorded identity/coverage mapping belongs to trace.

| Artifact | Category | Logical lines | Bytes |
|---|---|---:|---:|
| .agents/skills/auto-bmad/scripts/tests/test_routing_migration.py | mechanical-routing-tests | 968 | 54615 |
| .claude/skills/auto-bmad/scripts/tests/test_routing_migration.py | mechanical-routing-tests | 968 | 54615 |
| .env.test.example | configuration | 7 | 607 |
| compose.test.yaml | configuration | 133 | 4612 |
| tests/e2e/booking-editor.e2e.spec.ts | test-body | 532 | 39591 |
| tests/e2e/global-setup.ts | helper/fixture | 1102 | 47702 |
| tests/e2e/resources-person-profile.e2e.spec.ts | test-body | 175 | 10539 |
| tests/e2e/support/booking-editor-atdd.ts | helper/fixture | 307 | 22965 |
| tests/e2e/support/resource-cdp-attachment.ts | helper/fixture | 58 | 2307 |
| tests/factories/tenants/core.ts | helper/fixture | 493 | 21309 |
| tests/fixtures/golden/scheduling/capacity.json | golden-fixture | 203 | 4174 |
| tests/fixtures/golden/scheduling/conflicts.json | golden-fixture | 296 | 8322 |
| tests/fixtures/golden/scheduling/dst.json | golden-fixture | 69 | 1792 |
| tests/fixtures/golden/scheduling/regressions.json | golden-fixture | 487 | 13803 |
| tests/integration/commands/audit-anon-isolation.int.test.ts | test-body | 116 | 5554 |
| tests/integration/commands/booking-conflicts.int.test.ts | test-body | 862 | 64602 |
| tests/integration/commands/booking-editor-review-fixes.int.test.ts | test-body | 59 | 5738 |
| tests/integration/commands/booking-editor-round2.int.test.ts | test-body | 39 | 3559 |
| tests/integration/commands/booking-editor.int.test.ts | test-body | 637 | 41585 |
| tests/integration/commands/bookings-replay-authority.int.test.ts | test-body | 221 | 14946 |
| tests/integration/commands/bookings.int.test.ts | test-body | 488 | 36732 |
| tests/integration/commands/quote-pdf-validity.int.test.ts | test-body | 1590 | 72770 |
| tests/integration/commands/resources-boundaries.int.test.ts | test-body | 321 | 20595 |
| tests/integration/commands/resources.int.test.ts | test-body | 112 | 11397 |
| tests/integration/commands/update-job.int.test.ts | test-body | 340 | 16120 |
| tests/integration/components/booking-editor.test.ts | test-body | 165 | 11993 |
| tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts | test-body | 306 | 15111 |
| tests/integration/features/booking-read-actions.test.ts | test-body | 158 | 11661 |
| tests/integration/jobs/job-runs.int.test.ts | test-body | 76 | 4904 |
| tests/integration/rls/admin-user-management.rls.test.ts | test-body | 58 | 2937 |
| tests/integration/rls/approved-public-acl-repair.int.test.ts | test-body | 167 | 5879 |
| tests/integration/rls/bookings.rls.test.ts | test-body | 242 | 18658 |
| tests/integration/rls/calc-tables-migration-reset.int.test.ts | test-body | 354 | 17617 |
| tests/integration/rls/crm-tables-migration-reset.int.test.ts | test-body | 269 | 12763 |
| tests/integration/rls/cross-tenant-isolation.rls.test.ts | test-body | 756 | 38014 |
| tests/integration/rls/file-tables-migration-reset.int.test.ts | test-body | 360 | 16978 |
| tests/integration/rls/membership-self-grant.rls.test.ts | test-body | 165 | 6993 |
| tests/integration/rls/migration-reset.int.test.ts | test-body | 671 | 32022 |
| tests/integration/rls/onboarding-checklist.rls.test.ts | test-body | 135 | 9987 |
| tests/integration/rls/pricing-tables-migration-reset.int.test.ts | test-body | 242 | 12255 |
| tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts | test-body | 207 | 11523 |
| tests/integration/rls/quote-pipeline-read-model.rls.test.ts | test-body | 342 | 21191 |
| tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts | test-body | 191 | 9491 |
| tests/integration/rls/resources.rls.test.ts | test-body | 36 | 3882 |
| tests/integration/rls/role-harness.atdd.int.test.ts | test-body | 253 | 24326 |
| tests/integration/rls/settings-rls.int.test.ts | test-body | 388 | 19415 |
| tests/integration/rls/tenant-table-inventory.ts | helper/fixture | 2074 | 98334 |
| tests/support/authz/role-harness.ts | helper/fixture | 252 | 14678 |
| tests/support/booking-conflict-attestation.ts | helper/fixture | 196 | 17265 |
| tests/support/booking-conflicts-atdd.ts | helper/fixture | 205 | 14220 |
| tests/support/booking-editor-atdd.ts | helper/fixture | 151 | 9484 |
| tests/support/booking-editor-contract.ts | helper/fixture | 69 | 4373 |
| tests/support/booking-editor-production.ts | helper/fixture | 453 | 35383 |
| tests/support/bookings-atdd.ts | helper/fixture | 294 | 21348 |
| tests/support/global-setup.ts | helper/fixture | 64 | 2964 |
| tests/support/quote-send-diagnostics.ts | helper/fixture | 156 | 10393 |
| tests/support/scheduling-atdd.ts | helper/fixture | 56 | 3593 |
| tests/support/stack-gate.ts | helper/fixture | 104 | 4674 |
| tests/support/test-env.ts | helper/fixture | 281 | 12281 |
| tests/unit/admin-users/read-pagination.test.ts | test-body | 134 | 6797 |
| tests/unit/e2e/resource-cdp-attachment.test.ts | test-body | 22 | 1102 |
| tests/unit/features/resources/booking-attempt-transport.test.ts | test-body | 23 | 1765 |
| tests/unit/features/resources/booking-editor-input.test.ts | test-body | 108 | 7381 |
| tests/unit/features/resources/capacity-inputs.test.ts | test-body | 66 | 2962 |
| tests/unit/features/resources/resource-form-inputs.test.ts | test-body | 21 | 1349 |
| tests/unit/features/resources/schedule-form-merge.test.ts | test-body | 48 | 2506 |
| tests/unit/features/resources/schedule-read.test.ts | test-body | 15 | 935 |
| tests/unit/features/resources/work-hours.test.ts | test-body | 81 | 3540 |
| tests/unit/features/scheduling/capacity.golden.test.ts | test-body | 88 | 9201 |
| tests/unit/features/scheduling/conflicts.test.ts | test-body | 110 | 9163 |
| tests/unit/features/scheduling/dst.golden.test.ts | test-body | 46 | 4365 |
| tests/unit/quote-send-diagnostics.test.ts | test-body | 46 | 2311 |
| tests/unit/scope/booking-editor-scope.test.ts | test-body | 26 | 1648 |
| tests/unit/scope/manifest-derivations.test.ts | test-body | 185 | 8740 |
| tests/unit/scope/manifest-shape.test.ts | test-body | 217 | 10290 |
| tests/unit/scope/resources-activation.atdd.test.ts | test-body | 28 | 1348 |
| tests/unit/security-headers.test.ts | test-body | 20 | 1158 |
| tests/unit/server/authz/permission-matrix.test.ts | test-body | 62 | 2979 |
| tests/unit/server/authz/role-catalogue.test.ts | test-body | 46 | 3524 |
| tests/unit/server/authz/role-harness.test.ts | test-body | 56 | 2907 |
| tests/unit/server/bookings/conflict-attestation.test.ts | test-body | 41 | 3068 |
| tests/unit/server/commands/bookings-validation.test.ts | test-body | 68 | 6028 |
| tests/unit/server/resources/e2e-save-failure.test.ts | test-body | 14 | 846 |
| tests/unit/support/global-setup.test.ts | test-body | 19 | 691 |
| tests/unit/support/test-env.test.ts | test-body | 120 | 4077 |

## Context and Integration

The four approved stories establish nav-less active resources, same-tenant profiles/availability, command-only booking persistence, deterministic detector/current-fact atomic save and explicit reviewed whole-group editor acceptance. The audit respects those current boundaries without grading the prose. All Contract C transferred conflict checks retain actual 14.3 evidence. Contract D transfers only actual calendar slot click/drag to 15.1 before calendar exposure/completion; it is neither missing Epic 14 intent nor completed Epic 14 browser credit. Other toolbar/job/customer/standalone/reopen/edit entry obligations remain.

### Recorded Evidence and Limits

| Recorded raw report | Total | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| epic-14-gate-iter1-focused.json | 5 | 5 | 0 | 0 |
| epic-14-gate-iter1-affected.json | 47 | 47 | 0 | 0 |
| epic-14-gate-iter1-full.json | 1466 | 1465 | 0 | 1 |
| story14-3-r2-full.json | 1368 | 1367 | 0 | 1 |
| story14-4-r2-full-int.json | 1461 | 1460 | 0 | 1 |

These are inspected prior raw-runner artifacts, not executions by this audit. Browser evidence is 18/19 diagnostic plus separate1/1 targeted on the same final build, not a single19-pass run. Targeted40.545s is runner elapsed; the actual1,120,245-byte HTTP200 booking/audit readback establishes its own scenario, not an HTTP-duration/NFR certification. Existing Storage and Windows-xattr skips receive no acceptance credit. Historical failed reports and unknown causes remain historical.

**New product executions**: 0. No DB/Auth fixtures, browser/server launch, managed resource, environment/dependency/source/spec/migration/Git mutation was performed. Empty-database complete migration chain + seed + required integration CI remains mandatory before merge; populated local evidence does not prove it. No performance/A11Y/exploratory certification is invented. Dedicated stale-save renewed-ack browser journey is absent; existing pure/core and actual database evidence is not that browser journey. Coverage is excluded from this score; use the existing trace outputs for the formal coverage gate.

## Knowledge Base References

- [Test quality](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)
- [Data factories](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)
- [Fixture architecture](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/fixture-architecture.md)
- [Network-first](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/network-first.md)
- [Timing](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/timing-debugging.md)
- [Test levels](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md)
- [Selective testing](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/selective-testing.md)
- [Selectors](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)
- [Healing patterns](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/test-healing-patterns.md)
- [Playwright utility mandate](C:/DEV/ElproSaas/.agents/skills/bmad-testarch-test-review/resources/knowledge/playwright-utils-mandate.md)
- [Supabase boundary guidance](C:/Users/Rasmus/.agents/skills/supabase/SKILL.md)

## Next Steps

Route the concrete oracle/expiry/shared-fixture findings to the owning test author; preserve controlled barriers, real RPCs and exact durable assertions. Group/split/refactor only the named structural patterns without reducing test registration or replacing production evidence with mirrors. The root owns disposition and release/PR caveats. This advisory audit initiates no implementation fix or automatic BMAD Round3 and clears none of the Story14.1/14.2/14.4 follow-up flags. No re-review or new run was automatically started.

## Decision

**Recommendation**: Request Changes

The pinned ledger requires Request Changes. Its 0/F run-level score reflects structural volume and seven HIGH predicates; it does not override trace, supply release authority or establish a production bug from an assertion gap. Context waivers applied remain0.

## Appendix

### Violation Summary by Location

| Location | Severity | Row | Dimension |
|---|---|---|---|
| .agents/skills/auto-bmad/scripts/tests/test_routing_migration.py:46 | MEDIUM | M7 | maintainability |
| .claude/skills/auto-bmad/scripts/tests/test_routing_migration.py:46 | MEDIUM | M7 | maintainability |
| tests/e2e/global-setup.ts:1 | HIGH | H5 | maintainability |
| tests/e2e/resources-person-profile.e2e.spec.ts:32 | MEDIUM | M4 | isolation |
| tests/e2e/resources-person-profile.e2e.spec.ts:35 | MEDIUM | M1 | performance |
| tests/factories/tenants/core.ts:236 | MEDIUM | M2 | maintainability |
| tests/integration/commands/booking-conflicts.int.test.ts:290 | HIGH | H3 | determinism |
| tests/integration/commands/booking-conflicts.int.test.ts:565 | HIGH | H2 | determinism |
| tests/integration/commands/booking-conflicts.int.test.ts:812 | MEDIUM | M7 | maintainability |
| tests/integration/commands/bookings-replay-authority.int.test.ts:115 | MEDIUM | M7 | maintainability |
| tests/integration/commands/bookings.int.test.ts:71 | MEDIUM | M7 | maintainability |
| tests/integration/commands/quote-pdf-validity.int.test.ts:1 | HIGH | H5 | maintainability |
| tests/integration/commands/resources.int.test.ts:40 | MEDIUM | M2 | maintainability |
| tests/integration/components/booking-editor.test.ts:28 | MEDIUM | M2 | maintainability |
| tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts:64 | MEDIUM | M2 | maintainability |
| tests/integration/rls/bookings.rls.test.ts:222 | MEDIUM | M7 | maintainability |
| tests/integration/rls/quote-pipeline-read-model.rls.test.ts:165 | HIGH | H4 | isolation |
| tests/integration/rls/settings-rls.int.test.ts:269 | MEDIUM | M2 | maintainability |
| tests/integration/rls/tenant-table-inventory.ts:1 | HIGH | H5 | maintainability |
| tests/integration/rls/tenant-table-inventory.ts:502 | MEDIUM | M2 | maintainability |
| tests/support/booking-conflict-attestation.ts:186 | HIGH | H2 | determinism |
| tests/support/booking-conflicts-atdd.ts:80 | MEDIUM | M2 | maintainability |
| tests/unit/admin-users/read-pagination.test.ts:54 | MEDIUM | M4 | isolation |
| tests/unit/admin-users/read-pagination.test.ts:57 | MEDIUM | M2 | maintainability |
| tests/unit/features/resources/booking-attempt-transport.test.ts:7 | MEDIUM | M4 | isolation |
| tests/unit/features/resources/booking-editor-input.test.ts:13 | MEDIUM | M4 | isolation |
| tests/unit/features/resources/booking-editor-input.test.ts:15 | MEDIUM | M2 | maintainability |
| tests/unit/features/resources/capacity-inputs.test.ts:7 | MEDIUM | M4 | isolation |
| tests/unit/features/resources/capacity-inputs.test.ts:15 | MEDIUM | M2 | maintainability |
| tests/unit/features/resources/resource-form-inputs.test.ts:6 | MEDIUM | M4 | isolation |
| tests/unit/features/resources/resource-form-inputs.test.ts:7 | MEDIUM | M2 | maintainability |
| tests/unit/features/resources/schedule-form-merge.test.ts:5 | MEDIUM | M4 | isolation |
| tests/unit/features/resources/schedule-form-merge.test.ts:7 | MEDIUM | M2 | maintainability |
| tests/unit/features/resources/schedule-read.test.ts:7 | MEDIUM | M2 | maintainability |
| tests/unit/features/resources/work-hours.test.ts:7 | MEDIUM | M4 | isolation |
| tests/unit/features/resources/work-hours.test.ts:16 | MEDIUM | M2 | maintainability |
| tests/unit/features/scheduling/capacity.golden.test.ts:7 | MEDIUM | M4 | isolation |
| tests/unit/features/scheduling/capacity.golden.test.ts:8 | MEDIUM | M2 | maintainability |
| tests/unit/features/scheduling/conflicts.test.ts:9 | MEDIUM | M4 | isolation |
| tests/unit/features/scheduling/conflicts.test.ts:45 | MEDIUM | M2 | maintainability |
| tests/unit/scope/manifest-derivations.test.ts:107 | MEDIUM | M4 | isolation |
| tests/unit/scope/manifest-shape.test.ts:126 | MEDIUM | M4 | isolation |
| tests/unit/server/authz/permission-matrix.test.ts:9 | MEDIUM | M4 | isolation |
| tests/unit/server/authz/permission-matrix.test.ts:11 | MEDIUM | M2 | maintainability |
| tests/unit/server/bookings/conflict-attestation.test.ts:12 | MEDIUM | M4 | isolation |
| tests/unit/server/commands/bookings-validation.test.ts:9 | MEDIUM | M4 | isolation |
| tests/unit/server/commands/bookings-validation.test.ts:52 | MEDIUM | M2 | maintainability |
| tests/unit/support/test-env.test.ts:24 | MEDIUM | M4 | isolation |

### Execution and Workflow Limits

Three independent context-free Sol6.1 High children completed determinism/isolation/maintainability. Native agent-capacity refusals prevented a fresh performance child even after completion events; the root confirmed the named workflow’s supported sequential fallback. Exact performance M1/M6/H5 contracts completed locally with full reads/static AST/typechecker adjudication and its separate JSON. No fourth-child or parallel-speedup claim is made. The current primary session was not reconfigured.

The uv resolver could not initialize its Windows cache (OS error5); the existing Python runtime resolved the same customization successfully. Invocation supplied headless/full85/fourcontexts/outputoverride/noinlinecomments took precedence over empty defaults. No skill completion hook was configured. Registry L2 is absent from all four worker assignment lists; its measured convention is disclosed but it was not silently scored, passed or waived. All other exact assigned dimension rows completed.

### Quality Trends and Related Reviews

No comparable prior run-level test-quality score was supplied; no trend is inferred. This is an advisory test audit, not another broad product review round. The four JSON dimension contracts and summary.json contain detailed applicability, evidence and fixes.

## Review Metadata

Generated by BMad TEA test-review delegate; official Create workflow completed headlessly on2026-10-07. Authoritative input HEAD:e92e0ec126ea541e109e8abe0ac02ba57085e68e. Current complete file hashes are retained. Inline comments, story updates and generic shared TEA summary were disabled; all output is under this Epic14-unique audit directory.

## Feedback on This Review

Use the pinned row/location to discuss a finding; findings without an applicable registry predicate are prose limitations, not invented deductions. Approval/release disposition remains with the root/owner.

## Reviewed Files

- .agents/skills/auto-bmad/scripts/tests/test_routing_migration.py
- .claude/skills/auto-bmad/scripts/tests/test_routing_migration.py
- tests/e2e/booking-editor.e2e.spec.ts
- tests/e2e/global-setup.ts
- tests/e2e/resources-person-profile.e2e.spec.ts
- tests/e2e/support/booking-editor-atdd.ts
- tests/e2e/support/resource-cdp-attachment.ts
- tests/factories/tenants/core.ts
- tests/integration/commands/audit-anon-isolation.int.test.ts
- tests/integration/commands/booking-conflicts.int.test.ts
- tests/integration/commands/booking-editor-review-fixes.int.test.ts
- tests/integration/commands/booking-editor-round2.int.test.ts
- tests/integration/commands/booking-editor.int.test.ts
- tests/integration/commands/bookings-replay-authority.int.test.ts
- tests/integration/commands/bookings.int.test.ts
- tests/integration/commands/quote-pdf-validity.int.test.ts
- tests/integration/commands/resources-boundaries.int.test.ts
- tests/integration/commands/resources.int.test.ts
- tests/integration/commands/update-job.int.test.ts
- tests/integration/components/booking-editor.test.ts
- tests/integration/email/quote-delivery-recipient-snapshot.int.test.ts
- tests/integration/features/booking-read-actions.test.ts
- tests/integration/jobs/job-runs.int.test.ts
- tests/integration/rls/admin-user-management.rls.test.ts
- tests/integration/rls/approved-public-acl-repair.int.test.ts
- tests/integration/rls/bookings.rls.test.ts
- tests/integration/rls/calc-tables-migration-reset.int.test.ts
- tests/integration/rls/crm-tables-migration-reset.int.test.ts
- tests/integration/rls/cross-tenant-isolation.rls.test.ts
- tests/integration/rls/file-tables-migration-reset.int.test.ts
- tests/integration/rls/membership-self-grant.rls.test.ts
- tests/integration/rls/migration-reset.int.test.ts
- tests/integration/rls/onboarding-checklist.rls.test.ts
- tests/integration/rls/pricing-tables-migration-reset.int.test.ts
- tests/integration/rls/quote-follow-ups-migration-reset.int.test.ts
- tests/integration/rls/quote-pipeline-read-model.rls.test.ts
- tests/integration/rls/quote-review-authorization-migration-reset.int.test.ts
- tests/integration/rls/resources.rls.test.ts
- tests/integration/rls/role-harness.atdd.int.test.ts
- tests/integration/rls/settings-rls.int.test.ts
- tests/integration/rls/tenant-table-inventory.ts
- tests/support/authz/role-harness.ts
- tests/support/booking-conflict-attestation.ts
- tests/support/booking-conflicts-atdd.ts
- tests/support/booking-editor-atdd.ts
- tests/support/booking-editor-contract.ts
- tests/support/booking-editor-production.ts
- tests/support/bookings-atdd.ts
- tests/support/global-setup.ts
- tests/support/quote-send-diagnostics.ts
- tests/support/scheduling-atdd.ts
- tests/support/stack-gate.ts
- tests/support/test-env.ts
- tests/unit/admin-users/read-pagination.test.ts
- tests/unit/e2e/resource-cdp-attachment.test.ts
- tests/unit/features/resources/booking-attempt-transport.test.ts
- tests/unit/features/resources/booking-editor-input.test.ts
- tests/unit/features/resources/capacity-inputs.test.ts
- tests/unit/features/resources/resource-form-inputs.test.ts
- tests/unit/features/resources/schedule-form-merge.test.ts
- tests/unit/features/resources/schedule-read.test.ts
- tests/unit/features/resources/work-hours.test.ts
- tests/unit/features/scheduling/capacity.golden.test.ts
- tests/unit/features/scheduling/conflicts.test.ts
- tests/unit/features/scheduling/dst.golden.test.ts
- tests/unit/quote-send-diagnostics.test.ts
- tests/unit/scope/booking-editor-scope.test.ts
- tests/unit/scope/manifest-derivations.test.ts
- tests/unit/scope/manifest-shape.test.ts
- tests/unit/scope/resources-activation.atdd.test.ts
- tests/unit/security-headers.test.ts
- tests/unit/server/authz/permission-matrix.test.ts
- tests/unit/server/authz/role-catalogue.test.ts
- tests/unit/server/authz/role-harness.test.ts
- tests/unit/server/bookings/conflict-attestation.test.ts
- tests/unit/server/commands/bookings-validation.test.ts
- tests/unit/server/resources/e2e-save-failure.test.ts
- tests/unit/support/global-setup.test.ts
- tests/unit/support/test-env.test.ts

## Review Context

- _bmad-output/implementation-artifacts/spec-14-1-scheduling-activation-person-profiles-and-work-hours.md
- _bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md
- _bmad-output/implementation-artifacts/spec-14-3-deterministic-conflict-engine-detection-core.md
- _bmad-output/implementation-artifacts/spec-14-4-booking-editor-with-live-conflict-warnings-and-audited-override.md

## Excluded From Review Set

- .env.test.example — format not scorable by the ledger
- compose.test.yaml — format not scorable by the ledger
- tests/fixtures/golden/scheduling/capacity.json — format not scorable by the ledger
- tests/fixtures/golden/scheduling/conflicts.json — format not scorable by the ledger
- tests/fixtures/golden/scheduling/dst.json — format not scorable by the ledger
- tests/fixtures/golden/scheduling/regressions.json — format not scorable by the ledger
