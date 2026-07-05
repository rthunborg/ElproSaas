---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-05'
workflowType: testarch-test-design
designLevel: epic
epicNum: 7
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 7, lines 1401-1555; stories 7.1-7.4; FR41-FR48; AR20-AR21)
  - _bmad-output/planning-artifacts/architecture.md (§13 Acceptance-To-Job Transaction Design; ADR-A005 immutable quote/acceptance; ADR-A009 narrow RPC — explicitly names acceptQuoteAndCreateJob; §5 command registry; §6/§9 immutable lifecycle tables via triggers/constraints/command-only; §7 quote_acceptances/jobs IN; §14 file model owner types quote_acceptance/job + acceptance_evidence/job_evidence purposes; §15 audit; stable codes QUOTE_VERSION_LOCKED/ACCEPTANCE_ALREADY_RECORDED/COMMAND_CONFLICT)
  - _bmad-output/planning-artifacts/prd.md (FR41-FR48; NFR12 immutable accepted refs/evidence; NFR20 no partial acceptance/job state; UX-DR17/23/24/26/35)
  - _bmad-output/project-context.md (Money/Tax/Quote Rules öre; snapshot-source contract; Testing Rules; Security Regression Harness Rules; demo-data-only decision 2026-07-03)
  - _bmad-output/test-artifacts/test-design-epic-6.md (house style; Epic 6 sent-state lifecycle Epic 7 consumes; sent immutability R-605; 6.x Not-in-Scope cross-refs 7.4)
  - _bmad-output/test-artifacts/test-design-epic-8.md (house style + depth; wave-2 planning-depth pattern for not-yet-frozen dependencies; 8.1 file model; 8.4 accepted-evidence lock must AGREE with Epic 7)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (Epic 7 backlog; runs AFTER Epic 6, before Wave-2 8.2-8.5; 8.1 done)
  - _bmad-output/implementation-artifacts/deferred-work.md (8.1 quote_acceptance/job owner types INACTIVE; acceptance_evidence file-evidence UX = Epic 8.2; file_links no dedupe uniqueness — find-or-create deferred; 3.5 CompanySettingsSnapshot identity-partial; 4.x per-person ROT cap deferred)
  - supabase/migrations/20260704120000_file_storage_foundation.sql (files/file_links; owner_type quote_acceptance/job structurally valid but INACTIVE — Epic 7 activates them + acceptance_evidence/job_evidence purposes)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES enrollment + H4 inventory gate contract)
  - _bmad-output/auto-bmad/retro-notes/epic-5.md, epic-8.md (standing NFR carry; resumed-run artifact discipline; post-reset kong 502 false-green; coverage-inversion after RPC rewire)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 7 - Acceptance-To-Job Transaction

**Date:** 2026-07-05
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 7 — the epic that turns a **sent quote version into an
accepted customer commitment and a basic job/order, in one safe, idempotent, audited transaction**, and
then **locks the accepted state** behind a correction boundary. Four stories: off-system acceptance
evidence capture for a sent quote version, with adjusted-price handling (7.1); the idempotent,
transactional `acceptQuoteAndCreateJob` command — architecture §13's **highest-risk Phase A command**
(7.2); the minimal job/order record + tenant-admin traceability UX (7.3); and accepted-state
immutability enforced at command AND database level with an explicit audited-correction boundary (7.4).

**Epic goal (from epics.md):** Record quote acceptance and create the basic job/order from the accepted
quote in one safe, idempotent, audited workflow — without partial acceptance/job state, duplicate jobs
on retry, mutable acceptance evidence, adjusted-price ambiguity, or an unapproved correction policy.

**Why this epic is the riskiest transaction in Phase A:** every earlier epic either *built editable
state* (CRM, calc, money) or *froze a single artifact* (a quote snapshot, a PDF, a file). **Epic 7 is
the first epic that must atomically create MULTIPLE immutable records across multiple tables in one
transaction, AND be safe to call twice.** Architecture §13 and AR20 name `acceptQuoteAndCreateJob` the
single highest-risk command in the whole plan for exactly this reason. Four risk classes converge, and
three of them are new in their most consequential form:

1. **Idempotency (the headline).** A double-submit, a retried request, or a create-job attempt after an
   acceptance already exists must return the **existing** acceptance + job — never a second job, second
   acceptance, or second lifecycle transition. This is enforced by row locks + uniqueness constraints
   (one acceptance per sent quote version; one job source per acceptance) inside the RPC, not by a
   client check. Idempotency at the *database* is the property that keeps a customer commitment from
   silently forking.
2. **Atomicity / no partial state (NFR20).** Acceptance record + quote/version lifecycle update + job
   insert + quote/job/audit events must commit **or roll back together**. A mid-transaction failure must
   leave *nothing* — no orphaned acceptance, no half-accepted quote, no job with no acceptance, no
   dangling event. This is a behavioral rollback proof, not a field-exists check.
3. **Accepted-state immutability + correction boundary (ADR-A005, NFR12).** Once accepted, the accepted
   version reference, acceptance evidence, accepted price, accepted timestamp, channel, source quote
   total, and job source reference become immutable — blocked at **command validation AND DB
   constraint/trigger** (architecture §9), never just a disabled button. Corrections require an explicit
   audited workflow that Phase A intentionally does **not** implement (7.4 STOP) — this epic proves the
   *boundary* holds, not a correction workflow.
4. **Isolation across new commitment tables.** `quote_acceptances`, `jobs`, and the `job_events` /
   `quote_events` lifecycle-event tables are new tenant-owned tables carrying customer commitment and
   price data — each needs the full Epic 2-5 pattern (direct `tenant_id`, composite same-tenant FKs,
   enable+**force** RLS, `anon → none`, `TENANT_TABLES` enrollment) plus cross-tenant negatives. A
   cross-tenant leak here exposes another tenant's *accepted prices and commitments*.

**The two consumed dependencies — one frozen on main, one NOT yet implemented:**

- **Story 8.1's file model is merged on `main`** (`files`/`file_links`, private bucket, signed access).
  Its `owner_type` union already lists `quote_acceptance` and `job` as **structurally valid but
  INACTIVE** — link creation for those types is gated at the command layer until the owner tables exist
  (deferred-work.md, 8.1 iteration-2 note). **Epic 7 ACTIVATES the `quote_acceptance` owner type and the
  `acceptance_evidence` purpose** (7.1 evidence file id), and the `job` owner type + `job_evidence`
  purpose (7.3). 7.1 can record an *external evidence reference* immediately; file-upload evidence UX is
  completed by Epic 8.2 (epics.md 7.1 tech note). This is a **known integration surface**, not new file
  infrastructure — Epic 7 must NOT invent a competing file/evidence model (the 8.1 single-file-model
  contract, R-814).
- **Epic 6's `quote_versions` / sent-state lifecycle is NOT yet implemented** (sprint-status: Epic 6
  backlog; Epic 7 runs after Epic 6). Acceptance is only legal on a **sent** quote version, so the
  acceptance-precondition scenarios (accept a sent version; reject a draft/rejected/expired/cross-tenant
  version) consume a lifecycle Epic 6 owns. **This design covers Epic 7 to full implementable depth for
  the acceptance-to-job transaction, idempotency, atomicity, and immutability mechanisms, and covers the
  sent-state PRECONDITION scenarios to planning depth** — cross-referenced to Epic 6's frozen sent-state
  and re-confirmed at each create-story once `quote_versions`/sent-state exists, rather than forking the
  lifecycle rule table (the same approach epic-8 took for its Wave-2 lock matrix). This is intentional,
  not a gap: detailing the exact "which quote states permit acceptance" matrix before Epic 6 freezes the
  state machine would fork the rule table.

**Risk Summary:**

- Total risks identified: **19**
- High-priority risks (score ≥6): **11**
- Critical (score 9 / auto-BLOCK at design time): **0** — but **five controls are epic blockers
  regardless of numeric score**: (a) any new commitment table (`quote_acceptances`/`jobs`/`job_events`/
  `quote_events`) unenrolled in `TENANT_TABLES` / missing enable+force RLS + own-tenant policies +
  `anon → none` (R-701 — the H4 gate makes this CI-fatal by design); (b) a **duplicate acceptance or
  duplicate job** creatable on retry/double-submit through any path (R-702 — DB uniqueness constraints
  are a 7.2 acceptance criterion; a client-only idempotency check is a STOP); (c) **partial
  acceptance/job state surviving a mid-transaction failure** (R-703 — NFR20; single-transaction rollback
  is a 7.2 AC); (d) **accepted immutable fields mutable through ANY app path or a direct own-tenant SQL
  UPDATE** (R-704 — DB-level enforcement is a 7.4 AC; UI-only locking is a story STOP); (e) real
  PII/secret in an acceptance/job golden fixture (R-717, held at mitigate-control like Epic 4/5/6/8
  fixture risks).
- Critical categories: **DATA** (idempotency/duplicate prevention, atomicity/no-partial-state,
  accepted-state immutability, accepted-price integrity) — the dominant class this epic, matching its
  transactional nature — then **SEC** (isolation on the new commitment tables, cross-tenant acceptance/
  job rejection, evidence-file access), then **BUS/compliance** (adjusted-price reason/evidence gating,
  correction-boundary policy, no public acceptance endpoint, fixture privacy).

**Coverage Summary:**

- **P0 (Critical):** ~30-44 tests — migration reset + RLS negatives + `TENANT_TABLES` enrollment for
  all new commitment tables; cross-tenant acceptance/job rejection; **acceptance only on a sent
  quote version** (draft/rejected/expired/cross-tenant rejected); **retry/double-submit idempotency**
  (second call returns the existing acceptance + job, no duplicate); **duplicate-prevention uniqueness
  constraints** (one acceptance per version, one job per acceptance) at the DB; **injected mid-transaction
  failure ⇒ full rollback, no partial state**; adjusted-price reason/evidence required + öre discipline;
  accepted-state immutability at command AND direct SQL; job source references immutable + accurate;
  fixture privacy scan extension.
- **P1 (High):** ~18-28 tests — acceptance capture form validation + adjusted-price delta display; job/
  order detail traceability UX (source version, evidence, accepted price, no deferred labels); repeated
  acceptance/create-job UX shows the existing state (UX-DR24); acceptance-evidence link via the 8.1 file
  model (`quote_acceptance` owner type activation, external-reference path); audit/event writes for
  acceptance + job creation; job list filter/search with no field-worker/Fortnox surface; correction-
  boundary UX message.
