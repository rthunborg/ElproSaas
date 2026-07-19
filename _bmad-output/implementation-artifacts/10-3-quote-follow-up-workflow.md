# Story 10.3: Quote Follow-Up Workflow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Säljare,
I want to plan, see, and complete follow-ups on sent quotes,
so that open deals get worked and decided instead of silently going stale.

## Story Context

- **Epic 10 [Wave B1a]:** Quote Lifecycle Completion (+ Phase B Governance Re-Baseline). The deliberately small first Phase B epic (PB-D3).
- **This is the THIRD delivered story of Phase B.** It depends on **Story 10.1** (the scope manifest `src/scope/manifest.ts` + the derived guardrails — this story ADDS a tenant table and must enrol it in the manifest in the SAME PR, FR129) and on **Story 10.2** (the shipped `lost` lifecycle token + `quote_lost_reasons` + `markQuoteVersionLost` command — the `Markera som förlorad/avböjd` jump target the follow-up surface routes to, and the auto-complete-on-lost seam binds to that landed model).
- **Nature of the work:** ONE new migration (a new tenant-owned table `quote_follow_ups` + a partial unique index — **NO new RPC**, architecture §14: follow-up scheduling/completion are single-row envelope commands), THREE new single-row envelope commands (plan / complete / annotate), the follow-up dialog + completion sheet + detail-header chip + list filters + overdue badge, and two pure due/overdue helpers. **No new dependency. No money/tax/rounding logic. No change to any sent-snapshot content. No RPC.**
- **Design authority (read these — they govern):** `architecture-phase-b.md` §9.1 (`quote_follow_ups` table row), §14 (single-row envelope commands remain envelope commands on RLS-protected queries — **no RPC**), §11 (the pipeline read-model + money-amount projection are Story 10.4's, NOT this story's), §6 (composite same-tenant FK pattern). Epic BDD: `epics-phase-b.md` §Story 10.3 (ll.622-660). UX delta: `ux-design-specification-phase-b.md` ll.171-176 (follow-ups), l.549 UXB-A6, l.344 (the `Uppföljningar` dashboard widget is E19/§4.10 — NOT here), UX-BDR4 (`StatusBadge`) / UX-BDR17 (`ConnectionChip`). Test plan: `test-design-epic-10.md` (R-1030/R-1031/R-1032/R-1033 + R-1015/R-1034; test IDs 10.3-*).
- **The problem this solves:** the owner-confirmed quote status set is now complete (10.2 added Förlorad/Avböjd), but there is no user-facing way to **plan, see, and close out** the follow-up work that decides an open deal. Without a follow-up workflow, sent deals go silently stale — no due list, no overdue signal, no "the follow-up surface is where deals get decided" affordance (jump to Förlorad/Avböjd or Ny version). This story ships the **manual** follow-up workflow only.

## ⚑ SCOPE BOUNDARY — this story is the MANUAL follow-up workflow; automated reminders are Epic 13's

> **Automated reminders / notifications are NOT this story.** The `quote.follow_up_due` notification producer (and any email/in-app reminder that fires when a follow-up falls due) is registered by **Epic 13**, consuming this story's data. There is **NO forward dependency** (EB-A8): the due/overdue **lists and badges here work entirely without notifications**. This story MUST NOT add any notification producer, email-send path, background runner, or `notifications`/`email_*` write. If you find yourself wiring a reminder that "fires," STOP — that is E13.

## ⚑ SETTLED DESIGN DECISIONS (do NOT re-litigate at dev time)

