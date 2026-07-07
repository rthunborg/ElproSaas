---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-07'
workflowType: testarch-test-design
designLevel: epic
epicNum: 8
revision: 2 (refreshed 2026-07-07 against shipped reality)
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 8, lines 1556-1753; stories 8.1-8.5)
  - _bmad-output/planning-artifacts/architecture.md (ADR-A006/A009; §6 Storage; §9 immutable triggers; §14 File model; §15 audit)
  - _bmad-output/planning-artifacts/prd.md (required-files FRs)
  - _bmad-output/project-context.md (Testing Rules; Security Harness; RLS+GRANTs; TENANT_TABLES; golden PII scan; demo-data-only)
  - _bmad-output/test-artifacts/test-design-epic-6.md + test-design-epic-7.md (house style; 6.3 PDF-through-8.1; QV409/AR704 lock family)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (8.1 done; Epics 6-7 done; 8.2-8.5 backlog)
  - SHIPPED 8.1 code — migration 20260704120000_file_storage_foundation.sql; src/server/storage/*; src/server/commands/files/*; config.toml tenant-files bucket
  - SHIPPED 8.1 tests — file-tables-migration-reset, storage-object-isolation.rls, file-signed-access, file-link-ownership, generate-quote-pdf-storage-privacy, file-validation, object-path
  - FROZEN lock triggers — 20260707120000_quote_version_sent_lock.sql (QV409), 20260711120000_accepted_record_lock.sql (AR704); consumers generate-pdf.ts / accept.ts
  - tests/integration/rls/tenant-table-inventory.ts (files/file_links enrolled)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design Progress — Epic 8 (Required Files And Private Storage) — Revision 2

## Context
This is a **refresh** of the 2026-07-04 epic-8 test design. That first pass was prospective (8.1 "NEXT",
Epics 6-7 backlog, Wave 2 at planning depth). Current state: **8.1 `done`; Epics 6 and 7 `done` and
frozen; 8.2-8.5 `backlog` — Wave 2 ready.** Re-run in EPIC-LEVEL mode per orchestrator instruction.

## Step 1 — Detect Mode
Mode: **Epic-Level (Phase 4)**, epic 8. Confirmed by explicit user intent ("EPIC-LEVEL mode for epic 8")
and by `sprint-status.yaml` (file-based epic-level signal). Prerequisite check PASS: Epic 8 + all five
stories with ACs in epics.md; architecture context (ADR-A006/A009, §6/§9/§14) available; 8.1 shipped
code + tests now available as ground truth.

## Step 2 — Load Context
Config resolved from `_bmad/tea/config.yaml`: test_artifacts=`_bmad-output/test-artifacts`,
tea_use_playwright_utils=true, tea_use_pactjs_utils=false, tea_pact_mcp=none, tea_browser_automation=auto,
test_stack_type=auto → fullstack. Loaded epics.md Epic 8, architecture (file/storage/lock sections),
project-context, epic-6/7 designs, sprint-status. **Analyzed SHIPPED 8.1 in-repo** (migration, storage
helpers, file commands, config.toml bucket, all 8.1 tests) and the **frozen Epic 6/7 lock triggers**
(QV409/AR704) that 8.4 must join. Confirmed 6.3 `generateQuotePdf` and 7.x `accept` both consume 8.1
(single-model contract held). Browser CLI exploration skipped (feature-level, code+doc basis). Knowledge
fragments applied.

## Step 3 — Risk & Testability
21 risks (added R-822: "8.4 lock must join the QV409/AR704 family, not fork"). 11 high-priority (≥6).
**Reclassified vs revision 1:** R-801/R-803/R-804/R-805/R-806/R-807/R-819 now **MITIGATED** by shipped
8.1 (each with a named green in-repo test); R-815 (TTL configurable) and R-814 (8.1-before-Epic-6
sequencing) **RESOLVED**. Still **OPEN (Wave 2)**: R-808 (upload MIME/size GATE — 8.1 shipped
metadata-only), R-809 (upload-path existence disclosure), R-810 (preview-UX ordering), R-811 (upload
error states), R-812+R-822 (lock-enforcement trigger + family agreement), R-813 (partial lock/archive),
R-816 (index scope creep). Full register in deliverable with a new Status/Evidence column.

## Step 4 — Coverage Plan
P0/P1/P2/P3 matrix across UNIT/INT/RLS/STORAGE-NEG/E2E/GOLDEN/DOCS with **DONE/OPEN** status per row.
~8 of 12 P0 rows DONE (8.1 slice green); remaining P0 is 8.2 upload validation + 8.4 two-layer lock.
All P1 is Wave 2 (upload/preview/lock/index UX + compensation + audit). Execution strategy (run-all-on-PR),
range estimates (~50-87h total, ~1/3 landed, ~30-55h Wave-2 remainder), quality gates with shipped
non-negotiables checked off.

## Step 5 — Generate Output
Deliverable refreshed at `_bmad-output/test-artifacts/test-design-epic-8.md` (revision 2) using the
epic-level template + project house style. Added a "What Story 8.1 Actually Shipped" section (verified
in-repo artifact-by-artifact) and a "deliberately deferred" list. Validated against checklist. CLI
sessions: none opened. Temp artifacts: none outside test_artifacts. No product code / migrations / deps
changed (docs-only test-artifact update).
