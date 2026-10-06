/**
 * Story 14.2 ATDD adapters. No booking behavior is implemented here.
 * All callers remain test.skip until the implementation author binds these seams.
 * Provisional bindings: createBooking/updateBooking exports, snake_case input,
 * create_result/update_outcomes storage, and checked RPC p_input named argument.
 * Align with actual implementation without replacing real runCommand/RPC execution.
 */
import type { Command } from "@/server/commands/envelope";
import { runCommand } from "@/server/commands/envelope";
import { adminQuery } from "../factories/admin-sql";
import {
  adminInsertContact, adminInsertCustomer, adminInsertFacility,
  cleanupRoleAwarePhaseAFixture, createRoleAwarePhaseAFixture,
  makeAuthedServerClient, type FixtureUser, type TestServerClient,
} from "../factories/tenants";

export const bookingTables = ["bookings", "booking_assignees", "booking_conflicts"] as const;
export const bookingPublicColumns = "id,tenant_id,starts_at,ends_at,all_day,work_role_id,job_id,customer_id,facility_id,contact_id,description,status,series_id,occurrence_index,is_exception,created_at,updated_at";
export const bookingPrivateColumns = ["create_command_id", "create_payload_digest", "create_result", "update_outcomes"] as const;
export type BookingInput = {
  command_id: string; booking_id?: string; starts_at: string; ends_at: string;
  all_day: boolean; description: string; status: "planned" | "cancelled";
  assignee_ids: string[]; work_role_id: string | null; job_id: string | null;
  customer_id: string | null; facility_id: string | null; contact_id: string | null;
};
export function bookingInput(assignees: string[], patch: Partial<BookingInput> = {}): BookingInput {
  return { command_id: crypto.randomUUID(), starts_at: "2026-10-12T06:00:00.000Z",
    ends_at: "2026-10-12T14:00:00.000Z", all_day: false,
    description: "Install lighting at workshop", status: "planned", assignee_ids: assignees,
    work_role_id: null, job_id: null, customer_id: null, facility_id: null, contact_id: null, ...patch };
}

/** Dynamic import avoids a static unresolved import before production commands exist. */
export async function bookingCommand(operation: "create" | "update", client: TestServerClient,
  input: BookingInput, correlationId = crypto.randomUUID()) {
  const modulePath = operation === "create"
    ? "@/server/commands/bookings/create-booking" : "@/server/commands/bookings/update-booking";
  const module = await import(/* @vite-ignore */ modulePath) as Record<string, Command<unknown, { targetId: string }>>;
  return runCommand(module[operation === "create" ? "createBooking" : "updateBooking"], {
    client: client as never, input, correlationId,
  });
}

/** Provider endpoint: NEW internal checked create_booking/update_booking RPCs.
 * Names are approved; final SQL argument lists are an implementation binding need.
 * Do not add HTTP routes, use private primitives, or substitute a detector here.
 */
export function checkedBookingRpc(operation: "create" | "update", client: TestServerClient,
  input: BookingInput, tenantId: string, actorId: string | null,
  correlationId = crypto.randomUUID()) {
  return client.rpc(operation === "create" ? "create_booking" : "update_booking", {
    p_tenant_id: tenantId, p_actor_user_id: actorId, p_correlation_id: correlationId,
    p_input: input,
  });
}

export type DurableRow = Record<string, unknown> & { id: string; tenant_id: string };
export type BookingSnapshot = {
  bookings: DurableRow[]; assignees: DurableRow[]; conflicts: DurableRow[]; audit: DurableRow[];
};
/** Read all columns, including private immutable outcomes, for BOTH isolated tenants. */
export async function bookingSnapshot(tenantIds: string[]): Promise<BookingSnapshot> {
  const read = async (table: string) => (await adminQuery<{ row: DurableRow }>(
    `select to_jsonb(t) as row from public.${table} t where tenant_id=any($1::uuid[]) order by tenant_id,id`,
    [tenantIds],
  )).map(({ row }) => row);
  const [bookings, assignees, conflicts, audit] = await Promise.all([
    read("bookings"), read("booking_assignees"), read("booking_conflicts"), read("audit_events"),
  ]);
  return { bookings, assignees, conflicts, audit };
}
export async function rowSnapshot(table: "jobs" | "person_profiles", id: string) {
  return adminQuery<{ row: DurableRow }>(`select to_jsonb(t) as row from public.${table} t where id=$1`, [id]);
}

