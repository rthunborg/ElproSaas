---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-07-19'
workflowType: testarch-trace
gateType: epic
epicNum: 10
decisionMode: deterministic
coverageBasis: acceptance_criteria
oracleConfidence: high
oracleResolutionMode: formal_requirements
externalPointerStatus: not_used
tempCoverageMatrixPath: 'scratchpad/tea-trace-coverage-matrix-epic10.json'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-10.md (25 risks R-1001..R-1050; 8 high-priority ≥6; P0-P3 coverage plan with case IDs 10.1..10.4-* + 10.x; 8 epic-blocker non-negotiables)
  - _bmad-output/planning-artifacts/epics-phase-b.md (Epic 10, Stories 10.1-10.4; FR62-65, FR129/FR130)
  - _bmad-output/implementation-artifacts/10-1..10-4 story files (all four `review`; all tasks [x]; Review Findings all resolved/dispositioned; one 10.4 Defer[Low] explicitly forward-scoped)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (epic-10 in-progress; 10-1..10-4 review; last_updated 2026-07-19)
  - src/scope/manifest.ts + src/scope/manifest-schema.ts + src/scope/nav-registry.ts (the 10.1 governance keystone under test)
  - supabase/migrations/20260719120000_quote_lost_reasons_and_lost_status.sql + 20260719130000_quote_follow_ups.sql (the two new tenant tables)
  - src/server/read-models/{quote-pipeline-aggregate,entitlements,quote-pipeline}.ts (the first read-model module)
  - tests/unit/scope/**, tests/unit/{features/quotes,server/commands,server/read-models,components/quotes}/**, tests/integration/{commands,rls,features/quotes,components}/**, tests/e2e/quotes/** (epic-10 suites, verified present on disk)
  - LIVE suite state (this run, DB-free pure-unit subset): epic-10 unit subset = 137 pass / 0 fail / 0 skipped; 10.1 keystone (coherence + derivations + governance re-baseline) = 18 pass / 0 fail / 0 skipped. INT (782/782) + quote E2E (40/40) green per dev records (local Supabase stack; SUPABASE_TEST_REQUIRED=1 in CI).
---

# Traceability Report — Epic 10: Quote Lifecycle Completion (+ Phase B Governance Re-Baseline)

**Date:** 2026-07-19
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Gate Type:** Epic-level (Phase 4, epic boundary; first Phase B epic)
**Decision Mode:** Deterministic (rule-based: P0 100% required / P1 ≥90% PASS · 80–89% CONCERNS / overall ≥80%)
**Coverage Oracle:** formal requirements — Epic 10's **17 story acceptance criteria** across Stories 10.1-10.4
mapped against the 25-risk / 8-high-priority Epic 10 test design's P0-P3 coverage plan — **high confidence**.
The mapping was verified against **live, in-source, present-on-disk tests**: the epic-10 pure-unit subset was
re-run this session (137 pass / 0 fail / 0 skipped), the 10.1 governance keystone re-run in isolation
(18 pass / 0 fail / 0 skipped, each coherence-validator negative proven to *fire* and each derivation proven
byte-equal to its independent authored ground truth), every test file confirmed present, and the two "residual
skip" hits confirmed to be **stale RED-phase header comments + the standard `skipUnlessStack` reachability
gate**, not statically-skipped suites (the real `describe`/`test.describe` calls are labeled "GREEN —
implemented"). INT/RLS/E2E coverage (which needs the local Supabase stack) is taken green from the story dev
records (INT 782/782, quote E2E 40/40) — the record, not merely inferred prose.

---

## Gate Decision: PASS

**Rationale:** P0 coverage is **100%** (9/9 epic-blocker acceptance criteria), P1 coverage is **100%** (6/6),
P2 is **100%** (2/2) — so overall coverage is **100%** (17/17 mapped ACs FULL), above every deterministic
threshold (P0 100% required, P1 ≥90% PASS target, overall ≥80%). All **eight** high-priority Epic 10 risks
(score ≥6: R-1001, R-1002, R-1003, R-1010, R-1011, R-1012, R-1040, R-1041) are mitigated by real, in-source
tests, and **every one of the eight Non-Negotiable epic-blocker controls** in the Epic 10 test design is met
and verified against the actual manifest module, the two new migrations, the read-model source, and the
executed suites — not just the story prose:

1. **Governance no-drift + fail-loud retained (R-1001/R-1003).** Verified live: `manifest-derivations.test.ts`
   proves each of the four derivations equals an INDEPENDENT authored ground truth (deny-list == pinned 7
   tokens; nav registry == authored `nav-items.ts` hrefs; `TENANT_TABLES` == the pinned active-module union,
   now **26** after the 10.2/10.3 enrolments; deferred-token scan) — never derived==derived — and DERIVE-06
   proves an unlisted surface is NOT silently admitted (fail-loud preserved, FR129/FR130).
2. **Coherence validator proven able to fail on each incoherent state (R-1002, the "A22" lesson).** Verified
   live: `manifest-coherence.test.ts` COH-01..05 each INTRODUCE an incoherent state (active-without-epic;
   orphan nav/table; pending-module-with-live-surface; public-surface union > 3) and assert it is FLAGGED;
   COH-00 proves the real manifest coherent; COH-06 pins the EB-A5 matrix-rule carve-out (wired at 11.1).
3. **Re-baseline landed in one ADR-backed change.** Verified: `AGENTS.md` now declares "Phase B / Legacy
   Parity Release", points scope enforcement at `src/scope/manifest.ts`, and carries the Phase C ledger as
   the deferred set; `governance-rebaseline.test.ts` DOCS-01..05 pin the phase statement, the manifest
   pointer, the `phase-scope-reviewer` (both `.claude` + `.codex`) manifest baseline, the `CLAUDE.md` row,
   and the Stop-Condition guard that the deny set was NOT weakened.
4. **Sent-immutability preserved under the lost path (R-1010, NFR11/FR63).** 10.2-INT-01 re-runs the existing
   Epic 6/7 sent-immutability regression suite (green) and adds a before/after read of every customer-visible
   + PDF-source column; 10.2-INT-02 proves `mark_quote_version_lost` flips ONLY `status` + appends one
   `quote_events` row + inserts exactly one `quote_lost_reasons` row; the direct own-tenant `UPDATE` negative
   still returns `QUOTE_VERSION_LOCKED`.
5. **Lifecycle state-machine coherent across all layers (R-1011).** The single new `lost` token is widened
   from one source; 10.2-UNIT-01 (`lost-transition-coherence.test.ts`) pins the widened `LEGAL_TRANSITIONS`
   map + the CHECK-set tokens + the `QuoteVersionStatus` union; 10.2-INT-03 proves an illegal lost transition
   is rejected at BOTH the command (`VALIDATION_FAILED`) and the DB belt.
6. **Both new tenant tables isolated + enrolled (R-1012/R-1031).** `quote_lost_reasons` is insert-only
   (SELECT+INSERT policies/grants only; own-tenant UPDATE→42501; `unique (quote_version_id)`);
   `quote_follow_ups` is UPDATE-able with the one-open partial unique index. Both enrolled in
   `src/scope/manifest.ts` + `TENANT_TABLES` (H4 gate; derived union 24→25→26) with cross-tenant + anon
   negatives (RLS suites + migration-reset per-policy enumeration).
7. **First read-model sets the correct precedent (R-1040/R-1041).** 10.4-UNIT-01 pins the `{ data,
   entitlements }` descriptor (a withheld money leaf is ABSENT from `data` AND listed in
   `entitlements.withheld`, never `null`/`0`; aggregate honesty; conservative `tenant_admin` default);
   10.4-INT-01 proves the read-model queries via the RLS client ONLY with a genuine cross-tenant proof (B's
   seeded ids absent from A's list, A's present) and a structural no-service-role-import assertion. Amounts
   are integer-öre sums via `@/lib/money` only — no new money path.
8. **No real PII/secret in any new fixture (R-1015).** The standing `anonymization-scan.ts` control was
   widened during 10.2 review to cover `tests/fixtures/golden/quotes/**` (the `lost-lifecycle.json` fixture);
   10.3/10.4 follow-up + pipeline fixtures are anonymized shape-only.

**No new nav item / widget / analytics page / email-send path** (PB-D7) is guardrail-asserted by
10.4-INT-03 + the manifest `widgets: []` / single-`/quotes`-nav derivation. **R-1046 (the N-4 entitlement
seed) is a flagged conservative default, NOT owner-confirmed** — restated below so the owner-confirm trigger
stays visible (test-design exit criterion).

---

## Coverage Summary

| Priority | Total ACs | FULL | PARTIAL | NONE | Coverage |
| --- | --- | --- | --- | --- | --- |
| **P0** (governance integrity / commitment immutability / isolation / read-model precedent) | 9 | 9 | 0 | 0 | **100%** |
| **P1** (reason/follow-up workflow, aggregation, list filters) | 6 | 6 | 0 | 0 | **100%** |
| **P2** (rendering consistency, non-scope guard) | 2 | 2 | 0 | 0 | **100%** |
| **P3** | 0 | — | — | — | n/a |
| **Total** | **17** | **17** | **0** | **0** | **100%** |

**Coverage heuristics (blind-spot scan):** endpoints without tests = **0** (server commands + read-model
covered by INT/RLS, not REST endpoints); auth/authz missing negative paths = **0** (cross-tenant + anon
negatives per new table; insert-only UPDATE-rejected; illegal transition rejected at command AND DB;
read-model RLS-client-only + structural no-service-role assertion); happy-path-only criteria = **0**
(validation negatives, concurrent duplicate-reason double-submit, one-open rejection with clear message,
error-banner-visibility regression, month-end/leap period boundaries all covered).

---

## Traceability Matrix (requirement → tests)

### Story 10.1 — Phase B Governance Re-Baseline and Scope Manifest

| AC | Requirement | Pri | Coverage | Tests (test IDs → files) |
| --- | --- | --- | --- | --- |
| 10.1-AC1 | Re-baseline governance docs to Phase B in one ADR-backed change (`AGENTS.md`, `docs/process`, `phase-scope-reviewer`) | P0 | **FULL** | 10.1-DOCS-01..05 (`tests/unit/scope/governance-rebaseline.test.ts`); phase-scope-reviewer manifest baseline; `AGENTS.md`/`CLAUDE.md` verified on disk |
| 10.1-AC2 | Typed `src/scope/manifest.ts` (`satisfies ScopeManifest`; Phase A `active` seed 7 nav / 24 tables / 7 owner types under wave A; Phase B `pending`) | P0 | **FULL** | 10.1-UNIT-04 SHAPE (`manifest-shape.test.ts`, `manifest-schema-selectors.test.ts`) |
| 10.1-AC3 | Four guardrail derivations derive from the manifest, proven zero drift + fail-loud retained | P0 | **FULL** | 10.1-UNIT-02 DERIVE-01..05 derived==independent-authored; 10.1-UNIT-03 DERIVE-06 fail-loud (`manifest-derivations.test.ts`); H4 inventory gate (DB) |
| 10.1-AC4 | Coherence validator — fails on each incoherent state (presence AND coherence) | P0 | **FULL** | 10.1-UNIT-01 COH-00..06 (`manifest-coherence.test.ts`); cross-module uniqueness (`manifest-invariants.test.ts`) |

### Story 10.2 — Förlorad/Avböjd Status and Lost-Reason Lifecycle

| AC | Requirement | Pri | Coverage | Tests |
| --- | --- | --- | --- | --- |
| 10.2-AC1 | `Markera som förlorad/avböjd` dialog — outcome + structured reason (note required on `Annat`) | P1 | **FULL** | 10.2-UNIT-02 (`mark-lost-validation.test.ts`); 10.2-E2E-01 (`quote-lost-reason.e2e.spec.ts`) |
| 10.2-AC2 | Lost flip — append-only lifecycle + exactly one reason row + terminal badge distinct from Accepterad | P0 | **FULL** | 10.2-INT-02 mutate-only-status (`mark-quote-version-lost.int.test.ts`); 10.2-UNIT-01 5-layer coherence (`lost-transition-coherence.test.ts`); 10.2-INT-03 illegal transition rejected command+DB; 10.2-GOLDEN-01 (`lost-version-golden.test.ts`) |
| 10.2-AC3 | Sent-immutability invariant preserved — regression suite re-run green (NFR11/FR63) | P0 | **FULL** | 10.2-INT-01 re-run Epic 6/7 sent-immutability suite + before/after PDF-source column read + mutate-only-status |
| 10.2-AC4 | Quote list gains Förlorad/Avböjd status filter value + Förlustorsak column | P1 | **FULL** | 10.4-INT-02 status filter incl. lost + Förlustorsak column (`quote-pipeline-list-filters.int.test.ts`); 10.2-E2E-01 list surfacing |
| 10.2-AC5 | Cross-tenant isolation — insert-only enforced, `TENANT_TABLES` enrolment, H4 green | P0 | **FULL** | 10.2-RLS-01 insert-only UPDATE-rejected + cross-tenant/anon (`quote-lost-reasons.rls.test.ts`); 10.2-INT-04 per-policy (`quote-lost-reasons-migration-reset.int.test.ts`); 10.2-INT-06 cross-tenant; 10.2-INT-05 concurrent duplicate-reason |

### Story 10.3 — Quote Follow-Up Workflow

| AC | Requirement | Pri | Coverage | Tests |
| --- | --- | --- | --- | --- |
| 10.3-AC1 | Plan a follow-up + at-most-one-open-per-quote partial unique index (clear message, not raw DB error) | P1 | **FULL** | 10.3-INT-01 one-open positive+negative + new-open-after-complete (`quote-follow-ups.int.test.ts`); 10.3-UNIT validation (`follow-up-validation.test.ts`) |
| 10.3-AC2 | Quote-list `Har uppföljning` / `Försenad uppföljning` filters + overdue escalation (Europe/Stockholm boundary) | P1 | **FULL** | 10.3-UNIT-01 due/overdue date logic (`follow-up-dates.test.ts`); 10.3-UNIT-02 chip selection (`follow-up-view.test.ts`); 10.3-E2E-01 (`quote-follow-up.e2e.spec.ts`); 10.4-INT-02 filters |
| 10.3-AC3 | Complete-with-outcome + decide-here jumps + auto-complete-on-lost from the follow-up surface | P1 | **FULL** | 10.3-INT-03 complete + auto-complete-on-lost (`quote-follow-ups.int.test.ts`); 10.3-E2E-01; error-banner visibility regression (`follow-up-error-visibility.test.ts`) |
| 10.3-AC4 | Cross-tenant isolation + manifest/H4 enrolment (union 25→26) | P1 | **FULL** | 10.3-INT-02 per-policy (`quote-follow-ups-migration-reset.int.test.ts`); 10.3-RLS-01 cross-tenant + anon (`quote-follow-ups.rls.test.ts`) |

### Story 10.4 — Pipeline Surfacing and Dashboard Read-Model

| AC | Requirement | Pri | Coverage | Tests |
| --- | --- | --- | --- | --- |
| 10.4-AC1 | Pipeline read-model `{ data, entitlements }` contract + entitlement mechanism (event-sourced counts/hit-rate, öre aggregate, withheld absent+listed, aggregate honesty, conservative `tenant_admin` default) | P0 | **FULL** | 10.4-UNIT-01 descriptor (`entitlements.test.ts`); 10.4-UNIT-02 counts/hit-rate/empty/period/month-end/leap (`quote-pipeline-aggregate.test.ts`) |
| 10.4-AC2 | List/detail render consistently + 10.3 bespoke follow-up tones folded into the `status.ts` authority | P2 | **FULL** | 10.4-UNIT tone authority (`follow-up-tone.test.ts`); 10.4-E2E-01 (`quote-pipeline-consistency.e2e.spec.ts`) |
| 10.4-AC3 | No new analytics surface — no nav item / widget / analytics page / email-send path (PB-D7) | P2 | **FULL** | 10.4-INT-03 non-scope guard (`quote-pipeline-non-scope-guard.int.test.ts`); manifest `widgets: []` / nav derivation guardrail (`manifest-derivations.test.ts`) |
| 10.4-AC4 | Read-model isolation floor — RLS-client-only, cross-tenant proof, no service-role import | P0 | **FULL** | 10.4-INT-01 cross-tenant proof + structural no-service-role grep (`quote-pipeline-read-model.rls.test.ts`) |

---

## Gaps & Recommendations

**Coverage gaps: NONE.** No P0/P1/P2 acceptance criterion is uncovered, partial, or unit-only where an
integration/DB/E2E layer is required; no endpoint, auth-negative-path, or error-path heuristic blind spot was
found. No `URGENT` or `HIGH` remediation action is generated.

**Visible residuals (governance/forward-scope, NOT coverage gaps — do not block the gate):**

1. **R-1046 — N-4 entitlement seed is a flagged conservative default, not owner-confirmed.** 10.4 ships the
   withholding *mechanism* with `tenant_admin ⇒ money-entitled ⇒ withheld: []`; the per-role matrix is
   Epic 11 (`[gated: N-4]`, DECISION 3 / 10.4-DOCS-01). **Owner action:** re-confirm the seed at the owner
   gate before role-aware money withholding activates in Epic 11. Restated here per the test-design exit
   criterion so the trigger stays visible.
2. **10.4 Defer[Low] — dependency-aware aggregate-honesty helper.** The current withhold-list is a flat leaf
   delete (correct + complete for the single money leaf today); genuine leaf→aggregate dependency modeling is
   deferred to the first *multi-component* Phase-B read-model where it is exercisable/testable
   (`entitlements.ts:93`). Not a today gap.
3. **10.1 Defer[Low] — `tenantTablesFromManifest` platform-scope filter seam.** No active platform-scoped
   module carries tables in 10.1; add the scope filter when the first platform table lands at E12 activation.
4. **Pre-existing, unrelated Windows-only unit failure.** The Story 9.2 Lovable golden fixture
   (`acceptance.json`) byte-compare fails only on a local `core.autocrlf=true` Windows checkout; the committed
   blob is pure LF and the fixture is `eol=lf`-pinned, so CI (Linux/LF) is green. Zero overlap with Epic 10
   (no golden fixture touched). Not an Epic 10 coverage gap.

**Next actions:**

- **LOW:** run `/bmad:tea:test-review` to assess test *quality* (this trace assesses coverage). All four
  stories already passed adversarial code review with every Critical/High finding resolved.
- **OWNER:** carry R-1046 into the epic-boundary owner review (N-4 seed re-confirmation).

---

## Gate Decision Summary

```
🚨 GATE DECISION: PASS

📊 Coverage Analysis:
- P0 Coverage: 100% (Required: 100%)        → MET
- P1 Coverage: 100% (PASS target: 90%)      → MET
- Overall Coverage: 100% (Minimum: 80%)     → MET

✅ Decision Rationale:
P0 coverage is 100% (9/9 epic-blocker ACs), P1 coverage is 100% (6/6, above the 90% PASS target),
and overall coverage is 100% (17/17 mapped ACs FULL, above the 80% minimum). All 8 high-priority
(score ≥6) risks and all 8 Non-Negotiable epic-blocker controls are met and verified against
in-source, executed tests (pure-unit subset re-run live: 137 pass / 0 fail / 0 skipped; 10.1
keystone 18/18 with each validator negative proven to fire).

⚠️ Critical Gaps: 0     High Gaps: 0     Medium Gaps: 0

📝 Visible residuals (not gaps): R-1046 N-4 seed owner re-confirm (Epic 11);
   two Low forward-scoped Defers; one pre-existing unrelated Windows-only unit failure.

✅ GATE: PASS — coverage meets every deterministic threshold; epic clears the traceability gate.
```
