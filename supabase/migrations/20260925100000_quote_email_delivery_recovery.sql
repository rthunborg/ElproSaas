-- Story 13.4 AC8: a quote-delivery attempt that fails after artifact work begins
-- must leave durable, tenant-scoped recovery evidence. This append-only ledger is
-- deliberately independent of email_outbox: the finalization transaction can roll
-- that row back, while this record persists in the command's follow-up transaction.
create table public.email_delivery_recoveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- The authenticated tenant-admin whose failed command created this durable
  -- recovery record. It becomes NULL only when the Auth user is deleted, like
  -- the system audit trail; ordinary recovery records are always attributable.
  actor_user_id uuid references auth.users(id) on delete set null,
  quote_version_id uuid not null,
  correlation_id uuid not null,
  failure_stage text not null check (failure_stage in ('artifact_preparation', 'finalization')),
  recovery_state text not null check (recovery_state in ('orphaned', 'invalidated')),
  created_at timestamptz not null default statement_timestamp(),
  constraint email_delivery_recoveries_quote_version_tenant_fk
    foreign key (quote_version_id, tenant_id)
    references public.quote_versions(id, tenant_id)
    on delete restrict,
  constraint email_delivery_recoveries_correlation_stage_unique
    unique (tenant_id, correlation_id, failure_stage)
);

alter table public.email_delivery_recoveries enable row level security;
alter table public.email_delivery_recoveries force row level security;
revoke all on public.email_delivery_recoveries from public, anon, authenticated, service_role;
grant select on public.email_delivery_recoveries to authenticated;
create policy email_delivery_recoveries_select_own
  on public.email_delivery_recoveries for select to authenticated
  using (public.is_tenant_admin(tenant_id));

-- The server command calls this only after a failed preparation/finalization
-- attempt. It verifies the request-bound actor and tenant-admin authority itself;
-- no direct DML grant exists for the append-only recovery ledger.
create function public.record_quote_email_delivery_recovery(
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
  if not public.is_tenant_admin(p_tenant_id) then
    raise exception 'quote delivery recovery requires tenant admin' using errcode = 'insufficient_privilege';
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
