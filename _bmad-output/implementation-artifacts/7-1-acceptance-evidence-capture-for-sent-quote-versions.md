# Story 7.1: Acceptance Evidence Capture For Sent Quote Versions

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant admin,
I want to record off-system acceptance for a specific sent quote version — capturing channel, accepted timestamp, admin user, evidence file/reference, accepted price in öre, notes, and planned dates, with adjusted-price gating,
so that customer commitment evidence is preserved (immutably, tenant-scoped, audited) before a job/order is created.

## Acceptance Criteria

**AC1 — Acceptance capture form for a sent quote version**
**Given** a sent quote version
**When** the admin opens acceptance capture
**Then** the form captures channel, accepted timestamp, admin user, evidence file/reference, accepted price in öre, notes, and planned start/end dates when available
**And** no customer portal or public acceptance endpoint is created.

**AC2 — Adjusted-price requires reason/evidence + shows delta**
**Given** accepted price differs from the sent quote total
**When** the admin attempts to confirm acceptance
**Then** explicit adjustment reason/evidence is required (re-validated server-side — the client cannot bypass)
**And** the delta (computed with `@/lib/money`, in öre) is shown before confirmation.

**AC3 — Reject non-sent / cross-tenant versions**
**Given** a draft, accepted, rejected, expired, superseded, or cross-tenant quote version
**When** acceptance is attempted
**Then** command validation rejects it with a user-safe error (a non-sent state ⇒ a stable lifecycle rejection; a cross-tenant/foreign id ⇒ `TENANT_ACCESS_DENIED`, no existence disclosure).

**AC4 — New commitment tables are isolated + enrolled (foundation for 7.2/7.3/7.4)**
**Given** the migration lands `quote_acceptances`, `jobs`, and `job_events`
**When** the RLS/isolation harness runs
**Then** each new table carries a direct `tenant_id`, composite same-tenant parent FKs, enable+**force** RLS with own-tenant `is_tenant_admin` policies (SELECT/INSERT/UPDATE, no DELETE), `anon → nothing`, öre columns as `bigint CHECK >= 0`, and is enrolled in `TENANT_TABLES` (the H4 gate is green)
**And** NO field-worker/schedule/time-material/deviation/ÄTA/analytics/invoice/Fortnox table or column is created.

**AC5 — Accepted price + source sent total stored in öre; audit written**
**Given** an acceptance is captured
**When** the record persists
**Then** accepted price and source sent total are stored in integer öre (`bigint`, canonical guards)
**And** a single `audit_events` row is written with allow-listed metadata (NO raw accepted price / customer PII in metadata).

**AC6 — Evidence link activates the `quote_acceptance` owner type on the 8.1 file model**
**Given** the admin supplies an already-uploaded evidence file id (or an external reference)
**When** the evidence is attached
**Then** the `quote_acceptance` owner type + `acceptance_evidence` purpose are activated on the existing `files`/`file_links` model (a foreign file id ⇒ `TENANT_ACCESS_DENIED`; cross-tenant + anon access to the evidence file is rejected via the 8.1 signed-access funnel)
**And** NO competing evidence-storage model is invented (R-814). File-upload evidence UX (drag/drop, validation) is out of scope — that is Epic 8.2.

## Scope Boundary (read first — this is a multi-story epic)

This story lands the **schema + the acceptance-capture surface**, NOT the transaction. Precisely:

- **7.1 (this story):** the migration creating `quote_acceptances` / `jobs` / `job_events` (+ their uniqueness constraints, RLS, enrollment); the `captureQuoteAcceptance` command (validation, sent-state gate, adjusted-price reason/evidence gate, evidence-link activation, öre discipline, audit); the pure adjusted-price/reason-required `.ts` decision module; the acceptance-capture form UX replacing the `quote-acceptance-placeholder`.
- **7.2 (NEXT story, do NOT build here):** the narrow atomic `accept_quote_and_create_job` RPC — the idempotent, transactional multi-record write (acceptance + lifecycle flip + job insert + events + audit, row locks, rollback, retry idempotency, concurrency). 7.1 must leave the `jobs`/`job_events` tables **created but unpopulated by any live path** and must NOT implement the transaction.
- **7.4 (LATER story, do NOT build here):** the accepted-state DB immutability trigger/constraints + command lock code + correction-boundary UI. 7.1 creates the tables; 7.4 locks them.

**Decision needed from 7.1 (do not defer silently):** where does the acceptance record get written? Two acceptable shapes — (a) 7.1 persists `quote_acceptances` directly via an RLS-client INSERT in its own command now, and 7.2 later composes the job/lifecycle transaction around a re-usable acceptance write; or (b) 7.1 builds only validation + the form + evidence-link + the pure delta module, and the `quote_acceptances` INSERT lands with the 7.2 RPC. **Prefer (a):** 7.1's ACs (AC1/AC2/AC5) and the test design's `7.1-INT-*` scenarios read as 7.1 persisting the acceptance capture (accepted price/total in öre + audit), while 7.2 adds job/lifecycle/idempotency/atomicity on top. Build the acceptance persistence in 7.1; keep it a plain own-tenant RLS INSERT (a single-row write does not need the RPC per ADR-A009 — the RPC is for the multi-record 7.2 transaction). If the acceptance-write mechanism must change to satisfy 7.2's atomicity, that is a 7.2 concern; 7.1's single-row write remains valid. Do NOT create a client-side multi-step mutation sequence.

## Tasks / Subtasks

