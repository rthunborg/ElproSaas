import { describe, expect, test } from "vitest";

/**
 * Story 11.4 RED-phase local-Supabase integration scaffolds.
 *
 * The dynamic imports deliberately name the future seams inside skipped tests.
 * That preserves collection while keeping the tests red when each marker is
 * activated before its implementation lands.
 */
describe("Story 11.4 role harness (ATDD, RED)", () => {
  test.skip("[P0] derives one unique seeded-role × active-table/capability obligation and rejects incomplete metadata", async () => {
    const harnessPath = "../../support/authz/role-harness";
    const { buildRoleHarnessCases, createRoleHarnessFixture } = await import(harnessPath);
    const fixture = await createRoleHarnessFixture();
    const cases = buildRoleHarnessCases();

    expect(cases).toHaveLength(fixture.seedRoles.length * fixture.activeObligations.length);
    expect(new Set(cases.map((entry: { id: string }) => entry.id)).size).toBe(cases.length);
    expect(() => buildRoleHarnessCases({ omitEnrollmentFor: fixture.activeObligations[0]!.id })).toThrow(/enrollment/i);
    expect(() => buildRoleHarnessCases({ duplicateMetadataFor: fixture.activeObligations[0]!.id })).toThrow(/duplicate/i);
    expect(() => buildRoleHarnessCases({ addUnknownMetadata: true })).toThrow(/unknown/i);
  });

  test.skip("[P0] executes every generated allowed and denied RLS/command obligation without a denial side effect", async () => {
    const harnessPath = "../../support/authz/role-harness";
    const { buildRoleHarnessCases, createRoleHarnessFixture, expectDeniedCommandHasNoSideEffects, runRoleHarnessCase } = await import(harnessPath);
    const fixture = await createRoleHarnessFixture();

    for (const obligation of buildRoleHarnessCases()) {
      const result = await runRoleHarnessCase({ fixture, obligation });
      expect(result).toMatchObject({ obligationId: obligation.id, policyMatchesMatrix: true });
      if (obligation.expected === "denied") {
        await expectDeniedCommandHasNoSideEffects({ fixture, obligation, result });
      }
    }
  });

  test.skip("[P1] projects active-only per-role member counts and deterministic effective grants for a same-tenant Admin", async () => {
    const harnessPath = "../../support/authz/role-harness";
    const readPath = "@/features/admin-users/read";
    const { createRoleHarnessFixture } = await import(harnessPath);
    const { readAdminUsersRoleSurface } = await import(readPath);
    const fixture = await createRoleHarnessFixture();
    const projection = await readAdminUsersRoleSurface({
      client: fixture.adminAClient,
      targetMembershipId: fixture.multiRoleActiveMembershipId,
    });

    expect(projection.roles).toHaveLength(5);
    expect(projection.roles.map((role: { activeMemberLabel: string }) => role.activeMemberLabel)).toEqual(Array(5).fill("Aktiva medlemmar"));
    expect(projection.roleCounts).toEqual({
      tenant_admin: 1,
      projektledare: 2,
      ekonomiansvarig: 0,
      saljare: 1,
      montor: 0,
    });
    expect(new Set(projection.effectivePermissions.map((grant: { module: string; capability: string }) => `${grant.module}:${grant.capability}`)).size).toBe(projection.effectivePermissions.length);
    expect(projection.effectivePermissions.every((grant: { grantingRoles: readonly string[] }) => grant.grantingRoles.join("|") === [...grant.grantingRoles].sort((a, b) => a.localeCompare(b, "sv")).join("|"))).toBe(true);
  });

  test.skip("[P0] makes non-Admin, anonymous, missing, and foreign Roles probes indistinguishably denied", async () => {
    const harnessPath = "../../support/authz/role-harness";
    const readPath = "@/features/admin-users/read";
    const { createRoleHarnessFixture } = await import(harnessPath);
    const { readAdminUsersRoleSurface } = await import(readPath);
    const fixture = await createRoleHarnessFixture();
    const probes = [
      { client: fixture.nonAdminAClient, targetMembershipId: fixture.multiRoleActiveMembershipId },
      { client: fixture.anonClient, targetMembershipId: fixture.multiRoleActiveMembershipId },
      { client: fixture.adminAClient, targetMembershipId: fixture.missingMembershipId },
      { client: fixture.adminAClient, targetMembershipId: fixture.foreignMembershipId },
    ];

    const outcomes = await Promise.all(probes.map(async (input) => {
      try {
        return await readAdminUsersRoleSurface(input);
      } catch (error) {
        return { denial: (error as { code?: string }).code ?? "TENANT_ACCESS_DENIED", data: null };
      }
    }));
    expect(outcomes).toEqual(Array(4).fill({ denial: "TENANT_ACCESS_DENIED", data: null }));
  });
});
