/** Story 14.3 RED fixtures. Privileged SQL is local test-only, never a client bypass.
 * Provider source: actual create/update Booking commands + envelope, booking-db,
 * 20261006113212_booking_replay_current_authority.sql; see binding contract below.
 */
import type { BookingFixture, BookingInput, BookingSnapshot, DurableRow } from "./bookings-atdd";
import type { TestServerClient } from "../factories/tenants";

export type Operation = "create" | "update";
export type DerivedConflict = {
  booking_id: string; related_booking_id: string | null; affected_person_profile_id: string | null;
  conflict_type: string; starts_at: string; ends_at: string; natural_key: string;
};
export type DetectionSnapshot = {
  tenantId: string; actorId: string; operation: Operation; commandId: string; bookingId: string;
  candidateDigest: string; factDigest: string; canonicalFacts: string; facts: unknown;
  engineVersion: string; configVersion: string; correlationId: string;
  keyId: string; issuedAt: string; expiresAt: string;
};
export type AttestedAttempt = {
  snapshot: DetectionSnapshot; outputText: string; signature: string;
};
export type FinalizeResult =
  | { kind: "committed"; bookingId: string }
  | { kind: "stale" }
  | { kind: "denied"; code: string };
export type RpcResult = { data: unknown; error: { code?: string } | null };

/** PROVISIONAL BINDING CONTRACT, NOT a guessed production export/RPC signature.
 * The author must bind checked snapshot/finalize to cookie-bound RPCs in
 * src/server/bookings/conflict-facts.ts and save-with-conflicts.ts; preview and
 * detect must call the SOLE conflicts.ts detector; attest must use actual
 * conflict-attestation.ts + synthetic LOCAL key bootstrap, never a fake verifier.
 * snapshot maps exact SQL canonical bytes/digest/validity, including proposed UUID.
 * normalize maps actual outputs to existing DB column names without rounding UTC.
 * observeCommand invokes the REAL create/update via envelope with a narrow
 * after-snapshot/before-finalize barrier; it records actual snapshot/finalize calls.
 * Its barrier must not replace RPCs, detection, signatures, or responses.
 * sql inventory lists every new helper/RPC regprocedure + exact actual arguments.
 * signedVariant re-signs intentional invalid authenticated fields with the real
 * signer, so shape/tenant/range/version checks are tested past valid HMAC verification.
 * The test loader FAILS until these exports are bound. No runtime imports of an
 * absent module exist during skipped-body collection; never add a test-only API.
 */
export interface ConflictBindings {
  sourceEvidence: string[];
  snapshot(client: TestServerClient, op: Operation, input: BookingInput, correlationId: string,
    claimed?: { tenantId?: string; actorId?: string }): Promise<DetectionSnapshot>;
  detect(snapshot: DetectionSnapshot): Promise<DerivedConflict[]>;
  preview(snapshot: DetectionSnapshot): Promise<DerivedConflict[]>;
  attest(snapshot: DetectionSnapshot, conflicts: DerivedConflict[]): Promise<AttestedAttempt>;
  signedVariant(attempt: AttestedAttempt, change: Record<string, unknown>): Promise<AttestedAttempt>;
  finalize(client: TestServerClient, input: BookingInput, attempt: AttestedAttempt | null): Promise<FinalizeResult>;
  observeCommand(client: TestServerClient, op: Operation, input: BookingInput, correlationId: string,
    afterSnapshot: (attempt: AttestedAttempt, index: number) => Promise<void>): Promise<{
      result: { ok: true; data: { bookingId: string } } | { ok: false; code: string; retryable?: boolean };
      snapshots: DetectionSnapshot[]; finalizations: FinalizeResult[];
    }>;
  normalizedRows(rows: DurableRow[]): DerivedConflict[];
  sqlInventory: {
    checked: { signature: string; name: string; args: Record<string, unknown> }[];
    private: { signature: string; name: string; args: Record<string, unknown> }[];
  };
  /** Existing admin invitation fixture setup + authenticated accept RPC, not a synthetic fact mutation. */
  prepareInvitationWriter(fx: BookingFixture): Promise<PreparedWriter>;
}
export async function loadConflictBindings(): Promise<ConflictBindings> {
  throw new Error("ATDD_BINDING_REQUIRED: bind real Story 14.3 snapshot, sole detector, preview, signer, finalize, command barrier and SQL inventory; no mocks/stub detector permitted");
}

