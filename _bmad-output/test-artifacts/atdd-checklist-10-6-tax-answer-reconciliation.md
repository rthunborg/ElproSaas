---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-05'
workflowType: 'testarch-atdd'
storyId: '10.6'
storyKey: '10-6-tax-answer-reconciliation'
storyFile: '_bmad-output/implementation-artifacts/10-6-tax-answer-reconciliation.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-10-6-tax-answer-reconciliation.md'
generatedTestFiles:
  - 'tests/unit/lib/money/tax-answer-reconciliation.atdd.test.ts'
  - 'tests/unit/lib/money/tax-answer-reconciliation.golden.atdd.test.ts'
  - 'tests/integration/commands/tax-answer-reconciliation.int.test.ts'
  - 'tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/10-6-tax-answer-reconciliation.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/test-artifacts/test-design-epic-10.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - '_bmad-output/auto-bmad/retro-notes/epic-10.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

# ATDD Checklist - Epic 10, Story 10.6: Tax Answer Reconciliation

**Date:** 2026-08-05  
**Author:** Rasmus  
**Primary Test Level:** Unit and golden-master, with integration and E2E boundary proofs

---

## Step 1 - Preflight and Context

- **Mode:** Create.
- **Stack:** Full stack Next.js/React + Supabase; Node test runner for pure units and goldens,
  Vitest for database-backed integration/RLS, Playwright for user-boundary coverage.
- **Story state:** `ready-for-dev`; AC1-AC5 and the binding `10.6-*` test contract are testable.
- **Scope posture:** correctness reconciliation inside already-active calculations, quotes, CRM,
  settings, snapshots, and PDF surfaces. No new module, dependency, table, or public surface.
- **Immutability floor:** sent and accepted quote versions stay frozen. Any recomputation/backfill or
  weakened lock is a stop condition.
- **Red-phase posture:** Story 10.6 explicitly forbids self-skipping `TAX_SURFACE_PRESENT` /
  `VAT_SURFACE_PRESENT` gates and hollow assertions. Acceptance scaffolds must fail honestly before
  implementation while remaining type-correct and deterministic.
- **Test-data posture:** pure anonymized integer-öre fixtures; no PII, clock reads, network, or
  nondeterministic generated values. Database fixtures, when needed, must use per-test unique IDs and
  existing tenant factories.
- **Framework utilities:** the project already supplies the required runners, alias hook, two-tenant
  factories, Playwright configuration, and existing quote/PDF fixtures. No framework initialization is
  required.
- **Pact:** disabled and not relevant; the story adds no external service contract.

### Acceptance surface captured

1. Document-level VAT aggregation by exact `(VatType, rateBp)` category with split invariance.
2. Independent visibility and invoice-inclusion flags plus the exact closed deduction classification.
3. Explicit construction reverse charge, readiness gating, exact Swedish PDF wording, and mixed-category
   reconciliation.
4. Whole-SEK claim truncation, deterministic per-person allocation and caps, and fail-loud versioned
   policy lookup using the correct event date.
5. Actual-cost default, explicit fixed-price 97% mode, category-specific green rates, and disjoint
   ROT/green bases with no double counting.

### Existing seams that the red tests will exercise

- `@/lib/money` currently exposes line-rounded VAT and the legacy count-only deduction estimate.
- `src/features/calculations/totals.ts` currently couples inclusion to optional/selected posture and lacks
  Story 10.6's independent `included_in_invoice_total` and classification domain.
- Quote snapshots and PDF view models already have immutable/versioned boundaries to extend rather than
  replace.
- The old Story 4.2/4.3 unit and golden files retain surface-present `describe.skip` gates; Story 10.6
  owns converting those preconditions into hard assertions.

---

_Checkpoint saved after ATDD Step 1. Strategy, generated files, execution evidence, and implementation
handoff will be added by the remaining workflow steps._

## Step 2 - Generation Mode

- **Selected mode:** AI generation.
- **Reason:** AC1-AC5 and the settled design decisions define deterministic domain inputs, outputs,
  error cases, and lifecycle boundaries. The high-value coverage is primarily pure money/tax and
  snapshot/PDF contract testing.
- **Recording decision:** skipped. The new Story 10.6 controls and selectors are not implemented, so
  recording the current UI could only capture the obsolete surface. Playwright scenarios will instead
  use existing role/text-first project patterns plus explicit `data-testid` requirements documented in
  this checklist.

## Step 3 - Test Strategy

The story's binding ID families are retained exactly. Coverage is assigned to the lowest trustworthy
level and is not duplicated upward: the browser tests prove user wiring, the integration tests prove
persistence/locks/source-of-truth, and the pure suite owns arithmetic and policy edge matrices.

