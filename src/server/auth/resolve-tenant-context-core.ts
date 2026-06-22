/**
 * PURE decision core for tenant-context resolution (Story 2.1, AC1-AC4).
 *
 * This module contains NO I/O and NO Supabase SDK — it takes already-fetched inputs (the
 * re-validated user, and the membership row or its absence) and decides the typed
 * `Result`. Keeping the branch logic pure is what makes it exhaustively unit-testable
 * NOW, before Story 2.2's local Supabase stack exists (test-design "Critical Prerequisite";
 * the authoritative DB-backed INT/RLS tests are owned by 2.2). The orchestrator
 * (`resolve-tenant-context.ts`) performs the I/O and delegates every decision here.
 *
 * Decision order (architecture §5 steps 1-4):
 *   1. No re-validated user            -> UNAUTHENTICATED
 *   2. No membership row               -> TENANT_MEMBERSHIP_REQUIRED
 *   3. status !== 'active'             -> TENANT_MEMBERSHIP_REQUIRED  (distinct case)
 *   4. role  !== 'tenant_admin'        -> TENANT_MEMBERSHIP_REQUIRED
 *   5. (client tenant_id, matching OR mismatched) -> IGNORED; tenant stays membership-derived
 *   otherwise                          -> Ok(TenantContext)
 *
 * AC4 / R-004: a client-supplied `tenant_id` is NEVER an input to the authority decision.
 * The optional `clientTenantId` is accepted only so the caller can detect/log a spoof
 * attempt out-of-band; the resolved tenant is ALWAYS `membership.tenant_id`. A
 * stale/spoofed client value is ignored, never trusted — it can never widen access,
 * redirect to another tenant, OR deny a rightful admin out of their own tenant.
 */
import { err, ok, type Result } from "@/lib/result/result";
import {
  TENANT_ADMIN_ROLE,
  TENANT_CONTEXT_MESSAGES,
  type MembershipStatus,
  type TenantContext,
  type TenantContextErrorCode,
} from "./tenant-context";

/** The minimal shape of a re-validated user (from `getClaims()`/`getUser()`). */
export type ResolvedUser = {
  readonly id: string;
  readonly email: string | null;
};

/**
 * The minimal shape of a `tenant_memberships` row needed for the decision.
 *
 * `status` is narrowed to the `MembershipStatus` union (NOT a bare `string`) so the
 * precise three-value lifecycle in `tenant-context.ts` actually GOVERNS this boundary and
 * the type cannot drift from the runtime check (review fix). The DB edge in
 * `resolve-tenant-context.ts` is responsible for coercing any unrecognized DB value to a
 * DENYING status (`disabled`) before constructing this row — so an unknown status can
 * never sneak through as `active`, and the union here is authoritative.
 */
export type MembershipRow = {
  readonly tenant_id: string;
  readonly role: string;
  readonly status: MembershipStatus;
  /** Optional joined tenant display name (presentational only). */
  readonly tenant_name?: string | null;
};

export type ResolveTenantContextCoreInput = {
  /** Null when the session is missing/invalid (no re-validated user). */
  readonly user: ResolvedUser | null;
  /** Null when no active `tenant_admin` membership row was found for the user. */
  readonly membership: MembershipRow | null;
  /**
   * Optional client-supplied tenant id (query/body/header/cookie). NEVER the authority and
   * NEVER an input to the decision: it is IGNORED (the tenant is always
   * `membership.tenant_id`). Retained only so callers may detect/log a spoof attempt
   * out-of-band — it can never widen access nor deny a rightful admin (AC4 / R-004).
   */
  readonly clientTenantId?: string | null;
};

export type ResolveTenantContextResult = Result<
  TenantContext,
  TenantContextErrorCode
>;

export function resolveTenantContextCore(
  input: ResolveTenantContextCoreInput,
): ResolveTenantContextResult {
  const { user, membership, clientTenantId } = input;

  // 1. Unauthenticated: no re-validated user.
  if (!user || !user.id) {
    return err("UNAUTHENTICATED", TENANT_CONTEXT_MESSAGES.UNAUTHENTICATED);
  }

  // 2. No membership row at all.
  if (!membership) {
    return err(
      "TENANT_MEMBERSHIP_REQUIRED",
      TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
    );
  }

  // 3. Status must be strictly 'active' (invited/disabled/anything else = no access).
  //    This is a DISTINCT denial case from "no membership row" (test req).
  if (membership.status !== "active") {
    return err(
      "TENANT_MEMBERSHIP_REQUIRED",
      TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
    );
  }

  // 4. Role must be 'tenant_admin' (Phase A only role). Any other role is rejected.
  if (membership.role !== TENANT_ADMIN_ROLE) {
    return err(
      "TENANT_MEMBERSHIP_REQUIRED",
      TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
    );
  }

  // 5. AC4 / R-004: tenant authority is membership-derived. A client-supplied tenant id is
  //    NEVER an input to the decision — it is IGNORED entirely (AC4's "ignored" branch).
  //    Whether it is absent, matching, or a stale/spoofed mismatch, the resolved tenant
  //    always comes from the server-side membership row, never from the client value. The
  //    client value can only ever be ignored — it can never widen, redirect, or DENY
  //    access. (Ignoring a stale bookmarked/spoofed id means a rightful admin is never
  //    self-DoSed out of their own tenant; the load-bearing "never widens access" property
  //    still holds because the tenant is read from `membership.tenant_id` below, not from
  //    `clientTenantId`.) The parameter is retained only so callers may detect/log a spoof
  //    attempt out-of-band; it has no effect on the authority decision here.
  void clientTenantId;

  return ok({
    userId: user.id,
    tenantId: membership.tenant_id,
    role: TENANT_ADMIN_ROLE,
    status: "active",
    userEmail: user.email,
    tenantName: membership.tenant_name ?? null,
  });
}
