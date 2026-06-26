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
  // bypass the documented user-safe boundary state).
  //
  // A THROW here is an INFRASTRUCTURE failure (client/env construction, network/SDK
  // rejection), NOT an authorization outcome. Story 2.2 (Task 7.1) maps it to the distinct
  // transient `SERVER_ERROR` code — fail CLOSED (no access granted) but do NOT mislabel an
  // outage as a permanent "no membership" denial. The message stays generic (no internal
  // detail, no stack trace, no tenant/user existence signal).
  try {
    return await resolveTenantContextInner(options);
  } catch {
    return err("SERVER_ERROR", TENANT_CONTEXT_MESSAGES.SERVER_ERROR);
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

  // (b) Load this user's `tenant_admin` membership row(s). RLS (Story 2.2) restricts the
  //     rows to the caller; we still re-derive authority from the row, not from any client
  //     id. We do NOT filter on `status` so the pure core can treat a disabled/invited row
  //     as a DISTINCT no-access case from "no row at all" (test requirement).
  //
  //     Task 7.2: do NOT rely on a lexicographic `.order("status")` to surface an `active`
  //     row first (that fragile ordering — 'active' < 'disabled' < 'invited' — would be
  //     silently wrong if a future status sorted before 'active'). Instead fetch the small
  //     candidate set and select the preferred row EXPLICITLY below (active-first, then
  //     oldest). The `(tenant_id, user_id)` UNIQUE constraint means a single user has at
  //     most one row per tenant, so this set is only non-trivial ACROSS tenants.
  //
  //     Cap correctness (review fix 2026-06-26): the candidate set is bounded by an explicit
  //     `.limit(10)` blast-radius guard, but the preferred row is the `active` one — which
  //     `created_at` ordering alone does NOT guarantee survives the cap (a >10-tenant admin
  //     whose only active row is the 11th-oldest would have it truncated, silently locking
  //     out a rightful admin). So we fetch ACTIVE rows FIRST in a bounded query: filtering
  //     `status='active'` at the SQL layer means the active row can never be truncated by the
  //     cap, regardless of tenant count. Only when NO active row exists do we fall back to a
  //     capped fetch of the remaining rows — needed solely so the pure core can distinguish a
  //     disabled/invited membership (TENANT_MEMBERSHIP_REQUIRED, a deliberate case) from "no
  //     row at all". The pure-core active-first selection stays the authority over both sets.
  const baseQuery = () =>
    supabase
      .from("tenant_memberships")
      .select("tenant_id, role, status, created_at, tenants(name)")
      .eq("user_id", user.id)
      .eq("role", TENANT_ADMIN_ROLE);

  // (b1) Active rows first — filtered, so the user's active membership is NEVER capped out.
  const { data: activeRows, error: activeError } = await baseQuery()
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(10);

  // A real query error is a TRANSIENT infrastructure failure (DB down, RLS misconfig, pool
  // exhaustion) — NOT "you have no membership". Map it to the distinct SERVER_ERROR code so
  // an outage is never mislabeled as a permanent no-access denial (Task 7.1). Fail closed.
  if (activeError) {
    return err("SERVER_ERROR", TENANT_CONTEXT_MESSAGES.SERVER_ERROR);
  }

  // (b2) Fall back to the full capped set ONLY when there is no active row, so the pure core
  //      can still treat a disabled/invited row as a DISTINCT no-access case from "no row".
  let membershipRows = activeRows ?? [];
  if (membershipRows.length === 0) {
    const { data: anyRows, error: anyError } = await baseQuery()
      .order("created_at", { ascending: true })
      .limit(10);
    if (anyError) {
      return err("SERVER_ERROR", TENANT_CONTEXT_MESSAGES.SERVER_ERROR);
    }
    membershipRows = anyRows ?? [];
  }

  const membership = selectPreferredMembership(membershipRows);

  // (c) Pure decision (active + role; client-tenant-id is ignored, never the authority).
  return resolveTenantContextCore({
    user,
    membership,
    clientTenantId: options.clientTenantId ?? null,
  });
}

/** The raw shape PostgREST returns for the membership query (pre-normalization). */
type RawMembershipRow = {
  readonly tenant_id?: unknown;
  readonly role?: unknown;
  readonly status?: unknown;
  readonly created_at?: unknown;
  readonly tenants?: unknown;
};

/**
 * Select the PREFERRED membership from the candidate set and normalize it to a
 * `MembershipRow` (Task 7.2 — replaces the fragile lexicographic `.order("status")`).
 *
 * Preference, applied EXPLICITLY (not via string-sort luck):
 *   1. An `active` row wins over any non-active row (a disabled-then-reactivated admin is
 *      never denied by a stale `disabled` row).
 *   2. Among rows of equal active-ness, the OLDEST (`created_at` ascending — already the
 *      query order) wins for stability.
 * Rows with a null/empty `tenant_id` (orphaned FK / partial insert) are DROPPED — an empty
 * tenant would silently mis-scope every later tenant query. If, after filtering, no row
 * remains, returns null (the core then yields TENANT_MEMBERSHIP_REQUIRED).
 *
 * In Phase A the `(tenant_id, user_id)` UNIQUE constraint means at most one row per tenant,
 * so this only ever chooses BETWEEN tenants — and it deterministically prefers the active
 * one regardless of how the statuses would have sorted lexically.
 */
function selectPreferredMembership(
  rows: readonly RawMembershipRow[],
): MembershipRow | null {
  const normalized: MembershipRow[] = [];
  for (const raw of rows) {
    if (typeof raw.tenant_id !== "string" || raw.tenant_id === "") continue;
    // Fail CLOSED on a missing/empty role, mirroring the `tenant_id` guard above:
    // DROP the row rather than coercing to "" (which would push an empty-role row
    // into the candidate set). Defensive only — the query filters `.eq("role",
    // TENANT_ADMIN_ROLE)` and the DB CHECK bounds it — but it removes a fail-open
    // smell so an unexpected role can never be silently carried forward.
    if (typeof raw.role !== "string" || raw.role === "") continue;
    normalized.push({
      tenant_id: raw.tenant_id,
      role: raw.role,
      // Coerce the raw DB string to the union at the edge — unknown values fail closed to
      // the DENYING `disabled` so they can never be treated as `active`.
      status: normalizeMembershipStatus(raw.status),
      tenant_name: extractTenantName(raw.tenants),
    });
  }
  if (normalized.length === 0) return null;

  // Rows are already in `created_at` ascending order; a stable partition that puts the
  // first `active` row first preserves the oldest-wins tiebreak.
  const active = normalized.find((m) => m.status === "active");
  return active ?? normalized[0];
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
