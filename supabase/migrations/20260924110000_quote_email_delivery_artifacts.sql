-- ADR-B011: a delivery worker receives only an immutable, outbox-bound PDF copy.
create table public.email_delivery_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  quote_version_id uuid not null,
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  pdf_checksum_sha256 text not null check (pdf_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_bytes bytea not null check (octet_length(pdf_bytes) > 0),
  prepared_at timestamptz not null default now(),
  recovery_state text not null default 'prepared' check (recovery_state in ('prepared','orphaned','consumed','invalidated')),
  unique (outbox_id),
  unique (tenant_id, outbox_id),
  unique (id, tenant_id)
);

alter table public.email_outbox
  add column if not exists recipient_normalized text,
  add column if not exists recipient_source_type text check (recipient_source_type in ('customer','contact')),
  add column if not exists recipient_source_id uuid,
  add column if not exists quote_version_id uuid,
  add column if not exists delivery_artifact_id uuid;

alter table public.email_outbox
  add constraint email_outbox_delivery_artifact_same_tenant
  foreign key (delivery_artifact_id, tenant_id)
  references public.email_delivery_artifacts(id, tenant_id);

alter table public.email_outbox add constraint email_outbox_quote_delivery_snapshot_check check (
  (quote_version_id is null and delivery_artifact_id is null and recipient_normalized is null and recipient_source_type is null and recipient_source_id is null)
  or
  (quote_version_id is not null and delivery_artifact_id is not null
   and recipient_normalized is not null and recipient_normalized = lower(btrim(recipient_normalized))
   and recipient_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
   and recipient_source_type is not null and recipient_source_id is not null)
);