- **P2 (Medium):** ~8-12 tests — lifecycle edge transitions (accept an already-accepted version;
  accept then attempt second job); a11y/keyboard on acceptance form + job detail; documented Lovable
  mutable-acceptance delta; adjusted-price zero/negative/over-total boundaries; job allowed-edit scope
  (title/status/planned-dates) if approved.
- **P3 (Low):** ~3-6 tests — exploratory concurrent-accept fuzz (two parallel accepts of the same
  version ⇒ one wins, one idempotent-returns), DX typed errors, residual docs (correction workflow,
  per-person ROT cap carry).
- **Total:** ~59-90 tests across UNIT / INT / RLS / E2E / GOLDEN / DOCS levels.

---

## Dependency Posture & Planning Depth (read this before the coverage plan)

Epic 7 sits **between two dependencies with opposite maturity**, and that shapes how deep each part of
this design goes:

| Dependency | State | Effect on this design |
| --- | --- | --- |
| **Story 8.1 file model** (`files`/`file_links`, private bucket, signed access, `quote_acceptance`/`job` owner types + `acceptance_evidence`/`job_evidence` purposes structurally present but INACTIVE) | **DONE, merged on `main`** | **Full depth now.** Epic 7 ACTIVATES the `quote_acceptance` owner type (7.1 evidence link) and the `job` owner type (7.3 job evidence) by wiring the command-layer ownership validation the 8.1 migration deferred. 7.1's evidence can be an external reference immediately; file-upload evidence UX is Epic 8.2. Epic 7 REUSES `files`/`file_links` and MUST NOT invent a competing evidence model (R-814 single-file-model contract). |
| **Epic 6 `quote_versions` / sent-state lifecycle** (mark-sent, `QUOTE_VERSION_LOCKED`, immutable sent snapshot) | **NOT implemented** (Epic 6 backlog; Epic 7 runs after Epic 6) | **Transaction/idempotency/immutability mechanisms = full depth; sent-state PRECONDITION scenarios = planning depth.** The "acceptance only on a sent version; reject draft/rejected/expired" matrix consumes Epic 6's state machine, which is not yet frozen. This design fixes those scenarios' *shape, risk, and dependency gate* now and cross-references Epic 6's frozen sent-state; the exact permitted-state list is re-confirmed at 7.1/7.2 create-story once `quote_versions`/sent-state exists — rather than forking the lifecycle rule table (the epic-8 Wave-2 pattern). |

**Why this is not a gap:** the transactional core of Epic 7 (idempotency, atomicity, uniqueness
constraints, accepted-state immutability at the DB, the new-table isolation) is fully specifiable and
testable *now* against architecture §13 + ADR-A005/A009 — it does not need Epic 6's snapshot internals,
only that a "sent quote version" row exists to reference. The single part that depends on Epic 6's
not-yet-frozen state machine — *which quote-version states are acceptance-eligible* — is the one held at
planning depth. Designing that matrix before Epic 6 freezes `draft/sent/accepted/rejected/expired/
superseded` would fork the rule table and risk disagreement between the mark-sent gate (Epic 6) and the
acceptance gate (Epic 7).

