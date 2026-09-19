---
title: "PRD: ElproSaas — Phase B (Legacy Parity Release)"
status: final
created: 2026-07-18
updated: 2026-09-03
author: "Rasmus (via autonomous /bmad-prd run)"
mode: "headless create — non-interactive; all choices resolved against the ratified party-session record and the Phase B brief; judgment calls logged in the Assumptions Register"
supersedes: "_bmad-output/planning-artifacts/prd.md (Phase A PRD) as the forward requirements baseline. The Phase A PRD is frozen immutable as the pilot record and is never edited."
governedBy:
  - _bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md  # decisions PB-D1..PB-D14 are binding
  - _bmad-output/planning-artifacts/product-brief-phase-b.md             # the Phase B brief this PRD elaborates
inputs:
  - docs/planning/post-phase-a-plan-2026-07-08.md
  - docs/oracle/initial-system-audit-2026-06-01.md          # legacy feature inventory = the parity acceptance surface
  - docs/discovery/e0-domain-oracle-report.md
  - _bmad-output/planning-artifacts/owner-signoff-questions.md  # owner-gate system of record (referenced, never forked)
  - _bmad-output/planning-artifacts/prd.md                  # frozen Phase A baseline (FR1-FR61, NFR1-NFR41)
  - _bmad-output/planning-artifacts/architecture.md         # frozen Phase A baseline
  - _bmad-output/planning-artifacts/epics.md                # frozen Phase A baseline (epics 1-9)
  - _bmad-output/implementation-artifacts/epic-9-retro-2026-07-08.md
numbering: "FRs continue from the Phase A PRD at FR62; the Phase A NFR spine (NFR1-NFR41) is carried forward by reference with named amendments; new Phase B NFRs start at NFR42. Acceptance criteria are wave-prefixed (AC-B1a-n / AC-B1b-n / AC-B2-n / AC-B3-n / AC-PH-n). Assumptions use PB-A#, decisions cite PB-D# from the party session."
---

# PRD: ElproSaas — Phase B (Legacy Parity Release)

**Author:** Rasmus
**Date:** 2026-07-18

## 0. Document Purpose, Supersession, and Reading Order

This PRD defines Phase B of the ElproSaas rebuild for the PM, the owner, and the downstream planning stages (UX spec, architecture extension, epics). **It supersedes the Phase A PRD (`_bmad-output/planning-artifacts/prd.md`) as the forward requirements baseline.** The Phase A PRD is frozen immutable as the pilot record: it is never edited, its FR1–FR61 and NFR1–NFR41 remain the delivered baseline this document extends, and its IDs stay citable. Phase B artifacts take the `-phase-b` filename suffix in this folder (layout established by the brief).

Reading order for downstream consumers:

1. This PRD — requirements, parity dispositions, gates, acceptance criteria.
2. `phase-b-party-session-2026-07-18.md` — the binding decision pack (PB-D1..PB-D14), dependency map (§4), guardrail mechanism (§5), owner-gate detail (§9). This PRD deliberately does not duplicate its rationales or its mermaid dependency map.
3. `product-brief-phase-b.md` — the narrative brief this PRD hardens.
4. `owner-signoff-questions.md` — the living owner-gate register (system of record; §11 here is a pointer, not a fork).

Two structural rules govern how this PRD is written:

- **Requirements depth follows the ratified wave-checkpoint model (PB-D10).** Wave B1a and B1b modules carry full FR depth. Wave B2 and B3 modules carry deliberately **coarser FR groups** — parity-anchored scope bounds, enough to guarantee no legacy capability is silently dropped, without premature detail. Each coarse FR group is expanded to full FR depth at the wave-boundary checkpoint before its wave starts (a PRD update, not a new PRD).
- ~~**Owner-gated items stay open.**~~ **UPDATED 2026-07-26 — the gates are CLOSED.** This PRD was written to prepare gated areas (job model, tax-bound billing correctness, role seed, mobile posture, email activation) so work could proceed around them. The owner and accountant answered on 2026-07-26 (`docs/discovery/phase-b-owner-answers-2026-07-26.md`, `docs/discovery/phase-b-accountant-answers-2026-07-26.md`); **no hard owner gate remains open in Phase B.** §11 records each gate's disposition; the architecture-side dispositions are in `architecture-phase-b.md` §24. The 2026-07-26 N-3 answer is retained as historical evidence, but its Phase B PWA/offline direction was **superseded by the owner on 2026-09-03**. ADR-B009 and this amendment now define a connected, responsive Phase B field posture; the complete PWA/offline package is deferred to Phase C.

## 1. Executive Summary

Phase A (Internal Pilot MVP, epics 1–9, complete 2026-07-08) proved the foundation: pooled tenancy with RLS and cross-tenant negatives, integer-öre money, immutable quote snapshots and acceptance evidence, server-side audited commands, private files, and a golden-master comparison harness — 1378 unit tests green at close. The pilot was accepted and Phase B green-lit (owner, 2026-07-08).

Phase B is the parity release: **everything the legacy Lovable app did, but better, on the Phase A architecture.** The headline capabilities are **Jobs & Projects depth** and **Time planning & scheduling**, built inter-connected — jobs ↔ scheduling ↔ people ↔ materials ↔ economy ↔ documents — not as siloed pages. Phase B also productizes what the legacy app never had safely: full server-enforced RBAC with non-admin roles, tenant provisioning/onboarding for delivery to independent companies, and money-out (billing basis, then **Fortnox** — the one owner-directed capability the legacy app lacked entirely). All AI flows and other net-new surface are hard-excluded to Phase C (§14).

"Parity" is measured against the legacy feature inventory (`docs/oracle/initial-system-audit-2026-06-01.md`); "better" is measured against that audit's findings. The named anti-pattern Phase B must never reproduce is the legacy P0: background functions trusting **unverified, forgeable JWTs** with service-role power. Every legacy capability is dispositioned three ways in §6 — live-in-B, deliberately-thinned, or Phase-C-ledgered — with zero silent drops; that register is the Phase B acceptance surface.

The work is one phase — one PRD, one architecture extension, one epics doc — internally sequenced into four waves (B1a foundations, B1b operational core, B2 asset & service operations, B3 content/compliance/money-out), sized honestly at 21–25 candidate epics, roughly 2.5× Phase A (PB-D1, PB-D10). Wave boundaries are formal re-scope checkpoints. Epic numbering continues at 10; delivery continues via the established per-epic pipeline. The end state: the pilot company runs its whole operation in the new system, the legacy app can be retired (owner cutover criterion: "at least all functionality the Lovable app has"), and a second, independent tenant can be onboarded without engineering work.

## 2. Success Criteria

### User Success

- **Field workers (Montör) become first-class users.** A field worker signs in under their own role, sees their jobs and bookings, files time reports, and records diary entries, deviations, and photos from the field — none of which is possible today (`tenant_admin`-only).
- **Planners (Projektledare) run scheduling in the system.** Crews and resources are bookable with conflict detection and capacity visibility; the schedule is trustworthy enough to stop maintaining a parallel one.
- **Säljare close the quote loop.** Quotes carry the full owner-confirmed lifecycle (Utkast, Skickad, Accepterad, Förlorad/Avböjd, Arkiverad) with follow-up workflow and hit-rate visibility.
- **Ekonomi produces money-out.** Billing bases are assembled across jobs, rentals, and service, and — once Fortnox lands — exported with status/error/retry visibility.
- **Admins operate tenants.** User invitation, reset, deactivation, and role management work end-to-end without engineering involvement.

### Business Success

- The pilot company runs day-to-day operations — scheduling, jobs, time, materials, service, billing bases — in the new system, module by module as waves land, until the owner's cutover criterion is met and the legacy app is retired.
- The product is provably deliverable to independent companies: provisioning and onboarding a second tenant is an admin-driven flow requiring no engineering work. (Commercial pricing and packaging are business outcomes stored as tenant data, not application logic — N-2; self-serve signup is permanently out of scope, also per N-2.)
- No capability regression versus the legacy app without a conscious, owner-visible decision: the §6 parity register has no silent drops.

### Technical Success

- Every new module lands tenant-isolated (RLS + cross-tenant negatives), integer-öre where money flows, snapshot-immutable where customer-visible, server-side audited, and enrolled in the guardrail/manifest governance — the Phase A bar, held at 2.5× the surface.
- The two new attack-surface classes Phase B introduces — background execution and public token surfaces — ship only behind their ADRs (ADR-B002, ADR-B004) with negative tests proving the legacy failure modes (forged JWT, token abuse) are rejected.
- The golden/regression discipline — including the Epic 9 live-driven comparison-harness pattern — extends to scheduling and jobs money paths.

### Measures and Counter-Measures

Primary measures: waves accepted at their §10 acceptance criteria; parity register fully dispositioned with every live row traceable to a shipped epic; unit gate green and growing from its 1378 baseline; second-tenant provisioning proven end-to-end.

Counter-measures (do not optimize):

- **Do not optimize epic velocity against the per-module security gate.** A module merged without its RLS negatives, permission-matrix rows, and manifest activation is a failure even if it demos well.
- **Do not optimize parity breadth by shipping thin slices silently.** A deliberately-thinned capability (§6) counts only with its owner-visibility item acknowledged (e.g. N-7).
- **Do not optimize dashboard/widget count ahead of data.** Widgets ship only when their producing module is active (PB-D7) — no placeholder widgets.

## 3. Scope: One Phase, Four Waves

One Phase B — one PRD, one architecture extension, one epics doc — internally sequenced into four waves (PB-D1). Epic candidates E10–E34 (~25; plausible merges — provisioning→RBAC, panels→assets, KNX→tenders-adjacent, notes+CRM bundle — give a floor of ~21; final epic set is decided at the epics stage). Full dependency map: session record §4.

| Wave | Theme | Epic candidates |
| --- | --- | --- |
| B1a | Access & platform foundations | E10 quote lifecycle completion; E11 RBAC + admin user management; E12 tenant provisioning & onboarding; E13 notifications + email infrastructure |
| B1b | Operational core (the headline) | E14 resource + scheduling foundation; E15 scheduling views + time reporting; E16 jobs core; E17 jobs economy + material; E18 jobs field depth + completion; E19 operational dashboard v1 |
| B2 | Asset & service operations | E20 documents center; E21 rentals; E22 assets + QR; E23 service + warranties; E24 electrical panels; E25 supplier data + imports; E26 billing basis |
| B3 | Content, compliance & money-out | E27 DoU manual core; E28 self-inspections; E29 tenders/FKU thin core; E30 KNX; E31 HR depth; E32 notes + CRM completions; E33 Fortnox foundation; E34 Fortnox billing flows |

### Sequencing facts (binding on the epics stage)

