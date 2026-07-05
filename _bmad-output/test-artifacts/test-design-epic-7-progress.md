---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-05'
workflowType: testarch-test-design
designLevel: epic
epicNum: 7
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 7, lines 1401-1555; stories 7.1-7.4; FR41-FR48; AR20-AR21)
  - _bmad-output/planning-artifacts/architecture.md (§13 Acceptance-To-Job Transaction Design; ADR-A005 immutable quote/acceptance; ADR-A009 narrow RPC incl. acceptQuoteAndCreateJob; §5 command registry acceptQuoteAndCreateJob; §6/§9 immutable lifecycle tables via triggers/constraints; §7 quote_acceptances/jobs IN; §14 file model owner types quote_acceptance/job/acceptance_evidence/job_evidence; §15 audit; stable error codes ACCEPTANCE_ALREADY_RECORDED/QUOTE_VERSION_LOCKED/COMMAND_CONFLICT)
  - _bmad-output/planning-artifacts/prd.md (FR41-FR48 acceptance/job; NFR12 immutable accepted refs; NFR20 no partial acceptance/job state; UX-DR17/23/24/26/35)
  - _bmad-output/project-context.md (Money/Tax/Quote Rules öre; snapshot-source contract; Testing Rules; Security Regression Harness Rules; demo-data-only decision 2026-07-03)
  - _bmad-output/test-artifacts/test-design-epic-6.md (house style; Epic 6 sent-state lifecycle Epic 7 consumes; sent immutability R-605; Not-in-Scope cross-refs 7.4 correction boundary)
  - _bmad-output/test-artifacts/test-design-epic-8.md (house style + depth; wave-2 planning-depth pattern for not-yet-frozen dependencies; 8.1 file model; 8.4 locks accepted evidence must AGREE with Epic 7)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (Epic 7 backlog; runs AFTER Epic 6; before Wave-2 8.2-8.5; 8.1 done)
  - _bmad-output/implementation-artifacts/deferred-work.md (8.1 quote_acceptance/job owner types INACTIVE-deferred; acceptance_evidence file-evidence UX = Epic 8.2; file_links no dedupe; 3.5 CompanySettingsSnapshot identity-partial; 4.x per-person ROT cap deferred)
  - supabase/migrations/20260704120000_file_storage_foundation.sql (files/file_links; owner_type quote_acceptance/job structurally-valid but INACTIVE — Epic 7 activates the quote_acceptance + job owner types + acceptance_evidence/job_evidence purposes)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES enrollment + H4 inventory gate contract — quote_acceptances + jobs + job_events + quote_events enroll)
  - _bmad-output/auto-bmad/retro-notes/epic-5.md, epic-8.md (standing NFR carry; resumed-run artifact discipline; kong 502 post-reset false-green; storage-service reachability; coverage-inversion after RPC rewire)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design Progress — Epic 7 (Acceptance-To-Job Transaction)

## Step 1 — Detect Mode
Mode: **Epic-Level (Phase 4)**, epic 7. Confirmed by explicit user intent ("EPIC-LEVEL mode for Epic 7") and by presence of `_bmad-output/implementation-artifacts/sprint-status.yaml` (file-based epic-level signal). Prerequisite check PASS: Epic 7 + all four stories (7.1-7.4) with acceptance criteria present in epics.md (lines 1401-1555); architecture §13 acceptance-to-job design + ADR-A005/A009 + §5 command registry + §9 immutable lifecycle tables available; FR41-FR48 + AR20-AR21 present.

## Step 2 — Load Context
Config resolved (same as Epics 6/8): test_artifacts=`_bmad-output/test-artifacts`, fullstack stack (Next.js + Playwright + Supabase/Postgres). Loaded epics.md Epic 7, architecture (§13 acceptance transaction, ADR-A005 immutability, ADR-A009 RPC — which explicitly names `acceptQuoteAndCreateJob` as a mandated narrow-RPC command, §5/§6/§9/§14/§15), prd FR41-FR48/NFR12/NFR20/UX-DR17-35, project-context money/testing/security rules + demo-data-only decision, epic-6 + epic-8 designs (house style + the wave-2 planning-depth pattern for not-yet-frozen dependencies), sprint-status (Epic 7 backlog, runs after Epic 6, before Wave-2 8.2-8.5), deferred-work ledger (8.1 quote_acceptance/job owner types INACTIVE — Epic 7 activates them; acceptance_evidence file-evidence UX is Epic 8.2), the 8.1 migration (owner_type union + inactive gate), retro notes (epic-5 standing NFR carry + resumed-run discipline; epic-8 post-reset kong 502 false-green + coverage-inversion-after-RPC-rewire). Existing coverage scanned: mature harness (TENANT_TABLES + H4 gate, cross-tenant/anon suites, command envelope + verifyOwnership, audit append-only, two-tenant factories, golden PII/ORGNR scan, files/file_links on main). **No acceptance/job code or migration exists yet** — Epic 7 is greenfield acceptance-to-job on top of the frozen 8.1 file model and (pending) Epic 6 sent-state lifecycle. Browser CLI exploration skipped (feature not yet built; code+doc analysis basis). Knowledge fragments (risk-governance, probability-impact, test-levels, test-priorities) applied.

## Step 3 — Risk & Testability
19 risks identified across DATA/SEC/BUS/OPS/TECH/PERF. 11 high-priority (≥6). Headline (the epic's core): idempotency — double-accept / retry must NOT create two jobs (R-702); atomicity — acceptance + lifecycle + job + events commit-or-rollback together, no partial state (R-703); accepted-state immutability at command AND DB with a correction boundary (R-704); new tenant-table isolation on quote_acceptances/jobs/job_events (R-701); adjusted accepted-price reason/evidence + öre discipline (R-705); acceptance only on a SENT quote version, consuming Epic 6's sent-state lifecycle which is NOT yet implemented (R-706, dependency gate). Full register in deliverable.

## Step 4 — Coverage Plan
P0/P1/P2/P3 coverage matrix across UNIT/INT/RLS/E2E/GOLDEN/DOCS, execution strategy (PR gate; nothing epic-7-specific nightly), range estimates, quality gates, entry/exit criteria, interworking & regression. Epic 6 dependency handled with the epic-8 wave-2 planning-depth approach where the sent-state lifecycle is not yet frozen: the acceptance-precondition scenarios are cross-referenced to Epic 6 sent-state and re-confirmed at each create-story once quote_versions/sent-state exists, rather than forking the lifecycle rule table. Full matrix in deliverable.

## Step 5 — Generate Output
Deliverable written to `_bmad-output/test-artifacts/test-design-epic-7.md` using the epic-level template + project house style (risk register with scored P×I risks, coverage plan by level with P0-P3 + risk links, execution strategy, quality gates, entry/exit criteria, interworking & regression), matched to the depth of test-design-epic-6.md and test-design-epic-8.md. Validated against the epic-level checklist. CLI sessions: none opened (nothing to clean up). Temp artifacts: none outside test_artifacts. NOT committed — orchestrator owns git.
