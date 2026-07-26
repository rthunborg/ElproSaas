---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-19'
workflowType: testarch-nfr-assess
gateType: epic
epicNum: 10
executionMode: sequential
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-10.md (25 risks; 8 non-negotiable epic-blockers; pass/fail thresholds; R-1047 PERF residual)
  - _bmad-output/test-artifacts/traceability/epic-10-traceability-report.md (Gate PASS; 17/17 ACs FULL; live suite state)
  - _bmad-output/planning-artifacts/epics-phase-b.md (Epic 10 FR62-65, FR129/130; NFR11/NFR44/NFR51 carried+added)
  - _bmad-output/planning-artifacts/prd-phase-b.md (NFR1-41 spine carried; NFR42-54)
  - _bmad-output/implementation-artifacts/10-1..10-4 story files (all `review`; findings resolved)
  - supabase/migrations/20260719120000_quote_lost_reasons_and_lost_status.sql (insert-only table + lost widening + SECURITY INVOKER RPC)
  - supabase/migrations/20260719130000_quote_follow_ups.sql (UPDATE-able table + one-open partial unique index)
  - src/server/read-models/{quote-pipeline-aggregate,entitlements,quote-pipeline}.ts (first read-model: pure aggregate + entitlement withholding + RLS-client-only query layer)
  - .github/workflows/ci.yml (verify + db + e2e jobs; blocking pnpm audit; service-role source+bundle containment; H4 inventory gate)
  - _bmad-output/auto-bmad/retro-notes/epic-10.md (per-story retro notes; non-vacuity theme)
  - _bmad/tea/config.yaml (tea_execution_mode=auto→sequential; no browser evidence captured — static evidence audit)
---

# NFR Assessment — Epic 10: Quote Lifecycle Completion (+ Phase B Governance Re-Baseline)

**Date:** 2026-07-19
**Epic:** 10 (Stories 10.1–10.4) — first Phase B epic
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Overall Status:** CONCERNS ⚠️ (advisory only — no release blocker; the single CONCERNS domain is an explicitly accepted, documented pilot-scale residual)

---

> Note: This assessment audits **existing evidence** (migrations, read-model source, CI config, test
> design, traceability, story records). It does not run tests, load tools, or CI workflows. No live
> browser/CLI evidence was captured (`tea_browser_automation=auto`, but the epic surface is
> server/DB-centric and the perf threshold is deliberately undefined — a static evidence audit is the
> correct mode). Execution mode: **SEQUENTIAL** (4 NFR domains assessed in-process).

## Executive Summary

**Assessment:** 3 domains PASS (Security, Reliability, Maintainability), 1 domain CONCERNS (Performance/Scalability).

**Blockers:** 0. All eight Non-Negotiable epic-blocker controls in the Epic 10 test design are met and
verified against source (the two migrations, the read-model modules, the CI gates, and the executed
suites) — not merely story prose. Traceability gate is **PASS** (17/17 ACs FULL; P0 100%).

**High Priority Issues:** 0 release-blocking. Two advisory watch-items: (1) pilot-scale pipeline
aggregation latency is unmeasured with no SLA defined (R-1047, threshold UNKNOWN → CONCERNS by rule);
(2) a recurring test **non-vacuity / hollow-assertion** theme across the epic (3 instances found-and-fixed
in review) — a maintainability/test-quality watch, not an NFR failure.

**Recommendation:** **PROCEED** to the epic-boundary owner review / release gate. Overall status is
CONCERNS strictly because the Performance threshold is undefined (deterministic UNKNOWN→CONCERNS rule),
NOT because any control failed. Security, reliability, and maintainability evidence is strong and
directly verified. Carry the two watch-items (R-1047 perf residual; test non-vacuity gate) forward; both
are already logged in the test design and epic retro.

---

## NFR Categories & Thresholds

Thresholds are drawn from the Phase B PRD NFR spine (NFR1–41 carried + NFR42–54), the Epic 10 test
design (non-negotiables + pass/fail thresholds), and the story files. Where no threshold exists it is
marked **UNKNOWN** and reported CONCERNS per the no-guessing rule.

