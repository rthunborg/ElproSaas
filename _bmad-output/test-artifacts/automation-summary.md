---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-08'
workflowType: testarch-automate
story: 9.3 Golden-Master Comparison Harness For Core Workflow
detectedStack: backend
executionMode: sequential (pure-unit documented-delta live-drive coverage expansion)
inputDocuments:
  - _bmad-output/implementation-artifacts/9-3-golden-master-comparison-harness-for-core-workflow.md
  - _bmad-output/test-artifacts/test-design/test-design-epic-9.md
  - src/features/calculations/readiness.ts
  - src/features/calculations/totals.ts
  - src/features/calculations/vat-posture.ts
  - tests/unit/fixtures/golden/lovable/comparison-support.ts
  - tests/fixtures/golden/lovable/calculations.json
  - tests/fixtures/golden/lovable/quotes.json
  - tests/fixtures/golden/lovable/acceptance.json
  - tests/fixtures/golden/lovable/accepted-quote-to-job.json
---

# Test Automation Expansion — Story 9.3 (Golden-Master Comparison Harness)

## Step 1 — Preflight & Context

- **Stack**: backend / node (`node --test` unit runner via `pnpm run test:unit`, glob `tests/unit/**`;
  Vitest int tier `tests/integration/**`). Framework present — no scaffolding needed.
- **Mode**: BMad-Integrated (story + epic-9 test-design present).
- **Existing 9.3 coverage** (green, 1319/1319 before this run): four comparison suites +
  `comparison-support.ts` live-drive core covering the nine AC1 categories, the representativeness
  validator (runtime `ReadinessCode` union), the structured coverage manifest, the widened
  `number | classification-code` LABELLING guard, and the per-delta `deltaKind` STOP gate.

## Step 2 — Identify Targets (coverage gap)

The base suites REGISTER every AC1 category and enforce the guards, but for the DOCUMENTED-DELTA
cases they only asserted the fixture *carries* a divergent old value (the R-913 LABELLING guard) —
they never DROVE the REAL new-side oracle to PROVE the new value genuinely diverges from the recorded
old value. That old-vs-new live confirmation IS the golden-master signal; without it a `documented-delta`
is a claim, not evidence. Targets (all pure-unit, driving the existing 9.2 fixtures through the real
oracle deeper — no new fixtures, no scope change, no DB):

| Target | Level | Priority | Category |
| --- | --- | --- | --- |
| `vat-posture-classification-delta` — drive real `resolveVatDisplayPosture` (private→`private`, diverges from old `company_excl`) | unit | P0 | 9.3-CMP-01 / R-913 classification arm |
| `quote-total-rounding-documented-delta` — drive real `computeSectionTotal` (per-line sum-of-rounded 16666, diverges from old round-of-sum 16667) | unit | P0 | 9.3-CMP-02 / R-912 numeric arm |
| `job-initial-status-classification-delta` — new status `created` diverges from old `open` | unit | P1 | 9.3-CMP-03 / R-913 classification arm |
| `resolveTotalDisplay` — private incl-VAT display path (re-exported but never asserted in base suites) | unit | P1 | 9.3-CMP-01 |

Scope: `selective` (targeted expansion of the documented-delta live-drive, the highest-value gap).

## Step 3 — Generate Tests

New file: `tests/unit/fixtures/golden/lovable/lovable-comparison-classification-deltas.test.ts`
(4 tests, 3 suites — all pass). Drives the REAL oracle over the existing anonymized 9.2 fixtures
(consumed, never mutated); routes every öre op through `computeSectionTotal` (no inline math); asserts
the engine REPRODUCES each fixture's pinned NEW value while DIVERGING from the recorded OLD value.

Note on the numeric-delta case: the fixture's representative LINES carry `quantity: 3` (a captured
SHAPE), so its totals block is NOT a re-pin of those lines. The documented rounding DELTA is the
note's net-33333-per-line scenario; the test drives the real engine at that exact scenario (per-line
sum-of-rounded = 16666) and proves the old round-of-sum = `round(66666*0.25) = 16667`, so the 1-öre
delta direction is derived, not asserted.

### Gate results

- New suite: 4/4 pass.
- Lovable-pack set: 64/64 pass (was 60; +4).
- Full unit gate `pnpm run test:unit`: **1323/1323 pass**, 0 fail, 0 skipped, 0 todo (was 1319; +4).
- `tsc --noEmit`: clean. `eslint` on the new file: clean.
- int/RLS/storage tiers: NOT-APPLICABLE (pure-unit over anonymized static fixtures; no DB-backed
  case, no tenant-owned table or storage object touched) — SKIPPED-WITH-REASON, consistent with the
  story's AC3 SATISFIED-BY-NON-APPLICABILITY posture.

### Scope discipline

No product `src/**` change, no fixture mutated, no new dependency, no migration, no tenant table, no
nav change, no `.env` edit, no `describe.skip`, no out-of-glob (`tests/golden/**`) pin. The one new
asset lives under the approved `tests/unit/**` location.
