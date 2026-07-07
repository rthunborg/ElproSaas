---
stepsCompleted:
  - 'step-01-load-context'
  - 'step-02-discover-tests'
  - 'step-03-quality-evaluation'
  - 'step-03f-aggregate-scores'
  - 'step-04-generate-report'
lastStep: 'step-04-generate-report'
lastSaved: '2026-07-07'
workflowType: 'testarch-test-review'
reviewScope: 'suite (Epic 7 — stories 7-1 through 7-4)'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-7.md
  - _bmad-output/implementation-artifacts/7-1-acceptance-evidence-capture-for-sent-quote-versions.md
  - _bmad-output/implementation-artifacts/7-2-idempotent-accept-quote-and-create-job-command.md
  - _bmad-output/implementation-artifacts/7-3-minimal-job-order-record-and-tenant-admin-ux.md
  - _bmad-output/implementation-artifacts/7-4-accepted-state-immutability-and-correction-boundary.md
  - _bmad-output/project-context.md
  - _bmad/tea/config.yaml
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md
  - .claude/skills/bmad-testarch-test-review/resources/knowledge/test-levels-framework.md
---

# Test Quality Review: Epic 7 Suite (Stories 7-1 … 7-4)

**Quality Score**: 90/100 (A — Excellent)
**Review Date**: 2026-07-07
**Review Scope**: suite — the tests added/expanded across Epic 7 (stories 7-1 through 7-4)
**Reviewer**: TEA Agent (Master Test Architect), for Rasmus

---

Note: This review audits existing test quality; it does not generate tests. Coverage mapping and
coverage-gate decisions are **out of scope** here — route those to `trace`.

## Scope Reviewed

29 test files touched across the Epic-7 story commit range (`f2df0da..51c5655`): **8 newly added,
21 modified**, plus the supporting `tests/factories/tenants.ts`, `tests/e2e/global-setup.ts`, and the
`accepted-price-deltas.json` golden fixture. Spanning every level:

- **Unit / fast-gate (`node --test`, pure, DB-free):** `acceptance-price.test.ts`,
  `accept-quote-to-job-golden.test.ts`, `command-errors-acceptance-conflict.test.ts`,
  `accept-and-create-job-{validation,timestamp}.test.ts`, `capture-quote-acceptance-validation.test.ts`,
  `update-job-validation.test.ts`, `job-write-error-mapping.test.ts`, `quote-write-error-mapper.test.ts`,
  `file-validation.test.ts`, and the three `guardrails/*-non-scope.test.ts` scope scanners.
- **Integration (DB-backed, Vitest, local Supabase, stack-gated):**
  `accept-quote-and-create-job.int.test.ts` (545 L), `accepted-record-lock.int.test.ts` (675 L),
  `capture-quote-acceptance.int.test.ts`, `acceptance-evidence-link.int.test.ts`,
  `job-source-of-truth.int.test.ts`, `update-job.int.test.ts`, plus the RLS migration-reset /
  cross-tenant suites.
- **Integration (pure, injected fake client — never skips):** `job-read-mapping.int.test.ts`.
- **E2E (Playwright, real app + local stack):** `job-accepted-lock`, `job-traceability`,
  `job-list-deferred-surface`, `quote-acceptance-capture`, `quote-accept-create-job`.

---

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: **Approve**

### Key Strengths

✅ **Determinism is exemplary** — every command-under-test receives an injected `CommandClock` /
`fixedClock` with a fixed ISO literal; no `Math.random()`, no unmocked `Date.now()`/`new Date()` in
any assertion path; zero hard waits (`waitForTimeout`/`sleep`); the concurrent-accept race is proven
**sleep-free** via `Promise.all` + a DB row-lock assertion.
✅ **Test-level discipline is correct and self-documenting** — the load-bearing security/immutability
guarantees live at INT/RLS (direct own-tenant anon-key RLS UPDATE rejected by the trigger, `AR704` →
`ACCEPTED_RECORD_LOCKED`), E2E is explicitly scoped to **states + messaging only** with inline
"a UI-only lock is NOT evidence (architecture §9)" notes, and pure fast-gate units pin the boundary
contracts the DB suites would skip when the stack is down.
✅ **Traceability + readability are a model for the repo** — every file carries a `[Source: …]` header
tying it to `test-design-epic-7.md` rows, risk ids (R-70x/R-71x), ACs and architecture sections;
stable test IDs (`7.x-INT/UNIT/E2E-nn`) + `[P0/P1/P2]` priority markers on each case; data-driven
`for…of` over immutable-field tables removes copy-paste.

