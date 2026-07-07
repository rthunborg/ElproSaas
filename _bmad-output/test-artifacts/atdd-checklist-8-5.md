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
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-5-limited-file-index-and-file-audit-within-phase-a-scope.md'
  - '_bmad-output/test-artifacts/test-design-epic-8.md'
  - '_bmad-output/planning-artifacts/architecture.md (#6, #9, #14, #15)'
  - 'src/features/files/read.ts (readEntityFiles sibling)'
  - 'src/features/files/lock-predicates.ts'
  - 'src/server/commands/files/validation.ts (ACTIVE_OWNER_TYPES)'
  - 'tests/e2e/files/file-lock-panel.e2e.spec.ts (AC4 contract — already scaffolded)'
  - 'tests/integration/commands/file-link-lock.int.test.ts (8.4 archive+audit template)'
  - 'tests/integration/rls/storage-object-isolation.rls.test.ts (isolation template)'
  - 'tests/unit/guardrails/job-non-scope.test.ts (forbidden-token discipline)'
  - 'tests/unit/features/files/file-lock-predicate.test.ts (pure-unit red-phase stub convention)'
---

# ATDD Checklist: Story 8.5 — Limited File Index And File Audit Within Phase A Scope

## Preflight & Context (Step 1)

- **Stack detected:** `fullstack` (Next.js app + Supabase Postgres/Storage; `playwright.config.ts` +
  Vitest + `node --test` all present).
- **Frameworks configured:** Playwright (E2E), Vitest (`SUPABASE_TEST_REQUIRED=1` INT/RLS), `node --test`
  strip-types runner (pure unit). Test config confirmed present.
- **TEA flags:** `tea_use_playwright_utils: true`, `tea_browser_automation: auto`,
  `test_stack_type: auto` → resolved `fullstack`, `risk_threshold: p1`.
- **Prerequisites:** Story is `ready-for-dev` with five clear ACs (AC1-AC5). PASS.

## Generation Mode (Step 2)

- **Mode: AI generation from the acceptance criteria + the existing shipped test patterns.** The
  surfaces are standard (RLS-scoped list read, command-backed archive audit, panel affordance states,
  pure filter/guard logic) and every reuse target (`archiveFile`, `readEntityFiles`,
  `lock-predicates`, `ACTIVE_OWNER_TYPES`, the two-tenant factory) already exists — no live browser
  recording needed. Selectors follow the shipped `file-lock-panel.e2e.spec.ts` contract.

## TDD Red Phase — Failing Acceptance Scaffolds Generated

All new tests assert EXPECTED behavior and are intentionally inert until 8.5 lands:

| Level | File | Tests | Red-phase mechanism |
| --- | --- | --- | --- |
| E2E (Playwright) | `tests/e2e/files/file-index-scope.e2e.spec.ts` (NEW) | 3 | `test.skip` |
| E2E (Playwright) | `tests/e2e/files/file-lock-panel.e2e.spec.ts` (EXISTS — the AC4 contract) | 3 | `test.skip` (dev un-skips in Task 2.5) |
| INT/RLS (Vitest) | `tests/integration/rls/file-index-isolation.rls.test.ts` (NEW) | 4 | `describe.skip` |
| INT (Vitest) | `tests/integration/commands/file-audit-events.int.test.ts` (NEW) | 4 | `describe.skip` |
| UNIT (`node --test`) | `tests/unit/features/files/file-index.test.ts` (NEW) | 7 | `describe.skip` + throwing local stubs (no static import of the not-yet-existing module — the runner-glob trap) |
| UNIT (`node --test`) | `tests/unit/guardrails/file-index-non-scope.test.ts` (NEW) | 3 | **LIVE from red phase** (standing R-816 guardrail — passes green now, must stay green) |

**Total new scaffolds:** 5 files, 21 tests (18 skipped red-phase + 3 live guardrail). Plus the 3
already-scaffolded `file-lock-panel` tests dev un-skips in green. No placeholder assertions
(`expect(true).toBe(true)`) anywhere.

## Acceptance Criteria Coverage

| AC | Scenario | Level | Test id(s) | Priority |
| --- | --- | --- | --- | --- |
| **AC1** limited index lists only Phase A files, no doc-center | index root renders; no deferred label; only Phase A categories | E2E | `8.5-E2E-01` (file-index-scope) | P2 |
| **AC1** | own-tenant listing across owner types; display-safe projection; archived dropped | INT/RLS | `8.5-RLS-01/03/04` | P1 |
| **AC1** | owner-category map + filter + forbidden-deferred guard (pure) | UNIT | `8.5-UNIT-01` | P1 |
| **AC1/R-816** | no doc-center/deferred token in index sources; nav stays 7 | UNIT (live) | `8.5-UNIT-02` | P2 |
| **AC2** every file event a §15-clean audit row | archive writes 1 clean `file.archived` row; idempotent re-archive writes 0; §15 set closed | INT | `8.5-INT-01/02` | P1 |
| **AC3** search/filter strictly own-tenant; RLS negative | cross-tenant owner-id probe → 0 rows; positive own set + absence of foreign id | INT/RLS | `8.5-RLS-01/02` | P1 |
| **AC4** panel lock-notice + archive-only; no replace/delete on locked | lock notice text; archive-only; replace/delete count 0; evidence notice | E2E | `8.4-E2E-01` (file-lock-panel — dev un-skips) | P1 |
| **AC5** cross-tenant index/archive → generic denial | cross-tenant archive → `TENANT_ACCESS_DENIED`, no audit row | INT | `8.5-INT-03` | P1 |

