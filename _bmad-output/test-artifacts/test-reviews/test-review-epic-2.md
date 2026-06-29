---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: '2026-06-29'
workflowType: testarch-test-review
inputDocuments:
  - _bmad/tea/resources/knowledge/test-quality.md (skill knowledge base)
  - _bmad-output/implementation-artifacts (story files 2-1..2-4)
  - tests/** (33 test files + factories/support)
---

# Test Quality Review: Epic 2 — Multi-Tenant Foundation (stories 2-1..2-4)

**Quality Score**: 91/100 (A — Excellent)
**Review Date**: 2026-06-29
**Review Scope**: suite (epic 2)
**Reviewer**: TEA Agent (Master Test Architect)
**Suite size**: 33 test files — 146 unit (node:test) + 89 integration (Vitest, DB-backed) — 0 skipped; E2E `describe.skip`-gated (out of epic scope)

> This review audits existing test quality (determinism, isolation, maintainability, performance). It does not score coverage — use `trace` for coverage decisions and gates. It is advisory.

---

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve with Comments

### Key Strengths

- Data-driven security harness with a **single source of truth** (`tenant-table-inventory.ts`) and a **compile-time `assertNever` exhaustiveness guard** — adding a tenant table is a one-place edit; a missing metadata branch is a TypeScript error, not a silently wrong-shaped negative.
- **Mechanism-asserting negatives**: cross-tenant / anon / append-only denials assert the exact SQLSTATE (`42501` privilege, `23514` CHECK) plus an **independent BYPASSRLS re-read**, never a vacuous "non-null error OR empty set". This is the hardest-to-get-right part of RLS testing and it is done correctly throughout.
- **Determinism by construction**: injected `CommandClock` (single captured timestamp), no `Date.now()` in assertions, no `Math.random()` seeds in assertions, no hard waits anywhere; pooled `pg` sessions run `discard all` to prevent cross-test contamination.
- **Parallel-safe fixtures**: every `createTwoTenantFixture()` provisions globally-unique ids; ad-hoc lifecycle fixtures use `try/finally` cleanup; admin pools are closed in `afterAll`.
- **Best-in-class self-documentation**: every file ties tests to story ACs, risk ids (R-001..R-012), and architecture sections; `[P0]/[P1]/[P3]` priority tags on every title; assertions kept explicit in test bodies.

### Key Weaknesses

- One DB-backed test (`envelope-audit-write.int.test.ts`) uses a **hardcoded literal `correlation_id`** to key a row in an **append-only table that cannot be cleaned up** — on a repeated local run without `db reset`, the prior row collides and `expect(rows.length).toBe(1)` finds 2. **This failure was reproduced live during this audit** (1 of 89 integration tests failed for exactly this reason).
- Lifecycle-variant RLS tests re-provision a **full two-tenant fixture** when they only need one extra membership row — the most expensive setup repeated unnecessarily.
- A documentation-only test asserts `expect(true).toBe(true)`.

### Summary

Epic 2's test suite is high-quality engineering: the cross-tenant/anon/append-only negatives prove the *denial mechanism* (privilege/CHECK SQLSTATE + independent re-read) rather than a coincidental empty result, the H4 inventory gate proves it *bites* both as a pure function (off-DB) and against the live schema, and the whole suite is deterministic and parallel-safe by design. The single material defect is a self-isolation flaw in one happy-path audit test: it keys its assertion on a fixed `correlation_id` against an append-only table that cannot be deleted, so accumulated rows from earlier local runs break the exact-count assertion. The fix is one line (use `crypto.randomUUID()`, exactly as the sibling suites already do) and turns the suite fully green-on-repeat. Recommendation: **Approve with Comments** — score 91/100 (A).

---

## Quality Criteria Assessment

| Criterion | Status | Violations | Notes |
| --- | --- | --- | --- |
| BDD / clear test names | PASS | 0 | Every title carries `[P0/P1/P3]` + AC + the behaviour under test |
| Test IDs / priority markers | PASS | 0 | Consistent P0/P1/P3 + risk-id (R-00x) tagging |
| Hard waits (sleep/waitForTimeout) | PASS | 0 | None; time injected via `CommandClock`; reachability is a 2s bounded probe |
| Determinism (no random/real-time in asserts) | WARN | 1 | Fixed literal correlation_id vs append-only table → repeat-run collision |
| Isolation (cleanup, no shared state) | WARN | 1 | Append-only audit rows un-cleanable + keyed by a fixed literal |
| Fixture patterns | PASS | 0 | Per-call unique two-tenant fixtures; try/finally for ad-hoc fixtures |
| Data factories | PASS | 0 | `tenants` / `audit-events` factories; unique-id provisioning |
| Explicit assertions | PASS | 0 | Assertions in test bodies; mechanism asserted (42501/23514 + re-read) |
| Test length (<=300 lines) | WARN | 1 | `resolve-tenant-context.test.ts` = 370 lines (cohesive) |
| Vacuous assertions | WARN | 1 | One `expect(true).toBe(true)` documentation test |
| Flakiness patterns | WARN | 1 | Same root cause as the determinism finding (cross-run pollution) |
| Parallel safety | PASS | 0 | Unique-id design; pooled-session `discard all` |

**Total Violations**: 0 Critical, 0 High, 3 Medium, 5 Low

---

## Quality Score Breakdown

```
Dimension scores (weighted per TEA priorities):
  Determinism      90/100  × 0.30 = 27.00   (A)
  Isolation        88/100  × 0.30 = 26.40   (B+)
  Maintainability  95/100  × 0.25 = 23.75   (A)
  Performance      90/100  × 0.15 = 13.50   (A)
                                    --------
Overall                              90.65 → 91/100
Grade                                A (Excellent)

Violations: HIGH 0 | MEDIUM 3 | LOW 5 | TOTAL 8
```

---

## Critical Issues (Must Fix)

No critical issues detected.

---

## Recommendations (Should Fix)

### 1. Fixed `correlation_id` against an append-only table causes a repeat-run failure

**Severity**: P1 (High) — reproduced live (1/89 integration tests failed during this audit)
**Location**: `tests/integration/commands/envelope-audit-write.int.test.ts:91` (and the `11111111-2222-...` literal at the same file)
**Dimension**: Determinism + Isolation
**Knowledge Base**: test-quality.md — "Unique Data: use generated values, never hardcode ids" + "Self-Cleaning"

**Issue**: The test writes an audit row keyed on a hardcoded literal `correlation_id`, then asserts `expect(rows.length).toBe(1)`. `audit_events` is append-only — `cleanupFixture` cannot delete it (this run logged `audit_events is append-only: DELETE is not permitted`). So a second local run (without `supabase db reset`) finds the earlier run's row too → 2 rows.

```typescript
// Current (collides on repeat runs)
const correlationId = "dddddddd-cccc-cccc-cccc-cccccccccccc";
await runCommand(command, { client: a, input: { note: "audit-me" }, clock: fixedClock, correlationId });
const rows = await adminSelectAuditEvents({ correlationId });
expect(rows.length).toBe(1); // finds 2 on the second run
```

```typescript
// Recommended — match the sibling suites, which already do this
const correlationId = crypto.randomUUID();
```

**Why it matters**: a green suite must not depend on a freshly-reset DB. The cross-tenant, append-only, and anon-isolation suites already use `crypto.randomUUID()` for their seeds — this one file is the outlier. One-line fix, fully closes the only repeat-run flake.

### 2. Lifecycle-variant RLS tests re-provision a full two-tenant fixture

**Severity**: P2 (Medium)
**Location**: `tests/integration/rls/helper-semantics.rls.test.ts:92,110`; `membership-self-grant.rls.test.ts` (lifecycle cases)
**Dimension**: Performance

**Issue**: The disabled/invited cases call `createTwoTenantFixture()` again inside the test (2 tenants + 3 admin-API user creations) when they only need one extra `disabled`/`invited` membership on the existing `orphanUser`. Full fixture provisioning is the suite's most expensive setup.

**Recommended**: seed only the additional membership on the `beforeAll` fixture's `orphanUser`, or add a lighter membership-only seed path, to cut admin-API round-trips.

### 3. Documentation-only test with a vacuous assertion

**Severity**: P3 (Low)
**Location**: `tests/integration/rls/security-definer-search-path.rls.test.ts:115`
**Dimension**: Maintainability

**Issue**: A `[REVIEW NOTE]` test exists only to host a comment and asserts `expect(true).toBe(true)`. Convert to `it.todo`/skip or move the rationale to a file-level doc comment so the green count reflects only behavioural assertions.

### 4. Largest unit file exceeds the 300-line guideline

**Severity**: P3 (Low)
**Location**: `tests/unit/server/auth/resolve-tenant-context.test.ts` (370 lines)
**Dimension**: Maintainability

**Issue**: Cohesive (one resolver, AC1-AC4, shared fake builder) but the single longest file. Optionally split the multi-row/active-first-fallback cases out (the project already factors edges into `*-edges.test.ts`).

### 5. Shared scratch schema name + implicit parallelism (informational)

**Severity**: P3 (Low)
**Location**: `security-definer-search-path.rls.test.ts:67` (`evil` schema); Vitest default pool
**Dimension**: Isolation / Performance

The `evil` scratch schema is a fixed name dropped in `afterAll` + `discard all` per session — safe at file scope, but randomize it if file-level parallelism is ever enabled. Integration parallel-safety is real (unique-id design) but implicit in config rather than pinned.

---

## Best Practices Found (use as reference)

1. **Mechanism-asserting RLS negatives** — `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts`, `audit-append-only.int.test.ts`: assert the exact SQLSTATE (`42501`/`23514`) AND re-read independently via BYPASSRLS, so a future GRANT-regression that turns a denial into an empty set cannot false-green.
2. **Single-source-of-truth + compile-time exhaustiveness** — `tenant-table-inventory.ts`: `TENANT_TABLES` drives the cross-tenant, anon, and H4 gate suites; `assertNever(table)` makes an unenrolled-metadata table a typecheck error.
3. **Gate-bite proof at two levels** — `inventory-gate-core.test.ts` (pure fn, off-DB, fake `adminQuery`) + `rls-inventory-gate.int.test.ts` (live schema): both prove a deliberately-shrunk enrolled set surfaces the omitted REAL table by name.
4. **Injected clock / single-timestamp discipline** — `command-clock.test.ts` + `envelope-core.test.ts`: one `clock.now()` threads into every lifecycle field and `created_at`; time-dependent assertions never sleep.
5. **Search-path hijack negative with a positive control** — `security-definer-search-path.rls.test.ts`: plants a hostile `evil.tenant_memberships`, proves the DEFINER helper resists it, and includes a control proving the helper is not trivially always-false.

---

## Context and Integration

- Story files: `_bmad-output/implementation-artifacts/` (stories 2-1..2-4)
- Test design: `test-design-epic-2.md` (risk ids R-001..R-012 traced in test headers)
- Knowledge base: `_bmad/tea/resources/knowledge/test-quality.md`

For coverage mapping / traceability, consult the `trace` workflow (a coverage matrix already exists in test-artifacts).

---

## Next Steps

### Immediate (before next epic merge)
1. **P1** — Replace the hardcoded `correlation_id` literals in `envelope-audit-write.int.test.ts` with `crypto.randomUUID()`. Effort: ~5 min. Closes the live repeat-run failure.

### Follow-up (future PRs)
1. **P2** — Seed only an extra membership (not a full fixture) in lifecycle-variant RLS tests.
2. **P3** — De-vacuum the documentation-only test; optionally split the 370-line resolver unit file.

### Re-Review Needed?
No re-review needed — Approve with Comments. The P1 is a one-line fix; the rest are non-blocking.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**: Test quality is excellent (91/100, A). The denial-mechanism rigor, data-driven inventory with compile-time exhaustiveness, injected-clock determinism, and parallel-safe unique-id fixtures are all best-in-class. The one material defect is a self-isolation flaw (fixed correlation_id vs an un-cleanable append-only table) that produced a live failure this audit; it is a one-line fix the sibling suites already model. None of the findings are HIGH/Critical, so the epic does not warrant a block.

---

## Appendix — Violation Summary by Location

| Location | Severity | Dimension | Issue | Fix |
| --- | --- | --- | --- | --- |
| envelope-audit-write.int.test.ts:91 | P1 (Med) | Determinism/Isolation | Fixed correlation_id vs append-only table → repeat-run collision (reproduced live) | Use crypto.randomUUID() |
| helper-semantics.rls.test.ts:92,110 | P2 (Med) | Performance | Full fixture re-provisioned for a 1-membership variant | Seed only the extra membership |
| security-definer-search-path.rls.test.ts:115 | P3 (Low) | Maintainability | `expect(true).toBe(true)` doc test | it.todo / file-level comment |
| resolve-tenant-context.test.ts (370 ln) | P3 (Low) | Maintainability | Longest file > 300-line guideline | Optional split |
| security-definer-search-path.rls.test.ts:67 | P3 (Low) | Isolation | Fixed `evil` scratch schema name | Randomize if parallelized |
| integration suite-wide | P3 (Low) | Performance | Parallelism implicit, not pinned | Optional: pin Vitest pool |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review
**Execution mode**: sequential (single agent, 4 quality dimensions)
**Scope**: suite — 33 files (146 unit + 89 integration), live run executed (1 integration failure observed; root-caused above)
**Timestamp**: 2026-06-29
