---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-07-02'
workflowType: testarch-automate
story: 4.2 VAT And Quote Total Calculation Primitives
detectedStack: backend
executionMode: sequential (pure-library adaptation)
inputDocuments:
  - _bmad-output/implementation-artifacts/4-2-vat-and-quote-total-calculation-primitives.md
  - _bmad-output/test-artifacts/test-design-epic-4.md
  - src/lib/money/vat.ts
  - src/lib/money/ore.ts
  - src/lib/money/index.ts
  - src/server/commands/settings/validation.ts
  - tests/unit/lib/money/vat.test.ts
  - tests/unit/lib/money/vat.golden.test.ts
  - tests/fixtures/golden/money/vat-rates.json
---

# Test Automation Expansion — Story 4.2 (VAT + Quote-Total Primitives)

## Mode & Stack

- **Mode:** BMad-Integrated (story 4.2 + binding epic-4 test design present). Create mode
  (expand coverage after implementation).
- **Detected stack:** `backend` / pure-library. The story surface (`src/lib/money/vat.ts`) is a
  PURE integer-öre + basis-point VAT engine — NO DB, NO HTTP route, NO browser, NO clock. Test
  framework: `node --test` via `pnpm run test:unit` (`--experimental-strip-types` +
  `tests/support/register.mjs` alias hook). Vitest/Playwright exist for DB/e2e but are N/A here
  (test-design-epic-4: Epic 4 adds ZERO Vitest/Playwright tests).
- **Execution:** sequential, inline `node --test` authoring. The generic automate API/E2E subagent
  dispatch matrix does not fit a pure-logic module (epic-4 retro: pure-library stories route to
  inline UNIT + GOLDEN, not an HTTP/browser scaffold).

## Coverage baseline (already present before this run)

The frozen ATDD contract scaffolds pin the AC happy paths + load-bearing policy:
`vat.test.ts` (4.2-UNIT-01..06) + `vat.golden.test.ts` (4.2-GOLDEN-01) — 26 assertions covering
per-line round, sum-of-rounded ≠ round-of-sum, frozen snapshot, presentation-only display,
zero-rate, and the no-hidden-literal source grep. Full unit baseline: 516 pass.

## Gaps identified (Step 2) → tests generated (Step 3)

New file: **`tests/unit/lib/money/vat.coverage.test.ts`** (28 tests). Targets the branches,
negative paths, boundaries, and exact contracts the frozen scaffolds leave open — no duplication:

| Target (in `vat.ts`) | Priority | Coverage added |
| --- | --- | --- |
| `lineVatOre` | P1 | `INVALID_ORE_AMOUNT` vs `INVALID_VAT_RATE_BP` discriminant; validation ORDER (net first); defensive output-overflow guard at the öre ceiling; VAT monotonic in rate & ≤ net (5 tests) |
| `sumVatOre` | P1 | DIRECT contract: empty → 0; single element; order-independence; non-öre element → `INVALID_ORE_AMOUNT`; running total past ceiling → `ORE_OVERFLOW` (6 tests) |
| `vatBreakdown` | P1 | invalid net/rate → typed failure with NO partial breakdown; the DERIVED-gross `ORE_OVERFLOW` guard fires (net+VAT > ceiling — a branch unreachable in `lineVatOre` alone); gross = net+VAT, not re-rounded (4 tests) |
| `selectVatDisplay` | P1 | FULL `VatDisplayView` shape per posture (primaryOre/togglable/net/vat/gross); unknown-posture → conservative private/gross fallback; returned view is a fresh object (no input mutation) (5 tests) |
| `buildVatAssumptionSnapshot` | P1 | optional `sourceId`/`sourceUpdatedAt` copied when present, OMITTED (not `undefined`) when absent; sourceId-only case; frozen; no live ref to the DISPLAY field (4 tests) |
| `isVatRateBp` + `VAT_RATE_BP_MIN`/`MAX` | P1 | boundary accept/reject (0, 10000 / -1, 10001); float rejection; non-number rejection; the settings validator re-exports the SAME bounds (ONE authority, no fork) (4 tests) |

**Rationale (scope):** selective/targeted expansion of the pure engine's branch surface. No new
test level; no DB/browser/E2E (out of scope per epic-4 test design). No duplicate coverage — every
added test exercises a branch or contract the frozen scaffolds do not.

## Validation (Step 4)

- `tests/unit/lib/money/vat.coverage.test.ts` — **28 pass / 0 fail**.
- Full unit suite (`pnpm run test:unit`) — **544 pass / 0 fail / 0 skipped** (516 → +28, exactly
  the new file; no regressions).
- `pnpm typecheck` — clean. `pnpm lint` — 0 errors (1 pre-existing unused-var WARNING in the frozen
  ATDD scaffold `vat.test.ts`, not editable per ATDD contract; the new file is warning-free).
- DB/int/e2e gates unchanged: this expansion adds NO migration, dependency, DB or UI surface (pure
  unit only), consistent with the story's inherited-regression posture.

## Notes carried forward

- The `lineVatOre` output-overflow branch is unreachable from valid inputs alone (VAT ≤ net ≤ max
  for bp ≤ 10000), so its test asserts the ceiling case stays a valid öre amount (the guard is a
  defensive belt on the float product). The genuinely reachable overflow path — the DERIVED-gross
  guard in `vatBreakdown` (net at ceiling + non-zero VAT) — is now explicitly pinned.
- The per-line VAT rounding policy, the excl/incl/both display views, and the
  `private → always incl-VAT` invariant remain CONSERVATIVE PILOT ASSUMPTIONS pending
  owner/accounting/legal sign-off (Sign-Off Q1/Q2). Not re-opened — coverage pins the CURRENT
  policy so a regression fails loud.
- Two standing NFR concerns (no `pnpm audit` CI gate; no coverage reporter) remain owner-pending at
  the epic level — not introduced or fixed by this coverage expansion.