- [x] **Task 1 — Migration: `quote_acceptances` / `jobs` / `job_events` (AC4, AC5)** — additive migration `supabase/migrations/20260709120000_acceptance_to_job_model.sql` (pick the next unused `2026070*`/`2026071*` timestamp AFTER `20260708120000`). A frozen prior migration is NEVER edited. Mirror `20260705120000_quote_version_model.sql` + `20260704120000_file_storage_foundation.sql` VERBATIM.
  - [x] 1.1 `quote_acceptances`: `id`, `tenant_id` (FK `tenants(id) on delete cascade`), `quote_id`, `quote_version_id` (the accepted version ref), `channel text`, `accepted_at timestamptz not null`, `accepted_price_ore bigint not null check (>= 0)`, `source_sent_total_ore bigint not null check (>= 0)` (the sent total at acceptance time — captured commitment), `adjustment_reason text` (nullable), `evidence_file_id uuid` (nullable — optional composite same-tenant FK to `files(id,tenant_id) on delete set null`), `evidence_reference text` (nullable — external reference), `notes text`, `planned_start_date`/`planned_end_date` (nullable `date` or `timestamptz`), `archived_at`, `created_at`/`updated_at`. Composite same-tenant FK to `quote_versions(id,tenant_id)` and `quotes(id,tenant_id)`. **Uniqueness (7.2 backstop, add now):** `unique (quote_version_id)` — one acceptance per accepted quote version. `constraint quote_acceptances_id_tenant_unique unique (id, tenant_id)` (the composite-FK target for `jobs`).
  - [x] 1.2 `jobs`: `id`, `tenant_id`, immutable source refs `quote_acceptance_id` + `quote_version_id` (composite same-tenant FKs), `customer_id`/`facility_id`/`contact_id` (composite same-tenant FKs; facility/contact optional `on delete set null`), `title text`, `status text` (a closed Phase-A set, e.g. `('created','in_progress','done','cancelled')` — pick a minimal conservative set and document it; do NOT model field-worker states), `planned_start_date`/`planned_end_date`, `archived_at`, `created_at`/`updated_at`. **Uniqueness:** `unique (quote_acceptance_id)` — one job source per acceptance. `constraint jobs_id_tenant_unique unique (id, tenant_id)`. NO cost/margin/invoice/Fortnox/time-material/deviation column.
  - [x] 1.3 `job_events`: `id`, `tenant_id`, `job_id` (composite same-tenant FK), `event_type text` (closed set incl. `'created'`), `occurred_at timestamptz not null default now()`, optional `channel`/`reference`, `created_at`/`updated_at`. Mirror `quote_events` shape.
  - [x] 1.4 GRANTs: `authenticated → select, insert, update` on all three; `service_role → full DML`; `anon → NOTHING`. `set_updated_at()` BEFORE UPDATE trigger on each (REUSE the existing fn — do NOT redefine). Indexes on `(tenant_id, …)` access paths.
  - [x] 1.5 RLS: `enable` + `force` on all three; 3 own-tenant policies per table (SELECT/INSERT/UPDATE via `is_tenant_admin(tenant_id)`, no DELETE). Match the `quote_versions` policy block exactly.
  - [x] 1.6 SCOPE GUARD: NO Fortnox/invoice/customer-portal/external-mapping/supplier/sync/credential/api/edi column or table; NO acceptance-immutability trigger (that is 7.4); NO `accept_quote_and_create_job` RPC (that is 7.2). Add the same header comment discipline as the 6.1 migration.
- [x] **Task 2 — TENANT_TABLES enrollment (AC4)** — append `"quote_acceptances"`, `"jobs"`, `"job_events"` to `TENANT_TABLES` in `tests/integration/rls/tenant-table-inventory.ts` WITH both metadata seams (cross-tenant: `spoofedRowFor`/`tenantBFilter`/`hijackMutationFor`; anon: `anonRowFor`/`anonFilterFor`/`anonMutationFor`). Spoof child INSERTs carry a Tenant-B parent id (acceptance → version/quote; job → acceptance; job_event → job) so the composite FKs bind them to Tenant B. `updateDenialKind` = RLS-invisibility (these have an authenticated INSERT/UPDATE grant, like every business table). No supplier-ish column, no PII in spoof/anon rows; keep öre values < 10 digits (orgnr-scan boundary). Confirm the H4 gate + migration-reset per-table policy enumeration pass. (Testability note 1; retro epic-8: event tables are easy to forget — `job_events` enrolls like any other table.)
- [x] **Task 3 — Pure adjusted-price / reason-required decision module (AC2)** — a new `.ts` (e.g. `src/features/quotes/acceptance-price.ts` or `src/lib/money`-adjacent, but NOT inside a `"use client"` component — the coverage-shape lesson: a helper buried in a client component escapes the `node --test` gate). Pure functions: compute `deltaOre = acceptedPriceOre − sourceSentTotalOre` using integer öre arithmetic / `sumOre` (NEVER re-derived ad hoc); decide `reasonRequired = deltaOre !== 0`; validate accepted price with `isOreAmount`/`ORE_AMOUNT_MAX`. Exhaustively unit-testable without a DB (`7.1-UNIT-01`, `7.1-UNIT-02` — zero/negative/over-sent-total boundaries + öre overflow guard).
- [x] **Task 4 — `captureQuoteAcceptance` command (AC1/AC2/AC3/AC5)** — a `defineCommand` through the EXISTING envelope in `src/server/commands/quotes/` (co-locate; e.g. `accept.ts` + `validation.ts`/`quote-db.ts` additions). Pattern EXACTLY on `markQuoteVersionSent` (`mark-sent.ts`):
  - [x] 4.1 `validateInput` (pure, in `validation.ts`): UUID guards on `quote_version_id`/optional `evidence_file_id`; öre-shape on `accepted_price_ore`; reject unknown channel/fields. Never echo raw values.
  - [x] 4.2 `ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id })` — a foreign/non-existent id ⇒ `TENANT_ACCESS_DENIED` BEFORE execute (no existence disclosure).
  - [x] 4.3 In `execute`: LOAD the version's real `status` on the RLS client (reuse `loadQuoteVersionStatus`) → reject any non-`'sent'` status with a stable lifecycle code (see error-code decision below). This is the server-side sent-state gate (AC3) — matrix FINALIZED against the landed Epic 6 state machine (`draft/sent/accepted/rejected/expired/superseded`); acceptance legal ONLY on `status = 'sent'`.
  - [x] 4.4 Load the version's frozen source sent total (the customer-commitment gross the version froze — reuse the `accepted_price_ore` / totals columns already on `quote_versions`). Compute the delta via the Task 3 module; if `deltaOre !== 0` and no `adjustment_reason` (or evidence) is supplied ⇒ reject `VALIDATION_FAILED` (AC2 server re-validation; the client cannot bypass).
  - [x] 4.5 Persist the `quote_acceptances` row via an own-tenant RLS-client INSERT (a single-row write — NOT the RPC; the resolved `ctx.tenantContext.tenantId` is the ONLY tenant authority, never a client id). Use the injected `ctx.clock.now()` for any command instant; `accepted_at` is an explicit input field (H1 determinism — no wall-clock derivation of the accepted moment).
  - [x] 4.6 `auditable: true` with allow-listed `auditFields: (ctx, result) => ({ targetId: result.targetId })` — NO accepted price / channel / customer / PII in metadata (AC5).
