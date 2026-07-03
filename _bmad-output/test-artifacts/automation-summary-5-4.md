---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-03'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-4-calculation-readiness-review-and-snapshot-preview.md'
  - '_bmad-output/test-artifacts/test-design-epic-5.md'
  - 'src/features/calculations/readiness.ts'
  - 'src/features/calculations/vat-posture.ts'
  - 'src/features/calculations/totals.ts'
  - 'tests/unit/features/calculations/readiness.test.ts'
  - 'tests/unit/features/calculations/readiness-inclusion.golden.test.ts'
  - 'tests/e2e/calculations/calculation-readiness.e2e.spec.ts'
---

# Test Automation Expansion — Story 5.4 (Calculation Readiness Review & Snapshot Preview)

## Mode & Stack

- **Execution mode:** BMad-Integrated (story + `test-design-epic-5.md` present).
- **Detected stack:** fullstack (Next 16 / React 19 front end + Supabase/pg back end). Framework verified: Playwright (`@playwright/test`), Vitest 4.1.9 (`test:int`), and `node --test` fast unit gate all present.
- **Focus:** expand automation coverage for the code implemented in this story — the PURE readiness classifier (`readiness.ts`) and the pure VAT-posture helper (`vat-posture.ts`), which are the fast-gate-protected contract deliverables (R-509 coverage-shape).

## Existing coverage (baseline, before expansion)

- **UNIT** `tests/unit/features/calculations/readiness.test.ts` — 5.4-UNIT-01 (one case per rule-table condition), 5.4-UNIT-02 (tax non-final framing), 5.4-UNIT-04 (empty-section / zero-price / threshold-boundary edges), `resolveVatDisplayPosture` core cases.
- **GOLDEN** `readiness-inclusion.golden.test.ts` — 5.4-GOLDEN-01 (hidden + selected count; unselected excluded; VAT inclusion) against the frozen `options-tillval.json` pin.
- **E2E** `calculation-readiness.e2e.spec.ts` — 5.4-E2E-01 (blocker gates affordance, both gate states), 5.4-E2E-02 (preview content), 5.4-E2E-03 (new-version message present).
- Baseline fast gate ran clean: 31 story-5.4 unit cases / 813 total green.

## Coverage plan (gaps targeted)

The headline classifier is a pure function (highest-value UNIT level per `test-levels-framework`). The E2E already proves the UI gate/preview/message; no UI code changed, so no new E2E was warranted. Expansion is therefore all at the fast-gate UNIT level, filling genuine untested branches and behavioural contracts of the implemented classifier + posture helper:

| Target | Level | Priority | Gap filled |
| --- | --- | --- | --- |
| Report shape: blocker + warnings coexist | UNIT | P1 | A blocker never suppresses the warning list (pins the E2E-asserted behaviour at the contract layer) |
| Every issue: non-empty message + severity/group agreement | UNIT | P1 | Message/severity invariant across all emitted codes |
| No message leaks öre / basis-point jargon | UNIT | P1 | Boundary-copy discipline (kronor/percent only) |
| `MISSING_CUSTOMER` OR-branch (id present, name null) | UNIT | P1 | Second blocker predicate branch |
| `LOW_MARGIN` quantity-invariance | UNIT | P1 | Ratio depends on unit sell/cost, not quantity |
| `LOW_MARGIN` negative margin (cost > sell) | UNIT | P2 | Below-cost detection |
| `LOW_MARGIN` cross-section aggregation → single warning | UNIT | P2 | Aggregation multiplicity |
| `LOW_MARGIN` null cost → full margin → no warning | UNIT | P2 | Null-cost = zero-cost path |
| `EMPTY_SECTION` multiplicity (one per empty section) | UNIT | P2 | Per-section emission (guards a future accidental dedup) |
| `MISSING_WORK_ROLE` only for labor / only counted rows | UNIT | P1 | Non-labor and excluded-option negatives |
| `HIDDEN_ROWS_INCLUDED` only for counted hidden rows | UNIT | P1 | Excluded hidden option raises no disclosure; selected hidden option does |
| `TAX_SIGN_OFF_REQUIRED` label variants (grön / default) | UNIT | P1 | `gron_teknik` and no-type label branches |
| No spurious `privatkunder` note for private posture | UNIT | P2 | Eligibility-note branch only fires for non-private |
| No per-person-cap implication for any deduction type (R-512) | UNIT | P1 | Persons flat-cap discipline |
| `resolveVatDisplayPosture` unrecognised non-empty type | UNIT | P1 | Unknown type → non-private path (not silently private) |

## Result

- **14 new UNIT cases** appended to `tests/unit/features/calculations/readiness.test.ts` (story-5.4 unit file: 31 → 45).
- All new cases pass against the real implementation. No production code changed — tests pin existing behaviour only.
- Full fast gate green: **831 unit tests pass, 0 fail** (was 813 pre-story + this expansion).
- `pnpm typecheck` clean; `pnpm lint` clean (0 errors — the single warning in `vat.test.ts` is pre-existing and unrelated).
- No new DB/E2E run required: additions are pure `node --test` fast-gate units; the existing E2E already covers the DB-backed gate/preview/message paths and no UI/app code was touched.

## Notes

- These are regression pins on the shipped classifier contract — none required a production change, confirming the story's implementation is sound at every branch pinned.
- The `is_selected boolean | null` read-type inconsistency (5.2 Low deferral) remains a future editor-polish item; the new tests confirm `rowCountsTowardTotal` treats `null`/`false` identically, so it does not affect classification.
