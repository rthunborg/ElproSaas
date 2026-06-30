-- ============================================================================
-- Migration: company_settings_and_quote_terms
-- Story 3.3 — Company Identity, Quote Terms, And VAT Defaults.
--
-- The FIFTH migration in the project and the FIRST to add tenant-owned SETTINGS
-- tables. Creates the two Phase-A settings root entities (architecture §7 v0 IN
-- list) — `company_settings` (Företagsinställningar — quote identity + VAT
-- display/rate defaults + PDF-ready branding) and `quote_terms` (Offertvillkor —
-- tenant-owned reusable quote terms with an owner/legal SIGN-OFF). Each carries a
-- DIRECT `tenant_id` (architecture §6 convention), `created_at`/`updated_at`
-- timestamps with the EXISTING `public.set_updated_at()` BEFORE UPDATE trigger, a
-- `tenant_id` index, and is ONE-row-per-tenant (a `unique (tenant_id)` so the
-- upsert target is deterministic).
--
-- It REUSES the objects landed by 20260625122433_tenant_foundation.sql:
-- `public.set_updated_at()` (the updated_at trigger fn — NOT redefined here) and
-- the RLS helper `public.is_tenant_admin` (the own-tenant policy predicate).
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 3.3 Stop Conditions): company_settings
-- and quote_terms are the ONLY tables this migration creates. NO work_roles /
-- articles / tenant_counters (later Epic 3 stories), NO pricing table (Story 3.4),
-- NO supplier / credential / sync / import / external-mapping / API / Fortnox
-- field on ANY settings table.
--
-- ----------------------------------------------------------------------------
-- INTEGER-ÖRE / BASIS-POINTS MONEY DISCIPLINE (NFR9/AR13; architecture §10; epic-3
-- retro-note): this is the FIRST VAT-touching story, but it does NOT build a
-- VAT/ROT/grön-teknik CALCULATION engine (Epic 4 owns that). It STORES the VAT
-- defaults (display mode + `vat_rate_bp` in BASIS POINTS) as approved tenant-owned
-- settings for later snapshotting only. The VAT rate is `vat_rate_bp integer`
-- (basis points: 2500 = 25.00%, the legacy default; CHECK `>= 0 and <= 10000`) —
-- NEVER a float, NEVER a calc-code literal. No money field is required by this
-- story; if one were ever added it MUST be integer öre (`bigint`), never float.
--
-- ----------------------------------------------------------------------------
-- SIGN-OFF STOP-CONDITION (epic-3 retro-note HARD STOP-CONDITION; epics.md AC2):
-- customer-facing tax/legal/quote-terms wording must NEVER be silently or
-- automatically approved by the implementation. The schema represents approval
-- ONLY as a NULLABLE `approved_at timestamptz` (DEFAULT NULL = not-approved) +
-- `approved_by uuid` (who signed off). There is NO `approved`/`status`/`is_approved`
-- column that could default to a truthy/approved value — "not approved" is the
-- ABSENCE of a sign-off, so the schema CANNOT express a silent default-approved. A
-- fresh terms row is not-approved BY CONSTRUCTION; the ONLY path that sets
-- approved_at is the deliberate `approveQuoteTerms` command (a human action), and
-- editing the wording RESETS approved_at to NULL at the command layer (the old
-- approval no longer applies). Placeholder wording is acceptable for the pilot
-- (owner: "platshållartext räcker"); the final wording is an owner+legal sign-off
-- item (full release) — which is exactly why the not-approved-by-default mechanism
-- exists.
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (mirror the CRM table grants EXACTLY — Story 3.1 LOAD-BEARING):
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack,
-- and RLS only NARROWS an already-granted role. The tenant admin DOES create /
-- update settings rows via the app path, so grant deliberately:
--   * authenticated → SELECT, INSERT, UPDATE. The own-tenant SELECT/INSERT/UPDATE
--     policies narrow these to the caller's tenant. DELETE is NOT granted —
--     settings are updated/upserted, never hard-deleted.
--   * service_role  → full DML (SELECT/INSERT/UPDATE/DELETE). The TEST-ONLY
--     factory seed/cleanup path (BYPASSRLS); the cascade teardown also relies on
--     it. Never used from an app/client path.
--   * anon          → NOTHING. An unauthenticated caller can touch neither.
--
-- ----------------------------------------------------------------------------
-- RLS (architecture §6, §9): ENABLE + FORCE on both (FORCE so even the table owner
-- is subject to RLS; the factories use the BYPASSRLS service_role for setup).
-- Own-tenant policies are expressed via the EXISTING `is_tenant_admin` helper:
-- SELECT/INSERT/UPDATE only. NO delete policy (settings are never hard-deleted on
-- the app path). A cross-tenant write is denied by the WITH CHECK (`42501`
-- new-row-violates-RLS on INSERT); a cross-tenant read/update sees zero rows (RLS
-- USING invisibility), so the foreign row can never be read or mutated.
--
-- ----------------------------------------------------------------------------
-- SNAPSHOT SOURCE (architecture §11/§12; Story 3.5 + Epic 6): both tables are
-- MUTABLE SOURCES that Story 3.5's snapshot contract and Epic 6 quote versions will
-- FREEZE into immutable quote-version snapshots. The values are stored cleanly so a
-- later snapshot can capture {source id, value, timestamp}. The PDF reads ONLY the
-- frozen quote-version snapshot, never these mutable settings rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: company_settings (Företagsinställningar) — the tenant-owned quote
-- identity + VAT defaults root (architecture §7). ONE row per tenant.
-- ----------------------------------------------------------------------------
create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  -- Direct tenant ownership (architecture §6). Cascade so removing a tenant
  -- removes its settings row (no dangling tenant-orphaned data); the test cleanup
  -- relies on this cascade.
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Company identity for the quote PDF (architecture §11 snapshot source). Minimal,
  -- PDF-ready; `company_name` is the only required field at the command layer
  -- (owner: exact mandatory PDF-field set still pending — sensible defaults). NO
  -- supplier/credential/sync field; NO float money field.
  company_name text,
  org_nr text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  email text,
  phone text,
  logo_url text,
  -- The owner-approved DEFAULT VAT DISPLAY mode (architecture §10; owner decision
  -- 2026-06-18). The rule "private customers → always incl-VAT (not togglable);
  -- company customers → incl-VAT display togglable" is encoded as the tenant
  -- setting, NOT a code literal. The allowed values are enumerated by a CHECK so an
  -- unknown mode is rejected by the DB (the command validator catches it first).
  -- NO VAT CALCULATION engine is built here (Epic 4 owns that) — this STORES the
  -- default display assumption for later snapshotting.
  default_vat_display text not null default 'company_togglable',
  -- The configurable VAT RATE in BASIS POINTS (2500 = 25.00%, the legacy default —
  -- owner 2026-06-18). NEVER a float, NEVER a hardcoded VAT literal in calc/quote
  -- code. CHECK [0, 10000] (0%..100.00%). The authoritative rate is still gated on
  -- the Epic-4 working session; this stores the configurable setting defaulting to
  -- the legacy 25%.
  vat_rate_bp integer not null default 2500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ONE row per tenant — the upsert target is deterministic (`on conflict
  -- (tenant_id)`), so updateCompanySettings can never duplicate a tenant's settings.
  constraint company_settings_one_per_tenant unique (tenant_id),
  -- The owner-approved default-display modes. `company_togglable` (incl-VAT display
  -- togglable for company customers — the default) and `company_excl` (default to
  -- excl-VAT display for company customers) capture the company-side togglability;
  -- the private-customer rule (ALWAYS incl-VAT, not togglable) is an invariant the
  -- later VAT presentation honours regardless of this setting, so it is NOT an
  -- option here. Any other value is rejected by the DB.
  constraint company_settings_default_vat_display_valid check (
    default_vat_display in ('company_togglable', 'company_excl')
  ),
  -- BASIS POINTS integrity: a VAT rate is an integer in [0, 10000] (0%..100.00%).
  -- Belt-and-braces with the command validator; NEVER a float (the column type
  -- forbids fractional bp anyway).
  constraint company_settings_vat_rate_bp_range check (
    vat_rate_bp >= 0 and vat_rate_bp <= 10000
  )
);

