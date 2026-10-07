import { beforeAll, describe, expect, test } from "vitest";
import { adminQuery } from "../../factories/admin-sql";
import {
  cleanupFixture, createTwoTenantFixture, makeAuthedServerClient,
  type TestServerClient, type TwoTenantFixture,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

// playwright-utils deviation: Existing Vitest SQL/checked-RPC integration runner,
// not @playwright/test. Local-only tenant factories supply real Auth JWTs.
// Provider: 20261006122441_booking_conflict_detection_integration.sql;
// person-profiles.ts/profile-form.ts map defaultWorkRoleId -> p_work_role_id;
// work-hours.ts maps schedule.shifts -> p_schedule. Four RPCs check the real
// authenticated actor, current active roles and concrete same-tenant parents.

const resourceTables = ["person_profiles", "person_work_hours", "tenant_calendar_days"] as const;
const schedule = [{ weekday: 1, start: "08:00", end: "15:00", breaks: [{ start: "12:00", end: "12:30" }] }];
const exceptions = [{ kind: "blocked_time", date: "2026-10-19", start: "09:00", end: "10:00" }];
const calendarDay = { date: "2026-10-20", variant: "reduced_capacity", reductionPercent: 60 };
let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });

/** Snapshot full rows, including timestamps and audit payloads, not just counts. */
async function snapshot(tenantIds: readonly string[]) {
  const entries = await Promise.all(
    [...resourceTables, "audit_events"].map(async (table) => {
      const [row] = await adminQuery<{ rows: Record<string, unknown>[] }>(
        "select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) as rows from public." +
        table + " r where r.tenant_id=any($1::uuid[])", [tenantIds]);
      return [table, row.rows] as const;
    }),
  );
  return Object.fromEntries(entries);
}

type Targets = {
  tenantIds: readonly string[];
  membershipA: string; membershipB: string;
  profileA: string; profileB: string;
  roleA: string; roleB: string;
  clientA: TestServerClient; clientB: TestServerClient;
};

/** Uses existing tenant/auth factories; setup remains isolated per test. */
async function seedTargets(base: TwoTenantFixture): Promise<Targets> {
  const tenantIds = [base.tenantA.id, base.tenantB.id];
  const [memberA] = await adminQuery<{ id: string }>(
    "select id from public.tenant_memberships where tenant_id=$1 and user_id=$2",
    [base.tenantA.id, base.adminA.id]);
  const [memberB] = await adminQuery<{ id: string }>(
    "select id from public.tenant_memberships where tenant_id=$1 and user_id=$2",
    [base.tenantB.id, base.adminB.id]);
  const roleA = crypto.randomUUID(); const roleB = crypto.randomUUID();
  await adminQuery(
    "insert into public.work_roles(id,tenant_id,display_name,cost_rate_ore,sell_rate_ore) " +
    "values($1,$2,'Own resource role',10000,20000),($3,$4,'Foreign resource role',10000,20000)",
    [roleA, base.tenantA.id, roleB, base.tenantB.id]);
  const clientA = await makeAuthedServerClient(base.adminA);
  const clientB = await makeAuthedServerClient(base.adminB);
  const created: string[] = [];
  for (const [client, tenant, actor, membership, role] of [
    [clientA, base.tenantA.id, base.adminA.id, memberA.id, roleA],
    [clientB, base.tenantB.id, base.adminB.id, memberB.id, roleB],
  ] as const) {
    const reply = await client.rpc("save_resource_profile_form_with_audit", {
      p_tenant_id: tenant, p_actor_user_id: actor, p_correlation_id: crypto.randomUUID(),
      p_membership_id: membership, p_work_role_id: role, p_employment_percentage: 80,
      p_schedule: [{ weekday: 1, start: "07:00", end: "16:00", breaks: [{ start: "12:00", end: "12:30" }] }],
      p_exceptions: [{ kind: "training", date: "2026-10-19" }],
      p_calendar_day: { date: "2026-10-20", variant: "reduced_capacity", reductionPercent: 50 },
    });
    expect(reply.error).toBeNull();
    expect(reply.data).toEqual(expect.any(String));
    created.push(reply.data as string);
  }
  return { tenantIds, membershipA: memberA.id, membershipB: memberB.id,
    profileA: created[0], profileB: created[1], roleA, roleB, clientA, clientB };
}

