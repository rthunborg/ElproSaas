-- Story 13.4 final-convergence correction: every role admitted by the
-- Quotes.Send command boundary must be able to persist the append-only
-- recovery evidence when quote-delivery preparation or finalization fails.
create or replace function public.record_quote_email_delivery_recovery(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid,
  p_failure_stage text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_state text;
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

revoke all on function public.record_quote_email_delivery_recovery(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.record_quote_email_delivery_recovery(uuid, uuid, uuid, uuid, text) to authenticated;

comment on function public.record_quote_email_delivery_recovery(uuid, uuid, uuid, uuid, text) is
  'Persists tenant-scoped quote delivery recovery evidence for authenticated Quotes.Send actors.';