| Domain | Threshold source | Threshold |
| --- | --- | --- |
| Sent-immutability (NFR11/FR63) | Test design non-negotiable | Regression suite re-run green; lost flip mutates only `status`; own-tenant UPDATE → `QUOTE_VERSION_LOCKED` |
| Tenant isolation (NFR54 posture / §3.6 RLS floor) | Test design non-negotiable | 100% of new tables enrolled in `TENANT_TABLES`; H4 green; cross-tenant + anon negatives pass; insert-only UPDATE rejected |
| Read-model isolation (R-1041) | Test design non-negotiable | RLS-client-only; no service-role import on the path; cross-tenant proof |
| Governance integrity (NFR51) | Test design non-negotiable | 4 derivations == authored Phase A value; unlisted surface FAILS CI (fail-loud); coherence validator fails on each incoherent state |
| Sensitive-field withholding (NFR44) | Test design non-negotiable | Withheld money leaf ABSENT from `data` + listed in `entitlements.withheld`; conservative default; N-4 seed owner-gated |
| Money integrity | Test design non-negotiable | öre-derived via `@/lib/money` only; NO new money/rounding path |
| Dependency vulnerabilities | CI gate (owner decision 2026-07-03) | 0 HIGH/CRITICAL advisories (blocking) |
| Test coverage (pure logic) | Test design coverage target | ≥90% on manifest validator + derivations + read-model descriptor + aggregation |
| P0 / P1 pass rate | Test design pass/fail thresholds | P0 100%; P1 ≥95% |
| Pipeline aggregation latency (R-1047) | — | **UNKNOWN** — pilot-sized; **no Phase A/B SLA on this surface (explicit)** → CONCERNS |
| Runtime error tracking / APM | — | **UNKNOWN** — no APM/Sentry defined for pilot stage → CONCERNS (monitorability) |
| Availability / uptime (RTO/RPO) | — | **UNKNOWN** — platform-managed (Supabase/Vercel); no epic-specific SLA → N/A for this epic's code |

---

## Performance Assessment

### Response Time (p95) / Throughput

- **Status:** CONCERNS ⚠️
- **Threshold:** UNKNOWN — no Phase A/B SLA is defined for the pipeline surface (explicit in the test
  design: "Pilot-sized; no Phase A/B SLA on this surface"). Correctness/determinism, not latency, is the
  stated Phase A/B concern.
- **Actual:** Not measured. No load/k6/Lighthouse evidence exists (none required for a pilot-sized,
  internal read surface).
- **Evidence:** `test-design-epic-10.md` R-1047 (PERF, P×I = 2, disposition DOCUMENT: "add only if an SLA
  emerges"); `_bmad-output/test-artifacts/traceability/epic-10-traceability-report.md` (perf named a
  documented residual, not a coverage gap).
- **Findings:** This is a **deliberately accepted documented residual**, not a discovered gap. The
  aggregation core is a single-pass O(n) fold over already-read rows (`aggregateQuotePipeline`,
  `src/server/read-models/quote-pipeline-aggregate.ts`) and reads are RLS-scoped selects backed by
  `quote_lost_reasons_tenant_id_idx` and the one-open partial unique index. The one shape worth watching
  at scale: the read-model reads **all** `sent/accepted/lost` `quote_events` and window-filters in memory
  (`quote-pipeline.ts:113-116`) — fine at pilot volume, a candidate for a DB-side date predicate + index
  if an SLA later emerges. CONCERNS is assigned solely because the threshold is UNKNOWN (deterministic
  rule), with the mitigating fact that no SLA is required for this release.

### Resource Usage / Scalability

- **Status:** CONCERNS ⚠️ (pilot-appropriate)
- **Threshold:** UNKNOWN — no horizontal-scaling or dataset-size target for this surface.
- **Actual:** Stateless Next.js server actions + managed Postgres (Supabase); no per-tenant sharding
  (single pooled-tenancy DB, by Phase A/B design). Pure aggregation holds only the period's rows in
  memory.
