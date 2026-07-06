---
stepsCompleted:
  ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-07-06'
workflowType: 'testarch-test-review'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - 'tests/ (epic-6 changed test files, main..HEAD)'
  - '_bmad-output/test-artifacts/test-design-epic-6.md'
  - 'knowledge/test-quality.md'
  - 'knowledge/test-levels-framework.md'
  - 'knowledge/data-factories.md'
---

# Test Quality Review: Epic 6 — Quote Versions, PDF & Lifecycle (Suite)

**Quality Score**: 96/100 (A - Excellent)
**Review Date**: 2026-07-06
**Review Scope**: suite (all tests added across Epic 6, `main..HEAD` on `epic/6-quote-versions-pdf-and-lifecycle`)
**Reviewer**: TEA Agent (Master Test Architect)

---

Note: This review audits existing tests; it does not generate tests. Coverage mapping and coverage
gates are out of scope here — route those to `trace`. Scoring covers determinism, isolation,
maintainability, and performance only.

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve

Scope reviewed: 37 test/spec files (~278 `it/test` cases across 37 `describe` blocks) added by Epic 6
stories 6-1 through 6-5, spanning three levels:

- **Unit** (`node --test`, pure, no DB/clock/PII) — snapshot builder, golden packs, PDF view-model,
  lifecycle/send-gate/timeline logic, command-validation and error-mapper units, non-scope guardrails.
- **Integration** (`vitest` against the local Supabase stack) — command envelope proofs (create new
  version, mark-sent, update-draft, PDF determinism/retry/source-of-truth/storage-privacy), plus RLS
  cross-tenant isolation and migration-reset inventories.
- **E2E** (`playwright`) — quote detail/timeline UX, sent-lock, new-version, and PDF states against
  the real app with a two-tenant seeded fixture.

### Key Strengths

✅ Deterministic time everywhere it matters: an injected `CommandClock`/`capturedAt` (`FIXED_ISO`)
   pins every timestamp in unit + integration proofs — zero wall-clock sleeps, zero `waitForTimeout`.
✅ Textbook isolation: per-run unique ids via `crypto.randomUUID()`, `cleanupFixture` teardown in
   `afterAll`, dedicated per-mutation E2E fixtures, and a hard-fail stack gate in CI
   (`SUPABASE_TEST_REQUIRED=1`) so DB-backed immutability proofs can never silently skip.
✅ Explicit assertions live in the test bodies (helpers only shape/extract data), with rich
   `[Source: …]` traceability headers tying each case to test-design IDs, ACs, and risk codes.
✅ Real below-the-UI security proofs: sent-lock and child-lock triggers are asserted through a
   genuine authenticated anon-key RLS client (not BYPASSRLS), plus negative leak-shape assertions
   (`res.message` never echoes internal codes / cross-tenant existence / PII).

### Key Weaknesses

❌ One E2E test mutates a shared seeded draft (`draftVersionId.intro_text`) in place without
   restoring it — a minor re-run/ordering isolation smell (MEDIUM).
❌ Seven integration/RLS files exceed the 300-line DoD soft cap (up to 548 lines); they are
   composed of many focused `it()` blocks rather than monolithic tests, but the file size still
   trips the maintainability heuristic (MEDIUM).
❌ The E2E `waitForHydrated` helper sniffs React internal `__react*` keys — deterministic today but
   brittle to a framework/runtime change (LOW).

### Summary

This is a high-maturity test suite. The Epic-6 stories carry load-bearing money/immutability
correctness, and the tests treat that seriously: dual-layer enforcement (command guard + DB trigger),
golden-master snapshot behavior with an öre/basis-point discipline and a PII privacy scan, and
authenticated cross-tenant negative paths. Determinism and isolation — the two heaviest-weighted
dimensions — are effectively best-in-class. The only findings are low-risk polish items that do not
threaten reliability or block merge. **Approve.**

---

## Quality Criteria Assessment

