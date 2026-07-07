# Story 7.3: Minimal Job/Order Record And Tenant-Admin UX

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant admin,
I want to view the basic job/order created from an accepted quote — a read-only detail that traces the accepted commitment (source quote version, acceptance evidence, accepted price, customer/facility/contact, title/status, planned dates, files, event history) plus a filterable list — and make only Phase A-safe edits (title/status/planned dates), with all immutable source references non-editable,
so that accepted work is traceable and lightly manageable WITHOUT crossing into field-worker/schedule/time-material/deviation/ÄTA/invoice/Fortnox scope.

## Acceptance Criteria

**AC1 — Job/order detail with full source traceability (read-only source refs)**
**Given** an accepted quote has created a `jobs` row (via the 7.2 `accept_quote_and_create_job` RPC)
**When** the admin views the job/order detail at `/jobs/[jobId]`
**Then** it shows: the source quote version (link + quote number), the acceptance evidence (evidence file link OR external `evidence_reference`), the accepted price + source sent total (öre, displayed from the immutable `quote_acceptances` references — NEVER re-derived), the customer/facility/contact, the job `title`/`status`, the planned start/end dates, the linked files (via `file_links` owner_type=`job`), and the `job_events` history
**And** the source quote version reference + acceptance reference are DISPLAY-ONLY (no edit control renders for `quote_version_id`/`quote_acceptance_id`/`customer_id`/accepted price/source sent total/evidence) — the read layer surfaces them from the immutable refs, never re-derives (R-708, UX-DR26).

**AC2 — Job/order list with filter/search, no deferred surface**
**Given** the job/order list at `/jobs`
**When** the admin filters or searches
**Then** results can be filtered by customer, status, planned date, and source quote
**And** NO field-worker schedule, time/material, deviation, ÄTA, project-analytics, invoice, or Fortnox UI/route/label/control is shown ANYWHERE on the list or detail (a deferred-surface absence scan is a hard gate — R-711).

**AC3 — Tenant isolation on job reads AND allowed updates (RLS + command re-validation)**
**Given** tenant A and tenant B jobs
**When** tenant A attempts to read or update a tenant B `jobs`/`job_events` record (via the read path OR the allowed-edit command)
**Then** RLS AND command-layer ownership validation reject access (a foreign `jobId` ⇒ zero rows ⇒ generic not-found on read; ⇒ `TENANT_ACCESS_DENIED` on the command, no existence disclosure; anon ⇒ `UNAUTHENTICATED`) — the three tables are already enrolled in the H4 tenant-inventory gate (7.1); 7.3's live-path negatives target the job read + the `updateJob` command.

**AC4 — Phase A-safe allowed edits are audited; immutable refs cannot be mutated**
**Given** an existing job/order
**When** the admin edits ONLY the Phase A-safe fields (`title`, `status` within the closed `created|in_progress|done|cancelled` set, `planned_start_date`, `planned_end_date`)
**Then** the change persists through an audited `updateJob` command (a single `audit_events` row per change, allow-listed `{ targetId }` metadata — NO PII/price/customer in metadata), a `job_events` lifecycle row is appended when the status changes, and NO path (command validation rejects unknown fields; RLS + composite same-tenant FKs + the coming 7.4 immutability trigger) allows mutating `quote_version_id`/`quote_acceptance_id`/`customer_id`/accepted price/source sent total/evidence/accepted timestamp/channel — the immutable commitment data (7.4 hardens the DB lock; 7.3 must NOT expose any edit affordance for those fields).

**AC5 — Repeated acceptance/create-job shows the EXISTING job, not a duplicate or an error (idempotency UI mirror)**
**Given** an already-accepted quote version whose acceptance/create-job is re-attempted (double-submit, retry)
**When** the admin lands on the acceptance/quote UI or the job view
**Then** the EXISTING accepted state + the EXISTING single job are shown (a deep link from the accepted quote version to its one `jobs` row) — NEVER a duplicate job, a second create affordance, or an error (UX-DR24; the DB `unique (quote_acceptance_id)` + the 7.2 idempotent RPC guarantee one job; 7.3 surfaces it).

