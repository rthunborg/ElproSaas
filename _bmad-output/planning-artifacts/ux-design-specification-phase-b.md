---
title: "UX Design Specification: ElproSaas — Phase B (Legacy Parity Release)"
status: final
created: 2026-07-18
updated: 2026-09-03
author: "Rasmus (via autonomous /bmad-ux run)"
mode: "headless create — non-interactive; all choices resolved against the Phase B PRD and the ratified party-session record (PB-D1..PB-D14); judgment calls logged in the Assumptions Register (§15)"
governedBy:
  - _bmad-output/planning-artifacts/prd-phase-b.md                       # FR62-FR130; §4 roles/journeys; §7 job-model gate; §15.1 UX handoff items
  - _bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md  # PB-D1..PB-D14 binding; §9 owner gates
  - _bmad-output/planning-artifacts/product-brief-phase-b.md
references:
  - _bmad-output/planning-artifacts/ux-design-specification.md           # Phase A UX spec — FROZEN; referenced for carried tenant-admin surfaces, never edited
  - _bmad-output/project-context.md                                      # stack + shell conventions (Next.js App Router, Tailwind v4, AppShell nav island, seven Phase A nav items)
depthModel: "Detailed for Wave B1a/B1b surfaces (PRD §15.1 handoff items); pattern-level for Wave B2/B3 (re-validated and deepened at wave-boundary checkpoints per PB-D10)"
classification:
  projectType: saas_b2b_operations_app
  domain: swedish_electrical_contracting
  phase: Phase B - Legacy Parity Release
  scope: multi_role_ux (Företagsadmin, Projektledare, Montör, Säljare, Ekonomi, per-job Arbetsledare — seed CONFIRMED by owner answer N-4, 2026-07-26)
---

# UX Design Specification — ElproSaas Phase B (Legacy Parity Release)

**Author:** Rasmus
**Date:** 2026-07-18
**Artifact type:** Experience specification (IA, behavior, states, interactions, accessibility, flows). Not a visual design system — Phase A's "restrained admin web app" visual posture carries forward; see §1.

## 0. Purpose, Boundary, and Reading Order

This specification defines the Phase B user experience for the surfaces the PRD hands to the UX stage (PRD §15.1): the field-worker experience, the five scheduling views and the conflict resolver, the job workspace, RBAC/admin surfaces, tenant onboarding, notifications, the operational dashboard v1, and quote lifecycle completion — plus the pattern layer every B2/B3 module inherits.

Boundary rules:

- **The Phase A UX spec is frozen.** Carried tenant-admin surfaces (CRM, settings/pricing, calculation editor, quote versions/PDF/acceptance, basic job record, entity file panels, states, workflow) are specified there and are **referenced, never restated and never edited**. Where Phase B extends a carried surface (e.g. the quote detail gains Förlorad/Avböjd), only the delta is specified here.
- **Depth follows the ratified wave-checkpoint model (PB-D10).** Wave B1a/B1b surfaces are specified in detail (§4). Wave B2/B3 surfaces are specified at pattern level only (§5) — interaction patterns, list/detail conventions, and how they inherit the B1 system — and are deepened at their wave-boundary checkpoint before build.
- ~~**Owner gates stay open.**~~ **UPDATED 2026-07-26 — the gates are CLOSED.** This spec was written with `[gated: X]` markers around decisions it deliberately did not resolve. The owner answered all of them on 2026-07-26. **COURSE-CORRECTED 2026-09-03:** the N-3 installable-PWA/offline answer is preserved in the dated owner record and ADR-B007 but no longer governs Phase B. ADR-B009 defines connected responsive field UX at 360×640, transient unsent-input protection, explicit retry, and server-confirmed success; the complete PWA/offline package is Phase C. The money correction remains governed by `architecture-phase-b.md` §12A.
- **The legacy Lovable app is the behavioral and terminology oracle, not a visual template.** Nothing here copies legacy layout or code; legacy terms are adopted where they are the words users already use (§9), and uncertain labels carry an explicit `[oracle-check]` marker to be verified against the legacy app before build.
- **Phase C surfaces are unreachable** (PRD FR130): no AI affordances, no customer portal, no supplier-API UI, and no PWA install prompt/manifest, offline mode, pending-sync center, replay/conflict UI, or other placeholder for the deferred PWA/offline package. No placeholder screen or nav item exists for anything not manifest-active.

Reading order for downstream consumers: this spec → Phase B architecture extension (which owns ADR-B001..B006 and answers §14) → Phase B epics.

## 1. Foundation

### Form factor and posture

- **One responsive web application across desktop, tablet, and phone.** Desktop/laptop remains the primary posture for Företagsadmin, Projektledare, Säljare, and Ekonomi (the Phase A shell). Field-worker (Montör) surfaces are phone-first and usable from the 360×640 floor, but require connectivity. ADR-B009 supersedes the 2026-07-26 PWA/offline direction in ADR-B007; there is no installability, service-worker, durable offline, local queue, or synchronization UX in Phase B. **No native app** is designed in Phase B.
- **One codebase, role-shaped surfaces.** There is no separate "field app" URL space: the same routes render role- and viewport-appropriate layouts. Least privilege shapes what exists on screen (§3), the server enforces it (FR67).

### UI system

- The app is Next.js (App Router) + React + **Tailwind CSS v4** with tokens in `@theme` (`src/app/globals.css`), the Geist font, and the existing authenticated `AppShell` (server-resolved tenant context, client nav island). Phase B **extends this shell**; it does not introduce a component library or a new visual identity.
- No separate DESIGN.md token file exists or is created in this phase; Tailwind `@theme` is the de-facto token source and the Phase A visual posture ("restrained admin web app, dense-but-readable, clear primary actions") is the visual reference (UXB-A1). Behavioral component contracts live in §6.

### Design principles (Phase B additions to the Phase A posture)

1. **Interconnected, not siloed** (owner direction): every record surface exposes its connections (jobb ↔ bokningar ↔ personer ↔ material ↔ ekonomi ↔ dokument) as navigable context, and every entity is standalone-creatable AND connectable (owner rule 2026-07-14, PB-D12) — connection fields are always optional at creation, never artificial prerequisites.
2. **Least privilege is a UX feature, not just a security rule:** a Montör's app is small, calm, and task-shaped — not the admin app with things greyed out. Hidden, not disabled (§3).
3. **Gloves-and-daylight ergonomics** for field surfaces: large touch targets, high contrast, thumb-reach primary actions, no hover-dependent or precision-drag-dependent interactions on phone (§4.8, §10).
4. **The server is the truth teller:** client gating, conflict hints, and masked values are conveniences; every state the UI shows must be re-derivable from server responses. The UI never computes money, permissions, or conflicts locally as authority.
5. **Immutability is visible, not surprising** (carried from Phase A): lifecycle locks (sent quotes, locked billing bases, completion events) are announced before commitment and explained when they block.
6. **Swedish on the surface, English underneath:** Swedish business labels in UI; English route names and code identifiers (Phase A convention; §9).
7. **No placeholder UX:** nav items, widgets, tabs, and notification categories appear only when their producing module is manifest-active (PB-D7, FR129/FR130). The UI grows per wave; it never teases.

## 2. Information Architecture

### 2.1 Navigation model: grouped sidebar derived from manifest × permission matrix

Phase A's flat seven-item sidebar does not scale to ~20 modules. Phase B introduces **nav groups** in the same persistent left sidebar (desktop) / drawer (narrow) shell:

- A nav item renders only when **(a)** its module is `active` in the scope manifest (ADR-B003) AND **(b)** the signed-in user's role has at least read permission on it (permission matrix). Client-side visibility is UX only; the server independently rejects unauthorized routes (FR67, FR72).
- A group renders only when it contains ≥1 visible item. Groups are labeled, collapsible, and remember collapse state per user.
- **Hide, don't disable:** no disabled/teaser items for modules the role cannot reach or that are not yet active. Unauthorized direct navigation lands on a generic access page with no existence signals (FR72).
- The nav registry (groups, items, order, icons, required permission) should be a single derived structure so the manifest validator can trace every nav item to an active module (NFR51) — representation is an architecture-stage item (§14).

### 2.2 Target IA at full Phase B build-out

Wave column = when the item first appears (manifest activation). Labels per §9; routes stay English.

