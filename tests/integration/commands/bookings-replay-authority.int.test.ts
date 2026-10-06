import { beforeAll, describe, expect, test } from "vitest";
import { adminQuery } from "../../factories/admin-sql";
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