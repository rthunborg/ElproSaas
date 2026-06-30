-- ============================================================================
-- Migration: crm_data_model
-- Story 3.1 — Tenant-Owned CRM Data Model And Commands.
--
-- The THIRD migration in the project and the FIRST to add tenant-owned BUSINESS
-- tables. Creates the three Phase-A CRM root entities (architecture §7 v0 IN
-- list) — `customers` (Kund), `facilities` (Anläggning), `contacts` (Kontakt) —
-- each carrying a DIRECT `tenant_id` (architecture §6 convention), a soft-delete
-- `archived_at` column (archive over hard delete), `created_at`/`updated_at`
-- timestamps with the EXISTING `public.set_updated_at()` BEFORE UPDATE trigger,
-- and the COMPOSITE same-tenant parent constraints (architecture §6 — a child
-- duplicates `tenant_id` and references its parent on BOTH (id, tenant_id) so a
-- facility/contact can only point at a parent IN THE SAME tenant; a bare
-- `references customers(id)` would let a child point at another tenant's parent).
--
-- It REUSES the objects landed by 20260625122433_tenant_foundation.sql:
-- `public.set_updated_at()` (the updated_at trigger fn — NOT redefined here) and
-- the RLS helpers `public.is_tenant_admin` / `public.is_active_tenant_member`
-- (the own-tenant policy predicates).
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 3.1 Stop Conditions): customers/
-- facilities/contacts are the ONLY tables this migration creates. NO
-- company_settings / quote_terms / work_roles / articles / tenant_counters (later
-- Epic 3 stories), NO deferred-module table, and CRITICALLY no supplier /
-- credential / sync / import / external-mapping / API / Fortnox field on ANY CRM
-- table (a Stop Condition — article/supplier scope is Story 3.4, and even there NO
-- supplier fields). No money field is required by this story; if one were ever
-- added it MUST be integer öre (`bigint`), never floating kronor (NFR9/AR13).
--
-- ----------------------------------------------------------------------------
-- PERSONNUMMER (owner decision 2026-06-18 — REVERSES the "no personnummer"
-- default): architecture §7/§10, AR16, NFR16 and epics.md AC1 say "no
-- personnummer by default". The owner's 2026-06-18 sign-off SUPERSEDES that for
-- `private` customers only (needed for ROT downstream). So `customers` carries a
-- SINGLE nullable `personnummer` column, exclusively for `private` customers; it
-- appears on NO other CRM table. It is tenant-owned + RLS-protected (own-tenant
-- read like every other CRM column), never routed into audit metadata (the
-- SAFE_FIELDS allow-list drops it), and not surfaced in any default list
-- projection (a command/UI concern — Story 3.2). Full GDPR/retention treatment is
-- deferred to full release (internal pilot — owner decision). `org_nr` is the
-- identifier for `company`/`brf`/`public`.
--
-- ----------------------------------------------------------------------------
-- IDENTIFIER-BY-TYPE SPLIT (Task 1.5): a table CHECK ties the identifier to the
-- type WITHOUT forcing presence here — `personnummer` may only be present on a
-- `private` customer; `org_nr` may only be present on a non-`private` customer.
-- REQUIREDNESS (a private customer MUST have a personnummer; a non-private MUST
-- have an org_nr) is a CONFIGURABLE business rule enforced at the COMMAND
-- validation layer (src/server/commands/crm/customers.ts), per owner intent —
-- NOT a NOT NULL here, so the rule can evolve without a migration.
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (inherited Story 2.2/2.3 gotcha — LOAD-BEARING):
-- ----------------------------------------------------------------------------
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack,
-- and RLS only NARROWS an already-granted role. UNLIKE tenant_memberships
-- (admin-only SELECT) and audit_events (append-only), the tenant admin DOES
-- create / update / archive CRM rows via the app path, so grant deliberately:
--   * authenticated → SELECT, INSERT, UPDATE. The own-tenant SELECT/INSERT/UPDATE
--     policies narrow these to the caller's tenant. DELETE is NOT granted —
--     archive is an UPDATE of `archived_at` (soft-delete over hard delete).
--   * service_role  → full DML (SELECT/INSERT/UPDATE/DELETE). The TEST-ONLY
--     factory seed/cleanup path (BYPASSRLS); the cascade teardown also relies on
--     it. Never used from an app/client path.
--   * anon          → NOTHING. An unauthenticated caller can touch none of these.
--
-- ----------------------------------------------------------------------------
-- RLS (architecture §6, §9): ENABLE + FORCE on all three (FORCE so even the table
-- owner is subject to RLS; the factories use the BYPASSRLS service_role for
-- setup). Own-tenant policies are expressed via the EXISTING `is_tenant_admin`
-- helper: SELECT/INSERT/UPDATE only. NO delete policy (archive-only via UPDATE).
-- A cross-tenant write is denied by the WITH CHECK (`42501` new-row-violates-RLS
-- on INSERT); a cross-tenant read/update sees zero rows (RLS USING invisibility),
-- so the foreign row can never be read or mutated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: customers (Kund) — the tenant-owned customer root (architecture §7).
-- ----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  -- Direct tenant ownership (architecture §6). Cascade so removing a tenant
  -- removes its CRM rows (no dangling tenant-orphaned data); the test cleanup
  -- relies on this cascade reaching customers/facilities/contacts.
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The four owner-approved customer types (owner decision 2026-06-18). Any other
  -- value is rejected by the DB (AC2). No fifth type without owner sign-off.
  customer_type text not null
    check (customer_type in ('private', 'company', 'brf', 'public')),
  -- The presentational customer name used on quotes/lists (architecture §11
  -- snapshot source). NOT NULL + non-empty enforced at the command layer too.
  display_name text not null,
  -- IDENTIFIER BY TYPE (see header). Both NULLABLE here; requiredness is a
  -- command-layer rule. The CHECK below ties each to its type.
  --   * personnummer — ONLY for `private` customers (owner 2026-06-18, ROT). The
  --     single, access-controlled private-data field; tenant-owned + RLS-protected
  --     + never in audit metadata + not in default list projections.
  personnummer text,
  --   * org_nr — for `company`/`brf`/`public`.
  org_nr text,
  -- Minimal contact/address fields a quote PDF needs (architecture §11). NO
  -- personnummer beyond the one field above; NO supplier/credential/sync field.
  contact_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  -- Soft-delete: NULL = active; a non-null timestamp = archived (archive over
  -- hard delete, architecture §6). Set via the archive command's UPDATE.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- IDENTIFIER-BY-TYPE integrity (Task 1.5): a `private` customer never carries an
  -- org_nr; a non-`private` customer never carries a personnummer. Requiredness
  -- (private ⇒ personnummer present; non-private ⇒ org_nr present) is enforced at
  -- the command validation layer (configurable business rule — owner intent).
  constraint customers_identifier_by_type check (
    (customer_type = 'private' and org_nr is null)
    or (customer_type <> 'private' and personnummer is null)
  ),
  -- The composite UNIQUE the child same-tenant FKs reference (facilities/contacts
  -- point at customers(id, tenant_id) so the child's tenant must equal the
  -- parent's tenant — architecture §6 composite same-tenant constraint).
  constraint customers_id_tenant_unique unique (id, tenant_id)
);