| Test ID | AC | Scenario and negative/edge proof | Level | Priority | Pre-implementation RED reason |
| --- | --- | --- | --- | --- | --- |
| `10.6-UNIT-01` | AC1 | Aggregate VAT by exact `(VatType, rateBp)` and prove split/merge invariance for net, VAT, gross, deduction, and payable; retain existing line-net semantics | Unit (`node --test`) | P0 | Category/document aggregator is absent; legacy per-line VAT diverges on fractional-öre splits |
| `10.6-UNIT-02` | AC2 | Exhaust the closed deduction classifications and prove `is_hidden`, `included_in_invoice_total`, and classification are pairwise independent; excluded rows feed no customer total/basis | Unit | P0 | Current totals couple inclusion to optional-selection and have no classification field/domain |
| `10.6-UNIT-03` | AC3 | Treat construction reverse charge as an explicit VAT type; rate zero and company/org-number context never infer it; buyer VAT controls readiness | Unit | P0 | Current VAT model is rate-only and readiness has no reverse-charge context |
| `10.6-UNIT-04` | AC4 | Truncate `.99` claims downward to whole SEK; allocate whole-SEK claims exactly and deterministically across ordered person slots; apply ROT, ROT/RUT-combined, and green caps independently | Unit | P0 | Current engine rounds to öre and accepts only a count of persons with a flat cap |
| `10.6-UNIT-05` | AC4 | Resolve immutable policies at inclusive validity boundaries; reject gaps, overlaps, invalid dates and no-match; select ROT payment date vs green final-payment date; include allocated VAT in ROT labour basis | Unit | P0 | No versioned registry/date authority exists |
| `10.6-UNIT-06` | AC5 | Default to actual eligible costs; allow 97% only for explicit genuine fixed price; reject invalid use; apply 15/50/50 category rates and allow disjoint ROT+green without double feed | Unit | P0 | Legacy engine globally blocks ROT+green and has one generic green profile |
| `10.6-GOLDEN-01` | AC1/AC4/AC5 | Re-derived money truth for category VAT, claim truncation, caps, and green rates; structured manifest proves every named case is live-driven | Golden (`node --test`) | P0 | Existing VAT/tax fixtures pin superseded line rounding, flat caps, and generic green rates |
| `10.6-GOLDEN-02` | AC2 | Re-derived calculation-row truth for all classifications and the visibility/inclusion cross-product; matched-key manifest prevents substring/count-only coverage | Golden | P0 | Existing calc goldens have no independent invoice-inclusion/classification authority |
| `10.6-GOLDEN-03` | AC1-AC5 | Quote snapshot v1 legacy/null compatibility versus ratified v2; fresh snapshots use the shared builder and frozen historical bytes never change | Golden | P0 | Ratified v2 tax/VAT snapshot schema and shared fresh builder are absent |
| `10.6-GOLDEN-04` | AC1/AC3 | PDF text/totals truth for standard, reverse-charge, and mixed categories; exact `Omvänd betalningsskyldighet`, buyer VAT, no charged-VAT implication | Golden | P0 | PDF view model cannot represent explicit reverse-charge categories/buyer VAT |
| `10.6-INT-01` | AC2/AC3 | Additive migration shape/defaults/checks and RPC read/write parity for invoice inclusion, classification, VAT type, buyer VAT, and snapshot version | Integration (Vitest + local Supabase) | P0 | Migration and RPC fields are absent |
| `10.6-INT-02` | AC2/AC5 | Command persistence and validation for independent row properties, exact closed classification, fixed-price posture, and disjoint bases | Integration | P0 | Command schemas/persistence are absent |
| `10.6-INT-03` | AC1-AC5 | Sent/accepted locks reject every new field mutation and preserve stored snapshot/PDF source bytes | Integration | P0 | Locks cannot yet cover fields that do not exist |
| `10.6-INT-04` | AC1-AC5 | Historical v1 rows remain byte-stable while new drafts persist ratified v2 snapshots through `buildFreshQuoteSnapshot()` | Integration | P0 | Snapshot-version distinction/shared builder are absent |
| `10.6-INT-05` | AC1/AC3/AC4 | PDF generation and acceptance read the stored version/snapshot, not current settings or recomputation; reverse-charge text and payable totals reconcile | Integration | P0 | New frozen source fields and PDF projection are absent |
| `10.6-E2E-01` | AC3 | User explicitly selects reverse charge; missing buyer VAT blocks readiness; completed input produces a PDF with exact wording and reconciled mixed totals | E2E (Playwright) | P1 | Choice, readiness field, and document projection are absent |
| `10.6-E2E-02` | AC2/AC5 | User independently toggles visibility/invoice inclusion and selects classification; customer summary and deduction preview react without property coupling | E2E | P1 | Independent controls and resulting projections are absent |