### Key Weaknesses

❌ Two DB-backed files exceed the ≤300-line guideline — `accepted-record-lock.int.test.ts` (675 L,
HIGH) and `accept-quote-and-create-job.int.test.ts` (545 L, MEDIUM). Both are cohesive and
table-driven, so this is an advisory, not a defect.
❌ `accepted-record-lock.int.test.ts` re-seeds a **full** `sent→accept→job` chain per table-driven
case even when the case is a pure UPDATE the trigger rejects (row left reusable) — a per-run runtime
cost (MEDIUM performance).
❌ Minor E2E advisories: `page.goto` without a network-first intercept (LOW; mitigated by web-first
`expect()` retries + a RAF-poll `waitForHydrated`), and one documented `test.describe.serial` (LOW;
required by a one-shot shared accepted fixture).

### Summary

The Epic-7 suite is high-quality, production-ready test code. It correctly concentrates the
irreversible-commitment guarantees (atomic idempotent accept, accepted-state immutability,
cross-tenant isolation) in DB-backed integration and RLS tests using an authentic
`sent→accept→create-job` chain and the anon-key RLS client (never BYPASSRLS) for the load-bearing
proofs, while keeping BYPASSRLS strictly for independent readback. Fast pure units pin every boundary
contract (öre delta/reason gate, stable error codes, read-mapping projection, non-scope guardrails)
so the fast gate never silently skips coverage. The only findings are maintainability/performance
advisories on the two largest DB files — no correctness, determinism, or isolation defect blocks the
merge.

---

## Quality Criteria Assessment

| Criterion                            | Status   | Violations | Notes |
| ------------------------------------ | -------- | ---------- | ----- |
| BDD / Given-When-Then naming         | ✅ PASS  | 0          | Descriptive, scenario-style names on every case |
| Test IDs                             | ✅ PASS  | 0          | Stable `7.x-INT/UNIT/E2E/GOLDEN-nn` throughout |
| Priority Markers (P0/P1/P2/P3)       | ✅ PASS  | 0          | `[P0]`/`[P1]`/`[P2]` on cases; P0 concentrated on immutability/atomicity |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS  | 0          | None — concurrency proven sleep-free |
| Determinism (clocks, no randomness)  | ✅ PASS  | 0          | Injected `CommandClock` + fixed ISO literals everywhere |
| Isolation (cleanup, no shared state) | ⚠️ WARN  | 2 (LOW)    | Per-run UUID + `createTwoTenantFixture`/`cleanupFixture`; one documented serial, one shared global-setup fixture |
| Fixture Patterns                     | ✅ PASS  | 0          | Two-tenant fixture, dedicated one-shot E2E fixtures, injected fake read client |
| Data Factories                       | ✅ PASS  | 0          | `adminInsert*`/`adminSelect*` factories with per-run unique ids |
| Network-First Pattern                | ⚠️ WARN  | 1 (LOW)    | E2E navigates without intercept; mitigated by web-first `expect()` + hydration poll |
| Explicit Assertions                  | ✅ PASS  | 0          | Byte-unchanged readback, exact code/message no-leak assertions |
| Test Length (≤300 lines)             | ⚠️ WARN  | 2 (1H/1M)  | `accepted-record-lock` 675 L, `accept-quote-and-create-job` 545 L |
| Test Duration (≤1.5 min)             | ⚠️ WARN  | 1 (MED)    | Per-case full accept-chain re-seed in the largest INT file |
| Flakiness Patterns                   | ✅ PASS  | 0          | Stack-gated skip + CI `SUPABASE_TEST_REQUIRED=1` hard-fail; `/auth/v1/health` poll after reset |

**Total Violations**: 0 Critical, 1 High, 2 Medium, 4 Low

---

## Quality Score Breakdown

Weighted per the TEA dimension model (Determinism 30% / Isolation 30% / Maintainability 25% /
Performance 15%):

```
Determinism:      96/100 × 0.30 = 28.8   (A)
Isolation:        94/100 × 0.30 = 28.2   (A)
Maintainability:  82/100 × 0.25 = 20.5   (B)
Performance:      84/100 × 0.15 = 12.6   (B)
                                 -------
Overall:                          90.1 → 90/100
Grade:                            A (Excellent)
```

