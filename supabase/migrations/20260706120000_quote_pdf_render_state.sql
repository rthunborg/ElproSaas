-- ============================================================================
-- Story 6.3 — Quote PDF render-state column (ADDITIVE; architecture §12).
--
-- Adds the `pdf_status` render-state column to the (frozen 6.1) `quote_versions`
-- table. This is a NEW timestamp-prefixed migration file — a frozen prior
-- migration (20260705120000_quote_version_model.sql) is NEVER edited; the change
-- is purely ADDITIVE.
--
-- WHY A DISTINCT RENDER-STATE COLUMN (not just pdf_file_id presence):
-- `pdf_file_id IS NULL` reads IDENTICALLY for `not_generated`, `generating`, and
-- `failed` (all are file-absent). AC2's six visible states therefore REQUIRE a
-- distinct render-state column. The `not_generated`/`generating`/`generated`/
-- `failed` set is architecture §12 VERBATIM; `retry` and `preview`/`download` are
-- UI affordances DERIVED from `failed`/`generated`, NOT DB states.
--
-- SCOPE: this is the ONLY schema change in Story 6.3. It adds NO table (so the
-- tenant-owned set is unchanged and the H4 RLS-inventory gate is untouched — H4
-- covers tables, not columns) and NO policy. The new column INHERITS the existing
-- `quote_versions` RLS/GRANT posture (enable+force RLS + own-tenant is_tenant_admin
-- SELECT/INSERT/UPDATE policies + anon->none GRANTs from the 6.1 migration).
--
-- NO sent-immutability trigger here (Story 6.4). 6.3 UPDATEs the PDF-render columns
-- (pdf_status/pdf_file_id/pdf_generated_at) on a DRAFT or a SENT version (retry is
-- allowed for both — the PDF is DERIVED from the frozen snapshot, not customer-
-- visible commitment data). The 6.4 sent-lock trigger, when it lands, MUST EXEMPT
-- these PDF-render columns from the lock (recorded as a 6.4 obligation).
--
-- [Source: architecture.md#12 (render status: not_generated/generating/generated/
--  failed; retry for draft/sent without mutating snapshot); epics.md#Story 6.3 AC2;
--  supabase/migrations/20260705120000_quote_version_model.sql:235-261 (pdf_file_id/
--  pdf_generated_at + the composite same-tenant FK frozen for 6.3); project-context
--  #Architecture Rules (frozen migration never edited — additive only; migration-reset
--  exact-policy enumeration extended never loosened — adding a column changes no policy)]
-- ============================================================================

alter table public.quote_versions
  add column if not exists pdf_status text not null default 'not_generated'
    check (pdf_status in ('not_generated', 'generating', 'generated', 'failed'));

comment on column public.quote_versions.pdf_status is
  'Story 6.3 PDF render state (architecture §12): not_generated | generating | generated | failed. A distinct render-state column is REQUIRED because pdf_file_id presence alone cannot express generating vs failed (both file-absent). retry/preview/download are UI affordances derived from failed/generated, NOT DB states. Mutable on draft AND sent versions (retry regenerates a derived PDF, not commitment data); the Story 6.4 sent-lock trigger MUST exempt the PDF-render columns.';

-- ----------------------------------------------------------------------------
-- ADDITIVE widening of the quote_events.event_type closed set (architecture §7,
-- §12). AC3 requires the PDF pipeline to write a `quote_events` LIFECYCLE event on
-- generation. The 6.1 CHECK closed the set to the quote LIFECYCLE states
-- (created|draft|sent|accepted|rejected|expired|superseded); the DERIVED PDF-render
-- events (pdf_generated on success, pdf_failed on the failed→retryable transition)
-- must be added to the set so the event row can be written. This WIDENS the closed set
-- (never loosens it to free text) — the append-only event log stays a bounded vocabulary.
-- Drop the 6.1 auto-named inline CHECK and re-add a NAMED, widened one.
-- ----------------------------------------------------------------------------
alter table public.quote_events
  drop constraint if exists quote_events_event_type_check;

alter table public.quote_events
  add constraint quote_events_event_type_check
    check (
      event_type in (
        'created', 'draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded',
        'pdf_generated', 'pdf_failed'
      )
    );

comment on constraint quote_events_event_type_check on public.quote_events is
  'Story 6.3 — the quote_events closed event vocabulary, WIDENED (not loosened) from the 6.1 lifecycle set with the DERIVED PDF-render events pdf_generated (success) + pdf_failed (failed→retryable). The set stays bounded (append-only event log, never free text). NO email-send/portal/public-acceptance event.';
