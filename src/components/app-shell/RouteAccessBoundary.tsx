import { NoTenantAccess } from "@/components/app-shell/NoTenantAccess";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { canAccessPhaseARoute } from "@/server/authz/phase-a-surface";
import { TENANT_CONTEXT_MESSAGES } from "@/server/auth/tenant-context";

/**
 * Server-only route gate for an active Phase A module. Navigation is only a
 * presentation DTO; this boundary makes a crafted direct URL fail before its
 * page (and therefore its RLS-backed reads) is rendered.
 */
export async function RouteAccessBoundary({
  route,
  children,
}: {
  readonly route: string;
  readonly children: React.ReactNode;
}) {
  const context = await resolveTenantContext();
  if (!context.ok || !canAccessPhaseARoute(context.data.roles, route)) {
    return <NoTenantAccess message={TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED} />;
  }

  return children;
}
