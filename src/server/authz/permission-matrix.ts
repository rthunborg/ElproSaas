import { isTenantRole, normalizeRoles, type TenantRole } from "./roles";

type PermissionRow = { readonly roles: readonly TenantRole[] };
type ModulePermissions = Record<string, PermissionRow>;

/**
 * Server-only, versioned authorization source.  The deliberately conservative
 * seed preserves existing Admin access; Story 11.2 expands Phase-A access.
 */
export const PERMISSION_MATRIX = {
  foundation: { "Memberships.Manage": { roles: ["tenant_admin"] } },
  dashboard: { "Dashboard.View": { roles: ["tenant_admin"] } },
  crm: { "Customers.View": { roles: ["tenant_admin"] } },
  settings: { "Settings.View": { roles: ["tenant_admin"] } },
  calculations: { "Calculations.View": { roles: ["tenant_admin"] } },
  quotes: {
    "Quotes.View": { roles: ["tenant_admin"] },
    "Quotes.ViewSalesPrice": { roles: ["tenant_admin", "saljare"] },
  },
  jobs: { "Jobs.ViewAssigned": { roles: ["tenant_admin"] } },
  files: { "Files.View": { roles: ["tenant_admin"] } },
} as const satisfies Record<string, ModulePermissions>;

export const SENSITIVE_FIELD_MATRIX = {
  quotes: {
    cost_price_ore: { roles: ["tenant_admin", "projektledare", "ekonomi"] },
    acceptedValueOre: { roles: ["tenant_admin", "projektledare", "ekonomi"] },
  },
} as const satisfies Record<string, Record<string, PermissionRow>>;

export type CapabilityResolution = { readonly granted: boolean };

export function resolveCapability(input: {
  readonly roles?: readonly unknown[];
  readonly module?: unknown;
  readonly capability?: unknown;
  readonly matrix?: unknown;
}): CapabilityResolution {
  if (typeof input.module !== "string" || typeof input.capability !== "string") return { granted: false };
  const matrix = input.matrix === undefined ? PERMISSION_MATRIX : input.matrix;
  if (!matrix || typeof matrix !== "object") return { granted: false };
  const matrixModule = (matrix as Record<string, unknown>)[input.module];
  if (!matrixModule || typeof matrixModule !== "object") return { granted: false };
  const row = (matrixModule as Record<string, unknown>)[input.capability];
  if (!row || typeof row !== "object" || !Array.isArray((row as { roles?: unknown }).roles)) return { granted: false };
  const allowed = (row as { roles: unknown[] }).roles;
  if (!allowed.every(isTenantRole)) return { granted: false };
  return { granted: normalizeRoles(input.roles).some((role) => allowed.includes(role)) };
}

export function resolveSensitiveFieldEntitlement(input: {
  readonly roles?: readonly unknown[];
  readonly module?: unknown;
  readonly field?: unknown;
}): { readonly withheld: boolean } {
  if (typeof input.module !== "string" || typeof input.field !== "string") return { withheld: true };
  const fields = SENSITIVE_FIELD_MATRIX[input.module as keyof typeof SENSITIVE_FIELD_MATRIX];
  const row = fields && (fields as Record<string, PermissionRow>)[input.field];
  if (!row || !Array.isArray(row.roles) || !row.roles.every(isTenantRole)) return { withheld: true };
  return { withheld: !normalizeRoles(input.roles).some((role) => row.roles.includes(role)) };
}

export function permissionMatrixModuleIds(matrix: unknown = PERMISSION_MATRIX): string[] {
  if (!matrix || typeof matrix !== "object") return [];
  return Object.entries(matrix as Record<string, unknown>)
    .filter(([, capabilities]) => capabilities && typeof capabilities === "object" && Object.keys(capabilities).length > 0)
    .map(([moduleId]) => moduleId);
}