function mutationEntries(base: TwoTenantFixture, targets: Targets, actorId: string) {
  const common = { p_tenant_id: base.tenantA.id, p_actor_user_id: actorId };
  const profile = { ...common, p_membership_id: targets.membershipA,
    p_work_role_id: targets.roleA, p_employment_percentage: 75 };
  return [
    { name: "upsert_person_profile_with_audit", correlation: crypto.randomUUID(), args: profile },
    { name: "save_person_schedule_with_audit", correlation: crypto.randomUUID(),
      args: { ...common, p_person_profile_id: targets.profileA, p_schedule: schedule } },
    { name: "upsert_tenant_calendar_day_with_audit", correlation: crypto.randomUUID(),
      args: { ...common, p_local_date: calendarDay.date, p_variant: calendarDay.variant, p_reduction_percent: calendarDay.reductionPercent } },
    { name: "save_resource_profile_form_with_audit", correlation: crypto.randomUUID(),
      args: { ...profile, p_schedule: schedule, p_exceptions: exceptions, p_calendar_day: calendarDay } },
  ];
}

/** Scoped normal FK-safe deletes precede shared best-effort fixture cleanup. */
async function cleanupOwned(base: TwoTenantFixture) {
  const tenants = [base.tenantA.id, base.tenantB.id];
  const users = [base.adminA.id, base.adminB.id, base.orphanUser.id];
  try {
    await adminQuery("delete from public.person_work_hours where tenant_id=any($1::uuid[])", [tenants]);
    await adminQuery("delete from public.person_profiles where tenant_id=any($1::uuid[])", [tenants]);
    await adminQuery("delete from public.tenant_calendar_days where tenant_id=any($1::uuid[])", [tenants]);
    await adminQuery("delete from public.work_roles where tenant_id=any($1::uuid[])", [tenants]);
  } finally { await cleanupFixture(base); }
  const [remaining] = await adminQuery<{ rows: number }>(
    "select (" +
    "(select count(*) from public.tenants where id=any($1::uuid[])) +" +
    "(select count(*) from public.tenant_memberships where tenant_id=any($1::uuid[])) +" +
    "(select count(*) from public.membership_roles where tenant_id=any($1::uuid[])) +" +
    "(select count(*) from public.person_profiles where tenant_id=any($1::uuid[])) +" +
    "(select count(*) from public.person_work_hours where tenant_id=any($1::uuid[])) +" +
    "(select count(*) from public.tenant_calendar_days where tenant_id=any($1::uuid[])) +" +
    "(select count(*) from public.work_roles where tenant_id=any($1::uuid[])) +" +
    "(select count(*) from public.audit_events where tenant_id=any($1::uuid[])) +" +
    "(select count(*) from auth.users where id=any($2::uuid[])))::int as rows", [tenants, users]);
  expect(remaining.rows, "owned resource fixture cleanup must leave no rows").toBe(0);
}

