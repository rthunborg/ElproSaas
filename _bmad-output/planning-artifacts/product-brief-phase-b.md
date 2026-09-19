---
title: "Product Brief: ElproSaas — Phase B (Legacy Parity Release)"
status: "complete"
created: "2026-07-18"
updated: "2026-09-03"
author: "Rasmus (via autonomous /bmad-product-brief run)"
mode: "autonomous — non-interactive; all choices resolved against the ratified party-session record; judgment calls logged in the final section"
governedBy: "_bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md (decisions PB-D1..PB-D14 are binding on this brief)"
feeds: "Phase B PRD (/bmad-prd create) — the next planning artifact"
inputs:
  - _bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md
  - docs/planning/post-phase-a-plan-2026-07-08.md
  - docs/oracle/initial-system-audit-2026-06-01.md
  - docs/discovery/e0-domain-oracle-report.md
  - _bmad-output/planning-artifacts/owner-signoff-questions.md
  - _bmad-output/implementation-artifacts/epic-9-retro-2026-07-08.md
  - _bmad-output/planning-artifacts/prd.md (Phase A baseline, frozen)
  - _bmad-output/planning-artifacts/architecture.md (Phase A baseline, frozen)
  - _bmad-output/planning-artifacts/epics.md (Phase A baseline, frozen)
notes: "First product brief in the project (the Phase A PRD records productBriefs: 0). Phase A planning artifacts are frozen as the pilot record; Phase B siblings use the -phase-b filename suffix established by this file."
---

# Product Brief: ElproSaas — Phase B (Legacy Parity Release)

## Executive Summary

ElproSaas is the multi-tenant SaaS rebuild of a Swedish electrical contractor's legacy Lovable-built operations app. Phase A (Internal Pilot MVP, epics 1-9, complete 2026-07-08) proved the foundation on a deliberately narrow slice — CRM, pricing, calculations, immutable quote versions/PDF/acceptance, basic jobs, files, and a golden-master migration harness — delivered with tenant isolation + RLS, integer-öre money, immutable snapshots, server-side audited commands, and a 1378-test green gate. Stakeholders accepted the pilot and green-lit the next phase.

