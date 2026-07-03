---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-03'
workflowType: testarch-test-design
designLevel: epic
epicNum: 6
outputDocument: _bmad-output/test-artifacts/test-design-epic-6.md
---

# Test Design Progress — Epic 6 (Quote Versions, PDF, And Lifecycle)

## Step 1: Mode Detection

- **Mode:** Epic-Level (Phase 4). User explicitly requested epic-level test design for quote
  snapshots/PDF/immutability; `sprint-status.yaml` exists (BMad-integrated). Target: **Epic 6**
  (stories 6.1-6.5, all backlog — pre-implementation design).
- **Prerequisites:** Epic 6 ACs present in epics.md (lines 1213-1399); architecture §11-§12 +
  ADR-A005/A009; prior epic test designs + Epic 5 retro available.

## Step 2: Context Loaded

- **Config:** `tea_use_playwright_utils=true`, `tea_browser_automation=auto`, `risk_threshold=p1`;
  detected stack `fullstack` (Next.js + Supabase; two-runner + Playwright harness live in repo).
- **Artifacts:** epics.md Epic 6 (5 stories + FR30-40), architecture §11 snapshot model / §12 PDF /
  §13 boundary / ADR-A005/A009 / error codes, project-context money-tax-quote + snapshot contract
  rules, test-design-epic-5.md (house style + inherited foundation), epic-5 retro (Epic 6 prep:
  8.1 sequencing, numbering spike, pnpm-audit hard mechanism, sign-off session urgency), current
  migrations + `src/lib/money|snapshots` + `tests/integration/rls/tenant-table-inventory.ts`.
- **Knowledge:** risk-governance, probability-impact, test-levels-framework, test-priorities-matrix.
- **Existing coverage:** 850/850 unit+golden green; INT/RLS/E2E CI-gated; H4 inventory gate live —
  Epic 6's new tables enroll into the existing suites rather than new harness work.
- **Browser exploration:** skipped — Epic 6 UI does not exist yet (pre-implementation design).

## Step 3: Risk & Testability

- **17 risks** identified (R-601..R-618, R-615 held at mitigate-control): 11 high (score 6), 5
  medium (4), 2 low. No score-9 blockers. (R-610 downgraded 6→3 on 2026-07-03 by owner decision:
  MVP is demo-data-only, unapproved tax/terms placeholders accepted until post-MVP; re-score to 6
  if real-customer use is proposed before sign-off.)
- Dominant classes: isolation on ~6 new quote tables incl. `tenant_counters` (R-601/602/611),
  snapshot completeness + behavioral freeze (R-603), numbering race (R-604), sent-immutability at
  command AND DB layers (R-605), PDF snapshot-only sourcing (R-606), internal-content leakage
  (R-607), readiness-gated send (R-608), prior-version preservation (R-609), fixture PII (R-615).
- Four non-negotiable epic blockers regardless of score: enrollment/RLS, DB-level sent immutability,
  PDF source-of-truth, fixture privacy.

## Step 4: Coverage Plan

- **~63-94 tests**: P0 ~34-48, P1 ~18-28, P2 ~8-12, P3 ~3-6 across UNIT/INT/RLS/E2E/GOLDEN/DOCS.
- Headline P0 proofs: mutate-after-capture snapshot freeze; command (`QUOTE_VERSION_LOCKED`) + direct
  SQL immutability negatives; regenerate-after-mutation PDF source-of-truth; concurrency-driven
  numbering; v1-preservation after v2/lifecycle events; PDF text-extraction goldens.
- Execution: everything on every PR (<15 min); nothing epic-specific nightly.
- Estimates: ~61-99 h (~1.5-2.5 weeks, 1 dev). New fixed cost: PDF text-extraction tooling.

## Step 5: Output Generated & Validated

- **Output:** `_bmad-output/test-artifacts/test-design-epic-6.md` (single epic-level document,
  sequential single-writer mode — one artifact, no parallelization benefit).
- **Checklist validation:** passed — unique risk IDs with correct P×I scores; priority sections
  criteria-only with the P≠timing note; execution strategy PR/Nightly/Weekly, no test re-listing;
  interval estimates; quality gates with 100% P0 + non-negotiables; Not-in-Scope with mitigations;
  Entry/Exit criteria include environment + data readiness and the Story 8.1 blocker; no browser
  sessions opened; artifacts under test_artifacts.
- **Open assumptions:** Story 8.1 lands before 6.3 (currently backlog); quote-number display format
  presentation-only; sent channel/reference are simple recorded fields; renderer pinned in 6.3;
  tax/terms constants remain unapproved placeholders — accepted residual under the 2026-07-03
  demo-data-only owner decision, sign-off session deferred to post-MVP real-customer entry.
