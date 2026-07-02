---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-02'
inputDocuments:
  - _bmad-output/implementation-artifacts/4-1-integer-ore-money-and-rounding-primitives.md
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - _bmad-output/project-context.md
  - src/server/commands/pricing/validation.ts
  - src/features/pricing/money-display.ts
  - src/lib/result/result.ts
  - tests/unit/lib/snapshots/golden.test.ts
  - tests/unit/features/pricing/money-display.test.ts
  - tests/fixtures/golden/snapshots/work-role-source.json
  - tests/support/register.mjs
---

# ATDD Red-Phase Checklist — Story 4.1: Integer Öre Money And Rounding Primitives

## Step 1 — Preflight & Context

### Stack detection

- Repo stack: **fullstack** (Next.js/React front end + Node/pg back end; `playwright.config.ts`, `vitest.config.ts` present).
- **This story is a PURE-LOGIC library story.** Its tests are pure `node --test` UNIT + GOLDEN under `tests/unit/lib/money/**` — NO browser, NO Playwright, NO DB/Vitest (per story Task 5 and test-design-epic-4 Execution Strategy: "Epic 4 is pure `node --test` UNIT + GOLDEN, no DB/browser/network"). Acceptance scaffolds are therefore `node --test` unit/golden files, not Playwright specs.

### Prerequisites (satisfied)

- Story `ready-for-dev` with 4 clear, source-mapped acceptance criteria. ✅
- Test framework configured: the pure-logic runner is `pnpm run test:unit` = `node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/**/*.test.ts"`. The `@/*` alias hook (`tests/support/register.mjs` → `alias-hook.mjs`) serves it. ✅
- Dev environment available; no external service/secret needed (pure math). ✅

### TEA config flags

- `test_stack_type: auto` → detected fullstack; story-level = pure Node unit.
- `tea_use_playwright_utils: true` — **not applicable** to this story (no browser/API HTTP surface; pure library).
- `tea_use_pactjs_utils: false`, `tea_pact_mcp: none`, `tea_browser_automation: auto` — not applicable.
- `test_artifacts: _bmad-output/test-artifacts`; `communication_language: English`.

### Reuse surfaces confirmed on disk (the scaffolds import/mirror these — no forks)

- `isOreAmount` / `ORE_AMOUNT_MAX` (`src/server/commands/pricing/validation.ts:76-100`) — the single öre-validity authority. `ORE_AMOUNT_MAX = Number.MAX_SAFE_INTEGER`. Rejects float/negative/NaN/±Infinity/overflow/locale-comma/decimal-string/null/object.
- `oreToKronorString` / `kronorStringToOre` / `KronorParseResult` (`src/features/pricing/money-display.ts`, Story 3.4) — the existing öre↔kronor string seam to consolidate with (`85000 → "850,00"`, non-finite → `""`).
- `Result<T,C>` / `ok` / `err` (`src/lib/result/result.ts`) — typed failure surface option.
- Golden pattern: `tests/unit/lib/snapshots/golden.test.ts` (fixture load via `readFileSync` + `resolve` from `import.meta.url`; anonymized-PII scan). Fixture JSON shape: `tests/fixtures/golden/snapshots/work-role-source.json` (`_doc` + payload keys).
- Red→green convention: `tests/unit/features/pricing/money-display.test.ts` (Story 3.4) — the exact `node --test` + top-level `@/*` import + `pending(...)` style to mirror.

### Target module (does NOT exist yet — this story creates it)

- `src/lib/money/**` (architecture §22 canonical home) — NONE of `src/lib/money`, `tests/unit/lib/money`, `tests/fixtures/golden/money` exist. Confirmed on disk.

### Binding test contract (test-design-epic-4.md, VALIDATED PASS 2026-07-01)