describe("Story 14.1 resource authority and schema boundary completion", () => {
  test("[P0] 14.1-RLS-001 own-tenant authorized caller cannot use real foreign membership or profile", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const base = await createTwoTenantFixture();
    try {
      const targets = await seedTargets(base);
      const before = await snapshot(targets.tenantIds);
      const common = { p_tenant_id: base.tenantA.id, p_actor_user_id: base.adminA.id };
      const foreignMember = { ...common, p_membership_id: targets.membershipB,
        p_work_role_id: targets.roleA, p_employment_percentage: 90 };
      const attempts = [
        { name: "upsert_person_profile_with_audit", args: foreignMember },
        { name: "save_resource_profile_form_with_audit", args: { ...foreignMember,
          p_schedule: schedule, p_exceptions: exceptions, p_calendar_day: calendarDay } },
        { name: "save_person_schedule_with_audit", args: { ...common,
          p_person_profile_id: targets.profileB, p_schedule: schedule } },
      ];
      for (const attempt of attempts) {
        const denied = await targets.clientA.rpc(attempt.name, { ...attempt.args, p_correlation_id: crypto.randomUUID() });
        expect(denied.data, "own-tenant admin: " + attempt.name).toBeNull();
        expect(denied.error?.code, "own-tenant admin: " + attempt.name).toBe("42501");
        expect(await snapshot(targets.tenantIds), attempt.name).toEqual(before);
      }
    } finally { await cleanupOwned(base); }
  });

  test("[P1] 14.1-RLS-002 lower roles cannot call any resource writer; projektledare persists audited mutations", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const base = await createTwoTenantFixture();
    try {
      const targets = await seedTargets(base);
      await adminQuery("delete from public.membership_roles where membership_id=$1", [targets.membershipA]);
      const before = await snapshot(targets.tenantIds);
      for (const role of ["montor", "saljare", "ekonomi"]) {
        await adminQuery("update public.tenant_memberships set role=$2 where id=$1", [targets.membershipA, role]);
        expect(await adminQuery<{ role: string; status: string }>(
          "select role,status from public.tenant_memberships where id=$1", [targets.membershipA]))
          .toEqual([{ role, status: "active" }]);
        for (const entry of mutationEntries(base, targets, base.adminA.id)) {
          const denied = await targets.clientA.rpc(entry.name, { ...entry.args, p_correlation_id: entry.correlation });
          expect(denied.data, role + ": " + entry.name).toBeNull();
          expect(denied.error?.code, role + ": " + entry.name).toBe("42501");
          expect(await snapshot(targets.tenantIds), role + ": " + entry.name).toEqual(before);
        }
      }
      await adminQuery("update public.tenant_memberships set role='projektledare' where id=$1", [targets.membershipA]);
      expect(await adminQuery<{ role: string; status: string }>(
        "select role,status from public.tenant_memberships where id=$1", [targets.membershipA]))
        .toEqual([{ role: "projektledare", status: "active" }]);
      const foreignBefore = await snapshot([base.tenantB.id]);
      const entries = mutationEntries(base, targets, base.adminA.id);
      const returnedIds: string[] = [];
      for (const entry of entries) {
        const saved = await targets.clientA.rpc(entry.name, { ...entry.args, p_correlation_id: entry.correlation });
        expect(saved.error, "projektledare: " + entry.name).toBeNull();
        expect(saved.data, "projektledare: " + entry.name).toEqual(expect.any(String));
        returnedIds.push(saved.data as string);
      }
      expect(returnedIds[0]).toBe(targets.profileA);
      expect(returnedIds[3]).toBe(targets.profileA);
      expect(await adminQuery<{ id: string; default_work_role_id: string; employment_percentage: number }>(
        "select id,default_work_role_id,employment_percentage from public.person_profiles where tenant_id=$1",
        [base.tenantA.id])).toEqual([{ id: targets.profileA, default_work_role_id: targets.roleA, employment_percentage: 75 }]);
      expect(await adminQuery<{ entry_kind: string; weekday: number | null; local_date: string | null;
        exception_kind: string | null; starts_at: string; ends_at: string }>(
        "select entry_kind,weekday,local_date::text,exception_kind,starts_at::text,ends_at::text " +
        "from public.person_work_hours where tenant_id=$1 and person_profile_id=$2 order by entry_kind",
        [base.tenantA.id, targets.profileA])).toEqual([
        { entry_kind: "exception", weekday: null, local_date: "2026-10-19", exception_kind: "blocked_time", starts_at: "09:00:00", ends_at: "10:00:00" },
        { entry_kind: "weekly_break", weekday: 1, local_date: null, exception_kind: null, starts_at: "12:00:00", ends_at: "12:30:00" },
        { entry_kind: "weekly_shift", weekday: 1, local_date: null, exception_kind: null, starts_at: "08:00:00", ends_at: "15:00:00" },
      ]);
      expect(await adminQuery<{ id: string; local_date: string; variant: string; reduction_percent: number }>(
        "select id,local_date::text,variant,reduction_percent from public.tenant_calendar_days where tenant_id=$1",
        [base.tenantA.id])).toEqual([{ id: returnedIds[2], local_date: "2026-10-20", variant: "reduced_capacity", reduction_percent: 60 }]);
      const audits = await adminQuery<{ command: string; event_type: string; target_type: string;
        target_id: string; actor_user_id: string; correlation_id: string; metadata: { targetId: string } }>(
        "select command,event_type,target_type,target_id,actor_user_id,correlation_id,metadata " +
        "from public.audit_events where tenant_id=$1 and correlation_id=any($2::uuid[]) order by command",
        [base.tenantA.id, entries.map((entry) => entry.correlation)]);
      const expectedByCall = [
        [["resources.profile.save", "resource_profile_saved", "person_profile", targets.profileA]],
        [["resources.schedule.save", "resource_schedule_saved", "person_profile", targets.profileA]],
        [["resources.calendar_day.save", "resource_calendar_day_saved", "tenant_calendar_day", returnedIds[2]]],
        [
          ["resources.profile.save", "resource_profile_saved", "person_profile", targets.profileA],
          ["resources.schedule.save", "resource_schedule_saved", "person_profile", targets.profileA],
          ["resources.exception.save", "resource_exception_saved", "person_profile", targets.profileA],
          ["resources.calendar_day.save", "resource_calendar_day_saved", "tenant_calendar_day", returnedIds[2]],
        ],
      ];
      expect(audits).toHaveLength(7);
      for (const [index, entry] of entries.entries()) {
        expect(audits.filter((audit) => audit.correlation_id === entry.correlation))
          .toEqual(expectedByCall[index].map(([command, event_type, target_type, target_id]) => ({
            command, event_type, target_type, target_id, actor_user_id: base.adminA.id,
            correlation_id: entry.correlation, metadata: { targetId: target_id },
          })).sort((a, b) => a.command.localeCompare(b.command)));
      }
      expect((await snapshot([base.tenantA.id])).audit_events).toHaveLength(
        before.audit_events.filter((row) => row.tenant_id === base.tenantA.id).length + 7);
      expect(await snapshot([base.tenantB.id])).toEqual(foreignBefore);
    } finally { await cleanupOwned(base); }
  });

  test("[P1] 14.1-RLS-003 no-member invited and disabled callers see no resources and cannot mutate", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const base = await createTwoTenantFixture();
    try {
      const targets = await seedTargets(base);
      await adminQuery("delete from public.membership_roles where membership_id=$1", [targets.membershipA]);
      await adminQuery("update public.tenant_memberships set role='projektledare' where id=$1", [targets.membershipA]);
      // Populated-table positive control prevents vacuous empty negative reads.
      for (const table of resourceTables) {
        const own = await targets.clientA.from(table).select("id").eq("tenant_id", base.tenantA.id);
        expect(own.error, table).toBeNull();
        expect(own.data?.length, table).toBeGreaterThan(0);
      }
      expect(await adminQuery("select id from public.tenant_memberships where user_id=$1", [base.orphanUser.id])).toEqual([]);
      const orphanClient = await makeAuthedServerClient(base.orphanUser);
      const before = await snapshot(targets.tenantIds);
      const cases = [
        { label: "no-member", client: orphanClient, actor: base.orphanUser.id, status: null },
        { label: "invited", client: targets.clientA, actor: base.adminA.id, status: "invited" },
        { label: "disabled", client: targets.clientA, actor: base.adminA.id, status: "disabled" },
      ];
      for (const actor of cases) {
        if (actor.status !== null) {
          await adminQuery("update public.tenant_memberships set status=$2 where id=$1", [targets.membershipA, actor.status]);
          expect(await adminQuery<{ role: string; status: string }>(
            "select role,status from public.tenant_memberships where id=$1", [targets.membershipA]))
            .toEqual([{ role: "projektledare", status: actor.status }]);
        }
        for (const table of resourceTables) {
          const read = await actor.client.from(table).select("id").eq("tenant_id", base.tenantA.id);
          expect(read.error, actor.label + ": " + table).toBeNull();
          expect(read.data, actor.label + ": " + table).toEqual([]);
        }
        for (const entry of mutationEntries(base, targets, actor.actor)) {
          const denied = await actor.client.rpc(entry.name, { ...entry.args, p_correlation_id: entry.correlation });
          expect(denied.data, actor.label + ": " + entry.name).toBeNull();
          expect(denied.error?.code, actor.label + ": " + entry.name).toBe("42501");
          expect(await snapshot(targets.tenantIds), actor.label + ": " + entry.name).toEqual(before);
        }
      }
    } finally { await cleanupOwned(base); }
  });

  test("[P1] 14.1-DB-001 second raw profile insert rejects unique membership with exact no-op state", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const base = await createTwoTenantFixture();
    try {
      const targets = await seedTargets(base);
      const before = await snapshot(targets.tenantIds);
      expect(await adminQuery<{ id: string }>(
        "select id from public.person_profiles where membership_id=$1", [targets.membershipA]))
        .toEqual([{ id: targets.profileA }]);
      // Raw privileged DML bypasses command/upsert prechecks and exercises
      // the actual membership uniqueness constraint with a different primary key.
      await expect(adminQuery(
        "insert into public.person_profiles(id,tenant_id,membership_id,default_work_role_id,employment_percentage) " +
        "values($1,$2,$3,$4,90)",
        [crypto.randomUUID(), base.tenantA.id, targets.membershipA, targets.roleA]))
        .rejects.toMatchObject({ code: "23505", constraint: "person_profiles_membership_id_key" });
      expect(await adminQuery<{ count: number }>(
        "select count(*)::int as count from public.person_profiles where membership_id=$1", [targets.membershipA]))
        .toEqual([{ count: 1 }]);
      expect(await snapshot(targets.tenantIds)).toEqual(before);
    } finally { await cleanupOwned(base); }
  });

  test("[P1] 14.1-DB-002 actual profile writers reject foreign and nonexistent default work roles without writes or audit", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const base = await createTwoTenantFixture();
    try {
      const targets = await seedTargets(base);
      const missingRole = crypto.randomUUID();
      expect(await adminQuery<{ id: string; tenant_id: string; is_active: boolean }>(
        "select id,tenant_id,is_active from public.work_roles where id=$1", [targets.roleB]))
        .toEqual([{ id: targets.roleB, tenant_id: base.tenantB.id, is_active: true }]);
      expect(await adminQuery("select id from public.work_roles where id=$1", [missingRole])).toEqual([]);
      expect(await adminQuery<{ default_work_role_id: string }>(
        "select default_work_role_id from public.person_profiles where id=$1", [targets.profileA]))
        .toEqual([{ default_work_role_id: targets.roleA }]);
      const before = await snapshot(targets.tenantIds);
      for (const role of [{ label: "foreign", id: targets.roleB }, { label: "nonexistent", id: missingRole }]) {
        const profile = { p_tenant_id: base.tenantA.id, p_actor_user_id: base.adminA.id,
          p_membership_id: targets.membershipA, p_work_role_id: role.id, p_employment_percentage: 90 };
        for (const entry of [
          { name: "upsert_person_profile_with_audit", args: profile },
          { name: "save_resource_profile_form_with_audit", args: { ...profile,
            p_schedule: schedule, p_exceptions: exceptions, p_calendar_day: calendarDay } },
        ]) {
          const denied = await targets.clientA.rpc(entry.name, { ...entry.args, p_correlation_id: crypto.randomUUID() });
          expect(denied.data, "own-tenant admin/" + role.label + ": " + entry.name).toBeNull();
          expect(denied.error?.code, "own-tenant admin/" + role.label + ": " + entry.name).toBe("42501");
          expect(await snapshot(targets.tenantIds), role.label + ": " + entry.name).toEqual(before);
        }
      }
    } finally { await cleanupOwned(base); }
  });
});
