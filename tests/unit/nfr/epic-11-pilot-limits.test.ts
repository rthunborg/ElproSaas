import assert from "node:assert/strict";
import { test } from "node:test";
import { EPIC11_PILOT_LIMITS, assessEpic11PilotFixtureProfile, assessEpic11PilotMeasurements } from "../../../scripts/nfr/epic-11-pilot-limits";

test("Epic 11 pilot ceilings accept measurements exactly at every approved boundary", () => {
  const assessment = assessEpic11PilotMeasurements({
    readP95Ms: EPIC11_PILOT_LIMITS.readP95Ms,
    syntheticBulkEffectivePermissionsP95Ms: EPIC11_PILOT_LIMITS.syntheticBulkEffectivePermissionsP95Ms,
    authenticatedRlsRequestsPerRead: EPIC11_PILOT_LIMITS.authenticatedRlsRequestsPerRead,
  });

  assert.deepEqual(assessment, { passed: true, violations: [] });
});

test("Epic 11 pilot ceilings report every latency and RLS-request regression", () => {
  const assessment = assessEpic11PilotMeasurements({
    readP95Ms: EPIC11_PILOT_LIMITS.readP95Ms + 0.01,
    syntheticBulkEffectivePermissionsP95Ms: EPIC11_PILOT_LIMITS.syntheticBulkEffectivePermissionsP95Ms + 0.01,
    authenticatedRlsRequestsPerRead: EPIC11_PILOT_LIMITS.authenticatedRlsRequestsPerRead + 1,
  });

  assert.equal(assessment.passed, false);
  assert.equal(assessment.violations.length, 3);
  assert.match(assessment.violations.join("\n"), /Admin-users read p95/);
  assert.match(assessment.violations.join("\n"), /Synthetic bulk effective-permissions p95/);
  assert.match(assessment.violations.join("\n"), /Authenticated RLS requests per read/);
});

test("Epic 11 pilot ceilings reject non-finite measurements instead of false-greening", () => {
  const assessment = assessEpic11PilotMeasurements({
    readP95Ms: Number.NaN,
    syntheticBulkEffectivePermissionsP95Ms: Number.POSITIVE_INFINITY,
    authenticatedRlsRequestsPerRead: -1,
  });

  assert.equal(assessment.passed, false);
  assert.equal(assessment.violations.length, 3);
});

test("Epic 11 pilot fixture profile requires all 40 third-member secondary roles", () => {
  const exact = assessEpic11PilotFixtureProfile({
    tenantAActiveMemberships: 120,
    tenantBActiveMemberships: 24,
    tenantAPrimaryRoleCounts: {
      tenant_admin: 24,
      projektledare: 24,
      montor: 24,
      saljare: 24,
      ekonomi: 24,
    },
    tenantAExtraRoleMemberships: 40,
    tenantARoleAssignments: 160,
  });
  assert.deepEqual(exact, { passed: true, violations: [] });

  const missingAdminSecondaryRole = assessEpic11PilotFixtureProfile({
    tenantAActiveMemberships: 120,
    tenantBActiveMemberships: 24,
    tenantAPrimaryRoleCounts: {
      tenant_admin: 24,
      projektledare: 24,
      montor: 24,
      saljare: 24,
      ekonomi: 24,
    },
    tenantAExtraRoleMemberships: 39,
    tenantARoleAssignments: 159,
  });
  assert.equal(missingAdminSecondaryRole.passed, false);
  assert.match(missingAdminSecondaryRole.violations.join("\n"), /extra-role memberships must be 40/);
});
