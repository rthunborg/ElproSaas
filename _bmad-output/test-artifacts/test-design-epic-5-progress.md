---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-02'
workflowType: testarch-test-design
designLevel: epic
epicNum: 5
executionMode: sequential
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 5, lines 1026-1211)
  - _bmad-output/planning-artifacts/architecture.md (§7 data model IN list; §10 money/tax rules; §11 quote snapshot model; ADR-A009 narrow RPC; §12 PDF read-only sources)
  - _bmad-output/planning-artifacts/prd.md (FR19-FR29)
  - _bmad-output/project-context.md (Money/Tax/Quote Rules; Testing Rules; Security Regression Harness Rules; Critical Don't-Miss)
  - _bmad-output/test-artifacts/test-design-epic-4.md (house style + inherited money/snapshot/golden notes)
  - _bmad-output/test-artifacts/test-design-epic-3.md (RLS-heavy epic house style)
  - supabase/migrations/20260630120000_crm_data_model.sql (CRM composite same-tenant FK + RLS + GRANT pattern story 5.1 extends)
  - supabase/migrations/20260630140000_work_roles_and_articles.sql (pricing source rows story 5.3 snapshots)
  - src/lib/money/** (Epic 4 pure engine story 5.1/5.2/5.4/5.5 route all math through)
  - src/lib/snapshots/build.ts, types.ts + src/server/snapshots/resolve-source.ts (Story 3.5 snapshot contract story 5.3 composes)
  - src/server/commands/crm/validation.ts, crm-db.ts (command validation model story 5.1 follows)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES enrollment contract story 5.1 must extend)
  - tests/fixtures/golden/money/options-tillval.json (Epic 4 inclusion pin story 5.5 extends; R-408 cross-ref)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design Progress — Epic 5 (Calculation Workspace And Quote Readiness)

## Step 1 — Mode & Prerequisites

- **Mode:** Epic-Level (Phase 4) — user-explicit. `sprint-status.yaml` present also implies epic-level.
- **Epic 5:** 5 stories (5.1-5.5), slug `calculation-workspace-and-quote-readiness`, all at backlog (auto-bmad epic-5.yaml). No story files created yet; epic definition source is `epics.md` (Epic 5, lines 1026-1211).
- **Prerequisites met:** epic + story acceptance criteria available; architecture + PRD + project-context available; Epic 4 money engine, Epic 3 CRM/pricing/snapshot foundation live in `main`.
- **Config:** test_artifacts=`_bmad-output/test-artifacts`; tea_execution_mode=auto→sequential (single artifact); risk_threshold=p1; two-runner stack (`node --test` unit + Vitest integration/RLS + Playwright e2e).

## Step 2 — Context Loaded

- Detected stack: **fullstack** (Next.js/React frontend + Supabase/Postgres backend). Epic 5 is the first epic since Epic 3 to add tenant-owned TABLES (calculations/sections/rows) AND a real UI surface (calculation editor) AND consume the Epic 4 pure engine — so it spans UNIT + INT + RLS + E2E + GOLDEN, unlike pure-logic Epic 4.
- Inherited assets confirmed in-repo: CRM composite same-tenant FK + RLS enable+force + GRANT + archive-over-delete pattern; TENANT_TABLES enrollment + H4 inventory gate; envelope/command Result model + resolveSnapshotSource; pure `@/lib/money` engine (sumOre/lineVatOre/estimateDeduction/selectVatDisplay); copy-by-value+freeze snapshot contract; options-tillval inclusion golden pin (owner 2026-06-18: hidden rows + selected options count).
- Knowledge fragments (epic-level required): risk-governance, probability-impact, test-levels-framework, test-priorities-matrix.

## Steps 3-4 — Risk + Coverage

- 16 risks (R-501..R-516). High-priority (≥6): 11. No score-9 auto-BLOCK, but 3 non-negotiable epic blockers regardless of score (RLS/inventory gap on new calc tables; math not routed through `@/lib/money`; hidden-row/tillval totals-inclusion divergence from the owner-decided pin; fixture PII).
- Coverage: P0/P1/P2/P3 across UNIT / INT / RLS / E2E / GOLDEN / DOCS levels. RLS is the headline again (3 new tenant tables) alongside math-correctness-via-reuse and readiness classification.

## Step 5 — Output

- Wrote `_bmad-output/test-artifacts/test-design-epic-5.md` (epic-level template, sequential mode).
- Validated against checklist: risk IDs unique, P×I scored, high-risk flagged + mitigated, coverage mapped to levels + priorities + risk links, execution strategy (PR/nightly), estimates as ranges, quality gates + non-negotiables.
