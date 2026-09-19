-- Private dependency grant: the sole provisioning SECURITY DEFINER function
-- evaluates the existing platform allow-list under its non-login owner.
grant execute on function public.is_platform_operator() to provisioning_function_owner;