| Group | Item (Swedish label) | Route | Wave | Roles (seed default, confirmed N-4) |
| --- | --- | --- | --- | --- |
| — | `Dashboard` | `/dashboard` | A (v1 rework B1b) | All desktop roles; Montör lands on `Min dag` instead |
| — | `Min dag` | `/my-day` | B1b | Montör (landing), all roles optional |
| Försäljning | `Kunder` | `/customers` | A | Admin, Projektledare, Säljare |
| Försäljning | `Kalkyler` | `/calculations` | A | Admin, Projektledare, Säljare |
| Försäljning | `Offerter` | `/quotes` | A (lifecycle delta B1a) | Admin, Projektledare, Säljare |
| Drift | `Planering` | `/scheduling` | B1b | Admin, Projektledare (full); Montör (personal view only) |
| Drift | `Jobb` (or `Jobb & Projekt` per ADR-B006) | `/jobs` | A (workspace B1b) | Admin, Projektledare; Montör via `Mina jobb` scope |
| Drift | `Tidrapporter` | `/time-reports` | B1b | Admin, Projektledare (review); Montör (own) |
| Resurser | `Uthyrning` | `/rentals` | B2 | Admin, Projektledare |
| Resurser | `Utrustning` `[oracle-check]` | `/assets` | B2 | Admin, Projektledare; Montör (assigned-to-me read) |
| Resurser | `Service` | `/service` | B2 | Admin, Projektledare |
| Resurser | `Elcentraler` `[oracle-check]` | `/panels` | B2 | Admin, Projektledare, Montör |
| Resurser | `Leverantörer` | `/suppliers` | B2 | Admin, Ekonomi, Projektledare |
| Dokumentation | `Filer` → becomes `Dokument` at E20 | `/files` → `/documents` | A → B2 | All roles (index scoped by entity permissions) |
| Dokumentation | `DoU` | `/dou` | B3 | Admin, Projektledare |
| Dokumentation | `Egenkontroller` | `/self-inspections` | B3 | Admin, Projektledare, Montör (assigned) |
| Dokumentation | `Anbud (FKU)` `[oracle-check]` | `/tenders` | B3 | Admin, Projektledare, Säljare |
| Dokumentation | `KNX` | `/knx` | B3 | Admin, Projektledare |
| Ekonomi | `Faktureringsunderlag` | `/billing-basis` | B2 | Admin, Ekonomi |
| Ekonomi | `Fortnox` (export status) | `/fortnox` | B3 | Admin, Ekonomi |
| Personal | `Personal` | `/hr` | B3 | Admin (full); others self-scope via `Min sida` |
| Personal | `Min sida` | `/me` | B3 (profile basics earlier via top bar) | All roles |
| Personal | `Anslagstavla` | `/notice-board` | B3 | All roles |
| Administration | `Användare & roller` | `/admin/users` | B1a | Admin |
| Administration | `Inställningar` | `/settings` | A | Admin |

Notes:

- **Notification center is not a nav item** — it opens from the top-bar bell ("Visa alla") at `/notifications` (§4.4). Preferences live under the user profile menu.
- **Operator provisioning console** (§4.3) is deliberately **outside the tenant nav** — a separate operator-scoped area, invisible to tenant users.
- The Phase A `Pilotstöd`/`Migrering` support surface remains available to Admin as needed (frozen spec) and remains as pilot-support surface only. **N-1 (migration classification round 2) EXPIRED** with the owner's 2026-07-20 decision that there will be no Lovable→app data migration — cutover is a parallel run, so no per-module migration states are designed.
- Group and item labels ship with the activating epic; exact grouping may be re-balanced at wave checkpoints without changing the derivation rule.

### 2.3 Top bar

Carried from Phase A (tenant context, current user, page-level primary action) with two additions:

- **Notification bell** with unread badge (B1a, §4.4) — present for every role.
- **User menu** gains: `Min kalender` (personal feed link + calendar-feed token management `[ADR-B004]`), `Notisinställningar`, `Min sida` (B3). On phone, the top bar collapses to app title + bell + menu.

### 2.4 Cross-navigation rules (extended)

Phase A's lifecycle linking (kund → kalkyl → offert → acceptans → jobb) extends to the new spine: **jobb ↔ bokningar ↔ tidrapporter ↔ material ↔ ekonomi ↔ dokument ↔ underlag**. Rules:

- Every connection renders as a chip/link with type icon + label; navigating a connection preserves the origin in a breadcrumb/back affordance.
- Lists preserve filter/search/pagination state on return (carried).
- Lifecycle status is visible everywhere the record appears, as text+icon badges (never color-only).
- "Skapa och koppla" is a universal pattern: from any record, related records can be created pre-connected (e.g. `Ny bokning` from a job pre-fills the job connection) — and every such record type can also be created standalone from its own list (PB-D12).

## 3. Role Surfaces and the Least-Privilege UX Model

### 3.1 Role → home surface

| Role | Landing | Primary surfaces | Never sees (seed default, confirmed N-4) |
| --- | --- | --- | --- |
| Admin | `Dashboard` | Everything active | — |
| Projektledare | `Dashboard` (drift-weighted widgets) | Planering, Jobb, Tidrapporter (review), Kunder/Kalkyler/Offerter | Tenant provisioning; user admin |
| Montör | `Min dag` | Min dag, Mina jobb, job field tabs, Tidrapporter (own), Egenkontroller (assigned, B3) | Prices/costs/margins, others' rates, tenant settings, user admin, other people's time |
| Säljare | `Dashboard` (pipeline-weighted) | Kunder, Kalkyler, Offerter (+uppföljningar), Anbud (B3) | Job economy detail, HR, admin, **cost price and contribution margin** (N-4 default — `Economy.ViewContributionMargin` is grantable separately to e.g. a sales manager) |
| Ekonomi | `Dashboard` (economy-weighted) | Faktureringsunderlag (B2), Fortnox (B3), job economy rollups, Leverantörer | User admin, HR depth (except what N-4 grants) |
| Arbetsledare (job-scoped) | — (their tenant role's landing) | Elevated capabilities **inside the specific job workspace only** (§4.9) | Everything their tenant role doesn't grant |

### 3.2 Sensitive-field masking — the mechanism (policy is N-4's)

The PRD requires server-side withholding (FR71, NFR44): a role without entitlement **never receives the value in any payload**. The UX mechanism this spec commits to:

1. **Absence, not zeros:** the UI never renders a missing money/sensitive field as `0`, empty, or a client-computed fallback. Absence is a first-class rendered state.
2. **`MaskedValue` component (§6):** in detail contexts (cards, headers, economy panels), a withheld field renders a lock glyph + `Dold` with tooltip/long-press text *"Din roll ser inte belopp"* and screen-reader text "Dolt för din roll" — preserving layout stability.
3. **Column omission in tables:** in dense lists, money columns the role is not entitled to are **omitted entirely** (the column set derives from the response's entitlement shape), not rendered as masked cells — a table of lock icons is noise.
4. **Aggregate honesty:** a summary containing any withheld component is itself withheld (no "totals minus the hidden parts" — a wrong number is worse than no number).
5. **Feature-shaped fallout:** where masking would gut a surface (e.g. Ekonomi tab for Montör), the surface/tab is hidden for that role rather than rendered as a field of locks (§3.1, §4.9).
6. **Contract note for architecture (§14):** the UI needs a deterministic way to distinguish "withheld" from "empty/null" (field-presence/entitlement descriptor in the payload shape) — never a client-side role lookup.

The per-role entitlement seed is **answered (N-4, 2026-07-26)**: **Montör sees no sales price, no cost price, and no contribution margin. Säljare sees sales prices but not cost or margin by default.** Arbetsledare defaults to Montör's money posture on the jobs they lead. Projektledare, Ekonomi, and Företagsadmin see all three. Every money element below renders through the mechanism above against exactly that seed (`architecture-phase-b.md` §3.3A). One new surface follows from it: a **below-margin warning for Säljare** that says the quote is under the permitted margin **without revealing any cost figure** — the warning must not be invertible back to the cost price.

## 4. Wave B1 Detailed Surface Specifications

### 4.1 Quote lifecycle completion (E10) — delta on the frozen Phase A quote UX

The Phase A quote detail (version timeline, immutable snapshots, PDF, acceptance) is unchanged. Additions:

**Förlorad/Avböjd (FR62–FR63):**

- On a **sent** version, alongside `Registrera accept`: action `Markera som förlorad/avböjd`.
- Dialog: outcome (`Förlorad` — lost, vs `Avböjd` — declined `[oracle-check for whether legacy users distinguish these]`), **required reason** — structured category select (`Pris`, `Konkurrent`, `Tidplan`, `Uteblivet svar`, `Annat` — UXB-A5 strawman list, tenant-tunable later) + free-text note (required when `Annat`).
- Confirmation states the consequence plainly: the status flip is an append-only lifecycle event; the sent snapshot does not change; the quote can still be superseded by a new version if the deal revives.
- After: version badge `Förlorad/Avböjd` (terminal style, distinct from `Accepterad`); reason visible on the version card and in `Händelser`; the quote thread header reflects the latest version's state.
- Quote list: status filter gains `Förlorad/Avböjd`; a `Förlustorsak` column is available in that filter view.

**Follow-ups (FR64):**

- On any sent version: `Planera uppföljning` (date + note). One open follow-up per quote at a time (UXB-A6); completing it offers "planera nästa".
- `Uppföljningar` appear three places: a dashboard widget (due today / overdue / upcoming — §4.10), a quote-list filter (`Har uppföljning`, `Försenad uppföljning`), and on the quote detail header (next follow-up chip).
- Completing a follow-up: `Klarmarkera` with outcome note; from the same sheet the user can jump to `Markera som förlorad/avböjd` or `Ny version` — the follow-up surface is where deals get decided.
- Overdue follow-ups escalate visually (badge + dashboard) and produce a notification via E13 (§4.4).

**Pipeline visibility (FR65):** hit rate and counts render in the dashboard widget (§4.10); no separate analytics page in B1 (PB-D7).

### 4.2 RBAC and admin user management (E11)

Surface: `Användare & roller` (`/admin/users`), Admin-only. Two tabs: `Användare`, `Roller`.

**Användare (FR69–FR70):**

- List: name, e-mail, role(s), status badge (`Inbjuden` / `Aktiv` / `Inaktiverad`), last sign-in. Filters: role, status. Primary action `Bjud in användare`.
- **Invite flow:** dialog — e-mail + role(s) selection (seed roles with one-line descriptions of what each role reaches). Send → row appears as `Inbjuden` with actions `Skicka igen` / `Återkalla`. Every action confirms and lands in the audit trail (visible in a `Händelser` panel on the user detail).
- **User detail (sheet):** roles editor (add/remove roles with immediate effect warning), `Skicka lösenordsåterställning`, `Inaktivera` (confirm: "kan inte logga in; historik och bokningar bevaras") / `Aktivera igen`, `Ta bort medlemskap` (strong confirm; archive-over-delete semantics — history preserved, membership ended).
- **Effective permissions viewer (FR70):** read-only per-user panel listing modules × capabilities the user's role set grants — rendered from the server's permission matrix, grouped by module, with the granting role annotated. This is the admin's answer to "why can/can't Emil see X".
- Deactivated users: their bookings/time reports remain visible with an `Inaktiverad` marker; scheduling views flag their future bookings for reassignment (link into the conflict/reassign flow, §4.6).

**Roller:**

- B1a scope is **seed roles, no custom role builder** (UXB-A7): the five tenant roles listed with description and member count; per-role view shows its permission-matrix rows grouped by module — the matrix visibly **grows as modules activate** (PB-D2): a module's rows appear only when it is manifest-active, with the activating wave noted.
- Sensitive-field entitlements (money visibility) render as explicit rows per role, seeded per N-4. **Role and permission changes are audited and require a reason** — the edit surface captures it rather than writing silently (arch §3.3A).
- The per-job `Arbetsledare` designation is deliberately **not** here — it is assigned inside each job workspace (§4.9); the Roller tab explains this ("jobbroll, tilldelas på jobbet").

### 4.3 Tenant provisioning and onboarding (E12)

**Operator console (FR73, FR75):** a separate operator-scoped area (not in tenant nav; hosting/auth model is an architecture item).

- Tenant list (name, status, created, first-Admin state) → `Provisionera ny tenant` wizard, three steps: **1) Företagsuppgifter** (name, org identity), **2) Baslinje** (default settings applied — VAT default, terms placeholders, locale; displayed, not re-typed), **3) Bjud in första Admin** (e-mail). Finish screen: audit summary + invite status. No cross-tenant data is ever visible in the console beyond tenant identity/status (NFR54 posture).
- Re-entrant: an interrupted provisioning resumes at the incomplete step; re-running never duplicates a tenant (idempotent command semantics surface as "already provisioned" state).