comment on table public.company_settings is
  'Tenant-owned company settings (Företagsinställningar, architecture §7). ONE row per tenant (unique tenant_id). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — upsert over hard delete). Stores quote identity + branding for the PDF, the DEFAULT VAT DISPLAY mode (owner rule: private always incl-VAT not togglable / company togglable), and the configurable VAT rate vat_rate_bp in BASIS POINTS (2500 = 25.00%, legacy default; CHECK [0,10000]; never a float, never a calc literal). NO VAT/ROT calculation engine here (Epic 4). MUTABLE snapshot source for Story 3.5 / Epic 6. NO supplier/credential/sync/Fortnox field; NO float money field.';

-- ----------------------------------------------------------------------------
-- Table: quote_terms (Offertvillkor) — tenant-owned reusable quote terms with an
-- owner/legal SIGN-OFF (architecture §7). ONE active terms set per tenant.
-- ----------------------------------------------------------------------------
create table public.quote_terms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The customer-facing wording (placeholder text is acceptable for the pilot per
  -- owner: "platshållartext räcker"). NOT NULL + non-empty enforced at the command
  -- layer too. This is the MUTABLE snapshot source for the terms a quote version
  -- later freezes (architecture §11).
  terms_text text not null,
  -- SIGN-OFF columns. CRITICAL: there is NO `approved`/`status`/`is_approved`
  -- column that defaults to a truthy/approved value — "not approved" is represented
  -- by `approved_at IS NULL`, the ABSENCE of a sign-off, so the schema CANNOT
  -- express a silent default-approved. `approved_at` is NULLABLE with NO DEFAULT
  -- (DEFAULT NULL = not-approved). A fresh terms row is not-approved BY
  -- CONSTRUCTION; the ONLY path that sets approved_at is the deliberate
  -- approveQuoteTerms command; editing the wording RESETS it to NULL at the command
  -- layer (an edit invalidates a prior sign-off).
  approved_at timestamptz,
  -- Who signed off (the resolved acting admin). NULLABLE; ON DELETE SET NULL so
  -- removing the approving user detaches the attribution rather than the terms row.
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ONE active terms set per tenant (single-active-row shape — simplest, matches
  -- company_settings). A richer versioned/named-template model is a follow-up
  -- extension (Open Question 5) if the owner later needs it.
  constraint quote_terms_one_per_tenant unique (tenant_id)
);

