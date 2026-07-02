---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: '2026-07-02'
workflowType: testarch-test-review
reviewScope: suite
epicNum: 4
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - tests/unit/lib/money/ore.test.ts
  - tests/unit/lib/money/ore-edges.test.ts
  - tests/unit/lib/money/roundtrip.test.ts
  - tests/unit/lib/money/rounding.golden.test.ts
  - tests/unit/lib/money/vat.test.ts
  - tests/unit/lib/money/vat.coverage.test.ts
  - tests/unit/lib/money/vat.golden.test.ts
  - tests/unit/lib/money/tax.test.ts
  - tests/unit/lib/money/tax.edges.test.ts
  - tests/unit/lib/money/tax.golden.test.ts
  - tests/unit/lib/money/golden-pack.test.ts
  - tests/unit/lib/money/golden-pack-coverage.test.ts
  - tests/fixtures/golden/money/*.json
  - knowledge: test-quality.md, test-levels-framework.md, test-priorities-matrix.md, data-factories.md
---

# Test Quality Review: Epic 4 — Money / Tax / Snapshot Primitives & Golden Fixtures

**Quality Score**: 93/100 (A - Excellent)
**Review Date**: 2026-07-02
**Review Scope**: suite (the tests added across Epic 4)
**Reviewer**: TEA Agent (Master Test Architect)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve

### Key Strengths

✅ Perfect determinism + isolation: pure `node --test` units over `@/lib/money` — no clock (`capturedAt` is an injected fixed constant), no `Math.random`, no DB/browser/network, no shared mutable state, fully parallel-safe.
✅ Fast gate: 188 money/tax tests pass in ~491 ms (0 fail / 0 skip) — comfortably under the 1.5-minute Definition-of-Done bar, ideal for run-every-PR.
✅ Load-bearing, policy-pinning assertions: sum-of-rounded ≠ round-of-sum, half-away-from-zero rounding mode, VAT rate as basis points (no hidden 25% literal), ROT×grön mix blocked, `requiresSignOff` structural default, frozen assumption snapshots, and a three-way-labelled golden oracle (`old-lovable` / `new-expected` / `documented-delta`).

### Key Weaknesses

❌ Six test files exceed the 300-line DoD guideline (tax.test.ts 500, golden-pack.test.ts 422, vat.test.ts 342, ore.test.ts 318, tax.edges.test.ts 317, vat.coverage.test.ts 317) — individual tests are small, but the files are large.
❌ The typed-result helpers (`isOk` / `isErr` / `okOre` / `assertNoRawEcho`) are re-declared in ~6 files instead of a shared `tests/support` module (DRY).
❌ Residual tolerant either-shape branching in the 4.1/4.2/4.3 ATDD scaffolds — deterministic in practice, but now that the engine result shape (`OreResult`) is fixed the branches could be tightened.

### Summary

Epic 4's test suite is high quality and production-ready. It is exactly the shape the epic test-design called for: a dense **UNIT + GOLDEN** pack over pure money/tax logic with no integration/RLS/E2E footprint. The assertions are not vanity checks — they pin the exact, regression-sensitive policy decisions (rounding order/mode, VAT basis-point sourcing, deduction caps, ROT×grön mix blocking, sign-off gating, snapshot freeze) that every later quote/PDF/acceptance story inherits, and the golden pack is a genuinely explainable oracle (each expected value labelled by origin). The only findings are maintainability polish (large files, duplicated helpers) that do not affect correctness, reliability, or speed — hence a clean Approve.

---

## Quality Criteria Assessment

| Criterion                            | Status  | Violations | Notes |
| ------------------------------------ | ------- | ---------- | ----- |
| BDD Format (Given-When-Then)         | ✅ PASS | 0 | Descriptive test names encode intent; describe groups per AC/test-ID. |
| Test IDs                             | ✅ PASS | 0 | 4.x-UNIT / 4.x-GOLDEN IDs on every group, mapped to test-design. |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS | 0 | `[P0]`/`[P1]` markers present in golden/pack tests; P3 exploratory labelled. |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS | 0 | None — pure synchronous units. |
| Determinism (no conditionals)        | ✅ PASS | 1 (LOW) | Only result-shape narrowing branches in ATDD scaffolds; no flaky flow control. |
| Isolation (cleanup, no shared state) | ✅ PASS | 0 | Pure functions, no cleanup needed, parallel-safe. |
| Fixture Patterns                     | ✅ PASS | 0 | Golden JSON fixtures with `_doc`/`policy`/cases + origin labels; schema-shape guard. |
| Data Factories                       | ✅ PASS | 0 | N/A for pure logic; inline typed inputs — appropriate at this level. |
| Network-First Pattern                | ✅ PASS | 0 | N/A — no network surface (correct for pure units). |
| Explicit Assertions                  | ✅ PASS | 0 | `assert.*` in test bodies; helpers only extract/narrow, not assert-hide. |
| Test Length (≤300 lines)             | ⚠️ WARN | 6 files | Six files 317–500 lines; individual tests small. |
| Test Duration (≤1.5 min)             | ✅ PASS | 0 | 188 tests / 491 ms measured. |
| Flakiness Patterns                   | ✅ PASS | 0 | No timers/random/order-dependence/network. |

**Total Violations**: 0 Critical, 0 High, 6 Medium, 2 Low

---

## Quality Score Breakdown

Scored per the workflow's four weighted dimensions (Determinism 30%, Isolation 30%, Maintainability 25%, Performance 15%); each dimension `100 − Σ(HIGH×10 + MEDIUM×5 + LOW×2)`.

```
Dimension scores:
  Determinism:      98/100 (A)   [1 LOW]
  Isolation:       100/100 (A)   [clean]
  Maintainability:  74/100 (C)   [6 MEDIUM + 1 LOW]
  Performance:     100/100 (A)   [clean]

Weighted overall = 98×0.30 + 100×0.30 + 74×0.25 + 100×0.15
                 = 29.4 + 30.0 + 18.5 + 15.0
                 = 92.9  →  93/100

Final Score:      93/100
Grade:            A (Excellent)
```

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Split the six >300-line test files by AC group

**Severity**: P2 (Medium)
**Location**: `tests/unit/lib/money/tax.test.ts:1` (500), `golden-pack.test.ts:1` (422), `vat.test.ts:1` (342), `ore.test.ts:1` (318), `tax.edges.test.ts:1` (317), `vat.coverage.test.ts:1` (317)
**Criterion**: Test Length (≤300 lines) / Maintainability
**Knowledge Base**: [test-quality.md](../../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
Six files exceed the 300-line Definition-of-Done guideline. Note this is a file-size guideline, not a per-test one — the individual tests are all small and focused (the DoD's hard concern is oversized *tests*, which do not exist here). The length is driven by rich provenance headers plus many small tests under one file. Splitting `tax.test.ts` by AC group (shape / mix / sign-off / PII / snapshot) would bring each file under the guideline and shorten diff/blast-radius on future edits.

**Benefits**: Smaller, feature-scoped files are faster to locate and lower-risk to edit; failures point at a narrower area.

**Priority**: P2 — readability polish; no correctness/reliability impact, so it does not block merge.

### 2. Extract duplicated typed-result test helpers into a shared support module

**Severity**: P2 (Medium)
**Location**: `tests/unit/lib/money/{ore,vat,tax,golden-pack,golden-pack-coverage}.test.ts`
**Criterion**: Maintainability (DRY)
**Knowledge Base**: [fixture-architecture.md](../../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/fixture-architecture.md)

**Issue Description**:
`isOk` / `isErr` / `okOre` / `okNumber` / `assertNoRawEcho` are re-declared near-identically in ~6 files. A single `tests/support/money-result.ts` (data extraction / narrowing only — no hidden assertions, preserving the explicit-assertion rule) would remove the drift risk when the `OreResult` shape evolves.

**Benefits**: One authority for the result-shape helpers; less copy-paste; the explicit `assert.*` calls stay in the test bodies.

**Priority**: P2 — DRY improvement; safe follow-up.

### 3. Tighten residual tolerant either-shape branches in the ATDD scaffolds

**Severity**: P3 (Low)
**Location**: `tests/unit/lib/money/ore.test.ts`, `vat.test.ts`, `tax.test.ts` (4.1/4.2/4.3 scaffolds)
**Criterion**: Determinism
**Knowledge Base**: [test-quality.md](../../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
The red-phase scaffolds deliberately accepted either typed-failure surface (`{ok:false}` OR `Result<T,C>`) so the dev could pick the shape without rewriting tests. The engine now returns a fixed `OreResult`, and the `*-edges` / `*-coverage` / `*-golden` files already pin the concrete shape. The remaining tolerant branches in the scaffolds are harmless but now redundant.

**Benefits**: Removes the last shape-conditional branches; every path becomes single-shape and unambiguous.

**Priority**: P3 — cosmetic; no reliability impact (tests are green and deterministic).

---

## Best Practices Found

### 1. Sum-of-rounded vs round-of-sum pinned as a load-bearing invariant

**Location**: `tests/unit/lib/money/vat.test.ts:164` (`[LOAD-BEARING] section VAT is sum-of-rounded, NOT round-of-summed-VAT`)
**Pattern**: Policy assertion, not a math approximation
**Knowledge Base**: [test-quality.md](../../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Why This Is Good**: The test asserts the exact rounding ORDER (three 0.5-öre lines → sum-of-rounded 3, not round-of-sum 2) and explicitly `assert.notEqual`s the wrong value, so an accidental round-at-end regression fails loud with an explainable message. This is precisely the "policy assertion" the test-design flagged as load-bearing.

### 2. Behavioral sign-off gating (absence-of-approval as a structural default)

**Location**: `tests/unit/lib/money/tax.test.ts:298` (`the engine NEVER renders/persists a tax output as approved`)
**Pattern**: Behavioral (not merely field-presence) assertion for compliance
**Knowledge Base**: [test-priorities-matrix.md](../../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-priorities-matrix.md)

**Why This Is Good**: Rather than only checking a warning field exists, it serializes the result and asserts NO truthy `approved`/`isApproved` marker can appear, and that `requiresSignOff` is the default — enforcing the R-405 epic blocker at the behavior level.

### 3. Explainable golden oracle with three-way origin labelling + live-engine verification

**Location**: `tests/unit/lib/money/golden-pack.test.ts:217` and `golden-pack-coverage.test.ts:206`
**Pattern**: Labelled golden master where every expected value is `old-lovable` / `new-expected` / `documented-delta`, and the NEW numbers are reproduced by the real engine
**Knowledge Base**: [test-levels-framework.md](../../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md)

**Why This Is Good**: A failing golden points at the affected assumption/delta instead of an unexplained diff (R-410). The coverage companion even drives `lineNetOre`+`sumOre` to reproduce the documented `newExpectedOre` (69 öre) so the migration delta is a live oracle on both sides, not prose.

### 4. Source-level PII guard on the pure engine

**Location**: `tests/unit/lib/money/tax.test.ts:423` (`the src/lib/money/tax.ts source reads NO personnummer/PII field`)
**Pattern**: Static source-scan assertion backing a data-privacy invariant (R-412)
**Why This Is Good**: Strips comments then greps the actual engine source for `personnummer`/`orgnr`, proving no PII path exists in `src/lib/money` — a durable guard against future drift, complementing the runtime "no PII echoed" check.

---

## Test File Analysis

### Suite Metadata

- **Scope**: `tests/unit/lib/money/**` (12 files) + `tests/fixtures/golden/money/*.json` (5 fixtures)
- **Total test cases**: 177 `test()` blocks (188 executed cases incl. parametrized iterations)
- **Test Framework**: `node:test` (`node --experimental-strip-types`, `pnpm run test:unit`)
- **Language**: TypeScript
- **Measured run**: 188 pass / 0 fail / 0 skip in 491 ms

### Files In Scope

| File | Lines | Story / Test IDs |
| --- | --- | --- |
| ore.test.ts | 318 | 4.1-UNIT-01..07 |
| ore-edges.test.ts | 233 | 4.1 edge/branch supplement |
| roundtrip.test.ts | 56 | 4.1 property/round-trip (P3) |
| rounding.golden.test.ts | 164 | 4.1-GOLDEN-01 |
| vat.test.ts | 342 | 4.2-UNIT-01..06 |
| vat.coverage.test.ts | 317 | 4.2 coverage expansion |
| vat.golden.test.ts | 237 | 4.2-GOLDEN-01 |
| tax.test.ts | 500 | 4.3-UNIT-01..07 |
| tax.edges.test.ts | 317 | 4.3 edge/branch supplement |
| tax.golden.test.ts | 297 | 4.3-GOLDEN-01/02 |
| golden-pack.test.ts | 422 | 4.4-GOLDEN-01/02, 4.4-UNIT-01/02 |
| golden-pack-coverage.test.ts | 250 | 4.4 live-oracle expansion |

### Assertions Analysis

- Dense, explicit assertions in-body (e.g. ore.test.ts 50, vat.coverage.test.ts 78, tax.edges.test.ts 58).
- Helpers extract/narrow only; assertions remain visible per the explicit-assertion DoD rule.

---

## Context and Integration

### Related Artifacts

- **Test Design**: [test-design-epic-4.md](../test-design-epic-4.md)
- **Risk Assessment**: 14 risks (10 high ≥6); this suite verifies R-401/402/403/404/405/406/407/409/410/411/412/413.
- **Priority Framework**: P0–P3 applied (test IDs map to the design's coverage plan).

### Coverage Boundary

`test-review` does not score coverage. The design's coverage-completeness and gate decision are a `trace` concern — recommend running `*trace` at the epic boundary to build the traceability matrix and feed R-401–R-411 into the gate.

---

## Knowledge Base References

- **test-quality.md** — Definition of Done (no hard waits, <300 lines, <1.5 min, self-cleaning, explicit assertions)
- **test-levels-framework.md** — pure calculation ⇒ UNIT/GOLDEN, avoid DB/E2E (correctly applied)
- **test-priorities-matrix.md** — P0/P1/P2/P3 classification
- **data-factories.md** — isolated, parallel-safe data (inline typed inputs appropriate at unit level)

---

## Next Steps

### Immediate Actions (Before Merge)

None required. Test quality is Approve-grade.

### Follow-up Actions (Future PRs)

1. **Split the six >300-line files by AC group** — Priority P2, Target: maintenance backlog.
2. **Extract shared `OreResult` test helpers to `tests/support/`** — Priority P2, Target: maintenance backlog.
3. **Tighten residual tolerant-shape branches in the ATDD scaffolds** — Priority P3, Target: backlog.
4. **Run `*trace` at the epic boundary** — build the traceability matrix + gate decision (coverage is out of scope here).

### Re-Review Needed?

✅ No re-review needed — approve as-is.

---

## Decision

**Recommendation**: Approve

**Rationale**:
Test quality is excellent with a 93/100 (Grade A) score. The suite is deterministic, perfectly isolated, and fast (188 tests in ~0.5 s, all green), and it pins the exact money/tax policy invariants that Epics 5–7 will inherit — the highest-leverage correctness surface in the project. The only findings are maintainability polish (six files over the 300-line guideline; duplicated typed-result helpers; a few redundant tolerant-shape branches left from the ATDD red phase), none of which affect correctness, reliability, or speed. These are safe to address in a follow-up PR and do not block merge.

---

## Appendix

### Violation Summary by Location

| Location | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- |
| tax.test.ts (500) | P2 | Test Length | File > 300 lines | Split by AC group |
| golden-pack.test.ts (422) | P2 | Test Length | File > 300 lines | Split privacy scan out |
| vat.test.ts (342) | P2 | Test Length | File > 300 lines | Optional split |
| ore.test.ts (318) | P2 | Test Length | File > 300 lines | Optional trim |
| tax.edges.test.ts (317) | P2 | Test Length | File > 300 lines | Optional trim |
| vat.coverage.test.ts (317) | P2 | Test Length | File > 300 lines | Optional trim |
| {ore,vat,tax,golden-pack,...}.test.ts | P3 | Maintainability | Duplicated result helpers | Extract to tests/support |
| {ore,vat,tax}.test.ts scaffolds | P3 | Determinism | Redundant tolerant-shape branches | Pin to OreResult |

### Related Reviews

| Scope | Score | Grade | Critical | Status |
| --- | --- | --- | --- | --- |
| Epic 4 money/tax suite (`tests/unit/lib/money/**`) | 93/100 | A | 0 | Approved |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v4.0 (BMad v6)
**Review Scope**: suite (Epic 4)
**Timestamp**: 2026-07-02
**Version**: 1.0