4.1 maps to: `4.1-UNIT-01` (integer öre in/out; kr only at boundary — R-401), `4.1-UNIT-02` (line net = round(qty×unitPriceÖre) nearest öre, line-level; fractional qty; totals = sum-of-rounded — R-401/R-402), `4.1-GOLDEN-01` (half-away-from-zero mode golden-pinned; a half-to-even flip fails loud — R-402), `4.1-UNIT-03` (invalid money rejected, user-safe typed failure, no raw value echoed — R-401/R-413), `4.1-UNIT-04` (negative/zero/zero-qty semantics; discount = stop-condition — R-413), `4.1-UNIT-05` (formatting boundary preserves exact öre; non-finite → "" — R-401), `4.1-UNIT-06` (overflow guard at `ORE_AMOUNT_MAX` — R-401), `4.1-UNIT-07` (P3 exploratory property/round-trip — not a gate).

## Step 2 — Generation Mode

- **Mode chosen: AI generation** (from ACs + source-code analysis of the reuse surfaces).
- Rationale: acceptance criteria are clear and the deliverable is a PURE library (`src/lib/money`) with no UI/browser interaction — there is nothing to record. Recording mode is skipped (no `page.goto`/browser surface). Scaffolds are authored as `node --test` unit + golden files mirroring the Story-3.4 red-phase and Story-3.5 golden conventions.

## Step 3 — Test Strategy

### Levels selected

- **UNIT (`node --test`, pure, no DB)** — the primary and near-exclusive level. `src/lib/money` is pure math over primitive inputs, so unit + golden exhaustively cover it.
- **GOLDEN (`node --test` + JSON fixture)** — the load-bearing rounding-mode pin (`4.1-GOLDEN-01`). It is a unit test that loads a fixture; kept in a dedicated file so a mode flip fails loud with a labelled diff.
- **NO Integration / NO E2E** — this story adds no DB/table/migration/route/UI, so per test-design-epic-4 Execution Strategy the DB/int/e2e gates run only as inherited regression, never as new 4.1 coverage. Authoring an INT/E2E test here would be out of scope.

### AC → scenario → test-ID map (all RED before `src/lib/money` exists)