### Red-phase and quality gates

- No `describe.skip`, `test.skip`, `test.todo`, expected-failure wrapper, or surface-presence
  conditional may make missing Story 10.6 behavior appear green.
- New pure tests must load and typecheck, then fail on a specific absent/incorrect domain behavior.
- Every split-invariance, lock, isolation, and source-of-truth title must assert the seeded values/bytes
  that prove the claim; existence-only and shape-only assertions are insufficient.
- Numeric golden data stays below `1_000_000_000` öre, uses LF, contains no PII/secrets, and carries a
  structured case key plus provenance.
- Fixed clocks/dates and canonical ordering make repeated runs byte-identical.

## Step 4 - Generated Acceptance Scaffolds

**Execution mode:** agent-team (auto-selected; capability probe enabled)  
**Generation workers:** backend/unit-golden-integration contract + E2E journey contract  
**Story-specific override:** the generic ATDD template's skipped-scaffold mechanism was not used.
Story Task 8 explicitly requires hard, active assertions and forbids false-green surface gates.

### Generated tests

| File | IDs | Current active RED reason |
| --- | --- | --- |
| `tests/unit/lib/money/tax-answer-reconciliation.atdd.test.ts` | `10.6-UNIT-01..06` | Canonical category VAT, classification, policy/allocation, classified deduction, and VAT-type exports are missing; the first absent contract fails explicitly |
| `tests/unit/lib/money/tax-answer-reconciliation.golden.atdd.test.ts` | `10.6-GOLDEN-01..04` | Structured fixtures exist, but the current engine/snapshot/PDF authorities cannot produce their ratified v2 truth |
| `tests/integration/commands/tax-answer-reconciliation.int.test.ts` | `10.6-INT-01..05` | The additive migration and coherent command/RPC/lock/snapshot/PDF/acceptance projections are absent |
| `tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts` | `10.6-E2E-01..02` | Dedicated seed branch and explicit reverse-charge/row-property controls are absent |

### Generated golden fixtures

- `tests/fixtures/golden/money/tax-answer-reconciliation-v2.json`
- `tests/fixtures/golden/calculations/tax-answer-reconciliation-v2.json`
- `tests/fixtures/golden/snapshots/tax-answer-reconciliation-v1-v2.json`
- `tests/fixtures/golden/quote-pdf/tax-answer-reconciliation-v1-v2.json`

Each fixture has structured `coverageManifest` keys matched to executable case IDs, fixed dates,
integer öre below the known ten-digit privacy-scan trap, and synthetic PII-free inputs. The money and
calculation suites drive fixture cases through runtime authorities rather than counting tokens.

### Standing-control repair

The four landed Story 4.2/4.3 unit/golden files now hard-assert their required exports and use ordinary
`describe(...)`. Their obsolete `TAX_SURFACE_PRESENT` / `VAT_SURFACE_PRESENT` conditional skips and stale
red-phase banners were removed:

- `tests/unit/lib/money/vat.test.ts`
- `tests/unit/lib/money/vat.golden.test.ts`
- `tests/unit/lib/money/tax.test.ts`
- `tests/unit/lib/money/tax.golden.test.ts`

### E2E fixture and selector contract

Extend the existing `tests/e2e/global-setup.ts` fixture with `taxAnswer.reverseChargeCalc` and
`taxAnswer.independentPropertiesCalc`, using unique synthetic IDs and existing tenant cleanup.

Required stable selectors:

- `tax-document-settings`
- `readiness-summary` with `data-can-create-quote`
- `readiness-blocker-MISSING_BUYER_VAT_NUMBER`
- `create-quote`, `pre-quote-preview`, `confirm-create-quote-version`
- `preview-vat-category-standard`, `preview-vat-category-reverse-charge`
- `preview-net`, `preview-vat`, `preview-gross`
- `quote-pdf-status`, `quote-pdf-download`
- `row-edit-form`, `row-saved`, `totals-summary`, `summary-gross`

The controls also require accessible labels `Momshantering`, `Köparens momsregistreringsnummer`,
`Dold rad`, `Ingår i fakturasumman`, and `Avdragsklassificering`.

### Green-phase implementation order

1. Implement canonical domains, policy registry, whole-SEK claim/allocation, classified bases, and the
   category VAT authority; make `10.6-UNIT-01..06` green one at a time.