**First-Admin onboarding (FR74):** on first sign-in to a fresh tenant, the Admin lands on a **`Kom igång` checklist** (dismissable, resumable, pinned on the dashboard until done):

1. `Företagsinställningar` (identity, logo)
2. `Moms & visning` (VAT defaults)
3. `Offertvillkor` (terms — carries Phase A's sign-off warning posture)
4. `Arbetsroller & priser` (pricing baseline — also feeds scheduling, PB-A8)
5. `Bjud in användare` (with roles)

Each item deep-links to the real settings surface and auto-checks on completion (server-derived, not click-tracked). "Working state" = all items green (AC-B1a-1's demo path).

**No self-serve signup (N-2, answered 2026-07-26):** the owner has ruled it out — every customer company is registered and provisioned internally after a contract. No public registration surface, route, or copy ships. The wizard stays entry-point agnostic as a design property, not as a seam being built toward. The operator flow gains a **preview-then-approve** step: the provisioning agent shows exactly what will be created, an authorised person approves, and the outcome plus the approver are written to the audit log. The wizard must also support a **dry run** that writes nothing (FR76; arch §15.4A).

### 4.4 Notifications and email touchpoints (E13)

**Bell + popover (FR77):** top-bar bell with unread count (cap display "9+"). Popover: latest ~10 notifications — icon by category, one-line text, relative time, unread dot; actions `Markera alla som lästa`, `Visa alla`. Clicking a notification deep-links to its source record and marks it read.

**Notification center (`/notifications`):** full list with filters (category/module, read state, date). Categories exist only for **registered producers of active modules** (no placeholder categories): B1a ships quote follow-up reminders + admin/user events; B1b adds booking reminders, booking changes ("din bokning har flyttats"), time-report nudges; B2/B3 add service suggestions, expiries, mentions, export failures as their modules activate.

**Preferences (per user):** `Notisinställningar` under the profile menu — matrix rows = notification categories (grouped by module), columns = `I appen` / `E-post`. The e-post column renders but is **inactive with an explainer** ("e-postutskick aktiveras senare") until sending activates; in-app toggles are live from B1a. Essential/security notices are non-disableable and marked so.

**Email touchpoints (N-6 answered 2026-07-26):** the sender renders as **`[Företagsnamn] via [Systemnamn]`** from the central verified subdomain, with **Reply-To set to the tenant's own address** so customer replies reach the company, not us. Flow priority: invitations/security → quote sending → accept/reject notification → job assignment → quote reminders → digests. **Quote reminders stop automatically** on accept, reject, withdrawal, a new version, or expiry — the reminder settings UI must state those five conditions so nobody expects to have to cancel manually. Invoice emails come from **Fortnox**, not from us, so the customer never receives two. Bodies are designed at activation; this spec commits to: every outbound email carries the tenant identity, a clear subject convention, a deep link back to the record, and an unsubscribe link for non-essential mail (tokenized, ADR-B004). Unsubscribe landing page: minimal, confirms scope ("du får inte längre påminnelser via e-post"), offers re-subscribe, no login required, no tenant enumeration.

**Freshness honesty:** surfaces fed by background producers (due scans etc.) display last-run recency ("skannad för 2 tim sedan") rather than implying real-time (§7).

### 4.5 Scheduling: the five views (E14/E15)

Surface: `Planering` (`/scheduling`) with a view switcher (segmented control, keyboard-reachable): `Schema` · `Resurser` · `Team` · `Beläggning` · `Min kalender`. Shared toolbar: date navigation (idag / ‹ › / period picker), granularity (Dag/Vecka/Månad where applicable), filters (person, arbetsroll, jobb, kund), `Ny bokning`, and a persistent `Konflikter (n)` chip that opens the resolver (§4.6). Filter and period state persist per user per view.

| View | Layout | Optimized for | Notes |
| --- | --- | --- | --- |
| `Schema` | Time-grid calendar (day/week), bookings as blocks; month = density overview | "What is happening when" | Default for Projektledare. Booking blocks show assignees, job/kund chip, work-role tint + icon; conflict-marked blocks carry a warning glyph. |
| `Resurser` | Horizontal timeline: rows = bookable persons, columns = time (day/week) | "Who is free when" — assignment work | Row header: person + arbetsroll + capacity hint. Empty-slot click/drag creates a booking pre-filled with that person+time. Unassigned/needs-reassignment lane at top (e.g. bookings of deactivated users). |
| `Team` | Week board grouped by team/arbetsroll: columns = days, cards = bookings per group | Crew planning at a glance | Grouping toggle: per arbetsroll (B1) — named teams only if the oracle demands them `[oracle-check]` (UXB-A9). |
| `Beläggning` | Capacity matrix: rows = persons (or roll rollup), columns = periods, cells = booked vs available (percent + bar) | Spotting over/under-load | Cell color + **number** (never color alone); >100% cells link to the affected bookings. Capacity math per N-9: scheduled time − holidays/closed days − absence − bookings − blocked time − buffer, derived from the **actual weekly schedule** rather than employment percentage. Overtime is not ordinary capacity. |
| `Min kalender` | Personal agenda list (phone-first) + week grid (desktop) | The individual's own day/week | This is Montör's slice of Planering and the heart of `Min dag` (§4.8). Includes `Kalenderprenumeration` — create/rotate/revoke the personal tokenized feed URL with a plain-language warning that the link grants read access to their calendar `[ADR-B004]` (FR91). |

All five views read the same booking data and the same filter model; they are projections, not separate modules (AC-B1b-2).

### 4.6 Booking creation, recurrence, and the conflict resolver

**Create/edit booking (FR83–FR84):**

- Entry points: `Ny bokning` (toolbar, keyboard path), empty-slot drag/click (Schema/Resurser), `Boka` from a job workspace (pre-connected), `Ny bokning` from a customer/anläggning (pre-connected).
- Editor: side sheet (desktop) / full-screen sheet (phone). Fields: **Tilldelade** (multi-person picker with live availability hints and arbetsroll filter), **Arbetsroll**, **Tid** (start/end; full-day toggle), **Koppling** — Jobb / Kund / Anläggning / Kontakt, all optional (PB-D12; a booking is valid standalone), **Beskrivning**, **Återkommande** (off by default).
- **Live conflict check (FR85):** on every assignee/time change, the sheet shows an inline conflict panel per violation — type (`Dubbelbokning` / `Över kapacitet` / `Utanför arbetstid`, plus `Utanför åtkomstfönster` and `Saknad kompetens` from the N-9 job inputs), who, what collides, with a mini-timeline of the collision. Conflicts **warn, they do not hard-block**: saving with conflicts requires an explicit `Boka ändå` acknowledgment, which records the conflict as open on the booking (UXB-A10 — field reality sometimes needs deliberate double-booking; architecture validates the override/audit shape).
- Editing a booking that participates in a recurrence asks scope: `Endast detta tillfälle` / `Detta och kommande` (§ below).

**Recurring bookings (FR88):**

- Recurrence editor: preset patterns (Varje dag / Varje vecka [weekday picker] / Varannan vecka / Varje månad) + end condition (until date / N gånger). No freeform RRULE editing in B1.
- **Deterministic preview:** the editor always shows the next ~10 expanded occurrences before save ("så här blir det"), with conflict glyphs per occurrence — recurrence is never a surprise.
- Occurrence edits/cancellations mark the occurrence as an exception, visibly ("avviker från serien"); series edits re-preview before commit.

**The conflict resolver (FR89):**

- Entry: the persistent `Konflikter (n)` chip, the dashboard widget, or any conflict glyph on a booking.
- Layout: master-detail. Left: conflict queue (grouped by person, then date), each row = type + who + when. Right: selected conflict — a focused mini-timeline showing **both** colliding bookings (or the capacity breach window) with their job/kund context, and the violated rule in plain language.
- Actions per conflict:
  - `Flytta` — opens the time editor pre-scoped to the movable booking, with **suggested free slots** for the same assignees.
  - `Omfördela` — assignee picker filtered to available people with a matching arbetsroll; shows each candidate's load (Beläggning data).
  - `Justera` — open the booking editor (shorten/split/change scope).
  - `Acceptera konflikt` — required reason; the conflict is marked accepted (not deleted) and drops out of the default queue (filter `Visa accepterade`) (UXB-A10).
- Every resolution records outcome + actor + timestamp on the booking's history (`Händelser`), and notifies affected assignees ("din bokning har flyttats") via E13.
- Recurrence interplay: the resolver acts on occurrences; resolving one shows a notice if sibling occurrences carry the same conflict, with `Åtgärda hela serien` where the same fix applies.
- Empty state is a feature: "Inga konflikter" with last-checked recency.

### 4.7 Time reporting (E15)

- **Filing (Montör-first, FR90):** from a booking card (`Min dag`, booking detail) → `Rapportera tid`, pre-filled from the booking's times and job connection; adjust start/end or hours, optional note; submit. Also creatable standalone from `Tidrapporter` (`Ny tidrapport`, pick job/booking optionally — PB-D12).
- **Personal timesheet:** `Tidrapporter` for a Montör = own week list: day rows with reported hours, booking/job chips, and **missing-day indicators** for weekdays with bookings but no report (nudge, not enforcement; a producer sends the reminder via E13).
- **Review surface:** for Projektledare/Admin, `Tidrapporter` = team view filterable by person/job/week, with per-job and per-person sums. Rows open a review sheet (report vs booked time delta highlighted). **Approval semantics are deliberately open** (PB-A9): the surface ships with review/annotate affordances; a hard approval state lands only if architecture/owner define one — the layout reserves a status column so adding it is additive.
- Reported time flows onward without re-entry (FR92): visible in the job Ekonomi tab (hours × role rates — **valued amounts render only for entitled roles per the N-4 seed; a Montör's own time report shows hours, never money**) and later billing basis (E26).
- Phone posture: filing must be a ≤30-second, one-hand interaction (§4.8); the review surface is desktop-weighted.

### 4.8 The field-worker experience (Montör on a phone) — **connected responsive web (ADR-B009, 2026-09-03)**

**`Min dag` (`/my-day`) — the Montör landing:**

- Today header (date, week nav by swipe/arrows).
- **Dagens bokningar:** cards in time order — time range, job/kund + address (address links to the phone's map app), assignees, description. Primary card action: `Öppna jobbet`. Secondary: `Rapportera tid`.
- **Mina jobb** section (FR93): active jobs where the user is member/assignee — name, kund, status, my role on it; opens the job workspace in its field shape.
- Notification chips surface schedule changes prominently (a moved booking today/tomorrow is banner-level).
- Pull-to-refresh; content-first (no dashboard widgets, and **no money at all** — N-4 confirms Montör receives no sales price, cost price, or contribution margin; the values are absent from the payload, not masked in the UI).

**Job workspace, field shape (§4.9 on a phone, Montör permissions):**

- Reduced tab set as a **bottom tab/action bar** within the job: `Översikt` · `Dagbok` · `Foton` · `Avvikelser` · `Material` · `Mer` (chat, filer, egenkontroller when active). Ekonomi/Rapporter/Risker tabs simply don't exist for the role (§3.2 rule 5).
- **Capture ergonomics (the gloves-and-daylight rules):**
  - Primary capture actions are sticky bottom buttons ≥48px, thumb-reachable, labeled with icon+text.
  - `Foton`: camera-first — tapping opens capture directly (gallery pick secondary); after capture: optional caption, auto-attach to the job (and to a dagbok entry when initiated from one); multi-shot flow ("ta fler").
  - `Dagbok`: one-thumb entry — big text area, date pre-filled, optional photo attach; entries render author + timestamp (FR104).
  - `Avvikelser`: structured quick-form — title, description, optional photo(s), severity `[oracle-check for legacy severity levels]`; submission confirms visibly and notifies the job's Arbetsledare/PL via E13.
  - `Material`: quick usage logging — search own articles, quantity steppers (big +/- targets), unit displayed; requests (`Materialförfrågan`) as a separate small form routed to the responsible role (FR100).
  - Time reporting per §4.7 — reachable from the job and from `Min dag`.
- **Daylight/contrast:** field surfaces respect the AA floor with preference for high-contrast pairings on primary actions and status text (§10); no information carried by thin color differences alone.
- **Connectivity honesty:** capture requires a connection. A failed or disconnected attempt retains suitable unsent input where practical, explains that it has **not** been submitted, and offers explicit retry. §4.8A is the connected-field contract.
- Least-privilege reminder: everything above is served scoped to the user (my bookings, my jobs, my reports); the server rejects out-of-scope reads regardless of UI (FR72; Journey B1's "the server, not the UI, stops him").

#### 4.8A Connected field UX contract (ADR-B009; supersedes ADR-B007)

**Connection required.** Every field read and write requires connectivity. If content is unavailable because a request cannot reach the server, the page says `Anslutning krävs` and provides a useful next action; it does not silently substitute stale content or imply that work can continue offline.

**Transient protection, not submission.** Active edits stay in component state. Suitable non-secret text/number drafts may also be retained in `sessionStorage` for the current tenant, user, entity, and form. Pending photo bytes may remain in memory while the page is alive. These mechanisms protect against a failed request or accidental in-session navigation; they do not create a durable device record, queue, or promise across tab close, logout, browser eviction, or device restart. The UI calls retained input an **unsent draft**.

**Current state vocabulary:**

| State | User-facing meaning |
| --- | --- |
| `Editing / Utkast ej skickat` | Input exists only in the form/session; it is not stored in the system. |
| `Connection required / Anslutning krävs` | The server cannot currently be reached; no submission occurred. |
| `Submitting / Skickar` | A live request is in progress; prevent accidental duplicate clicks. |
| `Submission failed / Kunde inte skickas` | The request was not confirmed; keep suitable input and offer `Försök igen`. |
| `Uploading / Laddar upp` | Photo/file transfer is in progress; the record is not complete until confirmed. |
| `Upload failed / Kunde inte laddas upp` | Keep the in-memory selection where practical and offer retry while stating its lifecycle limits. |
| `Submitted / Sparad i systemet` | The server confirmed persistence. This is the only success state. |

The superseded ADR-B007 taxonomy (`SavedLocally`, `WaitingForSync`, `Syncing`, `Synced`, `Conflict`, `Failed`) is historical and must not appear as an active Phase B field-state model.

**Retry behavior.** Retry is always explicit. It resubmits through the ordinary authenticated server command, which re-checks membership, permissions, validation, RLS, and current record state. There is no local queue, automatic reconnect replay, app-open/foreground replay, background synchronization, or global “changes waiting” counter.

**Honest lifecycle limits.** When a photo selection or suitable draft cannot survive a reload/close, warn before destructive navigation where feasible and explain what remains unsent. Clear retained drafts after server-confirmed success and on logout where controlled. Never store access tokens, secrets, signature evidence, or server-only/withheld values in client draft storage.

### 4.9 The job workspace (E16–E18) — **model resolved by ADR-B006 (2026-07-26)**

**Shell contract:** the workspace binds to **one job container id** and renders header + tab set. The contract was written model-agnostically and **the chosen model confirms it unchanged** — ADR-B006 landed Jobb-as-container implemented as one typed entity (`type ∈ {order, projekt}`), so there is one container, one id, and one workspace. The Option B divergence (an `Ingående jobb` aggregate tab) **is not built**. The header's type semantics resolve to: a type badge (`Jobb` / `Projekt`) and an `Uppgradera till projekt` action on `type='order'` that states which features the upgrade unlocks before committing — and does not offer a downgrade, because the upgrade is one-way.

**Header:** title, type badge (`Order`/`Projekt`), status, kund + anläggning + kontakt chips (per owner rule `1.5`), Projektledare + `Arbetsledare` (job-scoped role, assigned here — picker among job members, FR95), planned start/end, budget vs upparbetat mini-bar (**absent entirely for Montör and for Arbetsledare by default** — N-4), primary actions: `Boka` (pre-connected booking), `Rapportera tid`, `Markera som klar`, overflow (`Uppgradera till projekt`, shown on `type='order'` only — the upgrade is one-way, so no downgrade action exists).

**Tab set** (full set; per-tab visibility = permission matrix × module activation; on narrow viewports: priority tabs + `Mer` overflow; Montör field shape per §4.8):

| Tab | Content (summary) | FR |
| --- | --- | --- |
| `Översikt` | Status, connections, next bookings, latest activity, open items (deviations, requests), member list with per-job roles | FR93–FR95 |
| `Arbetsorder` | Work-order list/cards: title, status, assignee(s); create/edit; each opens a work-order pane with its own description/status/files | FR96 — `work_orders` as children of the container, present on both `Jobb` and `Projekt` (ADR-B006) |
| `Schema` | The job's bookings (list + mini-timeline); `Ny bokning` pre-connected | FR84, P25 |
| `Material` | Usage log (who/what/qty/when) + `Materialförfrågningar` with request status | FR100 |
| `Ekonomi` | Rollup: budget (from accepted quote where connected), reported time value, material, other costs; budget-vs-actual; payment plan on projekt scope | FR101–FR102 — money per the N-4 seed (tab hidden for roles that would see only locks); the payment plan attaches to the container and is DB-bound to `type='projekt'` (ADR-B006 §8.3) |
| `Dagbok` | Chronological diary entries (author, timestamp, attachments) | FR104 |
| `Avvikelser` | Deviation list with status (open/closed), severity, photos | FR104 |
| `Foton` | Photo grid, capture-first on phone; photos taken in Dagbok/Avvikelser appear here too (one pool, contextual links) | FR104 |
| `Chatt` | Job-scoped message thread (members only; mentions notify via E13) | FR104 |
| `Risker` | Simple risk register rows (description, severity, owner, status) | FR104 |
| `Rapporter` | Export/report generation from job data (PDF exports; report types deepen per oracle) | FR105 |
| `Filer` | Entity file panel (frozen Phase A pattern, owner_type=job) | P54 seam |
| `Händelser` | Audit/event timeline incl. completion event, upgrades, resolutions | carried |

**Completion (FR106):** `Markera som klar` → confirmation dialog that **shows the downstream effects before commit**: "skapar garantibevakning (service), erbjuder DoU-paket" (consumers listed only when their modules are active; the event fires regardless from B1b). After completion: status `Klar`, field tabs become read-only-with-notice, the completion event is prominent in `Händelser`, and (when E27 is active) a `Skapa DoU-paket?` offer card appears once, dismissable.

**Model divergence notes (for the ADR-B006 outcome):**

- **Option A / C (container + typed upgrade — team recommendation):** one list at `Jobb`; `Uppgradera till projekt` is a header action with an audited confirm ("lås upp projektfunktioner: betalningsplan, fördjupad ekonomi, medlemsroller"); the tab set is constant, with Ekonomi gaining the payment plan section on projekt scope. **This spec's screens are drawn for this shape.**
- **Option B (flat + grouping):** `Jobb` list gains a sibling `Projekt` list; a projekt workspace reuses the same shell with one additional tab `Ingående jobb` (child list + aggregate Ekonomi); the per-job workspace is unchanged. No other surface in this spec changes.
- Either way, **bookings created against Phase A basic jobs before E16 deepen seamlessly** (PB-D12) — the workspace renders whatever depth exists; missing modules simply contribute no tab.
- The `7.3` job-card field list is **answered** (arch §8.4). The create/edit form carries the identity and planning fields (title, type, status, kund, anläggning + kontakt, PL/Arbetsledare, planned dates, budget from the accepted quote where connected, description) **plus the N-9 scheduling inputs**: estimated duration, earliest start, desired and latest end dates, priority, number of people, competence/certification requirements, location, dependencies on other work items, travel time, whether the customer must be present, and access/time windows. That is a long form — it needs progressive disclosure (identity first, scheduling detail in a second group) rather than one flat column, and the two set-valued fields (dependencies, access windows) are repeatable rows.

### 4.10 Operational dashboard v1 (E19)

- **One dashboard** (`/dashboard`), a responsive widget grid (12-col desktop, stacking to 1-col). **Widgets derive from a registry traceable to the scope manifest** (FR107, PB-D7): a widget exists only when its producing module is active — the grid grows per wave, never shows placeholders or "coming soon".
- **v1 widget set (B1 data only, PB-A11):**

| Widget | Content | Source | Roles (default) |
| --- | --- | --- | --- |
| `Offertpipeline` | Skickade/Accepterade/Förlorade counts (period), hit rate | E10/FR65 | Företagsadmin, Säljare, PL — amounts per the N-4 seed |
| `Uppföljningar` | Due today / overdue list, quick complete | E10 | Admin, Säljare |
| `Veckans bokningar` | Next bookings (mine vs team toggle per role) | E14/E15 | All |
| `Konflikter` | Open conflict count by type → resolver | E14 | Admin, PL |
| `Aktiva jobb` | Jobs by status, recently active, jobs missing planned dates | E16 | Admin, PL |
| `Tidläget` | Reported vs expected hours this week (team for PL, own for others) | E15 | Admin, PL |

- **Role-default layouts, no user customization in v1** (UXB-A12): each role gets a sensible default arrangement (§3.1 weighting); widget-level permissions follow module permissions and the money mechanism (FR108, §3.2). Montör does not land here (`Min dag` instead) but may open it if granted.
- Every widget: title, content, one primary deep link, empty state with meaning ("inga förfallna uppföljningar"), loading skeleton, error state with retry, and freshness stamp where fed by background producers.
- Later waves add widgets with their epics (service due, expiries, billing-basis status, Fortnox export health) at the wave checkpoint — pattern §5.

## 5. Wave B2/B3 Pattern-Level Specifications

> Pattern-level only (PB-D10): each module below is bound to the shared conventions in §5.1 plus its named deltas. Screen-by-screen detail is produced at the wave-boundary checkpoint that expands its coarse FRs.

### 5.1 Shared module conventions (the B1 inheritance)

Every B2/B3 module inherits, by default:

1. **List page:** toolbar (search, filters as chips, saved filter state), status badges (text+icon), primary action `Ny <entitet>`, archive filter (`Visa arkiverade`), empty/loading/error states per §7. Dense table desktop, card list narrow.
2. **Detail page:** record header (identity, status, connection chips, primary actions) + tabs — always ending with `Filer` and `Händelser` (Phase A patterns); module tabs in between.
3. **Archive-over-delete** everywhere (Phase A invariant): archive with confirm + reversible restore; hard delete never offered in normal UX (P55).
4. **Connections** per §2.4 (standalone-creatable + connectable; "skapa och koppla").
5. **Role gating** per §3 (hidden-not-disabled; masked-money mechanism).
6. **Immutability/locking** where customer-visible or committed (billing basis, DoU locks) reuses the announced-lock pattern (§1 principle 5) and the audited-correction language from Phase A.
7. **Background-producer honesty:** any "due/overdue/suggested" queue shows last-scan recency (ADR-B002 consumers).
8. **Imports/exports** use the wizard pattern: upload → parse/validate → review report (errors named per row, nothing silently skipped) → explicit commit; failures leave no partial state visible as success.

### 5.2 Module deltas (one paragraph each)

- **Documents center (E20):** `Filer` becomes `Dokument` — a global, searchable index over all active modules' entity-scoped files (PB-D6): filter by module/owner-type/purpose/date, preview pane (signed URLs), archive/restore per P55. It is an **aggregation view**; upload still happens in entity context (frozen Phase A panels). No folder tree — filters and owners are the structure (UXB-A13).
- **Rentals (E21):** register list + item detail; **`Snabbuthyrning`** as a fast-path dialog from the list (item, kund, period → order); rental orders (incl. grouped) with lifecycle (reserved → out → returned), delivery-note and return sub-flows producing PDF documents (`Följesedel`, `Retur` `[oracle-check]`); history tab per item; `Duplicera` action; billing records visibly "väntar på underlag" until consumed by E26.
- **Assets + QR (E22):** register (vehicles/tools/equipment) with assignment chips (person, via the single resource record), events timeline (service/inspection/insurance), fault reports, mileage log, documents; `Skriv ut etikett` (QR/label PDF). **Public QR page:** a stripped, unauthenticated layout — minimal asset identity, no tenant navigation or enumeration, one action (felanmälan form: description, photo, contact optional), rate-limit + abuse posture per `[ADR-B004]`; submissions land as fault reports + notifications. Proactive scan results surface as notification-fed queues with recency stamps.
- **Service + warranties (E23):** service records/plans/agreements lists; a **due/overdue queue** (`Förfaller`) fed by the authenticated scan; **suggestion inbox** — each suggestion: context, snooze, dismiss-with-reason, or `Skapa jobb` (pre-connected job creation); warranties are created by job completion events (visible provenance link back to the job) with expiry tracking + notifications.
- **Electrical panels (E24):** panel register + detail; the **gruppförteckning is a dense editable grid** (rows = groups/circuits, columns per legacy schema incl. RCD data `[oracle-check]`) with bulk edit, duplicate, and print/PDF export tuned for the standardized printed artifact. Manual core only — no image import affordance exists (Phase C).
- **Supplier data + imports (E25):** supplier register, price lists, discount agreements; **price-list file import** via the §5.1 wizard pattern (deterministic formats; per-row error report; re-import shows diff summary before commit); supplier articles become selectable as calc-row pricing sources (extends the frozen Phase A source-picker with a supplier scope; snapshot-on-select semantics unchanged).
- **Billing basis (E26):** Ekonomi-facing **assembly workbench**: pick scope (kund/jobb/period) → candidate lines from jobs (time, material, fixed price, payment-plan items, and other billable items — the per-kind content is defined in N-5 / arch §7.3), rentals, service → review with per-line include/exclude → `Justera` requires an audited reason → **approve**, with the announced-lock pattern (immutability consequence stated; corrections only via audited path, FR118) → export. **Status flow (N-5): `Draft → UnderReview → Approved → Exported → PartiallyInvoiced → Invoiced → Cancelled`**, replacing the earlier `Utkast → Låst → Exporterad` sketch — the workbench therefore needs a review state before approval and must show the basis **version**, since an Approved version can only be changed by reopening or replacing it. A consumed source item is visibly locked against double invoicing. The correctness banner now ties real-invoicing use to **Story 10.6 landing the ratified money rules** (arch §12A) rather than to an unanswered gate — demo track unaffected.
- **DoU (E27):** DoU projects list; project detail = folder/document tree + template picker (discipline templates; content owned by the designated content owner per N-8, surfaced as a **content-owner and approver attribution on every published template version** — never an anonymous template), upload/import, versioning + lock states per document, material-list sync status, `Exportera paket` (the contractual deliverable); `Skapa från jobb` seeds structure from a completed job (FR106 consumer).
- **Self-inspections (E28):** template-driven **form runner** — sections → items → measurements/attachments — designed to run in the field shape (§4.8 ergonomics; assignable to Montör); manual creation, export to the standardized document; linkable to kund/anläggning/jobb/DoU. Template content ownership and approval attribution per N-8, as for DoU. An in-progress document stays bound to the template version it was created from even after a newer version is published.
- **Tenders/FKU thin core (E29):** upload files/ZIP (auto-unzip) into organized storage; manual summary fields; manual conversion links to kalkyl/offert/jobb/DoU/egenkontroll. **Deliberately thin** — the UI must not promise analysis; an owner-visibility note accompanies the surface. **Owner accepted the thin slice as Phase B parity (N-7, 2026-07-26).** No AI affordances (Phase C).
- **KNX (E30):** group-address projects with rooms/functions/address tables — the panels-style dense grid pattern, small scope.
- **HR depth (E31):** extends the **same person record** (PB-D13 — no parallel employee UI): the person detail (reached from Användare or Personal) gains HR tabs (anställning, kompetenskort, certifikat, utbildningsplaner, dokument) with expiry-driven notifications; incident reports + HR inbox as a queue surface; **`Min sida`** = employee self-service (own profile, bookings, assigned assets, documents, suggestion box — authenticated, P70 thinned); GDPR deletion-request flow as a formal request → status tracker over the N-10 states (`Received → IdentityVerificationRequired → UnderAssessment → PartiallyApproved | Approved | Rejected → Executed → Closed`), showing what will be deleted, what must be retained and why, any `LegalHold`, and the response deadline. **Ordinary tenant admins get no hard-delete affordance at all** — deletion is the workflow's, not the admin's (arch §12B). Salary-adjacent fields ride the §3.2 masking mechanism against the N-4 seed.
- **Notes/notice board (E32):** tenant-wide feed with categories, pinning, archive; @mentions notify via E13; simple editor, no rich document ambitions.
- **CRM & calc completions (E32):** customer 360 tab on the frozen customer detail (aggregated cross-module context), favorites (star + filter), classification tools, duplicate-calculation action, quote-settings/branding completions — all deltas on frozen Phase A surfaces.
- **Fortnox (E33/E34):** connection settings under `Inställningar` (per-tenant status: `Ansluten/Ej ansluten/Fel`, connect/disconnect — OAuth entirely server-side, no tokens ever displayed, NFR50); `/fortnox` export surface = **outbox pattern**: export runs list → per-record rows (kund/artikel/fakturaunderlag) with status (`Köad → Skickad → Fel`), per-record error detail in plain language, `Försök igen` per record and per run, and filter `Endast fel`. Status/error/retry UX is the module's core, not an afterthought (FR128).

## 6. Component Patterns (behavioral contracts, new in Phase B)

| Component | Behavioral contract |
| --- | --- |
| `MaskedValue` | Renders withheld sensitive fields per §3.2: lock glyph + `Dold`, tooltip/long-press explainer, SR text "Dolt för din roll". Never renders 0/empty for withheld. |
| `StatusBadge` (extended) | Text+icon, tone by family (neutral/progress/success/terminal/warning). New statuses registered per module; terminal states (Förlorad/Avböjd, Låst, Klar) visually distinct from active ones. |
| `ConnectionChip` | Entity link chip (type icon + label); consistent across all modules; overflow gracefully; tap target ≥44px. |
| `BookingBlock` | Calendar block: time, assignees (avatars+names), connection chip, work-role tint + icon (never tint alone), conflict glyph slot; drag/resize on pointer devices with full keyboard/dialog equivalent (§10). |
| `ConflictPanel` | Inline list of violations (type, who, when, mini-timeline); used identically in the booking editor and the resolver detail. |
| `RecurrencePreview` | Deterministic next-N occurrence list with per-occurrence conflict glyphs; always shown before committing a series. |
| `SideSheet` | Standard create/edit container: desktop side panel, phone full-screen; focus-trapped, ESC/back closes with dirty-state guard ("osparade ändringar"). |
| `Wizard` | Linear steps with progress, resumable, explicit commit step; used by provisioning, imports, (later) Fortnox connect. |
| `WidgetCard` | Dashboard unit: title, content, one deep link, empty/loading/error/freshness states built-in; registry-driven (§4.10). |
| `NotificationItem` | Icon by category, one-line text, relative time, unread state, deep link; identical in popover and center. |
| `QueueList` | "Things needing action" pattern (conflicts, suggestions, follow-ups, due service, HR inbox, export errors): count chip, grouped list, per-item actions, empty-state-with-meaning, freshness stamp. |
| `CaptureButton` | Field capture entry (photo/diary/deviation): sticky bottom placement on phone, ≥48px, icon+label, opens capture directly. |
| `AuditTrail` (`Händelser`) | Chronological event list on every record detail (carried from Phase A); Phase B events include resolutions, overrides, upgrades, locks, exports. |
| `LockConfirmDialog` | The announced-lock pattern: states what becomes immutable, what the escape hatch is (new version / audited correction), requires explicit confirm. Reused: quote send (frozen), billing-basis lock, DoU lock. |
| `EffectivePermissions` | Read-only module × capability grid for a user/role, server-derived, grouped by module with granting role annotated. |

## 7. State Patterns

Carried in full from the frozen Phase A spec §9 (validation placement, blocking-vs-warning separation, plain language, no color-only, preserve unsaved data, lifecycle/immutability error explanations, generic cross-tenant denials). Phase B additions:

| Area | Required states |
| --- | --- |
| Scheduling | Empty week ("inga bokningar"), conflict-present, conflict-accepted, past-vs-future visual distinction, deactivated-assignee flag, recurrence-exception marker, DST-boundary rendering sanity (Europe/Stockholm, NFR48). |
| Booking editor | Live-conflict warning, `Boka ändå` acknowledgment, series-vs-occurrence edit scope prompt, dirty-state guard. |
| Time reports | Missing-day nudge, submitted, reviewed/annotated (approval state reserved, PB-A9), delta-vs-booking highlight. |
| Field capture | Saving, saved-confirm, transient-failure with data retained + `Försök igen` (never silent loss), photo upload progress, oversized/blocked file (Phase A file states carried). |
| RBAC/admin | `Inbjuden/Aktiv/Inaktiverad`, invite expired, revoked, last-admin protection ("minst en Admin krävs"), permission change applied-immediately notice. |
| Provisioning/onboarding | Wizard resumable state, already-provisioned (idempotent re-run), checklist auto-check, checklist dismissed-but-incomplete reminder. |
| Notifications | Unread/read, category-muted, email-column inactive `[N-6]`, producer-freshness stamp, empty ("inga notiser"). |
| Masked/entitlement | Withheld field (§3.2), withheld aggregate, surface hidden for role — plus the generic denial page for direct navigation (FR72). |
| Dashboard | Per-widget skeleton/empty/error/retry; a failed widget never blanks the grid. |
| Background producers | Last-scan recency, scan-failure surfaced to Admin (NFR47 visibility), "queued/not yet sending" email posture pre-`[N-6]`. |
| Locks & exports | `Utkast → Låst → Exporterad`, lock-blocked edit explanation with correct next action, per-record export `Köad/Skickad/Fel` + retry (Fortnox pattern), partial-failure honesty (per-row error reports). |
| Public surfaces | QR page: valid, revoked-token ("etiketten är inte längre aktiv"), rate-limited, submitted-confirm; unsubscribe: confirmed, already-unsubscribed, invalid token — all minimal, no tenant enumeration `[ADR-B004]`. |

## 8. Interaction Primitives

- **Direct manipulation with parity:** every drag interaction (booking move/resize) has a full non-drag equivalent (select → edit in dialog/sheet) — required for keyboard, touch precision, and gloves (§10).
- **Optimistic UI is limited to reversible, low-stakes actions** (mark-read, favorites, collapse state). Money, lifecycle, locks, and bookings confirm server-side before rendering success (principle 4).
- **Undo where safe, confirm where not:** archive offers undo-toast; lifecycle commitments (send, lock, complete, förlorad) use `LockConfirmDialog`-style explicit confirms — never undo-based.
- **Deep-linkability:** every list-filter state, record, tab, and queue item has a stable URL (notifications and dashboard links depend on it).
- **Keyboard:** global nav and all toolbars/tabs/sheets keyboard-operable (carried); scheduling adds arrow-key navigation across the grid and Enter-to-open.
- **Long operations** (PDF/package export, imports, provisioning): progress states with completion notification via E13 when the user has navigated away.

## 9. Voice, Tone, and Terminology

- **Microcopy:** operational, concise Swedish; verbs on buttons (`Boka`, `Rapportera tid`, `Lås underlag`); consequences stated before commitment; errors say what happened and what to do next; no developer jargon (carried from Phase A).
- **Route names and identifiers stay English**; UI labels Swedish (Phase A convention).
- **The legacy app is the terminology oracle** (PRD §5 vocabulary is binding). Labels introduced by this spec, with oracle status:

| Concept | UI label | Status |
| --- | --- | --- |
| Scheduling module | `Planering` | PRD §5-consistent |
| Booking / recurring | `Bokning` / `Återkommande bokning` | PRD §5 |
| Conflict | `Konflikt` | PRD §5 |
| Time report | `Tidrapport` | PRD §5 |
| Work order | `Arbetsorder` | PRD §5 |
| Job/project container | **`Jobb`** — a projekt is an upgraded jobb, not a sibling entity (ADR-B006); `Projekt` appears as a type badge, not a separate nav item | `[oracle-check]` on casing/vocabulary only |
| Diary / deviation / photos / risks | `Dagbok` / `Avvikelse` / `Foton` / `Risker` | PRD §5 / P28 |
| Billing basis | `Faktureringsunderlag` | PRD §5 |
| Notifications | `Notiser` | UXB choice `[oracle-check]` |
| Users & roles | `Användare & roller` | UXB choice |
| Rentals / delivery note / return | `Uthyrning` / `Följesedel` / `Retur` | `[oracle-check]` |
| Assets | `Utrustning` | `[oracle-check — legacy may say Fordon & utrustning]` |
| Panels / circuit schedule | `Elcentraler` / `Gruppförteckning` | Gruppförteckning per PRD §5; module label `[oracle-check]` |
| Documents center | `Dokument` | UXB choice |
| Self-inspection | `Egenkontroll(er)` | PRD §5 |
| Tenders | `Anbud (FKU)` | `[oracle-check]` |
| Notice board | `Anslagstavla` | `[oracle-check]` |
| My day / my page | `Min dag` / `Min sida` | UXB choice; `Min sida` matches legacy P69 |
| Lost/declined | `Förlorad/Avböjd` | Owner status set `4.3` |

Role names (**Företagsadmin**, Projektledare, Montör, Säljare, Ekonomi, Arbetsledare) are the owner's confirmed labels (N-4, 2026-07-26) and remain label-swappable — the stored literal for the admin role is still `tenant_admin` (PB-A7; arch §3.2).

## 10. Accessibility Floor

The Phase A floor (frozen spec §10; NFR30) carries in full: keyboard operability everywhere, accessible names on icon controls, label/error association, predictable focus on dialogs/sheets, text-not-color-only status, readable density, no precision-drag requirements for core work. Phase B additions:

- **Touch targets:** ≥44px minimum, ≥48px for field primary actions (gloves); adequate spacing between destructive and primary actions.
- **Contrast:** WCAG AA minimum everywhere; field-surface primary actions and statuses target AAA-ish contrast where feasible (daylight readability); never rely on tint alone in scheduling blocks or capacity cells (icon/number always present).
- **Drag parity:** scheduling drag/resize has keyboard + dialog equivalents (§8); conflict resolution fully operable without pointer.
- **Live updates announced:** conflict warnings, save confirmations, and notification arrivals use polite live regions; badge counts have SR text.
- **Camera/photo flows:** capture and review operable with SR; captions attachable; photo grids expose meaningful alt/labels (date, job, author).
- **Forms in the field:** large inputs, numeric keyboards for quantities/hours, no time-entry that requires precision sliders.
- **Public pages** (QR, unsubscribe): same floor applies; minimal, language-clear, no login walls for their single purpose.
- **Viewport floor:** connected field-worker flows are usable at 360×640 upward (NFR31/NFR53, ADR-B009); desktop surfaces are usable from common laptop widths (carried); scheduling views degrade gracefully (Schema → agenda list on phone; Beläggning is desktop-weighted with a phone summary).

## 11. Responsive and Platform Strategy

| Surface family | Phone (≤640) | Tablet | Desktop |
| --- | --- | --- | --- |
| Field surfaces (`Min dag`, job field shape, capture, time filing, egenkontroll runner) | **Primary** — bottom actions, single column, camera-first | Supported | Supported (same components, more air) |
| Scheduling `Min kalender` | **Primary** (agenda) | Grid | Grid |
| Scheduling Schema/Resurser/Team | Agenda/read + create via sheet | Usable grid | **Primary** |
| Beläggning, Tidrapporter review, dashboard, admin, provisioning, billing workbench, imports, Fortnox | Readable summary, no complex editing promised | Usable | **Primary** |
| Lists/details (all modules) | Card lists, stacked detail | Hybrid | Dense tables, side panels |

Rules: one breakpoint system (Tailwind defaults) app-wide; sidebar → icon rail → drawer (carried); tables switch to cards only when genuinely necessary (carried); sticky summaries become inline blocks on narrow (carried). No user-agent branching — viewport + capability only.

**Platform posture (owner course correction 2026-09-03 — ADR-B009):** Phase B is a browser-delivered responsive web application. Field surfaces are phone-first at 360×640 and require connectivity. Phase B provides no PWA installation/manifest, service worker, durable offline store, offline read/write, local operation queue, replay/synchronization/offline-conflict model, or background/reconnect-driven synchronization. The 2026-07-26 N-3 answer and ADR-B007 remain historical; **no native app** is designed in Phase B.

**Quote correction delta (ADR-B008; Stories 10.8/10.9):** review confirmation states that the authenticated user attests to the server-validated content; it must not imply that a click proves attention. The confirmation expires after 15 minutes and becomes stale after source, attachment, or customer-visible changes. Customer-visible draft edits mark the PDF outdated and send is unavailable until a current PDF is generated. PDF-byte attestation is a separate server-only security boundary, with no extra user secret, token, or client bypass. A successor starts with eligible predecessor attachments preselected; archived/ineligible attachments are omitted with a warning and selection remains editable. Green fixed-price entry states “gross including VAT before 97%”; mixed ROT/green requires separate allowances, insufficient allowance blocks, and reverse charge clears/disables deductions.

| Capability | Phase B posture | Failure protection |
| --- | --- | --- |
| Field surfaces (`Min dag`, job field shape, capture, time filing, checklists/egenkontroller, deviations, photos) | **Connectivity required**, responsive from 360×640 (§4.8A) | Suitable unsent form/session state, in-memory photos where appropriate, explicit failure/retry, server-confirmed success |
| Everything else — dashboard, scheduling planning views, admin, provisioning, economy, billing workbench, imports, Fortnox, settings, user administration | **Connectivity required** | Existing request failure/retry patterns; never silently show stale content as current |

Two rules apply app-wide: browser/network hints may improve messaging but **only the request result establishes persistence**, and a locally retained draft never receives an unqualified success message. `Sparad i systemet` appears only after server confirmation.

## 12. Key Flows (protagonists per PRD §4 journeys; climax beats marked)

**Flow 1 — Emil (Montör) runs his connected day from the phone (Journey B1).** 1) Emil signs in on his phone `[posture: ADR-B009]`; lands on `Min dag` — two bookings today. 2) Opens the 07:00 booking → `Öppna jobbet`; the job opens in field shape (Översikt/Dagbok/Foton/Avvikelser/Material). 3) Logs material usage with quantity steppers; `Sparad i systemet` appears only after confirmation. 4) **Climax:** the panel differs from the drawing — Emil files an `Avvikelse` with two photos in under a minute. Connectivity drops during submission: the form remains an `Utkast ej skickat`, says `Anslutning krävs`, retains suitable text and in-memory photos while the page remains alive, and offers `Försök igen`; it does not notify the Arbetsledare yet. 5) Connectivity returns and Emil explicitly retries; the server confirms persistence, then the UI shows success and the notification is produced. 6) He writes a dagbok entry and files prefilled time from `Min dag`. 7) Nowhere did Emil see a price, another montör's hours, or a settings page — and a crafted URL gets the generic denial (FR72).

