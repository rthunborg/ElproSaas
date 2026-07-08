---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-07'
inputDocuments:
  - _bmad-output/implementation-artifacts/9-3-golden-master-comparison-harness-for-core-workflow.md
  - _bmad-output/test-artifacts/test-design-epic-9.md
  - src/features/calculations/readiness.ts
  - src/features/calculations/totals.ts
  - src/features/calculations/vat-posture.ts
  - src/lib/quote-pdf/view-model.ts
  - src/server/quote-pdf/render.ts
  - tests/fixtures/golden/lovable/*.json
  - tests/fixtures/golden/money/accepted-price-deltas.json
  - tests/fixtures/golden/snapshots/quote-version-source.json
  - tests/unit/features/calculations/calc-golden-pack.test.ts
  - tests/unit/lib/quote-pdf/pdf-text-golden.test.ts
  - tests/unit/features/quotes/accept-quote-to-job-golden.test.ts
  - tests/unit/fixtures/golden/lovable/lovable-pack-support.ts
  - tests/unit/lib/money/golden-pack.test.ts
---

# ATDD Checklist: Story 9.3 — Golden-Master Comparison Harness For Core Workflow

Master Test Architect · TDD RED phase · Runner: `node --test` (`pnpm run test:unit`, glob `tests/unit/**`).

## Preflight & Context (Step 1)

- Stack: **fullstack** (Next.js + Supabase). This story is a **backend / domain-logic** slice —
  pure unit-tier golden-master comparison over anonymized fixtures. **No API/HTTP surface, no
  browser E2E.**
- Prerequisites satisfied: story has clear ACs; both runners exist (`test:unit` = `node --test`
  over `tests/unit/**`; `test:int` = Vitest over `tests/integration/**`).
- Generation mode (Step 2): **AI generation** (backend → always AI-generated; no recording).
- Red-phase posture (project-binding override): this project **BANS** `describe.skip` /
  self-disabling `SURFACE_PRESENT` gates and stale RED-PHASE banners (R-904, the ledgered
  `TAX/VAT_SURFACE_PRESENT` weakness). Scaffolds are therefore authored to **RUN**, with **HARD**
  surface assertions and honest failing assertions — NOT `test.skip()`. The generic ATDD
  `test.skip()` rule is superseded by this project rule (and by the story's explicit no-vacuous-green
  gate).

## TDD Red Phase (Current)

Failing acceptance scaffolds generated and verified RED by running them.

- **17 tests across 4 comparison suites: 9 pass / 8 fail (RED).**
  - The 9 **passing** are the invariants that need no dev glue — they prove the harness assertions
    are real and exercised (not vacuous): the INCLUSION frozen pin (hidden row COUNTS / unselected
    option does NOT), the accepted-price delta arithmetic + reason-gate, the immutable job
    source-ref tuple, the PDF non-empty `mustNotAppear` discipline, the widened-labelling
    both-arms guard, the seeded malformed-delta guard firing, and the hard surface-present probe.
  - The 8 **failing** are the genuine green-phase deliverables (below).
- Existing baseline unperturbed: the snapshot-consumer suites (`tests/unit/lib/quote-snapshot/**`)
  stay **11/11 green** (the mis-pinned fixture is intentionally left for the dev to align — Task 1.3);
  `tsc --noEmit` is clean.

### Generated files (test assets under `tests/unit/**`)

- `tests/unit/fixtures/golden/lovable/comparison-support.ts` — shared support extending the 9.2
  pack-support: the real `ReadinessCode` type import, the nine AC1 **comparison** categories
  (distinct from the eight fixture categories), the widened `number | classification-code`
  divergent-value helper, loaders, and the (RED) `realReadinessCodeSet()` seam the dev wires to a
  runtime union export.
- `tests/unit/fixtures/golden/lovable/lovable-comparison-guards.test.ts` — GUARD 0 (hard
  surface-present), GUARD 1 (representativeness validator + snapshot-alignment gate), GUARD 2
  (coverage manifest, structured, count derived — not a magic constant), GUARD 3 (widened LABELLING
  guard + fires-on-malformed proof).
- `tests/unit/fixtures/golden/lovable/lovable-comparison-calc-quote-pdf.test.ts` — 9.3-CMP-01/02:
  calc-totals / vat-tax-blocks / options-tillval / hidden-rows / quote-visible-lines /
  pdf-text-visual / attachment-selection.
- `tests/unit/fixtures/golden/lovable/lovable-comparison-acceptance-job.test.ts` — 9.3-CMP-03:
  acceptance transition + accepted price + job source refs.
- `tests/unit/fixtures/golden/lovable/lovable-comparison-delta-classification.test.ts` —
  9.3-DELTA-01: three-way origin + `deltaKind` (expected-simplification | bug |
  unresolved-assumption) + the STOP gate against silently labelling a sensitive divergence
  "expected simplification".

## Test Strategy — Acceptance Criteria Coverage (Step 3)

| AC | Coverage | Level / Priority | Suite |
| --- | --- | --- | --- |
| AC1 — compare the nine categories, driving the REAL new-side oracle; reference per-category goldens as single authority | calc-totals / vat-tax-blocks / options-tillval / hidden-rows / quote-visible-lines / pdf-text-visual / attachment-selection / acceptance-transition-and-accepted-price / job-source-refs | Unit / P0 | `lovable-comparison-calc-quote-pdf`, `lovable-comparison-acceptance-job`, coverage manifest in `lovable-comparison-guards` |
| AC2 — classify each delta (expected-simplification / bug / unresolved-assumption) + non-empty note; documented-delta/old-lovable carries divergent old value (number OR classification-code) | three-way origin + `deltaKind` + widened LABELLING guard (R-913) + STOP gate | Unit / P0 | `lovable-comparison-delta-classification`, GUARD 3 in `lovable-comparison-guards` |
| AC3 — two-tenant RLS/storage negatives **where applicable** | SATISFIED-BY-NON-APPLICABILITY: 9.3 is pure-unit comparison over anonymized static fixtures — no DB-backed comparison case touches a tenant-owned table or storage object (Task 4.1). No hollow integration case fabricated. Re-evaluate ONLY if a DB-backed comparison case is authored. | Integration / P1 (N/A) | — (record the non-applicability note; no `tests/integration/**` case) |
| Representativeness gate (R-903 / 9.3-VALID-01, epic blocker) | validator against the real union + snapshot-fixture alignment gate | Unit / P0 | GUARD 1 in `lovable-comparison-guards` |
| No-vacuous-green gate (R-904, epic blocker) | pins under `tests/unit/**`; HARD surface assertion; structured coverage manifest fails on any zero-executed category; no describe.skip/RED-PHASE banner | Unit / P0 | GUARD 0 + GUARD 2 in `lovable-comparison-guards` |

## Next Steps (TDD Green Phase — for the dev)

The 8 RED failures map 1:1 to the story's tasks. Resolve each by implementing the real live-drive
(never by relaxing an assertion):

1. **GUARD 1a — wire the real ReadinessCode union as a RUNTIME set (Task 1.2).**
   `src/features/calculations/readiness.ts` currently exports `ReadinessCode` as a **type only** (no
   runtime value). Add a runtime union export (e.g. `export const READINESS_CODES = [...] as const`
   covering the 13 members) and return it from `realReadinessCodeSet()` in `comparison-support.ts`.
   Do NOT hardcode a copy in the test. (Confirm the money/calc/snapshot suites stay green.)
2. **GUARD 1b — validate every fixture code against the union.** Falls out of (1); the structured
   `readinessWarnings`/`warnings` walk is scaffolded — replace the token-sweep fallback with the
   structured extraction if you prefer, but keep it structured (not `raw.includes`, R-921).
3. **GUARD 1c — align the mis-pinned snapshot fixture (Task 1.3).** Edit
   `tests/fixtures/golden/snapshots/quote-version-source.json`: line ~48 `["REQUIRES_SIGN_OFF"]` →
   `["TAX_SIGN_OFF_REQUIRED"]`; line ~94 `["REQUIRES_SIGN_OFF", "DEDUCTION_ESTIMATE_UNAPPROVED"]` →
   `["TAX_SIGN_OFF_REQUIRED"]` (dedupe — both fictional codes map to the one real
   sign-off-required condition). Then confirm `tests/unit/lib/quote-snapshot/{golden-pack,golden-v1-v2}.test.ts`
   stay green (they copy warning codes by value — aligning the value keeps them green while making it REAL).
4. **GUARD 2 — coverage manifest (Task 1.4).** Have each Task-2 comparison suite REGISTER its
   category into the manifest's `EXECUTED_COMPARISON_CATEGORIES` set ONLY when a live oracle case for
   it actually runs (best: export the executed set from the comparison suites and import it into the
   manifest, so a category cannot be declared covered without a live case). Keep the count DERIVED
   from the manifest array (no magic constant).
5. **9.3-CMP-01 vat-tax-blocks (Task 2.1).** In `lovable-comparison-calc-quote-pdf.test.ts`: build a
   `ReadinessInput` from `calculations.json` rows + a synthetic customer, drive `classifyReadiness`,
   assert emitted warning codes match the fixture's `readinessWarnings`. Route every öre op through
   `totals.ts`/`@/lib/money` — NO inline math. Register `vat-tax-blocks`. (The calc-totals /
   hidden-rows / options-tillval INCLUSION checks already pass — just register them + reference the
   `options-tillval.json` pin as the single numeric authority; a divergence is a STOP, never a re-pin.)
6. **9.3-CMP-02 quote-visible-lines + pdf-text-visual + attachment-selection (Task 2.2).** Drive the
   real quote view-model over `quotes.json`; and `buildQuotePdfViewModel → renderQuotePdf({renderedAt:
   FIXED_ISO}) → extractPdfText` over `pdfs.json`, asserting EVERY `mustAppear` present AND EVERY
   `mustNotAppear` absent (hidden-row + unselected-option labels do NOT leak). PDF pixel/visual is
   stability-only and NEVER gates. Register `quote-visible-lines`, `pdf-text-visual`, `attachment-selection`.
7. **9.3-CMP-03 (Task 2.3).** In `lovable-comparison-acceptance-job.test.ts`: cross-check the
   accepted-price delta against `accepted-price-deltas.json#transactionCases` (single authority; a
   divergence is a STOP), and drive the real accept-quote-to-job oracle for the source-ref tuple.
   Register `acceptance-transition-and-accepted-price` + `job-source-refs`. (The plain-öre delta +
   reason-gate + tuple checks already pass.)
8. **9.3-DELTA-01 deltaKind (Task 3.1/3.2).** Add a per-delta `deltaKind` +
   non-empty explanation to the harness delta model and assert it on every documented divergence.
   The STOP gate (`ownerApprovedSimplification`) forbids labelling a sensitive divergence
   "expected-simplification" without explicit owner approval — satisfy it or escalate (needs-human).
   The widened `number | classification-code` LABELLING guard (GUARD 3) is the epic-9 retro
   constraint that supersedes the money-pack numeric-only guard (`golden-pack.test.ts:217-232`) — make
   the harness enforce the widened union, do not drop the numeric arm.

### Stop conditions the dev/reviewer must honor

STOP (needs-human) if: a new-side total DIVERGES from a frozen money golden pin (report, never
re-pin); a `bug`/`unresolved-assumption` classification touches money/tax/quote-immutability/
acceptance/quote-numbering/accepted-quote-to-job; a real Lovable data export or real-capture SELECTION
is requested (owner-gated, Sign-Off 8.1/8.2); or a new dependency/migration/product-schema change
appears necessary (this story is comparison tests + one fixture alignment). Do NOT fabricate a real
old-Lovable number (the `old-lovable` placeholder stays `capturedFromRealLovable:false`).

## Scope guardrails (verify at PR)

- NO tenant-owned table added (`TENANT_TABLES` count stays 24); NO migration; NO nav change (7
  items); NO new dependency (reuse `pdfjs-dist` test-only + `@/lib/money`); NO `.env` edit; NO Lovable
  code copied (compare BEHAVIOR only). The ONE existing fixture mutated is
  `snapshots/quote-version-source.json` (Task 1.3). All comparison assets live under
  `tests/unit/**` + `tests/fixtures/golden/lovable/**`.
- Gate posture: typecheck / lint / unit / build APPLY. int/RLS/storage are **SKIPPED-WITH-REASON**
  (no DB-backed comparison case — pure unit-tier over anonymized fixtures; AC3 satisfied by
  non-applicability).

## Validation (Step 5)

- Red-phase compliance: all assertions pin EXPECTED behavior (no `expect(true).toBe(true)`
  placeholders); suites RUN (no self-disabling skip / stale banner — the project-banned anti-pattern);
  8 honest RED failures + 9 passing invariant checks; imports resolve against the real oracle; `tsc`
  clean; existing baseline unperturbed.