Dimension violation tallies: Determinism {0H/0M/1L}, Isolation {0H/0M/2L},
Maintainability {1H/1M/1L}, Performance {0H/1M/1L}.

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Split or shrink the two largest DB-backed integration files

**Severity**: P2 (Medium) · one HIGH-classified length (675 L) + one MEDIUM (545 L)
**Location**: `tests/integration/commands/accepted-record-lock.int.test.ts:1`,
`tests/integration/commands/accept-quote-and-create-job.int.test.ts:1`
**Criterion**: Test Length (≤300 lines) · **Knowledge Base**: `test-quality.md`

`accepted-record-lock.int.test.ts` (675 L) covers 7.4-INT-01 (command layer), 7.4-INT-02 + 02b (the
full fail-closed DB surface), 7.4-INT-03 (regression + retry preservation) and 7.4-RLS-01
(cross-tenant) in one file. It is cohesive and heavily table-driven, but well over the guideline.

**Recommended Improvement**: If it grows further, split by concern — e.g. a command-layer file, a
db-surface file (INT-02/02b), and an rls file — reusing the `seedAcceptedChain` helper from a shared
module. Not blocking now; the `for…of` tables keep the per-case reading cost low.

**Priority**: P2 — readability/scan-time only; no correctness impact.

### 2. Reuse one accepted row per describe block for rejected-UPDATE cases

**Severity**: P2 (Medium)
**Location**: `tests/integration/commands/accepted-record-lock.int.test.ts:127` (`seedAcceptedChain`)
**Criterion**: Test Duration / slow-setup · **Knowledge Base**: `data-factories.md`

Each locked-field case re-runs a full `insert → mark_quote_version_sent RPC → accept_quote_and_create_job
RPC` chain purely to obtain a fresh accepted row to attack. For the ~15+ table-driven **rejected-UPDATE**
cases the row is left byte-unchanged (the trigger rejects the write), so it is safely reusable.

**Recommended Improvement**: Seed one shared accepted row per describe block in `beforeAll` for the
rejected-UPDATE tables; keep per-`it` seeding only where the case actually mutates the row (the exempt
`archived_at`/status/facility re-point successes). This trims many full accept chains per run.

**Priority**: P2 — CI wall-clock; correctness unaffected.

### 3. (Optional) Network-first on the gating E2E assertions

**Severity**: P3 (Low)
**Location**: `tests/e2e/quotes/quote-accept-create-job.e2e.spec.ts:102` (and sibling job E2E)
**Criterion**: Network-First Pattern · **Knowledge Base**: `network-first.md`

E2E navigates with `page.goto` and relies on the RAF-poll `waitForHydrated` + Playwright web-first
`expect()` auto-retry rather than an intercept-before-navigate. This is acceptable against a real app +
local Supabase and shows no flakiness signal, but a `interceptNetworkCall` before the confirm-driven
navigation would make the specific server-response gate explicit.

**Priority**: P3 — no observed flake; leave as-is unless a race appears.

---

## Best Practices Found (use as reference)

### 1. Authentic load-bearing security proof via the anon-key RLS client

**Location**: `tests/integration/commands/accepted-record-lock.int.test.ts:305-364`
**Pattern**: DB-truth over UI-truth · **Knowledge Base**: `test-levels-framework.md`

The immutability guarantee is proven by a **direct own-tenant authenticated (anon-key RLS) UPDATE**
that the trigger must reject (`error.code === "AR704"`), with byte-unchanged readback via a separate
BYPASSRLS path — never asserting only that the UI disables a control. This is the correct level for the
guarantee and the inline "a UI-only lock is NOT evidence (architecture §9)" note makes the intent
explicit.

### 2. Sleep-free concurrency proof

**Location**: `tests/integration/commands/accept-quote-and-create-job.int.test.ts:443-476`
**Pattern**: deterministic race testing · **Knowledge Base**: `test-quality.md`, `timing-debugging.md`

Two parallel accepts via `Promise.all`, then assert **exactly one** acceptance + one job persisted and
that every OK result points at the same acceptance while any failure carries only
`COMMAND_CONFLICT`/`ACCEPTANCE_ALREADY_RECORDED` — a row-lock proof with **no `sleep`/`waitForTimeout`**.

### 3. Pure fast-gate contract pinning that never skips

