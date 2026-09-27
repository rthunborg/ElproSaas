-- Story 13.4 convergence: the command and finalization wrappers authorize the
-- complete Quotes.Send role set, so the PDF challenge and private verifier must
-- enforce that same exact actor/tenant contract rather than the older reviewer-
-- only helper. The HMAC payload and Vault verification remain unchanged.

create or replace function public.prepare_quote_pdf_send_attestation(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_attestation_key_id text
) returns table (
  file_id uuid,
  content_fingerprint text,
  bucket_id text,
  object_path text,
  checksum_sha256 text,
  size_bytes bigint,
  mime_type text,
  attestation_key_id text,
  attestation_issued_at text,
  attestation_expires_at text,
  generation_started_at text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id,
    p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  perform public.quote_pdf_attestation_vault_secret(p_attestation_key_id);
  perform public.assert_quote_pdf_current_for_send(p_quote_version_id);

  return query
  select qv.pdf_file_id,
         qv.pdf_content_fingerprint,
         f.bucket_id,
         f.object_path,
         f.checksum,
         f.size_bytes,
         f.mime_type,
         p_attestation_key_id,
         public.quote_pdf_attestation_iso(v_now),
         public.quote_pdf_attestation_iso(v_now + interval '5 minutes'),
         public.quote_pdf_attestation_iso(qv.pdf_generated_at)
    from public.quote_versions qv
    join public.files f
      on f.id = qv.pdf_file_id
     and f.tenant_id = qv.tenant_id
   where qv.id = p_quote_version_id
     and qv.tenant_id = p_tenant_id
     and qv.status = 'draft'
     and qv.pdf_status = 'generated'
     and qv.pdf_generated_at is not null
     and f.artifact_kind = 'quote_pdf'
     and f.lifecycle_state in ('linked', 'locked')
     and f.archived_at is null;

  if not found then
    raise exception 'current PDF send attestation could not be prepared' using errcode = 'PFD10';
  end if;
end;
$$;

create or replace function public.assert_quote_pdf_send_attestation(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_attestation_key_id text,
  p_attestation_issued_at text,
  p_attestation_expires_at text,
  p_attestation_signature text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_file_id uuid;
  v_fingerprint text;
  v_generated_at timestamptz;
  v_bucket text;
  v_path text;
  v_checksum text;
  v_size bigint;
  v_mime text;
  v_issued timestamptz;
  v_expires timestamptz;
  v_secret text;
  v_expected_signature text;
  v_now timestamptz := statement_timestamp();
begin
  perform public.story_11_2_assert_quote_roles(
    p_tenant_id,
    p_actor_user_id,
    array['tenant_admin', 'projektledare', 'saljare']::text[]
  );
  perform public.assert_quote_pdf_current_for_send(p_quote_version_id);

  begin
    v_issued := p_attestation_issued_at::timestamptz;
    v_expires := p_attestation_expires_at::timestamptz;
  exception when others then
    raise exception 'quote PDF send attestation is invalid' using errcode = 'PFD10';
  end;

  select qv.pdf_file_id, qv.pdf_content_fingerprint, qv.pdf_generated_at,
         f.bucket_id, f.object_path, f.checksum, f.size_bytes, f.mime_type
    into v_file_id, v_fingerprint, v_generated_at,
         v_bucket, v_path, v_checksum, v_size, v_mime
    from public.quote_versions qv
    join public.files f
      on f.id = qv.pdf_file_id
     and f.tenant_id = qv.tenant_id
   where qv.id = p_quote_version_id
     and qv.tenant_id = p_tenant_id
     and qv.status = 'draft'
     and qv.pdf_status = 'generated'
     and qv.pdf_generated_at is not null
     and f.artifact_kind = 'quote_pdf'
     and f.lifecycle_state in ('linked', 'locked')
     and f.archived_at is null
   for update of qv, f;

  if not found
     or p_attestation_issued_at is distinct from public.quote_pdf_attestation_iso(v_issued)
     or p_attestation_expires_at is distinct from public.quote_pdf_attestation_iso(v_expires)
     or v_issued > v_now
     or v_expires <= v_now
     or v_expires is distinct from v_issued + interval '5 minutes'
     or p_attestation_signature is null
     or p_attestation_signature !~ '^[0-9a-f]{64}$' then
    raise exception 'quote PDF send attestation is invalid' using errcode = 'PFD10';
  end if;

  perform public.assert_quote_pdf_storage_object(p_tenant_id, v_file_id);
  v_secret := public.quote_pdf_attestation_vault_secret(p_attestation_key_id);
  v_expected_signature := encode(extensions.hmac(public.quote_pdf_attestation_payload(
    p_tenant_id, p_actor_user_id, p_quote_version_id, v_file_id, v_fingerprint,
    v_bucket, v_path, v_checksum, v_size, v_mime, p_correlation_id,
    p_attestation_key_id, v_issued, v_expires, v_generated_at
  ), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');

  if v_expected_signature is distinct from p_attestation_signature then
    raise exception 'quote PDF send attestation is invalid' using errcode = 'PFD10';
  end if;
end;
$$;

revoke execute on function public.prepare_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text)
  from public, anon, service_role;
grant execute on function public.prepare_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text)
  to authenticated;
revoke execute on function public.assert_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;

comment on function public.prepare_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text) is
  'Story 13.4 Quotes.Send challenge for the current immutable quote PDF. Exact actor/tenant role authority is checked before returning the five-minute signing window; no signature or Vault secret is returned.';
comment on function public.assert_quote_pdf_send_attestation(uuid, uuid, uuid, uuid, text, text, text, text) is
  'Private Story 13.4 Quotes.Send verifier. Reconstructs the canonical current quote-PDF payload and verifies its HMAC-SHA256 through Vault immediately before commitment.';