**Flow 2 — Sara (Projektledare) books a crew and resolves the collision (Journey B2).** 1) Sara opens `Planering → Resurser`, next week. 2) Drags across Tuesday for montör #1 → booking sheet pre-filled; adds montör #2, work role `Installatör`, connects the jobb. 3) **The sheet warns live:** montör #2 is double-booked Tuesday, and montör #1 would exceed capacity `[rules: N-9]`. 4) Saves with `Boka ändå` for the capacity case (reason: "kort vecka, OK enligt Emil") — recorded; the double-booking she takes to the resolver. 5) **Climax — the resolver:** conflict selected, both colliding bookings on the mini-timeline; `Flytta` suggests Thursday 08–12 as free; she accepts. Outcome recorded; montör #2 gets "din bokning har flyttats". 6) Sets a recurring service round (every other Friday, ends after 10) — the preview shows all 10 occurrences, one flagged red on v.44; she adjusts before saving. 7) Her calendar app follows her tokenized feed `[ADR-B004]`.

**Flow 3 — Johan (Säljare) closes the loop on a quote (Journey B4).** 1) Dashboard `Uppföljningar` shows one due today; Johan opens it. 2) Calls the customer — they went with a competitor. 3) From the follow-up sheet, `Markera som förlorad/avböjd` → outcome `Förlorad`, category `Pris`, note. 4) **Climax:** the confirm states the snapshot is untouched and the flip is an append-only event — Johan commits; version badge turns terminal; the pipeline widget's hit rate updates. 5) The follow-up auto-completes with the outcome; nothing about the sent PDF changed.

