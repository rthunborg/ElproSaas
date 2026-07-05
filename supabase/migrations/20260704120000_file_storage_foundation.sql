-- ============================================================================
-- Migration: file_storage_foundation
-- Story 8.1 — File Storage Foundation (private bucket, metadata, links, RLS, and
-- the signed-access authorization funnel).
--
-- The FIRST time Phase A crosses the OBJECT-STORAGE boundary. Every earlier epic
-- kept sensitive state in Postgres under the proven RLS harness; this migration
-- adds a SECOND storage plane (Supabase Storage) that `storage.objects` RLS +
-- server-derived object paths must isolate as strictly as the database.
--
-- It creates the SINGLE Phase-A file model (architecture §14, ADR-A006/A009):
--   * public.files      — tenant-owned base metadata (bucket/object path, display
--                         name, mime, size, checksum, uploader, lifecycle state);
--   * public.file_links — tenant-owned polymorphic entity-link table (owner_type/
--                         owner_id + purpose + lock fields), with a COMPOSITE
--                         same-tenant FK to files(id, tenant_id) (R-802 both-side);
--   * storage.objects   — own-tenant RLS policies scoped to the `tenant-files`
--                         bucket AND the first path segment cast to the tenant id;
--   * public.create_file_with_link(...) — a narrow SECURITY INVOKER RPC (ADR-A009)
--                         that inserts the `files` row AND the `file_links` row in
--                         ONE transaction (atomic — both persist or neither).
--
-- SERVER-DERIVED PATH CONVENTION (Task 1.3): the object path is ALWAYS
--   `{tenant_id}/{file_id}/{safe_display_name}`  (or `{tenant_id}/{file_id}`).
-- The FIRST path segment is ALWAYS the RESOLVED tenant_id. The path is NEVER built
-- from client input — the command layer derives it via
-- `src/server/storage/object-path.ts` from `ctx.tenantContext.tenantId` only, and
-- `storage.objects` RLS re-checks the first segment against the caller's tenant.
--
-- It REUSES the objects landed by 20260625122433_tenant_foundation.sql:
-- `public.set_updated_at()` (the updated_at trigger fn — NOT redefined here) and
-- the RLS helper `public.is_tenant_admin` (the own-tenant policy predicate). The
-- helper is SECURITY DEFINER with a fixed empty search_path, so it is safe to call
-- from a `storage.objects` policy (schema-qualified as `public.is_tenant_admin`).
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §14; Story 8.1 Stop Conditions):
-- `files` and `file_links` are the ONLY public tables this migration creates. NO
-- broad deferred-module file-index / document-center / documents table (AC1
-- guardrail — a construction test asserts their ABSENCE). NO upload MIME/size
-- validation gate (Story 8.2). NO lock-enforcement TRIGGER (Story 8.4 — the lock
-- FIELDS are persisted here, but nothing enforces them yet). NO quote PDF
-- generation (Story 6.3). The owner-type union INCLUDES the deferred
-- quote_version/quote_acceptance/job values (the closed Phase-A union), but link
-- creation for them is INACTIVE until Epics 6/7 add those owner tables — the
-- command layer rejects them as "not-yet-available".
--
-- ----------------------------------------------------------------------------
-- GRANT discipline (mirror the calc/CRM table grants EXACTLY — LOAD-BEARING):
-- New `public` tables are NOT auto-exposed to the Data API roles on this stack, and
-- RLS only NARROWS an already-granted role. The tenant admin DOES create / update /
-- archive file metadata + links via the app path, so grant deliberately:
--   * authenticated → SELECT, INSERT, UPDATE. The own-tenant SELECT/INSERT/UPDATE
--     policies narrow these to the caller's tenant. DELETE is NOT granted — a file
--     row is archived via an `archived_at`/lifecycle UPDATE, never hard-deleted.
--   * service_role  → full DML (SELECT/INSERT/UPDATE/DELETE). The TEST-ONLY factory
--     seed/cleanup path (BYPASSRLS); the cascade teardown also relies on it. Never
--     used from an app/client path.
--   * anon          → NOTHING. An unauthenticated caller can touch none of these.
--
-- ----------------------------------------------------------------------------
-- RLS (architecture §6, §9, §14): ENABLE + FORCE on both tables (FORCE so even the
-- table owner is subject to RLS; the factories use the BYPASSRLS service_role for
-- setup). Own-tenant policies are expressed via the EXISTING `is_tenant_admin`
-- helper: SELECT/INSERT/UPDATE only. NO delete policy (archive over hard delete).
--
-- INHERITED-AND-ACCEPTED PHASE-A RLS POSTURE (deferred-work 2-2/2-3, Story 2.4
-- owner): the own-tenant SELECT policy scopes reads by TENANT
-- (`is_tenant_admin(tenant_id)`), not by `user_id = auth.uid()`, so in a multi-admin
-- tenant co-admins read each other's file metadata/links within their OWN tenant
-- (never across a boundary) — the SAME accepted single-admin Phase-A design as the
-- calc/CRM/settings tables. Least-privilege tightening is the Story 2.4 / RBAC seam.
--
-- ----------------------------------------------------------------------------
-- ATOMIC METADATA+LINK WRITE (ADR-A009): the narrow `create_file_with_link` RPC at
-- the bottom owns the transaction boundary + full rollback for the combined
-- files+file_links write — NOT client-side multi-step persistence (R-807). It is
-- SECURITY INVOKER (ADR-A009 default) so it executes under the CALLER's RLS — the
-- INSERT stays tenant-scoped by the own-tenant WITH CHECK policies, no service-role
-- app path — with a fixed empty search_path + schema-qualified refs (defensive
-- hardening matching reorder_calculation_rows). A SECURITY DEFINER design would need
-- separate approval + membership checks + dedicated negative tests; INVOKER is
-- preferred and sufficient. NOTE: for THIS story the RPC is exercised via
-- createFileLink against a pre-seeded own-tenant file to prove atomicity + rollback;
-- the real upload path that ALSO writes the storage object is Story 8.2 (the RPC
-- signature is designed to support it, but 8.2 owns the storage-write + compensation).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Belt-and-braces bucket seed (Task 1.2): ensure the `tenant-files` bucket exists
-- and is PRIVATE on a fresh reset regardless of config.toml load order. `public =
-- false` is the AC4 contract asserted by the migration-reset construction test.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tenant-files', 'tenant-files', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Table: files — tenant-owned base file metadata (architecture §14). MANY rows per
-- tenant (a collection — NO unique tenant_id). The file OUTLIVES its uploader, so
-- `uploaded_by` mirrors the audit_events.actor_user_id nullable / ON DELETE SET NULL
-- pattern (removing the auth user detaches the uploader without deleting the file).
-- ----------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  -- Direct tenant ownership (architecture §6). Cascade so removing a tenant removes
  -- its file metadata (the storage-object retention/cleanup is a later story; the
  -- METADATA cascade keeps the DB plane consistent).
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The storage bucket + the SERVER-DERIVED object path (`{tenant_id}/{file_id}/...`,
  -- first segment = resolved tenant_id — NEVER client input). Defaults to the single
  -- private Phase-A bucket.
  bucket_id text not null default 'tenant-files',
  object_path text not null,
  -- The presentational file name shown in lists / entity panels. NOT NULL + non-empty
  -- at the command layer. The object-path SEGMENT derived from this is sanitized (no
  -- traversal) — the raw display_name is stored for presentation only.
  display_name text not null,
  -- Persisted upload METADATA (no upload validation GATE here — Story 8.2 owns MIME/
  -- size policy; these are metadata-only). mime_type/size_bytes/checksum are nullable
  -- so a metadata row can precede the byte-write (the upload path is 8.2).
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  -- Content hash when available (§14) — non-secret; used for future integrity checks.
  checksum text,
  -- The uploading auth user (nullable, ON DELETE SET NULL — the file outlives the
  -- uploader). Mirrors audit_events.actor_user_id.
  uploaded_by uuid references auth.users (id) on delete set null,
  -- Lifecycle state (the closed union architecture §14). draft = metadata created but
  -- not yet linked; linked = attached to an owner entity; locked = pinned (Story 8.4
  -- enforcement is deferred — this migration only PERSISTS the state); archived/deleted
  -- are the lifecycle-INELIGIBLE states the signing funnel rejects (AC5).
  lifecycle_state text not null default 'draft'
    check (lifecycle_state in ('draft', 'linked', 'locked', 'archived', 'deleted')),
  -- Soft-delete: NULL = active; a non-null timestamp = archived (archive over hard
  -- delete, architecture §6).
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The composite UNIQUE the file_links same-tenant FK references (R-802): a link can
  -- only point at a file IN THE SAME tenant.
  constraint files_id_tenant_unique unique (id, tenant_id),
  -- One storage object maps to exactly one metadata row.
  constraint files_bucket_object_unique unique (bucket_id, object_path)
);

