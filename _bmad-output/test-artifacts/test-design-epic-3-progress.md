---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-06-30'
workflowType: testarch-test-design
designLevel: epic
epicNum: 3
mode: epic-level
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 3, lines 685-869)
  - _bmad-output/test-artifacts/test-design-epic-2.md (prior-epic conventions, inherited foundation)
  - _bmad-output/implementation-artifacts/deferred-work.md (carry-forward gaps)
  - tests/integration/rls/tenant-table-inventory.ts (H4 inventory gate + standing contract Epics 3-9)
  - src/server/commands/envelope.ts (reusable command envelope / ownership verify)
  - supabase/migrations/20260625122433_tenant_foundation.sql (RLS helper + tenant root contract)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
outputFile: _bmad-output/test-artifacts/test-design-epic-3.md
---

# Test Design Progress — Epic 3

## Step 1 — Mode Detection

Mode: **Epic-Level** (user explicitly chose epic-level for Epic 3 = "CRM, Company Settings,
And Pricing Foundation", epic + 5 stories 3-1..3-5). `sprint-status.yaml` present → confirms
epic-level. Prerequisites satisfied: Epic 3 + all 5 story specs (acceptance criteria) present
in epics.md; architecture context available; inherited Epic 2 foundation (command envelope,
RLS inventory gate, two-tenant factories) present in repo.

## Step 2 — Context Loaded

TEA config: `test_artifacts=_bmad-output/test-artifacts`, playwright_utils on, pactjs off,
pact_mcp none, browser_automation auto. Detected stack: **fullstack** (Next.js + Playwright +
Vitest + Supabase). Loaded epics.md Epic 3, Epic 2 test design (conventions), deferred-work
ledger, the H4 inventory gate module, the command envelope, the tenant_foundation migration,
and the four required epic-level knowledge fragments. Browser exploration skipped — no Epic 3
feature is implemented yet (design precedes implementation); rely on doc/code analysis.

Existing test foundation Epic 3 inherits (verified in repo):
- `tests/integration/rls/tenant-table-inventory.ts` — the SINGLE source of truth + H4 gate with an
  explicit "STANDING CONTRACT (Epics 3-9)": every new tenant-owned table must enroll with BOTH the
  cross-tenant and anon metadata seams or CI fails.
- `src/server/commands/envelope.ts` — `defineCommand`/`runCommand`, the authority surface every
  Epic 3 mutation plugs into; `verifyOwnership` is the parent-spoofing guard.
- two-tenant factories, deterministic command clock, append-only `audit_events`, metadata sanitizer.
- NO money/öre/VAT primitives exist yet (Epic 4 owns them); Epic 3 introduces integer-öre rate fields
  and a SMALL Phase-A snapshot contract (Story 3.5) that Epics 4-6 complete.

## Step 3 — Risk & Testability

13 risks identified, 8 high (≥6). Top categories: SEC (cross-tenant CRM/settings/pricing isolation,
parent-ownership spoofing, settings/terms isolation), BUS/compliance (personnummer capture, unapproved
tax/legal quote-terms wording, supplier-scope creep via articles), DATA (money öre integrity, snapshot
explainability / silent recompute), TECH (inventory-gate enrollment of 6 new tables, snapshot contract
durability). No score-9 BLOCK at design time — architecture + inherited controls define the mechanism;
residual risk is correct implementation + durable enforcement + Phase-A guardrails (the stop-conditions).

## Step 4 — Coverage Plan

P0 ~26-32, P1 ~22-28, P2/P3 ~14-20. Dominated by INT (server-command) + RLS-negative coverage with a
new emphasis on money-input UNIT tests (integer öre) and snapshot-builder UNIT/golden tests (Story 3.5),
plus a focused UI surface (Story 3.2 a11y/validation/no-deferred-nav). Execution: run everything in PR
(<~15 min); nightly = parallel RLS isolation; weekly = perf-deferred.

## Step 5 — Output

Wrote `_bmad-output/test-artifacts/test-design-epic-3.md` (epic-level template). Validated against
checklist.md. Single-worker (one artifact). Completion report returned to caller.
