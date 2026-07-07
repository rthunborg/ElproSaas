---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-07'
storyId: '8-4'
storyFile: '_bmad-output/implementation-artifacts/8-4-quote-pdf-attachment-and-acceptance-evidence-locks.md'
tddPhase: 'RED'
detectedStack: 'fullstack'
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-4-quote-pdf-attachment-and-acceptance-evidence-locks.md'
  - '_bmad-output/test-artifacts/test-design-epic-8.md'
  - 'supabase/migrations/20260707120000_quote_version_sent_lock.sql'
  - 'supabase/migrations/20260711120000_accepted_record_lock.sql'
  - 'supabase/migrations/20260704120000_file_storage_foundation.sql'
  - 'tests/integration/commands/accepted-record-lock.int.test.ts'
  - 'tests/integration/commands/acceptance-evidence-link.int.test.ts'
  - 'tests/integration/commands/generate-quote-pdf-retry-consistency.int.test.ts'
  - 'tests/unit/server/commands/job-write-error-mapping.test.ts'
  - 'tests/unit/features/quotes/accept-quote-to-job-golden.test.ts'
  - 'tests/e2e/jobs/job-accepted-lock.e2e.spec.ts'
  - 'tests/factories/tenants.ts'
  - 'tests/factories/audit-events.ts'
  - 'src/server/commands/files/file-db.ts'
  - 'src/server/commands/command-errors.ts'
  - 'src/server/commands/quotes/accept.ts'
  - 'src/server/commands/quotes/generate-pdf.ts'
---

# ATDD Checklist: Story 8.4 — Quote, PDF, Attachment, And Acceptance Evidence Locks

## TDD Red Phase (Current)

Failing (skipped) acceptance-test scaffolds generated. All red-phase tests are **inert until Story 8.4
lands** (the additive migration `20260712120000_file_link_lock.sql` — the `enforce_file_link_lock` /
`enforce_file_lock` triggers + the parent-state-keyed lock apply + custom SQLSTATE `FL823`; the
`FILE_LINK_LOCKED` command code + the `FL823` mapper branch; the `archiveFile`/`archiveFileLink`
command; the lock predicates — none exist yet), so the every-PR gate stays green:

- **INT tests** (Vitest, DB-backed, command layer): 6 `describe.skip` blocks, 11 `it`s —
  `tests/integration/commands/file-link-lock.int.test.ts`
- **RLS tests** (Vitest, DB-backed, the load-bearing DB-trigger half + FAMILY AGREEMENT): 7 `describe.skip`
  blocks, 18 `it`s — `tests/integration/rls/file-link-lock.rls.test.ts`
- **Unit mapper tests** (`node --test`): 2 `{ skip: true }` 8.4 tests appended to a NEW
  `tests/unit/server/commands/files/file-write-error-mapping.test.ts` (its 3 shipped-8.1-mapping guard
  tests stay ACTIVE)
- **Unit predicate tests** (`node --test`): 1 `describe.skip` block, 5 `it`s —
  `tests/unit/features/files/file-lock-predicate.test.ts`
- **Lifecycle golden** (`node --test`, ACTIVE — authored green in one pass, builds no lock code):
  `tests/unit/features/files/file-lock-lifecycle-golden.test.ts` over
  `tests/fixtures/golden/files/file-lock-lifecycle.json`
- **E2E tests** (Playwright, message/affordance-only): 3 `test.skip` —
  `tests/e2e/files/file-lock-panel.e2e.spec.ts`

**Verified inert + valid (this run):**

- `node --test` on the three new unit files → **7 pass** (the golden oracle + the 3 shipped-8.1 mapper
  guards) / **2 skip** (the 8.4 `FL823 → FILE_LINK_LOCKED` mapper branch); the predicate suite is
  `describe.skip` (inert). 0 fail.
- `npx vitest run` on the two new DB-backed suites → **29 skipped, 0 collection errors, 0 fail** (both
  suites collect cleanly without the local stack).
- `pnpm typecheck` (`tsc --noEmit`) → **exit 0 across the whole project** (all five scaffolds type-check
  against the real imports/helpers, with the not-yet-existing `archiveFile` / lock predicates modelled
  as typed local stubs so the skipped suites never fail module-load).

## Preflight & Context (Step 1)

- **Stack detection:** `test_stack_type: auto` → **fullstack** (Next.js/React + Supabase/Postgres +
  Playwright). Backend/DB is the load-bearing surface for this story (two-layer lock = DB trigger +
  command layer + RLS negatives); one thin message-only E2E for the panel affordance.
