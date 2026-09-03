---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd-phase-b.md
  - _bmad-output/planning-artifacts/architecture-phase-b.md
  - _bmad-output/planning-artifacts/ux-design-specification-phase-b.md
  - _bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md
  - _bmad-output/planning-artifacts/epics.md
phase: Phase B - Legacy Parity Release
scope: docs-only epic and story planning
status: ready-for-sprint-planning
created: 2026-07-18
updated: 2026-09-03
author: "Rasmus (via autonomous /bmad-create-epics-and-stories run)"
mode: "headless create — non-interactive; epic structure bound to the ratified party-session candidates E10–E34; depth per the wave-checkpoint model (PB-D10); judgment calls logged in the Assumptions Register (§ Assumptions)"
supersedes: "_bmad-output/planning-artifacts/epics.md (Phase A epics 1–9) as the forward epic baseline. The Phase A epics doc is FROZEN as the pilot record: it is never edited and its story IDs stay citable."
governedBy:
  - _bmad-output/planning-artifacts/prd-phase-b.md                       # FR62–FR130, NFR42–54 (+ carried NFR1–41 spine), AC-B1a/B1b/B2/B3/PH, §11 owner gates, §12 ADR triggers
  - _bmad-output/planning-artifacts/architecture-phase-b.md              # ADR-B001..B009 (B007 historical, B009 current field posture), §9 schema delta, §14 RPC set, §16 test strategy
  - _bmad-output/planning-artifacts/ux-design-specification-phase-b.md   # §4 B1 surfaces, §5 B2/B3 patterns, §6 components, §9 terminology incl. [oracle-check]
  - _bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md  # PB-D1..PB-D14 binding; §2 waves; §4 dependency map; §6 epic candidates E10–E34
epicNumbering: "continues at 10 (Phase A froze at Epic 9); every epic wave-tagged B1a / B1b / B2 / B3"
depthModel: "PB-D10 wave-checkpoint calibration — B1a (Epics 10–13): FULL stories with complete acceptance criteria; B1b (Epics 14–19): story titles + AC sketches, finalized before B1b build (E16–E18 were gated on ADR-B006 — RECORDED 2026-07-26, gate lifted); B2 (Epics 20–26) and B3 (Epics 27–34): candidate story lists only, expanded to full stories at their wave-boundary checkpoint together with the PRD coarse-FR expansion"
---

# ElproSaas — Phase B Epic Breakdown (Epics 10–34)

## Overview

This document provides the Phase B (Legacy Parity Release) epic and story breakdown for ElproSaas, decomposing the Phase B PRD requirements (FR62–FR130, NFR42–NFR56 plus the carried NFR1–41 spine), the Phase B architecture decisions (ADR-B001..B009 and the wave-tagged schema delta), and the Phase B UX specification into wave-sequenced work. ADR-B007 is historical; ADR-B009 is the current field posture.

Rules of this document:

- **The epic structure is bound.** The party-session candidates E10–E34 are the ratified epic set (session §2/§4/§6). Story-level refinement is owned here; wave membership and epic identity are not. Merge candidates the session itself flagged (E12→E11 provisioning→RBAC, E24→E22 panels→assets, E30 KNX→tenders adjacency, E32 notes+CRM bundle) are noted where they apply, but **E-numbers stay stable** — a merge exercised later absorbs stories without renumbering.
- **Depth follows the ratified wave-checkpoint model (PB-D10)** as stated in the frontmatter `depthModel`. B2/B3 candidate lists bound scope (traceable to the PRD §6 parity register); they are **not build-ready as written** — expanding them is a required output of the wave-boundary checkpoint that also expands the PRD's coarse FRs.
- ~~**Owner gates stay open.**~~ **UPDATED 2026-07-26 — every owner gate is CLOSED; COURSE-CORRECTED 2026-09-03.** Story 10.6 remains the ratified money-rule prerequisite. Story 10.7 is now a documentation/governance alignment story recording that Phase B field work is connected responsive web under ADR-B009 and the complete PWA/offline package is Phase C. It is **not** a technical prerequisite for E14–E18.
- **Story 10.1 is the first delivered story of Phase B**, before any module story: the one-time governance re-baseline (AGENTS.md + docs/process + phase-scope-reviewer rewrite, the TypeScript scope manifest per ADR-B003, guardrail derivation refactor, manifest coherence validator) — all in one story.
- Phase A epics 1–9 are frozen and delivered; nothing here re-plans them. Phase C surfaces (PRD §14 ledger) appear nowhere in this breakdown.

## Cross-Epic Delivery Rules (binding on every Phase B story)

These rules are story-template requirements. Sprint planning and story creation must carry them into each story context; they are restated here once instead of repeated in every story.

1. **Activation protocol (FR129, ADR-B003 §5.5):** a module epic's **first story** flips the module `pending → active` in `src/scope/manifest.ts` (adding epic reference + date) **in the same PR** as the module's first schema/nav change, removes the corresponding derived deny-list category, adds the module's permission-matrix rows, enrolls its tables in the H4 inventory + exact-policy enumeration, and lands the module's per-role negative tests. The manifest coherence validator blocks activation without matrix rows.
2. **Oracle terminology story-gate (architecture §22.4 / UX §14.14):** every epic whose UX surface carries `[oracle-check]` labels runs a `legacy-oracle-explorer` terminology task **before that epic's first story**; the resolved labels are recorded in the story context. Per-epic oracle-check registers are listed in each epic below.
3. **ADR gates:** no background execution path outside ADR-B002; no public token surface outside ADR-B004's closed set of three; no Fortnox artifact before ADR-B005-final; **ADR-B006 is recorded (2026-07-26) — E16–E18 are unblocked**, and their schema follows §8.3 (typed container, no `projects` table); all Phase B field reads/writes follow current ADR-B009 (connectivity required, transient unsent-draft protection, explicit retry, server-confirmed success, no PWA/offline queue or replay); any money path follows the §12A ratified rules.
4. ~~**Migration classification round 2 (N-1, NFR52)**~~ — **EXPIRED.** Owner decision 2026-07-20: there is no Lovable→app data migration; existing jobs finish in the legacy app while new work starts in the new one (parallel-run cutover). No B2/B3 module needs a data-migration story, and the per-epic N-1 notes below are void.
5. **Phase A invariants carry:** integer öre through `@/lib/money`, envelope commands + SECURITY INVOKER RPCs for transaction-sensitive writes (architecture §14; DEFINER only for the two sanctioned exceptions), DB-trigger lock family for new immutability scopes, entity-scoped `files`/`file_links` for every file, append-only audit, archive-over-delete, composite same-tenant FKs, exact-policy enumeration extended never loosened, unit gate grows from its 1378 baseline.
6. **Wave-boundary checkpoints (PB-D10):** B1a→B1b, B1b→B2, B2→B3 are formal re-scope events — mini-retro, re-validation of the next wave, PRD coarse-FR expansion, full story authoring for the next wave from the sketches/candidates here, and any re-estimate. Checkpoint outcomes are recorded; they are process events, not epics.

## Requirements Inventory

### Functional Requirements

Restated (condensed, faithful) from the Phase B PRD §8; the PRD text governs. `[coarse]` markers carry the PRD's meaning. **All `[gated: X]` markers were resolved on 2026-07-26** when the owner and accountant answered.

- FR62: Users with quote permissions can mark a sent quote version Förlorad/Avböjd with a required reason, completing the owner-confirmed status set (`4.3`).
- FR63: Lost/declined transitions are append-only quote lifecycle events; the immutable sent snapshot is untouched (NFR11 unaffected).
- FR64: Users with quote permissions can schedule follow-ups on sent quotes, see due/overdue lists, and complete or annotate follow-ups.
- FR65: The system surfaces quote pipeline data (sent/accepted/lost counts, open follow-ups, hit rate) for dashboard consumption.
- FR66: Tenant-scoped role model; every user holds at least one role; seed set **Företagsadmin, Projektledare, Montör, Säljare, Ekonomi** (confirmed N-4) plus job-scoped Arbetsledare; **a user may hold several roles at once**.
- FR67: Every read and mutation is authorized server-side against the permission matrix and RLS; client gating is UX only.
- FR68: The permission matrix gains per-module rows with each module activation (same change), without respecifying existing modules.
- FR69: Admins can invite/resend/revoke invitations, trigger resets, deactivate/reactivate users, and remove memberships; all audited.
- FR70: Admins can assign/change roles and view the effective permission set per user.
- FR71: Sensitive money fields are withheld server-side from unentitled roles (no value in the response). Seed per N-4: Montör none; Säljare sales prices only; Arbetsledare defaults to Montör's posture; PL/Ekonomi/Företagsadmin all.
- FR72: Non-admin users reach only role-appropriate modules/actions; unauthorized attempts are rejected server-side with no existence signals.
- FR73: Operators/admins can provision a new tenant (create → baseline → first-Admin invite) with zero engineering steps.
- FR74: The system guides a new tenant's first Admin through onboarding to a working state.
- FR75: Provisioning is audited and fully tenant-isolated; it can neither read nor affect any other tenant.
- FR76: Self-serve public tenant signup is **permanently out** (N-2 — no self-registration for customer companies, ever); operator-driven provisioning is the only path and must be validated, idempotent, dry-runnable, audit-logged, and re-runnable after partial failure.
- FR77: Users receive in-app notifications (bell + feed) with read/unread state and per-user preferences.
- FR78: Modules register notification producers running under the sanctioned authenticated background path (ADR-B002); producers activate with their modules.
- FR79: Outbound email is queued with delivery log, retries, suppression list, and unsubscribe handling.
- FR80: Users can unsubscribe from non-essential email via tokenized links governed by ADR-B004.
- FR81: Email sending activation is specified by N-6 (central verified subdomain, `[Företag] via [System]`, tenant Reply-To, six-step flow priority, five automatic reminder-stop conditions, invoices from Fortnox); until the activation story lands, email paths run queued/non-sending.
- FR82: Each schedulable person is the existing tenant user extended with work role, work hours, capacity basics (PB-D13); HR (E31) extends the same record.
- FR83: Users with scheduling permissions can create/edit/cancel bookings with assignees, time range, work role, and optional job/customer/facility/contact connections.
- FR84: Bookings exist standalone and can connect to Phase A basic jobs before jobs depth ships (PB-D12); later jobs epics deepen, never break, existing bookings.
- FR85: Booking conflicts (double-booking overlaps, capacity/work-hours violations) are detected at create and edit time and surfaced for resolution.
- FR86: Per-user work hours and capacity are represented. **Capacity derives from the actual weekly schedule, not employment percentage** (N-9); formula = scheduled − holidays/closed − absence − bookings − blocked − buffer; overtime is not ordinary capacity; overbooking warns; central Swedish holiday calendar + tenant closed days. Rules stay config + data, never schema.
- FR87: Scheduling data renders in schedule, resource, team, capacity, and personal views appropriate to role.
- FR88: Recurring bookings expand deterministically and participate fully in conflict detection.
- FR89: Detected conflicts are resolvable through an explicit resolution flow (move, reassign, adjust) that records the outcome.
- FR90: Users file time reports against bookings/jobs; entitled roles review team/job time reports.
- FR91: Users obtain a personal calendar feed via a revocable, rotatable tokenized URL governed by ADR-B004.
- FR92: Booking and time-report data flows into job economy (E17) and billing basis (E26) without re-entry.
- FR93: Users see a my-jobs view of jobs where they are members or assignees. (ADR-B006 recorded — the container is the typed `jobs` row.)
- FR94: Jobs are creatable standalone and connectable to customers/facilities/contacts/accepted quotes; the Phase A acceptance→job path continues unchanged.
- FR95: Jobs carry members with per-job operational roles, including per-job Arbetsledare.
- FR96: Jobs contain arbetsorder as constituent work items — `work_orders` children of the container, valid under both `type='order'` and `type='projekt'`.
- FR97: A job can be upgraded to projekt scope — an audited, event-logged, idempotent, **one-way** single-row `type` change.
- FR98: Offert/jobb-level workflows bind an anläggning and a specific contact per owner rule `1.5`.
- FR99: Job-card field set per the answered `7.3`/N-9 list (architecture §8.4).
- FR100: Job members log material usage; material requests flow through a request workflow visible to the responsible role.
- FR101: Projekt-scope jobs carry a payment plan, attached to the container and DB-bound to `type='projekt'`.
- FR102: Job economy rolls up budget/time/material/other costs in integer öre with budget-vs-actual per job for entitled roles.
- FR103: Job economy data feeds billing basis (E26) without re-entry.
- FR104: Job members record diary entries, deviations, photos, chat, and risks per role permissions; entries carry author + timestamp.
- FR105: Entitled roles produce job reports/exports from job data.
- FR106: Marking a job complete emits an explicit audited completion event consumed downstream (warranties E23, DoU seed E27).
- FR107: The operational dashboard's v1 widgets read live B1 data only; the widget surface grows strictly per the scope manifest — no placeholder widgets.
- FR108: Dashboard content respects role permissions; no sensitive money data to unentitled roles.
- FR109 `[coarse]` (E20): Global documents center — searchable cross-module file index over entity-scoped metadata, signed-URL preview/download, archive/restore semantics.
- FR110 `[coarse]` (E21): Rentals — register, quick rental, orders (incl. grouped), delivery notes, returns, history, duplicate item, rental billing records feeding billing basis.
- FR111 `[coarse]` (E22): Assets — register with assignments, events, documents, fault reports, mileage logs, QR/label PDF generation.
- FR112 `[coarse]` (E22): Asset public QR route + proactive scanning under ADR-B004/ADR-B002.
- FR113 `[coarse]` (E23): Service — records, plans, agreements with due/overdue scanning → suggestions and service-plan→job creation.
- FR114 `[coarse]` (E23): Warranties — created from job completion events, with expiry tracking and notifications.
- FR115 `[coarse]` (E24): Electrical panels — register/detail, gruppförteckning incl. RCD data, bulk edit, duplicate, print/PDF; manual core only.
- FR116 `[coarse]` (E25): Supplier data — master data, price lists, supplier articles, discount agreements, deterministic file import, supplier references on calc rows.
- FR117 `[coarse]` (E26): Billing basis — assemble faktureringsunderlag across jobs/rentals/service; review, adjust (audited), approve/lock, export. Content per N-5 (architecture §7.3); versioned status flow `Draft → UnderReview → Approved → Exported → PartiallyInvoiced → Invoiced → Cancelled`; correctness bound to the §12A ratified rules delivered by Story 10.6.
- FR118: Billing bases are immutable once locked/exported; corrections follow the audited-correction pattern.
- FR119 `[coarse]` (E27): DoU manual core — projects, templates, folder/document structure, upload, versioning, lock, package export, material-list sync, seed-from-job. Compliance content is owner-side (N-8: Johan Ahlström is the named content owner); `ContentOwnerUserId` is a configurable reference, never a hardcoded name.
- FR120 `[coarse]` (E28): Self-inspections manual core — templates, sections, items, assignees, measurements, attachments, manual creation, export, links. Same N-8 content-ownership contract as FR119.
- FR121 `[coarse]` (E29): Tenders/FKU thin core — upload/ZIP/unzip, organized storage, manual summary fields, manual conversion links. **Owner accepted the thin slice (N-7)**; AI analysis is explicitly Phase C.
- FR122 `[coarse]` (E30): KNX manual tables — group-address projects with rooms/functions/address tables and settings.
- FR123 `[coarse]` (E31): HR depth — employment data extending the B1 resource records (no parallel employee table), competence cards, certifications, training plans, documents, incidents, HR inbox, my-page, employee bookings/assets views.
- FR124 `[coarse]` (E31): GDPR deletion-request workflow — authenticated, audited, over the N-10 states `Received → … → Closed`, with retention fields, `LegalHold`, and a central versioned retention policy; ordinary admins cannot hard-delete.
- FR125 `[coarse]` (E32): Notes/notice board with categories, archive, mention notifications.
- FR126 `[coarse]` (E32): CRM & calc completions — customer 360, favorites, classification, duplicate-calculation, quote-settings/branding completions.
- FR127 `[coarse]` (E33): Fortnox foundation — **per-tenant OAuth 2 Authorization Code Flow** (never shared credentials), initial scopes `companyinformation, customer, article, invoice`, mapping configuration, export architecture per ADR-B005. Mastership split per N-5: we own the invoice basis, Fortnox owns the invoice, its number, bookkeeping, and payment status.
- FR128 `[coarse]` (E34): Fortnox billing flows — export customers/articles/invoice basis with per-record status, error visibility, retry UX.
- FR129: Module activation is governed by the machine-readable scope manifest; activation flips `pending → active` in the same PR as the first schema/nav change; guardrails derive from the manifest; unlisted surface fails CI.
- FR130: No Phase C surface (PRD §14 ledger) is reachable in Phase B UI, schema, endpoints, or background jobs.

### NonFunctional Requirements

The Phase A NFR spine **NFR1–NFR41 carries forward unchanged** (PRD §9.1) with exactly four named amendments (NFR5 narrowed by ADR-B004; NFR29 enforcement moved to the manifest; NFR31 amended by NFR53; NFR33 sanctions Fortnox). It applies to every Phase B story. Phase B additions:

- NFR42: Server-side enforcement of every permission decision; per module activation, per-role authorization negative tests (denied command + RLS negative per seeded role).
- NFR43: The permission matrix is a single machine-readable source of truth; matrix rows land with module activation; job-scoped roles enforced per job.
- NFR44: Sensitive-field visibility enforced server-side (value absent from payload); entitlement seed supplied by N-4 (architecture §3.3A), deny-by-default.
- NFR45: All background execution runs authenticated under ADR-B002; the legacy forged-JWT cron P0 is structurally impossible and proven rejected by negative tests.
- NFR46: Public token surfaces limited to the closed set of three (calendar feeds, asset QR, unsubscribe) with high-entropy revocable/rotatable tokens, rate limits, abuse monitoring, minimal data, no privilege; ADR-B004 accepted before the first surface ships.
- NFR47: Notification/email delivery reliable and idempotent (queue, delivery log, bounded retries, suppression, no duplicate sends, admin failure visibility, no entitlement leakage in outbound content).
- NFR48: Booking conflict detection deterministic and test-covered incl. recurrence, timezone/DST (Europe/Stockholm), capacity/work-hours edges, multi-assignee; missed or phantom conflicts are correctness defects.
- NFR49: Billing bases integer-öre end-to-end, immutable once locked/exported, golden-covered; correctness sign-off bound to tax gates A/B/C + `2.2` before real invoicing use.
- NFR50: Fortnox boundary isolation — server-side-only credentials, per-tenant isolation, no client-path calls, per-record inspectable export state; outbox/retry semantics per ADR-B005-final.
- NFR51: The scope manifest is the single source of scope truth; all guardrails derive from it; unlisted surface fails CI; the manifest has its own coherence validator.
- NFR52: ~~Migration classification round 2 (N-1)~~ — void; there is no data migration (owner 2026-07-20). The golden/comparison discipline still extends to scheduling and jobs money paths.
- NFR53 (restated 2026-09-03; supersedes the 2026-07-26 wording): Phase B field forms are connected and usable at the 360×640 viewport floor. Suitable unsent input is protected from transient request failures with component state, `sessionStorage`, and in-memory photo retention where appropriate; the UI shows connection-required/failure/retry explicitly and reports success only after server-confirmed persistence. A retained draft is not submitted. Phase B has no PWA manifest/installability, service worker, durable offline store, offline read/write, local operation queue, synchronization/replay/offline-conflict state, or background/reconnect-driven offline synchronization. No native app.
- NFR55 (new): money and tax follow the ratified §12A rules — per-VAT-category document-level rounding, visibility decoupled from deduction eligibility, reverse charge as a VAT type, claim amounts truncated to whole SEK, rates/caps time-versioned. Corrects shipped behaviour; delivered by Story 10.6.
- NFR54: Tenant provisioning proven leak-free — automated negatives on the provisioning path plus the end-to-end second-tenant proof (AC-PH-3).

### Additional Requirements (from the Phase B architecture)

