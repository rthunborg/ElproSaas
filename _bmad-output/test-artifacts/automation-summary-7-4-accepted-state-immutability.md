---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-07'
inputDocuments:
  - '_bmad-output/implementation-artifacts/7-4-accepted-state-immutability-and-correction-boundary.md'
  - '_bmad-output/test-artifacts/test-design-epic-7.md'
  - 'supabase/migrations/20260711120000_accepted_record_lock.sql'
  - 'src/server/commands/jobs/jobs-db.ts'
  - 'src/server/commands/command-errors.ts'
  - 'tests/integration/commands/accepted-record-lock.int.test.ts'
  - 'tests/e2e/jobs/job-accepted-lock.e2e.spec.ts'
  - 'tests/unit/server/commands/job-write-error-mapping.test.ts'
  - 'knowledge: test-levels-framework.md, test-priorities-matrix.md, data-factories.md, test-quality.md'
---

# Automation Coverage Expansion — Story 7.4 (Accepted-State Immutability + Correction Boundary)

## Mode / Stack

- Mode: **BMad-Integrated** (story + test-design-epic-7 + implemented code present).
- Detected stack: **fullstack** (Next.js/React frontend + Postgres/Supabase backend).
- Runners: `node --test` (pure unit), Vitest (INT/RLS, local Supabase stack), Playwright (E2E). Verified `playwright.config.ts` + `vitest.config.ts` present.
- TEA config flags: none set (defaults) — traditional patterns (no Playwright-Utils / Pact).

## Existing coverage (already GREEN from dev-story / ATDD)

- `tests/integration/commands/accepted-record-lock.int.test.ts` — 7.4-INT-01 (command-layer VALIDATION_FAILED), 7.4-INT-02 (direct-SQL trigger reject on 6 acceptance + 3 job columns, plus 2 exempt-success paths), 7.4-INT-03 (accidental-update regression + 7.2 idempotent-retry preservation), 7.4-RLS-01 (cross-tenant read/update + anon).
- `tests/unit/server/commands/job-write-error-mapping.test.ts` — AR704 → ACCEPTED_RECORD_LOCKED + no-leak.
- `tests/e2e/jobs/job-accepted-lock.e2e.spec.ts` — 7.4-E2E-01 messaging + no-silent-edit + a11y.

## Coverage gaps identified (target of this expansion)

The load-bearing R-704 evidence is the DB-layer **fail-closed-by-construction** claim in the
migration: *everything except `archived_at`/`updated_at` is locked on `quote_acceptances`; the whole
source-ref/identity tuple is locked on `jobs`*. The existing 7.4-INT-02 proves the **AC-headline
subset** of columns (6 of 15 acceptance columns; 3 of 6 job columns) and two exempt successes. It
does NOT exercise:

| # | Gap | Level | Priority | Why it matters |
| - | --- | ----- | -------- | -------------- |
| 1 | The remaining LOCKED acceptance columns (`quote_id`, `adjustment_reason`, `evidence_file_id`, `notes`, `planned_start_date`, `planned_end_date`) direct-UPDATE ⇒ AR704 | INT (DB) | P0 | Proves "locked-by-default", not merely the AC-named commitment fields. `notes`/planned dates are operational-not-commitment yet deliberately locked — the fail-closed posture is untested for them. |
| 2 | The **exempt-then-tuple combined-mutation** branch: an `archived_at` flip **together with** a locked column in the SAME UPDATE ⇒ AR704 | INT (DB) | P0 | The trickiest branch of `enforce_quote_acceptance_lock` (the migration comment's exempt-then-full-tuple technique). A naive exempt short-circuit would let a locked column slip through when archival co-mutates. Completely untested. |
| 3 | `jobs.created_at` immutability direct-UPDATE ⇒ AR704 | INT (DB) | P1 | `created_at` is in the job locked tuple but is the one job identity column INT-02 does not cover. |
| 4 | Job exempt PRECISION: a direct own-tenant UPDATE of `facility_id`/`contact_id` (deliberately UNLOCKED for the ON DELETE SET NULL cascade) SUCCEEDS | INT (DB) | P1 | Proves the job lock is precise (source-ref tuple only), not a blanket freeze — the migration's explicit lock-vs-exempt decision for the SET-NULL columns. |

All gaps are **DB-level (INT)** — the E2E/unit/command layers are already saturated and adding there
would duplicate. No new E2E (would only re-assert messaging) and no new unit (the mapper has one
branch, fully covered). Scope: **selective** — expand the highest-risk (R-704) DB proof to its full
fail-closed surface; do not re-test what is already green.

## Implementation

Added to the existing `tests/integration/commands/accepted-record-lock.int.test.ts` (co-located with
the sibling 7.4-INT-02 block so the fixtures/harness are reused; no new file — avoids a second stack
spin-up and keeps the two-layer proof in one place):

- **7.4-INT-02b** `describe`: the remaining locked acceptance columns (gap 1), the combined-mutation
  exempt-then-tuple RAISE (gap 2), `jobs.created_at` lock (gap 3), and the `facility_id`/`contact_id`
  exempt-success precision (gap 4). New `seedAcceptedChainWithFacility` helper seeds a real
  sent→accept chain whose parent quote carries a facility + contact (so the RPC copies them onto the
  job) — enabling the exempt-path proof against a genuine value.

All new tests follow the established conventions: real sent→accept→job chain (never hand-inserted),
anon-key RLS client for direct-SQL attacks (never BYPASSRLS), injected `CommandClock`, per-run UUIDs,
`skipUnlessStack` gate, öre < 10 digits / no PII (R-717).

## Verification (all green)

- `pnpm run test:unit` — 1126 pass / 0 fail (unchanged; no unit added).
- `pnpm run typecheck` — clean.
- `eslint tests/integration/commands/accepted-record-lock.int.test.ts` — 0 errors.
- `SUPABASE_TEST_REQUIRED=1 vitest run accepted-record-lock.int.test.ts` — **31 pass** (was 21;
  +10 new 7.4-INT-02b tests, all verified RUN not skipped against the live stack, health polled 200).
- `SUPABASE_TEST_REQUIRED=1 vitest run` (full INT) — **56 files / 641 tests, 0 fail** (was 631; +10). No regression.

Net new: **10 INT (DB-layer) tests** in one `7.4-INT-02b` describe block. Delivered gaps 1-4 in full
(6 remaining-locked acceptance columns; the exempt-then-tuple combined-mutation RAISE; jobs.created_at;
facility_id/contact_id re-point + null exempt-success x2).

## Traceability

- Gaps 1-4 all deepen **7.4-INT-02** (R-704, AC1, architecture §9 — the below-the-command DB proof)
  and the migration's fail-closed-by-construction guarantee. No new AC introduced; this is
  regression-depth on the load-bearing immutability layer.