2. Extend calculation totals and re-derive the money/calculation goldens.
3. Add the one forward migration and coherent command/RPC/lock projections; replace the integration
   front-door source assertions with/augment them by the checklist's seeded local-Supabase value proofs.
4. Extend the shared fresh snapshot builder, explicit v1 compatibility, PDF view model, and acceptance
   source; make `10.6-GOLDEN-03..04` and `10.6-INT-03..05` green.
5. Add the dedicated E2E seeds and controls, then make the two complete journeys green.

No test may be made green by adding a skip, loosening a lock/value assertion, or updating a golden
without re-deriving it through the canonical authority.

## Step 5 - Validation and Handoff

### Validation evidence

| Check | Result |
| --- | --- |
| Binding-ID inventory | PASS — exactly 17 named tests are present: 6 UNIT, 4 GOLDEN, 5 INT, 2 E2E |
| False-green scan | PASS — 0 matches across 8 generated/touched files for `describe.skip`, `test.skip`, `it.skip`, `test.todo`, `TAX_SURFACE_PRESENT`, `VAT_SURFACE_PRESENT`, or hollow true assertions |
| Golden JSON parse | PASS — all 4 new fixture files parse successfully |
| Relevant ESLint | PASS — 0 errors; one existing `ORE_AMOUNT_MAX` unused warning remains in `vat.test.ts` |
| Targeted active-red Node run | Environment-limited — 0 skipped/todo, but the known managed-sandbox source-visibility fault stopped both new files (and the pre-existing `vat.test.ts` control) at the alias hook before assertions: `ERR_MODULE_NOT_FOUND` for visible `src/**` paths |
| Project typecheck | Environment-limited — `tsc --noEmit` could not see the existing visible `next-env.d.ts` from its child process (`TS6053`); relevant ESLint parsing/type-aware rules found no generated-file errors |
| Playwright list | Environment-limited — the repository-standard generated fixture `tests/e2e/.auth/fixture.json` is absent until global setup/local stack runs; no browser session was opened |

The two runner limitations match the already-reported child-process/source visibility artifact and are
not treated as product RED evidence. Re-run the commands below in the normal story worktree/local stack;
the expected first functional failures are the explicit missing canonical exports, migration, seed branch,
and controls listed in Step 4.

### Commands for DEV

```powershell
# Active pure RED suite
node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/lib/money/tax-answer-reconciliation.atdd.test.ts tests/unit/lib/money/tax-answer-reconciliation.golden.atdd.test.ts

# Database-backed acceptance file (with the local empty-DB stack)
npx vitest run tests/integration/commands/tax-answer-reconciliation.int.test.ts

# Browser journeys after extending global setup
npx playwright test tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts

# Standing controls and repository gates
npm run test:unit
npm run typecheck
npm run lint
```

### Explicit N/A decisions

- **New HTTP/API contract:** N/A; Story 10.6 extends existing server-command/RPC boundaries.
- **External-service mocks/Pact:** N/A; Pact is disabled and no vendor/Skatteverket submission is in scope.
- **New generic factory module:** N/A; the green phase extends existing calculation/quote tenant factories
  and Playwright global setup, preserving their cleanup ownership.
- **Component-test file:** N/A; pure domain behavior is lower-level, while the two critical wiring journeys
  are covered at the browser boundary.

### Red-Green-Refactor handoff

The RED phase is complete at the artifact level: assertions, fixtures, stable selector requirements, and
expected failure reasons are present and cannot self-disable. DEV should take one ID at a time, confirm its
functional failure in the normal worktree, implement the smallest canonical authority/path that makes it
green, and rerun the relevant standing controls. After all 17 IDs pass, refactor only behind the full money,
snapshot, PDF, lock, acceptance, and browser regression set.

The story file was not modified by this delegated pass to avoid overlapping the parent workflow. Manual
handoff paths are the `storyFile`, `atddChecklistPath`, and `generatedTestFiles` values in this document's
frontmatter.

### Knowledge references applied

`data-factories.md`, `component-tdd.md`, `test-quality.md`, `test-healing-patterns.md`,
`selector-resilience.md`, `timing-debugging.md`, `fixtures-composition.md`, `network-first`/network utility
patterns, `test-levels-framework.md`, `test-priorities-matrix.md`, and `ci-burn-in.md`.

**Recommended next workflow:** `bmad-dev-story` for `10-6-tax-answer-reconciliation`; use
`bmad-testarch-automate` only after the product surface exists and the active acceptance IDs are green.
