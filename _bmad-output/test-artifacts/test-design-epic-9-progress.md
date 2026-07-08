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
epicNum: 9
mode: epic-level
executionMode: sequential (single-worker epic-level; playwright-cli absent → no browser exploration, code/doc analysis only)
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 9, lines 363-371 summary + 1755-1938 stories 9.1-9.5; FR55-59; NFR17/21/22/32/37/38/39; AR25/26 defs at 119-172)
  - _bmad-output/planning-artifacts/prd.md (NFR17/21/22/32/37/38/39 defs; PRD AC1-AC22 referenced by 9.5)
  - _bmad-output/planning-artifacts/owner-signoff-questions.md (the sign-off register system-of-record: Blocks A-D tax gates öppen/möte, 8.1/8.2 migration möte, 1.2/7.1/7.3 partial; Design note 5.4; Scope decisions 3.4/7.5)
  - _bmad-output/project-context.md (Lovable Oracle Policy; Testing Rules incl. golden-master runner-glob trap, no-real-Lovable-oracle → every calc golden is new-expected, fictional ReadinessCode representativeness trap, ORGNR 10-digit scan constraint, stale RED-PHASE banner class; Security Regression Harness Rules; demo-data-only decision 2026-07-03)
  - _bmad-output/implementation-artifacts/deferred-work.md (open Sign-Off Q1-Q8 residuals, per-person ROT cap, margin threshold, MIME sniffing R-817, golden-pack representativeness hardening items — the consolidation inputs for 9.4/9.5)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (epic-9 backlog; 9.1-9.5 backlog; Epics 1-8 done)
  - .github/workflows/ci.yml (verify → db(migration reset + int/RLS) → e2e gate structure the 9.5 acceptance report consolidates)
  - package.json scripts (test:unit / test:int / test:e2e / verify:* — the gate commands)
  - IN-REPO golden infra (the 9.2/9.3 foundation): tests/fixtures/golden/{money,snapshots,quote-pdf,files}/*.json; tests/unit/**/*golden*.test.ts (money/calc/pdf/snapshot/file packs); the extended PII/anonymization scan in tests/unit/lib/money/golden-pack.test.ts (personnummer/orgnr/email/secret/phone/address heuristics — the pattern 9.2 generalizes)
  - knowledge: risk-governance.md, probability-impact.md (P×I 1-9, 6-8=MITIGATE/CONCERNS, 9=BLOCK), test-levels-framework.md, test-priorities-matrix.md
---

# Test Design Epic 9 — Progress Log

## Step 1 — Mode Detection & Prerequisites

- **Mode: Epic-Level (Phase 4).** Explicit user intent ("EPIC-LEVEL mode for epic 9"). File-based
  detection agrees: `sprint-status.yaml` exists → epic-level. Prerequisites satisfied — Epic 9 and
  its five stories (9.1-9.5) carry full acceptance criteria + technical/test/security/money/migration
  notes in `epics.md`; architecture + PRD + project-context available.
- Epic 9 = "Migration, Coexistence, Golden Masters, And Pilot Readiness." Stories 9.1-9.5 are all
  `backlog`. Epics 1-8 are `done`, so the full workflow exists to compare against.

## Step 2 — Context Loaded

- TEA config resolved: `test_artifacts = _bmad-output/test-artifacts`; playwright-utils enabled, pact
  disabled, browser-automation `auto` but **playwright-cli absent → browser exploration skipped**
  (code/doc analysis — this epic is docs + fixtures + a comparison harness + a report, near-zero
  net-new product UI).
- Detected stack: **fullstack** (Next.js + Playwright configs + Supabase). Loaded epic-level core
  knowledge fragments (risk-governance, probability-impact, test-levels, test-priorities).
- Existing coverage analysed: a substantial golden-master pack already exists (money/calc/pdf/snapshot/
  file), plus a PII/anonymization scan and the two-tenant RLS/storage negative harness. **Key gap Epic 9
  fills:** there is currently NO anonymized Lovable oracle — every existing golden case is
  `origin: "new-expected"`; 9.2/9.3 introduce the first real `documented-delta`/`old-lovable` origins.

## Step 3 — Risk & Testability (see final doc for full matrix)

- 22 risks identified; 11 high-priority (≥6); 0 auto-BLOCK (score 9). Dominant categories: **SEC/DATA
  (privacy leak of real PII/customer files into committed fixtures/docs)**, **BUS (unsigned tax/money
  assumptions cut over to real use; over-migration of history)**, **TECH (comparison harness vacuous-
  green / representativeness traps)**, **OPS (fallback removed before gates pass)**.
- Testability is high for the docs/fixture/report stories (deterministic, offline, no external service)
  and moderate for the harness (depends on a stable Lovable capture and the local Supabase stack).

## Step 4 — Coverage Plan (see final doc)

- P0 dominated by (a) fixture-privacy scans, (b) golden comparison correctness + delta classification,
  (c) the acceptance-gate report's honesty (no false-green, deferred-scope scan). Execution: everything
  runs in the existing PR gate (< 15 min: unit golden + report checks) except the DB-backed comparison
  integration cases (db job) — no perf/nightly tier needed.
- Quality gates: P0 100%, P1 ≥95%, fixture-privacy 100%, no real PII/customer-file in any committed
  artifact (epic blocker), and the sign-off register must BLOCK real-pilot cutover on any unresolved
  money/tax/immutability/acceptance/migration-classification decision — while the demo-data-only owner
  decision (2026-07-03) keeps those same items NON-blocking for the demo track.

## Step 5 — Output generated

- `_bmad-output/test-artifacts/test-design-epic-9.md` written from `test-design-template.md`, validated
  against `checklist.md`. No CLI sessions opened (nothing to clean up). Single-worker epic-level.
