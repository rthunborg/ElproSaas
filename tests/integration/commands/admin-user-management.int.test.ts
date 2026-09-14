import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("Admin user management commands (Story 11.3)", () => {
  test("[P0] serialized last-Admin lifecycle changes are rejected without audit side effects", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants"); const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    try {
      const [member] = await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [fixture.tenantA.id, fixture.adminA.id]);
      const [before] = await adminQuery<{ count: number }>("select count(*)::int as count from public.audit_events where tenant_id=$1", [fixture.tenantA.id]); const client = await makeAuthedServerClient(fixture.adminA);
      for (const [action, roles] of [["disable", []], ["end", []], ["re_role", ["montor"]]] as const) {
        const { error } = await client.rpc("admin_manage_membership", { p_tenant_id: fixture.tenantA.id, p_membership_id: member.id, p_action: action, p_roles: roles, p_reason: "test", p_operation_id: crypto.randomUUID() }); expect(error?.code).toBe("42501");
      }
      const [afterMember] = await adminQuery<{ status: string }>("select status from public.tenant_memberships where id=$1", [member.id]); const [after] = await adminQuery<{ count: number }>("select count(*)::int as count from public.audit_events where tenant_id=$1", [fixture.tenantA.id]);
      expect(afterMember.status).toBe("active"); expect(after.count).toBe(before.count);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P1] ending a shared account removes only this tenant membership and preserves history", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants"); const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    try {
      const membershipId = crypto.randomUUID(); await adminQuery("insert into public.tenant_memberships (id,tenant_id,user_id,role,status) values ($1,$2,$3,'montor','active')", [membershipId, fixture.tenantA.id, fixture.adminB.id]); await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) values ($1,$2,'montor')", [fixture.tenantA.id, membershipId]);
      const client = await makeAuthedServerClient(fixture.adminA); const { error } = await client.rpc("admin_manage_membership", { p_tenant_id: fixture.tenantA.id, p_membership_id: membershipId, p_action: "end", p_roles: [], p_reason: null, p_operation_id: crypto.randomUUID() });
      const rows = await adminQuery<{ tenant_id: string; status: string }>("select tenant_id,status from public.tenant_memberships where user_id=$1 order by tenant_id", [fixture.adminB.id]); expect(error).toBeNull(); expect(rows).toContainEqual({ tenant_id: fixture.tenantA.id, status: "ended" }); expect(rows).toContainEqual({ tenant_id: fixture.tenantB.id, status: "active" });
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] reconciliation reads one durable uncertain operation without mutation", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants"); const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture(); const operationId = crypto.randomUUID();
    try {
      await adminQuery("insert into public.membership_admin_operations (id,tenant_id,actor_user_id,action,outcome) values ($1,$2,$3,'invite','uncertain')", [operationId, fixture.tenantA.id, fixture.adminA.id]); const client = await makeAuthedServerClient(fixture.adminA);
      const first = await client.rpc("admin_reconcile_membership_operation", { p_operation_id: operationId }); const second = await client.rpc("admin_reconcile_membership_operation", { p_operation_id: operationId }); expect(first.error).toBeNull(); expect(second.error).toBeNull(); expect(second.data).toEqual(first.data);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] an expired invitation can be superseded by a fresh attempt or terminally revoked only by its tenant Admin", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants"); const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    const seedExpired = async (email: string) => {
      const membershipId = crypto.randomUUID();
      await adminQuery(
        `insert into public.tenant_memberships (id,tenant_id,user_id,role,status,invited_email,invited_at,invitation_expires_at)
         values ($1,$2,null,'montor','expired',$3,statement_timestamp() - interval '2 hours',statement_timestamp() - interval '1 hour')`,
        [membershipId, fixture.tenantA.id, email],
      );
      await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) values ($1,$2,'montor')", [fixture.tenantA.id, membershipId]);
      return membershipId;
    };
    try {
      const tenantAAdmin = await makeAuthedServerClient(fixture.adminA);
      const tenantBAdmin = await makeAuthedServerClient(fixture.adminB);
      const email = `expired-${crypto.randomUUID()}@example.test`;
      const expiredForResend = await seedExpired(email);
      const fresh = await tenantAAdmin.rpc("admin_prepare_membership_invitation", {
        p_tenant_id: fixture.tenantA.id, p_email: email, p_roles: ["montor"], p_operation_id: crypto.randomUUID(), p_token_hash: crypto.randomUUID().replaceAll("-", ""), p_expiry: new Date(Date.now() + 60_000).toISOString(),
      });
      expect(fresh.error).toBeNull(); expect((fresh.data as { fresh?: boolean }).fresh).toBe(true);
      const replacementId = (fresh.data as { membershipId?: string }).membershipId;
      const replaced = await adminQuery<{ id: string; status: string }>("select id,status from public.tenant_memberships where id = any($1::uuid[]) order by id", [[expiredForResend, replacementId]]);
      expect(replaced).toContainEqual({ id: expiredForResend, status: "expired" }); expect(replaced).toContainEqual({ id: replacementId, status: "invited" });

      const uncertainOperationId = crypto.randomUUID();
      const uncertainEmail = `uncertain-${crypto.randomUUID()}@example.test`;
      const uncertain = await tenantAAdmin.rpc("admin_prepare_membership_invitation", {
        p_tenant_id: fixture.tenantA.id, p_email: uncertainEmail, p_roles: ["montor"], p_operation_id: uncertainOperationId, p_token_hash: crypto.randomUUID().replaceAll("-", ""), p_expiry: new Date(Date.now() + 60_000).toISOString(),
      });
      const uncertainMembershipId = (uncertain.data as { membershipId?: string }).membershipId;
      await tenantAAdmin.rpc("admin_finalize_membership_operation", { p_operation_id: uncertainOperationId, p_outcome: "uncertain" });
      const replay = await tenantAAdmin.rpc("admin_prepare_membership_invitation", {
        p_tenant_id: fixture.tenantA.id, p_email: uncertainEmail, p_roles: ["montor"], p_operation_id: uncertainOperationId, p_token_hash: crypto.randomUUID().replaceAll("-", ""), p_expiry: new Date(Date.now() + 60_000).toISOString(),
      });
      expect(replay.error).toBeNull(); expect(replay.data).toMatchObject({ membershipId: uncertainMembershipId, outcome: "uncertain", fresh: false });
      const observed = await tenantAAdmin.rpc("admin_reconcile_membership_operation", { p_operation_id: uncertainOperationId });
      expect(observed.data).toMatchObject({ operationId: uncertainOperationId, outcome: "uncertain" });
      const freshRetry = await tenantAAdmin.rpc("admin_prepare_membership_invitation", {
        p_tenant_id: fixture.tenantA.id, p_email: uncertainEmail, p_roles: ["montor"], p_operation_id: crypto.randomUUID(), p_token_hash: crypto.randomUUID().replaceAll("-", ""), p_expiry: new Date(Date.now() + 60_000).toISOString(),
      });
      expect(freshRetry.data).toMatchObject({ outcome: "pending", fresh: true }); expect((freshRetry.data as { membershipId?: string }).membershipId).not.toBe(uncertainMembershipId);

      const expiredForRevoke = await seedExpired(`revoke-${crypto.randomUUID()}@example.test`);
      const crossTenant = await tenantBAdmin.rpc("admin_manage_membership", { p_tenant_id: fixture.tenantA.id, p_membership_id: expiredForRevoke, p_action: "revoke", p_roles: [], p_reason: null, p_operation_id: crypto.randomUUID() });
      expect(crossTenant.error?.code).toBe("42501");
      const revoked = await tenantAAdmin.rpc("admin_manage_membership", { p_tenant_id: fixture.tenantA.id, p_membership_id: expiredForRevoke, p_action: "revoke", p_roles: [], p_reason: null, p_operation_id: crypto.randomUUID() });
      expect(revoked.error).toBeNull();
      const [afterRevoke] = await adminQuery<{ status: string }>("select status from public.tenant_memberships where id=$1", [expiredForRevoke]); expect(afterRevoke).toEqual({ status: "revoked" });
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] real invitation acceptance permits only the exact current, unexpired, email-bound attempt", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants"); const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    const hash = (token: string) => createHash("sha256").update(token).digest("hex");
    const seed = async (overrides: { email?: string; status?: string; expiry?: string; superseded?: boolean } = {}) => {
      const membershipId = crypto.randomUUID(); const operationId = crypto.randomUUID(); const token = crypto.randomUUID();
      await adminQuery(
        `insert into public.tenant_memberships (id,tenant_id,user_id,role,status,invited_email,invited_at,invitation_expires_at)
         values ($1,$2,null,'montor',$3,$4,statement_timestamp(),$5)`,
        [membershipId, fixture.tenantA.id, overrides.status ?? "invited", overrides.email ?? fixture.orphanUser.email, overrides.expiry ?? new Date(Date.now() + 60_000).toISOString()],
      );
      await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) values ($1,$2,'montor')", [fixture.tenantA.id, membershipId]);
      await adminQuery(
        `insert into public.membership_admin_operations (id,tenant_id,actor_user_id,membership_id,action,outcome,invitation_token_hash,invitation_expires_at,superseded_at,completed_at)
         values ($1,$2,$3,$4,'invite','succeeded',$5,$6,$7,statement_timestamp())`,
        [operationId, fixture.tenantA.id, fixture.adminA.id, membershipId, hash(token), overrides.expiry ?? new Date(Date.now() + 60_000).toISOString(), overrides.superseded ? new Date().toISOString() : null],
      );
      return { membershipId, token };
    };
    try {
      const client = await makeAuthedServerClient(fixture.orphanUser);
      const current = await seed();
      const accepted = await client.rpc("admin_accept_membership_invitation", { p_membership_id: current.membershipId, p_token_hash: hash(current.token), p_user_id: fixture.orphanUser.id, p_email: fixture.orphanUser.email });
      expect(accepted.error).toBeNull(); expect(accepted.data).toBe(true);
      const [active] = await adminQuery<{ status: string; user_id: string }>("select status,user_id from public.tenant_memberships where id=$1", [current.membershipId]); expect(active).toEqual({ status: "active", user_id: fixture.orphanUser.id });
      const replay = await client.rpc("admin_accept_membership_invitation", { p_membership_id: current.membershipId, p_token_hash: hash(current.token), p_user_id: fixture.orphanUser.id, p_email: fixture.orphanUser.email });
      expect(replay.error).toBeNull(); expect(replay.data).toBe(false);
      const events = await adminQuery<{ count: number }>("select count(*)::int as count from public.audit_events where target_id=$1 and event_type='membership_activated'", [current.membershipId]); expect(events[0]?.count).toBe(1);
      for (const rejected of [
        { expiry: new Date(Date.now() - 60_000).toISOString() },
        { status: "revoked" },
        { superseded: true },
        { email: `wrong-${fixture.orphanUser.email}` },
      ]) {
        const attempt = await seed(rejected);
        const result = await client.rpc("admin_accept_membership_invitation", { p_membership_id: attempt.membershipId, p_token_hash: hash(attempt.token), p_user_id: fixture.orphanUser.id, p_email: fixture.orphanUser.email });
        expect(result.error).toBeNull(); expect(result.data).toBe(false);
        const [unchanged] = await adminQuery<{ status: string; user_id: string | null }>("select status,user_id from public.tenant_memberships where id=$1", [attempt.membershipId]); expect(unchanged.status).not.toBe("active"); expect(unchanged.user_id).toBeNull();
        await adminQuery("update public.tenant_memberships set status='expired' where id=$1 and status='invited'", [attempt.membershipId]);
      }
    } finally { await cleanupFixture(fixture); }
  });
});
