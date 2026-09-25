-- ADR-B011: a queued quote delivery can be corrected only by cancelling its
-- frozen recipient snapshot and issuing a new, independently audited delivery.
-- The original PDF artifact is never reused by the worker after cancellation.

alter table public.email_outbox drop constraint if exists email_outbox_state_check;
alter table public.email_outbox add constraint email_outbox_state_check
  check (state in ('queued','sending','sent','failed','suppressed','cancelled'));

alter table public.email_delivery_events drop constraint if exists email_delivery_events_event_type_check;
alter table public.email_delivery_events add constraint email_delivery_events_event_type_check
  check (event_type in ('queued','sending','sent','failed','suppressed','cancelled','retry_scheduled','lease_recovered'));

create or replace function public.email_outbox_transition_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.state = 'queued' and new.state not in ('queued','sending','suppressed','cancelled') then
    raise exception 'invalid email outbox transition' using errcode = '23514';
  end if;
  if old.state = 'sending' and new.state not in ('sending','queued','sent','failed') then
    raise exception 'invalid email outbox transition' using errcode = '23514';
  end if;
  if old.state in ('sent','failed','suppressed','cancelled') and new is distinct from old then
    raise exception 'terminal email outbox state is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Normal producers keep their original permanent identity even after a terminal
-- outcome. A recipient correction is the sole exception: it creates a new
-- sequence only after cancelling the prior quote-delivery identity.
alter table public.email_outbox
  add column if not exists delivery_sequence integer not null default 1
  check (delivery_sequence >= 1);

alter table public.email_outbox
  drop constraint if exists email_outbox_tenant_id_category_subject_type_subject_id_logical_period_key;
alter table public.email_outbox
  drop constraint if exists email_outbox_tenant_id_category_subject_type_subject_id_log_key;
drop index if exists public.email_outbox_active_delivery_dedupe;
alter table public.email_outbox
  add constraint email_outbox_delivery_identity_key
  unique (tenant_id, category, subject_type, subject_id, logical_period, delivery_sequence);