**Flow 4 — Admin invites a new montör (E11).** 1) `Användare & roller → Bjud in användare`; e-mail + role `Montör` (the role card shows what Montör reaches). 2) Row shows `Inbjuden`; audit event visible. 3) New user accepts, signs in on a phone, lands on `Min dag` (empty state: "inga bokningar ännu"). 4) Admin opens the user detail → `Effektiva behörigheter` and verifies exactly the montör surface — money rows show `Dold` per seed `[N-4]`.

**Flow 5 — An operator provisions the second tenant (Journey B5).** 1) Operator console → `Provisionera ny tenant`: företagsuppgifter → baseline → first-Admin invite. 2) The new Admin signs in; `Kom igång` checklist pinned. 3) Works through settings → moms → villkor → arbetsroller → invites five users with roles. 4) **Climax:** all items green — a working tenant, zero engineering steps (AC-B1a-1); nothing they did could read or touch any other tenant (NFR54).

**Flow 6 — Anna (Ekonomi) assembles a billing basis (Journey B6, B2-wave pattern flow).** 1) `Faktureringsunderlag → Nytt underlag`, scope: kund + period. 2) Candidate lines stream in from jobs (time, material), a rental return, a service record `[content: N-5]`. 3) Excludes one line, adjusts another — reason required, audited. 4) **Climax:** `Lås underlag` — the lock dialog states immutability and the audited-correction path; Anna confirms; status `Låst`, then exports. The real-invoicing banner reminds that tax sign-off gates apply `[tax A/B/C + 2.2]`; the demo flow is unaffected.