comment on table public.quote_terms is
  'Tenant-owned reusable quote terms (Offertvillkor, architecture §7). ONE active set per tenant (unique tenant_id). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete). SIGN-OFF is a NULLABLE approved_at (DEFAULT NULL = not-approved) + approved_by — there is NO approved/status/is_approved column, so the schema CANNOT silently default to approved (epic-3 HARD STOP-CONDITION). A fresh/edited terms record is not-approved by construction; only the deliberate approveQuoteTerms command sets approved_at; editing the wording resets it to NULL (command layer). Placeholder wording acceptable for the pilot; final wording is an owner/legal full-release sign-off item. MUTABLE snapshot source for Story 3.5 / Epic 6.';

-- ----------------------------------------------------------------------------
-- updated_at triggers — REUSE the EXISTING public.set_updated_at() (landed by
-- 20260625122433_tenant_foundation.sql). Do NOT redefine the function.
-- ----------------------------------------------------------------------------
create trigger company_settings_set_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

create trigger quote_terms_set_updated_at
  before update on public.quote_terms
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes for the command/RLS access paths (architecture §22). The unique
-- constraint already provides a tenant_id index, but an explicit btree mirrors the
-- CRM index pattern and documents the access path.
-- ----------------------------------------------------------------------------
create index company_settings_tenant_id_idx
  on public.company_settings (tenant_id);
create index quote_terms_tenant_id_idx
  on public.quote_terms (tenant_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT, INSERT, UPDATE (the admin manages settings via the app
--                   path; DELETE withheld — upsert over hard delete).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.company_settings to authenticated;
grant select, insert, update on public.quote_terms to authenticated;
grant select, insert, update, delete on public.company_settings to service_role;
grant select, insert, update, delete on public.quote_terms to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on both (architecture §6, §9).
-- ----------------------------------------------------------------------------
alter table public.company_settings enable row level security;
alter table public.company_settings force row level security;
alter table public.quote_terms enable row level security;
alter table public.quote_terms force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT / INSERT / UPDATE via the EXISTING is_tenant_admin
-- helper. NO delete policy (upsert over hard delete). 6 new policies (3 per table).
--
-- SELECT  using  is_tenant_admin(tenant_id)  — read only own-tenant rows.
-- INSERT  with check is_tenant_admin(tenant_id) — a row carrying another tenant's
--         tenant_id fails the WITH CHECK (42501 new-row-violates-RLS).
-- UPDATE  using + with check is_tenant_admin(tenant_id) — a cross-tenant row is
--         invisible (USING) so it can't be selected for update; an attempt to move
--         a row to another tenant fails the WITH CHECK.
-- ----------------------------------------------------------------------------

-- company_settings
create policy company_settings_select_own
  on public.company_settings
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy company_settings_insert_own
  on public.company_settings
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy company_settings_update_own
  on public.company_settings
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- quote_terms
create policy quote_terms_select_own
  on public.quote_terms
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy quote_terms_insert_own
  on public.quote_terms
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy quote_terms_update_own
  on public.quote_terms
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (upsert-over-delete discipline):
--   * company_settings/quote_terms DELETE — no grant to authenticated AND no
--     delete policy → DENY-by-default. Settings are updated/upserted, never deleted.
