/**
 * `resolveTenantContext` — the SERVER authority for tenant context (Story 2.1, AC1-AC4;
 * architecture §5 command shape steps 1-4, §6, §8).
 *
 * It performs NO mutation (§5 marks it "No mutation"). Steps, in order:
 *   (a) Re-validate the authenticated user from server cookies via `getClaims()`
 *       (validates the JWT signature against the project's published public keys).
 *       NEVER `getSession()` — it is not guaranteed to re-validate in server code
 *       (architecture §5 step 1; @supabase/ssr SSR security guidance).
 *   (b) Load the user's `tenant_admin` membership from `tenant_memberships`.
 *   (c) Delegate the active/role/spoof decision to the pure core.
 *
 * Tenant authority is membership-derived; a client-supplied `tenant_id` is ignored or
 * (when supplied and mismatched) denied — never trusted as the authority (AC4 / R-004).
 *
 * NOTE (test-infra sequencing): `tenant_memberships` and its RLS land in Story 2.2's
 * local Supabase stack. This code reads that documented shape; the authoritative
 * DB-backed INT/RLS tests are owned by 2.2 (test-design "Critical Prerequisite"). The
 * branch logic is unit-tested NOW via `resolve-tenant-context-core.ts`.
 */
import type { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import {
  resolveTenantContextCore,
  type MembershipRow,
  type ResolveTenantContextResult,
  type ResolvedUser,
} from "./resolve-tenant-context-core";
import { TENANT_ADMIN_ROLE } from "./tenant-context";

/** The minimal slice of the Supabase server client the resolver depends on. */
type SupabaseAuthClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type ResolveTenantContextOptions = {
  /**
   * Optional client-supplied tenant id (e.g. from a request param/header). It is NOT the
   * authority — passing it only lets the resolver DENY a mismatch (AC4 / R-004). Omit it
   * for the normal "resolve my tenant" path.
   */
  readonly clientTenantId?: string | null;
  /**
   * Optional pre-built, request-bound Supabase server client. Production callers omit it
   * (a fresh per-request client is created here). Story 2.2's DB-backed integration tests
   * INJECT an authenticated/anon test client to drive the resolver against the local
   * stack without re-resolving cookies (test-design "Critical Prerequisite").
   */
  readonly client?: SupabaseAuthClient;
};

export async function resolveTenantContext(
  options: ResolveTenantContextOptions = {},
): Promise<ResolveTenantContextResult> {
  // The default client factory imports `next/headers` (Next-bundler-only). Load it LAZILY
  // and only when no client is injected, so importing this resolver in a plain Node test
  // (with an injected fake client) never pulls in `next/headers`. The `import type` above
  // keeps the type reference without an eager runtime dependency.
  const supabase =
    options.client ??
    (await (
      await import("@/server/db/supabase-server-client")
    ).createSupabaseServerClient());

  // (a) Re-validate the user. `getClaims` reads the access token and verifies it locally
  //     against the project's published JWKS (no trust in unrevalidated session cookies).
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const claims = claimsData?.claims;
  const user: ResolvedUser | null =
    !claimsError && claims && typeof claims.sub === "string"
      ? {
          id: claims.sub,
          email: typeof claims.email === "string" ? claims.email : null,
        }
      : null;

  // Short-circuit before touching the DB if there is no authenticated user.
  if (!user) {
    return resolveTenantContextCore({
      user: null,
      membership: null,
      clientTenantId: options.clientTenantId ?? null,
    });
  }

  // (b) Load this user's `tenant_admin` membership row. RLS (Story 2.2) restricts the row
  //     to the caller; we still re-derive authority from the row, not from any client id.
  //     We do NOT filter on `status` so the pure core can treat a disabled/invited row as
  //     a DISTINCT no-access case from "no row at all" (test requirement).
  const { data: membershipData, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status, tenants(name)")
    .eq("user_id", user.id)
    .eq("role", TENANT_ADMIN_ROLE)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const membership: MembershipRow | null =
    !membershipError && membershipData
      ? {
          tenant_id: membershipData.tenant_id,
          role: membershipData.role,
          status: membershipData.status,
          tenant_name: extractTenantName(membershipData.tenants),
        }
      : null;

  // (c) Pure decision (active + role + client-tenant-id spoof check).
  return resolveTenantContextCore({
    user,
    membership,
    clientTenantId: options.clientTenantId ?? null,
  });
}

/**
 * The embedded `tenants(name)` relation may come back as an object or a single-element
 * array depending on the PostgREST relationship cardinality. Normalize to a display name
 * or null. Presentational only — never an authority input.
 */
function extractTenantName(
  tenants: unknown,
): string | null {
  if (!tenants) return null;
  const row = Array.isArray(tenants) ? tenants[0] : tenants;
  if (row && typeof row === "object" && "name" in row) {
    const name = (row as { name: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}