| AC | Scenario | Level | Priority | Test ID | Risk |
| --- | --- | --- | --- | --- |
| AC1 | Integer öre in → integer öre out through `lineNetOre`/`sumOre`; kronor string produced ONLY by the boundary formatter (no float kronor crosses a boundary) | UNIT | P0 | 4.1-UNIT-01 | R-401 |
| AC1 | `formatOreAsKronor` is the single öre→kronor seam; formatting preserves exact öre internally; non-finite → `""` (no NaN to UI); byte-identical to existing `oreToKronorString` | UNIT | P2 | 4.1-UNIT-05 | R-401 |
| AC2 | `lineNetOre(qty, unitPriceÖre) = roundToOre(qty × unitPriceÖre)` — line-level round-to-nearest-öre; fractional qty (`1.5`, `0.333`, `2.25`) + large values → exact rounded öre | UNIT | P0 | 4.1-UNIT-02 | R-401, R-402 |
| AC2 | `sumOre` = SUM-OF-ROUNDED line values (never round-of-sum); includes an explicit case where sum-of-rounded ≠ round-of-sum; totals preserve exact öre | UNIT | P0 | 4.1-UNIT-02 | R-402 |
| AC2 | Half-rounding mode is **round-half-away-from-zero** and GOLDEN-pinned; a `.5`-boundary case where half-up gives `x+1` but half-to-even (banker's) would differ → an accidental mode flip FAILS LOUD | GOLDEN | P0 | 4.1-GOLDEN-01 | R-402 |
| AC3 | Invalid money REJECTED via reused `isOreAmount`: float öre, negative, `NaN`, `±Infinity`, overflow (> `ORE_AMOUNT_MAX`), locale-comma string (`"850,00"`), decimal string (`"850.00"`), null/object → typed failure, NO raw value echoed, NO `NaN`/throw | UNIT | P0 | 4.1-UNIT-03 | R-401, R-413 |
| AC3 | Negative/zero/zero-qty semantics: negatives rejected; zero öre valid; zero quantity valid → line net `0` (NOT a rejection); malformed quantity (`NaN`/`Infinity`/negative/non-number) rejected the same way; NO discount/negative-amount semantics invented (stop-condition) | UNIT | P1 | 4.1-UNIT-04 | R-413 |
| AC1/AC3 | Overflow guard at `ORE_AMOUNT_MAX` for `lineNetOre` output and the `sumOre` accumulator → typed failure, not a silent unsafe integer | UNIT | P2 | 4.1-UNIT-06 | R-401 |
| AC1/AC2 | (Exploratory, P3, non-gating) property/round-trip: `lineNetOre(1, x) === x` for valid öre `x`; `formatOreAsKronor` ∘ `kronorStringToOre` round-trips a valid öre value | UNIT | P3 | 4.1-UNIT-07 | — |
| AC4 | No-PII posture: the pure engine reads no personnummer/orgnr/customer field/clock; golden fixtures carry money numbers only (anonymized-scan reuse) | UNIT (golden) | P1 | R-411/R-412 posture (in golden file) | R-411 |

### Red-phase requirement (confirmed)

Every scaffold is designed to FAIL before implementation because `@/lib/money/*` does not exist yet:

- **Import-gated red phase** (mirrors Story 3.4 `money-display.test.ts`): each scaffold uses a `require`-gate at load time that SKIPS the whole file while `@/lib/money` is absent, so the green `test:unit` baseline stays UNPERTURBED (the suite does not error the runner). The dev's green phase deletes the gate and switches to a top-level `@/*` import + plain `test(...)`; the assertions ARE the contract.
- The golden fixture ships with the scaffold; the golden test is likewise gated until the engine exists.
- No test asserts a mode the story does not pin: half-away-from-zero is the single pinned mode; the banker's-rounding value appears ONLY as the "would fail loud" counter-expectation, never as an accepted output.

## Step 4 / 4C — Generation & Aggregation (adapted to a pure-library story)

### Orchestration adaptation

The standard ATDD workers (Worker A = failing API HTTP tests, Worker B = failing E2E browser tests) do not fit Story 4.1: it ships a PURE `src/lib/money` library with NO HTTP endpoint and NO browser surface, and the validated test-design-epic-4 pins Epic 4 to pure `node --test` UNIT + GOLDEN only ("no DB/browser/network"). Dispatching Playwright/API workers would emit off-target files. Per the delegate rule "complete the step and persist its deliverable," the generation ran **sequentially, in-line**, producing the artifacts that DO fit the story and its Task 5 — pure `node --test` unit scaffolds + a golden fixture.

### TDD red-phase mechanism (pure-Node analogue of `test.skip()`)

Instead of Playwright `test.skip()`, each scaffold uses a **load-time existence gate**: it checks whether `src/lib/money/{index,ore,money}.ts` exists and, while absent, runs the suite via `describe.skip` — so the whole file SKIPS cleanly without erroring the runner or perturbing the green baseline. This is the direct equivalent of `test.skip()` for the `node --test` runner and mirrors the Story-3.4 red→green convention already in the repo. Assertions are REAL expected-behavior contracts (no `assert.ok(true)` placeholders); the dev's green phase deletes the gate + lazy `import()` and switches to a top-level `@/*` import, leaving assertions unchanged.

### Files written to disk (RED)

| File | Kind | Test IDs covered |
| --- | --- | --- |
| `tests/unit/lib/money/ore.test.ts` | UNIT scaffold (`describe.skip` gated) | 4.1-UNIT-01, -02, -03, -04, -05, -06, -07 |
| `tests/unit/lib/money/rounding.golden.test.ts` | GOLDEN scaffold (`describe.skip` gated) | 4.1-GOLDEN-01 (+ sum-of-rounded, PII scan) |
| `tests/fixtures/golden/money/rounding-mode.json` | Anonymized golden fixture (`origin`-labelled, `bankersWouldGive` distinguisher) | feeds 4.1-GOLDEN-01 |

New directories created: `src/lib/money` target home (via `tests/unit/lib/money` + `tests/fixtures/golden/money`; the `src/lib/money` module itself is the dev's to create).

### Fixtures

Golden fixture only (`rounding-mode.json`) — 5 line-net cases (2 `.5`-boundary distinguishers + fractional + fractional-with-residue + large-value) and 1 sum-of-rounded case. No generic `test-data.ts` user fixture is needed (pure math, no auth/user surface). Fixture is anonymized: money numbers only, `_doc` provenance note, scanned by the golden test's own PII guard.

## Step 5 — Validate & Complete

### Red-phase verification (executed)

- Money scaffolds run standalone → both suites report `# SKIP`, `tests 0 / fail 0` (clean skip while engine absent). ✅
- Full `pnpm run test:unit` → **424 pass, 0 fail, 0 skipped-at-test-level**, with the two 4.1 suites SKIP-gated at the suite level. Existing green baseline UNPERTURBED. ✅
- Reference-implementation cross-check: an obvious pure engine (`Math.round`, `isOreAmount`, sum-with-overflow-guard, `oreToKronorString`-style formatter) satisfies **all 21 spot-checked assertions** — confirming the scaffolds are genuine RED (fail/skip now, GREEN when implemented), not impossible or tautological. ✅

### TDD red-phase compliance

- All tests suite-skipped in the red phase (existence gate). ✅
- No placeholder assertions — every test asserts EXPECTED öre/rounding/formatting behavior. ✅
- All tests expected-to-fail-until-implemented (gate flips to run once `src/lib/money` lands). ✅

### Acceptance-criteria coverage

- **AC1** (integer öre end-to-end; kr only at boundary) → 4.1-UNIT-01, 4.1-UNIT-05. ✅
- **AC2** (line-level round-to-nearest-öre; fractional qty; sum-of-rounded; half-away-from-zero golden-pinned) → 4.1-UNIT-02, 4.1-GOLDEN-01. ✅
- **AC3** (invalid money rejected via reused `isOreAmount`, user-safe typed failure, no raw echo; negative/zero/zero-qty semantics) → 4.1-UNIT-03, 4.1-UNIT-04. ✅
- **AC4** (pure foundation only: no schema/migration/VAT/ROT/dep/UI; formatter is presentation-only) → structurally enforced — scaffolds add NO migration/dep/route; the pure-engine no-PII posture is asserted by the golden PII scan; no VAT/ROT/snapshot assertions present. ✅

### Green-phase next steps (for the dev)

1. Create `src/lib/money/ore.ts` (+ `index.ts` re-export): `roundToOre` (half-away-from-zero, the single rounding primitive), `lineNetOre`, `sumOre`, `formatOreAsKronor`, `validateQuantity`; REUSE `isOreAmount`/`ORE_AMOUNT_MAX` (one implementation after the story) and reconcile the öre→kronor formatter with `src/features/pricing/money-display.ts` (one formatting authority).
2. In BOTH scaffolds: delete the `MONEY_ENGINE_PRESENT` existence gate + the lazy `loadEngine()` IIFE; add a top-level `import * as money from "@/lib/money";` and set `const engine = money as unknown as MoneyEngine;`. Leave assertions unchanged.
3. Run `pnpm run test:unit` → verify the 4.1 suites GO GREEN. Then the full CI gate (Task 5.4).
4. If a test fails, fix the implementation (not the assertion) unless a contract genuinely changed.

### Assumptions surfaced (NOT blockers for coding — owner/accounting sign-off pending)

- **Rounding policy** is a CONSERVATIVE PILOT ASSUMPTION: line-level rounding + half-away-from-zero + sum-of-rounded, golden-pinned. NOT accounting-final. STOP (needs-human) only if accounting requires DOCUMENT-LEVEL rounding, or if a discount/negative-amount data-model decision is required (test-design Sign-Off Q1; story Stop Conditions). Neither is triggered by this scaffolding work.
- **Two standing NFR concerns** (no `pnpm audit` CI gate, no coverage reporter) carry into this golden-heavy epic — surface in the epic gate for schedule-or-accept; not this story's to fix.

