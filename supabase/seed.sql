-- ============================================================================

-- Story 10.9 local/integration-test fixture only. This is deliberately not a
-- production key: deployment provisioning must create the matching Vault secret
-- (`quote_pdf_attestation_<key-id>`) independently and supply Node's non-public
-- QUOTE_PDF_ATTESTATION_KEY_ID / QUOTE_PDF_ATTESTATION_HMAC_SECRET variables.
do $$
declare
  v_secret_id uuid;
begin
  select id into v_secret_id
    from vault.secrets where name = 'quote_pdf_attestation_test_v1';
  if v_secret_id is null then
    perform vault.create_secret(
      'local-test-only-quote-pdf-attestation-secret-v1',
      'quote_pdf_attestation_test_v1',
      'Story 10.9 local integration-test HMAC fixture only'
    );
  else
    -- Repeated local resets/tests must not retain a stale key under the same
    -- fixture name. This touches only the explicitly test-only Vault record.
    perform vault.update_secret(
      v_secret_id,
      'local-test-only-quote-pdf-attestation-secret-v1',
      'quote_pdf_attestation_test_v1',
      'Story 10.9 local integration-test HMAC fixture only'
    );
  end if;
end;
$$;

-- Story 12.1 local-only fixture. Deployment provisions this independently; it
-- never supplies a fallback secret to application code.
do $$
declare v_secret_id uuid;
begin
  select id into v_secret_id from vault.secrets where name = 'tenant_provisioning_attestation_test_v1';
  if v_secret_id is null then
    perform vault.create_secret('local-test-only-provisioning-attestation-secret-v1', 'tenant_provisioning_attestation_test_v1', 'Story 12.1 local integration-test HMAC fixture only');
  else
    perform vault.update_secret(v_secret_id, 'local-test-only-provisioning-attestation-secret-v1', 'tenant_provisioning_attestation_test_v1', 'Story 12.1 local integration-test HMAC fixture only');
  end if;
end;
$$;

-- Story 10.8 local/integration-test fault-injection fixture. Keep the trigger
-- installed once by the reset/seed phase so parallel Vitest files never execute
-- CREATE/DROP TRIGGER against the shared audit_events table while other
-- transactions are writing it. Tests request a failure through correlation-scoped
-- DML in this non-exposed schema; no application/API role can access the control
-- table or function, and `supabase db push` does not apply seed.sql to demo/prod.
create schema if not exists test_support;
revoke all on schema test_support from public, anon, authenticated, service_role;

create table if not exists test_support.forced_audit_failures (
  correlation_id uuid primary key
);
revoke all on table test_support.forced_audit_failures
  from public, anon, authenticated, service_role;

create or replace function test_support.fail_requested_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from test_support.forced_audit_failures f
     where f.correlation_id = new.correlation_id
  ) then
    raise exception 'test-only forced audit failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function test_support.fail_requested_audit_event()
  from public, anon, authenticated, service_role;

drop trigger if exists test_only_forced_audit_failure on public.audit_events;
create trigger test_only_forced_audit_failure
  before insert on public.audit_events
  for each row execute function test_support.fail_requested_audit_event();
-- seed.sql — minimal deterministic baseline ONLY (architecture §18; test-design B1).
--
-- Loaded by `supabase db reset` AFTER migrations. Intentionally EMPTY of
-- business/tenant data: tenants, auth users, and tenant_admin memberships are
-- provisioned PER WORKER by the test-only factories (tests/factories/tenants.ts),
-- never here — so parallel test workers get isolated, disposable fixtures and no
-- shared mutable state (H5 / R-012).
--
-- Add only deterministic local/test fixtures or rows that every environment must
-- have. No tenant/business data belongs here.
-- ============================================================================
