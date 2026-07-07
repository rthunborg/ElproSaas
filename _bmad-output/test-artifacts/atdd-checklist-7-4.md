---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-07'
storyId: '7-4'
storyFile: '_bmad-output/implementation-artifacts/7-4-accepted-state-immutability-and-correction-boundary.md'
tddPhase: 'RED'
detectedStack: 'fullstack'
inputDocuments:
  - '_bmad-output/implementation-artifacts/7-4-accepted-state-immutability-and-correction-boundary.md'
  - '_bmad-output/test-artifacts/test-design-epic-7.md'
  - 'supabase/migrations/20260707120000_quote_version_sent_lock.sql'
  - 'tests/integration/commands/mark-quote-version-sent.int.test.ts'
  - 'tests/integration/commands/accept-quote-and-create-job.int.test.ts'
  - 'tests/integration/commands/update-job.int.test.ts'
  - 'tests/e2e/quotes/quote-sent-lock.e2e.spec.ts'
  - 'tests/e2e/jobs/job-traceability.e2e.spec.ts'
  - 'tests/unit/server/commands/job-write-error-mapping.test.ts'
  - 'tests/factories/tenants.ts'
  - 'src/components/jobs/JobDetailView.tsx'
  - 'src/server/commands/quotes/accept-and-create-job.ts'
---

# ATDD Checklist: Story 7.4 — Accepted State Immutability And Correction Boundary

## TDD Red Phase (Current)

Failing (skipped) acceptance-test scaffolds generated. All tests are **inert until Story 7.4 lands**
(the accepted-immutability trigger + `ACCEPTED_RECORD_LOCKED` code + correction-boundary notice do not
exist yet), so the every-PR gate stays green:

- **INT/RLS tests** (Vitest, DB-backed): 5 `describe.skip` blocks, ~18 `it`s — `tests/integration/commands/accepted-record-lock.int.test.ts`
- **E2E tests** (Playwright, message-only): 3 `test.skip` — `tests/e2e/jobs/job-accepted-lock.e2e.spec.ts`
- **Unit mapper tests** (`node --test`): 2 `{ skip: true }` tests appended to the EXISTING `tests/unit/server/commands/job-write-error-mapping.test.ts`

**Verified inert + valid:** `pnpm run test:unit` on the mapper file → 5 pass, 2 skip (the 7.4 branch);
`tsc --noEmit` → exit 0 across the whole project (all three scaffolds type-check against the real
imports/helpers).

## Preflight & Context (Step 1)

- **Stack detection:** `test_stack_type: auto` → **fullstack** (Next.js/React + Supabase/Postgres +
  Playwright). Backend/DB is the load-bearing surface for this story; one thin E2E message check.
- **Prerequisites:** story is `ready-for-dev` with clear AC1/AC2/AC3; test frameworks configured
  (`playwright.config.ts`, `vitest`, `node --test` runner via `tests/support/register.mjs`). PASS.
- **Framework/patterns loaded:** the 6.4 sent-lock analog is the DIRECT template — its INT test
  (`mark-quote-version-sent.int.test.ts`, the 6.4-INT-03 direct-SQL-UPDATE-rejected-by-trigger
  structure), its E2E (`quote-sent-lock.e2e.spec.ts`), and the mapper unit test pattern. Reused
  factories: `createTwoTenantFixture`, `makeAuthedServerClient`, `makeAnonServerClient`,
  `cleanupFixture`, `adminInsert*`, `adminSelectQuoteAcceptanceRow`, `adminSelectJobRow`,
  `adminSelectJobsForAcceptance`, `adminSelectAcceptancesForVersion`, `adminSelectJobEventsForJob`,
  `adminSelectAuditEvents`, `skipUnlessStack`, `isLocalStackReachable`, `runCommand`, injected
  `CommandClock`.

## Generation Mode (Step 2)

- **Mode:** AI generation (no browser recording). AC are clear and standard for this codebase (DB
  trigger + command + one message surface); the E2E mirrors the already-shipped 6.4 message spec, so
  live recording adds nothing. `tea_execution_mode: auto` → runtime is single-context, so worker
  dispatch resolved to **sequential** (API/INT scaffold then E2E scaffold, same context).