/** No network/environment work until a skipped body is activated. */
export async function withConflictFixture(run: (fx: BookingFixture) => Promise<void>) {
  const { isLocalStackReachable } = await import("./test-env");
  if (!await isLocalStackReachable()) throw new Error("Story 14.3 requires authorized local stack; a skip is not acceptance evidence");
  const { withBookingFixture } = await import("./bookings-atdd");
  await withBookingFixture(async (fx) => {
    for (const profile of [fx.ownProfile, fx.coworkerProfile]) {
      const saved = await fx.adminClient.rpc("save_person_schedule_with_audit", {
        p_tenant_id: fx.base.tenantA.id, p_actor_user_id: fx.base.adminA.id,
        p_correlation_id: crypto.randomUUID(), p_person_profile_id: profile.id,
        p_schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "08:00", end: "16:00", breaks: [] })),
      });
      if (saved.error) throw new Error("Real schedule fixture failed");
    }
    await run(fx);
  });
}
export const conflictIdentity = (row: DurableRow) => ({
  id: row.id, natural_key: row.natural_key, status: row.status,
  acceptance_reason: row.acceptance_reason, accepted_by_membership_id: row.accepted_by_membership_id,
  accepted_at: row.accepted_at, resolution_outcome: row.resolution_outcome,
  resolved_by_membership_id: row.resolved_by_membership_id, resolved_at: row.resolved_at,
});
export function foreignState(state: BookingSnapshot, tenantId: string): BookingSnapshot {
  const own = (rows: DurableRow[]) => rows.filter((row) => row.tenant_id === tenantId);
  return { bookings: own(state.bookings), assignees: own(state.assignees), conflicts: own(state.conflicts), audit: own(state.audit) };
}

/** Owner fixture seeds existing acceptance workflow; Story 14.3 adds no accept action. */
export async function seedAcceptedConflict(id: string, membershipId: string) {
  const { adminQuery } = await import("../factories/admin-sql");
  await adminQuery("update public.booking_conflicts set status='accepted',acceptance_reason='Existing approved coordination',accepted_by_membership_id=$2,accepted_at='2026-10-06T08:00:00.123456Z' where id=$1", [id, membershipId]);
}
export async function seedWorkRole(fx: BookingFixture) {
  const saved = await fx.adminClient.rpc("upsert_work_role_with_audit", {
    p_tenant_id: fx.base.tenantA.id, p_actor_user_id: fx.base.adminA.id, p_correlation_id: crypto.randomUUID(),
    p_work_role_id: null, p_display_name: "Conflict fixture electrician", p_cost_rate_ore: 20000, p_sell_rate_ore: 40000,
  });
  if (saved.error || typeof saved.data !== "string") throw new Error("Real work role fixture failed");
  return saved.data;
}
export const consumedWriterKinds = ["schedule", "profile", "calendar", "combined_form", "work_role_upsert", "work_role_active", "membership", "invitation_acceptance"] as const;
export type WriterKind = typeof consumedWriterKinds[number];
export type PreparedWriter = {
  invoke: () => Promise<RpcResult>;
  /** Fixed source-table SQL; author invitation seam supplies its membership row. */
  lockSql: string; lockParams: unknown[];
};
/** Calls actual enrolled authenticated production writers. Money is not a detector fact. */
export async function prepareConsumedWriter(fx: BookingFixture, kind: WriterKind, bindings: ConflictBindings) {
  if (kind === "invitation_acceptance") return bindings.prepareInvitationWriter(fx);
  const workRoleId = await seedWorkRole(fx);
  let lockSql = "select id from public.person_profiles where id=$1 for update";
  let lockParams: unknown[] = [fx.ownProfile.id];
  if (kind === "calendar") {
    const seeded = await fx.adminClient.rpc("upsert_tenant_calendar_day_with_audit", {
      p_tenant_id: fx.base.tenantA.id, p_actor_user_id: fx.base.adminA.id, p_correlation_id: crypto.randomUUID(),
      p_local_date: "2026-10-12", p_variant: "reduced_capacity", p_reduction_percent: 25,
    });
    if (seeded.error) throw new Error("Calendar barrier fixture failed");
    lockSql = "select id from public.tenant_calendar_days where id=$1 for update"; lockParams = [seeded.data];
  } else if (kind === "work_role_upsert" || kind === "work_role_active") {
    lockSql = "select id from public.work_roles where id=$1 for update"; lockParams = [workRoleId];
  } else if (kind === "membership") {
    lockSql = "select id from public.tenant_memberships where id=$1 for update"; lockParams = [fx.coworkerProfile.membershipId];
  }
  const common = { p_tenant_id: fx.base.tenantA.id, p_actor_user_id: fx.base.adminA.id, p_correlation_id: crypto.randomUUID() };
  const invoke = async (): Promise<RpcResult> => {
    switch (kind) {
      case "schedule": return fx.adminClient.rpc("save_person_schedule_with_audit", { ...common, p_person_profile_id: fx.ownProfile.id, p_schedule: [{ weekday: 1, start: "09:00", end: "12:00", breaks: [] }] });
      case "profile": return fx.adminClient.rpc("upsert_person_profile_with_audit", { ...common, p_membership_id: fx.ownProfile.membershipId, p_work_role_id: workRoleId, p_employment_percentage: 80 });
      case "calendar": return fx.adminClient.rpc("upsert_tenant_calendar_day_with_audit", { ...common, p_local_date: "2026-10-12", p_variant: "closed", p_reduction_percent: null });
      case "combined_form": return fx.adminClient.rpc("save_resource_profile_form_with_audit", { ...common, p_membership_id: fx.ownProfile.membershipId, p_work_role_id: workRoleId, p_employment_percentage: 80, p_schedule: [{ weekday: 1, start: "08:00", end: "16:00", breaks: [] }], p_exceptions: [{ kind: "blocked_time", date: "2026-10-12", start: "08:00", end: "12:00" }], p_calendar_day: null });
      case "work_role_upsert": return fx.adminClient.rpc("upsert_work_role_with_audit", { ...common, p_work_role_id: workRoleId, p_display_name: "Renamed current role", p_cost_rate_ore: 20000, p_sell_rate_ore: 40000 });
      case "work_role_active": return fx.adminClient.rpc("set_work_role_active_with_audit", { ...common, p_work_role_id: workRoleId, p_is_active: false });
      case "membership": return fx.adminClient.rpc("admin_manage_membership", { p_tenant_id: fx.base.tenantA.id, p_membership_id: fx.coworkerProfile.membershipId, p_action: "disable", p_roles: [], p_reason: "Consumed fact race", p_operation_id: crypto.randomUUID() });
    }
  };
  return { invoke, lockSql, lockParams };
}