- **Evidence:** `quote-pipeline-aggregate.ts` (pure, deterministic, bounded by period rows);
  `quote-pipeline.ts` (thin query layer, RLS client only).
- **Findings:** Adequate for internal-pilot / legacy-parity scale. Data-scaling (partitioning, read
  replicas, DB-side windowing) is genuinely deferred until an SLA or dataset-growth signal appears.

---

## Security Assessment

### Authentication Strength

- **Status:** PASS ✅
- **Threshold:** No service-role on any client path; authenticated RLS-scoped access only (§3.6 RLS floor).
- **Actual:** Every read-model query runs on the per-request cookie-bound **anon-key RLS client**
  (`createSupabaseServerClient`); the module never imports a privileged/unscoped client
  (`src/server/read-models/quote-pipeline.ts:7-14, 29`). The new RPC is `SECURITY INVOKER` with an empty
  `search_path`, schema-qualified — it runs under the caller's RLS, no service-role app path.
- **Evidence:** `quote-pipeline.ts` (RLS-client-only, injectable `deps.client` seam for the cross-tenant
  proof); `20260719120000_...sql:301-366` (`mark_quote_version_lost` SECURITY INVOKER); CI
  `verify:service-role-containment` (source) + `verify:bundle-containment` (post-build `.next` grep),
  both in `.github/workflows/ci.yml`. 10.4-INT-01 adds a structural no-service-role-import assertion.

### Authorization Controls

- **Status:** PASS ✅
- **Threshold:** Both new tenant tables enrolled + isolated; insert-only enforced where required;
  cross-tenant + anon negatives pass; H4 inventory gate green.
- **Actual:** `quote_lost_reasons` is **insert-only** — SELECT+INSERT policies/grants only, no UPDATE
  policy or grant, so an own-tenant UPDATE is deny-by-default at the privilege layer (42501); `unique
  (quote_version_id)` caps one reason per version. `quote_follow_ups` is UPDATE-able with a one-open
  partial unique index. Both use `is_tenant_admin(tenant_id)` policies, `FORCE ROW LEVEL SECURITY`, and
  composite same-tenant FKs. Both enrolled in `TENANT_TABLES` (derived union 24→25→26); the H4 inventory
  gate is CI-fatal for any un-enrolled tenant table.
- **Evidence:** `20260719120000_...sql:99-129` (insert-only grants/policies + intentional no-UPDATE
  note); `20260719130000_...sql:1-70` (UPDATE-able + one-open index); 10.2-RLS-01 / 10.2-INT-04/05/06,
  10.3-RLS-01 / 10.3-INT-02, 10.4-INT-01 (per traceability). CI `db` job runs migration reset from empty
  + INT/RLS negatives with `SUPABASE_TEST_REQUIRED=1` (no silent false-green).

### Data Protection

- **Status:** PASS ✅
- **Threshold:** Sent snapshot immutable under the lost path (NFR11/FR63); sensitive money fields
  withheld server-side (value absent from payload, NFR44); no real PII/secret in fixtures.
- **Actual:** The lost flip changes only the exempt `status` column; the 6.4 sent-lock trigger's
  full customer-visible/commitment tuple comparison is byte-unchanged (the immutability tuple is not
  weakened — `20260719120000_...sql:163-281`); direct own-tenant UPDATE still returns
  `QUOTE_VERSION_LOCKED`. The entitlement mechanism **deletes** a withheld money leaf from `data` (absent,
  never null/0) and lists its FieldPath (`entitlements.ts:100-144`) — value never rides the payload. The
  standing `anonymization-scan.ts` control was widened during 10.2 review to cover the golden quote
  fixtures.
- **Evidence:** `20260719120000_...sql:29-32` (sent-immutability comment + trigger body);
  `entitlements.ts` (absent+listed withholding); 10.2-INT-01 (regression suite re-run + before/after
  column read), 10.2-GOLDEN-01. Encryption at rest / TLS in transit is platform-managed (Supabase/Vercel)
  — not epic-specific, no regression introduced.

