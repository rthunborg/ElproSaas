---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-04'
workflowType: testarch-test-design
designLevel: epic
epicNum: 8
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 8, lines 1556-1753; stories 8.1-8.5)
  - _bmad-output/planning-artifacts/architecture.md (ADR-A006 entity-scoped private file model; ADR-A009 narrow RPC; §6 Storage strategy; §5 command registry incl. generateQuotePdf/createSignedFileAccess/archiveFile; §14 File And Storage Model; §15 audit; §12 quote PDF; §13 acceptance)
  - _bmad-output/planning-artifacts/prd.md (required-files FRs)
  - _bmad-output/project-context.md (Testing Rules; Security Regression Harness Rules; RLS-by-default + GRANTs; TENANT_TABLES enrollment contract; golden PII scan)
  - _bmad-output/test-artifacts/test-design-epic-6.md (house style + 8.1 dependency framing; 6.3 stores PDFs through 8.1)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (Epic 8 sequencing: 8.1 Wave-1 before Epic 6; 8.2-8.5 Wave-2 after Epics 6-7)
  - supabase/config.toml ([storage] present; NO buckets configured yet — 8.1 introduces private bucket)
  - supabase/migrations/** (no files/file_links/storage migration yet)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES + H4 gate enrollment contract)
  - tests/** (established runner split: node --test units, Vitest int/rls, Playwright e2e; two-tenant fixture; golden PII scan)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design Progress — Epic 8 (Required Files And Private Storage)

## Step 1 — Detect Mode
Mode: **Epic-Level (Phase 4)**, epic 8. Confirmed by explicit user intent ("EPIC-LEVEL mode for epic 8") and by presence of `_bmad-output/implementation-artifacts/sprint-status.yaml` (file-based epic-level signal). Prerequisite check PASS: Epic 8 + all five stories with acceptance criteria present in epics.md; architecture context (ADR-A006/A009, §6/§14) available.

## Step 2 — Load Context
Config resolved from `_bmad/tea/config.yaml`: test_artifacts=`_bmad-output/test-artifacts`, tea_use_playwright_utils=true, tea_use_pactjs_utils=false, tea_pact_mcp=none, tea_browser_automation=auto, test_stack_type=auto → detected **fullstack** (Next.js + Playwright + Supabase/Postgres). Loaded epics.md Epic 8, architecture (file/storage sections), project-context testing + security-harness rules, epic-6 design (house style + 8.1 dependency), sprint-status sequencing. Existing coverage scanned: mature harness (`tests/integration/rls/**`, `tests/integration/commands/**`, migration-reset tests, two-tenant factories, golden fixtures, e2e specs). **No file/storage code or migration exists yet** — Epic 8 is greenfield storage. Browser CLI exploration skipped (no running app / feature not yet built; code+doc analysis basis). Knowledge fragments (risk-governance, probability-impact, test-levels, test-priorities) applied.

## Step 3 — Risk & Testability
20 risks identified across SEC/DATA/BUS/OPS/TECH/PERF. 11 high-priority (≥6). Headline: storage path spoofing, public-bucket exposure, cross-tenant signed-URL/list/read, MIME/size bypass, locked-evidence replacement, storage↔DB atomicity/orphans, file-index scope creep. Full register in deliverable.

## Step 4 — Coverage Plan
P0/P1/P2/P3 coverage matrix across UNIT/INT/RLS/E2E/GOLDEN/DOCS, execution strategy (PR/nightly), range estimates, quality gates. Full matrix in deliverable.

## Step 5 — Generate Output
Deliverable written to `_bmad-output/test-artifacts/test-design-epic-8.md` using epic-level template, project house style. Validated against checklist. CLI sessions: none opened (nothing to clean up). Temp artifacts: none outside test_artifacts.