- **Prerequisites:** story is `ready-for-dev` with clear AC1-AC5; test frameworks configured
  (`playwright.config.ts`, `vitest`, `node --test` runner via `tests/support/register.mjs`). PASS.
- **Framework/patterns loaded:** the 7.4 accepted-lock analog is the DIRECT template — its INT/RLS test
  (`accepted-record-lock.int.test.ts`, the direct-SQL-UPDATE-rejected-by-trigger structure + the
  exempt-then-tuple discipline), its E2E (`job-accepted-lock.e2e.spec.ts`, message-only), and the mapper
  unit pattern (`job-write-error-mapping.test.ts`). The 7.1 evidence-link (`acceptance-evidence-link.int.test.ts`)
  and the 6.3 PDF-retry (`generate-quote-pdf-retry-consistency.int.test.ts`) inform the seed shapes and
  the pre-send-vs-post-send re-point boundary. The 7.2 golden (`accept-quote-to-job-golden.test.ts`) is
  the lifecycle-golden pattern. Reused factories (all verified present in `tests/factories/tenants.ts`):
  `createTwoTenantFixture`, `makeAuthedServerClient`, `makeAnonServerClient`, `cleanupFixture`,
  `adminInsertCustomer/Calculation/Quote/QuoteVersion`, `adminInsertFile`, `adminInsertFileLink`,
  `adminUpdateQuoteVersionStatus`, `adminInsertQuoteAcceptance`, `adminSelectFileById`,
  `adminSelectPdfFileLinks`, `adminSelectAcceptanceEvidenceLinks`, `adminSelectAuditEvents`,
  `skipUnlessStack`, `isLocalStackReachable`, `runCommand`, injected `CommandClock`.

## Generation Mode (Step 2)

- **Mode:** AI generation (no browser recording). AC are clear and standard for this codebase (DB
  triggers + command + one message surface); the E2E mirrors the already-shipped 6.4/7.4 message specs,
  so live recording adds nothing. `tea_execution_mode: auto` → single-context runtime, so worker
  dispatch resolved to **sequential** (INT/RLS scaffolds then E2E scaffold, same context).
- **Runner adaptation:** the skill's generic Worker A/B templates target Playwright `tests/api` +
  `tests/e2e`. This project's real convention (per the story's Testing section + `test-design-epic-8.md`
  + the shipped 6.4/7.4 lock suites) is **two runners + Playwright E2E** — `node --test` (unit mapper +
  golden + predicate), Vitest (INT/RLS, DB-backed, `SUPABASE_TEST_REQUIRED=1`), Playwright (E2E
  message-only). Scaffolds were authored to the project's real layout/imports, using the project's own
  skip idiom (`describe.skip`, `{ skip: true }`, `test.skip`) so the red phase is green-by-skip.

## Test Strategy (Step 3)