comment on table public.customers is
  'Tenant-owned customer root (Kund, architecture §7). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via archived_at). customer_type in (private|company|brf|public). Identifier by type: personnummer ONLY for private (owner 2026-06-18, ROT — access-controlled, never in audit metadata, not in default list projections), org_nr for the others; requiredness is enforced at the command layer. NO supplier/credential/sync/import/external/Fortnox field (Story 3.1 Stop Condition).';

-- ----------------------------------------------------------------------------
-- Table: facilities (Anläggning) — many-per-customer, optional on a customer.
-- ----------------------------------------------------------------------------
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent customer. A customer may have ZERO facilities (optional) and MANY
  -- (owner 2026-06-18). NOT NULL — a facility always belongs to a customer.
  customer_id uuid not null,
  name text not null,
  -- Address fields a quote/work-order needs (no supplier/credential field).
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK (architecture §6): the facility's (customer_id,
  -- tenant_id) must match an EXISTING customers (id, tenant_id) — so a facility
  -- can only reference a customer IN THE SAME tenant. A bare
  -- `references customers(id)` would let a Tenant A facility point at a Tenant B
  -- customer; this composite constraint makes that a DB-level rejection. Cascade
  -- so archiving/removing a customer's tenant removes its facilities.
  constraint facilities_customer_same_tenant
    foreign key (customer_id, tenant_id)
    references public.customers (id, tenant_id)
    on delete cascade,
  -- The composite UNIQUE the contacts.facility_id same-tenant FK references.
  constraint facilities_id_tenant_unique unique (id, tenant_id)
);

comment on table public.facilities is
  'Tenant-owned facility (Anläggning, architecture §7). Many-per-customer, optional. RLS-protected (own-tenant; archive via archived_at, no delete policy). Composite same-tenant FK facilities(customer_id, tenant_id) -> customers(id, tenant_id) so a facility can only reference a same-tenant customer (architecture §6). NO supplier/credential/sync field.';