- [x] **Task 5 — Evidence-link activation on the 8.1 file model (AC6)** — activate the `quote_acceptance` owner type + `acceptance_evidence` purpose:
  - [x] 5.1 In `src/server/commands/files/validation.ts`: add `"quote_acceptance"` to `ACTIVE_OWNER_TYPES` (it is already in `OWNER_TYPES`). Do NOT add `"job"` (that is 7.3).
  - [x] 5.2 In `src/server/commands/files/file-db.ts`: register `quote_acceptance → quote_acceptances` in `ownerTableFor`, so `ownerRecordVisible` can resolve it under own-tenant RLS (the R-802 owner-side check). A foreign evidence file id or foreign owner id ⇒ `TENANT_ACCESS_DENIED`.
  - [x] 5.3 Wire the acceptance command (or the form action) to materialize the evidence link with `owner_type: "quote_acceptance"`, `owner_id: <acceptance id>`, `purpose: "acceptance_evidence"` for an uploaded evidence file; an EXTERNAL reference (free text) goes into `quote_acceptances.evidence_reference` (no file link). **Shipped mechanism:** the acceptance command re-validates the evidence file is own-tenant-visible via `ownerRecordVisible(db, "files", evidence_file_id)` (the R-802 file-side check) and then materializes the `file_links` row via the narrow `link_existing_file` RPC — NOT the `createFileLink` command. This deliberate deviation keeps AC5 / `7.1-INT-05`'s "exactly ONE audit row" green (bypassing `createFileLink`, which is `auditable: true`); the just-created own-tenant acceptance owner is trivially visible and a foreign file is still rejected (`TENANT_ACCESS_DENIED`) by the `ownerRecordVisible` file check plus the composite same-tenant FK on `quote_acceptances.evidence_file_id`. **`file_links` has no dedupe uniqueness (8.1 deferral)** — decide find-or-create vs. accepting a possible duplicate on retry, and TEST the chosen semantics (Testability note 8). Given 7.1 does no idempotent retry itself, a single link on capture is fine; document the choice.
  - [x] 5.4 Do NOT build upload UX / MIME-size validation / entity file panels — Epic 8.2. Do NOT invent a competing evidence model (R-814 STOP).
- [x] **Task 6 — Acceptance-capture form UX (AC1/AC2)** — replace/augment the `quote-acceptance-placeholder` section in `src/components/quotes/QuoteDetailView.tsx` (currently "Ej accepterad ännu. Acceptans hanteras i Epic 7."). Render an acceptance form on a **sent** version only (mirror `MarkSentButton`/`DraftQuoteEditor` gating): channel, accepted timestamp, evidence file id / external reference, accepted price (öre input, Swedish comma convention — reuse the existing money-input helpers in `src/features/calculations/money-input.ts`, e.g. the kronor↔öre parse/format used by the calc editor; note the documented comma-vs-dot display residual there), notes, planned start/end. The admin user is the resolved session user (server-derived, not a form field). A server action + `useActionState` pattern (mirror `src/features/quotes/actions.ts` + `*-action-state.ts`). The adjusted-price delta + reason field appear when the entered price ≠ sent total (mirror the INT-proven server rule — the UI is a MIRROR, not the guarantee). NO public/portal/webhook route.
- [x] **Task 7 — Guardrail: no public acceptance surface (AC1)** — assert (fast-gate route/surface scan, `node --test`, mirror the 6.2-E2E-03 pattern) that NO unauthenticated/public acceptance endpoint, portal route, webhook, or cron exists.
- [x] **Task 8 — Tests (per test-design-epic-7.md §Coverage Plan, story 7.1 rows)** — see the Testing section below for the exact `7.1-*` IDs, levels, and the epic Exit Criteria this story must satisfy.

## Dev Notes