| Test ID | Level | Priority | AC | Red-phase file | Notes |
| --- | --- | --- | --- | --- | --- |
| 8.4-INT-01 | Integration (command) | P0 | AC1 | file-link-lock.int.test.ts | The LOCK IS APPLIED at send: after `markQuoteVersionSent` the sent version's `quote_pdf` link is locked + `files.lifecycle_state='locked'`; a DRAFT version's link is NOT locked (6.3 preview-on-draft stays green). |
| 8.4-INT-02 | Integration (command) | P0 | AC2 | file-link-lock.int.test.ts | After `captureQuoteAcceptance` with evidence, the `acceptance_evidence` link is locked + its file lifecycle is locked (AR704 has no draft state). |
| 8.4-INT-03 | Integration (command) | P0 | AC3 | file-link-lock.int.test.ts | `archiveFile` on a locked file SUCCEEDS (soft-delete: `archived_at` + `lifecycle_state='archived'`, never a hard DELETE) and writes EXACTLY ONE `audit_events` row with allow-listed `{ targetId, reason? }` metadata (no path/PII/contents — §15). |
| 8.4-INT-04 | Integration (command) | P0 | AC1/AC2 | file-link-lock.int.test.ts | A command-path mutation/hard-delete of a locked link surfaces the stable `FILE_LINK_LOCKED` code (mapped from `FL823`), never an opaque `SERVER_ERROR`. |
| 8.4-INT-05 | Integration | P0 | AC4 | file-link-lock.int.test.ts | Partial-lock / archive-delete consistency (R-813): a re-run archive on an already-archived file is a clean no-op (no double audit); the lock-apply is atomic (a stray unrelated file stays unlocked; only the genuinely-sent file locks). |
| 8.4-INT-RLS-01 | Integration (RLS) | P0 | AC5 | file-link-lock.int.test.ts | Cross-tenant `archiveFile` on a tenant B locked file ⇒ `TENANT_ACCESS_DENIED` (same generic shape as not-found, no existence disclosure — R-809); anon on the LIVE archive command ⇒ `UNAUTHENTICATED`. |
| 8.4-RLS-01 | Integration (DB trigger) | P0 | AC1 | file-link-lock.rls.test.ts | **Load-bearing.** DIRECT own-tenant authenticated (anon-key RLS client, NEVER BYPASSRLS) UPDATE of a LOCKED `file_links` row's `file_id` (the re-point hazard) / `owner_id` / `owner_type` / `purpose` / `is_locked` / `locked_at` ⇒ rejected with SQLSTATE `FL823`, row byte-unchanged. |
| 8.4-RLS-02 | Integration (DB trigger) | P0 | AC1 | file-link-lock.rls.test.ts | DIRECT own-tenant UPDATE of a LOCKED `files` row's `object_path` / `display_name` / `mime_type` / `bucket_id` / `size_bytes` ⇒ `FL823`. |
| 8.4-RLS-03/04 | Integration (DB trigger) | P0 | AC3 | file-link-lock.rls.test.ts | The SANCTIONED `locked → archived` transition is ALLOWED; a DISARMING `locked → linked/draft` transition ⇒ `FL823`. (The DELETE-arm `FL823` belt-and-braces is covered by the disarm/mutation cases; `authenticated` has no delete grant.) |
| 8.4-RLS-05 | Integration (DB trigger) | P0 | AC1/AC2 | file-link-lock.rls.test.ts | The pre-send-vs-post-send boundary (the 6.3-retry edge): a DRAFT version's PDF-link `file_id` re-point is ALLOWED; the SAME re-point after the parent is sent ⇒ `FL823`. Locking activates exactly at the parent's lock moment. |
| 8.4-RLS-06 | Integration (DB trigger) | P0 | AC1/AC2 | file-link-lock.rls.test.ts | **FAMILY AGREEMENT (R-822).** On a SENT version both `QV409` (mutate the version) and `FL823` (re-point the PDF link) are in force; on an ACCEPTED acceptance both `AR704` and `FL823`. The three SQLSTATEs (`QV409`/`AR704`/`FL823`) are DISTINCT and none collide. |
| 8.4-RLS-07 | Integration (RLS) | P0 | AC5 | file-link-lock.rls.test.ts | Cross-tenant direct UPDATE of a tenant B locked link/file ⇒ zero rows affected (RLS-invisible, the trigger never sees it), no error, no existence disclosure, row untouched. |
| 8.4-UNIT (mapper) | Unit | P0 (fast gate) | AC1/AC3 | file-write-error-mapping.test.ts (NEW) | `FL823 → FILE_LINK_LOCKED`, distinct from `QV409 → QUOTE_VERSION_LOCKED` / `AR704 → ACCEPTED_RECORD_LOCKED`; no raw SQLSTATE/pg-message leak. The 3 shipped-8.1 mapping guards stay ACTIVE. |
| 8.4-UNIT-01 (predicate) | Unit | P0 (fast gate) | AC1-AC4 | file-lock-predicate.test.ts | Pure client-safe `isFileLinkLockable({ownerType,purpose,parentState})` / `isLockedFileArchivable(lifecycleState)` branches (draft-parent → not lockable; sent/accepted-parent → lockable; committed acceptance → lockable; archived/deleted → not re-lockable). Extracted OUT of any `.tsx` (coverage-shape). |
| 8.4-GOLDEN-01 | Golden (unit, ACTIVE) | P1 | AC1-AC4 | file-lock-lifecycle-golden.test.ts + fixture | Lock-state lifecycle oracle: draft→unlocked; sent/accepted→locked; committed acceptance→locked; locked file archived→'archived' (never deleted). All `origin: "new-expected"` (no real Lovable lock oracle). Authored GREEN in one pass. |
| 8.4-E2E-01 | E2E | P1 | AC1/AC2/AC3 | file-lock-panel.e2e.spec.ts | STATES + MESSAGING only: the locked-file panel shows a lock notice ("kan arkiveras men inte ändras/tas bort"); NO replace/delete affordance; an archive-only affordance MAY render; keyboard-reachable, text-not-color. Does NOT assert DB rejection. |

**Red-phase guarantee:** every generated test asserts the EXPECTED (post-implementation) behavior and is
skipped (or, for the golden, is a live oracle over the pinned expected contract), so it fails-by-absence
today and must go green when 8.4 is implemented. No placeholder assertions (`expect(true).toBe(true)`).

