---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design-qa.md
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-06-11'
projectName: 'ElproSaas'
---

# TEA → BMAD Integration Handoff

## Purpose

This document bridges TEA's system-level test design with BMAD's epic/story workflows. Phase A epics and stories already exist (`_bmad-output/planning-artifacts/epics.md`); use this handoff to **enrich existing stories** with quality requirements during `create-story` / story refinement, and as input to epic-level test design runs per epic.

## TEA Artifacts Inventory

| Artifact | Path | BMAD Integration Point |
| --- | --- | --- |
| Architecture Test Design | `_bmad-output/test-artifacts/test-design-architecture.md` | Blockers B1–B3 and recommendations H1–H5 → story acceptance criteria in E1/E2/E6/E8 |
| QA Test Design | `_bmad-output/test-artifacts/test-design-qa.md` | Coverage plan P0–P3 → story test requirements |
| Risk Assessment | (embedded in both docs) | Epic risk classification, story priority |
| Progress/Working Notes | `_bmad-output/test-artifacts/test-design-progress.md` | Audit trail |

## Epic-Level Integration Guidance

### Risk References

- **E1:** R-OPS-1 (reset/CI), R-SEC-2 (service-role scan starts here)
- **E2:** R-SEC-1 (RLS suite), R-SEC-2, R-OPS-2 (audit), R-TECH-2 (if RPC path chosen)
- **E3:** R-SEC-1 (new tenant tables), R-DATA-1 (snapshot source contract)
- **E4:** R-DATA-1, R-BUS-1 (estimate labeling/warnings)
- **E5:** R-DATA-1 (totals/options/hidden rows), R-SEC-1
- **E6:** R-DATA-2 (sent immutability), R-TECH-1 (PDF), R-TECH-3 (numbering)
- **E7:** R-DATA-3 (transaction/idempotency), R-DATA-2 (correction boundary)
- **E8:** R-SEC-3 (storage), R-DATA-2 (file locks)
- **E9:** R-DATA-4 (fixture PII), R-BUS-2 (deltas), R-BUS-1 (cutover gate)

### Quality Gates

- Every epic: P0 = 100% pass; P1 ≥ 95%; new tenant tables enrolled in RLS suite before merge.
- E4 gate: money/tax unit suites + golden fixture pack green before E5/E6 depend on them.
- E7 gate: fault-injection test proves zero partial state before acceptance UX ships.
- E9/pilot cutover gate: all score-≥6 mitigations verified + owner/accounting sign-off register complete (AC21/AC22).

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

Must appear as explicit acceptance criteria in the mapped stories:

- **E1.1/E1.2:** migration reset + seed gate (P0-001); service-role scan (P0-007).
- **E2.2:** cross-tenant read/insert/update/delete negatives (P0-002..004); two-tenant fixtures; per-worker tenant rule.
- **E2.3:** command envelope rejects spoofed tenant ids (P0-005); audit event per critical command (P0-022).
- **E2.4:** unauthenticated route sweep (P0-006); membership-status negatives (P0-008).
- **E4.1–4.3:** öre/rounding/VAT/deduction unit suites (P0-009..011, P0-023).
- **E4.4:** golden fixture pack vs Lovable (P1-017).
- **E5.4/5.5:** readiness warnings, options/hidden-row goldens (P1-004, P0-023).
- **E6.1:** snapshot completeness (P0-012); server-side numbering (P0-024).
- **E6.4:** command + DB-level immutability negatives (P0-013, P0-014).
- **E7.2:** atomicity fault injection (P0-015); idempotent repeat (P0-016); adjusted-price reason (P0-017).
- **E8.1/8.3:** cross-tenant storage + spoofing negatives (P0-018); signed-URL expiry (P0-019, needs configurable TTL).
- **E9.2:** PII/secret scan on fixtures (P0-020).
- **Cross-epic:** core pilot journey E2E (P0-021) once E7 lands.

### Data-TestId Requirements

For E2E stability (selector resilience), stories with UI should require `data-testid` on: navigation items, primary actions (create/save/send/accept), calculation row inputs, totals/readiness panel, quote version timeline entries, PDF status indicator, acceptance form fields, file upload controls, and lifecycle state badges.

## Risk-to-Story Mapping

| Risk ID | Category | P×I | Recommended Story/Epic | Test Level |
| --- | --- | --- | --- | --- |
| R-SEC-1 | SEC | 2×3=6 | E2.2, E2.4, every schema story after | RLS negative |
| R-SEC-2 | SEC | 2×3=6 | E1.2, E2.4 | Static scan + integration |
| R-SEC-3 | SEC | 2×3=6 | E8.1, E8.3 | Storage negative |
| R-DATA-1 | DATA | 2×3=6 | E4.1–4.4, E5.5 | Unit + golden |
| R-DATA-2 | DATA | 2×3=6 | E6.4, E7.4, E8.4 | Integration + DB negative |
| R-DATA-3 | DATA | 2×3=6 | E7.2 | Integration (fault injection) |
| R-DATA-4 | DATA | 2×3=6 | E9.2 | Static scan + review |
| R-BUS-1 | BUS | 2×3=6 | E4.3, E9.4, E9.5 | Integration + manual gate |
| R-BUS-2 | BUS | 2×2=4 | E9.3 | Golden |
| R-TECH-1 | TECH | 2×2=4 | E6.3 | Integration + golden |
| R-TECH-3 | TECH | 2×2=4 | E6.1 | Integration (concurrency) |
| R-OPS-1 | OPS | 2×2=4 | E1.1, E1.2 | CI gate |
| R-OPS-2 | OPS | 2×2=4 | E2.3 onward | Integration assertion |
| R-TECH-2 | TECH | 1×3=3 | E2/E7 (if RPC chosen) | Integration negative |

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design** (this run) → produced architecture + QA docs + this handoff
2. **BMAD story refinement / create-story** → embed P0/P1 scenarios as acceptance criteria (epics already exist)
3. **TEA Framework** (`testarch-framework`) → initialize Playwright + harness when E1 starts
4. **TEA ATDD** → red-phase acceptance tests per story (run explicitly, per story)
5. **BMAD dev-story** → implement test-first
6. **TEA Automate** → expand coverage where gaps remain
7. **TEA Trace** → traceability matrix + gate decision before pilot cutover

## Phase Transition Quality Gates

| From Phase | To Phase | Gate Criteria |
| --- | --- | --- |
| Test Design | Story refinement | All score-≥6 risks have mitigation strategy (done in this design) |
| Story refinement | ATDD | Stories carry P0/P1 scenarios as acceptance criteria |
| ATDD | Implementation | Failing acceptance tests exist for P0/P1 scenarios of the story |
| Implementation | Test Automation | All story acceptance tests pass; cumulative PR suite green |
| Test Automation | Pilot cutover | Trace matrix ≥80% P0/P1 coverage; all high-risk mitigations verified; sign-off register complete |
