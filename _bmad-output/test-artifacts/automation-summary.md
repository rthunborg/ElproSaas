---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-07'
workflowType: testarch-automate
story: 8.2 Validated Upload And Entity File Panels
detectedStack: fullstack
executionMode: sequential (pure fast-gate coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/8-2-validated-upload-and-entity-file-panels.md
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - _bmad/tea/config.yaml
  - src/features/files/form-parsing.ts
  - src/features/files/upload-action-state.ts
  - src/server/storage/upload-object.ts
  - tests/integration/commands/file-upload.int.test.ts
  - tests/unit/server/storage/upload-policy.test.ts
  - tests/unit/server/storage/upload-error-classifier.test.ts
  - tests/unit/server/commands/files/validate-upload-file.test.ts
  - tests/e2e/files/entity-file-panel.e2e.spec.ts
---

# Test Automation Expansion — Story 8.2 (Validated Upload & Entity File Panels)

## Mode & Context

- **Mode:** BMad-Integrated (story + `test-design-epic-8.md` provided). Create mode.
- **Detected stack:** `fullstack` (Next.js 16 / React 19 frontend + server command layer + Supabase/Postgres backend).
- **Frameworks (verified present):** `node --test` two-runner for pure `.ts` units (`tests/unit/**`, `@/*` alias via `tests/support/register.mjs`), Vitest (`test:int`, DB-backed), Playwright (`test:e2e`). No `framework` scaffolding needed.
- **TEA flags:** `tea_use_playwright_utils: true`, `test_stack_type: auto`, `risk_threshold: p1`, `tea_execution_mode: auto`.
- **Story state:** `review` — dev-story landed GREEN (unit 1152, INT 658, E2E green). This pass EXPANDS the fast `node --test` gate; it does NOT re-author passing suites.

## Coverage Assessment (what Story 8.2 already had)

Dev-story landed comprehensive coverage across levels via the ATDD scaffolds, all green:
`8.2-INT-01..05` (server gate + cross-tenant no-existence-disclosure + storage↔DB compensation across all 6 active owner types), `8.2-UNIT-01` (upload-policy MIME/size boundaries), `8.2-UNIT-02` (four-error-state classifier, every branch incl. R-809 collapse), `8.2-UNIT-03` (`validateUploadFile` shape/coupling/strip), `8.2-E2E-01/02` (panel structure + one deterministic error state).

The genuine, non-duplicative gaps were at the **pure fast-gate (`node --test`) level** — decision-carrying `.ts` modules the dev added that ship WITHOUT dedicated unit pins (the coverage-shape lesson surface — logic currently exercised only indirectly through the `"use server"` action or the skippable DB-backed INT):

1. **`src/features/files/form-parsing.ts`** (`parseUploadForm` + `precheckUpload`) — no dedicated unit. Untested: owner/purpose/name field trimming + null-on-blank; the R-803 guarantee that a client `object_path`/`bucket_id`/`tenant_id` is NEVER surfaced; and the client pre-check discriminant (`blocked-type` wins over `too-large`; `none` when both pass). Only exercised indirectly through the `"use server"` action.

2. **`src/features/files/upload-action-state.ts`** (`UPLOAD_ERROR_MESSAGES` + `isRetryableUploadError` + `UPLOAD_ACTION_INITIAL`) — no unit. Untested: the four distinct non-empty user-safe messages (one per state, no two identical — the AC3 "four DISTINCT error states" contract at the message layer); and the retryable predicate (only `NETWORK_OR_SERVER` retryable, `PERMISSION` never — mirrors the signed-access transient-vs-permanent discipline).

3. **`src/server/storage/upload-object.ts`** (`uploadObjectWithMetadata`) — the shared 6.3↔8.2 upload helper. Its verified-compensated branch table was proven end-to-end ONLY by the DB-backed INT (8.2-INT-05, which skips when no local Supabase stack is up). No FAST, deterministic pin of: storage-fault → throw before ANY metadata (nothing to compensate); file-row-written then link-fail → archive-then-rethrow the ORIGINAL error; archive secondary-fault swallowed (original still surfaced); happy path returns fileId/objectPath/linkId; object path server-derived tenant-first.

## Coverage Plan (this expansion)

| Target | Level | Priority | Test IDs | Justification |
| --- | --- | --- | --- | --- |
| `parseUploadForm` / `precheckUpload` | Unit (`node --test`) | P1 | 8.2-UNIT-04 | Closes the client pre-check + R-803 strip gap at the fast gate; no DB |
| `UPLOAD_ERROR_MESSAGES` / `isRetryableUploadError` / `UPLOAD_ACTION_INITIAL` | Unit (`node --test`) | P1 | 8.2-UNIT-05 | Pins the four-distinct-message + retryable contract (AC3) cheaply |
| `uploadObjectWithMetadata` branch table | Unit (`node --test`, injected fakes) | P0 | 8.2-UNIT-06 | Fast, non-skippable pin of the R-807 compensation seam the INT proves only end-to-end |

Scope: **selective fast-gate expansion.** No INT/RLS/E2E added — those levels are already comprehensively covered by dev-story per the test design; adding there would duplicate. No framework/CI change (two-runner + Playwright already green). No product code, migration, or dependency touched — test-only.

## Files Created

- `tests/unit/features/files/upload-form-parsing.test.ts` — pure units for `parseUploadForm` (field trim/null-on-blank; smuggled `object_path`/`bucket_id`/`tenant_id` NEVER surfaced — R-803) and `precheckUpload` (blocked-type / too-large / none; blocked-type precedence when both fail).
- `tests/unit/features/files/upload-action-state.test.ts` — pure units for the four DISTINCT non-empty `UPLOAD_ERROR_MESSAGES`, `isRetryableUploadError` (only NETWORK_OR_SERVER; PERMISSION/BLOCKED_TYPE/TOO_LARGE not; idle not), and `UPLOAD_ACTION_INITIAL` pristine shape.
- `tests/unit/server/storage/upload-object.test.ts` — pure units (injected fake storage/insert/archive fns) for `uploadObjectWithMetadata`: happy path (returns fileId/objectPath/linkId, tenant-first server-derived path, correct contentType/upsert, link receives the up-front id); storage fault throws BEFORE any metadata write (no compensation); link-insert fault after file-row-written archives THAT file id then re-throws the ORIGINAL error; archive secondary-fault swallowed (original still surfaced); file-row-insert fault (before file written) does NOT archive.

## Verification

- New subset (the three files): **all pass / 0 fail** (`node --test`).
- Full unit suite (`pnpm run test:unit`): green, no regressions.
- `pnpm typecheck`: clean. `eslint` on the three new files: 0 errors.

## Validation (step 4)

- **Framework readiness:** ✅ (node --test / Vitest / Playwright all present).
- **Coverage mapping:** ✅ tests carry `8.2-UNIT-04/05/06` IDs and map to AC1/AC3/AC4.
- **Test quality/structure:** ✅ pure (no DB / no PII / no clock), injected fakes only, runner-glob-safe under `tests/unit/**` (no `.tsx`).
- **Fixtures/factories/helpers:** none added — reuse existing module exports + in-file fakes.
- **CLI sessions:** none opened (source-analysis path, no browser exploration; no orphaned processes).
- **Temp artifacts:** this summary lives under `_bmad-output/test-artifacts/`.

## Assumptions & Risks

- INT/E2E suites (Vitest/Playwright, DB/browser-backed) were **not re-run** in this pass — they require a local Supabase stack / browser and were untouched. CI (`SUPABASE_TEST_REQUIRED=1`) remains the gate for those; the dev-story already ran them green. No DB-dependent tests were authored, so no stack run was needed.
- No product code, migration, or dependency was modified — pure test-only expansion.

## Next Recommended Workflow

- `trace` (refresh the Epic-8 traceability matrix to record the added fast-gate coverage for AC1/AC3/AC4), or `test-review` (validate the new tests against best-practices). Neither is blocking — the story remains `review` and green across all tiers.
