---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: architecture
lastStep: 8
status: complete
project_name: ElproSaas
user_name: Rasmus
date: 2026-07-18
completedAt: 2026-07-18
amendedAt: 2026-07-26   # owner + accountant answers folded in: ADR-B006 recorded, ADR-B007 + §12A/§12B added, N-2/N-4/N-5/N-6/N-8/N-9/N-10 dispositions (see §24)
phase: Phase B - Legacy Parity Release
mode: "extend-by-supersession — headless create; non-interactive; all choices resolved against the ratified party-session record (PB-D1..PB-D14), the Phase B PRD, and the Phase B UX spec; judgment calls logged in the Assumptions Register (§21)"
supersedes: "_bmad-output/planning-artifacts/architecture.md as the forward architecture baseline. The Phase A architecture is FROZEN as the pilot record: it is never edited, ADR-A001..A009 carry forward unchanged and stay citable, and this document restates only deltas."
governedBy:
  - _bmad-output/planning-artifacts/prd-phase-b.md                       # FR62-FR130, NFR42-54 + carried NFR1-41 spine; §12 ADR trigger register; §15 open items
  - _bmad-output/planning-artifacts/ux-design-specification-phase-b.md   # §14 architecture handoff items 1-14
  - _bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md  # PB-D1..PB-D14 binding; §4 dependency map; §5 guardrail mechanism; §9.2 job-model options
inputDocuments:
  - _bmad-output/planning-artifacts/prd-phase-b.md
  - _bmad-output/planning-artifacts/ux-design-specification-phase-b.md
  - _bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md
  - _bmad-output/planning-artifacts/architecture.md                      # frozen Phase A baseline (read-only input)
  - _bmad-output/project-context.md                                      # implemented Phase A conventions through Epic 9 close
  - docs/oracle/initial-system-audit-2026-06-01.md                       # legacy P0 (forged-JWT cron) named anti-pattern source
  - docs/discovery/phase-b-owner-answers-2026-07-26.md                   # job model + N-2..N-10 (added 2026-07-26)
  - docs/discovery/phase-b-accountant-answers-2026-07-26.md              # tax blocks A/B/C + hidden rows 2.2 (added 2026-07-26)
---

# Phase B Architecture — ElproSaas Legacy Parity Release

**Author:** Rasmus
**Date:** 2026-07-18
**Artifact type:** Architecture extension. Extends the frozen Phase A architecture by supersession; carries ADR-A001..A009 forward unchanged; adds ADR-B001..B006 and the Phase B cross-cutting designs.

## 0. Purpose, Supersession, and Reading Order

This document is the forward architecture baseline for Phase B (legacy parity on the Phase A architecture). It exists so AI agents implement ~21–25 epics consistently against one set of decisions.

Rules of this document:

- **The Phase A architecture (`architecture.md`) is frozen.** ADR-A001..A009 are carried forward **unchanged** — they are cited in §2 with only their Phase B deltas restated. Where this document is silent, the Phase A architecture and the implemented conventions in `project-context.md` govern.
- **Decision precedence:** party-session decisions PB-D1..PB-D14 and PRD FR62–FR130 / NFR42–54 are binding inputs; this document mechanizes them, it does not re-decide them. Judgment calls made in this autonomous run are logged in §21 (AB-A#).
- **Owner gates: closed as of 2026-07-26.** The owner and accountant answers of 2026-07-26 (`docs/discovery/phase-b-owner-answers-2026-07-26.md`, `docs/discovery/phase-b-accountant-answers-2026-07-26.md`) closed every remaining hard Phase B gate. ADR-B006 is now **DECIDED** (§8); ADR-B007 (§8A) and the ADR-A004 money amendment (§12A) are new decisions recorded from those answers. ADR-B005 remains **boundary-only** by design (final design after the B2 spike) — that is a sequencing choice, not an owner gate. Residual `[gated: X]` markers survive only where the source answer genuinely left a detail open; §24 is the reconciliation ledger.
- **Docs-only:** this artifact creates no code, migrations, or dependencies. Story 10.1 (§5) delivers the first implementation.

Reading order for downstream consumers: PRD → UX spec → this document → Phase B epics doc. §19 maps every UX §14 handoff item and every PRD §15 architecture item to its section here.

## 1. Executive Architecture Summary

Phase B keeps the entire Phase A spine — pooled tenancy with forced RLS, the server command envelope, SECURITY INVOKER RPCs for atomic writes, integer-öre money, DB-trigger immutability locks, entity-scoped private files, append-only audit, golden-master discipline — and extends it along the decision lines below. Lines 1–6 were recorded at ratification (2026-07-18); lines 7–8 were added when the owner and accountant answers landed (2026-07-26).

1. **ADR-B001 (decided):** RBAC leaves `tenant_admin`-only. Roles live on `tenant_memberships`; authorization is a mechanism (code-level permission matrix + role-aware RLS predicates + command-layer capability checks) whose rows fill incrementally per module activation; sensitive money fields are withheld **server-side by structural absence** (companion-table RLS + read-model projection), never by client masking.
2. **ADR-B002 (decided):** Phase B's first background execution (notifications, email queue, scans) runs **authenticated** — a platform-scheduled runner behind a signed cron secret, with the legacy forged-JWT `verify_jwt=false` cron named as the structural anti-pattern and proven rejected by negative tests.
3. **ADR-B003 (decided):** scope governance re-baselines onto **one TypeScript scope manifest** from which the deny-list, nav registry, tenant-table inventory, widget registry, and scope scans derive; per-epic same-PR activation; the manifest carries its own coherence validator. Lands as Story 10.1.
4. **ADR-B004 (decided):** exactly three public token surfaces (calendar feeds, asset QR, unsubscribe) exist behind hashed high-entropy capability tokens with rotation, revocation, rate limits, and abuse monitoring — the narrow, deliberate NFR5 amendment (PB-D14).
5. **ADR-B005 (boundary only):** Fortnox is an outbox/mapping-shaped integration layer sketched here and finalized only after the B2 spike; no credentials, tables, or routes before its epic.
6. **ADR-B006 (decided 2026-07-26):** the job model is **Jobb-as-container (Option A) implemented as one typed entity (Option C)** — a single `jobs` table with `type ∈ {order, projekt}`, `arbetsorder` as child work items, and "upgrade to projekt" as an audited single-row type change. It extends the Phase A `jobs` table additively; there is no `projects` table. E16–E18 are unblocked.

Two further decisions were recorded from the 2026-07-26 answers and are numbered outside the B001–B006 sequence to avoid renumbering this document:

7. **ADR-B007 (decided 2026-07-26, §8A):** the field posture is an **installable PWA with genuine offline capture** — not "responsive web first". A local queue with idempotent, operation-id-keyed writes, per-change sync states, append-only field records, and scoped/minimised/purgeable local storage under the same permission checks as online reads. No native app.
8. **ADR-A004 amendment (decided 2026-07-26, §12A):** VAT rounds **per VAT category at document level** (Peppol/EN 16931 BR-CO-17), not per line; row visibility does not drive economic inclusion; construction reverse charge is a VAT **type**, not a 0 % rate; Skatteverket claim amounts truncate to whole SEK. This **corrects shipped behaviour** and is owned by Story 10.6.

The highest-risk Phase B surfaces are (a) per-role authorization correctness at 2.5× the module surface, (b) the two new attack-surface classes (background execution, public tokens), (c) scheduling correctness across recurrence and DST, and (d) money-out immutability. The test strategy (§16) scales the Phase A negative-test discipline along exactly those axes.

## 2. Carried Phase A Foundation — ADR-A001..A009 (Unchanged, Deltas Only)

All nine Phase A ADRs remain in force exactly as written in the frozen `architecture.md`. This table cites each and records only its Phase B delta. No delta weakens a Phase A invariant.

| ADR | Carried decision (cite; do not restate) | Phase B delta |
| --- | --- | --- |
| ADR-A001 Clean Next.js App Router rebuild | Carried unchanged. | New route territories: an unauthenticated `(public)` route group for ADR-B004 surfaces (§6.5) and an operator-scoped `/operator` area outside tenant context (§15.4). Same app, same stack; no new framework. |
| ADR-A002 Supabase pooled multi-tenancy | Carried unchanged. | Tenant provisioning becomes a product flow (E12) on the same pooled model; a small set of **platform-scoped** (non-tenant) tables is introduced for operator identity (§9.1) — an explicit, enumerated exception to the direct-`tenant_id` rule, mirroring how `tenants` itself already is one. |
| ADR-A003 Server-side command layer | Carried unchanged. | The command envelope gains a role/capability authorization gate (ADR-B001) between membership resolution and input validation. Background producers (ADR-B002) are the one non-user execution context and get their own containment rules (§4.3). |
| ADR-A004 Integer öre + snapshotted tax assumptions | Carried in mechanism; **amended in content by §12A (2026-07-26)**. | Extends to job economy (E17) and billing bases (E26): integer öre end-to-end, engine-only arithmetic (`@/lib/money`), correctness sign-off bound to the tax gates (NFR49, §13). The STOP condition stands — *no new rounding rule may be invented* — and §12A is not an invention: the accountant **supplied** the rule, which is the one sanctioned route to change it. §12A moves VAT rounding from per-line to **per VAT category at document level**, decouples row visibility from deduction eligibility, makes reverse charge a VAT **type**, and truncates Skatteverket claim amounts to whole SEK. Story 10.6 implements it; **the frozen Phase A architecture's Rounding section is superseded on that point and must not be read as current.** |
| ADR-A005 Immutable quote version + acceptance model | Carried unchanged. | Förlorad/Avböjd (E10) is an append-only lifecycle event + reason record; the sent snapshot is untouched (FR63). Billing-basis lock (§13) and DoU document locks (B3) reuse the announced-lock + DB-trigger discipline as new members of the shared lock-code family. |
| ADR-A006 Entity-scoped private file model | Carried unchanged. | Every B1+ module emits entity-scoped `files`/`file_links` metadata (PB-D6, §12); the E20 documents center is an **aggregation read** over that model, not a new storage model. `owner_type`/`purpose` unions grow only via manifest-governed activation. |
| ADR-A007 Lovable oracle + golden-master coexistence | Carried unchanged. | Comparison-harness pattern (Epic 9, live-driven) extends to scheduling and jobs money paths (§16.4, NFR52); the oracle additionally serves as the terminology authority for the UX `[oracle-check]` pass (§19 item U14). |
| ADR-A008 Future expansion through documented boundaries only | Carried unchanged in mechanism. | Phase B **activates** several Phase A seams through their ADRs: RBAC (ADR-B001), field workflow (E16–E18 under ADR-B006), supplier file import (E25), Fortnox boundary (ADR-B005). The Phase C ledger (PRD §14) is the new deferred set; enforcement moves to the scope manifest (ADR-B003). |
| ADR-A009 Narrow Postgres RPC for transaction-sensitive commands | Carried unchanged. | New transaction-sensitive commands enumerated in §14 (booking writes, series edits, job completion, billing-basis lock, tenant provisioning, lifecycle-lost). SECURITY INVOKER remains the default; the two sanctioned DEFINER exceptions (provisioning, §14.3; background context, §4.3) follow the Phase A DEFINER hardening shape and carry dedicated negative tests. |

The implemented Phase A conventions in `project-context.md` (envelope shape, H4 enrollment, exact-policy enumeration, composite same-tenant FKs, lock-trigger family, öre validation authority, snapshot builders) remain binding patterns for every Phase B story.

## 3. ADR-B001 — RBAC and Non-Admin Activation (DECIDED)

**Trigger (PRD §12):** with this planning package's ratification, before E11 design.
**Status:** DECIDED here. **Matrix seed content filled 2026-07-26** — the N-4 gate is closed and §3.3A carries the real role/permission model that replaces the "mechanism now, conservative default later" placeholder.
**Authority:** PB-D2; FR66–FR72; NFR42–NFR44; owner direction 2026-07-08; **owner answer N-4, 2026-07-26**.

### 3.1 The reversal, recorded

Phase A deliberately deferred full RBAC (Phase A PRD deferral, assumption **A29** / acceptance boundary **AC20**; architecture §21 RBAC seam: "only `tenant_admin` is active"). **Phase B reverses that deferral by explicit owner direction (2026-07-08) and ratified decision PB-D2.** The reversal is mechanism-first: Phase B ships the permission *mechanism* plus the seed roles; it does not spec a full matrix up front for modules that do not exist yet.

### 3.2 Role storage — roles on `tenant_memberships`

- `tenant_memberships` remains the single membership/authorization record (one row per tenant × user; `status ∈ {active, invited, disabled}` carried from Phase A).
- The `role` CHECK constraint widens from the single literal `tenant_admin` to the seed set: **`tenant_admin` (UI label **"Företagsadmin"** — the *literal* is retained; no rename, no data migration, `is_tenant_admin()` keeps working), `projektledare`, `montor`, `saljare`, `ekonomi`**. Confirmed verbatim by owner answer N-4.
- **Multi-role is REQUIRED, not speculative (N-4 revises AB-A2).** The owner is explicit: *"En användare ska kunna ha flera roller och jobbrelaterade uppdrag samtidigt."* The role-SET code contract (`roles: Role[]`) was already the design; the additive `membership_roles` child table (tenant_id, membership_id, role; unique per membership × role) is therefore **built in E11**, not reserved. Permission evaluation over a role set is the **union of the granted permissions** — a user holding two roles gets the more permissive outcome, tempered by the sensitive-field rules of §3.6, which are evaluated the same way (a field is withheld only if **no** held role is entitled to it).
- **Arbetsledare is confirmed job-scoped, not a tenant role** — see §3.2A.
- Admin user management (FR69) reuses existing surface: invitations are `tenant_memberships.status='invited'` rows plus Supabase Auth admin invites executed server-side (service context, never client-reachable); every action audited via the Phase A envelope.

### 3.2A Arbetsledare — a per-job assignment (N-4 confirmed)

**Arbetsledare is a job- or project-bound assignment, not a global role.** It lives on `job_members.job_role` (E16, ADR-B006 §8.3) and is enforced **per job** inside job commands (NFR43). It never appears in `tenant_memberships.role` and never widens a user's reach beyond the specific jobs they hold it on. A user may hold it on several jobs simultaneously, alongside any tenant roles.

Its default money posture is **the same as Montör's** — no sales price, no cost price, no contribution margin (see §3.3A). Being Arbetsledare on a job grants operational authority over that job (the crew, planning, documentation, consumption), not economic visibility.

### 3.3A Permission model and seed matrix (N-4, filled 2026-07-26)

The matrix is not a flat role→page map. Per N-4 it has **four dimensions**, and permission keys bind to **stable business functions and API operations — never to page names or a field's current position in the UI**:

1. **Resource / functional area** — customers, jobs, quotes, time rows, material, invoice basis, HR, company settings, …
2. **Action** — view, create, edit, delete, approve, send, export.
3. **Data scope** — own records, assigned jobs, one project, a group, the whole company.
4. **Sensitive field groups** — sales price, cost price, contribution margin, payroll data, specially protected personal data.

The owner's explicit design constraint: *"all skyddsvärd funktionalitet och all skyddsvärd information"* is permission-governed, **but not every cosmetic UI field gets its own key** — a literal per-form-field permission would be unadministrable and would break on every UI change. Sensitive **groups**, not individual widgets.

**Named keys (the seed set, owner-supplied):**

```text
Customers.View / Create / Edit / Delete
Jobs.ViewAssigned / ViewAll / Create / Edit / Delete / AssignUsers / ApproveCompletion
Quotes.View / Create / Edit / Approve / Send / Export
InvoiceBasis.View / Create / Edit / Approve / ExportToFortnox
Economy.ViewSalesPrice / EditSalesPrice / ViewCostPrice / EditCostPrice / ViewContributionMargin
Users.View / Invite / Edit / Deactivate
Roles.View / Manage
CompanySettings.View / Edit
```

This is a seed, not a closed universe: each module activation adds its own keys in the same PR (§5.5). The names above are binding for the areas they cover — do not re-coin `Jobs.Read` alongside `Jobs.ViewAll`.

**Seed role defaults (the "conservative default" placeholder is retired — this is the owner's actual matrix):**

| Role | Baseline access | Sales prices | Cost price + contribution margin |
| --- | --- | --- | --- |
| **Företagsadmin** (`tenant_admin`) | Whole company: system, users, settings | Yes | Yes |
| **Projektledare** | Assigned projects/jobs, planning, resources, economy | Yes | Yes |
| **Arbetsledare** *(per-job assignment, §3.2A)* | The specific job: crew, planning, documentation, consumption | **No by default** | **No** |
| **Montör** | Own/assigned jobs, time, material, documents, checklists, deviations | **No** | **No** |
| **Säljare** | Customers, leads, quotes, sales prices, discounts | Yes | **No by default** — `Economy.ViewContributionMargin` is grantable separately (e.g. sales manager, senior seller) |
| **Ekonomi** | Invoice basis, invoices, VAT, ROT, grön teknik, financial follow-up | Yes | Yes |

Two consequences to design to, not around:

- **Montör receives no price, cost, or margin value at all** — enforced by §3.6's structural absence, not by UI masking. A Montör's job card carries no budget number (ADR-B006 §8.4).
- **Säljare without `Economy.ViewContributionMargin` still needs margin protection.** The owner's suggested mechanism: the system **warns** when a quote falls below the company's permitted margin, **without revealing the cost calculation**. That warning is a server-computed boolean plus a threshold label — never a derived value the recipient could invert to recover the cost price. Treat the invertibility check as part of the design, not an afterthought.

**Enforcement and administration:**

- **Server-side always. Deny-by-default** — absence of an explicit permission is a denial. Hiding a button or field is usability, never protection (FR67, NFR44).
- **Tenant-specific roles exist in the data model** (roles are compositions of discrete permissions) but in v1 are **created and changed only by us as internal platform administrators**, via an internal admin surface or a version-controlled validated configuration. **Never by manual undocumented edits to the production database.** This confirms the §3.3 code-matrix choice for the seed while naming the path by which tenant-specific compositions arrive.
- **Every role/permission change is audit-logged** with: `ChangedBy`, `ChangedAt`, `CompanyId`, `RoleId`, `PreviousPermissions`, `NewPermissions`, `Reason`. The `Reason` is required — this is an audited administrative action, not a silent config write.

### 3.3 Permission matrix — a code-level single source of truth

- The matrix lives in **`src/server/authz/permission-matrix.ts`**: a typed, `satisfies`-guarded constant mapping `moduleId → capability → allowed roles` plus per-module **sensitive-field entitlement rows** (`sensitiveFields: field → entitled roles`). Machine-readable (NFR43), versioned in git, no DB permission tables — B1a ships **seed roles only, no tenant-facing custom role builder** (UXB-A7), so tenant-runtime mutability is explicitly not wanted. N-4 confirms this: tenant-specific role compositions in v1 come from **us**, through an internal surface or version-controlled validated configuration (§3.3A) — which is what a git-versioned matrix is. A tenant-facing role builder would migrate this to data; that is a Phase C+ decision.
- **The seed content is §3.3A** (owner answer N-4): the named permission keys, the six-role default table, and the deny-by-default posture. §3.3 is the mechanism; §3.3A is what it is loaded with.
- **Matrix rows land in the same PR as the module's manifest activation** (FR68, ADR-B003): activating a module without its matrix rows fails the manifest coherence validator (§5.4).
- The matrix drives, from one derivation: command-layer capability checks (§3.5), nav visibility (§15.1), per-tab/widget visibility, per-role landing routes (§15.3), the admin "effective permissions" viewer (server-rendered from this constant), and the per-role negative-test generator (§16.1).

### 3.4 RLS evolution — from `is_tenant_admin` to role-aware predicates

Three predicate tiers, all following the proven DEFINER-helper hardening (SECURITY DEFINER, `set search_path = ''`, schema-qualified refs, `STABLE`, revoked from PUBLIC, standing negative test):

1. **Membership baseline (carried):** `is_active_tenant_member(tenant_id)`, `is_tenant_admin(tenant_id)` — unchanged.
2. **Role gate (new):** `has_tenant_role(target_tenant_id uuid, allowed_roles text[])` — true iff the caller holds an active membership in the tenant with a role in `allowed_roles`. Module tables whose matrix says "role R has no read" use this in SELECT/write policies with the role array **generated from the permission matrix** at migration-authoring time (the migration cites the matrix version; the §16.1 suite asserts policy↔matrix agreement so drift fails loud).
3. **Row scope (new, per module):** ownership predicates for "own/member" scoping — e.g. `is_job_member(job_id)`, own-row checks on `time_reports.user_id = auth.uid()`, own-booking checks via `booking_assignees`. A Montör's RLS reality is: role-gated module read + row-scoped to self/membership.

Policy posture per table = the strictest of (tenant membership) ∧ (role gate where the matrix restricts) ∧ (row scope where the matrix says "own only"). The Phase A rule stands: client gating is UX only; RLS + commands are the authority (FR67), and unauthorized attempts return generic denials with no existence signals (FR72).

### 3.5 Command envelope extension

The Phase A envelope gains one gate: after membership resolution, `requireCapability(ctx, moduleId, capability)` consults the matrix against the membership's role set; failure returns the stable code `PERMISSION_DENIED` (new sibling of `TENANT_ACCESS_DENIED`; same no-existence-signal discipline). Job-scoped elevation (`Arbetsledare`) is checked against `job_members` inside job commands, never tenant-wide.

### 3.6 Sensitive-field withholding — server field-absence (the UX §3.2 contract)

NFR44 requires that an unentitled role never *receives* the value. Two enforcement tiers, chosen per field at schema-design time via the matrix's sensitive-field rows:

1. **Row-sensitive data → role-gated RLS:** where an entire table/row is sensitive (e.g. supplier discount agreements, HR employment data), the table's SELECT policy uses `has_tenant_role` — the unentitled role gets zero rows even via a crafted PostgREST request.
2. **Column-sensitive data → companion-table separation:** where a sensitive column would ride on an otherwise-readable row (RLS is row-level, not column-level), the sensitive columns live in a **companion table** with its own role-gated RLS (pattern: `<entity>` + `<entity>_economy`). Applied from the start to Phase B schema: job budget/rollup money lives in job-economy tables, not on the job container; time-report *hours* are readable per row scope while *valued amounts* are derived in economy read-models. Phase A carried tables with inline rates (`work_roles`, `articles`, calc rows) need no split: their modules are entirely closed to unentitled roles by the module-level role gate (matrix), which subsumes column masking.
3. **Read-model projection + entitlement descriptor (§11):** server read-models additionally project fields per the matrix and return the field-presence descriptor the UI's `MaskedValue`/column-omission mechanism requires. The projection is UX determinism; tiers 1–2 are the security floor.

### 3.7 Test obligations (NFR42)

Per module activation, generated from the matrix: for **every** seeded role, at least one denied-command test and one RLS negative proving the role cannot read/write beyond its matrix rows; plus job-scoped Arbetsledare positive/negative pairs once E16 lands. §16.1 defines the harness shape.

## 4. ADR-B002 — Background Jobs, Notifications, and Email (DECIDED)

**Trigger (PRD §12):** with E13; accepted before the first background execution path merges (AC-B1a-4).
**Status:** DECIDED here.
**Authority:** PB-D5; FR77–FR81; NFR45, NFR47; legacy audit P0.

### 4.1 The named anti-pattern (structural exclusion)

The legacy Lovable P0 (`docs/oracle/initial-system-audit-2026-06-01.md`): Edge Functions with `verify_jwt = false` whose shared cron guard **decodes JWT payloads without signature verification and trusts `role === "service_role"`**, while holding real service-role power. **This pattern must be structurally impossible in Phase B:**

- No code path may decode a JWT without signature verification. No authorization decision may read claims from an unverified token.
- No `verify_jwt = false`-equivalent surface may carry privileged capability. (The only unauthenticated surfaces are the ADR-B004 token surfaces, which carry no privilege.)
- **Mandatory negative tests (NFR45):** a forged/unsigned/none-alg JWT, a garbage bearer token, a missing secret, and a wrong secret are all rejected by the runner endpoint with a generic 401 and zero side effects. These tests are part of E13's definition of done and run in CI permanently.

### 4.2 The sanctioned execution mechanism

**One front door: a scheduler-invoked runner endpoint authenticated by a signed cron secret.**

- **Scheduler:** the platform scheduler (Vercel Cron on the existing deployment) invokes `POST /api/jobs/run` (a Next.js route handler) on fixed cadences. No pg_cron, no Edge Functions, no second runtime in Phase B (AB-A4: one app, one sanctioned lane; revisit only via an ADR amendment).
- **Authentication:** the request must carry the high-entropy shared secret (`CRON_SECRET`, ≥256-bit, server-env only, never client-bundled) in a header, compared **timing-safe**. A platform-verified JWT (properly signature-verified against the platform JWKS) is the sanctioned *alternative* if the platform provides one; decoded-but-unverified JWTs are never trusted (the anti-pattern). Rotation of the secret is an ops runbook item; the endpoint accepts current+previous during rotation windows.
- **Dispatch:** the runner reads the **producer registry** (§4.4), claims due work, and executes producers with bounded runtime per invocation (chunked; a producer never assumes it finishes a full scan in one run).

### 4.3 Background execution identity and containment

Background work has no user session; scans span tenants. Containment rules:

- The runner executes under a **server-only service context** (service-role client) that (a) exists only inside `src/server/jobs/**`, (b) is never importable from client paths (extends the Phase A service-role containment greps/tests), and (c) **iterates tenants explicitly** — every query written by a producer is tenant-scoped (`tenant_id = $current`) even though the service context could see more. A producer emitting a cross-tenant read without explicit iteration is a review-reject.
- Every producer write is audited (`audit_events` with `actor_user_id = NULL` and a `command` naming the producer, e.g. `producer:service_due_scan`; the Phase A "actor since removed" null semantics gain the sibling meaning "system actor", disambiguated by the command name).
- Producer failures are recorded and surfaced to Admin (NFR47 visibility; UX freshness stamps read from the producer run log).
- A small run-log table (`job_runs`, §9.1) records producer, window, started/finished, outcome, error summary — this is what "skannad för 2 tim sedan" renders from.

### 4.4 Producer registry → notification category taxonomy (UX §14.8)

- **Producers are registered in code:** `src/server/jobs/producers.ts` — a typed registry where each producer declares `{ id, moduleId, category, schedule, essential: boolean }`. The registry is **manifest-derived**: a producer is active iff its `moduleId` is manifest-active (ADR-B003); no placeholder categories (UX §4.4).
- **Category identity:** notification categories are stable string keys (e.g. `quote.follow_up_due`, `booking.reminder`, `booking.changed`, `time_report.nudge`, `service.suggestion`, `asset.expiry`, `mention`, `export.failed`), namespaced by module, declared by producers (background) or by command-layer emitters (interactive events like "din bokning har flyttats"). The category union derives from the registry + manifest; the notification-preferences UI renders exactly that union.
- **Per-user preferences:** `notification_preferences` rows (user × category × channel `in_app`/`email`); absent row = category default. `essential: true` categories are non-disableable (enforced server-side, rendered as such).
- **Deep-link contract:** every notification row stores the target route path (stable URL per UX §8) computed at emit time, plus tenant and category — the bell/center never re-derive links client-side.

### 4.5 Notification and email pipeline (schema in §9.1)

- **In-app:** producers/commands insert `notifications` rows (tenant, user, category, title/body, route, read_at). Read/unread flips are the sanctioned optimistic-UI case.
- **Email:** emitters enqueue `email_outbox` rows (tenant, recipient, category, template key + params, dedupe key, status `queued → sending → sent | failed | suppressed`, attempts, next_attempt_at). A queue-processing producer claims rows with `FOR UPDATE SKIP LOCKED`, enforces the **suppression list** (`email_suppressions`) before send, applies bounded retries with backoff, and appends `email_delivery_events` (append-only log). **Idempotency (NFR47):** a unique dedupe key per (category, subject entity, period) prevents duplicate sends from retried processing; the send step records provider message id before marking sent.
- **Sending activation:** the pipeline still ships **queued/non-sending** first (rows reach `queued` and stop; the preferences email column renders inactive-with-explainer) and the provider stays behind the narrow adapter interface (`src/server/email/provider.ts`, AB-A5). What is no longer open is *what activation looks like* — **N-6 answered it (§4.6)**. Every outbound mail carries tenant identity, deep link, and — for non-essential categories — an unsubscribe link governed by ADR-B004.
- Outbound content respects entitlements: an email body is built from the recipient's entitlement projection (§11), never from an Admin-shaped payload (NFR47 leakage clause).

### 4.6 Sender identity, flow priority, and delivery logging (N-6, answered 2026-07-26)

**Sender identity — a central verified subdomain, not per-tenant domains:**

```text
From display name:  [Företagsnamn] via [Systemnamn]
From address:       utskick@notify.<system>.se     # centrally administered, SPF/DKIM-verified
Reply-To:           the tenant's own chosen address, e.g. offert@kundforetag.se
```

The technical sender stays constant and authenticable while replies reach the right company. **Per-tenant verified sending domains are a later version**, explicitly not in the initial flow — so the adapter must not assume a per-tenant domain, and must not make one hard to add.

**Flow priority (the implementation order for E13 and its consumers):**

1. user invitations and account-security messages;
2. quote sending to the customer, including the link to open and accept or reject;
3. internal notification when a quote is accepted or rejected;
4. notification to a field worker when a job is assigned or materially rescheduled;
5. configurable quote reminders;
6. daily or weekly digest for less urgent events.

**Quote reminders stop automatically** when the quote is accepted, rejected, withdrawn, superseded by a new version, or expired. That is five distinct stop conditions and each needs a test — an unstoppable reminder loop pointed at a customer is the failure mode to design against.

**Invoices are sent from Fortnox, not from us** (N-5 §7.1), specifically so the recipient never gets two invoice emails from two systems.

**Delivery logging** — every send records at minimum:

```text
MessageType  TemplateId  TemplateVersion  CompanyId  Recipient
FromAddress  ReplyToAddress  TriggeredBy  TriggeredAt
RelatedEntityType  RelatedEntityId  ProviderMessageId
DeliveryStatus  DeliveredAt  BouncedAt  FailureReason
```

This is a superset of the `email_delivery_events` sketch in §4.5 and supersedes it. **Transactional and marketing messages are distinct classes; marketing is not part of the initial email capability** — the class is modelled so the distinction exists, but no marketing path is built.

## 5. ADR-B003 — Scope Manifest Guardrail Re-Scoping (DECIDED)

**Trigger (PRD §12):** with this planning package / the Story 10.1 re-baseline — before the first Phase B story.
**Status:** DECIDED here. **Lands as Story 10.1** (the first delivered story of Epic 10, before any module story).
**Authority:** PB-D8; FR129–FR130; NFR51; session §5.

### 5.1 Format decision: TypeScript, not YAML

The manifest is a **typed TypeScript module**: `src/scope/manifest.ts`, exporting a `satisfies ScopeManifest`-guarded constant. Justification (AB-A6):

- **Runtime consumers need to import it:** the nav registry (§15.1), the deferred-category deny-list, the widget registry, and the producer registry are runtime code. A TS module is importable everywhere (app, tests, scripts) with zero parsing.
- **Zero new dependency:** Node has no built-in YAML parser; a YAML manifest would add a dependency purely for governance — against the repo's dependency discipline.
- **Compile-time coherence for free:** literal-union module ids, wave tags, and epic references get typo-checked at `tsc` time; the repo's proven single-source pattern (`READINESS_CODES` `satisfies`-guard) is exactly this shape.
- YAML's one advantage (non-developer editability) is irrelevant: every manifest change is by definition a reviewed product PR (activation rule below).
- Placement in `src/scope/` (not `docs/scope/`) keeps the runtime import path clean; the session record's `docs/scope/…` was an example ("e.g."), not a binding location. `docs/process` references the manifest by path.

### 5.2 Manifest content (schema of the constant)

Per module: `{ id, label, wave: 'A' | 'B1a' | 'B1b' | 'B2' | 'B3', status: 'active' | 'pending', epic?: 'E10'..'E34' (required when active), activatedAt?, navItems: [{ route, group, requiredCapability }], tenantTables: string[], widgets: string[], notificationCategories: string[], publicSurfaces: ('calendar_feed' | 'asset_qr' | 'unsubscribe')[], fileOwnerTypes: string[] }`. Phase A's shipped surface (7 nav items, 24 tenant tables, 7 file owner types) is the initial `active` set under wave `'A'`.

### 5.3 Derivations (the four authored copies collapse to one)

From the manifest derive, at Story 10.1: the deferred deny-list (`src/features/files/deferred-categories.ts` re-derives `FORBIDDEN_DEFERRED_CATEGORIES` from `pending` modules), the nav guardrail expected set, the tenant-table inventory expectation (the H4 gate's expected enrollment set — `TENANT_TABLES` must equal the union of active modules' `tenantTables`), the deferred-token scope scans, and `phase-scope-reviewer`'s review baseline. Later derivations as they land: widget registry (§15.2), producer/category registry (§4.4), file `owner_type` union (§12), public-surface closed set (§6). Fail-loud is retained: any surface not manifest-listed fails CI.

### 5.4 Coherence validator (presence AND coherence — the Epic 9 `A22` lesson)

The manifest ships with its own validator (unit suite + typecheck):

- an `active` module without an `epic` reference fails;
- a nav item, tenant table, widget, notification category, file owner type, or public surface not traceable to an `active` module fails;
- a `pending` module with live surface (nav/table/widget) fails;
- the public-surface union across modules must stay within the ADR-B004 closed set of three;
- activating a module without permission-matrix rows for it (§3.3) fails.

### 5.5 Activation protocol

**Per-epic same-PR activation (FR129):** a module epic's first story flips `pending → active` (adding epic reference + date) **in the same PR** as the module's first schema/nav change, removes the corresponding deny-list category (automatic via derivation), adds the module's permission-matrix rows, enrolls its tables in H4 + the exact-policy enumeration, and lands its per-role negative tests. Story 10.1 also executes the one-time re-baseline: rewrite `AGENTS.md` phase statement + deferral list and update `phase-scope-reviewer` + `docs/process` scope statements, one ADR-backed change (PRD §13).

## 6. ADR-B004 — Public Token Surfaces (DECIDED)

**Trigger (PRD §12):** before the first public token surface ships (B1b calendar feed); governs asset QR (B2) and unsubscribe activation.
**Status:** DECIDED here — accepted with this document; ships before any B1b public surface.
**Authority:** PB-D14; FR80, FR91, FR112; NFR46; the narrow NFR5 amendment.

### 6.1 The closed set and the NFR5 amendment

Exactly three unauthenticated surfaces exist in Phase B: **personal calendar feeds**, **asset QR lookup/fault-report**, **email unsubscribe**. Nothing else. Adding a fourth requires amending this ADR (NFR46). Each surface carries **no privileged capability**: reads are minimal projections; the only writes are the QR fault-report submit and the unsubscribe flip, both executed through dedicated narrow commands with the token as the entire capability. NFR5's "no unauthenticated privileged surface" posture otherwise stands unamended; the legacy public anonymous suggestion endpoint (P70) remains outside the set (Phase C ledger).

### 6.2 Token design (uniform across the three)

- **Entropy/format:** 256-bit server-generated random (`crypto.randomBytes(32)`, base64url). Never a UUID, never derived from ids.
- **Storage:** tokens are stored **hashed (SHA-256)** in per-surface tables (`calendar_feed_tokens`, `asset_qr_tokens`, `email_unsubscribe_tokens` — §9) with tenant_id, subject reference, `created_at`, `revoked_at`, `last_used_at`, and usage counters. Lookup is by hash; the plaintext exists only in the issued URL. A leaked DB row does not yield a usable token.
- **Rotation:** rotate = issue new + revoke old in one command (audited). Calendar tokens: user-self-serve create/rotate/revoke (UX §4.5 `Kalenderprenumeration`). QR tokens: per-asset, rotated by reprinting the label (old token revoked on demand — "etiketten är inte längre aktiv"). Unsubscribe tokens: per (recipient, category-class), single-purpose, idempotent on reuse.
- **Revocation:** immediate (row flag checked on every request). Revoked/unknown tokens return the same generic not-active response (no valid-vs-revoked oracle, no tenant enumeration).
- **Rate limiting + abuse posture:** per-token and per-IP-hash fixed-window counters, DB-backed (pilot-scale per NFR24–26; a dedicated store is a scale-triggered revisit), returning 429 with retry-after. Abuse counters and spike flags surface on an admin queue (NFR46 monitoring). Public routes also sit behind platform-level protections.
- **Data minimization:** calendar feed = the subject user's own bookings only (times, title, job/customer label, location) — never money, never other people's data. QR page = minimal asset identity (label, model) + the fault-report form — no tenant name enumeration, no asset list. Unsubscribe = confirms scope, offers re-subscribe, nothing else.

### 6.3 Calendar-feed mechanics (UX §14.10)

`GET` feed route streaming iCalendar for the token's user, regenerated per request from live bookings (no stored feed). Create/rotate/revoke commands are ordinary authenticated commands (audited); the UX shows the plain-language access warning. Feed requests update `last_used_at` (the UX can show "senast hämtad").

### 6.4 Asset QR mechanics

QR label encodes the tokenized URL only (no ids). The public page renders the minimal projection; fault-report submit creates the fault report + notification via a narrow command that derives tenant/asset **from the token row**, never from client input. Rate-limited per §6.2; oversized/blocked uploads follow the Phase A file states.

### 6.5 Shell isolation (UX §14.11)

Public routes live in a dedicated unauthenticated route group `src/app/(public)/**` with its own minimal layout: **no AppShell import, no tenant context resolution, no session read, no nav registry** — a guardrail test asserts the `(public)` group imports none of the authenticated shell/context modules. Generic error states; same accessibility floor.

### 6.6 Test obligations (NFR46)

Per surface: valid-token happy path; revoked/rotated/unknown token → identical generic response; rate-limit trip; cross-tenant probe (token from tenant A can never surface tenant B data); enumeration resistance (response uniformity); for QR submit — input validation + no tenant/asset override via body. The calendar feed ships only after this ADR's suite is green (AC-B1b-7).

## 7. ADR-B005 — Fortnox Integration Layer (BOUNDARY ONLY)

**Trigger (PRD §12):** final ADR **after the B2 Fortnox spike, before E33 build** (B3).
**Status:** BOUNDARY ONLY — the shape below is a sketch to aim the spike; the final design is explicitly deferred. **No Fortnox credentials, tables, routes, dependencies, or UI exist until E33's epic activates the module in the manifest.** N-5 (answered 2026-07-26) **narrows** the boundary substantially — §7.1 records what is now settled and therefore no longer a spike question.
**Authority:** owner direction (Fortnox is IN); PB-D11 (spike during B2); FR127–FR128; NFR50; **owner answer N-5, 2026-07-26**.

### 7.1 Settled by N-5 (no longer open to the spike)

- **Auth: Fortnox OAuth 2 Authorization Code Flow, per tenant.** Each customer company connects its own Fortnox account and consents to the scopes. **API credentials and personal Fortnox logins are never shared between tenants** — a shared-credential design is out, not a fallback.
- **Initial scopes (least privilege):** `companyinformation`, `customer`, `article`, `invoice`. The further scopes `settings`, `project`, `costcenter`, `print`, `payment` are added **only when the corresponding feature is actually implemented** — scope creep in the OAuth grant is treated the same as scope creep in the manifest.
- **Mastership split — the governing rule:** **our system is master for the operational invoice basis; Fortnox is master for the final invoice, the invoice number, bookkeeping status, and payment status.** Anything that contradicts that split is a design error.
- **No automatic bookkeeping and no automatic invoice sending from our system in v1.** Sending is Fortnox's, deliberately (it also avoids the duplicate-email problem named in N-6).
- **The flow:** register time/material/payment items against the job → Arbetsledare or Projektledare reviews → a **frozen** invoice basis is created → an authorised user approves it → an invoice or invoice draft is created in Fortnox → final check in Fortnox → bookkeeping and sending from Fortnox → invoice number, status, and references sync **back** to our system.
- **Licence responsibility** sits with the customer company for the Fortnox resources the integration touches.

Consequences: E26's billing basis (§13) is the master record the export reads from, and the inbound direction is narrow and read-only (number/status/reference back-sync) rather than the "export-only, no inbound" sketch below — that sketch line is superseded.

### 7.2 Sketched shape (to validate/amend in the spike report)

- **Per-tenant connection:** `fortnox_connections` — one row per tenant; OAuth executed entirely server-side; tokens encrypted at rest, never client-reachable, never logged (NFR50). Connection status (`Ansluten/Ej ansluten/Fel`) is the only client-visible projection.
- **Outbox pattern:** `integration_outbox` — export intents appended **transactionally with the domain event that warrants them** (e.g. billing-basis locked → outbox row), processed by an ADR-B002 producer with per-record status (`Köad → Skickad → Fel`), bounded retries/backoff, per-record and per-run retry UX (FR128), and full inspectability (NFR50).
- **Mappings:** `external_mappings` — tenant-scoped local-id ↔ Fortnox-id per type (customer, article, invoice basis), unique per (tenant, type, local id).
- **Flows (B3):** customers, articles, invoice basis outbound, plus the **narrow inbound back-sync of invoice number / status / references** established by §7.1. No broader inbound sync and no webhooks without amending the final ADR.
- **Spike questions that REMAIN open after N-5:** Fortnox rate limits; idempotency keys on the Fortnox side; the exact payload mapping from our §7.3 invoice-basis line model to Fortnox's invoice-row shape; token refresh semantics and failure handling; test/sandbox environment availability. (Licensing, the API access model, the auth flow, the scope set, and the mastership split are **answered** in §7.1 and are no longer spike questions.)

### 7.3 Invoice-basis content and status flow (N-5 — the E26 content definition)

The long-`[gated: N-5]` content definition of a *faktureringsunderlag* is answered. A basis combines **time, material, fixed price, payment plan, and other billable items**, each kind keeping its own fields:

- **Time:** date or period, person or work category, work type, hours, hourly price, discount, VAT, **ROT classification**, reference to the originating time entry.
- **Material:** article number, description, quantity, unit, unit price, discount or markup, VAT, **grön-teknik classification where relevant**, reference to the originating material registration.
- **Fixed price:** fixed-price point or delivery part, agreed amount, what it covers, already-invoiced portion, remaining amount.
- **Payment plan:** milestone, amount or percentage, the condition that permits invoicing it, approval date, previously invoiced, remaining.
- **Other items:** travel, service vehicle, machine cost, administration, fees, additions or deductions. **These are kept separate precisely because they are treated differently under ROT and grön teknik** — which is the same rule §12A.4 enforces at row level.

Every line carries at least:

```text
SourceType  SourceId  Description  Quantity  Unit  UnitPriceExVat  Discount
VatRate  Account  Project  CostCenter  DeductionClassification  ServicePeriod
```

`DeductionClassification` is the **same enumeration as §12A.4** — one vocabulary from the calculation row through to the invoice line, not two that must be kept in sync.

**Double-invoicing guard:** only **approved and not-yet-invoiced** source items may be picked up. Once an item is placed on a basis it is **linked to that basis and locked against being billed again**. This is a database-level guard, not a query filter — the Epic 10 review lesson applies.

**Versioned status flow:**

```text
Draft → UnderReview → Approved → Exported → PartiallyInvoiced → Invoiced → Cancelled
```

An **Approved version cannot be edited** without being reopened or replaced by a new version, so it stays possible to see afterwards exactly which basis was exported to Fortnox. This is the same announced-lock + DB-trigger discipline as §13 — N-5 adds the version dimension and the `UnderReview` / `PartiallyInvoiced` / `Cancelled` states to the `Utkast → Låst → Exporterad` sketch in §13, which is superseded by this list.

## 8. ADR-B006 — Job Model: Jobb-as-Container, One Typed Entity (DECIDED)

**Trigger (PRD §12):** after owner möte items `7.1`/`7.3`; **before any E16–E18 design/schema/story work** (AC-B1b-6).
**Status:** **DECIDED 2026-07-26** — the gate is closed. This section supersedes the options-only text this document carried while the gate was open.
**Authority:** owner answer 2026-07-26 (`docs/discovery/phase-b-owner-answers-2026-07-26.md`, opening section: *"Gällande jobbmodellen kör vi på A som modell och C som teknik"*), recorded in `owner-signoff-questions.md` rows `7.1`/`7.3`; options prepared in `phase-b-party-session-2026-07-18.md` §9.2; job-card field list from the same owner answer's **N-9** (`Jobbindata för schemaläggning`); PRD §7; FR93–FR106.

### 8.1 The decision

**Option A is the conceptual model. Option C is the implementation technique.** They are not alternatives — the owner chose one of each, exactly as the team prepared them (session §9.2: *"present A, implemented as C"*).

**Option A — the model users see and talk about:**

- **`Jobb` is the container.** It is the unit that is created, assigned, scheduled, reported against, and completed.
- **A jobb contains `arbetsorder`** (work orders) — child work items within the container.
- **A jobb can be upgraded to a `projekt`.** The upgrade unlocks project features: members with per-job roles, payment plan, deeper economy. There is no separate "create a projekt" concept that bypasses the jobb container.

**Option C — how that model is built:**

- **One `jobs` table** carrying a `type ∈ {order, projekt}` discriminator. There is no `projects` table (Option B is rejected).
- **`arbetsorder` are child work items** in a `work_orders` table parented to the container.
- **"Upgrade" is an audited type change on one row** — an event-logged `order → projekt` transition — **never a row migration** into a second table. No data is copied, no id changes, nothing that references the jobb has to be re-pointed.

### 8.2 Rationale

| Consideration | Why A-as-model / C-as-technique wins |
| --- | --- |
| **Parity (the governing Phase B constraint)** | A matches the Lovable oracle's shape. Users keep the vocabulary and the mental model they already have; the parity release does not re-teach the core noun. |
| **One container, one security surface** | C keeps a single RLS surface, a single H4-enrolled container table, one exact-policy enumeration, one set of composite same-tenant FK targets. Option B would have doubled all four for a distinction users do not experience as two entities. |
| **The upgrade is cheap and reversible in review terms** | A single-row audited transition is a state change with an event row — the same shape as every other lifecycle flip in this codebase (`quote_events`, `job_events`). Option B's equivalent is a cross-table migration with re-pointing, which is a data-integrity risk for a routine user action. |
| **Phase A already built most of it** | The shipped `jobs` table (Epic 7) is already a single tenant-owned container with lifecycle status, source refs, customer/facility/contact FKs, planned dates, and an event log. C is additive columns on that table; A/B would both have required more. |
| **No aggregate read-model tax** | Option B's `projekt` grouping needs aggregate economy read-models over a set of jobb plus a workspace `Ingående jobb` read-model. C's economy rollup is per-container, which is what E17 wants anyway. |
| **Bookings and time already bind `jobs.id`** | `bookings.job_id` and `time_reports.job_id` (E14/E15, ungated) bind the container. Under C they keep binding it after an upgrade — the id does not change. Under B a jobb absorbed into a projekt would have needed a second bindable level. |

**The cost accepted:** a typed entity carries conditional validity — project-only children and project-only fields are meaningless on `type='order'`. §8.3 handles that at the database level rather than by convention, which is the price of the choice and is paid explicitly.

### 8.3 Schema implications — how the typed entity EXTENDS the Phase A `jobs` table

Phase A ships `public.jobs` (Story 7.1, `20260709120000_acceptance_to_job_model.sql`, relaxed by `20260714095225_standalone_job_creation.sql`). **That table is extended, not replaced.** Nothing in this ADR drops, renames, or re-creates it; the Epic 7 acceptance→job path and the standalone-create path both keep working unchanged, and their regression coverage is a hard acceptance condition of Story 16.1.

**Carried unchanged from Phase A (do not re-litigate):**

- direct `tenant_id`, RLS ENABLE + FORCE, own-tenant policies, no DELETE grant (archive via `archived_at`);
- `jobs_id_tenant_unique (id, tenant_id)` — the composite same-tenant FK target every new child table uses;
- the nullable-but-immutable-once-set source refs `quote_acceptance_id` / `quote_version_id` and the `jobs_source_ref_lock` trigger (owner decision 2026-07-14: standalone-creatable AND connectable; there is no connect-later mechanism in Phase B);
- `customer_id` (required) + `facility_id` / `contact_id` composite same-tenant FKs;
- `status in ('created','in_progress','done','cancelled')` and the `job_events` append-only lifecycle log.

**Added by E16 (the activation PR, per the §5.5 protocol):**

1. **`jobs.type text not null default 'order' check (type in ('order','projekt'))`** — the discriminator. The default is `'order'` so every existing row is a valid jobb with zero backfill ambiguity. **`type` is the only new discriminator; `status` is not overloaded** — lifecycle and kind stay orthogonal (a projekt can be `in_progress`; an order can be `done`).
2. **Project-scope columns, nullable until upgrade.** They live on the container because they describe the container, and they are `NULL` while `type='order'`. A DB CHECK enforces the one-way implication *(column set non-null ⇒ `type='projekt'`)*; it does **not** require them on upgrade (an upgraded projekt may legitimately have an empty payment plan on day one).
3. **`work_orders`** — the arbetsorder child (composite same-tenant FK to `jobs (id, tenant_id)`). Valid under **both** types: an ordinary jobb has arbetsorder too. This is the model's core containment relation, not a project feature.
4. **`job_members`** — per-job membership with `job_role`, the home of the **Arbetsledare** designation (ADR-B001 §3.2: Arbetsledare is job-scoped, never a `tenant_memberships.role`). Also valid under both types.
5. **Project-only children** — `job_payment_plans` (+ items) and any later projekt-gated child — carry a **DB CHECK or trigger binding them to `type='projekt'`**, not a command-layer convention. The rule is enforced where it cannot be bypassed by a direct table write (the Epic 10 review lesson: a command-layer invariant with a direct-table-API bypass is not an invariant).

**The upgrade transition (`order → projekt`):**

- One audited command, `upgradeJobToProjekt`, joining the §14 transaction-sensitive set: flips `jobs.type`, appends a `job_events` row, writes an `audit_events` row, and unlocks the project surfaces in the same transaction.
- **One-way in Phase B.** A downgrade `projekt → order` is not built: it would have to decide what happens to payment-plan rows and project-scope data that an order cannot hold. A DB trigger rejects the reverse transition; re-opening it requires an owner decision and an ADR amendment.
- **Idempotent:** upgrading an already-`projekt` job short-circuits to the existing state (the `ALREADY_*` shape used by `provisionTenant` and `lockBillingBasis`).
- The confirmation UI states which features the upgrade unlocks before commit — the same announce-before-commit discipline as `markJobComplete` (§14).

**What this ADR does NOT decide:** the remaining job-depth tables in §9.2 (`job_material_usage`, `job_material_requests`, `job_diary_entries`, `job_deviations`, `job_chat_messages`, `job_risks`, economy companion tables) keep their §9.2 dispositions. They were never model-dependent; they parent to the container either way. Economy money stays in companion tables per §3.6 regardless of `type`.

### 8.4 The job-card field set (closes owner item `7.3`)

Owner item `7.3` ("fields on the first job card") is answered by the **N-9** scheduling-input list in the same owner answer. These are container-level fields on the job card; they are **scheduling inputs first** — E14's capacity and conflict engines consume them — and they are what the create/edit form offers.

| Field | Shape | Notes |
| --- | --- | --- |
| Estimated duration | interval / minutes | Feeds capacity math (§10.5) and the booking editor's default length. |
| Earliest possible start | date | Lower bound for scheduling suggestions. |
| Desired end date | date | Soft target — a miss is a warning, not a block. |
| Latest permitted end date | date | Hard target — a miss is a flagged breach. Distinct from the desired date; both exist. |
| Priority | closed enum | Ordering input for the planner; the value set is `[oracle-check]` against legacy usage. |
| Number of people | integer | Crew size the job needs; capacity math multiplies against it. |
| Competence / certification requirements | references to the work-role / competence catalog | Drives the competence check (N-9: "kompetenskontroller"). B1b reads the Phase A `work_roles` catalog (PB-A8 — one catalog); the richer competence/certification records are E31 (B3) and extend, never fork, this reference. |
| Location | structured place reference | Normally derived from the job's `facility_id`; overridable for work that is not at the registered anläggning. Feeds travel time. |
| Dependencies on other work items | references to other jobs / work orders | Phase B stores and displays them and warns on violation. **No automatic scheduling optimisation** (N-9 is explicit: not required in Phase B). |
| Travel time | interval | Planned travel attached to the job, consumed by capacity math; distinct from time reported against the job. |
| Responsible project manager | person reference | A `Projektledare`-role user; a tenant-level role (ADR-B001). |
| Responsible Arbetsledare | person reference | Resolves to a `job_members` row with the Arbetsledare designation — **the field is a view onto `job_members`, not a second storage location**. |
| Customer must be present | boolean | Scheduling constraint; surfaces on the booking editor. |
| Access / time windows | window records | When the site is reachable at all. A booking outside a window is a conflict-detection input (§10.1 `outside_work_hours` sits alongside it). |

Carried job-card fields from the existing surface and the earlier session §9.2 proposal remain: title, `type`, status, customer, anläggning + specific kontakt (required per owner answer `1.5`), planned start/end, budget from the accepted quote where connected, description.

**Storage disposition:** scalar fields are columns on `jobs`. The two set-valued fields — **dependencies** and **access/time windows** — are child rows (composite same-tenant FKs), not JSON, so they can be queried by the scheduling engine and constrained by the database. **Money on the job card obeys §3.6:** the budget figure is not a column on `jobs`; it is read from the economy companion projection with the §11 entitlement descriptor, so a Montör opening a job card receives no budget value at all.

### 8.5 What this unblocks, and the consequences for E16–E18

**The AC-B1b-6 gate is closed.** E16, E17, and E18 may now design schema, write stories, and implement. The gate banners on those epics in `epics-phase-b.md` are lifted.

| Epic / story | Consequence of the recorded decision |
| --- | --- |
| **E16.1 Container evolution** | Take the Option C branch: additive `type` CHECK + project-scope columns on the existing `jobs`. The Option B branch (`projects` table + `project_id`) is **deleted from the story, not kept as an alternative**. Manifest enrollment + matrix rows + per-role negatives land in the same PR (§5.5). Phase A acceptance→job and standalone-create regression proofs are acceptance conditions. |
| **E16.2 Job members** | Proceeds as written — `job_members` with the Arbetsledare designation, enforced per job inside job commands (NFR43), never tenant-wide. |
| **E16.3 Arbetsorder** | Un-gated: `work_orders` is a child of the container and valid under both types. The `[gated: 7.1/7.3 containment]` marker is removed. |
| **E16.4 Projekt upgrade** | Un-gated and now concretely specified: the audited single-row type transition of §8.3, one-way, idempotent, with project-only children DB-bound to `type='projekt'`. The job-card form uses the §8.4 field set. **Nav label: `Jobb`** — the container's name is the model's name; `Jobb & Projekt` is not used, because projekt is a state of a jobb, not a sibling entity. (`[oracle-check]` on the label survives only to confirm legacy casing/vocabulary, not the choice.) |
| **E16.5 Job workspace shell** | Unchanged — it was already model-agnostic (§8.6). It binds one container id; the `Ingående jobb` read-model that Option B would have required is **not built**. |
| **E17 (economy/material)** | Payment plan attaches to the container and is DB-bound to `type='projekt'` (Story 17.2's `[gated: 7.1/7.3 attachment]` marker resolves to exactly this). Economy rollup is per-container; no cross-job aggregation layer. |
| **E18 (field depth/completion)** | Unchanged — diary, deviations, photos, chat, risks, and `markJobComplete` all key on the container id and were never model-dependent. |
| **E14/E15 (already shipped-forward design)** | Confirmed unaffected (PB-D12): `bookings.job_id` and `time_reports.job_id` bind the container and survive the upgrade because the id does not change. |
| **Schema count (§9.2)** | The B1b gated candidate set resolves to: `jobs` column additions, `work_orders`, `job_members`, plus the ungated-by-model depth tables. **No `projects` table.** |

### 8.6 Model-agnostic invariants (retained — they now describe the chosen model)

These were written to survive whichever option won. They are retained because they are still the binding contracts, and the Option B clauses are struck:

- **Bookings bind `jobs.id`** and deepen seamlessly from Phase A basic jobs (PB-D12).
- **Job-workspace data contracts (UX §14.12):** the workspace binds **one job container id**; each tab is a read-model keyed by that id (bookings via `bookings.job_id`, files via `file_links(owner_type='job')`, time via `time_reports.job_id`, economy via the E17 companion tables). ~~Option B adds one `Ingående jobb` read-model~~ — not applicable; the UX §4.9 shell contract stands unchanged.
- **The completion event is container-level:** `markJobComplete` emits the audited completion event on the container (§14), whatever its `type`.
- **Type never widens silently:** the `type` CHECK is a closed set. A third kind of container requires an ADR amendment, not a migration.

## 8A. ADR-B007 — Installable PWA and Offline Field Capture (DECIDED)

**Trigger:** owner gate N-3 (field posture), answered 2026-07-26; **before the E14/E15/E16–E18 field-surface stories**.
**Status:** **DECIDED 2026-07-26.** Numbered `B007` and placed here (rather than renumbering §9–§23) so the ADR block stays contiguous.
**Authority:** owner answer 2026-07-26 §N-3; NFR53 (as amended below); PRD §9.1 NFR31 amendment. **Owned by Story 10.7.**

### 8A.1 Why this is an ADR and not a UX refinement

The team recommendation carried in the PRD, the UX spec (§1, §4.8, UXB-A11), and this document (§15.5, AB-A9) was **"responsive web first, no offline promise"**. The owner answered differently: an **installable PWA with genuine offline capture**. That is not a finish-level change. Offline capture introduces a **second write path with its own durability, identity, conflict, and data-at-rest semantics** — a local queue, replayed writes, and tenant data resident on field devices. Every one of those touches an invariant this architecture already enforces (idempotency, append-only audit, RLS as the authority, entity-scoped private files). It therefore gets a decision record, and §15.5 is superseded by §8A.6.

**What is explicitly still out:** a native mobile app. The owner is explicit — *"En native-app ingår inte i nuvarande scope och ska inte planeras som en separat leveransfas."* The Phase C ledger's "native mobile app" exclusion stands unamended.

### 8A.2 The decision

**One app — the same Next.js application — made installable as a PWA, serving desktop, tablet, and phone.** Field workers install it to the home screen and keep working through a temporary loss of connectivity. There is no second codebase, no second deployment, and no separate field app.

### 8A.3 Offline capability scope (a closed set, like ADR-B004's surfaces)

Offline is a **capability of named surfaces**, not a global mode. Available offline:

- read of **previously downloaded, assigned** jobs plus their basic customer and site information;
- time reporting; work notes; material usage;
- checklists / egenkontroller; deviations;
- photos and attachments within defined size limits;
- marking work items started / completed;
- signature or confirmation capture where technically and legally sound.

**Requiring connectivity by design:** administration, economy reporting, company settings, user administration, the operator console, and every other central surface. Attempting one offline yields an honest "kräver anslutning" state, never a silent stale read.

### 8A.4 The sync contract

- **Local queue.** A change is written to device storage and enqueued. It is durable from the moment the user submits it — *"Data får inte försvinna enbart för att en överföring misslyckas."*
- **Sync triggers:** immediately when online; on reconnect; on app open; on return to foreground; on explicit manual retry. **The design must NOT depend on the browser performing background sync while the app is closed** (the owner is explicit). Background sync, where the platform offers it, is an optimisation only — every unsynced item is reprocessed on next open regardless.
- **Per-change visible state**, a closed set surfaced in the UI: `SavedLocally`, `WaitingForSync`, `Syncing`, `Synced`, `Conflict`, `Failed`. A failure explains itself in plain language and offers retry.
- **Idempotent writes keyed by a client-generated operation id.** Every sync endpoint takes the operation id and is safe to replay: a re-sent change never creates a second time row, material line, or attachment. This **extends the existing command-key idempotency discipline** (§14) rather than inventing a parallel mechanism — the operation id is the command key, generated on the device instead of in the browser tab.
- **The server remains the authority.** A queued write is not an authorised write. On sync each operation passes the full envelope — membership resolution, `requireCapability` (§3.5), input validation, RLS — exactly as an online write does. An operation captured offline against a job the user has since lost access to is **rejected on sync**, surfaced as `Failed` with an explanation, and never silently applied.

### 8A.5 Conflict model (by data shape, not one global policy)

| Data shape | Policy |
| --- | --- |
| Time rows, material registrations, photos, diary entries, deviations | **Append-only separate records.** Two devices adding rows is not a conflict — it is two rows. This is the default and the reason most field capture never conflicts. |
| Shared mutable objects (job header, work-order status, checklist item state) | **Optimistic locking / version check.** The operation carries the version it was based on; a stale version returns `SYNC_OPERATION_CONFLICT` (§14). |
| Anything that cannot be resolved safely and automatically | **Surface it to the user** with both values and an explicit choice. |

**Never silently overwrite another user's change** — this is a hard rule, not a preference. A last-write-wins path anywhere in the sync layer is a review-reject.

### 8A.6 Local data at rest (this supersedes §15.5)

The Phase A/B posture "sessionStorage only, nothing long-lived on shared devices" (AB-A9) **cannot hold** — offline capture requires durable local storage. The mitigation moves from *avoidance* to *scoping and lifecycle*:

- **Scoped, never a mirror.** Only the user's assigned or explicitly selected jobs are stored locally. Downloading the tenant database to a device is forbidden by design.
- **Same permission checks as online.** Nothing may be cached that the user could not read online. **Story 10.7's stop condition is exactly this** — if a proposed offline scope needs data the user lacks permission to read, the scope is wrong, not the permission.
- **Minimised** — the projection cached is the field projection, which by §11 already excludes withheld money fields. An unentitled role's device never holds a value its screen would not show.
- **Time-boxed and purged** — a defined retention window, cleared on expiry, and cleared on logout wherever the platform permits.
- Shared-device risk is managed by scope + purge + the entitlement projection, not by refusing to store.

### 8A.7 Test obligations

- **Replay idempotency:** the same operation id submitted N times produces exactly one row — per offline-capable write type.
- **Authorisation on sync:** an operation captured against a resource the user has since lost access to is rejected, with no partial write and no existence signal.
- **Scope containment:** the offline store never holds a record outside the user's assigned scope; a negative test proves a non-assigned job's data is absent.
- **Entitlement containment:** an unentitled role's offline store contains no withheld money field (the §11 descriptor holds through the cache).
- **Purge:** logout clears the store where the platform permits; expiry clears it regardless.
- **No-data-loss:** a failed transfer leaves the change queued and re-syncable, never dropped.
- **No background-sync dependency:** the reprocess-on-open path is proven independently of any background-sync API.

### 8A.8 Consequences

- **UX spec §1, §4.8, §10 (viewport floor), §11, and UXB-A11** are superseded on posture — see §24 for the exact edits. The field surfaces themselves are unaffected in layout; what changes is that they now have offline states.
- **§15.5 (field transient-failure retention)** is superseded by §8A.6. The sessionStorage-plus-in-memory-blobs mechanism remains valid as the *online* transient-failure path; it is no longer the whole story.
- **NFR53** is restated in the PRD from "usable on the confirmed posture" to the PWA + offline requirement.
- **E14/E15/E16–E18 field stories** gain offline acceptance criteria; Story 10.7 owns the platform-level capability (installability, queue, sync engine, states, storage lifecycle) so the module epics consume it rather than each inventing one.
- **AB-A9 is superseded**; see §21.

## 9. Schema v1 Delta — New Tenant-Owned Tables Per Wave

Baseline: Phase A ships **24 tenant-owned tables** (enrolled set per `project-context.md`). Every Phase B table below is direct-`tenant_id`, RLS-forced, GRANT+policy paired, H4-enrolled, exact-policy-enumerated, composite-same-tenant-FK'd where parented, archive-over-delete, and **manifest-governed** — it may exist only when its module is `active`, activated in the same PR as its first schema change (ADR-B003). Wave tags are binding; B2/B3 rows are outline-level and are finalized at their wave-boundary checkpoint (PB-D10). Money columns are integer öre with `isOreAmount` validation; no exceptions.

### 9.1 Wave B1a (full depth) — 8 tenant-owned + 2 platform-scoped + 1 ops table

| Epic | Table | Purpose / key constraints |
| --- | --- | --- |
| E10 | `quote_follow_ups` | Follow-ups on sent quotes: due date, note, status open/completed, outcome. Partial unique index: one open follow-up per quote (UXB-A6). |
| E10 | `quote_lost_reasons` | One row per lost/declined version (`unique (quote_version_id)`): outcome ∈ {förlorad, avböjd}, category, note. Insert-only (no UPDATE policy); the status flip itself is an append-only `quote_events` row via the widened lifecycle RPC (§14). Sent snapshot untouched (FR63). |
| E11 | *(no new table)* | Role mechanism = `tenant_memberships.role` CHECK widening + `membership_roles` reserved extension (§3.2). Permission matrix is code (§3.3). Invitations reuse `status='invited'`. |
| E12 | `platform_operators` **(platform-scoped)** | Operator allow-list (user_id, granted_at/by). **Not tenant-owned** — the enumerated exception class (§2/ADR-A002 delta); RLS: operator-only self-read; consulted via `is_platform_operator()` DEFINER helper (hardened shape). |
| E12 | *(columns)* | Provisioning/onboarding state: additive columns on `tenants` (provisioning status) — the onboarding checklist is **derived** from server data, not stored; per-admin dismissal is a small column, not a table. |
| E13 | `notifications` | Per-user in-app notifications: category, title, route (deep link), read_at. |
| E13 | `notification_preferences` | user × category × channel toggles; essential categories non-disableable server-side. |
| E13 | `email_outbox` | Outbound queue: recipient, category, template key/params, dedupe key (unique), status, attempts, next_attempt_at. |
| E13 | `email_delivery_events` | Append-only delivery log (queued/sent/failed/suppressed events, provider message id). |
| E13 | `email_suppressions` | Suppression list (recipient, scope/category-class, reason, created_at). |
| E13 | `email_unsubscribe_tokens` | Hashed capability tokens per (recipient, category-class) — ADR-B004 rules. |
| E13 | `job_runs` **(ops)** | Producer run log (producer id, window, outcome, error summary) — powers freshness stamps + Admin failure visibility (§4.3). Tenant-scoped rows for per-tenant producers; platform rows for global sweeps. |

### 9.2 Wave B1b (full depth) — 8 ungated + gated job-depth candidates

| Epic | Table | Purpose / key constraints |
| --- | --- | --- |
| E14 | `person_profiles` | **The single person record (PB-D13):** 1:1 with `tenant_memberships` (`unique (membership_id)`), default work role (FK to Phase A `work_roles` — one catalog, pricing + scheduling consumers, PB-A8), capacity basics. B3 HR extends **this record** (columns/child tables); a parallel employee table is forbidden. |
| E14 | `person_work_hours` | Normalized weekly work-hours template rows per person, plus per-person exceptions (vacation, sick leave, leave, training, blocked time) and shift/break structure. **Capacity derives from these rows, not from employment percentage** (N-9, §10.5A); percentage is stored as a check value. |
| E14 | `tenant_calendar_days` | **Built (no longer reserved)** — N-9 requires it: per-tenant closed days, half days, klämdagar, collective-agreement leave, company activities, reduced-capacity periods, layered over the central Swedish public-holiday source (§10.5A). |
| E14 | `bookings` | Booking rows (incl. materialized recurrence occurrences): time range (timestamptz UTC), all-day flag, work role, optional connections (job/customer/facility/contact — all nullable, PB-D12), description, status, series linkage (`series_id`, occurrence index, `is_exception`). |
| E14 | `booking_assignees` | Multi-assignee join (booking × person), composite same-tenant FKs. |
| E14 | `booking_conflicts` | Materialized conflict workflow records: type (double_booking / over_capacity / outside_work_hours), participants, window, status open/accepted/resolved, required reason on accept, resolver outcome + actor (§10.2). Detection stays deterministic/derived; this table persists workflow state. |
| E15 | `booking_series` | Recurrence rule (preset patterns + end condition — no freeform RRULE in B1), expansion horizon bookkeeping; occurrences materialize as `bookings` rows (§10.3). |
| E15 | `time_reports` | Own-row-scoped reports: user, date, duration, optional booking/job links, note; a `status` column ships with the single value `submitted` — the reserved approval seam (§10.6). |
| E15 | `calendar_feed_tokens` | Hashed per-user feed tokens (ADR-B004, §6.3). |
| E16–E18 | **Resolved by ADR-B006 (§8.3)** | Container evolution is **additive columns on the existing `jobs`** (`type` CHECK + nullable project-scope fields + the §8.4 job-card fields); **there is no `projects` table**. New tables: `work_orders`, `job_members` (per-job roles incl. Arbetsledare), `job_dependencies` + `job_access_windows` (the two set-valued §8.4 fields), `job_material_usage`, `job_material_requests`, `job_payment_plans` (+ items; DB-bound to `type='projekt'`), `job_diary_entries`, `job_deviations`, `job_chat_messages`, `job_risks` (~11–13 tables). Economy money lives in companion tables per §3.6 (rollup inputs valued in economy read-models; budget snapshot from the accepted quote — never a column on the container). Photos/documents are **not** new tables — they are `files`/`file_links` with job-scoped owner types/purposes (§12). |
| E19 | *(no new table)* | Dashboard widgets are registry-derived reads over module data (§15.2). |

### 9.3 Wave B2 (outline — finalized at the B1b→B2 checkpoint)

| Epic | Tables (outline) | ~Count |
| --- | --- | --- |
| E20 documents center | none — aggregation read over `files`/`file_links` (PB-D6, §12) | 0 |
| E21 rentals | `rental_items`, `rental_orders`, `rental_order_lines`, `rental_order_events`, `rental_billing_records` (feeds E26) | 5 |
| E22 assets + QR | `assets`, `asset_assignments` (person via `person_profiles`), `asset_events`, `asset_fault_reports`, `asset_mileage_logs`, `asset_qr_tokens` (ADR-B004) | 6 |
| E23 service + warranties | `service_agreements`, `service_plans`, `service_records`, `service_suggestions` (scan-fed via ADR-B002), `warranties` (created by the completion event) | 5 |
| E24 panels | `panels`, `panel_groups` (gruppförteckning rows incl. RCD data) | 2 |
| E25 supplier data | `suppliers`, `supplier_price_lists`, `supplier_articles`, `supplier_discount_agreements` (row-sensitive → role-gated RLS), `supplier_import_runs` (wizard audit) | 5 |
| E26 billing basis | `billing_bases`, `billing_basis_lines` (copy-by-value snapshots), `billing_basis_events` (append-only) — lock discipline §13 | 3 |

### 9.4 Wave B3 (outline — finalized at the B2→B3 checkpoint)

| Epic | Tables (outline) | ~Count |
| --- | --- | --- |
| E27 DoU | `dou_projects`, `dou_templates`, `dou_documents`, `dou_document_versions` (versioning + lock via the trigger family). **N-8:** each published template version carries `TemplateId`, `Title`, **`ContentOwnerUserId` (a configurable user/role reference — never a hardcoded name)**, `ApprovedByUserId`, `Version`, `EffectiveFrom`, `EffectiveTo`, `Status`, `ChangeSummary`, `SupersedesTemplateVersionId`; statuses `Draft → UnderReview → Approved → Published → Superseded → Archived`. | 4 |
| E28 self-inspections | `inspection_templates`, `inspection_template_items`, `self_inspections`, `self_inspection_items` (responses/measurements). Same N-8 template-version contract as E27. | 4 |
| E29 tenders thin core | `tenders` (manual summary fields; files via `file_links`) | 1 |
| E30 KNX | `knx_projects`, `knx_rows` | 2 |
| E31 HR depth | extends `person_profiles` (employment columns/child) + `competence_cards`, `certifications`, `training_plans`, `hr_incidents`, `deletion_requests`, **`retention_policies`** (the central versioned policy per §12B), `improvement_suggestions` (authenticated, P70-thinned). HR data row-sensitive → role-gated RLS (§3.6). | ~7–8 |
| E32 notes + CRM completions | `notice_posts` (+ categories/pins/mentions via E13), `customer_favorites`; customer-360/classification are read-models + small columns | ~2 |
| E33/E34 Fortnox | `fortnox_connections`, `integration_outbox`, `external_mappings` — **only after the final ADR-B005**, only with E33 activation | 3 (sketch) |

**Summary:** B1a adds 8 tenant-owned tables (+2 platform-scoped, +1 ops); B1b adds 8 ungated + ~9–11 gated job-depth candidates; B2 outlines ~26; B3 outlines ~19–20 (+3 Fortnox post-ADR). Every activation extends `TENANT_TABLES`, the exact-policy enumeration, and the per-role negative suite in the same PR.

## 10. Scheduling and Booking Engine

### 10.1 Conflict detection (FR85, NFR48)

- **One pure engine:** `src/features/scheduling/conflicts.ts` — deterministic function of (candidate booking(s), existing bookings, work-hours templates, capacity rule config). No I/O, no clock reads (the Phase A engine discipline). Conflict types: `double_booking` (assignee overlap), `over_capacity`, `outside_work_hours`, plus `outside_access_window` and `competence_missing` from the N-9 job-side inputs (§10.5A, §8.4). Rules enter as injectable config + golden fixtures, never hardcoded — the N-9 rule set is now supplied (§10.5A), so the fixtures can harden.
- **Server is the authority:** booking commands re-run detection server-side inside the write transaction (§14); the editor's live warnings call the same engine (shared module) — preview and save can never disagree (the readiness-classifier precedent).
- A missed conflict or a phantom conflict is a correctness defect with a regression fixture, not a UX nit (NFR48).

### 10.2 Warn-and-allow audited override (validates UXB-A10 / UX §14.3)

The UX assumption is **validated with one amendment**: `Boka ändå` is not a flag on the booking — it is a **persisted conflict record in state `accepted`**:

- Saving with conflicts requires explicit acknowledgment + required reason; the command persists the booking **and** `booking_conflicts` rows (state `accepted`, reason, actor) in the same transaction, plus an audit event. Unacknowledged detected conflicts persist as state `open` (they feed the resolver queue and the `Konflikter (n)` chip).
- Resolver actions (`Flytta`/`Omfördela`/`Justera`) re-run detection after the edit and mark the conflict `resolved` with outcome + actor + timestamp; affected assignees are notified via E13 (`booking.changed`).
- **Conflict identity across recurrence (UX §14.3):** conflicts key on materialized occurrence rows — natural key (type, booking ids / person, window). Editing a booking or re-expanding a series **re-derives** detection: an accepted conflict whose natural key still holds carries its accepted state forward; a changed window re-opens detection (accepted state never silently blankets a *different* collision). Sibling-occurrence conflicts are grouped by series for the resolver's `Åtgärda hela serien`.
- Suggested free slots (`Flytta`) are computed by the same engine inverted (find windows with zero conflicts for the same assignees) — a convenience projection, never an authority.

### 10.3 Recurrence model and exception storage (FR88; UX §14.4)

- **Materialized occurrences:** a `booking_series` row holds the rule (preset patterns: daily / weekly with weekday picker / biweekly / monthly + end condition until-date or N times — end condition **required**, no unbounded series in B1); occurrences are real `bookings` rows generated by **one pure expansion function** shared by the editor preview ("next ~10 occurrences") and server materialization — deterministic by construction.
- **Exceptions:** an edited occurrence sets `is_exception` and diverges (series edits no longer overwrite it); a cancelled occurrence remains as a cancelled tombstone (prevents regeneration). Both render as "avviker från serien".
- **"Detta och kommande":** series split — the existing series truncates before the pivot; a new series (new rule row) owns the pivot onward; exceptions before the pivot stay with the old series. Occurrence rows keep stable ids across the split wherever their times are unchanged (conflict identity, feed stability).
- Recurrence participates fully in conflict detection (expansion output feeds the same engine).

### 10.4 Timezone and DST strategy (NFR48)

- **Storage:** all instants are `timestamptz` (UTC). **Interpretation:** recurrence rules, work hours, capacity windows, and all-day boundaries are evaluated in the tenant's IANA timezone — fixed default `Europe/Stockholm`, held as a tenant setting seam (no UI in B1).
- **Expansion:** calendar-date arithmetic in tenant TZ, then convert to UTC — a weekly 07:00 booking stays 07:00 local across DST transitions.
- **DST edge policy:** spring-forward nonexistent local times shift forward to the first valid instant; fall-back ambiguous local times resolve to the **first** (earlier) instant. Both are golden-pinned with boundary fixtures (spring and autumn transition weeks) in unit CI (AC-B1b-1).

### 10.5 Capacity and work hours (FR86)

Capacity math = booked time vs available time derived from `person_work_hours` templates + rule config. The architecture guarantee stands: rules are config + data, never schema — new rules must not require schema rework. **N-9 (answered 2026-07-26) supplies the rules — see §10.5A.** The `[gated: N-9]` markers on the conflict-rule set (§10.1) and the capacity fixtures resolve against it.

### 10.5A Scheduling inputs and capacity rules (N-9, answered 2026-07-26)

**The governing principle: capacity comes from the ACTUAL weekly schedule, not from employment percentage.** The owner's example is the whole point — *a person at 80 % may work four full days or five short ones*, and those two are not interchangeable for planning. **Employment percentage is a check and calculation value; the actual weekly schedule determines availability.** A model that derives availability from a percentage is wrong.

Per person, the model must be able to express: employment period; employment percentage; timezone; a **recurring weekly schedule**; shift start and end times; breaks; individual schedule exceptions; vacation; sick leave; leave of absence; training; other blocked time.

The company defines a **default working schedule that new users inherit**. There is **no globally hardcoded assumption** that every company or employee works the same hours or the same weekdays — a constant of that kind anywhere in the capacity engine is a defect.

**Capacity formula:**

```text
  scheduled working time
− public holidays and closed days
− absence
− existing bookings
− blocked internal time
− planning buffer (optional)
= available capacity
```

- **Overtime is not ordinary capacity.** It is added only by an explicit decision from an authorised user — which makes it a permissioned action, not a slider.
- **Overbooking is allowed but always warns.** For larger overruns the system must be able to require a specific permission or confirmation — this maps onto the existing §10.2 warn-and-allow audited override, with the acknowledgment threshold as rule config.

**Holiday and company calendar:** a **centrally maintained Swedish public-holiday calendar**, plus per-tenant registration of local closed days, half days, *klämdagar*, collective-agreement leave, company-wide activities, and other reduced-capacity periods. Individual per-user exceptions on top. This confirms and requires the `tenant_calendar_days` table that §9.2 held in reserve — **it is built**, alongside the central holiday source.

**Job-side scheduling inputs** are the ADR-B006 §8.4 job-card field set — estimated duration, earliest start, desired and latest end, priority, crew size, competence requirements, location, dependencies, travel time, responsible PL and Arbetsledare, customer-presence requirement, and access windows.

**No automatic optimisation is required in Phase B.** Manual scheduling with capacity warnings, conflict warnings, competence checks, travel-time information, and clear free-vs-booked visualisation is the target. An optimiser is not a stretch goal to sneak in; it is out of scope.

### 10.6 Time reports (FR90; UX §14.5 — decided disposition)

- Own-row-scoped filing (RLS: own rows; review surfaces role-gated per matrix). Reports flow to job economy (E17) and billing basis (E26) without re-entry (FR92): consumers read `time_reports` by job/period; **valuation** (hours × role rates) happens in economy read-models/companion tables so report rows themselves carry no money (§3.6).
- **Approval: no hard approval state ships in B1b (PB-A9 resolved for now).** The `status` column exists with the single value `submitted`; review/annotation are affordances, not states. A hard approval state is introduced **only if** the N-5 billing-basis content definition or the owner requires "approved time" as a billing precondition — decided at the B1b→B2 checkpoint with E26 design; adding it then is an additive enum widening + command, zero rework (the UX's reserved status column maps to exactly this).

## 11. Entitlement / Field-Presence Contract (UX §14.1)

The deterministic payload contract behind `MaskedValue` and column omission:

- **Read-models:** Phase B introduces `src/server/read-models/**` — per-surface server query modules (consumed by server components/route handlers) that (a) query via the RLS client, (b) apply the permission matrix's sensitive-field projection for the caller's role set, and (c) return `{ data, entitlements }`.
- **The descriptor:** `entitlements: { withheld: FieldPath[] }` — a withheld field is **absent from `data`** (never `null`, never `0`) *and* listed in `withheld`. UI rule: absent + listed = render `MaskedValue`/omit column; absent + not listed = genuinely empty. The UI never consults role names client-side.
- **Aggregate honesty is computed server-side:** an aggregate with any withheld component is itself withheld (listed, absent) — the server never ships a partial sum (UX §3.2 rule 4).
- **Table column sets** derive from the descriptor (a wholly-withheld column is omitted, not masked per cell).
- **The security floor is §3.6 (RLS/companion tables), not this projection** — the descriptor is the UX-determinism layer on top. A crafted request bypassing the read-model hits the RLS floor.
- Emails and exports (PDF/reports) build from the same projection for their recipient (NFR47).

## 12. Documents-Center-Compatible File Metadata Contract (PB-D6; UX item — file model)

- **Every B1+ module stores files exactly per the Phase A model:** private bucket, tenant-first server-derived paths, `files` metadata + polymorphic `file_links` (`owner_type`, `owner_id`, `purpose`) — no per-entity file FKs, no per-module buckets, no second file table. New owner types (e.g. `booking`, `work_order`, `rental_order`, `asset`, `dou_document`, `self_inspection`, `tender`) and purposes (e.g. `job_photo`, `deviation_photo`, `delivery_note_pdf`, `asset_document`) are **declared in the manifest per module** and become valid only on activation (the Phase A closed-union validation pattern, now manifest-derived — §5.3).
- Job photos, diary/deviation attachments, delivery notes, QR label PDFs, DoU documents, tender files are all `files` + `file_links` rows — one pool, contextual links (matches UX §4.9 Foton).
- **The E20 documents center is an aggregation read-model** over this metadata (filter by module/owner-type/purpose/date; signed-URL preview; archive/restore honoring archive-over-delete P55). It adds zero storage tables. The `Filer` → `Dokument` transition is a manifest nav-item swap at E20 activation.
- Lock/immutability: customer-visible or committed documents (billing-basis exports, DoU locked versions) join the DB-trigger lock family with parent-side apply triggers where the create path is frozen (the proven 8.4 shape).

## 12A. ADR-A004 Amendment — Ratified VAT Rounding, Deduction Classification, and Reverse Charge (DECIDED)

**Trigger:** the carried tax gates `A.1`/`A.2`, `B.1`–`B.4`, `C.1`–`C.3`, and `2.2`, answered 2026-07-26.
**Status:** **DECIDED 2026-07-26.** Numbered `12A` (rather than renumbering §13–§23, which would break inbound references) and placed ahead of §13, which consumes it. **Owned by Story 10.6.**
**Authority:** `docs/discovery/phase-b-accountant-answers-2026-07-26.md`, recorded in `owner-signoff-questions.md`. Peppol/EN 16931 **BR-CO-17**; Skatteverket guidance; Lag (2009:194) and Lag (2020:1066) on the procedure for tax reduction.

### 12A.1 What changed, and why this is an amendment rather than a restatement

ADR-A004 (integer öre + snapshotted tax assumptions) is **carried unchanged in its mechanism**: money stays integer öre end-to-end, arithmetic stays in `@/lib/money`, tax assumptions stay snapshotted onto the quote version. The ADR-A004 STOP condition — *"no new rounding rule may be invented"* — is also carried, and is precisely why this section exists: **the rule is not being invented, it is being supplied by the accountant**, which is the one sanctioned way it may change.

Most of the accountant's answers **confirmed** the shipped assumptions (25 % VAT; ROT 30 %; ROT cap 50 000 SEK/person/year; grön teknik 15 / 50 / 50 %; grön cap 50 000). Three did not, and two of those **contradict behaviour that is already shipped**. Documenting them without correcting the engine would leave the docs describing an engine we know to be wrong, so they are recorded here as decisions and implemented by Story 10.6.

### 12A.2 VAT rounding scope — per VAT category at DOCUMENT level (corrects shipped behaviour)

**The frozen Phase A architecture's Rounding section says:** *"Calculate VAT per line from rounded line net … Sum rounded line values for section and quote totals."* The shipped engine implements exactly that (`src/lib/money/ore.ts`: line-level rounding, `sumOre` = sum-of-rounded). **That model is superseded.**

The ratified rule:

1. **Line NET rounds to two decimals (whole öre)** — unchanged from Phase A, and still the single `roundToOre` primitive.
2. **Taxable basis is summed per VAT category and rate** across the document.
3. **VAT is computed and rounded on that summed per-category basis** — not per line, and never by summing rounded per-line VAT amounts.
4. **Document VAT total** = the sum of the per-category VAT amounts.
5. **Display is two decimals** in the PDF and any e-invoice.

The accountant's explicit warning is the reason this cannot be treated as a rounding nicety: *the per-line model yields a different total depending on how the same work is split into lines.* Two economically identical quotes that differ only in line granularity must not produce different VAT. That property — call it **split invariance** — is the testable statement of the rule and is pinned in §16.6.

Canonical settings:

```text
VatRoundingScope    = PerVatCategoryAtDocumentLevel
CurrencyDecimals    = 2
PayableRounding     = None   # see 12A.3
```

**Öresavrundning to whole kronor** is supported but **off by default**. When enabled, the difference appears as a **separate document-level row** ("Öresavrundning +0,37 kr"). It is never achieved by adjusting VAT or by editing invoice lines. Skatteverket permits rounding the payable total to whole kronor; it is not required for electronic payment, hence the default.

**Rounding mode:** the pinned half-away-from-zero mode (`tests/fixtures/golden/money/rounding-mode.json`) is unchanged. What changes is **where** rounding is applied, not **how** a half is broken.

### 12A.3 Amounts claimed from Skatteverket truncate to whole SEK

Amounts **claimed from Skatteverket** for ROT and grön teknik are stated in whole kronor with **öre discarded — truncation downward, not rounding to nearest**. The PDF may still display the amount with decimals (`−3 750,00 kr`); the claim value is the truncated one. Where a deduction is allocated across several people, allocation is in **whole kronor summing exactly to the invoice's deduction** — no per-person residue.

```text
TaxReductionClaimRounding = Whole SEK, discard cents
```

This is a **third distinct rounding rule** in the system (line net → öre; VAT → öre per category at document level; claim → truncated whole SEK). They must not be collapsed into one helper. Each gets its own named primitive so a call site cannot silently use the wrong one.

### 12A.4 Row visibility does not drive economic inclusion (corrects a shipped assumption)

**The shipped assumption** — carried in the Phase A PRD (FR25 hidden rows) and its golden coverage (Story 5.5) — is *"hidden rows always count in both the total and the deduction basis"*. **That is wrong on the second half.** Correct for the total when the row is billable; not automatically correct for tax reduction.

A row needs **three independent properties**, and no one of them may be derived from another:

```text
VisibleToCustomer        # a presentation property, and ONLY that
IncludedInInvoiceTotal   # is the row billed to the customer at all
DeductionClassification  # what tax reduction, if any, the row's cost type supports
```

```text
DeductionClassification ∈ {
  NONE,
  ROT_LABOR,
  GREEN_SOLAR_LABOR,   GREEN_SOLAR_MATERIAL,
  GREEN_STORAGE_LABOR, GREEN_STORAGE_MATERIAL,
  GREEN_CHARGING_LABOR, GREEN_CHARGING_MATERIAL
}
```

Resulting behaviour (the accountant's table, restated):

| Row kind | In total | In ROT basis | In grön-teknik basis |
| --- | --- | --- | --- |
| Billed electrician labour | Yes | Yes, if the work is ROT-approved | Yes, if part of an approved installation |
| Billed material | Yes | **No — material is never ROT-eligible** | Yes, if part of an approved installation |
| Travel, vehicle, machine, administration | Yes | **No** | **No** |
| Internal cost row not billed to the customer | **No** | No | No |
| Cost baked into a visible fixed package price | Yes, via the package price | Per the actual labour share | Per actual split, or the 97 % schablon |

**The invariant to hold onto:** hiding a row is a presentation decision and must never change what the tax reduction is computed on. Skatteverket requires labour, material, and other costs to be kept apart for both ROT and grön teknik; the customer's invoice need not itemise hidden detail rows, but it must carry visible summaries that separate labour / material / other costs / VAT / ROT-or-grön / amount payable, and that reconcile.

### 12A.5 Reverse charge is a VAT TYPE, not a 0 % rate

Construction-sector reverse charge (*omvänd betalningsskyldighet*) can apply to electrical work on property when the buyer is a construction business that more than occasionally sells relevant construction services, or is an intermediary in such a sale. It is **not** a zero rate and must not be modelled as one — a 0 % rate would silently merge with genuine zero-rated cases and would produce the wrong document text and the wrong VAT reporting.

```text
VatType ∈ { STANDARD_VAT_25, REVERSE_CHARGE_CONSTRUCTION, … }   # default STANDARD_VAT_25
```

- The document is issued **without charged VAT**, carries the **buyer's VAT registration number**, and prints the text **"Omvänd betalningsskyldighet"**.
- **Being a company is not sufficient.** The system requires an explicit per-document choice or a verified customer setting; it must never infer reverse charge from customer type.
- Material supplied **as part of** the construction service follows the service's VAT treatment; a plain sale of goods normally does not.
- `VatType` is a **per-VAT-category key** for §12A.2 — the document-level summation groups by (VAT type, rate), so a mixed document sums each category separately.

### 12A.6 Rates and caps are time-versioned data, not constants

Rates, caps, and calculation rules carry `ValidFrom` / `ValidTo` and are resolved by date — not held as permanent constants. The ratified values as of 2026-07-25:

```text
VAT_DEFAULT_RATE                     = 25 %
ROT_RATE                             = 30 %          # the temporary 2025 uplift has lapsed
ROT_MAX_PER_PERSON_YEAR              = 50 000 SEK
ROT_RUT_COMBINED_MAX_PER_PERSON_YEAR = 75 000 SEK    # new: the combined ceiling is also representable
ROT_BASIS                            = eligible labour INCLUDING VAT
GREEN_SOLAR_RATE                     = 15 %
GREEN_STORAGE_RATE                   = 50 %
GREEN_CHARGING_RATE                  = 50 %
GREEN_MAX_PER_PERSON_YEAR            = 50 000 SEK    # separate from the ROT/RUT ceiling
GREEN_DEFAULT_BASIS_METHOD           = ACTUAL_ELIGIBLE_COSTS
GREEN_FIXED_PRICE_ELIGIBLE_SHARE     = 97 %          # opt-in only
```

Further ratified detail that the engine must respect:

- **ROT basis** is eligible labour **including VAT**, and should be derived from the VAT actually attaching to the ROT-eligible labour rows rather than by hardcoding × 1,25 — because a document may not be uniformly 25 %.
- **ROT ordering:** labour ex-VAT → VAT per normal rules → ROT-eligible labour incl. VAT → 30 % → cap per person → truncate to whole SEK → subtract from the gross to get the customer's payable. ROT is a split of the payment between customer and Skatteverket, **not** a reduction of the VAT basis.
- **Grön teknik 97 % schablon** applies **only** to a genuine fixed-price total contract (*totalentreprenad till fast pris*) and is an explicit user choice; the default is actual eligible costs, with **no** additional 3 % reduction. A mixed project (e.g. solar + storage) **splits its basis per category before** applying 15/50/50. The same installation part may never support both ROT and grön teknik.
- **ROT tax year follows the customer's PAYMENT date, not the invoice date** — this determines which year's remaining allowance applies.
- The customer's remaining allowance is **customer-declared input**, not something the company can verify; the field exists and the estimate is explicitly preliminary.

### 12A.7 Blast radius and the immutability boundary

Affected: `@/lib/money` and `@/lib/tax`, the calculation engine's total and deduction paths, quote snapshot builders, the quote PDF, and **every money/tax golden-master fixture** (Stories 4.4, 5.5) — those are re-derived, not patched, and the diff in expected values is the evidence that the rule changed.

**The hard boundary, carried from ADR-A005:** an already-**SENT** quote version's frozen snapshot is **immutable**. The corrected rules apply to **new** versions only. Recomputing a sent snapshot under new rules is forbidden, and that is Story 10.6's stop condition. This is also why §13's real-invoicing block matters: the correction must land before real ROT/grön-teknik documents leave the system, because a document already sent cannot be retro-corrected in place.

## 12B. Data Lifecycle, Retention, and Deletion Groundwork (N-10, answered 2026-07-26)

**Status:** decided as a **Phase B technical foundation**. The full legal and automated GDPR programme stays in Phase C (the ledger is unamended) — but N-10 is explicit that *"den tekniska grunden måste finnas från början"*, so the fields, states, and policy indirection land in Phase B. E31 (B3) owns the workflow; every earlier module that stores identifiable-person data adopts the field contract as it activates.

**Scope — every identifiable natural person, not just customers and ex-employees:** employees, former employees, private customers, sole traders, **contact persons at corporate customers**, subcontractors, job applicants, **people appearing in photos**, and people named in signatures, notes, or work documents. The photo clause matters here specifically: job photos (E18) are person data whenever someone is in frame, and the file model (§12) must carry the retention fields, not just the business tables.

**Leaver flow (when an employee departs):** deactivate the account → revoke active sessions and credentials → prevent new login → remove the person from future scheduling → **reassign open tasks and responsibilities** → retain historical records where there is a documented need or legal requirement → delete or anonymise the remainder when the defined retention period expires.

**Historical data is NOT hard-deleted merely because a relationship ended.** Bookkeeping, payroll, contracts, warranties, insurance matters, legal claims, and work-environment or safety documentation all create retention duties that outlive the relationship.

**Ordinary tenant administrators may not hard-delete** users, customers, time reports, invoice bases, or financial documents. Deletion happens only through the controlled workflow. This is enforcement, not policy text — it aligns with the existing archive-over-delete posture (no DELETE grant on tenant tables) and extends it: the workflow, not the admin, is the delete authority.

**Field contract** (adopted per table as modules activate):

```text
RetentionCategory  RetentionPolicyId  RetentionUntil
DeletionRequestedAt  DeletionRequestedBy  DeletionStatus
LegalHold  RestrictedAt  AnonymizedAt  DeletedAt
DeletionDecisionReason  DeletionApprovedBy
```

**Deletion-request states:** `Received → IdentityVerificationRequired → UnderAssessment → PartiallyApproved | Approved | Rejected → Executed → Closed`. The workflow must record who the request concerns and when it arrived, verify identity, locate the relevant data, **separate deletable data from data that must be retained**, delete or anonymise what is permitted, restrict access to what must be kept, document the decision and its legal basis, and track the response deadline and the date answered.

**`LegalHold` blocks automatic purging** for anything under dispute, investigation, or a documented preservation duty. A hold overrides an expired `RetentionUntil` — the purge job must consult it, and a purge path that does not is a defect.

**Retention periods live in a central, versioned policy — never scattered constants.** Each policy carries `DataCategory`, `LegalBasis`, `Purpose`, `RetentionPeriod`, `RetentionStartEvent`, `DeletionMethod`, `AnonymizationMethod`, `PolicyOwner`, `EffectiveFrom`, `EffectiveTo`. This is the same `ValidFrom`/`ValidTo` shape as §12A's tax rates and for the same reason: a value with legal consequences that changes over time is data, not a constant.

Baseline categories: active user profile (kept while active); closed user profile (deactivated immediately, purged per policy); time and payroll basis (per legal/contractual need); invoices and accounting records (per bookkeeping rules); job notes and photos (per purpose, warranty, and contract need); contact persons (purged when the business relationship and any other need has ended); never-accepted invitations (purged after a short defined period); security and audit logs (per the separate security policy); support cases (per support/contract/security need).

**Controllership:** each customer company is normally controller for its employees, customers, and job data, with us as processor. We are separately controller for our own data — contract contacts, subscription and billing, support contacts, security logs, our own user and administrator records. Technical features support that split; they do not replace the contracts, privacy information, and DPA that establish it.

## 13. Billing Basis (B2) — Placement and Lock Immutability

- **Placement (PB-D11):** E26 closes B2; it consumes job economy (E17), rental billing records (E21), and service records (E23); Fortnox (B3) consumes it. The Fortnox spike runs during B2 in parallel.
- **Assembly:** candidate lines are **copy-by-value snapshots** (the Phase A snapshot discipline): each `billing_basis_lines` row freezes source refs + description + öre amounts at assembly time; source-record changes never silently alter an assembled basis. **The content definition is no longer gated — N-5 supplied it: see §7.3** for the per-kind field sets (time / material / fixed price / payment plan / other), the canonical line shape, and the double-invoicing lock on consumed source items.
- **Adjustments pre-lock:** audited with required reason (`billing_basis_events` append-only + audit event).
- **Lock:** the sketch `Utkast → Låst → Exporterad` is **superseded by the N-5 status flow** `Draft → UnderReview → Approved → Exported → PartiallyInvoiced → Invoiced → Cancelled` (§7.3), and the basis is **versioned**: an Approved version cannot be edited without reopening or being replaced, so the exported basis stays reconstructible. `lockBillingBasis` is a transaction-sensitive RPC (§14); locked bases are **immutable via a DB trigger pair** — the fourth scope of the shared lock-code family (new SQLSTATE + command code `BILLING_BASIS_LOCKED`, same enumerate-the-exempt-tuple shape, reversal + identity-column tests mandatory). Corrections after lock follow the audited-correction pattern (NFR23 family): a correcting basis references the original; the original never mutates.
- **Correctness binding (NFR49):** amounts are engine-derived integer öre with golden/regression coverage before real invoicing use. Tax gates `A`/`B`/`C` + `2.2` were **answered 2026-07-26** and are recorded in **§12A** — so the block is no longer "pending an owner answer", it is **pending Story 10.6 landing the answered rules in the engine**. Until then real-customer invoicing stays blocked (sign-off register + the UX correctness banner); the demo track is unaffected. Billing-basis assembly and line VAT **must consume the §12A rules** — per-category document-level VAT, `DeductionClassification` per line, `VatType` per category, truncated claim amounts. No new rounding rule may be introduced here beyond §12A's three named ones (STOP condition carried from ADR-A004).

## 14. Command Layer and RPC Extensions (ADR-A009 pattern)

All new sensitive mutations use the Phase A envelope (+ the §3.5 capability gate). Transaction-sensitive multi-record commands use narrow **SECURITY INVOKER** RPCs per ADR-A009. The Phase B transaction-sensitive set:

| Command | Why transactional | Idempotency |
| --- | --- | --- |
| `createBooking` / `updateBooking` | booking + assignees + materialized conflict rows + acceptance state in one write (§10.2) | client-supplied command key on create; natural on update |
| `createBookingSeries` / `updateBookingSeries` (incl. "this and following" split) | series row + occurrence materialization (+ exception preservation) atomically | series-level dedupe key |
| `resolveConflict` | booking edit + conflict state flip + outcome record (+ notification enqueue) | conflict id + action |
| `markQuoteVersionLost` | widens the existing `mark_quote_version_lifecycle` RPC: append-only `quote_events` flip + `quote_lost_reasons` insert; sent-lock untouched | one lost-reason row per version (unique) |
| `markJobComplete` | completion event + downstream seeds (warranty stub when E23 active) in one transaction; **active-consumer flags are computed server-side from the manifest and passed to the RPC explicitly** — the RPC never guesses scope | one completion per job (unique/state guard) |
| `upgradeJobToProjekt` (ADR-B006 §8.3) | `jobs.type` flip + `job_events` row + audit row + project-surface unlock in one write; one-way (a DB trigger rejects `projekt → order`) | already-`projekt` short-circuits to existing state |
| `lockBillingBasis` | status flip + line freeze finalization + lock-apply + events | already-locked short-circuits to existing state |
| `provisionTenant` | tenant + baseline settings + first-Admin invited membership atomically | idempotent on org identity/key — re-run returns "already provisioned" (UX §4.3) |
| email-queue claim/process (producer-side) | claim-with-`FOR UPDATE SKIP LOCKED` + delivery-event append | dedupe key; provider message id recorded before `sent` |

Deliberate exceptions to INVOKER-default, each with the Phase A DEFINER hardening (fixed empty `search_path`, schema-qualified refs, explicit authorization check inside, revoked from PUBLIC, dedicated negative tests):

1. **`provision_tenant` is SECURITY DEFINER**, gated on `is_platform_operator()` — the operator has, by definition, no membership in the tenant being created (the chicken-egg); this is the sanctioned, separately-approved DEFINER case foreseen by ADR-A009. Supabase Auth admin-invite runs server-side in the command (service context), never in the RPC, never client-reachable.
2. **Background producers** run on the §4.3 service context with explicit per-tenant iteration — not an RPC exception but the one non-user execution context; containment rules in §4.3 apply.

Single-row mutations (role changes, follow-up scheduling/completion, notification read flips, preference toggles, conflict acceptance without booking edit) remain envelope commands on RLS-protected queries. Error codes extend the stable family: `PERMISSION_DENIED`, `BOOKING_CONFLICT_UNACKNOWLEDGED`, `SERIES_EDIT_SCOPE_REQUIRED`, `BILLING_BASIS_LOCKED`, `ALREADY_PROVISIONED`, `TOKEN_REVOKED`, `JOB_TYPE_DOWNGRADE_FORBIDDEN`, `SYNC_OPERATION_CONFLICT` (public surfaces map to generic responses, §6.2).

## 15. Application Shell, Registries, Landing, Operator Console, Field Retention

### 15.1 Nav registry (UX §14.2)

`src/scope/nav-registry.ts` — **one derivation**: manifest (`navItems` of `active` modules, §5.2) × permission matrix (`requiredCapability`) → the grouped sidebar model (groups, order, icons, labels). The AppShell nav island renders the registry filtered by the session's role set; the server independently authorizes every route (FR67/72 — nav visibility is never the authority). The manifest validator traces every nav item to an active module (NFR51); hide-don't-disable and the `Filer`→`Dokument` swap fall out of the derivation. Group collapse state is per-user UI state, not registry data.

### 15.2 Dashboard widget registry (UX §14.9)

`src/scope/widget-registry.ts`: widget ids are declared per module in the manifest; the registry maps active-module widget ids → widget components + required capability + role-default placement. A widget renders only when its module is active AND the role has its capability (FR107/108); money inside widgets rides the §11 contract. No placeholder widgets can exist by construction (a widget id without an active module fails the manifest validator).

### 15.3 Per-role landing redirects (UX §14.6)

`resolveLandingRoute(roleSet)` in `src/server/authz/` — matrix-derived (Montör → `/my-day`; dashboard-entitled roles → `/dashboard`). Applied **server-side** in the authenticated app entry (root/`/dashboard` server components) after tenant-context resolution; a role without dashboard capability is redirected, and direct navigation anywhere remains governed by route-level authorization (redirect is convenience, FR72 is the gate).

### 15.4 Operator / provisioning console (UX §14.7; NFR54)

- **Placement:** same Next.js app, dedicated route territory `src/app/operator/**` with its own layout — **no tenant AppShell, no tenant context, no tenant nav registry**. Separate-deployment isolation is a deliberate non-goal for Phase B (one pilot operator; AB-A8) and a named Phase C hardening option.
- **AuthZ:** Supabase-authenticated user AND `is_platform_operator()` (the `platform_operators` allow-list, §9.1). Tenant users get the generic denial; the operator area is invisible to tenant nav.
- **Data exposure:** console read-models expose **tenant identity/status/first-Admin state only** — never tenant business data (UX §4.3; NFR54). Provisioning runs via `provisionTenant` (§14), fully audited (audit rows carry the new tenant's tenant_id).
- **Negatives (NFR54):** non-operator denied; operator console cannot read tenant business tables through console read-models; provisioning path cross-tenant negatives; idempotent re-run proof; plus the end-to-end second-tenant proof (AC-PH-3).

### 15.4A Provisioning flow and subscription data (N-2, answered 2026-07-26)

**No self-serve signup — ever, in this phase.** Every customer company is registered and provisioned **internally by us after a contract is signed**. The E12 "self-serve signup remains a seam only" line is now stronger: the seam is not built toward, and the Phase C ledger's self-serve exclusion stands unamended.

**The flow is AI-assisted but technically controlled.** A structured, version-controlled onboarding template — **defined fields, not free text** — is filled in by a founder or developer and handed to an internal agent:

1. a founder/developer fills in the onboarding template;
2. the agent validates that mandatory data is present and flags contradictory or uncertain settings;
3. the agent produces a clear **preview of exactly what will be created**;
4. an authorised internal person **approves**;
5. the agent calls a **bounded provisioning service** that creates the company account and its configuration;
6. the company's first administrator is invited;
7. outcome, deviations, and **who approved** are written to an audit log.

**The hard architectural constraint (AB-A19):** the provisioning logic lives in a **deterministic system service or internal API**. The AI agent is an **interface and orchestrator** — it must **not** have general database access and must **not** be able to run arbitrary SQL in production. It follows that `provision_tenant` (§14, the sanctioned DEFINER exception) is the only write path, and that its input is a validated request object, never a generated statement.

The flow must be **validated, idempotent** (the same request never creates two companies), **dry-runnable without writing**, **audit-logged**, **safe to re-run after a partial failure**, and built so that **secrets and credentials never need to travel in an AI prompt**.

**Onboarding template fields** (the owner's list — the provisioning request schema): legal company name; organisation number and VAT registration details; address and primary contacts; language, timezone, currency; first administrator's name and email; subscription plan; included users; enabled modules and feature flags; contract start and any trial period; logo and basic profile settings; invoice/quote/number-series settings; **default VAT, ROT, and grön-teknik settings** (which resolve against §12A's time-versioned rates); email sender and Reply-To addresses (§4.6); any Fortnox settings (§7.1); the company's base schedule and calendar settings (§10.5A); and any initial users, roles, or data to import.

**After provisioning, tenant administrators can** invite and manage their own users, assign available roles (§3.3A), create their end customers, create a new end customer inline while registering a new job or project, and change the company settings they are entitled to.

**Subscription data is DATA, never hardcoded.** The commercial model is a fixed monthly fee per company with a defined number of included users, plus additions for further active users and optional modules — but **prices are a commercial decision and must never live in application logic**. Stored per tenant:

```text
SubscriptionPlan  SubscriptionStatus  IncludedUsers  AdditionalUserPrice
EnabledModules  FeatureFlags  ContractStartDate  ContractEndDate
TrialEndDate  BillingReference  CommercialOverrides
```

`CommercialOverrides` exists so **manually agreed prices, discounts, and special terms can be recorded without shipping a new build**. A hardcoded price anywhere is a review-reject.

### 15.5 Field transient-failure retention (UX §14.13) — **partly superseded by ADR-B007 §8A.6**

**Still valid as the ONLINE transient-failure path:** capture forms (diary, deviation, photo caption, time report) keep state in **component state + `sessionStorage`** keyed per form+entity, so an accidental in-session navigation or a failed request never loses typed input; photos pending upload are held as in-memory blobs/object URLs until upload confirms; failures render the retained state + explicit `Försök igen`.

**Superseded:** the clauses "nothing long-lived on shared devices — deliberately not `localStorage`" (AB-A9) and "no service worker, no background sync in Phase B". ADR-B007 (§8A) introduces durable, **scoped and purgeable** local storage plus a service worker for installability and offline reads. The shared-device concern is now answered by §8A.6's scope + minimisation + time-box + purge, not by refusing to persist. Read §8A.6 as the authority wherever the two sections disagree.

## 16. Test Strategy Extension

The Phase A layers (unit / command integration / RLS negative / storage negative / golden-master / migration reset / E2E / docs validators) carry unchanged. Phase B extends along seven axes — five defined at ratification, plus §16.6 and §16.7 added with the 2026-07-26 decisions:

### 16.1 Per-role RLS + permission matrix scaling (NFR42/43)

- The H4 inventory gains a **role dimension**: each `TENANT_TABLES` entry declares its `moduleId` (manifest-traceable) and the parameterized suite generates, **per seeded role × table**: allowed-path positives and denied read/write negatives derived from the permission matrix (role-gate + row-scope). Cross-tenant and anon arms carry unchanged.
- A command-layer generator produces, per module activation, one denied-command test per role per capability boundary (the §3.7 obligation) — landing in the activation PR (manifest validator cross-checks presence via the module's test manifest entry).
- Policy↔matrix agreement: a suite asserts that each table's role-gated policies match the matrix rows they were generated from — drift fails loud.

### 16.2 Background execution negatives (NFR45)

Forged/unsigned/none-alg JWT, garbage bearer, missing/wrong cron secret → 401 + zero side effects (the ADR-B002 mandatory suite). Producer idempotency (retry produces no duplicate notifications/emails — dedupe-key proofs), suppression enforcement, bounded-retry exhaustion visibility, and service-context containment (no service-role import reachable from client paths — extended grep/bundle checks).

### 16.3 Public-surface abuse tests (NFR46)

Per ADR-B004 §6.6: token validity/revocation/rotation, response uniformity (no enumeration oracle), rate-limit trips, cross-tenant probes, QR-submit input hardening, `(public)` shell-isolation guardrail (no authenticated-shell imports).

### 16.4 Comparison-harness extension (NFR52)

The Epic 9 live-driven pattern (frozen anonymized fixtures + live-engine projection + documented divergences) extends to: **scheduling** (conflict-detection scenario packs incl. recurrence expansion and the two DST boundary weeks; capacity cases once N-9 rules land) and **jobs money paths** (economy rollup budget-vs-actual, time valuation, material amounts, billing-basis line assembly and lock totals). Fixture anonymization + PII-scan discipline (Story 9.2 authority) is reused verbatim; real-record capture stays owner-gated. Golden packs pin öre values and rounding mode exactly as the Phase A money packs do.

### 16.5 Migration reset discipline — unchanged

Empty-DB reset must succeed at every migration state; the exact-policy enumeration is **extended, never loosened**, per new table; seed stays minimal; test factories grow per module (role-bearing memberships, persons, bookings). Wave-boundary N-1 classification (round 2) precedes each B2/B3 module's data-migration story (NFR52); the unit gate grows from its 1378 baseline and never shrinks (AC-PH-4).

### 16.6 Money-rule conformance to §12A (Story 10.6)

- **Split invariance (the load-bearing test):** two documents with identical economics but different line granularity produce **identical** VAT and identical totals. This is the direct test of "per VAT category at document level" and the one that fails loud if anyone reintroduces per-line VAT rounding.
- **Mixed-category documents:** a document mixing `STANDARD_VAT_25` and `REVERSE_CHARGE_CONSTRUCTION` sums and rounds each category independently; the reverse-charge portion charges no VAT and the document carries the buyer's VAT number plus the required text.
- **Reverse charge is never inferred:** a company customer without an explicit choice or verified setting gets `STANDARD_VAT_25` — a negative test.
- **Deduction-basis classification:** hidden ROT-eligible labour counts in the ROT basis; hidden **material** does not; hidden travel/machine/admin count in neither; a non-billable internal row counts in nothing. One case per row of the §12A.4 table.
- **Three-property independence:** flipping `VisibleToCustomer` alone changes no total and no deduction basis. This is the regression guard for the corrected assumption.
- **Claim truncation:** claim amounts truncate downward to whole SEK (an amount ending `.99` truncates, never rounds up), and a multi-person allocation distributes in whole SEK summing **exactly** to the document's deduction.
- **Time-versioned rates:** a document dated inside one `ValidFrom`/`ValidTo` window resolves that window's rate; the ROT tax year follows the customer's **payment** date, proven by a case where payment and invoice fall in different years.
- **Grön teknik:** the 97 % schablon applies only when explicitly chosen; a mixed solar + storage project splits its basis per category before applying 15/50/50; the same installation part never feeds both ROT and grön.
- **Golden fixtures are re-derived, not patched** — the money/tax packs (Stories 4.4, 5.5) get new expected values, and the diff is the evidence of the rule change.
- **Immutability negative:** recomputing an already-SENT quote version's snapshot under the new rules is rejected (ADR-A005 carried; §12A.7).

### 16.7 Offline sync obligations (ADR-B007, Story 10.7)

The §8A.7 suite is part of the standing gate: replay idempotency per offline-capable write type; authorisation-on-sync (a queued operation against a since-revoked resource is rejected with no partial write); offline-store scope containment (no non-assigned job data present); entitlement containment (no withheld money field on the device); purge on logout and on expiry; no-data-loss on failed transfer; and proof that the reprocess-on-open path works with no background-sync API available.

## 17. Repo Structure Delta

Additions to the Phase A structure (everything else carries):

```text
src/
  scope/
    manifest.ts            # ADR-B003 single source (typed, satisfies-guarded)
    manifest-schema.ts     # ScopeManifest types + coherence validator input
    nav-registry.ts        # §15.1 derivation (manifest × matrix)
    widget-registry.ts     # §15.2 derivation
  server/
    authz/
      permission-matrix.ts # ADR-B001 single source; roles, capabilities, sensitive fields
      capability.ts        # requireCapability envelope gate; resolveLandingRoute
    read-models/           # §11 per-surface projections + entitlement descriptors
    jobs/
      runner.ts            # ADR-B002 runner (cron-secret auth, dispatch, chunking)
      producers.ts         # producer registry (manifest-derived)
      producers/<module>.ts
    email/
      provider.ts          # adapter seam (implementation lands at N-6 activation)
      queue.ts             # outbox claim/process, suppression, delivery events
    notifications/         # emit helpers, category taxonomy types
    sync/                  # ADR-B007 server side: operation-id ledger, replay guards (§8A.4)
  features/
    scheduling/            # pure engines: conflicts.ts, recurrence.ts, capacity.ts
    offline/               # ADR-B007 client side: local queue, sync engine, per-change states
    <module>/              # per-module pure logic per the Phase A convention
  app/
    (public)/              # ADR-B004 surfaces — isolated minimal layout (§6.5)
    operator/              # §15.4 operator console — outside tenant shell
    (app)/my-day/          # Montör landing (B1b)
tests/
  unit/scope/              # manifest coherence validator suite
  integration/authz/       # per-role matrix suites (§16.1)
  integration/jobs/        # runner auth negatives, producer idempotency
  integration/public/      # token-surface abuse suites
  integration/sync/        # ADR-B007 replay idempotency + authorisation-on-sync (§16.7)
  fixtures/golden/scheduling/  # DST/recurrence/conflict packs (§16.4)
  fixtures/golden/jobs-money/  # economy/billing golden packs
```

The PWA manifest and service worker land with Story 10.7 under the Next.js app conventions; the service worker's cache scope is bound to the §8A.6 rules and is reviewed as security surface, not as build config.

Naming, data-format, and process conventions from Phase A §22 apply unchanged (snake_case SQL / camelCase TS / `_ore` money suffixes / stable error codes / blocking-vs-warning separation / lifecycle locks at DB level).

## 18. Security Risks and Mitigations (Phase B additions)

| Risk | Mitigation |
| --- | --- |
| Forged-token background execution (the legacy P0) | ADR-B002: signed cron secret / platform-verified JWT only; no unverified-JWT decode anywhere; mandatory forged-token negatives; runner-only service context with explicit tenant iteration. |
| Public token surface abuse / enumeration | ADR-B004 closed set of three; hashed 256-bit tokens; rotation/revocation; rate limits + abuse counters; uniform generic responses; shell isolation; per-surface negative suites. |
| Role-check drift at 2.5× surface | Single code matrix; policy↔matrix agreement tests; generated per-role negatives per activation; manifest validator blocks activation without matrix rows. |
| Sensitive-field leakage to unentitled roles | Structural: role-gated RLS + companion-table separation (floor) + read-model projection with field-presence descriptor (UX determinism); email/export builds from the recipient's projection. |
| Cross-tenant leakage via provisioning/operator paths | Operator console exposes identity/status only; DEFINER `provision_tenant` with operator check + negatives; NFR54 end-to-end second-tenant proof. |
| Scheduling correctness drift (missed/phantom conflicts, DST) | One pure engine shared by preview and command; golden DST/recurrence packs; conflicts as persisted, audited workflow records. |
| Money-out mutation after commitment | Billing-basis lock joins the DB-trigger lock family (reversal + identity tests); copy-by-value line snapshots; audited corrections only; tax-gate binding blocks real invoicing use. |
| Scope creep past the manifest | ADR-B003: any unlisted surface fails CI; per-epic same-PR activation; coherence validator; `phase-scope-reviewer` reviews against the manifest. |
| Tenant data at rest on field devices (ADR-B007) | Scoped to assigned jobs only (never a tenant mirror); cached projection is the §11 entitlement projection, so withheld money never reaches the device; time-boxed with purge on expiry and on logout; negative tests prove non-assigned and unentitled data are absent. |
| Offline replay creating duplicate or unauthorised writes (ADR-B007) | Operation-id-keyed idempotent sync endpoints (replay proofs per write type); the full command envelope — capability gate + RLS — runs on sync, so a queued write is never a pre-authorised write; append-only field records plus optimistic locking on shared objects; last-write-wins is a review-reject. |
| Money-rule drift between the shipped engine and the ratified rules (§12A) | Story 10.6 is the single owner of the correction; §13's real-invoicing block stays in force until it lands; golden fixtures are re-derived, not patched; the split-invariance test (§16.6) makes a regression to per-line VAT rounding fail loud. |
| Notification/email data leakage or duplicate sends | Entitlement-projected content; suppression enforcement; dedupe keys + idempotent claims; delivery log append-only. |
| Fortnox credential exposure (B3) | ADR-B005 boundary: server-side-only encrypted tokens, no client path, no tables/routes before the final ADR + epic activation. |

## 19. Coverage — UX §14 Handoff Items and PRD §15 Architecture Items

Every UX §14 item (U1–U14) and every PRD §15.2 architecture item (P1–P10) has a disposition here:

| # | Item | Disposition | Section |
| --- | --- | --- | --- |
| U1 | Entitlement/field-presence contract; matrix drives nav/tab visibility | Answered: `{data, entitlements.withheld}` contract; one matrix derivation for nav/tabs/widgets/landing | §11, §3.3, §15.1 |
| U2 | Nav registry representation from manifest | Answered: `nav-registry.ts` = manifest × matrix, validator-traced, incl. `Filer`→`Dokument` swap | §15.1, §5.3 |
| U3 | Conflict override semantics + conflict identity across recurrence | Answered: UXB-A10 validated-with-amendment — persisted `booking_conflicts` records with accepted/resolved states; natural-key identity, re-derive on change | §10.2 |
| U4 | Recurrence exception storage + "this and following" | Answered: materialized occurrences, exception flags, cancelled tombstones, series split; one shared expansion function | §10.3 |
| U5 | Time-report approval existence | Answered: no hard approval state in B1b; `submitted`-only status column reserved; re-decided at B1b→B2 checkpoint with E26/N-5 | §10.6 |
| U6 | Per-role landing redirects | Answered: server-side `resolveLandingRoute` from the matrix | §15.3 |
| U7 | Operator console hosting/auth outside tenant context | Answered: same app, `operator/**` territory, `platform_operators` allow-list, identity/status-only read-models | §15.4, §9.1 |
| U8 | Notification producer registry → category taxonomy | Answered: code registry, manifest-derived activation, stable category keys, preference storage, essential classes, deep-link contract | §4.4, §4.5 |
| U9 | Dashboard widget registry | Answered: manifest-declared widget ids → registry; role defaults; no placeholders by construction | §15.2 |
| U10 | Calendar-feed token UX mechanics | Answered: self-serve create/rotate/revoke commands over hashed tokens; live-generated feed; last-used visibility | §6.3, §6.2 |
| U11 | Public QR page shell isolation | Answered: `(public)` route group, minimal layout, no shell/context imports (guardrail-tested), no enumeration | §6.5, §6.4 |
| U12 | Job-workspace tab data contracts under ADR-B006 | Answered and now model-final: one container id, per-tab read-models on stable keys (job_id / owner_type='job'); the Option B `Ingående jobb` read-model is **not built** | §8.6, §8.5 |
| U13 | Field transient-failure retention | Answered, then **re-answered by ADR-B007**: sessionStorage + in-memory blobs remain the online transient path; durable scoped offline storage + a sync queue supersede the no-offline-promise clause | §8A.6, §15.5 |
| U14 | Oracle terminology pass hook | Process disposition: every `[oracle-check]` label resolves via a `legacy-oracle-explorer` terminology task **before the owning epic's first story**; the epics stage must carry this as a story-template gate | §22 item 4 |
| P1 | ADR-B001..B006 sequence | Answered: §3–§8 with PRD §12 trigger points restated per ADR | §3–§8 |
| P2 | Permission-matrix representation + RLS integration | Answered: code-level matrix; three-tier predicates; policy↔matrix tests | §3.3–§3.5, §16.1 |
| P3 | Background-execution runner choice | Answered: platform-cron → runner endpoint, signed secret, service-context containment | §4.2–§4.3 |
| P4 | Scope-manifest format + validator design | Answered: TypeScript, `src/scope/manifest.ts`, coherence validator; Story 10.1 | §5 |
| P5 | Resource-model schema extension (PB-D13) | Answered: `person_profiles` 1:1 membership record; HR extends the same record; work-role catalog reuse (PB-A8 validated) | §9.2 |
| P6 | Booking/recurrence/conflict engine incl. timezone | Answered: pure shared engine, materialized occurrences, Europe/Stockholm evaluation, DST policy + goldens | §10 |
| P7 | Token-surface design | Answered: ADR-B004 | §6 |
| P8 | Notification-producer registry | Answered: §4.4 | §4.4 |
| P9 | Fortnox outbox | Boundary only by design; final after B2 spike | §7 |
| P10 | Comparison-harness extension to scheduling/jobs money | Answered: §16.4 | §16.4 |

(PRD §15 items 1, 3, 4 belong to the UX, epics, and process stages respectively; item 3's epic-merge candidates are restated in §22 for the epics stage.)

## 20. Requirements Coverage Validation

| Requirement area | Architecture coverage |
| --- | --- |
| Quote lifecycle completion (FR62–65) | §9.1 tables, §14 widened lifecycle RPC, append-only events preserving ADR-A005 |
| RBAC + admin mgmt (FR66–72, NFR42–44) | ADR-B001 (§3), §11, §16.1 |
| Provisioning/onboarding (FR73–76, NFR54) | §9.1, §14 (`provisionTenant`), §15.4 |
| Notifications/email (FR77–81, NFR45, NFR47) | ADR-B002 (§4), §9.1 |
| Resource/scheduling/time (FR82–92, NFR48) | §9.2, §10, ADR-B004 (§6.3) |
| Jobs core/economy/field/completion (FR93–106) | ADR-B006 decided (§8): typed container + `work_orders` + `job_members`, §8.4 job-card fields, §9.2 table set, §14 (`markJobComplete`, `upgradeJobToProjekt`), §3.6 economy separation |
| Dashboard v1 (FR107–108) | §15.2, §11 |
| B2 coarse groups (FR109–118, NFR49–50) | §9.3, §12, §13, ADR-B005 (§7) |
| B3 coarse groups (FR119–128) | §9.4, §12, ADR-B005 (§7) |
| Governance (FR129–130, NFR51) | ADR-B003 (§5), §15.1–15.2 |
| Migration/golden discipline (NFR52) | §16.4–16.5 |
| Field posture (NFR53) | ADR-B007 (§8A): installable PWA with offline capture; §15.5 is superseded by §8A.6 |
| Money/VAT/deduction correctness (NFR49; FR25 hidden rows carried) | ADR-A004 amendment (§12A); Story 10.6 owns the code change |
| Carried NFR1–41 spine | §2 (no delta weakens an invariant; the four PRD §9.1 amendments are honored: NFR5 via §6.1, NFR29/NFR51 via §5, NFR31/NFR53 via §15.5, NFR33 via §7) |

**Validation result (2026-07-18):** READY FOR THE PHASE B EPICS STAGE — with the deliberate exceptions: ADR-B006 gated (E16–E18 design blocked until recorded), ADR-B005 final design post-spike, and the owner gates of PRD §11 open by design. No gate blocks starting B1a.

**Re-validation (2026-07-26, after the owner + accountant answers):** ADR-B006 is recorded (§8) — **E16–E18 are unblocked**. ADR-B007 (§8A) and the ADR-A004 amendment (§12A) are recorded. **No hard owner gate remains open in Phase B.** ADR-B005's final design still waits on the B2 spike by design (sequencing, not a gate). One reconciliation debt is carried and owned: the §12A money rules **correct shipped behaviour** and land through Story 10.6, which must precede any real ROT/grön-teknik quote leaving the system (§13, §24).

## 21. Assumptions Register (autonomous run record — AB-A#)

| ID | Assumption / judgment call | Status |
| --- | --- | --- |
| AB-A1 | Extend-by-supersession honored: ADR-A001..A009 cited with deltas only (§2); the frozen Phase A architecture + `project-context.md` conventions govern wherever this document is silent. | accepted |
| AB-A2 | B1a ships single-role-per-membership storage with a role-SET code contract; `membership_roles` is the reserved additive extension if N-4/operations require multi-role. `tenant_admin` literal retained as the Admin role (zero data migration; `is_tenant_admin` untouched). | **REVISED 2026-07-26 by N-4** — multi-role is required, not conditional: `membership_roles` is **built in E11**. The role-SET code contract and the retained `tenant_admin` literal stand; the UI label is **"Företagsadmin"**. |
| AB-A3 | Permission matrix is code-level (no DB permission tables) because B1a is seed-roles-only with no custom role builder (UXB-A7); a future role builder would migrate it to data. | **CONFIRMED 2026-07-26 by N-4** — tenant-specific role compositions in v1 are authored by us via an internal surface or version-controlled validated configuration, never by direct production-DB edits; a git-versioned code matrix is exactly that. |
| AB-A4 | One background-execution lane (platform cron → runner endpoint) rather than pg_cron/Edge Functions — one runtime, one front door, one negative-test surface. Adding a second lane requires amending ADR-B002. | accepted |
| AB-A5 | Email provider selection deferred to the N-6 activation story behind the adapter seam; queue runs non-sending until then. No provider dependency in B1a. | accepted |
| AB-A6 | Manifest format TS over YAML; located `src/scope/manifest.ts` (runtime-importable; session's `docs/scope/…` was an example, not binding). | accepted |
| AB-A7 | Conflicts are deterministic-derived but **materialized** as workflow records (`booking_conflicts`) because accept/resolve states, reasons, and outcomes must persist and be auditable — this validates-and-amends UXB-A10. | accepted for architecture |
| AB-A8 | Operator console lives in the same Next.js deployment (route-territory isolation + operator allow-list) for Phase B; separate-deployment hardening is a named Phase C option. | accepted |
| AB-A9 | Field transient retention uses sessionStorage (not localStorage) to avoid long-lived capture data on shared devices; photos in-memory until upload. | **SUPERSEDED 2026-07-26 by ADR-B007 §8A.6** — offline capture requires durable local storage. The sessionStorage path survives as the *online* transient-failure mechanism; the shared-device concern is now answered by scoping + minimisation + time-box + purge. |
| AB-A10 | Time-report hard approval state deliberately not shipped in B1b; re-decided at the B1b→B2 checkpoint with E26/N-5 (resolves PB-A9 for now; additive enum widening if introduced). | accepted; checkpoint item |
| AB-A11 | Materialized-occurrence recurrence (bounded series, mandatory end condition) chosen over virtual expansion — conflict identity, resolver actions, exceptions, and feed stability all key on real rows. | accepted |
| AB-A12 | DST edge policy: spring-forward → first valid instant; fall-back → earlier instant; golden-pinned. | accepted (test-pinned at E14/E15) |
| AB-A13 | B2/B3 schema rows are outline-level by design (PB-D10); counts are indicative and finalized at wave-boundary checkpoints — they bound scope, they are not migrations. | accepted |
| AB-A14 | `job_runs` and `platform_operators` are the enumerated non-tenant-owned exceptions (ops log / platform identity), documented in §9.1 with their own RLS posture; everything else stays direct-`tenant_id`. | accepted |
| AB-A15 | The completion-event consumer flags are computed by the command layer from the manifest and passed explicitly to the RPC — SQL never encodes scope knowledge. | accepted |
| AB-A16 | ADR-B007 and the §12A money amendment are numbered/placed outside the B001–B006 sequence (as `8A` and `12A`) rather than renumbering §9–§23, so every existing inbound cross-reference — including the ones in shipped test-file headers — stays valid. | accepted (2026-07-26) |
| AB-A17 | The `order → projekt` upgrade is **one-way** in Phase B (ADR-B006 §8.3). A downgrade would have to decide the fate of payment-plan rows and project-scope data an order cannot hold; that is an owner decision, not an implementation detail. Reversal requires an ADR amendment. | accepted (2026-07-26) |
| AB-A18 | The two set-valued §8.4 job-card fields (dependencies, access/time windows) are **child tables, not JSON columns**, so the scheduling engine can query them and the database can constrain them. | accepted (2026-07-26) |
| AB-A19 | The N-2 provisioning **AI agent is an orchestrator with no database access** — it fills and validates the structured onboarding template and calls the deterministic provisioning service. No general DB access, no arbitrary SQL in production, no secrets in prompts (§15.4A). | accepted (2026-07-26; owner-stated, recorded as binding) |
| AB-A20 | §12A introduces **three distinct rounding rules** (line net → öre; VAT → öre per category at document level; Skatteverket claim → truncated whole SEK). They get three named primitives and are never collapsed into one helper, so a call site cannot silently use the wrong one. | accepted (2026-07-26) |

## 22. Open Items for the Epics Stage

1. **Final epic set:** merge candidates per PRD §15.3 (E12→E11, E24→E22, E30 adjacency, E32 bundle); wave tags binding; every module epic's first story carries the manifest flip + matrix rows + negative tests (the §5.5 activation protocol) — make this a story-template requirement.
2. **Story 10.1 content is fixed** (§5.5 + PRD §13): AGENTS.md/guardrail re-baseline + manifest + derivations + coherence validator. Sequence it before any module story.
3. **ADR-B006 recording:** ✅ **done 2026-07-26** (§8). The AC-B1b-6 gate is closed and the E16–E18 gate banners in `epics-phase-b.md` are lifted. Remaining work is story-level: E16.1 takes the Option C branch and deletes the Option B branch; E16.3/E16.4/E17.2 drop their `[gated: 7.1/7.3 …]` markers per §8.5.
4. **Oracle terminology pass (U14):** a `legacy-oracle-explorer` terminology task per epic with `[oracle-check]` labels, before that epic's first story — encode as a story-gate in the epics doc.
5. **Wave-boundary checkpoints** own: coarse-FR expansion (PRD), B2/B3 schema finalization (§9.3–9.4), the time-report approval decision (§10.6/AB-A10), and any N-9-driven capacity-rule fixtures.
6. **B2 Fortnox spike story** (during B2, not B3): produce the spike report answering §7's questions; it feeds ADR-B005-final and the N-5 owner conversation (AC-B2-6).
7. **Owner-gate watchlist for sequencing:** ✅ **all closed 2026-07-26.** N-3 → ADR-B007 (§8A); N-4 → §3.2A/§3.3A; N-9 → §10.5A; N-6 → §4.6; N-2 → §15.4A; N-5 → §7.1/§7.3; N-8 → §9.4 template contract; N-10 → §12B; the tax blocks + `2.2` → §12A. What replaces the watchlist is a **sequencing debt**, not a gate: Story 10.6 (money correction) must precede any real ROT/grön-teknik document leaving the system, and Story 10.7 (PWA/offline) must precede or accompany the E14–E18 field stories that assume offline states.

## 23. Handoff Guidance

Implementation proceeds through the Phase B epics doc (Epic 10+, wave-tagged) via the established per-epic pipeline. Before any Phase B implementation PR merges, confirm: the touched module is manifest-`active` (or the PR is its activation), matrix rows + per-role negatives land with activation, no background path exists outside ADR-B002, no public surface outside ADR-B004's closed set, no Fortnox artifact before ADR-B005-final, money is integer öre through `@/lib/money`, new tables are H4-enrolled with the exact-policy enumeration extended, and the Phase C ledger (PRD §14) stays untouched.

Added by the 2026-07-26 decisions: E16–E18 schema follows **ADR-B006 §8.3** (typed container, no `projects` table); any offline-capable write is **operation-id idempotent and re-authorised on sync** (ADR-B007 §8A.4); any new money path uses the **§12A** rules (per-category document-level VAT, `DeductionClassification`, `VatType`, truncated claims) and never the frozen Phase A Rounding section; any table holding identifiable-person data carries the **§12B** retention fields; and no price, rate, cap, or retention period is hardcoded — they are time-versioned data (§12A.6, §12B, §15.4A).

## 24. Reconciliation Ledger — 2026-07-26 Answers

What each answer changed in this document and its siblings. `owner-signoff-questions.md` remains the system of record for the answers themselves; this table is the **architecture-side disposition**.

| Answer | Effect | Where |
| --- | --- | --- |
| **Job model (`7.1`)** | Gate closed. Option A model / Option C technique recorded; E16–E18 unblocked; no `projects` table. | §8 (rewritten), §1.6, §9.2, §14, §19 U12, §20, §22.3 |
| **Job-card fields (`7.3`)** | Answered via N-9's job-side inputs; set-valued fields become child tables. | §8.4, §10.5A, AB-A18 |
| **A.1 rounding** ⚠ | **Corrects shipped behaviour.** VAT per category at document level; three distinct rounding rules named. | §12A.2–3, §2 (ADR-A004 row), §13, §16.6, §18, AB-A20 |
| **`2.2` hidden rows** ⚠ | **Corrects a shipped assumption.** Visibility decoupled from economic inclusion; three row properties + `DeductionClassification`. | §12A.4, §16.6, PRD FR25 note |
| **A.2 reverse charge** | New VAT **type**, never a 0 % rate; explicit choice required. | §12A.5, §7.3 |
| **B/C rates, caps, schablon** | Mostly confirmations; new: ROT+RUT combined 75 000, claim truncation, payment-date tax year, `ValidFrom`/`ValidTo`. | §12A.6 |
| **N-2 provisioning** | No self-serve ever; deterministic service with the agent as orchestrator only; subscription data never hardcoded. | §15.4A, AB-A19 |
| **N-3 mobile** ⚠ | **Supersedes "responsive web first".** ADR-B007: installable PWA + offline capture. | §8A (new), §15.5, §17, §16.7, §18, §20, AB-A9 superseded |
| **N-4 RBAC** | Matrix seed filled — the "conservative default" placeholder is retired. Multi-role required, not reserved. **Epic 11 consumes this directly.** | §3.2, §3.2A, §3.3, §3.3A, AB-A2/AB-A3 revised |
| **N-5 Fortnox** | Auth, scopes, mastership split, invoice-basis line content and status flow settled; spike narrowed. | §7.1, §7.3, §13 |
| **N-6 email** | Sender identity, flow priority, reminder stop conditions, delivery-log fields. | §4.6, §4.5 |
| **N-7 tenders** | Confirmation only — the thin manual slice was already the designed scope. | no change |
| **N-8 DoU content** | `ContentOwnerUserId` as a configurable reference; template version contract and statuses. | §9.4 (E27/E28 rows) |
| **N-9 scheduling** | Capacity from the actual weekly schedule, not employment percentage; `tenant_calendar_days` is built, not reserved. | §10.1, §10.5A, §9.2 |
| **N-10 GDPR** | Phase B technical foundation: retention fields, deletion-request states, `LegalHold`, central versioned policy. | §12B, §9.4 (E31 row) |

⚠ = changes behaviour that is already shipped or already assumed. These three are owned by Stories 10.6 (money) and 10.7 (PWA/offline); they are the reason this reconciliation exists as work rather than as a note.

— End of Phase B architecture. Downstream: Phase B epics & stories (Epic 10+), then `project-context.md` refresh, per the ratified document plan (session §7).
