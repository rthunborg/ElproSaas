---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-quality-evaluation
  - step-03f-aggregate-scores
  - step-04-generate-report
lastStep: step-04-generate-report
lastSaved: '2026-07-08'
review_scope: suite
scope_target: epic-9 (migration-coexistence-golden-masters-and-pilot-readiness)
detected_stack: backend (node:test / node:assert, pure-logic unit runner)
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-9.md
  - _bmad-output/auto-bmad/state/epic/epic-9.yaml
  - resources/knowledge/test-quality.md (TEA core fragment)
  - tests/unit/docs/*.test.ts (epic-9)
  - tests/unit/fixtures/golden/lovable/*.test.ts (epic-9)
  - tests/support/anonymization-scan.ts
---

# Test Quality Review — Epic 9 (suite scope)

**Scope:** all tests added across Epic 9 (migration/coexistence, golden-master comparison
harness, pilot readiness). **Stack:** backend / pure-logic — `node --test` +
`node:assert/strict` via `pnpm test:unit` (glob `tests/unit/**/*.test.ts`). No Playwright/Cypress
in scope, so browser-evidence collection was skipped (per workflow fallback).

## Score Summary

| Dimension | Score | Grade | Weight |
| --- | --- | --- | --- |
| Determinism | 100/100 | A | 30% |
| Isolation | 95/100 | A | 30% |
| Maintainability | 88/100 | B+ | 25% |
| Performance | 98/100 | A | 15% |
| **Overall** | **95/100** | **A** | 100% |

> Coverage is intentionally **out of scope** for `test-review` (route coverage/traceability to
> `trace`). Epic 9's `trace_gate` already ran (`gate_decision: PASS` in epic state).

**Live-run confirmation:** the 14 epic-9 `*.test.ts` files execute **121 tests, 0 fail, 0
skipped, ~2.0s** on the pure-logic runner — corroborating the determinism/performance scores and
proving no suite self-disabled (vacuous-green).

## Files Reviewed (14 test files + 4 support modules)

`tests/unit/docs/`: `migration-runbook-validators.test.ts` (9),
`sign-off-register-validators.test.ts` (19), `acceptance-gate-report-validators.test.ts` (29).
`tests/unit/fixtures/golden/lovable/`: `lovable-loader-roundtrip` (3), `lovable-privacy-scan` (5),
`lovable-scanner-unit` (14), `lovable-shape-guard` (8), `lovable-capture-script` (4),
`lovable-capture-anonymizer-unit` (8), `lovable-comparison-guards` (7),
`lovable-comparison-calc-quote-pdf` (4), `lovable-comparison-acceptance-job` (2),
`lovable-comparison-classification-deltas` (4), `lovable-comparison-delta-classification` (5).
Support: `comparison-support.ts` (749 L), `anonymization-scan.ts` (187 L),
`lovable-pack-support.ts` (144 L), `sign-off-checklist-model.ts` (97 L).

## Critical Findings

**None.** No HIGH-severity violations across any dimension. This is a strong, disciplined suite.

## Dimension Notes

### Determinism — 100 (A)
- Zero `Math.random`, `Date.now`, `new Date()`, `setTimeout`/`setInterval`, or `waitForTimeout`.
- PDF-render comparisons inject a fixed instant (`renderedAt: FIXED_ISO`) so the text golden is
  time-stable.
- Every fact is loaded LIVE from a single source of truth (the real `READINESS_CODES` union,
  `TENANT_TABLES`, `FORBIDDEN_DEFERRED_CATEGORIES`, `navItems`, CI YAML/`package.json` scripts,
  the owner-signoff system-of-record) — no memorized/hardcoded copies that could drift or make a
  test pass by accident.
- The öre-digit `< 1,000,000,000` guard keeps fixtures deterministic against the orgnr scan.

### Isolation — 95 (A)
- `node --test` runs each file in its own process; no cross-file shared mutable state relied upon.
- Explicit **purity assertions** are a highlight: `evaluateCutover`, `anonymizeRecord`, and
  `stripProse` are each proven not to mutate their inputs.
- Tests are read-only over committed fixtures (fixtures are *consumed, never mutated* — stated and
  enforced), so no data-cleanup/teardown is needed; no DB, no env mutation, no global writes.
- MEDIUM (single, minor): `lovable-comparison-guards.test.ts` runs a **top-level `for await`
  loop at module import** to build `EXECUTED_COMPARISON_CATEGORIES` before the `describe` block.
  It is deterministic and self-contained, but it is import-time work whose result a later test
  reads — a mild isolation/readability smell. Acceptable as written (the comment justifies it via
  the per-file-process model), but worth noting.

### Maintainability — 88 (B+)
- Exemplary self-documentation: every test is tagged with its AC / risk ID (e.g. `9.4-BLOCK-01`,
  `R-908`) and a rationale; validators are modeled as **pure functions** driven with a positive
  path AND a **seeded negative control** that proves the guard actually FIRES (directly answers the
  "structurally-unreachable dead-guard" anti-pattern the epic called out).
- LOW: the PII-scan regex block (personnummer/orgnr/email/phone/secret + masked-placeholder
  stripping) is **copy-pasted verbatim** across `migration-runbook-validators`,
  `sign-off-register-validators`, and `acceptance-gate-report-validators`. The shared authority
  `tests/support/anonymization-scan.ts` already exists and is used by the lovable pack; the three
  docs-validators could reuse it instead of re-declaring the regexes. Deliberate per an inline
  comment, but it is genuine duplication and a drift risk (a regex hardened in one place won't
  propagate).
- LOW: very long file/JSDoc headers and heavy inline commentary make some files verbose
  (`comparison-support.ts` 749 L; `acceptance-gate-report-validators.test.ts` 928 L / 29 tests).
  Per-test size stays healthy (~32 L avg, well under the 300-line ceiling); the length is breadth,
  not monolithic tests.

### Performance — 98 (A)
- ~2.0s wall for 121 tests. All files parallelizable; **no `.serial`**, no slow/expensive setup,
  no DB spin-up, no network. Fixtures are small JSON. Nothing to optimize.

## Warnings / Recommendations (all LOW, non-blocking)

1. **De-duplicate the PII-scan regexes** — have the three `tests/unit/docs/*-validators.test.ts`
   import the personnummer/orgnr/email/phone/secret regexes (and masked-placeholder stripping)
   from `tests/support/anonymization-scan.ts` rather than re-declaring them, so a future hardening
   propagates to every docs scan.
2. **Consider extracting** the module-import `for await` category-drive in
   `lovable-comparison-guards.test.ts` into an explicit `before()` hook (or a helper the GUARD-2
   test calls) so coverage-manifest construction is not import-time side effect.
3. **Optional:** silence the `MODULE_TYPELESS_PACKAGE_JSON` reparse warning (add `"type":
   "module"` or an ESM shim) — cosmetic, not a test-quality issue, but it clutters CI logs.

## Context References
- Test design: `_bmad-output/test-artifacts/test-design-epic-9.md`.
- Epic state / trace gate: `_bmad-output/auto-bmad/state/epic/epic-9.yaml`
  (`phase8_steps.trace_gate: done`, `gate_decision: PASS`).
- **Coverage boundary:** `test-review` does not score coverage. For AC→test traceability and the
  coverage gate, use `trace` (already PASSed for this epic).

## Next Recommended Workflow
`trace` is already green for epic 9. No test-quality remediation is required to proceed; the three
LOW recommendations above are optional hygiene for a later `automate` pass.
