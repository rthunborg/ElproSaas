---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-19'
workflowType: testarch-test-design
designLevel: epic
epicNum: 10
mode: epic-level
inputDocuments:
  - _bmad-output/planning-artifacts/epics-phase-b.md (Epic 10 §ll.522-696; Cross-Epic Delivery Rules ll.44-54; Requirements Inventory FR62-65)
  - _bmad-output/planning-artifacts/architecture-phase-b.md (§5 ADR-B003 scope manifest; §6 ADR-B004 public surfaces; §9.1 quote_follow_ups/quote_lost_reasons; §11 entitlement/read-model contract; §14 markQuoteVersionLost RPC; §3.6 field withholding)
  - _bmad-output/planning-artifacts/prd-phase-b.md (FR62-65, FR129-130, FR107; NFR11 carried, NFR47, NFR51; AC-B1a-5/6; §13 governance, §14 Phase C ledger)
  - _bmad-output/planning-artifacts/prd.md (NFR11 sent-immutability, carried by reference)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (Phase B wave order, OWNER-GATE WATCHLIST N-4, epic-10 stories)
  - _bmad-output/test-artifacts/test-design-epic-6.md (house style; inherited immutability/isolation harness)
  - src/server/commands/quotes/lifecycle.ts (markQuoteVersionLifecycle command; the state machine at command layer)
  - src/features/quotes/lifecycle.ts (isLegalLifecycleTransition, LEGAL_TRANSITIONS closed set, QuoteVersionStatus)
  - src/features/files/deferred-categories.ts (FORBIDDEN_DEFERRED_CATEGORIES deny-list to be manifest-derived)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES — 24-table Phase A enrolled set; H4 gate)
  - supabase/migrations/20260705120000_quote_version_model.sql + 20260707120000_quote_version_sent_lock.sql (quote_events, status/event CHECK sets, sent-lock row-equality trigger, mark_quote_version_lifecycle RPC)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
notes:
  - Mode detection: sprint-status.yaml present + explicit user intent (epic 10) → Epic-Level Mode.
  - tea_browser_automation=auto but no Playwright CLI / browser reachable in this headless run → browser exploration skipped per step-02 fallback; design is code+doc-evidence-based.
  - Prerequisites satisfied: Epic 10 has 4 full-depth stories with acceptance criteria (epics-phase-b.md) + Phase B architecture + PRD. No HALT.
---

# Test Design Progress — Epic 10 (Quote Lifecycle Completion + Phase B Governance Re-Baseline)

Step 1 (mode): Epic-Level Mode confirmed for Epic 10 (Phase B, Wave B1a). 4 stories:
10.1 governance re-baseline + scope manifest; 10.2 Förlorad/Avböjd + lost-reason lifecycle;
10.3 follow-up workflow; 10.4 pipeline read-model.

Step 2 (context): Loaded epics-phase-b Epic 10 + cross-epic rules; architecture §5/§6/§9.1/§11/§14/§3.6;
PRD FR62-65/FR129-130/NFR11/NFR47/NFR51/AC-B1a-5/6; existing quote lifecycle command + state machine +
sent-lock trigger + quote_events CHECK sets; TENANT_TABLES (24-table Phase A set); deferred-categories
deny-list. Knowledge fragments loaded (risk-governance, probability-impact, test-levels, test-priorities).

Step 3 (risk): 25 risks; 8 at score 6 (governance-drift, validator-completeness, fail-loud, sent-snapshot
mutation, state-machine cross-layer drift, quote_lost_reasons isolation, first-read-model entitlement
contract, read-model RLS-client-only). 0 auto-BLOCK; PII fixture held-at-blocker.

Step 4 (coverage): ~58-83 tests across UNIT/INT/RLS/E2E/GOLDEN/DOCS. P0 ~28-41 (governance integrity +
sent-immutability + isolation + read-model contract), P1 ~20-28, P2 ~7-10, P3 ~3-4.

Step 5 (output): Final document written to _bmad-output/test-artifacts/test-design-epic-10.md.
