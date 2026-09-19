-- Preserve the revoked hash as an auditable, non-secret fact. The raw token is
-- never available to this trigger or any database row.
alter table public.tenant_provisioning_invites
  add column if not exists revoked_token_hash text;

create or replace function public.capture_provisioning_revoked_token_hash()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.token_hash is distinct from old.token_hash then
    new.revoked_token_hash := old.token_hash;
    new.revoked_at := statement_timestamp();
  end if;
  return new;
end $$;

drop trigger if exists tenant_provisioning_invites_capture_revoked_hash on public.tenant_provisioning_invites;
create trigger tenant_provisioning_invites_capture_revoked_hash
before update of token_hash on public.tenant_provisioning_invites
for each row execute function public.capture_provisioning_revoked_token_hash();
revoke all on function public.capture_provisioning_revoked_token_hash() from public;