### Input Validation

- **Status:** PASS ✅
- **Threshold:** Parameterized access; structured-value CHECKs; server-side re-validation.
- **Actual:** All DB access is parameterized (Supabase client / RPC parameters — no string-concatenated
  SQL). `outcome`, `category`, `status` are CHECK-constrained; a fail-closed CHECK requires a non-empty
  note when `category='annat'`; the command layer re-validates and maps a duplicate 23505 to
  `VALIDATION_FAILED`; an illegal lost transition is rejected at BOTH the command (`VALIDATION_FAILED`)
  and the DB belt (`QV409`→`QUOTE_VERSION_LOCKED`).
- **Evidence:** `20260719120000_...sql:60-87, 331-362`; 10.2-UNIT-02, 10.2-INT-03.

### Secrets Management

- **Status:** PASS ✅
- **Threshold:** No hardcoded credentials; secret reads/edits denied to agents; CI uses non-secret local
  defaults only.
- **Actual:** No new secret surface in this epic. `.env*` reads/edits are denied via
  `.claude/settings.json` + `guard.ps1` (project governance); the CI `db`/`e2e` jobs use the universal
  local Supabase demo defaults (documented not-real-secrets), and CI has `permissions: contents: read`.
- **Evidence:** `.github/workflows/ci.yml:24-27, 100-104`; CLAUDE.md/AGENTS.md governance.

### Compliance (GDPR)

- **Status:** PASS ✅ (posture; no formal external audit)
- **Standards:** GDPR (tenant data isolation, data minimization).
- **Actual:** Strong tenant isolation (RLS FORCE + H4 gate), demo-data-only through MVP (owner decision
  2026-07-03), no real PII in fixtures. No formal certification performed (out of scope for internal
  pilot).
- **Findings:** Adequate for the internal pilot. Re-assess before real-customer data lands.

**Security domain risk: LOW → PASS.** No FAIL, no unresolved CONCERN.

---

## Reliability Assessment

### Error Handling & Fault Tolerance

- **Status:** PASS ✅
- **Threshold:** Graceful degradation with no SQL/stack leak; atomic mutations; clear user-facing errors
  (not raw DB errors).
- **Actual:** The read-model degrades to a **generic empty descriptor** on any query fault and never
  leaks a SQL/stack detail (`quote-pipeline.ts:20-23, 117, 178-181`). `mark_quote_version_lost` is a
  single transaction — any step failure rolls back the whole txn (status flip + event + reason are
  all-or-nothing). The one-open 23505 maps to a clear message via the shared envelope
  (`CommandError.userMessage`), not a raw DB error. An occluded-error-banner UI regression was found and
  fixed with a react-dom/server render-tree assertion.
- **Evidence:** `quote-pipeline.ts` (generic-error posture mirrors `read.ts`); `20260719120000_...sql`
  (transactional RPC); retro notes (envelope `userMessage` widening; error-banner-visibility test
  `follow-up-error-visibility.test.ts`).

### Availability / MTTR / Disaster Recovery

- **Status:** N/A for epic code (platform-managed) — no regression
- **Threshold:** UNKNOWN — no epic-specific uptime/RTO/RPO target.
- **Actual:** Availability and backups are Supabase/Vercel managed; this epic adds only additive
  migrations and read-only server code. No epic-specific SLA is defined.
- **Findings:** No DR posture change introduced. Documented as UNKNOWN (platform-owned).

### Data Integrity / Consistency

- **Status:** PASS ✅ (one accepted residual)
- **Threshold:** Lifecycle state-machine coherent across all 5 layers; append-only audit trail.
- **Actual:** The single `lost` token is widened coherently across the 3 DB layers (status CHECK, event
  CHECK, sent-lock allow-set) + 2 TS layers (transition map, timeline union); `quote_events` is the
  append-only lifecycle source. **Accepted residual:** auto-complete-on-lost is deliberately non-atomic
  (two-command orchestration, no new RPC) — a rare orphaned open follow-up is an accepted, audited,
  recoverable state by design (documented in the story + retro).
