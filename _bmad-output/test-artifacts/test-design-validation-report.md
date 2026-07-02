---
workflowType: testarch-test-design
mode: validate
designLevel: epic
epicNum: 4
target: _bmad-output/test-artifacts/test-design-epic-4.md
validatedAgainst: bmad-testarch-test-design/checklist.md (epic-level path)
date: '2026-07-02'
author: Rasmus (Master Test Architect)
overallVerdict: PASS
---

# Test Design Validation Report — Epic 4 (Money, Tax, Snapshot Primitives, Golden Fixtures)

**Target artifact:** `_bmad-output/test-artifacts/test-design-epic-4.md` (Draft, generated 2026-07-01)
**Mode:** Validate (epic-level single-document path)
**Checklist:** `bmad-testarch-test-design/checklist.md`
**Overall verdict:** **PASS** — the epic test plan / risk matrix is complete, internally consistent,
and faithfully traces to the Epic 4 source (`epics.md` 871–1024, stories 4.1–4.4). No FAIL items;
two informational WARNs (both process/ownership, not plan defects).

Source cross-check: every AC, test requirement, stop-condition, and non-scope item in the plan was
confirmed against the live Epic 4 text in `epics.md`. Epic 4 and all four stories are `backlog` in
`sprint-status.yaml` (pre-implementation), which is the correct posture for an epic-level design
sourced from ACs rather than story files.

---

## Section-by-Section Results

### Prerequisites (Epic-Level Mode) — PASS
- [PASS] Story-level ACs with clear Given/When/Then exist for 4.1–4.4 (epics.md).
- [PASS] PRD / epic documentation available (`prd.md`, `epics.md`).
- [PASS] Architecture context available (`architecture.md`, `project-context.md`).
- [PASS] Requirements testable and unambiguous where decided; genuine ambiguities (rounding mode,
  ROT/grön-teknik constants) are surfaced as sign-off questions rather than silently assumed.

### Step 1 — Context Loading — PASS
- [PASS] PRD, epics.md (Epic 4), story ACs, architecture, project rules, and prior epic-3 design all
  read; recorded in the artifact frontmatter with line references.
- [PASS] Existing coverage analyzed (two-runner stack; inherited `isOreAmount`/`ORE_AMOUNT_MAX`,
  `src/lib/snapshots` freeze contract, golden pattern + PII scan) and captured in "Inherited Foundation".
- [PASS] Knowledge fragments loaded: risk-governance, probability-impact, test-levels-framework,
  test-priorities-matrix.

### Step 2 — Risk Assessment — PASS
- [PASS] 14 genuine risks (R-401..R-414), not restated features.
- [PASS] Categories assigned (DATA/BUS/SEC/TECH/PERF/OPS) with a legend.
- [PASS] Probability and Impact each 1–3; scores = P×I. Spot-verified: R-401 2×3=6, R-402 2×3=6,
  R-407 2×3=6, R-408 2×2=4, R-412 1×3=3, R-413 2×2=4, R-414 1×2=2 — all arithmetic correct.
- [PASS] High-priority (≥6) clearly marked: 10 risks; 0 nines.
- [PASS] Mitigation plans, owners, and timelines present for every ≥6 risk; residuals documented
  (R-414 perf + standing NFR concerns).
- [NOTE] Two compliance risks (R-405 unapproved-tax-as-fact, R-411 fixture PII) are correctly held at
  score 6 but escalated to **epic blockers regardless of numeric score** — a sound, evidence-backed
  deviation, not a scoring error.

### Step 3 — Coverage Design — PASS
- [PASS] ACs decomposed into atomic, individually-owned scenarios with test IDs `4.{story}-{LEVEL}-{seq}`.
- [PASS] Test levels selected appropriately: **UNIT + GOLDEN (+ DOCS)** only. Deliberately no
  E2E/INT/RLS for a pure-logic surface — matches test-levels-framework (pure calc with high branch
  complexity ⇒ unit).
- [PASS] No duplicate coverage across levels.
- [PASS] P0/P1/P2/P3 assigned; P0 meets strict criteria (blocks trustworthy money/tax foundation OR
  compliance breach + high risk ≥6 + no workaround).
- [PASS] Risk linkage present on every row; data prerequisites (anonymized golden fixtures) and tooling
  (`node --test`, extended PII scan) documented.

### Step 4 — Deliverables — PASS
- [PASS] Risk matrix, coverage matrix, execution strategy, resource estimates, and quality-gate criteria
  all present.
- [PASS] Output written to the correct location under `test_artifacts/` and follows the test-design
  template structure (Executive Summary, Not in Scope, Risk Assessment, Testability Notes, Entry/Exit,
  Coverage Plan, Execution Strategy, Resource Estimates, Quality Gates, Mitigation Plans, Sign-Off,
  Assumptions/Dependencies, Interworking, Appendix).

## Output Validation

### Risk Assessment Matrix — PASS
- [PASS] Unique IDs; category per risk; P/I in 1–3; scores correct; ≥6 marked; mitigations specific and
  actionable (concrete reuse of `isOreAmount`, per-line-round-then-sum, freeze-by-value, labelled oracle,
  CI PII scan).

### Coverage Matrix — PASS
- [PASS] All ACs mapped to test levels; priorities assigned; risk links documented; counts realistic
  (ranges, not false precision); owners assigned; no behavior tested at two levels.

### Execution Strategy — PASS
- [PASS] Simple PR / Nightly-Weekly structure; philosophy "run everything in PRs" (whole suite is pure
  `node --test`, runs in seconds); no complex smoke/P0/P1 tiering; no re-listing of tests. Playwright
  parallelization note is N/A (no browser surface) and correctly omitted.

