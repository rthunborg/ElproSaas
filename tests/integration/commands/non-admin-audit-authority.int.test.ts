/**
 * Story 11.2 recovery: a non-admin mutation may succeed only through a checked,
 * command-specific wrapper that owns its audit insert in the same transaction.
 * The generic record_audit_event RPC remains Admin-only and direct table INSERT
 * is removed once the command moves behind the wrapper.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminExec, adminQuery, closeAdminPool } from "../../factories/admin-sql";
import {
  adminInsertMembership,
  adminSelectCrmRowById,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TestServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { assertSearchPathExactlyEmpty } from "../../support/search-path";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createCustomer } from "@/server/commands/crm/customers";

let stackUp = false;
let fixture: TwoTenantFixture;
let seller: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  await adminInsertMembership({
    tenant_id: fixture.tenantA.id,
    user_id: fixture.orphanUser.id,
    role: "saljare",
    status: "active",
  });
  seller = await makeAuthedServerClient(fixture.orphanUser);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
  if (stackUp) await closeAdminPool();
});

function customerRpcArgs(tenantId: string, correlationId: string, label: string) {
  return {
    p_tenant_id: tenantId,
    p_actor_user_id: fixture.orphanUser.id,
    p_correlation_id: correlationId,
    p_customer_type: "company",
    p_display_name: label,
    p_personnummer: null,
    p_org_nr: "556677-8899",
    p_contact_name: null,
    p_email: null,
    p_phone: null,
    p_address_line1: null,
    p_address_line2: null,
    p_postal_code: null,
    p_city: null,
  };
}

async function customerCountByLabel(label: string): Promise<number> {
  const rows = await adminQuery<{ count: string }>(
    `select count(*)::text as count
       from public.customers
      where display_name = $1`,
    [label],
  );
  return Number(rows[0]?.count ?? 0);
}

describe("Story 11.2 checked non-admin audit authority", () => {
  it("[P0] hardens the public wrapper and leaves the internal audit writer non-executable", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
      proargnames: string[] | null;
      anon_exec: boolean;
      authenticated_exec: boolean;
      service_exec: boolean;
    }>(
      `select p.proname,
              p.prosecdef,
              p.proconfig,
              p.proargnames,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec
         from pg_catalog.pg_proc p
         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'create_customer_with_audit',
            'story_11_2_record_audit_event_internal'
          )
        order by p.proname`,
    );
    expect(rows).toHaveLength(2);

    const wrapper = rows.find((row) => row.proname === "create_customer_with_audit");
    const internal = rows.find(
      (row) => row.proname === "story_11_2_record_audit_event_internal",
    );
    expect(wrapper?.prosecdef).toBe(true);
    expect(wrapper?.anon_exec).toBe(false);
    expect(wrapper?.authenticated_exec).toBe(true);
    expect(wrapper?.service_exec).toBe(false);
    expect(wrapper?.proargnames).toEqual([
      "p_tenant_id",
      "p_actor_user_id",
      "p_correlation_id",
      "p_customer_type",
      "p_display_name",
      "p_personnummer",
      "p_org_nr",
      "p_contact_name",
      "p_email",
      "p_phone",
      "p_address_line1",
      "p_address_line2",
      "p_postal_code",
      "p_city",
    ]);
    assertSearchPathExactlyEmpty(wrapper?.proname ?? "missing wrapper", wrapper?.proconfig ?? null);

    expect(internal?.prosecdef).toBe(false);
    expect(internal?.anon_exec).toBe(false);
    expect(internal?.authenticated_exec).toBe(false);
    expect(internal?.service_exec).toBe(false);
    assertSearchPathExactlyEmpty(internal?.proname ?? "missing internal", internal?.proconfig ?? null);
  });

  it("[P0] lets an entitled Seller create a customer with exactly one trustworthy audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const correlationId = crypto.randomUUID();
    const label = `11.2 seller ${crypto.randomUUID()}`;
    const result = await runCommand(createCustomer, {
      client: seller as never,
      input: {
        customer_type: "company",
        display_name: label,
        org_nr: "556677-8899",
      },
      correlationId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const customer = await adminSelectCrmRowById("customers", result.data.targetId);
    expect(customer?.tenant_id).toBe(fixture.tenantA.id);
    expect(customer?.display_name).toBe(label);

    const audit = await adminSelectAuditEvents({ correlationId });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.orphanUser.id,
      command: "customer.create",
      event_type: "customer.created",
      target_type: "customer",
      target_id: result.data.targetId,
      metadata: {},
    });
  });

  it("[P0] denies cross-tenant and unentitled raw wrapper calls without mutation or audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const crossCorrelationId = crypto.randomUUID();
    const crossLabel = `11.2 cross ${crypto.randomUUID()}`;
    const cross = await seller.rpc(
      "create_customer_with_audit",
      customerRpcArgs(fixture.tenantB.id, crossCorrelationId, crossLabel),
    );
    expect(cross.data).toBeNull();
    expect(cross.error?.code).toBe("42501");
    expect(await customerCountByLabel(crossLabel)).toBe(0);
    expect(await adminSelectAuditEvents({ correlationId: crossCorrelationId })).toEqual([]);

    const actorSpoofCorrelationId = crypto.randomUUID();
    const actorSpoofLabel = `11.2 actor spoof ${crypto.randomUUID()}`;
    const actorSpoof = await seller.rpc("create_customer_with_audit", {
      ...customerRpcArgs(
        fixture.tenantA.id,
        actorSpoofCorrelationId,
        actorSpoofLabel,
      ),
      p_actor_user_id: fixture.adminA.id,
    });
    expect(actorSpoof.data).toBeNull();
    expect(actorSpoof.error?.code).toBe("42501");
    expect(await customerCountByLabel(actorSpoofLabel)).toBe(0);
    expect(
      await adminSelectAuditEvents({ correlationId: actorSpoofCorrelationId }),
    ).toEqual([]);

    await adminQuery(
      `update public.tenant_memberships
          set role = 'montor'
        where tenant_id = $1 and user_id = $2`,
      [fixture.tenantA.id, fixture.orphanUser.id],
    );
    try {
      const deniedCorrelationId = crypto.randomUUID();
      const deniedLabel = `11.2 denied ${crypto.randomUUID()}`;
      const denied = await seller.rpc(
        "create_customer_with_audit",
        customerRpcArgs(fixture.tenantA.id, deniedCorrelationId, deniedLabel),
      );
      expect(denied.data).toBeNull();
      expect(denied.error?.code).toBe("42501");
      expect(await customerCountByLabel(deniedLabel)).toBe(0);
      expect(await adminSelectAuditEvents({ correlationId: deniedCorrelationId })).toEqual([]);
    } finally {
      await adminQuery(
        `update public.tenant_memberships
            set role = 'saljare'
          where tenant_id = $1 and user_id = $2`,
        [fixture.tenantA.id, fixture.orphanUser.id],
      );
    }
  });

  it("[P0] rejects forged raw audit and direct customer INSERT by the same entitled Seller", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const forgedCorrelationId = crypto.randomUUID();
    const forged = await seller.rpc("record_audit_event", {
      p_tenant_id: fixture.tenantA.id,
      p_actor_user_id: fixture.orphanUser.id,
      p_command: "customer.create",
      p_event_type: "customer.created",
      p_target_type: "customer",
      p_target_id: crypto.randomUUID(),
      p_correlation_id: forgedCorrelationId,
      p_metadata: {},
      p_created_at: new Date().toISOString(),
    });
    expect(forged.data).toBeNull();
    expect(forged.error?.code).toBe("42501");
    expect(await adminSelectAuditEvents({ correlationId: forgedCorrelationId })).toEqual([]);

    const directLabel = `11.2 direct ${crypto.randomUUID()}`;
    const direct = await seller
      .from("customers")
      .insert({
        tenant_id: fixture.tenantA.id,
        customer_type: "company",
        display_name: directLabel,
        org_nr: "556677-8899",
      })
      .select("id");
    expect(direct.data).toBeNull();
    expect(direct.error?.code).toBe("42501");
    expect(await customerCountByLabel(directLabel)).toBe(0);
  });

  it("[P0] rolls the customer INSERT back when its bound audit INSERT fails", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const correlationId = crypto.randomUUID();
    const label = `11.2 rollback ${crypto.randomUUID()}`;
    await adminExec(
      `insert into test_support.forced_audit_failures (correlation_id)
       values ($1::uuid)`,
      [correlationId],
    );
    try {
      const result = await runCommand(createCustomer, {
        client: seller as never,
        input: {
          customer_type: "company",
          display_name: label,
          org_nr: "556677-8899",
        },
        correlationId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("SERVER_ERROR");
      expect(await customerCountByLabel(label)).toBe(0);
      expect(await adminSelectAuditEvents({ correlationId })).toEqual([]);
    } finally {
      await adminExec(
        `delete from test_support.forced_audit_failures
          where correlation_id = $1::uuid`,
        [correlationId],
      );
    }
  });
});