- AR-B1: Phase A ADR-A001..A009 and the implemented conventions in `project-context.md` (envelope shape, H4 enrollment, exact-policy enumeration, composite same-tenant FKs, lock-trigger family, öre validation, snapshot builders) are binding on every Phase B story; no delta weakens a Phase A invariant.
- AR-B2: The scope manifest is a typed TypeScript module at `src/scope/manifest.ts` (`satisfies ScopeManifest`), listing per module: id, label, wave, status (active/pending + epic ref), nav items, tenant tables, widgets, notification categories, public surfaces, file owner types. Phase A's shipped surface (7 nav items, 24 tenant tables, 7 file owner types) is the initial `active` set (ADR-B003 §5.2).
- AR-B3: All scope guardrails derive from the manifest: deny-list, nav guardrail expected set, tenant-table inventory (H4 expected enrollment), deferred-token scope scans, widget registry, producer registry, file owner-type union, public-surface closed set. Fail-loud retained; the coherence validator enforces presence AND coherence (ADR-B003 §5.3–5.4).
- AR-B4: The permission matrix is code-level at `src/server/authz/permission-matrix.ts` (moduleId → capability → roles, plus sensitive-field entitlement rows); `requireCapability` gates the command envelope after membership resolution; stable code `PERMISSION_DENIED` with no existence signals; Arbetsledare enforced per job via `job_members`, never tenant-wide (ADR-B001).
- AR-B5: RLS evolves in three predicate tiers: carried membership helpers; new `has_tenant_role(tenant_id, roles[])` (hardened DEFINER-helper shape); per-module row-scope predicates (own rows / job membership). Policy↔matrix agreement tests make drift fail loud.
- AR-B6: Sensitive fields are withheld structurally — role-gated RLS for row-sensitive tables, companion-table separation for column-sensitive money (`<entity>_economy` pattern) — plus server read-models (`src/server/read-models/**`) returning `{ data, entitlements: { withheld } }` for deterministic UI masking. Emails/exports build from the recipient's projection.
- AR-B7: Background execution has one sanctioned lane (ADR-B002): platform cron → `POST /api/jobs/run` authenticated by a timing-safe high-entropy `CRON_SECRET` (current+previous during rotation); typed producer registry (`src/server/jobs/producers.ts`) manifest-derived; runner-only service context confined to `src/server/jobs/**` with explicit per-tenant iteration; producer writes audited (`actor_user_id NULL` + producer command name); `job_runs` log powers freshness stamps and Admin failure visibility.
- AR-B8: The email pipeline is outbox-shaped: `email_outbox` (unique dedupe key), claim with `FOR UPDATE SKIP LOCKED`, suppression enforcement before send, bounded retries with backoff, append-only `email_delivery_events`; queued/non-sending until N-6; provider behind a narrow adapter seam (`src/server/email/provider.ts`) with no provider dependency before activation.
- AR-B9: Public token surfaces (ADR-B004): 256-bit random tokens stored hashed (SHA-256) in per-surface tables; rotation = issue new + revoke old (audited); immediate revocation; uniform generic responses (no enumeration oracle); per-token and per-IP-hash rate limits with 429; minimal data projections; public routes live in `src/app/(public)/**` with a guardrail test proving no authenticated-shell/context imports.
- AR-B10: Scheduling correctness: one pure conflict engine (`src/features/scheduling/conflicts.ts`) shared by editor preview and server command (no I/O, no clock); recurrence as materialized occurrence rows from one pure expansion function (preset patterns, mandatory end condition); exceptions + cancelled tombstones + "this and following" series split; all instants `timestamptz` UTC evaluated in Europe/Stockholm; DST edge policy golden-pinned (spring-forward → first valid instant; fall-back → earlier instant).
- AR-B11: Conflicts persist as `booking_conflicts` workflow records (open/accepted/resolved, required reason on accept, outcome + actor) with natural-key identity across recurrence; `Boka ändå` = persisted accepted-conflict record, not a booking flag.
- AR-B12: Time reports are own-row-scoped; the `status` column ships with the single value `submitted` (reserved approval seam); a hard approval state is decided at the B1b→B2 checkpoint with E26/N-5 and would be an additive enum widening.
- AR-B13: Transaction-sensitive commands use SECURITY INVOKER RPCs per architecture §14 (`createBooking`/`updateBooking`, `createBookingSeries`/`updateBookingSeries`, `resolveConflict`, `markQuoteVersionLost`, `markJobComplete`, `lockBillingBasis`, `provisionTenant`, email-queue claim/process). The only DEFINER exceptions: `provision_tenant` (operator-gated, hardened, negative-tested) and the background service context (§4.3 containment).
- AR-B14: Tenant provisioning: `platform_operators` allow-list (platform-scoped exception table) + `is_platform_operator()` hardened helper; `provisionTenant` idempotent (`ALREADY_PROVISIONED`); operator console in the same app at `src/app/operator/**` outside tenant shell/context, exposing tenant identity/status only (NFR54).
- AR-B15: Person model (PB-D13): `person_profiles` 1:1 with `tenant_memberships`; default work role FKs the Phase A `work_roles` catalog (one catalog, pricing + scheduling consumers); `person_work_hours` normalized templates carrying the N-9 shape (weekly schedule, shift times, breaks, per-person exceptions, absence kinds) plus injectable rule config; `tenant_calendar_days` is **built**, not reserved (N-9 requires tenant closed days over a central Swedish holiday calendar); B3 HR extends the same record — a parallel employee table is forbidden.
- AR-B16: Every B1+ module stores files per the Phase A model (`files` + polymorphic `file_links`); new owner types/purposes are manifest-declared per module and valid only on activation; the E20 documents center is an aggregation read-model adding zero storage tables (PB-D6).
- AR-B17: Billing basis: `billing_basis_lines` are copy-by-value öre snapshots; `Utkast → Låst → Exporterad`; lock via the DB-trigger lock family (new SQLSTATE + `BILLING_BASIS_LOCKED`, reversal + identity tests); audited corrections only; no new rounding rule (ADR-A004 STOP condition carried).
- AR-B18: Fortnox: no credentials, tables, routes, dependencies, or UI before ADR-B005-final + E33 activation; per-tenant server-side-encrypted tokens; `integration_outbox` appended transactionally with the warranting domain event; `external_mappings` per (tenant, type, local id); export-only in Phase B.
- AR-B19: Every new tenant-owned table is direct-`tenant_id`, RLS-forced, GRANT+policy paired, H4-enrolled, exact-policy-enumerated, composite-same-tenant-FK'd where parented, archive-over-delete, manifest-governed, integer-öre-validated where money flows. Enumerated non-tenant exceptions: `platform_operators`, `job_runs` (documented RLS posture).
- AR-B20: Test strategy scales along five axes (architecture §16): generated per-role matrix suites (H4 gains a role dimension; policy↔matrix agreement), background-execution negatives (forged JWT, idempotency, containment), public-surface abuse suites, comparison-harness extension to scheduling (DST/recurrence packs) and jobs money paths (economy/billing goldens), unchanged migration-reset discipline.
- AR-B21: Nav registry (`src/scope/nav-registry.ts`), widget registry (`src/scope/widget-registry.ts`), and `resolveLandingRoute` derive from manifest × permission matrix; hide-don't-disable; no placeholder nav items or widgets can exist by construction.
- AR-B22: **ADR-B006 is RECORDED (2026-07-26): Option A as the model, Option C as the technique.** Jobb is the container and holds arbetsorder; a jobb upgrades to projekt; implemented as ONE `jobs` table with `type ∈ {order, projekt}`, additive on the Phase A table, with `work_orders` and `job_members` as children and the upgrade as an audited one-way single-row type change. **No `projects` table.** Job-workspace data contracts hold unchanged (one container id, per-tab read-models on stable keys); bookings bind `jobs.id`, which survives the upgrade because the id does not change. Job-card fields per architecture §8.4.
- AR-B24 (historical): **ADR-B007** recorded the 2026-07-26 installable-PWA/offline decision. It is retained for traceability but superseded for active Phase B scope by ADR-B009; no module epic consumes it.
- AR-B25 (new): **§12A money amendment** — VAT rounds per VAT category at document level (BR-CO-17), not per line; `VisibleToCustomer` / `IncludedInInvoiceTotal` / `DeductionClassification` are three independent row properties; construction reverse charge is a VAT type; Skatteverket claims truncate to whole SEK; rates/caps carry `ValidFrom`/`ValidTo`. Three distinct rounding rules, three named primitives. Story 10.6 delivers it.
- AR-B26 (new): **§12B retention groundwork** — retention fields, deletion-request states, `LegalHold`, and a central versioned retention policy, adopted per table as modules activate; applies to every identifiable person including contact persons, subcontractors, and people in photos.
- AR-B27 (new): **§15.4A provisioning** — the AI agent orchestrates and validates; the provisioning logic is a deterministic service. The agent gets no general DB access and cannot run arbitrary SQL in production; the flow is dry-runnable, idempotent, audited, and re-runnable after partial failure. Subscription terms are tenant data, never hardcoded.
- AR-B28 (new, current): **ADR-B009** — connected responsive Phase B field web at 360×640; suitable transient unsent-draft and in-memory photo retention, explicit retry, current server authorization, and server-confirmed success. PWA/installability and genuine offline operation are a complete Phase C package. Story 10.7 aligns governance only; E14–E18 have no technical dependency on it. PWA/offline is not a manifest module, so no manifest change is made or invented.
- AR-B23: N-5 settled the Fortnox auth model, scopes, mastership split, and invoice-basis content (architecture §7.1/§7.3). The B2 spike narrows to: rate limits, Fortnox-side idempotency keys, the payload mapping from our line model to Fortnox invoice rows, token-refresh semantics, and sandbox availability. It feeds ADR-B005-final (AC-B2-6).

### UX Design Requirements

- UX-BDR1: Grouped sidebar navigation derived from manifest × permission matrix; a group renders only with ≥1 visible item; hide-don't-disable (no teaser/disabled items); unauthorized direct navigation lands on a generic access page with no existence signals.
- UX-BDR2: Sensitive-field masking mechanism: `MaskedValue` (lock glyph + `Dold`, SR text "Dolt för din roll") in detail contexts; whole-column omission in tables; aggregate honesty (any withheld component withholds the aggregate); feature-shaped fallout (hide the surface rather than render a field of locks); absence is never rendered as 0/empty.
- UX-BDR3: Per-role landings: Montör lands on `Min dag` (`/my-day`, B1b); dashboard-entitled roles land on `/dashboard` with role-weighted default widget layouts.
- UX-BDR4: Quote lifecycle delta UX: `Markera som förlorad/avböjd` on sent versions with outcome + required structured reason (category strawman Pris/Konkurrent/Tidplan/Uteblivet svar/Annat + note); terminal badge distinct from `Accepterad`; list gains status filter + `Förlustorsak` column; follow-ups appear as dashboard widget, list filters, and detail header chip; one open follow-up per quote; completion offers plan-next and jump-to-lost/new-version.
- UX-BDR5: `Användare & roller` (Admin-only): Användare tab (list, invite flow, user detail sheet with role editor/reset/deactivate/remove, audit panel) and Roller tab (seed roles with matrix rows grouped by module, growth-per-activation visible, N-4 entitlements seeded and shown concretely; role/permission edits capture a required reason and are audited); effective-permissions viewer per user; last-admin protection.
- UX-BDR6: Operator console: three-step provisioning wizard (Företagsuppgifter → Baslinje → Bjud in första Admin), re-entrant/resumable, idempotent re-run shows already-provisioned; first-Admin `Kom igång` checklist (5 items, server-derived auto-check, dismissable, pinned until done, deep-linked); entry-point-agnostic as a design property only — **N-2 rules out public signup permanently**; the wizard adds a preview-then-approve step and a write-nothing dry run.
- UX-BDR7: Notifications: top-bar bell + unread badge for every role; popover (latest ~10, mark-all-read, Visa alla); `/notifications` center with filters; per-user preferences matrix (categories × I appen/E-post) with the e-post column inactive-with-explainer until sending activates (sender identity and flow priority per N-6); essential categories non-disableable; every notification deep-links; producer-fed surfaces show last-scan recency.
- UX-BDR8: Scheduling: five views (`Schema`, `Resurser`, `Team`, `Beläggning`, `Min kalender`) as projections of one booking/filter model; shared toolbar (date nav, granularity, filters, `Ny bokning`); persistent `Konflikter (n)` chip; per-user per-view filter/period persistence; capacity cells show number + color, never color alone.
- UX-BDR9: Booking editor (side sheet desktop / full-screen phone): multi-assignee picker with availability hints, work role, time, all-optional connections, description, recurrence; live inline conflict panel per violation; conflicts warn-and-allow — saving requires explicit `Boka ändå` with required reason; series-vs-occurrence edit scope prompt; dirty-state guard.
- UX-BDR10: `RecurrencePreview`: deterministic next ~10 occurrences with per-occurrence conflict glyphs always shown before committing a series; exceptions render "avviker från serien"; cancelled occurrences remain visible tombstones.
- UX-BDR11: Conflict resolver: master-detail queue (grouped by person/date) with mini-timeline of both colliding bookings; actions `Flytta` (suggested free slots), `Omfördela` (available candidates with load), `Justera`, `Acceptera konflikt` (required reason, drops from default queue, filter `Visa accepterade`); resolutions recorded on `Händelser` and notify affected assignees; `Åtgärda hela serien` for sibling-occurrence conflicts; empty state with last-checked recency.
- UX-BDR12: Time reporting: filing from booking cards pre-filled (≤30-second one-hand phone interaction) or standalone; personal week timesheet with missing-day nudges; desktop review surface (person/job/week filters, report-vs-booked delta highlight); reserved status column (no hard approval state in B1b).
- UX-BDR13: `Min dag` (Montör landing): today header, time-ordered booking cards (job/kund + map-linked address, `Öppna jobbet`, `Rapportera tid`), `Mina jobb` section, banner-level schedule-change notices, pull-to-refresh, no money content.
- UX-BDR14: Field capture ergonomics (gloves-and-daylight): sticky bottom `CaptureButton`s ≥48px; camera-first `Foton` with multi-shot; one-thumb `Dagbok`; structured `Avvikelse` quick-form (severity per oracle) notifying Arbetsledare/PL only after persistence; `Material` quantity steppers + `Materialförfrågan`; connected transient-failure retention (component state + suitable `sessionStorage`, in-memory photo blobs) with explicit connection/failure state and `Försök igen`; retained input is unsent, and success requires server confirmation.
- UX-BDR15: Job workspace: shell bound to one container id (confirmed unchanged by ADR-B006; no `Ingående jobb` aggregate) — header (title, type badge, status, kund/anläggning/kontakt chips, PL + Arbetsledare, planned dates, budget mini-bar (absent for Montör and, by default, Arbetsledare — N-4), primary actions) + tab set (Översikt, Arbetsorder, Schema, Material, Ekonomi, Dagbok, Avvikelser, Foton, Chatt, Risker, Rapporter, Filer, Händelser); per-tab visibility = matrix × activation; Montör field shape = bottom tab bar with reduced set; completion dialog states downstream effects before commit; post-completion read-only-with-notice.
- UX-BDR16: Dashboard v1: registry-driven `WidgetCard` grid (12-col → 1-col); v1 widgets exactly Offertpipeline, Uppföljningar, Veckans bokningar, Konflikter, Aktiva jobb, Tidläget; role-default layouts, no user customization; per-widget skeleton/empty/error/retry/freshness; a failed widget never blanks the grid.
- UX-BDR17: Component behavioral contracts per UX §6 are binding: MaskedValue, StatusBadge, ConnectionChip, BookingBlock, ConflictPanel, RecurrencePreview, SideSheet, Wizard, WidgetCard, NotificationItem, QueueList, CaptureButton, AuditTrail, LockConfirmDialog, EffectivePermissions.
- UX-BDR18: B2/B3 modules inherit the shared module conventions (UX §5.1): list page pattern, detail header + tabs ending `Filer`/`Händelser`, archive-over-delete, connections ("skapa och koppla"), role gating, announced locks, background-producer freshness honesty, import/export wizard with per-row error reports and explicit commit.
- UX-BDR19: Accessibility floor additions: touch targets ≥44px (≥48px field primary), WCAG AA everywhere with high-contrast field primaries, full drag parity (keyboard/dialog equivalents), polite live regions for conflicts/saves/notifications, numeric keyboards for quantities/hours, 360×640 field viewport floor, and ADR-B009 connection-required/submitting/failure/retry/server-confirmed states announced without false success; public pages held to the same floor.
- UX-BDR20: Terminology: Swedish UI labels per UX §9 with English routes/identifiers; every `[oracle-check]` label resolves via the legacy-oracle terminology pass before the owning epic's first story (Cross-Epic Delivery Rule 2).

### FR Coverage Map

Every Phase B FR (FR62–FR130) lands in exactly the epics below. B2/B3 coarse FRs map to candidate epics and are re-verified at their wave checkpoint when expanded.

FR62: Epic 10 - Förlorad/Avböjd with required reason on sent versions.
FR63: Epic 10 - Append-only lost/declined lifecycle events; sent snapshot untouched.
FR64: Epic 10 - Follow-up scheduling, due/overdue lists, completion/annotation.
FR65: Epic 10 - Pipeline read-model (counts, open follow-ups, hit rate) for dashboard consumption (rendered by Epic 19).
FR66: Epic 11 - Tenant-scoped role model with the N-4-confirmed seed set + multi-role support + job-scoped Arbetsledare (enforced per job from Epic 16).
FR67: Epic 11 - Server-side authorization of every read/mutation (matrix + RLS); client gating UX-only.
FR68: Epic 11 - Matrix mechanism gaining rows per module activation (exercised by every activation story via Cross-Epic Rule 1).
FR69: Epic 11 - Admin user management commands (invite/reset/deactivate/reactivate/remove), audited.
FR70: Epic 11 - Role assignment + effective-permissions viewer.
FR71: Epic 11 - Server-side sensitive-field withholding against the N-4 seed.
FR72: Epic 11 - Non-admin users reach only role-appropriate surface; generic server-side denials.
FR73: Epic 12 - Operator provisioning flow with zero engineering steps.
FR74: Epic 12 - First-Admin onboarding to a working state.
FR75: Epic 12 - Audited, tenant-isolated provisioning.
FR76: Epic 12 - Self-serve signup is permanently out (N-2); operator provisioning only.
FR77: Epic 13 - In-app notifications (bell + feed + preferences).
FR78: Epic 13 - Producer registry on the sanctioned background path (consumers register per later epic).
FR79: Epic 13 - Email queue, delivery log, retries, suppression, unsubscribe handling.
FR80: Epic 13 - Tokenized unsubscribe under ADR-B004 (activates with sending).
FR81: Epic 13 - Sending activation per N-6; queued/non-sending until the activation story.
FR82: Epic 14 - Minimal bookable person on the existing user record (PB-D13).
FR83: Epic 14 - Booking create/edit/cancel with assignees, work role, optional connections.
FR84: Epic 14 - Standalone bookings + Phase A basic-job binding (PB-D12).
FR85: Epic 14 - Deterministic conflict detection at create/edit.
FR86: Epic 14 - Work hours/capacity model with the N-9 rules (actual weekly schedule, not employment percentage).
FR87: Epic 15 - The five scheduling views.
FR88: Epic 15 - Recurring bookings with deterministic expansion + conflict participation.
FR89: Epic 15 - Conflict resolution flow with recorded outcomes.
FR90: Epic 15 - Time-report filing + role-scoped review.
FR91: Epic 15 - Tokenized personal calendar feed (ADR-B004).
FR92: Epic 15 - Booking/time data flows onward to Epics 17/26 without re-entry.
FR93: Epic 16 - My-jobs view (ADR-B006 recorded).
FR94: Epic 16 - Standalone-creatable, connectable jobs; Phase A acceptance→job path unchanged.
FR95: Epic 16 - Job members with per-job roles incl. Arbetsledare.
FR96: Epic 16 - Arbetsorder as `work_orders` children of the container.
FR97: Epic 16 - Audited one-way projekt upgrade (single-row type change).
FR98: Epic 16 - Anläggning + specific contact binding per owner rule `1.5`.
FR99: Epic 16 - Job-card field set per the answered `7.3`/N-9 list (architecture §8.4).
FR100: Epic 17 - Material usage + request workflow.
FR101: Epic 17 - Payment plan on projekt scope, DB-bound to `type='projekt'`.
FR102: Epic 17 - Integer-öre economy rollup with budget-vs-actual.
FR103: Epic 17 - Economy feed to billing basis (consumed by Epic 26).
FR104: Epic 18 - Diary, deviations, photos, chat, risks with author + timestamp.
FR105: Epic 18 - Job reports/exports.
FR106: Epic 18 - Audited completion event consumed downstream (Epics 23/27).
FR107: Epic 19 - Dashboard v1 with live-B1, manifest-traceable widgets only.
FR108: Epic 19 - Role-respecting dashboard content.
FR109: Epic 20 - Documents center aggregation `[coarse]`.
FR110: Epic 21 - Rentals `[coarse]`.
FR111: Epic 22 - Assets register and depth `[coarse]`.
FR112: Epic 22 - Asset public QR route + proactive scanning `[coarse]`.
FR113: Epic 23 - Service records/plans/agreements + scanning `[coarse]`.
FR114: Epic 23 - Warranties from completion events `[coarse]`.
FR115: Epic 24 - Electrical panels manual core `[coarse]`.
FR116: Epic 25 - Supplier data + deterministic imports + calc-row references `[coarse]`.
FR117: Epic 26 - Billing basis assembly/review/approve/export `[coarse]`; content per N-5, correctness per §12A (Story 10.6).
FR118: Epic 26 - Locked-basis immutability + audited corrections.
FR119: Epic 27 - DoU manual core `[coarse]`; compliance content owner-side per N-8.
FR120: Epic 28 - Self-inspections manual core `[coarse]`; content owner-side per N-8.
FR121: Epic 29 - Tenders/FKU thin core `[coarse]`; slice accepted by the owner (N-7).
FR122: Epic 30 - KNX manual tables `[coarse]`.
FR123: Epic 31 - HR depth on the B1 person record `[coarse]`.
FR124: Epic 31 - GDPR deletion-request workflow `[coarse]`; N-10 field/state contract + central versioned retention policy.
FR125: Epic 32 - Notes/notice board with mentions `[coarse]`.
FR126: Epic 32 - CRM & calc completions `[coarse]`.
FR127: Epic 33 - Fortnox foundation `[coarse]`; N-5 prerequisites settled, ADR-B005-final still post-spike.
FR128: Epic 34 - Fortnox billing flows `[coarse]`.
FR129: Story 10.1 (manifest + derivations) + every module epic's activation story (Cross-Epic Rule 1).
FR130: Story 10.1 (manifest-derived Phase C enforcement) + continuously by the manifest validator/CI in every epic.

**Coverage check:** FR62–FR130 all mapped; no FR is uncovered; FR129/FR130 are cross-epic governance FRs anchored in Story 10.1 and re-exercised by every activation story.

## Epic List

Epic identity and wave membership are ratified (session §2/§4/§6); goals restated per the PRD. "Activation" names what flips `pending → active` in the scope manifest per Cross-Epic Rule 1. "Oracle checks" lists the `[oracle-check]` labels the epic must resolve before its first story.

### Epic 10 [Wave B1a]: Quote Lifecycle Completion (+ Phase B Governance Re-Baseline)

