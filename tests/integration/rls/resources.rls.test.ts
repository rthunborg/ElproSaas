import { describe, expect, test } from "vitest";
import { TENANT_TABLES } from "./tenant-table-inventory";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("Story 14.1 resource RLS enrollment", () => {
  test("[P0] enrolls every resource table in the manifest-derived H4 inventory", () => {
    expect(TENANT_TABLES).toEqual(expect.arrayContaining(["person_profiles", "person_work_hours", "tenant_calendar_days"]));
  });
  test("[P0] tenant B cannot read or mutate tenant A resource rows", async (ctx) => {
    if (skipUnlessStack(ctx, await isLocalStackReachable())) return;
    const { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } = await import("../../factories/tenants"); const { adminQuery } = await import("../../factories/admin-sql"); const fixture = await createTwoTenantFixture();
    try {
      const membershipId = crypto.randomUUID(); const profileId = crypto.randomUUID();
      await adminQuery("insert into public.tenant_memberships (id,tenant_id,user_id,role,status) values ($1,$2,$3,'montor','active')", [membershipId, fixture.tenantA.id, fixture.orphanUser.id]);
      await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) values ($1,$2,'montor')", [fixture.tenantA.id, membershipId]);
      const hourId = crypto.randomUUID(); const calendarDayId = crypto.randomUUID();
      await adminQuery("insert into public.person_profiles (id,tenant_id,membership_id) values ($1,$2,$3)", [profileId, fixture.tenantA.id, membershipId]);
      await adminQuery("insert into public.person_work_hours (id,tenant_id,person_profile_id,entry_kind,weekday,starts_at,ends_at) values ($1,$2,$3,'weekly_shift',1,'07:00','16:00')", [hourId, fixture.tenantA.id, profileId]);
      await adminQuery("insert into public.tenant_calendar_days (id,tenant_id,local_date,variant,reduction_percent) values ($1,$2,'2026-12-24','reduced_capacity',50)", [calendarDayId, fixture.tenantA.id]);
      const tenantB = await makeAuthedServerClient(fixture.adminB);
      const read = await tenantB.from("person_profiles").select("id").eq("id", profileId); const profileWrite = await tenantB.from("person_profiles").update({ employment_percentage: 50 }).eq("id", profileId);
      const hourWrite = await tenantB.from("person_work_hours").update({ ends_at: "17:00" }).eq("id", hourId);
      const calendarWrite = await tenantB.from("tenant_calendar_days").update({ reduction_percent: 75 }).eq("id", calendarDayId);
      expect(read.error).toBeNull(); expect(read.data).toEqual([]); expect(profileWrite.error).toBeNull(); expect(hourWrite.error).toBeNull(); expect(calendarWrite.error).toBeNull();
      expect((await adminQuery<{ employment_percentage: number | null }>("select employment_percentage from public.person_profiles where id=$1", [profileId]))[0]?.employment_percentage).toBeNull();
      expect((await adminQuery<{ ends_at: string }>("select ends_at::text from public.person_work_hours where id=$1", [hourId]))[0]?.ends_at).toBe("16:00:00");
      expect((await adminQuery<{ reduction_percent: number }>("select reduction_percent from public.tenant_calendar_days where id=$1", [calendarDayId]))[0]?.reduction_percent).toBe(50);
    } finally { await cleanupFixture(fixture); }
  });
});