**Standing contract this epic honors:** the acceptance/job *lifecycle-immutability rule* (accepted →
locked at command AND DB) must **AGREE** with Epic 6's sent-immutability (R-605) and with Epic 8.4's
accepted-evidence file lock (which epic-8's design explicitly cross-references to Epic 7). The three
enforcement points — sent-version snapshot freeze (Epic 6), accepted-record immutability (Epic 7),
locked-evidence-file (Epic 8.4) — describe **one** immutability model at three scopes; a divergence
between them is a design defect and a STOP condition.

---

## Inherited Foundation (what Epic 7 builds on, not rebuilds)

Epics 2-6 (+ 8.1) shipped the isolation harness, the money engine, the snapshot/immutability discipline,
and the file model Epic 7 now composes into the acceptance-to-job transaction. Verified in-repo (8.1 on
`main`; Epics 2-5 done; Epic 6 pending but its contracts are fixed by the epic-6 design). Epic 7 must
**reuse**, not re-invent:

| Inherited asset | Where | Epic 7 obligation |
| --- | --- | --- |
| Tenant-table pattern: direct `tenant_id`, composite same-tenant parent FK, enable+**force** RLS with own-tenant `is_tenant_admin` policies, `anon → none` GRANT, archive-over-delete, `set_updated_at()` | `supabase/migrations/20260630120000_crm_data_model.sql`, `20260702120000_calculation_data_model.sql`, `20260704120000_file_storage_foundation.sql` | `quote_acceptances` (→ `quote_versions`/`quotes` same-tenant FKs), `jobs` (→ `quote_acceptances`/`quote_versions` + customer/facility/contact same-tenant FKs), `job_events`/`quote_events` (→ jobs/quotes) each REUSE the exact pattern. A bare non-composite FK is a cross-tenant hole. NO field-worker/schedule/time-material/deviation/invoice/Fortnox table (epics.md 7.x non-scope). |
| `TENANT_TABLES` enrollment + H4 inventory gate (compile-exhaustive; FAILS CI on an unenrolled tenant table) | `tests/integration/rls/tenant-table-inventory.ts` | **STANDING CONTRACT:** every new commitment table (`quote_acceptances`, `jobs`, `job_events`, `quote_events` if new here) MUST enroll with spoof/filter/mutation metadata BEFORE merge. R-701's automated backstop. |
| Server command Result model: typed `Result<T, CommandErrorCode>`, `verifyOwnership` (zero rows ⇒ `TENANT_ACCESS_DENIED`), validation never echoes raw values, allow-listed audit metadata; stable codes incl. **`QUOTE_VERSION_LOCKED`**, **`ACCEPTANCE_ALREADY_RECORDED`**, **`COMMAND_CONFLICT`** | `src/server/commands/envelope.ts`, `command-errors.ts`; architecture §5 | 7.1/7.2/7.4 commands REUSE this. A cross-tenant quote-version/acceptance/job id ⇒ `TENANT_ACCESS_DENIED`; an idempotent re-accept returns existing (not an error, per 7.2 AC2) OR `ACCEPTANCE_ALREADY_RECORDED` where a distinct conflict must surface; a mutation of an accepted record ⇒ a stable lock code (exact-code negative assertions). Cross-tenant failures return the GENERIC code — no existence disclosure. |
| **Narrow Postgres RPC discipline (ADR-A009)** — proven by Epic 5's atomic reorder RPCs, designed for Epic 6's version RPCs, and **explicitly naming `acceptQuoteAndCreateJob`** as a mandated narrow-RPC command | `supabase/migrations/2026070*` calc RPCs; `20260704120000_*` `link_existing_file`/`create_file_with_link`; ADR-A009; epics.md 7.2 tech note; AR21 | 7.2's `accept_quote_and_create_job` RPC owns: row locks on the quote version + parent quote row, sent-state + tenant verification, idempotent existing-record return, uniqueness constraints (one acceptance/version, one job/acceptance), multi-row insert (acceptance + job + events + audit), explicit timestamp parameters (`accepted_at`, command ts — H1, no wall-clock), and rollback. Security **invoker** unless a separately approved definer design. Mechanism change without ADR = STOP. |
| **Immutability-by-DB discipline** (architecture §9: immutable lifecycle tables — `quote_versions` when sent, `quote_acceptances`, locked file snapshots, audit events — block normal updates via triggers/constraints/command-only rules, NOT UI disabling); proven behaviorally by Epic 6's sent-immutability design (R-605) and the 8.1 append-only/locked patterns | architecture §9/§6; ADR-A005; epic-6 design R-605; `20260629121136_audit_events.sql` (append-only trigger) | 7.4 composes the SAME discipline for `quote_acceptances` + `jobs` source references: command guard (stable lock code) AND DB trigger/constraint reject mutation of the immutable field set; the freeze proof is behavioral (attempt mutation via command AND via direct own-tenant authenticated UPDATE). Must AGREE with Epic 6 (R-605) and Epic 8.4. |
| Pure `@/lib/money` engine — integer öre, `bigint`, `CHECK >= 0`, canonical `isOreAmount`/`ORE_AMOUNT_MAX`, single kronor formatter | `src/lib/money/**` | Accepted price + source sent total are stored in öre (7.1/7.2 money impact HIGH/CRITICAL); the adjusted-price DELTA is computed with the engine, never re-derived ad hoc; new öre columns reuse the canonical guards. Golden tests cover accepted-price cases incl. adjusted (architecture §12: "acceptance with unchanged and adjusted accepted price"). |
| **Story 8.1 file model** (`files`/`file_links`, private bucket, server-derived paths, signed access, command-layer ownership validation; `owner_type` union incl. `quote_acceptance`/`job` structurally valid but INACTIVE) | `supabase/migrations/20260704120000_file_storage_foundation.sql`; `src/server/commands/files/**` | **INTEGRATION SURFACE, LANDED.** 7.1 activates the `quote_acceptance` owner type + `acceptance_evidence` purpose for evidence links (external reference now; file-upload UX is Epic 8.2); 7.3 activates `job`/`job_evidence`. Epic 7 REUSES the file model + signed access; a competing evidence-storage model is a STOP (R-814). Note the 8.1 deferral: `file_links` has NO dedupe uniqueness — 7.1/7.3 decide find-or-create vs a constraint when they wire the link (deferred-work 8.1 iter-2). |
| Frozen-snapshot / capture-by-value discipline (Epic 3→4→5, designed-for-6) | `src/lib/snapshots/**`; epic-6 design | The accepted price, source quote total, accepted version reference, and evidence reference are **captured commitment data** (7.2 money impact CRITICAL) — stored by value at acceptance time, immutable thereafter; the job/order detail DISPLAYS them from the immutable references, never re-derives (UX-DR26, R-708). |
| Two-runner stack + Playwright E2E (CI-gated, `SUPABASE_TEST_REQUIRED=1`) + two-tenant fixture + per-run unique ids; goldens under `tests/unit/**` (runner-glob trap); golden PII/secret + ORGNR scan | project-context Testing Rules; `scripts/run-tests.mjs`; `tests/factories/**` | 7.1/7.2/7.4 land INT + RLS; 7.1/7.3 acceptance-form + job-detail land E2E; accepted-price + accepted-quote-to-job goldens land under `tests/unit/**` with origin labelling (new-expected / documented Lovable delta). |
| `audit_events` append-only + own-tenant-read, allow-listed sanitized metadata | `20260629121136_audit_events.sql`; architecture §15 | 7.2/7.4 write acceptance-recorded, job-created, and correction-attempt-rejected events through this SAME table — NO raw accepted price echoed as PII, allow-listed metadata only. File audit (evidence linked) flows through the 8.1/§15 path. |

**What is genuinely NEW in Epic 7 (needs fresh coverage):** the `quote_acceptances` + `jobs` (+
`job_events` / any new `quote_events`) tables + RLS + enrollment; the acceptance-capture command with
adjusted-price reason/evidence gating; the **`acceptQuoteAndCreateJob` transaction** — the first
Phase A command that atomically creates *multiple immutable records across multiple tables and must be
idempotent under retry* (row locks + uniqueness constraints + rollback); the minimal job/order record +
traceability UX; **accepted-state immutability enforced at the DB**; the activation of the
`quote_acceptance`/`job` owner types on the 8.1 file model. This is a full-stack, transaction-centric
epic — UNIT + INT + RLS + E2E + GOLDEN + DOCS.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Customer portal / public acceptance route / webhook / e-sign** | epics.md 7.x explicit non-scope; architecture §5 "no public quote acceptance route, customer portal, webhook, cron, or privileged unauthenticated function exists in Phase A" | Guardrail tests assert NO public/unauthenticated acceptance endpoint, portal route, webhook, or cron exists (7.1 AC "no customer portal or public acceptance endpoint is created"); mirrors the epic-6 "no public acceptance endpoint" guardrail. |
| **The Epic 6 quote-version snapshot, sent-immutability, and PDF pipeline** | Epic 6 owns the snapshot freeze (R-603), sent immutability (R-605), and PDF source-of-truth (R-606) | Epic 7 consumes a *sent* quote version as its precondition and cross-references Epic 6's sent-state; it re-proves only the ACCEPTED-state immutability + the transaction. The sent-eligibility matrix is at planning depth pending Epic 6 (see Dependency Posture). |
| **File-upload evidence UX (drag/drop, validation, entity panels)** | Epic 8.2 owns upload UX + validation (R-808/R-811); 7.1 records an EXTERNAL evidence reference or an already-uploaded file id | 7.1 activates the `quote_acceptance` owner type + `acceptance_evidence` purpose on the 8.1 model and accepts an external reference now; the full upload UX/validation is Epic 8.2 (cross-ref). Broad storage negatives stay Epic 8. |
| **A broad correction/edit workflow after acceptance** | epics.md 7.4 STOP condition + architecture §11 "corrections after acceptance are explicit audited workflows, not edits" — the workflow itself is owner-gated | 7.4 enforces the immutability BOUNDARY only (mutation rejected at command + DB; UI explains corrections need an approved audited workflow); it does NOT implement a correction workflow (STOP). The correction policy is an owner-gated residual (R-714). |
| **Field-worker UX / schedule depth / time-material / deviation / ÄTA / project analytics** | epics.md 7.3 explicit non-scope; ADR-A008 field-workflow SEAM only; `jobs` is a MINIMAL accepted-work record (architecture §"Field Workflow") | 7.3 job detail + list assert NO field-worker schedule, time/material, deviation, ÄTA, project-analytics, invoice, or Fortnox UI/route/label (7.3 AC + guardrail, R-711). |
| **Invoicing / Fortnox / billing adapter** | Deferred (AGENTS.md); architecture "Fortnox Sync: Not in Phase A"; the billing adapter is a documented BOUNDARY only | Migration test asserts no invoice/Fortnox/billing-adapter table; job detail shows no invoice/Fortnox affordance; the accepted job/order is the boundary a FUTURE adapter consumes, not built here. |
| **Adjusted-price policy semantics (which adjustments are permitted / require which evidence)** | epics.md 7.1 STOP condition — accepted-price adjustment policy, accepted evidence channels, and correction semantics are owner-gated | Tests pin the MECHANISM (a delta from the sent total requires an explicit reason/evidence and shows the delta before confirm) against conservative defaults; the exact policy/channel constants are an owner residual (R-713), re-confirmed at 7.1 create-story. Under demo-data-only (2026-07-03) not a current blocker. |
| **Per-person ROT cap multiplier** | Carried deferral from Epic 4 (deferred-work: `persons` captured but flat-cap; Sign-Off Q3) | Accepted-price tests use the accepted price as stored; they do NOT depend on the per-person cap. The carry is a documented residual (R-716), not re-opened here. |
| **Acceptance/job performance / bulk operations / scale** | Pilot-sized NFRs only; no Phase A SLA | Single-acceptance transactional correctness + idempotency is the concern; perf is a documented residual (R-718), add only if an SLA emerges. |
| **Real Lovable acceptance/job data import** | Lovable is a behavioral oracle only (ADR-A007) | Accepted-quote-to-job goldens are anonymized shape-only; the intentional delta — Lovable's *mutable* acceptance evidence / *client-side* multi-step acceptance vs Phase A's immutable, single-transaction model — is a DOCUMENTED delta (7.2/7.4 migration note), never copied behavior. |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT,
4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

**Impact rationale (why so many Impact 3):** Epic 7 produces and locks a customer *commitment* — an
accepted quote and the job/order derived from it. A cross-tenant leak now exposes another tenant's
accepted prices and commitments; a duplicate job or acceptance forks a legal commitment and corrupts
every downstream record (job traceability, migration sign-off); a partial-state failure leaves a
half-accepted quote that no later epic can trust; a mutable accepted field silently rewrites a
commitment the customer relied on. These are **Impact 3**. **Probability is held at 2** for most: the
isolation harness, the narrow-RPC + row-lock + uniqueness pattern, and the DB-immutability discipline
are all proven (Epics 2-5, 8.1), so the residual risk is *correct composition of a new, multi-record,
idempotent-under-retry transaction* — the first of its kind in Phase A. Probability rises where the
mechanism is genuinely first-of-kind and subtle (idempotency under true concurrency, R-702), and drops
to 1 where an automated gate makes silent failure hard (fixture PII scan) or where failure is
degraded-not-critical (UX plumbing, docs).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-701 | SEC | **New commitment-table isolation gap** — any of `quote_acceptances`/`jobs`/`job_events`/`quote_events` ships without direct `tenant_id`, enable+**force** RLS + own-tenant policies, `anon → none`, or **unenrolled in `TENANT_TABLES`** → cross-tenant read/write of another tenant's accepted prices, commitments, and jobs | 2 | 3 | 6 | Reuse the proven migration pattern verbatim on ALL new tables; composite same-tenant FKs (job → acceptance → quote_version → quote); enroll everything in `TENANT_TABLES` with spoof/filter/mutation metadata BEFORE merge (H4 gate CI-fatal otherwise); migration-reset + cross-tenant + anon-path negatives per table | Dev (7.1/7.2/7.3) | Stories 7.1-7.3 |
| R-702 | DATA | **Duplicate acceptance / duplicate job on retry or double-submit** — a retried `acceptQuoteAndCreateJob`, a double-click, or a create-job attempt after an acceptance exists creates a SECOND acceptance/job/lifecycle transition; or idempotency is a client-only check outside the transaction → a forked customer commitment | 2 | 3 | 6 | **DB uniqueness constraints** (one acceptance per quote version; one job source per acceptance) + row locks on the quote version + parent quote inside the narrow RPC; on re-entry the RPC returns the EXISTING acceptance + job idempotently (7.2 AC2); INT retry test asserts a second identical call returns the same ids and creates NO second row; concurrency test drives two parallel accepts ⇒ exactly one creates, the other idempotent-returns; client-only idempotency is a STOP | Dev (7.2) | Story 7.2 |
| R-703 | DATA | **Partial acceptance/job state on mid-transaction failure** — a step failure leaves an orphaned acceptance, a half-accepted quote lifecycle, a job with no acceptance, or a dangling quote/job/audit event committed (NFR20 violation) | 2 | 3 | 6 | ALL of acceptance + lifecycle update + job insert + event/audit writes in ONE narrow-RPC transaction (ADR-A009); INT injects a failure at each step boundary (e.g. constraint violation on the job insert) and asserts NOTHING is committed — no acceptance, no lifecycle change, no job, no event; behavioral rollback proof, not field-exists; matches architecture §13 step 10 "commit or roll back all changes together" | Dev (7.2) | Story 7.2 |
| R-704 | DATA/BUS | **Accepted-state immutability bypass** — accepted version reference, acceptance evidence, accepted price, accepted timestamp, channel, source quote total, or job source reference is mutable through a command path OR a direct own-tenant SQL UPDATE because locking is command-only / UI-only (ADR-A005 / NFR12 violation) | 2 | 3 | 6 | Two independent layers per 7.4 AC + architecture §9: command validation (⇒ stable lock code) AND DB triggers/constraints block updates to the immutable field set; INT negatives attempt mutation via command AND via direct authenticated UPDATE; UI-only locking is a STOP; must AGREE with Epic 6 sent-immutability (R-605) and Epic 8.4 accepted-evidence lock | Dev (7.4) | Story 7.4 |
| R-705 | DATA/BUS | **Adjusted accepted price accepted without reason/evidence, or accepted price/total not in öre** — a delta from the sent total is confirmed with no explicit adjustment reason/evidence, or accepted price / source total is stored as float/kronor → an unexplained or imprecise commitment | 2 | 3 | 6 | 7.1 AC: an accepted price differing from the sent quote total REQUIRES explicit adjustment reason/evidence and SHOWS the delta before confirm; command re-validates server-side (client cannot bypass); accepted price + source sent total stored in öre (`bigint`, canonical guards); UNIT delta computation + INT reason-required negative + GOLDEN unchanged-vs-adjusted accepted-price cases | Dev (7.1/7.2) | Stories 7.1, 7.2 |
| R-706 | BUS/DATA | **Acceptance recorded against a non-sent (or cross-tenant) quote version** — a draft, rejected, expired, superseded, or another tenant's quote version is accepted because the sent-state precondition is not enforced server-side; or the check consumes an Epic 6 lifecycle that is not yet frozen and forks the rule table | 2 | 3 | 6 | Command + RPC verify the quote version belongs to the tenant AND is in the sent state BEFORE recording (architecture §13 step 3); INT negatives: draft/rejected/expired/cross-tenant version ⇒ user-safe rejection; **sent-eligibility matrix cross-referenced to Epic 6's frozen sent-state, re-confirmed at 7.1/7.2 create-story** (planning depth pending Epic 6 — do NOT fork the state machine) | Dev (7.1/7.2) | Stories 7.1, 7.2 (after Epic 6) |
| R-707 | SEC | **Cross-tenant source id accepted into the transaction** — `acceptQuoteAndCreateJob` accepts a foreign `quote_version_id`, or the evidence link accepts a foreign file id, or a bare FK lets the acceptance/job point at another tenant's parent | 2 | 3 | 6 | Composite same-tenant FKs at the DB (acceptance → version, job → acceptance/version); command re-validates quote-version + evidence-file ownership under RLS (`verifyOwnership`, zero rows ⇒ `TENANT_ACCESS_DENIED`); INT negatives spoof a foreign quote-version id AND a foreign evidence file id; generic error (no existence disclosure) | Dev (7.1/7.2) | Stories 7.1, 7.2 |
| R-708 | DATA | **Job/order shows wrong or mutable source data** — the job detail re-derives or re-reads mutable data for source quote version, accepted price, evidence, or source totals instead of displaying the immutable accepted references → the job disagrees with the commitment it was created from | 2 | 3 | 6 | Job stores IMMUTABLE source references (accepted version id, acceptance id) at creation; detail DISPLAYS accepted price / source totals / evidence from those immutable references, never re-derives (UX-DR26); INT: mutate any mutable upstream source after job creation ⇒ job detail data unchanged; source refs are non-editable (7.3 AC) | Dev (7.3) | Story 7.3 |
| R-709 | SEC/DATA | **Acceptance-evidence file access / activation gap** — activating the `quote_acceptance` owner type on the 8.1 model links a foreign file, or the evidence file is reachable cross-tenant/anon, or a competing evidence model is invented instead of reusing `files`/`file_links` | 2 | 3 | 6 | REUSE the 8.1 file model + command-layer ownership validation to activate `quote_acceptance`/`acceptance_evidence` (external reference now; upload UX Epic 8.2); INT: evidence link creation rejects a foreign file id; cross-tenant + anon access to the evidence file/metadata rejected via 8.1's signed-access funnel; NO competing evidence model (R-814 STOP); full storage-negative breadth stays Epic 8 (cross-ref) | Dev (7.1) | Story 7.1 |
| R-710 | OPS/DATA | **Partial job-side / event / audit write** — the acceptance commits but the job/order, `job_events`, `quote_events`, or `audit_events` write is missing (or vice versa) because they are not in the same transaction, or a retry duplicates events | 2 | 3 | 6 | All acceptance + job + `job_events` + `quote_events` + `audit_events` writes inside the ONE narrow-RPC transaction (architecture §13 steps 6-10); INT asserts every expected event/audit row is present on success and ABSENT on rollback; retry writes NO duplicate events (idempotent re-entry short-circuits before insert); allow-listed audit metadata, no raw price PII | Dev (7.2) | Story 7.2 |
| R-717 | SEC/BUS | **Acceptance/job golden-fixture PII leak** — accepted-quote-to-job fixtures embed a real customer name/address/personnummer/orgnr/secret, or a real accepted-price tied to a real customer, in `tests/fixtures/golden/**` or a committed artifact | 1 | 3 | 3 → held at 6-equivalent control | Anonymized shape-only fixtures; REUSE + extend the CI golden PII/secret + ORGNR scan to acceptance/job fixtures; committed real PII is an epic blocker regardless of score (mirrors R-411/R-516/R-615/R-819); keep öre values under the 10-digit orgnr-scan boundary (epic-4/5 authoring constraint) | Dev (7.1/7.2/7.3) | Stories 7.1-7.3 |

### Medium-Priority Risks (Score 4-5)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-711 | BUS | **Job/order surface leaks deferred scope** — the job detail or list grows a field-worker schedule, time/material, deviation, ÄTA, project-analytics, invoice, or Fortnox affordance/label/route (scope creep beyond the minimal accepted-work record) | 2 | 2 | 4 | 7.3 AC + guardrail: job detail/list show ONLY source quote/acceptance, customer/facility/contact, basic title/status, planned dates, files, event history; E2E/guardrail asserts absence of every deferred label/route; `Jobb/Order` working label until owner picks terminology (7.3 tech note) | Dev (7.3) + Rasmus |
| R-712 | BUS | **Repeated acceptance/create-job UX confuses instead of showing the existing state** — a re-attempt shows an error or a new form instead of the existing acceptance/job (UX-DR24 violation), even though the command is idempotent | 2 | 2 | 4 | UX-DR24: a repeated acceptance/create-job attempt shows the EXISTING accepted state/job, not a duplicate or an error; E2E: attempt acceptance twice ⇒ second attempt lands on the existing acceptance/job view; mirrors the idempotent command behavior at the UI (R-702 link) | Dev (7.3) |
| R-713 | BUS | **Adjusted-price policy / accepted-evidence channels unapproved for real pilot** — conservative dev defaults for which adjustments/channels are permitted reach real-pilot use without owner approval (7.1 STOP) | 1 | 2 | 2 → doc under demo-data-only | DOCUMENT: conservative defaults fine for demo-data-only MVP (2026-07-03); the exact adjustment policy + accepted-evidence channel set is an owner Sign-Off residual re-confirmed at 7.1 create-story; 7.1 STOP if policy materially differs from conservative assumptions. Re-score if real-customer use is proposed | Rasmus (accept authority) |
| R-714 | BUS | **Correction-workflow policy undecided; the boundary must not leak a back door** — Phase A locks accepted data with NO correction workflow; a legitimate correction need must have no silent edit path, and the future workflow is owner-gated | 2 | 2 | 4 | 7.4 AC + STOP: NO normal edit path changes immutable accepted data; the event is never hidden/silently overwritten; UI explains corrections need an approved audited workflow; the correction workflow itself is a STOP requiring owner-approved policy/story; INT regression asserts accidental update paths (empty-patch, id-only update, bulk update) do not mutate accepted fields | Dev (7.4) + Rasmus |
| R-715 | TECH | **Lifecycle/acceptance non-determinism from wall-clock reads** — the RPC reads `now()` internally instead of taking explicit `accepted_at` / command-timestamp parameters, making acceptance timing non-deterministic and hard to test (H1 violation) | 2 | 2 | 4 | RPC takes explicit `accepted_at` + command-timestamp parameters (epics.md 7.2 tech note H1; architecture §13); no internal wall-clock; INT drives deterministic timestamps; UNIT-pins the timestamp-injection adapter (mirrors Epic 6 mark-sent's injected timestamp) | Dev (7.2) |
| R-716 | BUS | **Per-person ROT cap carry reaches Epic 7 accepted price** — the flat-cap `persons` deferral (Epic 4 Sign-Off Q3) is still open; an accepted price derived from a ROT quote inherits the flat-cap placeholder | 1 | 2 | 2 → doc | DOCUMENT: Epic 7 stores the accepted price as given; it does NOT re-run the ROT engine, so the per-person carry does not change acceptance behavior. Surface the standing carry in the gate; owner Sign-Off Q3 owns resolution (deferred-work epic-4). Re-score only if acceptance is asked to re-derive tax | Rasmus (accept authority) |

### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- |
| R-718 | PERF | Acceptance/job transaction latency / concurrent-accept throughput untested (pilot-sized load only, no SLA) | 1 | 2 | 2 | DOCUMENT; add only if an SLA emerges. Functional idempotency/atomicity correctness, not perf, is the Phase A concern. |
| R-719 | OPS | **Standing NFR carry reaches a SEVENTH epic surface** — `pnpm audit` CI gate + coverage reporter still unresolved (carried Epics 2-6, resolution forced "before Epic 6 closes" per epic-5 retro) | 1 | 2 | 2 | DOCUMENT with dated status in the gate: the standing NFR CONCERN (audit gate / coverage reporter) must show resolved-or-dated-accept, not a further silent carry; surface for the owner schedule-or-accept at the Epic 7 gate. Not test effort — a calendar item |

### Risk Category Legend

- **DATA**: Data Integrity (idempotency/duplicate prevention, atomicity/no-partial-state, accepted-state immutability, accepted-price integrity, job source-of-truth, partial event/audit writes)
- **SEC**: Security (new commitment-table isolation, cross-tenant source ids, acceptance-evidence file access, fixture PII)
- **BUS**: Business/Compliance (adjusted-price reason gating, correction-boundary policy, sent-eligibility precondition, deferred-scope creep, repeated-attempt UX, policy approvals)
- **TECH**: Technical (timestamp-injection determinism)
- **OPS**: Operations (partial event/audit plumbing, standing NFR carry)
- **PERF**: Performance (transaction latency, no SLA)

---

## Testability Notes (Epic-Level)

1. **RLS negatives BEFORE positives, and enrollment is the completeness guarantee.** `quote_acceptances`,
   `jobs`, `job_events`, and any new `quote_events` enroll in `TENANT_TABLES` so the H4 gate + shared
   cross-tenant/anon suites cover them automatically. The event tables (`job_events`) are easy to forget —
   they are tenant-owned state and enroll like any other table. Do not hand-write ad-hoc isolation tests
   that bypass the inventory (five-epic precedent).
2. **The headline proof is idempotency, and it has two forms — sequential retry AND true concurrency.**
   (a) *Sequential retry:* call `acceptQuoteAndCreateJob` twice with the same input, assert the second
   returns the SAME acceptance + job ids and creates NO second row (the UNIQUE constraints + the RPC's
   existing-record short-circuit are the mechanism). (b) *Concurrency:* drive two parallel accepts of the
   same sent version with `Promise.all` (sleep-free, per the standing harness rule) — exactly one creates,
   the other either idempotent-returns the winner's records or fails cleanly with `COMMAND_CONFLICT`/
   `ACCEPTANCE_ALREADY_RECORDED`; NEVER two jobs. A test that only proves the happy-path single accept is
   not evidence of idempotency.
3. **Atomicity is a behavioral rollback proof, not a field-exists check.** Inject a failure at a step
   boundary inside the transaction (e.g. force the job insert to violate a constraint, or the event write
   to fail) and assert the END STATE is empty — no acceptance, no lifecycle change, no job, no event.
   Field-exists assertions on the happy path do not prove NFR20. Use the ADR-A009 RPC's single
   transaction boundary so the rollback is directly testable below the command layer (the epic-8/epic-5
   RPC-rollback precedent).
4. **Accepted immutability is two-layer and behavioral (7.4).** Attempt mutation of each immutable field
   (accepted version ref, evidence, accepted price, accepted_at, channel, source total, job source ref)
   through the command (assert the lock code) AND through a direct own-tenant authenticated UPDATE (assert
   the trigger/constraint rejects). A test that only proves the UI disables the button is not evidence
   (architecture §9; mirrors Epic 6 R-605). Also drive the "accidental update path" regressions — id-only
   update, empty-patch, bulk update — and prove none mutate accepted fields (7.4 AC).
5. **The immutability model must AGREE across three epics.** The accepted-record lock (Epic 7), the
   sent-version snapshot freeze (Epic 6 R-605), and the locked-evidence-file (Epic 8.4) are ONE model at
   three scopes. Cross-reference, do not fork: 7.4's lock-code and rejection behavior should be the same
   family as `QUOTE_VERSION_LOCKED` and the 8.4 file-lock code, and epic-8's design already commits 8.4 to
   AGREE with Epic 7. A divergence is a STOP.
6. **Sent-eligibility is planning-depth pending Epic 6 — cross-reference, don't fork.** The
   "acceptance only on a sent version; reject draft/rejected/expired/superseded/cross-tenant" matrix
   consumes Epic 6's not-yet-frozen state machine. Fix the scenario SHAPE + the dependency gate now;
   re-confirm the exact permitted-state list at 7.1/7.2 create-story once `quote_versions`/sent-state
   exists. Do not encode a speculative state list that could disagree with Epic 6's mark-sent gate.
7. **Adjusted-price gating is server-side and behavioral.** The delta-requires-reason rule must be
   re-validated in the command (client cannot bypass); INT drives an adjusted price with NO reason and
   asserts rejection, and an adjusted price WITH reason and asserts acceptance + the delta captured.
   Extract the pure delta/reason-required decision into a `.ts` module for the fast unit gate (the
   coverage-shape lesson — a helper buried in a `"use client"` component escapes the node:test gate).
8. **Evidence-link activation reuses 8.1 — do not build a second file model.** 7.1 activates the
   `quote_acceptance` owner type + `acceptance_evidence` purpose by wiring the command-layer ownership
   validation the 8.1 migration left deferred; the link and access go through `files`/`file_links` + the
   signed-access funnel. Note the 8.1 deferral: `file_links` has no dedupe uniqueness — decide
   find-or-create vs a constraint when wiring the evidence link, and test the chosen semantics
   (deferred-work 8.1 iter-2).
9. **E2E hygiene as established:** two-tenant fixture, `crypto.randomUUID()` seeds for count assertions,
   red-phase ATDD headers cleared when flipping green, goldens under `tests/unit/**`. Acceptance/job E2E
   asserts the acceptance form, the adjusted-price delta display, the job traceability, the
   repeated-attempt-shows-existing behavior (UX-DR24), and deferred-surface absence — not the
   transaction internals (that is INT territory — duplicate-coverage guard).
10. **Env + resumed-run discipline (retro standing practice):** poll `/auth/v1/health` to 200 after
    `supabase db reset` before trusting a local INT run (the post-reset Kong 502 false-green trap, epic-5/8
    retros); `SUPABASE_TEST_REQUIRED=1` in CI hard-fails a missing stack. Any resumed story re-verifies
    scaffold completeness (`describe.skip`/`notYetImplemented`), exported-but-unimplemented command
    surface, and sprint-status freshness against disk before trusting recorded state. **And (epic-8
    retro):** if a review fix rewires the transaction off one RPC onto another, re-check that the
    idempotency/privilege negatives still target the LIVE entry point — a coverage inversion is easy to
    miss after an RPC swap.

---

## Entry Criteria

- [ ] Epics 1-5 merged and green in `main` — isolation harness, money engine, snapshot contract,
      command envelope + `verifyOwnership` + Result model, `audit_events` append-only, two-tenant fixture
      all live (verified: through-Epic-5 gates PASS).
- [ ] **Story 8.1 (file foundation) landed and green** — the single Phase A file model exists on `main`
      with `quote_acceptance`/`job` owner types + `acceptance_evidence`/`job_evidence` purposes
      structurally present (INACTIVE); 7.1/7.3 activate them via command-layer ownership validation and
      MUST NOT create a competing evidence model (R-814). Verified: 8.1 done.
- [ ] **Epic 6 landed and green (sent-state lifecycle frozen)** — `quote_versions`, mark-sent,
      `QUOTE_VERSION_LOCKED`, and the sent-immutability model exist so acceptance has a sent version to
      reference and the sent-eligibility matrix can be finalized at 7.1/7.2 create-story (R-706). Epic 7
      runs AFTER Epic 6 (sprint-status). If Epic 6 slips, the transaction/idempotency/immutability
      mechanisms are still specifiable, but the sent-eligibility scenarios stay at planning depth.
- [ ] **Acceptance-to-job data model agreed** — `quote_acceptances` (accepted version ref, channel,
      `accepted_at`, accepted price öre, adjustment reason/evidence, evidence file/reference, notes,
      planned start/end dates), `jobs` (immutable source version + acceptance refs, customer/facility/
      contact, title/status, planned dates), `job_events`/`quote_events`, and the **uniqueness
      constraints** (one acceptance per version, one job source per acceptance) per architecture §13.
- [ ] **`accept_quote_and_create_job` RPC approach agreed** under ADR-A009 — narrow RPC, security
      **invoker** default (any definer needs separate approval + fixed `search_path` + membership checks +
      negative tests); row locks on the quote version + parent quote; explicit `accepted_at` +
      command-timestamp parameters (H1); rollback + idempotent existing-record return. A mechanism change
      is a 7.2 STOP.
- [ ] **Adjusted-price policy + accepted-evidence channels chosen (conservative dev defaults)** — the
      exact policy is an owner Sign-Off residual (R-713) re-confirmed at 7.1 create-story; not a real-pilot
      blocker under demo-data-only (2026-07-03).
- [ ] **Correction-workflow policy explicitly deferred** — Phase A locks accepted data with NO correction
      workflow; the audited-correction workflow is owner-gated (7.4 STOP, R-714). The gate must restate
      this so the boundary is proven without implying a workflow was built.
- [ ] **Standing NFR mechanism resolved** — `pnpm audit` CI gate + coverage reporter shown
      resolved-or-dated-accept, not a seventh silent carry (R-719; epic-5 retro forced resolution before
      Epic 6 closes — restate status here).
- [ ] Anonymized Lovable acceptance/job oracle examples available for delta capture (no real data copied);
      the mutable-acceptance / client-side-multi-step vs immutable-single-transaction delta is pre-agreed
      as an intentional, documented delta.

## Exit Criteria

- [ ] All P0 tests passing (100%).
- [ ] All P1 tests passing or each failure explicitly triaged/waived (≥95%).
- [ ] **Isolation proven** — all new commitment tables (`quote_acceptances`/`jobs`/`job_events`/
      `quote_events`) enrolled in `TENANT_TABLES`; H4 gate green; cross-tenant read/write + anon negatives
      pass per table; foreign quote-version/evidence-file ids rejected with `TENANT_ACCESS_DENIED`.
- [ ] **Migration reset from empty proven** with per-table policy enumeration; no field-worker/schedule/
      time-material/deviation/invoice/Fortnox tables.
- [ ] **Idempotency proven** — a retried/double-submitted `acceptQuoteAndCreateJob` returns the existing
      acceptance + job and creates NO duplicate; DB uniqueness constraints (one acceptance/version, one
      job/acceptance) present + exercised; concurrent-accept ⇒ exactly one job.
- [ ] **Atomicity proven** — an injected mid-transaction failure leaves NO partial state (no acceptance,
      no lifecycle change, no job, no event); commit-or-rollback-together.
- [ ] **Accepted immutability proven at BOTH layers** — command mutation ⇒ stable lock code; direct
      own-tenant SQL UPDATE ⇒ rejected by trigger/constraint; every immutable field (version ref, evidence,
      accepted price, accepted_at, channel, source total, job source ref) covered; accidental update paths
      (id-only/empty-patch/bulk) do not mutate; AGREES with Epic 6 (R-605) and Epic 8.4.
- [ ] **Sent-precondition gated** — acceptance rejected on a draft/rejected/expired/superseded/cross-tenant
      quote version (final permitted-state list confirmed against Epic 6 at create-story).
- [ ] **Adjusted price gated + öre-correct** — a delta from the sent total requires explicit reason/evidence
      and shows the delta before confirm; accepted price + source total stored in öre; unchanged-vs-adjusted
      accepted-price GOLDEN green.
- [ ] **Job traceability proven** — job detail displays source version, evidence, accepted price, source
      totals, customer/facility/contact from immutable references; mutating upstream sources after job
      creation leaves job detail unchanged; source refs non-editable; no deferred-scope labels/routes.
- [ ] **Evidence-link activation proven** — `quote_acceptance` owner type activated on the 8.1 model;
      foreign evidence file id rejected; cross-tenant + anon evidence-file access rejected via signed access;
      no competing evidence model.
- [ ] **Event/audit completeness proven** — acceptance-recorded, job-created, and correction-attempt-
      rejected events + audit rows present on success, ABSENT on rollback, no duplicate on retry, allow-listed
      metadata (no raw price PII).
- [ ] **No public acceptance surface** — no unauthenticated/public acceptance endpoint, portal route,
      webhook, or cron exists (guardrail green).
- [ ] **Fixture privacy green** — CI PII/secret + ORGNR scan covers acceptance/job fixtures; no real PII;
      öre values under the 10-digit orgnr-scan boundary.
- [ ] No open high-priority (≥6) risk unmitigated/unwaived; R-719 (standing NFR mechanism) reported
      resolved-or-dated in the gate; R-706 (Epic 6 dependency) and R-713/R-714 (owner-gated policies)
      restated with their re-confirmation triggers visible.

---

## Test Coverage Plan

> **P0/P1/P2/P3 = priority / risk classification, NOT execution timing.** Execution timing is defined
> separately in the Execution Strategy section below.

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels: **UNIT** (pure `node --test`), **INT** (Vitest,
DB-backed command/migration/RPC), **RLS** (Vitest cross-tenant/anon negatives via the shared inventory),
**E2E** (Playwright), **GOLDEN** (data-driven UNIT over `tests/fixtures/golden/**`), **DOCS** (documented
residual/assumption). Counts are ranges (no false precision).

### P0 (Critical)

**Criteria**: Blocks core (isolation / commitment integrity / transaction safety) + high risk (≥6) + no
workaround.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1-INT-01 | Migration reset from empty creates `quote_acceptances`/`jobs`/`job_events`(+`quote_events` if new) with tenant ownership, composite same-tenant parent FKs, immutable source refs, öre columns, uniqueness constraints; NO field-worker/schedule/time-material/deviation/invoice/Fortnox tables (7.x non-scope) | INT | R-701 | 2-3 | Dev | Per-table policy enumeration; deferred-table absence; öre columns `bigint` + `CHECK >= 0` |
| 7.1-RLS-01 | Cross-tenant read/write + anon-path rejected on every new commitment table | RLS | R-701 | 6-10 | Dev | Via `TENANT_TABLES` enrollment; spoof/filter/mutation metadata per table |
| 7.1-RLS-02 | H4 inventory gate green — all new tables enrolled (`quote_acceptances`/`jobs`/`job_events`/`quote_events`) | RLS | R-701 | 1 | Dev | Unenrolled table fails CI by design |
| 7.1-INT-02 | Acceptance capture rejects a draft/rejected/expired/superseded/cross-tenant quote version with a user-safe error (7.1 AC3) | INT | R-706, R-707 | 3-4 | Dev | **Sent-eligibility list confirmed vs Epic 6 at create-story** (planning depth pending Epic 6) |
| 7.1-INT-03 | Adjusted accepted price (≠ sent total) REQUIRES explicit adjustment reason/evidence, re-validated server-side; missing reason ⇒ rejected (7.1 AC2) | INT | R-705 | 2-3 | Dev | Client cannot bypass; delta captured |
| 7.1-UNIT-01 | Adjusted-price delta + reason-required decision, pure, öre-based, canonical guards; extracted to `.ts` for the fast gate (coverage-shape lesson) | UNIT | R-705 | 3-4 | Dev | Delta computed with the engine, not ad hoc |
| 7.1-INT-04 | Acceptance-evidence link activates the `quote_acceptance` owner type on the 8.1 model; foreign evidence file id ⇒ `TENANT_ACCESS_DENIED`; cross-tenant + anon evidence-file access rejected via signed access; NO competing evidence model (7.1 tech note; R-814) | INT | R-709 | 2-3 | Dev | External reference path now; upload UX = Epic 8.2 (cross-ref) |
| 7.2-INT-01 | `acceptQuoteAndCreateJob` happy path: records acceptance, updates quote/version lifecycle to accepted, creates minimal job, writes quote/job/audit events, commits together (7.2 AC1; architecture §13) | INT | R-703, R-710 | 2-3 | Dev | The full-transaction success case; RPC via ADR-A009 |
| 7.2-INT-02 | **Retry idempotency:** a second identical call returns the EXISTING acceptance + job ids, creates NO second acceptance/job/lifecycle transition/event (7.2 AC2; UX-DR24) | INT | R-702, R-710 | 3-4 | Dev | The headline proof; second call short-circuits before insert |
| 7.2-INT-03 | **Duplicate-prevention uniqueness constraints** at the DB: one acceptance per quote version, one job source per acceptance — a direct second insert violates the constraint (architecture §13 uniqueness) | INT | R-702 | 2-3 | Dev | DB-level backstop below the command; not client-only |
| 7.2-INT-04 | **Atomicity / no partial state:** an injected mid-transaction failure (constraint violation on the job insert / event write) leaves NO acceptance, NO lifecycle change, NO job, NO event (7.2 AC3; NFR20) | INT | R-703 | 3-4 | Dev | Behavioral rollback proof at each step boundary |
| 7.2-INT-05 | Cross-tenant + anonymous `acceptQuoteAndCreateJob` rejected (foreign quote-version id ⇒ `TENANT_ACCESS_DENIED`; anon ⇒ `UNAUTHENTICATED`); generic error, no existence disclosure (7.2 test req) | INT/RLS | R-707, R-701 | 2-3 | Dev | Composite-FK + command-validation backstop |
| 7.2-INT-06 | Concurrent accept: two parallel `Promise.all` accepts of the same sent version ⇒ exactly ONE creates, the other idempotent-returns or `COMMAND_CONFLICT`/`ACCEPTANCE_ALREADY_RECORDED`; NEVER two jobs (7.2 idempotency) | INT | R-702 | 2-3 | Dev | Row-lock proof; sleep-free concurrency; per-run unique tenants |
| 7.4-INT-01 | Post-acceptance mutation of any immutable field (accepted version ref/evidence/price/accepted_at/channel/source total/job source ref) via COMMAND ⇒ stable lock code (7.4 AC1) | INT | R-704 | 3-4 | Dev | Exact error-code assertions; field-by-field |
| 7.4-INT-02 | Post-acceptance mutation via DIRECT own-tenant authenticated UPDATE ⇒ rejected by trigger/constraint (7.4 AC1: "database constraints/triggers reject") | INT | R-704 | 2-3 | Dev | Below-the-command proof; UI-only locking is a STOP; AGREES with Epic 6/8.4 |
| 7.4-INT-03 | Accidental update-path regression: id-only update, empty-patch, and bulk update do NOT mutate accepted fields and never silently overwrite the event (7.4 AC2) | INT | R-704, R-714 | 2-3 | Dev | The "no normal edit path changes immutable data" guarantee |
| 7.4-RLS-01 | Cross-tenant attack on accepted records (tenant A/B) — read + immutable-field update both fail (7.4 AC3) | RLS/INT | R-701, R-704 | 2-3 | Dev | Tenant A vs tenant B acceptances/jobs |
| 7.x-UNIT-01 | Fixture/artifact privacy: PII/secret + ORGNR scan extended to acceptance/job fixtures (standing control); öre values under the 10-digit boundary | UNIT | R-717 | 1-2 | Dev | CI-gated; blocker regardless of score |

**Total P0**: ~30-44 tests

### P1 (High)

**Criteria**: Important correctness/behavior + medium/high risk + common paths.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1-E2E-01 | Acceptance capture form: channel, accepted timestamp, admin user, evidence file/reference, accepted price (öre), notes, planned start/end dates; no public/portal endpoint (7.1 AC1) | E2E | R-711 | 2-3 | Dev | Two-tenant fixture; unique-id seeding |
| 7.1-E2E-02 | Adjusted-price flow: entering an accepted price ≠ sent total shows the delta and requires an adjustment reason/evidence before confirm (7.1 AC2) | E2E | R-705 | 2-3 | Dev | UI mirror of the INT-proven rule |
| 7.1-INT-05 | Accepted price + source sent total stored in öre; audit event written for acceptance capture with allow-listed metadata (no raw price PII) (7.1 money/audit) | INT | R-705, R-710 | 2-3 | Dev | Öre discipline + audit hygiene |
| 7.2-INT-07 | Every expected event/audit row (acceptance-recorded, job-created, quote/job lifecycle events) present on success and no DUPLICATE on retry (7.2 AC1/AC2) | INT | R-710 | 2-3 | Dev | Idempotent re-entry writes no second event |
| 7.2-GOLDEN-01 | Accepted-quote-to-job goldens: unchanged accepted price AND adjusted accepted price; source references + öre totals pinned; documented Lovable transactional delta labelled (7.2 migration note; architecture §12 "acceptance with unchanged and adjusted accepted price") | GOLDEN | R-705, R-717 | 2-3 | Dev | Under `tests/unit/**`; anonymized; origin-labelled |
| 7.3-E2E-01 | Job/order detail shows source quote version, acceptance evidence, accepted price, customer/facility/contact, basic title/status, planned dates, files, event history; source refs non-editable (7.3 AC1; UX-DR26) | E2E | R-708 | 2-3 | Dev | Traceability from immutable references |
| 7.3-INT-01 | Job detail data unchanged after mutating any upstream mutable source post-creation — source-of-truth proof from immutable refs (7.3 AC1) | INT | R-708 | 2-3 | Dev | Regenerate/re-read unchanged |
| 7.3-E2E-02 | Repeated acceptance/create-job attempt shows the EXISTING accepted state/job, not a duplicate or an error (UX-DR24) | E2E | R-712, R-702 | 1-2 | Dev | UI mirror of idempotency |
| 7.3-E2E-03 | Job list filter/search by customer/status/planned-date/source-quote; NO field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/Fortnox UI (7.3 AC2; guardrail) | E2E | R-711 | 2-3 | Dev | Deferred-surface absence scan |
| 7.4-E2E-01 | On a mutation attempt against accepted data, the UI explains that corrections require an approved audited workflow (7.4 AC1) | E2E | R-714 | 1-2 | Dev | Message + no silent edit affordance |
| 7.x-E2E-01 | No public/unauthenticated acceptance endpoint, portal route, webhook, or cron exists (7.1 test req; architecture §5) | E2E/INT | — | 1-2 | Dev | Guardrail scan (mirrors epic-6) |
| 7.3-INT-02 | Allowed job edits (title/status/planned dates, if approved by 7.3) are audited; source quote/acceptance refs remain non-editable (7.3 tech note) | INT | R-708, R-711 | 1-2 | Dev | Phase A-safe edits only; audit on any allowed change |

**Total P1**: ~18-28 tests

### P2 (Medium)

**Criteria**: Secondary behavior + low/medium risk + edge cases.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 7.2-INT-08 | Lifecycle edge: accepting an ALREADY-accepted version, and a second create-job attempt on an existing acceptance, both idempotent-return the existing records (no error path duplication) | INT | R-702, R-712 | 2-3 | Dev | Closed-transition idempotency edges |
| 7.1-UNIT-02 | Adjusted-price boundaries: zero, negative, and over-sent-total accepted prices handled per policy (rejected or reason-gated); öre overflow guarded | UNIT | R-705 | 2-3 | Dev | Canonical `ORE_AMOUNT_MAX` guard |
| 7.1-E2E-03 | Keyboard navigation + a11y on the acceptance form and confirm dialog; focus moves predictably on completing acceptance (UX-DR35); status/labels use text not color alone | E2E | R-711 | 2-3 | Dev | A11y baseline (epic-6 pattern) |
| 7.3-E2E-04 | Accessibility on job detail/list controls; predictable focus opening/closing job dialogs | E2E | — | 1-2 | Dev | |
| 7.4-DOCS-01 | Documented intentional delta vs Lovable mutable acceptance evidence / client-side multi-step acceptance (7.2/7.4 migration note) | DOCS | R-704 | 1 | Dev | Oracle delta register; never copied |
| 7.2-UNIT-01 | Timestamp-injection adapter unit-pinned: RPC takes explicit `accepted_at`/command ts, no wall-clock (H1) | UNIT | R-715 | 1-2 | Dev | Determinism proof (mirrors Epic 6 mark-sent) |

**Total P2**: ~8-12 tests

### P3 (Low)

**Criteria**: Nice-to-have + exploratory + benchmarks.

| Test ID | Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 7.2-INT-09 | Exploratory concurrency fuzz: N randomized interleaved accepts of the same version ⇒ exactly one job, others idempotent/`COMMAND_CONFLICT` | INT | 1-2 | Dev | Exploratory; not a gate |
| 7.x-DOCS-01 | Residual notes: correction-workflow deferral (R-714), adjusted-price/channel policy residual (R-713), per-person ROT cap carry (R-716), transaction perf (R-718), standing NFR mechanism (R-719) | DOCS | 1 | Dev | Awareness/assumption register |
| 7.x-UNIT-02 | DX: clear typed errors for unknown lifecycle transitions / duplicate-accept / unsupported job states | UNIT | 1-2 | Dev | Developer ergonomics |

**Total P3**: ~3-6 tests

---

## Execution Strategy

**Philosophy: run everything in every PR that can run in <15 min; the DB/E2E suites are the only real
cost.** Same shape as Epics 5/6/8 (full-stack epic):

- **Every PR (the gate):**
  - All Epic 7 UNIT + GOLDEN (`pnpm test:unit`) — adjusted-price delta/reason logic, timestamp-injection
    adapter, accepted-quote-to-job goldens (unchanged + adjusted), fixture PII/ORGNR scan. Seconds.
  - All Epic 7 INT + RLS (`pnpm test:int`, local Supabase stack) — migration reset, the
    `accept_quote_and_create_job` RPC (happy path + retry idempotency + uniqueness constraints +
    injected-failure rollback + concurrent accept), sent-eligibility + cross-tenant rejection, accepted
    immutability (command + direct SQL), accidental-update regressions, event/audit completeness,
    evidence-link activation, H4 gate. `SUPABASE_TEST_REQUIRED=1` hard-fails a missing stack (the
    post-reset Kong 502 false-green trap makes this non-negotiable).
  - Epic 7 E2E (`pnpm test:e2e`, Playwright) — acceptance form + adjusted-price delta, job traceability,
    repeated-attempt-shows-existing, deferred-surface absence, no-public-acceptance guardrail. Within the
    15-min bar.
- **Nightly / Weekly:** nothing Epic-7-specific. (Transaction perf / concurrent-accept throughput deferred,
  R-718 — add only if an SLA emerges. The P3 concurrency fuzz stays on-demand.)

Standard triage order: smoke (login + open one sent quote → acceptance form) → P0 (isolation +
idempotency + atomicity + accepted immutability) → P1 (traceability + adjusted-price UX + event/audit) →
P2/P3.

### Smoke Tests (<5 min)

- [ ] New commitment-table migration-reset + H4 inventory gate green (INT)
- [ ] `acceptQuoteAndCreateJob` cross-tenant + anon rejection (INT)
- [ ] Retry idempotency: second identical accept returns existing, no duplicate (INT)

### P0 Tests (<10 min — PR gate)

- [ ] Commitment-table RLS cross-tenant + anon negatives (RLS)
- [ ] Sent-eligibility + foreign quote-version/evidence-id rejection (INT)
- [ ] Uniqueness constraints (one acceptance/version, one job/acceptance) (INT)
- [ ] Injected mid-transaction failure ⇒ full rollback, no partial state (INT)
- [ ] Concurrent accept ⇒ exactly one job (INT)
- [ ] Accepted immutability: command lock code + direct-SQL rejection + accidental-update regression (INT)
- [ ] Fixture PII/ORGNR scan (UNIT)

### P1/P2/P3 Tests (<30-60 min)

- [ ] Acceptance form + adjusted-price delta UX (E2E) · öre + audit (INT)
- [ ] Job traceability + source-of-truth + repeated-attempt-shows-existing (E2E/INT)
- [ ] Deferred-surface absence + no-public-acceptance guardrail (E2E/INT)
- [ ] Accepted-quote-to-job goldens unchanged+adjusted (GOLDEN) · lifecycle edges + a11y + delta doc (INT/E2E/DOCS)

---

## Resource Estimates

Ranges, not false precision. Epic 7 pays the **DB/RLS tax on ~3-4 new tables + a first-of-kind
transactional-command tax** (idempotency under retry AND concurrency, multi-step rollback, two-layer
immutability), but SAVES on math and file infrastructure — the money engine and the 8.1 file model are
inherited and pinned; 7.x asserts *capture, transaction safety, and preservation*, not arithmetic or new
storage.

| Priority | Count (range) | Effort (range) | Notes |
| --- | --- | --- | --- |
| P0 | ~30-44 | ~30-48 h | Migration/RLS enrollment + the transaction suite (idempotency/atomicity/uniqueness/concurrency) + two-layer immutability dominate |
| P1 | ~18-28 | ~16-28 h | Acceptance form + adjusted-price UX + job traceability + event/audit + goldens |
| P2 | ~8-12 | ~5-9 h | A11y, lifecycle edges, adjusted-price boundaries, delta doc, timestamp adapter |
| P3 | ~3-6 | ~2-4 h | Exploratory concurrency fuzz / DX / residual docs |
| **Total** | **~59-90** | **~53-89 h (~1.5-2.5 weeks, 1 dev)** | Comparable to Epics 5/6; the transaction suite is the one new fixed cost (idempotency + rollback fault injection) |

**Prerequisites**

- **Test data:** two-tenant factory extended with a sent-quote-version fixture (from Epic 6 once landed;
  a synthetic sent-version row until then), acceptance/job/event seeds + cleanup; anonymized
  accepted-quote-to-job golden fixtures under `tests/fixtures/golden/**` (origin-labelled, öre < 10
  digits); count-asserting tests seed `crypto.randomUUID()`; a fault-injection hook for the
  rollback/atomicity tests.
- **Tooling:** existing runners (node --test / Vitest / Playwright) — no new runner; the 8.1 file model +
  signed-access harness reused for evidence links; PII/secret + ORGNR scan extended to acceptance/job
  fixtures.
- **Environment:** local Supabase CLI stack for INT/RLS/E2E (health-poll `/auth/v1/health` to 200 after
  reset); Epic 6 sent-state lifecycle for the acceptance precondition (planning depth until landed); the
  8.1 file model for evidence links.

**Non-effort dependency (calendar time):** the standing NFR mechanism (R-719, `pnpm audit` gate +
coverage reporter) is a calendar item, not test effort — it must appear resolved-or-dated in this epic's
gate. Epic 6 landing (sent-state) is the sequencing prerequisite for the sent-eligibility scenarios
(R-706).

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational)
- **High-risk (≥6) mitigations:** 100% complete or approved waivers

### Coverage Targets

- **Transaction command (idempotency/atomicity/uniqueness) logic:** 100% of the specified failure/retry/
  concurrency paths covered
- **RLS negatives:** 100% of new commitment tables enrolled + exercised
- **Accepted-immutability proofs:** 100% of immutable fields covered by a mutate-via-command AND
  mutate-via-direct-SQL test; accidental-update regressions covered
- **Rollback proof:** 100% of transaction step boundaries covered by an injected-failure ⇒ no-partial-state
  test
- **Adjusted-price + öre discipline:** 100% of accepted-price columns öre; unchanged + adjusted goldens
  present

### Non-Negotiable (epic blockers regardless of numeric score)

- [ ] Every new commitment table: direct `tenant_id` + enable+**force** RLS + own-tenant policies +
      `anon → none` + **`TENANT_TABLES` enrollment** (H4 green)
- [ ] No cross-tenant quote-version/acceptance/job/evidence id accepted by any command
- [ ] **No duplicate acceptance or duplicate job on retry/double-submit/concurrency** — DB uniqueness
      constraints present; idempotent re-entry returns existing
- [ ] **No partial acceptance/job state** on a mid-transaction failure — commit-or-rollback-together (NFR20)
- [ ] **Accepted data immutable at the DATABASE** (trigger/constraint), not just command/UI; mutation via
      command returns a stable lock code; AGREES with Epic 6 (R-605) and Epic 8.4
- [ ] Adjusted accepted price requires explicit reason/evidence; accepted price + source total in öre
- [ ] Acceptance only on a sent, own-tenant quote version (final permitted-state list confirmed vs Epic 6)
- [ ] Job source references immutable + accurate; job surface carries no deferred-scope labels/routes
- [ ] No public/unauthenticated acceptance endpoint, portal, webhook, or cron
- [ ] **No real PII/secret** in any acceptance/job fixture or committed artifact (CI scan green)
- [ ] R-719 resolved per the epic-5 retro hard mechanism: audit-gate/coverage status shown
      resolved-or-dated in this epic's gate report — a further silent carry is a gate CONCERNS by definition

---

## Mitigation Plans (High-Priority, Score ≥6)

### R-701: New commitment-table isolation gap (Score 6, enrollment-gated)

**Strategy:** Reuse the proven migration pattern verbatim on `quote_acceptances`/`jobs`/`job_events`/
`quote_events`; composite same-tenant FKs down the job → acceptance → version → quote chain; enroll
everything in `TENANT_TABLES` with spoof/filter/mutation metadata before merge (compile-exhaustive; H4
CI-fatal). **Owner:** Dev (7.1-7.3). **Timeline:** Stories 7.1-7.3.
**Verification:** `7.1-INT-01`, `7.1-RLS-01/02`.

### R-702: Duplicate acceptance / duplicate job on retry or concurrency (Score 6)

**Strategy:** DB uniqueness constraints (one acceptance per quote version, one job per acceptance) + row
locks on the version + parent quote inside the narrow RPC; idempotent existing-record return on re-entry;
sequential-retry AND concurrent-accept proofs; client-only idempotency is a STOP. **Owner:** Dev (7.2).
**Timeline:** Story 7.2. **Verification:** `7.2-INT-02/03/06` (+ `7.2-INT-08` edges, `7.2-INT-09`
exploratory).

### R-703: Partial acceptance/job state on mid-transaction failure (Score 6)

**Strategy:** All acceptance + lifecycle + job + event/audit writes in ONE narrow-RPC transaction
(ADR-A009); inject a failure at each step boundary and assert nothing commits; behavioral rollback proof
(NFR20). **Owner:** Dev (7.2). **Timeline:** Story 7.2. **Verification:** `7.2-INT-01/04`.

### R-704: Accepted-state immutability bypass (Score 6)

**Strategy:** Two independent layers — command guard (stable lock code) AND DB trigger/constraint per
architecture §9; negatives attempt both routes field-by-field; accidental-update-path regressions;
AGREES with Epic 6 (R-605) and Epic 8.4; UI-only locking is a STOP. **Owner:** Dev (7.4). **Timeline:**
Story 7.4. **Verification:** `7.4-INT-01/02/03`, `7.4-RLS-01`.

### R-705: Adjusted price ungated / not in öre (Score 6)

**Strategy:** A delta from the sent total requires explicit adjustment reason/evidence, re-validated
server-side, delta shown before confirm; accepted price + source total stored in öre with canonical
guards; delta computed with the engine. **Owner:** Dev (7.1/7.2). **Timeline:** Stories 7.1, 7.2.
**Verification:** `7.1-INT-03`, `7.1-UNIT-01`, `7.2-GOLDEN-01`.

### R-706: Acceptance on a non-sent / cross-tenant version (Score 6, Epic-6-dependency-gated)

**Strategy:** Command + RPC verify tenant ownership AND sent state before recording; INT negatives on
draft/rejected/expired/superseded/cross-tenant; **the exact sent-eligibility list is cross-referenced to
Epic 6's frozen sent-state and confirmed at 7.1/7.2 create-story** (planning depth pending Epic 6 — do
not fork the state machine). **Owner:** Dev (7.1/7.2). **Timeline:** Stories 7.1, 7.2 (after Epic 6).
**Verification:** `7.1-INT-02`, `7.2-INT-05`.