| Criterion                            | Status    | Violations | Notes                                                                 |
| ------------------------------------ | --------- | ---------- | --------------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | ✅ PASS   | 0          | Descriptive `it()` names + inline comments carry Given/When/Then.     |
| Test IDs                             | ✅ PASS   | 0          | Test-design IDs embedded (e.g. `6.4-INT-03`, `6.1-GOLDEN-01`).        |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS   | 0          | `[P0]` markers throughout; risk codes (R-605/R-608/R-615) referenced. |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS   | 0          | None found; E2E uses `expect().toBeVisible()`/hydration polling.      |
| Determinism (no conditionals)        | ✅ PASS   | 0          | `if (!res.ok) return` is type-narrowing after assert, not flow ctrl.  |
| Isolation (cleanup, no shared state) | ⚠️ WARN   | 1          | 1 E2E mutates shared seeded draft in place (MEDIUM).                  |
| Fixture Patterns                     | ✅ PASS   | 0          | `createTwoTenantFixture`/`cleanupFixture`, dedicated mutation quotes. |
| Data Factories                       | ✅ PASS   | 0          | `adminInsert*` helpers with unique-suffix overrides.                  |
| Network-First Pattern                | ✅ PASS   | 0          | E2E awaits hydration + element state before asserting.               |
| Explicit Assertions                  | ✅ PASS   | 0          | Assertions in bodies; helpers only extract (e.g. `catchMapped`).      |
| Test Length (≤300 lines)             | ⚠️ WARN   | 7          | 7 int/RLS files 307–548 lines (many focused `it()` blocks) (MEDIUM). |
| Test Duration (≤1.5 min)             | ✅ PASS   | 0          | Admin/API seeding, no UI setup, parallel-safe.                        |
| Flakiness Patterns                   | ✅ PASS   | 0          | No `Math.random`, no unmocked time, no race-prone waits.             |

**Total Violations**: 0 Critical, 0 High, 2 Medium, 3 Low

---

## Quality Score Breakdown

Per the workflow's four weighted dimensions (Determinism 30% · Isolation 30% · Maintainability 25% ·
Performance 15%). Each dimension: `score = 100 − Σ(severity penalty)` with HIGH −10 / MEDIUM −5 / LOW −2.

```
Determinism      98/100 (A)  — 1 LOW: Date.now() for unique E2E data (quotes.e2e.spec.ts:147)
Isolation        95/100 (A)  — 1 MEDIUM: in-place mutation of shared seeded draft (quotes.e2e.spec.ts)
Maintainability  93/100 (A)  — 1 MEDIUM: 7 files >300 lines; 1 LOW: React-internals hydration sniff
Performance      98/100 (A)  — 1 LOW: full two-tenant beforeAll fixture repeated per int file

Weighted overall = 98·0.30 + 95·0.30 + 93·0.25 + 98·0.15
                 = 29.4 + 28.5 + 23.25 + 14.7
                 = 95.85  →  96/100

Final Score:             96/100
Grade:                   A (Excellent)
```

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Restore or self-seed the mutated draft in the E2E draft-edit test

**Severity**: P2 (Medium)
**Location**: `tests/e2e/quotes/quotes.e2e.spec.ts:142-151`
**Criterion**: Isolation (no shared-state mutation)
**Knowledge Base**: test-quality.md (Example 2: Isolated Test with Cleanup)

**Issue Description**: The "a DRAFT edit updates only the draft version" test fills and saves
`intro_text` on the globally-seeded `draftVersionId`. Because that row is shared across the file's
read-only assertions (and re-runs against a persistent local DB), the mutation is not restored. It
works today because the edited field isn't re-asserted afterward, but it is a latent ordering/re-run
coupling — exactly the class the sibling specs avoid by seeding dedicated mutation quotes
(`markSendQuote`, per-test `createNewVersion` targets).

**Recommended Improvement**: Seed a dedicated draft for the mutation case (mirror the
`quote-sent-lock.e2e.spec.ts` / `quote-new-version.e2e.spec.ts` per-mutation fixture pattern), or
reset `intro_text` in an `afterEach`. The uniqueness token itself (`Uppdaterad intro ${Date.now()}`)
is fine — keep it, just don't apply it to the shared seed.

**Benefits**: Removes the only cross-test coupling in the suite; keeps the file re-runnable in any
order against a warm DB.

**Priority**: P2 — no observed failure today; prevents future flake if assertions on that draft are added.

### 2. Consider splitting the largest integration/RLS files by concern

**Severity**: P2 (Medium)
**Location**: `create-new-quote-version.int.test.ts` (548), `quote-version.int.test.ts` (515),
`mark-quote-version-sent.int.test.ts` (510), `cross-tenant-isolation.rls.test.ts` (499),
`quote-tables-migration-reset.int.test.ts` (484), plus `file-tables-migration-reset` (358),
`migration-reset` (353)
**Criterion**: Test Length (≤300-line DoD soft cap)
**Knowledge Base**: test-quality.md (Example 4: Test Length Limits)

**Issue Description**: These files exceed the 300-line Definition-of-Done cap. Mitigating context:
the cap targets monolithic *single tests*, whereas these are collections of many small, focused
`it()` blocks sharing one `beforeAll` fixture — the readable-and-debuggable shape the DoD actually
wants. Still, at ~500+ lines a single file mixes several concerns (e.g. mark-sent AC1 transition +
R-605 layer-1 command guard + R-605 layer-2 DB trigger + R-608 send-gate + AC3 cross-tenant).

