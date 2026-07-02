---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-01'
workflowType: testarch-test-design
designLevel: epic
epicNum: 4
outputFile: _bmad-output/test-artifacts/test-design-epic-4.md
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 4, lines 871-1024)
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md (Money/Tax/Quote Rules; Testing Rules)
  - _bmad-output/test-artifacts/test-design-epic-3.md
  - src/server/commands/pricing/validation.ts
  - src/lib/snapshots/build.ts, src/lib/snapshots/types.ts
  - tests/unit/lib/snapshots/golden.test.ts
  - tests/fixtures/golden/snapshots/{work-role,article}-source.json
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design Progress — Epic 4 (Money, Tax, Snapshot Primitives, Golden Fixtures)

## Step 1 — Detect Mode & Prerequisites

- **Mode:** Epic-Level (Phase 4). Explicit user intent ("epic-level test design for money/tax").
  `sprint-status.yaml` present ⇒ epic-level detection also agrees.
- **Target epic:** Epic 4 — the dedicated money/tax epic (`4-1..4-4`, currently `backlog`). Downstream
  money/tax invariants (quote-snapshot immutability = Epic 6, acceptance = Epic 7) are separate epics,
  carried here only as forward contracts.
- **Prerequisites:** Epic + story ACs available (epics.md 871–1024); architecture + PRD + project
  rules available. No HALT.

## Step 2 — Load Context

- **Config (`_bmad/tea/config.yaml`):** `test_artifacts=_bmad-output/test-artifacts`,
  `tea_use_playwright_utils=true`, `tea_use_pactjs_utils=false`, `tea_pact_mcp=none`,
  `tea_browser_automation=auto`, `test_stack_type=auto`, `communication_language=English`.
- **Detected stack:** fullstack (Next.js + Supabase), but **Epic 4 surface is pure logic** — no UI/DB
  for its own deliverables. **Browser exploration skipped** (no page to explore; pure primitives).
- **Existing coverage analyzed:** two-runner stack live (`node --test` units `tests/unit/**`, Vitest
  `tests/integration/**`, Playwright e2e). Money discipline (`isOreAmount`/`ORE_AMOUNT_MAX`) + snapshot
  freeze contract (`src/lib/snapshots`) + golden pattern (`tests/fixtures/golden/**` + PII scan)
  already exist and are the inherited foundation.
- **Knowledge loaded:** `risk-governance`, `probability-impact`, `test-levels-framework`,
  `test-priorities-matrix`. Playwright-utils/pact profiles N/A (no UI/microservices in Epic 4).

## Step 3 — Risk & Testability

- **14 risks** (R-401..R-414); **10 high (≥6)**, 0 nines. Dominant categories DATA (öre/float,
  rounding, VAT order, cap/basis, snapshot recompute) + BUS/compliance (hardcoded VAT, unapproved
  tax constants, ROT×grön mix, sign-off gating, fixture privacy) + TECH (golden-oracle labelling).
- Two compliance risks (R-405 unapproved-tax-as-fact, R-411 fixture PII) flagged as **epic blockers
  regardless of numeric score**.
- Testability: strongest of any epic (pure UNIT + GOLDEN); key concern is that rounding/VAT/sign-off
  are *behavioral/policy* assertions, and the golden oracle must be labelled old/new/delta.

## Step 4 — Coverage Plan

- Levels: **UNIT + GOLDEN only** (no INT/RLS/E2E in Epic 4's own scope). Test IDs `4.{story}-{LEVEL}-{seq}`.
- P0 ~24–38 · P1 ~14–20 · P2/P3 ~8–14. Total ~46–72 tests, ~34–61 h (~1–1.5 weeks, 1 dev).
- Execution: **run everything every PR** (`pnpm test:unit`, seconds; no DB/browser); nothing deferred.
- Gates: P0 100% / P1 ≥95% / high-risk mitigated; six non-negotiable epic blockers (integer öre, no
  VAT literal, no approvable tax without sign-off, invalid mix blocked, no fixture PII, frozen
  snapshots).

## Step 5 — Generate Output

- Mode: sequential (epic-level = single artifact). No system-level handoff doc (epic-level).
- **Output:** `_bmad-output/test-artifacts/test-design-epic-4.md` (uses `test-design-template.md`).
- Validated against `checklist.md` (epic-level path): risk matrix, coverage matrix, execution
  strategy (PR-only), interval estimates, quality gates, not-in-scope, entry/exit, interworking,
  sign-off questions all present. No browser CLI sessions opened (nothing to clean up). Artifacts under
  `test_artifacts/`.
- **Open items for the human:** 8 owner/accounting/legal sign-off questions (rounding, VAT display,
  ROT, grön teknik, eligibility/disclaimer, personnummer scope, approval posture, accepted-price
  delta) + reconcile 4.3 "no personnummer by default" with the 2026-06-18 owner decision + schedule/
  accept the two standing NFR concerns (no `pnpm audit` gate, no coverage reporter).