Säljare close the quote loop: Förlorad/Avböjd with reasons, follow-up workflow, and pipeline visibility — after Story 10.1 delivers the one-time Phase B governance re-baseline (scope manifest per ADR-B003) before any module story.

**FRs covered:** FR62, FR63, FR64, FR65, FR65A, FR65B (+FR129/FR130 anchored by Story 10.1)
**Primary NFR coverage:** NFR51, NFR56; carried NFR11 (sent immutability) untouched
**Natural dependencies:** None (deliberately small first epic, PB-D3). Story 10.1 precedes every other Phase B story.
**Activation:** No new module — quotes are Phase A-active; Story 10.1 introduces the manifest itself with Phase A as the initial active set; Stories 10.2/10.3/10.8 enroll their new quote tables (`quote_lost_reasons`, `quote_follow_ups`, and `quote_review_authorizations`) under the active quotes module, H4, and exact-policy enumeration in the same PRs.
**Oracle checks:** Förlorad vs Avböjd distinction; lost-reason category list (UXB-A5).

#### Story 10.6: Tax-Answer Reconciliation — VAT rounding scope, deduction classification, reverse charge (owner/accountant answers 2026-07-26)

As the company owner who must issue legally correct quotes and invoices,
I want the money engine to match the accountant's ratified rules rather than our provisional assumptions,
so that a real ROT/grön-teknik quote is correct the first time it leaves the system.

**Origin:** the accountant's answers of 2026-07-26 (`docs/discovery/phase-b-accountant-answers-2026-07-26.md`). Most answers CONFIRMED our assumptions (25 % VAT, ROT 30 %, caps 50 000, grön 15/50/50). **Three did not, and they change SHIPPED behaviour** — this story exists because a register entry cannot fix code.

### AC1 — VAT rounds per VAT category at DOCUMENT level, not per line
**Given** architecture §10 currently specifies per-line VAT rounding, summing rounded line values
**When** the money engine computes VAT
**Then** line NET is rounded to öre, but VAT is computed and rounded **per VAT category on the summed document-level basis** (Peppol/EN 16931 **BR-CO-17**)
**And** the golden-master fixtures are re-derived, because the accountant explicitly warns the per-line model yields different totals depending on how many lines an invoice is split into.

### AC2 — Hidden rows: visibility is decoupled from economic inclusion
**Given** the shipped assumption "hidden rows always count in BOTH total and deduction basis"
**When** a row is hidden from the customer
**Then** it counts in the TOTAL when billable, but in the DEDUCTION basis **only when its cost type is eligible** (material is never ROT-eligible; travel/machine/admin are neither ROT nor grön)
**And** each row carries the three separate properties `VisibleToCustomer`, `IncludedInInvoiceTotal`, `DeductionClassification` (`NONE`, `ROT_LABOR`, `GREEN_*_LABOR`, `GREEN_*_MATERIAL`).

### AC3 — Reverse charge is a VAT TYPE, not rate 0
**Given** construction-sector reverse charge (`omvänd betalningsskyldighet`) applies to electrical work on property for qualifying buyers
**When** a quote/invoice is issued under it
**Then** it is modelled as a distinct VAT type (`STANDARD_VAT_25` / `REVERSE_CHARGE_CONSTRUCTION`), never as a 0 % rate
**And** it requires an explicit choice or verified customer setting — being a company is NOT sufficient — and prints the buyer's VAT number plus the text "Omvänd betalningsskyldighet".

### AC4 — Claim amounts truncate to whole SEK; rates are time-versioned
**Given** amounts claimed from Skatteverket must be whole SEK with öre DISCARDED (truncation, not rounding)
**When** a ROT/grön amount is claimed
**Then** it truncates down, and a multi-person allocation distributes in whole SEK summing exactly to the invoice's deduction
**And** rates/caps are stored with `ValidFrom`/`ValidTo` (not constants), the ROT+RUT combined 75 000 ceiling is representable alongside the 50 000 ROT cap, and the ROT tax year follows the customer's **payment** date, not the invoice date.

### AC5 — Grön teknik 97 % schablon is opt-in, per category
**Given** the 97 % standard applies ONLY to a genuine fixed-price total contract
**Then** the default basis method is `ACTUAL_ELIGIBLE_COSTS`; the schablon is an explicit user choice, and a mixed project (e.g. solar + battery) splits its basis per category before applying 15/50/50.

**Security/RLS Impact:** none new. **Money Impact:** HIGH — this is the money engine and its golden masters. **Dependencies:** Epic 4 money/tax primitives. **Stop Conditions:** stop if a change would alter an already-SENT quote version's frozen snapshot — snapshots are immutable; new rules apply to NEW versions only.

### Story 10.7: Phase B Connected Field Posture and Phase C PWA/Offline Deferral

As the product owner and delivery team,
I want the planning corpus and sprint history to record the connected Phase B field posture and the complete Phase C PWA/offline deferral,
so that E14–E18 can proceed without an accidental offline dependency or a false claim that halted functionality was delivered.

**Type:** documentation/governance alignment. **Origin:** owner course correction 2026-09-03 after the original Story 10.7 Auto-BMAD run halted `blocked` on an `intent gap`; no implementation started. The exact 2026-07-26 N-3 answer and ADR-B007 remain historical evidence.

### AC1 — ADR-B009 is the current Phase B field decision; ADR-B007 is clearly historical/superseded and points to B009 without being erased.
### AC2 — Every current authoritative Phase B artifact says field workflows are connected responsive web at the 360×640 floor and contains no active PWA-installability, service-worker, durable-offline-storage, offline-read/write, local-queue, replay/sync/conflict, or reconnect/background-sync promise.
### AC3 — E14–E18 remain in Phase B with scheduling, time, jobs, material, diary, deviation, photo, checklist, and completion scope intact, and have no Story 10.7 or ADR-B007 technical prerequisite.
### AC4 — The PRD, architecture, UX, and epics consistently specify component/session/in-memory transient protection, explicit connection/failure/retry states, and server-confirmed success; retained local input is an unsent draft.
### AC5 — The Phase C ledger contains the complete PWA/installability and genuine offline-operation package plus unresolved concrete surfaces, retention/purge, attachment-size, signature/legal, authorization-after-access-change, conflict, platform, security, and testing questions without preselecting implementation architecture.
### AC6 — Scope-manifest impact is explicitly assessed as **no change required** because PWA/offline is not represented as a manifest module; no module is invented and manifest bytes remain unchanged.
### AC7 — The original blocked spec, Auto-BMAD report, and exact state remain traceable as halted/superseded; no historical record says the functionality was implemented or silently marks the blocked implementation run complete.
### AC8 — Repository-wide verification classifies every remaining `ADR-B007`, `NFR53`, `Story 10.7`, `PWA`, `offline`, `offline-capable`, `offline sync`, and `N-3` occurrence as current connected posture, explicit Phase C deferral, or clearly labelled history.

**Security/RLS Impact:** none — no runtime surface or schema. **Money Impact:** none. **Dependencies:** planning corpus and the halted Story 10.7 artifacts only; none on E14–E18. **Stop Conditions:** do not modify product code, migrations, dependencies, lockfiles, `.env` files, or manifest source; do not mark PWA/offline functionality delivered.

### Story 10.8: Quote Review Provenance, Authority, and Audit (ADR-B008)

As an authenticated tenant business user,
I want a bounded attestation to exact server-validated quote content,
so that quote creation, successor creation, and send have accountable authority without claiming that a UI proves attention.

### AC1 — Authenticated, content-bound attestation
**Given** a user performs initial creation, successor creation, final review, or send
**When** review authority is required
**Then** the server validates the exact content and records the authenticated actor's explicit attestation
**And** the system neither treats a browser interaction as proof of attention nor requires a second reviewer.

### AC2 — One-time authority with change invalidation
**Given** a review authorization was issued
**When** it is reused, older than 15 minutes, or source/attachment/customer-visible content changes
**Then** it is rejected and a fresh review is required.

### AC3 — Server boundary and atomic audit
**Given** a quote lifecycle mutation succeeds
**When** the mutation commits
**Then** actor and correlation audit evidence commits atomically with it
**And** authenticated direct DML/bypass and the obsolete digest overload cannot substitute for this authority.

**Technical Notes:** Until Epic 11 activates, `tenant_admin` is the authority. **SEAM (supporting infrastructure, final task):** Epic 11 maps `Quotes.Create`, `Quotes.Approve`, and `Quotes.Send`; the same user may hold all three. Narrow, hardened `SECURITY DEFINER` functions are permitted only if needed to enforce this review-authority boundary. Review authority is explicitly non-HMAC. The separate server-side HMAC byte attestation is owned by Story 10.9 as a PDF-byte activation prerequisite/consumer, not as 10.8 authority. Service-role authority/access remains forbidden.

**Test Requirements:** Unit/command/integration/RLS negatives for expiry, reuse, altered content, cross-tenant attempts, removed bypasses, and atomic audit rollback.

**Security/RLS Impact:** High. **Dependencies:** Stories 10.1–10.6. **Stop Conditions:** stop if a proposed solution needs UI-attention inference, client service-role access, or unauthenticated privilege.

### Story 10.9: Quote PDF Validity and Attachment Carry-Forward (ADR-B008)

As a quote user,
I want every sent quote to use a current PDF and successors to start with eligible predecessor attachments,
so that customer-visible material is coherent across draft edits and versioning.

### AC1 — Current PDF is a send precondition
**Given** customer-visible draft content changes
**When** the edit is saved
**Then** the active PDF is invalidated
**And** send rejects missing, stale, or fingerprint-mismatched PDF output until a current PDF is generated.

### AC2 — Obsolete PDF reference is archived, not deleted
**Given** a current PDF is superseded
**When** it is invalidated or replaced
**Then** its active reference is archived/unlinked, bytes are retained, and normal signed access refuses the archived file.

### AC3 — Eligible attachment carry-forward
**Given** a successor is created
**When** predecessor attachments are evaluated against the current calculation
**Then** all active eligible attachments are preselected, may be deselected/reselected, and reuse immutable bytes without copying
**And** archived or ineligible attachments are omitted with a warning.

### AC4 — Customer-facing tax/PDF wording correction
**Given** a policy window has exclusive `validTo`
**When** rendered to a customer
**Then** wording does not present that boundary as inclusive
**And** fixed-price green inputs are gross including VAT before 97%; ROT+green uses disjoint allowance, insufficient allowance blocks, and reverse charge is mutually exclusive with deductions.

**Technical Notes (superseded for current activation):** the historic reservation/checksum wording is replaced by ADR-B008. Option A's database-issued render/file ID and immutable `files.artifact_kind='quote_pdf'` reservation remain, but completion/send now require the separate server-only HMAC-SHA256 attestation verified in PostgreSQL/`pgcrypto` against matching Vault secret `quote_pdf_attestation_<key-id>`. The HMAC binds the ADR-B008 identity/content/storage/correlation/key/time-window fields, is never returned/logged/persisted, and fails closed; review authority is separate and non-HMAC. No Edge Function, service role/elevated Storage credential, or client bypass.

**DEFERRED:** physical byte reclamation, legal retention periods, and deletion workflows remain E31 / B2→B3 work; carry-forward is not a retention implementation commitment.

**Test Requirements:** Command/integration/RLS proof for PDF invalidation/send gate, archive access denial, attachment eligibility/reselection/reuse, and tax/PDF wording edges.

**Security/RLS Impact:** High. **Dependencies:** Stories 10.6 and 10.8. **Stop Conditions:** stop if the change would hard-delete bytes or broaden normal signed access to archived files.

## Epic 11 [Wave B1a]: RBAC Mechanism and Admin User Management

The `tenant_admin`-only era ends: role storage, the code-level permission matrix, role-aware RLS, sensitive-field withholding, admin user management, and the per-role negative-test harness (ADR-B001). **The matrix seed is no longer a placeholder — N-4 (2026-07-26) supplied it in full** (architecture §3.2A/§3.3A): the five tenant roles with **Företagsadmin** as the admin label, Arbetsledare as a per-job assignment, **multi-role membership as a requirement** (`membership_roles` is built here, not reserved), the four-dimension permission model with the owner's named keys (`Jobs.ViewAssigned`, `Economy.ViewCostPrice`, `Economy.ViewContributionMargin`, `InvoiceBasis.ExportToFortnox`, …), the default money-visibility table, deny-by-default, and audited role/permission changes carrying a required reason.