### Primary sources (read these first)
- **Test design (authoritative test spec):** `_bmad-output/test-artifacts/test-design-epic-7.md` — the 7.1 rows in the Coverage Plan (7.1-INT-01..05, 7.1-RLS-01/02, 7.1-UNIT-01/02, 7.1-E2E-01/02/03), the Testability Notes (§1-10), Entry/Exit Criteria, and the Risk table (R-701/R-705/R-706/R-707/R-709/R-717).
- **Epic + AC source:** `_bmad-output/planning-artifacts/epics.md#Story 7.1` (lines 1413-1447).
- **Architecture:** §13 Acceptance-To-Job Transaction Design (the 10 transaction steps — 7.1 owns steps 1/3/5/6 semantics: resolve+membership, verify tenant+sent, validate adjusted price, insert acceptance; steps 2/4/7-10 are 7.2); §7 (`quote_acceptances` IN); §9 (immutable lifecycle tables — 7.4); §14 (file/owner model — `quote_acceptance` owner type + `acceptance_evidence` purpose); ADR-A005 (immutable accepted model); ADR-A009 (narrow RPC — for 7.2, NOT 7.1's single-row write); §15 (audit).

### Reference implementations to COPY the pattern from (do NOT re-invent)
- **Migration pattern (table + composite FK + RLS + GRANT + policies + indexes + header discipline):** `supabase/migrations/20260705120000_quote_version_model.sql` (the 6.1 quote model — the closest analog: tenant-owned commitment tables). Composite same-tenant FK shape: `foreign key (child_col, tenant_id) references parent (id, tenant_id)`. RLS block: lines 459-544. GRANTs: lines 443-454.
- **Command pattern (envelope, ownership, execute, RLS-client, injected clock, audit allow-list, stable error codes):** `src/server/commands/quotes/mark-sent.ts` (the mark-sent command — same shape: load real status on the RLS client, reject a wrong lifecycle state with a stable code, write via the RLS client, `{ targetId }` audit only).
- **Evidence-link activation:** `src/server/commands/files/files.ts` (`createFileLink` + `assertOwnerVisibleOrThrow`), `src/server/commands/files/validation.ts` (`ACTIVE_OWNER_TYPES` / `OWNER_TYPES` — `quote_acceptance` is present-but-INACTIVE; activation = add it to `ACTIVE_OWNER_TYPES` + register its table), `src/server/commands/files/file-db.ts` (`ownerTableFor`/`ownerRecordVisible`).
- **Money:** `@/lib/money` (`src/lib/money/ore.ts`) — `isOreAmount`, `ORE_AMOUNT_MAX`, `sumOre`, `formatOreAsKronor`. The adjusted-price delta uses integer öre arithmetic; the ONLY kronor string is at the presentation boundary.
- **TENANT_TABLES enrollment:** `tests/integration/rls/tenant-table-inventory.ts` (the quote block, lines 130-149, is the exact template for the three new tables + their spoof/anon metadata).
- **Acceptance placeholder to replace:** `src/components/quotes/QuoteDetailView.tsx:399-405` (`data-testid="quote-acceptance-placeholder"`).
- **Write-error mapper:** `src/server/commands/quotes/quote-db.ts` (`throwMappedQuoteWriteError`) — map 23503/42501 → `TENANT_ACCESS_DENIED`, 23505/23514/22P02 → `VALIDATION_FAILED`. The uniqueness constraint (`unique (quote_version_id)`) will raise 23505 on a duplicate — decide whether 7.1 surfaces that (a second capture of the same version) as `VALIDATION_FAILED` or reserves `ACCEPTANCE_ALREADY_RECORDED` / `COMMAND_CONFLICT` for 7.2's idempotent path.

### Stable error codes
- `COMMAND_CONFLICT` and `ACCEPTANCE_ALREADY_RECORDED` are the epic's idempotency codes. **`COMMAND_CONFLICT` already exists in `command-errors.ts` (reserved, unused).** `ACCEPTANCE_ALREADY_RECORDED` is NOT yet in `CommandErrorCode` — the test design predicts Epic 7 ADDS it. **Decision:** the true idempotent re-entry (return existing) is 7.2's concern. For 7.1, a duplicate-capture attempt against an already-accepted version is naturally caught by the sent-state gate (an accepted version has `status = 'accepted'`, not `'sent'`, so AC3 rejects it) — so 7.1 may not need to add `ACCEPTANCE_ALREADY_RECORDED` at all. If a stable code IS needed for a distinct 7.1 conflict, add `ACCEPTANCE_ALREADY_RECORDED` to `CommandErrorCode` + `COMMAND_MESSAGES` (a generic user-safe Swedish message, no leak) — but prefer to leave the idempotency codes for 7.2 unless a 7.1 test forces one. **Do NOT rename/merge** `QUOTE_VERSION_LOCKED` / `QUOTE_VERSION_NOT_DRAFT` / `COMMAND_CONFLICT` — they co-exist (epic-6 convention).
- For rejecting a non-sent version (AC3): a `'draft'` version is a legitimate not-yet-sendable state; an `'accepted'/'rejected'/'expired'/'superseded'` version is a terminal/locked state. A generic `VALIDATION_FAILED` (or a lifecycle-specific stable code if you add one) is acceptable — the message must be user-safe and NOT leak the exact status. Do NOT reuse `QUOTE_VERSION_LOCKED` (that is the sent-immutability lock, a different meaning).

### Epic-7 retro-note constraints (surfaced by the epic test design — apply directly)
- **The sent-lock trigger enforces a legal-transition ALLOW-LIST, not a blanket non-draft pass.** `20260707120000_quote_version_sent_lock.sql` (lines 128-134) permits a status change on a non-draft version ONLY to `('sent','accepted','rejected','expired','superseded')` and REJECTS any customer-visible/commitment column co-mutated in the same non-draft UPDATE (raises `QV409` → `QUOTE_VERSION_LOCKED`). **7.1 does NOT transition the version's status** (that is 7.2's `sent → accepted` flip). But be aware: when 7.2 flips `status` to `'accepted'`, it must transition `status` ALONE. 7.1 must NOT write any `quote_versions` column as part of acceptance capture — capture writes only `quote_acceptances`. If you find yourself modifying the sent-lock trigger, that is a design-drift STOP signal.
- **Accepted-immutability is ONE model at three scopes across three epics** (Epic 6 sent-freeze R-605, Epic 7 accepted-lock R-704, Epic 8.4 locked-evidence-file). 7.1 creates the tables; 7.4 enforces the lock and MUST agree with the `QUOTE_VERSION_LOCKED` family and the 8.4 file-lock. Do NOT fork the lock model. (7.1 only needs to leave the schema shaped so 7.4 can add the trigger additively — same pattern as 6.1 leaving the door open for 6.4.)

