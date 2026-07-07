---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-07-07'
workflowType: testarch-trace
gateType: epic
epicNum: 7
decisionMode: deterministic
coverageBasis: acceptance_criteria
oracleConfidence: high
oracleResolutionMode: formal_requirements
externalPointerStatus: not_used
tempCoverageMatrixPath: 'scratchpad/tea-trace-coverage-matrix-epic7.json'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-7.md (19 risks R-701..R-719; 11 high-priority ≥6; 5 non-negotiable epic blockers; full P0-P3 test-ID coverage plan)
  - _bmad-output/planning-artifacts/epics.md (Epic 7, Stories 7.1-7.4; FR41-FR48; AR20-AR21)
  - _bmad-output/implementation-artifacts/7-1..7-4 story files (all Status: review; all tasks [x]; 21 ACs across 4 stories)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (epic-7 in-progress; 7-1..7-4 all review; last_updated 2026-07-07)
  - supabase/migrations/20260709120000_acceptance_to_job_model.sql (quote_acceptances/jobs/job_events tables + RLS + composite same-tenant FKs + uniqueness backstops + öre columns)
  - supabase/migrations/20260710120000_accept_quote_and_create_job.sql (narrow ADR-A009 transactional RPC; explicit accepted_at/command ts)
  - supabase/migrations/20260711120000_accepted_record_lock.sql (accepted-immutability triggers: quote_acceptances_accepted_lock, jobs_source_ref_lock)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES — quote_acceptances/jobs/job_events enrolled; quote_events already enrolled Epic 6; cross-tenant + anon-path metadata per table)
  - tests/integration/rls/{acceptance-tables-migration-reset,cross-tenant-isolation,anon-path-isolation,rls-inventory-gate}.* (migration reset + shared inventory-driven RLS negatives + H4 gate)
  - tests/integration/commands/{accept-quote-and-create-job,capture-quote-acceptance,acceptance-evidence-link,accepted-record-lock,job-source-of-truth,update-job}.int.test.ts
  - tests/integration/features/jobs/job-read-mapping.int.test.ts
  - tests/unit/features/quotes/{acceptance-price,accept-quote-to-job-golden}.test.ts ; tests/unit/guardrails/{acceptance,job}-non-scope.test.ts ; tests/unit/server/commands/{accept-and-create-job-*,capture-quote-acceptance-validation,command-errors-acceptance-conflict,job-write-error-mapping,quote-write-error-mapper,update-job-validation}.test.ts
  - tests/unit/lib/money/golden-pack.test.ts (extended PII/ORGNR privacy scan over accepted-price-deltas.json — R-717/R-411 lineage)
  - tests/e2e/quotes/{quote-acceptance-capture,quote-accept-create-job}.e2e.spec.ts ; tests/e2e/jobs/{job-traceability,job-list-deferred-surface,job-accepted-lock}.e2e.spec.ts
  - src/server/commands/quotes/** ; src/features/jobs/** ; src/features/quotes/acceptance-price.ts
  - _bmad-output/test-artifacts/automation-summary-7-2/7-3/7-4-*.md (recorded results: unit 1126 pass / 0 fail; full INT 56 files / 641 tests / 0 fail; accepted-record-lock 31 pass on live stack)
  - src/server/commands/command-errors.ts (COMMAND_CONFLICT reserved; ACCEPTED_RECORD_LOCKED / acceptance-conflict codes live)
---

# Traceability Report — Epic 7: Acceptance-To-Job Transaction

**Date:** 2026-07-07
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Gate Type:** Epic-level (Phase 4, epic boundary)
**Decision Mode:** Deterministic (rule-based: P0 100% required / P1 ≥90% PASS · 80–89% CONCERNS / overall ≥80%)
**Coverage Oracle:** formal requirements (Epic 7's 21 story acceptance criteria across Stories 7.1-7.4 +
the 19-risk / 5-blocker Epic 7 test design's P0-P3 coverage plan) — **high confidence** (formal,
non-synthetic; active in-source test cases verified against the real migrations, the `TENANT_TABLES`
RLS inventory, the transactional RPC + immutability triggers, and the test source — not merely the
story records).

---

## Gate Decision: PASS

**Rationale:** P0 coverage is **100%** (15/15 epic P0 requirement groups) and P1 coverage is **100%**
(8/8), so overall coverage is **100%** (23/23 mapped requirement groups FULL) — above every
deterministic threshold (P0 100% required, P1 ≥90% PASS target, overall ≥80%). All eleven
high-priority Epic 7 risks (score ≥6: R-701..R-710, R-717) are mitigated and proven by real,
in-source, active tests, and **every one of the five Non-Negotiable epic blockers** in the Epic 7
test design is met and verified against the actual migrations, the RLS inventory, the RPC/trigger
definitions, and the test source:

1. **Every new commitment table (`quote_acceptances` / `jobs` / `job_events`) has a direct `tenant_id`
   + enable+**force** RLS + own-tenant `is_tenant_admin` policies + `anon → none` GRANT, and is
   ENROLLED in `TENANT_TABLES`** — R-701. Verified: `20260709120000_acceptance_to_job_model.sql`
   creates all three with composite same-tenant parent FKs; `tenant-table-inventory.ts` enrolls all
   three (plus the reused Epic-6 `quote_events`) with cross-tenant + anon metadata; the H4
   inventory-gate test (`rls-inventory-gate.int.test.ts`) fails CI on any unenrolled tenant table by
   design; migration-reset (`acceptance-tables-migration-reset.int.test.ts`, all `describe.skip`
   removed → green) proves the schema/policy/öre/uniqueness contract per table.
2. **No duplicate acceptance or duplicate job is creatable on retry / double-submit / concurrency** —
   R-702. Verified: DB uniqueness constraints (`quote_acceptances.unique(quote_version_id)`,
   `jobs.unique(quote_acceptance_id)`) + row-locking narrow RPC (`accept_quote_and_create_job`,
   `20260710120000`); `7.2-INT-02` (retry returns existing ids, no second row), `7.2-INT-03` (direct
   second insert violates the DB constraint), `7.2-INT-06` (two parallel `Promise.all` accepts ⇒
   exactly one job, sleep-free), `7.2-INT-08` (closed-transition idempotency edges) — all present.
3. **No partial acceptance/job state survives a mid-transaction failure** (NFR20) — R-703. Verified:
   `7.2-INT-04` injects a mid-transaction fault at step boundaries and asserts the end state is empty
   (no acceptance, no lifecycle change, no job, no event) — a behavioral rollback proof below the
   command layer, not a field-exists check.
4. **Accepted immutable fields are immutable at BOTH the command AND the DB layer** — R-704. Verified:
   `20260711120000_accepted_record_lock.sql` lands the `quote_acceptances_accepted_lock` +
   `jobs_source_ref_lock` triggers; `7.4-INT-01` (command ⇒ stable lock code `ACCEPTED_RECORD_LOCKED`),
   `7.4-INT-02` (direct own-tenant authenticated UPDATE ⇒ trigger rejects, on 6 acceptance + 3 job
   columns incl. the deliberately-locked operational columns), `7.4-INT-03` (id-only / empty-patch /
   bulk accidental-update regressions do not mutate; idempotent-retry preservation) — 31 tests, run
   (not skipped) against the live stack.
5. **Fixture privacy is enforced by the CI PII/secret + ORGNR scan over the acceptance golden** —
   R-717. Verified: `tests/unit/lib/money/golden-pack.test.ts` extends the 4.4 anonymization scan
   (personnummer / orgnr / secret / email) over `accepted-price-deltas.json` — the Epic 7 acceptance
   golden — as an epic blocker regardless of numeric score, REUSING (not forking) the 4.4 scan exactly
   as the design mandated.

**Recorded suite state (from the Epic 7 automation summaries):** full unit suite **1126 pass / 0
fail**; full INT suite **56 files / 641 tests / 0 fail**; the 7.4 accepted-record-lock suite **31 pass**
verified RUN (not skipped) against the live Supabase stack with `/auth/v1/health` polled to 200. No
active `describe.skip`/`it.skip` remains in any Epic 7 test file (all red-phase ATDD scaffolds flipped
green). All four stories are at `Status: review` with every task `[x]`.

---

## Coverage Summary

- **Total mapped requirement groups:** 23 (21 story ACs across 7.1-7.4 + 2 epic-wide requirements:
  no-public-acceptance-surface guardrail, fixture-privacy scan)
- **Fully covered (FULL):** 23 (100%)
- **Partial / Unit-only / None:** 0
- **P0 coverage:** 15/15 = **100%** (required: 100%) → MET
- **P1 coverage:** 8/8 = **100%** (PASS target: ≥90%) → MET
- **Overall coverage:** 23/23 = **100%** (minimum: 80%) → MET

**Planned-vs-implemented test-ID reconciliation:** 39 test IDs are named in the design's coverage plan;
34 are present as literal `{EPIC}.{STORY}-{LEVEL}-{SEQ}` labels in `tests/` (plus 2 extra —
`7.2-E2E-01/02` acceptance→job E2E). The 7 design IDs without a literal same-named test file are each
covered by another mechanism or are explicitly non-gating (see Gaps table) — no P0/P1 requirement is
uncovered.

---

## Traceability Matrix (AC → Tests)

Coverage status: **FULL** = requirement proven by at least one active, in-source test at an
appropriate level; source references verified against migrations / RLS inventory / RPC-trigger defs /
test source.

### Story 7.1 — Acceptance Evidence Capture For Sent Quote Versions

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 7.1-AC1 | Acceptance capture form for a sent quote version (channel, ts, admin user, evidence, öre price, notes, planned dates; no public/portal) | P1 | 7.1-E2E-01 | FULL |
| 7.1-AC2 | Adjusted-price (≠ sent total) requires reason/evidence + shows delta; server re-validated | P0 | 7.1-INT-03, 7.1-UNIT-01, 7.1-UNIT-02, 7.1-E2E-02 | FULL |
| 7.1-AC3 | Reject draft/accepted/rejected/expired/superseded/cross-tenant version (sent-state gate) | P0 | 7.1-INT-02 | FULL |
| 7.1-AC4 | New commitment tables isolated + enrolled (quote_acceptances/jobs/job_events) | P0 | 7.1-INT-01, 7.1-RLS-01 (shared cross-tenant/anon), 7.1-RLS-02 (H4 gate) | FULL |
| 7.1-AC5 | Accepted price + source sent total stored in öre (bigint, CHECK≥0); audit written, allow-listed metadata | P0 | 7.1-INT-01, 7.1-INT-05, 7.1-UNIT-01 | FULL |
| 7.1-AC6 | Evidence link activates `quote_acceptance` owner type + `acceptance_evidence` on 8.1 model; foreign file id rejected; no competing model | P0 | 7.1-INT-04 | FULL |

### Story 7.2 — Idempotent `acceptQuoteAndCreateJob` Command

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 7.2-AC1 | Atomic accept-and-create-job happy path (acceptance + sent→accepted + job + quote/job/audit events, committed together) | P0 | 7.2-INT-01, 7.2-INT-07, 7.2-UNIT-01 | FULL |
| 7.2-AC2 | Idempotent retry / duplicate prevention (second call returns existing ids, no second row) | P0 | 7.2-INT-02, 7.2-INT-03, 7.2-INT-06, 7.2-INT-08 | FULL |
| 7.2-AC3 | Atomicity / no partial state on injected mid-transaction failure (rollback proof) | P0 | 7.2-INT-04 | FULL |
| 7.2-AC4 | Sent-precondition + cross-tenant/anon rejection (server truth; generic error, no existence disclosure) | P0 | 7.2-INT-05 | FULL |
| 7.2-AC5 | Adjusted accepted price gated + öre discipline re-enforced in the transaction; unchanged + adjusted goldens | P0 | 7.2-GOLDEN-01, 7.2-INT-01 | FULL |
| 7.2-AC6 | Immutable job source references (accepted version id, acceptance id) | P0 | 7.2-INT-01, 7.3-INT-01, 7.4-INT-01, 7.4-INT-02 | FULL |

### Story 7.3 — Minimal Job/Order Record + Tenant-Admin UX

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 7.3-AC1 | Job/order detail with full source traceability from immutable refs (read-only source refs) | P1 | 7.3-E2E-01, 7.3-INT-01 | FULL |
| 7.3-AC2 | Job/order list filter/search; NO field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/Fortnox surface | P1 | 7.3-E2E-03 (E2E) + 7.3-E2E-03 (job-non-scope guardrail unit) | FULL |
| 7.3-AC3 | Tenant isolation on job reads AND allowed updates (RLS + command re-validation) | P0 | 7.4-RLS-01, shared cross-tenant/anon RLS suites (enrollment) | FULL |
| 7.3-AC4 | Phase A-safe allowed edits (title/status/planned dates) audited; immutable refs cannot be mutated | P1 | 7.3-INT-02 | FULL |
| 7.3-AC5 | Repeated acceptance/create-job shows EXISTING job, not a duplicate or an error (idempotency UI mirror, UX-DR24) | P1 | 7.3-E2E-02, 7.2-INT-02 | FULL |
| 7.3-AC6 | Activate `job` file owner type + `job_evidence` purpose; job files surface only own-type links | P1 | 7.3-INT-01 (job-read-mapping projection) | FULL |

### Story 7.4 — Accepted-State Immutability + Correction Boundary

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 7.4-AC1 | Accepted commitment fields immutable at BOTH layers (command lock code AND DB trigger) | P0 | 7.4-INT-01, 7.4-INT-02, 7.4-E2E-01 | FULL |
| 7.4-AC2 | No normal edit path mutates immutable data; event not hidden/silently overwritten (id-only/empty-patch/bulk regressions) | P0 | 7.4-INT-03 | FULL |
| 7.4-AC3 | Cross-tenant attack on accepted records fails (read + immutable-field update + anon) | P0 | 7.4-RLS-01 | FULL |

### Epic-wide requirements

| Req | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 7.x-GUARDRAIL | No public/unauthenticated acceptance endpoint, portal route, webhook, or cron exists | P1 | 7.x-E2E-01 (acceptance-non-scope guardrail) | FULL |
| 7.x-FIXTURE-PRIVACY | Fixture PII/secret + ORGNR scan covers acceptance/job goldens; öre < 10-digit boundary | P0 | 7.x-UNIT-01 (golden-pack extended scan over accepted-price-deltas.json) | FULL |

---

## Gaps & Non-Gating Unauthored Items

No P0 or P1 requirement is uncovered. The following 7 design-plan test IDs have no literal same-named
test file; each is dispositioned:

| Design ID | Priority | Disposition |
| --- | --- | --- |
| 7.1-RLS-01 | P0 | **Covered (not a gap)** — by the shared inventory-driven `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts`, which iterate the FULL `TENANT_TABLES` set (the new tables are enrolled). This is the design-mandated mechanism ("Via `TENANT_TABLES` enrollment; do not hand-write ad-hoc isolation tests that bypass the inventory"). |
| 7.1-RLS-02 | P0 | **Covered (not a gap)** — by `rls-inventory-gate.int.test.ts` (the H4 gate), which reads the single-source-of-truth inventory and fails CI on any unenrolled tenant table. |
| 7.x-UNIT-01 | P0 | **Covered (not a gap)** — the fixture PII/ORGNR scan lives in `golden-pack.test.ts` (extended over `accepted-price-deltas.json`), carrying the R-411/R-717 lineage rather than a separate Epic-7-labeled file. |
| 7.2-INT-09 | P3 | **Non-gating** — exploratory concurrency fuzz; the design states "not a gate." Core concurrency is proven by 7.2-INT-06 (green). |
| 7.x-UNIT-02 | P3 | **Non-gating** — DX typed-error ergonomics; substantially covered by the validation + error-mapper unit tests (`accept-and-create-job-validation`, `command-errors-acceptance-conflict`, `job-write-error-mapping`). |
| 7.4-DOCS-01 | P2 | **Non-gating (DOCS)** — documented Lovable mutable-acceptance delta; a residual/oracle register item, not an executable test. |
| 7.x-DOCS-01 | P3 | **Non-gating (DOCS)** — residual/assumption register (R-713 adjusted-price policy, R-714 correction-workflow, R-716 per-person ROT cap, R-718 perf, R-719 standing NFR). |

**Standing NFR carry (R-719):** the `pnpm audit --audit-level=high` blocking CI gate was RESOLVED in
Epic 6; the coverage reporter (`c8` over `test:unit`, report-only) remains the single LOW standing
residual carried since Epic 2 — a dated calendar item, not test effort. Restated here so it is not a
silent carry.

**Owner-gated residuals (not test gaps, restated per Exit Criteria):** R-713 (exact adjusted-price
adjustment policy + accepted-evidence channel set) and R-714 (audited correction workflow — Phase A
intentionally implements the BOUNDARY only, no workflow) are owner Sign-Off residuals; conservative dev
defaults are acceptable under the demo-data-only decision (2026-07-03). The immutability model AGREES
across Epic 6 (sent-version freeze, R-605), Epic 7 (accepted-record lock), and is committed to AGREE
with Epic 8.4 (locked evidence file).

---

## Next Actions

1. **PASS — proceed.** No remediation is required to clear the epic-boundary traceability gate; all P0
   and P1 requirements are FULLY covered by active, in-source, verified-green tests.
2. **(LOW, post-merge, optional)** Author the two P3 items if desired — the exploratory concurrency fuzz
   (`7.2-INT-09`) and the DX typed-error unit (`7.x-UNIT-02`); neither gates.
3. **(LOW, calendar)** Keep the standing NFR carry (R-719 coverage reporter) dated in the retro/backlog
   rather than silently carried; the `pnpm audit` half is already resolved.
4. **(Owner)** Re-confirm the R-713 adjusted-price policy / R-714 correction-workflow residuals at any
   move away from demo-data-only; both are documented, not silent.

---

## Gate Decision Summary

- **Decision:** PASS
- **P0 Coverage:** 100% (15/15) — Required 100% → MET
- **P1 Coverage:** 100% (8/8) — PASS target ≥90% → MET
- **Overall Coverage:** 100% (23/23) — Minimum 80% → MET
- **High-priority risks (≥6):** 11/11 mitigated and proven by active tests (R-701..R-710, R-717)
- **Non-negotiable epic blockers:** 5/5 met and verified
- **Critical gaps:** 0
- **Decision date:** 2026-07-07

✅ GATE: PASS — the Epic 7 acceptance-to-job transaction meets the epic-boundary traceability standard;
coverage is complete across isolation, idempotency, atomicity, accepted-state immutability (two-layer),
adjusted-price/öre discipline, job traceability, evidence-link activation, event/audit completeness, the
no-public-acceptance guardrail, and fixture privacy.
