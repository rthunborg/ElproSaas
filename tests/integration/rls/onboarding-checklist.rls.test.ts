import { describe, expect, test } from "vitest";

describe("Story 12.3 onboarding dismissal RLS", () => {
  test("[P0] only the authenticated active member can update its own presentation timestamp", async () => {
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const fixture = await createTwoTenantFixture();
    try {
      const caller = await makeAuthedServerClient(fixture.adminA);
      const own = await caller.from("tenant_memberships").update({ onboarding_checklist_dismissed_at: new Date().toISOString() }).eq("tenant_id", fixture.tenantA.id).eq("user_id", fixture.adminA.id);
      expect(own.error).toBeNull();
      const foreign = await caller.from("tenant_memberships").update({ onboarding_checklist_dismissed_at: new Date().toISOString() }).eq("tenant_id", fixture.tenantB.id).eq("user_id", fixture.adminB.id);
      expect(foreign.error).toBeNull();
      const [foreignRow] = await adminQuery<{ onboarding_checklist_dismissed_at: string | null }>("select onboarding_checklist_dismissed_at from public.tenant_memberships where tenant_id=$1 and user_id=$2", [fixture.tenantB.id, fixture.adminB.id]);
      expect(foreignRow.onboarding_checklist_dismissed_at).toBeNull();
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] column privilege rejects role and status mutation even for the current member", async () => {
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const fixture = await createTwoTenantFixture();
    try {
      const caller = await makeAuthedServerClient(fixture.adminA);
      const { error } = await caller.from("tenant_memberships").update({ status: "disabled" }).eq("tenant_id", fixture.tenantA.id).eq("user_id", fixture.adminA.id);
      expect(error).not.toBeNull();
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] non-ready tenants cannot persist a dismissal and no audit event is created", async () => {
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const fixture = await createTwoTenantFixture();
    try {
      await adminQuery("update public.tenants set provisioning_state='pending_first_admin_invite' where id=$1", [fixture.tenantA.id]);
      const caller = await makeAuthedServerClient(fixture.adminA);
      const { data } = await caller.from("tenant_memberships").update({ onboarding_checklist_dismissed_at: new Date().toISOString() }).eq("tenant_id", fixture.tenantA.id).eq("user_id", fixture.adminA.id).select("id");
      expect(data ?? []).toEqual([]);
      const [audit] = await adminQuery<{ count: number }>("select count(*)::int as count from public.audit_events where tenant_id=$1 and event_type='onboarding_checklist_presentation_changed'", [fixture.tenantA.id]);
      expect(audit.count).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] an additional active or unexpired invited member counts only with an assigned role", async () => {
    const { createTwoTenantFixture, cleanupFixture } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const fixture = await createTwoTenantFixture();
    try {
      const memberId = crypto.randomUUID();
      await adminQuery("insert into public.tenant_memberships(id,tenant_id,role,status,invited_email,invitation_expires_at) values($1,$2,'tenant_admin','invited','check@example.test',statement_timestamp()+interval '1 hour')", [memberId, fixture.tenantA.id]);
      const count = async () => (await adminQuery<{ count: number }>(`select count(distinct m.id)::int as count from public.tenant_memberships m join public.membership_roles r on r.tenant_id=m.tenant_id and r.membership_id=m.id where m.tenant_id=$1 and m.id <> (select id from public.tenant_memberships where tenant_id=$1 and user_id=$2) and (m.status='active' or (m.status='invited' and m.invitation_expires_at>statement_timestamp()))`, [fixture.tenantA.id, fixture.adminA.id]))[0]?.count;
      expect(await count()).toBe(0);
      await adminQuery("insert into public.membership_roles(tenant_id,membership_id,role) values($1,$2,'tenant_admin')", [fixture.tenantA.id, memberId]);
      expect(await count()).toBe(1);
      await adminQuery("update public.tenant_memberships set invitation_expires_at=statement_timestamp()-interval '1 second' where id=$1", [memberId]);
      expect(await count()).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] two active Admins in one tenant keep independent dismissal timestamps", async () => {
    const { createTwoTenantFixture, cleanupFixture } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql");
    const fixture = await createTwoTenantFixture();
    try {
      const secondId = crypto.randomUUID();
      await adminQuery("insert into public.tenant_memberships(id,tenant_id,user_id,role,status) values($1,$2,$3,'tenant_admin','active')", [secondId, fixture.tenantA.id, fixture.adminB.id]);
      await adminQuery("insert into public.membership_roles(tenant_id,membership_id,role) values($1,$2,'tenant_admin')", [fixture.tenantA.id, secondId]);
      await adminQuery("update public.tenant_memberships set onboarding_checklist_dismissed_at=statement_timestamp() where tenant_id=$1 and user_id=$2", [fixture.tenantA.id, fixture.adminA.id]);
      const rows = await adminQuery<{ user_id: string; onboarding_checklist_dismissed_at: string | null }>("select user_id,onboarding_checklist_dismissed_at from public.tenant_memberships where id in ($1,$2) order by id", [secondId, (await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [fixture.tenantA.id, fixture.adminA.id]))[0]!.id]);
      expect(rows.filter((row) => row.onboarding_checklist_dismissed_at !== null)).toHaveLength(1);
    } finally { await cleanupFixture(fixture); }
  });
});