- **Evidence:** `20260719120000_...sql:132-281`; 10.2-UNIT-01 (5-layer coherence); retro note (10.3
  non-atomic-by-design).

### CI Burn-In (Stability)

- **Status:** PASS ✅
- **Threshold:** P0 100% / P1 ≥95%; full suite green.
- **Actual:** Per dev+trace records: INT 782/782, quote E2E 40/40, epic-10 pure-unit subset 137/137,
  10.1 keystone 18/18 — all green. CI enforces the gate on every PR + post-merge push.
- **Evidence:** traceability report frontmatter (LIVE suite state); `.github/workflows/ci.yml` (verify +
  db + e2e). No dedicated multi-run burn-in/flake-rate log exists (standard single-run CI) — minor.

### Monitoring & Observability

- **Status:** CONCERNS ⚠️
- **Threshold:** UNKNOWN — no APM/error-tracking requirement defined for the pilot.
- **Actual:** Server-side has an append-only `audit_events` trail + `quote_events` lifecycle and
  generic-error degradation, but there is **no APM, distributed tracing, or Sentry/error-tracking**
  integration. Acceptable for internal-pilot stage; flagged so it is a conscious choice.
- **Evidence:** No APM/Sentry dependency in the tree; generic-error posture in `quote-pipeline.ts`.
- **Findings:** Add runtime error tracking before external/production rollout.

**Reliability domain risk: LOW → PASS** (with a monitorability CONCERN that is pilot-appropriate).

---

## Maintainability Assessment

### Test Coverage

- **Status:** PASS ✅
- **Threshold:** ≥90% pure-logic coverage; P0 100%; RLS negatives 100% of new tables.
- **Actual:** 17/17 ACs FULL (traceability PASS); pure validator/derivation/descriptor/aggregation
  covered; both new tables have cross-tenant + anon negatives; unit/INT/RLS/E2E layers all present and
  green. Two-runner discipline (node:test fast unit gate + Playwright INT/E2E) is followed.
- **Evidence:** `epic-10-traceability-report.md` (100% coverage, 0 gaps).

### Governance Integrity (NFR51) — the maintainability keystone

- **Status:** PASS ✅
- **Threshold:** Scope manifest is the single source of truth; 4 guardrail derivations == authored Phase
  A values; unlisted surface FAILS CI (fail-loud); coherence validator fails on each incoherent state.
- **Actual:** `src/scope/manifest.ts` is the typed single source; `manifest-derivations.test.ts` proves
  each of the 4 derivations equals an INDEPENDENT authored ground truth (never derived==derived);
  DERIVE-06 proves an unlisted surface is not silently admitted; `manifest-coherence.test.ts` COH-01..05
  each introduce an incoherent state and assert it is FLAGGED. This is the durable guardrail every later
  Phase B story inherits — a strong maintainability control.
- **Evidence:** traceability §Story 10.1 (DERIVE/COH/DOCS suites); test-design non-negotiable #1.

### Code Quality & Technical Debt

- **Status:** PASS ✅
- **Threshold:** typecheck + lint green in CI; no new money/rounding path; documented debt only.
- **Actual:** CI enforces `typecheck` + `lint` + `pnpm audit --audit-level=high` (blocking) on every PR.
  Pure/thin separation is clean (aggregate + entitlement pure; query layer thin). Money is an integer-öre
  sum via `@/lib/money` only — no new money path. Known debt is explicitly forward-scoped: (1)
  dependency-aware aggregate-honesty helper (Defer[Low], `entitlements.ts` — deferred to first
  multi-component read-model); (2) `tenantTablesFromManifest` platform-scope filter seam (Defer[Low],
  E12); (3) R-1046 N-4 entitlement seed is a conservative flagged default awaiting owner re-confirm at
  Epic 11.
- **Evidence:** `entitlements.ts:13-31, 92-112` (deferral documented in-source); `.github/workflows/ci.yml`
  (blocking audit + typecheck + lint).

### Test Quality — WATCH ITEM

