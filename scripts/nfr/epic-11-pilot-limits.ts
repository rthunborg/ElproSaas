import { TENANT_ROLES } from "../../src/server/authz/roles";

/** Approved, local-only Epic 11 pilot limits for the measured RBAC read path. */
export const EPIC11_PILOT_LIMITS = {
  tenantAActiveMemberships: 120,
  tenantBActiveMemberships: 24,
  readP95Ms: 250,
  syntheticBulkEffectivePermissionsP95Ms: 25,
  authenticatedRlsRequestsPerRead: 3,
} as const;

export type Epic11PilotMeasurements = {
  readonly readP95Ms: number;
  readonly syntheticBulkEffectivePermissionsP95Ms: number;
  readonly authenticatedRlsRequestsPerRead: number;
};

export type Epic11PilotAssessment = {
  readonly passed: boolean;
  readonly violations: readonly string[];
};

export type Epic11PilotFixtureProfile = {
  readonly tenantAActiveMemberships: number;
  readonly tenantBActiveMemberships: number;
  readonly tenantAPrimaryRoleCounts: Readonly<Record<string, number>>;
  readonly tenantAExtraRoleMemberships: number;
  readonly tenantARoleAssignments: number;
};

function finiteNonNegative(name: string, value: number): string | null {
  return Number.isFinite(value) && value >= 0 ? null : `${name} must be a finite non-negative number; observed ${value}.`;
}

/**
 * Returns every failed ceiling so the persisted local-only evidence explains a
 * regression without hiding a second broken invariant behind the first one.
 */
export function assessEpic11PilotMeasurements(measurements: Epic11PilotMeasurements): Epic11PilotAssessment {
  const violations = [
    finiteNonNegative("Admin-users read p95", measurements.readP95Ms),
    finiteNonNegative("Synthetic bulk effective-permissions p95", measurements.syntheticBulkEffectivePermissionsP95Ms),
    finiteNonNegative("Authenticated RLS requests per read", measurements.authenticatedRlsRequestsPerRead),
  ].filter((message): message is string => message !== null);

  if (Number.isFinite(measurements.readP95Ms) && measurements.readP95Ms > EPIC11_PILOT_LIMITS.readP95Ms) {
    violations.push(`Admin-users read p95 ${measurements.readP95Ms.toFixed(2)}ms exceeds ${EPIC11_PILOT_LIMITS.readP95Ms}ms.`);
  }
  if (Number.isFinite(measurements.syntheticBulkEffectivePermissionsP95Ms) && measurements.syntheticBulkEffectivePermissionsP95Ms > EPIC11_PILOT_LIMITS.syntheticBulkEffectivePermissionsP95Ms) {
    violations.push(
      `Synthetic bulk effective-permissions p95 ${measurements.syntheticBulkEffectivePermissionsP95Ms.toFixed(2)}ms exceeds ${EPIC11_PILOT_LIMITS.syntheticBulkEffectivePermissionsP95Ms}ms.`,
    );
  }
  if (Number.isFinite(measurements.authenticatedRlsRequestsPerRead) && measurements.authenticatedRlsRequestsPerRead > EPIC11_PILOT_LIMITS.authenticatedRlsRequestsPerRead) {
    violations.push(
      `Authenticated RLS requests per read ${measurements.authenticatedRlsRequestsPerRead} exceeds ${EPIC11_PILOT_LIMITS.authenticatedRlsRequestsPerRead}.`,
    );
  }

  return { passed: violations.length === 0, violations };
}

/**
 * The benchmark is useful only when its fixture is exactly the approved pilot
 * profile. Keep this separate from timing assessment so a fixture drift fails
 * before anyone can treat a fast result as performance evidence.
 */
export function assessEpic11PilotFixtureProfile(profile: Epic11PilotFixtureProfile): Epic11PilotAssessment {
  const violations: string[] = [];
  const expectedPrimaryRoleCount = EPIC11_PILOT_LIMITS.tenantAActiveMemberships / TENANT_ROLES.length;
  const expectedExtraRoleMemberships = EPIC11_PILOT_LIMITS.tenantAActiveMemberships / 3;
  const expectedRoleAssignments = EPIC11_PILOT_LIMITS.tenantAActiveMemberships + expectedExtraRoleMemberships;

  for (const [name, actual, expected] of [
    ["Tenant A active memberships", profile.tenantAActiveMemberships, EPIC11_PILOT_LIMITS.tenantAActiveMemberships],
    ["Tenant B active memberships", profile.tenantBActiveMemberships, EPIC11_PILOT_LIMITS.tenantBActiveMemberships],
    ["Tenant A extra-role memberships", profile.tenantAExtraRoleMemberships, expectedExtraRoleMemberships],
    ["Tenant A role assignments", profile.tenantARoleAssignments, expectedRoleAssignments],
  ] as const) {
    const invalid = finiteNonNegative(name, actual);
    if (invalid) violations.push(invalid);
    else if (actual !== expected) violations.push(`${name} must be ${expected}; observed ${actual}.`);
  }
  for (const role of TENANT_ROLES) {
    const actual = profile.tenantAPrimaryRoleCounts[role];
    const invalid = finiteNonNegative(`Tenant A primary ${role} memberships`, actual);
    if (invalid) violations.push(invalid);
    else if (actual !== expectedPrimaryRoleCount) {
      violations.push(`Tenant A primary ${role} memberships must be ${expectedPrimaryRoleCount}; observed ${actual}.`);
    }
  }
  return { passed: violations.length === 0, violations };
}
