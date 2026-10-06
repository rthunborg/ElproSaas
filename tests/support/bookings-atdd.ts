/** Story 14.2 real envelope/checked-RPC adapters and privileged durable fixtures. */
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
  commandId: string; bookingId?: string; startsAt: string; endsAt: string;
  allDay: boolean; description: string; status: "planned" | "cancelled";
  assigneeIds: string[]; workRoleId: string | null; jobId: string | null;
  customerId: string | null; facilityId: string | null; contactId: string | null;
};
export function bookingInput(assignees: string[], patch: Partial<BookingInput> = {}): BookingInput {
  return { commandId: crypto.randomUUID(), startsAt: "2026-10-12T06:00:00.000Z",
    endsAt: "2026-10-12T14:00:00.000Z", allDay: false,
    description: "Install lighting at workshop", status: "planned", assigneeIds: assignees,
    workRoleId: null, jobId: null, customerId: null, facilityId: null, contactId: null, ...patch };
}

/** Imports and executes the actual production command. */
export async function bookingCommand(operation: "create" | "update", client: TestServerClient,
  input: BookingInput, correlationId = crypto.randomUUID()) {
  const command = operation === "create"
    ? (await import("@/server/commands/bookings/create-booking")).createBooking
    : (await import("@/server/commands/bookings/update-booking")).updateBooking;
  return runCommand(command as Command<unknown, { bookingId: string }>, {
    client: client as never, input, correlationId,
  });
}

/** Calls the checked authenticated RPC with operation metadata outside the canonical payload. */
export function checkedBookingRpc(operation: "create" | "update", client: TestServerClient,
  input: BookingInput, tenantId: string, actorId: string | null,
  correlationId = crypto.randomUUID()) {
  const { commandId, bookingId, ...payload } = input;
  return client.rpc(operation === "create" ? "create_booking" : "update_booking", {
    p_tenant_id: tenantId, p_actor_id: actorId, p_correlation_id: correlationId,
    p_command_id: commandId, p_payload: payload,
    ...(operation === "update" ? { p_booking_id: bookingId } : {}),
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

/** Fixture workflow rows for read/constraint tests; no derived detector output. */
export async function seedReadFixtures(fx: BookingFixture) {
  const seed = async (tenantId: string, profiles: string[]) => {
    const id = crypto.randomUUID();
    await adminQuery("insert into public.bookings(id,tenant_id,starts_at,ends_at,description,create_command_id,create_payload_digest,create_result) values($1,$2,'2026-10-12T06:00:00Z','2026-10-12T14:00:00Z','Read fixture',$3,repeat('a',64),jsonb_build_object('bookingId',$1::uuid::text))", [id, tenantId, crypto.randomUUID()]);
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
      (id,tenant_id,booking_id,affected_person_profile_id,conflict_type,starts_at,ends_at,natural_key,status)
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

/** Owner-only correlation-scoped trigger faults test atomic preparation and audit rollback. */
export async function withBookingFault<T>(correlationId: string,
  stage: "after_booking" | "after_assignees" | "audit", run: () => Promise<T>): Promise<T> {
  await installBookingFaults();
  if (stage === "audit") {
    await adminQuery("insert into test_support.forced_audit_failures(correlation_id) values($1)", [correlationId]);
    try { return await run(); }
    finally { await adminQuery("delete from test_support.forced_audit_failures where correlation_id=$1", [correlationId]); }
  }
  await adminQuery("insert into test_support.forced_booking_failures(correlation_id,stage) values($1,$2)", [correlationId, stage]);
  try { return await run(); }
  finally { await adminQuery("delete from test_support.forced_booking_failures where correlation_id=$1", [correlationId]); }
}

export async function seedBookingReadRows(tenantId: string, profileId: string) {
  const bookingId = crypto.randomUUID();
  await adminQuery("insert into public.bookings(id,tenant_id,starts_at,ends_at,description,create_command_id,create_payload_digest,create_result) values($1,$2,'2026-10-12T06:00:00Z','2026-10-12T14:00:00Z','Read fixture',$3,repeat('a',64),jsonb_build_object('bookingId',$1::uuid::text))", [bookingId, tenantId, crypto.randomUUID()]);
  const [assignee] = await adminQuery<{id:string}>("insert into public.booking_assignees(tenant_id,booking_id,person_profile_id) values($1,$2,$3) returning id", [tenantId, bookingId, profileId]);
  const [conflict] = await adminQuery<{id:string}>("insert into public.booking_conflicts(tenant_id,booking_id,affected_person_profile_id,conflict_type,starts_at,ends_at,natural_key) values($1,$2,$3,'outside_work_hours','2026-10-12T06:00:00Z','2026-10-12T07:00:00Z',$4) returning id", [tenantId, bookingId, profileId, crypto.randomUUID()]);
  return { bookings: bookingId, booking_assignees: assignee.id, booking_conflicts: conflict.id };
}

let faultInstallation: Promise<void> | undefined;
function installBookingFaults(): Promise<void> {
  return faultInstallation ??= (async () => {
    await adminQuery(`create schema if not exists test_support;
      create table if not exists test_support.forced_booking_failures(correlation_id uuid primary key,stage text not null);
      revoke all on test_support.forced_booking_failures from public,anon,authenticated;
      create or replace function test_support.fail_booking_write() returns trigger language plpgsql set search_path='' as $$
      begin
        if exists(select 1 from test_support.forced_booking_failures f
          where f.correlation_id=nullif(current_setting('app.booking_correlation_id',true),'')::uuid and f.stage=TG_ARGV[0])
        then raise exception 'forced booking write failure' using errcode='XX000'; end if;
        return null;
      end $$;
      revoke all on function test_support.fail_booking_write() from public,anon,authenticated;
      drop trigger if exists test_forced_booking_failure on public.bookings;
      create trigger test_forced_booking_failure after insert or update on public.bookings
        for each statement execute function test_support.fail_booking_write('after_booking');
      drop trigger if exists test_forced_assignee_failure on public.booking_assignees;
      create trigger test_forced_assignee_failure after insert on public.booking_assignees
        for each statement execute function test_support.fail_booking_write('after_assignees');`);
  })();
}