export async function withBookingFixture(run: (fixture: Awaited<ReturnType<typeof seedBookingFixture>>) => Promise<void>) {
  const roleFixture = await createRoleAwarePhaseAFixture();
  try { await run(await seedBookingFixture(roleFixture)); }
  finally { await cleanupRoleAwarePhaseAFixture(roleFixture); }
}
async function seedBookingFixture(roleFixture: Awaited<ReturnType<typeof createRoleAwarePhaseAFixture>>) {
  const { base, users } = roleFixture;
  const seedProfile = async (tenantId: string, user: FixtureUser) => {
    const [membership] = await adminQuery<{ id: string }>(
      "select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [tenantId, user.id]);
    const id = crypto.randomUUID();
    await adminQuery("insert into public.person_profiles(id,tenant_id,membership_id) values($1,$2,$3)", [id, tenantId, membership.id]);
    return { id, membershipId: membership.id };
  };
  const [adminProfile, ownProfile, coworkerProfile, foreignProfile] = await Promise.all([
    seedProfile(base.tenantA.id, base.adminA), seedProfile(base.tenantA.id, users.montor),
    seedProfile(base.tenantA.id, users.projektledare), seedProfile(base.tenantB.id, base.adminB),
  ]);
  const [adminClient, plannerClient, montorClient, foreignClient] = await Promise.all([
    makeAuthedServerClient(base.adminA), makeAuthedServerClient(users.projektledare),
    makeAuthedServerClient(users.montor), makeAuthedServerClient(base.adminB),
  ]);
  return { ...roleFixture, adminProfile, ownProfile, coworkerProfile, foreignProfile,
    adminClient, plannerClient, montorClient, foreignClient,
    tenantIds: [base.tenantA.id, base.tenantB.id] };
}
export type BookingFixture = Awaited<ReturnType<typeof seedBookingFixture>>;

export async function seedBookingParents(tenantId: string) {
  const customerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: "Workshop customer" });
  const otherCustomerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: "Other customer" });
  const facilityId = await adminInsertFacility({ tenant_id: tenantId, customer_id: customerId, name: "Workshop" });
  const contactId = await adminInsertContact({ tenant_id: tenantId, customer_id: customerId, facility_id: facilityId, name: "Workshop contact" });
  const wrongFacilityId = await adminInsertFacility({ tenant_id: tenantId, customer_id: otherCustomerId, name: "Other workshop" });
  const wrongContactId = await adminInsertContact({ tenant_id: tenantId, customer_id: otherCustomerId, name: "Other contact" });
  const [role] = await adminQuery<{ id: string }>(
    "insert into public.work_roles(tenant_id,display_name,cost_rate_ore,sell_rate_ore) values($1,'Electrician',20000,40000) returning id", [tenantId]);
  // Existing Phase A createJob command produces the real basic-job record.
  const { createJob } = await import("@/server/commands/jobs");
  return { customerId, otherCustomerId, facilityId, contactId, wrongFacilityId, wrongContactId, workRoleId: role.id, createJob };
}

/** Only fixture conflict-workflow rows: these are NOT server-derived detection output.
 * Provisional conflict window/actor names require binding to the author migration.
 */
export async function seedReadFixtures(fx: BookingFixture) {
  const seed = async (tenantId: string, profiles: string[]) => {
    const id = crypto.randomUUID();
    await adminQuery("insert into public.bookings(id,tenant_id,starts_at,ends_at,description) values($1,$2,'2026-10-12T06:00:00Z','2026-10-12T14:00:00Z','Read fixture')", [id, tenantId]);
    for (const profileId of profiles) await adminQuery(
      "insert into public.booking_assignees(tenant_id,booking_id,person_profile_id) values($1,$2,$3)", [tenantId, id, profileId]);
    return id;
  };
  const own = await seed(fx.base.tenantA.id, [fx.ownProfile.id]);
  const shared = await seed(fx.base.tenantA.id, [fx.ownProfile.id, fx.coworkerProfile.id]);
  const coworker = await seed(fx.base.tenantA.id, [fx.coworkerProfile.id]);
  const foreign = await seed(fx.base.tenantB.id, [fx.foreignProfile.id]);
  const conflict = async (tenantId: string, bookingId: string, profileId: string) => {
    const id = crypto.randomUUID();
    await adminQuery(`insert into public.booking_conflicts
      (id,tenant_id,booking_id,person_profile_id,type,starts_at,ends_at,natural_key,status)
      values($1,$2,$3,$4,'outside_work_hours','2026-10-12T06:00:00Z','2026-10-12T07:00:00Z',$5,'open')`,
    [id, tenantId, bookingId, profileId, `atdd-fixture:${id}`]);
    return id;
  };
  return { own, shared, coworker, foreign,
    ownConflict: await conflict(fx.base.tenantA.id, own, fx.ownProfile.id),
    sharedOwnConflict: await conflict(fx.base.tenantA.id, shared, fx.ownProfile.id),
    sharedCoworkerConflict: await conflict(fx.base.tenantA.id, shared, fx.coworkerProfile.id),
    invisibleOwnConflict: await conflict(fx.base.tenantA.id, coworker, fx.ownProfile.id),
    foreignConflict: await conflict(fx.base.tenantB.id, foreign, fx.foreignProfile.id) };
}

/** Implementation-local test seed seam, never a callable production fault switch.
 * Author must add correlation-scoped private control rows and seed-only trigger
 * faults after real booking/assignee preparation. No grants to anon/authenticated.
 * Audit stage reuses the established seed-installed forced_audit_failures trigger.
 */
export async function withBookingFault<T>(correlationId: string,
  stage: "after_booking" | "after_assignees" | "audit", run: () => Promise<T>): Promise<T> {
  if (stage === "audit") {
    await adminQuery("insert into test_support.forced_audit_failures(correlation_id) values($1)", [correlationId]);
    try { return await run(); }
    finally { await adminQuery("delete from test_support.forced_audit_failures where correlation_id=$1", [correlationId]); }
  }
  await adminQuery("insert into test_support.forced_booking_failures(correlation_id,stage) values($1,$2)", [correlationId, stage]);
  try { return await run(); }
  finally { await adminQuery("delete from test_support.forced_booking_failures where correlation_id=$1", [correlationId]); }
}
