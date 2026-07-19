---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: '2026-07-19'
workflowType: testarch-test-review
reviewScope: suite
reviewTarget: 'Epic 10 — Quote Lifecycle Completion (+ Phase B Governance Re-Baseline), tests added across Stories 10.1–10.4'
executionMode: sequential
inputDocuments:
  - _bmad/tea/config.yaml (TEA config; tea_use_playwright_utils true, tea_browser_automation auto)
  - resources/knowledge/test-quality.md (Definition of Done; core-tier quality fragment)
  - _bmad-output/test-artifacts/traceability/epic-10-traceability-report.md (coverage gate PASS — cross-referenced for test→AC map, NOT re-scored here)
  - 28 epic-10 test files under tests/unit/**, tests/integration/**, tests/e2e/quotes/** (enumerated in Test File Inventory)
---

# Test Quality Review: Epic 10 Suite (Stories 10.1–10.4)

**Quality Score**: 94/100 (A — Excellent)
**Review Date**: 2026-07-19
**Review Scope**: suite (the 28 test files added across Epic 10)
**Reviewer**: TEA — Master Test Architect (BMad)

---

Note: This review audits **test quality** (determinism, isolation, maintainability, performance). It does
**not** score coverage — Epic 10 coverage is decided in
[epic-10-traceability-report.md](../traceability/epic-10-traceability-report.md) (gate: PASS, 17/17 ACs FULL).
Use `trace` for any coverage question.

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve (with one non-blocking follow-up)

### Key Strengths

✅ **Determinism is textbook.** Every time-dependent path takes an INJECTED clock/instant (`fixedClock`
   over `FIXED_ISO`, `NOON_UTC`, `SEED_INSTANT`); zero `Date.now()`/`new Date()` on production paths, zero
   `Math.random()`, zero `waitForTimeout` hard waits, zero `.only`. The follow-up date tests even prove the
   classifier is DST-aware (winter UTC+1 vs summer UTC+2) rather than a hard-coded offset, and the
   read-model test derives its period window from its own seed instant to avoid a "hardcoded-July time-bomb".
✅ **Test IDs + priority markers everywhere.** Every case carries a stable id (`10.2-INT-02`,
   `10.1-UNIT-DERIVE-05`, `10.4-UNIT-01`, …) and an explicit `[P0]`/`[P1]` marker, tracing straight to ACs
   and risks. Assertions are explicit and message-bearing, in the test body — never hidden in helpers.
✅ **Strong isolation primitives.** Per-run `crypto.randomUUID()` seeds (no hard-coded ids/emails),
   two-tenant fixtures with real cross-tenant negatives, `afterAll` fixture cleanup, and pure `node --test`
   units with no shared state. Negatives are genuine (own-tenant UPDATE→42501, illegal transition rejected
   at command AND DB, `=== 1` cross-tenant counts rather than tautological `>= 0`).
✅ **Fast by construction.** Integration setup is admin-SQL/API seeding (never UI), pure logic is on the
   `node --test` gate not Playwright, the expensive two-tenant fixture is built once per file in `beforeAll`,
   and there is no unnecessary `.serial`.

### Key Weaknesses

❌ **Stale RED-phase header comments in 9 of 28 files** contradict their now-active GREEN code (documentation
   hygiene, not a functional defect) — the single material finding.
❌ **Two integration files exceed the 300-line DoD guideline** (371 and 321 lines) — file-level only; the
   individual tests within are short.
❌ **Shared-fixture + `afterAll`-only cleanup** means intra-file data accumulates and one read-model test
   leans on intra-file seed ordering in its narration — safe under Vitest's in-file serial execution, but it
   constrains per-test parallelism.

### Summary

Epic 10's tests are high-quality and production-ready: deterministic, well-identified, explicitly asserted,
and layered correctly (pure logic as `node --test` units, DB/RLS enforcement as Vitest integration, UI states
as Playwright e2e — the "two-runner discipline" the epic retro mandated). The only real finding is
documentation debt: during the RED→GREEN transition, ~14 files had their header docblocks updated to a
"GREEN (Story 10.X implemented)" statement, but 9 files kept RED-phase narration ("WHY the top `describe` is
skipped", "the whole suite is `describe.skip`", "implementation not yet landed") even though their `describe`
blocks are now active and green — in several files the same header both says "skipped (RED PHASE)" and labels
the describe "GREEN". This misleads a future maintainer but does not affect correctness, determinism, or CI
behaviour. Recommendation is **Approve**; schedule the comment cleanup as a low-priority follow-up.

---

## Quality Criteria Assessment

| Criterion                            | Status   | Violations | Notes |
| ------------------------------------ | -------- | ---------- | ----- |
| BDD / clear intent naming            | ✅ PASS  | 0          | Every test name states the concrete behaviour + the AC/risk it proves. |
| Test IDs                             | ✅ PASS  | 0          | Stable ids on 100% of cases (`10.x-UNIT/INT/RLS/E2E/GOLDEN/DOCS-*`). |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS  | 0          | `[P0]`/`[P1]` present on integration/e2e; unit ids map to the P0–P2 plan. |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS  | 0          | None. E2E uses `expect().toBeVisible()`, `toHaveURL`, and a hydration-condition wait. |
| Determinism (clocks, random, order)  | ✅ PASS  | 1 (LOW)    | Injected clocks/instants throughout; only nit is an unbounded rAF hydration poll. |
| Isolation (cleanup, no shared state) | ⚠️ WARN  | 2 (LOW)    | `afterAll`-only cleanup on shared fixtures; one read-model test narrates intra-file ordering. |
| Fixture Patterns                     | ✅ PASS  | 0          | `createTwoTenantFixture` + typed factory helpers; setup-only helpers, not hidden assertions. |
| Data Factories                       | ✅ PASS  | 0          | `adminInsert*` factories + `crypto.randomUUID()` unique seeds. |
| Network-First Pattern                | ✅ PASS  | 0          | N/A for units/integration; e2e seeds via global-setup fixture, no racey UI-driven setup. |
| Explicit Assertions                  | ✅ PASS  | 0          | All `expect`/`assert` in test bodies with descriptive failure messages. |
| Test Length (≤300 lines)             | ⚠️ WARN  | 2 (LOW)    | `quote-follow-ups.int` 371, `mark-quote-version-lost.int` 321 (file-level; per-test short). |
| Determinism of data windows          | ✅ PASS  | 0          | Period windows derived from a fixed seed instant (no wall-clock time-bomb). |
| Stale/contradictory comments         | ❌ FAIL  | 1 (MEDIUM) | 9 files retain RED-phase "is skipped"/"not yet landed" headers over active GREEN code. |

**Total Violations**: 0 Critical, 0 High, 1 Medium, 5 Low

---

## Quality Score Breakdown

Per-dimension scores (skill rubric: 100 − Σ severity penalty; HIGH −10 / MEDIUM −5 / LOW −2), then weighted
(determinism 0.30, isolation 0.30, maintainability 0.25, performance 0.15).

```
Determinism      98/100 (A)   − 1×LOW  (unbounded rAF hydration wait)
Isolation        95/100 (A)   − 2×LOW  (afterAll-only cleanup; intra-file seed-order narration)
Maintainability  86/100 (B)   − 1×MEDIUM (stale RED-phase headers, 9 files)
                              − 2×LOW  (two files >300 lines)
Performance      98/100 (A)   − 1×LOW  (shared-fixture accumulation limits per-test parallelism)

Weighted overall = 98×0.30 + 95×0.30 + 86×0.25 + 98×0.15
                 = 29.4 + 28.5 + 21.5 + 14.7
                 = 94.1  → 94/100

Final Score:  94/100
Grade:        A (Excellent)
```

---

## Critical Issues (Must Fix)

No critical issues detected. ✅ No P0/High test-quality violation was found. Every negative path is genuine
(no `assert.ok(true)` filler, no tautological assertions, no swallowed failures), all clocks are injected,
and there are no hard waits, random data, or `.only`/accidental `.skip` on live suites.

---

## Recommendations (Should Fix)

### 1. Purge stale RED-phase header comments from GREEN suites

**Severity**: P2 (Medium) — documentation hygiene; misleads maintainers, no functional impact
**Criterion**: Maintainability (stale/contradictory comments)
**Knowledge Base**: [test-quality.md](../../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md) — "if a pattern is justified, document it with a comment" (corollary: comments must match the code)

**Issue Description**:
During the ATDD RED→GREEN transition, ~14 Epic 10 files had their header docblocks updated to a
`── GREEN (Story 10.X implemented) ──` statement, but **9 files kept RED-phase narration** that now
contradicts their active code. In several files the same header simultaneously claims the suite is skipped
AND the `describe` is labelled "GREEN". A maintainer reading the header would believe the suite does not run.

Affected files (all verified to have **active, non-skipped** `describe`/`test` blocks on disk):

| File | Stale claim in header | Reality |
| --- | --- | --- |
| `tests/integration/commands/mark-quote-version-lost.int.test.ts` | "WHY the top `describe` is skipped (RED PHASE)"; "the whole suite is `describe.skip`"; "remove `.skip`"; inline "RED-PHASE cast: the `never` command placeholder" (l.141) | l.66 imports the real `markQuoteVersionLost`; l.127 `describe(... GREEN — Story 10.2 implemented)`, not skipped |
| `tests/e2e/quotes/quote-lost-reason.e2e.spec.ts` | "WHY `test.describe.skip` (RED PHASE)"; "The suite is `test.describe.skip` so it cannot fail CI" | l.85 `test.describe(...)` — no `.skip`; drives the real surface (trace: quote e2e 40/40 green) |
| `tests/integration/rls/quote-lost-reasons-migration-reset.int.test.ts` | "RED PHASE (Story 10.2 not yet implemented)"; "`describe.skip`" | l.64 active `describe(...)`; migration landed |
| `tests/unit/features/quotes/lost-transition-coherence.test.ts` | "WHY the top `describe` is skipped (RED PHASE)" | l.69 active `describe`, l.70 label "GREEN — Story 10.2 implemented" |
| `tests/unit/features/quotes/lost-version-golden.test.ts` | "WHY the top `describe` is skipped (RED PHASE)" | l.86 active `describe`, l.87 label "GREEN — fixture authored" |
| `tests/unit/scope/manifest-shape.test.ts` | "RED PHASE (implementation not yet landed)" | manifest landed; tests active + green |
| `tests/unit/scope/manifest-coherence.test.ts` | "RED PHASE (implementation not yet landed)" | manifest landed; tests active + green |
| `tests/unit/scope/manifest-derivations.test.ts` | "RED PHASE (implementation not yet landed)" | manifest landed; tests active + green |
| `tests/unit/scope/governance-rebaseline.test.ts` | "RED PHASE (implementation not yet landed)" | docs re-baselined; tests active + green |

**Recommended Fix**:
Replace the "WHY skipped / not yet landed" sections with the same `── GREEN (Story 10.X implemented) ──`
statement the sibling files already use, and delete the inline "RED-PHASE cast" comment in
`mark-quote-version-lost.int.test.ts:141` (the cast is no longer over a placeholder — the real command is
imported). Keep the valuable AC/risk/source provenance blocks; only the skip-state narration is wrong.

**Why This Matters**:
A header that says "the whole suite is `describe.skip`" over a suite that actually runs is an active
correctness hazard for the *next* editor — someone could "helpfully" re-add a `.skip`, or assume the proofs
are inert and weaken them. The assertions are the contract; the comments must not undercut them.

### 2. Split or annotate the two >300-line integration files

**Severity**: P3 (Low)
**Criterion**: Test Length (DoD ≤300 lines)
**Location**: `tests/integration/commands/quote-follow-ups.int.test.ts` (371), `tests/integration/commands/mark-quote-version-lost.int.test.ts` (321)

**Issue Description**:
Both exceed the 300-line DoD guideline. This is file-level, not per-test — the individual `it()` blocks are
~15–35 lines and each proves one concern (plan/complete/annotate/one-open/cross-tenant/auto-complete-on-lost).

**Recommended Improvement**:
Optional: extract the shared `seed*QuoteVersion`/`plan` helpers into `tests/factories/` (they are already
setup-only, no hidden assertions) to bring each file under the threshold, or accept as-is given the cohesive
P0 scenario cluster. Not blocking.

### 3. (Informational) Shared-fixture `afterAll`-only cleanup constrains per-test parallelism

**Severity**: P3 (Low)
**Criterion**: Isolation / Performance
**Location**: all `*.int.test.ts` / `*.rls.test.ts` using `createTwoTenantFixture` in `beforeAll`

**Issue Description**:
Rows created by each test accumulate on the shared two-tenant fixture until `afterAll` cleanup. Tests stay
independent because every test seeds its own uniquely-id'd quote/version, and `quote-pipeline-read-model.rls`
proves isolation with exact `=== 1` / `=== 0` counts rather than `>= 0`. But the pattern relies on Vitest's
in-file serial execution and would not survive per-test parallelization within a file. This is the
established Phase-A harness convention; no change recommended, noted for awareness.

---

## Best Practices Found (use as reference for later Phase B epics)

### 1. Injected-clock + derived-window determinism
**Location**: `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:71-72`, all command tests' `fixedClock`
Period windows are derived from a fixed `SEED_INSTANT` via the same pure helper the read-model uses, so seeded
events are unambiguously in-window on any run date — explicitly avoiding a "hardcoded-July time-bomb". Commands
take a `CommandClock` and assert `completed_at === FIXED_ISO`. This is the gold standard for time-dependent tests.

### 2. Non-circular derivation proofs
**Location**: `tests/unit/scope/manifest-derivations.test.ts:29-69, 122-133`
Each manifest derivation is proven equal to an INDEPENDENT ground truth (a pinned Phase-A literal, or the
still-authored `nav-items` hrefs / live deny-list export) — never derived==derived. DERIVE-06 proves an
unlisted surface can never appear in the derived union (fail-loud retained). Exemplary guardrail testing.

### 3. Genuine, non-tautological cross-tenant negatives
**Location**: `tests/integration/rls/quote-pipeline-read-model.rls.test.ts:126-149`, `tests/integration/commands/quote-follow-ups.int.test.ts:345-370`
Cross-tenant tests use a REAL other-tenant row (never a non-existent id), assert exact counts (`=== 1`, not
`>= 0`), and check the error message does NOT leak a cross-tenant existence signal (`not.toMatch(/exist|tenant b/i)`).
Structural "no service-role import" is asserted by reading the source text — a bypass is caught without a stack.

### 4. Allow-list PII discipline asserted in tests
**Location**: `tests/integration/commands/quote-follow-ups.int.test.ts:157-159, 254-255`
Audit-metadata tests assert `metadata` equals `{}` AND that free-text (`ring kund`, `notering`) does NOT appear
in the serialized audit row — the test itself enforces that possible-PII never leaks into audit events.

---

## Test File Inventory (28 files, ~4,621 lines)

**Unit — pure logic (`node --test`, no DB):**
`tests/unit/scope/{governance-rebaseline, manifest-shape, manifest-schema-selectors, manifest-derivations,
manifest-coherence, manifest-invariants}.test.ts`;
`tests/unit/features/quotes/{follow-up-dates, follow-up-view, lost-transition-coherence, lost-version-golden}.test.ts`;
`tests/unit/server/commands/{follow-up-validation, mark-lost-validation}.test.ts`;
`tests/unit/server/read-models/{entitlements, quote-pipeline-aggregate}.test.ts`;
`tests/unit/components/quotes/follow-up-tone.test.ts`

**Integration — commands / features / components (Vitest, local Supabase):**
`tests/integration/commands/{mark-quote-version-lost, quote-follow-ups}.int.test.ts`;
`tests/integration/features/quotes/{quote-pipeline-list-filters, quote-pipeline-non-scope-guard}.int.test.ts`;
`tests/integration/components/follow-up-error-visibility.test.ts`

**Integration — RLS / migration-reset (Vitest, local Supabase):**
`tests/integration/rls/{quote-lost-reasons.rls, quote-lost-reasons-migration-reset.int, quote-follow-ups.rls,
quote-follow-ups-migration-reset.int, quote-pipeline-read-model.rls}.test.ts`

**E2E (Playwright):**
`tests/e2e/quotes/{quote-lost-reason, quote-follow-up, quote-pipeline-consistency}.e2e.spec.ts`

### Framework & Structure
- **Frameworks**: `node:test`/`assert` (pure units), Vitest (integration/RLS), Playwright (e2e) — correct
  two-runner discipline; pure logic never on Playwright.
- **Determinism controls**: injected `CommandClock`/instants, `crypto.randomUUID()` seeds, derived period
  windows. **No** `Math.random`, `Date.now()` on paths, `waitForTimeout`, `.serial`, or `.only`.
- **Isolation controls**: two-tenant fixtures, `afterAll` cleanup, unique per-run ids, pure units.
- **Stack gating**: `skipUnlessStack` is a reachability gate only; CI sets `SUPABASE_TEST_REQUIRED=1` so
  integration/RLS proofs cannot be silently skipped in CI (verified in headers, not just prose).

---

## Context and Integration

### Related Artifacts
- **Traceability (coverage gate)**: [epic-10-traceability-report.md](../traceability/epic-10-traceability-report.md) — PASS, 17/17 ACs FULL, all 8 high-priority risks + 8 epic-blocker controls mitigated.
- **Story files**: `_bmad-output/implementation-artifacts/10-1..10-4-*.md` (all `review`; adversarial code review Critical/High findings resolved).
- **Test design**: `_bmad-output/test-artifacts/test-design-epic-10.md` (25 risks, P0–P3 plan).

### Coverage Boundary
`test-review` does **not** score coverage. Epic 10 coverage is FULL per the trace gate above. This review
found no quality reason to revisit that decision.

---

## Next Steps

### Immediate Actions (Before Merge)
_None._ No blocking test-quality issue. The suite is approvable as-is.

### Follow-up Actions (Future PRs)
1. **Purge stale RED-phase header comments (Recommendation 1)** — 9 files; align headers to the
   `── GREEN (Story 10.X implemented) ──` convention already used by their siblings; drop the inline
   "RED-PHASE cast" comment in `mark-quote-version-lost.int.test.ts:141`.
   - Priority: P2 · Target: next docs/test-hygiene PR · Effort: ~20 min
2. **Optionally extract shared integration seed helpers to `tests/factories/`** to bring the two >300-line
   files under the DoD line guideline (Recommendation 2).
   - Priority: P3 · Target: backlog

### Re-Review Needed?
✅ No re-review needed — approve as-is. The follow-up comment cleanup is low-priority and does not require a
re-review of the suite.

---

## Decision

**Recommendation**: Approve (with comments)

**Rationale**:
Test quality is excellent at **94/100 (A)**. Determinism, explicit-assertion discipline, test identification,
layering, and genuine (non-tautological) negatives are all at reference standard, and there are zero critical
or high violations. The one medium finding — stale RED-phase header comments in 9 of 28 files that contradict
their now-GREEN code — is documentation hygiene only; it does not affect correctness, determinism, isolation,
performance, or CI behaviour, and the sibling files already show the correct "GREEN" header pattern to copy.
Tests are production-ready; the header cleanup can land in a low-priority follow-up.

---

## Appendix — Violation Summary

| Severity | Dimension | Finding | Location(s) |
| --- | --- | --- | --- |
| MEDIUM | Maintainability | Stale RED-phase "is skipped"/"not yet landed" headers over active GREEN code | 9 files (see Recommendation 1 table) |
| LOW | Maintainability | File exceeds 300-line DoD guideline | `quote-follow-ups.int.test.ts` (371) |
| LOW | Maintainability | File exceeds 300-line DoD guideline | `mark-quote-version-lost.int.test.ts` (321) |
| LOW | Determinism | Unbounded `requestAnimationFrame` hydration-poll (condition wait, bounded only by Playwright test timeout) | `quote-lost-reason.e2e.spec.ts:63-73` (shared `waitForHydrated`) |
| LOW | Isolation | `afterAll`-only cleanup accumulates rows on shared fixture | all `*.int`/`*.rls` suites |
| LOW | Isolation/Perf | Read-model test narrates intra-file seed ordering; constrains per-test parallelism | `quote-pipeline-read-model.rls.test.ts:126-149` |

---

## Review Metadata
**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review (suite scope, sequential execution)
**Review ID**: test-review-epic-10-suite-20260719
**Score**: 94/100 (A) · **Decision**: Approve with comments
