/** Closed, code-owned tenant role vocabulary. */
export const TENANT_ROLES = [
  "tenant_admin",
  "projektledare",
  "montor",
  "saljare",
  "ekonomi",
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === "string" && (TENANT_ROLES as readonly string[]).includes(value);
}

/** Normalizes untrusted role lists into a de-duplicated, closed role set. */
export function normalizeRoles(roles: readonly unknown[] | undefined): TenantRole[] {
  if (!roles) return [];
  return [...new Set(roles.filter(isTenantRole))];
}
