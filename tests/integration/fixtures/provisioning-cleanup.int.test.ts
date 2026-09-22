import { describe, expect, test } from "vitest";
import { adminInsertAuditEvent } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { cleanupFixture, createTwoTenantFixture } from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("fixture cleanup preserves protocol integrity", () => {
  test("[infra] a synthetic provisioning request is removed before its tenant and actor, without touching an unrelated fixture", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    const fixture = await createTwoTenantFixture();
    const unrelated = await createTwoTenantFixture();
    const requestId = crypto.randomUUID();
    const unrelatedRequestId = crypto.randomUUID();

    try {
      await adminQuery(
        `insert into public.tenant_provisioning_requests
           (request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash)
         values ($1,repeat('a',64),$2,$3,repeat('b',64))`,
        [requestId, fixture.tenantA.id, fixture.adminA.id],
      );
      await adminQuery(
        `insert into public.tenant_provisioning_requests
           (request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash)
         values ($1,repeat('c',64),$2,$3,repeat('d',64))`,
        [unrelatedRequestId, unrelated.tenantA.id, unrelated.adminA.id],
      );
      await adminInsertAuditEvent({
        tenant_id: fixture.tenantA.id,
        actor_user_id: fixture.adminA.id,
        command: "cleanup.provisioning-probe",
        event_type: "cleanup.provisioning-probe",
        target_type: "tenant",
        target_id: fixture.tenantA.id,
        correlation_id: crypto.randomUUID(),
        metadata: {},
      });

      await cleanupFixture(fixture);

      const [targetRequest, targetTenant, targetActor, targetAudit] = await Promise.all([
        adminQuery("select request_id from public.tenant_provisioning_requests where request_id=$1", [requestId]),
        adminQuery("select id from public.tenants where id=$1", [fixture.tenantA.id]),
        adminQuery("select id from auth.users where id=$1", [fixture.adminA.id]),
        adminQuery("select id from public.audit_events where tenant_id=$1", [fixture.tenantA.id]),
      ]);
      expect(targetRequest).toHaveLength(0);
      expect(targetTenant).toHaveLength(0);
      expect(targetActor).toHaveLength(0);
      expect(targetAudit).toHaveLength(0);

      const [unrelatedRequest, unrelatedTenant, unrelatedActor] = await Promise.all([
        adminQuery("select request_id from public.tenant_provisioning_requests where request_id=$1", [unrelatedRequestId]),
        adminQuery("select id from public.tenants where id=$1", [unrelated.tenantA.id]),
        adminQuery("select id from auth.users where id=$1", [unrelated.adminA.id]),
      ]);
      expect(unrelatedRequest).toHaveLength(1);
      expect(unrelatedTenant).toHaveLength(1);
      expect(unrelatedActor).toHaveLength(1);
    } finally {
      await cleanupFixture(unrelated);
    }
  });
});
