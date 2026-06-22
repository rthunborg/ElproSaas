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
 * Tenant authority is membership-derived; a client-supplied `tenant_id` is IGNORED — never
 * trusted as the authority. It is read from `membership.tenant_id` regardless of any client
 * value (matching, mismatched, or absent), so a stale/spoofed id can never widen access nor
 * deny a rightful admin (AC4 / R-004).
 *
 * NOTE (test-infra sequencing): `tenant_memberships` and its RLS land in Story 2.2's
 * local Supabase stack. This code reads that documented shape; the authoritative
 * DB-backed INT/RLS tests are owned by 2.2 (test-design "Critical Prerequisite"). The
 * branch logic is unit-tested NOW via `resolve-tenant-context-core.ts`.
 */
import type { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { err } from "@/lib/result/result";
import {
  resolveTenantContextCore,
  type MembershipRow,
  type ResolveTenantContextResult,
  type ResolvedUser,
} from "./resolve-tenant-context-core";
import {
  TENANT_ADMIN_ROLE,
  TENANT_CONTEXT_MESSAGES,
  type MembershipStatus,
} from "./tenant-context";

/** The minimal slice of the Supabase server client the resolver depends on. */
type SupabaseAuthClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type ResolveTenantContextOptions = {
  /**
   * Optional client-supplied tenant id (e.g. from a request param/header). It is NOT the
   * authority and has NO effect on the resolved tenant: it is IGNORED entirely (the tenant
   * always comes from the membership row). The parameter is retained only so callers may
   * detect/log a spoof attempt out-of-band — passing a mismatched value never denies, never
   * widens access (AC4 / R-004). Omit it for the normal "resolve my tenant" path.
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
  // Wrap ALL I/O (client creation, missing-env throw, SDK/network rejections in
  // `getClaims()` / the membership query) so a thrown error NEVER escapes the typed
  // `Result` boundary as an unhandled Next.js 500 (which could leak a stack trace and
  // bypass the documented user-safe boundary state). Any throw maps to the generic
  // no-access result — fail closed, never fail open. (Review fix: edge/blind layers.)
  try {
    return await resolveTenantContextInner(options);
  } catch {
    // Generic, user-safe denial. We deliberately reuse TENANT_MEMBERSHIP_REQUIRED's
    // generic message (no internal detail, no stack trace, no tenant/user existence
    // signal). A distinct transient/SERVER_ERROR code is deferred to Story 2.2's broader
    // error-code taxonomy (see Review Findings → Defer).
    return err(
      "TENANT_MEMBERSHIP_REQUIRED",
      TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
    );
  }
}

async function resolveTenantContextInner(
  options: ResolveTenantContextOptions,
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
  //     a DISTINCT no-access case from "no row at all" (test requirement). Prefer an
  //     `active` row first (then oldest) so a disabled-then-reactivated admin (older
  //     `disabled` + newer `active` row) is NOT denied by a stale row sorting first.
  const { data: membershipData, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status, tenants(name)")
    .eq("user_id", user.id)
    .eq("role", TENANT_ADMIN_ROLE)
    .order("status", { ascending: true }) // 'active' < 'disabled' < 'invited' lexically; prefer active.
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const membership: MembershipRow | null =
    !membershipError &&
    membershipData &&
    // Guard against a null/empty tenant_id (orphaned FK / partial insert): an empty tenant
    // would silently mis-scope every later tenant query. Treat it as no-access.
    typeof membershipData.tenant_id === "string" &&
    membershipData.tenant_id !== ""
      ? {
          tenant_id: membershipData.tenant_id,
          role: membershipData.role,
          // Coerce the raw DB string to the `MembershipStatus` union at the edge. Only the
          // three known lifecycle values pass through; ANYTHING else (NULL, a future/unknown
          // status, a typo) coerces to the DENYING `disabled` so it can never widen access —
          // fail closed. The pure core then governs the decision via the narrowed union.
          status: normalizeMembershipStatus(membershipData.status),
          tenant_name: extractTenantName(membershipData.tenants),
        }
      : null;

  // (c) Pure decision (active + role; client-tenant-id is ignored, never the authority).
  return resolveTenantContextCore({
    user,
    membership,
    clientTenantId: options.clientTenantId ?? null,
  });
}

/**
 * Coerce a raw DB `status` string to the `MembershipStatus` union. Only the three known
 * lifecycle values are accepted; any other value (NULL, empty, a future/unknown status)
 * maps to `disabled` — a DENYING status — so an unrecognized status can never be treated
 * as `active`. Fail closed (architecture §8; review fix: enforce the union).
 */
function normalizeMembershipStatus(status: unknown): MembershipStatus {
  if (status === "active" || status === "invited" || status === "disabled") {
    return status;
  }
  return "disabled";
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