### Resource Estimates — PASS
- [PASS] All interval ranges (P0 ~24–38 tests / ~20–34h; P1 ~14–20 / ~10–18h; P2 ~5–9 / ~3–6h;
  P3 ~3–5 / ~1–3h; total ~46–72 / ~34–61h; ~1–1.5 weeks). No exact "N × 2h" arithmetic. Calendar-time
  sign-off dependency correctly separated from dev effort.

### Quality Gate Criteria — PASS
- [PASS] P0 100%, P1 ≥95%, P2/P3 ≥90% informational, high-risk (≥6) 100% mitigated-or-waived; coverage
  ≥90% for money/tax logic + six non-negotiable epic blockers enumerated.

## Quality Checks

### Evidence-Based Assessment — PASS
- [PASS] Risks grounded in documented evidence (epics.md ACs, project-context money/tax rules, in-repo
  inherited assets). Assumptions explicitly listed; clarifications raised as 8 sign-off questions rather
  than guessed.

### Risk Classification Accuracy — PASS
- [PASS] DATA = öre/float, rounding, VAT order, cap/basis, snapshot recompute; BUS = hardcoded VAT,
  unapproved tax constants, mix rule, sign-off gating; SEC = fixture PII / PII into engine; TECH = golden
  oracle labelling; PERF/OPS = calc-at-scale + standing NFR gaps. Categories match content.

### Priority Assignment Accuracy — PASS
- [PASS] Explicit note at top of the Coverage Plan: "P0/P1/P2/P3 = priority/risk classification, NOT
  execution timing." Priority sections carry only Criteria (no "Execution:" field). Execution timing is
  handled separately.
- [PASS] P0/P1/P2/P3 definitions match the standard rubric.

### Test Level Selection — PASS
- [PASS] Unit for edge cases/algorithms; golden (data-driven unit) for policy pins; no E2E/API where a
  pure function suffices; no redundant coverage.

### Knowledge Base Integration — PASS
- [PASS] risk-governance, probability-impact, test-levels-framework, test-priorities-matrix all consulted
  and referenced in the Appendix.

## Accountability & Logistics

- [PASS] **Not in Scope** — 10 items listed, each with reasoning + mitigation (calc UX → Epic 5; quote
  snapshot/PDF → Epic 6; acceptance → Epic 7; production approval of legal/tax constants; personnummer
  capture; Fortnox; document-level rounding; real Lovable import; perf).
- [PASS] **Entry Criteria** — environment, test-data, and pre-implementation sign-off blockers defined.
- [PASS] **Exit Criteria** — per-priority pass thresholds + the six financial/compliance invariants +
  fixture-privacy + no-PII-in-engine.
- [PASS] **Interworking & Regression** — impacted components (`src/lib/money` new; reuse of
  `src/lib/snapshots`, `isOreAmount`, `company_settings.vat_rate_bp`) with regression scope; inherited
  RLS/anon/service-role gates correctly noted as untouched.

## Workflow Dependencies — PASS
- [PASS] Can proceed to `*atdd` for P0 scenarios (noted as a separate, explicitly-run workflow, not
  auto-run), then `*automate` once `src/lib/money` exists, then `*trace` at the epic boundary feeding the
  gate. Risk register (R-401..R-411) explicitly earmarked for the gate.

---

## Findings

### Blocking (FAIL)
None.

### Warnings (informational — do not block)
1. **WARN — Status-file integration.** The checklist item "Test design logged in Quality & Testing
   Progress" is satisfied via the dedicated `test-artifacts/` artifacts + progress file rather than a
   central status log. This matches the project's file-system tracking convention; no action needed, but
   noted for completeness.
2. **WARN — Author/date placeholders.** Artifact `Status: Draft`, author "Rasmus", date 2026-07-01.
   These are correct for a pre-implementation design; a human owner should flip Status to Approved once
   the sign-off questions (below) are addressed.

### Open items carried by the design (for the human owner, not defects)
- 8 owner/accounting/legal **sign-off questions** (rounding mode, VAT display incl-for-private, ROT cap,
  grön-teknik rates/caps + mix rule, eligibility/disclaimer, personnummer scope, approval posture,
  accepted-price delta) — correctly surfaced, not silently assumed.
- Reconcile 4.3 "personnummer not captured by default" with the **2026-06-18 owner decision** to store
  personnummer for `private` customers (flagged as R-412, a known plan-vs-code divergence).
- Two standing NFR concerns (no `pnpm audit` CI gate, no coverage reporter) — surfaced to be scheduled or
  formally accepted at this epic's gate rather than silently carried (R-414).

---

## Conclusion

`test-design-epic-4.md` **PASSES** epic-level validation. It is a complete, evidence-backed, risk-based
plan with a correct risk matrix (14 risks, 10 high, arithmetic verified), an appropriately UNIT+GOLDEN
coverage strategy for a pure-logic epic, simple execution strategy, interval-based estimates, and clear
entry/exit/quality gates. The only follow-ups are human sign-off decisions the plan already enumerates —
not gaps in the plan. Recommended next workflow at implementation time: `*atdd` for the P0 UNIT+GOLDEN
scenarios, then `*trace` at the Epic 4 boundary.

**Completed by:** Rasmus (Master Test Architect)
**Date:** 2026-07-02
**Epic:** Epic 4 — Money, Tax, Snapshot Primitives, And Golden Fixtures
**Notes:** Validation only; target artifact left unmodified per validate-mode rules.