**Note on AC2/AC5 by-construction coverage:** the archive audit shape + cross-tenant denial are already
proven at the command layer by 8.4 (`file-link-lock.int.test.ts` 8.4-INT-03 / 8.4-RLS-01). The 8.5 INT
suite is the **coverage-inversion re-verification** that the archive UI path routes through the SAME
command (no divergent write path — the epic-8 retro rule) plus the §15-set-completeness check — it does
NOT re-implement the 8.1/8.2/8.3 upload/link/sign audit coverage.

## Red-Phase Verification (run now)

- `tests/unit/guardrails/file-index-non-scope.test.ts` → **3 pass** (live guardrail is green today and
  must stay green as 8.5 lands).
- `tests/unit/features/files/file-index.test.ts` → **suite SKIP** (loads cleanly, does not hard-fail —
  the throwing-stub convention avoids the `node --test` missing-module load error).
- Full unit gate (`tests/unit/**`) → **1215 pass, 0 fail** (no regression).
- `file-index-isolation.rls.test.ts` + `file-audit-events.int.test.ts` → **8 skipped, 0 fail** under
  Vitest with no live stack (they resolve their real imports and skip via `describe.skip`).
- E2E scaffold: 3 `test.skip` tests; collection requires the global-setup `.auth/fixture.json` (same
  top-level `readFileSync` convention as the shipped `file-lock-panel.e2e.spec.ts`).
- `eslint` on all 5 new files → **0 errors** (3 non-blocking unused-`_param` warnings on the throwing
  stubs — identical to the shipped 8.4 red-phase scaffold; they clear on green when the stub block is
  deleted).

## Next Steps (TDD Green Phase — for dev-story)

1. **Task 1** — add `readFileIndex()` to `src/features/files/read.ts`; extract pure logic to
   `src/features/files/file-index.ts` (owner-category map + `filterFileIndexRows` +
   `FORBIDDEN_DEFERRED_CATEGORIES`); replace `src/app/(app)/files/page.tsx` stub with the
   `force-dynamic` server component → `src/components/files/FileIndexList.tsx`.
   - Then in `file-index.test.ts`: DELETE the throwing-stub block, uncomment the real
     `@/features/files/file-index` import, remove `describe.skip`. Align the export names if dev chose
     different ones (`ownerCategoryLabel` / `filterFileIndexRows` / `FORBIDDEN_DEFERRED_CATEGORIES` /
     `FileIndexRow`).
2. **Task 2** — wire the `EntityFilePanel` lock-notice + `archive-file` (+ `evidence-lock-notice`);
   add `archiveFileAction`; add the `data-testid`s (`file-index`, `file-index-category-filter`,
   `file-lock-notice`, `evidence-lock-notice`, `archive-file`; NO `replace-file`/`delete-file` on a
   locked file). Remove the three `test.skip` in `file-lock-panel.e2e.spec.ts`.
3. **Task 3** — remove `describe.skip` from `file-index-isolation.rls.test.ts` and
   `file-audit-events.int.test.ts`; run under `supabase start && supabase db reset` with
   `SUPABASE_TEST_REQUIRED=1`.
4. Run `pnpm typecheck && pnpm lint && pnpm test` green; confirm no regression in the 8.2/8.3/8.4 file
   suites.

## Key Risks / Assumptions (hand-off to dev-story)

- **FIXTURE GAP (blocks the AC4 E2E green phase):** `file-lock-panel.e2e.spec.ts` reads
  `fixture.sentQuote.{quoteId,sentVersionId}` and `fixture.acceptedAcceptance.{acceptanceId,quoteId}`,
  but the current `tests/e2e/global-setup.ts` fixture object (lines 565-630) does NOT emit those keys —
  it has `quote`, `acceptQuote`, `acceptedJob`, etc. Dev Task 2.5 MUST add `sentQuote` +
  `acceptedAcceptance` (with their file ids) to global-setup, or repoint the spec at existing keys
  (e.g. `quote.sentVersionId` for the sent-quote PDF and an accepted acceptance's evidence). The spec
  header calls this "already scaffolded" — it is NOT; this is the real red-phase gap.
- **`readFileIndex` is cookie-bound (not injectable)** — the RLS suite runs the EXACT index query shape
  on the fixture's authed anon-key client (mirrors how `storage-object-isolation.rls.test.ts` proves
  the plane). If dev exposes an injectable `readFileIndex({ client })`, swap the direct query for it.
- **Export-name alignment:** the pure-unit scaffold assumes `ownerCategoryLabel` / `filterFileIndexRows`
  / `FORBIDDEN_DEFERRED_CATEGORIES` / `FileIndexRow`. If Task 1.4 names them differently, update the
  import + call sites (documented inline in the file).
- **No schema change expected:** the index is a READ over existing `file_links`→`files`; the panel
  archive reuses the 8.4 `archiveFile` command. If a projection needs a read column that does not exist,
  that is a scope surprise → surface as an open question, do NOT silently add a migration.
- **CLI/browser sessions:** none opened (AI-generation mode; no live recording). No orphaned browsers.
- **Temp artifacts:** stored under `_bmad-output/test-artifacts/` (this checklist); no random temp
  locations.

## Next Recommended Workflow

`bmad-dev-story` on Story 8.5 (implement the feature, then flip the 18 skipped scaffolds + the 3
`file-lock-panel` tests to green). `bmad-testarch-trace` afterward to confirm the AC→test traceability
matrix closes.
