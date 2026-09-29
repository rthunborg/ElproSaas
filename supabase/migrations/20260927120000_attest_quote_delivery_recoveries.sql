-- Story 13.4 final-convergence correction: the recovery ledger is evidence of a
-- server-observed command failure. Actor/tenant/capability checks alone cannot
-- distinguish that event from a direct same-tenant PostgREST call, so require a
-- short-lived server HMAC rooted in the existing quote-PDF Vault credential.

revoke all on function public.record_quote_email_delivery_recovery(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
drop function public.record_quote_email_delivery_recovery(uuid, uuid, uuid, uuid, text);

create function public.quote_delivery_recovery_attestation_payload(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_quote_version_id uuid,
  p_correlation_id uuid,
  p_failure_stage text,
  p_root_fingerprint text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
) returns bytea
language sql stable security invoker set search_path = '' as $$
  select string_agg(
    convert_to(octet_length(convert_to(value, 'UTF8'))::text || ':', 'UTF8') ||
      convert_to(value, 'UTF8'),
    ''::bytea order by ordinality
  )
  from unnest(array[
    'elpro.quote-delivery.recovery-attestation.v1',
    p_tenant_id::text,
    p_actor_user_id::text,
    p_quote_version_id::text,
    p_correlation_id::text,
    p_failure_stage,
    p_root_fingerprint,
    public.quote_pdf_attestation_iso(p_issued_at),
    public.quote_pdf_attestation_iso(p_expires_at)
  ]) with ordinality as fields(value, ordinality)
$$;

create function public.quote_delivery_recovery_attestation_key(p_root_fingerprint text)
returns bytea
language plpgsql stable security definer set search_path = '' as $$
declare v_count integer; v_secret text;
begin
  if p_root_fingerprint is null or p_root_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'quote delivery recovery attestation is invalid' using errcode = 'PFD10';
  end if;
  select count(distinct decrypted_secret), min(decrypted_secret)
    into v_count, v_secret
    from vault.decrypted_secrets
   where left(name, 22) = 'quote_pdf_attestation_'
     and encode(extensions.digest(convert_to(decrypted_secret, 'UTF8'), 'sha256'), 'hex') = p_root_fingerprint;
  if v_count <> 1 or v_secret is null or octet_length(convert_to(v_secret, 'UTF8')) = 0 then
    raise exception 'quote delivery recovery attestation is invalid' using errcode = 'PFD10';
  end if;
  return extensions.hmac(
    convert_to('elpro.quote-delivery.recovery-key.v1', 'UTF8'),
    convert_to(v_secret, 'UTF8'),
    'sha256'
  );
end;
$$;

revoke execute on function public.quote_delivery_recovery_attestation_payload(
  uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz
), public.quote_delivery_recovery_attestation_key(text)
from public, anon, authenticated, service_role;

create function public.record_quote_email_delivery_recovery(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_failure_stage text,
  p_attestation_root_fingerprint text,
  p_attestation_issued_at text,
  p_attestation_expires_at text,
  p_attestation_signature text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_state text;
  v_now timestamptz := statement_timestamp();
  v_issued timestamptz;
  v_expires timestamptz;
  v_expected_signature text;
begin
  if auth.uid() is null or auth.uid() <> p_actor_user_id then
    raise exception 'quote delivery recovery actor mismatch' using errcode = 'insufficient_privilege';
  end if;
  if not public.has_tenant_role(
    p_tenant_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  ) then
    raise exception 'quote delivery recovery requires Quotes.Send authority' using errcode = 'insufficient_privilege';
  end if;
  if p_failure_stage not in ('artifact_preparation', 'finalization') then
    raise exception 'invalid quote delivery recovery stage' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.quote_versions
    where id = p_quote_version_id and tenant_id = p_tenant_id
  ) then
    raise exception 'quote delivery recovery target missing' using errcode = 'P0002';
  end if;

  begin
    v_issued := p_attestation_issued_at::timestamptz;
    v_expires := p_attestation_expires_at::timestamptz;
  exception when others then
    raise exception 'quote delivery recovery attestation is invalid' using errcode = 'PFD10';
  end;
  if p_attestation_issued_at is distinct from public.quote_pdf_attestation_iso(v_issued)
     or p_attestation_expires_at is distinct from public.quote_pdf_attestation_iso(v_expires)
     or v_expires is distinct from v_issued + interval '5 minutes'
     or v_issued > v_now + interval '1 minute'
     or v_expires <= v_now - interval '1 minute'
     or p_attestation_signature is null
     or p_attestation_signature !~ '^[0-9a-f]{64}$' then
    raise exception 'quote delivery recovery attestation is invalid' using errcode = 'PFD10';
  end if;
  v_expected_signature := encode(extensions.hmac(
    public.quote_delivery_recovery_attestation_payload(
      p_tenant_id,
      p_actor_user_id,
      p_quote_version_id,
      p_correlation_id,
      p_failure_stage,
      p_attestation_root_fingerprint,
      v_issued,
      v_expires
    ),
    public.quote_delivery_recovery_attestation_key(p_attestation_root_fingerprint),
    'sha256'
  ), 'hex');
  if v_expected_signature is distinct from p_attestation_signature then
    raise exception 'quote delivery recovery attestation is invalid' using errcode = 'PFD10';
  end if;

  v_state := case p_failure_stage
    when 'artifact_preparation' then 'orphaned'
    else 'invalidated'
  end;
  insert into public.email_delivery_recoveries (
    tenant_id, actor_user_id, quote_version_id, correlation_id, failure_stage, recovery_state
  ) values (
    p_tenant_id, p_actor_user_id, p_quote_version_id, p_correlation_id, p_failure_stage, v_state
  )
  on conflict (tenant_id, correlation_id, failure_stage) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.email_delivery_recoveries
    where tenant_id = p_tenant_id
      and correlation_id = p_correlation_id
      and failure_stage = p_failure_stage;
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_quote_email_delivery_recovery(
  uuid, uuid, uuid, uuid, text, text, text, text, text
) from public, anon, service_role;
grant execute on function public.record_quote_email_delivery_recovery(
  uuid, uuid, uuid, uuid, text, text, text, text, text
) to authenticated;

comment on function public.record_quote_email_delivery_recovery(
  uuid, uuid, uuid, uuid, text, text, text, text, text
) is 'Appends tenant-scoped quote delivery recovery evidence only for an authenticated Quotes.Send actor carrying a fresh server HMAC.';
