-- Story 13.1: the single authenticated background-runner lane (ADR-B002).
-- This deliberately replaces the legacy forged-JWT cron pattern: application code
-- authenticates the scheduler secret before it creates this operational record.

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  producer text not null check (producer ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  window_started_at timestamptz not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  outcome text not null check (outcome in ('running', 'completed', 'partial', 'failed')),
  cursor text check (length(cursor) <= 512),
  correlation_id uuid not null,
  error_summary text check (error_summary is null or length(error_summary) <= 256),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check ((outcome = 'running') = (finished_at is null))
);

comment on table public.job_runs is
  'Tenant-scoped, append-only operational log for the sole ADR-B002 scheduler runner. No notification, preference, email, or outbox records are introduced here.';

create index job_runs_tenant_producer_started_idx
  on public.job_runs (tenant_id, producer, started_at desc);
create index job_runs_correlation_idx on public.job_runs (correlation_id);

revoke all on table public.job_runs from anon, authenticated;
grant select on table public.job_runs to authenticated;
grant select, insert on table public.job_runs to service_role;

alter table public.job_runs enable row level security;
alter table public.job_runs force row level security;

create policy job_runs_select_tenant_admin
  on public.job_runs for select to authenticated
  using (public.is_tenant_admin(tenant_id));

create or replace function public.job_runs_block_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'job_runs is append-only: % is not permitted', tg_op using errcode = 'restrict_violation';
end;
$$;
create trigger job_runs_append_only before update or delete on public.job_runs
  for each row execute function public.job_runs_block_mutation();