**FRs covered:** FR66, FR67, FR68, FR69, FR70, FR71, FR72
**Primary NFR coverage:** NFR42, NFR43, NFR44
**Natural dependencies:** Story 10.1 (manifest). Precedes everything in B1b (PB-D2); contributes matrix rows to every later activation.
**Activation:** No new tenant module; adds the matrix + role dimension to the manifest/H4 machinery and seeds matrix rows for the active Phase A modules. Nav item `Användare & roller` (Admin).
**Oracle checks:** None (role names are the owner's own vocabulary, confirmed in N-4; labels stay swappable — the stored admin literal remains `tenant_admin`).

### Epic 12 [Wave B1a]: Tenant Provisioning and Onboarding

An operator provisions a new tenant end-to-end (fill the structured onboarding template → validate → preview → approve → create → first-Admin invite → onboarding checklist) with zero engineering steps. **N-2 (2026-07-26): self-serve signup is permanently out** — not a seam being built toward. The provisioning logic is a deterministic service; an AI agent may orchestrate and validate but gets **no general DB access and cannot run arbitrary SQL in production**. The flow must be dry-runnable without writing, idempotent, audit-logged (including who approved), and safe to re-run after a partial failure. Subscription terms (`SubscriptionPlan`, `IncludedUsers`, `AdditionalUserPrice`, `EnabledModules`, `CommercialOverrides`, …) are stored as **data** — no price is ever hardcoded (architecture §15.4A).

**FRs covered:** FR73, FR74, FR75, FR76
**Primary NFR coverage:** NFR54
**Natural dependencies:** Epic 11 (roles/invites). Session-flagged merge candidate into E11 (provisioning→RBAC) — E-number kept stable.
**Activation:** Platform surfaces (operator console, `platform_operators`, tenants provisioning columns) recorded in the manifest as platform-scoped entries; no tenant module flip.
**Oracle checks:** None (net-new productization surface; legacy `register_company` is the thinned P2 reference).

### Epic 13 [Wave B1a]: Notifications and Email Infrastructure

The sanctioned background-execution path (ADR-B002 runner + producer registry), in-app notifications (bell/center/preferences), and the outbox-shaped email pipeline — queued/non-sending until the activation story. **N-6 (2026-07-26) specifies what activation looks like** (architecture §4.6): a central verified sending subdomain, display name `[Företagsnamn] via [Systemnamn]`, **Reply-To set to the tenant's own address**, the six-step flow priority (invitations/security → quote sending → accept/reject notification → job assignment → quote reminders → digests), **five automatic reminder-stop conditions** (accept, reject, withdrawal, new version, expiry), invoices sent from Fortnox rather than from us, and the full delivery-log field set.

**FRs covered:** FR77, FR78, FR79, FR80, FR81
**Primary NFR coverage:** NFR45, NFR47
**Natural dependencies:** Epic 10 (follow-up data for the first producer), Epic 11 (roles for admin visibility). Precedes E15 reminders, E22 expiries, E23 scanning.
**Activation:** `notifications` module → active (tables `notifications`, `notification_preferences`, `email_outbox`, `email_delivery_events`, `email_suppressions`, `email_unsubscribe_tokens`; ops table `job_runs`); bell/top-bar surface + `/notifications` route (not a nav item).
**Oracle checks:** `Notiser` label.

### Epic 14 [Wave B1b]: Resource and Scheduling Foundation

The minimal bookable person (PB-D13), bookings with optional connections (PB-D12), and deterministic conflict detection with the warn-and-allow override. **N-9 (2026-07-26) supplied the rules, so the conflict/capacity fixtures can harden now** (architecture §10.5A): capacity derives from the **actual weekly schedule**, not employment percentage; capacity = scheduled − holidays/closed days − absence − bookings − blocked time − buffer; overtime is not ordinary capacity and needs an explicit authorised decision; overbooking warns, and a large overrun may require a specific permission; a central Swedish public-holiday calendar plus per-tenant closed days (`tenant_calendar_days` is built, not reserved); no automatic optimisation in Phase B.

**FRs covered:** FR82, FR83, FR84, FR85, FR86
**Primary NFR coverage:** NFR48, NFR53 (connected 360×640 field resilience per ADR-B009)
**Natural dependencies:** Epics 11 and 13. Does NOT wait for jobs depth (PB-D12) and has no Story 10.7/PWA/offline prerequisite. N-3 and N-9 are resolved, so neither gates these stories.
**Activation:** `scheduling` module → active (tables `person_profiles`, `person_work_hours`, `bookings`, `booking_assignees`, `booking_conflicts`); nav item `Planering` lands with the first view surface (E15) in that PR's manifest change.
**Oracle checks:** None at foundation level (E15 carries the view-level checks).

### Epic 15 [Wave B1b]: Scheduling Views, Time Reporting, and Calendar Feeds

The five scheduling views, recurring bookings, the conflict resolver, time reporting, `Min dag`, and the first public token surface (calendar feed) under ADR-B004.

**FRs covered:** FR87, FR88, FR89, FR90, FR91, FR92
**Primary NFR coverage:** NFR46 (calendar feed), NFR48, NFR53 (connected time/Min dag field behavior)
**Natural dependencies:** Epics 13, 14. Calendar feed ships only after the ADR-B004 suite is green (AC-B1b-7).
**Activation:** Extends `scheduling` (tables `booking_series`, `time_reports`, `calendar_feed_tokens`; nav items `Planering`, `Tidrapporter`, route `/my-day`; public surface `calendar_feed`).
**Oracle checks:** Named teams vs arbetsroll grouping in Team view (UXB-A9).

### Epic 16 [Wave B1b]: Jobs Core

> **GATE LIFTED 2026-07-26 — ADR-B006 is recorded.** The model is Jobb-as-container (Option A) implemented as one typed entity (Option C): a single `jobs` table with `type ∈ {order, projekt}`, `work_orders` as children, and "upgrade to projekt" as an audited one-way single-row type change. No `projects` table. E16–E18 design, schema, and story work may proceed (AC-B1b-6 satisfied).

My-jobs, standalone-creatable + connectable jobs, members with per-job roles (Arbetsledare), arbetsorder, projekt upgrade, and the model-agnostic job workspace shell.

**FRs covered:** FR93, FR94, FR95, FR96, FR97, FR98, FR99
**Primary NFR coverage:** NFR42/43 (job-scoped role enforcement), NFR53 (connected 360×640 field shell)
**Natural dependencies:** ADR-B006 recorded; Epics 11, 14 (bookings deepen). Seeds E27 (DoU) and feeds E17/E18.
**Activation:** `jobs` module is Phase A-active; E16 enrolls the job-depth tables per ADR-B006 §8.3 — additive columns on the existing `jobs` (`type` CHECK, project-scope fields, the §8.4 job-card fields), plus `work_orders`, `job_members`, `job_dependencies`, `job_access_windows`. Nav label **`Jobb`** (a projekt is an upgraded jobb, not a sibling entity).
**Oracle checks:** job workspace tab labels against legacy usage; the `Jobb` label's casing/vocabulary (the label choice itself follows from ADR-B006, not from the oracle); the priority value set on the job card (§8.4).

### Epic 17 [Wave B1b]: Jobs Economy and Material

> Gate lifted with Epic 16 (ADR-B006 recorded). Economy separation (companion tables) applies as designed — economy money never sits on the container.

Material usage/requests, payment plan on projekt scope, the integer-öre economy rollup with budget-vs-actual, and the jobs-money golden/comparison-harness extension.

**FRs covered:** FR100, FR101, FR102, FR103
**Primary NFR coverage:** NFR44 (economy companion separation), NFR52 (jobs money goldens), NFR53 (connected material reporting)
**Natural dependencies:** Epic 16; consumes E14/E15 time data (FR92). Feeds E26.
**Activation:** Extends `jobs` (tables `job_material_usage`, `job_material_requests`, `job_payment_plans` + economy companion tables per architecture §3.6/§9.2).
**Oracle checks:** Material request workflow terminology.

### Epic 18 [Wave B1b]: Jobs Field Depth and Completion

> Gate lifted with Epic 16 (ADR-B006 recorded). Capture UX follows the connected ADR-B009 contract in UX §4.8/§4.8A: 360×640, connectivity required, suitable unsent-draft protection, explicit retry, and server-confirmed success. There is no Story 10.7 or ADR-B007 technical dependency.

Diary, deviations, photos, chat, risks, reports/exports, and the audited completion event that seeds warranties (E23) and DoU (E27).

**FRs covered:** FR104, FR105, FR106
**Primary NFR coverage:** NFR53 (connected field capture for diary, deviations, photos, checklists, material, and start/complete marking under ADR-B009), NFR45 (no new background paths outside ADR-B002)
**Natural dependencies:** Epics 13, 16. Emits the completion event consumed by E23/E27.
**Activation:** Extends `jobs` (tables `job_diary_entries`, `job_deviations`, `job_chat_messages`, `job_risks`; photos/documents via manifest-declared `files`/`file_links` owner types/purposes, no new file tables).
**Oracle checks:** Avvikelse severity levels.

### Epic 19 [Wave B1b]: Operational Dashboard v1

One dashboard whose v1 widgets read live B1 data only, registry-driven and manifest-traceable — no placeholder widgets, role-default layouts.

**FRs covered:** FR107, FR108
**Primary NFR coverage:** NFR44 (widget money via entitlement contract), NFR51
**Natural dependencies:** Epics 10, 14, 15, 16 (widget data sources); Epic 11 (role defaults).
**Activation:** No new tenant tables; introduces `src/scope/widget-registry.ts` and declares the six v1 widget ids on their producing modules in the manifest.
**Oracle checks:** None (dashboard is a Phase B-shaped surface; legacy P7 parity completes as later widgets land per wave).

### Epic 20 [Wave B2]: Documents Center

Global `Dokument` surface — an aggregation read-model over all active modules' entity-scoped file metadata (PB-D6); zero new storage tables; `Filer` → `Dokument` nav swap.

**FRs covered:** FR109
**Natural dependencies:** B1 modules emitting compatible metadata (already guaranteed by AR-B16).
**Activation:** `documents` module → active (no tables; nav swap `Filer`→`Dokument`).
**Oracle checks:** `Dokument` label (UXB choice) sanity against legacy document-page vocabulary.

### Epic 21 [Wave B2]: Rentals

Rental register, quick rental, orders (incl. grouped), delivery notes, returns, history, duplicate item, and rental billing records feeding E26.

**FRs covered:** FR110
**Natural dependencies:** Epic 13 (notifications, minor); feeds Epic 26.
**Activation:** `rentals` → active (5 outline tables per architecture §9.3; nav `Uthyrning`).
**Oracle checks:** `Följesedel` / `Retur` labels.

### Epic 22 [Wave B2]: Assets and QR

Asset register (vehicles/tools/equipment), assignments via the person record, events, documents, fault reports, mileage logs, QR/label PDFs, the public QR route (ADR-B004), and proactive scanning via E13.

**FRs covered:** FR111, FR112
**Natural dependencies:** Epics 13, 14 (person record). Session-flagged merge candidate absorbing E24 (panels→assets) — E-numbers kept stable.
**Activation:** `assets` → active (6 outline tables incl. `asset_qr_tokens`; nav `Utrustning`; public surface `asset_qr`).
**Oracle checks:** `Utrustning` vs legacy "Fordon & utrustning".

### Epic 23 [Wave B2]: Service and Warranties

Service records/plans/agreements with authenticated due/overdue scanning → suggestion inbox and plan→job creation; warranties created from job completion events with expiry tracking.

**FRs covered:** FR113, FR114
**Natural dependencies:** Epics 13 (scan producers), 18 (completion event), 16 (job creation).
**Activation:** `service` → active (5 outline tables; nav `Service`).
**Oracle checks:** Service suggestion/queue vocabulary.

### Epic 24 [Wave B2]: Electrical Panels

Panel register/detail with the gruppförteckning dense grid (incl. RCD data), bulk edit, duplicate, and print/PDF export — manual core only.

**FRs covered:** FR115
**Natural dependencies:** None hard; session-flagged merge candidate into E22.
**Activation:** `panels` → active (2 outline tables; nav `Elcentraler`).
**Oracle checks:** `Elcentraler` module label; gruppförteckning column set incl. RCD fields.

### Epic 25 [Wave B2]: Supplier Data and Imports

Supplier master data, price lists, supplier articles, discount agreements (row-sensitive RLS), deterministic price-list file import via the wizard pattern, and supplier article references on calculation rows.

**FRs covered:** FR116
**Natural dependencies:** Phase A calculations (source-picker extension); Epic 11 (row-sensitive role gating).
**Activation:** `suppliers` → active (5 outline tables; nav `Leverantörer`).
**Oracle checks:** Supplier/price-list import vocabulary; discount-agreement terms.

### Epic 26 [Wave B2]: Billing Basis (+ Fortnox Spike)

The Ekonomi assembly workbench: candidate lines from jobs/rentals/service as copy-by-value öre snapshots; review, audited adjust, announced lock (`Utkast → Låst → Exporterad`), export — closing B2 (PB-D11). Hosts the B2 Fortnox spike feeding ADR-B005-final and N-5.

**FRs covered:** FR117, FR118 (spike feeds FR127)
**Primary NFR coverage:** NFR49; NFR52 (billing goldens)
**Natural dependencies:** Epics 17, 21, 23 (line sources); **Story 10.6** — the ratified money rules (§12A) must be in the engine before a basis drives real invoicing (demo track unaffected). Content definition per N-5 (architecture §7.3), including the versioned `Draft → UnderReview → Approved → Exported → PartiallyInvoiced → Invoiced → Cancelled` status flow and the double-invoicing lock on consumed source items.
**Activation:** `billing` → active (3 outline tables; nav `Faktureringsunderlag`).
**Oracle checks:** Faktureringsunderlag line/adjustment vocabulary (legacy had rental-only underlag, P40).

### Epic 27 [Wave B3]: DoU Manual Core

DoU projects, discipline templates, folder/document structure, upload/import, versioning + lock, package export, material-list sync, and seed-from-job.

**FRs covered:** FR119
**Natural dependencies:** Epics 16/18 (seed-from-job, completion consumer), 20 (document volume). Compliance content is owner-side (N-8 — Johan Ahlström named as content owner); we build the template engine, versioning, and approval flow, store `ContentOwnerUserId` as a **configurable reference rather than a hardcoded name**, and do not author content presented as legally, regulatorily, or electrically authoritative.
**Activation:** `dou` → active (4 outline tables; nav `DoU`).
**Oracle checks:** DoU folder/template structure vocabulary.

### Epic 28 [Wave B3]: Self-Inspections

Template-driven form runner (field-shape capable), sections/items/measurements/attachments, manual creation, export, and links to kund/anläggning/jobb/DoU.

**FRs covered:** FR120
**Natural dependencies:** Epic 27 adjacency (links), field shape from E18 patterns. Template content is owner-side per N-8; `ContentOwnerUserId` is a configurable reference.
**Activation:** `self_inspections` → active (4 outline tables; nav `Egenkontroller`).
**Oracle checks:** Egenkontroll template/section vocabulary.

### Epic 29 [Wave B3]: Tenders/FKU Thin Core

Upload tender files/ZIP with unzip into organized storage, manual summary fields, manual conversion links — the conscious thin parity slice.

**FRs covered:** FR121
**Natural dependencies:** Epic 20 (file volume). **Thin slice accepted by the owner (N-7, 2026-07-26)** — AI document analysis, requirement extraction, version comparison, risk classification, generated answers, and scoring are explicitly Phase C. Session-flagged KNX adjacency (E30).
**Activation:** `tenders` → active (1 outline table; nav `Anbud (FKU)`).
**Oracle checks:** `Anbud (FKU)` label.

### Epic 30 [Wave B3]: KNX Manual Tables

Group-address projects with rooms/functions/address tables and settings — the panels-style dense grid at small scope.

**FRs covered:** FR122
**Natural dependencies:** None hard; session-flagged tenders adjacency (E29).
**Activation:** `knx` → active (2 outline tables; nav `KNX`).
**Oracle checks:** KNX table column vocabulary vs legacy.

### Epic 31 [Wave B3]: HR and Personnel Depth

Employment depth on the same person record (PB-D13), competence cards, certifications, training plans, employee documents, incidents + HR inbox, `Min sida` self-service (incl. authenticated suggestions, P70 thinned), and the GDPR deletion-request workflow.

**FRs covered:** FR123, FR124
**Natural dependencies:** Epics 13 (expiry alerts), 14 (person record), 22 (assigned-assets view). **Deletion posture answered by N-10** (architecture §12B): retention fields, `Received → … → Closed` request states, `LegalHold`, a central versioned retention policy rather than scattered constants, coverage of every identifiable person including contact persons/subcontractors/people in photos, and no hard-delete affordance for ordinary tenant admins. Earlier modules adopt the retention field contract as they activate — E31 owns the workflow, not the fields.
**Activation:** `hr` → active (~6–7 outline tables extending `person_profiles`; nav `Personal`, `Min sida`).
**Oracle checks:** Competence-card/certification vocabulary; `Min sida` matches legacy P69.

### Epic 32 [Wave B3]: Notes and CRM Completions

Notice board with categories/pinning/archive and mention notifications; customer 360, favorites, classification tools, duplicate-calculation flow, quote-settings/branding completions.

**FRs covered:** FR125, FR126
**Natural dependencies:** Epic 13 (mentions); frozen Phase A CRM/calc surfaces (deltas only). Session-flagged bundle (notes+CRM) — one epic, stable number.
**Activation:** `notes` → active (~2 outline tables; nav `Anslagstavla`); CRM completions ride active Phase A modules.
**Oracle checks:** `Anslagstavla` label; customer-classification vocabulary.

### Epic 33 [Wave B3]: Fortnox Foundation

Per-tenant Fortnox connection (OAuth entirely server-side), mapping configuration, and the outbox export architecture — only after ADR-B005-final (post-spike).

**FRs covered:** FR127
**Primary NFR coverage:** NFR50
**Natural dependencies:** Epic 26 (billing basis), the E26-hosted spike, ADR-B005-final. **N-5 prerequisites are settled** (architecture §7.1): per-tenant OAuth 2 Authorization Code Flow, never shared credentials; initial scopes `companyinformation, customer, article, invoice` with the rest added only when the feature is built; our system master for the invoice basis, Fortnox master for the invoice, its number, bookkeeping and payment status; no automatic bookkeeping or sending from our system in v1.
**Activation:** `fortnox` → active (3 sketch tables `fortnox_connections`, `integration_outbox`, `external_mappings`; nav `Fortnox`; settings section) — nothing exists before the final ADR + this activation.
**Oracle checks:** None (net-new owner-directed addition; no legacy Fortnox surface existed).

### Epic 34 [Wave B3]: Fortnox Billing Flows

Export customers, articles, and invoice bases to Fortnox with per-record status, plain-language error detail, and per-record/per-run retry UX.

**FRs covered:** FR128
**Primary NFR coverage:** NFR50
**Natural dependencies:** Epic 33.
**Activation:** Extends `fortnox` (no new module).
**Oracle checks:** None.

## Epic 10 [Wave B1a]: Quote Lifecycle Completion (+ Phase B Governance Re-Baseline)

**Epic goal:** Warm up the Phase B pipeline on a deliberately small epic (PB-D3): land the one-time governance re-baseline first, then complete the owner-confirmed quote status set with lost/declined lifecycle, follow-ups, and pipeline surfacing.

**Scope:** Story 10.1 re-baseline (AGENTS.md/docs/process/phase-scope-reviewer + scope manifest + derivations + coherence validator); Förlorad/Avböjd with reasons; follow-up workflow; quote-list and read-model surfacing for the dashboard; the approved 10.8/10.9 provenance/authority/audit, current-PDF, and attachment carry-forward correction (ADR-B008).

**Explicit non-scope:** Any mutation of sent snapshots; a separate analytics page (PB-D7); email reminders (E13 registers the producer; sending activates per N-6); dashboard widget rendering (E19); global physical file reclamation/legal retention (E31 / B2→B3).

**Dependencies:** None. Story 10.1 precedes every other Phase B story.

**Risks:** Derivation refactor silently changing guardrail expectations; lifecycle events leaking into snapshot mutation; follow-up lists drifting from the one-open-per-quote rule.

**Wave acceptance tie:** AC-B1a-5, AC-B1a-6.

### Story 10.1: Phase B Governance Re-Baseline and Scope Manifest

As an implementation lead,
I want the Phase B scope re-baseline and the single machine-readable scope manifest landed in one story before any module story,
So that all ~15–25 Phase B scope changes flow through one derived, validated source instead of four drifting authored copies.

**Acceptance Criteria:**

**Given** the ratified Phase B planning package (PRD, architecture ADR-B003)
**When** the re-baseline change lands
**Then** the `AGENTS.md` phase statement and deferral list are rewritten to Phase B scope with the Phase C ledger (PRD §14) as the deferred set
**And** `docs/process` scope statements and the `phase-scope-reviewer` agent are updated to review against the manifest, all in one ADR-backed change.

**Given** the scope manifest is introduced at `src/scope/manifest.ts`
**When** it is type-checked and imported
**Then** it is a typed, `satisfies ScopeManifest`-guarded constant listing per module: id, label, wave (`A`/`B1a`/`B1b`/`B2`/`B3`), status (`active`/`pending` with epic reference + date required when active), nav items, tenant tables, widgets, notification categories, public surfaces, and file owner types
**And** Phase A's shipped surface (7 nav items, 24 tenant tables, 7 file owner types) is the initial `active` set under wave `A`, with every Phase B module `pending`.

**Given** the derivation refactor
**When** the guardrail suites run
**Then** the deferred deny-list (`src/features/files/deferred-categories.ts`), the nav guardrail expected set, the tenant-table inventory expectation (H4 expected enrollment), and the deferred-token scope scans derive their expected values from the manifest
**And** the derived expected values are identical to the previously authored Phase A values (proving no drift during refactor)
**And** fail-loud is retained: any surface not manifest-listed still fails CI (FR129, FR130).

**Given** the manifest coherence validator
**When** an incoherent manifest state is introduced in test
**Then** the suite fails for each of: an `active` module without an epic reference; a nav item, tenant table, widget, notification category, file owner type, or public surface not traceable to an `active` module; a `pending` module with live surface; a public-surface union exceeding the ADR-B004 closed set of three.

**Technical Notes:** ADR-B003 §5 is the design authority; PRD §13 fixes the story content. TypeScript over YAML (AB-A6); place in `src/scope/` for runtime imports. The "activation without permission-matrix rows fails" coherence rule is wired at Story 11.1 when the matrix source exists (EB-A5). Docs-heavy + focused code refactor; no schema, no new dependencies.

**Test Requirements:** Manifest coherence validator unit suite (`tests/unit/scope/`); refactored guardrail suites green with expected values proven equal to the pre-refactor authored values; docs validators updated for the rewritten AGENTS.md/process statements; scope-scan CI checks pass.

**Security/RLS Impact:** None directly; strengthens the enforcement machinery every later security-relevant activation depends on.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** None.

**Dependencies:** None. Blocks all other Phase B stories.

**Stop Conditions Requiring Human Approval:** Stop if any derived guardrail expectation diverges from the shipped Phase A surface during the refactor (indicates existing drift that must be resolved, not papered over), or if the re-baseline would require weakening a deny/hook enforcement path.

### Story 10.2: Förlorad/Avböjd Status and Lost-Reason Lifecycle

As a Säljare,
I want to mark a sent quote version as Förlorad/Avböjd with a required reason,
So that the pipeline reflects reality and hit-rate analytics have honest inputs — without touching the sent commitment.

**Acceptance Criteria:**

**Given** a sent quote version
**When** the user chooses `Markera som förlorad/avböjd`
**Then** a dialog requires outcome (`Förlorad` or `Avböjd`) and a structured reason (category from the tenant strawman list + note, note required when `Annat`)
**And** the confirmation states plainly that the flip is an append-only lifecycle event, the sent snapshot does not change, and a new version can still revive the deal.

**Given** the user confirms
**When** the command executes
**Then** the widened lifecycle RPC (`markQuoteVersionLost`, extending the existing `mark_quote_version_lifecycle` per architecture §14) appends the `quote_events` status flip and inserts exactly one `quote_lost_reasons` row (unique per version, insert-only — no UPDATE policy) in one transaction with an audit event
**And** the version badge renders the terminal `Förlorad/Avböjd` style distinct from `Accepterad`, with the reason visible on the version card and in `Händelser`.

**Given** the sent-immutability invariant (NFR11)
**When** the full sent-immutability regression suite runs after lifecycle completion lands
**Then** it stays green: no customer-visible snapshot field, attachment selection, or PDF source datum changed through the lost/declined path (FR63).

**Given** the quote list
**When** filtering by status
**Then** `Förlorad/Avböjd` is a filter value and a `Förlustorsak` column is available in that filter view.

**Given** tenant A and tenant B quotes
**When** cross-tenant lost/declined attempts occur
**Then** RLS and command validation reject them generically.

**Technical Notes:** Tables per architecture §9.1 (`quote_lost_reasons`). Runs under `tenant_admin` until Epic 11 activates roles; the command uses the envelope's capability seam so the E11 matrix applies without rework (EB-A4). Reason category list is the UXB-A5 strawman, tenant-tunable later. Oracle check (Förlorad vs Avböjd distinction, categories) resolved before this story per Cross-Epic Rule 2.

**Test Requirements:** Integration tests for the lost transition (happy path, duplicate attempt rejected by uniqueness, missing reason rejected); sent-immutability regression suite re-run; RLS negatives incl. insert-only enforcement on `quote_lost_reasons`; unit tests for reason validation; lifecycle golden fixture extended with a lost version.

**Security/RLS Impact:** Medium. New tenant-owned table + widened lifecycle RPC (SECURITY INVOKER, ADR-A009 pattern).

**Money/Tax/Quote Impact:** High-adjacent: touches the quote lifecycle but must not alter any money or snapshot content — the regression suite is the proof.

**Migration/Coexistence Impact:** Compare against legacy accept/reject/lost behavior (P19) and document deltas; no data migration.

**Dependencies:** Story 10.1.

**Stop Conditions Requiring Human Approval:** Stop if completing the status set would require any UPDATE on sent-version rows or any new rounding/money logic.

### Story 10.3: Quote Follow-Up Workflow

As a Säljare,
I want to plan, see, and complete follow-ups on sent quotes,
So that open deals get worked and decided instead of silently going stale.

**Acceptance Criteria:**

**Given** a sent quote version
**When** the user chooses `Planera uppföljning` with a due date and note
**Then** a follow-up is created (status open) and appears on the quote detail header as the next-follow-up chip
**And** a partial unique index enforces at most one open follow-up per quote (UXB-A6); planning a second is rejected with a clear message.

**Given** open follow-ups exist
**When** the user views the quote list
**Then** filters `Har uppföljning` and `Försenad uppföljning` work, and overdue follow-ups escalate visually (badge).

**Given** a due follow-up
**When** the user completes it (`Klarmarkera`) with an outcome note
**Then** the completion is recorded and audited, the sheet offers `planera nästa`, and offers jumps to `Markera som förlorad/avböjd` (Story 10.2) and `Ny version`
**And** completing from the follow-up surface auto-completes with the chosen outcome when the lost path is taken.

**Given** tenant isolation
**When** cross-tenant follow-up reads/writes are attempted
**Then** RLS rejects them; follow-up commands are envelope-authorized and audited.

**Technical Notes:** Table `quote_follow_ups` per architecture §9.1 (due date, note, status open/completed, outcome). The due-reminder notification producer (`quote.follow_up_due`) is registered by Epic 13 consuming this data — no forward dependency: lists and badges here work without notifications (EB-A8). Single-row envelope commands; no RPC needed.

**Test Requirements:** Integration tests for plan/complete/annotate, the one-open-per-quote constraint, due/overdue list logic (date-boundary unit tests); RLS negatives; audit-event assertions.

**Security/RLS Impact:** Medium. New tenant-owned table with standard role-gated policies.

**Money/Tax/Quote Impact:** None (workflow metadata only).

**Migration/Coexistence Impact:** Compare with legacy follow-up handling (P18); document deltas; no data migration.

**Dependencies:** Stories 10.1, 10.2 (jump target).

**Stop Conditions Requiring Human Approval:** Stop if parallel open follow-ups per quote turn out to be a hard legacy-behavior requirement (would reverse UXB-A6 — take to oracle/owner).

### Story 10.4: Pipeline Surfacing and Dashboard Read-Model

As a Säljare and Projektledare,
I want quote pipeline data (counts, hit rate, open follow-ups) surfaced in lists and available as a server read-model,
So that the pipeline is visible now and the E19 dashboard can render it without re-implementation.

**Acceptance Criteria:**

**Given** quotes across the lifecycle (sent, accepted, lost/declined)
**When** the pipeline read-model is queried for a period
**Then** it returns sent/accepted/lost counts, hit rate, and open/overdue follow-up counts computed server-side from lifecycle events (FR65)
**And** money amounts in the projection ride the entitlement descriptor so unentitled roles receive no amounts (mechanism per AR-B6; seed per N-4 / architecture §3.3A).

**Given** the quote list and detail surfaces
**When** lifecycle completion data exists
**Then** status filters, the `Förlustorsak` column, follow-up filters, and header chips from Stories 10.2–10.3 render consistently with `StatusBadge`/`ConnectionChip` contracts (UX-BDR4, UX-BDR17).

**Given** no separate analytics page exists
**When** scanning the shipped surface
**Then** pipeline data appears only in the quote list/detail surfaces and the read-model consumed later by E19 (PB-D7) — no new nav item, no widget yet.

**Technical Notes:** First `src/server/read-models/**` module (architecture §11) — establishes the `{ data, entitlements }` pattern the whole phase reuses. Deterministic period boundaries (Europe/Stockholm) unit-tested. Widget rendering is Epic 19's; this story owns data + list surfacing.

**Test Requirements:** Unit tests for pipeline aggregation (counts, hit rate, period boundaries, empty states); read-model entitlement projection tests (withheld amounts absent + listed); list filter integration tests.

**Security/RLS Impact:** Low-medium. Read-model queries via the RLS client only.

**Money/Tax/Quote Impact:** Medium. Aggregates must be öre-derived and follow aggregate honesty (no partial sums).

**Migration/Coexistence Impact:** None.

**Dependencies:** Stories 10.1–10.3.

**Stop Conditions Requiring Human Approval:** Stop if pipeline aggregation would require a new money computation path outside `@/lib/money`.

### Story 10.5: Quote-Table DB Hardening and Read-Model Pagination (post-review follow-up)

As a tenant admin whose data integrity must not depend on clients using the app,
I want the quote lifecycle tables to enforce their invariants in the DATABASE and the pipeline reads to stay correct at scale,
so that a direct table-API call cannot forge or corrupt follow-up/lost state, and pipeline numbers do not silently truncate as a tenant grows.

**Origin:** the independent Codex review rounds on [PR #38](https://github.com/rthunborg/ElproSaas/pull/38). The two **P1** findings from that review (source→destination transition validation on the sent-lock trigger; the manual-completion quote scope) were fixed **in** Epic 10. The 8 items below were **consciously ledgered** rather than bolted onto an already thrice-revised PR — see `deferred-work.md` → `## Deferred from: Codex review of epic-10 (2026-07-25)`. Each is **P2**; none is exploitable cross-tenant (RLS holds throughout — these are own-tenant integrity and scale issues).

**Acceptance Criteria**

### AC1 — `quote_lost_reasons` cannot be orphaned or mis-anchored

**Given** the insert policy today only checks tenant membership
**When** an authenticated tenant admin inserts a reason row directly through the table API
**Then** the DB rejects a reason whose `quote_version_id` does not belong to the supplied `quote_id`, or whose version is not becoming `lost` in the same transaction
**And** the unique `(quote_version_id)` slot can no longer be consumed pre-emptively — which today makes a later legitimate `mark_quote_version_lost` fail with 23505 and roll back (a self-inflicted denial of the app path).

### AC2 — `quote_follow_ups` anchors are enforced in the DB

**Given** the two independent same-tenant FKs prove same-tenant parents but not their relationship
**When** a follow-up row is written directly
**Then** a composite constraint (or equivalent trigger) requires `quote_version_id` to belong to `quote_id`
**And** an open follow-up requires a `sent` anchor version, so a forged row cannot attach to a draft or occupy another quote's one-open slot.

### AC3 — Follow-up identity and lifecycle are immutable in the wrong directions

**Given** the UPDATE policy currently permits every column while the row stays in-tenant
**When** a direct UPDATE attempts to move a follow-up to another quote/version, reopen a completed row, or pre-populate completion fields
**Then** a transition/column trigger rejects it — only `open → completed` (plus note edits on an open row) is legal, matching the audited commands.

### AC4 — Plan-time anchor check is atomic

**Given** `planQuoteFollowUp` reads the anchor status and then inserts
**When** the version is accepted/lost between the read and the insert
**Then** the insert still cannot create an open follow-up on a terminal quote — the anchor is locked and re-checked in the same transaction, or the sent-state predicate is enforced in the DB.

### AC5 — Pipeline reads are complete at scale

**Given** `supabase/config.toml` sets `max_rows = 1000` and PostgREST truncates **silently** (no error, so the empty-result fallback never fires)
**When** a tenant exceeds 1000 lifecycle events, versions, or lost-reason rows
**Then** the pipeline event read, the latest-status lookup, and the quote-list lost-reason read all return complete results — by pushing the period/id filters into the database and paginating (or aggregating in a DB query/RPC)
**And** counts, hit rate, accepted value, and the `Förlustorsak` column stay correct rather than degrading quietly.

### AC6 — Accepted-value summation cannot silently lose öre

**Given** the canonical money contract requires safe-integer öre end-to-end
**When** summed accepted commitments would exceed `Number.MAX_SAFE_INTEGER`
**Then** the aggregate uses the guarded öre summation (or a bigint representation) and fails loudly rather than returning a silently rounded amount.

### AC7 — Pipeline metrics do not rest on a forgeable log

**Given** `quote_events` carries an `authenticated` INSERT grant plus an own-tenant insert policy
**When** a tenant admin inserts arbitrary `sent`/`accepted`/`lost` events with caller-chosen `occurred_at` through the table API
**Then** the pipeline can no longer be skewed by them — either event insertion is hardened to the command/RPC path (the log becomes append-only-by-command), or the metrics are derived from a command-owned authoritative source (version status + acceptance rows) rather than the event log
**And** counts, hit rate and accepted value cannot be inflated or shifted between periods without an authoritative state change.

*Note: the underlying client-insertability of `quote_events` is a PRE-EXISTING deferral from Story 6.4 — what Story 10.4 changed is that this log is now an **analytics source**, which raises the stakes. Fixing the insert path likely closes both.*

### AC8 — A lifecycle transition and its audit row cannot diverge

**Given** `mark_quote_version_lost` commits status + event + reason in its OWN transaction and the envelope writes `audit_events` afterwards
**When** the audit write fails transiently after the RPC has committed
**Then** the system does not end in the current state — where the user sees a failed command, the retry is refused (the version is already `lost`), and a critical transition is left permanently unaudited
**And** the fix is either an audit insert inside the same transaction as the transition, or a durable transactional outbox — never treating a post-commit audit failure as if the mutation failed.

*Scope warning: this is an **envelope-wide** shape, not a `lost.ts` bug — every RPC-backed command (including `acceptQuoteAndCreateJob`) has it. Fixing it properly touches the command envelope and probably deserves its own ADR; it is filed here because Codex found it here. Split it out if it grows beyond this story.*

### AC7 — Pipeline metrics do not rest on a forgeable log

**Given** `quote_events` carries an `authenticated` INSERT grant plus an own-tenant insert policy
**When** a tenant admin inserts arbitrary `sent`/`accepted`/`lost` rows with caller-chosen `occurred_at` through the table API
**Then** the pipeline read-model must not silently treat those as truth — either event insertion is hardened to command-only (closing the pre-existing `quote_events` client-insertable deferral, ledger item `6-4`), or the metrics are derived from a command-owned authoritative source (e.g. version status + acceptance rows) rather than the log
**And** counts, hit rate, and accepted value can no longer be inflated or period-shifted without a lifecycle command.

### AC8 — A critical transition cannot commit without its audit

**Given** `mark_quote_version_lost` (and every other RPC-backed command) commits its own transaction, after which the envelope writes the audit row separately
**When** that audit write fails transiently
**Then** the system must not end in the current state — transition committed, audit missing, user shown an error, and the retry rejected because the version is already `lost`
**And** the fix is either to include the audit insert in the same transaction as the transition, or to use a durable transactional outbox; **note this is an ENVELOPE-WIDE property, not specific to the lost path** — scope the fix accordingly (it may warrant its own ADR).

**Technical Notes**

- **Do NOT weaken** the Epic-10 guards to satisfy these: `enforce_lost_version_has_reason` fires on INSERT **and** UPDATE deliberately (`authenticated` holds a direct INSERT grant on `quote_versions`), and the sent-lock trigger now validates the `(old → new)` pair. Both are load-bearing.
- Test seeding must keep using `adminInsertLostQuoteVersionWithReason` (one writable-CTE statement = one transaction), since the coherence trigger is `DEFERRABLE INITIALLY DEFERRED`.
- AC5 is the only item with user-visible impact **at scale**; at pilot data volumes none of these bite today — which is why they were ledgered rather than rushed.

**Security/RLS Impact:** Meaningful but bounded. **No cross-tenant exposure** — every item is own-tenant integrity (RLS and the envelope hold). The theme is "the direct table API can bypass invariants the command layer enforces," the same theme as the two P1s already fixed.

**Migration/Coexistence Impact:** New migration(s) adding constraints/triggers to `quote_lost_reasons` and `quote_follow_ups`. Additive; must flow repo→demo after merge.

**Money Impact:** AC6 only (guarded öre summation).

**Dependencies:** Stories 10.1–10.4 (the tables and read-model it hardens).

**Stop Conditions Requiring Human Approval:** Stop if enforcing an AC would require weakening an existing Epic-10 guard, or if a constraint would break the shipped RPC paths (the RPC must remain the sanctioned way to reach these states).

### Story 10.8: Quote Review Provenance, Authority, and Audit (ADR-B008)

As an authenticated tenant business user, I want a bounded attestation to exact server-validated quote content, so that quote creation, successor creation, and send have accountable authority without claiming that a UI proves attention.

**Acceptance Criteria:**

### AC1 — Authenticated, content-bound attestation
**Given** a user performs initial creation, successor creation, final review, or send
**When** review authority is required
**Then** the server validates the exact content and records the authenticated actor's explicit attestation
**And** the system neither treats a browser interaction as proof of attention nor requires a second reviewer.

### AC2 — One-time authority with change invalidation
**Given** a review authorization was issued
**When** it is reused, older than 15 minutes, or source/attachment/customer-visible content changes
**Then** it is rejected and a fresh review is required.

### AC3 — Server boundary and atomic audit
**Given** a quote lifecycle mutation succeeds
**When** the mutation commits
**Then** actor and correlation audit evidence commits atomically with it
**And** authenticated direct DML/bypass and the obsolete digest overload cannot substitute for this authority.

**Technical Notes:** `tenant_admin` is temporary authority until Epic 11. **SEAM:** `Quotes.Create`, `Quotes.Approve`, `Quotes.Send`; one user may hold all. A narrowly hardened `SECURITY DEFINER` function is permitted only where needed for this boundary. Review authority is non-HMAC; the separate server-only HMAC is required only for Story 10.9 PDF-byte activation. Service-role authority is not.
**Test Requirements:** Unit, command, integration, and RLS negatives for expiry, reuse, changed content, tenant isolation, bypass removal, and atomic-audit rollback.
**Security/RLS Impact:** High. **Dependencies:** Stories 10.1–10.6. **Stop Conditions:** UI-attention inference, client service-role access, or unauthenticated privilege.

### Story 10.9: Quote PDF Validity and Attachment Carry-Forward (ADR-B008)

As a quote user, I want every sent quote to use a current PDF and successors to start with eligible predecessor attachments, so that customer-visible material is coherent across edits and versions.

**Acceptance Criteria:**

### AC1 — Current PDF is a send precondition
**Given** customer-visible draft content changes
**When** the edit is saved
**Then** the active PDF is invalidated
**And** send rejects missing, stale, or fingerprint-mismatched PDF output until a current PDF is generated.

### AC2 — Obsolete PDF reference is archived, not deleted
**Given** a current PDF is superseded
**When** it is invalidated or replaced
**Then** its active reference is archived/unlinked, bytes are retained, and normal signed access refuses the archived file.

### AC3 — Eligible attachment carry-forward
**Given** a successor is created
**When** predecessor attachments are evaluated against the current calculation
**Then** all active eligible attachments are preselected, may be deselected/reselected, and reuse immutable bytes without copying
**And** archived or ineligible attachments are omitted with a warning.

### AC4 — Customer-facing tax/PDF wording correction
**Given** a policy window has exclusive `validTo`
**When** rendered to a customer
**Then** wording does not present that boundary as inclusive
**And** fixed-price green inputs are gross including VAT before 97%; ROT+green uses disjoint allowance, insufficient allowance blocks, and reverse charge is mutually exclusive with deductions.

**Technical Notes:** `start_quote_pdf_render` issues the sole render/file ID. The narrow authenticated `reserve_quote_pdf_file` RPC reserves immutable metadata before the first non-upsert Storage upload and is the only authenticated route that may set nullable `files.artifact_kind='quote_pdf'`; generic files remain `NULL`. A reserved draft quote PDF is not signable. Completion/send verify Storage existence/system MIME/size and a separate server-only short-lived HMAC-SHA256 byte attestation in PostgreSQL/`pgcrypto` against matching Vault secret `quote_pdf_attestation_<key-id>`. The HMAC binds tenant, actor, version, render/file, current fingerprint, bucket/path, checksum, size, MIME, correlation, key, and time window; it is never returned/logged/persisted and fails closed. Review authorization is non-HMAC. Render start is correlation-idempotent with a five-minute lease and response-loss reconciliation preserves a current generated PDF. No Edge Function, service role/elevated Storage credential, or client bypass.

**DEFERRED:** physical reclamation, legal retention periods, and deletion workflow remain E31 / B2→B3; carry-forward is not a retention implementation commitment.
**Test Requirements:** Command/integration/RLS proof for invalidation, send gate, archive denial, eligibility/reselection/reuse, and tax/PDF wording edges.
**Security/RLS Impact:** High. **Dependencies:** Stories 10.6 and 10.8. **Stop Conditions:** hard deletion or broadened signed access to archived files.

## Epic 11 [Wave B1a]: RBAC Mechanism and Admin User Management

**Epic goal:** End the `tenant_admin`-only era with a mechanism-first permission system (ADR-B001): role storage, the code-level matrix, role-aware RLS, server-side sensitive-field withholding, admin user management, and the generated per-role negative-test harness.

**Scope:** Role CHECK widening + role-SET code contract; `permission-matrix.ts` + `requireCapability`; `has_tenant_role` + row-scope predicates; matrix seed for the active Phase A modules; nav/landing derivation; entitlement read-model descriptor; invite/reset/deactivate/reactivate/remove; Roles UX + effective-permissions viewer; per-role test generation.

**Explicit non-scope:** Custom role builder (UXB-A7); DB permission tables (AB-A3); multi-role storage (`membership_roles` reserved, not built — AB-A2); job-scoped Arbetsledare enforcement (lands with E16's `job_members`); resolving N-4 (the entitlement seed ships as a flagged conservative default).

**Dependencies:** Story 10.1. Precedes all of B1b (PB-D2).

**Risks:** Policy↔matrix drift; client gating mistaken for authority; sensitive values leaking through aggregates or emails; invitation flows bypassing audit; last-admin lockout.

**Wave acceptance tie:** AC-B1a-2, AC-B1a-3.

### Story 11.1: Role Storage and Permission-Matrix Mechanism

As an implementation lead,
I want role storage widened and the code-level permission matrix + envelope capability gate in place,
So that every later module can declare authorization rows once, in one source, enforced server-side.

**Acceptance Criteria:**

**Given** the existing `tenant_memberships` table
**When** the role mechanism lands
**Then** the `role` CHECK widens from the single literal `tenant_admin` to the seed set (`tenant_admin` retained as the stored literal, UI label **Företagsadmin** — no rename, no data migration, `is_tenant_admin()` untouched; plus `projektledare`, `montor`, `saljare`, `ekonomi`), confirmed by owner answer N-4.
**And** **multi-role membership ships here, not later** — N-4 revised AB-A2: *"En användare ska kunna ha flera roller och jobbrelaterade uppdrag samtidigt."* The additive `membership_roles` child table (tenant_id, membership_id, role; unique per membership × role) lands in this story, and every authorization API takes a role set (`roles: Role[]`), evaluated as the **union** of the held roles' permissions — with sensitive fields withheld only when **no** held role is entitled.

**Given** the permission matrix at `src/server/authz/permission-matrix.ts`
**When** it is introduced
**Then** it is a typed, `satisfies`-guarded constant mapping moduleId → capability → allowed roles plus per-module sensitive-field entitlement rows
**And** the manifest coherence validator gains the rule "activating a module without matrix rows fails" (completing Story 10.1's deferred rule).

**Given** the command envelope
**When** any command executes after membership resolution
**Then** `requireCapability(ctx, moduleId, capability)` consults the matrix; failure returns the stable `PERMISSION_DENIED` with no existence signals (same discipline as `TENANT_ACCESS_DENIED`).

**Given** the new `has_tenant_role(target_tenant_id, allowed_roles)` RLS helper
**When** it is created
**Then** it follows the proven hardened DEFINER-helper shape (fixed empty `search_path`, schema-qualified, `STABLE`, revoked from PUBLIC) with a standing negative test.

**Technical Notes:** ADR-B001 §3.2–§3.5, and **§3.3A for the seed content** (N-4). The permission model has four dimensions — resource/area, action, data scope, sensitive field groups — and keys bind to **stable business functions and API operations, never to page names or a field's current UI position**. Use the owner's named keys verbatim (`Customers.*`, `Jobs.ViewAssigned`/`ViewAll`/`AssignUsers`/`ApproveCompletion`, `Quotes.*`, `InvoiceBasis.*` incl. `ExportToFortnox`, `Economy.ViewSalesPrice`/`EditSalesPrice`/`ViewCostPrice`/`EditCostPrice`/`ViewContributionMargin`, `Users.*`, `Roles.*`, `CompanySettings.*`) — do not coin synonyms alongside them. **Deny-by-default**: absence of an explicit permission is a denial. No UI in this story. Arbetsledare is deliberately absent from tenant roles (a per-job assignment, E16 — §3.2A). The CHECK widening migration is additive-only.

**Test Requirements:** Unit tests for matrix typing/lookup and `requireCapability`; migration reset green; `has_tenant_role` positive/negative integration tests; standing hardened-helper negative test; coherence-validator rule test.

**Security/RLS Impact:** High. This is the authorization mechanism everything else trusts.

**Money/Tax/Quote Impact:** None directly (sensitive-field rows defined, enforced in 11.2).

**Migration/Coexistence Impact:** None (additive CHECK; existing memberships remain valid Admin rows).

**Dependencies:** Story 10.1.

**Stop Conditions Requiring Human Approval:** Stop if any design pressure pushes toward DB permission tables or **tenant-runtime-mutable** roles in B1a (contradicts AB-A3/UXB-A7 — N-4 confirms tenant-specific role compositions are authored by us via an internal surface or version-controlled configuration, never by direct production-DB edits), or if the widening would require touching `is_tenant_admin` semantics.

### Story 11.2: Non-Admin Access to the Phase A Surface (Matrix Seed, Role-Aware RLS, Nav and Landing)

> **N-4 ANSWERED 2026-07-26 — the conservative-default placeholder is retired.** This story seeds the matrix with the owner's actual defaults, not a team guess, and nothing renders "väntar på ägarbeslut". The seed (architecture §3.3A): **Företagsadmin** — whole company, sales prices yes, cost + contribution margin yes. **Projektledare** — assigned projects/jobs, planning, resources, economy; prices yes; cost + TB yes. **Montör** — own/assigned jobs, time, material, documents, checklists, deviations; **no sales price, no cost price, no contribution margin**. **Säljare** — customers, leads, quotes, sales prices and discounts; **sales prices yes, cost and TB no by default**, with `Economy.ViewContributionMargin` grantable separately to e.g. a sales manager or senior seller. **Ekonomi** — invoice basis, invoices, VAT, ROT, grön teknik, financial follow-up; prices, cost, and TB yes. **Arbetsledare** (per-job, E16) — the specific job's crew, planning, documentation, and consumption; no prices, no cost/TB by default.
>
> Two additional requirements from N-4 that belong to this story: **role and permission changes are audit-logged** with `ChangedBy`, `ChangedAt`, `CompanyId`, `RoleId`, `PreviousPermissions`, `NewPermissions`, and a **required** `Reason`; and the owner's suggested margin affordance for Säljare — a **warning when a quote falls below the company's permitted margin that reveals no cost figure**. Design that warning so it is not invertible back to the cost price (a boolean plus a threshold label, never a derived amount).

As a non-admin user (Projektledare, Montör, Säljare, Ekonomi),
I want to sign in and reach exactly my role-appropriate slice of the active Phase A surface,
So that least privilege is real — enforced by the server, not the menu.

**Acceptance Criteria:**

**Given** matrix seed rows for the active Phase A modules (dashboard, customers, calculations, quotes, jobs, files, settings)
**When** users of every seeded role sign in
**Then** each reaches only matrix-granted modules and actions; the grouped nav renders from the manifest × matrix derivation (`src/scope/nav-registry.ts`), hide-don't-disable
**And** unauthorized direct navigation and crafted commands/queries are rejected server-side with generic denials and no existence signals (FR72).

**Given** role-aware RLS
**When** module tables whose matrix restricts read/write are migrated
**Then** their policies use `has_tenant_role` with role arrays generated from the matrix at migration-authoring time, and the policy↔matrix agreement suite proves policies match the matrix rows (drift fails loud).

**Given** sensitive money fields (prices, costs, margins) and an unentitled role
**When** any read-model, export, or payload is produced
**Then** the value is absent from the response and listed in `entitlements.withheld` (`{ data, entitlements }` contract per AR-B6); aggregates with withheld components are themselves withheld
**And** the UI renders `MaskedValue`/column omission per UX-BDR2 — never 0, never a client-side role lookup.

**Given** per-role landings
**When** a user signs in
**Then** `resolveLandingRoute(roleSet)` applies server-side: dashboard-entitled roles land on `/dashboard`; Montör lands on a role-appropriate start that becomes `/my-day` when E15 ships it (EB-A6).

**Given** NFR42
**When** CI runs
**Then** for every seeded role and every active module there is at least one denied-command test and one RLS negative proving the role cannot read/write beyond its matrix rows (AC-B1a-2).

**Technical Notes:** Phase A tables with inline rates (`work_roles`, `articles`, calc rows) need no companion split — their modules close entirely to unentitled roles via the module-level role gate (architecture §3.6). New Phase B tables apply companion separation from the start. The conservative default seed: Montör sees no prices/costs/margins/settings/user admin; Säljare margin visibility withheld pending N-4; Ekonomi sees economy surfaces.

**Test Requirements:** The generated per-role suite (first exercise of the 11.4 harness shape, may land minimally here and be generalized in 11.4); policy↔matrix agreement tests; entitlement-projection tests (absent + listed); landing-redirect tests; nav-derivation unit tests.

**Security/RLS Impact:** Very high. Converts the whole Phase A surface to role-aware enforcement.

**Money/Tax/Quote Impact:** High. Money visibility becomes role-dependent; withholding must never alter stored öre values or computations.

**Migration/Coexistence Impact:** None (policy evolution, no data change). Legacy comparison: legacy roles were client-gated (P3/P5) — the server-enforced rebuild is the intentional delta.

**Dependencies:** Story 11.1.

**Stop Conditions Requiring Human Approval:** Stop if any surface requires delivering a sensitive value client-side "for display math", or if role-gating an existing Phase A table would break the pilot tenant's admin workflows.

### Story 11.3: Admin User Management

As an Admin,
I want to invite, reset, deactivate/reactivate, re-role, and remove users from the UI with full audit,
So that tenant user administration needs no engineering involvement.

**Acceptance Criteria:**

**Given** `Användare & roller → Användare` (Admin-only, nav via matrix)
**When** the Admin invites a user by email with role selection
**Then** a `tenant_memberships` row with `status='invited'` is created and the Supabase Auth admin invite executes server-side (service context, never client-reachable); the row shows `Inbjuden` with `Skicka igen`/`Återkalla` actions
**And** every action (invite, resend, revoke, reset, deactivate, reactivate, role change, remove) writes an audit event visible in the user detail `Händelser` panel (AC-B1a-3).

**Given** an active user
**When** the Admin edits roles, triggers `Skicka lösenordsåterställning`, or chooses `Inaktivera`/`Aktivera igen`/`Ta bort medlemskap`
**Then** changes apply with immediate-effect warnings and confirms; deactivation states "kan inte logga in; historik och bokningar bevaras"; removal follows archive-over-delete semantics (history preserved, membership ended).

**Given** the last active Admin of a tenant
**When** deactivation, role-downgrade, or removal is attempted
**Then** the command rejects it ("minst en Admin krävs").

**Given** a deactivated user
**When** their records are viewed
**Then** history remains visible with an `Inaktiverad` marker; future-dated bookings are flagged for reassignment once scheduling exists (seam note for E14/E15).

**Given** cross-tenant attempts
**When** an Admin of tenant A targets tenant B users
**Then** RLS and command validation reject generically.

**Technical Notes:** Reuses existing membership surface (ADR-B001 §3.2); invitation state machine incl. expiry/revoked states per UX §7. Single-row envelope commands; the Auth admin API is server-only (extends service-role containment checks).

**Test Requirements:** Integration tests per action incl. audit assertions; last-admin protection tests; invite lifecycle states; RLS negatives; containment check that the Auth admin client is not importable from client paths.

**Security/RLS Impact:** High. Membership mutation is the tenant's access control.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** Legacy P4 comparison (server commands + audit replace legacy client-side admin) — document delta.

**Dependencies:** Stories 11.1, 11.2.

**Stop Conditions Requiring Human Approval:** Stop if invitation flow would require emailing before E13/N-6 posture is clarified — Supabase Auth invite emails are the sanctioned path; any custom email path must wait for E13.

### Story 11.4: Roles Surface, Effective Permissions, and the Per-Role Test Harness

As an Admin (and as the delivery team),
I want a Roles view with the growing matrix, a per-user effective-permissions viewer, and a generated per-role negative-test harness,
So that "why can/can't Emil see X" has a server-derived answer and every future activation ships provable role boundaries.

**Acceptance Criteria:**

**Given** `Användare & roller → Roller`
**When** an Admin views it
**Then** the five seed roles list with descriptions and member counts; a per-role view shows its matrix rows grouped by module with the activating wave noted; module rows appear only when manifest-active
**And** sensitive-field entitlement rows render explicitly, showing "väntar på ägarbeslut" until N-4 confirms the seed
**And** the tab explains Arbetsledare as a job-scoped designation assigned inside job workspaces (not here).

**Given** a user detail
**When** the Admin opens `Effektiva behörigheter`
**Then** a read-only module × capability grid renders server-side from the permission matrix with the granting role annotated (FR70; `EffectivePermissions` contract).

**Given** the per-role test harness
**When** a module activates (now and for every future activation)
**Then** the H4 inventory's role dimension + the command-layer generator produce, per seeded role × table/capability: allowed-path positives and denied read/write negatives derived from the matrix — landing in the activation PR (architecture §16.1)
**And** the policy↔matrix agreement suite runs as a standing CI gate.

**Technical Notes:** The harness generalizes what 11.2 exercised for the Phase A seed; it is the reusable mechanism Cross-Epic Rule 1 requires from every activation story. Viewer is server-rendered (no matrix shipped to the client as authority).

**Test Requirements:** Harness self-tests (generator produces expected case matrix for a sample module); viewer rendering tests; agreement-suite red/green demonstrations against a deliberately drifted fixture.

**Security/RLS Impact:** High (test machinery guarding all future activations).

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** None.

**Dependencies:** Stories 11.1–11.3.

**Stop Conditions Requiring Human Approval:** Stop if generating per-role suites for any Phase A module reveals an existing policy gap (fix under this epic only with explicit approval — scope control).

## Epic 12 [Wave B1a]: Tenant Provisioning and Onboarding

**Epic goal:** Make the product deliverable to independent companies: an operator provisions a tenant end-to-end and its first Admin onboards to a working state — zero engineering steps, zero cross-tenant leakage.

**Scope:** `platform_operators` + `is_platform_operator()`; the `provisionTenant` DEFINER RPC (sanctioned exception); operator console at `/operator` (identity/status only); three-step provisioning wizard; `Kom igång` onboarding checklist; NFR54 negative suite.

**Explicit non-scope:** Public self-serve signup — **permanently out per N-2** (FR76), not a seam being built toward; separate-deployment operator isolation (Phase C hardening option, AB-A8); commercial pricing/packaging as application logic (N-2: these are tenant data — `SubscriptionPlan`, `IncludedUsers`, `AdditionalUserPrice`, `CommercialOverrides`, … — never hardcoded values, so that a manually agreed discount needs no new build).

**Dependencies:** Epic 11 (roles, invitations). Session-flagged merge candidate into E11 — number kept stable.

**Risks:** DEFINER RPC misuse; operator console leaking tenant business data; non-idempotent provisioning creating duplicate tenants; onboarding checklist claiming completion it cannot verify.

**Wave acceptance tie:** AC-B1a-1; phase-level AC-PH-3 (the second-tenant proof re-runs this path).

### Story 12.1: Platform Operator Identity and the Provision-Tenant Command

As a platform operator,
I want an operator allow-list and an atomic, idempotent, audited provision-tenant command,
So that new tenants are created safely without engineering and without any cross-tenant blast radius.

**Acceptance Criteria:**

**Given** the `platform_operators` allow-list table (platform-scoped exception per AR-B19)
**When** it is introduced
**Then** it stores user_id + granted_at/by with operator-only self-read RLS, and `is_platform_operator()` follows the hardened DEFINER-helper shape with a standing negative test.

**Given** an operator invokes `provisionTenant`
**When** the command executes
**Then** the `provision_tenant` SECURITY DEFINER RPC (the sanctioned ADR-A009 exception: fixed empty `search_path`, schema-qualified refs, explicit `is_platform_operator()` check inside, revoked from PUBLIC) creates the tenant, applies baseline settings, and creates the first-Admin invited membership atomically
**And** the Supabase Auth admin invite runs server-side in the command (service context), never in the RPC, never client-reachable
**And** every provisioning action is audited with the new tenant's tenant_id.

**Given** a repeated invocation for the same org identity
**When** the command re-runs
**Then** it is idempotent: no duplicate tenant; the stable state `ALREADY_PROVISIONED` is returned.

**Given** NFR54 negatives
**When** the suite runs
**Then** non-operators are denied generically; provisioning for tenant X can neither read nor affect tenant Y (cross-tenant negatives on the provisioning path); forged/absent operator claims are rejected.

**Technical Notes:** Architecture §14.3/§15.4/§9.1. Provisioning status lives as additive columns on `tenants`; the onboarding checklist is derived server-side, not stored (per architecture — per-admin dismissal is a small column).

**Test Requirements:** RPC integration tests (atomicity via induced-failure rollback, idempotency, operator gate); DEFINER hardening negative tests; audit assertions; migration reset green.

**Security/RLS Impact:** Very high. The one new DEFINER surface of B1a; gets the full hardening + negative treatment.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** None (net-new productization; legacy `register_company` P2 is the thinned reference — document the deliberate operator-driven delta).

**Dependencies:** Epic 11 (membership/invite machinery).

**Stop Conditions Requiring Human Approval:** Stop if any additional SECURITY DEFINER function beyond `provision_tenant` appears necessary, or if provisioning would need to write into another tenant's rows for any reason.

### Story 12.2: Operator Console

As a platform operator,
I want a console listing tenants and a three-step provisioning wizard,
So that provisioning is a guided flow with visible state — and nothing more than tenant identity/status is ever exposed.

**Acceptance Criteria:**

**Given** the operator console at `src/app/operator/**`
**When** an allow-listed operator opens it
**Then** it renders outside the tenant AppShell (no tenant context resolution, no tenant nav registry) with its own layout, listing tenants (name, status, created, first-Admin state) only
**And** a tenant-role user (incl. Admin) receives the generic denial; the operator area is invisible to tenant nav.

**Given** `Provisionera ny tenant`
**When** the operator walks the wizard
**Then** three steps execute — 1) Företagsuppgifter (name, org identity), 2) Baslinje (defaults displayed, not re-typed), 3) Bjud in första Admin (email) — ending in an audit summary + invite status
**And** the wizard is re-entrant: an interrupted provisioning resumes at the incomplete step, and a re-run renders the `ALREADY_PROVISIONED` state instead of duplicating.

**Given** console read-models
**When** any console query runs
**Then** it exposes tenant identity/status/first-Admin state only — a negative test proves console read-models cannot return tenant business data (NFR54).

**Technical Notes:** `Wizard` component contract (UX-BDR6/UX-BDR17). Same Next.js deployment (AB-A8). Route-level authorization is `is_platform_operator()`-gated on every server entry, not just layout.

**Test Requirements:** AuthZ tests (operator vs tenant user vs anonymous); wizard resume/idempotent-state tests; console data-exposure negative; shell-isolation check (no tenant-context imports in `operator/**`).

**Security/RLS Impact:** High. New privileged-but-narrow surface with its own negative suite.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** None.

**Dependencies:** Story 12.1.

**Stop Conditions Requiring Human Approval:** Stop if the console needs any tenant business read (indicates scope creep past NFR54 posture).

### Story 12.3: First-Admin Onboarding Checklist

As a new tenant's first Admin,
I want a `Kom igång` checklist that walks me to a working state,
So that a provisioned tenant becomes operational without engineering help — proving AC-B1a-1 end-to-end.

**Acceptance Criteria:**

**Given** a first Admin's first sign-in to a fresh tenant
**When** the app loads
**Then** the `Kom igång` checklist renders (pinned on the dashboard until done, dismissable and resumable) with five items: Företagsinställningar, Moms & visning, Offertvillkor (carrying the Phase A sign-off warning posture), Arbetsroller & priser, Bjud in användare
**And** each item deep-links to the real settings surface and auto-checks from server-derived state (never click-tracking).

**Given** all items reach green
**When** the checklist completes
**Then** the tenant is in the AC-B1a-1 "working state"; the end-to-end flow (provision → baseline → first-Admin invite → onboarding to working settings/pricing) is covered by an automated test or a scripted demo run.

**Given** the N-2 seam
**When** scanning the shipped surface
**Then** the checklist and wizard are entry-point agnostic (a future public signup would land in the same onboarding), and **no** public registration surface, route, or copy exists (FR76).

**Given** a dismissed-but-incomplete checklist
**When** the Admin returns
**Then** a reminder affordance restores it (UX §7 provisioning states).

**Technical Notes:** Checklist derivation reads existing settings/pricing/user state; per-admin dismissal is a small column (architecture §9.1). No new tables.

**Test Requirements:** Derivation unit tests per item (incomplete/complete detection); end-to-end provisioning-to-working-state test or scripted demo run recorded; dismissal/resume tests.

**Security/RLS Impact:** Low (reads existing tenant-scoped state).

**Money/Tax/Quote Impact:** None (pricing baseline is configured through existing Phase A surfaces).

**Migration/Coexistence Impact:** None.

**Dependencies:** Stories 12.1, 12.2; Epic 11 (invite flow).

**Stop Conditions Requiring Human Approval:** Stop if any checklist item would require new settings schema beyond Phase A surfaces.

## Epic 13 [Wave B1a]: Notifications and Email Infrastructure

**Epic goal:** Land Phase B's first background execution the right way (ADR-B002): an authenticated runner + producer registry, in-app notifications with preferences, and an outbox-shaped email pipeline that stays dark until N-6 — with the legacy forged-JWT P0 proven structurally impossible.

**Scope:** Runner endpoint + `CRON_SECRET` auth + `job_runs`; typed manifest-derived producer registry; `notifications`/`notification_preferences` + bell/popover/center/preferences UI; `email_outbox`/`email_delivery_events`/`email_suppressions` + queue processing (non-sending); the N-6 sending-activation story (defined, dark).

**Explicit non-scope:** Email provider dependency before N-6 (AB-A5); any producer for not-yet-active modules (registry is manifest-derived); pg_cron/Edge Functions (one lane, AB-A4); public unsubscribe page before sending activates.

**Dependencies:** Epic 10 (follow-up data for the first producer), Epic 11 (admin visibility surfaces).

**Risks:** The named P0 anti-pattern re-entering via convenience; duplicate sends on retry; producer cross-tenant reads without explicit iteration; notification categories drifting from the manifest.

**Wave acceptance tie:** AC-B1a-4.

### Story 13.1: Authenticated Background Runner and Producer Registry

As an implementation lead,
I want the single sanctioned background-execution lane with a signed-secret-authenticated runner and a typed producer registry,
So that every scheduled behavior in Phase B runs authenticated, contained, observable — and the legacy forged-JWT cron is structurally impossible.

**Acceptance Criteria:**

**Given** the platform scheduler (Vercel Cron on the existing deployment)
**When** it invokes `POST /api/jobs/run`
**Then** the request authenticates via the high-entropy `CRON_SECRET` (≥256-bit, server-env only) compared timing-safe, accepting current+previous during rotation windows
**And** a forged/unsigned/none-alg JWT, a garbage bearer token, a missing secret, and a wrong secret are each rejected with a generic 401 and zero side effects — these negative tests are permanent CI members (NFR45, AC-B1a-4).

**Given** the producer registry at `src/server/jobs/producers.ts`
**When** producers are declared
**Then** each declares `{ id, moduleId, category, schedule, essential }` and is active iff its module is manifest-active — no placeholder categories can exist
**And** the runner claims due work and executes producers chunked with bounded runtime per invocation.

**Given** background execution identity
**When** any producer runs
**Then** it runs under the server-only service context confined to `src/server/jobs/**` (never importable from client paths — containment greps/tests extended), iterates tenants explicitly (every query tenant-scoped), writes audited events with `actor_user_id = NULL` + producer-named command, and records a `job_runs` row (producer, window, outcome, error summary)
**And** producer failures surface to Admin (NFR47 visibility) and freshness stamps render from the run log.

**Technical Notes:** ADR-B002 is accepted with the architecture; this story is its first implementation and must merge with the negative suite in the same PR. No JWT decoding without signature verification anywhere (structural review-reject). Secret rotation is an ops runbook item.

**Test Requirements:** The mandatory NFR45 negative suite; producer idempotency scaffolding; containment checks; chunking/bounded-runtime unit tests; `job_runs` recording tests.

**Security/RLS Impact:** Very high. The new attack-surface class; the P0 exclusion is this story's reason to exist.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** Explicit intentional delta vs the legacy forged-JWT cron (P78 note) — documented.

**Dependencies:** Story 10.1 (manifest for registry derivation); Epic 11 (admin failure-visibility surface may land minimal here and complete in 13.2).

**Stop Conditions Requiring Human Approval:** Stop if any second execution lane (pg_cron, Edge Function, ad-hoc endpoint) is proposed, or if any code path needs to read claims from an unverified token.

### Story 13.2: In-App Notifications — Bell, Center, and Preferences

As a user of any role,
I want in-app notifications with a bell, a center, and per-user preferences,
So that reminders and events reach me inside the app with working read state and deep links.

**Acceptance Criteria:**

**Given** the `notifications` and `notification_preferences` tables
**When** a producer or command-layer emitter inserts a notification
**Then** the row carries tenant, user, category, title/body, deep-link route (computed at emit time — the bell/center never re-derive links), and read_at
**And** the top-bar bell shows the unread count (cap "9+") for every role; the popover lists the latest ~10 with mark-all-read and `Visa alla`; clicking deep-links and marks read (the sanctioned optimistic-UI case).

**Given** the notification center at `/notifications`
**When** the user filters
**Then** category/module, read state, and date filters work; categories shown are exactly the registry-derived union for active modules — B1a ships `quote.follow_up_due` (consuming Epic 10 data) and admin/user events; no placeholder categories.

**Given** `Notisinställningar`
**When** the user edits preferences
**Then** the matrix (categories grouped by module × I appen / E-post) persists per user; the e-post column renders inactive-with-explainer ("e-postutskick aktiveras senare") until N-6; essential categories are non-disableable, enforced server-side and rendered as such.

**Given** producer-fed surfaces
**When** they render
**Then** last-run recency shows from `job_runs` ("skannad för X tim sedan") — freshness honesty, never implied real-time.

**Given** tenant isolation
**When** cross-tenant notification reads/writes are attempted
**Then** RLS rejects them; unentitled data never rides a notification body (entitlement-projected content).

**Technical Notes:** Deep-link contract per architecture §4.4; stable category keys namespaced by module. The follow-up due producer is the first scheduled producer (EB-A8).

**Test Requirements:** Emit/read-flip integration tests; preference enforcement (incl. essential non-disableable server-side); category-union derivation tests; deep-link storage tests; RLS negatives; producer idempotency for the follow-up scan (no duplicate notifications on retry).

**Security/RLS Impact:** Medium-high. Per-user rows inside tenant scope; own-row read policies.

**Money/Tax/Quote Impact:** None (notification bodies must not carry unentitled amounts — covered by projection tests).

**Migration/Coexistence Impact:** Legacy P78 comparison (notifications table/bell) — document deltas; no data migration.

**Dependencies:** Story 13.1; Epic 10 (follow-up data).

**Stop Conditions Requiring Human Approval:** Stop if a needed category has no active producing module (indicates a manifest/scope violation).

### Story 13.3: Email Outbox Pipeline (Queued, Non-Sending)

As an Ekonomi/Admin stakeholder in reliable communication,
I want the full outbound email pipeline — queue, delivery log, suppression, retries, idempotency — running dark,
So that when the owner activates sending (N-6), only the provider adapter and flows remain to switch on.

**Acceptance Criteria:**

**Given** the `email_outbox`, `email_delivery_events`, and `email_suppressions` tables
**When** an emitter enqueues mail
**Then** rows carry recipient, category, template key/params, and a unique dedupe key per (category, subject entity, period); status walks `queued → sending → sent | failed | suppressed`.

**Given** the queue-processing producer
**When** it claims work
**Then** it uses `FOR UPDATE SKIP LOCKED`, enforces the suppression list before send, applies bounded retries with backoff, and appends append-only delivery events
**And** retried processing never duplicates a send (dedupe-key proof); the provider message id is recorded before `sent`.

**Given** the pre-N-6 posture (FR81)
**When** the pipeline runs
**Then** rows reach `queued` and stop — no send occurs, no provider dependency exists (`src/server/email/provider.ts` is a seam only) — and Admin sees queue/failure state.

**Given** entitlements
**When** an email body is built (template render path, even while dark)
**Then** content derives from the recipient's entitlement projection, never an Admin-shaped payload.

**Technical Notes:** Architecture §4.5; AB-A5. Unsubscribe token schema (`email_unsubscribe_tokens`, hashed per ADR-B004) may land with this story's migrations but its public surface stays dark until Story 13.4.

**Test Requirements:** Claim-concurrency tests (SKIP LOCKED semantics); dedupe idempotency proofs; suppression enforcement; retry/backoff exhaustion visibility; non-sending posture test (no provider call path exists); projection-based body tests.

**Security/RLS Impact:** Medium. Tenant-scoped queue tables; append-only delivery log.

**Money/Tax/Quote Impact:** None.

**Migration/Coexistence Impact:** Legacy P79 comparison (email queue/log/suppression) — document deltas.

**Dependencies:** Stories 13.1, 13.2.

**Stop Conditions Requiring Human Approval:** Stop if any path would perform a real send before N-6, or if a provider dependency is proposed before activation.

### Story 13.4: Email Sending Activation

> **N-6 ANSWERED 2026-07-26 — this story is unblocked.** Sender identity, priority order, and reminder-stop rules are settled (architecture §4.6). What remains a deliberate sequencing choice, not a gate, is the owner's go-ahead to actually start delivering mail to real recipients: **do not flip a flow to sending without it.**

As an Admin,
I want email sending activated per the owner's N-6 decisions,
So that the queued flows start delivering in the owner's priority order, with suppression and unsubscribe working.

**Acceptance Criteria:**

**Given** the N-6 decisions — a **central verified sending subdomain** (e.g. `notify.<system>.se`), display name **`[Företagsnamn] via [Systemnamn]`**, and **Reply-To set to the tenant's own chosen address** (e.g. `offert@kundforetag.se`) so customer replies reach the company, not us
**When** activation lands
**Then** the provider adapter is implemented behind the existing seam (dependency added only now), flows switch from queued to sending **in the owner's priority order** — (1) invitations and account-security messages, (2) quote sending to the customer incl. the open/accept/reject link, (3) internal accept/reject notification, (4) job-assignment or material-reschedule notice to the field worker, (5) configurable quote reminders, (6) daily/weekly digest — and every outbound mail carries tenant identity, a clear subject convention, and a deep link
**And** **quote reminders stop automatically** on accept, reject, withdrawal, supersession by a new version, and expiry — five conditions, each with its own test; an unstoppable reminder aimed at a customer is the failure mode this guards
**And** **invoice emails are NOT sent from this system** — Fortnox sends them, so the recipient never gets two invoice mails (N-5/§7.1)
**And** each send is logged with `MessageType`, `TemplateId`, `TemplateVersion`, `CompanyId`, `Recipient`, `FromAddress`, `ReplyToAddress`, `TriggeredBy`, `TriggeredAt`, `RelatedEntityType`, `RelatedEntityId`, `ProviderMessageId`, `DeliveryStatus`, `DeliveredAt`, `BouncedAt`, `FailureReason`
**And** transactional and marketing classes are distinguishable in the model, with **no marketing path built** (out of the initial email capability)
**And** non-essential mail carries a tokenized unsubscribe link; the public unsubscribe page (ADR-B004 rules: hashed token lookup, uniform responses, no tenant enumeration, re-subscribe offer) activates in the `(public)` route group with its abuse suite green
**And** the preferences e-post column becomes live; suppression + unsubscribe are enforced end-to-end; delivery events show real provider outcomes.

**Technical Notes:** ADR-B004 governs the unsubscribe surface (closed-set member 3). Architecture §4.6 carries the full N-6 contract. Per-tenant **verified sending domains are explicitly a later version** — the adapter must not assume a per-tenant domain, and must not make one hard to add.

**Test Requirements:** Provider-adapter contract tests; unsubscribe token abuse suite (validity/revocation/uniform response/rate limit); end-to-end queued→sent path against a sandbox/mock; suppression + dedupe re-proof under real sending.

**Security/RLS Impact:** High (first activated public token surface of the email family).

**Money/Tax/Quote Impact:** None directly; outbound quote-send content remains snapshot-derived.

**Migration/Coexistence Impact:** None.

**Dependencies:** Stories 13.1–13.3; ADR-B004; the owner's go-live approval for real sending.

**Stop Conditions Requiring Human Approval:** Stop before any flow begins delivering to real recipients without the owner's explicit go-ahead. Additionally stop if a flow outside the six-step priority order is proposed for activation, or if a design would send invoice mail from this system.

---

# Wave B1b — Story Titles + AC Sketches

> **Depth note (PB-D10):** Epics 14–19 below carry story titles with AC sketches, not full acceptance criteria. They are finalized to Phase-A-style full stories at the B1a→B1b checkpoint. **ADR-B006 is recorded (2026-07-26), so Epics 16–18 no longer carry an extra precondition.** Cross-Epic Delivery Rules 1–5 apply to every story below. Every field-facing surface in E14–E18 carries ADR-B009's connected 360×640, transient-draft, explicit-retry, and server-confirmed-success acceptance posture; none consumes Story 10.7 or an offline platform capability.

## Epic 14 [Wave B1b]: Resource and Scheduling Foundation

> **Gate notes — closed and course-corrected.** `[N-3]` → **ADR-B009 (2026-09-03):** connected responsive web at 360×640, no PWA/offline or Story 10.7 dependency. `[N-9]` → **answered 2026-07-26:** the conflict/capacity rules are supplied (architecture §10.5A), so the golden-pinned rule packs can be authored now — capacity from the actual weekly schedule, the six-term capacity formula, overtime excluded, overbooking warning thresholds, and the central-holidays-plus-tenant-closed-days calendar (FR86, NFR48).

**Stories:**

#### Story 14.1: Scheduling Activation — Person Profiles and Work Hours

AC sketch: `scheduling` flips active (manifest + matrix rows + per-role negatives in the same PR); `person_profiles` 1:1 with memberships (default work role FK to the Phase A `work_roles` catalog — one catalog, two consumers) and `person_work_hours` weekly templates land; capacity math consumes templates + injectable rule config so N-9 answers require zero schema rework; admin surface to maintain person scheduling basics; deactivated-user semantics carried from 11.3.

#### Story 14.2: Bookings and Assignees — Schema and Transactional Commands

AC sketch: `bookings` (UTC `timestamptz`, all-day flag, work role, all-optional connections per PB-D12, status, series linkage fields) + `booking_assignees` (composite same-tenant FKs); `createBooking`/`updateBooking` SECURITY INVOKER RPCs write booking + assignees + conflict rows atomically with client-supplied command key idempotency; bookings valid standalone; binding to Phase A basic jobs works today and deepens (never breaks) when E16 lands; RLS: role-gated module access + own-booking row scope for Montör; cross-tenant negatives.

#### Story 14.3: Deterministic Conflict Engine (Detection Core)

AC sketch: one pure engine (`src/features/scheduling/conflicts.ts`) — no I/O, no clock — detecting `double_booking`, `over_capacity`, `outside_work_hours` from (candidate, existing bookings, work-hour templates, injectable rule config); server re-runs detection inside the write transaction; editor preview calls the same module so preview and save can never disagree; Europe/Stockholm evaluation with the pinned DST edge policy (spring-forward → first valid instant; fall-back → earlier instant) covered by boundary-week fixtures; missed/phantom conflicts are correctness defects with regression fixtures; capacity/work-hours rule packs are golden-pinned **now** — N-9 supplied the rules (architecture §10.5A), so the packs cover the six-term capacity formula, actual-weekly-schedule derivation, holiday/closed-day layering, and the overbooking warning threshold. Conflict types extend with `outside_access_window` and `competence_missing` from the N-9 job-card inputs.

#### Story 14.4: Booking Editor with Live Conflict Warnings and Audited Override

AC sketch: side-sheet editor (desktop) / full-screen (phone) with multi-assignee picker + availability hints, work role, time, optional connections, description; live inline `ConflictPanel` per violation with mini-timeline; saving with conflicts requires explicit `Boka ändå` + required reason → persists `booking_conflicts` rows in state `accepted` (unacknowledged detected conflicts persist as `open`) in the same transaction plus audit event; persistent `Konflikter (n)` chip counts open conflicts; entry points: toolbar, empty-slot click/drag, pre-connected from job/customer; dirty-state guard; the connected phone shape works at 360×640, retains suitable unsent form state after a request failure, offers explicit retry, and shows saved only after server confirmation (ADR-B009).

## Epic 15 [Wave B1b]: Scheduling Views, Time Reporting, and Calendar Feeds

> **Gate notes:** calendar feed (Story 15.5) ships **only after the ADR-B004 suite is green** (AC-B1b-7) — it is Phase B's first public token surface. The field posture is settled by ADR-B009: Min dag/phone-shape stories proceed as connected 360×640 experiences with transient-failure protection, no Story 10.7 technical dependency. Reminder producers activate via the E13 registry.

**Stories:**

#### Story 15.1: The Five Scheduling Views

AC sketch: `Planering` nav lands (manifest change in this PR); `Schema` (time-grid day/week, month density), `Resurser` (person-row timeline, empty-slot create, needs-reassignment lane), `Team` (week board grouped by arbetsroll — named teams only if the oracle demands, UXB-A9 `[oracle-check]`), `Beläggning` (capacity matrix, number + color never color alone, >100% links to bookings, capacity rules per architecture §10.5A), `Min kalender` (agenda phone-first); all five are projections of one booking/filter model (AC-B1b-2); shared toolbar with per-user per-view filter/period persistence; `BookingBlock` contract with drag parity (keyboard/dialog equivalents).

#### Story 15.2: Recurring Bookings — Series, Materialized Occurrences, Exceptions

AC sketch: `booking_series` rule rows (preset patterns: daily/weekly-with-weekday-picker/biweekly/monthly; mandatory end condition — no unbounded series); occurrences materialize as real `bookings` rows via one pure expansion function shared by editor preview ("next ~10 with conflict glyphs") and server; `createBookingSeries`/`updateBookingSeries` RPCs with series-level dedupe; occurrence edits set `is_exception` ("avviker från serien"), cancellations leave tombstones; "Detta och kommande" = series split preserving pre-pivot exceptions and stable occurrence ids where times unchanged; recurrence participates fully in conflict detection; DST boundary-week fixtures extend the 14.3 packs.

#### Story 15.3: Conflict Resolver

AC sketch: master-detail resolver from the `Konflikter (n)` chip/queue — grouped queue (person, date), detail mini-timeline of both colliding bookings with job/kund context and plain-language violated rule; actions `Flytta` (suggested free slots from the inverted engine — convenience, never authority), `Omfördela` (available candidates with load), `Justera`, `Acceptera konflikt` (required reason, drops from default queue, `Visa accepterade` filter); resolution re-runs detection, marks `resolved` with outcome + actor, records on `Händelser`, notifies affected assignees (`booking.changed` via E13); accepted-conflict natural-key identity carries across recurrence; `Åtgärda hela serien` for sibling occurrences; empty state with last-checked recency (FR89).

#### Story 15.4: Time Reporting — Filing, Timesheet, Review

AC sketch: `time_reports` own-row-scoped (user, date, duration, optional booking/job links, note; `status` column ships `submitted`-only — the reserved approval seam, decided at the B1b→B2 checkpoint per AB-A10); filing from booking cards pre-filled (≤30-second one-hand phone flow) or standalone (`Ny tidrapport`, PB-D12); suitable unsent input survives a transient request failure, remains labelled unsent, and explicit retry is available; the `submitted` domain/UI state appears only after server persistence; personal week timesheet with missing-day nudge indicators (+ `time_report.nudge` producer registered in E13's registry); desktop review surface for PL/Admin (person/job/week filters, per-job/person sums, report-vs-booked delta highlight, review/annotate affordances — no hard approval state); hours flow onward valued only in economy read-models (report rows carry no money); per-role RLS (own rows vs review scope).

#### Story 15.5: Personal Calendar Feed (ADR-B004 Surface #1)

AC sketch: `calendar_feed_tokens` hashed 256-bit tokens; user-self-serve `Kalenderprenumeration` (create/rotate/revoke, audited, plain-language access warning, "senast hämtad" from `last_used_at`); `GET` feed route in `(public)` streaming iCalendar regenerated per request — own bookings only, minimal fields, never money, never other people's data; revoked/unknown tokens → identical generic response; per-token + per-IP-hash rate limits; the full ADR-B004 abuse suite (validity, revocation, rotation, uniformity, rate-limit trip, cross-tenant probe, shell isolation) green before ship (AC-B1b-7, NFR46).

#### Story 15.6: Min Dag — the Field Landing

AC sketch: `/my-day` route + Montör landing redirect activates (completing EB-A6); today header with week nav; time-ordered booking cards (job/kund + map-linked address, `Öppna jobbet`, `Rapportera tid`); banner-level schedule-change notices from `booking.changed`; pull-to-refresh; no money content; `Mina jobb` section renders when E16 activates (PB-D12 seam — the section contributes nothing before then); connected responsive behavior at the 360×640 floor; when data cannot be reached the page says `Anslutning krävs` and never substitutes an offline/stale job list; empty state "inga bokningar ännu" only after a successful connected read.

## Epic 16 [Wave B1b]: Jobs Core

> **GATE LIFTED 2026-07-26 — ADR-B006 recorded (architecture §8).** The owner chose exactly the team recommendation: **Option A as the model, Option C as the technique.** The sketches below were drawn for that outcome and therefore stand as written, with the Option B branches deleted rather than kept as alternatives — there is no `projects` grouping story and no `Ingående jobb` read-model story. Story-level detail may now be finalized (AC-B1b-6 satisfied).

**Stories:**

#### Story 16.1: Jobs Depth Activation — Container Evolution and My-Jobs

AC sketch: evolve the Phase A `jobs` container per ADR-B006 §8.3 — additive `type ∈ {order, projekt}` CHECK defaulting to `'order'` (so every existing row stays valid with no backfill ambiguity), plus nullable project-scope fields whose non-null state implies `type='projekt'` by DB CHECK. `status` is NOT overloaded — lifecycle and kind stay orthogonal. Manifest/table enrollment + matrix rows + per-role negatives in the same PR; my-jobs view (`Mina jobb`) scoped to membership/assignment (FR93); standalone create + connect per FR94/FR98 with the answered §8.4 field set (progressive disclosure — identity fields first, N-9 scheduling inputs in a second group; dependencies and access windows as repeatable child rows, not JSON); budget is read from the economy projection, never a column on the container. **Both Phase A creation paths are regression-proven unchanged** — the Epic 7 acceptance→job RPC and the 2026-07-14 standalone-create command — and existing bookings bind seamlessly (PB-D12).

#### Story 16.2: Job Members and Per-Job Roles (Arbetsledare)

AC sketch: `job_members` (person, per-job operational role incl. `Arbetsledare` designation, composite same-tenant FKs); assignment happens in the job workspace (never the Roller tab); server-side per-job enforcement — Arbetsledare capabilities checked against `job_members` inside job commands, never tenant-wide (NFR43); member list on Översikt; per-role positive/negative test pairs for job-scoped elevation.

#### Story 16.3: Arbetsorder

AC sketch: `work_orders` child work items (title, status, assignees, description, own files via manifest-declared owner type), composite same-tenant FK to `jobs (id, tenant_id)`; **present on both `type='order'` and `type='projekt'`** — containment is the model's core relation, not a project feature; workspace `Arbetsorder` tab with list/cards + work-order pane; creation/edit envelope commands; RLS + role gating per matrix.

#### Story 16.4: Projekt Upgrade and Job-Card Semantics

AC sketch: the `upgradeJobToProjekt` command (architecture §14) — a single-row `type` transition in one transaction with a `job_events` row, an `audit_events` row, and the project-surface unlock; **idempotent** (already-`projekt` short-circuits) and **one-way** (a DB trigger rejects `projekt → order`, error code `JOB_TYPE_DOWNGRADE_FORBIDDEN`); project-only children (payment plan) DB-bound to `type='projekt'` by CHECK or trigger, **not** by command-layer convention. `Uppgradera till projekt` header action shown only on `type='order'`, with an audited confirm listing the features it unlocks before commit; **no downgrade action exists**. Job-card create/edit form per the §8.4 field set; nav label **`Jobb`** (`[oracle-check]` on casing/vocabulary only).

#### Story 16.5: Job Workspace Shell

AC sketch: shell bound to one container id (ADR-B006 confirms the contract unchanged; no `Ingående jobb` aggregate) — header (title, type badge `Jobb`/`Projekt`, status, kund/anläggning/kontakt chips per `1.5`, PL + Arbetsledare picker, planned dates, budget mini-bar **absent entirely for Montör and, by default, Arbetsledare** per the N-4 seed, primary actions `Boka`/`Rapportera tid`/`Markera som klar`) + tab registry where each tab is a read-model keyed by container id; tabs live in B1b: Översikt, Arbetsorder, Schema (job's bookings, `Ny bokning` pre-connected), Filer, Händelser — later tabs contribute per epic; per-tab visibility = matrix × activation; Montör field shape = connected bottom tab bar at 360×640 (UX §4.8, ADR-B009), with explicit connection-required/error/retry states; narrow-viewport priority tabs + `Mer`.

## Epic 17 [Wave B1b]: Jobs Economy and Material

> Inherits the Epic 16 ADR-B006 gate banner. Economy money lives in companion tables (never on the container) regardless of model — the §3.6 separation is model-independent.

**Stories:**

#### Story 17.1: Material Usage and Material Requests

AC sketch: `job_material_usage` (who/what/qty/unit/when; article search over own articles) + `job_material_requests` (request workflow with status, routed to the responsible role, notification category registered); Montör quick-logging with quantity steppers in the connected field shape; suitable unsent input is retained after a request failure with explicit retry, and usage/request status plus notifications exist only after server confirmation; workspace `Material` tab; per-role RLS (members log, responsible roles manage requests).

#### Story 17.2: Payment Plan on Projekt Scope

AC sketch: `job_payment_plans` (+ items) attached to the job container and **DB-bound to `type='projekt'`** (ADR-B006 §8.3); integer-öre amounts via `@/lib/money`; visible in the Ekonomi tab for entitled roles; plan items become billing-basis candidates later (N-5 content definition decides inclusion — seam only here).

#### Story 17.3: Economy Rollup — Budget vs Actual

AC sketch: economy companion tables + read-models (architecture §3.6): budget snapshot from the accepted quote where connected; reported time valued (hours × role rates) in read-models only; material amounts; other costs; integer-öre rollup with budget-vs-actual per job; `{ data, entitlements }` projection — unentitled roles receive no amounts, aggregates honest (FR102, NFR44); workspace Ekonomi tab hidden for roles that would see only locks (UX-BDR2 rule 5); dashboard/economy freshness honest.

#### Story 17.4: Jobs-Money Golden Coverage and Billing Seam

AC sketch: the comparison-harness pattern extends to jobs money paths (economy rollup budget-vs-actual, time valuation, material amounts) with frozen anonymized fixtures + öre-exact golden packs (NFR52, AC-B1b-5); FR103 seam proven: economy data readable by the future E26 assembly without re-entry (read-model contract documented); no new rounding rule anywhere (ADR-A004 STOP carried).

## Epic 18 [Wave B1b]: Jobs Field Depth and Completion

> Inherits the Epic 16 ADR-B006 gate banner for schema shape. Field capture UX per UX §4.8 and the completion-event contract are model-independent.

**Stories:**

#### Story 18.1: Diary and Photos (Field Capture Core)

AC sketch: `job_diary_entries` (author + timestamp, optional photo attach); photos are `files`/`file_links` with job-scoped owner types/purposes (`job_photo` etc. manifest-declared — no new file tables); camera-first `Foton` tab (capture direct, caption, multi-shot, auto-attach, photos from Dagbok appear in the one pool); sticky ≥48px `CaptureButton`s; connected transient-failure retention (suitable `sessionStorage` draft + in-memory blobs) with explicit connection/failure state and `Försök igen`; lifecycle limits are stated honestly, and `Sparad i systemet`/attachment completion appears only after server confirmation (ADR-B009, UX-BDR14); upload progress + oversized/blocked states carried from Phase A.

#### Story 18.2: Deviations, Risks, and Job Chat

AC sketch: `job_deviations` (structured quick-form: title, description, photos, severity `[oracle-check: legacy severity levels]`, status open/closed; suitable unsent input survives transient failure, and submission notifies the job's Arbetsledare/PL via E13 only after server-confirmed persistence), `job_risks` (simple register rows), `job_chat_messages` (members only; mentions notify only after persistence); connected field-shape ergonomics at 360×640; per-role/member RLS; author + timestamp on everything (FR104).

#### Story 18.3: Job Reports and Exports

AC sketch: report/export generation from job data (PDF exports; report types deepened per oracle) for entitled roles (FR105); exports build from the recipient's entitlement projection (no unentitled money in a Montör-triggered export); long-operation progress + completion notification via E13; `Rapporter` tab.

#### Story 18.4: Job Completion Event

AC sketch: `markJobComplete` SECURITY INVOKER RPC — one completion per job (unique/state guard), audited completion event on the container, active-consumer flags computed server-side from the manifest and passed explicitly (SQL never encodes scope); the connected confirmation dialog states downstream effects before commit, listing only active consumers; a failed/disconnected request keeps the job uncompleted and offers retry without false success; post-completion field tabs become read-only-with-notice only after server confirmation; the event is consumed by at least one downstream in test (warranty stub when E23 active, DoU seed offer card when E27 active — B1b proof via test consumer) (FR106, AC-B1b-4).

## Epic 19 [Wave B1b]: Operational Dashboard v1

**Stories:**

#### Story 19.1: Widget Registry and Dashboard Framework

AC sketch: `src/scope/widget-registry.ts` — manifest-declared widget ids → components + required capability + role-default placement; a widget renders only when its module is active AND the role holds the capability; no placeholder widgets by construction (a widget id without an active module fails the manifest validator); responsive 12-col → 1-col grid; `WidgetCard` contract (title, content, one deep link, empty-with-meaning/loading/error-retry/freshness states); a failed widget never blanks the grid; role-default layouts, no user customization in v1 (UXB-A12).

#### Story 19.2: The v1 Widget Set

AC sketch: exactly six widgets on live B1 data (PB-A11): `Offertpipeline` (E10 read-model; amounts per the N-4 seed), `Uppföljningar` (due/overdue + quick complete), `Veckans bokningar` (mine/team toggle per role), `Konflikter` (open by type → resolver), `Aktiva jobb` (status, recently active, missing planned dates), `Tidläget` (reported vs expected hours); widget money rides the entitlement contract (FR108); widget list manifest-traceable (AC-B1b-8); Montör does not land here (`Min dag`) but may open if granted.

---

# Wave B2 — Candidate Story Lists

> **Depth note (PB-D10):** candidate titles only. Expanded to full stories at the **B1b→B2 checkpoint** together with the PRD coarse-FR expansion (AC-B2-8) and the B2 schema finalization (architecture §9.3). Every epic: first story = activation story (Cross-Epic Rule 1); `[oracle-check]` labels resolve before the epic's first story (Rule 2); **migration-classification round 2 (N-1) precedes each module's data-migration story** (Rule 4, NFR52, AC-B2-7).

## Epic 20 [Wave B2]: Documents Center — candidates

**Scope line:** Global `Dokument` aggregation over all active modules' entity-scoped file metadata; zero storage tables (PB-D6). **Key dependency:** B1 metadata compatibility (already guaranteed). **N-1 note:** no module data of its own — no migration story; legacy document-page index parity verified against aggregated modules.

- Story 20.1 (candidate): Documents activation + aggregation read-model (filter by module/owner-type/purpose/date; signed-URL preview; RLS-scoped via source entities).
- Story 20.2 (candidate): Documents UI — search/filter surface, preview pane, archive/restore per archive-over-delete (P55 thinned trash disposition); no folder tree (UXB-A13).
- Story 20.3 (candidate): `Filer` → `Dokument` nav swap + entity-panel cross-links ("visa i Dokument").

## Epic 21 [Wave B2]: Rentals — candidates

**Scope line:** Rental register through returns and history, with billing records feeding E26 (P39–P40). **Key dependency:** E13 (notifications); feeds E26. **N-1 note:** rentals classification before 21.6. **Oracle:** `Följesedel`/`Retur`.

- Story 21.1 (candidate): Rentals activation + item register (list/detail/archive/duplicate).
- Story 21.2 (candidate): `Snabbuthyrning` fast-path flow.
- Story 21.3 (candidate): Rental orders (incl. grouped) with lifecycle (reserved → out → returned).
- Story 21.4 (candidate): Delivery notes + return flows producing PDF documents (`Följesedel`, `Retur`).
- Story 21.5 (candidate): Rental history, item availability views, and rental billing records ("väntar på underlag" until E26 consumes).
- Story 21.6 (candidate): Rentals data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 22 [Wave B2]: Assets and QR — candidates

**Scope line:** Asset register with assignments/events/faults/mileage/labels plus the public QR route and proactive scanning (P41–P44). **Key dependency:** E13 (scan producers), E14 (person record), ADR-B004 (QR surface). **N-1 note:** assets classification before 22.6. **Oracle:** `Utrustning` label. **Merge note:** session-flagged absorb of E24.

- Story 22.1 (candidate): Assets activation + register (vehicles/tools/equipment; archive; documents via file model).
- Story 22.2 (candidate): Assignments (person via `person_profiles`), asset events timeline, mileage logs.
- Story 22.3 (candidate): Fault reports + QR/label PDF generation (`Skriv ut etikett`).
- Story 22.4 (candidate): Public QR route (ADR-B004 surface #2): hashed `asset_qr_tokens`, minimal projection, felanmälan submit deriving tenant/asset from the token row, rate limits, abuse suite (AC-B2-3).
- Story 22.5 (candidate): Proactive asset scan producer → expiry/service notifications with freshness stamps (AC-B2-4).
- Story 22.6 (candidate): Assets data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 23 [Wave B2]: Service and Warranties — candidates

**Scope line:** Service records/plans/agreements with authenticated due-scanning → suggestions and plan→job creation; warranties from completion events (P51–P53). **Key dependency:** E13 (producers), E18 (completion event), E16 (job creation). **N-1 note:** service/warranty classification before 23.5.

- Story 23.1 (candidate): Service activation + records/plans/agreements (lists/details, due dates).
- Story 23.2 (candidate): Due/overdue scan producer + suggestion inbox (`QueueList`: context, snooze, dismiss-with-reason, `Skapa jobb` pre-connected).
- Story 23.3 (candidate): Service-plan → job creation flow.
- Story 23.4 (candidate): Warranties — created by the E18 completion event (provenance link back to the job), expiry tracking + notifications.
- Story 23.5 (candidate): Service data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 24 [Wave B2]: Electrical Panels — candidates

**Scope line:** Panel register + gruppförteckning dense grid (RCD data), bulk edit, duplicate, print/PDF — manual core, no image import (P45; P46 stays C). **Key dependency:** none hard. **N-1 note:** panels classification before 24.3. **Oracle:** `Elcentraler` label, gruppförteckning columns. **Merge note:** candidate absorb into E22 — decided at the checkpoint, number stable.

- Story 24.1 (candidate): Panels activation + register/detail.
- Story 24.2 (candidate): Gruppförteckning editable grid (groups/circuits incl. RCD), bulk edit, duplicate, print/PDF export tuned to the standardized artifact.
- Story 24.3 (candidate): Panels data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 25 [Wave B2]: Supplier Data and Imports — candidates

**Scope line:** Supplier master data, price lists, supplier articles, discount agreements (row-sensitive RLS), deterministic file import, calc-row supplier references (P15, P48–P49; AI parsing stays C). **Key dependency:** Phase A calculations (source picker); E11 (role gating). **N-1 note:** supplier-data classification before 25.4.

- Story 25.1 (candidate): Suppliers activation + master data, price lists, discount agreements (discounts row-sensitive → role-gated RLS).
- Story 25.2 (candidate): Deterministic price-list file import via the wizard pattern (`supplier_import_runs` audit; per-row error report; re-import diff summary; explicit commit — nothing silently skipped).
- Story 25.3 (candidate): Supplier articles selectable on calculation rows (extends the frozen source picker with a supplier scope; snapshot-on-select semantics unchanged).
- Story 25.4 (candidate): Supplier data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 26 [Wave B2]: Billing Basis (+ Fortnox Spike) — candidates

**Scope line:** The Ekonomi assembly workbench closing B2 (PB-D11): candidate lines from jobs/rentals/service as copy-by-value öre snapshots; review → audited adjust → announced lock → export; plus the B2 Fortnox spike. **Key dependency:** E17/E21/E23 line sources. **Gates:** `[N-5 content definition; tax A/B/C + 2.2 bind real-invoicing use — demo unaffected]` (NFR49). **N-1 note:** no legacy billing-basis data expected (legacy had rental-only underlag support, P40) — confirm in classification.

- Story 26.1 (candidate): Billing activation + schema (`billing_bases`, `billing_basis_lines` copy-by-value snapshots, `billing_basis_events` append-only).
- Story 26.2 (candidate): Assembly workbench — scope pick (kund/jobb/period), candidate-line streaming from jobs (time, material, fixed price, payment-plan items, and other billable items per the N-5 content definition — architecture §7.3), rentals, service; per-line include/exclude; only approved, not-yet-invoiced source items are eligible and a consumed item is locked against double invoicing.
- Story 26.3 (candidate): Audited adjustments + `Lås underlag` (`Utkast → Låst → Exporterad`; `lockBillingBasis` RPC; DB-trigger lock-family member `BILLING_BASIS_LOCKED` with reversal + identity tests; audited-correction path; FR118) + export.
- Story 26.4 (candidate): Billing golden/regression packs (line assembly, lock totals, öre-exactness) + the real-invoicing correctness banner bound to the tax gates (NFR49, AC-B2-5).
- Story 26.5 (candidate): **B2 Fortnox spike** — answers architecture §7's questions (licensing/API access, rate limits, idempotency keys, invoice-basis payload vs N-5, token refresh, sandbox); produces the spike report feeding ADR-B005-final and the N-5 owner conversation (AC-B2-6). Runs parallel to 26.1–26.4; may be lifted to a standalone pre-E33 item at the checkpoint (EB-A9). **No Fortnox code, credentials, tables, or dependencies — a report.**

---

# Wave B3 — Candidate Story Lists

> **Depth note (PB-D10):** candidate titles only. Expanded at the **B2→B3 checkpoint** together with the PRD coarse-FR expansion (AC-B3-6) and B3 schema finalization (architecture §9.4). Rules 1, 2, and 4 apply per epic as in B2. **E33/E34 additionally gate on ADR-B005-final (post-spike).**

## Epic 27 [Wave B3]: DoU Manual Core — candidates

**Scope line:** DoU projects, discipline templates, folder/document structure, upload, versioning + lock, package export, material-list sync, seed-from-job (P56; all DoU AI stays C). **Key dependency:** E16/E18 (seed-from-job/completion), E20 (volume). **Gate:** `[N-8 template content — ingestion proceeds regardless]`. **N-1 note:** DoU classification before 27.5.

- Story 27.1 (candidate): DoU activation + projects and discipline-template structures (ingestion-ready before owner content, N-8).
- Story 27.2 (candidate): Folder/document tree, upload/import, per-document versioning + lock (lock-trigger family member).
- Story 27.3 (candidate): Package export (`Exportera paket`) + material-list sync status.
- Story 27.4 (candidate): `Skapa från jobb` — completion-event consumer seeding structure from a completed job (activates the E18 offer card).
- Story 27.5 (candidate): DoU data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 28 [Wave B3]: Self-Inspections — candidates

**Scope line:** Template-driven form runner (sections/items/measurements/attachments) usable in the field shape; manual creation, export, links to kund/anläggning/jobb/DoU (P58; AI generation stays C). **Key dependency:** E27 adjacency, E18 field patterns. **Gate:** `[N-8 template content]`. **N-1 note:** classification before 28.4.

- Story 28.1 (candidate): Self-inspections activation + templates (sections/items) with ingestion-ready template model.
- Story 28.2 (candidate): Form runner — assignable to Montör, field-shape ergonomics, measurements + attachments.
- Story 28.3 (candidate): Export to the standardized document + links to customer/facility/job/DoU.
- Story 28.4 (candidate): Self-inspections data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 29 [Wave B3]: Tenders/FKU Thin Core — candidates

**Scope line:** Upload files/ZIP with unzip into organized storage, manual summary fields, manual conversion links — the conscious thin parity slice; the UI must not promise analysis (P60–P61; tender AI stays C). **Gate:** `[N-7 — owner visibility of the thin slice; visibility, not permission]`. **N-1 note:** classification before 29.3. **Oracle:** `Anbud (FKU)` label. **Merge note:** KNX adjacency (E30).

- Story 29.1 (candidate): Tenders activation + upload/ZIP/unzip organized storage (files via `file_links`).
- Story 29.2 (candidate): Manual summary fields + manual conversion links to kalkyl/offert/jobb/DoU/egenkontroll (with the N-7 owner-visibility note on the surface).
- Story 29.3 (candidate): Tender file/data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 30 [Wave B3]: KNX Manual Tables — candidates

**Scope line:** Group-address projects with rooms/functions/address tables and settings — panels-style dense grid, small scope (P63; ETS parsing stays C). **N-1 note:** classification before 30.2. **Merge note:** tenders adjacency.

- Story 30.1 (candidate): KNX activation + projects with rooms/functions/group-address tables (dense grid pattern) and settings.
- Story 30.2 (candidate): KNX data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 31 [Wave B3]: HR and Personnel Depth — candidates

**Scope line:** Employment depth on the same person record (PB-D13 — parallel employee tables forbidden), competence/certifications/training with expiry alerts, incidents + HR inbox, `Min sida` self-service (authenticated suggestions — P70 thinned), GDPR deletion-request workflow (P65–P71). **Key dependency:** E13 (expiries), E14 (person record), E22 (assigned assets). **Answered gates:** N-10 supplies the deletion/retention posture (architecture §12B — retention fields, `LegalHold`, `Received → … → Closed` states, a central versioned retention policy, and no hard-delete for ordinary tenant admins, covering every identifiable person incl. contact persons, subcontractors, and people in photos); HR data is row-sensitive → role-gated RLS; salary-adjacent fields ride the N-4 sensitive-field seed. **N-1 note VOID** — there is no data migration (owner 2026-07-20).

- Story 31.1 (candidate): HR activation + employment extension of `person_profiles` (columns/child tables; zero parallel tables — AC-B3-2).
- Story 31.2 (candidate): Competence cards, certifications, training plans, employee documents with expiry-driven notifications.
- Story 31.3 (candidate): Incident reports + HR inbox (`QueueList`).
- Story 31.4 (candidate): `Min sida` — employee self-service (own profile, bookings, assigned assets, documents, authenticated suggestion box).
- Story 31.5 (candidate): GDPR deletion-request workflow — formal request → status tracker, authenticated + audited processing via ADR-B002, over the N-10 states `Received → IdentityVerificationRequired → UnderAssessment → PartiallyApproved | Approved | Rejected → Executed → Closed`, honouring `LegalHold` and the central versioned retention policy (architecture §12B).
- Story 31.6 (candidate): HR data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**
- Story 31.7 (candidate): Retention enforcement + physical Storage reclamation — after 31.5 establishes the central versioned policy, implement tenant-scoped dry-run/execute batches that delete only policy-expired, unlinked bytes with no `LegalHold`; re-authorize every batch, make retries idempotent, record per-object audit outcomes, and prove cross-tenant/held/current/linked files cannot be reclaimed. This is technical enforcement only; legal retention periods and customer-facing legal wording remain owner-approved inputs, not application guesses.

## Epic 32 [Wave B3]: Notes and CRM Completions — candidates

**Scope line:** Notice board with categories/pinning/archive + mention notifications; customer 360, favorites, classification tools, duplicate-calculation flow, quote-settings/branding completions — deltas on frozen Phase A surfaces (P10–P16, P72–P73). **Key dependency:** E13 (mentions). **N-1 note:** notes/classification data before 32.4. **Oracle:** `Anslagstavla`.

- Story 32.1 (candidate): Notes activation + notice board (categories, pinning, archive) with @mention notifications.
- Story 32.2 (candidate): Customer 360 tab + favorites + classification tools (read-models + small columns on frozen CRM surfaces).
- Story 32.3 (candidate): Duplicate-calculation flow + quote-settings/branding completions.
- Story 32.4 (candidate): Notes/CRM-completions data migration — **VOID (owner decision 2026-07-20: no Lovable→app data migration; parallel-run cutover). Do not create this story.**

## Epic 33 [Wave B3]: Fortnox Foundation — candidates

> **Gate banner:** `[ADR-B005-final (post-spike) + N-5]` — no Fortnox credentials, tables, routes, dependencies, or UI exist before the final ADR and this epic's activation (NFR50, AR-B18).

**Scope line:** Per-tenant Fortnox connection (OAuth entirely server-side, tokens encrypted, never client-reachable), mapping configuration, outbox export architecture. **Key dependency:** E26 (billing basis), the 26.5 spike, ADR-B005-final.

- Story 33.1 (candidate): Fortnox activation + `fortnox_connections` (server-side OAuth, encrypted tokens, status projection `Ansluten/Ej ansluten/Fel`) + connection settings UI under `Inställningar`.
- Story 33.2 (candidate): `integration_outbox` (appended transactionally with warranting domain events) + `external_mappings` (tenant-scoped, unique per type + local id) + the ADR-B002 export producer.
- Story 33.3 (candidate): Fortnox boundary-isolation negative suite (no client-path calls, no token exposure/logging, per-tenant isolation) per NFR50.

## Epic 34 [Wave B3]: Fortnox Billing Flows — candidates

**Scope line:** Export customers, articles, and invoice bases with per-record status, plain-language errors, per-record and per-run retry — status/error/retry UX is the module's core (FR128; export-only, no webhooks/inbound). **Key dependency:** E33.

- Story 34.1 (candidate): Customer + article export flows (mapping-aware, idempotent per ADR-B005-final).
- Story 34.2 (candidate): Invoice-basis export flow consuming locked billing bases (per-record `Köad → Skickad → Fel`).
- Story 34.3 (candidate): Export status surface at `/fortnox` — runs list, per-record rows with error detail, `Försök igen` per record/per run, `Endast fel` filter (AC-B3-4).

---

## Validation Summary

- **FR coverage:** FR62–FR130 all mapped (FR Coverage Map above); FR129/FR130 anchored in Story 10.1 and re-exercised by every activation story. No FR is uncovered; B2/B3 coarse FRs map to candidate epics and are re-verified when expanded at their checkpoint.
- **Depth per PB-D10:** B1a = 20 full stories with complete acceptance criteria (Epic 10: 9, including corrective Stories 10.8/10.9; Epic 11: 4, Epic 12: 3, Epic 13: 4); B1b = 25 sketched stories (Epic 14: 4, Epic 15: 6, Epic 16: 5, Epic 17: 4, Epic 18: 4, Epic 19: 2); B2 = 32 candidates (Epics 20–26); B3 = 31 candidates (Epics 27–34, including retention-enforcement Story 31.7). Total 108 story slots across 25 epics.
- **Sequencing:** Story 10.1 first overall; within B1a: E10 → E11 → E12 → E13; RBAC precedes all of B1b (PB-D2); scheduling does not wait for jobs depth (PB-D12); E26 closes B2 (PB-D11); Fortnox spike during B2 (26.5); no forward dependencies inside any epic. Repurposed Story 10.7 is governance alignment and creates no E14–E18 prerequisite.
- **Gate banners placed:** ADR-B006 banner on Epics 16–18 (stories finalized at gate close); N-4 on Story 11.2 and the Roles surface; N-2 on Story 12.3/FR76; N-6 on Story 13.4 (dark); N-3 is resolved by current ADR-B009 and adds no technical prerequisite to E14–E18; N-9 on conflict-rule fixtures (14.3/15.1); N-5 + tax gates on E26; N-7 on E29; N-8 on E27/E28; N-10 on 31.5; N-1 on every B2/B3 migration story; ADR-B004 on 15.5/22.4/13.4; ADR-B005-final on E33/E34.
- **Epic independence:** each epic delivers complete functionality for its slice using only earlier epics; gated epics (16–18, 33–34) block only themselves; no epic requires a later epic to function.
- **No Phase C runtime surface** appears in any story. Story 10.7 records the PWA/offline deferral in planning only; the manifest validator and scope scans enforce FR130 continuously.

## Assumptions Register (autonomous run record — EB-A#)

Judgment calls made in this non-interactive run. None re-litigates a ratified decision; each is overridable at sprint planning or a wave checkpoint without renumbering.

| ID | Assumption / judgment call | Status |
| --- | --- | --- |
| EB-A1 | The interactive workflow menus (confirm/elicit/party-mode) were collapsed per the autonomous mandate; the party-session record supplies the binding epic structure the menus would normally ratify; the frozen Phase A epics.md supplies format/AC conventions. | accepted for this doc |
| EB-A2 | Output file is `epics-phase-b.md`; the Phase A `epics.md` is untouched and remains the frozen numbering predecessor (stories 1.1–9.5). | accepted |
| EB-A3 | All 25 ratified candidates kept as separate epics with stable E-numbers. Session-flagged merges (E12→E11, E24→E22, E30↔E29 adjacency, E32 bundle) are recorded on the affected epics; a merge exercised at a checkpoint absorbs stories under the surviving epic without renumbering. | accepted; checkpoint decision |
| EB-A4 | B1a internal order E10 → E11 → E12 → E13. E10's module stories (10.2–10.4) run under `tenant_admin` with envelope capability seams; Story 11.2's matrix seed retrofits role enforcement to them without rework. | accepted |
| EB-A5 | The manifest coherence rule "activation without matrix rows fails" is wired at Story 11.1 (when the matrix source exists), not 10.1 — avoids a self-failing validator in the gap between the two stories. All other validator rules land in 10.1. | accepted |
| EB-A6 | Per-role landing (11.2) ships with a role-appropriate fallback start for Montör until `/my-day` exists; the Min dag redirect activates in Story 15.6. | accepted |
| EB-A7 | `Min dag` is placed in Epic 15 (bookings-first, per PB-D12); its `Mina jobb` section renders only once E16 activates — a one-directional seam, not a dependency. | accepted |
| EB-A8 | The follow-up due-reminder producer (`quote.follow_up_due`) lands in Story 13.2 consuming Epic 10 data; Epic 10's lists/badges work without notifications, so no forward dependency exists. | accepted |
| EB-A9 | The B2 Fortnox spike is carried as candidate Story 26.5 inside E26 (PB-D11 "spike during B2"), runnable in parallel with billing-basis build; the B1b→B2 checkpoint may lift it to a standalone pre-E33 item. | accepted; checkpoint may restructure |
| EB-A10 | E12's operator console and platform tables are recorded in the manifest as platform-scoped entries rather than a tenant module flip (mirrors architecture §9.1's enumerated exception class). | assumption for Story 10.1/12.1 implementation |
| EB-A11 | B1b sketch numbering and B2/B3 candidate numbering are provisional; final numbering is fixed when stories are authored in full (gate close for E16–E18; wave checkpoints for B2/B3). Full-AC B1a numbering (10.1–13.4) is final. | accepted |
| EB-A12 | Story 11.2 ships a conservative default entitlement seed (Montör sees no prices/costs/margins; Säljare margin visibility withheld; strictest-default posture) explicitly flagged "väntar på ägarbeslut"; N-4 confirmation is a config-level matrix edit. This keeps AC-B1a-2 achievable without pre-empting the owner. | needs owner visibility at the N-4 gate |
| EB-A13 | Story counts per epic are planning slots, not commitments; wave checkpoints own re-estimates (PB-D10). E14–E18 remain the least-certain sizings (session §6 caveat). | accepted |
| EB-A14 | Epic 19 carries no oracle-check gate: dashboard v1 is a Phase-B-shaped surface (PB-D7); legacy P7 widget parity completes cumulatively as later modules land, verified at wave checkpoints rather than per-epic terminology checks. | accepted |
| EB-A15 | Data-migration candidate stories are placed only on B2/B3 module epics (N-1 round-2 scope per session §9.3); B1a/B1b modules (quotes delta, scheduling, jobs depth) take migration decisions through the same N-1 lens at their wave checkpoints if legacy data exists (e.g. legacy bookings/time data is explicitly in the N-1 list — hooks noted, stories added at the checkpoint). | accepted; checkpoint item |
| EB-A16 | PWA/offline is not a manifest module. The 2026-09-03 course correction therefore changes planning/dependencies and the Phase C ledger without a manifest edit or placeholder module. | accepted; ADR-B009 |

## Open Items for Sprint Planning


1. **Sequence Story 10.1 as the first pipeline story** and block every other Phase B story behind it (AC-B1a-6). The `project-context.md` refresh (document plan item 10) should follow immediately after 10.1 merges.
2. **ADR decisions:** ADR-B006 is recorded and E16–E18 are unblocked. ADR-B009 is current; ADR-B007 is historical. Finalize E14–E18 from these connected sketches without adding PWA/offline or Story 10.7 dependencies.
3. **Owner decisions:** all former gates are closed. N-3 was superseded on 2026-09-03; carry ADR-B009's connected 360×640/transient-failure posture into each affected story. Story 10.6 remains the separate money-rule sequencing prerequisite.
4. **Oracle terminology tasks:** create the `legacy-oracle-explorer` terminology task per epic with `[oracle-check]` labels (E10, E13, E15, E16, E17, E18, E20–E25, E27–E32) and run it before that epic's first story (Cross-Epic Rule 2).
5. **Wave-boundary checkpoints** own: PRD coarse-FR expansion (B2 at B1b→B2, B3 at B2→B3), full story authoring for the next wave from the candidates here, B2/B3 schema finalization, the time-report approval decision (AB-A10, with E26/N-5), N-9 capacity-rule fixture hardening, merge decisions (EB-A3), and re-estimates.
6. **Per-story template carry-over:** every story context must restate Cross-Epic Delivery Rules 1–5 obligations relevant to it (activation protocol, oracle gate, ADR gates, N-1, Phase A invariants) — sprint planning should encode this in the story template.
7. **Second-tenant proof scheduling:** AC-PH-3 (end-to-end second-tenant provisioning) should be scheduled as a verification run after Epic 12 completes and re-run at phase close.

— End of Phase B epic breakdown. Downstream: sprint planning (`/bmad-sprint-planning`), then `/auto-bmad epic --epic 10`, per the ratified document plan (session §7).






