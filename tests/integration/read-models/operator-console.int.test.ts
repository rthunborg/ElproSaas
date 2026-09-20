import { describe, expect, test } from "vitest";
import { cleanupPlatformOperatorFixture, createPlatformOperatorFixture, makePlatformOperatorClient } from "../../factories/platform-operators";
import { admin } from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("Story 12.2 operator-console read model", () => {
  test("[P0] 12.2-INT-001 platform projection denies a tenant identity without data", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createPlatformOperatorFixture();
    try {
      const result = await (await makePlatformOperatorClient(fixture.tenantAdmin)).rpc("operator_console_projection", { p_tenant_id: null });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("42501");
    } finally { await cleanupPlatformOperatorFixture(fixture); }
  });

  test("[P0] 12.2-INT-002 operator projection has the exact safe column contract", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createPlatformOperatorFixture();
    try {
      const organizationNumber = `556${crypto.randomUUID().replaceAll("-", "").replace(/\D/g, "").padEnd(7, "0").slice(0, 7)}`;
      const seeded = await admin().from("tenants")
        .update({ country_code: "SE", normalized_organization_number: organizationNumber })
        .eq("id", fixture.base.tenantA.id);
      expect(seeded.error).toBeNull();

      const client = await makePlatformOperatorClient(fixture.operator);
      const result = await client.rpc("operator_console_projection", { p_tenant_id: fixture.base.tenantA.id });
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(Object.keys(result.data?.[0] ?? {}).sort()).toEqual(["canonical_organisation_identity", "created_at", "first_admin_state", "provisioning_state", "tenant_name"]);
      expect(result.data?.[0]).toMatchObject({
        tenant_name: fixture.base.tenantA.name,
        canonical_organisation_identity: `SE:${organizationNumber}`,
        first_admin_state: "pending",
      });

      const byIdentity = await client.rpc("operator_console_projection_by_identity", { p_identity: `SE:${organizationNumber}` });
      expect(byIdentity.error).toBeNull();
      expect(byIdentity.data).toHaveLength(1);
      expect(Object.keys(byIdentity.data?.[0] ?? {}).sort()).toEqual(["canonical_organisation_identity", "created_at", "first_admin_state", "provisioning_state", "tenant_name"]);
    } finally { await cleanupPlatformOperatorFixture(fixture); }
  });

  test("[P0] 12.2-INT-003 resume targeting is independently operator-scoped", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createPlatformOperatorFixture();
    try {
      const organizationNumber = `556${crypto.randomUUID().replaceAll("-", "").replace(/\D/g, "").padEnd(7, "0").slice(0, 7)}`;
      const seededTenant = await admin().from("tenants")
        .update({ country_code: "SE", normalized_organization_number: organizationNumber })
        .eq("id", fixture.base.tenantA.id);
      expect(seededTenant.error).toBeNull();
      const [membership] = await adminQuery<{ id: string }>(
        "select id from public.tenant_memberships where tenant_id=$1 and user_id=$2",
        [fixture.base.tenantA.id, fixture.operator.id],
      );
      expect(membership?.id).toBeTruthy();
      await adminQuery(
        "insert into public.tenant_provisioning_invites (tenant_id,membership_id,token_hash,normalized_email) values ($1,$2,'',$3)",
        [fixture.base.tenantA.id, membership!.id, fixture.operator.email],
      );

      const identity = `SE:${organizationNumber}`;
      const denied = await (await makePlatformOperatorClient(fixture.tenantAdmin)).rpc("operator_console_resume_target", { p_identity: identity });
      expect(denied.data).toBeNull();
      expect(denied.error?.code).toBe("42501");

      const allowed = await (await makePlatformOperatorClient(fixture.operator)).rpc("operator_console_resume_target", { p_identity: identity });
      expect(allowed.error).toBeNull();
      expect(allowed.data).toEqual([{ tenant_id: fixture.base.tenantA.id, first_admin_attempt: 0 }]);
    } finally { await cleanupPlatformOperatorFixture(fixture); }
  });
});