### R-707: Cross-tenant source id accepted into the transaction (Score 6)

**Strategy:** Composite same-tenant FKs at the DB; command re-validates quote-version + evidence-file
ownership under RLS (zero rows ⇒ `TENANT_ACCESS_DENIED`); INT negatives spoof a foreign version id AND a
foreign evidence file id; generic error. **Owner:** Dev (7.1/7.2). **Timeline:** Stories 7.1, 7.2.
**Verification:** `7.1-INT-02/04`, `7.2-INT-05`.

### R-708: Job shows wrong/mutable source data (Score 6)

**Strategy:** Job stores immutable source references at creation; detail displays accepted price/source
totals/evidence from those references, never re-derives; mutate any upstream source after job creation ⇒
job detail unchanged; source refs non-editable. **Owner:** Dev (7.3). **Timeline:** Story 7.3.
**Verification:** `7.3-E2E-01`, `7.3-INT-01`.

### R-709: Acceptance-evidence file access / activation gap (Score 6)

**Strategy:** Activate the `quote_acceptance` owner type + `acceptance_evidence` purpose on the 8.1 model
via command-layer ownership validation (external reference now, upload UX Epic 8.2); reject a foreign
evidence file id; cross-tenant + anon evidence access rejected via the 8.1 signed-access funnel; NO
competing evidence model (R-814 STOP). **Owner:** Dev (7.1). **Timeline:** Story 7.1.
**Verification:** `7.1-INT-04`.

