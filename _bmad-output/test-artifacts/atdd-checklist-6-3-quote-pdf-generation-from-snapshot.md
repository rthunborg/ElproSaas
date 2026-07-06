---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-06'
inputDocuments:
  - '_bmad-output/implementation-artifacts/6-3-quote-pdf-generation-from-snapshot.md'
  - '_bmad-output/test-artifacts/test-design-epic-6.md'
  - '_bmad/tea/config.yaml'
  - 'tests/unit/features/quotes/view-model.test.ts'
  - 'tests/unit/lib/quote-snapshot/golden-pack.test.ts'
  - 'tests/integration/commands/quote-version.int.test.ts'
  - 'tests/e2e/quotes/quotes.e2e.spec.ts'
  - 'src/lib/quote-snapshot/types.ts'
  - 'src/features/quotes/read.ts'
  - 'src/features/calculations/readiness.ts'
  - 'tests/factories/tenants.ts'
  - 'tests/e2e/global-setup.ts'
---

# ATDD Checklist: Story 6.3 — Quote PDF Generation From Snapshot

**TDD phase:** RED (failing/skipped acceptance scaffolds authored BEFORE implementation).
**Story:** `_bmad-output/implementation-artifacts/6-3-quote-pdf-generation-from-snapshot.md`
**Stack:** fullstack (Next.js 16 + Supabase). Runners: `node --test` (unit/golden fast gate),
Vitest (integration, local Supabase stack), Playwright (E2E, CI-gated).
**Generation mode:** AI generation (backend-heavy + snapshot/command logic; standard scenarios,
clear AC). No live browser recording — the E2E scaffold reuses the existing 6.2 fixture pattern.

## Red-phase mechanism per runner

BMAD's canonical `test.skip()` red-phase idiom is adapted to each runner so the fast gate stays
GREEN (visible SKIP, never a failing red build) until each Task lands:

- **`node --test`** (unit + golden): `test("...", { skip: "ATDD red phase ..." }, () => {...})`.
  Assertions reference the not-yet-existent `buildQuotePdfViewModel` / renderer via `declare`
  placeholders (deleted when the real module lands). Verified: 8 tests, 8 skipped, 0 fail.
- **Vitest** (integration): whole-suite `describe.skip("... [ATDD red phase ...]")` (the command
  `generateQuotePdf` does not exist yet). Bodies carry the real proof outline + `expect.fail(...)`
  so a stray un-skip fails loud rather than vacuously passing.
- **Playwright** (E2E): `test.describe.skip("... [ATDD red phase ...]")` header (mirrors the 6.2
  E2E's no-lingering-red-header discipline — clear the header when flipping green).

## Acceptance-criteria coverage

| Test ID | Level (runner) | AC | P | Red-phase scaffold file |
| --- | --- | --- | --- | --- |
| 6.3-UNIT-01 | Unit (`node --test`) | AC1 | P0 | `tests/unit/lib/quote-pdf/view-model.test.ts` |
| 6.3-GOLDEN-01 | Golden (`node --test`) | AC1 | P0 | `tests/unit/lib/quote-pdf/pdf-text-golden.test.ts` |
| 6.3-INT-01 | Integration (Vitest) | AC1 | P0 | `tests/integration/commands/generate-quote-pdf-source-of-truth.int.test.ts` |
| 6.3-INT-02 | Integration (Vitest) | AC3 | P0 | `tests/integration/commands/generate-quote-pdf-storage-privacy.int.test.ts` |
| 6.3-INT-03 | Integration (Vitest) | AC1/AC2 | P1 | `tests/integration/commands/generate-quote-pdf-determinism.int.test.ts` |
| 6.3-INT-04 | Integration (Vitest) | AC2/AC3 | P1 | `tests/integration/commands/generate-quote-pdf-retry-consistency.int.test.ts` |
| 6.3-E2E-01 | E2E (Playwright) | AC2 | P1 | `tests/e2e/quotes/quote-pdf-states.e2e.spec.ts` |
| 6.3-E2E-02 | E2E (Playwright) | AC2/AC3 | P2 | `tests/e2e/quotes/quote-pdf-states.e2e.spec.ts` |

- **AC1 (snapshot-only source-of-truth + no internal leakage + verbatim money):** 6.3-UNIT-01
  (pure, leakage-by-construction), 6.3-GOLDEN-01 (text-extraction), 6.3-INT-01 (the canonical
  behavioral negative — mutate mutable sources → PDF text unchanged), 6.3-INT-03 (determinism).
- **AC2 (six render states visible/accessible + retry/preview):** 6.3-E2E-01/02, 6.3-INT-03/04.
- **AC3 (private storage via 8.1 foundation + cross-tenant/anon rejection + consistency):**
  6.3-INT-02 (storage privacy + negatives), 6.3-INT-04 (retry/consistency).

**Deliberately NOT authored here** (belongs to `dev-story`, not ATDD red-phase scaffolds):
6.3-GOLDEN-02 (visual snapshot, P1 stability-only — never a gate); 6.x-UNIT-01 as a *new* CI
scan wiring (the golden scaffold already carries the pack-wide PII/öre-digit scan inline,
mirroring the 6.1 pack); 6.3-DOCS-01 (renderer-choice record — a dev-story doc obligation).

## Fixtures / infrastructure the GREEN phase must add (referenced, not yet created)

- A `tests/support/pdf-text.ts` wrapper around the pinned text-extraction devDependency
  (e.g. `pdf-parse`/`pdfjs-dist`) — kept test-only, out of the client bundle.
- A `tests/fixtures/golden/quote-pdf/quote-pdf-source.json` origin-labelled fixture pack
  (`origin: "new-expected"` only — no Lovable oracle exists; anonymized shape-only; öre < 10
  digits; REAL `ReadinessCode` codes).
- Factory extensions (additive): `adminInsertQuoteVersion` gains `pdf_status`/`pdf_file_id`/
  `pdf_generated_at`; a stub-PDF-file/object seed helper; a stored-PDF-bytes readback helper;
  `global-setup.ts` seeds a `generated` + a `failed` version state for the E2E.

## Next steps (TDD green phase — for `dev-story`)

1. Implement the pure `buildQuotePdfViewModel` (`src/lib/quote-pdf/**`) → un-skip 6.3-UNIT-01;
   delete the `declare` placeholder; import the real symbols.
2. Select + EXACT-pin the Node PDF renderer (gated dependency add — avoid a headless-browser
   binary; STOP → needs-human if a major binary is required) + the text-extractor devDependency;
   record the choice (6.3-DOCS-01) → un-skip 6.3-GOLDEN-01 + 6.3-INT-03.
3. Implement `generateQuotePdf` (command + storage pipeline via the 8.1 foundation) → un-skip
   6.3-INT-01/02/04.
4. Build the six-state PDF panel + generate/retry/preview/download actions → seed the E2E
   fixture states → un-skip + de-header the E2E suite.
5. Run the full CI gate in order; verify every scaffold flips GREEN (or is a documented,
   justified skip). Clear ALL red-phase headers/skip reasons when green.

## Red-phase verification evidence

- `node --experimental-strip-types ... --test "tests/unit/lib/quote-pdf/**/*.test.ts"` →
  `tests 8 / pass 0 / fail 0 / skipped 8` (fast gate stays green).
- `tsc --noEmit` → 0 errors across all seven new scaffold files (type-clean red phase).
- The Vitest + Playwright scaffolds are whole-suite `.skip`'d so they collect without executing
  the not-yet-existent command/UI (the E2E loads the gitignored `fixture.json` at module scope,
  identical to the 6.2 spec — collected in CI where global-setup seeds it).
