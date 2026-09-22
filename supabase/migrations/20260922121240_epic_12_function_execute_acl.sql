-- Hosted default privileges can grant roles EXECUTE directly; revoking PUBLIC
-- in the original migrations does not remove those independent grants.
revoke execute on function public.is_platform_operator() from anon;

-- This function is a trigger implementation, not an RPC. Existing trigger
-- execution does not require the updating role to hold function EXECUTE.
revoke execute on function public.audit_onboarding_checklist_dismissal()
  from anon, authenticated, service_role;
