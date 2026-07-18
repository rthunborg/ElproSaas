---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: architecture
lastStep: 8
status: complete
project_name: ElproSaas
user_name: Rasmus
date: 2026-07-18
completedAt: 2026-07-18
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
- **Owner gates stay open.** ADR-B006 is deliberately **gated** (not decided). ADR-B005 is **boundary-only** (final design after the B2 spike). Everything `[gated: X]` designs mechanism and seams, never the gated content.
- **Docs-only:** this artifact creates no code, migrations, or dependencies. Story 10.1 (§5) delivers the first implementation.

Reading order for downstream consumers: PRD → UX spec → this document → Phase B epics doc. §19 maps every UX §14 handoff item and every PRD §15 architecture item to its section here.

## 1. Executive Architecture Summary

Phase B keeps the entire Phase A spine — pooled tenancy with forced RLS, the server command envelope, SECURITY INVOKER RPCs for atomic writes, integer-öre money, DB-trigger immutability locks, entity-scoped private files, append-only audit, golden-master discipline — and extends it along six decision lines:

1. **ADR-B001 (decided):** RBAC leaves `tenant_admin`-only. Roles live on `tenant_memberships`; authorization is a mechanism (code-level permission matrix + role-aware RLS predicates + command-layer capability checks) whose rows fill incrementally per module activation; sensitive money fields are withheld **server-side by structural absence** (companion-table RLS + read-model projection), never by client masking.
2. **ADR-B002 (decided):** Phase B's first background execution (notifications, email queue, scans) runs **authenticated** — a platform-scheduled runner behind a signed cron secret, with the legacy forged-JWT `verify_jwt=false` cron named as the structural anti-pattern and proven rejected by negative tests.
3. **ADR-B003 (decided):** scope governance re-baselines onto **one TypeScript scope manifest** from which the deny-list, nav registry, tenant-table inventory, widget registry, and scope scans derive; per-epic same-PR activation; the manifest carries its own coherence validator. Lands as Story 10.1.
4. **ADR-B004 (decided):** exactly three public token surfaces (calendar feeds, asset QR, unsubscribe) exist behind hashed high-entropy capability tokens with rotation, revocation, rate limits, and abuse monitoring — the narrow, deliberate NFR5 amendment (PB-D14).
5. **ADR-B005 (boundary only):** Fortnox is an outbox/mapping-shaped integration layer sketched here and finalized only after the B2 spike; no credentials, tables, or routes before its epic.
6. **ADR-B006 (gated):** the Jobb/Projekt/Arbetsorder model is documented as options A/B/C with schema implications and **stays undecided** pending owner möte items `7.1`/`7.3`; job-workspace data contracts stay model-agnostic meanwhile.

The highest-risk Phase B surfaces are (a) per-role authorization correctness at 2.5× the module surface, (b) the two new attack-surface classes (background execution, public tokens), (c) scheduling correctness across recurrence and DST, and (d) money-out immutability. The test strategy (§16) scales the Phase A negative-test discipline along exactly those axes.

## 2. Carried Phase A Foundation — ADR-A001..A009 (Unchanged, Deltas Only)

All nine Phase A ADRs remain in force exactly as written in the frozen `architecture.md`. This table cites each and records only its Phase B delta. No delta weakens a Phase A invariant.