### R-710: Partial job-side / event / audit write, or duplicate events on retry (Score 6)

**Strategy:** All job + `job_events` + `quote_events` + `audit_events` writes inside the ONE RPC
transaction; every expected event/audit row present on success, ABSENT on rollback, no duplicate on retry;
allow-listed metadata, no raw price PII. **Owner:** Dev (7.2). **Timeline:** Story 7.2.
**Verification:** `7.2-INT-01/04/07`.

### R-717: Acceptance/job fixture PII leak (held at mitigate-control)

**Strategy:** Anonymized shape-only fixtures; extend the CI PII/secret + ORGNR scan to acceptance/job
fixtures; keep öre values under the 10-digit orgnr-scan boundary; a committed real identifier is an epic
blocker regardless of score. **Owner:** Dev (7.1/7.2/7.3). **Timeline:** Stories 7.1-7.3.
**Verification:** `7.x-UNIT-01`.

---

## Open Assumptions

1. **Epic 6 lands before Epic 7** (sprint-status). The transaction/idempotency/immutability/isolation
   mechanisms are specifiable now; the sent-eligibility precondition scenarios stay at planning depth
   until Epic 6 freezes `quote_versions`/sent-state, then are confirmed at 7.1/7.2 create-story (R-706).
2. **Story 8.1 is the single Phase A file model** (landed). Epic 7 activates the `quote_acceptance`/`job`
   owner types + `acceptance_evidence`/`job_evidence` purposes; it does NOT build a competing evidence
   store (R-814). `file_links` has no dedupe uniqueness — 7.1/7.3 decide find-or-create vs a constraint
   when wiring the link (deferred-work 8.1 iter-2).