1. **`quote_follow_ups` is an UPDATE-able tenant table, NOT insert-only.** Unlike 10.2's insert-only `quote_lost_reasons`, a follow-up row **advances state on its own row** (`status` open → completed, `outcome`/`completed_at` written on completion) and an open row's `note` can be annotated — so the table carries a **SELECT + INSERT + UPDATE** grant/policy set (still **NO DELETE** grant/policy — archive-over-delete). This changes its `TENANT_TABLES` enrolment profile (`updateDenialKind → "rls-invisible"`, mirror `quote_acceptances`), which is the load-bearing difference from 10.2's `"privilege"`/insert-only enrolment (see Constraints).
2. **One open follow-up per QUOTE (not per version), enforced by a partial unique index** `unique (quote_id) WHERE status='open'` (UXB-A6). Planning a second open follow-up is rejected with a **clear message**; a NEW open follow-up is allowed once the prior is completed (`planera nästa`).
3. **NO RPC (architecture §14).** plan / complete / annotate are plain `defineCommand` envelope commands issuing direct RLS-client table writes. The one-open rule is DB-enforced (the partial unique index → `23505` → mapped to a clear `VALIDATION_FAILED`); the commands do not need a transactional RPC.
4. **Due/overdue is deterministic Europe/Stockholm date logic, not a wall-clock read.** Classification is a **pure** function over `(due_date, injectedNow)` computing "today in Europe/Stockholm" from the injected instant. NO `Date.now()` on the classification path (mirrors the render path's injected-clock discipline). The same date discipline is reused by Story 10.4's period windows.
5. **Auto-complete-on-lost = a TWO-COMMAND orchestration at the action layer, NOT a widened RPC (architecture §14).** When the user takes the `Markera som förlorad/avböjd` jump **from the follow-up surface**, the action calls the shipped 10.2 `markQuoteVersionLost` (unchanged) FIRST, then `completeQuoteFollowUp(follow_up_id, outcome=<the chosen förlorad/avböjd>)`. Both are individually audited. See Dev Notes → "The auto-complete-on-lost seam" for the ordering rationale and the accepted, recoverable non-atomicity residual. **Do NOT re-touch the immutability-critical `mark_quote_version_lost` RPC / its frozen migration.**
6. **10.3 SHIPS the follow-up list filters + overdue badge + next-follow-up chip; 10.4 does the read-model + consistency pass.** Story 10.4 AC2 explicitly says the follow-up filters + header chips come "from Stories 10.2–10.3" and 10.4 only makes them "render consistently." So the `Har uppföljning` / `Försenad uppföljning` filters (functional, correct rows), the overdue-escalation badge, and the next-follow-up chip land HERE. The pipeline read-model, hit-rate/counts aggregation, and the `{ data, entitlements }` descriptor are Story 10.4 (STOP if you start building a read-model or an aggregate). This reconciles the 10.2 Task 5.4 note (which loosely lumped these filters under "10.4") against the authoritative 10.3/10.4 ACs.

## Acceptance Criteria

### AC1 — Plan a follow-up on a sent version (one open per quote)

**Given** a sent quote version
**When** the user chooses `Planera uppföljning` with a **due date** and a note
**Then** a follow-up is created with `status='open'` (envelope-authorized + audited) and appears on the **quote detail header as the next-follow-up chip**
**And** a **partial unique index enforces at most one open follow-up per quote** (UXB-A6); planning a second **open** follow-up is rejected with a **clear message** (not a raw DB error), while a new open follow-up is allowed once the prior one is completed.

### AC2 — Quote-list follow-up filters + overdue escalation

**Given** open follow-ups exist
**When** the user views the quote list
**Then** the `Har uppföljning` and `Försenad uppföljning` status/attribute filters **work** (return exactly the correct rows), **and overdue follow-ups escalate visually** (an overdue badge, using `StatusBadge`/`ConnectionChip` contracts) — with due/overdue computed on the Europe/Stockholm date boundary.

### AC3 — Complete a follow-up + the decide-here jumps + auto-complete-on-lost

**Given** a due (open) follow-up
**When** the user completes it (`Klarmarkera`) with an **outcome note**
**Then** the completion is **recorded and audited** (`status`→`completed`, `outcome` + `completed_at` set on the same row), the sheet offers `planera nästa` (open a new plan dialog), and offers jumps to `Markera som förlorad/avböjd` (Story 10.2) and `Ny version`
**And** when the **lost path is taken from the follow-up surface**, the open follow-up **auto-completes with the chosen outcome** (the Förlorad/Avböjd choice) — no open follow-up survives a lost flip taken from this surface.

### AC4 — Cross-tenant isolation + manifest/H4 enrolment

**Given** tenant A and tenant B quotes
**When** cross-tenant follow-up reads/writes are attempted (command or direct SQL)
**Then** RLS rejects them generically (`TENANT_ACCESS_DENIED`); the plan/complete/annotate commands are envelope-authorized and audited
**And** `quote_follow_ups` is enrolled in the `quotes` module of `src/scope/manifest.ts` **and** in `TENANT_TABLES` in the SAME PR as its migration (FR129), so the H4 inventory gate + the shared cross-tenant/anon suites cover it (manifest-derived `TENANT_TABLES` count 25 → 26).

## Tasks / Subtasks

- [ ] **Task 1 — Migration: `quote_follow_ups` table + partial unique index + full RLS (AC1, AC3, AC4)**
  - [ ] 1.1 New migration file `supabase/migrations/<ts>_quote_follow_ups.sql` (timestamp AFTER `20260719120000` — the 10.2 migration). Do NOT edit any frozen migration. Purely additive.
  - [ ] 1.2 Create `public.quote_follow_ups` (see Dev Notes → "The `quote_follow_ups` table" for the verbatim shape): direct `tenant_id` (FK → `tenants` on delete cascade), `quote_id` + `quote_version_id` with **composite same-tenant FKs** to `quotes(id,tenant_id)` / `quote_versions(id,tenant_id)` (on delete cascade), `due_date date not null`, nullable `note`, `status text not null default 'open' check (status in ('open','completed'))`, nullable `outcome`, `created_at`, nullable `completed_at`, plus the fail-closed `check (status <> 'completed' or completed_at is not null)`.
  - [ ] 1.3 **Partial unique index** `create unique index quote_follow_ups_one_open_per_quote on public.quote_follow_ups (quote_id) where status = 'open';` (the UXB-A6 one-open rule — R-1030). Add `quote_follow_ups_tenant_id_idx (tenant_id)`.
  - [ ] 1.4 Grants: `grant select, insert, update on public.quote_follow_ups to authenticated;` (**NO delete** — archive-over-delete) and `grant select, insert, update, delete on public.quote_follow_ups to service_role;` (repo convention, test-only). Anon: nothing.
  - [ ] 1.5 `enable row level security` + **`force row level security`**. Policies (3): `quote_follow_ups_select_own` (SELECT `using (public.is_tenant_admin(tenant_id))`), `quote_follow_ups_insert_own` (INSERT `with check (public.is_tenant_admin(tenant_id))`), `quote_follow_ups_update_own` (UPDATE `using (...) with check (...)`). **NO delete policy.**
  - [ ] 1.6 `comment on table` documenting: tenant-owned, MANY rows per tenant, at most ONE open per quote (partial unique index), UPDATE-able (open→completed), NO delete/updated_at-trigger, NO money/öre column, NO Fortnox/supplier/sync/portal column, NO notification/email column (E13 owns reminders).
- [ ] **Task 2 — Enrol the new table (H4 + scope manifest) IN THE SAME PR (AC4, FR129)**
  - [ ] 2.1 Add `"quote_follow_ups"` to the `quotes` module `tenantTables` in `src/scope/manifest.ts` (the module comment at ll.134-137 already reserves this for 10.3). Manifest-derived `TENANT_TABLES` count 25 → 26; the 10.1 coherence + derivation tests must stay green. **Manifest-governed activation (ADR-B003 §5.5): the table may exist only when its module change lands in the same PR** — the H4 gate fails CI otherwise. The `quotes` module is already `active`/wave `A` — this is a table joining an existing active module, NOT a new pending module.
  - [ ] 2.2 Bump the live-count pins in `tests/unit/scope/manifest-shape.test.ts` + `manifest-derivations.test.ts` from 25 → 26 (they were bumped 24 → 25 by 10.2). **Do NOT re-touch the frozen Phase-A gate validators** (`acceptance-gate-report-validators.test.ts` / `migration-runbook-validators.test.ts`) — 10.2 already relaxed them to a `>= 24` floor; they stay as floors (Phase B only adds).
  - [ ] 2.3 Enrol `quote_follow_ups` in `tests/integration/rls/tenant-table-inventory.ts`: add it to the `TenantTableName` union + `TENANT_TABLES`, and add its per-table spoof/filter/mutation/anon metadata switch-cases. **Mutation-denial profile = `"rls-invisible"`** (UPDATE granted; cross-tenant hidden by RLS `USING` — mirror `quote_acceptances`, NOT the 10.2 `"privilege"`/insert-only `quote_lost_reasons` case). The UPDATE hijack payload sets a benign own-column (e.g. `note`/`outcome`); the negative asserts zero-rows-affected + a BYPASSRLS re-read proving the target row is UNCHANGED (never a vacuous empty set). DELETE stays `"privilege"` (no app-path delete grant).
- [ ] **Task 3 — Commands + validators: plan / complete / annotate (AC1, AC3, AC4)**
  - [ ] 3.1 `src/server/commands/quotes/validation.ts`: add pure `validatePlanQuoteFollowUp` (`quote_version_id` UUID-shaped; `due_date` a valid ISO date; `note` optional, bounded, trimmed), `validateCompleteQuoteFollowUp` (`follow_up_id` UUID-shaped; `outcome` REQUIRED, non-empty trimmed, bounded), `validateAnnotateQuoteFollowUp` (`follow_up_id` UUID-shaped; `note` bounded). **Never echo raw values** (`VALIDATION_FAILED`).
  - [ ] 3.2 New command file `src/server/commands/quotes/follow-ups.ts` with three `defineCommand`s (envelope, RLS client, no RPC — mirror the envelope shape of `lifecycle.ts`, minus the RPC):
    - `planQuoteFollowUp` — `ownership: { table: 'quote_versions', id: input.quote_version_id }`; in `execute` load the anchor version's `status` AND `quote_id` from the RLS client (extend `loadQuoteVersionStatus` or select both) and assert `status='sent'` (else `VALIDATION_FAILED`); **derive `quote_id` from the loaded version row — do NOT trust a client-supplied quote_id** (a mismatched own-tenant quote_id would satisfy its own composite FK yet point the follow-up at the wrong quote); INSERT the open row on the RLS client (`tenant_id` from `ctx.tenantContext`, never the client); map `23505` (the one-open partial unique index) → `VALIDATION_FAILED` with a clear message ("En öppen uppföljning finns redan för offerten."); audit `{ targetId }` (the new follow-up id) ONLY.
    - `completeQuoteFollowUp` — `ownership: { table: 'quote_follow_ups', id: input.follow_up_id }`; UPDATE `set status='completed', outcome=<input.outcome>, completed_at=ctx.clock.now()` `where id=… and tenant_id=… and status='open'`; zero rows (already completed / not open) → `VALIDATION_FAILED` ("Uppföljningen är redan avslutad."); audit `{ targetId }` ONLY (NO outcome free text — possible PII).
    - `annotateQuoteFollowUp` — `ownership: { table: 'quote_follow_ups', id: input.follow_up_id }`; UPDATE `set note=<input.note>` `where id=… and tenant_id=… and status='open'`; zero rows → `VALIDATION_FAILED`; audit `{ targetId }` ONLY.
  - [ ] 3.3 Register all three in `src/server/commands/quotes/index.ts` (export commands + validators/types).
- [ ] **Task 4 — Pure due/overdue + chip/badge selection logic (AC2)**
  - [ ] 4.1 `src/features/quotes/follow-up-dates.ts`: a pure `classifyFollowUp(dueDateISO, now, timeZone='Europe/Stockholm')` returning `{ isDue, isOverdue }` (or a small status enum). Compute "today in Europe/Stockholm" from the injected `now` via an explicit `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' })` (never the host default, never `Date.now()`). Overdue = open AND `due_date < todayStockholm`; due-today = open AND `due_date == todayStockholm`. Completed follow-ups are never due/overdue.
  - [ ] 4.2 In the same module (or `src/features/quotes/follow-up-view.ts`): a pure `selectNextOpenFollowUp(followUps)` (pick the single open follow-up for the chip) + a `followUpChipState(followUp, now)` (the chip/overdue-badge presentation state). Keep this client-island logic on the fast unit gate (the epic-9/10 "extract client-island logic to a pure unit" lesson).
- [ ] **Task 5 — UI: plan dialog, completion sheet + jumps, detail chip, list filters + badge (AC1, AC2, AC3)**
  - [ ] 5.1 New client component `src/components/quotes/PlanFollowUpButton.tsx` (the `Planera uppföljning` dialog): a due-date input + a note textarea + explicit confirm. Render it on a **sent** version in `QuoteDetailView.tsx`, alongside the accept / mark-lost affordances.
  - [ ] 5.2 New client component `src/components/quotes/FollowUpSheet.tsx` (the `Klarmarkera` completion sheet): an outcome-note field + confirm; after completion offers `planera nästa` (re-open `PlanFollowUpButton`) and the decide-here jumps to `Markera som förlorad/avböjd` (reuse the shipped 10.2 `MarkLostButton`, passing the open follow-up id) and `Ny version` (reuse the existing new-version affordance).
  - [ ] 5.3 Detail header: render the **next-follow-up chip** (from `selectNextOpenFollowUp` + `followUpChipState`) using the `ConnectionChip`/`StatusBadge` contract (UX-BDR17/BDR4); overdue escalates visually.
  - [ ] 5.4 New action-state file `src/features/quotes/follow-up-action-state.ts` (mirror `lost-action-state.ts`), and server actions in `src/features/quotes/actions.ts`: `planQuoteFollowUpAction`, `completeQuoteFollowUpAction`, `annotateQuoteFollowUpAction`. Each revalidates BOTH `/quotes/[quoteId]` AND the `/quotes/[quoteId]/versions/[versionId]` subroute after success (the 6.2 subroute-revalidation lesson).
  - [ ] 5.5 **The auto-complete-on-lost seam:** extend `markQuoteVersionLostAction` to read an OPTIONAL hidden `follow_up_id` form field; when present AND the lost flip succeeds, call `completeQuoteFollowUp(follow_up_id, outcome=<the chosen förlorad/avböjd>)` (lost-flip FIRST — see Dev Notes). The standalone (non-follow-up) lost dialog omits the field, so 10.2's behavior is byte-unchanged when no follow-up id is carried.
  - [ ] 5.6 Quote list (`src/components/quotes/QuoteList.tsx` + `src/features/quotes/read.ts`): add the `Har uppföljning` and `Försenad uppföljning` filters (functional, correct rows) + an overdue badge on rows with an overdue open follow-up. Surface the open-follow-up + overdue flags from the list read projection. **Keep the read-model/aggregation OUT — that is Story 10.4.**
- [ ] **Task 6 — Tests (all ACs; map to test-design-epic-10 IDs) — see Dev Notes → Testing**
  - [ ] 6.1 UNIT (`node --test`): 10.3-UNIT-01 (due/overdue date-boundary logic, Europe/Stockholm, injected instant — due-today, just-overdue, completed-excluded, empty, overdue-escalation flag); 10.3-UNIT-02 (next-follow-up-chip + overdue-badge selection logic); the plan/complete/annotate validators.
  - [ ] 6.2 INT (Vitest, local Supabase): 10.3-INT-01 (one-open partial unique index — positive plan; a second open rejected with the clear `VALIDATION_FAILED` message; a NEW open allowed after the prior is completed); 10.3-INT-02 (migration + isolation: direct `tenant_id`, force RLS, the 3 policies, `anon → none`, `TENANT_TABLES` enrolment; plan/complete/annotate commands each write exactly ONE audit row); 10.3-INT-03 (complete-with-outcome + `planera nästa` reopen allowed; the lost-from-follow-up jump auto-completes the follow-up with the chosen outcome and both actions are audited — the 10.3↔10.2 coupling).
  - [ ] 6.3 RLS (Vitest): 10.3-RLS-01 (cross-tenant read/write + anon rejected; own-tenant UPDATE ALLOWED but cross-tenant UPDATE hidden/zero-rows; H4 green with the table enrolled) — via the `TENANT_TABLES` enrolment, not a hand-written ad-hoc suite.
  - [ ] 6.4 Extend `tests/integration/rls/migration-reset.int.test.ts` (EXACT policy enumeration) with the 3 `quote_follow_ups` policies.
  - [ ] 6.5 E2E (Playwright): 10.3-E2E-01 (`Planera uppföljning` with due date + note → next-follow-up chip; overdue badge; `Klarmarkera` with outcome note → sheet offers `planera nästa` / `Markera som förlorad/avböjd` / `Ny version`) — two-tenant fixture, `crypto.randomUUID()` seeds.
  - [ ] 6.6 DOCS: 10.3-DOCS-01 (record the legacy follow-up delta P18 + the recorded parallel-open-follow-ups reversal STOP — see Dev Notes → "Oracle / legacy delta").
  - [ ] 6.7 PII: 10.x-UNIT-01 — ensure all follow-up-note fixtures (two-tenant factory seeds, E2E seeds) are anonymized shape-only. **If any follow-up golden fixture is added**, extend the STANDING PII/secret scan through the SHARED authority (`tests/support/anonymization-scan.ts` + the standing privacy-scan test) — NOT a weaker fixture-local check (the 10.2 review lesson).

## Dev Notes

### What this story IS / IS NOT

- **IS:** the `quote_follow_ups` table (UPDATE-able, one-open-per-quote partial unique index) + three envelope commands (plan/complete/annotate, no RPC) + the plan dialog + the completion sheet with the decide-here jumps + the auto-complete-on-lost seam (two-command orchestration) + the next-follow-up chip + the `Har uppföljning`/`Försenad uppföljning` list filters + the overdue badge + the pure Europe/Stockholm due/overdue classification; enrolment in `TENANT_TABLES` + the scope manifest in the same PR.
- **IS NOT:** any automated reminder / notification producer / email-send path / background runner (**Epic 13** — the `quote.follow_up_due` producer consumes this data; lists+badges work WITHOUT it, EB-A8); the pipeline read-model / hit-rate / sent-accepted-lost counts / the `{ data, entitlements }` descriptor (**Story 10.4** — STOP if you start a read-model or an aggregate); the `Uppföljningar` dashboard widget (**Epic 19**, UX §4.10); any RPC (architecture §14 — single-row envelope commands); any mutation of a sent snapshot's customer-visible content (follow-ups are workflow metadata on a SEPARATE table — they never touch `quote_versions` snapshot columns); any money/tax/rounding logic; the permission matrix / role-aware withholding (Epic 11 — this runs under `tenant_admin` via the envelope capability seam, EB-A4).

### The `quote_follow_ups` table (verbatim shape — mirror `quote_acceptances`, MINUS money + PLUS the one-open index)

```
create table public.quote_follow_ups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quote_id uuid not null,
  quote_version_id uuid not null,
  due_date date not null,
  note text,
  status text not null default 'open' check (status in ('open', 'completed')),
  outcome text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint quote_follow_ups_quote_same_tenant
    foreign key (quote_id, tenant_id) references public.quotes (id, tenant_id) on delete cascade,
  constraint quote_follow_ups_version_same_tenant
    foreign key (quote_version_id, tenant_id) references public.quote_versions (id, tenant_id) on delete cascade,
  constraint quote_follow_ups_completed_shape
    check (status <> 'completed' or completed_at is not null)
);

create unique index quote_follow_ups_one_open_per_quote
  on public.quote_follow_ups (quote_id) where status = 'open';

create index quote_follow_ups_tenant_id_idx on public.quote_follow_ups (tenant_id);
```

- **UPDATE-able (NOT insert-only):** SELECT + INSERT + UPDATE policies/grants for `authenticated` (open → completed is an UPDATE; annotate is an UPDATE). **NO DELETE** grant/policy (archive-over-delete). This is the key contrast with 10.2's insert-only `quote_lost_reasons` — it drives the `updateDenialKind → "rls-invisible"` enrolment (Task 2.3).
- `due_date` is a `date` (no time) — timezone-robust; overdue is computed against "today in Europe/Stockholm" from the injected instant (Task 4.1), so the column stores no tz.
- `outcome` holds the completion outcome note; on the lost-from-follow-up path it carries the chosen förlorad/avböjd. `note` is the planning note (optional). NO `updated_at`/`set_updated_at` trigger (nothing derives from it; the completion UPDATE is explicit). NO money/öre column. NO supplier/Fortnox/sync/api/portal column. NO notification/reminder column (E13).
- A completed follow-up is not editable by any command path (the commands filter `status='open'`); a hypothetical own-tenant direct re-open/edit is bounded by the one-open index and is an accepted own-tenant capability for the pilot — do NOT add an immutability trigger (out of scope, over-engineering).

### The three commands (no RPC — architecture §14; mirror `lifecycle.ts` envelope shape)

- All three are `defineCommand` through the EXISTING envelope: resolve user → resolve active `tenant_admin` → validate typed input → envelope `ownership` verifies the target id is own-tenant-visible (zero rows → `TENANT_ACCESS_DENIED` BEFORE execute) → in `execute` a direct RLS-client write (never service-role) with the resolved `tenant_id` → append-only audit `{ targetId }` ONLY. No bespoke auth/error/audit mechanism.
- `planQuoteFollowUp`: ownership on `quote_versions`; assert the anchor version is `'sent'` (a follow-up is for an OPEN deal); the one-open rule is DB-enforced (the partial unique index → `23505` → a mapped `VALIDATION_FAILED` with the clear message). Use the existing quote write-error mapper if it already maps `23505`; otherwise map `23505` → `VALIDATION_FAILED` at the command with the specific message. **Do NOT introduce a new `CommandErrorCode`** — the stable error family is closed (architecture §14).
- `completeQuoteFollowUp` / `annotateQuoteFollowUp`: ownership on `quote_follow_ups`; the `where … and status='open'` predicate makes complete/annotate a clean no-op-reject on a non-open row (zero rows → `VALIDATION_FAILED`). `completed_at = ctx.clock.now()` (the single injected command clock — never a wall-clock read).
- **Audit metadata is `{ targetId }` ONLY** on all three — never the note/outcome free text (possible PII), matching the lost/lifecycle allow-list discipline.

### The auto-complete-on-lost seam (10.3 ↔ 10.2 — binds to the SHIPPED lost model)

- **Flow:** on the completion sheet, `Markera som förlorad/avböjd` opens the shipped 10.2 `MarkLostButton` dialog, carrying the open follow-up id as a hidden field. On confirm, `markQuoteVersionLostAction` (extended in Task 5.5) performs the lost flip via the unchanged `markQuoteVersionLost` command FIRST, and on success calls `completeQuoteFollowUp(follow_up_id, outcome=<the chosen förlorad/avböjd>)`.
- **Why two commands, lost-first, NOT a widened RPC:** architecture §14 states follow-up completion is a single-row envelope command with **no RPC**, and the 10.2 `mark_quote_version_lost` RPC/migration is frozen and immutability-critical (R-1010) — re-touching it to complete a follow-up in one transaction adds regression risk to the sent-commitment path for no architectural mandate. The lost flip is the irreversible customer-facing commitment and must succeed on its own merits first; the follow-up completion is own-tenant workflow metadata that cannot fail on business grounds once the lost flip lands.
- **Accepted residual (document it, don't over-engineer):** the two writes are NOT one DB transaction. A rare transient failure of the follow-up completion AFTER a successful lost flip leaves an orphaned OPEN follow-up on a now-lost quote — **non-corrupting and recoverable** (the follow-up sheet remains available; the user can `Klarmarkera` it manually; both commands are independently audited). No sent-snapshot content is touched at any point. The E2E/INT (10.3-INT-03) prove the happy-path auto-complete; the residual is the pilot posture (mirrors the Phase-A verified-compensated seams, e.g. 6.3 PDF pipeline).

### Reuse — do NOT reinvent

- Command envelope + `defineCommand` + `verifyOwnership` + the quote write-error mapper + `loadQuoteVersionStatus` — all in `src/server/commands/quotes/{lifecycle.ts,quote-db.ts,validation.ts}`. Copy the `markQuoteVersionLifecycle`/`markQuoteVersionLost` envelope shape (drop the RPC call — use direct RLS-client writes).
- The RLS/policy/composite-same-tenant-FK/`is_tenant_admin` migration pattern — copy `quote_acceptances` (`20260709120000_…`) / the 10.2 `quote_lost_reasons` migration (`20260719120000_…`), KEEPING the UPDATE policy/grant (this table is updatable) and DROPPING nothing but DELETE.
- The 10.2 `MarkLostButton` dialog + `markQuoteVersionLostAction` — the follow-up sheet jumps to them (pass the follow-up id); do NOT fork a second lost path.
- The action-state / subroute-revalidation shape — copy `lost-action-state.ts` + `markQuoteVersionLostAction`.
- `StatusBadge` / `ConnectionChip` / `src/components/quotes/status.ts` — the chip + overdue badge render through these (UX-BDR4/BDR17); no new badge component.
- Two-tenant fixture + `tests/factories/**` quote factories (extend with `quote_follow_ups` seeds: open / overdue / completed) + `tests/e2e/global-setup.ts`. Per-run `crypto.randomUUID()` ids.
- The explicit `sv-SE` / injected-clock date discipline from `src/server/quote-pdf/render.ts` (no host-default locale, no `Date.now()`); the Europe/Stockholm classification is new but follows this discipline (no existing Stockholm helper — `render.ts` formats in UTC; add the small pure helper in Task 4.1 and let 10.4 reuse it).

### Constraints & persistent facts (from epic-10 retro-notes + deferred-work overlaps — MUST honor)

1. **Enrol the new table in the scope manifest in the SAME PR (Story 10.1 ratified; FR129).** Add `quote_follow_ups` to `src/scope/manifest.ts` `quotes.tenantTables` together with the migration. The table joins the EXISTING **active** `quotes` module (wave `A`) — NOT a new pending module. Manifest-governed activation means the H4 gate fails CI if the table exists un-enrolled; the manifest edit IS the activation. Bump the live-count pins `manifest-shape`/`manifest-derivations` 25 → 26; the frozen Phase-A gate validators stay `>= 24` FLOORS (10.2 already reconciled them — do NOT re-touch). (epic-10 retro-notes 10-1/10-2: manifest-governed activation + the count-pins-are-floors reconciliation, ratified in 10.2.)
2. **`quote_follow_ups` is UPDATE-able, so its `TENANT_TABLES` mutation-denial profile differs from 10.2's insert-only table.** Enrol with `updateDenialKind → "rls-invisible"` (mirror `quote_acceptances`), NOT `"privilege"` (which was correct only for the insert-only `quote_lost_reasons`). Getting this wrong makes the cross-tenant UPDATE negative assert the wrong mechanism. (from `tests/integration/rls/tenant-table-inventory.ts:278-313`.)
3. **Unskip-or-delete ATDD finalize discipline (epic-10 retro-notes Tier-A + the 10.2 review findings).** Leave NO skipped scaffolds behind. Every ATDD scaffold this story creates must end EITHER unskipped-and-green OR deleted — never a `describe.skip` shipped as if it were coverage, never a duplicate throwing-placeholder scaffold next to the real test. Any "all unskipped and green" Change-Log claim must be literally true (three separate 10.2 review Patches were exactly this failure mode — do not repeat).
4. **Standing PII/secret scan via the SHARED authority for any golden fixture (10.2 review Patch, R-1015).** If a follow-up golden fixture is added, extend the standing scan through `tests/support/anonymization-scan.ts` (`listGoldenFixtureFiles(dir)`) + the standing `lovable-privacy-scan.test.ts`-style test so the new fixture fails CI on real PII via the STANDING control — not only a weaker fixture-local pattern block. Follow-up notes are free text: keep ALL fixtures (factory + E2E seeds) anonymized shape-only.
5. **`quote_events` stays RPC-only for lifecycle; follow-ups do NOT append `quote_events` (deferred-work 6-4, accepted LOW).** Follow-ups are a SEPARATE workflow table — they emit NO `quote_events` row. The only `quote_events` write on any 10.3 path is the `lost` event appended by the shipped 10.2 `mark_quote_version_lost` RPC on the auto-complete-on-lost jump. Do NOT introduce any new client-facing `quote_events` insert/edit path and do NOT "fix" the 6-4 deferral here (out of scope; work within it).
6. **Two-runner discipline (epic-10 retro-notes 10-1 Phase-4).** Pure logic (due/overdue classification, chip/badge selection, the 3 validators) lands as `node --test` UNIT — NOT Playwright. DB-backed migration/commands/RLS is Vitest INT/RLS; only the dialog/sheet/chip/badge/filters are Playwright E2E. Do not push pure-TS assertions into the slow gate.
7. **`SUPABASE_TEST_REQUIRED=1` in CI** — the INT/RLS/E2E gate hard-fails on a missing/unreset stack (the post-reset false-green trap). Run against a freshly `supabase db reset` local stack. The committed `supabase/cli-profile.yaml` lacks `dashboard_url` for CLI 2.109.1 (10.2 dev hit this) — use a complete TEMP profile for the local reset only; do NOT commit a cli-profile change (out of scope).
8. **Golden fixture EOL (epic-10 retro-notes 10-1 Phase-5 / 10-2).** If a follow-up golden fixture is added, the dir-wide `tests/fixtures/golden/**/*.json text eol=lf` `.gitattributes` pin (added in 10.2) already covers it — verify it applies; no new `.gitattributes` entry needed unless a new golden dir is introduced.
9. **No service-role on any client/read path; no new money/rounding path; no snapshot-content write; no notification/email path.** Hard invariants (AGENTS.md; the ⚑ scope boundary above; Stop Conditions below).

### Oracle / legacy delta (P18 — 10.3-DOCS-01; no legacy code copied)

- The Lovable oracle is a behavioral reference only and is not reachable in this run; terminology is resolved from the owner-confirmed workflow + the UX strawman and recorded in the story completion notes.
- **Legacy delta (P18, prd-phase-b ll.204):** the legacy app had quote follow-up handling (workflow, due lists, completion). This story ships the equivalent MANUAL workflow (plan/see/complete + due/overdue + the decide-here jumps) under the owner-confirmed quote lifecycle. **No data migration** (demo-data-only, MVP posture). Record the delta; do NOT copy legacy code.
- **Parallel-open-follow-ups STOP (UXB-A6, R-1034):** the design assumes **one open follow-up per quote** (complete-then-plan-next). If the oracle/owner turns out to REQUIRE parallel open follow-ups per quote, that reverses UXB-A6 and is a **STOP** — take to oracle/owner (do not silently drop the partial unique index). Record this as a documented residual.

### Testing (levels, IDs, and the non-negotiables)

- Runners: `node --test` (UNIT under `tests/unit/**`), Vitest (INT/RLS, DB-backed, local Supabase), Playwright (E2E). No new runner, no new dependency.
- **P0/P1 non-negotiables (test-design exit criteria for 10.3):** `quote_follow_ups` enrolled in `TENANT_TABLES` (H4 green) with force-RLS + the 3 own-tenant policies + `anon → none`; the one-open partial unique index proven (second-open rejected, new-open-after-complete allowed); due/overdue date-boundary logic deterministic (Europe/Stockholm, injected instant); complete-with-outcome + the lost-from-follow-up auto-complete proven + audited; cross-tenant + anon negatives pass; no real PII/secret in any follow-up-note fixture (CI scan green).
- Enrolment is the completeness guarantee — do NOT hand-write an ad-hoc isolation suite that bypasses the `TENANT_TABLES` inventory (test-design Testability Note 5).

### Project Structure Notes

- New files: `supabase/migrations/<ts>_quote_follow_ups.sql`, `src/server/commands/quotes/follow-ups.ts`, `src/features/quotes/follow-up-dates.ts` (+ optionally `follow-up-view.ts`), `src/features/quotes/follow-up-action-state.ts`, `src/components/quotes/PlanFollowUpButton.tsx`, `src/components/quotes/FollowUpSheet.tsx`, plus INT/RLS/UNIT/E2E test files under `tests/**`.
- Edited files: `src/scope/manifest.ts`, `src/server/commands/quotes/{validation.ts,index.ts}`, `src/features/quotes/{read.ts,actions.ts}`, `src/components/quotes/{QuoteDetailView.tsx,QuoteList.tsx}`, `tests/integration/rls/{tenant-table-inventory.ts,migration-reset.int.test.ts}`, `tests/unit/scope/{manifest-shape.test.ts,manifest-derivations.test.ts}`, `tests/factories/tenants.ts`, `tests/e2e/global-setup.ts`.
- All quote surfaces live under `src/{app/(app)/quotes,components/quotes,features/quotes,server/commands/quotes}` — no new module directory. Note `src/components/quotes/QuoteList.tsx` is a shared surface carrying an open picker-readiness deferral (deferred-work, list-page-create-entry-points) — leave that untouched; only ADD the follow-up filters + overdue badge.

### Stop Conditions Requiring Human Approval

- STOP if parallel open follow-ups per quote turn out to be a hard legacy-behavior requirement (would reverse UXB-A6 — take to oracle/owner; do not drop the one-open index silently).
- STOP if enrolling `quote_follow_ups` in the manifest/`TENANT_TABLES` surfaces a pre-existing drift in the 10.1-derived guardrails (reconcile or escalate — do not paper over).
- STOP if satisfying the follow-up workflow appears to require an RPC, a new money/rounding path, a `quote_versions` snapshot-column write, or a notification/email producer — all of these are out of scope (RPC → architecture §14 says none; snapshot write → NFR11/FR63; reminders → Epic 13).

### References

- [Source: architecture-phase-b.md#9.1 quote_follow_ups (l.290); #14 single-row envelope commands / no RPC (l.429); #11 read-model = 10.4; #6 composite same-tenant FK]
- [Source: epics-phase-b.md#Story 10.3 (ll.622-660); #Story 10.4 AC2 (chips/filters "from Stories 10.2–10.3", ll.675-677); Cross-Epic Rule 2]
- [Source: ux-design-specification-phase-b.md ll.171-176 (follow-ups: Planera/Klarmarkera/planera nästa/jumps/overdue), l.344 (Uppföljningar widget = E19), l.549 UXB-A6, UX-BDR4/BDR17]
- [Source: prd-phase-b.md FR64 (l.312), FR65 = 10.4 (l.313), P18 (l.204), FR81/FR107 (email/dashboard = E13/E19), journey B4 (l.149), AC-B1a-5 (l.479)]
- [Source: test-design-epic-10.md R-1030/R-1031/R-1032/R-1033/R-1034/R-1015; 10.3-UNIT/INT/RLS/E2E/DOCS test IDs; Testability Notes 5/6; Entry/Exit Criteria]
- [Source (code, reuse): src/server/commands/quotes/{lifecycle.ts,lost.ts,quote-db.ts,validation.ts,index.ts}; src/features/quotes/{lifecycle.ts,timeline.ts,read.ts,actions.ts,lost-action-state.ts}; src/components/quotes/{MarkLostButton.tsx,QuoteDetailView.tsx,QuoteList.tsx,status.ts}; supabase/migrations/20260709120000_acceptance_to_job_model.sql (quote_acceptances pattern); 20260719120000_quote_lost_reasons_and_lost_status.sql (10.2 table/RLS pattern); src/scope/manifest.ts (quotes module ll.126-152); tests/integration/rls/tenant-table-inventory.ts (updateDenialKind ll.278-313); src/server/quote-pdf/render.ts (sv-SE/injected-clock date discipline)]
- [Source (constraints): _bmad-output/auto-bmad/retro-notes/epic-10.md; _bmad-output/implementation-artifacts/deferred-work.md (6-4 quote_events insert; list-page QuoteList picker; 10-1 tenantTablesFromManifest scope)]

## Dev Agent Record

### Agent Model Used

<!-- Populated by the dev-story agent. -->

### Debug Log References

### Completion Notes List

### File List

### Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-19 | 0.1 | Story context created (ready-for-dev) — quote_follow_ups table (updatable, one-open-per-quote) + plan/complete/annotate envelope commands (no RPC) + follow-up dialog/sheet/chip/badge/filters + Europe/Stockholm due-overdue logic + auto-complete-on-lost seam (two-command orchestration) + scope-manifest enrolment (25→26). |