Phase B is the parity release: **everything the legacy app did, but better, on the Phase A architecture** (owner direction, 2026-07-08). The headline capabilities are **Jobs & Projects depth** and **Time planning & scheduling for employees and teams**, with all modules built **inter-connected** — jobs ↔ scheduling ↔ people ↔ materials ↔ economy ↔ documents — not as siloed pages. Phase B also productizes what the legacy app never had safely: real multi-company delivery (tenant provisioning/onboarding, full RBAC with non-admin roles) and money-out (billing basis, then **Fortnox**). When Phase B is done, the pilot company runs its whole operation in the new system, the legacy app can be retired (the owner's stated cutover criterion is "at least all functionality the Lovable app has"), and the product can be offered to independent electrical companies.

The work is one phase — one PRD, one architecture extension, one epics doc — internally sequenced into four waves (B1a foundations, B1b operational core, B2 asset & service operations, B3 content/compliance/money-out), sized honestly at **21-25 candidate epics, roughly 2.5× Phase A** (PB-D1, PB-D10). All AI flows and other net-new surface are hard-excluded to Phase C.

**Course-correction amendment (2026-09-03):** Phase B field workflows are responsive and phone-usable at the 360×640 viewport floor, but require connectivity. PWA installation/manifest, service-worker caching, durable offline storage, offline reads/writes, local queues, synchronization/replay/conflict states, and background/reconnect-driven offline synchronization are deferred together to Phase C. ADR-B009 is current; the 2026-07-26 N-3 answer and ADR-B007 remain historical evidence.

## The Problem

The pilot proved the new foundation — but the company still runs its business on the legacy app. Scheduling crews, running jobs day to day, rentals, assets, service and warranties, DoU packages, self-inspections, HR records, notifications: all of it lives in the old system. Until the new system covers that ground, every working day splits data and habits across two systems, and the rebuild's value stays capped at the quote-to-accepted-job slice.

The legacy app cannot simply be kept: the 2026-06-01 audit found a P0 authorization hole (background functions trusting **unverified, forgeable JWTs** with service-role power), money stored as floating kronor with a hardcoded 25% VAT, "versioned" quotes that are in fact mutable rows, client-side non-transactional job creation, roles enforced only in the browser, one placeholder test, 1426 lint problems, and no CI. It is unsafe to extend and impossible to license. And the ambition is explicitly bigger than one company: the product must be deliverable to many independent electrical contractors — something neither system can do today (the legacy app is unsafe; the new one is `tenant_admin`-only and narrow).

The cost of the status quo is concrete: field workers cannot even log in to the new system (no non-admin roles), nothing can be scheduled, no billing basis can be produced, and every module the company needs daily forces it back into the insecure legacy app that Phase A was built to replace.

## The Solution

Build the remaining legacy surface on the proven Phase A foundation, in four ratified waves (§Scope), keeping the modules inter-connected from the schema up:

- **B1a — Access & platform foundations:** quote lifecycle completion (Förlorad/Avböjd + follow-up workflow); full RBAC mechanism + roles + admin user management; tenant provisioning & onboarding (admin/operator-driven); notifications + email infrastructure — the first sanctioned background-execution path, designed so the legacy forged-JWT P0 can never be reproduced (ADR-B002).
- **B1b — Operational core (the emphasis):** the minimal bookable person/resource model; bookings with conflict detection; schedule/resource/team/capacity/personal views, recurring bookings, time reports, calendar feeds; Jobs & Projects core (my-jobs, members/roles incl. per-job Arbetsledare, work orders, order→projekt upgrade); jobs economy & material; jobs field depth (diary, deviations, photos, chat, risks, reports, completion event); operational dashboard v1. Field use is connected, responsive, connectivity-honest, and protected against transient form-data loss; it is not PWA/offline delivery.
- **B2 — Asset & service operations:** global documents center aggregating the entity-scoped file model (B1 modules emit index-compatible file metadata from the start — PB-D6); rentals; assets (+public QR); service & warranties; electrical panels (manual core); supplier master data + price-list file imports; **billing basis (faktureringsunderlag)** across jobs/rentals/service.
- **B3 — Content, compliance & money-out:** DoU manual core; self-inspections manual core; tenders/FKU thin manual core; KNX manual tables; HR & personnel depth (extending the B1 resource model — no parallel employee table); notes/notice board + CRM & calc completions; **Fortnox** foundation and billing flows (after a B2 spike).

Scheduling does not wait for jobs depth: bookings bind (optionally) to Phase A basic jobs and the jobs epics deepen them later (PB-D12, applying the owner's "independently creatable + connectable" rule). Wave boundaries are formal re-scope checkpoints with a mini-retro and re-validation of the next wave's content.

## What "Better" Means

Parity is measured against the legacy feature inventory; "better" is measured against the legacy audit's findings. Every module Phase B rebuilds crosses this line:

| Legacy reality (audit 2026-06-01) | Phase B standard (Phase A architecture, extended) |
| --- | --- |
| Forged-JWT cron auth with service-role power (P0) | Authenticated background jobs done right — ADR-B002 before any notification/scan ships |
| Money as float kronor; VAT hardcoded 25% | Integer öre everywhere; snapshotted VAT/tax assumptions |
| Mutable quote "versions"; evidence on mutable rows | Immutable sent/accepted snapshots with audited corrections (proven in Phase A) |
| Roles gated in the browser only | Server-enforced RBAC + RLS, permission matrix filled per module, negative-tested |
| Client-side, non-transactional job creation | Server-side audited, transactional, idempotent commands |
| One placeholder test, no CI | Growing unit/integration/RLS/golden-master gates, green in CI at every story |
| 107-table sprawl, scope by accident | Scope-manifest-governed module activation, fail-loud guardrails (ADR-B003) |
| Unauthenticated public endpoints by default | Narrow, ADR-governed public token surfaces only (calendar feeds, asset QR, unsubscribe — ADR-B004) |

Two owner-directed additions go beyond parity: **Fortnox integration** (the legacy app had none; billing basis lands first because "behövs") and the **multi-tenant productization layer** (provisioning, onboarding, full RBAC) that makes the system deliverable to independent companies. For the six AI-entangled legacy modules, Phase B ships the independently valuable **manual/deterministic core** and defers every AI layer to Phase C (PB-D4); the tenders/FKU manual core is a consciously thin slice flagged for owner visibility (N-7).

## Who This Serves

**Tenant companies (the buyers):** Swedish electrical contracting firms that are non-personal legal entities. Provisioning v1 does not support individuals or `enskild firma`; the latter uses the proprietor's personnummer as organisation identity. The pilot company comes first; independent eligible companies follow once provisioning/onboarding is proven. This tenant boundary does not restrict CRM end customers, which may be companies or private individuals without personnummer capture. **End customers still do not log in** — the customer portal remains Phase C.

**Users (the roles):** Phase B ends the `tenant_admin`-only era. The working role set — pending owner confirmation as the RBAC seed, including per-role money/sensitive-field visibility (N-4) — is **Admin, Projektledare, Montör, Säljare, Ekonomi, plus per-job Arbetsledare**:

- **Montör / field workers become first-class users** — connected my-jobs, bookings, time reporting, diary/deviations/photos/chat from the field in a responsive web application usable at 360×640. Suitable unsent input may be retained through transient failures, but the UI must require connectivity and never describe a local draft as submitted (ADR-B009). No native app.
- **Projektledare** — jobs & projects depth, scheduling views, capacity and conflict resolution, job economy.
- **Säljare** — the completed quote lifecycle (Förlorad/Avböjd + follow-ups), CRM completions (customer 360, favorites, duplicate-calculation).
- **Ekonomi** — billing basis review/export, Fortnox flows, economy rollups.
- **Admin** — user management (invite/reset/remove), role management, tenant settings, onboarding.

## Scope: One Phase, Four Waves

Ratified structure and epic candidates (E10-E34; ~21 after plausible merges — PB-D1, PB-D10; full dependency map in the session record §4):

| Wave | Theme | Epic candidates |
| --- | --- | --- |
| B1a | Access & platform foundations | E10 quote lifecycle completion; E11 RBAC + admin user mgmt; E12 tenant provisioning; E13 notifications + email infra |
| B1b | Operational core (headline) | E14 resource/scheduling foundation; E15 scheduling views + time reports; E16 jobs core; E17 jobs economy + material; E18 jobs field depth + completion; E19 dashboard v1 |
| B2 | Asset & service operations | E20 documents center; E21 rentals; E22 assets + QR; E23 service + warranties; E24 electrical panels; E25 supplier data + imports; E26 billing basis |
| B3 | Content, compliance & money-out | E27 DoU manual core; E28 self-inspections; E29 tenders/FKU thin core; E30 KNX; E31 HR depth; E32 notes + CRM completions; E33 Fortnox foundation; E34 Fortnox billing flows |

**Sizing & horizon (stated honestly, not committed):** ~2.5× Phase A's 9 epics. Phase A delivered 9 epics in ~4.5 pipeline-weeks; linear extrapolation puts Phase B at roughly 11-13 pipeline-weeks — an October-2026-ish horizon. E14-E18 remain substantial connected workflows, but the 2026-09-03 course correction removes the PWA/offline technical package and Story 10.7 dependency from their Phase B scope.

**Key sequencing facts:** RBAC (E11) precedes all of B1b and feeds matrix rows to every later module; notifications/email (E13) precede scheduling reminders, service scanning, and expiry alerts; billing basis (E26) needs job economy and rentals/service billing records and precedes Fortnox (E33/E34); warranties hang off the job completion event; DoU seeds hang off jobs; a Fortnox **spike runs during B2** so B3 integrates something already understood (PB-D11).

**Top risks (acknowledged, with standing mitigations):**

- **Connectivity loss during field entry:** mitigated by suitable component/session draft retention, in-memory photo retention where appropriate, explicit connection and retry states, and success only after server confirmation. This is transient-failure protection, not offline operation.
- **E14-E18 sizing uncertainty** (scheduling + jobs are the least-certain epics and sit behind `7.1`/`7.3`): mitigated by the wave-boundary re-scope checkpoints (PB-D10).
- **Parity-scope ambiguity** ("everything it did" invites drift in both directions): mitigated by the scope manifest (ADR-B003) and by treating the legacy-inventory parity checklist as the acceptance surface — every capability lands, is consciously thinned, or is ledgered to Phase C.
- **New attack surface** (first background execution paths, first public token surfaces, non-admin access): mitigated by ADR-B002/ADR-B004 as ship-blocking preconditions and the per-module RLS negative-test gate.

### Explicitly Out — Phase C (hard exclusions)

No exceptions without a new owner decision: **all AI flows** (DoU classification/generation, self-inspection generation, tender analysis/OCR/RAG, panel image import, KNX ETS parsing); **bookkeeping integrations beyond Fortnox**; **live supplier vendor APIs** (Ahlsell/Rexel/Solar/Sonepar — file import only in B); **customer portal / online acceptance** (BankID/portal signing); **net-new features** beyond the parity inventory and the two sanctioned additions; and the **full-release legal/GDPR program** (disclaimer wording, retention, authoritative tax-number ownership). Self-serve tenant signup remains excluded. The ledger also contains the complete **PWA installability and genuine offline field package**: manifest/installability, service-worker and application/data caching, durable device storage, offline reads/writes, local record/attachment queues, synchronization/replay/idempotency/conflict states, reconnect/foreground/app-open/background synchronization, device retention/purge, authorization after access changes, attachment-size limits, signature/legal implications, platform support, and offline security/recovery testing. Phase C must resolve those surfaces and constraints before architecture is selected.

## Open Owner Gates (presented, deliberately unresolved)

These are decision inputs, not blockers to starting B1a — but they sit on the critical path and one working session can clear both sets. System of record: `owner-signoff-questions.md`.

| Gate | What it decides | What it gates |
| --- | --- | --- |
| `7.1`/`7.3` (carried) | Job model structure (options A/B/C prepared in session §9.2; team recommends "present A, implement as C") + first job-card fields | E16-E18 design — the B1b critical path — and pilot sign-off |
| Tax blocks `A`/`B`/`C` + `2.2` (carried) | Rounding, VAT rate, ROT/grön teknik rates/caps/schablon; hidden-row mechanics | Real-pilot cutover + billing-basis (E26) correctness sign-off |
| `8.1`/`8.2` (carried) | Migration classification round 1 + golden examples | Real-pilot cutover |
| N-1 | Migration classification round 2 (per B module) | Each B2/B3 module's migration story |
| N-2 | ✅ Closed 2026-07-26; detailed 2026-09-17 and supplemented by Decisions 1–7C on 2026-09-19: internal operator provisioning only; no self-serve/AI flow; strict-v1 Swedish legal-entity identity, exact email/VAT canonicalization, immutable baseline ID/version/hash catalogue, stateless hash-bound approval, dual idempotency, sole narrow RPC authority, fresh hash-only Epic 11 token generation per dispatch, reconciliation-first bounded attempts, exact readiness, and non-granting platform capability | E12 implements the approved contract; pricing values remain tenant data, never hardcoded |
| N-3 | **Superseded decision chain:** the 2026-07-26 PWA/offline answer remains historical; the 2026-09-03 owner decision selects connected responsive web at 360×640 under ADR-B009 | No technical gate: E14-E18 proceed as connected workflows; PWA/offline is Phase C |
| N-4 | Role-set confirmation + per-role money visibility | E11 permission-matrix seed |
| N-5 | Fortnox prerequisites + faktureringsunderlag content definition | E26 shape; E33/E34 |
| N-6 | Email activation (domain, from-address, first flows) | E13 |
| N-7 | Accept the thin tenders/FKU slice as parity | E29 (visibility) |
| N-8 | Who supplies DoU/self-inspection template content | E27/E28 |
| N-9 | Work-hours model, capacity rules, holidays | E14 |
| N-10 | GDPR/retention posture for HR deletion requests | E31 |

**Current Story 12.1 owner contract (Decisions 1–7C, 2026-09-19):** keep `provision_tenant` as the sole SECURITY DEFINER surface, with only initial provisioning, requested/unknown/failed recording, reconciliation/attempt-generation recording, and transition-audit variants; Epic 11 acceptance may mark exact readiness after membership activation. The initial authorised dispatch and every explicit resend each use a fresh 32-byte CSPRNG application token held only in memory and persist only SHA-256 bound to invitation/tenant/membership/normalized email/`tenant_admin`/expiry. After observation-only reconciliation, the sole RPC atomically revokes the prior hash and reserves the fresh hash/attempt before one provider call, invalidating old links; no raw token reaches storage, operator/browser output, logs, or audits. Replay/reconciliation never rotate or dispatch, `unknown` never auto-resends, and explicit `retry_first_admin_invite` makes at most one call. One approved snapshot permits three total dispatches; a fourth needs fresh preview/approval and a new invitation generation. No escrow, deterministic derivation, or provider/callback redesign is added. Decision 7C supersedes the earlier same-token-reuse-across-dispatches wording. `TENANT_PROVISIONING_BASELINES` entries are immutable ID/monotonic-version/content-hash records. Email uses trim/NFC, IDNA+lowercase domain, lowercase local, preserved plus/dots/tags, and strict syntax rejection; VAT is canonical `SE` + matching ten-digit organisation number + `01`. `ready` requires DB completion, recorded baseline ID/version/hash, active first-Admin membership, non-null matching Auth identity, and no unresolved definitive failure. `Platform.Operator.Access` is `scope: platform`, `tenantGrantable: false`, `tenantRoles: []`; only the operator registry consumes it, while `is_platform_operator()` remains the authority and tenant consumers exclude it.

## Success Criteria

**Per wave:**

- **B1a:** An operator can provision and onboard a new tenant without engineering work through the immutable-catalogue preview, narrow single-RPC authority, reconciliation-first bounded Auth handoff, hashed invitation-token lifecycle, and exact readiness contract; non-admin users sign in with server-enforced, RLS-tested role scoping; admins manage users end-to-end; the notification/email path runs as an authenticated background job (ADR-B002 satisfied); quotes carry the full legacy lifecycle including Förlorad/Avböjd and follow-ups.
- **B1b:** Employees/teams are schedulable with conflict detection and capacity views; at 360×640 and with connectivity, field workers sign in and file their own time reports; transient request failure preserves suitable unsent input and offers retry without false success; jobs carry members/roles (incl. per-job Arbetsledare), work orders, economy rollup, and field depth; the operational dashboard v1 reads live B1 data.
- **B2:** Rentals, assets (+QR), service/warranties, panels, and supplier imports run as tenant-isolated modules; the documents center aggregates files across modules; **billing bases are produced across jobs/rentals/service** — the "behövs" deliverable.
- **B3:** DoU, self-inspections, tenders (thin), KNX, HR depth, and notes/CRM completions are live; **Fortnox is connected per tenant and exports the billing flows** with status/error/retry UX.

**Phase level:**

- **Parity, audited:** every module/capability in the legacy inventory (`initial-system-audit-2026-06-01.md`) is either live in Phase B, consciously thinned with owner visibility (tenders/FKU, N-7), or on the explicit Phase C ledger — no silent drops. This checklist is the Phase B acceptance surface.
- **Real work:** the pilot company runs day-to-day operations — scheduling, jobs, time, materials, service, billing bases — in the new system across activated modules, with legacy data brought over per module per the N-1 classification, until the owner's cutover criterion ("everything the Lovable app has") is met and the legacy app can be retired.
- **Deliverable product:** provisioning and onboarding a second, independent eligible tenant is proven end-to-end as an internal operator flow requiring no engineering work, with strict immutable-baseline preview/approval, duplicate- and token-safe bounded Auth handoff, exact readiness, non-granting platform authorization metadata, and zero cross-tenant leakage in negative tests. Signing commercial customers and setting prices remain business outcomes; self-serve signup is not a future Phase B outcome and remains excluded.
- **Scope-honest field release:** no authoritative Phase B artifact or shipped surface promises PWA installation or offline operation; retained unsent input is labelled as a draft, submitted states require server confirmation, and the complete deferred package is traceable in Phase C.
- **The bar holds:** every new module lands tenant-isolated (RLS negative tests), integer-öre, snapshot-immutable where customer-visible, server-side audited; the unit gate stays green and grows from its 1378 baseline; the golden/regression discipline — including the Epic-9 live-driven comparison-harness pattern — extends to scheduling and jobs money paths; no public surface ships before ADR-B004; every wave boundary executes its re-scope checkpoint.

## Delivery & Governance Notes

Delivery continues via the established per-epic auto-bmad pipeline, epic numbering from 10, wave-tagged. Before the first B story: the one-time guardrail re-baseline (AGENTS.md phase statement, `phase-scope-reviewer`, and the single machine-readable **scope manifest** from which deny-lists, nav guardrails, and table-count validators derive — ADR-B003/PB-D8, also closing the Epic-9 retro's authored-copy-drift theme). Document plan per session §7: this brief → Phase B PRD (supersedes; Phase A PRD frozen) → UX spec (new surfaces: field-worker, scheduling, job workspace) → architecture extension carrying ADR-A001..A009 forward and adding ADR-B001..B006 → epics. Phase A planning artifacts are never edited; Phase B siblings take the `-phase-b` suffix in this folder, as this file does. Near-term workstreams W1 (cleanup) and W2 (UAT dry-run) run independently and are unaffected.

## Vision

Phase B ends with one connected, responsive product two kinds of customers can trust: the pilot company running everything on it, and independent contractors able to onboard onto it. Phase C then considers the deferred PWA/installability and genuine offline-field package alongside the differentiators the legacy app only gestured at — governed AI across DoU, self-inspections, tenders/FKU, panels, and KNX; live supplier APIs; a customer portal with online acceptance; further bookkeeping integrations — on top of a foundation that can carry them safely. Detailed offline architecture remains deliberately undecided until Phase C resolves its write surfaces, storage/retention, attachment, legal/signature, authorization, conflict, platform, security, and test questions.

## Assumptions & Judgment Calls (autonomous run record)

1. **The party-session record is binding.** All shaping choices (waves, epic candidates, splits, placements) restate PB-D1..PB-D14; nothing was re-litigated. Where this brief compresses, the session record and its §4 dependency map govern.
2. **Decision-history amendment.** This brief originally left N-1..N-10 open and later inherited the 2026-07-26 owner answers. The 2026-09-03 owner course correction supersedes only N-3's Phase B PWA/offline direction; it does not rewrite the original answer or ADR-B007 out of history. ADR-B009 is the current field posture.
3. **No market/web research was performed.** The direction is owner-fixed and the parity target is the in-repo legacy inventory; competitive analysis would not change this brief's content. Revisit at Phase C scoping (licensing/pricing) alongside N-2.
4. **File-layout decision exercised:** the party session left Phase B artifact layout "to be decided when the brief is created" — this brief establishes flat `-phase-b`-suffixed siblings in `_bmad-output/planning-artifacts/` (matches BMAD folder discovery; keeps Phase A files untouched).
5. **No separate distillate file was produced** (single-artifact constraint for this run). The PRD stage should read the party-session record §2-§9 directly as the detail pack; this brief deliberately does not duplicate its dependency map or decision rationales.
6. **Success criteria are authored here** (the session defined direction and structure but no phase-level acceptance statement); they are derived strictly from the owner direction, PB decisions, and the Phase A quality bar, and should be hardened into measurable acceptance criteria by the PRD.
7. **Sizing and horizon are restated, not re-estimated** — 21-25 epics / ~2.5× Phase A / 11-13 pipeline-weeks with the session's two caveats; the PRD/epics stage owns any re-estimate at wave boundaries.
8. **Legacy pain framing** cites the 2026-06-01 audit as-of-then facts (P0 cron auth, float money, mutable quotes, 1426 lint issues); they describe the system being replaced, not its current operators.
