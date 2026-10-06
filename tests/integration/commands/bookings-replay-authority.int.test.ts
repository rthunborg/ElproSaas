import { beforeAll, describe, expect, test } from "vitest";
import { setTimeout as pause } from "node:timers/promises";
import { adminQuery, adminSession } from "../../factories/admin-sql";
import { makeAuthedServerClient } from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  bookingCommand, bookingInput, bookingSnapshot, checkedBookingRpc, withBookingFixture,
} from "../../support/bookings-atdd";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });

/* Provider source: envelope.ts maps updateBooking to resources/Bookings.Manage;
 * envelope-core.ts checks current capability before ownership and execute.
 * resolve-tenant-context-core.ts rejects invited/disabled membership.
 * 20261006101609_bookings_and_assignees.sql checks current actor/roles in
 * update_booking and booking_write_internal before returning update_outcomes.
 * The forward replay correction rechecks under actor lock after serialization.
 * Public success is { bookingId }; checked RPC authority failures use 42501.
 */
describe("Story 14.2 completed UPDATE replay authority", () => {
  test.for([
    { name: "role downgraded and secondary roles removed", role: "saljare", status: "active", code: "PERMISSION_DENIED" },
    { name: "membership invited", role: "tenant_admin", status: "invited", code: "TENANT_MEMBERSHIP_REQUIRED" },
    { name: "membership disabled", role: "tenant_admin", status: "disabled", code: "TENANT_MEMBERSHIP_REQUIRED" },
  ] as const)("[P1] 14.2-INT-003 UPDATE replay rejects stale caller after $name", async (scenario, ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      // The union actor has a scalar admin role and real secondary planner/sales
      // grants. Reuse this authenticated client after changing database authority.
      const actor = fx.roleUnionUser;
      const client = await makeAuthedServerClient(actor);
      const [membership] = await adminQuery<{ id: string; role: string; status: string }>(
        "select id,role,status from public.tenant_memberships where tenant_id=$1 and user_id=$2",
        [fx.base.tenantA.id, actor.id]);
      expect(membership).toBeDefined();
      const secondaryRoles = await adminQuery<{
        id: string; tenant_id: string; membership_id: string; role: string; created_at: string;
      }>("select id,tenant_id,membership_id,role,created_at from public.membership_roles where membership_id=$1 order by id", [membership.id]);
      expect(secondaryRoles.map((row) => row.role).sort()).toEqual(["projektledare", "saljare"]);

      const create = bookingInput([fx.ownProfile.id]);
      const created = await bookingCommand("create", client, create);
      expect(created.ok).toBe(true); if (!created.ok) return;
      const update = bookingInput([fx.coworkerProfile.id], {
        bookingId: created.data.bookingId, description: "Completed update before authority revocation",
      });
      const updated = await bookingCommand("update", client, update);
      expect(updated).toEqual({ ok: true, data: { bookingId: created.data.bookingId } });
      const committed = await bookingSnapshot(fx.tenantIds);
      expect(committed.bookings.find((row) => row.id === created.data.bookingId)?.update_outcomes).toEqual({
        [update.commandId]: { digest: expect.any(String), result: { bookingId: created.data.bookingId } },
      });
      // Positive controls prove this exact completed key/payload is replayable
      // through both entry points, without a second outcome or audit event.
      expect(await bookingCommand("update", client, update)).toEqual(updated);
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(committed);
      const allowed = await checkedBookingRpc("update", client, update, fx.base.tenantA.id, actor.id);
      expect(allowed.error).toBeNull(); expect(allowed.data).toEqual({ bookingId: created.data.bookingId });
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(committed);

      try {
        await adminQuery("update public.tenant_memberships set role=$2,status=$3 where id=$1",
          [membership.id, scenario.role, scenario.status]);
        if (scenario.status === "active") {
          await adminQuery("delete from public.membership_roles where membership_id=$1", [membership.id]);
        }
        expect(await bookingCommand("update", client, update)).toMatchObject({ ok: false, code: scenario.code });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(committed);
        const denied = await checkedBookingRpc("update", client, update, fx.base.tenantA.id, actor.id);
        expect(denied.error?.code).toBe("42501"); expect(denied.data).toBeNull();
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(committed);
      } finally {
        // Restore actor state even on assertion failure, before fixture cleanup.
        await adminQuery("update public.tenant_memberships set role=$2,status=$3 where id=$1",
          [membership.id, membership.role, membership.status]);
        if (scenario.status === "active") {
          for (const row of secondaryRoles) {
            await adminQuery("insert into public.membership_roles(id,tenant_id,membership_id,role,created_at) values($1,$2,$3,$4,$5)",
              [row.id, row.tenant_id, row.membership_id, row.role, row.created_at]);
          }
        }
      }
    });
  });
});

