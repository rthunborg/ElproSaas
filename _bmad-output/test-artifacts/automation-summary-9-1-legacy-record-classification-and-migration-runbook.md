---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
  - step-03c-aggregate
  - step-04-validate-and-summarize
lastStep: step-04-validate-and-summarize
lastSaved: '2026-07-07'
inputDocuments:
  - _bmad-output/implementation-artifacts/9-1-legacy-record-classification-and-migration-runbook.md
  - _bmad-output/test-artifacts/test-design-epic-9.md
  - docs/migration/legacy-record-classification.md
  - docs/migration/migration-runbook.md
  - tests/integration/rls/tenant-table-inventory.ts
  - src/features/calculations/readiness.ts
  - tests/unit/guardrails/file-index-non-scope.test.ts
---

# Automation Summary — Story 9.1 (Legacy Record Classification & Migration Runbook)

## Preflight & Context (Step 1)

- **Stack detected:** `fullstack` (Next.js/React front end + Supabase/Postgres back end).
  Framework present: `playwright.config.ts` (E2E), `vitest.config.ts` (DB-backed INT/RLS),
  and the dependency-free `node --test` pure-logic unit runner
  (`pnpm test:unit`, glob `tests/unit/ ** / *.test.ts`). No `framework` scaffolding step
  needed.
- **Execution mode:** BMad-Integrated (story + epic-9 test design available).
- **Critical stack fact:** `tests/unit/**` runs on `node --test` (`node:test`/`node:assert`),
  NOT Vitest — Vitest only covers `tests/integration/**`. Any pure-logic/docs validator must
  therefore be authored for `node --test` and live under `tests/unit/**` or it is
  vacuous-green (the "runner-glob trap" the story warns of). New coverage was authored
  accordingly.

## Automation Targets & Coverage Plan (Step 2)

**Nature of the story under test:** Story 9.1 is **docs-only** — it implemented NO product
code, schema, migration, or fixture. Its git diff is two Markdown docs under `docs/migration/**`
(classification register + per-workflow runbook) plus story/tracking files. The epic-9 test
design (`test-design-epic-9.md`) weights 9.1's "tests" as **docs/checklist validators** over
`docs/migration/**`, and the story explicitly sanctions promoting them to executable
`tests/unit/**` checks that cite the real `ReadinessCode` union. There is therefore no API /
E2E / component surface to test; the coverage-expansion target is the docs-invariant validator
set — promoting the authoring story's MANUAL docs-review checks to STANDING, executable
`node --test` coverage.

| Test-design case | Level | Priority | Risk | Validator |
| --- | --- | --- | --- | --- |
| 9.1-CLASS-01 | Unit | P1 | R-907 | All four buckets present; every DEFERRED row → `none — deferred` (never a Phase A table); every LIVE target ∈ the real 24 `TENANT_TABLES`. |
| 9.1-RUNBOOK-01 | Unit | P2 | R-907/R-908 | All six Phase A workflows carry source · treatment · fallback · backfill-risk · cutover, each non-empty; cutover stated per-workflow, never whole-company. |
| 9.1-STOP-01 | Unit | P2 | R-907 | Fail-closed "scope-unclear → STOP" protocol section present with hard-STOP conditions (real-data export/import, over-migration, deferred-module activation); `8.1`/`8.2` owner-gated slots STOP-marked, not default-filled. |
| 9.1-PRIV-03 | Unit | P0 | R-901/R-902 | Whole-directory PII scan over `docs/migration/**`: zero personnummer-shaped / bare-10-digit orgnr (R-914) / non-placeholder email / phone / secret. |
| (representativeness guard) | Unit | P2 | R-903/R-904 | The docs' only readiness-code reference (`REQUIRED_FILES_DEFERRED`) is a REAL member of the `ReadinessCode` union; the fictional `REQUIRES_SIGN_OFF` / `DEDUCTION_ESTIMATE_UNAPPROVED` codes never appear. |

**Coverage scope justification:** *critical-paths* — the four test-design cases map 1:1 to
the story's three ACs + the epic-blocker PII control, plus one representativeness guard folded
from the epic-9 retro constraints. No further expansion is warranted because the story ships no
executable product logic.

## Generation & Aggregation (Steps 3 / 3C)

- **Execution:** sequential (single well-scoped docs-invariant target; the API/E2E/backend
  subagent split does not apply to a docs-only story with no product code, API, or UI).
- **File created:** `tests/unit/docs/migration-runbook-validators.test.ts` — 9 `node --test`
  cases covering the five plan rows above.
- **No fixtures / factories / helpers** needed — the validators read the committed docs and the
  live source-of-truth modules directly; no auth, data-factory, or network mock applies.
- **Source-of-truth cross-checks (no fabricated facts):** the 24-table Phase A boundary is
  loaded LIVE from `tests/integration/rls/tenant-table-inventory.ts` `TENANT_TABLES` (asserted
  count === 24); the readiness reference is cross-checked against the real
  `src/features/calculations/readiness.ts` union. A rename/removal in either source surfaces
  as a failure here rather than the docs quietly drifting.

## Validation & Summary (Step 4)

- **All 9 new cases pass.** Full unit suite after the addition: **1259 tests, 0 fail** (the new
  file IS picked up by the real `pnpm test:unit` glob — confirmed).
- **Non-vacuous proof (mutation testing):** temporarily (a) breaking the STOP-protocol heading
  → `9.1-STOP-01` fails; (b) wiring a deferred group (`warranties`) to a live table (`jobs`) →
  `9.1-CLASS-01 (R-907)` fails; (c) injecting a bare 10-digit orgnr → `9.1-PRIV-03` fails. All
  docs were restored byte-identical afterward (git diff clean aside from a benign LF/CRLF
  advisory).
- **No product code, schema, dependency, or `.env` touched.** The docs under `docs/migration/**`
  are unchanged (read-only inputs). The only new artifact is the test file + this summary.
- **Fixtures/helpers:** N/A. **CLI sessions:** N/A (no browser exploration). **Temp artifacts:**
  none left outside `_bmad-output/test-artifacts/`.

### Files created / updated

- **New:** `tests/unit/docs/migration-runbook-validators.test.ts` (9 executable validators).
- **New:** this summary (`_bmad-output/test-artifacts/automation-summary-9-1-*.md`).
- **Updated:** the story file's Dev Agent Record / File List / Change Log (records the new
  standing coverage).

### Assumptions & risks

- **Assumption:** the docs are the "code under test" for this docs-only story, per the epic-9
  test design; there is deliberately no product logic to unit-test. The whole-fixture-set
  automated privacy scanner (9.2-PRIV-01) and the register-traceability validators (9.4) remain
  LATER-story deliverables — 9.1's obligation is the clean, complete, STOP-marked docs plus the
  standing validators added here.
- **Risk (low):** the runbook-structure validator matches on the current section headings/field
  labels; a future heading rename in the docs would need a matching validator update. This is
  intentional — a drop of a required field or the STOP section should fail loudly rather than
  pass silently.

### Next recommended workflow

- `bmad-testarch-trace` (or the epic-9 trace) to fold these executable checks into the 9.1
  traceability row, then the standard code-review pass. No `framework`/`ci` work required —
  the file runs under the existing `pnpm test:unit` CI gate.
