-- ============================================================================
-- Migration: accept_quote_and_create_job
-- Story 7.2 — Idempotent Accept Quote And Create Job Command.
--
-- The narrow atomic `accept_quote_and_create_job` RPC (ADR-A009) — the idempotent,
-- transactional multi-record write that turns a SENT quote version into an accepted
-- customer commitment and a basic job/order in ONE transaction. Architecture §13's
-- highest-risk Phase A command.
--
-- Purely ADDITIVE to the (frozen) 7.1 acceptance/jobs/job_events model
-- (20260709120000) + the 6.4 sent-lock triggers (20260707120000) — a frozen prior
-- migration is NEVER edited; every change here is additive (ONE SECURITY INVOKER RPC
-- on the EXISTING tables; NO new TABLE → the tenant-owned set is UNCHANGED, the H4
-- RLS-inventory gate is UNTOUCHED [H4 covers TABLES, not functions], and the 7.1
-- RLS/GRANT posture is inherited verbatim). It MIRRORS the shape of
-- mark_quote_version_sent (20260707120000 §4 — lock + re-assert status + flip status
-- + append event, SECURITY INVOKER, empty search_path, schema-qualified, QV409
-- SQLSTATE, revoke-from-public + grant-to-authenticated,service_role) FUSED with
-- create_new_quote_version (20260708120000 — multi-insert + parent-quote row lock +
-- find-or-create file_links idempotent guard).
--
-- In ONE transaction (architecture §13 steps 1-10) it:
--   (1/2/3) row-locks the target quote_versions row FOR UPDATE (own-tenant RLS
--       narrows it; a foreign id → 0 rows → RAISE QV409 → the command already denied
--       it before execute — reaching 0 rows here is a race, fail closed), reads
--       status/quote_id off it, then row-locks the PARENT quotes row FOR UPDATE
--       (serializes concurrent accepts on the same quote — architecture §13 step 2) and
--       reads customer/facility/contact off the QUOTE (the version snapshot holds only
--       display names; the IDS live on the parent quote), and RE-ASSERTS status = 'sent'
--       (a non-sent version RAISES QV409 — a race-safe re-check below the command);
--   (4 — THE HEADLINE) idempotent existing-record return: BEFORE inserting, selects
--       any existing quote_acceptances row for the version (the unique (quote_version_id)
--       backstop guarantees at most one). If found, selects its existing jobs row (the
--       unique (quote_acceptance_id) backstop guarantees at most one) and RETURNS the
--       existing (acceptance_id, job_id) pair with `was_existing = true` and NO insert
--       or lifecycle write — the idempotent short-circuit. The FOR UPDATE lock on the
--       version + quote serializes two concurrent first-accepts so exactly one wins the
--       INSERT and the other takes this path (or hits the unique constraint 23505,
--       which the command maps to ACCEPTANCE_ALREADY_RECORDED). NEVER two jobs.
--   (5) the accepted price + reason are validated in the COMMAND (the pure money
--       engine) BEFORE this RPC; the RPC does NOT re-run money math (it is not the
--       money authority) — it persists the accepted_price_ore + source_sent_total_ore +
--       adjustment_reason AS GIVEN (no VAT/ROT/total recompute in SQL — R-716);
--   (6) inserts the single quote_acceptances row (all the 7.1 columns; accepted_at =
--       the EXPLICIT injected p_accepted_at, H1 — never now()) → the unique
--       (quote_version_id) constraint is the concurrency backstop (23505 on a raced
--       second insert);
--   (7) flips status sent → accepted (status ALONE — NO other quote_versions column in
--       this UPDATE; the 6.4 sent-lock trigger PERMITS sent → accepted on its
--       legal-transition allow-list but RAISES QV409 if ANY customer-visible/commitment
--       column is co-mutated in the same non-draft UPDATE) + appends a quote_events
--       `accepted` row (occurred_at = p_accepted_at; `accepted` is already in the 6.1
--       quote_events closed CHECK set — NO widening);
--   (8) inserts the minimal jobs row with immutable source refs (quote_acceptance_id +
--       quote_version_id), the customer/facility/contact carried from the LOCKED parent
--       quote row, title = p_title, status defaults 'created', planned dates from the
--       acceptance → the unique (quote_acceptance_id) constraint is the one-job-per-
--       acceptance backstop;
--   (9) inserts a job_events `created` row (occurred_at = p_accepted_at). The
--       audit_events row is written by the COMMAND envelope (NOT the RPC — mirror
--       mark-sent/create/pdf; a single audit row per command);
--   (9b) OPTIONAL evidence file_links find-or-create (R-814): when p_evidence_file_id
--       is supplied, materialize the file_links owner_type='quote_acceptance'
--       purpose='acceptance_evidence' row INSIDE the txn with an exists(...) guard (the
--       IDENTICAL find-or-create shape as create_new_quote_version's attachment link) so
--       an idempotent retry appends NO duplicate link (8.1 has no dedupe uniqueness);
--   (10) returns (acceptance_id, job_id, was_existing). A failure at ANY step rolls back
--       the WHOLE txn (no orphaned acceptance/job/event — NFR20). SECURITY INVOKER
--       (ADR-A009 default — under the caller's RLS, own-tenant only, NO service-role app
--       path) with a fixed empty search_path + schema-qualified refs. The RESOLVED tenant
--       id is passed explicitly (the own-tenant WITH CHECK narrows every write; a
--       cross-tenant p_tenant_id fails 42501 → aborts).
--
-- ----------------------------------------------------------------------------
-- FAULT-INJECTION HOOK (p_fault_inject — TEST-ONLY, atomicity/rollback proof, NFR20):
-- The atomicity test (7.2-INT-04) drives a fault at a step boundary INSIDE the txn to
-- prove the whole transaction rolls back (no partial state). Rather than crafting an
-- input that violates a constraint mid-txn (brittle), the RPC exposes an EXPLICIT
-- fault-injection parameter: p_fault_inject = 'job-insert' RAISES immediately AFTER the
-- job insert (before the job_events/link writes), and 'event-write' RAISES after the
-- job_events insert — either way the whole txn rolls back and the END STATE is empty (no
-- acceptance, no lifecycle flip, no job, no event). It is a controlled `raise exception`
-- (SQLSTATE 'QV703') the command maps to SERVER_ERROR; the command only threads it when
-- an EXPLICIT `__faultInject` test field is present (never a client-reachable input —
-- the validator strips unknown fields, so a normal request can never set it). A no-op
-- (NULL / any other value) is the production path.
--
-- ----------------------------------------------------------------------------
-- SCOPE DISCIPLINE (architecture §7; Story 7.2 Task 1.9 Stop Conditions):
-- ONE RPC on the EXISTING tables is the ONLY object. NO new TABLE (H4 untouched). NO
-- Fortnox/invoice/customer-portal/external-mapping/supplier/sync/credential/api/edi
-- object. NO field-worker/schedule/time-material/deviation/ÄTA/analytics column. NO
-- acceptance/job IMMUTABILITY trigger (Story 7.4 — 7.2 only flips lifecycle + inserts,
-- it does NOT lock). NO modification of the 20260707120000 sent-lock trigger (relying on
-- its sanctioned sent → accepted transition is the DESIGN — modifying it is a drift STOP).
-- NO inline money math / NO recompute of totals/VAT (the accepted price is stored AS
-- GIVEN). NO service-role app path (SECURITY INVOKER, runs under the caller's RLS).
-- ============================================================================

create or replace function public.accept_quote_and_create_job(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_accepted_at timestamptz,
  p_accepted_price_ore bigint,
  p_source_sent_total_ore bigint,
  p_channel text,
  p_adjustment_reason text,
  p_evidence_file_id uuid,
  p_evidence_reference text,
  p_notes text,
  p_planned_start_date date,
  p_planned_end_date date,
  p_title text,
  p_fault_inject text
)
returns table (acceptance_id uuid, job_id uuid, was_existing boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_quote_id uuid;
  v_customer_id uuid;
  v_facility_id uuid;
  v_contact_id uuid;
  v_acceptance_id uuid;
  v_job_id uuid;
  v_link_exists boolean;
begin
  -- (1/3) Lock + load the target version row (own-tenant RLS narrows it; a foreign id
  -- → 0 rows → not found → RAISE and abort). FOR UPDATE is a race-safe row lock: two
  -- concurrent first-accepts serialize on this row. The version carries the lifecycle
  -- `status` + the parent `quote_id`; the customer/facility/contact IDS live on the
  -- PARENT `quotes` row (the version snapshot holds only display names).
  select qv.status, qv.quote_id
    into v_status, v_quote_id
    from public.quote_versions qv
   where qv.id = p_quote_version_id
     and qv.tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'accept_quote_and_create_job: target version not found for tenant'
      using errcode = 'QV409';
  end if;

  -- (2) Row-lock the PARENT quotes row too (architecture §13 step 2 — serializes
  -- concurrent accepts on the SAME quote; belt-and-braces with the version lock) AND
  -- read the customer/facility/contact IDS carried on the quote (the job's parents).
  select q.customer_id, q.facility_id, q.contact_id
    into v_customer_id, v_facility_id, v_contact_id
    from public.quotes q
   where q.id = v_quote_id
     and q.tenant_id = p_tenant_id
   for update;

  -- (4 — THE HEADLINE) Idempotent existing-record short-circuit. BEFORE any write, look
  -- for an existing acceptance for the version (the unique (quote_version_id) backstop
  -- guarantees at most one). If found, return the EXISTING (acceptance, job) pair with
  -- was_existing = true and NO insert / lifecycle write — the retry / second-concurrent
  -- winner takes this path. (Its own job exists by the one-job-per-acceptance backstop.)
  select qa.id into v_acceptance_id
    from public.quote_acceptances qa
   where qa.quote_version_id = p_quote_version_id
     and qa.tenant_id = p_tenant_id
   limit 1;

  if v_acceptance_id is not null then
    select j.id into v_job_id
      from public.jobs j
     where j.quote_acceptance_id = v_acceptance_id
       and j.tenant_id = p_tenant_id
     limit 1;
    return query select v_acceptance_id, v_job_id, true;
    return;
  end if;

  -- (3) Re-assert status = 'sent' UNDER the lock (the command already checked, but
  -- re-check so a race cannot flip a non-sent version). A non-sent version RAISES QV409;
  -- the command maps a non-sent lifecycle rejection to VALIDATION_FAILED (not the locked
  -- code) — but a race reaching here is exceptional, so QV409 is the honest signal.
  if v_status <> 'sent' then
    raise exception 'accept_quote_and_create_job: version is not sent (status %)', v_status
      using errcode = 'QV409';
  end if;

  -- (6) Insert the single acceptance row. accepted_at = the EXPLICIT injected instant
  -- (H1 — never now()). The accepted price + source total + reason are stored AS GIVEN
  -- (the command's pure money engine validated the delta/reason gate; no SQL money math).
  -- The unique (quote_version_id) constraint is the concurrency backstop (23505).
  insert into public.quote_acceptances (
    tenant_id, quote_id, quote_version_id, channel, accepted_at,
    accepted_price_ore, source_sent_total_ore, adjustment_reason,
    evidence_file_id, evidence_reference, notes,
    planned_start_date, planned_end_date
  )
  values (
    p_tenant_id, v_quote_id, p_quote_version_id, p_channel, p_accepted_at,
    p_accepted_price_ore, p_source_sent_total_ore, p_adjustment_reason,
    p_evidence_file_id, p_evidence_reference, p_notes,
    p_planned_start_date, p_planned_end_date
  )
  returning id into v_acceptance_id;

  -- (7) Flip status sent → accepted — status ALONE (NO other column in this UPDATE; the
  -- 6.4 sent-lock trigger permits this transition but RAISES QV409 on a co-mutated
  -- customer-visible/commitment column). The accepted price lives on quote_acceptances,
  -- NOT on the version row.
  update public.quote_versions
     set status = 'accepted'
   where id = p_quote_version_id
     and tenant_id = p_tenant_id;

  -- (7 cont.) Append the lifecycle `accepted` quote_event (occurred_at = the accepted
  -- instant). `accepted` is already in the 6.1 quote_events closed CHECK set.
  insert into public.quote_events (
    tenant_id, quote_id, quote_version_id, event_type, occurred_at
  )
  values (
    p_tenant_id, v_quote_id, p_quote_version_id, 'accepted', p_accepted_at
  );

  -- (8) Insert the minimal job with immutable source refs + the carried customer/
  -- facility/contact from the locked PARENT QUOTE row. status defaults 'created'. The
  -- unique (quote_acceptance_id) constraint is the one-job-per-acceptance backstop.
  insert into public.jobs (
    tenant_id, quote_acceptance_id, quote_version_id,
    customer_id, facility_id, contact_id,
    title, planned_start_date, planned_end_date
  )
  values (
    p_tenant_id, v_acceptance_id, p_quote_version_id,
    v_customer_id, v_facility_id, v_contact_id,
    p_title, p_planned_start_date, p_planned_end_date
  )
  returning id into v_job_id;

  -- TEST-ONLY fault injection at the job-insert boundary (7.2-INT-04): RAISE now so the
  -- WHOLE txn rolls back (no acceptance, no lifecycle flip, no job, no event committed).
  if p_fault_inject = 'job-insert' then
    raise exception 'accept_quote_and_create_job: injected fault at job-insert boundary'
      using errcode = 'QV703';
  end if;

  -- (9) Append the job `created` event (occurred_at = the accepted instant).
  insert into public.job_events (
    tenant_id, job_id, event_type, occurred_at
  )
  values (
    p_tenant_id, v_job_id, 'created', p_accepted_at
  );

  -- TEST-ONLY fault injection at the event-write boundary (7.2-INT-04): RAISE now so the
  -- WHOLE txn rolls back (the acceptance + job + quote_event just written are undone).
  if p_fault_inject = 'event-write' then
    raise exception 'accept_quote_and_create_job: injected fault at event-write boundary'
      using errcode = 'QV703';
  end if;

  -- (9b) OPTIONAL evidence file_links find-or-create (R-814 — 8.1 has NO dedupe
  -- uniqueness; 7.2 IS retry-able, so a retry must NOT append a duplicate link). The
  -- idempotent short-circuit above means a retry returns before this on the second call;
  -- the exists(...) guard is belt-and-braces (mirrors create_new_quote_version's link).
  -- The composite same-tenant FK on quote_acceptances.evidence_file_id already rejected a
  -- foreign file id (23503) at the acceptance INSERT; the command re-validated ownership
  -- BEFORE the RPC too.
  if p_evidence_file_id is not null then
    select exists(
      select 1 from public.file_links fl
       where fl.tenant_id = p_tenant_id
         and fl.file_id = p_evidence_file_id
         and fl.owner_type = 'quote_acceptance'
         and fl.owner_id = v_acceptance_id
         and fl.purpose = 'acceptance_evidence'
    ) into v_link_exists;
    if not v_link_exists then
      insert into public.file_links (
        tenant_id, file_id, owner_type, owner_id, purpose
      )
      values (
        p_tenant_id, p_evidence_file_id, 'quote_acceptance', v_acceptance_id,
        'acceptance_evidence'
      );
    end if;
  end if;

  -- (10) Return the freshly-created pair (was_existing = false — a real state change, so
  -- the command writes the single audit row).
  return query select v_acceptance_id, v_job_id, false;
end;
$$;

comment on function public.accept_quote_and_create_job(
  uuid, uuid, timestamptz, bigint, bigint, text, text, uuid, text, text, date, date, text, text
) is
  'Narrow atomic accept-and-create-job RPC (architecture ADR-A009 / §13, Story 7.2) — the idempotent, transactional multi-record write. In ONE txn: row-locks the target quote_versions row + the parent quotes row FOR UPDATE; idempotent SHORT-CIRCUIT returns the EXISTING (acceptance_id, job_id, was_existing=true) with NO write when an acceptance already exists (retry / concurrent-loser path — the unique (quote_version_id) / (quote_acceptance_id) backstops guarantee at most one each; NEVER two jobs); else re-asserts status=''sent'' (QV409 if not), inserts the quote_acceptances row (accepted_at = the EXPLICIT injected instant, H1; accepted price/total/reason stored AS GIVEN — no SQL money math), flips status sent → accepted (status ALONE — the 6.4 sent-lock trigger permits it), appends a quote_events ''accepted'' row, inserts the minimal jobs row with immutable source refs + carried customer/facility/contact, appends a job_events ''created'' row, and find-or-creates the OPTIONAL evidence file_links row (R-814 — no duplicate on retry). Returns (acceptance_id, job_id, was_existing=false) on a fresh accept. A failure at ANY step rolls back the whole txn (NFR20). SECURITY INVOKER (under the caller''s RLS — own-tenant only, no service-role app path) + empty search_path + schema-qualified refs. The audit_events row is written by the COMMAND envelope, not the RPC. p_fault_inject is a TEST-ONLY controlled-RAISE hook (SQLSTATE QV703) for the atomicity/rollback proof; the command threads it only from an explicit test field, never a client-reachable input.';

-- Function privileges: revoke the implicit PUBLIC EXECUTE, then grant ONLY to the
-- app-runtime + test roles (mirror the 6.4/6.5 RPCs). anon must NOT execute.
revoke execute on function public.accept_quote_and_create_job(
  uuid, uuid, timestamptz, bigint, bigint, text, text, uuid, text, text, date, date, text, text
) from public;
grant execute on function public.accept_quote_and_create_job(
  uuid, uuid, timestamptz, bigint, bigint, text, text, uuid, text, text, date, date, text, text
) to authenticated, service_role;