**Deliberate coverage decisions (answered autonomously per the story's guidance):**

- **SQLSTATE assumed `FL823`** (the story's recommended value) for the INT/RLS exact-code assertions and
  the mapper branch (the `FILE_LINK_LOCK_SQLSTATE` const in the RLS file + the mapper test's `code`
  literal). If dev chooses a different distinguishable 5-char SQLSTATE (must NOT collide with
  `23503`/`42501`/`23505`/`23514`/`22P02` NOR `QV409` NOR `AR704`), update it in those two/three places.
- **`archiveFile` command name + shape assumed** (`{ id, reason? }` input; `file.archived` event type).
  If dev names it `archiveFileLink` / uses a different event type or input, update the INT file's stub +
  call sites and the `file.archived` filter in one place. It is modelled as a typed local stub in the
  red phase (a static import of the not-yet-existing export would fail Vitest collection even under
  `describe.skip`); the file documents the green-phase `import { archiveFile } from "@/server/commands/files"`.
- **Lock predicates (`isFileLinkLockable` / `isLockedFileArchivable`) assumed at
  `@/features/files/lock-predicates`** (Task 5.1 extracts them). Same typed-local-stub approach in the
  predicate unit (a static import of a missing module fails `node --test` at module-load even under
  `describe.skip`); the file documents the green-phase import to uncomment.
- **The lock-apply mechanism (Task 2)** is asserted BY OUTCOME (the file/link IS locked after send/accept)
  rather than by mechanism, so the tests hold whether dev picks the PREFERRED parent-state-keyed
  BEFORE-INSERT/UPDATE trigger (2.1) or the ALTERNATIVE command step (2.2).
- **8.4-DOCS-01** (documented Lovable-oracle delta) is NOT a code test — it is a migration-header comment
  + Dev-Agent-Record note the dev authors. The lifecycle golden encodes the delta as `origin:
  "new-expected"` labelling (no real Lovable lock oracle); the doc itself is left to dev-story (no
  automated assertion), noted here so trace doesn't flag it as a missing test.
- **No PII / öre discipline:** every fixture öre value is `125_000` (< 10 digits — the orgnr-scan
  boundary, R-717/R-819); anonymized display names only (`offert-8-4.pdf`, `acceptans-bevis-8-4.pdf`); no
  personnummer/orgnr/name/email/phone. The sent version + accepted acceptance are produced by the REAL
  Epic-6/7 chains where the command path is exercised (mark-sent / capture-acceptance) and by BYPASSRLS
  seed only for the direct-SQL RLS negatives, so the locked fields are authentic.

## Acceptance Criteria Coverage

- **AC1 — sent-version file-links locked; replace/delete blocked at BOTH layers; AGREES with QV409:**
  8.4-INT-01 (lock applied at send, command-observable) + 8.4-RLS-01/02 (the load-bearing DB-trigger
  rejection, `FL823`) + 8.4-RLS-05 (the pre-send-vs-post-send re-point boundary) + 8.4-RLS-06 (family
  agreement with `QV409`) + the mapper + predicate + golden. COVERED.
- **AC2 — accepted evidence immutable except an approved audited correction; AGREES with AR704:**
  8.4-INT-02 (lock applied at accept) + 8.4-RLS-06 (family agreement with `AR704`) + 8.4-INT-04 (command
  code) + the golden (committed-acceptance case). COVERED (the correction workflow itself is NOT built
  here — the tests assert only the immutability boundary).
- **AC3 — deletion of a locked file is archive-only + full audit event:** 8.4-INT-03 (archive succeeds,
  never a hard delete; exactly one clean audit row, no path/PII) + 8.4-RLS-03/04 (`locked → archived`
  allowed, disarm rejected). COVERED.
- **AC4 — partial-lock / broken archive-delete leaves a consistent, retryable state:** 8.4-INT-05
  (idempotent re-archive no-op; atomic lock-apply — a stray file stays unlocked). COVERED.
- **AC5 — cross-tenant locked-file attacks denied with generic user-safe errors:** 8.4-INT-RLS-01
  (`TENANT_ACCESS_DENIED` on the command, `UNAUTHENTICATED` for anon) + 8.4-RLS-07 (zero rows affected,
  no existence disclosure, generic `FL823` RAISE). COVERED.

## Next Steps (TDD Green Phase — for dev-story)

After implementing Story 8.4 (the additive migration `20260712120000_file_link_lock.sql`; the
`FILE_LINK_LOCKED` code + Swedish message in `command-errors.ts`; the `FL823` branch in `file-db.ts`
`throwMappedFileWriteError`; the `archiveFile`/`archiveFileLink` command in `files.ts`; the
`lock-predicates.ts` helper; the `EntityFilePanel` lock notice + archive affordance):

1. **INT scaffold** (`file-link-lock.int.test.ts`): DELETE the `archiveFile` typed-local-stub block and
   uncomment `import { archiveFile } from "@/server/commands/files";`; remove `.skip` from the 6
   `describe.skip` blocks. Align the `file.archived` event-type + `{ id, reason }` input if dev chose
   different names.
2. **RLS scaffold** (`file-link-lock.rls.test.ts`): remove `.skip` from the 7 `describe.skip` blocks;
   confirm `FILE_LINK_LOCK_SQLSTATE = "FL823"` matches the migration's chosen SQLSTATE (adjust in one
   place if different).
3. **Mapper unit** (`file-write-error-mapping.test.ts`): remove `{ skip: true }` from the 2 8.4 tests.
4. **Predicate unit** (`file-lock-predicate.test.ts`): DELETE the typed-local-stub block, uncomment the
   real `@/features/files/lock-predicates` import, remove `.skip`.
5. **E2E** (`file-lock-panel.e2e.spec.ts`): remove `test.skip` from the 3 tests; add the `data-testid`s
   the spec expects (`file-lock-notice`, `evidence-lock-notice`, `archive-file`) and ensure NO
   `replace-file` / `delete-file` controls render for a locked file; extend global-setup to persist a
   `sentQuote` + `acceptedAcceptance` fixture (per-run-unique via `crypto.randomUUID()`).
6. Run: `pnpm run test:unit` (fast) → bring up the local Supabase stack (poll `/auth/v1/health` to 200
   after `supabase db reset`) and `pnpm run test:int` (`SUPABASE_TEST_REQUIRED=1`) → `pnpm run test:e2e`.
   All 8.4 tests must PASS.
7. If any fail: fix the implementation (feature bug) or the test (test bug); the DB `FL823` rejection is
   the load-bearing proof — a UI-disable alone is a STOP (R-812).

## Regression Guardrails (must stay green — no scaffold edits, just re-run)

- `migration-reset.int.test.ts` + `file-tables-migration-reset.int.test.ts` (per-table policy
  enumeration UNCHANGED — the 8.4 trigger adds NO RLS policy, NO new table, NO new column; H4 inventory
  gate stays green).
- `rls-inventory-gate.int.test.ts` + `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts`
  (`files`/`file_links` already enrolled — 8.4 must NOT hand-write ad-hoc isolation that bypasses the
  inventory).
- `generate-quote-pdf-*.int.test.ts` (the 6.3 PDF suites — the pre-send preview + retry re-point must
  stay green; the parent-state-keyed lock apply must not lock a DRAFT version's PDF link — the
  coverage-inversion re-verify from the epic-8 retro).
- `mark-quote-version-sent.int.test.ts` + `quote-sent-lock.e2e.spec.ts` (6.4 `QV409` — 8.4 does NOT edit
  the frozen trigger; `FL823` is additive and orthogonal).
- `accepted-record-lock.int.test.ts` + `acceptance-evidence-link.int.test.ts` (7.4/7.1 `AR704` + evidence
  link — 8.4 does NOT edit the frozen accept RPC/trigger).
- `audit-append-only.int.test.ts` + `audit-metadata-hygiene-e2e.int.test.ts` (the file archive event
  writes through the same append-only `audit_events`, allow-listed metadata only).

## Generated Files

- `tests/integration/commands/file-link-lock.int.test.ts` (NEW — 8.4-INT-01..05 + INT-RLS-01)
- `tests/integration/rls/file-link-lock.rls.test.ts` (NEW — 8.4-RLS-01..07, the load-bearing DB half + family agreement)
- `tests/unit/server/commands/files/file-write-error-mapping.test.ts` (NEW — the `FL823` mapper branch, 2 skipped 8.4 tests + 3 active 8.1 guards)
- `tests/unit/features/files/file-lock-predicate.test.ts` (NEW — the pure lock-decision predicates, skipped)
- `tests/unit/features/files/file-lock-lifecycle-golden.test.ts` (NEW — the lock-state lifecycle oracle, ACTIVE)
- `tests/fixtures/golden/files/file-lock-lifecycle.json` (NEW — the lock-state golden fixture)
- `tests/e2e/files/file-lock-panel.e2e.spec.ts` (NEW — 8.4-E2E-01, message-only, skipped)
- `_bmad-output/test-artifacts/atdd-checklist-8-4-quote-pdf-attachment-and-acceptance-evidence-locks.md` (this checklist)