### Deferred-work ledger items that overlap this story (fold in, don't reopen unrelated ones)
- **[8.1, R-814] `quote_acceptance`/`job` owner types are structurally valid but INACTIVE in the 8.1 file model.** 7.1 ACTIVATES `quote_acceptance` (Task 5). This is the sanctioned activation, exactly as the 8.1 iteration-2 note says Epics 6/7 will do. REUSE `files`/`file_links` — a competing evidence model is a STOP.
- **[8.1] `file_links` has NO dedupe uniqueness on `(tenant_id, file_id, owner_type, owner_id, purpose)`; `createFileLink` does no existence check.** When wiring the evidence link (Task 5.3), decide find-or-create vs. accept-duplicate and test it (Testability note 8). 6.1/6.3 chose find-or-create via an `exists(...)` guard in their RPCs — but 7.1 uses `createFileLink` directly, which has no such guard. For a single capture (no retry in 7.1) one insert is fine; document the choice so 8.2/6.x reconcile it later.
- **[Epic-6 review, Med] Correction + PDF affordances render on EVERY non-draft version, including the future `accepted` state.** `QuoteDetailView.tsx:409,442` mounts `CreateNewVersionButton` + `QuotePdfPanel` for any `status !== "draft"`. The epic-6 gate assigns Epic 7 (the acceptance boundary) to "gate both affordances (command + UI) to draft/sent and never accepted when the acceptance flow lands." **7.1 does NOT flip a version to `accepted` (7.2 does), so this is not yet reachable in 7.1** — but the acceptance-form UX you add here is the first surface that makes `accepted` meaningful. Note it for 7.2/7.4: once a version can be `accepted`, the new-version/PDF affordances must be gated off `accepted`. Do NOT build that gating in 7.1 (it belongs with the lifecycle flip in 7.2/7.4); record it in the completion notes so the epic trace treats it as an Epic-7 obligation.
- **[Epic-4/Epic-7, R-716] Per-person ROT cap is a flat-cap placeholder (Sign-Off Q3, deferred).** 7.1 stores the accepted price AS GIVEN and does NOT re-run the ROT engine, so the per-person carry does not affect acceptance. Do NOT re-derive tax. Documented residual only.
- **[Epic-6/Epic-7, R-713, demo-data-only 2026-07-03] Adjusted-price policy + accepted-evidence channel set are owner-gated.** 7.1 pins the MECHANISM (a delta requires a reason/evidence; the delta is shown before confirm) against conservative defaults. The exact policy/channel constants are an owner Sign-Off residual. Under demo-data-only this is NOT a blocker. **STOP (report `needs-human`) if** the accepted-price adjustment policy, accepted evidence channels, or correction semantics materially differ from these conservative assumptions, OR if the accepted-price-delta representation must be treated as production-approved (Sign-Off Q8), OR if real customer quote data is needed for a golden fixture.

### Money / öre discipline (money impact HIGH — AC5)
- Accepted price + source sent total are `bigint` integer öre with `CHECK >= 0`. NO float/kronor money column. Validate every öre field with the canonical `isOreAmount`/`ORE_AMOUNT_MAX` (one authority, no fork). The delta is computed with the engine, never ad hoc. Keep any öre value in a committed fixture < 10 digits (the orgnr-scan boundary — R-717). NO PII in fixtures (personnummer/orgnr/name/email/phone/address); NO clock in a golden.

### Project Structure Notes
- Migration → `supabase/migrations/` (next unused timestamp after `20260708120000`). Command → `src/server/commands/quotes/` (co-locate with the quote commands; the acceptance is a quote-lifecycle command). Pure delta module → `src/features/quotes/` or a `@/lib`-level module — NOT inside a `"use client"` component (coverage-shape lesson). Form → `src/components/quotes/` + server action in `src/features/quotes/actions.ts` (+ an `*-action-state.ts`). Evidence-link activation edits → `src/server/commands/files/{validation,file-db}.ts`. Enrollment → `tests/integration/rls/tenant-table-inventory.ts`. Tests → `tests/integration/**`, `tests/integration/rls/**`, `tests/unit/**`, `tests/e2e/**` per the level.
- No conflicts with existing structure; the acceptance tables extend the quote chain (`quotes → quote_versions → quote_acceptances → jobs → job_events`). `quote_events` is REUSED (Epic 6, already enrolled) — 7.1/7.2 write new event rows through it, they do NOT recreate it.

### Testing standards summary
- **Two runners:** `node --test` (pure UNIT + GOLDEN under `tests/unit/**` — the runner-glob trap: goldens live under `tests/unit/**`), Vitest (INT/RLS, DB-backed, local Supabase stack). Playwright for E2E. `SUPABASE_TEST_REQUIRED=1` hard-fails a missing stack in CI. Poll `/auth/v1/health` to 200 after `supabase db reset` before trusting a local INT run (the post-reset Kong 502 false-green trap — epic-5/8 retros).
- **Fixtures:** two-tenant factory; drive the REAL `mark_quote_version_sent` RPC to produce a `sent` version fixture (Epic 6 is landed — no synthetic sent row; and note the 6.4 child-lock: seed a version as `draft` → add children → flip to `sent`, never insert children into an already-sent parent). Count-asserting tests seed `crypto.randomUUID()`. Extend the golden PII/secret + ORGNR scan to any acceptance/job fixture.
- **RLS negatives BEFORE positives; enrollment is the completeness guarantee** — do NOT hand-write ad-hoc isolation tests that bypass `TENANT_TABLES` (five-epic precedent).