// The production admin RPC serializes all role/status changes on the membership
// parent. Observe a blocked replay first, commit revocation, then release its
// command lock. This proves post-wait authority rather than a timing guess.
describe("Story 14.2 replay authority after serialization waits", () => {
  test.for([
    { operation: "create", revoke: "primary and secondary roles" },
    { operation: "update", revoke: "primary and secondary roles" },
    { operation: "create", revoke: "secondary-only planner" },
    { operation: "update", revoke: "secondary-only planner" },
    { operation: "create", revoke: "disabled membership" },
    { operation: "update", revoke: "disabled membership" },
  ] as const)("[P1] 14.2-INT-003 $operation replay rejects $revoke revoked during lock wait", async (scenario, ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const actor = fx.roleUnionUser;
      const client = await makeAuthedServerClient(actor);
      const [membership] = await adminQuery<{ id: string }>(
        "select id from public.tenant_memberships where tenant_id=$1 and user_id=$2",
        [fx.base.tenantA.id, actor.id]);
      const manage = (action: "re_role" | "disable", roles: string[]) => fx.adminClient.rpc("admin_manage_membership", {
        p_tenant_id: fx.base.tenantA.id, p_membership_id: membership.id,
        p_action: action, p_roles: roles, p_reason: "Booking replay authority regression",
        p_operation_id: crypto.randomUUID(),
      });
      if (scenario.revoke === "secondary-only planner") {
        expect((await manage("re_role", ["saljare", "projektledare"])).error).toBeNull();
      }
      const create = bookingInput([fx.ownProfile.id]);
      const created = await checkedBookingRpc("create", client, create, fx.base.tenantA.id, actor.id);
      expect(created.error).toBeNull();
      const bookingId = (created.data as { bookingId: string }).bookingId;
      const input = scenario.operation === "create" ? create : bookingInput([fx.coworkerProfile.id], {
        bookingId, description: "Completed update before concurrent revocation",
      });
      const successful = await checkedBookingRpc(scenario.operation, client, input, fx.base.tenantA.id, actor.id);
      expect(successful.error).toBeNull(); expect(successful.data).toEqual({ bookingId });
      const committed = await bookingSnapshot(fx.tenantIds);
      await adminSession(async ({ query }) => {
        await query("begin");
        let pending: Promise<Awaited<typeof successful>> | undefined;
        try {
          const [blocker] = await query<{ pid: number }>("select pg_backend_pid() as pid");
          if (scenario.operation === "create") {
            await query("select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text,0))", [fx.base.tenantA.id, input.commandId]);
          } else {
            await query("select id from public.bookings where id=$1 for update", [bookingId]);
          }
          pending = Promise.resolve(checkedBookingRpc(scenario.operation, client, input, fx.base.tenantA.id, actor.id));
          let blocked = false;
          for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
            const [waiting] = await query<{ blocked: boolean }>(
              "select exists(select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)) and wait_event_type='Lock') as blocked", [blocker.pid]);
            blocked = waiting.blocked; if (!blocked) await pause(50);
          }
          expect(blocked).toBe(true);
          const revoked = await manage(scenario.revoke === "disabled membership" ? "disable" : "re_role", ["saljare"]);
          expect(revoked.error).toBeNull();
          const [current] = await query<{ role: string; status: string; privileged_roles: number }>(
            `select m.role,m.status,(select count(*)::int from public.membership_roles r
             where r.membership_id=m.id and r.role in ('tenant_admin','projektledare')) as privileged_roles
             from public.tenant_memberships m where m.id=$1`, [membership.id]);
          if (scenario.revoke === "disabled membership") expect(current.status).toBe("disabled");
          else expect(current).toEqual({ role: "saljare", status: "active", privileged_roles: 0 });
          const afterRevocation = await bookingSnapshot(fx.tenantIds);
          expect(afterRevocation.bookings).toEqual(committed.bookings);
          expect(afterRevocation.assignees).toEqual(committed.assignees);
          expect(afterRevocation.conflicts).toEqual(committed.conflicts);
          expect(afterRevocation.audit).toHaveLength(committed.audit.length + 1);
          await query("commit");
          const denied = await pending;
          expect(denied.error?.code).toBe("42501"); expect(denied.data).toBeNull();
          expect(await bookingSnapshot(fx.tenantIds)).toEqual(afterRevocation);
        } finally {
          await query("rollback"); if (pending) await pending;
        }
      });
    });
  });
});

describe("Story 14.2 checked SQL timestamp grammar", () => {
  test.for(["create", "update"] as const)("[P1] 14.2-INT-008 $0 checked RPC rejects out-of-range clock fields", async (operation, ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const seed = await checkedBookingRpc("create", fx.adminClient, bookingInput([fx.ownProfile.id]), fx.base.tenantA.id, fx.base.adminA.id);
      expect(seed.error).toBeNull();
      const bookingId = (seed.data as { bookingId: string }).bookingId;
      const before = await bookingSnapshot(fx.tenantIds);
      // Each interval has a later valid end: hour 24 would otherwise normalize
      // into the following day in PostgreSQL. Bypass TypeScript validation.
      for (const invalid of ["2026-10-12T24:00:00Z", "2026-10-12T06:60:00Z", "2026-10-12T06:00:60Z"]) {
        for (const field of ["startsAt", "endsAt"] as const) {
          const input = bookingInput([fx.ownProfile.id], {
            ...(operation === "update" ? { bookingId } : {}),
            startsAt: "2026-10-11T06:00:00Z", endsAt: "2026-10-14T14:00:00Z", [field]: invalid,
          });
          const denied = await checkedBookingRpc(operation, fx.adminClient, input, fx.base.tenantA.id, fx.base.adminA.id);
          expect(denied.error?.code).toBe("23514"); expect(denied.data).toBeNull();
          expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
        }
      }
    });
  });
});
