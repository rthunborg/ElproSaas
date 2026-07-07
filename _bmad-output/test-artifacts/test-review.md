---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: 2026-07-07
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - _bmad-output/test-artifacts/traceability/epic-8-traceability-report.md
  - _bmad/tea knowledge fragments (test-quality, data-factories, test-levels-framework, selective-testing, test-healing-patterns, selector-resilience, timing-debugging)
reviewScope: suite (epic 8 — file storage / required files)
executionMode: sequential (agent-team/subagent probe: sequential fallback)
---

# Test Quality Review — Epic 8 (File Storage & Required Files)

**Scope:** suite — the 26 test files added across Epic 8 (stories 8-1 … 8-5), spanning e2e (Playwright), integration commands + RLS (Vitest), and unit (`node --test` strip-types). Coverage is intentionally out of scope for `test-review` (route to `trace`; the epic-8 traceability report already exists).

**Stack:** fullstack — Next.js app; Playwright e2e; Vitest integration/RLS; `node --test` pure unit. No Pact/contract tests.

## Overall Quality Score: 93 / 100 — Grade A

| Dimension | Weight | Score | Grade |
| --- | --- | --- | --- |
| Determinism | 30% | 96 | A |
| Isolation | 30% | 95 | A |
| Maintainability | 25% | 88 | B+ |
| Performance | 15% | 90 | A- |

Weighted: 96·0.30 + 95·0.30 + 88·0.25 + 90·0.15 = **92.8 → 93 (A)**.

## Violations Summary

- HIGH: 0
- MEDIUM: 2
- LOW: 4
- TOTAL: 6

No HIGH-severity findings. No blockers. The suite is merge-ready on quality grounds.

## Files Reviewed (26)

**e2e (4):** `entity-file-panel`, `entity-file-preview`, `file-index-scope`, `file-lock-panel` (`tests/e2e/files/`)
**integration commands (4):** `file-upload`, `file-link-lock`, `file-signed-access-refresh`, `file-audit-events` (`tests/integration/commands/`)
**integration RLS (2):** `file-index-isolation`, `file-link-lock` (`tests/integration/rls/`)
**unit (16):** features/files (`file-index`, `signed-access-state`, `file-lock-lifecycle-golden`, `file-lock-predicate`, `upload-action-state`, `archive-action-state`, `upload-form-parsing`), server/storage (`upload-object`, `upload-policy`, `upload-error-classifier`), server/commands/files (`validate-upload-file`, `validate-archive-file`, `file-write-error-mapping`), guardrails (`file-index-non-scope`), components/files (`entity-file-panel-owner-type`)

## Strengths

- **Determinism is exemplary.** Every INT/RLS suite injects a fixed `CommandClock` (`now: () => new Date(FIXED_ISO)`); expiry assertions compute a deterministic `EXPECTED_EXPIRES_AT`; per-run-unique ids use `crypto.randomUUID()` (never `Date.now()` — the documented epic-3 flake lesson). No `Math.random`, no `waitForTimeout`, no bare wall-clock. The e2e `waitForHydrated` is event-driven (`requestAnimationFrame` tick on React fiber presence), not a fixed sleep.
- **Security-property discipline is outstanding.** No-existence-disclosure (R-809) is proven by asserting cross-tenant and non-existent inputs return the *identical* generic code; positive allow-list assertions on Result keys (`["expiresAt","signedUrl","targetId"]`) catch a leaked field loud; no-raw-path (R-810) is checked at command, RLS-projection, and E2E-DOM layers; the two-layer lock is proven at the DB trigger (SQLSTATE `FL823`) *and* the command-code mapper, with an explicit family-agreement cross-check that `QV409`/`AR704`/`FL823` are distinct and co-in-force.
- **Isolation & vacuity guards.** Every DB suite builds its own two-tenant fixture and `cleanupFixture` in `afterAll`; seeds throw if any id is missing so negatives can never pass vacuously; `SUPABASE_TEST_REQUIRED=1` hard-fails a missing stack so the storage-negative class is never silently skipped (closes the retro R-2 false-green gap).
- **Coverage-shape discipline.** Pure decision logic is deliberately extracted into plain `.ts` modules so the strip-types fast gate protects it (never trapped in a `.tsx`/`"use server"`). Boundary + defensive branches are pinned (expiry-at-instant is expired; unparseable/empty `expiresAt` fails *toward* re-authorize, never fail-open; unmapped error codes degrade to the generic safe state, never over-disclose).
- **Traceability & docs.** Each file carries an accurate header docblock with `[Source: …]` refs and stable `[8.x-LEVEL-0y][P0/ACz/R-nnn]` test ids; golden fixture carries a PII scan + origin labelling.

## Findings (with fixes)

### MEDIUM

1. **Shared-fixture mutation in the refresh suite** — `tests/integration/commands/file-signed-access-refresh.int.test.ts`.
   A single `beforeAll`-seeded `refreshFileId` has its lifecycle flipped (`archived`/`deleted`) inside multiple tests and restored to `linked` at the end of each. Cases are order-independent *only because* the restore runs; the restore is in the test body, not a `try/finally`, so an assertion failure mid-test can leak an unexpected lifecycle into the next case.
   **Fix:** seed a fresh file per test (as the sibling file suites already do) or wrap the mutate/restore in `try/finally`.

2. **60 MiB in-memory allocation in the oversized-upload case** — `tests/integration/commands/file-upload.int.test.ts` (`oversizedBytes()`).
   A 60 MiB zero-filled `Uint8Array` is allocated to prove the server size gate. Correct and bounded, but heavy.
   **Fix:** if the server validates `size_bytes` before reading the body, pass a declared oversized `size_bytes` with a tiny buffer; keep one real-bytes case only if the gate measures actual length.

### LOW

3. **Duplicated e2e sign-in helpers** — `signIn` + `waitForHydrated` + the fixture `JSON.parse` are copy-pasted into all four epic-8 e2e specs. This mirrors an established project-wide convention (all 20 e2e specs inline them), so it is *consistent* — but it is still duplicated boilerplate. **Fix (project-wide, not epic-8-specific):** extract a shared `tests/e2e/support` helper or Playwright fixture.

4. **Repeated lock/PDF seed helpers** — `seedDraftVersionWithPdfLink` / `seedSentVersionWithLockedPdf(Link)` are re-authored with near-identical bodies in `file-link-lock.int`, `file-link-lock.rls`, and `file-audit-events.int`. **Fix:** promote the seeder into `tests/factories`.

5. **Determinism: same shared-state coupling as #1** (counted once as LOW under determinism, the same root cause as MEDIUM #1 under isolation).

6. **Maintainability: seed duplication** (same root as #4).

## Coverage Boundary

`test-review` does **not** score coverage or gate on it. The Epic 8 traceability matrix already exists at `_bmad-output/test-artifacts/traceability/epic-8-traceability-report.md`; direct any coverage-gap concerns there via `trace`.

## Recommended Next Workflow

`trace` (confirm the traceability matrix + gate decision are current) — or proceed to merge. The two MEDIUM findings are quality-of-suite refinements, not correctness blockers; recommend addressing #1 (shared-fixture mutation) opportunistically since it is the only finding that could theoretically produce an order-dependent flake.