- **RBAC (E11) precedes everything in B1b** and contributes permission-matrix rows to every later module activation (PB-D2). The matrix fills incrementally per module — mechanism first, not full-matrix-up-front.
- **Notifications/email infra (E13) precedes** scheduling reminders (E15), service scanning (E23), and expiry alerts (E22/E31).
- **Scheduling does not wait for jobs depth** (PB-D12): bookings bind optionally to Phase A basic jobs; the jobs epics deepen them later. This applies the owner's independent-creatable + connectable rule (2026-07-14).
- **Job model:** **resolved 2026-07-26** (ADR-B006 — Jobb as container, one typed entity). E16–E18 design is unblocked. See §7.
- **Billing basis (E26) closes B2** (moved from B3, PB-D11): it needs job economy (E17) and consumes rentals/service billing records; Fortnox (E33/E34) needs billing basis. A **Fortnox spike runs during B2** so B3 integrates something already understood.
- **Warranties hang off the job completion event** (E18→E23); **DoU seeds hang off jobs** (E16→E27).
- **Quote lifecycle completion (E10) is the deliberately small first epic** (PB-D3) — pipeline warm-up, no pre-B interstitial.

### Requirements depth per wave (PB-D10)

- **B1a + B1b:** full FR depth in §8.1–§8.2. These FRs are build-ready pending their named gates.
- **B2 + B3:** coarse FR groups in §8.3–§8.4. Each group bounds the module's parity scope (traceable to §6 rows) and is expanded to full FR depth at the wave-boundary checkpoint before its wave begins. Coarse groups are **not** build-ready as written; expanding them is a required checkpoint output.
- **Wave boundaries (B1a→B1b→B2→B3) are formal re-scope checkpoints:** mini-retro plus re-validation (and FR expansion) of the next wave's content before it starts.

### First delivered story — the governance re-baseline

**Story 10.1 (the first story of Epic 10, before any module story) delivers the one-time Phase B re-baseline** (ratified adjustment; session §5 step 1, PB-D8/ADR-B003): rewrite the `AGENTS.md` phase statement and deferral list, update `phase-scope-reviewer` and `docs/process` scope statements, and introduce the single machine-readable **scope manifest** from which the deny-list, nav guardrails, tenant-table validators, and scope scans derive their expected values. Phase A's surface is the initial `active` set. Details in §13.

### Sizing and horizon (stated honestly, not committed)

~2.5× Phase A's 9 epics. Phase A delivered 9 epics in ~4.5 pipeline-weeks; linear extrapolation puts Phase B at roughly 11–13 pipeline-weeks (an October-2026-ish horizon) with two ratified caveats: E14–E18 were the least-certain sizings and sat behind `7.1`/`7.3` — **now resolved (2026-07-26)** — while N-9 scheduling depth and N-10 retention groundwork remain in scope; and owner-gate latency, Phase A's long pole, is **no longer on the critical path**. The 2026-09-03 course correction removes the formerly added ADR-B007 PWA/offline capability and its technical prerequisite from Phase B. Wave-boundary checkpoints own any re-estimate.

## 4. Users, Roles, and Journeys

### Role model

Phase B ends the `tenant_admin`-only era. The working role seed — **confirmed as the RBAC seed by owner answer N-4 (2026-07-26), including per-role money/sensitive-field visibility** — is the owner's own Roadmap-1 answer:

| Role | Primary surface |
| --- | --- |
| Admin | Tenant settings, user/role management, provisioning/onboarding, all modules |
| Projektledare | Jobs & projects depth, scheduling views, conflict/capacity, job economy |
| Montör (field worker) | My-jobs, own bookings, time reporting, diary/deviations/photos/chat |
| Säljare | CRM, calculations, quote lifecycle incl. Förlorad/Avböjd + follow-ups |
| Ekonomi | Billing basis review/export, Fortnox flows, economy rollups |
| Arbetsledare (per-job) | Job-scoped lead designation on a specific job — a job-scoped role, not a tenant-wide role |

Role names are UI labels for the seed; the permission model is a mechanism that survives role-set changes (PB-D2). **N-4 (answered 2026-07-26) confirms the six roles above** — the Admin label is **Företagsadmin** — adds that **a user may hold several roles simultaneously**, and supplies the real default money-visibility matrix (Montör sees no price, cost, or margin; Säljare sees sales prices but not contribution margin unless granted `Economy.ViewContributionMargin` separately). See `architecture-phase-b.md` §3.3A. End customers still do not log in — the customer portal remains Phase C.

**Field-worker UX posture (owner course correction, 2026-09-03): a responsive, phone-usable connected web application.** Field experiences remain usable at the existing 360×640 viewport floor, but require connectivity. Suitable unsent input may be protected from transient failures with component state, `sessionStorage`, in-memory photo retention, honest connectivity messaging, and explicit retry; only server-confirmed persistence may be described as submitted. Phase B has no PWA installation/manifest, service-worker caching, durable offline device storage, offline reads or writes, local operation queues, synchronization/replay/offline-conflict states, or background/reconnect-driven offline synchronization. **No native app.** ADR-B009 supersedes ADR-B007 for active Phase B direction; Story 10.7 records the governance alignment rather than delivering PWA/offline functionality.

### Journeys

Journeys carry the new Phase B surfaces; Phase A journeys 1–5 (quote-to-accepted-job, versioning, acceptance, oracle comparison, support investigation) remain valid and are not restated.

**Journey B1: Montör Emil runs his connected day from the field.** Emil signs in to the responsive web application on his phone (ADR-B009). With connectivity, his personal view shows today's bookings and his my-jobs list. On site he opens the job, logs material usage, writes a diary entry, photographs the installation, and records a deviation when the panel differs from the drawing. Before leaving he files his time report against the booking. If connectivity drops during entry, the UI keeps suitable unsent form state where practical, states clearly that a connection is required, and offers explicit retry; nothing is shown as submitted until the server confirms persistence. He never sees tenant settings, other people's rates, or margins (per the N-4 visibility seed) — and the server, not the UI, is what stops him.

**Journey B2: Projektledare Sara schedules a crew and resolves a conflict.** Sara opens the team view for next week, books two Montörer onto a job with the right work role, and gets an immediate conflict warning — one of them is already booked and the other would exceed capacity. The conflict resolver shows the collision; she moves one booking and reassigns the other. She sets a recurring booking for the service round. Reminders go out through the notification infrastructure. Her own calendar app follows her tokenized calendar feed (ADR-B004).

**Journey B3: A job runs from acceptance to completion.** An accepted quote has created a job (Phase A path). Sara upgrades it to projekt scope (audited), adds members with per-job roles and names an Arbetsledare, and splits the work into arbetsorder. Through the job's life, material usage and time reports accumulate into the economy rollup against the accepted-quote budget. At the end she marks the job complete; the completion event creates the warranty record (E23) and offers to seed a DoU package (E27).

**Journey B4: Säljare Johan works the pipeline.** Johan sends a quote (Phase A path), schedules a follow-up, and gets a reminder when it falls due. The customer declines; Johan marks the version Förlorad/Avböjd with a reason. The dashboard's pipeline widget reflects hit rate and open follow-ups. Nothing about the sent snapshot changed — the status flip is an append-only lifecycle event.

**Journey B5: An operator provisions a second company.** An allow-listed platform operator enters a strict request for a Swedish non-personal legal entity, reviews a write-nothing server-hashed preview of an immutable baseline ID/version/content hash, explicitly approves it, and sees the database baseline commit before the first-Admin Auth handoff begins. Replay/reconciliation shows the same tenant, state, attempt, and next action instead of duplicating, silently updating, rotating a token, or calling the provider. The initial authorised dispatch and each explicit retry use a distinct fresh 32-byte token, persist only SHA-256, and make at most one provider call; the approved snapshot permits three total dispatches, while a fourth needs a fresh preview/approval and new invitation generation. The first Admin reaches exact readiness only after membership activation and matching Auth identity, then walks onboarding — company settings, pricing baseline, inviting users with roles — to a working state. No engineer touched anything; nothing the new tenant does can read or affect any other tenant. Self-serve public signup is permanently out per N-2.

**Journey B6: Ekonomi Anna produces money-out.** At month end Anna assembles billing bases from job time/material, rental orders, and service records. She reviews, adjusts with an audited reason, and locks each basis — locked bases are immutable. When Fortnox is connected (B3), she exports customers, articles, and invoice bases and watches per-record status, retrying the one that failed. Correctness of the amounts is bound to the tax sign-off gates (§11) before real invoicing use.

**Journey B7: Service keeps itself honest.** The nightly service scan — running as an authenticated background job (ADR-B002), not the legacy forged-JWT cron — finds agreements coming due and creates service suggestions and notifications. A Projektledare converts one into a job. An asset's QR label, scanned by a field worker via the public QR route (ADR-B004), opens a fault report that lands in the same flow.

## 5. Domain Vocabulary

New Phase B nouns (Phase A vocabulary — quote version, acceptance, snapshot, tenant, command, öre — carries forward unchanged). Downstream artifacts use these terms exactly:

- **Role** — a tenant-scoped permission grouping (seed per N-4). **Job-scoped role** — a role designation on a specific job (Arbetsledare). The **permission matrix** is the server-side authority mapping role × module capability, filled per module activation.
- **Resource / bookable person** — a tenant user extended with work role, work hours, and capacity basics (PB-D13). Not an HR record; B3 HR extends the same record.
- **Work role** — the existing Phase A pricing entity (`work_roles`), reused as the scheduling competence/context on bookings — one catalog, two consumers.
- **Booking** — a scheduled assignment of one or more resources over a time range, optionally connected to a job/customer/facility/contact. **Recurring booking** — a booking with a recurrence rule expanded deterministically. **Conflict** — an overlap or capacity/work-hours violation detected by the system.
- **Time report** — a user's reported time against a booking/job.
- **Jobb / Projekt / Arbetsorder** — the job container, its project-scope upgrade, and constituent work items. Structure fixed by ADR-B006: one typed container (`type ∈ {order, projekt}`) with `work_orders` as children; a projekt is an upgraded jobb, not a separate entity. **Completion event** — the explicit, audited event emitted when a job is marked complete; seeds warranties and DoU.
- **Faktureringsunderlag (billing basis)** — the assembled, reviewable, lockable basis for an invoice, drawn from jobs/rentals/service; content definition settled by N-5 (arch §7.3). Locked bases are immutable, and an Approved version cannot be edited without reopening or replacement.
- **Notification producer** — a module-registered source of notifications (reminders, due scans, expiries) executing via the sanctioned background path (ADR-B002). **Email queue / delivery log / suppression / unsubscribe token** — the outbound email infrastructure of E13.
- **Public token surface** — an unauthenticated endpoint reachable via a capability token. Phase B's closed set: calendar feeds, asset QR routes, email unsubscribe (ADR-B004).
- **Scope manifest** — the single machine-readable file listing modules (active/pending + authorizing epic), approved nav items, and tenant tables, from which guardrails derive (ADR-B003).
- **Parity disposition** — the three-way classification of a legacy capability: **live-in-B**, **deliberately-thinned** (conscious reduction, owner-visible), or **Phase-C-ledgered**.
- **DoU** — drift- och underhållsdokumentation packages (manual core in B). **Egenkontroll (self-inspection)** — template-driven compliance inspection records. **FKU/Tender** — förfrågningsunderlag/tender material (thin manual core in B). **Gruppförteckning** — electrical panel circuit schedule. **Delivery note / return** — rental order fulfillment documents.

