-- ============================================================================
-- Standalone job creation (owner decision 2026-07-14).
--
-- Relax the two IMMUTABLE source references on public.jobs from NOT NULL to
-- NULLABLE so a job can be created STANDALONE (directly from the /jobs list,
-- via the new `createJob` command) as well as by the 7.2 acceptance
-- transaction. NOTHING else changes:
--   - the composite same-tenant FKs (jobs_acceptance_same_tenant /
--     jobs_version_same_tenant) tolerate a NULL member by construction (a NULL
--     skips FK enforcement), so a POPULATED ref is still same-tenant-checked;
--   - `unique (quote_acceptance_id)` tolerates NULLs (one job per acceptance
--     still holds for acceptance-created jobs; standalone jobs never collide);
--   - the 7.4 `jobs_source_ref_lock` trigger is UNTOUCHED: a source ref stays
--     immutable ONCE SET. There is NO "connect a standalone job to a quote
--     later" mechanism — that is a future audited workflow.
-- ============================================================================

alter table public.jobs
  alter column quote_acceptance_id drop not null,
  alter column quote_version_id drop not null;

comment on column public.jobs.quote_acceptance_id is
  'IMMUTABLE-once-set source ref to the acceptance that created this job (composite same-tenant FK, ON DELETE RESTRICT; locked by jobs_source_ref_lock). NULLABLE since 2026-07-14 (owner decision — standalone job creation): a STANDALONE job created via the createJob command carries NULL source refs; there is NO connect-later mechanism — linking a standalone job to a quote is a future audited workflow.';

comment on column public.jobs.quote_version_id is
  'IMMUTABLE-once-set source ref to the accepted quote version (composite same-tenant FK, ON DELETE RESTRICT; locked by jobs_source_ref_lock). NULLABLE since 2026-07-14 (owner decision — standalone job creation): a STANDALONE job created via the createJob command carries NULL source refs; there is NO connect-later mechanism — linking a standalone job to a quote is a future audited workflow.';

comment on table public.jobs is
  'Tenant-owned minimal accepted-work record (architecture §7, §"Field Workflow" SEAM only). MANY rows per tenant. Populated by the 7.2 accept_quote_and_create_job RPC (source refs set) OR — since 2026-07-14 (owner decision) — by the createJob command as a STANDALONE job (source refs NULL). RLS-protected (own-tenant read/insert/update via is_tenant_admin; no delete — archive via archived_at). The source refs to quote_acceptances(id,tenant_id) + quote_versions(id,tenant_id) are NULLABLE but IMMUTABLE ONCE SET (composite same-tenant FKs ON DELETE RESTRICT; the 7.4 jobs_source_ref_lock trigger rejects any change to a set ref — there is NO connect-standalone-to-quote-later mechanism). Composite same-tenant FKs to customers(id,tenant_id) [required] + facilities/contacts(id,tenant_id) [optional]. status in (created|in_progress|done|cancelled) — a MINIMAL conservative order-lifecycle set, NOT field-worker states. unique (quote_acceptance_id) is the 7.2 one-job-per-acceptance backstop (NULLs exempt); unique (id, tenant_id) is the composite-FK target for job_events. NO cost/margin/invoice/Fortnox/time-material/deviation/ÄTA/schedule/analytics column (Story 7.1 Stop Condition).';