-- ----------------------------------------------------------------------------
-- Table: contacts (Kontakt) — at customer level, optionally tied to a facility.
-- Multiple per customer/facility; NO enforced "exactly one primary" (owner).
-- ----------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The parent customer (always present — a contact belongs to a customer).
  customer_id uuid not null,
  -- OPTIONAL facility link (a contact may be tied to a specific facility).
  facility_id uuid,
  name text not null,
  email text,
  phone text,
  -- e.g. 'arbetsledare' / 'projektledare' — a free-text role label, NOT an RBAC
  -- role (Phase A has no contact-level RBAC).
  role_label text,
  -- OPTIONAL convenience flag. NEVER enforced as "exactly one primary" (owner
  -- 2026-06-18 — no enforced primary contact). No partial-unique constraint.
  is_primary boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent customer (architecture §6) — same
  -- rationale as facilities: a contact can only reference a same-tenant customer.
  constraint contacts_customer_same_tenant
    foreign key (customer_id, tenant_id)
    references public.customers (id, tenant_id)
    on delete cascade,
  -- OPTIONAL composite same-tenant FK to a facility. NULLABLE (facility_id may be
  -- null). When present, (facility_id, tenant_id) must match a same-tenant
  -- facility — so a cross-tenant facility link is a DB-level rejection. ON DELETE
  -- SET NULL so removing a facility detaches its contacts (the contact survives at
  -- the customer level) rather than deleting the contact.
  constraint contacts_facility_same_tenant
    foreign key (facility_id, tenant_id)
    references public.facilities (id, tenant_id)
    on delete set null
);

comment on table public.contacts is
  'Tenant-owned contact (Kontakt, architecture §7). At customer level, optionally tied to a facility; multiple per customer/facility, NO enforced primary (owner 2026-06-18). RLS-protected (own-tenant; archive via archived_at, no delete policy). Composite same-tenant FKs to customers(id, tenant_id) and (optional) facilities(id, tenant_id) so a contact can only reference same-tenant parents (architecture §6). NO supplier/credential/sync field; NO personnummer (that lives ONLY on customers).';

-- ----------------------------------------------------------------------------
-- updated_at triggers — REUSE the EXISTING public.set_updated_at() (landed by
-- 20260625122433_tenant_foundation.sql). Do NOT redefine the function.
-- ----------------------------------------------------------------------------
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger facilities_set_updated_at
  before update on public.facilities
  for each row execute function public.set_updated_at();

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes for the command/RLS access paths (architecture §22; mirror the
-- tenant_foundation index pattern).
-- ----------------------------------------------------------------------------
create index customers_tenant_id_idx
  on public.customers (tenant_id);
create index facilities_tenant_customer_idx
  on public.facilities (tenant_id, customer_id);
create index contacts_tenant_customer_idx
  on public.contacts (tenant_id, customer_id);
create index contacts_facility_id_idx
  on public.contacts (facility_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT, INSERT, UPDATE (the admin manages CRM via the app
--                   path; DELETE withheld — archive via archived_at UPDATE).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.facilities to authenticated;
grant select, insert, update on public.contacts to authenticated;
grant select, insert, update, delete on public.customers to service_role;
grant select, insert, update, delete on public.facilities to service_role;
grant select, insert, update, delete on public.contacts to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on all three (architecture §6, §9).
-- ----------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.customers force row level security;
alter table public.facilities enable row level security;
alter table public.facilities force row level security;
alter table public.contacts enable row level security;
alter table public.contacts force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT / INSERT / UPDATE via the EXISTING is_tenant_admin
-- helper. NO delete policy (archive-only via UPDATE of archived_at).
--
-- SELECT  using  is_tenant_admin(tenant_id)  — read only own-tenant rows.
-- INSERT  with check is_tenant_admin(tenant_id) — a row carrying another tenant's
--         tenant_id fails the WITH CHECK (42501 new-row-violates-RLS).
-- UPDATE  using + with check is_tenant_admin(tenant_id) — a cross-tenant row is
--         invisible (USING) so it can't be selected for update; an attempt to
--         move a row to another tenant fails the WITH CHECK.
-- ----------------------------------------------------------------------------

-- customers
create policy customers_select_own
  on public.customers
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy customers_insert_own
  on public.customers
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy customers_update_own
  on public.customers
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- facilities
create policy facilities_select_own
  on public.facilities
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy facilities_insert_own
  on public.facilities
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy facilities_update_own
  on public.facilities
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- contacts
create policy contacts_select_own
  on public.contacts
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy contacts_insert_own
  on public.contacts
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy contacts_update_own
  on public.contacts
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (archive-over-delete discipline):
--   * customers/facilities/contacts DELETE — no grant to authenticated AND no
--     delete policy → DENY-by-default. Archival is an UPDATE of archived_at.