| ADR | Carried decision (cite; do not restate) | Phase B delta |
| --- | --- | --- |
| ADR-A001 Clean Next.js App Router rebuild | Carried unchanged. | New route territories: an unauthenticated `(public)` route group for ADR-B004 surfaces (§6.5) and an operator-scoped `/operator` area outside tenant context (§15.4). Same app, same stack; no new framework. |
| ADR-A002 Supabase pooled multi-tenancy | Carried unchanged. | Tenant provisioning becomes a product flow (E12) on the same pooled model; a small set of **platform-scoped** (non-tenant) tables is introduced for operator identity (§9.1) — an explicit, enumerated exception to the direct-`tenant_id` rule, mirroring how `tenants` itself already is one. |
| ADR-A003 Server-side command layer | Carried unchanged. | The command envelope gains a role/capability authorization gate (ADR-B001) between membership resolution and input validation. Background producers (ADR-B002) are the one non-user execution context and get their own containment rules (§4.3). |
| ADR-A004 Integer öre + snapshotted tax assumptions | Carried unchanged. | Extends to job economy (E17) and billing bases (E26): integer öre end-to-end, engine-only arithmetic (`@/lib/money`), correctness sign-off bound to the tax gates (NFR49, §13). No new rounding rule may be invented (STOP condition carried). |
| ADR-A005 Immutable quote version + acceptance model | Carried unchanged. | Förlorad/Avböjd (E10) is an append-only lifecycle event + reason record; the sent snapshot is untouched (FR63). Billing-basis lock (§13) and DoU document locks (B3) reuse the announced-lock + DB-trigger discipline as new members of the shared lock-code family. |
| ADR-A006 Entity-scoped private file model | Carried unchanged. | Every B1+ module emits entity-scoped `files`/`file_links` metadata (PB-D6, §12); the E20 documents center is an **aggregation read** over that model, not a new storage model. `owner_type`/`purpose` unions grow only via manifest-governed activation. |
| ADR-A007 Lovable oracle + golden-master coexistence | Carried unchanged. | Comparison-harness pattern (Epic 9, live-driven) extends to scheduling and jobs money paths (§16.4, NFR52); the oracle additionally serves as the terminology authority for the UX `[oracle-check]` pass (§19 item U14). |
| ADR-A008 Future expansion through documented boundaries only | Carried unchanged in mechanism. | Phase B **activates** several Phase A seams through their ADRs: RBAC (ADR-B001), field workflow (E16–E18 under ADR-B006), supplier file import (E25), Fortnox boundary (ADR-B005). The Phase C ledger (PRD §14) is the new deferred set; enforcement moves to the scope manifest (ADR-B003). |
| ADR-A009 Narrow Postgres RPC for transaction-sensitive commands | Carried unchanged. | New transaction-sensitive commands enumerated in §14 (booking writes, series edits, job completion, billing-basis lock, tenant provisioning, lifecycle-lost). SECURITY INVOKER remains the default; the two sanctioned DEFINER exceptions (provisioning, §14.3; background context, §4.3) follow the Phase A DEFINER hardening shape and carry dedicated negative tests. |

The implemented Phase A conventions in `project-context.md` (envelope shape, H4 enrollment, exact-policy enumeration, composite same-tenant FKs, lock-trigger family, öre validation authority, snapshot builders) remain binding patterns for every Phase B story.

## 3. ADR-B001 — RBAC and Non-Admin Activation (DECIDED)

**Trigger (PRD §12):** with this planning package's ratification, before E11 design.
**Status:** DECIDED here.
**Authority:** PB-D2; FR66–FR72; NFR42–NFR44; owner direction 2026-07-08.

### 3.1 The reversal, recorded

Phase A deliberately deferred full RBAC (Phase A PRD deferral, assumption **A29** / acceptance boundary **AC20**; architecture §21 RBAC seam: "only `tenant_admin` is active"). **Phase B reverses that deferral by explicit owner direction (2026-07-08) and ratified decision PB-D2.** The reversal is mechanism-first: Phase B ships the permission *mechanism* plus the seed roles; it does not spec a full matrix up front for modules that do not exist yet.

### 3.2 Role storage — roles on `tenant_memberships`