- **Status:** CONCERNS ⚠️ (found-and-fixed; theme, not an open failure)
- **Threshold:** Assertions must be non-vacuous (prove the thing, not merely "runs green").
- **Actual:** The epic surfaced **three** hollow-assertion instances (all found-and-fixed in Tier-A
  review): 10.2 skipped scaffolds that the Change Log claimed "unskipped and green"; a 10.2 standing
  R-1015 control-glob left un-widened while its task was marked done; and a 10.4 `Array.isArray`
  masquerading as a cross-tenant proof. Each was fixed, but the recurrence is the signal: "unskipped and
  green" can be literally true while proving nothing. The epic-boundary retro already flags the need for a
  **mechanical non-vacuity gate** in dev-story rather than relying on reviewer discipline.
- **Evidence:** `_bmad-output/auto-bmad/retro-notes/epic-10.md` (Tier-A review notes for 10.2, 10.4);
  traceability "THIRD hollow-assertion instance this epic".
- **Findings:** Not a release blocker (all instances resolved), but a standing process/maintainability
  recommendation. Directly explains the epic PR shipping as DRAFT for human review
  (convergence_unverified sticky).

### Documentation Completeness

- **Status:** PASS ✅
- **Threshold:** Story files, ADR-backed re-baseline, inline rationale.
- **Actual:** Governance re-baseline landed in one ADR-backed change (`AGENTS.md` Phase B declaration,
  `phase-scope-reviewer` baseline, `CLAUDE.md` row); migrations and read-model modules carry extensive
  design-decision headers; story files carry Dev Notes + Change Log + Review Findings.
- **Evidence:** 10.1-DOCS-01..05; the migration/read-model file headers.

**Maintainability domain risk: LOW → PASS** (with the test non-vacuity watch item).

---

## Quick Wins

3 quick wins identified:

1. **Adopt the react-dom/server render-tree assertion as a standing lane** (Maintainability) — LOW — <1 day
   - The 10.3 fix for the occluded-error-banner (Dialog-hosted error surface, invisible to
     node:test/Vitest-node/happy-path E2E) is a cheap, stack-free assertion pattern. Promote it to a
     documented standing pattern for Dialog-hosted error surfaces.
2. **Add a mechanical non-vacuity / no-`describe.skip` finalize gate to dev-story** (Maintainability) — HIGH — 1–2 days
   - Closes the recurring "unskipped and green proves nothing" theme (3 instances this epic). A grep/AST
     gate for residual `.skip`, `Array.isArray`-only assertions, and un-widened standing-control globs.
3. **Pin a DB-side date predicate seam for the pipeline events query** (Performance) — LOW — <1 day, only if an SLA emerges
   - `quote-pipeline.ts` currently reads all sent/accepted/lost events then window-filters in memory;
     leave a documented seam for a DB-side `occurred_at` range + index when/if a latency SLA appears.

---

## Recommended Actions

### Immediate (Before Release) — CRITICAL/HIGH

- **None.** No NFR is in FAIL; all eight epic-blocker controls are met and verified. No release blocker.

### Short-term (Next Milestone) — MEDIUM

1. **Non-vacuity gate in dev-story** — HIGH-value/MEDIUM-priority — 1–2 days — Dev/TEA
   - Mechanical gate for residual skips, hollow assertions, and un-widened standing controls; encode as a
     dev-story finalize checklist + CI lint. Removes reliance on reviewer discipline.
2. **Runtime error tracking before external rollout** — MEDIUM — 1–2 days — Dev/Ops
   - Add Sentry (or equivalent) + minimal request tracing before any production/customer exposure;
     pilot-stage absence is acceptable, external rollout is not.

### Long-term (Backlog) — LOW

1. **Owner re-confirm the N-4 entitlement seed (R-1046)** — LOW — owner gate — Owner/Epic 11
   - Re-confirm `tenant_admin ⇒ money-entitled` before role-aware money withholding activates in 11.2.
