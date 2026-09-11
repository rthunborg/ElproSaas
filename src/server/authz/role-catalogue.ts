import { SCOPE_MANIFEST } from "@/scope/manifest";
import { normalizeRoles, TENANT_ROLES, type TenantRole } from "./roles";
import { PERMISSION_MATRIX, SENSITIVE_FIELD_MATRIX } from "./permission-matrix";

/** Presentation-only descriptions for the closed, code-owned role set. */
const ROLE_PRESENTATION: Readonly<Record<TenantRole, { readonly label: string; readonly description: string }>> = {
  tenant_admin: { label: "Företagsadmin", description: "Administrerar företaget, användare och behörigheter." },
  projektledare: { label: "Projektledare", description: "Planerar och driver företagets projekt och offerter." },
  montor: { label: "Montör", description: "Har åtkomst till det arbete som rollen är behörig till." },
  saljare: { label: "Säljare", description: "Arbetar med kunder och offerter utan kostnads- och marginalvärden." },
  ekonomi: { label: "Ekonomi", description: "Har insyn i försäljningspriser, kostnader och marginaler." },
};

export type RoleCatalogueGrant = {
  readonly module: string;
  readonly moduleLabel: string;
  readonly wave: string;
  readonly capability: string;
};

export type EffectivePermissionGrant = RoleCatalogueGrant & {
  readonly grantingRoles: readonly string[];
};

export type RoleCatalogueCard = {
  readonly role: TenantRole;
  readonly label: string;
  readonly description: string;
  readonly activeMemberLabel: "Aktiva medlemmar";
  readonly activeMemberCount: number;
  readonly grants: readonly RoleCatalogueGrant[];
  readonly sensitiveEntitlements: readonly string[];
};

export type RoleCatalogue = {
  readonly roles: readonly RoleCatalogueCard[];
  readonly arbetsledareGuidance: string;
};

const collator = new Intl.Collator("sv");

function activeModules() {
  return SCOPE_MANIFEST.modules.filter((module) => module.status === "active");
}

type MatrixRow = { readonly roles: readonly TenantRole[] };

function rowsForModule(moduleId: string): Readonly<Record<string, MatrixRow>> {
  return (PERMISSION_MATRIX as unknown as Record<string, Readonly<Record<string, MatrixRow>>>)[moduleId] ?? {};
}

function grantsForRoles(roles: readonly TenantRole[]): RoleCatalogueGrant[] {
  const held = new Set(roles);
  return activeModules()
    .flatMap((module) => Object.entries(rowsForModule(module.id))
      .filter(([, row]) => row.roles.some((role) => held.has(role)))
      .map(([capability]) => ({ module: module.id, moduleLabel: module.label, wave: module.wave, capability })))
    .sort((a, b) => collator.compare(a.moduleLabel, b.moduleLabel) || collator.compare(a.capability, b.capability));
}

function sensitiveEntitlementsFor(role: TenantRole): string[] {
  return Object.entries(SENSITIVE_FIELD_MATRIX)
    .flatMap(([module, fields]) => Object.entries(fields)
      .filter(([, row]) => row.roles.includes(role))
      .map(([field]) => `${module}.${field}`))
    .sort(collator.compare);
}

/**
 * Builds only display data from the active manifest and code-owned matrix. It is
 * deliberately separate from authorization: callers cannot use this output to
 * make a permission decision.
 */
export function buildRoleCatalogue(counts: Partial<Record<TenantRole, number>> = {}): RoleCatalogue {
  return {
    roles: TENANT_ROLES.map((role) => ({
      role,
      label: ROLE_PRESENTATION[role].label,
      description: ROLE_PRESENTATION[role].description,
      activeMemberLabel: "Aktiva medlemmar",
      activeMemberCount: counts[role] ?? 0,
      grants: grantsForRoles([role]),
      sensitiveEntitlements: sensitiveEntitlementsFor(role),
    })),
    arbetsledareGuidance: "Arbetsledare tilldelas inom ett jobb och är inte en företagsroll.",
  };
}

/** The effective union, one active capability per module, with sorted role labels. */
export function buildEffectivePermissions(roles: readonly unknown[] | undefined): EffectivePermissionGrant[] {
  const held = normalizeRoles(roles);
  if (held.length === 0) return [];
  return grantsForRoles(held).map((grant) => {
    const row = rowsForModule(grant.module)[grant.capability];
    const grantingRoles = (row?.roles ?? [])
      .filter((role) => held.includes(role))
      .map((role) => ROLE_PRESENTATION[role].label)
      .sort(collator.compare);
    return { ...grant, grantingRoles };
  });
}