## 6. Parity Acceptance Surface

The legacy feature inventory in `docs/oracle/initial-system-audit-2026-06-01.md` is the parity checklist. Every capability below is dispositioned **Live** (in Phase B — including those already delivered by Phase A, marked "A"), **Thinned** (deliberately reduced, with the reduction named), or **Phase C** (ledgered to §14). This register is the Phase B acceptance surface (AC-PH-1): a capability may change disposition only through an owner-visible decision recorded in the register history — no silent drops, no silent adds.

**Summary: 79 rows — 66 Live (10 already delivered by Phase A, 56 landing in Phase B), 7 Thinned, 6 Phase-C-ledgered.**

| # | Legacy capability (audit §) | Disposition | Phase B home | Note |
| --- | --- | --- | --- | --- |
| **Authentication, tenancy, roles** | | | | |
| P1 | Login/auth flow | Live (A) | Phase A | Carried |
| P2 | Self-serve company registration (`register_company`) | Thinned | E12 | Operator/admin-driven provisioning in B; public self-serve **permanently out** per N-2 |
| P3 | User roles (admin/projektledare/installatör/ekonomi) | Live | E11 | Expanded seed per N-4; server-enforced (legacy was client-gated) |
| P4 | Admin user management (invite/reset/set password/remove) | Live | E11 | Server commands, audited |
| P5 | Route/sidebar gating | Live | E11 | Rebuilt as server-side authorization; client gating becomes UX only |
| P6 | Tenant-aware RLS | Live (A) | Phase A | Hardened; per-role policies extend it in E11 |
| **Dashboard** | | | | |
| P7 | Operational KPI dashboard + action cards | Live | E19 | v1 in B1b on B1 data; widgets grow per wave (PB-D7) — full widget parity completes as source modules land |
| **Customers and CRM** | | | | |
| P8 | Customer list/detail, customer types | Live (A) | Phase A | Carried |
| P9 | Facilities + contacts | Live (A) | Phase A | Carried |
| P10 | Favorite customers | Live | E32 | |
| P11 | Customer 360 overview | Live | E32 | Aggregates calc/quote/rental/self-inspection context |
| P12 | Sensitive personnummer handling | Live (A) | Phase A | A23 posture; access-controlled, tenant-owned |
| P13 | Customer classification tools | Live | E32 | |
| **Calculations** | | | | |
| P14 | Calc core (sections, rows, cost types, work roles, articles, tax-deduction validation, tillval, display modes, notes, attachments) | Live (A) | Phase A | Carried; engine golden-pinned |
| P15 | Supplier article references on calc rows | Live | E25 | |
| P16 | Duplicate calculation flow | Live | E32 | |
| **Quotes** | | | | |
| P17 | Quote creation/preview/PDF, attachments, terms, versions/statuses | Live (A) | Phase A | Carried; immutable snapshots |
| P18 | Quote follow-up handling | Live | E10 | Workflow, due lists, completion |
| P19 | Accept/reject/lost-reason lifecycle | Live | E10 | Förlorad/Avböjd + reason completes owner status set `4.3` |
| P20 | Quote acceptance → job creation | Live (A) | Phase A | Carried; transactional + idempotent |
| **Jobs and projects** | | | | |
| P21 | Job list, my-jobs, job detail | Live | E16 | Model resolved by ADR-B006 (§7) |
| P22 | Order/projekt workflows + order→projekt upgrade | Live | E16 | Model per ADR-B006 |
| P23 | Job members with operational roles | Live | E16 | Incl. per-job Arbetsledare |
| P24 | Work orders (arbetsorder) | Live | E16 | |
| P25 | Job schedule tab/phases | Live | E15/E16 | Bookings bind to jobs |
| P26 | Material usage + material requests | Live | E17 | |
| P27 | Payment plan + economy rollup | Live | E17 | Integer öre; budget-vs-actual |
| P28 | Diary, deviations, photos, chat, risks, reports/exports | Live | E18 | |
| P29 | Job analytics tab | Thinned | E17/E19 | Economy rollup + reports/exports in B; deeper per-module analytics live inside modules or later waves (PB-D7) |
| P30 | Job completion → warranty creation | Live | E18→E23 | Via completion event |
| P31 | Job → DoU package seed | Live | E16→E27 | Seed-from-job |
| **Time planning and scheduling** | | | | |
| P32 | Schedule/resource/team/capacity/personal views + timelines | Live | E15 | |
| P33 | Bookings with assignee, work role, job/customer/facility/contact context | Live | E14 | |
| P34 | Recurring bookings | Live | E15 | |
| P35 | Conflict checks + resolver UI | Live | E14/E15 | |
| P36 | User work hours | Live | E14 | Rules per N-9 |
| P37 | Time reports | Live | E15 | |
| P38 | Calendar feed tokens | Live | E15 | ADR-B004 gate |
| **Rentals** | | | | |
| P39 | Rental register, quick rental, orders (incl. grouped), delivery notes, returns, history, duplicate item | Live | E21 | |
| P40 | Rental billing records / underlag support | Live | E21→E26 | Feeds billing basis |
| **Assets** | | | | |
| P41 | Asset register/detail/archive, assignments, events, documents, fault reports, mileage logs | Live | E22 | |
| P42 | Public QR route for asset lookup/fault reporting | Live | E22 | ADR-B004 gate |
| P43 | QR/label PDF generation | Live | E22 | |
| P44 | Proactive asset scan / notifications | Live | E22 via E13 | Authenticated background path (ADR-B002) |
| **Electrical panels** | | | | |
| P45 | Panel list/detail, groups/circuit schedule, RCD data, bulk edit, duplicate, print/PDF | Live | E24 | Manual core |
| P46 | AI panel image import (`analyze-panel-schedule`) | Phase C | — | §14 |
| **Articles and supplier data** | | | | |
| P47 | Own article register | Live (A) | Phase A | Carried |
| P48 | Supplier master data, price lists, supplier articles, discount agreements | Live | E25 | |
| P49 | Supplier price-list file import (deterministic formats) | Live | E25 | Full parity — file import was all the legacy had (PB-D4) |
| P50 | AI-assisted supplier parsing (`parse-supplier-file`, `split-supplier-pdf`) | Phase C | — | Deterministic import covers the workflow; AI variants ledgered |
| **Service** | | | | |
| P51 | Service records, plans, agreements, due/overdue handling | Live | E23 | |
| P52 | Service scanning → suggestions; service-plan → job creation | Live | E23 via E13 | Authenticated background path |
| **Warranties** | | | | |
| P53 | Warranty records from completed jobs, expiry tracking | Live | E23 | |
| **Documents and file index** | | | | |
| P54 | Global document page, cross-module `file_index`, preview/download via signed URLs | Live | E20 | Aggregates the Phase A entity-scoped file model (PB-D6) |
| P55 | Soft delete/restore + manager trash | Thinned | E20 | Archive-over-delete replaces hard-delete trash; restore = un-archive; hard deletion stays a gated retention workflow (Phase A R-818 posture) |
| **DoU documentation** | | | | |
| P56 | DoU projects, templates, folder/document structure, upload, editor/preview/render, package export, versioning, lock, material-list sync, duplicate check | Live | E27 | Manual core; template content per N-8 |
| P57 | DoU AI (classification, material classification, PDF splitting, armature parsing, product-sheet matching, list/narrative generation, validation) | Phase C | — | §14 |
| **Self-inspections** | | | | |
| P58 | Templates, sections, items, assignees, measurements, attachments, manual creation, export, links to customer/facility/job/DoU | Live | E28 | Manual core; template content per N-8 |
| P59 | AI-generated self-inspections | Phase C | — | §14 |
| **Tenders / FKU** | | | | |
| P60 | Upload tender files/ZIP, unzip, organized storage | Live | E29 | |
| P61 | Tender analysis value (summaries, conversion) | Thinned | E29 | Manual summary fields + manual conversion links only — the conscious thin slice (N-7); legacy value was mostly AI |
| P62 | Tender AI (analysis, OCR, chunks/facts/quantities, RAG chat, auto-summary, auto-convert) | Phase C | — | §14 |
| **KNX tooling** | | | | |
| P63 | KNX group-address projects, rooms/functions tables, settings | Live | E30 | Manual tables |
| P64 | AI parsing of ETS Buildings PDFs | Phase C | — | §14 |
| **HR and personnel** | | | | |
| P65 | Employee profiles + employment data | Live | E31 | Extends the B1 resource record — no parallel employee table (PB-D13) |
| P66 | Competence cards, certifications, training plans, employee documents | Live | E31 | |
| P67 | Incident reports + HR inbox | Live | E31 | |
| P68 | GDPR data-deletion request workflow | Live | E31 | Posture per N-10; processing runs authenticated (ADR-B002) |
| P69 | My page (employee self-service) | Live | E31 | Builds on B1 personal views |
| P70 | Anonymous improvement suggestions | Thinned | E31 | Authenticated in-app suggestions in B; the public anonymous endpoint is outside the ADR-B004 closed set (legacy audit flagged its abuse risk) and is ledgered to Phase C pending abuse-protection design |
| P71 | Employee bookings + assigned-assets views | Live | E31 | Aggregates E14/E22 data |
| **Notes / notice board** | | | | |
| P72 | Notice board, categories, archive, mention notifications | Live | E32 | Mentions via E13 |
| **Admin** | | | | |
| P73 | Company settings, VAT defaults, quote settings/colors/logos, terms templates | Live | Phase A + E32 | Phase A base; branding/quote-settings completions in E32 |
| P74 | Work roles/prices, calculation settings | Live (A) | Phase A | Carried |
| P75 | Notification/proactivity settings | Live | E13 | |
| P76 | Data-quality/admin panels + personnummer cleanup tooling | Thinned | module admin surfaces | Data-hygiene utilities absorbed into module admin surfaces as needed; no standalone panels (owner may re-raise) |
| P77 | Internal product backlog (in-app) | Thinned | — | Dropped from the product: the delivery backlog lives in the development process, not the app (owner visibility; may re-raise) |
| **Notifications and email** | | | | |
| P78 | Notifications table, bell UI, reminders, upcoming bookings, expiring documents, service suggestions, proactive scans | Live | E13 (+consumers per wave) | Authenticated background execution replaces the forged-JWT cron |
| P79 | Email queue, delivery log, suppression, unsubscribe tokens | Live | E13 | Unsubscribe is an ADR-B004 surface; sending activation per N-6 |