## 13. Owner-Gate Impact Map (what is designed vs what waits)

| Gate | Surfaces touched here | Designed now | Waits for the gate |
| --- | --- | --- | --- |
| `7.1`/`7.3` → ADR-B006 | Job workspace (§4.9), jobs nav label, job create form | ✅ **Closed 2026-07-26.** Shell confirmed unchanged; nav label is **`Jobb`** (a projekt is an upgraded jobb, not a sibling entity); upgrade is a one-way audited action with an announce-before-commit dialog; job-card fields per arch §8.4. E16–E18 build detail is unblocked. |
| N-2 | Provisioning/onboarding (§4.3) | ✅ **Closed 2026-07-26.** Operator wizard + entry-point-agnostic onboarding confirmed; the wizard gains a **preview-then-approve** step (the agent shows exactly what will be created before an authorised person approves). **No public signup surface is designed — ever.** |
| N-3 | All §4.8 field surfaces, NFR31/NFR53 viewport floor | **Superseded 2026-09-03.** The 2026-07-26 answer selected PWA/offline and remains historical in ADR-B007. Current ADR-B009: connected responsive web at 360×640, transient unsent-draft protection, explicit retry, and server-confirmed success. PWA/offline is Phase C; no native app. |
| N-4 | Every money/sensitive element (§3.2, §4.7, §4.9 Ekonomi, §4.10, HR) | ✅ **Closed 2026-07-26.** Seed supplied: Montör sees no price/cost/margin; Säljare sees sales prices but not contribution margin by default; Arbetsledare defaults to Montör's money posture; Projektledare/Ekonomi/Företagsadmin see all. Also new UX work: a **below-margin warning for Säljare that reveals no cost figures** (arch §3.3A). |
| N-5 | Billing workbench candidate-line model (§5.2 E26) | ✅ **Closed 2026-07-26.** Line content defined per source kind (time/material/fixed price/payment plan/other); the lock flow becomes a **versioned status flow** `Draft → UnderReview → Approved → Exported → PartiallyInvoiced → Invoiced → Cancelled`, with Approved locked against edits (arch §7.3). |
| N-6 | Notification preferences e-mail column, email touchpoints (§4.4) | ✅ **Closed 2026-07-26.** Sender shows as `[Företagsnamn] via [Systemnamn]` with the tenant's own Reply-To; flow priority and the five automatic reminder-stop conditions defined; invoices come from Fortnox, not from us (arch §4.6). |
| N-7 | Tenders thin core (§5.2 E29) | ✅ **Closed 2026-07-26** — owner accepted the thin manual slice as Phase B parity; AI analysis explicitly Phase C. |
| N-8 | DoU/egenkontroll templates (§5.2 E27/E28) | Template-driven runner/ingestion UX | Real template content |
| N-9 | Conflict/capacity rules (§4.5 Beläggning, §4.6 checks) | Conflict surfacing, resolver, capacity view shells | Exact work-hours/capacity/holiday rules the checks encode |
| N-10 | HR deletion-request flow (§5.2 E31) | Request → status-tracker pattern | Retention posture |
| Tax A/B/C + `2.2` | Billing basis correctness banner (§5.2 E26) | Demo-track UX | Real-invoicing enablement |
| ADR-B002/B004 (team ADRs, not owner) | Freshness stamps; public QR/unsubscribe/calendar-feed patterns | Patterns + states | Token/runner mechanics per ADR |

