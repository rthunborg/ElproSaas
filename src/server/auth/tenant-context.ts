/**
 * Types for server-resolved tenant context (Story 2.1, architecture §5/§8).
 *
 * The tenant context is the load-bearing authority of Epic 2: it is derived from the
 * authenticated user's ACTIVE `tenant_admin` membership, never from client input
 * (query/body/header/cookie). A client-supplied `tenant_id` is ignored or verified
 * against this resolved value; a mismatch never widens access (test-design R-004).
 */

/** Phase A is `tenant_admin` only (architecture §6, §8). */
export const TENANT_ADMIN_ROLE = "tenant_admin" as const;
export type TenantRole = typeof TENANT_ADMIN_ROLE;

/** Membership lifecycle status (architecture §8). ONLY `active` grants access. */
export type MembershipStatus = "active" | "invited" | "disabled";

/** The server-resolved context returned on success. `tenantId` is membership-derived. */
export type TenantContext = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: TenantRole;
  readonly status: Extract<MembershipStatus, "active">;
  /** Presentational only — display value for the top bar. Not an authority input. */
  readonly userEmail: string | null;
  /** Presentational only — tenant/company display name when available. */
  readonly tenantName: string | null;
};

/**
 * Stable typed failure codes (architecture §5). Mapped to user-safe messages; they never
 * leak whether a specific tenant/user exists, stack traces, or internal detail.
 *
 * - `UNAUTHENTICATED`           — no/invalid session (no re-validated user).
 * - `TENANT_MEMBERSHIP_REQUIRED`— authenticated, but no ACTIVE `tenant_admin` membership
 *   (covers: no membership row, non-`active` status such as `invited`/`disabled`, and a
 *   non-`tenant_admin` role).
 */
export type TenantContextErrorCode =
  | "UNAUTHENTICATED"
  | "TENANT_MEMBERSHIP_REQUIRED";

/** User-safe messages. Deliberately generic — no cross-tenant leakage (UX §11). */
export const TENANT_CONTEXT_MESSAGES: Record<TenantContextErrorCode, string> = {
  UNAUTHENTICATED: "Du måste vara inloggad för att fortsätta.",
  TENANT_MEMBERSHIP_REQUIRED:
    "Ditt konto har ingen aktiv behörighet till ett företag. Kontakta din administratör.",
};