**Location**: `tests/unit/server/commands/command-errors-acceptance-conflict.test.ts`,
`tests/integration/features/jobs/job-read-mapping.int.test.ts`
**Pattern**: fast-gate boundary contracts · **Knowledge Base**: `data-factories.md`

The one new stable error code and the read-layer projection/coercion (both PostgREST embed shapes,
öre-string→number, owner_type/file_id surface hygiene) are pinned with pure, DB-free tests using a
hand-built injected fake client, so they run **unconditionally** even when the local stack is down.

---

## Context and Integration

### Related Artifacts

- **Test Design**: `_bmad-output/test-artifacts/test-design-epic-7.md` (priorities + R-70x/R-71x risks;
  every case traces back to a `7.x-*` row)
- **Story implementation artifacts**: `7-1 … 7-4-*.md` under
  `_bmad-output/implementation-artifacts/`
- **Project rules**: `_bmad-output/project-context.md` (öre-integer money, tenant isolation,
  quote/acceptance immutability, no-PII-in-fixtures/R-717, local-stack-gated INT)

### Coverage note

Coverage completeness (AC→test mapping, gate decision) is **not scored here**. The automate summaries
already indicate a comprehensive AC-mapped suite; run `trace` for the formal Epic-7 traceability
matrix + coverage gate.

---

## Next Steps

### Immediate Actions (Before Merge)

None required. The suite is approvable as-is.

### Follow-up Actions (Future PRs)

1. **Split/shrink the two largest DB-backed INT files** — Priority P2, backlog/next-touch.
2. **`beforeAll` shared accepted-row for rejected-UPDATE cases** — Priority P2, backlog.
3. **Optional network-first on gating E2E** — Priority P3, only if a race emerges.

### Re-Review Needed?

✅ No re-review needed — approve as-is. The follow-ups are non-blocking advisories.

---

## Decision

**Recommendation**: **Approve**

**Rationale**: At 90/100 (Grade A) the Epic-7 suite is production-ready. Determinism and isolation —
the two highest-weighted dimensions and the ones that drive flakiness — are effectively clean (injected
clocks, fixed timestamps, per-run UUID ids, stack-gated skips with a CI hard-fail, sleep-free
concurrency). The load-bearing irreversibility and tenant-isolation guarantees are proven at the
correct DB/RLS level against authentic accepted rows, with pure fast-gate tests backstopping every
boundary contract. The only findings are maintainability/performance advisories on the two largest
DB-backed files (length + per-case re-seeding), which are cohesive and table-driven and do not warrant
blocking.

> Test quality is excellent with 90/100. Minor length/performance advisories can be addressed in
> follow-up PRs. Tests are production-ready and follow best practices.

---

## Appendix — Violation Summary by Location

| Location | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- |
| `accepted-record-lock.int.test.ts:1` | P1 (High) | Test length | 675 L file | Optional split by concern (command/db-surface/rls) |
| `accept-quote-and-create-job.int.test.ts:1` | P2 (Med) | Test length | 545 L file | Split idempotency/atomicity/rejection if it grows |
| `accepted-record-lock.int.test.ts:127` | P2 (Med) | Slow setup | Full accept-chain re-seed per rejected-UPDATE case | `beforeAll` shared row (rejected UPDATE leaves row reusable) |
| `capture-quote-acceptance.int.test.ts:1` | P3 (Low) | Test length | 343 L (marginal) | Watch |
| `quote-accept-create-job.e2e.spec.ts:102` | P3 (Low) | Network-first | goto without intercept | Optional interceptNetworkCall on the gating nav |
| `quote-accept-create-job.e2e.spec.ts:95` | P3 (Low) | Serial isolation | Documented one-shot-fixture serial block | Keep isolated to the dedicated fixture (as done) |
| `job-accepted-lock.e2e.spec.ts:48` | P3 (Low) | Shared fixture | Shared global-setup fixture.json | Keep read-only; mutation flows on dedicated fixtures |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0 (step-file architecture)
**Review ID**: test-review-epic-7-suite-20260707
**Scope**: suite — Epic 7 stories 7-1 … 7-4
**Version**: 1.0

This review is guidance, not rigid rules. Where a pattern is justified (e.g. the documented serial
block, or the deliberately large but cohesive table-driven INT files), it is documented with a comment
and treated as an advisory rather than a defect.