2. **Pipeline latency SLA + DB-side windowing** — LOW — only if an SLA emerges — Dev
   - Define an SLA and add DB-side date predicate + index; convert R-1047 from documented residual to a
     measured target.
3. **Dependency-aware aggregate-honesty helper** — LOW — first multi-component read-model — Dev
   - Land the deferred leaf→aggregate withholding helper when a multi-component read-model makes it
     exercisable/testable.

---

## Monitoring Hooks

Recommended before external rollout (pilot-stage optional):

### Reliability Monitoring
- [ ] Error tracking (Sentry/equivalent) — capture read-model degrade events + command failures
  - **Owner:** Dev/Ops — **Deadline:** before production/customer exposure
- [ ] Request tracing / Server-Timing on the read-model path
  - **Owner:** Dev — **Deadline:** before production/customer exposure

### Performance Monitoring
- [ ] Pipeline aggregation latency metric (only meaningful once an SLA is defined)
  - **Owner:** Dev — **Deadline:** when an SLA emerges (R-1047 trigger)

### Alerting Thresholds
- [ ] Alert on repeated read-model generic-degrade responses (proxy for a silent query fault)
  - **Owner:** Ops — **Deadline:** with error tracking rollout

---

## Fail-Fast Mechanisms

Already in place (verified this epic):

- **Validation gates (Security):** DB CHECK constraints (outcome/category/annat-note), command-layer
  re-validation (`VALIDATION_FAILED`), illegal-transition rejection at command AND DB belt, H4 inventory
  gate (CI-fatal), blocking dependency audit, service-role source+bundle containment.
- **Circuit-breaker-equivalent (Reliability):** read-model generic-empty degrade posture (no SQL/stack
  leak); transactional RPC rollback.
