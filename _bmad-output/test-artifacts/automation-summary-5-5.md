---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
  - step-03c-aggregate
  - step-04-validate-and-summarize
lastStep: step-04-validate-and-summarize
lastSaved: '2026-07-03'
inputDocuments:
  - _bmad-output/implementation-artifacts/5-5-calculation-golden-tests-for-options-hidden-rows-and-tax-warnings.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - tests/unit/features/calculations/calc-golden-pack.test.ts
  - tests/fixtures/golden/money/calc-rows.json
  - tests/unit/features/calculations/readiness-inclusion.golden.test.ts
  - tests/unit/lib/money/golden-pack.test.ts
  - tests/unit/lib/money/golden-pack-coverage.test.ts
  - src/features/calculations/totals.ts
  - src/features/calculations/readiness.ts
  - src/features/calculations/vat-posture.ts
---

# Test Automation Expansion — Story 5.5 (Calc Golden Pack)

**Role:** Master Test Architect · **Mode:** BMad-Integrated, Create · **Stack:** backend/fullstack (Next 16 app; pure `node --test` fast gate for this story) · **Execution mode:** sequential (single narrowly-scoped golden-pack expansion; subagent fan-out not warranted).

## Context

Story 5.5 is itself a tests-only golden-pack story. It shipped:

- `tests/fixtures/golden/money/calc-rows.json` — the anonymized calc-row golden fixture.
- `tests/unit/features/calculations/calc-golden-pack.test.ts` — the 4-guard pack (coverage manifest, labelling, behavioral live-oracle, schema-shape) + pack-wide privacy scan (14 tests, all green).

Per the automate charter, expansion must close only GENUINE residual gaps in the pack or its guards, not pad redundant tests. The already-pinned surfaces (arithmetic, five row types, frozen inclusion pin, ROT/grön warnings, rounding, VAT excl/incl/both for private+company) are covered at the right level by the pack + the referenced per-category authorities + the 5.4 inclusion golden — they were NOT duplicated.

## Coverage plan — gap analysis

Comparing AC1 + the `readiness.ts` rule table (the oracle this pack guards) against what the shipped pack actually drives, five genuine live-oracle gaps were found — all NEGATIVE / EDGE branches of the exact modules the pack is chartered to guard, mirroring the Story 4.4 `golden-pack-coverage.test.ts` GAP-1..GAP-5 discipline:

| Gap | Level | Prio | Residual gap closed |
| --- | --- | --- | --- |
| GAP-A | UNIT/GOLDEN | P0 | `computeSectionTotal` EXCLUSION branch — an UNSELECTED option dropped from a SECTION total (the pack's section builders only fed plain visible rows; a regression folding an unselected option into a section total would slip past every 5.5 section guard). Live negative oracle on the `options-tillval.json` pinned öre (R-508, no re-pin). |
| GAP-B | UNIT/GOLDEN | P0 | `classifyReadiness` `TOTAL_UNCOMPUTABLE` BLOCKER + `canCreateQuote===false` on an engine-REJECTED total — the P0 quote-creation gate downstream of the totals oracle, never driven by the pack (all pack readiness cases were computable). The engine decides the rejection (no inline math, R-505). |
| GAP-C | UNIT/GOLDEN | P0 | `MISSING_CUSTOMER` BLOCKER + the fail-open discipline that a WARNING (always-present `REQUIRED_FILES_DEFERRED`) NEVER gates. The pack always supplied a full customer, so the one hard gate and `canCreateQuote` derivation were unpinned. |
| GAP-D | UNIT/GOLDEN | P1 | `resolveVatDisplayPosture` brf/public/unknown-type branch — folds every non-private type into the tenant default AS-IS (a real owner-decision seam). The pack pinned only private + company. References `vat-rates.json` öre (R-508); asserts the round-trip returns the identical stored öre. |
| GAP-E | UNIT/GOLDEN | P3 | 5.5-UNIT-03 property/invariant (exploratory) — `gross === net + VAT` per line and section-net === engine sum-of-rounded of included line nets, swept deterministically through the real engine. Pure engine-vs-engine invariant, no pinned magic number → cannot rot against a re-pin. |

## Deliverable

- `tests/unit/features/calculations/calc-golden-pack-coverage.test.ts` (NEW) — 5 gap-closing live-oracle tests (GAP-A..GAP-E). Companion to `calc-golden-pack.test.ts`, mirroring the 4.4 `golden-pack-coverage.test.ts` precedent. Under `tests/unit/**` (never `tests/golden/**` — the runner-glob vacuous-green trap).

No `src/**` change, no new fixture, no dependency, no migration, no `.env` edit, no product code. The frozen `calc-rows.json` fixture and the shipped pack file were left untouched. No existing numeric authority re-pinned; nothing marked production-approved. No inline money math — every öre op routes through `totals.ts` / `@/lib/money`.

## Verification

Full active CI gate sequence, in order, each step separate:

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors (1 pre-existing warning in the untouched `tests/unit/lib/money/vat.test.ts`).
- `pnpm run test:unit` — **850 pass / 0 fail / 0 skip / 0 todo** (was 845 before; +5 gap-closing tests).
- `pnpm run verify:service-role-containment` — passed.
- `pnpm build` — succeeded.
- `pnpm run verify:bundle-containment` — passed.

Targeted pack run (`calc-golden-pack.test.ts` + `calc-golden-pack-coverage.test.ts`): 19 tests, all green. GAP-B confirmed non-vacuous — the engine genuinely rejects the overflow-scale line (`{ok:false}`), so the blocker path is live, not a false green.

## Priority coverage (new tests)

- P0: 3 (GAP-A, GAP-B, GAP-C)
- P1: 1 (GAP-D)
- P3: 1 (GAP-E)

## Open / deferred

- Standing epic-gate NFR concerns (no `pnpm audit` CI gate; no coverage reporter) are an Epic 5 trace/gate decision (R-510) — intentionally NOT actioned here.
- No `documented-delta`/`old-lovable` case exists yet (no anonymized Lovable calc oracle available; AGENTS.md — behavioral oracle only). The labelling + schema-shape guards still enforce the three-way origin discipline, so the pack is ready to absorb a real delta when Epic 9 captures one. Not fabricated.
