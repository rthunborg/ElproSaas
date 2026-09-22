-- Only the dedicated NOLOGIN function owner may renew the bound membership expiry.
grant update(invitation_expires_at) on public.tenant_memberships to provisioning_function_owner;

-- PR #72: resume committed handoffs and renew expired first-Admin invitations.
-- Amend the sole attested writer; preserve all prior validation and privileges.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.provision_tenant(text,jsonb)'::regprocedure) into v_definition;
  v_old := $old$'reservationDispatchGeneration',v_invite.dispatch_generation,'tokenHash',nullif(v_invite.token_hash,'')$old$;
  v_new := $new$'reservationDispatchGeneration',v_invite.dispatch_generation,'tokenHash',nullif(v_invite.token_hash,''),
      'originalRequest',v_existing.request_payload - array['normalizedOrganizationNumber','vatRegistrationNumber','firstAdminEmail','canonicalRequestHash'],
      'invitationExpired',(v_invite.expires_at <= statement_timestamp() or exists (
        select 1 from public.tenant_memberships m where m.id=v_invite.membership_id
          and (m.status = 'expired' or m.invitation_expires_at <= statement_timestamp())))$new$;
  if position(v_old in v_definition) = 0 then raise exception 'provisioning recovery seam 1 changed'; end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_old := $old$or v_membership_row.invitation_expires_at <= statement_timestamp()$old$;
  v_new := $new$$new$;
  if position(v_old in v_definition) = 0 then raise exception 'provisioning recovery seam 2 changed'; end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_old := $old$if v_invite.dispatch_generation >= 3 then$old$;
  v_new := $new$if v_invite.dispatch_generation >= 3 or v_invite.expires_at <= statement_timestamp()
       or v_membership_row.invitation_expires_at <= statement_timestamp() or v_membership_row.status = 'expired' then$new$;
  if position(v_old in v_definition) = 0 then raise exception 'provisioning recovery seam 3 changed'; end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_old := $old$(v_att->>'approvalGeneration')::integer <= v_existing.approval_generation$old$;
  v_new := $new$(v_att->>'approvalGeneration')::integer is distinct from v_existing.approval_generation + 1$new$;
  if position(v_old in v_definition) = 0 then raise exception 'provisioning recovery seam 4 changed'; end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_old := $old$    v_reservation := gen_random_uuid();$old$;
  v_new := $new$    -- Membership and capability expiry belong to the same new invitation generation.
    -- Existing pending-reservation guard runs before renewal; provider work remains post-commit.
    if v_is_renewal then
      v_invite.expires_at := statement_timestamp() + interval '24 hours';
      update public.tenant_memberships set invitation_expires_at=v_invite.expires_at,status='invited'
        where id=v_invite.membership_id and tenant_id=v_tenant;
      update public.tenant_provisioning_invites set expires_at=v_invite.expires_at where tenant_id=v_tenant;
    end if;
    v_reservation := gen_random_uuid();$new$;
  if position(v_old in v_definition) = 0 then raise exception 'provisioning recovery seam 5 changed'; end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_old := $old$or v_membership_row.status <> 'invited'$old$;
  v_new := $new$or v_membership_row.status not in ('invited','expired')$new$;
  if position(v_old in v_definition) = 0 then raise exception 'provisioning recovery membership state seam changed'; end if;
  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end $migration$;

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
