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
 *   5. (client tenant_id mismatch)     -> ignored; resolution stays membership-derived
 *   otherwise                          -> Ok(TenantContext)
 *
 * AC4 / R-004: a client-supplied `tenant_id` is NEVER an input to the authority decision.
 * The optional `clientTenantId` is accepted only so the caller can detect/log a spoof
 * attempt; it is compared AFTER the membership tenant is resolved and can only ever
 * deny — it can never widen access or select a different tenant.
 */
import { err, ok, type Result } from "@/lib/result/result";
import {
  TENANT_ADMIN_ROLE,
  TENANT_CONTEXT_MESSAGES,
  type TenantContext,
  type TenantContextErrorCode,
} from "./tenant-context";

/** The minimal shape of a re-validated user (from `getClaims()`/`getUser()`). */
export type ResolvedUser = {
  readonly id: string;
  readonly email: string | null;
};

/** The minimal shape of a `tenant_memberships` row needed for the decision. */
export type MembershipRow = {
  readonly tenant_id: string;
  readonly role: string;
  readonly status: string;
  /** Optional joined tenant display name (presentational only). */
  readonly tenant_name?: string | null;
};

export type ResolveTenantContextCoreInput = {
  /** Null when the session is missing/invalid (no re-validated user). */
  readonly user: ResolvedUser | null;
  /** Null when no active `tenant_admin` membership row was found for the user. */
  readonly membership: MembershipRow | null;
  /**
   * Optional client-supplied tenant id (query/body/header/cookie). NEVER the authority.
   * Only used to deny a mismatch; can never widen access (AC4 / R-004).
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

  // 5. AC4 / R-004: tenant authority is membership-derived. A client-supplied tenant id
  //    is ignored when absent; when present and MISMATCHED it can only DENY — it never
  //    selects a different tenant or widens access. (A matching value is redundant.)
  if (
    clientTenantId != null &&
    clientTenantId !== "" &&
    clientTenantId !== membership.tenant_id
  ) {
    return err(
      "TENANT_MEMBERSHIP_REQUIRED",
      TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
    );
  }

  return ok({
    userId: user.id,
    tenantId: membership.tenant_id,
    role: TENANT_ADMIN_ROLE,
    status: "active",
    userEmail: user.email,
    tenantName: membership.tenant_name ?? null,
  });
}
