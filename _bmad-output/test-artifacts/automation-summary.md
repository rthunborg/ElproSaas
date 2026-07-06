---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-06'
workflowType: testarch-automate
story: 6.3 Quote PDF Generation From Snapshot
detectedStack: fullstack
executionMode: sequential (pure-unit coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/6-3-quote-pdf-generation-from-snapshot.md
  - src/lib/quote-pdf/view-model.ts
  - src/server/quote-pdf/render.ts
  - src/server/commands/quotes/validation.ts
  - tests/unit/lib/quote-pdf/view-model.test.ts
  - tests/unit/lib/quote-pdf/pdf-text-golden.test.ts
  - tests/unit/server/commands/update-draft-quote-validation.test.ts
  - _bmad-output/test-artifacts/test-design/test-design-epic-6.md
---

# Test Automation Expansion — Story 6.3 (Quote PDF Generation From Snapshot)

## Preflight & Context

- **Mode:** BMad-Integrated (story file provided). Create mode.
- **Stack:** fullstack (Next 16 / React 19 frontend + Supabase backend). Frameworks verified:
  Playwright (`playwright.config.ts`), Vitest (`vitest.config.ts`), and the `node --test`
  fast-gate unit runner (`test:unit` via `tests/support/register.mjs` + `@/*` alias).
- **Story state:** `review` — dev-story landed GREEN (unit 952, int 490, e2e 70). All ATDD
  scaffolds flipped green. This pass EXPANDS the fast `node --test` gate; it does NOT re-author
  passing suites.
- **Surface reviewed:** the pure `buildQuotePdfViewModel` (`src/lib/quote-pdf/view-model.ts`),
  the deterministic server-only `renderQuotePdf` (`src/server/quote-pdf/render.ts`), the pure
  `validateGenerateQuotePdf` validator, plus the existing 6.3 tests
  (`view-model.test.ts`, `pdf-text-golden.test.ts` — 2 golden cases only) and the DB-backed
  INT/E2E proofs (source-of-truth, storage-privacy, determinism, retry, states).

## Identify Targets — Coverage Gaps

Focus: the fast `node --test` gate over the PURE + server-only-but-I/O-free 6.3 surface.
The load-bearing correctness proofs (source-of-truth INT-01, storage-privacy INT-02,
determinism INT-03, retry INT-04, E2E states) are DB/Playwright-backed and already pass —
not appropriate to re-implement as units. The genuine holes are cheap belts the fast gate
does NOT currently protect:

| Module | Gap (previously untested at the fast gate) | Priority |
| --- | --- | --- |
| `src/server/quote-pdf/render.ts` | `renderQuotePdf` byte-DETERMINISM at the fast gate (same VM + `renderedAt` → identical bytes) — INT-03 only proves it DB-backed | P1 |
| `src/server/quote-pdf/render.ts` | Injected-timestamp discipline: different `renderedAt` still renders; identical `renderedAt` is byte-identical (no wall-clock read in the render path, H3/R-612) | P1 |
| `src/server/quote-pdf/render.ts` | `NON_FINAL_CUE` prints when `requiresSignOff` and is ABSENT when not (demo-data-only framing, R-610) | P1 |
| `src/server/quote-pdf/render.ts` | R-607 belt through the RENDER: a hostile internal value in the VM's typed holes never reaches the extracted PDF text | P1 |
| `src/server/quote-pdf/render.ts` | Branch coverage: empty lines / empty attachments / no warnings / no deduction / null company identity → renders (no throw) with the right fallback text | P2 |
| `src/server/quote-pdf/render.ts` | `svDate` fallback: null / unparseable ISO → the `—` dash, valid ISO → stable sv-SE format (locale-independent) | P2 |
| `src/server/commands/quotes/validation.ts` | `validateGenerateQuotePdf` — the ONE 6.3 validator with no dedicated unit test (its 6.1/6.2 siblings both have one); id-only shape, uppercase-uuid, smuggled-key strip, VALIDATION_FAILED negatives | P1 |
| `src/lib/quote-pdf/view-model.ts` | `buildQuotePdfViewModel` edge/ordering: sortOrder stability, null-öre→null kronor, bp→percent (`2550`→"25.5", `2500`→"25"), empty collections, deduction-type absent | P2 |

## Choose Test Levels & Priorities

- **Unit (`node --test`)** for all of the above — every target is pure or I/O-free (the
  renderer reads no clock and does no I/O; the injected `renderedAt` makes it a pure function
  of its input). No duplicate coverage: content-vs-mutable-source (INT-01), storage privacy
  (INT-02), and UI states (E2E) stay at their DB/browser tiers.
- Priorities per `test-priorities-matrix.md`: determinism / non-final framing / R-607 belt =
  P1 (high risk, they back the canonical Epic-6 correctness properties at a cheap tier);
  branch/edge/formatting = P2.

## Coverage Plan Scope

**Selective** — targeted at the pure/I/O-free 6.3 surface that the fast gate under-covers,
avoiding any overlap with the passing DB-backed INT/E2E proofs. Three new/extended files:

1. `tests/unit/server/quote-pdf/render.test.ts` (NEW) — renderer determinism + injected-timestamp
   + non-final cue + R-607-through-render + branch/`svDate` coverage.
2. `tests/unit/server/commands/generate-quote-pdf-validation.test.ts` (NEW) — the missing
   `validateGenerateQuotePdf` validator belt.
3. `tests/unit/lib/quote-pdf/view-model.test.ts` (EXTEND) — ordering/null/formatting/empty-collection
   edge cases on the pure view-model builder.

## Generate — Result

Two NEW pure `node --test` files + one EXTENDED (no duplicate parallel files; no production
code touched; no new dependency):

- `tests/unit/server/quote-pdf/render.test.ts` (NEW, +11 cases) — `renderQuotePdf`
  byte-determinism (same VM+instant → identical bytes), injected-timestamp discipline (fixed
  instant byte-identical regardless of wall clock), the `NON_FINAL_CUE` present/absent by
  `requiresSignOff` (R-610), the R-607 leakage belt THROUGH the render (smuggled internal value
  never reaches the extracted text), plus empty-collection / no-deduction / null-identity /
  `svDate` fallback / optional-line branch coverage. Reuses the shared `extractPdfText`
  (`pdfjs-dist`) helper.
- `tests/unit/server/commands/generate-quote-pdf-validation.test.ts` (NEW, +5 cases) — the
  previously-untested `validateGenerateQuotePdf` belt: id-only accept, case-insensitive uuid,
  smuggled-key strip (server resolves the snapshot — never client data, R-606), and the
  VALIDATION_FAILED negatives (non-record, missing/non-uuid/non-hex id).
- `tests/unit/lib/quote-pdf/view-model.test.ts` (EXTEND, +5 cases) — sortOrder ordering,
  null-öre→null kronor, bp→percent formatting (`2500`→"25", `2550`→"25.5"), empty collections,
  absent deduction type.

**+21 new test declarations.** The 6.3 quote-pdf unit subset went 8 → 24; the whole fast gate
grew 952 → 972 executed tests.

## Verification

- 6.3 quote-pdf unit subset (the three files): **24 pass / 0 fail** (was 8).
- Full unit suite (`pnpm run test:unit`): **972 pass / 0 fail** (was 952).
- `pnpm typecheck`: clean.
- `pnpm lint`: 0 errors (1 pre-existing warning in `tests/unit/lib/money/vat.test.ts`,
  `ORE_AMOUNT_MAX` unused — unrelated to this story, carried from prior automation passes).

All new tests are pure `node --test` (fast gate on every PR). No new dependency, no framework
change, no production code touched. Determinism, non-final framing, and the R-607 leakage
property — previously proven only DB-backed (INT) or via the 2-case golden — now also carry a
cheap fast-gate belt. The DB-backed INT (source-of-truth, storage-privacy, retry) and E2E
(states) proofs remain the authority for their tiers; no overlap introduced.

## Validation (step 4) & Next

- **Framework readiness:** verified (`node --test` fast gate, Vitest, Playwright all present).
- **Coverage mapping:** each new belt maps to a story test id / risk (6.3-INT-03 determinism,
  6.3-GOLDEN-01 render text, 6.3-UNIT-01 view-model, R-606/R-607/R-610/R-611/R-612).
- **Test quality/structure:** pure, deterministic, injected-instant (no clock/DB/PII), explicit
  allow-list assertions, mirrors the sibling validator + 6.2 leakage-belt precedents.
- **Fixtures/factories/helpers:** reuse the shared `extractPdfText` helper; a local
  `baseViewModel(...)` factory in the render test (no new global fixture needed).
- **CLI sessions:** none opened (no browser exploration — pure-unit expansion). No orphaned
  processes. Temp/output artifacts live under `_bmad-output/test-artifacts/`.
- **Assumptions/risks:** the byte-determinism assertion depends on the pinned `pdf-lib@1.17.1`
  + `useObjectStreams:false` + injected InfoDict dates — the same posture the story's INT-03
  relies on; a renderer bump would re-baseline both (already gated: exact-pinned + CI verify).
- **Next recommended workflow:** `trace` (refresh the 6.3 traceability matrix to record the new
  fast-gate belts) or `test-review` (quality pass). Neither is blocking — the story remains
  `review` and green across all tiers.

