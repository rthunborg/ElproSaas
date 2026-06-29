/**
 * Factory teardown — `cleanupFixture` reliably removes a tenant that accrued audit
 * rows, despite the `audit_events` append-only trigger blocking the `tenant_id ON
 * DELETE CASCADE`.
 *
 * Resolves the retro-flagged "before Epic 3 factory teardown" item: the append-only
 * guard (`audit_events_block_mutation`) raises on the cascade DELETE, so a plain
 * `delete from public.tenants` LEAKED any tenant that had authored audit rows into
 * the long-lived local DB. `cleanupFixture` now purges audit + tenants on one
 * superuser session with `session_replication_role = replica` (TEST-ONLY, loopback-
 * gated). Production audit immutability is unchanged — this is a teardown path only.
 *
 * Runs against the LOCAL stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createTwoTenantFixture, cleanupFixture } from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { adminInsertAuditEvent } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";

let stackUp = false;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

describe("cleanupFixture tears down a tenant that accrued audit rows (no leak)", () => {
  it("[infra] purges audit_events + tenant rows despite the append-only ON DELETE CASCADE block", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const fixture = await createTwoTenantFixture();

    // Seed a Tenant A audit row so the tenant `on delete cascade` would hit the
    // append-only guard (the pre-fix leak path).
    await adminInsertAuditEvent({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.adminA.id,
      command: "cleanup.probe",
      event_type: "cleanup.probe",
      target_type: "tenant",
      target_id: fixture.tenantA.id,
      correlation_id: crypto.randomUUID(),
      metadata: { reason: "cleanup-teardown" },
    });

    // The unit under test: cleanup must SUCCEED (no swallowed warning leak).
    await cleanupFixture(fixture);

    // Independent privileged re-read: both tenant rows AND their audit rows are gone.
    const tenants = await adminQuery(
      `select id from public.tenants where id = any($1::uuid[])`,
      [[fixture.tenantA.id, fixture.tenantB.id]],
    );
    expect(tenants.length).toBe(0);

    const audit = await adminQuery(
      `select id from public.audit_events where tenant_id = any($1::uuid[])`,
      [[fixture.tenantA.id, fixture.tenantB.id]],
    );
    expect(audit.length).toBe(0);
  });
});
