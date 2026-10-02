import { describe, expect, test } from "vitest";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("Story 14.1 resource persistence commands", () => {
  test("[P0] creates one profile, saves a schedule, and rejects overlap without partial rows", async (ctx) => {
    if (skipUnlessStack(ctx, await isLocalStackReachable())) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    try {
      const [membership] = await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [fixture.tenantA.id, fixture.adminA.id]);
      const client = await makeAuthedServerClient(fixture.adminA);
      const profile = await client.rpc("upsert_person_profile_with_audit", { p_tenant_id: fixture.tenantA.id, p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_membership_id: membership.id, p_work_role_id: null, p_employment_percentage: 80 });
      expect(profile.error).toBeNull();
      const schedule = [{ weekday: 1, start: "07:00", end: "16:00", breaks: [{ start: "12:00", end: "12:30" }] }];
      expect((await client.rpc("save_person_schedule_with_audit", { p_tenant_id: fixture.tenantA.id, p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_person_profile_id: profile.data, p_schedule: schedule })).error).toBeNull();
      const invalid = await client.rpc("save_person_schedule_with_audit", { p_tenant_id: fixture.tenantA.id, p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_person_profile_id: profile.data, p_schedule: [{ weekday: 1, start: "07:00", end: "16:00", breaks: [] }, { weekday: 1, start: "15:00", end: "18:00", breaks: [] }] });
      expect(invalid.error?.code).toBe("23514");
      const rows = await adminQuery<{ entry_kind: string; starts_at: string }>("select entry_kind,starts_at::text from public.person_work_hours where person_profile_id=$1 order by entry_kind,starts_at", [profile.data]);
      expect(rows).toEqual([{ entry_kind: "weekly_break", starts_at: "12:00:00" }, { entry_kind: "weekly_shift", starts_at: "07:00:00" }]);
    } finally { await cleanupFixture(fixture); }
  });
  test("[P0] rejects forged tenants and invalid reductions without calendar writes", async (ctx) => {
    if (skipUnlessStack(ctx, await isLocalStackReachable())) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants"); const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    try {
      const client = await makeAuthedServerClient(fixture.adminA);
      expect((await client.rpc("upsert_tenant_calendar_day_with_audit", { p_tenant_id: fixture.tenantB.id, p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_local_date: "2026-12-24", p_variant: "reduced_capacity", p_reduction_percent: 50 })).error?.code).toBe("42501");
      expect((await client.rpc("upsert_tenant_calendar_day_with_audit", { p_tenant_id: fixture.tenantA.id, p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_local_date: "2026-12-24", p_variant: "reduced_capacity", p_reduction_percent: 101 })).error?.code).toBe("23514");
      expect((await adminQuery<{ count: number }>("select count(*)::int as count from public.tenant_calendar_days where tenant_id=$1", [fixture.tenantA.id]))[0]?.count).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });
  test("[P0] saves the browser form's profile, schedule, exception, and calendar input in one transaction", async (ctx) => {
    if (skipUnlessStack(ctx, await isLocalStackReachable())) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    try {
      const [membership] = await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [fixture.tenantA.id, fixture.adminA.id]);
      const client = await makeAuthedServerClient(fixture.adminA);
      const saved = await client.rpc("save_resource_profile_form_with_audit", {
        p_tenant_id: fixture.tenantA.id, p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_membership_id: membership.id,
        p_work_role_id: null, p_employment_percentage: null,
        p_schedule: [{ weekday: 1, start: "07:00", end: "16:00", breaks: [{ start: "12:00", end: "12:30" }] }],
        p_exceptions: [{ kind: "blocked_time", date: "2026-10-16" }],
        p_calendar_day: { date: "2026-10-15", variant: "reduced_capacity", reductionPercent: 50 },
      });
      expect(saved.error).toBeNull();
      expect(typeof saved.data).toBe("string");
    } finally { await cleanupFixture(fixture); }
  });
  test("[P0] composite form RPC rejects foreign tenants and forged actors without writes", async (ctx) => {
    if (skipUnlessStack(ctx, await isLocalStackReachable())) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants");
    const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    try {
      const [membership] = await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [fixture.tenantA.id, fixture.adminA.id]);
      const input = {
        p_tenant_id: fixture.tenantA.id, p_correlation_id: crypto.randomUUID(), p_membership_id: membership.id,
        p_work_role_id: null, p_employment_percentage: null, p_schedule: [], p_exceptions: [], p_calendar_day: null,
      };
      const foreign = await (await makeAuthedServerClient(fixture.adminB)).rpc("save_resource_profile_form_with_audit", { ...input, p_actor_user_id: fixture.adminB.id });
      const forgedActor = await (await makeAuthedServerClient(fixture.adminA)).rpc("save_resource_profile_form_with_audit", { ...input, p_correlation_id: crypto.randomUUID(), p_actor_user_id: fixture.adminB.id });
      expect(foreign.error?.code).toBe("42501");
      expect(forgedActor.error?.code).toBe("42501");
      expect((await adminQuery<{ count: number }>("select count(*)::int as count from public.person_profiles where tenant_id=$1", [fixture.tenantA.id]))[0]?.count).toBe(0);
      expect((await adminQuery<{ count: number }>("select count(*)::int as count from public.person_work_hours where tenant_id=$1", [fixture.tenantA.id]))[0]?.count).toBe(0);
      expect((await adminQuery<{ count: number }>("select count(*)::int as count from public.tenant_calendar_days where tenant_id=$1", [fixture.tenantA.id]))[0]?.count).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });
});
