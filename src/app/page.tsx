import { redirect } from "next/navigation";
import { NoTenantAccess } from "@/components/app-shell/NoTenantAccess";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { TENANT_CONTEXT_MESSAGES } from "@/server/auth/tenant-context";
import { resolveLandingRoute } from "@/server/authz/phase-a-surface";

/**
 * Root entry is a server-derived landing boundary.  A static `/dashboard`
 * redirect would let an otherwise valid non-admin context ignore the matrix
 * when the first route it can use changes.  The app layout remains the normal
 * protection boundary for every concrete route; this only chooses the first
 * allowed route from the cookie-bound server context.
 */
export default async function Home() {
  const context = await resolveTenantContext();
  if (!context.ok) {
    if (context.code === "UNAUTHENTICATED") redirect("/login");
    return (
      <NoTenantAccess
        message={TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED}
      />
    );
  }

  const landing = resolveLandingRoute(context.data.roles);
  if (landing) redirect(landing);

  return (
    <NoTenantAccess
      message={TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED}
    />
  );
}