**AC6 — Activate the `job` file owner type + `job_evidence` purpose (job files surface)**
**Given** the 8.1 file model with `job`/`job_evidence` structurally present but INACTIVE at the command layer
**When** 7.3 wires the job-files surface (AC1's "files")
**Then** it ACTIVATES `job` in `ACTIVE_OWNER_TYPES` + adds its `ownerTableFor` branch (`job → jobs`) so a file can be own-tenant-linked to a job via `createFileLink` (owner_type=`job`, purpose=`job_evidence`), reusing the 8.1 signed-access + own-tenant ownership funnel VERBATIM — NO competing file/evidence store (R-814 STOP), NO upload UX built here (upload is Epic 8.2; 7.3 reads/links existing files + external references).

## Scope Boundary (read first — this is a multi-story epic)

7.3 lands **the read/traceability UX + the minimal allowed-edit command + the `job` file-owner activation**. Precisely what belongs where:

- **7.1 (DONE, do NOT rebuild):** the migration `20260709120000_acceptance_to_job_model.sql` creating `quote_acceptances`/`jobs`/`job_events` (columns, composite same-tenant FKs, uniqueness constraints, RLS own-tenant policies, GRANTs, indexes, `TENANT_TABLES` enrollment); the `captureQuoteAcceptance` command + `acceptance-price.ts` delta module; the `quote_acceptance` file-owner activation. **All frozen. 7.3 REUSES the tables verbatim — it adds NO column and NO table.**
- **7.2 (DONE, do NOT rebuild):** the `accept_quote_and_create_job` RPC (migration `20260710120000_accept_quote_and_create_job.sql`) that POPULATES `jobs`/`job_events` transactionally + idempotently; the `acceptQuoteAndCreateJob` command; the acceptance-UI re-point; the epic-6 affordance gating (new-version/PDF-retry gated OFF `accepted`). **7.3 SURFACES the `jobs` rows 7.2 creates — it does NOT touch the RPC or the acceptance transaction.**
- **7.3 (THIS story):** the `/jobs` list (replace the `PagePlaceholder`) + `/jobs/[jobId]` detail read UX; the RLS-scoped `src/features/jobs/read.ts` list + detail projections; the `updateJob` allowed-edit command (title/status/planned dates only, audited); the `job` file-owner-type + `job_evidence` activation; the deep-link from the accepted quote version to its job; the list filter/search; the deferred-surface guardrail; the E2E traceability + no-deferred-label tests. **7.3 adds NO migration** (no schema change — read + an UPDATE-only command over frozen tables). If you find yourself writing a migration, that is a design-drift STOP (unless the ONLY thing it does is the additive 7.4-shaped work — which it must NOT, that is 7.4).
- **7.4 (LATER, do NOT build here):** the accepted-state DB immutability trigger/constraints on `quote_acceptances`/`jobs` + the command lock code + the correction-boundary UI. 7.3 must NOT expose ANY edit affordance for immutable source/commitment fields, and must leave the `jobs` row shaped so 7.4 can add the immutability trigger ADDITIVELY (same pattern as 6.1→6.4, 7.1→7.4). 7.3 itself adds NO immutability trigger. **7.3's `updateJob` command MUST only touch the four Phase A-safe columns** — a broader UPDATE would fight the coming 7.4 trigger.

## Tasks / Subtasks

- [x] **Task 1 — RLS-scoped job read layer (`src/features/jobs/read.ts`) (AC1/AC2/AC3)** — plain async server-only functions on the per-request cookie-bound RLS client (anon key — NEVER service-role), mirroring `src/features/quotes/read.ts` VERBATIM (server-only, no `"use server"`; RLS scopes every row to the caller's tenant with NO tenant id passed; a cross-tenant/nonexistent id ⇒ zero rows ⇒ generic not-found, never an existence leak; `bigint` öre coerced to numbers at THIS boundary; snake_case → camelCase here).
  - [x] 1.1 `readJobList(filters?)` — the `/jobs` index projection over ACTIVE jobs (`archived_at is null`), ordered `updated_at desc`. Project: `id`, `title`, `status`, `planned_start_date`/`planned_end_date`, `customer_id` + the joined `customer_display_name`/name (embed via the composite FK, mirror `readQuoteList`'s embedded customer join), the source `quote_version_id` + its quote number (join through the version), `updated_at`. Support optional server-side filters: by `customer_id`, by `status` (closed set), by planned-date range, and by source quote (`quote_id`/`quote_version_id`). Return `{ rows, error }` (a generic error string on a transient failure — NEVER a leaked detail).
  - [x] 1.2 `readJobDetail(jobId)` — the `/jobs/[jobId]` detail projection. Read the `jobs` row (RLS-scoped; foreign/nonexistent ⇒ null ⇒ page 404), then read from the IMMUTABLE source references (NEVER re-derive money): the accepted `quote_acceptances` row (`accepted_price_ore`, `source_sent_total_ore`, `channel`, `accepted_at`, `adjustment_reason`, `evidence_file_id`, `evidence_reference`, `notes`, `planned_start_date`/`planned_end_date`) via `quote_acceptance_id`; the source `quote_versions` row (quote number, quote id, customer/facility/contact DISPLAY names from the frozen snapshot — never a personnummer); the customer/facility/contact display names; the linked `file_links` (owner_type=`job`) + evidence file; and the `job_events` history (ordered `occurred_at`). Return a single view-model coercing öre to numbers.
  - [x] 1.3 SCOPE GUARD in the read layer: DISPLAY the accepted price + source sent total + evidence + source refs from the immutable `quote_acceptances`/`quote_versions` rows — NEVER re-read the live calc/settings/pricing to re-derive a total (the copy-by-value freeze; R-708/R-616). NEVER select a `personnummer` (inherited epic-3/epic-6 private-data posture — display names only).
- [x] **Task 2 — `/jobs` list page + `JobList` client island (AC2/AC5)** — replace `src/app/(app)/jobs/page.tsx` (currently a `PagePlaceholder`) with a SERVER component over `readJobList` (mirror `src/app/(app)/quotes/page.tsx` — `export const dynamic = "force-dynamic"`; NO new auth mechanism; NO new nav item — "Jobb/Order → /jobs" already exists in the seven-item shell nav, `src/components/app-shell/nav-items.ts`). Hand rows to a client `JobList` (`src/components/quotes/QuoteList.tsx` is the shape to mirror) that renders the filterable/searchable table, each row linking to `/jobs/[jobId]`.
  - [x] 2.1 Filter/search controls: customer, status, planned-date, source-quote (AC2). Keep it a thin index (the detail is the heart of the story). Status labels are TEXT not color-alone (a11y — UX baseline).
  - [x] 2.2 SCOPE GUARD: NO field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/Fortnox column, control, label, badge, or link on the list. NO placeholder for a deferred module.
- [x] **Task 3 — `/jobs/[jobId]` detail page + `JobDetailView` (AC1/AC4/AC5)** — a NEW route `src/app/(app)/jobs/[jobId]/page.tsx` (SERVER component over `readJobDetail`; `dynamic = "force-dynamic"`; a null read ⇒ `notFound()`). Render `JobDetailView` (`src/components/quotes/QuoteDetailView.tsx` is the closest read-detail shape to mirror; place the new component under `src/components/jobs/`).
  - [x] 3.1 Source traceability block (AC1, read-only): source quote version (link to `/quotes/[quoteId]/versions/[versionId]` + quote number), acceptance evidence (a signed link to the evidence file via the 8.1 signed-access command OR the `evidence_reference` text), accepted price + source sent total (öre → kronor via the existing money display helper, e.g. `oreToKronorString`), customer/facility/contact, planned dates, files (owner_type=`job`), event history. Every immutable field is DISPLAY-ONLY — render NO edit control for source refs / accepted price / source total / evidence / accepted timestamp / channel (UX-DR26; the coming 7.4 trigger is the DB backstop, but 7.3 must not even offer the affordance).
  - [x] 3.2 Allowed-edit affordance (AC4): a minimal edit form/dialog for `title`, `status` (the closed `created|in_progress|done|cancelled` set — a select), `planned_start_date`, `planned_end_date` ONLY. Wire it to the `updateJob` action (Task 4). On idempotent re-attempt / repeated acceptance, this detail is where the deep link from the accepted quote version lands (AC5 — show the EXISTING job, never a duplicate/create affordance).
  - [x] 3.3 SCOPE GUARD: NO field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/Fortnox surface. Status is a Phase-A order-lifecycle set, NOT field-worker states (no scheduled/dispatched/on-site).
- [x] **Task 4 — `updateJob` allowed-edit command (AC3/AC4)** — a `defineCommand` through the EXISTING envelope in a NEW `src/server/commands/jobs/` dir (e.g. `jobs.ts` + `validation.ts`), patterned EXACTLY on `updateCustomer`/`updateFacility` (`src/server/commands/crm/*`): validate typed input → verify ownership → execute the UPDATE via the RLS client → append-only audit.
  - [x] 4.1 `validateInput` (pure): accept ONLY `{ id, title?, status?, planned_start_date?, planned_end_date? }`. UUID guard on `id`; `status` ∈ the closed `created|in_progress|done|cancelled` set; ISO-date guards on the planned dates; REJECT any unknown field (incl. `quote_version_id`/`quote_acceptance_id`/`customer_id`/`accepted_price_ore`/`evidence_*`/`accepted_at`/`channel`/`tenant_id`) with `VALIDATION_FAILED` (the immutable/commitment fields are NOT part of the input shape — a client cannot smuggle them). Client-supplied `tenant_id` is NEVER read (resolved tenant is the only authority).
  - [x] 4.2 `ownership: (input) => ({ table: "jobs", id: input.id })` — a foreign/nonexistent job id ⇒ `TENANT_ACCESS_DENIED` BEFORE execute (no existence disclosure; AC3).
  - [x] 4.3 In `execute`: build the patch from ONLY the supplied Phase A-safe fields; short-circuit an empty patch (return the target id unchanged — the epic-3/epic-5 empty-patch guard, prevents a false `TENANT_ACCESS_DENIED` on `.update({})`). UPDATE `public.jobs set <patch> where id = input.id` on the RLS client (own-tenant WITH CHECK narrows it). When `status` changes, append a `job_events` row (`event_type` = the new status, `occurred_at` = the injected `ctx.clock.now()`). Map write errors via the shared mapper (23503/42501 → `TENANT_ACCESS_DENIED`; 23505/23514/22P02 → `VALIDATION_FAILED`).
  - [x] 4.4 `auditable: true`, `eventType: "job.updated"` (+ `"job.status_changed"` when status changes, if the vocabulary distinguishes), `targetType: "job"`, allow-listed `auditFields: (ctx) => ({ targetId: ctx.input.id })` — NO PII/price/customer/title in metadata (audit-hygiene, R-710). Export `updateJob` (+ validator/types) from a `src/server/commands/jobs/index.ts`.
  - [x] 4.5 A thin server action `updateJobAction` (`src/features/jobs/actions.ts` + an action-state module mirroring the quote action-state files) that delegates to `updateJob` and revalidates `/jobs` + `/jobs/[jobId]` after success. NO other mutation surface (no create/delete/archive job affordance from 7.3 — a job is only created by the 7.2 acceptance transaction, and delete is not granted).
- [x] **Task 5 — Activate the `job` file owner type + `job_evidence` purpose (AC6)** — the MINIMAL activation, mirroring 7.1's `quote_acceptance` activation:
  - [x] 5.1 Add `"job"` to `ACTIVE_OWNER_TYPES` in `src/server/commands/files/validation.ts` (it is already in `OWNER_TYPES` + the DB CHECK; `job_evidence` is already in `FILE_PURPOSES`) and update the module header note (currently: "`job` remains not-yet-available until Story 7.3 wires the job-evidence surface").
  - [x] 5.2 Add the `case "job": return "jobs";` branch to `ownerTableFor` in `src/server/commands/files/file-db.ts` (the exhaustiveness `assertNeverOwnerType` guard forces this — adding the active type without the branch is a COMPILE error). This lets `createFileLink` resolve a job owner under own-tenant RLS (a foreign job owner id ⇒ zero rows ⇒ `TENANT_ACCESS_DENIED`; R-802 both-side check).
  - [x] 5.3 SCOPE GUARD: NO upload UX (Epic 8.2 owns validated uploads); 7.3 links/reads EXISTING files + external references only. NO competing evidence/file store (R-814 STOP). Reuse `createFileLink` + `ownerRecordVisible` + the 8.1 signed-access command VERBATIM. If a `file_links` link is materialized for a job, it must be find-or-create-safe (mirror 6.1/6.3/7.1 — an `exists(...)` guard or single link, no duplicate on retry; the R-814 8.1-no-dedupe residual).
- [x] **Task 6 — Deferred-surface guardrail + no-new-nav-item scan (AC2)** — extend/mirror the `tests/unit/guardrails/acceptance-non-scope.test.ts` pattern with a job-non-scope fast-gate scan: assert NO `field-worker`/`schedule`/`time-material`/`timesheet`/`deviation`/`ata`/`ÄTA`/`fortnox`/`invoice`/`billing`/`analytics`/`supplier` route segment or surface token appears under `src/app/jobs/**` + `src/features/jobs/**` + `src/components/jobs/**` + `src/server/commands/jobs/**`; assert the nav item count stays exactly seven (no new nav item — "Jobb/Order" already exists). NO public/portal/webhook/cron job route.
- [x] **Task 7 — Tests (per test-design-epic-7.md §Coverage Plan, story 7.3 rows)** — see the Testing section for the exact `7.3-*` IDs, levels, and the epic Exit Criteria this story satisfies. Highest-stakes: `7.3-INT-01` (source-of-truth-from-immutable-refs proof) + `7.3-E2E-01` (traceability) + `7.3-E2E-03` (deferred-surface absence) + `7.3-INT-02` (audited allowed edits, immutable refs non-editable). NO new table ⇒ the H4/enrollment coverage is 7.1's (already green); 7.3's cross-tenant/anon negatives target the LIVE job read + `updateJob` command.

## Dev Notes

### Primary sources (read these first)
- **Test design (authoritative test spec):** `_bmad-output/test-artifacts/test-design-epic-7.md` — the 7.3 rows in the Coverage Plan (`7.3-E2E-01` traceability, `7.3-INT-01` immutable-source-of-truth, `7.3-E2E-02` repeated-attempt-shows-existing, `7.3-E2E-03` deferred-surface-absence, `7.3-INT-02` audited allowed edits, `7.3-E2E-04` a11y); the Risk table (R-708 job shows wrong/mutable source data, R-711 deferred-scope leak, R-712 duplicate job on retry, R-717 fixture PII); Entry/Exit Criteria ("Job traceability proven" exit line ~461-463).
- **Epic + AC source:** `_bmad-output/planning-artifacts/epics.md#Story 7.3` (lines 1484-1518); FR41-FR48 (esp. FR48 "Job/order shows source quote version, acceptance evidence, price, and totals").
- **Architecture:** §4 (route/module structure — `/jobs` "Jobb/Order · Basic accepted-work list only", `/jobs/[jobId]` "Source quote/acceptance, basic status/planned dates/files/events · No field-worker UX", lines 245-246); §5 (command pattern — the 9-step command shape); §7 (`jobs` "Minimal basic job/order from accepted quote", line 363); §13 (the accepted-to-job transaction — 7.3 DISPLAYS from the immutable refs the transaction wrote); §"Field Workflow" (jobs is a MINIMAL accepted-work record; field workflow is a SEAM/BOUNDARY only, lines 740-743); §14 (file owner-type/purpose union); ADR-A005 (immutable accepted model — 7.3 displays it, 7.4 locks it); ADR-A008 (field-workflow seam only).
- **Previous stories:** `_bmad-output/implementation-artifacts/7-2-idempotent-accept-quote-and-create-job-command.md` (the RPC that POPULATES `jobs`/`job_events`; the acceptance-UI re-point; the accepted-quote deep-link seam; the affordance gating) and `7-1-acceptance-evidence-capture-for-sent-quote-versions.md` (the acceptance schema + evidence-link mechanism 7.3 reads; the `quote_acceptance` file-owner activation to mirror for `job`).

### Reference implementations to COPY the pattern from (do NOT re-invent)
- **Read layer (RLS-scoped, server-only, list + detail projection, öre coercion, generic not-found):** `src/features/quotes/read.ts` — `QuoteListRow`/`readQuoteList` (the thin index projection + embedded customer join + `updated_at desc`) and the detail read (`readQuoteDetail`) that surfaces the FROZEN snapshot VERBATIM without re-deriving. Mirror EXACTLY: `oreNumber`/`num` coercion helpers, the `GENERIC_READ_ERROR` string, the "display the immutable ref, never recompute" discipline (R-708 is the 7.3 analog of 6.2's R-616). Also `src/features/calculations/read.ts` (the read.ts shape both quotes/calcs mirror).
- **List page + client island:** `src/app/(app)/quotes/page.tsx` (SERVER component, `force-dynamic`, NO new nav item) + `src/components/quotes/QuoteList.tsx` (the client table island). `/jobs/page.tsx` currently renders `PagePlaceholder` ("Den här modulen byggs i Epic 7") — REPLACE it.
- **Detail page + view:** `src/app/(app)/quotes/[quoteId]/page.tsx` (the `[param]` server page → `notFound()` on null) + `src/components/quotes/QuoteDetailView.tsx` (the read-detail shape: sections, `data-testid` hooks, `oreToKronorString(selected.accepted_price_ore)` money display, the accepted-price block at line ~338). The QuoteDetailView accepted section (lines 417-434) already tells the admin "Ett jobb har skapats från den accepterade offerten" — 7.3 should make that a deep LINK to `/jobs/[jobId]` (the AC5 idempotency deep-link seam).
- **Allowed-edit command (validate → ownership → RLS update → audit; empty-patch guard; patch from supplied fields only):** `src/server/commands/crm/customers.ts` (`updateCustomer`) + `src/server/commands/crm/facilities.ts` (`updateFacility`) — the `defineCommand` shape, `ownership`, the empty-patch short-circuit (`if (Object.keys(patch).length === 0) return { targetId: input.id };` — the epic-3/epic-5 deferral fix), `auditable: true` + allow-listed `{ targetId }` `auditFields`. The shared write-error mapper + the injected `ctx.clock.now()` for lifecycle/event timestamps.
- **File owner-type activation (mirror 7.1's `quote_acceptance`):** `src/server/commands/files/validation.ts` (`ACTIVE_OWNER_TYPES` — add `"job"`; the module header note says `job` is "not-yet-available until Story 7.3") + `src/server/commands/files/file-db.ts` (`ownerTableFor` — add `case "job": return "jobs";`; the `assertNeverOwnerType` exhaustiveness guard forces the branch). `createFileLink` + `ownerRecordVisible` + the 8.1 signed-access command are REUSED verbatim.
- **Deferred-surface guardrail:** `tests/unit/guardrails/acceptance-non-scope.test.ts` (`7.x-E2E-01` — the `node --test` route-segment + surface-token scan) + `tests/unit/guardrails/quote-non-scope.test.ts`. Mirror for a `job-non-scope` scan.
- **Frozen jobs schema (7.1, do NOT re-create):** `supabase/migrations/20260709120000_acceptance_to_job_model.sql` — `jobs` columns (`id`, `tenant_id`, immutable `quote_acceptance_id`/`quote_version_id`, `customer_id`/`facility_id`/`contact_id`, `title`, `status` default `'created'` CHECK `created|in_progress|done|cancelled`, `planned_start_date`/`planned_end_date`, `archived_at`, `created_at`/`updated_at`; `unique (quote_acceptance_id)` one-job-per-acceptance; `unique (id, tenant_id)` the `job_events` FK target); `job_events` (`event_type` CHECK `created|in_progress|done|cancelled`, `occurred_at`, `channel`/`reference`); RLS own-tenant SELECT/INSERT/UPDATE (NO delete), `authenticated` GRANT SELECT/INSERT/UPDATE. All three tables enrolled in `tests/integration/rls/tenant-table-inventory.ts` (H4 gate green from 7.1).

### Epic-7 retro-note constraints (surfaced by earlier stories in THIS epic — apply directly)
- **[7.2 dev-story] The job's `customer_id`/`facility_id`/`contact_id` were read off the PARENT `quotes` row, NOT `quote_versions` (the version snapshot holds only DISPLAY names).** The 7.2 RPC carried customer/facility/contact IDs from the parent quote into the `jobs` row (a 42703 RED-phase bug fixed by moving the read to the parent quote). **So the `jobs` row's `customer_id`/`facility_id`/`contact_id` are the AUTHORITATIVE ids for 7.3's detail read** — join THEM to `customers`/`facilities`/`contacts` for the current display names. For the accepted commitment's frozen customer/facility/contact DISPLAY names (as at acceptance time), read the `quote_versions` snapshot's display fields (never a live re-derive; never a personnummer). Do NOT expect the version snapshot to carry the id — it carries display names only.
- **[7.2 dev-story] The command sent-state gate was relaxed to let an already-`accepted` version reach the RPC's idempotent short-circuit; 7.4 immutability MUST preserve this retry path.** 7.3 is downstream: its AC5 (repeated-attempt-shows-existing) RELIES on that idempotent path already producing exactly ONE job (`unique (quote_acceptance_id)`). 7.3 just surfaces the single existing job; it does NOT add a second create affordance.
- **[epic test design] Accepted-immutability is ONE model at three scopes across three epics** (Epic 6 sent-freeze R-605, Epic 7 accepted-lock R-704, Epic 8.4 locked-evidence-file). 7.3 DISPLAYS the accepted record + job; **7.3 must NOT expose any edit affordance for immutable commitment/source fields** and must leave the `jobs`/`quote_acceptances` rows shaped so 7.4 can add the accepted-immutability trigger ADDITIVELY (same pattern as 6.1→6.4). Do NOT fork the lock model; 7.3 adds NO immutability trigger and NO migration.
- **[epic test design] The 6.4 sent-lock trigger transitions `status` ALONE and rejects customer-visible column co-mutation** — this is a 7.2 concern (the accept lifecycle flip), NOT 7.3's (7.3 does not touch `quote_versions`). 7.3's `updateJob` UPDATE targets `jobs` ONLY (which has NO such trigger yet); keep the `updateJob` patch to the four Phase A-safe columns so the coming 7.4 `jobs` immutability trigger does not fire on an allowed edit.

### Deferred-work ledger items that overlap this story (fold in, don't reopen unrelated ones)
- **[8.1 iter-2, R-814] `file_links` has NO dedupe uniqueness; `createFileLink` does no existence check.** When wiring the job-files surface (Task 5), a job-file link (owner_type=`job`) must be find-or-create-safe if 7.3 materializes one on a repeatable path — mirror 6.1/6.3/7.1's `exists(...)` guard (or a single link). But 7.3's primary job-files surface is READ (list existing links) + reuse the 8.1 signed-access; a double-linked file is the residual to avoid, not a blocker. Do NOT add a DB unique constraint (8.1 schema stays unchanged — that is deferred to the Epic 6.1/6.3 reuse story per the ledger). Owner of the constraint decision remains the reuse story; 7.3 just avoids duplicate links on its own path.
- **[8.1] `link_existing_file` never transitions `files.lifecycle_state` draft→linked; the draft→linked transition is owned by Story 8.2.** If 7.3 links a job file, do NOT flip `lifecycle_state` — 8.2 owns that transition. `draft` is still access-eligible, so signing/access is unaffected. Consumers must not infer link status from `lifecycle_state`.
- **[7.1 review, Low — Epic-6/7 reconcile] `source_sent_total_ore` derives from `quote_versions.accepted_price_ore` (defaults 0).** The accepted commitment's source sent total the job detail displays comes from the `quote_acceptances.source_sent_total_ore` the 7.2 transaction persisted (a real non-zero value in the seeded fixtures). 7.3 DISPLAYS this frozen value; it does NOT re-derive or add a `> 0` guard. A 0-frozen sent version is a data-quality dependency on Epic 6, NOT a 7.3 defect — seed a real non-zero commitment in the 7.3 fixtures.
- **[epic-6 gate, Med — assigned to Epic 7] Correction + PDF affordances render on every non-draft version, including the now-reachable `accepted`.** RESOLVED IN 7.2 (Task 5 gated new-version/PDF-retry OFF `accepted`). 7.3 does NOT re-do this; it only ADDS the deep-link from the accepted version to its job. Do NOT re-open the gating.
- **[Epic-4/7, R-716] Per-person ROT cap is a flat-cap placeholder (Sign-Off Q3, deferred).** 7.3 DISPLAYS the accepted price AS GIVEN from the immutable `quote_acceptances` row; it does NOT re-run or imply a per-person-scaled ROT/VAT engine. Documented residual only — no code impact on 7.3.

### Money / öre discipline (money impact HIGH — AC1)
- Accepted price + source sent total are `bigint` integer öre on the frozen `quote_acceptances` row (7.1-landed, `CHECK >= 0`). 7.3 DISPLAYS them via the existing money display helper (`oreToKronorString` — same as QuoteDetailView's `data-testid="quote-accepted-price"` at line ~338). NEVER re-derive a total in the read layer; NEVER float/kronor math. Coerce PostgREST's `bigint`-as-string öre to numbers at the read boundary (the `oreNumber` helper). The accepted value + source totals are DISPLAYED from immutable snapshot references (UX-DR26, R-708) — the whole point of the story is that mutating any upstream source AFTER job creation leaves the job detail unchanged (`7.3-INT-01`).

### Golden / fixtures / PII discipline (R-717)
- 7.3 lands NO new golden (the accepted-quote-to-job golden is 7.2's `7.2-GOLDEN-01`). 7.3's fixtures are two-tenant INT/E2E seeds. Extend the CI PII/secret + ORGNR scan to any job fixture; keep any öre value < 10 digits (the orgnr-scan boundary, R-717); NO PII (personnummer/orgnr/name/email/phone/address) in fixtures; NO clock in a golden. Seed a REAL sent-then-accepted chain: drive the REAL `mark_quote_version_sent` RPC to produce a `sent` version (Epic 6 landed — no synthetic sent row; and the 6.4 child-lock: seed `draft` → add children → flip to `sent`), then the REAL `accept_quote_and_create_job` RPC (7.2 landed) to produce the acceptance + job — never insert a `jobs` row directly for a live-path test (the job must come from the real transaction so the source refs are authentic).

### Project Structure Notes
- Read layer → NEW `src/features/jobs/read.ts` (+ `actions.ts` + an action-state module) mirroring `src/features/quotes/`. List page → REPLACE `src/app/(app)/jobs/page.tsx` (currently `PagePlaceholder`). Detail page → NEW `src/app/(app)/jobs/[jobId]/page.tsx`. Components → NEW `src/components/jobs/JobList.tsx` + `JobDetailView.tsx` (mirror `src/components/quotes/QuoteList.tsx` + `QuoteDetailView.tsx`). Command → NEW `src/server/commands/jobs/{jobs.ts,validation.ts,index.ts}` (mirror `src/server/commands/crm/`). File-owner activation → EDIT `src/server/commands/files/validation.ts` + `file-db.ts`. Guardrail → NEW `tests/unit/guardrails/job-non-scope.test.ts`. Tests → `tests/integration/commands/**` (updateJob + source-of-truth INT), `tests/e2e/jobs/**` (traceability, deferred-surface, repeated-attempt, a11y).
- NO migration, NO new table ⇒ the H4 gate + migration-reset per-table policy enumeration are UNCHANGED (H4 covers tables; the three job tables are 7.1-enrolled). The deep-link from `QuoteDetailView` (accepted section) to `/jobs/[jobId]` is the only edit to an existing quote component.
- The `/jobs` nav item ("Jobb/Order") ALREADY EXISTS in `src/components/app-shell/nav-items.ts` (the seven-item shell). 7.3 adds NO nav item and NO eighth module — it fills in the two `/jobs` routes behind the existing nav entry. Deferred modules must not appear as nav/placeholders/dormant UI (architecture §4, FR61).

### Testing standards summary
- **Two runners:** `node --test` (pure UNIT + the guardrail scan under `tests/unit/**`), Vitest (INT/RLS, DB-backed, local Supabase stack), Playwright for E2E. `SUPABASE_TEST_REQUIRED=1` hard-fails a missing stack in CI. Poll `/auth/v1/health` to 200 after `supabase db reset` before trusting a local INT run (the post-reset Kong 502 false-green trap — epic-5/8 retros).
- **Fixtures:** two-tenant factory; drive the REAL `mark_quote_version_sent` then `accept_quote_and_create_job` RPCs to produce an authentic accepted-quote→job chain (never a hand-inserted `jobs` row on a live-path test). Seed a NON-ZERO frozen `source_sent_total_ore`. Count-asserting tests seed `crypto.randomUUID()`. The 7.2 factory already added `adminSelectJobRow`/`adminSelectJobsForAcceptance`/`adminSelectJobEventsForJob` — REUSE them (and a dedicated `acceptQuote` sent-version fixture exists in the E2E global-setup from 7.2).
- **RLS negatives BEFORE positives; enrollment is the completeness guarantee** — the three tables are already enrolled (7.1). 7.3's cross-tenant/anon negatives (AC3) go against the LIVE job read (`readJobDetail` returns null for a foreign id) + the `updateJob` command (foreign id ⇒ `TENANT_ACCESS_DENIED`; anon ⇒ `UNAUTHENTICATED`).
- **`7.3-INT-01` is the highest-value INT proof (R-708):** create the job via the real transaction, then MUTATE an upstream mutable source (e.g. rename the customer, edit the live calc — anything the job does NOT reference by value) AND assert the job detail read is UNCHANGED (it reads from the immutable `quote_acceptances`/`quote_versions` refs, never re-derives). A happy-path field-exists assertion does NOT prove source-of-truth-from-immutable-refs.

### References
- [Source: _bmad-output/test-artifacts/test-design-epic-7.md#Test Coverage Plan (7.3-E2E-01/02/03/04, 7.3-INT-01/02); #Risk Assessment R-708/R-711/R-712/R-717; #Exit Criteria (Job traceability proven, lines ~461-463); #Non-scope (field-worker/invoicing/Fortnox boundaries, lines ~256-257)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3 (lines 1484-1518); FR41-FR48]
- [Source: _bmad-output/planning-artifacts/architecture.md#4 (routes /jobs + /jobs/[jobId], lines 245-246); #5 (command pattern); #7 (jobs table row, line 363; file_links, line 366); #13 (acceptance-to-job transaction); #"Field Workflow" (seam only, lines 740-743); #14 (file owner-type/purpose union); ADR-A005 (immutable accepted model); ADR-A008 (field-workflow seam)]
- [Source: supabase/migrations/20260709120000_acceptance_to_job_model.sql (the frozen jobs/job_events/quote_acceptances schema 7.3 reads + updates); 20260710120000_accept_quote_and_create_job.sql (the RPC that populates jobs)]
- [Source: src/features/quotes/read.ts (the RLS-scoped list+detail read pattern to mirror); src/app/(app)/quotes/page.tsx + quotes/[quoteId]/page.tsx (list+detail page pattern); src/components/quotes/QuoteList.tsx + QuoteDetailView.tsx (list+detail view pattern; the accepted-section deep-link seam at lines 417-434); src/server/commands/crm/customers.ts + facilities.ts (the updateJob allowed-edit command pattern + empty-patch guard)]
- [Source: src/server/commands/files/validation.ts (ACTIVE_OWNER_TYPES — add "job"; header note names Story 7.3); src/server/commands/files/file-db.ts (ownerTableFor — add job→jobs branch); src/components/app-shell/nav-items.ts (Jobb/Order → /jobs already exists — no new nav item)]
- [Source: tests/unit/guardrails/acceptance-non-scope.test.ts + quote-non-scope.test.ts (the deferred-surface scan pattern to mirror for job-non-scope); tests/integration/rls/tenant-table-inventory.ts (the 3 job tables already enrolled)]
- [Source: _bmad-output/implementation-artifacts/7-2-idempotent-accept-quote-and-create-job-command.md (the RPC that populates jobs; the customer/facility/contact-off-parent-quote gotcha; the acceptance-UI deep-link seam; the reusable job test factories); 7-1-acceptance-evidence-capture-for-sent-quote-versions.md (the quote_acceptance file-owner activation to mirror)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md (8.1 R-814 file_links no-dedupe → find-or-create; 8.1 draft→linked owned by 8.2; 7.1 zero-frozen-total residual; epic-6 affordance-gating resolved in 7.2; R-716 per-person ROT cap); _bmad-output/auto-bmad/retro-notes/epic-7.md (customer/facility/contact off parent quote; relaxed sent-state gate for idempotent re-entry; accepted-immutability one model)]

## Testing

Per `test-design-epic-7.md` — the story-7.3 rows. All run in the every-PR gate (UNIT/guardrail seconds; INT on the local stack; E2E within the 15-min bar).

**P1 (≥95%):**
- `7.3-E2E-01` — Job/order detail shows source quote version, acceptance evidence, accepted price, customer/facility/contact, basic title/status, planned dates, files, event history; source refs non-editable (AC1; UX-DR26; R-708) (2-3 tests).
- `7.3-INT-01` — **Source-of-truth-from-immutable-refs (the headline INT):** job detail data UNCHANGED after mutating any upstream mutable source post-creation (rename customer / edit live calc) — proves the detail reads from the immutable `quote_acceptances`/`quote_versions` refs, never re-derives (AC1; R-708) (2-3 tests).
- `7.3-E2E-02` — Repeated acceptance/create-job attempt shows the EXISTING accepted state + the ONE existing job, not a duplicate or an error (AC5; UX-DR24; R-712/R-702) (1-2 tests).
- `7.3-E2E-03` — Job list filter/search by customer/status/planned-date/source-quote; **NO field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/Fortnox UI** (AC2; guardrail; R-711) (2-3 tests). Pair with the `job-non-scope` `node --test` route/surface scan (Task 6).
- `7.3-INT-02` — Allowed job edits (title/status/planned dates) are audited (one audit row, allow-listed metadata; a `job_events` row on status change); source quote/acceptance refs remain non-editable — an attempt to mutate an immutable field is rejected at the command (`VALIDATION_FAILED` — unknown field) and the DB (AC4; R-708/R-711) (1-2 tests).

**P2 (Medium):**
- `7.3-E2E-04` — Accessibility on job detail/list controls; predictable focus opening/closing the job edit dialog; status/labels use text not color alone (a11y baseline, epic-6 pattern) (1-2 tests).

**Cross-tenant/anon (AC3, INT — target the LIVE path):** `readJobDetail(foreignJobId)` ⇒ null/not-found; `updateJob` on a foreign job id ⇒ `TENANT_ACCESS_DENIED` (no existence disclosure); anon ⇒ `UNAUTHENTICATED`. The three tables' H4/enrollment cross-tenant negatives are 7.1's (already green) — 7.3 adds the live-command/live-read negatives.

**Exit criteria this story contributes to (epic gate):** Job traceability proven — job detail displays source version, evidence, accepted price, source totals, customer/facility/contact, title/status, planned dates, files, event history from the IMMUTABLE references; mutating any upstream source post-creation leaves the job detail unchanged; source refs non-editable; allowed edits (title/status/planned dates) audited; NO field-worker/schedule/time-material/deviation/ÄTA/project-analytics/invoice/Fortnox UI, route, or label anywhere; repeated-attempt shows the existing job (no duplicate/error); cross-tenant/anon rejected on the live job read + `updateJob`; the `job` file owner type + `job_evidence` purpose activated with NO competing store.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (auto-bmad dev-story delegate).

### Debug Log References

- Full quality gate green: `typecheck` clean; `eslint` clean (1 pre-existing unrelated warning in `tests/unit/lib/money/vat.test.ts`); `node --test` unit suite 1119 passed; `vitest run` INT suite 597 passed (54 files); Playwright E2E 93 passed; `next build` succeeds with the two new `/jobs` routes.
- Job INT proofs (local Supabase stack): `update-job.int.test.ts` (8) + `job-source-of-truth.int.test.ts` (4) = 12 passed.
- Job E2E: `job-traceability.e2e.spec.ts` (5) + `job-list-deferred-surface.e2e.spec.ts` (3) = 8 passed.

### Completion Notes List

**What was built (Tasks 1–7 all complete):**
- **Task 1 — Job read layer (`src/features/jobs/read.ts` + `types.ts`):** `readJobList(filters?)` (thin `/jobs` index projection over active jobs, `updated_at desc`, embedded current-customer + source quote number, optional customer/status/planned-date/source-quote filters) and `readJobDetail(client, jobId)` (RLS-scoped `jobs` row → immutable `quote_acceptances` money/evidence + frozen `quote_versions` commitment names + `file_links` owner_type=`job` + `job_events` history). Money coerced to numbers at the boundary; frozen commitment names never re-derived (R-708); NO personnummer selected. A page-facing `readJobDetailForPage(jobId)` returns `{ detail, error }`. **Boundary fix:** the runtime `JOB_STATUSES`/`JOB_STATUS_LABELS` + row/detail types live in a pure `src/features/jobs/types.ts` so client islands import them without pulling the server-only RLS client into the client bundle.
- **Task 2 — `/jobs` list:** replaced the `PagePlaceholder` with a server component over `readJobList` handing rows to a client `JobList` island (four AC2 filters, client-side narrowing; status as TEXT). No new nav item, no deferred surface.
- **Task 3 — `/jobs/[jobId]` detail:** new server route over `readJobDetailForPage` (`notFound()` on null) rendering `JobDetailView` (source-quote-version link, evidence via `JobEvidenceLink`, accepted price + source sent total öre→kronor, current + frozen commitment customer, planned dates, files, events) + the `JobEditDialog` allowed-edit affordance. NO edit control for any immutable ref.
- **Task 4 — `updateJob` command (`src/server/commands/jobs/`):** `defineCommand` mirroring `updateCustomer`. Validator rejects ANY key outside `{id,title,status,planned_start_date,planned_end_date}` (hard unknown-field reject — a client cannot smuggle an immutable field), status ∈ closed set, ISO-date guards, empty-patch VALID. Execute: empty-patch short-circuit (no write, no audit); status-change appends ONE `job_events` row with `occurred_at = ctx.clock.now()`; UPDATE on the four columns only; **self-audits** (allow-listed `{ targetId }` on the `target_id` column, empty metadata) ONLY on a real mutation (`auditable:false` + conditional `writeAuditEvent`, mirroring `acceptQuoteAndCreateJob`). Thin `updateJobAction` + `JobActionState`; a `previewJobEvidenceAction` reuses `createSignedFileAccess` verbatim.
- **Task 5 — File owner activation (AC6):** added `"job"` to `ACTIVE_OWNER_TYPES` (`files/validation.ts`) + the `case "job": return "jobs"` branch to `ownerTableFor` (`files/file-db.ts`). No upload UX, no competing store (R-814); reuses `createFileLink` + `ownerRecordVisible` + signed-access.
- **Task 6 — Guardrail:** the pre-existing `tests/unit/guardrails/job-non-scope.test.ts` (route/token scan + nav-count=7) runs green.
- **AC5 deep-link seam:** extended `readQuoteDetail` with an `acceptedJobIdByVersionId` map (RLS-scoped own-tenant jobs, non-fatal on error) and `QuoteDetailView`'s accepted section now renders a `quote-accepted-job-link` to `/jobs/[jobId]`.

**Key decisions / deviations:**
- The four ATDD red-phase scaffolds (`update-job.int.test.ts`, `job-source-of-truth.int.test.ts`, the two job E2E specs) were authored against a DRIFTED API surface (a non-existent `actor` param on `runCommand`, camelCase factory seeds, `makeAuthedServerClient(userId)`, `adminSelectAuditEvents({tenantId,targetType,targetId})`, `metadata:{targetId}`). They were rewritten to the REAL command/factory/audit APIs while preserving the ATDD intent (assertions). Added a `adminUpdateCustomerDisplayName` BYPASSRLS factory helper for the source-of-truth mutate step.
- Audit hygiene: `updateJob` writes the job id to the audit `target_id` COLUMN and `metadata = {}` (the sanitizer allow-list would drop a `targetId` metadata key anyway) — matching the 7.2 `acceptQuoteAndCreateJob` audit shape; the INT test asserts `target_id === jobId` + `metadata === {}`.
- E2E fixture: added a DEDICATED `acceptedJob` fixture in `global-setup.ts` that drives the REAL `accept_quote_and_create_job` RPC at seed time (persisting a known `jobId` + source `quoteId`/`sentVersionId`), so 7.3's detail/list/deep-link E2E are self-contained and do NOT depend on the 7.2 spec's runtime accept ordering.
- Updated `tests/unit/server/commands/file-validation.test.ts` to assert `isActiveOwnerType("job") === true` (was `false`) — the sanctioned 7.3 activation (same as 7.1's `quote_acceptance`).

**Deferred / out of scope (honored):** NO migration, NO new table/column, NO immutability trigger (7.4), NO upload UX (8.2), NO `lifecycle_state` flip on a linked job file (8.2 owns draft→linked), NO field-worker/schedule/invoice/Fortnox surface.

### File List

**Added (source):**
- `src/features/jobs/types.ts`
- `src/features/jobs/read.ts`
- `src/features/jobs/actions.ts`
- `src/features/jobs/action-state.ts`
- `src/features/jobs/evidence-preview-state.ts`
- `src/server/commands/jobs/validation.ts`
- `src/server/commands/jobs/jobs.ts`
- `src/server/commands/jobs/jobs-db.ts`
- `src/server/commands/jobs/index.ts`
- `src/components/jobs/JobList.tsx`
- `src/components/jobs/JobDetailView.tsx`
- `src/components/jobs/JobEditDialog.tsx`
- `src/components/jobs/JobEvidenceLink.tsx`
- `src/app/(app)/jobs/[jobId]/page.tsx`

**Modified (source):**
- `src/app/(app)/jobs/page.tsx` (replaced `PagePlaceholder` with the server list)
- `src/server/commands/files/validation.ts` (`job` → `ACTIVE_OWNER_TYPES` + note)
- `src/server/commands/files/file-db.ts` (`ownerTableFor` job→jobs branch)
- `src/features/quotes/read.ts` (`acceptedJobIdByVersionId` deep-link map)
- `src/components/quotes/QuoteDetailView.tsx` (`quote-accepted-job-link` deep link)

**Added (tests):**
- `tests/unit/server/commands/update-job-validation.test.ts`

**Modified (tests / fixtures):**
- `tests/integration/commands/update-job.int.test.ts` (rewritten to the real API; `.skip` removed)
- `tests/integration/commands/job-source-of-truth.int.test.ts` (rewritten to the real API; `.skip` removed)
- `tests/e2e/jobs/job-traceability.e2e.spec.ts` (`.skip` removed; `acceptedJob` fixture)
- `tests/e2e/jobs/job-list-deferred-surface.e2e.spec.ts` (`.skip` removed)
- `tests/e2e/global-setup.ts` (dedicated `acceptedJob` fixture via the real accept RPC)
- `tests/factories/tenants.ts` (`adminUpdateCustomerDisplayName` helper)
- `tests/unit/server/commands/file-validation.test.ts` (`isActiveOwnerType("job")` now true)

**Pre-existing (unchanged) test scaffold used as-is:**
- `tests/unit/guardrails/job-non-scope.test.ts` (already live/green)

### Change Log

- 2026-07-07 — Story 7.3 implemented (dev-story). Job/order read+traceability UX (`/jobs` list + `/jobs/[jobId]` detail), the audited `updateJob` allowed-edit command (title/status/planned dates only; immutable refs non-editable), the `job` file-owner-type + `job_evidence` activation, and the accepted-version→job deep link. NO migration. All ACs satisfied; full gate green (unit 1119 / INT 597 / E2E 93 / build). Status → review.