/** Deterministic barrier: observe real blocked sessions, never assume timing/FIFO. */
export async function waitForBlocked(ownerPid: number, count: number) {
  const { adminQuery } = await import("../factories/admin-sql");
  const { setTimeout: pause } = await import("node:timers/promises");
  for (let attempt = 0; attempt < 100; attempt++) {
    const [row] = await adminQuery<{ n: number }>(`with recursive blocked(pid) as (
      select pid from pg_stat_activity where $1=any(pg_blocking_pids(pid))
      union select a.pid from pg_stat_activity a join blocked b on b.pid=any(pg_blocking_pids(a.pid)))
      select count(*)::int as n from blocked b join pg_stat_activity a using(pid) where a.wait_event_type='Lock'`, [ownerPid]);
    if (row.n >= count) return;
    await pause(50);
  }
  throw new Error("Expected authenticated transaction never reached lock barrier");
}
/** Test-only fault after conflict preparation, including a delete-only refresh.
 * Existing audit fault helper is reused for its real audit trigger. Markers are
 * correlation scoped, revoked from all client roles and removed in finally.
 */
export async function withConflictFault<T>(correlationId: string, stage: "post_conflict" | "audit", run: () => Promise<T>): Promise<T> {
  const { adminQuery } = await import("../factories/admin-sql");
  if (stage === "audit") {
    const { withBookingFault } = await import("./bookings-atdd");
    return withBookingFault(correlationId, "audit", run);
  }
  await adminQuery(`create schema if not exists test_support;
    create table if not exists test_support.forced_conflict_failures(correlation_id uuid primary key);
    revoke all on test_support.forced_conflict_failures from public,anon,authenticated,service_role;
    create or replace function test_support.fail_conflict_preparation() returns trigger language plpgsql set search_path='' as $$
    begin
      if exists(select 1 from test_support.forced_conflict_failures f
        where f.correlation_id=nullif(current_setting('app.booking_correlation_id',true),'')::uuid)
      then raise exception 'forced post conflict failure' using errcode='XX000'; end if;
      return null;
    end $$;
    revoke all on function test_support.fail_conflict_preparation() from public,anon,authenticated,service_role;
    drop trigger if exists test_forced_conflict_preparation on public.booking_conflicts;
    create trigger test_forced_conflict_preparation after insert or update or delete on public.booking_conflicts
      for each statement execute function test_support.fail_conflict_preparation();`);
  await adminQuery("insert into test_support.forced_conflict_failures values($1)", [correlationId]);
  try { return await run(); }
  finally { await adminQuery("delete from test_support.forced_conflict_failures where correlation_id=$1", [correlationId]); }
}