## 14. Open Items for the Architecture Stage

1. **Entitlement/field-presence contract** (§3.2): how payloads mark withheld-vs-empty so `MaskedValue` and column omission are deterministic — and how the permission matrix drives the nav registry and per-tab visibility (one derivation, NFR43/NFR51).
2. **Nav registry representation:** groups/items/permissions derived from the scope manifest (ADR-B003) so the manifest validator traces every nav item (§2.1); includes the `Filer` → `Dokument` transition at E20 activation.
3. **Conflict semantics:** the override/accept model (UXB-A10) — is `Boka ändå` an audited state on the booking? Conflict identity across recurrence occurrences; suggested-slot computation; phantom/missed conflict test surface (NFR48).
4. **Recurrence editing semantics:** occurrence-exception storage and "this and following" behavior consistent with deterministic expansion (FR88).
5. **Time-report review/approval:** whether a hard approval state exists (PB-A9); the reserved status column awaits it.
6. **Per-role landing resolution** (§3.1): route-level redirect logic (Montör → `/my-day`) under the same server-side authorization.
7. **Operator console placement:** hosting/auth for the platform-operator area outside tenant context (§4.3; NFR54).
8. **Notification producer registry → category taxonomy** (§4.4): category identity, per-user preference storage, non-disableable classes, deep-link contract (ADR-B002 adjacency).
9. **Dashboard widget registry** (§4.10): manifest-traceable widget list + role defaults (FR107/108).
10. **Calendar-feed token UX mechanics** (§4.5): create/rotate/revoke affordances bound to ADR-B004's entropy/rate-limit/revocation rules.
11. **Public QR page isolation** (§5.2 E22): layout/app-shell separation for unauthenticated surfaces, no tenant enumeration (ADR-B004).
12. **Job-workspace tab data contracts** — ✅ resolved: ADR-B006 landed the typed single container, the §4.9 shell contract holds unchanged, and Option B's `Ingående jobb` aggregate is not built.
13. **Field capture persistence** (§4.8/§4.8A) — ✅ current ADR-B009: component state, suitable minimized `sessionStorage` drafts, and in-memory photo retention protect transient failures; explicit retry and server confirmation govern success. No durable store/queue/replay exists in Phase B; ADR-B007 is history and the full capability is Phase C.
14. **Oracle terminology pass:** resolve every `[oracle-check]` label against the legacy app (legacy-oracle-explorer task) before the relevant epic's first story.