3. **`accept_quote_and_create_job` is a narrow security-invoker RPC** (ADR-A009) with row locks,
   uniqueness constraints, explicit timestamps (H1), and rollback; a definer variant or a mechanism
   change is a 7.2 STOP.
4. **Adjusted-price policy + accepted-evidence channels remain conservative dev defaults** until owner
   Sign-Off; tests pin the mechanism, not the policy constants (R-713). Under demo-data-only (2026-07-03)
   this is an accepted residual; a real-customer proposal re-scores it.
5. **No correction workflow is built in Phase A** — 7.4 proves only the immutability boundary; the audited
   correction workflow is owner-gated (R-714, 7.4 STOP).
6. **The immutability model is one model at three scopes** — Epic 6 sent freeze (R-605), Epic 7 accepted
   lock, Epic 8.4 locked evidence — and must AGREE; a divergence is a STOP.
7. **Lovable's mutable-acceptance / client-side-multi-step behavior** is an intentional, documented Phase A
   delta — goldens label it, never replicate it.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **`TENANT_TABLES` inventory + H4 gate** | New commitment tables enroll | `rls-inventory-gate.int.test.ts`, `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts` must stay green with `quote_acceptances`/`jobs`/`job_events`(/`quote_events`) added |
| **Server command envelope + `verifyOwnership`** | New acceptance/job commands reuse it | `envelope-*.int.test.ts`, `server-error-vs-no-access.int.test.ts` — generic-error / no-existence-disclosure discipline preserved; new stable codes (`ACCEPTANCE_ALREADY_RECORDED`/`COMMAND_CONFLICT`/lock) exercised |
| **`audit_events` (append-only)** | Acceptance/job/correction-attempt events written through it | `audit-append-only.int.test.ts`, `audit-metadata-hygiene-e2e.int.test.ts` — no raw accepted-price/PII in metadata; no duplicate audit on retry |
| **Migration-reset suite** | New migration in the chain | `migration-reset.int.test.ts` + per-table policy enumeration must include the new commitment tables |
| **Story 8.1 file model (`files`/`file_links`, signed access)** | Epic 7 activates `quote_acceptance`/`job` owner types + `acceptance_evidence`/`job_evidence` purposes | `file-link-ownership.int.test.ts`, `file-signed-access.int.test.ts`, `storage-object-isolation.rls.test.ts` stay green; the newly-active owner types get command-layer ownership validation + cross-tenant/anon evidence-access negatives; no competing model (R-814) |
| **Epic 6 quote_versions / sent-state (pending)** | Acceptance consumes a SENT version; accepted lifecycle transitions the version | Sent-eligibility scenarios cross-reference Epic 6's sent-state; Epic 6's sent-immutability (R-605) and Epic 7's accepted-immutability must AGREE — a shared lock-code family, not a fork |
| **Epic 8.4 accepted-evidence lock (Wave 2, pending)** | 8.4 locks the accepted evidence FILE; Epic 7 locks the accepted RECORD | epic-8 design commits 8.4 to AGREE with Epic 7 accepted immutability — the file lock and the record lock describe one model; cross-referenced, not re-invented |
| **Service-role containment guards** | Acceptance/job paths stay anon+RLS/server-command | `verify:service-role-containment` + `verify:bundle-containment` stay green — no service-role key on client acceptance/job paths |
| **Money engine (`@/lib/money`)** | Accepted price + source total + delta in öre | Money golden pack + öre-boundary orgnr scan stay green; new öre columns reuse canonical guards; no forked rounding/format |