### References
- [Source: _bmad-output/test-artifacts/test-design-epic-7.md#Test Coverage Plan (7.1-INT-01..05, 7.1-RLS-01/02, 7.1-UNIT-01/02, 7.1-E2E-01/02/03); #Testability Notes 1-10; #Entry/Exit Criteria; #Risk Assessment R-701/R-705/R-706/R-707/R-709/R-717/R-713/R-716]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1 (lines 1413-1447)]
- [Source: _bmad-output/planning-artifacts/architecture.md#13 Acceptance-To-Job Transaction Design; #7; #9; #14; ADR-A005; ADR-A009; #15]
- [Source: supabase/migrations/20260705120000_quote_version_model.sql (6.1 table/RLS/GRANT/policy pattern); 20260707120000_quote_version_sent_lock.sql (transition allow-list lines 128-134); 20260704120000_file_storage_foundation.sql (file model)]
- [Source: src/server/commands/quotes/mark-sent.ts (command pattern); src/server/commands/files/{files,validation,file-db}.ts (evidence-link activation); src/lib/money/ore.ts (öre guards); src/components/quotes/QuoteDetailView.tsx:399-405 (acceptance placeholder)]
- [Source: tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES enrollment, lines 130-149)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md (8.1 owner-type activation + file_links dedupe; epic-6 review affordance-gating; R-716 per-person ROT cap); _bmad-output/auto-bmad/retro-notes/epic-7.md (transition allow-list; accepted-immutability one-model)]

## Testing

Per `test-design-epic-7.md` — the story-7.1 rows. All run in the every-PR gate (UNIT/GOLDEN seconds; INT/RLS on the local stack; E2E within the 15-min bar).

**P0 (must pass 100%):**
- `7.1-INT-01` — migration reset from empty creates `quote_acceptances`/`jobs`/`job_events` (`quote_events` reused, not recreated) with tenant ownership, composite same-tenant parent FKs, immutable source refs, öre columns (`bigint` + `CHECK >= 0`), uniqueness constraints; per-table policy enumeration; NO field-worker/schedule/time-material/deviation/invoice/Fortnox table (2-3 tests).
- `7.1-RLS-01` — cross-tenant read/write + anon-path rejected on every new commitment table, via `TENANT_TABLES` enrollment (6-10 tests).
- `7.1-RLS-02` — H4 inventory gate green; all new tables enrolled (1 test).
- `7.1-INT-02` — acceptance rejects a draft/accepted/rejected/expired/superseded/cross-tenant quote version with a user-safe error (matrix finalized vs landed Epic 6; one negative per non-sent state + cross-tenant) (4-5 tests).
- `7.1-INT-03` — adjusted accepted price (≠ sent total) REQUIRES explicit adjustment reason/evidence, re-validated server-side; missing reason ⇒ rejected; delta captured (2-3 tests).
- `7.1-UNIT-01` — the adjusted-price delta + reason-required decision, pure, öre-based, canonical guards, extracted to `.ts` for the fast gate (3-4 tests).
- `7.1-INT-04` — evidence link activates the `quote_acceptance` owner type on the 8.1 model; foreign evidence file id ⇒ `TENANT_ACCESS_DENIED`; cross-tenant + anon evidence-file access rejected via signed access; NO competing evidence model (2-3 tests).
- `7.x-UNIT-01` (this story's share) — fixture/artifact PII/secret + ORGNR scan extended to acceptance fixtures; öre values < 10 digits (1-2 tests).

**P1 (≥95%):**
- `7.1-E2E-01` — acceptance form captures channel, accepted timestamp, admin user, evidence file/reference, accepted price (öre), notes, planned dates; no public/portal endpoint (2-3 tests).
- `7.1-E2E-02` — adjusted-price flow: entering a price ≠ sent total shows the delta and requires a reason/evidence before confirm (2-3 tests).
- `7.1-INT-05` — accepted price + source sent total stored in öre; a single audit event with allow-listed metadata, no raw price PII (2-3 tests).
- `7.x-E2E-01` (this story's share) — no public/unauthenticated acceptance endpoint, portal route, webhook, or cron (guardrail scan, mirror 6.2-E2E-03 as a fast-gate `node --test` route-presence scan) (1-2 tests).

**P2:**
- `7.1-UNIT-02` — adjusted-price boundaries: zero, negative, over-sent-total; öre overflow guarded (`ORE_AMOUNT_MAX`) (2-3 tests).
- `7.1-E2E-03` — keyboard nav + a11y on the acceptance form + confirm dialog; predictable focus on completing acceptance; text-not-color status/labels (2-3 tests).

**Exit criteria this story contributes to (epic gate):** isolation proven (new tables enrolled, H4 green, cross-tenant + anon negatives per table, foreign quote-version/evidence-file ids ⇒ `TENANT_ACCESS_DENIED`); migration-reset from empty with per-table policy enumeration + no deferred tables; sent-precondition gated (acceptance only on `status = 'sent'`); adjusted price gated + öre-correct; evidence-link activation proven; no public acceptance surface; fixture privacy green.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (auto-bmad dev-story delegate).

### Debug Log References

- `supabase db reset` — the new migration `20260709120000_acceptance_to_job_model.sql` applies cleanly on top of the frozen Epic 1-6 + 8.1 migrations; `/auth/v1/health` polled to 200 before the INT run (Kong 502 false-green trap).
- `pnpm test:unit` — 1040 pass, 0 fail, 0 skip (incl. `7.1-UNIT-01/02` + both guardrails LIVE).
- `pnpm test:int` — 571 pass, 0 fail (incl. `7.1-INT-01..05`, the H4 inventory gate, migration-reset exact-policy enumeration extended by 9, and the cross-tenant/anon RLS suites now covering the 3 new tables).
- `pnpm test:e2e` — acceptance-capture spec 5 pass; the 6.2 `quotes.e2e` spec 10 pass (no regression from the placeholder-section change).
- `pnpm typecheck` / `pnpm lint` / `pnpm build` — all green (lint has one pre-existing unrelated warning in `tests/unit/lib/money/vat.test.ts`).

### Completion Notes List

- **Acceptance-write shape — Decision (a) taken (as the story preferred):** `captureQuoteAcceptance` persists the `quote_acceptances` row via a plain own-tenant RLS-client INSERT (a single-row write, not the ADR-A009 RPC — that RPC is 7.2's multi-record transaction). `accepted_at` is an explicit input field (H1 — no wall-clock derivation of the accepted moment); the injected clock anchors only the command instant. The resolved tenant is the only tenant authority.
- **Error-code decision:** a non-sent version and a delta-without-reason both surface as the generic `VALIDATION_FAILED` (user-safe, does not leak the exact status; does NOT reuse `QUOTE_VERSION_LOCKED`, a different meaning). No new `ACCEPTANCE_ALREADY_RECORDED` code was added — an already-accepted version has `status='accepted'` (not `'sent'`), so the sent-state gate already rejects the common duplicate case; the `unique (quote_version_id)` DB backstop surfaces a distinct duplicate as `VALIDATION_FAILED` (23505 → mapper). The idempotency codes are left for 7.2, per the story's guidance.
- **Evidence-link find-or-create decision (8.1 deferral):** 7.1 capture is single-shot (no idempotent retry), so exactly ONE `file_links` row is created per capture with an evidence file — no find-or-create guard is needed. Documented + tested (a re-link would append a duplicate, which 7.1 never exercises). **Shipped mechanism (deliberate deviation from Task 5.3's original `createFileLink` framing):** the acceptance command materializes the link via the narrow `link_existing_file` RPC (in `accept.ts`), NOT the `createFileLink` command, after re-validating the evidence file with `ownerRecordVisible(db, "files", evidence_file_id)` (the R-802 file-side check). This keeps `7.1-INT-05`'s "exactly ONE audit row" assertion green — `createFileLink` is `auditable: true` and would emit a second audit row. Foreign-file rejection is preserved (`ownerRecordVisible` file check + the composite same-tenant FK on `quote_acceptances.evidence_file_id` ⇒ `TENANT_ACCESS_DENIED`), and the owner side is the just-created own-tenant acceptance (trivially visible). The `quote_acceptance` owner type + `acceptance_evidence` purpose are still activated on the EXISTING 8.1 model (Task 5.1/5.2: `ACTIVE_OWNER_TYPES` + `ownerTableFor`), so the standalone `createFileLink` command's new owner branch is exercised by its own tests — no competing evidence store (R-814).
- **Cross-epic reconciliation:** the Epic-5 `calc-tables-migration-reset.int.test.ts` forbade the `jobs` table (deferred at Epic-5 time). Epic 7 sanctions `jobs`, so it was removed from that test's `FORBIDDEN_TABLES` (kept `projects`/`field_workers`). The exact-policy enumeration in `migration-reset.int.test.ts` was extended by the 9 new acceptance/job policies (kept EXACT, not loosened).
- **Deferred obligations recorded for later Epic-7 stories (do NOT build in 7.1):** (a) once 7.2 flips a version to `accepted`, the `CreateNewVersionButton` + `QuotePdfPanel` affordances (`QuoteDetailView.tsx`) must be gated OFF `accepted` (epic-6 review carry) — not reachable in 7.1 since 7.1 never flips a version; (b) 7.4 adds the accepted-state immutability trigger/constraints additively (7.1 shaped the schema so it can); (c) 7.1 stores the accepted price AS GIVEN and does NOT re-run the ROT engine (per-person ROT cap carry, R-716, unaffected).
- **The pre-existing `/jobs` app route** (a placeholder `page.tsx` from before this story) is untouched — the jobs UI is Story 7.3.

### File List

**Created:**
- `supabase/migrations/20260709120000_acceptance_to_job_model.sql` — the `quote_acceptances`/`jobs`/`job_events` migration (tables, composite same-tenant FKs, öre columns, uniqueness constraints, RLS enable+force + own-tenant policies, GRANTs, indexes, updated_at triggers).
- `src/features/quotes/acceptance-price.ts` — the pure adjusted-price delta + reason-required decision module (Task 3).
- `src/server/commands/quotes/accept.ts` — the `captureQuoteAcceptance` command (Task 4/5.3). Evidence link is materialized via the narrow `link_existing_file` RPC (with an `ownerRecordVisible(db, "files", …)` file-side check), NOT the `createFileLink` command — see the completion note above for why (single-audit-row preservation).
- `src/features/quotes/acceptance-action-state.ts` — the acceptance-capture `useActionState` contract.
- `src/components/quotes/AcceptanceCaptureForm.tsx` — the sent-version acceptance form (Task 6).

**Modified:**
- `src/server/commands/quotes/validation.ts` — added `validateCaptureQuoteAcceptance` + `CaptureQuoteAcceptanceInput`.
- `src/server/commands/quotes/quote-db.ts` — added `loadQuoteVersionAcceptanceSource` + the `quote_acceptances` INSERT surface.
- `src/server/commands/quotes/index.ts` — export `captureQuoteAcceptance` + its validator/types.
- `src/server/commands/files/validation.ts` — activated `quote_acceptance` in `ACTIVE_OWNER_TYPES` (Task 5.1).
- `src/server/commands/files/file-db.ts` — registered `quote_acceptance → quote_acceptances` in `ownerTableFor` (Task 5.2).
- `src/features/quotes/actions.ts` — added `captureQuoteAcceptanceAction` (Task 6).
- `src/components/quotes/QuoteDetailView.tsx` — replaced the acceptance placeholder with the sent-version form (Task 6).
- `tests/integration/rls/tenant-table-inventory.ts` — enrolled `quote_acceptances`/`jobs`/`job_events` (all metadata seams; Task 2).
- `tests/factories/tenants.ts` — added acceptance/job seed + readback helpers; added `accepted_price_ore` to the quote-version seed.
- `tests/integration/rls/cross-tenant-isolation.rls.test.ts` — seed the 3 new Tenant-B rows + the readback branch.
- `tests/integration/rls/migration-reset.int.test.ts` — extended the exact-policy enumeration by the 9 new policies.
- `tests/integration/rls/calc-tables-migration-reset.int.test.ts` — removed `jobs` from the Epic-5 forbidden list (Epic-7 reconcile).

**Green-phased test scaffolds (ATDD red → green):**
- `tests/unit/features/quotes/acceptance-price.test.ts` (7.1-UNIT-01/02).
- `tests/integration/commands/capture-quote-acceptance.int.test.ts` (7.1-INT-02/03/05).
- `tests/integration/commands/acceptance-evidence-link.int.test.ts` (7.1-INT-04).
- `tests/integration/rls/acceptance-tables-migration-reset.int.test.ts` (7.1-INT-01).
- `tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts` (7.1-E2E-01/02/03).
- `tests/unit/guardrails/acceptance-non-scope.test.ts` (7.x-E2E-01) — was already LIVE; still green.

### Change Log

- 2026-07-06 — Story 7.1 implemented. Added the acceptance-to-job commitment schema (`quote_acceptances`/`jobs`/`job_events`), the `captureQuoteAcceptance` command (sent-state gate, server-side adjusted-price reason/evidence gate, öre discipline, audit `{targetId}`), the pure adjusted-price decision module, the `quote_acceptance` owner-type activation on the 8.1 file model, and the sent-version acceptance-capture form. All P0/P1/P2 tests green. Status → review.
- 2026-07-06 — Review fix (doc-only): resolved the `[Review][Patch][Low]` evidence-link doc-drift finding. Aligned Task 5.3, the "Evidence-link find-or-create decision" completion note, and the File List with the shipped `link_existing_file` RPC path (+ `ownerRecordVisible` file-side check) instead of the original `createFileLink` framing. No code/test change — `accept.ts` was already correct.

### Review Findings

Triaged from the primary Acceptance Auditor lens + the auto-bmad-local security review (2026-07-06). Verdict: Approve (no Critical/High; 1 Med + 3 Low, none a hard AC violation). Thin Tier-A pass (blind/edge lenses reserved for the epic integration review — not run this iteration, not counted as failed layers). Security review reported NO findings.

- [x] [Review][Decision][Med] (resolved: dismissed/won't-fix per triage recommendation — auto-resolved, epic mode) Evidence link uses a raw `link_existing_file` RPC, not the story-mandated `createFileLink` command — Task 5.3 says wire the acceptance evidence link to `createFileLink({ owner_type: "quote_acceptance", purpose: "acceptance_evidence" })`, but `src/server/commands/quotes/accept.ts` instead calls `ownerRecordVisible(db, "files", evidence_file_id)` + a direct `asFileRpcClient(db).rpc("link_existing_file", …)`. So the acceptance path does not run `createFileLink`'s R-802 both-side owner check (only the standalone `createFileLink` command exercises the new `ownerTableFor` branch). The deviation is functionally sound — the owner is the just-created own-tenant acceptance (trivially visible), the manual `ownerRecordVisible` FILE check + the composite same-tenant FK on `quote_acceptances.evidence_file_id` still reject a foreign file (`TENANT_ACCESS_DENIED`), and bypassing `createFileLink` (which is `auditable: true`) is what keeps AC5 / `7.1-INT-05`'s "exactly ONE audit row" assertion green. Recommended: dismiss: the manual path is deliberate and correct (single audit row + foreign-file rejection preserved); ratify as-is — only the doc drift needs fixing (see the Patch below). (Merged: Acceptance Auditor [Med] finding; security review reported no findings on this path.)
- [x] [Review][Decision][Low] (resolved: dismissed/won't-fix per triage recommendation — auto-resolved, epic mode) "Admin user" (AC1) is captured only in the audit trail, not on the acceptance record — AC1 lists "admin user" among the fields the capture must record, but `quote_acceptances` (migration `20260709120000_acceptance_to_job_model.sql`) has NO `accepted_by`/`created_by` column and `captureQuoteAcceptance` never persists the acting user onto the row; the admin is captured only server-side as `p_actor_user_id` on the single append-only audit event. Task 1.1 deliberately omits `accepted_by` and Dev Notes state "the admin user is the resolved session user, not a form field." Ambiguous whether the immutable acceptance row (which 7.4 will lock) should itself carry the accepting user or whether the audit-actor is sufficient. Recommended: dismiss: the acting admin IS captured (server-derived actor on the append-only audit event) and Task 1.1 intentionally omits the column — AC1 is satisfied by the audit trail; if a real-customer/legal need later requires the actor ON the record, reopen as a 7.4 immutability-scope item.
- [x] [Review][Patch][Low] (resolved 2026-07-06 — doc drift reconciled) `accept.ts` inline comment and the story Completion Notes / File List misdescribe the evidence-link mechanism [src/server/commands/quotes/accept.ts:764] — The shipped code links evidence via the narrow `link_existing_file` RPC, but Task 5.3, the "Evidence-link find-or-create decision" completion note ("7.1 uses `createFileLink` directly, which has no such guard"), and the File List all frame the mechanism as `createFileLink`. This internal inconsistency will mislead 8.2/7.x reconcilers who trust the File List. Fix: align the story narrative (Task 5.3 wording + the find-or-create note) with the shipped `link_existing_file` RPC path; the `accept.ts` comment block already says "via the narrow RPC" (correct) — reconcile the surrounding story prose to match. **Resolution:** Task 5.3 now states the shipped `link_existing_file` RPC + `ownerRecordVisible` file-side-check mechanism; the "Evidence-link find-or-create decision" completion note corrected (no longer claims `createFileLink` is used) and now explains the single-audit-row rationale; the File List `accept.ts` entry annotated with the RPC path. No code change — the shipped `accept.ts` was already correct.
- [x] [Review][Defer][Low] `source_sent_total_ore` derives from `quote_versions.accepted_price_ore`, which defaults to 0 — a zero-frozen sent total pre-fills the price input to "0 kr" and treats an equal 0 as "no delta, no reason" [src/server/commands/quotes/quote-db.ts:847] — Both the command (`loadQuoteVersionAcceptanceSource`) and the UI (`QuoteDetailView.tsx` → `sourceSentTotalOre={selected.accepted_price_ore}`) read `quote_versions.accepted_price_ore` (`bigint not null default 0`). Nothing in 7.1 asserts the frozen source total is > 0, so a 0-frozen sent version silently skips the AC2 adjusted-price gate for a 0 accepted price. This is a data-quality dependency on Epic 6 populating `accepted_price_ore` correctly, NOT a 7.1 code defect (the gate fires correctly for any non-zero frozen total; the INT tests seed `accepted_price_ore = 125_000`). deferred, pre-existing.