comment on table public.files is
  'Tenant-owned base file metadata (architecture §14, ADR-A006). MANY rows per tenant (a collection — NO unique tenant_id). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via archived_at / lifecycle_state). object_path is SERVER-DERIVED `{tenant_id}/{file_id}/{safe_name}` (first segment = resolved tenant_id, never client input); bucket_id defaults to the single private `tenant-files` bucket. lifecycle_state in (draft|linked|locked|archived|deleted); the signing funnel rejects archived/deleted (AC5). uploaded_by is ON DELETE SET NULL (the file outlives the uploader, mirroring audit_events.actor_user_id). unique (id, tenant_id) is the composite-FK target for file_links (R-802); unique (bucket_id, object_path) maps one object to one metadata row. The SINGLE Phase A file model — Epic 6 (attachment metadata / PDF storage) REUSES this table, no competing model (R-814). NO upload MIME/size gate (Story 8.2). NO deferred-module column.';

-- ----------------------------------------------------------------------------
-- Table: file_links — tenant-owned polymorphic entity link (architecture §14).
-- owner_type is the closed Phase-A union (customer/facility/contact/calculation +
-- the deferred quote_version/quote_acceptance/job — the latter three INACTIVE at the
-- command layer until Epics 6/7). owner-record ownership is validated at the COMMAND
-- layer (the polymorphic owner_id has no single DB FK target).
-- ----------------------------------------------------------------------------
create table public.file_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- The linked file. NOT NULL — a link always references a file. Enforced same-tenant
  -- by the composite FK below (a bare references files(id) would be an R-802 hole).
  file_id uuid not null,
  -- The Phase A closed owner-type union (tech note). The deferred
  -- quote_version/quote_acceptance/job values are STRUCTURALLY valid but link creation
  -- for them is INACTIVE until those owner tables exist (Epics 6/7) — the command
  -- rejects them as "not-yet-available". NO deferred-module (supplier/asset/rental/hr/
  -- tender/fku) owner type — that is a STOP condition.
  owner_type text not null
    check (
      owner_type in (
        'customer', 'facility', 'contact', 'calculation',
        'quote_version', 'quote_acceptance', 'job'
      )
    ),
  -- The owner row id. POLYMORPHIC — there is NO DB FK on (owner_id, tenant_id) because
  -- owner_type varies; owner-record ownership is validated at the COMMAND layer via an
  -- own-tenant RLS SELECT on the resolved owner table (Task 5.3, R-802 both-side).
  owner_id uuid not null,
  -- The link purpose (§14 closed union). Drives how the file surfaces per entity.
  purpose text not null
    check (
      purpose in (
        'calculation_attachment', 'quote_attachment_snapshot', 'quote_pdf',
        'acceptance_evidence', 'job_evidence', 'crm_document'
      )
    ),
  -- Lock fields (persisted here; the lock-ENFORCEMENT trigger is Story 8.4, NOT here —
  -- this migration only PERSISTS the fields). is_locked defaults false.
  is_locked boolean not null default false,
  locked_at timestamptz,
  -- Soft-delete: NULL = active.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- COMPOSITE same-tenant FK to the parent file (architecture §6, R-802): the link's
  -- (file_id, tenant_id) must match an EXISTING files (id, tenant_id), so a link can
  -- only point at a same-tenant file. A bare `references files(id)` would let a Tenant A
  -- link point at a Tenant B file — the R-802 cross-tenant hole. Cascade so removing a
  -- file removes its links.
  constraint file_links_file_same_tenant
    foreign key (file_id, tenant_id)
    references public.files (id, tenant_id)
    on delete cascade
);