create or replace function public.enqueue_email_outbox(
  p_tenant_id uuid, p_recipient_hash text, p_category text, p_subject_type text,
  p_subject_id uuid, p_logical_period date, p_template_key text,
  p_template_version integer, p_template_params jsonb
) returns table(id uuid, state text, lease_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.email_outbox (
    tenant_id, recipient_hash, category, subject_type, subject_id, logical_period,
    template_key, template_version, template_params
  ) values (
    p_tenant_id, p_recipient_hash, p_category, p_subject_type, p_subject_id,
    p_logical_period, p_template_key, p_template_version, p_template_params
  ) on conflict (tenant_id, category, subject_type, subject_id, logical_period, delivery_sequence)
    do nothing
    returning email_outbox.id into v_id;
  if v_id is not null then
    insert into public.email_delivery_events (tenant_id, outbox_id, event_type)
      values (p_tenant_id, v_id, 'queued');
  else
    select o.id into v_id from public.email_outbox o
      where o.tenant_id=p_tenant_id and o.category=p_category
        and o.subject_type=p_subject_type and o.subject_id=p_subject_id
        and o.logical_period=p_logical_period and o.delivery_sequence=1;
  end if;
  return query select o.id, o.state, o.lease_expires_at
    from public.email_outbox o where o.id=v_id;
end;
$$;

create or replace function public.correct_pending_quote_email_delivery(
  p_tenant_id uuid, p_quote_version_id uuid, p_recipient_source_type text,
  p_recipient_source_id uuid, p_actor_user_id uuid, p_correlation_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_quote_id uuid;
  v_customer_id uuid;
  v_old_outbox_id uuid;
  v_old_recipient text;
  v_template_key text;
  v_template_version integer;
  v_template_params jsonb;
  v_logical_period date;
  v_delivery_sequence integer;
  v_fingerprint text;
  v_checksum text;
  v_pdf_bytes bytea;
  v_recipient text;
  v_recipient_hash text;
  v_new_outbox_id uuid;
  v_new_artifact_id uuid;
begin
  -- Correction is an explicit send operation. It deliberately uses the same
  -- role set as Quotes.Send without broadening the stricter quote-review
  -- authority helper used by PDF review and finalization flows.
  if auth.uid() is null or auth.uid() is distinct from p_actor_user_id
     or not public.has_tenant_role(p_tenant_id, array['tenant_admin','projektledare','saljare']::text[]) then
    raise exception 'quote delivery sender denied' using errcode='42501';
  end if;
  if p_recipient_source_type not in ('customer','contact') then
    raise exception 'invalid quote delivery recipient selection' using errcode='23514';
  end if;

  -- Lock the only deliverable state. A claimed/sent/failed/suppressed/cancelled
  -- row cannot be redirected, so a provider race cannot reach a changed address.
  select qv.quote_id, q.customer_id, o.id, o.recipient_normalized,
         o.template_key, o.template_version, o.template_params, o.logical_period, o.delivery_sequence,
         a.content_fingerprint, a.pdf_checksum_sha256, a.pdf_bytes
    into v_quote_id, v_customer_id, v_old_outbox_id, v_old_recipient,
         v_template_key, v_template_version, v_template_params, v_logical_period, v_delivery_sequence,
         v_fingerprint, v_checksum, v_pdf_bytes
    from public.email_outbox o
    join public.email_delivery_artifacts a
      on a.id=o.delivery_artifact_id and a.tenant_id=o.tenant_id and a.outbox_id=o.id
    join public.quote_versions qv
      on qv.id=o.quote_version_id and qv.tenant_id=o.tenant_id
    join public.quotes q
      on q.id=qv.quote_id and q.tenant_id=qv.tenant_id
   where o.tenant_id=p_tenant_id and o.quote_version_id=p_quote_version_id
     and o.category='quote.delivery' and o.state='queued'
     and a.recovery_state='prepared' and qv.status='sent'
     and qv.pdf_content_fingerprint=a.content_fingerprint
   for update of o, a, qv;
  if not found then
    raise exception 'pending quote delivery is unavailable' using errcode='QV409';
  end if;

  if p_recipient_source_type='customer' then
    select lower(btrim(c.email)) into v_recipient from public.customers c
      where c.tenant_id=p_tenant_id and c.id=p_recipient_source_id
        and c.id=v_customer_id and c.archived_at is null;
  else
    select lower(btrim(c.email)) into v_recipient from public.contacts c
      where c.tenant_id=p_tenant_id and c.id=p_recipient_source_id
        and c.customer_id=v_customer_id and c.archived_at is null;
  end if;
  if v_recipient is null or length(v_recipient)>256
     or v_recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or v_recipient=v_old_recipient then
    raise exception 'selected customer/contact email is unavailable' using errcode='23514';
  end if;
  v_recipient_hash := encode(extensions.digest(v_recipient,'sha256'),'hex');

  update public.email_outbox set state='cancelled', lease_owner=null,
    lease_expires_at=null, updated_at=statement_timestamp()
    where id=v_old_outbox_id and tenant_id=p_tenant_id;
  update public.email_delivery_artifacts set recovery_state='invalidated'
    where tenant_id=p_tenant_id and outbox_id=v_old_outbox_id
      and recovery_state='prepared';
  insert into public.email_delivery_events(tenant_id,outbox_id,event_type)
    values(p_tenant_id,v_old_outbox_id,'cancelled');

  insert into public.email_outbox(
    tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,
    delivery_sequence,template_key,template_version,template_params
  ) values(
    p_tenant_id,v_recipient_hash,'quote.delivery','quote_version',p_quote_version_id,
    v_logical_period,v_delivery_sequence + 1,v_template_key,v_template_version,v_template_params
  ) returning id into v_new_outbox_id;
  insert into public.email_delivery_artifacts(
    tenant_id,outbox_id,quote_version_id,content_fingerprint,pdf_checksum_sha256,pdf_bytes
  ) values(
    p_tenant_id,v_new_outbox_id,p_quote_version_id,v_fingerprint,v_checksum,v_pdf_bytes
  ) returning id into v_new_artifact_id;
  update public.email_outbox set quote_version_id=p_quote_version_id,
    delivery_artifact_id=v_new_artifact_id, recipient_normalized=v_recipient,
    recipient_source_type=p_recipient_source_type, recipient_source_id=p_recipient_source_id
    where id=v_new_outbox_id and tenant_id=p_tenant_id;
  insert into public.email_delivery_events(tenant_id,outbox_id,event_type)
    values(p_tenant_id,v_new_outbox_id,'queued');

  -- Keep the authorization and audit evidence inside the same transaction as
  -- cancellation/reissue; a failed audit rolls all of it back.
  perform public.record_audit_event(
    p_tenant_id, p_actor_user_id, 'quote.delivery.correct_recipient',
    'quote.delivery.recipient_corrected', 'quote_version', p_quote_version_id,
    p_correlation_id, '{}'::jsonb, statement_timestamp()
  );
  return v_new_outbox_id;
end;
$$;

revoke all on function public.correct_pending_quote_email_delivery(uuid,uuid,text,uuid,uuid,uuid)
  from public, anon, service_role;
grant execute on function public.correct_pending_quote_email_delivery(uuid,uuid,text,uuid,uuid,uuid)
  to authenticated;

create or replace function public.has_pending_quote_email_delivery(
  p_tenant_id uuid, p_quote_version_id uuid
) returns boolean
language sql security definer set search_path = '' as $$
  select public.has_tenant_role(p_tenant_id, array['tenant_admin','projektledare','saljare']::text[]) and exists (
    select 1 from public.email_outbox o
      join public.email_delivery_artifacts a
        on a.id=o.delivery_artifact_id and a.tenant_id=o.tenant_id and a.outbox_id=o.id
     where o.tenant_id=p_tenant_id and o.quote_version_id=p_quote_version_id
       and o.category='quote.delivery' and o.state='queued'
       and a.recovery_state='prepared'
  );
$$;
revoke all on function public.has_pending_quote_email_delivery(uuid,uuid) from public, anon;
grant execute on function public.has_pending_quote_email_delivery(uuid,uuid) to authenticated;

-- The queue is a redacted operational projection, but each row needs a stable
-- opaque identity because an authorized correction can create a second delivery
-- for the same quote and logical period.
drop function if exists public.read_email_outbox_queue(uuid);
create function public.read_email_outbox_queue(p_tenant_id uuid)
returns table(id uuid, subject_type text, subject_id uuid, logical_period date, state text, attempts integer, next_attempt_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_tenant_admin(p_tenant_id) then return; end if;
  return query select o.id, o.subject_type, o.subject_id, o.logical_period, o.state, o.attempts, o.next_attempt_at
    from public.email_outbox o where o.tenant_id = p_tenant_id order by o.created_at desc limit 50;
end;
$$;
revoke all on function public.read_email_outbox_queue(uuid) from public, anon;
grant execute on function public.read_email_outbox_queue(uuid) to authenticated, service_role;
