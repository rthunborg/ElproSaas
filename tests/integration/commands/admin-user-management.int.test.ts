import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";
import {
  isLocalStackReachable,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
} from "../../support/test-env";
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

  test("[P0] direct invitation RPC binds the current token to the confirmed authenticated Auth identity", async (testCtx) => {
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
      const mismatchedClient = await makeAuthedServerClient(fixture.adminB);
      const [auditBefore] = await adminQuery<{ count: number }>(
        "select count(*)::int as count from public.audit_events where tenant_id=$1 and target_id=$2",
        [fixture.tenantA.id, current.membershipId],
      );
      const rolesBefore = await adminQuery<{ membership_id: string; role: string }>(
        "select membership_id,role from public.membership_roles where membership_id=$1 order by role",
        [current.membershipId],
      );
      const [operationBefore] = await adminQuery<{ id: string; outcome: string; completed_at: string | null; superseded_at: string | null }>(
        "select id,outcome,completed_at,superseded_at from public.membership_admin_operations where membership_id=$1",
        [current.membershipId],
      );
      const tenantBStateBefore = await adminQuery<{ membership_id: string; status: string; role: string }>(
        `select m.id as membership_id,m.status,r.role
           from public.tenant_memberships m
           join public.membership_roles r on r.membership_id=m.id
          where m.tenant_id=$1 and m.user_id=$2
          order by r.role`,
        [fixture.tenantB.id, fixture.adminB.id],
      );
      const mismatched = await mismatchedClient.rpc("admin_accept_membership_invitation", {
        p_membership_id: current.membershipId,
        p_token_hash: hash(current.token),
        p_user_id: fixture.adminB.id,
        // This is the pre-fix exploit: a caller controls this value while using a
        // valid invitation for a different Auth identity.
        p_email: fixture.orphanUser.email,
      });
      expect(mismatched.error).toBeNull(); expect(mismatched.data).toBe(false);
      const [afterMismatch] = await adminQuery<{ status: string; user_id: string | null }>("select status,user_id from public.tenant_memberships where id=$1", [current.membershipId]);
      const [auditAfterMismatch] = await adminQuery<{ count: number }>(
        "select count(*)::int as count from public.audit_events where tenant_id=$1 and target_id=$2",
        [fixture.tenantA.id, current.membershipId],
      );
      const tenantBMembershipInTenantA = await adminQuery<{ count: number }>(
        "select count(*)::int as count from public.tenant_memberships where tenant_id=$1 and user_id=$2 and status='active'",
        [fixture.tenantA.id, fixture.adminB.id],
      );
      const rolesAfterMismatch = await adminQuery<{ membership_id: string; role: string }>(
        "select membership_id,role from public.membership_roles where membership_id=$1 order by role",
        [current.membershipId],
      );
      const [operationAfterMismatch] = await adminQuery<{ id: string; outcome: string; completed_at: string | null; superseded_at: string | null }>(
        "select id,outcome,completed_at,superseded_at from public.membership_admin_operations where membership_id=$1",
        [current.membershipId],
      );
      const tenantBStateAfter = await adminQuery<{ membership_id: string; status: string; role: string }>(
        `select m.id as membership_id,m.status,r.role
           from public.tenant_memberships m
           join public.membership_roles r on r.membership_id=m.id
          where m.tenant_id=$1 and m.user_id=$2
          order by r.role`,
        [fixture.tenantB.id, fixture.adminB.id],
      );
      expect(afterMismatch).toEqual({ status: "invited", user_id: null });
      expect(auditAfterMismatch.count).toBe(auditBefore.count);
      expect(tenantBMembershipInTenantA[0]?.count).toBe(0);
      expect(rolesAfterMismatch).toEqual(rolesBefore);
      expect(operationAfterMismatch).toEqual(operationBefore);
      expect(tenantBStateAfter).toEqual(tenantBStateBefore);

      // p_email is deliberately false: successful acceptance proves this
      // compatibility argument no longer controls the database identity check.
      const accepted = await client.rpc("admin_accept_membership_invitation", { p_membership_id: current.membershipId, p_token_hash: hash(current.token), p_user_id: fixture.orphanUser.id, p_email: "caller-controlled@example.test" });
      expect(accepted.error).toBeNull(); expect(accepted.data).toBe(true);
      const [active] = await adminQuery<{ status: string; user_id: string }>("select status,user_id from public.tenant_memberships where id=$1", [current.membershipId]); expect(active).toEqual({ status: "active", user_id: fixture.orphanUser.id });
      const [auditAfterAccept] = await adminQuery<{ count: number }>(
        "select count(*)::int as count from public.audit_events where tenant_id=$1 and target_id=$2",
        [fixture.tenantA.id, current.membershipId],
      );
      expect(auditAfterAccept.count).toBe(auditBefore.count + 1);
      const replay = await client.rpc("admin_accept_membership_invitation", { p_membership_id: current.membershipId, p_token_hash: hash(current.token), p_user_id: fixture.orphanUser.id, p_email: fixture.orphanUser.email });
      const [auditAfterReplay] = await adminQuery<{ count: number }>(
        "select count(*)::int as count from public.audit_events where tenant_id=$1 and target_id=$2",
        [fixture.tenantA.id, current.membershipId],
      );
      expect(replay.error).toBeNull(); expect(replay.data).toBe(false);
      expect(auditAfterReplay.count).toBe(auditAfterAccept.count);

      const unconfirmedEmail = `unconfirmed-${crypto.randomUUID()}@example.test`;
      const unconfirmedPassword = `Pw-${crypto.randomUUID()}-Aa1!`;
      const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({ email: unconfirmedEmail, password: unconfirmedPassword, email_confirm: true });
      expect(createError).toBeNull(); expect(created.user).toBeDefined();
      try {
        const unconfirmedClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
        const { error: signInError } = await unconfirmedClient.auth.signInWithPassword({ email: unconfirmedEmail, password: unconfirmedPassword });
        expect(signInError).toBeNull();
        // Preserve a real authenticated session, then revoke confirmation in the
        // Auth row to prove the definer procedure reads current trusted identity
        // state rather than relying on a stale JWT or any RPC email argument.
        await adminQuery("update auth.users set email_confirmed_at=null where id=$1", [created.user!.id]);
        const [unconfirmedAuthRow] = await adminQuery<{ email_confirmed_at: string | null }>(
          "select email_confirmed_at from auth.users where id=$1",
          [created.user!.id],
        );
        expect(unconfirmedAuthRow?.email_confirmed_at).toBeNull();
        const unconfirmedAttempt = await seed({ email: unconfirmedEmail });
        const unconfirmed = await unconfirmedClient.rpc("admin_accept_membership_invitation", {
          p_membership_id: unconfirmedAttempt.membershipId,
          p_token_hash: hash(unconfirmedAttempt.token),
          p_user_id: created.user!.id,
          p_email: unconfirmedEmail,
        });
        const [unconfirmedMembership] = await adminQuery<{ status: string; user_id: string | null }>("select status,user_id from public.tenant_memberships where id=$1", [unconfirmedAttempt.membershipId]);
        expect(unconfirmed.error).toBeNull(); expect(unconfirmed.data).toBe(false);
        expect(unconfirmedMembership).toEqual({ status: "invited", user_id: null });
      } finally {
        if (created.user) await serviceClient.auth.admin.deleteUser(created.user.id);
      }
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
