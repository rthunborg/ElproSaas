---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-06-21'
workflowType: testarch-test-design
designLevel: epic
epicNum: 2
inputDocuments:
  - C:\ElproSaas\_bmad-output\planning-artifacts\epics.md (Epic 2, lines 525-684)
  - C:\ElproSaas\_bmad-output\planning-artifacts\architecture.md (ADR-A002/A003/A009, §5 Command Pattern, §6 Auth/RLS, §8 Tenant Model, §9/§18 Test Strategy, §19 CI, §20 Security Risks)
  - C:\ElproSaas\_bmad-output\planning-artifacts\prd.md
  - C:\ElproSaas\_bmad-output\implementation-artifacts\epic-1-retro-2026-06-21.md (Part 2 Epic 2 prep, deferred-work carry-forward)
  - C:\ElproSaas\_bmad-output\implementation-artifacts\sprint-status.yaml
  - C:\ElproSaas\_bmad-output\test-artifacts\test-design-progress.md (prior system-level test design, blockers B1/B2/B3, H1/H4/H5)
  - C:\ElproSaas\_bmad-output\test-artifacts\nfr-assessment.md
  - C:\ElproSaas\package.json (placeholder test gate confirms no runner yet)
  - knowledge/risk-governance.md
  - knowledge/probability-impact.md
  - knowledge/test-levels-framework.md
  - knowledge/test-priorities-matrix.md
---

# Test Design Progress — Epic 2 (Epic-Level)

This progress log accumulates the work of the epic-level test-design workflow for
Epic 2. The final deliverable is `test-design-epic-2.md` in this folder. The prior
system-level artifact `test-design-progress.md` (lastSaved 2026-06-11) is intentionally
left untouched.

## Step 1 — Mode Detection & Prerequisites

- **Mode:** Epic-Level (Phase 4). Two independent signals agree:
  - Explicit user intent: epic-level mode for Epic 2.
  - File-based detection: `_bmad-output/implementation-artifacts/sprint-status.yaml` exists → Epic-Level.
- **Epic:** Epic 2 — "Tenant Access, Admin Auth, RLS, And Audit Foundation". Four stories
  (2.1 login/tenant-context, 2.2 membership schema/RLS/fixtures, 2.3 command envelope/audit,
  2.4 security regression harness). All currently `backlog` (no story files yet); requirements
  sourced from `epics.md` acceptance criteria + architecture.
- **Prerequisites (Epic-Level):** Satisfied. Epic + per-story acceptance criteria present with
  Given/When/Then; architecture context (ADRs, command pattern, RLS strategy, test strategy)
  available; prior system-level test design + NFR assessment available; epic-1 retro provides
  test-environment readiness context.

## Step 2 — Context Loaded

- Config (tea): `test_artifacts`, `tea_use_playwright_utils: true`, `tea_browser_automation: auto`,
  `test_stack_type: auto`, `risk_threshold: p1`. Communication language: English.
- Stack detection: Next.js 16 App Router + React 19 + TypeScript (frontend present);
  Supabase Postgres/Auth/Storage is the backend (local CLI stack arrives in Story 2.2).
  Classified `fullstack`. **No test runner installed yet** — `pnpm test` is an honest placeholder
  (package.json line 15). `supabase/` directory does not yet exist.
- Existing coverage: none. Epic 1 shipped app shell + CI gates only; first real suites land in Epic 2.
- Knowledge fragments loaded (epic-level required): risk-governance, probability-impact,
  test-levels-framework, test-priorities-matrix.

## Step 3 — Risk Assessment

13 risks identified across SEC/TECH/DATA/OPS. 8 are high-priority (score ≥6), dominated by SEC
(tenant isolation, service-role containment, anonymous privileged access, client tenant spoofing).
See the risk register in `test-design-epic-2.md`. No score-9 (auto-BLOCK) risks at design time —
the controls exist in the architecture; the risk is in *correct implementation and durable enforcement*,
which the epic's own harness (Story 2.4) is built to police.

## Step 4 — Coverage Plan

~58-74 scenarios across Unit / Integration (server-command + RLS) / E2E levels, weighted toward
Integration + RLS-negative because the epic is a security/data-foundation epic with little UI.
Priorities: P0 (tenant isolation, auth boundary, service-role containment, append-only audit,
inventory gate), P1 (membership lifecycle, command envelope failure modes, migration reset),
P2/P3 (UX context display, audit surfacing, harness ergonomics). Full matrix, execution strategy,
estimates, and gate criteria in `test-design-epic-2.md`.
