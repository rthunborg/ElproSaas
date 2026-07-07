---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-07'
inputDocuments:
  - _bmad-output/implementation-artifacts/8-4-quote-pdf-attachment-and-acceptance-evidence-locks.md
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - tests/integration/rls/file-link-lock.rls.test.ts
  - tests/integration/commands/file-link-lock.int.test.ts
  - tests/unit/features/files/file-lock-predicate.test.ts
  - tests/unit/features/files/file-lock-lifecycle-golden.test.ts
  - tests/unit/server/commands/files/file-write-error-mapping.test.ts
  - src/server/commands/files/files.ts
  - src/server/commands/files/validation.ts
  - src/server/commands/quotes/generate-pdf.ts
  - src/features/files/lock-predicates.ts
---

# Test Automation Expansion — Story 8.4 (Quote/PDF/Attachment + Acceptance Evidence Locks)

## Step 1 — Preflight & Context

- **Mode:** BMad-Integrated (story file + epic test-design present).
- **Stack:** `backend`/`fullstack` (Next.js + Supabase). Two-runner discipline: pure logic →
  `node --test` under `tests/unit/**` (`pnpm run test:unit`); DB-backed INT/RLS → Vitest under
  `tests/integration/**` (`pnpm run test:int`). Framework already initialized — no `framework`
  workflow needed.
- **Knowledge (core):** test-levels-framework, test-priorities-matrix, data-factories,
  selective-testing, test-quality. Playwright/Pact utils not applicable (no browser/contract surface
  in this story).

## Step 2 — Automation Targets & Coverage Assessment

Story 8.4 shipped with an already-thorough two-layer proof set. Existing coverage audited:

| Surface (production)                                     | Existing coverage                                                        | Level         |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| `enforce_file_link_lock` / `enforce_file_lock` triggers  | `file-link-lock.rls.test.ts` (8.4-RLS-01..07: mutate/re-point/disarm/DELETE → FL823; archive-allowed; family agreement; cross-tenant zero-rows) | RLS (DB)      |
| Parent-state-keyed lock APPLY (send/accept moment)       | `file-link-lock.int.test.ts` (8.4-INT-01/02: sent PDF link + evidence link land `locked`) | INT (command) |
| `archiveFile` archive-only-delete + audit                | `file-link-lock.int.test.ts` (8.4-INT-03/04/05: soft-delete, one clean audit row, hardDelete → FILE_LINK_LOCKED, cross-tenant → TENANT_ACCESS_DENIED, anon → UNAUTHENTICATED, idempotent no-op) | INT (command) |
| `FL823 → FILE_LINK_LOCKED` file-write mapper             | `file-write-error-mapping.test.ts` (mapping + no leak)                   | Unit          |
| `isFileLinkLockable` / `isLockedFileArchivable`          | `file-lock-predicate.test.ts` (every branch)                            | Unit          |
| Lock-state lifecycle golden                              | `file-lock-lifecycle-golden.test.ts` + JSON fixture                     | Unit (golden) |

**Gaps identified (untested production surfaces added by this story):**

1. **`validateArchiveFile` (pure exported validator, `src/server/commands/files/validation.ts`)** —
   the `archiveFile` command's `validateInput` gate. Has real branches (UUID `id`, optional bounded
   `reason` trim/empty/oversize, optional `hardDelete` type, server-authority strip of client
   `tenant_id`/`object_path`/`bucket_id`) and had **zero unit coverage**. This is exactly the
   coverage-shape discipline the story emphasizes — pin every pure branch in the fast `node --test`
   gate. **P1** (input-boundary correctness; the command's crafted-request surface).

2. **`throwMappedPdfWriteError` FL823 branch (`generate-pdf.ts`)** — the post-send PDF re-point maps
   `FL823 → FILE_LINK_LOCKED`. The function is **private (non-exported)**; unit-testing it in
   isolation would require exporting it (a production change outside test-authoring scope). Its
   behavior is already proven end-to-end by the RLS suite (post-send re-point → `FL823`, 8.4-RLS-05)
   and the identical mapping table is unit-covered on the `file-db.ts` sibling. **Intentionally not
   added** — the coverage is present, and exporting a private symbol purely for a test would be
   gratuitous production surface.

**Justification for scope:** SELECTIVE — the story's AC1-AC5 are already covered at RLS, command,
mapper, predicate, and golden levels. Only gap #1 was a genuinely untested pure production branch
set that the fast gate should protect. No new INT/RLS suites were warranted (would duplicate the
existing two-layer proofs).

## Step 3 — Generated Tests

**Added:** `tests/unit/server/commands/files/validate-archive-file.test.ts` — 9 tests, pure
`node --test`, no DB / no PII / no clock. Mirrors the 8.2 `validate-upload-file.test.ts` template.

Branches pinned (all P1, mapped to AC3/AC4/AC5):

- `8.4-UNIT-02a` — a fully-valid `{ id }` (no reason, no hardDelete) ACCEPTS; absent optionals omitted.
- `8.4-UNIT-02b` — an optional bounded `reason` ACCEPTS and is trimmed.
- `8.4-UNIT-02c` — a well-typed `hardDelete: true` ACCEPTS (crafted-request surface; the block is
  the command's job, proven in INT).
- `8.4-UNIT-02d` — a non-record input → VALIDATION_FAILED.
- `8.4-UNIT-02e` — a non-UUID `id` → VALIDATION_FAILED (a value the DB would `22P02`-reject).
- `8.4-UNIT-02f` — a non-string / empty / whitespace-only `reason` → VALIDATION_FAILED.
- `8.4-UNIT-02g` — an oversized `reason` (> 128 chars) → VALIDATION_FAILED (raw value never echoed).
- `8.4-UNIT-02h` — a non-boolean `hardDelete` → VALIDATION_FAILED.
- `8.4-UNIT-02i` — a client-supplied `tenant_id`/`object_path`/`bucket_id` is NOT surfaced on the
  narrowed value (server-authority only — R-809/AC5 posture).

## Verification

- `pnpm run test:unit` — **1212 pass, 0 fail, 0 skipped** (was 1203 before; +9 new).
- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors (1 pre-existing unrelated warning in `vat.test.ts`).
- DB-backed INT/RLS suites (`file-link-lock.*`) unchanged and remain the two-layer proof of record
  (run under `SUPABASE_TEST_REQUIRED=1` with the local stack up).

## Deferred / knowingly not added

- `throwMappedPdfWriteError` isolated unit test — the symbol is private; behavior already covered
  end-to-end (RLS 8.4-RLS-05) + via the sibling `file-db.ts` mapper unit test. Not worth exporting a
  private function solely for a test.