comment on table public.file_links is
  'Tenant-owned polymorphic entity link (architecture §14). Many-per-tenant. RLS-protected (own-tenant; archive via archived_at, no delete policy). COMPOSITE same-tenant FK file_links(file_id,tenant_id) -> files(id,tenant_id) so a link can only reference a same-tenant file (R-802 — a bare references files(id) would be a cross-tenant hole). owner_type is the Phase A closed union (customer|facility|contact|calculation|quote_version|quote_acceptance|job); the deferred quote_version/quote_acceptance/job values are structurally valid but link creation for them is INACTIVE until Epics 6/7 add the owner tables (command-layer "not-yet-available" rejection). owner_id is polymorphic — NO DB FK; owner-record ownership is validated at the COMMAND layer via an own-tenant RLS SELECT (R-802 both-side). purpose in (calculation_attachment|quote_attachment_snapshot|quote_pdf|acceptance_evidence|job_evidence|crm_document). Lock fields is_locked/locked_at are PERSISTED here; the lock-enforcement trigger is Story 8.4. NO deferred-module owner type.';

-- ----------------------------------------------------------------------------
-- updated_at triggers — REUSE the EXISTING public.set_updated_at() (landed by
-- 20260625122433_tenant_foundation.sql). Do NOT redefine the function.
-- ----------------------------------------------------------------------------
create trigger files_set_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