- `tenant_memberships` remains the single membership/authorization record (one row per tenant × user; `status ∈ {active, invited, disabled}` carried from Phase A).
- The `role` CHECK constraint widens from the single literal `tenant_admin` to the seed set: **`tenant_admin` (UI label "Admin" — the literal is retained; no rename, no data migration, `is_tenant_admin()` keeps working), `projektledare`, `montor`, `saljare`, `ekonomi`** `[labels and per-role money entitlements gated: N-4; the mechanism is not]`.
- **Single role per membership at B1a ship; role-SET contract in code from day one.** Every authorization API takes a role set (`roles: Role[]`), so multi-role support is additive: if N-4 or operations require users with more than one role, an additive `membership_roles` child table (tenant_id, membership_id, role; unique) extends storage without touching the permission mechanism (AB-A2). Do not build it speculatively.
- **Arbetsledare is a job-scoped designation, not a tenant role:** it lives on the job-members record (`job_members.job_role`, E16, under ADR-B006) and is enforced **per job** server-side (NFR43). It never appears in `tenant_memberships.role`.
- Admin user management (FR69) reuses existing surface: invitations are `tenant_memberships.status='invited'` rows plus Supabase Auth admin invites executed server-side (service context, never client-reachable); every action audited via the Phase A envelope.

### 3.3 Permission matrix — a code-level single source of truth

- The matrix lives in **`src/server/authz/permission-matrix.ts`**: a typed, `satisfies`-guarded constant mapping `moduleId → capability → allowed roles` plus per-module **sensitive-field entitlement rows** (`sensitiveFields: field → entitled roles`). Machine-readable (NFR43), versioned in git, no DB permission tables — B1a ships **seed roles only, no custom role builder** (UXB-A7), so runtime mutability is explicitly not wanted. A future role builder would migrate this to data; that is a Phase C+ decision.
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
- **Sending activation is gated (N-6, FR81):** until activation, the pipeline runs **queued/non-sending** (rows reach `queued` and stop; the preferences email column renders inactive-with-explainer). The email provider is chosen at the activation story behind a narrow adapter interface (`src/server/email/provider.ts`); no provider dependency lands before N-6 (AB-A5). Every outbound mail carries tenant identity, deep link, and — for non-essential categories — an unsubscribe link governed by ADR-B004.
- Outbound content respects entitlements: an email body is built from the recipient's entitlement projection (§11), never from an Admin-shaped payload (NFR47 leakage clause).

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
**Status:** BOUNDARY ONLY — the shape below is a sketch to aim the spike; the final design is explicitly deferred. **No Fortnox credentials, tables, routes, dependencies, or UI exist until E33's epic activates the module in the manifest.**
**Authority:** owner direction (Fortnox is IN); PB-D11 (spike during B2); FR127–FR128; NFR50.

Sketched shape (to validate/amend in the spike report):

- **Per-tenant connection:** `fortnox_connections` — one row per tenant; OAuth executed entirely server-side; tokens encrypted at rest, never client-reachable, never logged (NFR50). Connection status (`Ansluten/Ej ansluten/Fel`) is the only client-visible projection.
- **Outbox pattern:** `integration_outbox` — export intents appended **transactionally with the domain event that warrants them** (e.g. billing-basis locked → outbox row), processed by an ADR-B002 producer with per-record status (`Köad → Skickad → Fel`), bounded retries/backoff, per-record and per-run retry UX (FR128), and full inspectability (NFR50).
- **Mappings:** `external_mappings` — tenant-scoped local-id ↔ Fortnox-id per type (customer, article, invoice basis), unique per (tenant, type, local id).
- **Flows (B3):** customers, articles, invoice basis — export-only in Phase B; no webhooks/inbound sync without amending the final ADR.
- **Spike questions the B2 spike must answer (feeding N-5):** Fortnox licensing/API access model, rate limits, idempotency keys on the Fortnox side, invoice-basis payload shape vs the N-5 faktureringsunderlag content definition, token refresh semantics, sandbox availability for tests.

## 8. ADR-B006 — Job Model (GATED — NOT DECIDED)

**Trigger (PRD §12):** after owner möte items `7.1`/`7.3`; **before any E16–E18 design/schema/story work** (AC-B1b-6).
**Status:** GATED. This section documents the options and their schema implications so the möte decision can be recorded quickly; it decides nothing.
**Authority:** PRD §7; session §9.2.

