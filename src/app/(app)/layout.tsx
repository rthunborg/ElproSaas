/**
 * Authenticated app-shell route-group layout — the PROTECTED-ROUTE BOUNDARY
 * (Story 2.1, Task 3.2; AC1/AC2/AC3).
 *
 * This is now a SERVER layout (no `"use client"`): it is the server-side authority for
 * the `(app)` group. On every request it resolves tenant context from the authenticated
 * user's ACTIVE `tenant_admin` membership — never from client input (architecture §5/§8).
 *
 * Outcomes (the load-bearing boundary of Epic 2):
 *   - UNAUTHENTICATED            → redirect to `/login` (AC3). No app shell, no data.
 *   - TENANT_MEMBERSHIP_REQUIRED → render a user-safe no-access state with ZERO tenant
 *                                  data loaded (AC2). The generic message never reveals
 *                                  whether a specific tenant/user exists (UX §11).
 *   - Ok(context)               → mount `AppShell`, passing the resolved tenant/user
 *                                  context DOWN for presentational display (AC1, Task 4).
 *
 * Per project-context (Framework-Specific Rules), the auth resolution is done in this
 * SERVER layout and the existing client `AppShell` island stays small — the authority is
 * never the client. `AppShell` is mounted only on success; the empty/no-access paths do
 * not render it.
 */
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { NoTenantAccess } from "@/components/app-shell/NoTenantAccess";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { TENANT_CONTEXT_MESSAGES } from "@/server/auth/tenant-context";
import { resolvePhaseANavigation } from "@/server/authz/phase-a-surface";

/** Generic, user-safe fallback for an unexpected throw (no internal detail leaked). */
const GENERIC_NO_ACCESS_MESSAGE = TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED;

/**
 * Protected routes are inherently per-request (they read auth cookies and re-resolve
 * tenant context every request), so they MUST NOT be statically prerendered. Forcing
 * dynamic rendering also keeps the build from evaluating `resolveTenantContext` (and the
 * Supabase env contract) at build time, where no request/session/env exists. This is the
 * correct posture for an authenticated boundary — never serve a cached anonymous shell.
 */
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `resolveTenantContext` already maps thrown I/O to a typed `Result` (it never throws for
  // logical failures). This try/catch is defense-in-depth: a genuinely-unexpected throw
  // falls back to the user-safe no-access render instead of an unhandled Next.js 500 that
  // could leak a stack trace. The `redirect()` below is OUTSIDE this try block, so its
  // Next.js control-flow sentinel is never swallowed here.
  let result;
  try {
    result = await resolveTenantContext();
  } catch {
    return <NoTenantAccess message={GENERIC_NO_ACCESS_MESSAGE} />;
  }

  if (!result.ok) {
    if (result.code === "UNAUTHENTICATED") {
      // AC3: no re-validated user → redirect to the auth entry. No tenant data loaded.
      redirect("/login");
    }
    // AC2: authenticated but no ACTIVE tenant_admin membership → user-safe no-access state.
    // No app shell, no tenant-owned data. The message is the generic, server-mapped one.
    return <NoTenantAccess message={result.message} />;
  }

  // AC1: success → mount the shell with the server-resolved context (presentational).
  return (
    <AppShell
      context={{
        tenantName: result.data.tenantName,
        userEmail: result.data.userEmail,
      }}
      navigation={resolvePhaseANavigation(result.data.roles)}
    >
      {children}
    </AppShell>
  );
}
