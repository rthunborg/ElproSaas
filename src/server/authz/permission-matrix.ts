import { isTenantRole, normalizeRoles, type TenantRole } from "./roles";

type PermissionRow = { readonly roles: readonly TenantRole[] };
type ModulePermissions = Record<string, PermissionRow>;

/**
 * Server-only, versioned authorization source. The Phase A seed is the
 * owner-approved N-4 matrix. It deliberately names stable business operations
 * instead of pages or widgets so command and RLS policies can share it.
 */
export const PERMISSION_MATRIX = {
  foundation: { "Memberships.Manage": { roles: ["tenant_admin"] } },
  rbac: { "Memberships.Manage": { roles: ["tenant_admin"] } },
  dashboard: { "Dashboard.View": { roles: ["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"] } },
  crm: {
    "Customers.View": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Customers.Create": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Customers.Edit": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Customers.Delete": { roles: ["tenant_admin"] },
  },
  settings: {
    "CompanySettings.View": { roles: ["tenant_admin"] },
    "CompanySettings.Edit": { roles: ["tenant_admin"] },
    "Pricing.Edit": { roles: ["tenant_admin", "projektledare"] },
  },
  calculations: {
    // Calculation rows carry inline costs and markup. Until their economy data is
    // split out, Säljare is deliberately closed at module level (ADR-B001 §3.6).
    "Calculations.View": { roles: ["tenant_admin", "projektledare"] },
    "Calculations.Create": { roles: ["tenant_admin", "projektledare"] },
    "Calculations.Edit": { roles: ["tenant_admin", "projektledare"] },
  },
  quotes: {
    "Quotes.View": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Quotes.Create": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Quotes.Edit": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Quotes.Approve": { roles: ["tenant_admin", "projektledare"] },
    "Quotes.Send": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Quotes.Export": { roles: ["tenant_admin", "projektledare", "saljare"] },
    // Compatibility key retained for Story 11.1's public capability contract.
    // New Phase-A callers use the Economy.* vocabulary below.
    "Quotes.ViewSalesPrice": { roles: ["tenant_admin", "projektledare", "saljare", "ekonomi"] },
    "Economy.ViewSalesPrice": { roles: ["tenant_admin", "projektledare", "saljare", "ekonomi"] },
    "Economy.EditSalesPrice": { roles: ["tenant_admin", "projektledare", "saljare"] },
    "Economy.ViewCostPrice": { roles: ["tenant_admin", "projektledare", "ekonomi"] },
    "Economy.EditCostPrice": { roles: ["tenant_admin", "projektledare", "ekonomi"] },
    "Economy.ViewContributionMargin": { roles: ["tenant_admin", "projektledare", "ekonomi"] },
  },
  jobs: {
    // `Jobs.ViewAssigned` is intentionally empty: job_members does not exist
    // until E16, so granting it here would accidentally mean tenant-wide access.
    "Jobs.ViewAssigned": { roles: [] },
    "Jobs.ViewAll": { roles: ["tenant_admin", "projektledare"] },
    "Jobs.Create": { roles: ["tenant_admin", "projektledare"] },
    "Jobs.Edit": { roles: ["tenant_admin", "projektledare"] },
    "Jobs.Delete": { roles: ["tenant_admin"] },
    "Jobs.AssignUsers": { roles: [] },
    "Jobs.ApproveCompletion": { roles: ["tenant_admin", "projektledare"] },
  },
  files: {
    // Phase A has neither job_members nor file-owner assignment scope. Montör
    // access therefore stays closed rather than becoming a tenant-wide grant.
    "Files.View": { roles: ["tenant_admin", "projektledare"] },
    "Files.Create": { roles: ["tenant_admin", "projektledare"] },
    "Files.Edit": { roles: ["tenant_admin", "projektledare"] },
  },
} as const satisfies Record<string, ModulePermissions>;

export const SENSITIVE_FIELD_MATRIX: Record<string, Record<string, PermissionRow>> = {
  quotes: {
    sales_price_ore: { roles: ["tenant_admin", "projektledare", "saljare", "ekonomi"] },
    cost_price_ore: { roles: ["tenant_admin", "projektledare", "ekonomi"] },
    contribution_margin_ore: { roles: ["tenant_admin", "projektledare", "ekonomi"] },
    acceptedValueOre: { roles: ["tenant_admin", "projektledare", "ekonomi"] },
  },
};

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
