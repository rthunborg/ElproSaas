import { authoritativeBookingRpc } from "../../support/booking-conflict-attestation";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { beforeAll, describe, expect, test } from "vitest";
import { adminQuery, adminSession } from "../../factories/admin-sql";
import { makeAnonServerClient, makeAuthedServerClient } from "../../factories/tenants";
import {
  bookingCommand, bookingInput, bookingPrivateColumns, bookingPublicColumns,
  bookingSnapshot, bookingTables, checkedBookingRpc, seedReadFixtures, withBookingFixture,
} from "../../support/bookings-atdd";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });

/** Exercises checked RPC authority, exact public reads and private outcome denial. */
describe("Story 14.2 booking authority ATDD", () => {
  test("[P0] 14.4 checked editor RPCs have closed anon ACL and current manager gate", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const anon = await makeAnonServerClient();
      const empty = { p_tenant_id: fx.base.tenantA.id, p_actor_id: fx.base.adminA.id,
        p_correlation_id: crypto.randomUUID(), p_command_id: crypto.randomUUID(), p_booking_id: null,
        p_proposed_id: crypto.randomUUID(), p_payload: {}, p_key_id: "test_v1", p_decision: null };
      const entries = [
        { name: "snapshot_booking_editor", args: empty },
        { name: "booking_editor_people", args: { p_tenant_id: fx.base.tenantA.id, p_actor_id: fx.base.adminA.id } },
        { name: "finalize_booking_editor", args: { ...empty, p_key_id: undefined, p_claims: null, p_output: null,
          p_signature: null, p_review_claims: null, p_review_groups: null, p_review_signature: null } },
      ];
      const before = await bookingSnapshot(fx.tenantIds);
      for (const entry of entries) for (const client of [anon,fx.montorClient,fx.foreignClient]) {
        const reply = await client.rpc(entry.name,entry.args);
        expect(reply.data).toBeNull(); expect(reply.error?.code).toBe("42501");
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    });
  });
  test("[P1] 14.2-RLS-002 secondary Montor grants own reads and revocation removes them", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const rows = await seedReadFixtures(fx);
      const before = await bookingSnapshot(fx.tenantIds);
      for (const scalarRole of ["saljare", "ekonomi"]) {
        await adminQuery("update public.tenant_memberships set role=$2 where id=$1", [fx.ownProfile.membershipId, scalarRole]);
        await adminQuery("delete from public.membership_roles where membership_id=$1", [fx.ownProfile.membershipId]);
        await adminQuery("insert into public.membership_roles(tenant_id,membership_id,role) values($1,$2,'montor')", [fx.base.tenantA.id, fx.ownProfile.membershipId]);
        const bookings = await fx.montorClient.from("bookings").select(bookingPublicColumns);
        expect(bookings.error).toBeNull(); expect(bookings.data?.map((row) => row.id).sort()).toEqual([rows.own, rows.shared].sort());
        const assignees = await fx.montorClient.from("booking_assignees").select("booking_id,person_profile_id");
        expect(assignees.error).toBeNull();
        expect(assignees.data?.map((row) => ({ bookingId: row.booking_id, profileId: row.person_profile_id })).sort((a,b) => a.bookingId.localeCompare(b.bookingId)))
          .toEqual([rows.own, rows.shared].sort().map((bookingId) => ({ bookingId, profileId: fx.ownProfile.id })));
        const conflicts = await fx.montorClient.from("booking_conflicts").select("id,booking_id,affected_person_profile_id");
        expect(conflicts.error).toBeNull(); expect(conflicts.data?.map((row) => row.id).sort()).toEqual([rows.ownConflict, rows.sharedOwnConflict].sort());
        for (const operation of ["create", "update"] as const) {
          const input = bookingInput([fx.ownProfile.id], operation === "update" ? { bookingId: rows.own } : {});
          expect(await bookingCommand(operation, fx.montorClient, input)).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
          expect((await checkedBookingRpc(operation, fx.montorClient, input, fx.base.tenantA.id, fx.users.montor.id)).error?.code).toBe("42501");
        }
        await adminQuery("delete from public.membership_roles where membership_id=$1 and role='montor'", [fx.ownProfile.membershipId]);
        for (const table of bookingTables) {
          const read = await fx.montorClient.from(table).select(table === "bookings" ? bookingPublicColumns : "id");
          expect(read.error).toBeNull(); expect(read.data).toEqual([]);
        }
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    });
  });
  test("[P0] 14.2-RLS-001 foreign booking/assignee/conflict reads and every write path expose no state", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const rows = await seedReadFixtures(fx); const before = await bookingSnapshot(fx.tenantIds);
      for (const [client, tenantId] of [[fx.foreignClient, fx.base.tenantA.id], [fx.adminClient, fx.base.tenantB.id]] as const) {
        for (const table of bookingTables) {
          const read = await client.from(table).select(table === "bookings" ? bookingPublicColumns : "id,tenant_id,booking_id")
            .eq("tenant_id", tenantId);
          expect(read.error).toBeNull(); expect(read.data).toEqual([]);
          const id = table === "bookings" ? (tenantId === fx.base.tenantA.id ? rows.own : rows.foreign) : before[table === "booking_assignees" ? "assignees" : "conflicts"]
            .find((item) => item.tenant_id === tenantId)?.id;
          const update = await client.from(table).update({ tenant_id: client === fx.adminClient ? fx.base.tenantA.id : fx.base.tenantB.id }).eq("id", id);
          const deletion = await client.from(table).delete().eq("id", id);
          expect(update.error?.code).toBe("42501"); expect(deletion.error?.code).toBe("42501");
        }
      }
      const foreignTarget = bookingInput([fx.ownProfile.id], { bookingId: rows.own });
      const unknownTarget = { ...foreignTarget, bookingId: crypto.randomUUID() };
      const foreign = await bookingCommand("update", fx.foreignClient, foreignTarget);
      const missing = await bookingCommand("update", fx.foreignClient, unknownTarget);
      expect(foreign).toMatchObject({ ok: false, code: "TENANT_ACCESS_DENIED" });
      expect(missing).toEqual(foreign); // no target-existence oracle
      for (const operation of ["create", "update"] as const) {
        const direct = await checkedBookingRpc(operation, fx.foreignClient, foreignTarget, fx.base.tenantA.id, fx.base.adminB.id);
        expect(direct.error?.code).toBe("42501");
        const spoofed = await checkedBookingRpc(operation, fx.adminClient,
          bookingInput([fx.foreignProfile.id], { bookingId: rows.foreign }), fx.base.tenantB.id, fx.base.adminA.id);
        expect(spoofed.error?.code).toBe("42501");
      }
      for (const table of bookingTables) {
        const source = before[table === "bookings" ? "bookings" : table === "booking_assignees" ? "assignees" : "conflicts"]
          .find((item) => item.tenant_id === fx.base.tenantA.id)!;
        expect((await fx.foreignClient.from(table).insert({ ...source, id: crypto.randomUUID() })).error?.code).toBe("42501");
      }
      for (const column of bookingPrivateColumns) for (const client of [fx.adminClient, fx.foreignClient])
        expect((await client.from("bookings").select(column)).error?.code).toBe("42501");
      const anon = await makeAnonServerClient();
      for (const table of bookingTables) {
        const read = await anon.from(table).select("id").eq("tenant_id", fx.base.tenantA.id);
        if (read.error) expect(read.error.code).toBe("42501"); else expect(read.data).toEqual([]);
        expect((await anon.from(table).delete().eq("tenant_id", fx.base.tenantA.id)).error?.code).toBe("42501");
      }
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });

  test("[P1] 14.2-RLS-002 Montor reads own/shared bookings, own assignment rows and own-participation visible conflicts only", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const rows = await seedReadFixtures(fx); const before = await bookingSnapshot(fx.tenantIds);
      const bookings = await fx.montorClient.from("bookings").select(bookingPublicColumns).order("id");
      expect(bookings.error).toBeNull();
      expect(bookings.data?.map((row) => row.id).sort()).toEqual([rows.own, rows.shared].sort());
      const assignments = await fx.montorClient.from("booking_assignees").select("id,tenant_id,booking_id,person_profile_id").order("id");
      expect(assignments.error).toBeNull();
      expect(assignments.data?.map((row) => ({ booking_id: row.booking_id, person_profile_id: row.person_profile_id }))
        .sort((a, b) => a.booking_id.localeCompare(b.booking_id)))
        .toEqual([rows.own, rows.shared].sort().map((booking_id) => ({ booking_id, person_profile_id: fx.ownProfile.id })));
      const conflicts = await fx.montorClient.from("booking_conflicts").select("id,tenant_id,booking_id,affected_person_profile_id,natural_key,status");
      expect(conflicts.error).toBeNull();
      expect(conflicts.data?.map((row) => row.id).sort()).toEqual([rows.ownConflict, rows.sharedOwnConflict].sort());
      expect((await fx.montorClient.from("person_profiles").select("id").eq("id", fx.coworkerProfile.id)).data).toEqual([]);
      for (const column of bookingPrivateColumns)
        expect((await fx.montorClient.from("bookings").select(column)).error?.code).toBe("42501");
      // Active membership is part of own-row authority; a stale signed JWT cannot retain it.
      await adminQuery("update public.tenant_memberships set status='disabled' where id=$1", [fx.ownProfile.membershipId]);
      for (const table of bookingTables) {
        const read = await fx.montorClient.from(table).select(table === "bookings" ? bookingPublicColumns : "id");
        expect(read.error).toBeNull(); expect(read.data).toEqual([]);
      }
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });

  test("[P1] 14.2-RLS-003 Montor cannot create/update via envelope, checked RPC or direct own-table DML", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const rows = await seedReadFixtures(fx); const before = await bookingSnapshot(fx.tenantIds);
      const input = bookingInput([fx.ownProfile.id], { bookingId: rows.own });
      for (const operation of ["create", "update"] as const) {
        expect(await bookingCommand(operation, fx.montorClient, input)).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
        expect((await checkedBookingRpc(operation, fx.montorClient, input, fx.base.tenantA.id, fx.users.montor.id)).error?.code).toBe("42501");
      }
      for (const table of bookingTables) {
        const source = before[table === "bookings" ? "bookings" : table === "booking_assignees" ? "assignees" : "conflicts"]
          .find((item) => item.tenant_id === fx.base.tenantA.id)!;
        expect((await fx.montorClient.from(table).insert({ ...source, id: crypto.randomUUID() })).error?.code).toBe("42501");
        expect((await fx.montorClient.from(table).update({ tenant_id: fx.base.tenantA.id }).eq("id", source.id)).error?.code).toBe("42501");
        expect((await fx.montorClient.from(table).delete().eq("id", source.id)).error?.code).toBe("42501");
      }
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });

  test("[P1] 14.2-RLS-004 admin/planner checked paths succeed but every outer wrapper independently rechecks authority", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const rows = await seedReadFixtures(fx);
      for (const [client, actor] of [[fx.adminClient, fx.base.adminA], [fx.plannerClient, fx.users.projektledare]] as const) {
        const input = bookingInput([fx.ownProfile.id]);
        const envelope = await bookingCommand("create", client, input); expect(envelope.ok).toBe(true); if (!envelope.ok) return;
        const direct = await authoritativeBookingRpc("create", client, bookingInput([fx.coworkerProfile.id]), fx.base.tenantA.id, actor.id);
        expect(direct.error).toBeNull(); expect(direct.data).toEqual({ bookingId: expect.any(String) });
        expect((await authoritativeBookingRpc("update", client,
          bookingInput([fx.ownProfile.id], { bookingId: envelope.data.bookingId }), fx.base.tenantA.id, actor.id)).error).toBeNull();
        for (const table of bookingTables) {
          const snapshot = await bookingSnapshot(fx.tenantIds);
          const source = snapshot[table === "bookings" ? "bookings" : table === "booking_assignees" ? "assignees" : "conflicts"]
            .find((row) => row.tenant_id === fx.base.tenantA.id)!;
          expect((await client.from(table).insert({ ...source, id: crypto.randomUUID() })).error?.code).toBe("42501");
          expect((await client.from(table).update({ tenant_id: fx.base.tenantA.id }).eq("id", source.id)).error?.code).toBe("42501");
          expect((await client.from(table).delete().eq("id", source.id)).error?.code).toBe("42501");
          const read = await client.from(table).select(table === "bookings" ? bookingPublicColumns : "id").eq("tenant_id", fx.base.tenantA.id);
          expect(read.error).toBeNull(); expect(read.data?.length).toBe(snapshot[table === "bookings" ? "bookings" : table === "booking_assignees" ? "assignees" : "conflicts"]
            .filter((row) => row.tenant_id === fx.base.tenantA.id).length);
        }
      }
      const before = await bookingSnapshot(fx.tenantIds);
      const input = bookingInput([fx.ownProfile.id], { bookingId: rows.own });
      for (const operation of ["create", "update"] as const) for (const actor of [null, fx.base.adminB.id])
        expect((await checkedBookingRpc(operation, fx.adminClient, input, fx.base.tenantA.id, actor)).error?.code).toBe("42501");
      const outsiders = [await makeAnonServerClient(), await makeAuthedServerClient(fx.base.orphanUser),
        await makeAuthedServerClient(fx.invitedUser), await makeAuthedServerClient(fx.disabledUser),
        await makeAuthedServerClient(fx.users.saljare), await makeAuthedServerClient(fx.users.ekonomi)];
      for (const client of outsiders) for (const operation of ["create", "update"] as const) {
        expect((await bookingCommand(operation, client, input)).ok).toBe(false);
        const claims = await client.auth.getUser();
        expect((await checkedBookingRpc(operation, client, input, fx.base.tenantA.id, claims.data.user?.id ?? null)).error?.code).toBe("42501");
      }
      // A direct wrapper cannot keep planner authority after role/status revocation.
      await adminQuery("delete from public.membership_roles where membership_id=$1", [fx.coworkerProfile.membershipId]);
      await adminQuery("update public.tenant_memberships set role='montor' where id=$1", [fx.coworkerProfile.membershipId]);
      for (const operation of ["create", "update"] as const)
        expect((await checkedBookingRpc(operation, fx.plannerClient, input, fx.base.tenantA.id, fx.users.projektledare.id)).error?.code).toBe("42501");
      for (const status of ["invited", "disabled"]) {
        await adminQuery("update public.tenant_memberships set status=$2 where tenant_id=$1 and user_id=$3", [fx.base.tenantA.id, status, fx.base.adminA.id]);
        for (const operation of ["create", "update"] as const)
          expect((await checkedBookingRpc(operation, fx.adminClient, input, fx.base.tenantA.id, fx.base.adminA.id)).error?.code).toBe("42501");
      }
      // Discover real private transaction primitives rather than guessing names.
      const primitives = await adminQuery<{ invocation: string; authenticated: boolean; anon: boolean }>(
        `select format('%I.%I(%s)',n.nspname,p.proname,
          (select string_agg('null::'||format_type(t,null),',' order by ordinal)
            from unnest(p.proargtypes::oid[]) with ordinality a(t,ordinal))) as invocation,
         has_function_privilege('authenticated',p.oid,'execute') as authenticated,
         has_function_privilege('anon',p.oid,'execute') as anon
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where ((n.nspname='private' and p.proname like '%booking%') or (n.nspname='public' and p.proname like 'booking%internal')) and p.prorettype<>'boolean'::regtype`);
      expect(primitives.length).toBeGreaterThanOrEqual(1);
      for (const primitive of primitives) {
        expect(primitive.authenticated).toBe(false); expect(primitive.anon).toBe(false);
        for (const role of ["authenticated", "anon"]) await adminSession(async ({ query }) => {
          await query("begin");
          try {
            await query(`set local role ${role}`);
            await expect(query(`select ${primitive.invocation}`)).rejects.toMatchObject({ code: "42501" });
          } finally { await query("rollback"); }
        });
      }
      const outerSecurity = await adminQuery<{ name: string; definer: boolean; hardened: boolean }>(
        `select p.proname as name,p.prosecdef as definer,
         coalesce(p.proconfig @> array['search_path=""'],false) as hardened
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname in ('create_booking','update_booking')`);
      expect(outerSecurity).toHaveLength(2);
      for (const outer of outerSecurity) expect(outer).toMatchObject({ definer: true, hardened: true });
      const forcedRls = await adminQuery<{ name: string; enabled: boolean; forced: boolean }>(
        "select relname as name,relrowsecurity as enabled,relforcerowsecurity as forced from pg_class where oid=any($1::regclass[])",
        [bookingTables.map((table) => `public.${table}`)]);
      expect(forcedRls).toHaveLength(3); for (const table of forcedRls) expect(table).toMatchObject({ enabled: true, forced: true });
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
});