## 15. Assumptions Register (autonomous run record)

| ID | Assumption / judgment call | Status |
| --- | --- | --- |
| UXB-A1 | Single-file spec (this document) rather than the DESIGN.md + EXPERIENCE.md pair: project convention is single-file planning artifacts with `-phase-b` suffix, Phase A explicitly excluded visual-design-system work, and Tailwind `@theme` remains the token source. This is an experience spec; a DESIGN.md can be introduced later without invalidating it. | accepted for spec |
| UXB-A2 | Depth split follows the caller/PRD handoff exactly: §4 detailed = B1a+B1b; §5 pattern-level = B2/B3, deepened at wave checkpoints (PB-D10). | accepted |
| UXB-A3 | Grouped-sidebar IA with manifest×matrix derivation (§2) is the team answer to PRD §15.1's "how nav grows beyond seven items"; exact grouping is checkpoint-adjustable without changing the rule. | accepted; architecture validates derivation |
| UXB-A4 | Hide-don't-disable for unauthorized/inactive nav (no teaser items) — least-privilege clarity outweighs discoverability inside a tenant. | accepted |
| UXB-A5 | Förlorad/Avböjd reason = structured category (Pris/Konkurrent/Tidplan/Uteblivet svar/Annat) + note. Category list is a strawman for the owner/oracle; free text alone would kill hit-rate analytics. | needs oracle/owner glance |
| UXB-A6 | One open follow-up per quote at a time (complete-then-plan-next) — keeps due lists honest; revisit if the oracle shows parallel follow-ups. | assumption |
| UXB-A7 | B1a ships seed roles only — no custom-role builder UI (mechanism-first per PB-D2; the matrix grows per module). A role builder is a later decision, not designed here. | **CONFIRMED 2026-07-26 by N-4** — tenant-specific roles in v1 are created only by us internally, via an internal surface or version-controlled configuration; no tenant-facing builder is designed. |
| UXB-A8 | Montör's landing is `Min dag`, not the dashboard; dashboard remains one surface with role-default widget layouts, no v1 user customization (PB-A11/PB-D7 alignment). | accepted |
| UXB-A9 | Team view groups by arbetsroll in B1 (no named-teams entity in the PRD); named teams only if the oracle demands them. | needs oracle check |
| UXB-A10 | Conflicts warn-and-allow with explicit `Boka ändå` + accepted-conflict state, rather than hard-blocking — matches field reality and FR85/FR89's "surface for resolution"; override shape is an architecture item (§14.3). | assumption for architecture |
| UXB-A11 | Original posture: no offline capture promise in Phase B; transient-failure retention + explicit retry only. | **Decision chain:** superseded 2026-07-26 by N-3/ADR-B007, then reinstated and tightened 2026-09-03 by ADR-B009. Current contract: connected 360×640 field UX, suitable unsent-draft protection, honest lifecycle limits, and server-confirmed success. Full PWA/offline package is Phase C. |
| UXB-A12 | Dashboard v1 widget set per PB-A11's minimal B1 list; widgets are registry-driven and manifest-traceable. | accepted |
| UXB-A13 | Documents center is filter/search-shaped (no folder tree) since it aggregates entity-scoped files (PB-D6); folders exist only where the domain has them (DoU, tenders). | assumption |
| UXB-A14 | All `[oracle-check]` labels (§9) must be resolved via the legacy-oracle terminology pass before the owning epic's first story — labels are cheap to change now, expensive after users learn them. | open item (§14.14) |

— End of specification. Downstream: Phase B architecture extension (answers §14, records ADR-B001..B006), then Phase B epics.