- **Runner adaptation:** the skill's generic Worker A/B templates target Playwright `tests/api` +
  `tests/e2e`. This project's real convention (per the story's Testing section + `test-design-epic-7.md`)
  is **three runners** — `node --test` (unit mapper), Vitest (INT/RLS, DB-backed), Playwright (E2E
  message). Scaffolds were authored to the project's real layout/imports rather than the generic
  templates. Every test uses the project's own skip idiom so the red phase is green-by-skip.

## Test Strategy (Step 3)

| Test ID | Level | Priority | AC | Red-phase file | Notes |
| --- | --- | --- | --- | --- | --- |
| 7.4-INT-01 | Integration (command) | P0 | AC1 | accepted-record-lock.int.test.ts | Field-by-field: `updateJob` smuggling an immutable field ⇒ `VALIDATION_FAILED`, row byte-unchanged. The command cannot smuggle the field, so the command path returns VALIDATION_FAILED; the DB `ACCEPTED_RECORD_LOCKED` is proven by INT-02. |
| 7.4-INT-02 | Integration (DB trigger) | P0 | AC1 | accepted-record-lock.int.test.ts | **Load-bearing.** DIRECT own-tenant authenticated (anon-key RLS client, NEVER BYPASSRLS) UPDATE of each immutable field on `quote_acceptances` (6 fields) + `jobs` (3 fields) ⇒ rejected by the trigger with SQLSTATE `AR704`. EXEMPT paths still succeed: `archived_at` flip on the acceptance; the four allowed job edits. |
| 7.4-INT-03 | Integration | P0 | AC2 | accepted-record-lock.int.test.ts | Empty-patch/id-only `updateJob` no-op (no false denial, no write, no audit); status-change appends exactly one `job_events` row; the 7.2 idempotent accept-retry returns the existing `(acceptanceId, jobId)` with no second write (the trigger MUST NOT fire on the short-circuit). |
| 7.4-RLS-01 | Integration (RLS) | P0 | AC3 | accepted-record-lock.int.test.ts | Cross-tenant read ⇒ zero rows (no existence disclosure); cross-tenant immutable-field UPDATE ⇒ zero rows affected (RLS-invisible, trigger never sees it); anon on the LIVE command ⇒ `UNAUTHENTICATED`. |
| 7.4-E2E-01 | E2E | P1 | AC1 | job-accepted-lock.e2e.spec.ts | STATES + MESSAGING only: the correction-boundary notice renders; NO edit affordance for any immutable commitment field; keyboard-reachable, text-not-color. Does NOT assert DB rejection. |
| 7.4-UNIT (mapper) | Unit | P0 (fast gate) | AC1 | job-write-error-mapping.test.ts (extended) | `AR704 → ACCEPTED_RECORD_LOCKED`, distinct from `QV409 → QUOTE_VERSION_LOCKED`; no raw SQLSTATE/pg-message leak. |

**Red-phase guarantee:** every generated test asserts the EXPECTED (post-implementation) behavior and
is skipped, so it fails-by-absence today and must go green when 7.4 is implemented. No placeholder
assertions (`expect(true).toBe(true)`).

