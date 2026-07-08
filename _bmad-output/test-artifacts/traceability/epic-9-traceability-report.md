---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-07-08'
workflowType: testarch-trace
gateType: epic
epicNum: 9
decisionMode: deterministic
coverageBasis: acceptance_criteria
oracleConfidence: high
oracleResolutionMode: formal_requirements
externalPointerStatus: not_used
tempCoverageMatrixPath: 'scratchpad/tea-trace-coverage-matrix-epic9.json'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-9.md (22 risks R-901..R-922; 11 high-priority ≥6; 5 non-negotiable epic controls; P0-P3 coverage plan with case IDs 9.1..9.5-*)
  - _bmad-output/planning-artifacts/epics.md (Epic 9, Stories 9.1-9.5, lines 1755-1938; 15 story ACs)
  - _bmad-output/implementation-artifacts/9-1..9-5 story files (all five `review`; all tasks [x]; Review Findings all resolved/dispositioned; 9.5 Patch findings RESOLVED)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (epic-9 in-progress; 9-1..9-5 review; last_updated 2026-07-08)
  - _bmad-output/test-artifacts/automation-summary-9-{1,2,4,5}*.md + automation-summary.md (9.3) — per-story coverage-expansion records
  - _bmad-output/planning-artifacts/owner-signoff-questions.md (sign-off register system-of-record — the 9.4 blocking-ID source)
  - docs/migration/{legacy-record-classification,migration-runbook,pilot-fallback-cutover,phase-a-acceptance-gate}.md (the four Epic-9 decision/evidence docs under test)
  - tests/support/anonymization-scan.ts + scripts/migration/lovable-capture.ts (9.2 shared scanner + deterministic anonymizer)
  - tests/fixtures/golden/lovable/**.json (8 anonymized oracle fixtures — first old-lovable/documented-delta origins in the repo)
  - tests/unit/fixtures/golden/lovable/*.test.ts (9.2 scanner/shape/loader + 9.3 comparison/delta/guard suites) + tests/unit/docs/*.test.ts (9.1/9.4/9.5 docs-invariant validators + models)
  - LIVE suite state (this run): `pnpm test:unit` = 1371 pass / 0 fail / 0 skipped / 0 todo / 86 suites; epic-9 subset (golden/lovable + docs) = 121 pass / 0 fail / 0 skipped
---

# Traceability Report — Epic 9: Migration, Coexistence, Golden Masters, And Pilot Readiness

**Date:** 2026-07-08
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Gate Type:** Epic-level (Phase 4, epic boundary)
**Decision Mode:** Deterministic (rule-based: P0 100% required / P1 ≥90% PASS · 80–89% CONCERNS / overall ≥80%)
**Coverage Oracle:** formal requirements (Epic 9's 15 story acceptance criteria across Stories 9.1-9.5 mapped
against the 22-risk / 5-control Epic 9 test design's P0-P3 coverage plan) — **high confidence**. The mapping
was verified against **live, executed, in-source tests** — the full unit gate was re-run this session
(1371 pass / 0 fail / 0 skipped), the Epic-9 subset re-run in isolation (121 pass / 0 fail / 0 skipped),
and every test file + fixture + doc confirmed present on disk — not merely inferred from the story records.

---

## Gate Decision: PASS

**Rationale:** P0 coverage is **100%** (8/8 epic-blocker acceptance criteria), P1 coverage is **100%**
(6/6), P2 is **100%** (1/1), so overall coverage is **100%** (16/16 mapped ACs FULL) — above every
deterministic threshold (P0 100% required, P1 ≥90% PASS target, overall ≥80%). All eleven high-priority
Epic 9 risks (score ≥6: R-901..R-911) are mitigated and proven by real, in-source, *executed* tests, and
**every one of the five Non-Negotiable epic controls** in the Epic 9 test design is met and verified against
the actual scanner module, the anonymized fixtures, the live `ReadinessCode` union, the `evaluateCutover`
guard, the `owner-signoff-questions.md` blocking set, and the `deferred-categories.ts` deny-list — not just
the story prose:

1. **Zero real PII / secret / raw-customer-file in any committed fixture, doc, prompt, or log** (R-901/R-902).
   Verified: the shared `anonymization-scan.ts` byte-matches the money-pack authority (not loosened),
   `lovable-privacy-scan.test.ts` scans the DATA payload of all 8 committed Lovable fixtures, and
   `migration-runbook-validators.test.ts` scans the whole `docs/migration/**` tree — all green — and the
   scanner *fires* on seeded personnummer/orgnr/email/SE-phone/secret (`lovable-scanner-unit.test.ts`,
   `acceptance-gate-report-validators.test.ts` PII-scan section), so the control is a live tripwire, not a
   today-is-clean snapshot. A real SAAB orgnr that had leaked into a 9.5 test sample was removed in code
   review (replaced with a non-registered placeholder) — no real orgnr ships in the tree.
2. **No mirage golden** — every comparison code/enum is validated against the real exported `ReadinessCode`
   union at pack build (R-903). Verified: `lovable-shape-guard.test.ts` and `lovable-comparison-guards.test.ts`
   assert every fixture code is a REAL union member; the previously-fictional `REQUIRES_SIGN_OFF` /
   `DEDUCTION_ESTIMATE_UNAPPROVED` codes in `quote-version-source.json` were aligned to the real union as part
   of 9.3, and the quote-snapshot golden consumers stay green.
3. **No false-green / no vacuous-green** (R-909/R-904). Verified: every Epic-9 pin lives under `tests/unit/**`
   (inside the real `pnpm test:unit` glob), 0 `skipped` / 0 `todo` / no `describe.skip` in the live run;
   `evaluateGateHonesty` distinguishes pass / fail / **skipped-with-reason** and rejects a bare `skipped`
   (no reason) even when the report otherwise looks complete; the comparison suites DRIVE the real engine
   (`computeSectionTotal`, `resolveVatDisplayPosture`, `classifyReadiness`, the 6.3 PDF text-extraction path)
   as the new-side oracle and PROVE each documented delta genuinely diverges from the recorded old value.
4. **No cutover on an open blocking assumption** (R-905/R-908). Verified: the `evaluateCutover` guard blocks
   real-pilot cutover AND fallback removal for any workflow with an unresolved blocking item, names every open
   item in `blockedBy`, and keeps the demo track non-blocking; `9.4-REG-01` feeds every LIVE blocking ID from
   `owner-signoff-questions.md` through the guard and proves each blocks real-pilot. The register HONESTLY
   records the open tax sign-offs (VAT rate `A.2`, rounding `A.1`, ROT/grön `B/C`) as **BLOCKING real-pilot
   use** while non-blocking for the demo track (owner demo-data-only decision 2026-07-03) — the gate rewards
   *honest recording of the blockers*, which is present, not their resolution (correctly deferred post-MVP).
5. **No deferred module in implemented scope** (R-910). Verified: `9.5-SCOPE-01` scans the implemented surface
   parametrically over the live `deferred-categories.ts` deny-list (word-boundary, case-insensitive), trips on
   a seeded `fortnox`/`supplier`/… token, and does NOT false-positive on benign tokens that brush short
   category names (`chars`/`threshold`/`assessment`/real table names).

No deterministic threshold is breached; no high-priority risk is unmitigated; no epic-blocker control is open.
**Release approved from the traceability perspective.**

> **Scope note (what PASS means here).** This gate certifies that Epic 9's *evidence machinery* is complete and
> honest: fixtures are private, goldens are real, deltas are classified, gates report truthfully, cutover is
> structurally blocked on open assumptions, and no deferred module leaked in. It does NOT — and by design must
> not — resolve the open owner/accounting/legal tax sign-offs. Those remain recorded as **blocking real-pilot
> cutover** in the 9.4 register (non-blocking for the demo track). Real-customer cutover still requires the
> owner sign-off session; the demo pilot proceeds. This split is the intended Phase A landing.

---

## Coverage Summary

- **Total mapped requirements (story ACs):** 16 *(15 story ACs; 9.2-AC1 carries two obligations — business-shape
  preservation AND PII removal — but is scored as one FULL AC. The 16th row is the PII-removal obligation broken
  out where the design tracks it as its own P0 control; both arms are green.)*
- **Fully covered (FULL):** 16 (**100%**)
- **Partially covered (PARTIAL):** 0
- **Uncovered (NONE):** 0
- **P0 coverage:** 8/8 (**100%**)
- **P1 coverage:** 6/6 (**100%**)
- **P2 coverage:** 1/1 (**100%**)
- **P3 coverage:** n/a (P3 test-design rows — path-convention, evergreen-doc anchors, non-gating PDF visual — are
  hygiene/monitoring items folded into the P0/P1 validators; no standalone P3 AC)
- **Live test evidence:** full unit gate **1371 pass / 0 fail / 0 skipped / 0 todo** (86 suites); Epic-9 subset
  **121 pass / 0 fail / 0 skipped** (re-run this session)

---

## Traceability Matrix (Requirement → Test)

| Req (Story · AC) | Priority | Requirement | Coverage | Level | Mapped tests (executed) | Risk |
| ---------------- | -------- | ----------- | -------- | ----- | ----------------------- | ---- |
| 9.1-AC1 | P1 | Classify records live/archive-only/excluded/deferred; deferred never → Phase A table/UI | FULL | Unit | `migration-runbook-validators.test.ts` (9.1-CLASS-01: 4 buckets present; every DEFERRED → `none — deferred`; every LIVE target ∈ real 24 `TENANT_TABLES`) | R-907 |
| 9.1-AC2 | P1 | Runbook: source · treatment · fallback · backfill-risk · cutover-by-workflow | FULL | Unit | `migration-runbook-validators.test.ts` (9.1-RUNBOOK-01: all six Phase A workflows carry every field non-empty; cutover per-workflow) | R-907/R-908 |
| 9.1-AC3 | P1 | STOP for owner clarification when scope unclear (no silent extra-history import) | FULL | Unit | `migration-runbook-validators.test.ts` (9.1-STOP-01: fail-closed STOP protocol present; 8.1/8.2 owner-gated slots STOP-marked) | R-907 |
| 9.2-AC1 (shape) | P0 | Fixtures preserve business shape across all nine categories | FULL | Unit | `lovable-shape-guard.test.ts` (9.2-SHAPE-01: structured per-category shape match; load-bearing structure guard; over-anonymization fails loud) | R-911 |
| 9.2-AC1 (privacy) | P0 | Real names/emails/phones/addresses/personnummer/orgnr/secrets/raw files removed or replaced | FULL | Unit | `lovable-privacy-scan.test.ts` (9.2-PRIV-01/02 over all 8 fixture DATA payloads) + `lovable-scanner-unit.test.ts` + `lovable-capture-anonymizer-unit.test.ts` (deterministic anonymizer, secret-drop at depth) | R-901/R-914 |
| 9.2-AC2 | P1 | Capture scripts local/test-oriented, documented, repeatable, no global changes; fixture round-trips | FULL | Unit | `lovable-loader-roundtrip.test.ts` (9.2-REPEAT-01) + `lovable-capture-script.test.ts` + `lovable-capture-anonymizer-unit.test.ts` (module composition: capture output passes the shared scanner) | R-918 |
| 9.2-AC3 | P0 | Committed-fixture privacy checks FAIL on obvious real PII/secret patterns | FULL | Unit | `lovable-privacy-scan.test.ts` + `lovable-scanner-unit.test.ts` (seeded personnummer/orgnr/email/phone/address/secret each fires; `@example.test` not flagged; ORGNR string-leaf hardening — numeric öre does NOT trip, string orgnr DOES) | R-901/R-914 |
| 9.3-AC1 | P0 | Comparisons cover all nine categories (calc totals, VAT/tax, options/tillval, hidden rows, quote-visible lines, PDF text/visual, attachment selection, acceptance transition, accepted price, job source refs) driving the REAL engine | FULL | Unit | `lovable-comparison-calc-quote-pdf.test.ts` (9.3-CMP-01/02: real `computeSectionTotal`/`resolveVatDisplayPosture`; 6.3 PDF text path with non-empty `mustNotAppear`) + `lovable-comparison-acceptance-job.test.ts` (9.3-CMP-03: 7.2 accept→job + accepted-price delta) + `lovable-comparison-guards.test.ts` (9.3-VALID-01: real `ReadinessCode` union) | R-903/R-904/R-912 |
| 9.3-AC2 | P0 | Every delta classified expected-simplification/bug/unresolved-assumption + non-empty note; documented-delta carries divergent old value (number \| classification-code) | FULL | Unit | `lovable-comparison-delta-classification.test.ts` (9.3-DELTA-01: widened LABELLING guard) + `lovable-comparison-classification-deltas.test.ts` (drives real oracle to PROVE new value diverges from recorded old: VAT posture, quote-rounding 16666-vs-16667, job status created-vs-open) | R-906/R-913 |
| 9.3-AC3 | P1 | Integration cases touching tenant data/files include two-tenant RLS/storage negatives where applicable | FULL (satisfied-by-non-applicability) | Integration | The 9.3 harness is pure-unit over anonymized static fixtures — it touches NO tenant-owned table or storage object, so no DB-backed comparison case was authored → SKIPPED-WITH-REASON (documented, per test-design "Integration only where a comparison touches tenant data/files"). The standing Epics 2-8 RLS/storage negative harness (`cross-tenant-isolation.rls`, `storage-object-isolation.rls`, `TENANT_TABLES` H4 gate) remains green and unaffected. | R-915 |
| 9.4-AC1 | P2 | Runbook documents old-app fallback, cutover-by-workflow, backfill risks, rollback decision points | FULL | Unit | `sign-off-register-validators.test.ts` (9.4-FALLBACK-01: docs-structure validators over `pilot-fallback-cutover.md`; per-workflow fallback/cutover/rollback sections) | R-908 |
| 9.4-AC2 | P1 | Register marks quote numbering/sent semantics/acceptance channels/adjusted-price/required files/VAT/ROT/grön/rounding/terms/tax wording signed-off or blocking; every blocking ID mapped to a decision status | FULL | Unit | `sign-off-register-validators.test.ts` (9.4-REG-01: reads blocking IDs LIVE from `owner-signoff-questions.md`; all 8 live-blocking IDs present; register↔model consistency) | R-917 |
| 9.4-AC3 | P0 | Checklist BLOCKS real-pilot cutover for any workflow with an unresolved blocking assumption; demo non-blocking; also blocks fallback removal | FULL | Unit | `sign-off-register-validators.test.ts` (9.4-BLOCK-01: multi-item `blockedBy`, R-908 cutover+fallback symmetry, clean-workflow no-phantom-block, demo totality with 8 open items, input purity) + `sign-off-checklist-model.ts::evaluateCutover` | R-905/R-908 |
| 9.5-AC1 | P0 | Report summarizes all Phase A gates + skipped-gates-with-reasons; distinguishes pass/fail/skipped-with-reason; fails on a skipped mandatory gate without a reason | FULL | Unit | `acceptance-gate-report-validators.test.ts` (9.5-GATE-01/EVID-01: `evaluateGateHonesty` full status vocabulary + `invalidStatus`; `parseReportedGates` extracts real §2 gate rows; reason is load-bearing) | R-909/R-916 |
| 9.5-AC2 | P0 | Scope scan confirms NO deferred module leaked in AND trips on a seeded deferred token | FULL | Unit | `acceptance-gate-report-validators.test.ts` (9.5-SCOPE-01: parametric over live `deferred-categories.ts` deny-list; word-boundary; case-insensitive `/Fortnox`, `HR_Report`, `SUPPLIER_APIS`; benign-token no-false-positive) | R-910/R-903 |
| 9.5-AC3 | P1 | Report lists unresolved stop conditions with owner/accounting/legal/security decision owners; blocks real pilot use where required; no drift vs register blocking IDs | FULL | Unit | `acceptance-gate-report-validators.test.ts` (9.5-READY-01: `registerBlockingIds` now captures the dotted `A.1`/`A.2`/`B.1-B.4`/`C.1-C.3` money/tax families; `reconcileReadinessBlocking` asserts 1:1 no-drift + a seeded-drop negative fails) | R-920 |

---

## Coverage Heuristics (blind-spot scan)

- **Endpoint coverage:** N/A — Epic 9 ships NO new API/route/HTTP surface (evidence/decision epic). 0 endpoints
  without tests.
- **Auth/authz negative-path coverage:** N/A for net-new surface (no new endpoint). The one place tenant
  isolation is in scope (9.3-AC3) is satisfied-by-non-applicability because the harness touches no tenant data;
  the standing cross-tenant/anon/spoof RLS/storage negatives (Epics 2-8) remain green. 0 auth negative-path gaps.
- **Error-path / negative coverage:** STRONG — this epic's tests are dominated by negative/tripwire assertions
  (seeded PII must fire the scan, a bogus `ReadinessCode` must fail the pack, a bare `skipped` gate must fail
  the honesty model, a seeded deferred token must trip the scope scan, an open blocking item must block cutover,
  a dropped register-blocking ID must fail reconciliation). No requirement is happy-path-only. 0 happy-path-only
  criteria.

---

## Gaps & Recommendations

**No coverage gaps.** All 16 mapped ACs are FULL; all eleven ≥6 risks mitigated; all five non-negotiable epic
controls verified against real, executed tests.

**Advisory (non-blocking) — carried in the deferred-work ledger, none gate this epic:**
1. **Register-traceability strictness (two deferred Lows, 9.4/9.5).** The register validators assert *substring
   presence in the register slice*, not a structural *decision-status row / owning-ID / owner / workflow column*
   per item. It passes correctly today (auditor-verified every blocking ID lives in the §4 register with a
   status), and 9.5's `registerBlockingIds` regex was hardened in code review to capture the dotted money/tax
   families. The residual is test-hardening (would only be exposed by a future authoring edit), not a
   deliverable defect. Optionally tighten to a per-row structural assertion post-MVP.
2. **PII-scan file-set.** The whole-directory automated PII scan covers `docs/migration/**` + committed fixtures;
   seeded PII *samples* under `tests/unit/**` are outside its file-set (they are intentional negative-control
   inputs). The code review already removed a real orgnr from one such sample; optionally extend the scan's
   file-set to seeded samples as belt-and-braces.

**Next actions:**
- `test-review` (Epic-9 validator quality) — scheduled at the epic boundary.
- `nfr` (Epic-9 NFR audit: security/reliability of the fixture-privacy + comparison + gate machinery) — scheduled.
- No `atdd` / `automate` remediation required (0 P0/P1 gaps).

---

## Gate Decision Summary

🚨 **GATE DECISION: PASS**

📊 Coverage Analysis:
- P0 Coverage: **100%** (8/8) — Required 100% → **MET**
- P1 Coverage: **100%** (6/6) — PASS target 90%, minimum 80% → **MET**
- Overall Coverage: **100%** (16/16) — Minimum 80% → **MET**

✅ Rationale: P0 at 100%, P1 at 100% (≥90% PASS target), overall at 100% (≥80%); all eleven high-priority
(≥6) risks mitigated and proven by executed in-source tests; all five non-negotiable epic controls
(privacy / no-mirage-golden / no-false-green / no-cutover-on-open-assumption / no-deferred-module) verified
against the real scanner, fixtures, live `ReadinessCode` union, `evaluateCutover` guard, the live blocking-ID
set, and the `deferred-categories.ts` deny-list. Live unit gate 1371 pass / 0 fail / 0 skipped.

⚠️ Critical Gaps: **0**

📝 Recommended Actions: proceed to `test-review` + `nfr` epic-boundary gates; no coverage remediation needed.

✅ **GATE: PASS — release approved from the traceability perspective, coverage meets standards.** The open
owner/accounting/legal tax sign-offs are correctly recorded as **blocking real-pilot cutover** (non-blocking
for the demo track) and are NOT resolved by this gate — that split is the intended Phase A landing.

📂 Coverage matrix (temp): `scratchpad/tea-trace-coverage-matrix-epic9.json`

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-trace` (epic-level, Phase 4 epic boundary)
**Version:** 4.0 (BMad v6)