**Recommended Improvement**: Where a file spans clearly separable concerns, split along the
`describe` seams (e.g. a `*-immutability.int.test.ts` for the layer-2 trigger block) sharing the
existing seed helpers. Optional — treat as maintainability hygiene, not a correctness gap.

**Benefits**: Faster navigation, smaller blast radius per change, tighter parallel sharding.

**Priority**: P2 — cosmetic/maintainability; the current structure is already grouped and commented.

### 3. Reduce E2E coupling to React runtime internals in `waitForHydrated`

**Severity**: P3 (Low)
**Location**: `tests/e2e/quotes/quotes.e2e.spec.ts:37-47` (and the mirrored helper in sibling E2E specs)
**Criterion**: Selector/Timing Resilience
**Knowledge Base**: test-quality.md (Deterministic waits); selector-resilience.md

**Issue Description**: `waitForHydrated` polls `Object.keys(el).some(k => k.startsWith('__react'))`
to detect hydration. This is deterministic today but reaches into React's private fiber-key naming,
which is not a stable contract across React/runtime upgrades.

**Recommended Improvement**: Prefer a product-owned readiness signal — e.g. a `data-hydrated="true"`
attribute set on mount, or waiting on the network response that gates interactivity — over sniffing
`__react*` keys. Centralize the helper in `tests/e2e/support` so a future fix lands once.

**Benefits**: Insulates the whole E2E layer from a React-internals rename.

**Priority**: P3 — low likelihood, but a single point of future breakage.

---

## Best Practices Found

### 1. Injected clock → wall-clock-free determinism

**Location**: `tests/integration/commands/mark-quote-version-sent.int.test.ts:62-63,144,175`
**Pattern**: Dependency-injected `CommandClock` asserted exactly
**Knowledge Base**: test-quality.md (Example 1: Deterministic Test Pattern)

**Why This Is Good**: `occurred_at` is asserted `=== FIXED_ISO`, proving the write path consumes the
injected clock and never `Date.now()`. This turns a normally flake-prone timestamp assertion into an
exact-equality proof — and doubles as a regression guard against re-introducing wall-clock reads.

```typescript
const FIXED_ISO = "2026-07-06T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };
// ...
expect(sentEvent?.occurred_at).toBe(FIXED_ISO); // wall clock would drift → fails loud
```

### 2. Dual-layer immutability proven below the UI

**Location**: `mark-quote-version-sent.int.test.ts:237-432`
**Pattern**: Command-guard (layer 1) + DB-trigger (layer 2) via authenticated RLS client
**Knowledge Base**: test-levels-framework.md; data-factories.md

**Why This Is Good**: Rather than asserting "the UI disabled the button," the suite drives a *direct*
own-tenant authenticated UPDATE/INSERT on the anon-key RLS client and asserts the trigger RAISEs,
while confirming the exempt PDF-render columns and legal lifecycle transitions still succeed, and
that a status reversal / re-parent are rejected. This is genuine defense-in-depth evidence.

### 3. Golden pack with anti-vacuous-green + privacy discipline

**Location**: `tests/unit/lib/quote-snapshot/golden-pack.test.ts:192-243`
**Pattern**: Behavioral golden master + PII/secret scan + öre/bp invariants + `Object.isFrozen`
**Knowledge Base**: data-factories.md; test-quality.md

**Why This Is Good**: The pack asserts it is non-empty ("never a vacuous green"), enforces
labelling/origin schema so a future real-Lovable delta lands without a code-shape change, scans the
fixture payload for personnummer/orgnr/non-`.test` email/secrets, and checks öre-integer + `<10`
digit bounds. Excellent long-horizon guardrail design.

### 4. Leak-shape negative assertions

**Location**: `mark-quote-version-sent.int.test.ts:156,206,459,502`
**Pattern**: Assert error/audit payloads do NOT echo internal codes, PII, or cross-tenant existence
**Why This Is Good**: `expect(res.message).not.toMatch(/…/)` and `expect(JSON.stringify(metadata))
.not.toMatch(/email|REF-123|ore/i)` turn security/privacy requirements into executable regressions.

---

## Test File Analysis

### Suite Metadata

- **Files reviewed**: 37 `*.test.ts` / `*.spec.ts` (Epic-6 diff, `main..HEAD`)
- **Frameworks**: `node:test` (unit), Vitest (integration), Playwright (E2E)
- **Language**: TypeScript
- **Total lines (spec files)**: ~7.9k across the 37 files
- **Test cases**: ~278 `it/test` across 37 `describe` blocks