create trigger file_links_set_updated_at
  before update on public.file_links
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Indexes for the command/RLS access paths (architecture §22; mirror the calc index
-- pattern). files by tenant; file_links by (tenant, owner) for per-entity reads and by
-- (tenant, file) for per-file reads.
-- ----------------------------------------------------------------------------
create index files_tenant_id_idx
  on public.files (tenant_id);
create index file_links_tenant_owner_idx
  on public.file_links (tenant_id, owner_type, owner_id);
create index file_links_tenant_file_idx
  on public.file_links (tenant_id, file_id);

-- ----------------------------------------------------------------------------
-- Base table privileges (GRANTs) — see the GRANT discipline note in the header.
--   authenticated → SELECT, INSERT, UPDATE (the admin manages files via the app
--                   path; DELETE withheld — archive via archived_at / lifecycle).
--   service_role  → full DML (TEST-ONLY factory seed/cleanup; BYPASSRLS).
--   anon          → NOTHING.
-- ----------------------------------------------------------------------------
grant select, insert, update on public.files to authenticated;
grant select, insert, update on public.file_links to authenticated;
grant select, insert, update, delete on public.files to service_role;
grant select, insert, update, delete on public.file_links to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security: ENABLE + FORCE on both (architecture §6, §9).
-- ----------------------------------------------------------------------------
alter table public.files enable row level security;
alter table public.files force row level security;
alter table public.file_links enable row level security;
alter table public.file_links force row level security;

-- ----------------------------------------------------------------------------
-- Policies: own-tenant SELECT / INSERT / UPDATE via the EXISTING is_tenant_admin
-- helper. NO delete policy (archive over hard delete). 6 new policies (3 per table).
-- ----------------------------------------------------------------------------

-- files
create policy files_select_own
  on public.files
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy files_insert_own
  on public.files
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy files_update_own
  on public.files
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- file_links
create policy file_links_select_own
  on public.file_links
  for select
  to authenticated
  using (public.is_tenant_admin(tenant_id));

create policy file_links_insert_own
  on public.file_links
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id));

create policy file_links_update_own
  on public.file_links
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

-- INTENTIONALLY NOT EXPOSED to the app path (archive-over-delete discipline):
--   * files/file_links DELETE — no grant to authenticated AND no delete policy →
--     DENY-by-default. Archival is an UPDATE of archived_at / lifecycle_state.

-- ----------------------------------------------------------------------------
-- storage.objects RLS — tenant path prefix (AC4, AC6, R-805). The metadata-
-- INDEPENDENT storage-plane isolation. Own-tenant policies scoped to the
-- `tenant-files` bucket AND the FIRST path segment cast to the tenant id:
--   bucket_id = 'tenant-files'
--   and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
-- A malformed (non-uuid) first segment fails the ::uuid cast → denied. A cross-tenant
-- first segment fails is_tenant_admin → denied. SELECT + INSERT (with check) + UPDATE
-- only; NO delete policy (archive over hard delete; a locked-file retention/delete
-- workflow is Story 8.4). anon gets NO storage policy → an anonymous storage
-- list/read/sign is denied.
--
-- `is_tenant_admin` is SECURITY DEFINER with a fixed empty search_path (existing
-- helper), so it is safe to call from a storage.objects policy; schema-qualified as
-- public.is_tenant_admin so the storage-schema policy context resolves it.
--
-- The predicate is wrapped so a first segment that is not a valid uuid does not raise
-- (a raising USING/WITH CHECK still denies, but a clean boolean-false is tidier): a
-- uuid-shape regex match (`(storage.foldername(name))[1] ~ '<uuid-regex>'`) SHORT-CIRCUITS
-- the `::uuid` cast — only a well-formed uuid segment reaches the cast + is_tenant_admin.
-- An absent/NULL first subscript (no folder) `~ regex` yields NULL → the AND is NULL/false
-- → the row is denied. There is NO explicit array_length() expression; the regex guard is
-- the whole mechanism (a NULL subscript matches nothing, a malformed segment fails the
-- shape check, both deny before the cast is ever attempted).
-- ----------------------------------------------------------------------------
create policy tenant_files_objects_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );

create policy tenant_files_objects_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );

create policy tenant_files_objects_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'tenant-files'
    and (storage.foldername(name))[1] ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_tenant_admin(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- Narrow atomic metadata+link RPC (ADR-A009) (AC7). Inserts the `files` row AND the
-- `file_links` row in ONE transaction (the function body is an implicit txn) so
-- either BOTH persist or NEITHER — a mid-flow failure (FK/RLS/CHECK violation) rolls
-- the whole write back, leaving no half-written `files` row without its link and no
-- orphaned metadata (R-807).
--
-- SECURITY INVOKER (ADR-A009 default): runs under the CALLER's RLS — the INSERTs are
-- narrowed to the caller's own tenant by the own-tenant WITH CHECK policies (a row
-- carrying another tenant's tenant_id fails 42501), no service-role app path. A fixed
-- empty search_path + schema-qualified refs are defensive hardening (matching
-- reorder_calculation_rows).
--
-- The command (Task 5.3) passes the RESOLVED tenant id explicitly (RLS still narrows
-- the INSERT WITH CHECK to the caller). The path is SERVER-DERIVED by the caller; the
-- RPC stores it verbatim. Returns the new file id + link id.
-- ----------------------------------------------------------------------------
create or replace function public.create_file_with_link(
  p_tenant_id uuid,
  p_bucket_id text,
  p_object_path text,
  p_display_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum text,
  p_uploaded_by uuid,
  p_lifecycle_state text,
  p_owner_type text,
  p_owner_id uuid,
  p_purpose text
)
returns table (file_id uuid, link_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_file_id uuid;
  v_link_id uuid;
begin
  -- INSERT the files row FIRST. RLS narrows the WITH CHECK to the caller's own tenant
  -- (a cross-tenant p_tenant_id fails 42501 here → the whole function aborts, nothing
  -- persists). lifecycle defaults to 'linked' when not supplied (a file created WITH a
  -- link is linked by construction).
  insert into public.files (
    tenant_id, bucket_id, object_path, display_name, mime_type,
    size_bytes, checksum, uploaded_by, lifecycle_state
  )
  values (
    p_tenant_id,
    coalesce(p_bucket_id, 'tenant-files'),
    p_object_path,
    p_display_name,
    p_mime_type,
    p_size_bytes,
    p_checksum,
    p_uploaded_by,
    coalesce(p_lifecycle_state, 'linked')
  )
  returning id into v_file_id;

  -- INSERT the file_links row in the SAME transaction. The composite same-tenant FK
  -- (file_id, tenant_id) -> files(id, tenant_id) binds it to the file just written;
  -- the owner-record ownership is validated at the COMMAND layer BEFORE this call, so
  -- the RPC does not re-resolve the owner table. A CHECK/FK/RLS violation here raises
  -- and rolls back the files insert above too (R-807 atomicity).
  insert into public.file_links (
    tenant_id, file_id, owner_type, owner_id, purpose
  )
  values (
    p_tenant_id, v_file_id, p_owner_type, p_owner_id, p_purpose
  )
  returning id into v_link_id;

  return query select v_file_id, v_link_id;
end;
$$;

comment on function public.create_file_with_link(
  uuid, text, text, text, text, bigint, text, uuid, text, text, uuid, text
) is
  'Narrow atomic metadata+link creation RPC (architecture ADR-A009, Story 8.1). Inserts the files row AND the file_links row in ONE DB-side transaction (fully commits or fully rolls back — R-807): a mid-flow FK/RLS/CHECK violation on the link insert rolls back the file insert too, leaving no half-written files orphan and no dangling metadata. SECURITY INVOKER (runs under the caller''s RLS — own-tenant only, the INSERT WITH CHECK rejects a cross-tenant tenant_id with 42501; no service-role app path) with a fixed empty search_path + schema-qualified refs. The Next.js server command handles auth/session/membership/validation + the R-802 both-side ownership check (file AND owner record), then calls this; the RPC owns the transaction boundary + rollback. The object_path is SERVER-DERIVED by the caller; the RPC stores it verbatim. Designed to also support the real upload path (Story 8.2 adds the storage-object write + compensation) without a signature change.';

-- Function privileges: revoke the implicit PUBLIC EXECUTE, then grant ONLY to the
-- app-runtime + test roles. anon must NOT be able to execute.
revoke execute on function public.create_file_with_link(
  uuid, text, text, text, text, bigint, text, uuid, text, text, uuid, text
) from public;
grant execute on function public.create_file_with_link(
  uuid, text, text, text, text, bigint, text, uuid, text, text, uuid, text
) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Narrow LINK-EXISTING-FILE RPC (Story 8.1, Task 5.3 — review fix). `createFileLink`
-- must attach an ALREADY-VERIFIED, ALREADY-STORED file to an owner entity — it does
-- NOT mint a new files row (the real upload+object-write path is Story 8.2). This RPC
-- inserts EXACTLY ONE `file_links` row that references the EXISTING file directly
-- (p_file_id), so the link points at the real file — no phantom `files` row, no
-- `deriveObjectPath`-bypassing synthetic path.
--
-- The single INSERT is atomic by construction. The COMPOSITE same-tenant FK
-- (file_id, tenant_id) -> files(id, tenant_id) still binds the link to a same-tenant
-- file: a cross-tenant p_file_id (or a p_tenant_id the caller does not admin) fails
-- the FK (23503) or the own-tenant WITH CHECK (42501), and nothing persists. The
-- command layer performs the R-802 both-side ownership check (file AND owner record)
-- BEFORE calling this; the RPC re-enforces the same-tenant file binding at the DB.
--
-- SECURITY INVOKER (ADR-A009 default): runs under the CALLER's RLS (own-tenant only,
-- no service-role app path) with a fixed empty search_path + schema-qualified refs.
-- ----------------------------------------------------------------------------
create or replace function public.link_existing_file(
  p_tenant_id uuid,
  p_file_id uuid,
  p_owner_type text,
  p_owner_id uuid,
  p_purpose text
)
returns table (file_id uuid, link_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_file_id uuid := p_file_id;
  v_link_id uuid;
begin
  -- Insert the file_links row referencing the EXISTING, already-verified file. The
  -- own-tenant WITH CHECK narrows tenant_id to the caller (a cross-tenant p_tenant_id
  -- fails 42501); the composite same-tenant FK (file_id, tenant_id) rejects a file that
  -- is not in the caller's tenant (23503). No new files row is written.
  insert into public.file_links (
    tenant_id, file_id, owner_type, owner_id, purpose
  )
  values (
    p_tenant_id, p_file_id, p_owner_type, p_owner_id, p_purpose
  )
  returning id into v_link_id;

  return query select v_file_id, v_link_id;
end;
$$;

comment on function public.link_existing_file(uuid, uuid, text, uuid, text) is
  'Narrow link-existing-file RPC (Story 8.1, Task 5.3). Inserts EXACTLY ONE file_links row referencing an ALREADY-VERIFIED, ALREADY-STORED file (p_file_id) — the link points at the REAL file, no phantom files row (the upload+object-write path is Story 8.2). Atomic by construction (single insert). The composite same-tenant FK (file_id, tenant_id) -> files(id, tenant_id) rejects a cross-tenant file (23503) and the own-tenant WITH CHECK rejects a forged tenant_id (42501). SECURITY INVOKER (caller RLS, own-tenant only, no service-role app path) with a fixed empty search_path + schema-qualified refs. The command layer does the R-802 both-side ownership check (file AND owner record) before calling this.';

revoke execute on function public.link_existing_file(
  uuid, uuid, text, uuid, text
) from public;
grant execute on function public.link_existing_file(
  uuid, uuid, text, uuid, text
) to authenticated, service_role;
