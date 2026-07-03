---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-03'
workflowType: testarch-automate
story: 5.3 Pricing Source Selection And Row Snapshots
detectedStack: fullstack
executionMode: sequential (targeted coverage expansion on a reviewed story)
inputDocuments:
  - _bmad-output/implementation-artifacts/5-3-pricing-source-selection-and-row-snapshots.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - src/server/commands/calculations/rows.ts
  - src/server/commands/calculations/validation.ts
  - src/features/calculations/form-parsing.ts
  - src/features/calculations/source-options.ts
  - src/components/calculations/RowEditor.tsx
  - tests/integration/commands/calculation-row-source.int.test.ts
  - tests/unit/server/commands/calc-source-validation.test.ts
  - tests/unit/features/calculations/form-parsing.test.ts
  - tests/unit/features/calculations/source-options.test.ts
  - tests/e2e/calculations/calculation-source-selection.e2e.spec.ts
knowledgeFragments:
  - test-levels-framework.md
  - test-priorities-matrix.md
  - test-quality.md
---

# Test Automation Expansion — Story 5.3

## Preflight

- Framework present (no `framework` workflow needed): Vitest 4.1.9 (INT/RLS), Playwright
  (E2E), `node --test` + `--experimental-strip-types` (pure UNIT fast gate). BMad-Integrated
  mode (story + epic-5 test design present). Story status `review`, implementation complete.
- Local Supabase stack reachable; `/auth/v1/health` = 200 before DB-backed runs (avoids the
  false-green skip trap).

## Coverage baseline (already present, verified green)

Story 5.3 shipped strong coverage already: INT 5.3-INT-01/02/03(create+update)/04 (store
frozen snapshot, freeze proof, both-layers cross-tenant spoof, archived-source
explainability); UNIT source-pair validation (both-or-neither / unknown kind / non-UUID /
empty-string-drop / clear / clear+pair contradiction), form-parser source round-trip + clear,
and `source-options` mapping; E2E 5.3-E2E-01..05 (work-role + article prefill/provenance,
manual save, no-supplier-label, seven-item nav). No duplication was added over these.

## Gaps identified & filled

Two genuine, load-bearing gaps had no dedicated automated coverage:

1. **Source CLEAR / REPLACE round-trip at the DB layer (P1, INT).** Task 2.4's headline
   "cleared-binding" behaviour (switch a sourced row back to manual → ALL `source_*` columns
   null TOGETHER) and the re-source case (replace one work role with another → all captured
   columns move wholesale, no stale field) were proven only at the parser/validator layer,
   never end-to-end at the DB. Added `5.3-INT-05` (clear round-trip: create-with-source →
   `source_clear:true` → every source column null) and `5.3-INT-06` (replace: create-with-A →
   update-to-B → captured columns are wholly B, nothing from A) to the existing INT suite.

2. **RowEditor pure select-value helpers (P2, UNIT fast gate).** `encodeSourceValue` /
   `decodeSourceValue` (the `<select>`-value ↔ `source_kind`/`source_id` contract, incl. the
   malformed-value branches: no colon, leading colon, unknown kind, empty id, id-with-colon)
   and `sourcesForRowType` / `kindForRowType` (labor→work-role, material→article, else manual)
   were only indirectly exercised by the slow/flaky E2E. Extracted them out of the
   `"use client"` `RowEditor.tsx` into a pure I/O-free module
   `src/features/calculations/source-select.ts` (JSX in a `.tsx` cannot be imported by the
   strip-types `node --test` runner) and unit-pinned all branches. RowEditor now imports the
   helpers — no behavioural change (typecheck/build/containment green).

## Test levels & priorities

| Target                                             | Level | Priority | Added                       |
| -------------------------------------------------- | ----- | -------- | --------------------------- |
| source clear round-trip (all columns null together)| INT   | P1       | 5.3-INT-05                  |
| source replace (captured columns move wholesale)   | INT   | P1       | 5.3-INT-06                  |
| select-value encode/decode + malformed branches    | UNIT  | P2       | source-select.test.ts (×8)  |
| row-type → source-list / kind mapping              | UNIT  | P2       | source-select.test.ts (×4)  |

## Files changed

- `tests/integration/commands/calculation-row-source.int.test.ts` — +2 INT tests (clear, replace).
- `src/features/calculations/source-select.ts` — NEW pure module (extracted RowEditor helpers).
- `tests/unit/features/calculations/source-select.test.ts` — NEW, 12 unit tests.
- `src/components/calculations/RowEditor.tsx` — imports the extracted helpers (no behaviour change).

## Verification

- `pnpm typecheck` ✓ · `pnpm lint` ✓ (1 pre-existing unrelated warning in `vat.test.ts`)
- `pnpm run test:unit` ✓ 782 pass (was 770; +12 new source-select unit tests)
- `pnpm build` ✓ (`/calculations/[calculationId]` stays `ƒ` dynamic)
- `verify:service-role-containment` ✓ · `verify:bundle-containment` ✓
- INT (source suite, `SUPABASE_TEST_REQUIRED=1`) ✓ 8/8 — the 2 new tests confirmed RAN
  (verbose reporter), not skipped.

## Notes

- No supplier/import/credential/external/sync/api scope introduced. Snapshot stays copy-by-value
  (no live FK). No new dependency, no `.env` edit, nav stays seven. The extraction is a pure
  refactor (helpers moved verbatim), keeping the E2E affordance behaviour identical.