### Level Distribution

| Level        | Representative files                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| Unit         | quote-snapshot/build, golden-pack, golden-v1-v2, quote-pdf/view-model, features/*    |
| Integration  | commands/mark-quote-version-sent, create-new-quote-version, generate-quote-pdf-*, rls/* |
| E2E          | quotes.e2e, quote-sent-lock.e2e, quote-new-version.e2e, quote-pdf-states.e2e         |

### Priority Distribution

- P0 (Critical): the load-bearing money/immutability/snapshot proofs are `[P0]`-marked throughout.
- Mixed P1/P2 supporting cases (validation units, view-model, timeline, guardrails).

---

## Context and Integration

### Related Artifacts

- **Test Design**: [test-design-epic-6.md](../test-design-epic-6.md) — test IDs (6.x-UNIT/INT/E2E/GOLDEN/RLS) and risk codes (R-603/R-605/R-607/R-608/R-615) are referenced directly in test headers.
- **Prior epic reviews**: test-review-epic-5.md (same suite lineage / conventions).

### Risk Alignment

The tests trace to the epic's declared risks — money/öre discipline (R-508/R-603), quote
immutability once sent (R-605), internal/cost non-leak (R-607), send-gate reuse of the 5.4
classifier (R-608), and fixture privacy (R-615) — with an executable assertion per risk.

---

## Knowledge Base References

- **test-quality.md** — Definition of Done (no hard waits, <300 lines, <1.5 min, self-cleaning, explicit assertions).
- **test-levels-framework.md** — unit vs integration vs E2E appropriateness (well-observed here).
- **data-factories.md** — factories with unique overrides + cleanup discipline.

For coverage mapping/gates, consult the `trace` workflow (out of scope here).

---

## Next Steps

### Immediate Actions (Before Merge)

None required. No critical or high findings.

### Follow-up Actions (Future PRs)

1. **Self-seed the E2E draft-edit target** (Rec 1) — Priority P2 — Target: next quotes-E2E touch.
2. **Split the 500-line integration files along `describe` seams** (Rec 2) — Priority P2 — Target: backlog / opportunistic.
3. **Replace `__react*` hydration sniff with a product-owned readiness signal** (Rec 3) — Priority P3 — Target: backlog.

### Re-Review Needed?

✅ No re-review needed — approve as-is.

---

## Decision

**Recommendation**: Approve

**Rationale**: Test quality is excellent at 96/100 (Grade A). Determinism and isolation — the two
highest-weighted dimensions — are effectively best-in-class (injected clocks, unique per-run ids,
teardown, CI hard-fail gating, authenticated below-UI trigger proofs). The three findings are all
Medium/Low polish items with no correctness or flakiness risk; they can be handled in follow-up PRs.
The suite is production-ready and should serve as a reference pattern for future epics.

> Test quality is excellent with 96/100 score. Minor issues noted can be addressed in follow-up PRs.
> Tests are production-ready and follow best practices.

---

## Appendix

### Violation Summary by Location

| Location                                             | Severity | Dimension       | Issue                                                  | Fix                                              |
| ---------------------------------------------------- | -------- | --------------- | ------------------------------------------------------ | ------------------------------------------------ |
| `tests/e2e/quotes/quotes.e2e.spec.ts:142-151`        | P2 (M)   | Isolation       | Mutates shared seeded draft `intro_text` in place       | Seed dedicated draft or restore in `afterEach`   |
| 7 int/RLS files (307–548 lines)                      | P2 (M)   | Maintainability | Exceed 300-line DoD soft cap (many `it()` per file)     | Split along `describe` seams (optional)          |
| `tests/e2e/quotes/quotes.e2e.spec.ts:37-47`          | P3 (L)   | Maintainability | `waitForHydrated` sniffs React `__react*` internals     | Use `data-hydrated` / network-gated readiness    |
| `tests/e2e/quotes/quotes.e2e.spec.ts:147`            | P3 (L)   | Determinism     | `Date.now()` for unique E2E data                        | Benign; keep (uniqueness token, not a flake src) |
| int suites (`beforeAll` two-tenant fixture per file) | P3 (L)   | Performance     | Full fixture rebuilt per file                           | Acceptable; shared setup already amortized       |

### Related Reviews

| Review                | Grade | Notes                                  |
| --------------------- | ----- | -------------------------------------- |
| test-review-epic-5.md | (prior) | Same conventions; Epic 6 continues them. |

**Suite Score**: 96/100 (A)

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review
**Review ID**: test-review-epic-6-suite-20260706
**Timestamp**: 2026-07-06
**Version**: 1.0
