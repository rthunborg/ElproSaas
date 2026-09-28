-- ReviewBot follow-up: the scheduler's operational row and system audit are one
-- observation. A service-role caller must not be able to commit either half.
create function public.record_job_run_with_system_audit(
  p_tenant_id uuid,
  p_producer text,
  p_window_started_at timestamptz,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_outcome text,
  p_cursor text,
  p_error_summary text,
  p_correlation_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_run_id uuid;
begin
  if p_producer !~ '^[a-z][a-z0-9._-]{0,127}$'
     or p_outcome not in ('completed', 'partial', 'failed')
     or (p_outcome = 'partial') is distinct from (p_cursor is not null)
     or p_finished_at < p_started_at
     or (p_error_summary is not null and char_length(p_error_summary) > 256) then
    raise exception 'invalid job run record' using errcode = '23514';
  end if;

  insert into public.job_runs (
    tenant_id, producer, window_started_at, started_at, finished_at, outcome,
    cursor, error_summary, correlation_id
  ) values (
    p_tenant_id, p_producer, p_window_started_at, p_started_at, p_finished_at,
    p_outcome, p_cursor, p_error_summary, p_correlation_id
  ) returning id into v_run_id;

  insert into public.audit_events (
    tenant_id, actor_user_id, command, event_type, target_type, target_id,
    correlation_id, metadata, created_at
  ) values (
    p_tenant_id, null, 'jobs.' || p_producer, 'job.producer.executed',
    'job_run', v_run_id, p_correlation_id,
    jsonb_build_object('outcome', p_outcome, 'cursor', p_cursor), p_finished_at
  );
  return v_run_id;
end;
$$;

revoke all on function public.record_job_run_with_system_audit(
  uuid, text, timestamptz, timestamptz, timestamptz, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_job_run_with_system_audit(
  uuid, text, timestamptz, timestamptz, timestamptz, text, text, text, uuid
) to service_role;

-- A missing application HMAC cannot create an attested recovery record. This
-- separate service-only writer is limited to that configuration failure and
-- preserves actor/tenant/quote attribution without relaxing the attested RPC.
create function public.record_quote_email_delivery_configuration_recovery(
  p_tenant_id uuid,
  p_quote_version_id uuid,
  p_actor_user_id uuid,
  p_correlation_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (
    select 1
    from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and (
        m.role = any(array['tenant_admin', 'projektledare', 'saljare']::text[])
        or exists (
          select 1 from public.membership_roles mr
          where mr.membership_id = m.id
            and mr.tenant_id = m.tenant_id
            and mr.role = any(array['tenant_admin', 'projektledare', 'saljare']::text[])
        )
      )
  ) then
    raise exception 'quote delivery recovery requires Quotes.Send authority' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.quote_versions
    where id = p_quote_version_id and tenant_id = p_tenant_id
  ) then
    raise exception 'quote delivery recovery target missing' using errcode = 'P0002';
  end if;

  insert into public.email_delivery_recoveries (
    tenant_id, actor_user_id, quote_version_id, correlation_id, failure_stage, recovery_state
  ) values (
    p_tenant_id, p_actor_user_id, p_quote_version_id, p_correlation_id,
    'artifact_preparation', 'orphaned'
  ) on conflict (tenant_id, correlation_id, failure_stage) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.email_delivery_recoveries
    where tenant_id = p_tenant_id
      and correlation_id = p_correlation_id
      and failure_stage = 'artifact_preparation';
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_quote_email_delivery_configuration_recovery(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.record_quote_email_delivery_configuration_recovery(uuid, uuid, uuid, uuid)
  to service_role;
