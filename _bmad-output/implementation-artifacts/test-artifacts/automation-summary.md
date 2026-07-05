---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-05'
workflowType: testarch-automate
story: 6.2 Draft Quote Version Review And Timeline UX
detectedStack: fullstack
executionMode: sequential (pure-unit coverage expansion)
inputDocuments:
  - '_bmad-output/implementation-artifacts/6-2-draft-quote-version-review-and-timeline-ux.md'
  - 'src/server/commands/quotes/validation.ts'
  - 'src/server/commands/quotes/update-draft.ts'
  - 'src/features/quotes/timeline.ts'
  - 'src/features/quotes/view-model.ts'
  - 'src/features/quotes/read.ts'
  - 'src/components/quotes/status.ts'
  - 'tests/unit/features/quotes/timeline.test.ts'
  - 'tests/unit/features/quotes/view-model.test.ts'
  - 'tests/unit/components/quotes/status.test.ts'
  - 'tests/unit/server/commands/quote-validation.test.ts'
  - 'tests/integration/commands/update-draft-quote-version.int.test.ts'
---

# Test Automation Expansion — Story 6.2 (Draft Quote Version Review And Timeline UX)

## Step 1 — Preflight & Context

- **Stack:** fullstack (Next.js 16 App Router + Supabase). Frameworks present and verified:
  `node --test` (fast unit gate, `test:unit`), Vitest 4.1.9 (`test:int`, DB-backed), Playwright
  (`test:e2e`, CI-gated `SUPABASE_TEST_REQUIRED=1`). Framework scaffolding exists — no `framework`
  workflow needed.
- **Mode:** BMad-Integrated. Story file 6.2 loaded (AC1–3 + Testing Requirements) plus the epic
  test design references (R-605/R-607/R-616, 6.2-UNIT-01/02, 6.2-E2E-01/02/03/04).
- **TEA config:** `tea_use_playwright_utils=true`, `tea_use_pactjs_utils=false`, `tea_pact_mcp=none`,
  `tea_browser_automation=auto`, `tea_execution_mode=auto`, `test_stack_type=auto`.

## Step 2 — Identify Targets

Story 6.2 already shipped substantial coverage (per its File List): `timeline.test.ts` (12),
`view-model.test.ts` (5, the R-607 leakage-by-construction guard), `status.test.ts` (4,
WCAG-1.4.1 text-not-color), `quote-non-scope.test.ts` (guardrail scan), the DB-backed
`update-draft-quote-version.int.test.ts`, and the `quotes.e2e.spec.ts` suite. The audit found the
existing pure-unit coverage strong for the presentation/selection helpers.

**Gap identified (single, high-ROI):** the Story-6.2 draft-edit input validator
`validateUpdateDraftQuoteVersion` (`src/server/commands/quotes/validation.ts`) had **NO pure unit
coverage**. Its sibling 6.1 validator (`validateCreateQuoteVersionFromCalculation`) is fully
unit-pinned in `quote-validation.test.ts`, and every other command domain (calc/crm/files/pricing/
settings) has a validator unit test — this was the one remaining gap. The validator is
security-relevant (it is the input-shape guard for the draft-only edit scope, the load-bearing R-605
property), pure (no I/O), and branch-rich (UUID guard, bounded free text, ISO-date parse, closed
display-mode allow-list, field-presence/empty-patch semantics, smuggled-key stripping). The
DB-backed INT suite proves the re-assert-draft / cross-tenant behaviour but does NOT exhaustively
exercise these shape branches — exactly the cheap coverage the fast gate should own.

**Level / priority:** UNIT (pure), P0 (input-shape guard on a security-relevant command path).
No E2E/API generation warranted — the E2E surface is already covered by the story's own suites and
this is pure logic; scope kept to the identified gap (selective).

## Step 3 — Generate Tests

Added `tests/unit/server/commands/update-draft-quote-validation.test.ts` (15 tests), mirroring the
existing `quote-validation.test.ts` house style (`node --test`, `assert/strict`, `@/` alias, no DB,
no PII, no clock). Coverage:

- **Happy paths:** id-only edit (empty-patch path), case-insensitive UUID, the full presentational
  set, ISO date AND full ISO timestamp for `valid_until`, every `display_mode` in the allow-list,
  empty-string bounded text, the exact 5000-char text bound.
- **Field-presence semantics (the empty-patch guard contract):** a present `null` is carried
  through (explicit clear) while an absent field is omitted, and `"field" in data` mirrors the raw
  input exactly (no spurious keys).
- **VALIDATION_FAILED negatives:** non-record raw, missing/non-UUID `quote_version_id`, non-string
  text, unparseable/out-of-bounds `valid_until`, `display_mode` outside the closed (case-sensitive)
  allow-list, over-5000 text.
- **Draft-scope stripping (R-605):** a client-supplied `tenant_id`/`status`/totals/`lines`/
  `quote_number` are stripped — only the id + supplied presentational fields survive the validator.

## Step 4 — Validate & Summarize

- New file unit run: **15/15 pass**.
- Full fast gate `pnpm run test:unit`: **944/944 pass** (was 929 → +15), 58 suites, ~4.2s.
- `pnpm run typecheck`: clean.
- `pnpm run lint`: clean (the single warning in `tests/unit/lib/money/vat.test.ts` is pre-existing
  and unrelated, already noted in the story Debug Log).
- No DB-backed suites needed (pure unit only); no framework/CI change; no source change; no new
  dependency; no migration.

**Files changed:**
- `tests/unit/server/commands/update-draft-quote-validation.test.ts` (NEW, 15 tests).

**Coverage delta:** the Story-6.2 `validateUpdateDraftQuoteVersion` input guard is now
exhaustively unit-pinned on the fast gate, closing the last validator-coverage gap in the quotes
command domain. No open questions, no deferred work, no blockers.
