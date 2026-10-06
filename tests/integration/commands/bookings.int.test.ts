import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { beforeAll, describe, expect, test } from "vitest";
import { setTimeout as pause } from "node:timers/promises";
import { runCommand } from "@/server/commands/envelope";
import { adminQuery, adminSession } from "../../factories/admin-sql";
import {
  bookingCommand, bookingInput, bookingSnapshot, checkedBookingRpc,
  rowSnapshot, seedBookingParents, seedReadFixtures, withBookingFault, withBookingFixture,
} from "../../support/bookings-atdd";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });

/** Retained foundation checks; derived conflict integration belongs to Story 14.3. */
describe("Story 14.2 booking transaction foundation ATDD", () => {
  test("[P1] 14.2-INT-003 six-digit timestamp replay agrees across envelope and checked RPC", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      for (const [startFraction, endFraction] of [["1", "6"], ["12", "65"], ["123", "654"], ["1234", "6543"], ["12345", "65432"], ["123456", "654321"]]) {
        const create = bookingInput([fx.ownProfile.id], {
          startsAt: `2026-10-12T06:00:00.${startFraction}Z`, endsAt: `2026-10-12T14:00:00.${endFraction}Z`,
        });
        const equivalent = { ...create, startsAt: `2026-10-12T08:00:00.${startFraction.padEnd(6, "0")}+02:00`, endsAt: `2026-10-12T16:00:00.${endFraction.padEnd(6, "0")}+02:00` };
        // Exercise both directions: checked RPC first for CREATE, envelope first for UPDATE.
        const created = await checkedBookingRpc("create", fx.adminClient, create, fx.base.tenantA.id, fx.base.adminA.id);
        expect(created.error).toBeNull();
        const bookingId = (created.data as { bookingId: string }).bookingId;
        const beforeReplay = await bookingSnapshot(fx.tenantIds);
        const createdRow = beforeReplay.bookings.find((row) => row.id === bookingId)!;
        expect(createdRow.starts_at).toBe(`2026-10-12T06:00:00.${startFraction}+00:00`);
        expect(createdRow.ends_at).toBe(`2026-10-12T14:00:00.${endFraction}+00:00`);
        expect(createdRow.create_result).toEqual(created.data);
        expect(await bookingCommand("create", fx.adminClient, equivalent)).toEqual({ ok: true, data: created.data });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(beforeReplay);
        const update = { ...create, bookingId, commandId: crypto.randomUUID(), description: "Microsecond update" };
        const updated = await bookingCommand("update", fx.adminClient, update);
        expect(updated).toEqual({ ok: true, data: { bookingId } });
        const beforeUpdateReplay = await bookingSnapshot(fx.tenantIds);
        const directReplay = await checkedBookingRpc("update", fx.adminClient, { ...equivalent, ...update, startsAt: equivalent.startsAt, endsAt: equivalent.endsAt }, fx.base.tenantA.id, fx.base.adminA.id);
        expect(directReplay.error).toBeNull(); expect(directReplay.data).toEqual({ bookingId });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(beforeUpdateReplay);
        const [stored] = await adminQuery<{ start: string; end: string }>(
          `select to_char(starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as start,
           to_char(ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "end" from public.bookings where id=$1`, [bookingId]);
        expect(stored).toEqual({ start: `2026-10-12T06:00:00.${startFraction.padEnd(6, "0")}Z`, end: `2026-10-12T14:00:00.${endFraction.padEnd(6, "0")}Z` });
      }
    });
  });

  test("[P1] 14.2-INT-005 overlapping same-key updates commit one outcome and one audit", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const created = await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id]));
      expect(created.ok).toBe(true); if (!created.ok) return;
      for (const differing of [false, true]) {
        const first = bookingInput([fx.coworkerProfile.id], { bookingId: created.data.bookingId, description: "Concurrent winner", startsAt: "2026-10-13T06:00:00.123456Z", endsAt: "2026-10-13T14:00:00.654321Z" });
        const inputs = differing ? [first, { ...first, description: "Other contender", assigneeIds: [fx.ownProfile.id] }] : [first, first, first, first];
        const correlations = inputs.map(() => crypto.randomUUID());
        const before = await bookingSnapshot(fx.tenantIds);
        const results = await adminSession(async ({ query }) => {
          await query("begin");
          let pending: Promise<Awaited<ReturnType<typeof bookingCommand>>[]> | undefined;
          try {
            const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
            await query("select id from public.bookings where id=$1 for update", [created.data.bookingId]);
            pending = Promise.all(inputs.map((input, index) => bookingCommand("update", fx.adminClient, input, correlations[index])));
            let blocked = 0;
            for (let attempt = 0; attempt < 100 && blocked < inputs.length; attempt++) {
              const [waiting] = await query<{ n: number }>(`with recursive blocked(pid) as (
                select pid from pg_stat_activity where $1=any(pg_blocking_pids(pid))
                union select a.pid from pg_stat_activity a join blocked b on b.pid=any(pg_blocking_pids(a.pid)))
                select count(*)::int as n from blocked b join pg_stat_activity a using(pid)
                where a.wait_event_type='Lock'`, [owner.pid]);
              blocked = waiting.n; if (blocked < inputs.length) await pause(50);
            }
            expect(blocked).toBe(inputs.length);
            await query("commit");
            return await pending;
          } finally { await query("rollback"); if (pending) await pending; }
        });
        const winners = results.map((result, index) => ({ result, index })).filter(({ result }) => result.ok);
        expect(winners).toHaveLength(differing ? 1 : 4);
        for (const result of results) if (result.ok) expect(result.data).toEqual({ bookingId: created.data.bookingId });
        if (differing) expect(results.find((result) => !result.ok)).toMatchObject({ ok: false, code: "COMMAND_CONFLICT" });
        const winnerIndex = winners[0].index;
        const after = await bookingSnapshot(fx.tenantIds);
        expect(after.bookings).toHaveLength(before.bookings.length); expect(after.conflicts).toEqual(before.conflicts);
        expect(after.audit).toHaveLength(before.audit.length + 1);
        const row = after.bookings.find((booking) => booking.id === created.data.bookingId)!;
        expect(row.description).toBe(inputs[winnerIndex].description);
        expect(after.assignees.filter((assignment) => assignment.booking_id === row.id).map((assignment) => assignment.person_profile_id).sort()).toEqual([...inputs[winnerIndex].assigneeIds].sort());
        const original = before.bookings.find((booking) => booking.id === row.id)!;
        expect(row).toMatchObject({ id: original.id, tenant_id: original.tenant_id, created_at: original.created_at,
          create_command_id: original.create_command_id, create_payload_digest: original.create_payload_digest, create_result: original.create_result,
          starts_at: "2026-10-13T06:00:00.123456+00:00", ends_at: "2026-10-13T14:00:00.654321+00:00",
          all_day: false, status: "planned", work_role_id: null, job_id: null, customer_id: null, facility_id: null, contact_id: null,
          series_id: null, occurrence_index: null, is_exception: false });
        expect(row.update_outcomes).toEqual({ ...(original.update_outcomes as Record<string, unknown>), [first.commandId]: { digest: expect.any(String), result: { bookingId: row.id } } });
        expect(after.bookings.filter((booking) => booking.id !== row.id)).toEqual(before.bookings.filter((booking) => booking.id !== row.id));
        expect(after.audit.filter((audit) => !correlations.includes(String(audit.correlation_id)))).toEqual(before.audit);
        const audits = after.audit.filter((audit) => correlations.includes(String(audit.correlation_id)));
        expect(audits).toHaveLength(1); expect(audits[0].target_id).toBe(row.id);
        if (differing) expect(audits[0].correlation_id).toBe(correlations[winnerIndex]);
        for (const input of inputs) {
          const replay = await bookingCommand("update", fx.adminClient, input);
          expect(replay.ok).toBe(input.description === inputs[winnerIndex].description);
          if (!replay.ok) expect(replay.code).toBe("COMMAND_CONFLICT");
          expect(await bookingSnapshot(fx.tenantIds)).toEqual(after);
        }
      }
    });
  });
  test("[P0] 14.2-INT-001 actual envelope commits exact booking, assignees, durable outcome and one audit", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const before = await bookingSnapshot(fx.tenantIds);
      const input = bookingInput([fx.ownProfile.id, fx.coworkerProfile.id]);
      const correlationId = crypto.randomUUID();
      const result = await bookingCommand("create", fx.adminClient, input, correlationId);
      expect(result.ok).toBe(true); if (!result.ok) return;
      expect(Object.keys(result.data)).toEqual(["bookingId"]);
      const after = await bookingSnapshot(fx.tenantIds);
      expect(after.bookings).toHaveLength(before.bookings.length + 1);
      const row = after.bookings.find((item) => item.id === result.data.bookingId);
      expect(row).toMatchObject({ tenant_id: fx.base.tenantA.id, description: input.description,
        status: "planned", all_day: false, series_id: null, occurrence_index: null, is_exception: false,
        create_command_id: input.commandId, create_result: result.data, update_outcomes: {} });
      expect(row?.create_payload_digest).toEqual(expect.any(String));
      expect(after.assignees.filter((item) => item.booking_id === result.data.bookingId)
        .map((item) => item.person_profile_id).sort()).toEqual([...input.assigneeIds].sort());
      expect(after.assignees).toHaveLength(before.assignees.length + 2);
      expect(after.audit).toHaveLength(before.audit.length + 1);
      expect(after.audit.filter((item) => item.correlation_id === correlationId)).toEqual([
        expect.objectContaining({ tenant_id: fx.base.tenantA.id, actor_user_id: fx.base.adminA.id,
          target_id: result.data.bookingId }),
      ]);
      const metadata = after.audit.find((item) => item.correlation_id === correlationId)?.metadata as Record<string, unknown>;
      expect(Object.keys(metadata).filter((key) => key !== "targetId")).toEqual([]);
      if ("targetId" in metadata) expect(metadata.targetId).toBe(result.data.bookingId);
      // Conflict persistence/derivation acceptance is deliberately transferred to 14.3.
      expect(after.bookings.filter((item) => item.tenant_id === fx.base.tenantB.id))
        .toEqual(before.bookings.filter((item) => item.tenant_id === fx.base.tenantB.id));
    });
  });

  test("[P1] 14.2-INT-002 update replaces mutable fields and exact assignees with immutable identity/history", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const created = await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id]));
      expect(created.ok).toBe(true); if (!created.ok) return;
      const before = await bookingSnapshot(fx.tenantIds); const original = before.bookings[0];
      const input = bookingInput([fx.coworkerProfile.id], { bookingId: created.data.bookingId,
        description: "Rescheduled workshop installation", status: "cancelled",
        startsAt: "2026-10-13T06:00:00Z", endsAt: "2026-10-13T10:00:00Z" });
      const correlationId = crypto.randomUUID();
      const result = await bookingCommand("update", fx.plannerClient, input, correlationId);
      expect(result).toEqual({ ok: true, data: { bookingId: created.data.bookingId } });
      const after = await bookingSnapshot(fx.tenantIds);
      expect(after.bookings).toHaveLength(1); expect(after.assignees).toHaveLength(1);
      expect(after.bookings[0]).toMatchObject({ id: original.id, tenant_id: original.tenant_id,
        created_at: original.created_at, create_command_id: original.create_command_id,
        create_payload_digest: original.create_payload_digest, create_result: original.create_result,
        description: input.description, status: "cancelled" });
      expect(new Date(String(after.bookings[0].starts_at)).toISOString()).toBe("2026-10-13T06:00:00.000Z");
      expect(after.assignees[0]).toMatchObject({ booking_id: original.id, person_profile_id: fx.coworkerProfile.id });
      expect(after.bookings[0].update_outcomes).toEqual({ [input.commandId]: {
        digest: expect.any(String), result: { bookingId: original.id },
      } });
      expect(after.audit).toHaveLength(before.audit.length + 1);
      expect(after.audit.filter((row) => row.correlation_id === correlationId)).toEqual([
        expect.objectContaining({ target_id: original.id, actor_user_id: fx.users.projektledare.id }),
      ]);
      const metadata = after.audit.find((item) => item.correlation_id === correlationId)?.metadata as Record<string, unknown>;
      expect(Object.keys(metadata).filter((key) => key !== "targetId")).toEqual([]);
      if ("targetId" in metadata) expect(metadata.targetId).toBe(original.id);
    });
  });

  test("[P1] 14.2-INT-003 canonical replay survives subsequent updates and assignee deactivation", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const create = bookingInput([fx.ownProfile.id, fx.coworkerProfile.id]);
      const first = await bookingCommand("create", fx.adminClient, create);
      expect(first.ok).toBe(true); if (!first.ok) return;
      const update = bookingInput(create.assigneeIds, { bookingId: first.data.bookingId, description: "First update" });
      const updated = await bookingCommand("update", fx.adminClient, update); expect(updated.ok).toBe(true);
      expect((await bookingCommand("update", fx.adminClient,
        { ...update, commandId: crypto.randomUUID(), description: "Later update" })).ok).toBe(true);
      await adminQuery("update public.tenant_memberships set status='disabled' where id=$1", [fx.ownProfile.membershipId]);
      const before = await bookingSnapshot(fx.tenantIds);
      const equivalent = { ...create, commandId: create.commandId.toUpperCase(),
        startsAt: "2026-10-12T08:00:00+02:00", endsAt: "2026-10-12T16:00:00+02:00",
        assigneeIds: [...create.assigneeIds].reverse().map((id) => id.toUpperCase()) };
      expect(await bookingCommand("create", fx.adminClient, equivalent)).toEqual(first);
      expect(await bookingCommand("update", fx.adminClient, { ...update, commandId: update.commandId.toUpperCase() })).toEqual(updated);
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      // Authorization still precedes replay, even for an existing durable outcome.
      await adminQuery("update public.tenant_memberships set status='disabled' where tenant_id=$1 and user_id=$2", [fx.base.tenantA.id, fx.base.adminA.id]);
      expect(await bookingCommand("create", fx.adminClient, create)).toMatchObject({ ok: false, code: "TENANT_MEMBERSHIP_REQUIRED" });
      expect((await checkedBookingRpc("create", fx.adminClient, create, fx.base.tenantA.id, fx.base.adminA.id)).error?.code).toBe("42501");
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });

  test("[P1] 14.2-INT-004 changed canonical scoped key returns generic conflict without any durable change", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const create = bookingInput([fx.ownProfile.id]);
      const first = await bookingCommand("create", fx.adminClient, create); expect(first.ok).toBe(true); if (!first.ok) return;
      const update = bookingInput([fx.ownProfile.id], { bookingId: first.data.bookingId });
      expect((await bookingCommand("update", fx.adminClient, update)).ok).toBe(true);
      for (const [operation, input] of [["create", create], ["update", update]] as const) {
        const before = await bookingSnapshot(fx.tenantIds);
        const denied = await bookingCommand(operation, fx.adminClient, { ...input, description: "Different canonical content" });
        expect(denied).toMatchObject({ ok: false, code: "COMMAND_CONFLICT", message: expect.any(String) });
        expect(Object.keys(denied).sort()).toEqual(["code", "message", "ok"]);
        for (const privateValue of [fx.base.tenantA.id, input.description, "Different canonical content", "SQL", "23505"])
          expect(JSON.stringify(denied)).not.toContain(privateValue);
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
      // UPDATE scopes include target; CREATE scopes include tenant.
      const second = await bookingCommand("create", fx.adminClient, bookingInput([fx.coworkerProfile.id]));
      expect(second.ok).toBe(true); if (!second.ok) return;
      expect((await bookingCommand("update", fx.adminClient, { ...update, bookingId: second.data.bookingId })).ok).toBe(true);
      expect((await bookingCommand("create", fx.foreignClient, { ...create, assigneeIds: [fx.foreignProfile.id] })).ok).toBe(true);
    });
  });

  test("[P1] 14.2-INT-005 concurrent identical creates persist one booking and one attributable audit", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const input = bookingInput([fx.ownProfile.id, fx.coworkerProfile.id]);
      const before = await bookingSnapshot(fx.tenantIds);
      const results = await Promise.all(Array.from({ length: 4 }, () => bookingCommand("create", fx.adminClient, input)));
      expect(results.every((result) => result.ok)).toBe(true);
      for (const result of results) expect(result).toEqual(results[0]);
      const after = await bookingSnapshot(fx.tenantIds);
      expect(after.bookings).toHaveLength(before.bookings.length + 1);
      expect(after.assignees).toHaveLength(before.assignees.length + 2);
      expect(after.audit).toHaveLength(before.audit.length + 1);
      expect(after.bookings[0]).toMatchObject({ create_command_id: input.commandId,
        create_result: results[0].ok ? results[0].data : undefined, update_outcomes: {} });
      expect(after.assignees.map((row) => row.person_profile_id).sort()).toEqual([...input.assigneeIds].sort());
    });
  });

  test("[P1] 14.2-INT-006 booking preparation and audit faults roll back create and update snapshots", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const seed = await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id]));
      expect(seed.ok).toBe(true); if (!seed.ok) return;
      for (const operation of ["create", "update"] as const) for (const stage of ["after_booking", "audit"] as const) {
        const input = bookingInput([fx.coworkerProfile.id], operation === "update" ? { bookingId: seed.data.bookingId } : {});
        const correlationId = crypto.randomUUID(); const before = await bookingSnapshot(fx.tenantIds);
        const result = await withBookingFault(correlationId, stage,
          () => bookingCommand(operation, fx.adminClient, input, correlationId));
        expect(result).toMatchObject({ ok: false, code: "SERVER_ERROR" });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
        expect((await bookingCommand(operation, fx.adminClient, input)).ok).toBe(true);
      }
    });
  });

  test("[P1] 14.2-INT-007 assignee preparation fault restores all business, outcomes and audit rows", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const seed = await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id]));
      expect(seed.ok).toBe(true); if (!seed.ok) return;
      for (const operation of ["create", "update"] as const) {
        const input = bookingInput([fx.coworkerProfile.id], operation === "update" ? { bookingId: seed.data.bookingId } : {});
        const correlationId = crypto.randomUUID(); const before = await bookingSnapshot(fx.tenantIds);
        expect(await withBookingFault(correlationId, "after_assignees", () => bookingCommand(operation, fx.adminClient, input, correlationId)))
          .toMatchObject({ ok: false, code: "SERVER_ERROR" });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    });
  });

  test("[P1] 14.2-DB-001 standalone booking preserves independent null links and reserved recurrence storage", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const input = bookingInput([fx.ownProfile.id]);
      const result = await bookingCommand("create", fx.adminClient, input); expect(result.ok).toBe(true);
      const snapshot = await bookingSnapshot(fx.tenantIds);
      expect(snapshot.bookings).toHaveLength(1);
      expect(snapshot.bookings[0]).toMatchObject({ work_role_id: null, job_id: null, customer_id: null,
        facility_id: null, contact_id: null, series_id: null, occurrence_index: null, is_exception: false });
      for (const forbidden of [{ seriesId: crypto.randomUUID() }, { occurrenceIndex: 1 },
        { isException: true }, { conflicts: [] }]) {
        const before = await bookingSnapshot(fx.tenantIds);
        expect(await bookingCommand("create", fx.adminClient, { ...input, commandId: crypto.randomUUID(), ...forbidden }))
          .toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    });
  });

  test("[P1] 14.2-DB-002 each nullable link accepts coherent own parents and rejects foreign/mismatched links atomically", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const own = await seedBookingParents(fx.base.tenantA.id); const foreign = await seedBookingParents(fx.base.tenantB.id);
      for (const patch of [{ workRoleId: own.workRoleId }, { customerId: own.customerId },
        { facilityId: own.facilityId }, { contactId: own.contactId },
        { customerId: own.customerId, facilityId: own.facilityId, contactId: own.contactId }])
        expect((await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id], patch))).ok).toBe(true);
      const refs = [{ workRoleId: foreign.workRoleId }, { customerId: foreign.customerId },
        { facilityId: foreign.facilityId }, { contactId: foreign.contactId },
        { customerId: own.customerId, facilityId: own.wrongFacilityId },
        { customerId: own.customerId, contactId: own.wrongContactId },
        { facilityId: own.facilityId, contactId: own.wrongContactId }];
      const target = (await bookingSnapshot(fx.tenantIds)).bookings[0].id;
      for (const patch of refs) for (const operation of ["create", "update"] as const) {
        const before = await bookingSnapshot(fx.tenantIds);
        const result = await bookingCommand(operation, fx.adminClient,
          bookingInput([fx.ownProfile.id], { ...patch, ...(operation === "update" ? { bookingId: target } : {}) }));
        expect(result.ok).toBe(false); if (!result.ok) expect(["VALIDATION_FAILED", "TENANT_ACCESS_DENIED"]).toContain(result.code);
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
      for (const [column, id] of [["work_role_id", foreign.workRoleId], ["customer_id", foreign.customerId],
        ["facility_id", foreign.facilityId], ["contact_id", foreign.contactId]]) {
        const before = await bookingSnapshot(fx.tenantIds);
        await expect(adminQuery(`update public.bookings set ${column}=$2 where id=$1`, [target, id])).rejects.toMatchObject({ code: "23503" });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
      const fixtures = await seedReadFixtures(fx);
      for (const [column, id] of [["booking_id", fixtures.foreign], ["related_booking_id", fixtures.foreign],
        ["affected_person_profile_id", fx.foreignProfile.id]]) {
        const before = await bookingSnapshot(fx.tenantIds);
        await expect(adminQuery(`update public.booking_conflicts set ${column}=$2 where id=$1`, [fixtures.ownConflict, id]))
          .rejects.toMatchObject({ code: "23503" });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    });
  });

  test("[P1] 14.2-DB-003 zero/negative booking and conflict windows plus incoherent workflow metadata are constrained", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const fixtures = await seedReadFixtures(fx);
      for (const end of ["2026-10-12T06:00:00Z", "2026-10-12T05:59:59Z"]) {
        const before = await bookingSnapshot(fx.tenantIds);
        expect(await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id], { endsAt: end })))
          .toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
        for (const table of ["bookings", "booking_conflicts"])
          await expect(adminQuery(`update public.${table} set ends_at=$2 where id=$1`, [table === "bookings" ? fixtures.own : fixtures.ownConflict, end]))
            .rejects.toMatchObject({ code: "23514" });
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
      for (const assignment of ["status='accepted'", "status='resolved'",
        "status='accepted',acceptance_reason=' ',accepted_by_membership_id=null,accepted_at=now()",
        "status='resolved',resolution_outcome=' ',resolved_by_membership_id=null,resolved_at=now()"])
        await expect(adminQuery(`update public.booking_conflicts set ${assignment} where id=$1`, [fixtures.ownConflict]))
          .rejects.toMatchObject({ code: "23514" });
    });
  });

  test("[P1] 14.2-DB-004 UTC timed/all-day bounds round-trip Stockholm spring 23h and fall 25h days", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      for (const [start, end, localStart, localEnd, hours] of [
        ["2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z", "2026-03-29 00:00:00", "2026-03-30 00:00:00", 23],
        ["2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z", "2026-10-25 00:00:00", "2026-10-26 00:00:00", 25],
      ] as const) {
        const result = await bookingCommand("create", fx.adminClient,
          bookingInput([fx.ownProfile.id], { startsAt: start, endsAt: end, allDay: true }));
        expect(result.ok).toBe(true); if (!result.ok) return;
        const [stored] = await adminQuery<{ start: string; end: string; hours: number; utc_start: Date; utc_end: Date }>(
          `select (starts_at at time zone 'Europe/Stockholm')::text as start,
           (ends_at at time zone 'Europe/Stockholm')::text as end,
           extract(epoch from ends_at-starts_at)::float/3600 as hours,
           starts_at as utc_start,ends_at as utc_end from public.bookings where id=$1`, [result.data.bookingId]);
        expect(stored).toMatchObject({ start: localStart, end: localEnd, hours });
        expect(stored.utc_start.toISOString()).toBe(new Date(start).toISOString());
        expect(stored.utc_end.toISOString()).toBe(new Date(end).toISOString());
      }
      const timed = bookingInput([fx.ownProfile.id], { startsAt: "2026-03-29T00:30:00Z", endsAt: "2026-03-29T01:30:00Z" });
      const saved = await bookingCommand("create", fx.adminClient, timed); expect(saved.ok).toBe(true); if (!saved.ok) return;
      const [timedRow] = await adminQuery<{ start: string; end: string }>(
        "select (starts_at at time zone 'Europe/Stockholm')::text as start,(ends_at at time zone 'Europe/Stockholm')::text as end from public.bookings where id=$1", [saved.data.bookingId]);
      expect(timedRow).toEqual({ start: "2026-03-29 01:30:00", end: "2026-03-29 03:30:00" });
      const before = await bookingSnapshot(fx.tenantIds);
      expect(await bookingCommand("create", fx.adminClient, { ...timed, commandId: crypto.randomUUID(), allDay: true }))
        .toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });

  test("[P1] 14.2-DB-005 assignee uniqueness, minimum set and composite child references cannot be bypassed", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      for (const assignees of [[], [fx.ownProfile.id, fx.ownProfile.id.toUpperCase()], [fx.foreignProfile.id]]) {
        const before = await bookingSnapshot(fx.tenantIds);
        const denied = await bookingCommand("create", fx.adminClient, bookingInput(assignees));
        expect(denied.ok).toBe(false); if (!denied.ok) expect(["VALIDATION_FAILED", "TENANT_ACCESS_DENIED"]).toContain(denied.code);
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
      const fixtures = await seedReadFixtures(fx); const before = await bookingSnapshot(fx.tenantIds);
      await expect(adminQuery("insert into public.booking_assignees(tenant_id,booking_id,person_profile_id) values($1,$2,$3)",
        [fx.base.tenantA.id, fixtures.own, fx.ownProfile.id])).rejects.toMatchObject({ code: "23505" });
      for (const [booking, profile] of [[fixtures.foreign, fx.ownProfile.id], [fixtures.own, fx.foreignProfile.id]])
        await expect(adminQuery("insert into public.booking_assignees(tenant_id,booking_id,person_profile_id) values($1,$2,$3)",
          [fx.base.tenantA.id, booking, profile])).rejects.toMatchObject({ code: "23503" });
      await expect(adminQuery("update public.booking_conflicts set natural_key=(select natural_key from public.booking_conflicts where id=$2) where id=$1",
        [fixtures.sharedOwnConflict, fixtures.ownConflict])).rejects.toMatchObject({ code: "23505" });
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });

  test("[P1] 14.2-INT-009 existing Phase A basic job ID/links remain intact on booking create and update", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const parents = await seedBookingParents(fx.base.tenantA.id);
      const job = await runCommand(parents.createJob, { client: fx.adminClient as never,
        input: { customer_id: parents.customerId, title: "Basic installation job" } });
      expect(job.ok).toBe(true); if (!job.ok) return;
      // createJob accepts customer/title only; fixture SQL establishes existing job-owned links.
      await adminQuery("update public.jobs set facility_id=$2,contact_id=$3 where id=$1",
        [job.data.targetId, parents.facilityId, parents.contactId]);
      const jobBefore = await rowSnapshot("jobs", job.data.targetId);
      const linked = bookingInput([fx.ownProfile.id], { jobId: job.data.targetId });
      const result = await bookingCommand("create", fx.adminClient, linked); expect(result.ok).toBe(true); if (!result.ok) return;
      expect((await bookingSnapshot(fx.tenantIds)).bookings[0]).toMatchObject({ job_id: job.data.targetId, customer_id: null, facility_id: null, contact_id: null });
      expect((await bookingCommand("update", fx.adminClient, { ...linked, commandId: crypto.randomUUID(), bookingId: result.data.bookingId, description: "Linked update" })).ok).toBe(true);
      expect(await rowSnapshot("jobs", job.data.targetId)).toEqual(jobBefore);
      const foreignParents = await seedBookingParents(fx.base.tenantB.id);
      const foreignJob = await runCommand(foreignParents.createJob, { client: fx.foreignClient as never, input: { customer_id: foreignParents.customerId } });
      expect(foreignJob.ok).toBe(true); if (!foreignJob.ok) return;
      for (const patch of [{ jobId: foreignJob.data.targetId }, { jobId: job.data.targetId, customerId: parents.otherCustomerId },
        { jobId: job.data.targetId, facilityId: parents.wrongFacilityId }, { jobId: job.data.targetId, contactId: parents.wrongContactId }]) {
        const before = await bookingSnapshot(fx.tenantIds);
        expect((await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id], patch))).ok).toBe(false);
        expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
      await expect(adminQuery("update public.bookings set job_id=$2 where id=$1", [result.data.bookingId, foreignJob.data.targetId]))
        .rejects.toMatchObject({ code: "23503" });
      expect(await rowSnapshot("jobs", job.data.targetId)).toEqual(jobBefore);
    });
  });

  test("[P1] 14.2-INT-010 disabled/archive assignment history survives; new assignment and lock race are rejected", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    await withBookingFixture(async (fx) => {
      const saved = await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id]));
      expect(saved.ok).toBe(true); if (!saved.ok) return;
      await adminQuery("update public.tenant_memberships set status='disabled' where id=$1", [fx.ownProfile.membershipId]);
      await adminQuery("update public.person_profiles set archived_at=now() where id=$1", [fx.ownProfile.id]);
      const before = await bookingSnapshot(fx.tenantIds);
      expect((await bookingCommand("create", fx.adminClient, bookingInput([fx.ownProfile.id]))).ok).toBe(false);
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(before);
      expect((await bookingCommand("update", fx.adminClient,
        bookingInput([fx.ownProfile.id], { bookingId: saved.data.bookingId, description: "Retain disabled history" }))).ok).toBe(true);
      const history = await bookingSnapshot(fx.tenantIds);
      expect(history.assignees).toEqual(before.assignees);
      expect((await rowSnapshot("person_profiles", fx.ownProfile.id))[0].row.archived_at).not.toBeNull();
      // Hold the assignee membership lock; commit deactivation before authoritative
      // assignment validation resumes. Poll actual lock blocking, never use a timing guess.
      const raceBefore = await bookingSnapshot(fx.tenantIds);
      await adminSession(async ({ query }) => {
        await query("begin");
        let pending: ReturnType<typeof bookingCommand> | undefined;
        try {
          const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
          await query("select id from public.tenant_memberships where id=$1 for update", [fx.coworkerProfile.membershipId]);
          pending = bookingCommand("create", fx.adminClient, bookingInput([fx.coworkerProfile.id]));
          let blocked = false;
          for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
            const [waiting] = await query<{ n: number }>("select count(*)::int as n from pg_stat_activity where $1=any(pg_blocking_pids(pid))", [owner.pid]);
            blocked = waiting.n > 0; if (!blocked) await pause(50);
          }
          expect(blocked).toBe(true);
          await query("update public.tenant_memberships set status='disabled' where id=$1", [fx.coworkerProfile.membershipId]);
          await query("commit");
          expect((await pending).ok).toBe(false);
        } finally { await query("rollback"); if (pending) await pending; }
      });
      expect(await bookingSnapshot(fx.tenantIds)).toEqual(raceBefore);
    });
  });
});