### 8.1 Options and schema implications

| Option | Shape | Schema implications |
| --- | --- | --- |
| **A — legacy-shaped (team presentation default)** | `Jobb` is the container; contains arbetsorder; an upgrade path marks a jobb as projekt, unlocking project features. | Evolves the existing `jobs` table in place: additive scope/upgrade marker + `work_orders` child table + `job_members`. One container, one RLS surface, migration-friendly (matches the oracle's shape). Upgrade = audited state change. |
| **B — flat + grouping (challenger)** | `Jobb` and `Projekt` are separate entities; a projekt groups jobb. | New `projects` table + nullable `project_id` on `jobs` (composite same-tenant FK). Two containers → two RLS/policy/H4 surfaces, aggregate economy read-models over the group, an extra workspace read-model (`Ingående jobb`). Migration must classify legacy projekt records into the new split. |
| **C — single typed entity (team implementation preference under A)** | One `jobs` table, `type ∈ {order, projekt}`; arbetsorder as child work items; upgrade = audited type change. | Additive columns on the existing `jobs` (`type` CHECK + project-scope fields nullable until upgrade) + `work_orders` + `job_members`. Phase A `jobs` is already nearly this. Upgrade = single-row audited transition guarded by a lifecycle check; project-only children (payment plan) carry a DB CHECK/trigger binding them to `type='projekt'`. |

Team recommendation (restated, not decided): **present A, implement as C**, keep B as the challenger.

### 8.2 What is bound regardless of the outcome (model-agnostic invariants)

- **E16–E18 schema design waits** on `7.1`/`7.3`; nothing in B1a or E14/E15 waits (PB-D12).
- **Bookings bind `jobs.id` today and survive every option:** A/C keep the table; under B, `jobs` remains the bookable child entity. Bookings created against Phase A basic jobs deepen seamlessly (PB-D12).
- **Job-workspace data contracts stay model-agnostic (UX §14.12):** the workspace binds **one job container id**; each tab is a read-model keyed by that id (bookings via `bookings.job_id`, files via `file_links(owner_type='job')`, time via `time_reports.job_id`, economy via the E17 companion tables). Option B adds exactly one read-model (`Ingående jobb` aggregate); no other contract changes — this confirms the UX §4.9 shell contract.
- **The completion event is model-independent:** `markJobComplete` emits the audited completion event on the container (§14) whatever the container is.
- The job-depth table candidates in §9.2 are named capabilities, not a schema commitment; their final shape is fixed in the recorded ADR-B006 at the B1a→B1b checkpoint.

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
| E14 | `person_work_hours` | Normalized weekly work-hours template rows per person; capacity math consumes these + injectable rule config so N-9 answers (anställningsgrad, holidays) land without schema rework (FR86). Holiday calendar, if N-9 requires one, is an additive `tenant_calendar_days` table — reserved, not built. |
| E14 | `bookings` | Booking rows (incl. materialized recurrence occurrences): time range (timestamptz UTC), all-day flag, work role, optional connections (job/customer/facility/contact — all nullable, PB-D12), description, status, series linkage (`series_id`, occurrence index, `is_exception`). |
| E14 | `booking_assignees` | Multi-assignee join (booking × person), composite same-tenant FKs. |
| E14 | `booking_conflicts` | Materialized conflict workflow records: type (double_booking / over_capacity / outside_work_hours), participants, window, status open/accepted/resolved, required reason on accept, resolver outcome + actor (§10.2). Detection stays deterministic/derived; this table persists workflow state. |
| E15 | `booking_series` | Recurrence rule (preset patterns + end condition — no freeform RRULE in B1), expansion horizon bookkeeping; occurrences materialize as `bookings` rows (§10.3). |
| E15 | `time_reports` | Own-row-scoped reports: user, date, duration, optional booking/job links, note; a `status` column ships with the single value `submitted` — the reserved approval seam (§10.6). |
| E15 | `calendar_feed_tokens` | Hashed per-user feed tokens (ADR-B004, §6.3). |
| E16–E18 | **GATED on ADR-B006** | Candidate set, named model-agnostically (final shape at the recorded ADR): job container evolution (columns on `jobs` or sibling `projects` under option B), `work_orders`, `job_members` (per-job roles incl. Arbetsledare), `job_material_usage`, `job_material_requests`, `job_payment_plans` (+ items; projekt-scope-bound), `job_diary_entries`, `job_deviations`, `job_chat_messages`, `job_risks` (~9–11 tables). Economy money lives in companion tables per §3.6 (e.g. rollup inputs valued in economy read-models; budget snapshot from the accepted quote). Photos/documents are **not** new tables — they are `files`/`file_links` with job-scoped owner types/purposes (§12). |
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
| E27 DoU | `dou_projects`, `dou_templates`, `dou_documents`, `dou_document_versions` (versioning + lock via the trigger family) | 4 |
| E28 self-inspections | `inspection_templates`, `inspection_template_items`, `self_inspections`, `self_inspection_items` (responses/measurements) | 4 |
| E29 tenders thin core | `tenders` (manual summary fields; files via `file_links`) | 1 |
| E30 KNX | `knx_projects`, `knx_rows` | 2 |
| E31 HR depth | extends `person_profiles` (employment columns/child) + `competence_cards`, `certifications`, `training_plans`, `hr_incidents`, `deletion_requests` (N-10 posture), `improvement_suggestions` (authenticated, P70-thinned). HR data row-sensitive → role-gated RLS (§3.6). | ~6–7 |
| E32 notes + CRM completions | `notice_posts` (+ categories/pins/mentions via E13), `customer_favorites`; customer-360/classification are read-models + small columns | ~2 |
| E33/E34 Fortnox | `fortnox_connections`, `integration_outbox`, `external_mappings` — **only after the final ADR-B005**, only with E33 activation | 3 (sketch) |

**Summary:** B1a adds 8 tenant-owned tables (+2 platform-scoped, +1 ops); B1b adds 8 ungated + ~9–11 gated job-depth candidates; B2 outlines ~26; B3 outlines ~19–20 (+3 Fortnox post-ADR). Every activation extends `TENANT_TABLES`, the exact-policy enumeration, and the per-role negative suite in the same PR.

## 10. Scheduling and Booking Engine

### 10.1 Conflict detection (FR85, NFR48)

- **One pure engine:** `src/features/scheduling/conflicts.ts` — deterministic function of (candidate booking(s), existing bookings, work-hours templates, capacity rule config). No I/O, no clock reads (the Phase A engine discipline). Conflict types: `double_booking` (assignee overlap), `over_capacity`, `outside_work_hours` `[rule set gated: N-9 — rules enter as injectable config + golden fixtures, never hardcoded]`.
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

Capacity math = booked time vs available time derived from `person_work_hours` templates + rule config. The N-9 gate supplies the rules (anställningsgrad, holidays, thresholds); the architecture guarantees: rules are config + data, never schema — new rules must not require schema rework.

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

## 13. Billing Basis (B2) — Placement and Lock Immutability

- **Placement (PB-D11):** E26 closes B2; it consumes job economy (E17), rental billing records (E21), and service records (E23); Fortnox (B3) consumes it. The Fortnox spike runs during B2 in parallel.
- **Assembly:** candidate lines are **copy-by-value snapshots** (the Phase A snapshot discipline): each `billing_basis_lines` row freezes source refs + description + öre amounts at assembly time; source-record changes never silently alter an assembled basis. Content definition of what constitutes a line `[gated: N-5]`; the line model (source type + frozen öre + include/exclude + adjustment) is mechanism and proceeds.
- **Adjustments pre-lock:** audited with required reason (`billing_basis_events` append-only + audit event).
- **Lock:** `Utkast → Låst → Exporterad`. `lockBillingBasis` is a transaction-sensitive RPC (§14); locked bases are **immutable via a DB trigger pair** — the fourth scope of the shared lock-code family (new SQLSTATE + command code `BILLING_BASIS_LOCKED`, same enumerate-the-exempt-tuple shape, reversal + identity-column tests mandatory). Corrections after lock follow the audited-correction pattern (NFR23 family): a correcting basis references the original; the original never mutates.
- **Correctness binding (NFR49):** amounts are engine-derived integer öre with golden/regression coverage before real invoicing use; **real-customer invoicing is blocked pending tax gates A/B/C + `2.2`** — enforced as posture (the sign-off register + the UX correctness banner), demo track unaffected. No new rounding rule may be introduced here (STOP condition carried from ADR-A004).

## 14. Command Layer and RPC Extensions (ADR-A009 pattern)

All new sensitive mutations use the Phase A envelope (+ the §3.5 capability gate). Transaction-sensitive multi-record commands use narrow **SECURITY INVOKER** RPCs per ADR-A009. The Phase B transaction-sensitive set:

| Command | Why transactional | Idempotency |
| --- | --- | --- |
| `createBooking` / `updateBooking` | booking + assignees + materialized conflict rows + acceptance state in one write (§10.2) | client-supplied command key on create; natural on update |
| `createBookingSeries` / `updateBookingSeries` (incl. "this and following" split) | series row + occurrence materialization (+ exception preservation) atomically | series-level dedupe key |
| `resolveConflict` | booking edit + conflict state flip + outcome record (+ notification enqueue) | conflict id + action |
| `markQuoteVersionLost` | widens the existing `mark_quote_version_lifecycle` RPC: append-only `quote_events` flip + `quote_lost_reasons` insert; sent-lock untouched | one lost-reason row per version (unique) |
| `markJobComplete` | completion event + downstream seeds (warranty stub when E23 active) in one transaction; **active-consumer flags are computed server-side from the manifest and passed to the RPC explicitly** — the RPC never guesses scope | one completion per job (unique/state guard) |
| `lockBillingBasis` | status flip + line freeze finalization + lock-apply + events | already-locked short-circuits to existing state |
| `provisionTenant` | tenant + baseline settings + first-Admin invited membership atomically | idempotent on org identity/key — re-run returns "already provisioned" (UX §4.3) |
| email-queue claim/process (producer-side) | claim-with-`FOR UPDATE SKIP LOCKED` + delivery-event append | dedupe key; provider message id recorded before `sent` |

Deliberate exceptions to INVOKER-default, each with the Phase A DEFINER hardening (fixed empty `search_path`, schema-qualified refs, explicit authorization check inside, revoked from PUBLIC, dedicated negative tests):

1. **`provision_tenant` is SECURITY DEFINER**, gated on `is_platform_operator()` — the operator has, by definition, no membership in the tenant being created (the chicken-egg); this is the sanctioned, separately-approved DEFINER case foreseen by ADR-A009. Supabase Auth admin-invite runs server-side in the command (service context), never in the RPC, never client-reachable.
2. **Background producers** run on the §4.3 service context with explicit per-tenant iteration — not an RPC exception but the one non-user execution context; containment rules in §4.3 apply.

Single-row mutations (role changes, follow-up scheduling/completion, notification read flips, preference toggles, conflict acceptance without booking edit) remain envelope commands on RLS-protected queries. Error codes extend the stable family: `PERMISSION_DENIED`, `BOOKING_CONFLICT_UNACKNOWLEDGED`, `SERIES_EDIT_SCOPE_REQUIRED`, `BILLING_BASIS_LOCKED`, `ALREADY_PROVISIONED`, `TOKEN_REVOKED` (public surfaces map to generic responses, §6.2).

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

### 15.5 Field transient-failure retention (UX §14.13)

Client-side only, matching the no-offline-promise posture (UXB-A11): capture forms (diary, deviation, photo caption, time report) keep state in **component state + `sessionStorage`** keyed per form+entity (survives accidental in-session navigation; expires with the session; nothing long-lived on shared devices — deliberately not `localStorage`, AB-A9). Photos pending upload are held as in-memory blobs/object URLs until upload confirms. Failures render the retained state + explicit `Försök igen`; no server-side draft storage, no service worker, no background sync in Phase B.

## 16. Test Strategy Extension

The Phase A layers (unit / command integration / RLS negative / storage negative / golden-master / migration reset / E2E / docs validators) carry unchanged. Phase B extends along five axes:

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
  features/
    scheduling/            # pure engines: conflicts.ts, recurrence.ts, capacity.ts
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
  fixtures/golden/scheduling/  # DST/recurrence/conflict packs (§16.4)
  fixtures/golden/jobs-money/  # economy/billing golden packs
```

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
| U12 | Job-workspace tab data contracts under ADR-B006 | Answered model-agnostically: one container id, per-tab read-models on stable keys (job_id / owner_type='job'); Option B adds only `Ingående jobb` | §8.2 |
| U13 | Field transient-failure retention | Answered: sessionStorage + in-memory blobs, explicit retry, no offline promise | §15.5 |
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
| Jobs core/economy/field/completion (FR93–106) | ADR-B006 gated (§8), §9.2 candidates, §14 (`markJobComplete`), §3.6 economy separation |
| Dashboard v1 (FR107–108) | §15.2, §11 |
| B2 coarse groups (FR109–118, NFR49–50) | §9.3, §12, §13, ADR-B005 (§7) |
| B3 coarse groups (FR119–128) | §9.4, §12, ADR-B005 (§7) |
| Governance (FR129–130, NFR51) | ADR-B003 (§5), §15.1–15.2 |
| Migration/golden discipline (NFR52) | §16.4–16.5 |
| Field posture (NFR53) `[gated: N-3]` | §15.5; responsive-web architecture assumptions per team recommendation |
| Carried NFR1–41 spine | §2 (no delta weakens an invariant; the four PRD §9.1 amendments are honored: NFR5 via §6.1, NFR29/NFR51 via §5, NFR31/NFR53 via §15.5, NFR33 via §7) |

**Validation result:** READY FOR THE PHASE B EPICS STAGE — with the deliberate exceptions: ADR-B006 gated (E16–E18 design blocked until recorded), ADR-B005 final design post-spike, and the owner gates of PRD §11 open by design. No gate blocks starting B1a.

## 21. Assumptions Register (autonomous run record — AB-A#)

| ID | Assumption / judgment call | Status |
| --- | --- | --- |
| AB-A1 | Extend-by-supersession honored: ADR-A001..A009 cited with deltas only (§2); the frozen Phase A architecture + `project-context.md` conventions govern wherever this document is silent. | accepted |
| AB-A2 | B1a ships single-role-per-membership storage with a role-SET code contract; `membership_roles` is the reserved additive extension if N-4/operations require multi-role. `tenant_admin` literal retained as the Admin role (zero data migration; `is_tenant_admin` untouched). | accepted; N-4 may trigger the extension |
| AB-A3 | Permission matrix is code-level (no DB permission tables) because B1a is seed-roles-only with no custom role builder (UXB-A7); a future role builder would migrate it to data. | accepted |
| AB-A4 | One background-execution lane (platform cron → runner endpoint) rather than pg_cron/Edge Functions — one runtime, one front door, one negative-test surface. Adding a second lane requires amending ADR-B002. | accepted |
| AB-A5 | Email provider selection deferred to the N-6 activation story behind the adapter seam; queue runs non-sending until then. No provider dependency in B1a. | accepted |
| AB-A6 | Manifest format TS over YAML; located `src/scope/manifest.ts` (runtime-importable; session's `docs/scope/…` was an example, not binding). | accepted |
| AB-A7 | Conflicts are deterministic-derived but **materialized** as workflow records (`booking_conflicts`) because accept/resolve states, reasons, and outcomes must persist and be auditable — this validates-and-amends UXB-A10. | accepted for architecture |
| AB-A8 | Operator console lives in the same Next.js deployment (route-territory isolation + operator allow-list) for Phase B; separate-deployment hardening is a named Phase C option. | accepted |
| AB-A9 | Field transient retention uses sessionStorage (not localStorage) to avoid long-lived capture data on shared devices; photos in-memory until upload. | accepted |
| AB-A10 | Time-report hard approval state deliberately not shipped in B1b; re-decided at the B1b→B2 checkpoint with E26/N-5 (resolves PB-A9 for now; additive enum widening if introduced). | accepted; checkpoint item |
| AB-A11 | Materialized-occurrence recurrence (bounded series, mandatory end condition) chosen over virtual expansion — conflict identity, resolver actions, exceptions, and feed stability all key on real rows. | accepted |
| AB-A12 | DST edge policy: spring-forward → first valid instant; fall-back → earlier instant; golden-pinned. | accepted (test-pinned at E14/E15) |
| AB-A13 | B2/B3 schema rows are outline-level by design (PB-D10); counts are indicative and finalized at wave-boundary checkpoints — they bound scope, they are not migrations. | accepted |
| AB-A14 | `job_runs` and `platform_operators` are the enumerated non-tenant-owned exceptions (ops log / platform identity), documented in §9.1 with their own RLS posture; everything else stays direct-`tenant_id`. | accepted |
| AB-A15 | The completion-event consumer flags are computed by the command layer from the manifest and passed explicitly to the RPC — SQL never encodes scope knowledge. | accepted |

## 22. Open Items for the Epics Stage

1. **Final epic set:** merge candidates per PRD §15.3 (E12→E11, E24→E22, E30 adjacency, E32 bundle); wave tags binding; every module epic's first story carries the manifest flip + matrix rows + negative tests (the §5.5 activation protocol) — make this a story-template requirement.
2. **Story 10.1 content is fixed** (§5.5 + PRD §13): AGENTS.md/guardrail re-baseline + manifest + derivations + coherence validator. Sequence it before any module story.
3. **ADR-B006 recording:** schedule the ADR write-up immediately after the owner möte (`7.1`/`7.3`); E16–E18 epic/story design blocked until then (AC-B1b-6); the §8.1 options table is the möte hand-out.
4. **Oracle terminology pass (U14):** a `legacy-oracle-explorer` terminology task per epic with `[oracle-check]` labels, before that epic's first story — encode as a story-gate in the epics doc.
5. **Wave-boundary checkpoints** own: coarse-FR expansion (PRD), B2/B3 schema finalization (§9.3–9.4), the time-report approval decision (§10.6/AB-A10), and any N-9-driven capacity-rule fixtures.
6. **B2 Fortnox spike story** (during B2, not B3): produce the spike report answering §7's questions; it feeds ADR-B005-final and the N-5 owner conversation (AC-B2-6).
7. **Owner-gate watchlist for sequencing:** N-3 (field posture) before E14/E15 UX stories; N-4 (role/money seed) before the E11 matrix seed lands as more than mechanism; N-9 before conflict-rule fixtures harden; N-6 before any send activation.

## 23. Handoff Guidance

Implementation proceeds through the Phase B epics doc (Epic 10+, wave-tagged) via the established per-epic pipeline. Before any Phase B implementation PR merges, confirm: the touched module is manifest-`active` (or the PR is its activation), matrix rows + per-role negatives land with activation, no background path exists outside ADR-B002, no public surface outside ADR-B004's closed set, no Fortnox artifact before ADR-B005-final, no E16–E18 schema before ADR-B006 is recorded, money is integer öre through `@/lib/money`, new tables are H4-enrolled with the exact-policy enumeration extended, and the Phase C ledger (PRD §14) stays untouched.

— End of Phase B architecture. Downstream: Phase B epics & stories (Epic 10+), then `project-context.md` refresh, per the ratified document plan (session §7).
