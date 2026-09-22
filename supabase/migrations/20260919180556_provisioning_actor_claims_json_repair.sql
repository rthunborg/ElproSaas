-- PostgREST supplies the authenticated request as request.jwt.claims JSON in
-- the current runtime. Keep the actor extraction independent of auth.uid(),
-- while the existing is_platform_operator() check remains the live allow-list
-- proof. The prior additive function body is replaced verbatim except here.
do $body$
declare
  v_definition text;
  v_old text := $$v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;$$;
  v_new text := $$v_actor := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;$$;
begin
  select pg_get_functiondef('public.provision_tenant(text,jsonb)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'expected legacy provisioning actor expression is absent';
  end if;
  execute replace(v_definition, v_old, v_new);
end $body$;

alter function public.provision_tenant(text,jsonb) owner to provisioning_function_owner;
revoke all on function public.provision_tenant(text,jsonb) from public, anon, authenticator, service_role;
grant execute on function public.provision_tenant(text,jsonb) to authenticated;