Beyond parity, Phase B carries two owner-directed **additions** the legacy app never had: **Fortnox integration** (E33/E34; the audit confirmed no legacy Fortnox code existed) and the **multi-tenant productization layer** (E11/E12 as a product-grade capability rather than the legacy's client-gated roles). Cross-module **billing basis** (E26) generalizes the legacy's rental-only underlag support (P40) to jobs and service.

## 7. Job Model (E16–E18) — **RESOLVED 2026-07-26**

This section was the job-model **gate**. The owner answered on 2026-07-26: **Option A as the model, Option C as the technique.** The gate is closed and E16–E18 are unblocked.

**The model (A):** **Jobb is the container.** It contains **arbetsorder** (work orders). A jobb can be **upgraded to a projekt**, which unlocks project features — members with per-job roles, payment plan, deeper economy. There is no separate projekt entity that bypasses the container.

**The technique (C):** one `jobs` table with `type ∈ {order, projekt}`; arbetsorder as child work items; **"upgrade" is an audited, event-logged type change on a single row — not a row migration.** Option B (separate `Projekt` entity grouping jobb) is **rejected**; no `projects` table is built.

This is recorded in full as **ADR-B006** (`architecture-phase-b.md` §8), including how the typed entity **extends** the Phase A `jobs` table shipped in Epic 7 rather than replacing it, the one-way upgrade semantics, and the per-epic consequences.

**`7.3` (first job-card field set) is answered** by the N-9 scheduling inputs in the same owner answer: estimated duration, earliest possible start, desired end date, latest permitted end date, priority, number of people, competence/certification requirements, location, dependencies on other work items, travel time, responsible project manager, responsible Arbetsledare, whether the customer must be present, and access/time windows — plus the carried fields (title, type, status, customer, anläggning + specific kontakt per `1.5`, planned start/end, budget from the accepted quote where connected, description). The full set with storage dispositions is `architecture-phase-b.md` §8.4.

Consequences for this PRD:

1. **The jobs FRs (FR93–FR106) stay as written** — they were authored model-agnostically and remain correct under the chosen model. Their `[gated: 7.1/7.3]` markers are **resolved**; each now points at the ADR-B006 subsection that fixes its structure.
2. **E16–E18 design, schema, and story work may proceed** (AC-B1b-6 satisfied).
3. **Nothing that was already proceeding is invalidated:** B1a was ungated, and E14/E15 bookings bind `jobs.id`, which survives the upgrade unchanged (PB-D12) — the container id does not change when a jobb becomes a projekt.

## 8. Functional Requirements

Numbering continues from the Phase A PRD (FR1–FR61 delivered and frozen). Phase A FR phrasing conventions apply: actor-first capability statements; "the system can" for system behaviors. Requirements marked `[gated: X]` may not be built until gate X resolves — **as of 2026-07-26 every such marker in this document has been resolved and replaced with the answered content**; requirements marked `[coarse]` are B2/B3 FR groups expanded at their wave boundary (§3).

### 8.1 Wave B1a — Access & platform foundations (full depth)

#### Quote lifecycle completion (E10)

- FR62: Users with quote permissions can mark a sent quote version as Förlorad/Avböjd with a required reason, completing the owner-confirmed status set (Utkast, Skickad, Accepterad, Förlorad/Avböjd, Arkiverad — owner answer `4.3`).
- FR63: The system can record lost/declined transitions as append-only quote lifecycle events without mutating the immutable sent snapshot; sent-version immutability (NFR11) is unaffected by lifecycle completion.
- FR64: Users with quote permissions can schedule follow-ups on sent quotes, see due/overdue follow-up lists, and complete or annotate follow-ups.
- FR65: The system can surface quote pipeline data — sent/accepted/lost counts, open follow-ups, hit rate — for dashboard consumption (E19).
- FR65A (ADR-B008): Quote creation, successor creation, final review, and send use authenticated, server-validated review authority with atomic actor/correlation audit. A review authorization is one-time, expires in 15 minutes, and is invalidated by source, attachment, or customer-visible changes; it is not UI-attention proof or a mandatory second-person control.
- FR65B (ADR-B008): A customer-visible draft change invalidates the quote PDF; send requires a current generated PDF/fingerprint plus the separate server-only HMAC byte attestation. Successors preselect active/eligible predecessor attachments for editable carry-forward, while archived/ineligible attachments are omitted with warning and eligible bytes are reused.

#### RBAC and admin user management (E11)

- FR66: The system can enforce a tenant-scoped role model in which every user holds at least one role; the seed role set is **Företagsadmin, Projektledare, Montör, Säljare, Ekonomi** (confirmed by N-4, 2026-07-26) plus the job-scoped Arbetsledare designation. A user may hold **several roles simultaneously**; permissions evaluate as the union over the held set.
- FR67: The system can authorize every read and mutation server-side against the permission matrix and RLS; client-side navigation/button gating is a UX convenience, never the authority.
- FR68: The permission matrix can gain per-module permission rows as each module activates (PB-D2) — matrix rows land in the same change as the module's activation, and the mechanism does not require respecifying existing modules.
- FR69: Admins can invite users by email, resend or revoke invitations, trigger password resets, deactivate/reactivate users, and remove memberships; every action is audited.
- FR70: Admins can assign and change user roles and view the effective permission set per user.
- FR71: The system can withhold sensitive money fields (prices, costs, margins) from roles not entitled to them, server-side (no sensitive value present in the response). The per-role seed is settled (N-4): Montör receives no sales price, cost price, or contribution margin; Säljare receives sales prices but not contribution margin unless `Economy.ViewContributionMargin` is granted separately; Arbetsledare defaults to Montör's money posture. See `architecture-phase-b.md` §3.3A.
- FR72: Non-admin users can sign in and reach only role-appropriate modules and actions; unauthorized attempts are rejected server-side and reveal no data or existence signals.

#### Tenant provisioning and onboarding (E12)

- FR73: An authenticated allow-listed platform operator can provision a Swedish non-personal legal-entity tenant through strict schema v1: `country_code = 'SE'`; remove spaces/hyphens from the ten-digit organisation number; validate checksum; reject personnummer-shaped identity; canonicalize optional VAT as `SE` + the matching organisation number + `01` without using VAT as identity; canonicalize first-Admin email by trim/NFC, IDNA+lowercase domain and lowercase local part while preserving plus-addressing/dots/tags and rejecting display names/comments/malformed/multiple addresses; return a stateless write-nothing preview; bind explicit approval to its server `preview_hash` and exact immutable baseline ID/monotonic version/content hash; atomically create the tenant/baseline/first-Admin membership; then perform the server-only Auth handoff. Individuals and `enskild firma` are not eligible tenants; tenant CRM end customers may still be companies or private individuals without personnummer capture.
- FR74: The system can guide a new tenant's first Admin through onboarding (company settings, pricing baseline, user invitations) to a working state.
- FR75: Provisioning is audited and fully tenant-isolated; canonical `(country_code, normalized_organization_number)` is unique across every tenant status, and archived/inactive identity must be reactivated rather than duplicated. Same request UUID/hash is reconciliation-first and returns tenant/current state/attempt/reconciliation action without provider work or token rotation; same UUID/different content returns `IDEMPOTENCY_CONFLICT`; different UUID/same organisation returns `ALREADY_PROVISIONED` with identity/status; no replay silently updates. Database provisioning commits before Auth administration. The sole `provision_tenant` SECURITY DEFINER RPC has only narrow variants for initial provisioning, recording requested/unknown/failed, recording reconciliation/attempt-generation results, and auditing transitions; no general service-role mutation or second DEFINER is allowed. Under Decision 7C, the initial authorised dispatch and every explicit resend each generate a fresh 32-byte CSPRNG application token in memory, persist only SHA-256, and bind the current generation to invitation/tenant/membership/normalized email/`tenant_admin`/expiry. Every authorised explicit `retry_first_admin_invite` follows reconciliation, atomically revokes the prior hash and reserves the fresh hash/attempt through the sole RPC before at most one provider call, invalidates older links, and records only a sanitized outcome; raw tokens never reach storage, operator/browser output, logs, or audits. `unknown` never auto-resends. One approved snapshot permits three total fresh-token dispatches; a fourth requires fresh preview/approval and begins a new invitation generation. V1 adds no raw-token escrow, deterministic derivation, or provider/callback redesign; this supersedes same-token reuse across dispatch attempts. Epic 11 acceptance validates the current binding and activates the verified membership. Persist exactly `pending_first_admin_invite`, `first_admin_invite_unknown`, `first_admin_invite_requested`, `first_admin_invite_failed`, and `ready`; `ready` requires completed DB provisioning, recorded approved baseline ID/version/hash, active first-Admin membership with non-null matching Auth identity, and no unresolved definitive failure. Provider acceptance is requested, not delivered or ready.
- FR76: Self-serve public tenant signup is **permanently out of scope for Phase B** — owner answer N-2 (2026-07-26): there will be no self-registration for customer companies; each is registered and provisioned internally after a contract is signed. No public registration surface ships. Operator-driven provisioning is the only path. Schema v1 uses a strict field allow-list and immutable version-controlled `TENANT_PROVISIONING_BASELINES` catalogue: published entries have ID/monotonic version/content hash and are never edited; changed content creates a new version; requests select ID/version and cannot provide arbitrary baseline values. Unknown fields return `UNSUPPORTED_FIELD`, unsupported versions return `UNSUPPORTED_SCHEMA_VERSION`, rejected/deferred capabilities are never silently ignored or stored for later, preview writes nothing, execution rehashes the original request and exact catalogue entry and returns `PREVIEW_STALE` when content is missing/changed, approver identity comes only from the authenticated platform operator, and no second-person approval is required. Activation also supplies non-granting `Platform.Operator.Access` (`scope: platform`, `tenantGrantable: false`, `tenantRoles: []`): authorization remains exclusively `is_platform_operator()`, tenant consumers exclude platform rows, and coherence validators verify the platform row without treating it as a tenant module (`architecture-phase-b.md` §3.3/§15.4A).

#### Notifications and email infrastructure (E13)

- FR77: Users can receive in-app notifications (bell + feed) with read/unread state and per-user notification preferences.
- FR78: Modules can register notification producers (reminders, upcoming bookings, expiring items, due scans) whose executions run under the sanctioned authenticated background path (ADR-B002); producers activate as their producing modules activate.
- FR79: The system can queue outbound email with a delivery log, retry handling, a suppression list, and unsubscribe handling.
- FR80: Users can unsubscribe from non-essential email via tokenized links governed by ADR-B004.
- FR81: Email sending activation is **specified** by N-6 (2026-07-26): a central verified sending subdomain, display name `[Företagsnamn] via [Systemnamn]`, Reply-To set to the tenant's own address, and the flow priority invitations/security → quote sending → accept/reject notification → job assignment → quote reminders → digests. Quote reminders stop automatically on accept, reject, withdrawal, a new version, or expiry. Invoices are sent from Fortnox, not from us. Until the activation story lands, email paths run queued/non-sending (`architecture-phase-b.md` §4.6).

### 8.2 Wave B1b — Operational core (full depth)

#### Resource and scheduling foundation (E14)

- FR82: The system can represent each schedulable person as the existing tenant user extended with work role, work hours, and capacity basics — the minimal bookable person (PB-D13); employment depth belongs to E31, which extends the same record.
- FR83: Users with scheduling permissions can create, edit, and cancel bookings with one or more assignees, a time range, a work role, and optional connections to a job, customer, facility, and contact.
- FR84: A booking can exist standalone and can connect to a Phase A basic job before jobs depth ships (PB-D12); later jobs epics deepen, never break, existing bookings.
- FR85: The system can detect booking conflicts — assignee double-booking overlaps and capacity/work-hours violations — at create and edit time, and surface them for resolution.
- FR86: The system can represent per-user work hours and capacity. **Per N-9 (2026-07-26), capacity derives from the actual weekly schedule, not from employment percentage** — an 80 % employee may work four full days or five short ones, and both must be expressible. Available capacity = scheduled time − public holidays and closed days − absence − existing bookings − blocked internal time − planning buffer. Overtime is not ordinary capacity and requires an explicit authorised decision; overbooking is permitted but always warns. A centrally maintained Swedish public-holiday calendar plus per-tenant closed days, half days, klämdagar, and reduced-capacity periods, with per-user exceptions. Rules remain config + data, never schema (`architecture-phase-b.md` §10.5A).

#### Scheduling views and time reporting (E15)

- FR87: Users can view scheduling data in schedule, resource, team, capacity, and personal views appropriate to their role.
- FR88: Users with scheduling permissions can create recurring bookings; recurrences expand deterministically and participate fully in conflict detection.
- FR89: Users can resolve detected conflicts through an explicit resolution flow (move, reassign, adjust) that records the outcome.
- FR90: Users can file time reports against their bookings/jobs; users with the appropriate role can review time reports for their teams/jobs.
- FR91: Users can obtain a personal calendar feed via a tokenized URL that is revocable and rotatable, governed by ADR-B004.
- FR92: Booking and time-report data can flow into job economy (E17) and billing basis (E26) without re-entry.

#### Jobs core (E16) — **model resolved by ADR-B006; see §7**

- FR93: Users can see a my-jobs view of jobs where they are members or assignees.
- FR94: Users with job permissions can create jobs standalone and connect them to customers, facilities, contacts, and — where one exists — an accepted quote; the Phase A acceptance→job path continues unchanged.
- FR95: Jobs can carry members with per-job operational roles, including a per-job Arbetsledare designation.
- FR96: Jobs can contain arbetsorder (work orders) as constituent work items — a `work_orders` child table parented to the job container, valid under **both** `type='order'` and `type='projekt'` (ADR-B006 §8.3).
- FR97: A job can be upgraded to projekt scope, unlocking project-level features (member/role depth, payment plan, deeper economy). The upgrade is an **audited single-row `type` change** — event-logged, idempotent, and **one-way in Phase B** (a downgrade is rejected at the database level; reversing that requires an owner decision and an ADR amendment). ADR-B006 §8.3.
- FR98: Jobs used in offert/jobb-level workflows bind an anläggning and a specific contact per the owner's rule (`1.5`).
- FR99: The job-card field set is the one answered in `7.3`/N-9 and enumerated in `architecture-phase-b.md` §8.4 — estimated duration, earliest start, desired and latest end dates, priority, number of people, competence/certification requirements, location, dependencies, travel time, responsible project manager, responsible Arbetsledare, customer-presence requirement, and access/time windows, plus the carried identity and planning fields. Money on the card obeys the entitlement contract: an unentitled role receives no budget value at all.

#### Jobs economy and material (E17)

- FR100: Job members can log material usage on a job; users can raise material requests through a request workflow visible to the responsible role.
- FR101: Projekt-scope jobs can carry a payment plan. It attaches to the job container and is **bound to `type='projekt'` by a database constraint**, not by a command-layer convention (ADR-B006 §8.3).
- FR102: The system can roll up job economy — budget (from the accepted quote where connected), reported time, material usage, and other costs — in integer öre, with budget-vs-actual visible per job to entitled roles.
- FR103: Job economy data can feed billing basis (E26) without re-entry.

#### Jobs field depth and completion (E18)

- FR104: Job members can record diary entries, deviations, photos, chat messages, and risks on jobs they belong to, per role permissions; entries carry author and timestamp.
- FR105: Users with the appropriate role can produce job reports/exports from job data.
- FR106: Users with the appropriate role can mark a job complete; completion emits an explicit audited completion event that downstream modules consume (warranty creation E23, DoU seed offer E27).

#### Operational dashboard v1 (E19)

- FR107: Users can view an operational dashboard whose v1 widgets read live B1 data only — quote pipeline/follow-ups/hit rate (FR65), bookings/conflicts, jobs, time; the widget surface grows per wave strictly per the scope manifest (PB-D7), never via placeholder widgets.
- FR108: Dashboard content respects role permissions — no sensitive money data is delivered to roles without entitlement (FR71).

### 8.3 Wave B2 — Asset & service operations `[coarse]`

- FR109 `[coarse]` (E20): **Global documents center** — a searchable cross-module file index aggregating the entity-scoped `files`/`file_links` metadata of all active modules (PB-D6), with preview/download via tenant-authorized signed URLs and archive/restore semantics consistent with archive-over-delete (P54–P55).
- FR110 `[coarse]` (E21): **Rentals** — rental item register, quick rental flow, rental orders (incl. grouped), delivery notes, return flows, rental history, duplicate item, and rental billing records that feed billing basis (P39–P40).
- FR111 `[coarse]` (E22): **Assets** — register for vehicles/tools/equipment with assignments to employees, asset events (service/inspection/insurance), asset documents, fault reports, mileage logs, and QR/label PDF generation (P41, P43).
- FR112 `[coarse]` (E22): **Asset public QR route + proactive scanning** — a public QR lookup/fault-report route under ADR-B004 rules, and proactive asset scans producing notifications via E13 under ADR-B002 (P42, P44).
- FR113 `[coarse]` (E23): **Service** — service records, plans, and agreements with due/overdue scanning that produces service suggestions (via E13, authenticated) and service-plan→job creation (P51–P52).
- FR114 `[coarse]` (E23): **Warranties** — warranty records created from job completion events (FR106), with expiry tracking and notifications (P53).
- FR115 `[coarse]` (E24): **Electrical panels** — panel register/detail, panel groups/gruppförteckning (circuit schedule), RCD data, bulk edit, duplicate, and print/PDF export; manual core only (P45).
- FR116 `[coarse]` (E25): **Supplier data** — supplier master data, price lists, supplier articles, discount agreements, deterministic price-list file import, and supplier article references selectable on calculation rows (P15, P48–P49).
- FR117 `[coarse]` (E26): **Billing basis** — entitled users (Ekonomi) can assemble faktureringsunderlag across jobs (time, material, fixed-price/payment-plan items per the N-5 content definition), rentals, and service; review, adjust with audited reason, lock, and export The content definition is **settled by N-5** — per-kind field sets for time, material, fixed price, payment plan, and other items; only approved, not-yet-invoiced source items may be drawn, and a consumed item is locked against double invoicing; the basis is versioned through `Draft → UnderReview → Approved → Exported → PartiallyInvoiced → Invoiced → Cancelled`, and an Approved version cannot be edited without reopening or replacement (`architecture-phase-b.md` §7.3). Correctness is bound to NFR55 / arch §12A, delivered by Story 10.6.
- FR118: Billing bases are immutable once locked/exported; corrections follow the audited-correction pattern (Phase A NFR23 family).

### 8.4 Wave B3 — Content, compliance & money-out `[coarse]`

- FR119 `[coarse]` (E27): **DoU manual core** — DoU projects with discipline templates, folder/document structure, upload/import, versioning, lock, package export, material-list sync, and seed-from-job (FR106); template content ingestion ready before owner content arrives. **Per N-8, Johan Ahlström is the named content owner** for the compliance content; we build the template engine, versioning, and approval flow. `ContentOwnerUserId` is stored as a configurable user reference, never a hardcoded name, and the development team does not author content presented as legally, regulatorily, or electrically authoritative without the designated expert's formal approval (P56).
- FR120 `[coarse]` (E28): **Self-inspections manual core** — templates, sections, items, assignees, measurements, attachments, manual creation, and export; linkable to customers, facilities, jobs, and DoU contexts. Same N-8 content-ownership contract as FR119 (P58).
- FR121 `[coarse]` (E29): **Tenders/FKU thin core** — upload of tender files/ZIP bundles with unzip, organized storage, manual summary fields, and manual conversion links to calculation/quote/job/DoU/self-inspection. Deliberately thin (P60–P61). **Accepted by the owner as Phase B parity (N-7, 2026-07-26)**; AI-based document analysis, requirement extraction, version comparison, risk classification, generated answers, and scoring are explicitly Phase C.
- FR122 `[coarse]` (E30): **KNX manual tables** — group-address projects with rooms/functions/group-address tables and settings (P63).
- FR123 `[coarse]` (E31): **HR & personnel depth** — employee profiles and employment data extending the B1 resource records (no parallel employee table — PB-D13), competence cards, certifications, training plans, employee documents, incident reports, HR inbox, my-page, and employee bookings/assigned-assets views (P65–P67, P69, P71).
- FR124 `[coarse]` (E31): **GDPR deletion-request workflow** — employees can submit data-deletion requests; processing is an authenticated, audited workflow. **Per N-10, Phase B carries the technical foundation**: retention fields (`RetentionCategory`, `RetentionPolicyId`, `RetentionUntil`, `LegalHold`, `AnonymizedAt`, …), deletion-request states `Received → … → Closed`, and a **central versioned retention policy** rather than scattered constants — applying to every identifiable natural person, including contact persons, subcontractors, and people appearing in photos. Ordinary tenant administrators may not hard-delete (`architecture-phase-b.md` §12B). Future Story 31.7 applies that policy to dry-run-first, legal-hold-aware, tenant-scoped physical Storage reclamation; legal periods remain owner-approved inputs (P68).
- FR125 `[coarse]` (E32): **Notes/notice board** — internal notice board with categories, archive behavior, and mention notifications via E13 (P72).
- FR126 `[coarse]` (E32): **CRM & calc completions** — customer 360 overview, favorite customers, customer classification tools, duplicate-calculation flow, and quote-settings/branding completions (P10–P11, P13, P16, P73).
- FR127 `[coarse]` (E33): **Fortnox foundation** — per-tenant Fortnox connection (OAuth handled server-side), mapping configuration, and the export architecture per ADR-B005, informed by the B2 spike. **Prerequisites are settled by N-5**: OAuth 2 Authorization Code Flow **per tenant** (never shared credentials), initial scopes `companyinformation, customer, article, invoice`, and the mastership split — our system is master for the invoice basis, Fortnox for the invoice, its number, bookkeeping, and payment status. No automatic bookkeeping or sending from our system in v1 (`architecture-phase-b.md` §7.1).
- FR128 `[coarse]` (E34): **Fortnox billing flows** — export customers, articles, and invoice basis to Fortnox with per-record status, error visibility, and retry UX.

### 8.5 Scope boundaries and guardrails

- FR129: Module activation is governed by the machine-readable scope manifest (ADR-B003): a module's first story flips it `pending → active` (with epic reference and date) in the same PR as its first schema/nav change; guardrail tests derive from the manifest; any surface not manifest-listed fails CI.
- FR130: No Phase C surface (§14 — AI flows, live supplier vendor APIs, customer portal/online acceptance, bookkeeping integrations beyond Fortnox, net-new features) is reachable in Phase B UI, schema, endpoints, or background jobs.

## 9. Non-Functional Requirements

### 9.1 Carried Phase A NFR spine (NFR1–NFR41) — unchanged, with named amendments

The Phase A NFR spine carries forward **unchanged** as stated in the frozen Phase A PRD and applies to every Phase B module. By family: security & tenant isolation (NFR1–NFR8), data integrity & domain correctness (NFR9–NFR15 — integer öre, snapshot immutability, transactional/idempotent lifecycle, tax sign-off gates), privacy & data handling (NFR16–NFR19), reliability & operational safety (NFR20–NFR23 — incl. audited corrections), performance (NFR24–NFR26, pilot-scale posture), scalability (NFR27–NFR29), accessibility & usability (NFR30–NFR31), integration & coexistence (NFR32–NFR34), and test & quality gates (NFR35–NFR41). Where a Phase A NFR names "Phase A", read it as "the current phase" — the invariants, not the phase label, are what carry.

Exactly four narrow, deliberate amendments (everything else is verbatim-carried):

| NFR | Amendment | Authority |
| --- | --- | --- |
| NFR5 (no unauthenticated privileged surface) | Amended narrowly: the closed set of **public token surfaces** (calendar feeds, asset QR routes, email unsubscribe) becomes permissible under NFR46/ADR-B004. Nothing else. Privileged/service-role surfaces remain forbidden without exception. | PB-D14 |
| NFR29 (no placeholder tables for deferred modules) | Rule unchanged; the deferred set is now the Phase C ledger (§14), and enforcement moves to the scope manifest (NFR51). Active-module tables are of course no longer "deferred". | PB-D8 |
| NFR31 (no mobile-first requirement) | **Phase B amendment, restated 2026-09-03:** Phase B is a responsive web application, including phone-usable field workflows at the 360×640 viewport floor. Field workflows require connectivity. Phase B does not include PWA installation or a PWA manifest, service workers, durable offline device storage, offline reads or writes, local operation queues, synchronization/replay/offline-conflict states, or background/reconnect-driven offline synchronization. No native app. | Owner course correction, 2026-09-03; ADR-B009 |
| NFR33 (integrations remain inactive unless ADR-backed scope change) | Fortnox is now sanctioned scope (this PRD + ADR-B005). Supplier vendor APIs, AI, customer portal, and further bookkeeping integrations remain inactive per §14. | Owner direction 2026-07-08 |

### 9.2 Phase B additions (NFR42–NFR54)

**Authorization and RBAC**

- NFR42: Every permission decision must be enforced server-side (command layer + RLS). Each module activation must ship per-role authorization negative tests — for every seeded role, at least one denied-command test and one RLS negative proving the role cannot read/write beyond its matrix rows. Client-side gating alone is never sufficient evidence.
- NFR43: The permission matrix must be a single machine-readable source of truth; matrix rows for a module land in the same change as the module's activation. Job-scoped roles (Arbetsledare) must be enforced server-side per job, not per tenant.
- NFR44: Sensitive-field visibility (prices, costs, margins, salary-adjacent HR data) must be enforced server-side — a role without entitlement must not receive the value in any payload. The per-role entitlement seed is **supplied by N-4 (2026-07-26)** — Montör: no sales price, cost price, or contribution margin; Säljare: sales prices yes, contribution margin only if `Economy.ViewContributionMargin` is granted; Projektledare/Ekonomi/Företagsadmin: full. Deny-by-default throughout (`architecture-phase-b.md` §3.3A).

**Background execution**

- NFR45: Every scheduled/background execution (notification producers, email queue processing, service/asset scans, deletion processing) must run authenticated under the sanctioned mechanism defined by ADR-B002. **The named anti-pattern is the legacy forged-JWT cron P0** (decoding JWT payloads without signature verification and trusting `role === "service_role"`): it must be structurally impossible, and negative tests must prove forged/unsigned tokens are rejected. ADR-B002 must be accepted before the first background path merges.

**Public token surfaces**

- NFR46: Public token surfaces are limited to the closed set: calendar feeds, asset QR routes, email unsubscribe. Each must use high-entropy capability tokens with revocation and rotation, per-token rate limiting, abuse monitoring, minimal data exposure (no tenant enumeration, no PII beyond the surface's purpose), and no privileged capability. ADR-B004 must be accepted before the first such surface ships (B1b calendar feed is the first candidate). Adding a fourth surface requires amending ADR-B004.

**Notifications and email**

- NFR47: Notification/email delivery must be reliable and idempotent: queued sending with a delivery log, bounded retries with backoff, suppression-list enforcement, no duplicate sends from retried processing, and failure visibility to admins. Outbound email must not leak sensitive business data beyond the recipient's entitlement.

**Scheduling correctness**

- NFR48: Booking conflict detection must be deterministic and test-covered, including recurrence expansion, timezone/DST boundaries (Europe/Stockholm), capacity/work-hours edge cases, and multi-assignee bookings. A conflict the system fails to detect, or a phantom conflict, is a correctness defect, not a UX nit.

**Money-out correctness**

- NFR49: Billing bases must be integer-öre end-to-end, immutable once locked/exported (audited corrections only), and covered by golden/regression tests before real invoicing use. Billing-basis **correctness sign-off is bound to the tax gates** (blocks A/B/C + `2.2`): no real-customer invoicing use before those sign-offs, demo track unaffected.
- NFR50: Fortnox boundary isolation: credentials and tokens live server-side only, never reachable from client paths; connections are per-tenant isolated; no Fortnox call executes from a client path; export state must be inspectable per record. Outbox/retry semantics are defined by ADR-B005 (after the B2 spike), not improvised per story.

**Governance, migration, and quality**

- NFR51: The scope manifest (ADR-B003) is the single source of scope truth: deny-lists, nav guardrails, tenant-table validators, and scope scans derive their expected values from it; any unlisted surface fails CI; the manifest has its own validator (an `active` entry without an epic reference fails; a nav item or tenant table not traceable to an active module fails).
- NFR52: Each B2/B3 module's data-migration story requires **migration classification round 2** (N-1: live/archive/excluded per module) before real legacy data moves. The golden/comparison discipline — including the Epic 9 live-driven comparison-harness pattern — must extend to scheduling and jobs money paths.
- NFR53 **(restated 2026-09-03; supersedes the 2026-07-26 offline wording)**: Connected field forms must protect suitable unsent input from transient request failures using component state, `sessionStorage`, and in-memory photo retention where appropriate; show explicit connection-required, failure, and retry states; and render success only after the server confirms persistence. Retained local input is an unsent draft, not a submitted record, and no continued operation without connectivity is promised. See ADR-B009. The superseded wording remains available in the dated owner-answer record and historical ADR-B007.
- NFR55 **(new, 2026-07-26)**: money and tax computation must follow the accountant-ratified rules recorded in `architecture-phase-b.md` §12A — VAT summed and rounded **per VAT category at document level** (Peppol/EN 16931 BR-CO-17), row **visibility decoupled from economic inclusion** (`VisibleToCustomer` / `IncludedInInvoiceTotal` / `DeductionClassification`), construction reverse charge as a VAT **type** rather than a 0 % rate, Skatteverket claim amounts **truncated** to whole SEK, and rates/caps stored with `ValidFrom`/`ValidTo` rather than as constants. This **corrects behaviour shipped in Phase A** and is delivered by Story 10.6; the already-SENT snapshot immutability of NFR11/ADR-A005 is unaffected — new rules apply to new versions only.
- NFR56 (ADR-B008): quote review authority is server-enforced, single-use, time-bounded, invalidation-aware, tenant-scoped, audit-atomic, and non-HMAC; no authenticated direct-DML or digest-shaped bypass may substitute for it. Current-PDF send validity and archived-reference access denial are enforced server-side. Quote-PDF provenance uses a database-issued render ID and a narrow authenticated pre-upload reservation RPC as the sole writer of immutable nullable `files.artifact_kind='quote_pdf'`; an unlinked reserved draft artifact is not signable. PDF-byte activation requires a separate short-lived server-only HMAC-SHA256 attestation verified in PostgreSQL/`pgcrypto` against matching Vault secret `quote_pdf_attestation_<key-id>`, binding the ADR-B008 tenant/actor/version/render-file/content/storage/correlation/key/time-window fields; it is never returned/logged/persisted and fails closed. Render start is correlation-idempotent with a five-minute lease and response-loss reconciliation preserves a current generated PDF. No Edge Function, service-role/elevated Storage credential, or client bypass.
- NFR54: Tenant provisioning must be proven leak-free, secret-safe, and duplicate-safe: automated negatives cover the narrow sole-RPC authority, non-granting platform capability and exclusive operator authorization, canonical-identity uniqueness, reconciliation-first request/hash replay, immutable-catalogue/write-nothing preview, fresh 32-byte token generation per dispatch, SHA-256-only persistence, atomic prior-hash revocation and old-link rejection with raw-token absence, the three-total-dispatch approval budget/fourth-dispatch reapproval, exact readiness, post-commit Auth reconciliation, and identity/status-only operator projections, plus an end-to-end second-tenant provisioning proof (AC-PH-3).

## 10. Acceptance Criteria

Wave acceptance is evaluated at each wave-boundary checkpoint; phase acceptance at Phase B close. These harden the brief's success criteria into measurable gates.

### Wave B1a

- AC-B1a-1: An allow-listed operator provisions an eligible new tenant end-to-end (strict request → immutable-baseline write-nothing preview → hash-bound approval → database baseline → reconciliation-first, attempt-bounded first-Admin invite handoff → exact readiness → onboarding to a working settings/pricing state) with zero engineering steps; the flow is audited and covered by an automated test or scripted demo run without claiming external email delivery or exposing raw invitation tokens.
- AC-B1a-2: Users of every seeded role can sign in; per-role authorization negative tests (denied command + RLS negative per role, per active module) pass in CI (NFR42).
- AC-B1a-3: Admins perform invite/reset/deactivate/reactivate/role-change from the UI; each action produces an audit event.
- AC-B1a-4: The notification bell and email queue run via the authenticated background path; ADR-B002 is accepted before the first background job merged; forged/unsigned-token negative tests pass (NFR45).
- AC-B1a-5: Quote versions support Förlorad/Avböjd with required reason and follow-up scheduling/due/complete; status flips are append-only events; the sent-immutability regression suite stays green (FR62–FR64).
- AC-B1a-6: Story 10.1 is delivered: AGENTS.md/guardrail re-baseline done, scope manifest introduced, guardrail suites derive from the manifest, manifest validator active (NFR51).

### Wave B1b

- AC-B1b-1: Booking conflicts (overlap + capacity/work-hours) are detected at create/edit and resolvable through the resolution flow; conflict rules (per N-9 inputs) are unit/integration covered incl. recurrence and DST cases (NFR48).
- AC-B1b-2: All five scheduling views (schedule/resource/team/capacity/personal) render live data; recurring bookings expand correctly.
- AC-B1b-3: At the 360×640 viewport floor and with connectivity, a Montör-role user signs in and files a time report against a booking/job without admin assistance; a transient request failure retains suitable unsent input, presents an honest connection/failure state, and permits retry without ever presenting the input as submitted before server confirmation.
- AC-B1b-4: Jobs carry members/roles incl. per-job Arbetsledare, arbetsorder, economy rollup (budget-vs-actual, integer öre, vs accepted quote where connected), and field-depth records (diary/deviation/photo/chat/risk); the completion event fires and is consumed by at least one downstream (warranty or DoU seed) in test.
- AC-B1b-5: Jobs money paths are covered by golden/regression tests extending the comparison-harness pattern (NFR52).
- AC-B1b-6: ADR-B006 (job model, from `7.1`/`7.3`) is recorded before any E16–E18 design/story work; the implemented model matches it.
- AC-B1b-7: The calendar feed ships only after ADR-B004 acceptance; token entropy/rotation/revocation/rate-limit behavior is test-covered (NFR46).
- AC-B1b-8: Dashboard v1 renders live B1-sourced widgets only; the widget list is manifest-traceable; no placeholder widgets exist (FR107).

### Wave B2

- AC-B2-1: Rentals, assets, service+warranties, panels, and supplier imports are live as tenant-isolated modules — each with RLS negatives, permission-matrix rows, and manifest activation landed in the same PR as first schema/nav change (FR129, NFR42).
- AC-B2-2: The documents center aggregates files across all active modules from entity-scoped metadata; access is signed-URL only; archive/restore honors archive-over-delete (FR109).
- AC-B2-3: The asset public QR route ships under ADR-B004 with its token rules test-covered.
- AC-B2-4: Service and asset scans run via the authenticated background path and produce suggestions/notifications (FR112–FR113).
- AC-B2-5: Billing bases are produced across jobs, rentals, and service; integer-öre; immutable once locked; export path works; real-invoicing use remains blocked pending the tax gates (NFR49) — demo track unaffected.
- AC-B2-6: The Fortnox spike report exists and feeds ADR-B005 and the N-5 owner conversation.
- AC-B2-7: Migration classification round 2 is completed for each B2 module before its data-migration story (NFR52).
- AC-B2-8: B2's coarse FRs (FR109–FR118) were expanded to full FR depth at the B1b→B2 checkpoint before B2 build began.

### Wave B3

- AC-B3-1: DoU, self-inspections, tenders thin core, and KNX are live per FR119–FR122; exports work; template ingestion is ready for owner-supplied content (N-8).
- AC-B3-2: HR depth extends the B1 resource records with zero parallel employee tables (PB-D13); the deletion-request workflow operates per the N-10 posture.
- AC-B3-3: Notes and CRM completions are live (FR125–FR126).
- AC-B3-4: Fortnox is connected per tenant with server-side credentials only; billing flows export with per-record status/error/retry UX; boundary-isolation tests pass (NFR50).
- AC-B3-5: Migration classification round 2 is completed for each B3 module before its data-migration story.
- AC-B3-6: B3's coarse FRs (FR119–FR128) were expanded to full FR depth at the B2→B3 checkpoint before B3 build began.

### Phase level

- AC-PH-1: The §6 parity register is fully dispositioned with zero silent drops: every Live row traces to a shipped epic/FR, every Thinned row has its owner-visibility item acknowledged (N-7 for tenders P61; N-2 for self-serve P2; P29/P55/P70/P76/P77 via the owner-gate session), every Phase C row appears in §14.
- AC-PH-2: The pilot company runs day-to-day operations in the new system across activated modules, with legacy data brought over per module per N-1, until the owner's cutover criterion ("at least all functionality the Lovable app has") is met and legacy retirement is agreed.
- AC-PH-3: A second, independent tenant is provisioned and onboarded end-to-end admin-driven, with zero cross-tenant leakage in automated negatives (NFR54).
- AC-PH-4: The quality bar held: every new module tenant-isolated with negatives; integer-öre and immutability invariants intact; the unit gate green and grown from its 1378 baseline; every wave-boundary checkpoint executed with a recorded re-scope outcome; no public surface shipped outside ADR-B004; no background path outside ADR-B002.
- AC-PH-5: No authoritative Phase B artifact or shipped surface presents PWA installation, service-worker caching, offline reads/writes, durable offline storage, local operation queues, replay/synchronization, or offline-conflict handling as a Phase B capability. Historical records point to ADR-B009, and the complete deferred package and unresolved questions are present in the Phase C ledger.

## 11. Owner-Gate Register (reference)

**System of record: `_bmad-output/planning-artifacts/owner-signoff-questions.md`** — its "Phase B additions (2026-07-18 party session)" section holds N-1..N-10, and its earlier sections hold the carried möte items. This PRD does not fork that register; the table below only maps each gate to what it blocks here. One owner working session can clear both sets.

**Status as of 2026-07-26: every gate below is CLOSED or EXPIRED. No hard owner gate remains open in Phase B.**

| Gate | Decides | Disposition (2026-07-26) |
| --- | --- | --- |
| `7.1`/`7.3` (carried) | Job model structure + first job-card fields (§7 options A/B/C) | ✅ **Answered: Option A as the model, Option C as the technique.** ADR-B006 recorded (arch §8); job-card fields from N-9 (arch §8.4). **E16–E18 unblocked.** |
| Tax blocks `A`/`B`/`C` + `2.2` (carried) | Rounding, VAT rate, ROT/grön teknik rates/caps/schablon; hidden-row mechanics | ⚠ **Answered — and two answers correct SHIPPED behaviour** (per-line VAT rounding; "hidden rows always count in the deduction basis"). Recorded as arch §12A / NFR55; delivered by **Story 10.6**, which must land before any real ROT/grön-teknik document leaves the system. |
| `8.1`/`8.2` (carried) | Migration classification round 1 + golden examples | **EXPIRED** — owner decision 2026-07-20: no Lovable→app data migration, ever. Parallel-run cutover instead. |
| N-1 | Migration classification round 2 per B module | **EXPIRED** with `8.1`/`8.2` (same owner decision). |
| N-2 | Business model / pricing / provisioning flow | ✅ **No self-serve signup, ever.** Internal allow-listed operators provision after contract through the deterministic strict-v1 service. The 2026-09-17 identity/schema/preview contract and 2026-09-19 authority/token/attempt/catalogue/canonicalization/readiness/platform-capability decisions are binding. Phase B has no AI provisioning flow. Subscription terms are stored as data (arch §3.3/§15.4A). |
| N-3 | Field-worker mobile posture | ✅ **Superseded 2026-09-03.** The 2026-07-26 answer selected an installable PWA with offline capture and is preserved as historical evidence in the owner-answer record and ADR-B007. The current owner decision is connected responsive web at 360×640 under ADR-B009; the full PWA/offline package is Phase C. **Story 10.7 is a documentation/governance alignment story, not a technical prerequisite or implementation claim.** |
| N-4 | Role-set confirmation + per-role money visibility | ✅ **Answered in full.** Six roles confirmed; Arbetsledare is a per-job assignment; multi-role required; four-dimension model with named keys; Montör sees no money, Säljare no margin by default. Arch §3.2A/§3.3A. **Epic 11 consumes this directly.** |
| N-5 | Fortnox prerequisites + faktureringsunderlag content definition | ✅ **Answered.** OAuth2 per tenant, initial scopes, mastership split, full invoice-basis line content and the `Draft→…→Invoiced` status flow (arch §7.1, §7.3). The B2 spike narrows to rate limits, idempotency keys, payload mapping, token refresh, sandbox. |
| N-6 | Email activation (domain, from-address, first flows) | ✅ **Answered.** Central verified subdomain, `[Företag] via [System]`, tenant Reply-To, six-step flow priority, reminder stop conditions, delivery-log fields (arch §4.6). |
| N-7 | Accept the thin tenders/FKU slice as parity | ✅ **Accepted** as Phase B parity; AI analysis explicitly Phase C. No design change. |
| N-8 | Who supplies DoU/self-inspection template content | ✅ **Johan Ahlström is the named content owner.** We build the template engine/versioning/approval; `ContentOwnerUserId` is a **configurable reference, never a hardcoded name**. The dev team must not author content presented as legally or electrically authoritative. |
| N-9 | Work-hours model, capacity rules, holidays | ✅ **Answered.** Capacity from the **actual weekly schedule**, not employment percentage; the capacity formula; overtime excluded; overbooking warns; central Swedish holiday calendar + tenant closed days; no automatic optimisation in Phase B (arch §10.5A). |
| N-10 | GDPR/retention posture for HR deletion requests | ✅ **Answered.** Phase B carries the technical foundation — retention fields, deletion-request states, `LegalHold`, central versioned retention policy — for **every** identifiable person, including contact persons, subcontractors, and people in photos (arch §12B). |

No gate blocks starting B1a, and none now blocks B1b. Story 10.6 remains the money/tax reconciliation prerequisite for dependent surfaces. Repurposed Story 10.7 records this course correction and governance alignment; it is not a technical prerequisite for E14–E18 and does not claim that PWA/offline functionality was delivered.

## 12. ADR Trigger Register (ADR-B001–B009)

| ADR | Subject | Trigger point |
| --- | --- | --- |
| ADR-B001 | RBAC / non-admin access — the deliberate reversal of the Phase A deferral; mechanism-first matrix model | With **this PRD's ratification** (before E11 design) |
| ADR-B002 | Background-job / notification / email execution model — the sanctioned authenticated path; forged-JWT anti-pattern exclusion | With the **notifications epic (E13)** — accepted before the first background execution path merges |
| ADR-B003 | Scope manifest + guardrail derivation mechanism | With **PRD ratification / the Story 10.1 re-baseline** — before the first B story |
| ADR-B004 | Public token surfaces (calendar feeds, asset QR, unsubscribe) — entropy/rotation/rate-limit/abuse rules; the narrow NFR5 amendment | **Before the first public token surface ships in B1b** (calendar feed); governs asset QR (B2) and unsubscribe activation |
| ADR-B005 | Fortnox integration layer — mapping/outbox architecture, retry semantics | **After the B2 Fortnox spike, before E33 build** (B3) |
| ADR-B006 | Job model (A/B/C per §7) | **After owner möte item C (`7.1`/`7.3`)** — before any E16–E18 design |
| ADR-B007 | Installable PWA + offline field capability | **Historical decision from 2026-07-26; superseded for active Phase B scope by ADR-B009 on 2026-09-03.** Retained as decision history, not an active requirement. |
| ADR-B008 | Quote review authority, current-PDF validity, and PDF provenance/attestation | Decided and active; governs the quote-review security boundary and Story 10.5/10.6 follow-through. |
| ADR-B009 | Connected responsive Phase B field web; PWA and genuine offline operation deferred | **Decided by owner 2026-09-03 and active immediately.** Governs all E14–E18 field UX and supersedes ADR-B007 without deleting it. |

## 13. Governance, Delivery, and Migration

**Delivery** continues via the established per-epic auto-bmad pipeline; epic numbering continues at 10, wave-tagged. Near-term workstreams W1 (cleanup) and W2 (UAT dry-run) run independently and are unaffected.

**Story 10.1 — the one-time re-baseline (PB-D8 / ADR-B003), the first delivered story:**

1. Rewrite the `AGENTS.md` phase statement + deferral list; update `phase-scope-reviewer` and `docs/process` scope statements — one ADR-backed change.
2. Introduce the single machine-readable scope manifest (e.g. `docs/scope/phase-b-scope.<yaml|ts>`) listing modules (active/pending + authorizing epic), approved nav items, and tenant tables; Phase A's surface is the initial `active` set.
3. Refactor the deny-list (`src/features/files/deferred-categories.ts`), nav guardrails, table-count validators, and scope scans to derive expected values from the manifest. Fail-loud is retained; the manifest gets its own coherence validator. This also collapses the Epic 9 retro's authored-copy-drift theme (four independent copies of scope truth) into one source.

**Per-epic activation:** each module epic's first story flips the module `pending → active` in the manifest, in the same PR as the module's first schema/nav change, removing the corresponding deny-list category in the same change (FR129).

**Wave-boundary checkpoints (PB-D10):** at B1a→B1b, B1b→B2, and B2→B3 — mini-retro, re-validation of the next wave's content, expansion of the next wave's coarse FRs to full depth (a PRD update on this file), and any re-estimate. Checkpoint outcomes are recorded.

**Migration:** legacy data moves per module, governed by migration classification round 2 (N-1) for every B2/B3 module before its migration story (NFR52). The Phase A migration control docs, fixture/PII disciplines, and the comparison-harness pattern remain the mechanism; scheduling and jobs money paths join the golden surface.

**Downstream document plan** (session §7, amended through the 2026-09-03 course correction): this PRD → Phase B UX spec (new surfaces: connected field-worker, scheduling views, job workspace, dashboard, onboarding) → Phase B architecture extension (carrying ADR-A001..A009 forward and ADR-B001..B009 history/current status) → Phase B epics doc (Epic 10+, wave-tagged) → `project-context.md` refresh → phased-plan alignment. Phase A planning artifacts are never edited.

## 14. Explicitly Deferred — the Phase C Ledger (hard exclusions)

No exceptions without a new owner decision. Nothing in this PRD pulls any of these forward:

- **All AI flows:** DoU classification/material classification/PDF splitting/armature parsing/product-sheet matching/material-list generation/narrative generation/validation (P57); AI-generated self-inspections (P59); tender analysis/OCR/chunks/facts/quantities/RAG chat/auto-summaries/auto-conversion (P62); panel image import (P46); KNX ETS parsing (P64); AI-assisted supplier parsing (P50); every other AI job or AI mutation.
- **Live supplier vendor APIs** (Ahlsell, Rexel, Solar, Sonepar) — file import only in Phase B.
- **Customer portal / online acceptance** (BankID/portal signing); end customers do not log in.
- **Bookkeeping integrations beyond Fortnox.**
- **Public anonymous suggestion endpoint** (P70) — pending abuse-protection design; authenticated in-app suggestions ship in B.
- **Net-new features** beyond the parity inventory and the two sanctioned additions (Fortnox, multi-tenant productization).
- **Full-release legal/GDPR program** parked in Phase A: customer-facing disclaimer wording (`A22`-tax), retention program, authoritative tax-number ownership (NFR15). N-10 covers only the HR deletion-request feature posture, not the program.
- **PWA installability and genuine offline field capability (complete deferred package)** — PWA manifest/install prompts; service-worker/application-shell/data caching; durable device storage; offline reads and writes; local operation and attachment queues; synchronization, replay, idempotency, and user-visible conflict/failure states; reconnect-, foreground-, app-open-, or background-driven synchronization; offline security/authorization revocation behavior; retention, purge, and device-loss posture; attachment/photo size and transfer constraints; signature/legal implications; browser/platform support; and the required offline, security, and recovery test matrix. Phase C must resolve the concrete read/write surfaces, retention periods, attachment limits, signature/legal posture, authorization-after-access-change behavior, conflict semantics, supported platforms, and test/security model before implementation. This ledger records durable seams and open decisions only; it does not pre-decide Phase C architecture.
- **Native mobile app** — **confirmed out by owner answer N-3 (2026-07-26)**: *"En native-app ingår inte i nuvarande scope och ska inte planeras som en separat leveransfas."* The 2026-09-03 course correction does not bring native mobile into scope, and it is not part of the Phase C PWA/offline package. A native app would require a separate future owner decision.
- **Self-serve tenant signup** — **confirmed out by owner answer N-2 (2026-07-26)**: there will be no self-registration for customer companies. Every tenant is provisioned internally after a contract. This is no longer "pending N-2"; it is a settled exclusion.

## 15. Open Questions

Owner-facing questions live exclusively in the §11 register (single system of record). Open items for the downstream planning stages:

1. **UX stage:** connected field-worker surface design under ADR-B009, including honest connection-required/failure/retry states and server-confirmed success; the five scheduling views + conflict resolver interaction model; job workspace layout (tab structure inherits the §7 model decision); dashboard v1 widget layout; onboarding flow; role-management UX; how nav grows beyond Phase A's seven items under manifest governance.
2. **Architecture stage:** the ADR-B001..B009 sequence (§12), including ADR-B007 as superseded history and ADR-B009 as the active field decision; permission-matrix representation and its RLS integration; the background-execution runner choice (ADR-B002); scope-manifest format (`yaml` vs `ts`) and validator design; the resource-model schema extension (PB-D13, single-record rule); booking/recurrence/conflict engine design incl. timezone strategy; token-surface design (ADR-B004); notification-producer registry; Fortnox outbox (ADR-B005, post-spike); comparison-harness extension to scheduling/jobs money paths.
3. **Epics stage:** final epic set (merge candidates: E12→E11, E24→E22, E30 adjacency, E32 bundle); wave-tagging; per-epic activation stories carrying manifest flips.
4. **Process:** whether the B2/B3 coarse-FR expansions at wave boundaries are run as PRD update intents on this file (assumed — PB-A10) or as wave-scoped addenda; owner preference not yet stated.

## 16. Assumptions Register (autonomous run record)

Continuing the Phase A pattern (A1–A29 frozen in the Phase A PRD). Every judgment call made in this non-interactive run is logged here; none re-litigates a ratified decision.

| ID | Assumption / judgment call | Status |
| --- | --- | --- |
| PB-A1 | The party-session record (PB-D1..PB-D14) and the Phase B brief are binding; this PRD restates and hardens, never re-decides. Where this PRD compresses, the session record governs. | accepted for PRD |
| PB-A2 | Numbering: FRs continue at FR62 (Phase A FR1–61 frozen as delivered); NFR spine NFR1–41 carried by reference with exactly four named amendments (§9.1); new NFRs from NFR42. Chosen so downstream references (e.g. the session's "NFR5 amendment") stay unambiguous. | accepted for PRD |
| PB-A3 | Single-artifact constraint honored: no separate decision log or addendum file; the decision log is this register plus the session record; overflow detail deliberately lives in the referenced session record (its §4 map, §5 mechanism, §9.2 options). | accepted for PRD |
| PB-A4 | Parity register granularity (79 rows) is an authored clustering of the audit inventory — fine enough that no capability hides inside a row, coarse enough to stay reviewable. Row set is closed; disposition changes require register-visible edits (AC-PH-1). | accepted for PRD |
| PB-A5 | Five Thinned dispositions beyond the ratified tenders slice are authored here as conservative readings of ratified decisions and Phase A invariants: P29 job analytics (PB-D7), P55 trash→archive-over-delete (Phase A lifecycle invariant), P70 anonymous public endpoint (outside the PB-D14 closed surface set), P76 admin data-hygiene panels, P77 in-app backlog. All five are flagged for owner acknowledgment at the gate session (AC-PH-1). | needs owner visibility |
| PB-A6 | Jobs FRs (FR93–FR106) are written model-agnostically per the handoff instruction; structural phrases are `[gated: 7.1/7.3]`. If ADR-B006 lands option B (flat + grouping), FR96/FR97 phrasing is revisited at the B1a→B1b checkpoint. | **RESOLVED 2026-07-26** — ADR-B006 landed A-as-model/C-as-technique, not B. The model-agnostic phrasing held; FR96/FR97/FR99/FR101 are now stated against the typed container, and no checkpoint revisit is needed. |
| PB-A7 | Role names (Admin, Projektledare, Montör, Säljare, Ekonomi, Arbetsledare) are used as UI-label placeholders pending N-4; FRs bind to the mechanism, not the labels. | accepted for PRD |
| PB-A8 | Scheduling "work role" reuses the Phase A `work_roles` catalog (one catalog, pricing + scheduling consumers) rather than a parallel competence table — the same single-record principle as PB-D13. Architecture stage validates. | assumption for architecture |
| PB-A9 | Time-report review semantics (who approves, whether approval is a hard state) are left to UX/architecture within FR90's bounds; the legacy oracle shows time reports but not a formal approval chain. | assumption for UX/architecture |
| PB-A10 | Wave-boundary coarse-FR expansion is executed as a PRD **update intent on this file** (frontmatter `updated` bumped, expansion recorded), keeping one forward baseline rather than per-wave PRD files. | accepted for PRD (owner may override) |
| PB-A11 | Dashboard v1 widget set (FR107: quote pipeline/follow-ups/hit rate, bookings/conflicts, jobs, time) is the team-derived minimal B1 set; exact widgets finalize in UX within the manifest constraint. | assumption for UX |
| PB-A12 | Sizing/horizon (~21–25 epics, ~11–13 pipeline-weeks, October-ish) is restated from the session, not re-estimated; wave checkpoints own re-estimates. | accepted for PRD |
| PB-A13 | Doc-standards polish (structure/prose) was applied inline by the authoring run rather than via separate editorial subagent passes — a headless single-run constraint. | accepted for PRD |
| PB-A14 | Frontmatter `status: final` refers to this create-intent run's completeness as the forward baseline; owner gates remain open by design and are content, not draft-ness. The separate validate intent (per the process roadmap) may still be run against this file. | accepted for PRD |