---

## Follow-On Workflows

- `*atdd` — generate red-phase P0 scaffolds per story (run explicitly at story start; 7.1 first, then the
  7.2 transaction suite as the highest-stakes red phase).
- `*trace` — epic-boundary traceability + gate decision after stories land (confirm the sent-eligibility
  matrix was finalized against the landed Epic 6 sent-state).
- `*nfr-assess` — must show the R-719 standing-NFR-mechanism outcome (resolved or dated accept) and the
  transaction-latency residual (R-718) status.
- `*test-review` — suite quality after the epic suite lands, with special attention to the idempotency +
  rollback fault-injection tests (behavioral, not field-exists) and any RPC-swap coverage inversion
  (epic-8 retro lesson).

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification + gate decision rules
- `probability-impact.md` — P×I scoring methodology (thresholds: 1-3 DOCUMENT, 4-5 MONITOR, 6-8 MITIGATE, 9 BLOCK)
- `test-levels-framework.md` — UNIT / INT / RLS / E2E / GOLDEN / DOCS selection
- `test-priorities-matrix.md` — P0-P3 prioritization + execution ordering

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md` (FR41-FR48; NFR12/NFR20; UX-DR17/23/24/26/35)
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 7, lines 1401-1555)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (§13 Acceptance-To-Job Transaction Design; ADR-A005 immutable quote/acceptance; ADR-A009 narrow RPC; §5 command registry; §6/§9 immutable lifecycle tables; §7 quote_acceptances/jobs; §14 file model owner types; §15 audit)
- Dependent designs: `_bmad-output/test-artifacts/test-design-epic-6.md` (sent-state Epic 7 consumes; R-605 sent-immutability); `_bmad-output/test-artifacts/test-design-epic-8.md` (8.1 file model; 8.4 accepted-evidence lock AGREEs with Epic 7; wave-2 planning-depth pattern)
- Sequencing: `_bmad-output/implementation-artifacts/sprint-status.yaml` (Epic 7 after Epic 6, before Wave-2 8.2-8.5; 8.1 done)
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md` (8.1 quote_acceptance/job owner types INACTIVE — Epic 7 activates; file_links no dedupe; per-person ROT cap carry)
- Project context: `_bmad-output/project-context.md` (Money/Tax/Quote Rules; Testing Rules; Security Regression Harness Rules; demo-data-only decision)

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: {name} Date: {date}
- [ ] Tech Lead: {name} Date: {date}
- [ ] QA Lead: {name} Date: {date}

**Comments:** The transaction core (idempotency, atomicity, uniqueness, accepted immutability, new-table
isolation) is fully implementable now against architecture §13 + ADR-A005/A009 + the landed 8.1 file
model. The sent-eligibility precondition scenarios are at planning depth pending Epic 6's frozen
sent-state and are re-confirmed at 7.1/7.2 create-story — designing that matrix before Epic 6 freezes the
state machine would fork the lifecycle rule table. The accepted-immutability model must AGREE with Epic 6
sent-immutability (R-605) and Epic 8.4 locked evidence.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6) · Epic-Level (Phase 4)