**Deliberate coverage decisions (answered autonomously per the story's guidance):**

- **7.4-DOCS-01** (documented Lovable-oracle delta) is NOT a code test — it is a migration-header
  comment the dev authors in `20260711120000_accepted_record_lock.sql`. Left to dev-story (it has no
  automated assertion); noted here so trace doesn't flag it as a missing test.
- **7.x-UNIT-01** (fixture PII/ORGNR scan) is the standing CI control, not a per-story authored test.
  These scaffolds add NO PII: every öre value is `125_000` (< 10 digits, the orgnr-scan boundary,
  R-717); no personnummer/orgnr/name/email/phone. The accepted record is produced by the REAL
  sent→accept→job chain (never hand-inserted), so the locked fields are authentic.
- **SQLSTATE assumed `AR704`** (the story's recommended value) for INT-02's exact-code assertion and
  the mapper branch. If dev chooses a different distinguishable SQLSTATE, update the `ACCEPTED_LOCK_SQLSTATE`
  const in the INT file + the mapper test's `code` literal to match.
- **INT-03 idempotency** asserts on same-`(acceptanceId, jobId)` + unchanged row counts (the 7.2
  suite's proven convention), because the public command result does not expose `wasExisting` — the
  same-ids + count-unchanged pair is the sanctioned idempotent-return proof.

## Acceptance Criteria Coverage

- **AC1 — immutable at BOTH layers (command lock code AND DB trigger):** 7.4-INT-01 (command,
  field-by-field) + 7.4-INT-02 (DB trigger, field-by-field, the load-bearing proof) + the mapper unit
  test (`AR704 → ACCEPTED_RECORD_LOCKED`) + 7.4-E2E-01 (UI explains corrections need an approved
  audited workflow; no silent edit affordance). COVERED.
- **AC2 — no normal edit path mutates immutable data; the event is not hidden/overwritten; the 7.2
  retry is preserved:** 7.4-INT-03 (empty-patch no-op; status-change appends exactly one event; the
  idempotent accept-retry returns existing records with no write and the trigger does not fire on the
  short-circuit). COVERED.
- **AC3 — cross-tenant read + immutable-field update both fail; no existence disclosure:** 7.4-RLS-01
  (read ⇒ zero rows; UPDATE ⇒ zero rows affected; anon ⇒ UNAUTHENTICATED). COVERED.

## Next Steps (TDD Green Phase — for dev-story)

After implementing Story 7.4 (the additive migration `20260711120000_accepted_record_lock.sql`; the
`ACCEPTED_RECORD_LOCKED` code + Swedish message in `command-errors.ts`; the `AR704` branch in
`jobs-db.ts` `throwMappedJobWriteError`; the `job-accepted-lock-notice` on `JobDetailView.tsx`):

1. Remove `.skip` from the two `describe.skip` groups families in `accepted-record-lock.int.test.ts`
   (the whole file's 5 blocks) and the 3 `test.skip` in `job-accepted-lock.e2e.spec.ts`; remove
   `{ skip: true }` from the two 7.4 mapper tests.
2. Confirm the SQLSTATE literal (`ACCEPTED_LOCK_SQLSTATE = "AR704"`) matches the migration's chosen
   custom SQLSTATE; adjust in one place if the dev picked a different value.
3. Add the E2E `data-testid`s the spec expects: `job-accepted-lock-notice` (the notice). The negative
   assertions expect NO `edit-*` testids for immutable fields — no work needed unless such controls
   exist (they must not).
4. Run: `pnpm run test:unit` (fast), then bring up the local Supabase stack (poll `/auth/v1/health` to
   200 after `supabase db reset`) and `pnpm run test:int`, then `pnpm run test:e2e`. All 7.4 tests must
   PASS.
5. If any fail: fix the implementation (feature bug) or the test (test bug); the DB rejection is the
   load-bearing proof — a UI-disable alone is a STOP.

## Regression Guardrails (must stay green — no scaffold edits, just re-run)

- `migration-reset.int.test.ts` (per-table policy enumeration UNCHANGED — the trigger adds no RLS policy).
- `accept-quote-and-create-job.int.test.ts` + `job-source-of-truth.int.test.ts` + `update-job.int.test.ts`
  (the 7.2/7.3 suites — the allowed edits + the accept transaction stay green under the new trigger).
- `mark-quote-version-sent.int.test.ts` + `quote-sent-lock.e2e.spec.ts` + `quote-write-error-mapper.test.ts`
  (the 6.4 sent-lock — 7.4 does NOT modify the 6.4 trigger or the `QV409 → QUOTE_VERSION_LOCKED` mapping;
  `AR704 → ACCEPTED_RECORD_LOCKED` is additive and orthogonal).

## Generated Files

- `tests/integration/commands/accepted-record-lock.int.test.ts` (NEW — 7.4-INT-01/02/03 + 7.4-RLS-01)
- `tests/e2e/jobs/job-accepted-lock.e2e.spec.ts` (NEW — 7.4-E2E-01)
- `tests/unit/server/commands/job-write-error-mapping.test.ts` (EXTENDED — the `AR704` branch, 2 skipped tests)
- `_bmad-output/test-artifacts/atdd-checklist-7-4.md` (this checklist)