- **Recommended (Maintainability):** non-vacuity / no-residual-skip finalize gate (see Quick Wins #2).

---

## Evidence Gaps

3 evidence gaps — all documented and dispositioned (none block the gate):

- [ ] **Pipeline aggregation latency** (Performance) — Owner: Dev — Deadline: when an SLA emerges —
  Suggested evidence: k6/load test once an SLA is defined — Impact: unmeasured at scale, but no SLA
  required for this release (R-1047 DOCUMENT).
- [ ] **Runtime error tracking / APM** (Reliability/Monitorability) — Owner: Dev/Ops — Deadline: before
  external rollout — Suggested evidence: Sentry integration + tracing — Impact: reduced production
  debuggability; acceptable at pilot stage.
- [ ] **Dedicated CI burn-in / flake-rate log** (Reliability) — Owner: TEA — Deadline: optional —
  Suggested evidence: multi-run stability report — Impact: low; single-run CI is green and enforced.

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**

| Category | Criteria Met | PASS | CONCERNS | FAIL | Overall Status |
| --- | --- | --- | --- | --- | --- |
| 1. Testability & Automation | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ (non-vacuity watch) |
| 2. Test Data Strategy | 3/3 | 3 | 0 | 0 | PASS ✅ |
| 3. Scalability & Availability | 2/4 | 2 | 2 | 0 | CONCERNS ⚠️ (latency/scale UNKNOWN) |
| 4. Disaster Recovery | 2/3 | 1 | 2 | 0 | CONCERNS ⚠️ (platform-managed; UNKNOWN RTO/RPO) |
| 5. Security | 4/4 | 4 | 0 | 0 | PASS ✅ |
| 6. Monitorability, Debuggability & Manageability | 3/4 | 2 | 2 | 0 | CONCERNS ⚠️ (no APM/tracing) |
| 7. QoS & QoE | 3/4 | 3 | 1 | 0 | PASS ✅ (correctness strong; latency UNKNOWN) |
| 8. Deployability | 3/3 | 3 | 0 | 0 | PASS ✅ |
| **Total** | **23/29** | **21** | **8** | **0** | **CONCERNS ⚠️** |

**Criteria Met Scoring:** 23/29 (79%) = Room for improvement — driven almost entirely by
platform-managed/UNKNOWN-threshold categories (scalability, DR, monitorability) that are deliberately
undefined at pilot stage, NOT by any FAIL. Security is a clean 4/4; zero FAIL across all 29 criteria.

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-07-19'
  epic: 10
  feature_name: 'Quote Lifecycle Completion (+ Phase B Governance Re-Baseline)'
  adr_checklist_score: '23/29'
  categories:
    testability_automation: 'CONCERNS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'CONCERNS'
    security: 'PASS'
    monitorability: 'CONCERNS'
    qos_qoe: 'PASS'
    deployability: 'PASS'
  domain_risk:
    security: 'LOW'
    performance: 'MEDIUM' # threshold UNKNOWN / no SLA — documented residual
    reliability: 'LOW'
    scalability: 'MEDIUM' # pilot-appropriate; UNKNOWN scale target
  overall_status: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 0 # release-blocking
  medium_priority_issues: 2 # non-vacuity gate; error tracking before external rollout
  concerns: 8
  blockers: false
  quick_wins: 3
  evidence_gaps: 3
  recommendations:
    - 'Add a mechanical non-vacuity / no-residual-skip finalize gate in dev-story (closes the 3-instance hollow-assertion theme)'
    - 'Add runtime error tracking (Sentry) + tracing before any external/production rollout'
    - 'Owner re-confirm the N-4 entitlement seed (R-1046) before role-aware money withholding activates at Epic 11'
```

---

## Related Artifacts

- **Story Files:** `_bmad-output/implementation-artifacts/10-1..10-4-*.md`
- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-10.md`
- **Traceability:** `_bmad-output/test-artifacts/traceability/epic-10-traceability-report.md`
- **PRD (Phase B):** `_bmad-output/planning-artifacts/prd-phase-b.md` (NFR1-41 carried; NFR42-54)
- **Epics (Phase B):** `_bmad-output/planning-artifacts/epics-phase-b.md`
- **Retro notes:** `_bmad-output/auto-bmad/retro-notes/epic-10.md`
- **Key source evidence:**
  - `supabase/migrations/20260719120000_quote_lost_reasons_and_lost_status.sql`
  - `supabase/migrations/20260719130000_quote_follow_ups.sql`
  - `src/server/read-models/{quote-pipeline-aggregate,entitlements,quote-pipeline}.ts`
  - `.github/workflows/ci.yml`

---

## Recommendations Summary

**Release Blocker:** None. Zero NFR FAIL; all eight Non-Negotiable epic-blocker controls met and verified
against source; traceability gate PASS.

**High Priority:** None release-blocking. Advisory: mechanical non-vacuity gate (test quality); runtime
error tracking before external rollout.

**Medium Priority:** N-4 seed owner re-confirm (Epic 11); pipeline latency SLA + DB-side windowing if an
SLA emerges.

**Next Steps:** Overall CONCERNS is advisory — the only CONCERNS-driving thresholds (latency, scale, DR,
APM) are deliberately undefined at internal-pilot stage. Proceed to the epic-boundary owner review /
release gate; carry the two watch-items (non-vacuity gate, error tracking) and R-1046 forward. This
matches the epic PR shipping as DRAFT for human review (convergence_unverified sticky per the Tier-A
found-and-fixed High).

---

## Sign-Off

**NFR Assessment:**

- Overall Status: CONCERNS ⚠️ (advisory; no release blocker)
- Critical Issues: 0
- High Priority (release-blocking) Issues: 0
- Concerns: 8 (7 UNKNOWN-threshold/platform-managed at pilot stage + 1 test-quality theme, all
  documented/dispositioned)
- Evidence Gaps: 3 (all dispositioned)

**Gate Status:** CONCERNS ⚠️ — proceed with the two forward watch-items; no blocker.

**Next Actions:**

- CONCERNS ⚠️: Address the non-vacuity gate + error tracking before external rollout; no re-run required
  before this epic's release/owner gate (the CONCERNS are accepted pilot-scale residuals, not failures).

**Generated:** 2026-07-19
**Workflow:** testarch-nfr v4.0

---

<!-- Powered by BMAD-CORE™ -->