-- Completing a lease-bound sent outcome consumes only its immutable artifact in
-- the same transaction. A missing artifact is handled by the worker as a
-- recoverable failure before any adapter call.
create or replace function public.record_email_outbox_delivery(p_outbox_id uuid, p_tenant_id uuid, p_worker_id text, p_provider_message_id text, p_now timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.email_outbox set state='sent', provider_message_id=p_provider_message_id, lease_owner=null, lease_expires_at=null, updated_at=p_now
    where id=p_outbox_id and tenant_id=p_tenant_id and state='sending' and lease_owner=p_worker_id and lease_expires_at > p_now;
  if not found then raise exception 'active email outbox claim not found' using errcode='P0002'; end if;
  update public.email_delivery_artifacts set recovery_state='consumed'
    where tenant_id=p_tenant_id and outbox_id=p_outbox_id and recovery_state='prepared';
  insert into public.email_delivery_events(tenant_id,outbox_id,event_type) values(p_tenant_id,p_outbox_id,'sent');
end;
$$;

revoke all on public.email_delivery_artifacts from public, anon, authenticated, service_role;
alter table public.email_delivery_artifacts enable row level security;
alter table public.email_delivery_artifacts force row level security;

-- Only a lease owner can read one exact artifact. The worker cannot select quote files or a generic bucket.
create or replace function public.read_claimed_email_delivery_artifact(p_tenant_id uuid, p_outbox_id uuid, p_worker_id text, p_now timestamptz)
returns table(pdf_bytes bytea, quote_version_id uuid, content_fingerprint text, pdf_checksum_sha256 text)
language sql security definer set search_path = '' as $$
  select a.pdf_bytes, a.quote_version_id, a.content_fingerprint, a.pdf_checksum_sha256
  from public.email_delivery_artifacts a
  join public.email_outbox o on o.id=a.outbox_id and o.tenant_id=a.tenant_id
  where a.tenant_id=p_tenant_id and a.outbox_id=p_outbox_id
    and o.state='sending' and o.lease_owner=p_worker_id and o.lease_expires_at > p_now
    and a.recovery_state='prepared';
$$;
revoke all on function public.read_claimed_email_delivery_artifact(uuid,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.read_claimed_email_delivery_artifact(uuid,uuid,text,timestamptz) to service_role;

create or replace function public.validate_claimed_quote_email_delivery(
  p_tenant_id uuid, p_outbox_id uuid, p_worker_id text, p_now timestamptz, p_content_fingerprint text
) returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.email_delivery_artifacts a
    join public.email_outbox o on o.id=a.outbox_id and o.tenant_id=a.tenant_id
    join public.quote_versions qv on qv.id=a.quote_version_id and qv.tenant_id=a.tenant_id
    where a.tenant_id=p_tenant_id and a.outbox_id=p_outbox_id and a.content_fingerprint=p_content_fingerprint
      and a.recovery_state='prepared' and o.state='sending' and o.lease_owner=p_worker_id and o.lease_expires_at>p_now
      and qv.status='sent' and qv.pdf_content_fingerprint=a.content_fingerprint
  );
$$;
revoke all on function public.validate_claimed_quote_email_delivery(uuid,uuid,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.validate_claimed_quote_email_delivery(uuid,uuid,text,timestamptz,text) to service_role;

-- The authenticated sender has already performed ADR-B008's request-bound byte
-- verification. This function persists a separate copy, finalizes the quote, and
-- queues its delivery in one database transaction. The HMAC itself is deliberately
-- forwarded only to mark_quote_version_sent and is never stored here.
create or replace function public.finalize_quote_email_delivery(
  p_tenant_id uuid, p_quote_version_id uuid, p_authorization_id uuid, p_sent_at timestamptz,
  p_channel text, p_reference text, p_actor_user_id uuid, p_correlation_id uuid,
  p_attestation_key_id text, p_attestation_issued_at text, p_attestation_expires_at text,
  p_attestation_signature text, p_recipient_source_type text, p_recipient_source_id uuid,
  p_pdf_base64 text, p_content_fingerprint text, p_pdf_checksum_sha256 text
) returns table(quote_version_id uuid, outbox_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_quote_id uuid; v_customer_id uuid; v_recipient text; v_outbox_id uuid; v_artifact_id uuid;
  v_bytes bytea; v_recipient_hash text;
begin
  if p_recipient_source_type not in ('customer','contact') or p_pdf_base64 is null
     or p_content_fingerprint !~ '^[0-9a-f]{64}$' or p_pdf_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid quote email delivery input' using errcode='23514';
  end if;
  v_bytes := decode(p_pdf_base64, 'base64');
  if octet_length(v_bytes)=0 or encode(extensions.digest(v_bytes,'sha256'),'hex') <> p_pdf_checksum_sha256 then
    raise exception 'quote delivery bytes do not match current fingerprint' using errcode='23514';
  end if;
  select qv.quote_id, q.customer_id into v_quote_id, v_customer_id
    from public.quote_versions qv join public.quotes q on q.id=qv.quote_id and q.tenant_id=qv.tenant_id
   where qv.tenant_id=p_tenant_id and qv.id=p_quote_version_id for update;
  if not found then raise exception 'quote delivery target missing' using errcode='QV409'; end if;
  if p_recipient_source_type='customer' then
    select lower(btrim(c.email)) into v_recipient from public.customers c
     where c.tenant_id=p_tenant_id and c.id=p_recipient_source_id and c.id=v_customer_id and c.archived_at is null;
  else
    select lower(btrim(c.email)) into v_recipient from public.contacts c
     where c.tenant_id=p_tenant_id and c.id=p_recipient_source_id and c.customer_id=v_customer_id and c.archived_at is null;
  end if;
  if v_recipient is null or length(v_recipient)>256 or v_recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'selected customer/contact email is unavailable' using errcode='23514';
  end if;
  v_recipient_hash := encode(extensions.digest(v_recipient,'sha256'),'hex');
  insert into public.email_outbox(tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params)
    values(p_tenant_id,v_recipient_hash,'quote.delivery','quote_version',p_quote_version_id,current_date,'quote-delivery',1,'{}'::jsonb)
    returning id into v_outbox_id;
  insert into public.email_delivery_artifacts(tenant_id,outbox_id,quote_version_id,content_fingerprint,pdf_checksum_sha256,pdf_bytes)
    values(p_tenant_id,v_outbox_id,p_quote_version_id,p_content_fingerprint,p_pdf_checksum_sha256,v_bytes) returning id into v_artifact_id;
  update public.email_outbox set quote_version_id=p_quote_version_id, delivery_artifact_id=v_artifact_id,
    recipient_normalized=v_recipient, recipient_source_type=p_recipient_source_type, recipient_source_id=p_recipient_source_id
    where id=v_outbox_id and tenant_id=p_tenant_id;
  perform * from public.mark_quote_version_sent(p_tenant_id,p_quote_version_id,p_authorization_id,p_sent_at,p_channel,p_reference,p_actor_user_id,p_correlation_id,p_attestation_key_id,p_attestation_issued_at,p_attestation_expires_at,p_attestation_signature);
  insert into public.email_delivery_events(tenant_id,outbox_id,event_type) values(p_tenant_id,v_outbox_id,'queued');
  return query select p_quote_version_id,v_outbox_id;
end;
$$;
revoke all on function public.finalize_quote_email_delivery(uuid,uuid,uuid,timestamptz,text,text,uuid,uuid,text,text,text,text,text,uuid,text,text,text) from public, anon;
grant execute on function public.finalize_quote_email_delivery(uuid,uuid,uuid,timestamptz,text,text,uuid,uuid,text,text,text,text,text,uuid,text,text,text) to authenticated;
