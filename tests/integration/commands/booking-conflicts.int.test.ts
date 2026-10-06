import { describe, expect, test } from "vitest";

/** Provider: actual createBooking/updateBooking -> runCommand -> booking-db.
 * Snapshot/finalize/preview bindings call production exports directly.
 * Native Vitest command/RLS suite; no HTTP/UI/consumer-provider contract exists.
 * Fixtures import lazily; no services start during collection.
 * Transferred INT-003 P0 / 004 P1 / 005 P1 / 006 P0 ALL must execute before 14.4/PR.
 */
async function harness() {
  const fixtures = await import("../../support/booking-conflicts-atdd");
  const bookings = await import("../../support/bookings-atdd");
  const sql = await import("../../factories/admin-sql");
  return { ...fixtures, ...bookings, ...sql };
}
function exactSuccess(result: { ok: boolean; data?: { bookingId: string }; code?: string }): string {
  expect(result.ok, result.code ?? "Expected real command success").toBe(true);
  if (!result.ok || !result.data) throw new Error("Expected real command success");
  expect(Object.keys(result.data)).toEqual(["bookingId"]);
  return result.data.bookingId;
}
type AuthorityGroup = "race" | "proof";
const authorityScenarios: { group: AuthorityGroup; title: string; run: () => Promise<void> }[] = [];
function registerAuthorityScenario(group: AuthorityGroup, title: string, run: () => Promise<void>) {
  authorityScenarios.push({ group, title, run });
}
function workflowOpen(rows: Record<string, unknown>[]) {
  for (const row of rows) expect(row).toMatchObject({ status: "open", acceptance_reason: null,
    accepted_by_membership_id: null, accepted_at: null, resolution_outcome: null,
    resolved_by_membership_id: null, resolved_at: null });
}

/** Private fixture signing only: database-relative bounds isolate each validity rule. */
async function proofWindow(kind: "expired" | "future" | "oversized") {
  const { adminQuery } = await import("../../factories/admin-sql");
  const offsets = kind === "expired" ? ["-3 seconds", "-2 seconds"]
    : kind === "future" ? ["30 seconds", "60 seconds"] : ["-1 second", "180 seconds"];
  const [window] = await adminQuery<{ issuedAt: string; expiresAt: string }>(`select
    to_char((clock_timestamp()+$1::interval) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "issuedAt",
    to_char((clock_timestamp()+$2::interval) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "expiresAt"`, offsets);
  return window;
}

describe("Story 14.3 authoritative conflict persistence", () => {
  test("[P1] 14.3-INT-001 frozen internal preview and real save use identical normalized conflicts", async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const peerId = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
      const input = h.bookingInput([fx.ownProfile.id, fx.coworkerProfile.id], { startsAt: "2026-10-12T08:00:00.123456Z", endsAt: "2026-10-12T10:00:00.654321Z" });
      const correlation = crypto.randomUUID();
      let expected: Awaited<ReturnType<typeof b.detect>> = [];
      const before = await h.bookingSnapshot(fx.tenantIds);
      const observed = await b.observeCommand(fx.adminClient, "create", input, correlation, async (attempt) => {
        expected = await b.detect(attempt.snapshot);
        expect(await b.preview(attempt.snapshot)).toEqual(expected);
        expect(expected.filter((row) => row.conflict_type === "double_booking")).toEqual([
          expect.objectContaining({ affected_person_profile_id: fx.ownProfile.id,
            starts_at: "2026-10-12T08:00:00.123456Z", ends_at: "2026-10-12T10:00:00.654321Z" }),
        ]);
      });
      const bookingId = exactSuccess(observed.result);
      const after = await h.bookingSnapshot(fx.tenantIds);
      expect(after.bookings.some((row) => row.id === bookingId)).toBe(true);
      expect(b.normalizedRows(after.conflicts.filter((row) => row.tenant_id === fx.base.tenantA.id))).toEqual(expected);
      expect(after.bookings.find((row) => row.id === peerId)).toEqual(before.bookings.find((row) => row.id === peerId));
      expect(h.foreignState(after, fx.base.tenantB.id)).toEqual(h.foreignState(before, fx.base.tenantB.id));
    });
  });

  test("[P1] 14.3-INT-002 a stale signed preview writes nothing after a peer booking commits", async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const input = h.bookingInput([fx.ownProfile.id]); const correlation = crypto.randomUUID();
      const snapshot = await b.snapshot(fx.adminClient, "create", input, correlation);
      const attempt = await b.attest(snapshot, await b.detect(snapshot));
      exactSuccess(await h.bookingCommand("create", fx.plannerClient, h.bookingInput([fx.ownProfile.id])));
      const before = await h.bookingSnapshot(fx.tenantIds);
      expect(await b.finalize(fx.adminClient, input, attempt)).toEqual({ kind: "stale" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      const current = await b.snapshot(fx.adminClient, "create", input, correlation);
      expect(current.factDigest).not.toBe(snapshot.factDigest);
      expect((await b.detect(current)).filter((row) => row.conflict_type === "double_booking")).toHaveLength(1);
    });
  });

  test("[P0] 14.3-INT-003 fresh actual CREATE commits exact conflicts, assignments, outcome and one target audit", async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
      const input = h.bookingInput([fx.ownProfile.id, fx.coworkerProfile.id], { startsAt: "2026-10-12T08:00:00.123456Z", endsAt: "2026-10-12T10:00:00.654321Z" });
      const correlation = crypto.randomUUID(); const before = await h.bookingSnapshot(fx.tenantIds);
      let expected: Awaited<ReturnType<typeof b.detect>> = [];
      const observed = await b.observeCommand(fx.adminClient, "create", input, correlation, async (attempt) => { expected = await b.detect(attempt.snapshot); });
      const bookingId = exactSuccess(observed.result); const after = await h.bookingSnapshot(fx.tenantIds);
      expect(after.bookings).toHaveLength(before.bookings.length + 1);
      expect(after.bookings.find((row) => row.id === bookingId)).toMatchObject({ tenant_id: fx.base.tenantA.id,
        starts_at: "2026-10-12T08:00:00.123456+00:00", ends_at: "2026-10-12T10:00:00.654321+00:00",
        description: input.description, all_day: false, status: "planned", create_command_id: input.commandId,
        create_payload_digest: expect.stringMatching(/^[a-f0-9]{64}$/), create_result: { bookingId }, update_outcomes: {} });
      expect(after.assignees.filter((row) => row.booking_id === bookingId).map((row) => row.person_profile_id).sort()).toEqual([...input.assigneeIds].sort());
      expect(after.assignees.filter((row) => row.booking_id !== bookingId)).toEqual(before.assignees);
      expect(expected.some((row) => row.conflict_type === "double_booking")).toBe(true);
      expect(b.normalizedRows(after.conflicts)).toEqual(expected);
      workflowOpen(after.conflicts.filter((row) => !before.conflicts.some((old) => old.natural_key === row.natural_key)));
      expect(after.audit.filter((row) => row.correlation_id !== correlation)).toEqual(before.audit);
      const audit = after.audit.filter((row) => row.correlation_id === correlation);
      expect(audit).toEqual([expect.objectContaining({ tenant_id: fx.base.tenantA.id, actor_user_id: fx.base.adminA.id, target_id: bookingId })]);
      const metadata = audit[0].metadata as Record<string, unknown>;
      expect(Object.keys(metadata).filter((key) => key !== "targetId")).toEqual([]);
      expect(h.foreignState(after, fx.base.tenantB.id)).toEqual(h.foreignState(before, fx.base.tenantB.id));
    });

  });

  test("[P1] 14.3-INT-004 replace old/new assignees/windows, preserve accepted keys, refresh peers and cancellation", async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      let oldPeer = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
      let candidate = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
      const newPeer = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.coworkerProfile.id], { startsAt: "2026-10-13T06:00:00Z", endsAt: "2026-10-13T14:00:00Z" })));
      const first = await h.bookingSnapshot(fx.tenantIds);
      const collision = first.conflicts.find((row) => row.conflict_type === "double_booking" && [oldPeer, candidate].includes(String(row.booking_id)));
      expect(collision).toBeDefined(); if (!collision) throw new Error("Real pair collision not detected");
      // Mutate the RELATED booking so the removed stale row is demonstrably owned
      // by a peer, regardless of the detector's canonical participant ordering.
      if (collision.booking_id === candidate) { const previous = oldPeer; oldPeer = candidate; candidate = previous; }
      expect(collision.booking_id).toBe(oldPeer); expect(collision.related_booking_id).toBe(candidate);
      await h.seedAcceptedConflict(collision.id, fx.adminProfile.membershipId);
      const accepted = (await h.bookingSnapshot(fx.tenantIds)).conflicts.find((row) => row.id === collision.id)!;
      exactSuccess(await h.bookingCommand("update", fx.plannerClient, h.bookingInput([fx.ownProfile.id], { bookingId: candidate, description: "Description changes preserve exact collision" })));
      const unchanged = await h.bookingSnapshot(fx.tenantIds);
      expect(h.conflictIdentity(unchanged.conflicts.find((row) => row.natural_key === accepted.natural_key)!)).toEqual(h.conflictIdentity(accepted));
      const beforeReplace = await h.bookingSnapshot(fx.tenantIds);
      const input = h.bookingInput([fx.coworkerProfile.id], { bookingId: candidate, startsAt: "2026-10-13T08:00:00.123456Z", endsAt: "2026-10-13T10:00:00.654321Z" });
      let expected: Awaited<ReturnType<typeof b.detect>> = [];
      const correlation = crypto.randomUUID();
      const observed = await b.observeCommand(fx.plannerClient, "update", input, correlation, async (attempt) => { expected = await b.detect(attempt.snapshot); });
      expect(exactSuccess(observed.result)).toBe(candidate);
      const replaced = await h.bookingSnapshot(fx.tenantIds);
      expect(b.normalizedRows(replaced.conflicts)).toEqual(expected);
      expect(replaced.conflicts.some((row) => row.natural_key === accepted.natural_key)).toBe(false);
      expect(replaced.conflicts.some((row) => row.booking_id === oldPeer || row.related_booking_id === oldPeer)).toBe(false);
      const fresh = replaced.conflicts.filter((row) => row.conflict_type === "double_booking");
      expect(fresh).toHaveLength(1);
      expect([fresh[0].booking_id, fresh[0].related_booking_id].sort()).toEqual([candidate, newPeer].sort());
      expect(fresh[0].affected_person_profile_id).toBe(fx.coworkerProfile.id); workflowOpen(fresh);
      expect(replaced.assignees.filter((row) => row.booking_id === candidate).map((row) => row.person_profile_id)).toEqual([fx.coworkerProfile.id]);
      expect(replaced.bookings.filter((row) => row.id !== candidate)).toEqual(beforeReplace.bookings.filter((row) => row.id !== candidate));
      expect(replaced.audit.filter((row) => row.correlation_id === correlation)).toEqual([expect.objectContaining({ target_id: candidate })]);
      exactSuccess(await h.bookingCommand("update", fx.adminClient, { ...input, commandId: crypto.randomUUID(), status: "cancelled" }));
      const cancelled = await h.bookingSnapshot(fx.tenantIds);
      expect(cancelled.conflicts.filter((row) => row.booking_id === candidate || row.related_booking_id === candidate)).toEqual([]);
      expect(cancelled.bookings.filter((row) => row.id !== candidate)).toEqual(replaced.bookings.filter((row) => row.id !== candidate));
      expect(h.foreignState(cancelled, fx.base.tenantB.id)).toEqual(h.foreignState(first, fx.base.tenantB.id));
    });
  });

  test("[P1] 14.3-INT-005 CREATE and UPDATE post-conflict/audit faults roll back every durable column", async () => {
    const h = await harness(); await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
      const target = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
      for (const operation of ["create", "update"] as const) for (const stage of ["post_conflict", "audit"] as const) {
        const input = h.bookingInput([fx.ownProfile.id, fx.coworkerProfile.id], { ...(operation === "update" ? { bookingId: target } : {}), startsAt: "2026-10-12T08:00:00.123456Z", endsAt: "2026-10-12T10:00:00.654321Z" });
        const correlation = crypto.randomUUID(); const before = await h.bookingSnapshot(fx.tenantIds);
        const failed = await h.withConflictFault(correlation, stage, () => h.bookingCommand(operation, fx.adminClient, input, correlation));
        expect(failed).toMatchObject({ ok: false, code: "SERVER_ERROR" });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        const retry = await h.bookingCommand(operation, fx.adminClient, input, correlation);
        const id = exactSuccess(retry); const after = await h.bookingSnapshot(fx.tenantIds);
        expect(after.audit.filter((row) => row.correlation_id === correlation)).toEqual([expect.objectContaining({ target_id: id })]);
        expect(after.bookings).toHaveLength(before.bookings.length + (operation === "create" ? 1 : 0));
        expect(after.conflicts.some((row) => row.conflict_type === "double_booking")).toBe(true);
      }
    });
  });

  test("[P0] 14.3-INT-006 real save refreshes stale facts under the original command UUID", async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const input = h.bookingInput([fx.ownProfile.id]); const correlation = crypto.randomUUID();
      let peerState: Awaited<ReturnType<typeof h.bookingSnapshot>> | undefined;
      const observed = await b.observeCommand(fx.adminClient, "create", input, correlation, async (_attempt, index) => {
        if (index === 0) {
          exactSuccess(await h.bookingCommand("create", fx.plannerClient, h.bookingInput([fx.ownProfile.id])));
          peerState = await h.bookingSnapshot(fx.tenantIds);
        } else expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(peerState);
      });
      const id = exactSuccess(observed.result);
      expect(observed.snapshots).toHaveLength(2);
      expect(observed.snapshots.map((row) => row.commandId)).toEqual([input.commandId, input.commandId]);
      expect(observed.finalizations).toEqual([{ kind: "stale" }, { kind: "committed", bookingId: id }]);
      const after = await h.bookingSnapshot(fx.tenantIds);
      expect(after.bookings).toHaveLength(peerState!.bookings.length + 1);
      expect(after.audit.filter((row) => row.correlation_id === correlation)).toEqual([expect.objectContaining({ target_id: id })]);
      expect(after.conflicts.filter((row) => row.conflict_type === "double_booking")).toHaveLength(1);
      expect(b.normalizedRows(after.conflicts)).toEqual(await b.detect(observed.snapshots[1]));
    });

  });

  test("[P0] AC10 three real stale attempts exhaust as retryable SERVER_ERROR without target/outcome/audit writes", async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const input = h.bookingInput([fx.ownProfile.id]); const correlation = crypto.randomUUID();
      let committedPeers: Awaited<ReturnType<typeof h.bookingSnapshot>>;
      const observed = await b.observeCommand(fx.adminClient, "create", input, correlation, async (_attempt, index) => {
        exactSuccess(await h.bookingCommand("create", fx.plannerClient, h.bookingInput([fx.ownProfile.id], { description: `Concurrent peer ${index}` })));
        committedPeers = await h.bookingSnapshot(fx.tenantIds);
      });
      expect(observed.result).toMatchObject({ ok: false, code: "SERVER_ERROR" });
      // Retry is represented by SERVER_ERROR, not an invented public wire field.
      expect(Object.keys(observed.result).sort()).toEqual(["code", "message", "ok"]);
      expect(observed.snapshots).toHaveLength(3);
      expect(observed.snapshots.map((row) => row.commandId)).toEqual([input.commandId, input.commandId, input.commandId]);
      expect(observed.finalizations).toEqual([{ kind: "stale" }, { kind: "stale" }, { kind: "stale" }]);
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(committedPeers!);
      expect(committedPeers!.bookings.some((row) => row.create_command_id === input.commandId)).toBe(false);
      expect(committedPeers!.audit.some((row) => row.correlation_id === correlation)).toBe(false);
    });
  });

  test("[P0] AC10 distinct-key concurrent bookings cannot commit a conflict-free write skew", async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const inputs = [h.bookingInput([fx.ownProfile.id]), h.bookingInput([fx.ownProfile.id])];
      const correlations = inputs.map(() => crypto.randomUUID()); const before = await h.bookingSnapshot(fx.tenantIds);
      let arrivals = 0; let release!: () => void; const barrier = new Promise<void>((resolve) => { release = resolve; });
      const runs = inputs.map((input, index) => b.observeCommand(fx.adminClient, "create", input, correlations[index], async (_attempt, retry) => {
        if (retry === 0) { arrivals++; if (arrivals === 2) release(); await barrier; }
      }));
      const results = await Promise.all(runs); const ids = results.map((row) => exactSuccess(row.result));
      expect(new Set(ids).size).toBe(2);
      expect(results.flatMap((row) => row.finalizations).filter((row) => row.kind === "stale")).toHaveLength(1);
      const after = await h.bookingSnapshot(fx.tenantIds);
      expect(after.bookings).toHaveLength(before.bookings.length + 2);
      expect(after.assignees).toHaveLength(before.assignees.length + 2);
      const collisions = after.conflicts.filter((row) => row.conflict_type === "double_booking");
      expect(collisions).toHaveLength(1);
      expect([collisions[0].booking_id, collisions[0].related_booking_id].sort()).toEqual([...ids].sort());
      expect(collisions[0].affected_person_profile_id).toBe(fx.ownProfile.id);
      expect(after.audit).toHaveLength(before.audit.length + 2);
      for (let index = 0; index < inputs.length; index++) {
        expect(after.audit.filter((row) => row.correlation_id === correlations[index])).toEqual([expect.objectContaining({ target_id: ids[index] })]);
        expect(await h.bookingCommand("create", fx.adminClient, inputs[index])).toEqual(results[index].result);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(after);
      }
    });
  });
});

// Every known consumed writer must acquire the common tenant gate BEFORE its row lock.
for (const writer of ["schedule", "profile", "calendar", "combined_form", "work_role_upsert", "work_role_active", "membership", "invitation_acceptance"] as const) {
  registerAuthorityScenario("race", `[P0] AC10 ${writer} holds first gate before row lock; waiting finalize verifies coherent facts`, async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const prepared = await h.prepareConsumedWriter(fx, writer, b);
      const input = h.bookingInput([fx.ownProfile.id]);
      const snapshot = await b.snapshot(fx.adminClient, "create", input, crypto.randomUUID());
      const attempt = await b.attest(snapshot, await b.detect(snapshot));
      const before = await h.bookingSnapshot(fx.tenantIds);
      await h.adminSession(async ({ query }) => {
        await query("begin"); let pendingWriter: ReturnType<typeof prepared.invoke> | undefined;
        let pendingFinalize: ReturnType<typeof b.finalize> | undefined;
        try {
          const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
          expect(await query(prepared.lockSql, prepared.lockParams)).toHaveLength(1);
          pendingWriter = prepared.invoke(); await h.waitForBlocked(owner.pid, 1);
          // The real writer holds the first gate while waiting on our row.
          pendingFinalize = b.finalize(fx.adminClient, input, attempt);
          await h.waitForBlocked(owner.pid, 2);
          expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
          await query("commit"); expect((await pendingWriter).error).toBeNull();
          const finalizeResult = await pendingFinalize;
          if (writer === "work_role_upsert" && finalizeResult.kind === "committed") {
            // A display-name-only catalog edit may be excluded from detector
            // facts. The gate still must be first, and equal facts may commit.
            expect(finalizeResult.bookingId).toBe(snapshot.bookingId);
            const committed = await h.bookingSnapshot(fx.tenantIds);
            expect(committed.bookings).toHaveLength(before.bookings.length + 1);
            expect(committed.assignees).toHaveLength(before.assignees.length + 1);
            expect(committed.bookings.find((row) => row.id === snapshot.bookingId)).toMatchObject({ create_command_id: input.commandId, create_result: { bookingId: snapshot.bookingId } });
            expect(committed.audit.filter((row) => row.correlation_id === snapshot.correlationId)).toEqual([expect.objectContaining({ target_id: snapshot.bookingId })]);
            expect(b.normalizedRows(committed.conflicts)).toEqual(await b.detect(snapshot));
            return;
          }
          expect(finalizeResult).toEqual({ kind: "stale" });
          const afterWriter = await h.bookingSnapshot(fx.tenantIds);
          expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(afterWriter);
          expect(afterWriter.bookings).toEqual(before.bookings);
          expect(afterWriter.assignees).toEqual(before.assignees);
          expect(afterWriter.conflicts).toEqual(before.conflicts);
          const current = await b.snapshot(fx.adminClient, "create", input, snapshot.correlationId);

          expect(current.factDigest).not.toBe(snapshot.factDigest);
          const expected = await b.detect(current);
          const retry = await b.finalize(fx.adminClient, input, await b.attest(current, expected));
          expect(retry).toEqual({ kind: "committed", bookingId: current.bookingId });
          expect(b.normalizedRows((await h.bookingSnapshot(fx.tenantIds)).conflicts)).toEqual(expected);
        } finally {
          await query("rollback"); await Promise.allSettled([pendingWriter, pendingFinalize]);
        }
      });
    });
  });
}

for (const operation of ["create", "update"] as const) {
  registerAuthorityScenario("race", `[P0] AC10 ${operation} replay waits for real admin revocation then denies without added writes`, async () => {
    const h = await harness(); await h.loadConflictBindings();
    const { makeAuthedServerClient } = await import("../../factories/tenants");
    await h.withConflictFixture(async (fx) => {
      const actor = fx.roleUnionUser; const client = await makeAuthedServerClient(actor);
      const [member] = await h.adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id=$1 and user_id=$2", [fx.base.tenantA.id, actor.id]);
      const create = h.bookingInput([fx.ownProfile.id]); const id = exactSuccess(await h.bookingCommand("create", client, create));
      const input = operation === "create" ? create : h.bookingInput([fx.ownProfile.id], { bookingId: id, description: "Historical update" });
      const original = operation === "create" ? { ok: true, data: { bookingId: id } } : await h.bookingCommand("update", client, input);
      exactSuccess(original); const committed = await h.bookingSnapshot(fx.tenantIds);
      expect(await h.bookingCommand(operation, client, input)).toEqual(original);
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(committed);
      await h.adminSession(async ({ query }) => {
        await query("begin"); let revoke: PromiseLike<{ error: { code?: string } | null }> | undefined;
        let replay: Promise<Awaited<ReturnType<typeof h.checkedBookingRpc>>> | undefined;
        try {
          const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
          await query("select id from public.tenant_memberships where id=$1 for update", [member.id]);
          revoke = fx.adminClient.rpc("admin_manage_membership", { p_tenant_id: fx.base.tenantA.id,
            p_membership_id: member.id, p_action: "re_role", p_roles: ["saljare"], p_reason: "Post-wait replay authority", p_operation_id: crypto.randomUUID() });
          // Convert thenable so the real RPC starts before observing the lock.
          revoke = Promise.resolve(revoke); await h.waitForBlocked(owner.pid, 1);
          replay = Promise.resolve(h.checkedBookingRpc(operation, client, input, fx.base.tenantA.id, actor.id)); await h.waitForBlocked(owner.pid, 2);
          await query("commit"); expect((await revoke).error).toBeNull();
          const denied = await replay; expect(denied.error?.code).toBe("42501"); expect(denied.data).toBeNull();
          const afterRevocation = await h.bookingSnapshot(fx.tenantIds);
          expect(afterRevocation.bookings).toEqual(committed.bookings);
          expect(afterRevocation.assignees).toEqual(committed.assignees);
          expect(afterRevocation.conflicts).toEqual(committed.conflicts);
          expect(afterRevocation.audit).toHaveLength(committed.audit.length + 1);
          expect(await h.bookingCommand(operation, client, input)).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
          expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(afterRevocation);
        } finally { await query("rollback"); await Promise.allSettled([revoke, replay]); }
      });
    });
  });

  registerAuthorityScenario("race", `[P1] AC10 ${operation} authorized historical replay survives assignee deactivation; changed payload conflicts`, async () => {
    const h = await harness(); await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const create = h.bookingInput([fx.ownProfile.id]); const id = exactSuccess(await h.bookingCommand("create", fx.adminClient, create));
      const input = operation === "create" ? create : h.bookingInput([fx.ownProfile.id], { bookingId: id, description: "Historical update" });
      const original = await h.bookingCommand(operation, fx.adminClient, input); exactSuccess(original);
      exactSuccess(await h.bookingCommand("update", fx.adminClient, h.bookingInput([fx.coworkerProfile.id], { bookingId: id, startsAt: "2026-10-13T06:00:00Z", endsAt: "2026-10-13T14:00:00Z" })));
      expect((await fx.adminClient.rpc("admin_manage_membership", { p_tenant_id: fx.base.tenantA.id,
        p_membership_id: fx.ownProfile.membershipId, p_action: "disable", p_roles: [], p_reason: "Retain booking history", p_operation_id: crypto.randomUUID() })).error).toBeNull();
      const before = await h.bookingSnapshot(fx.tenantIds);
      const canonical = { ...input, assigneeIds: [...input.assigneeIds].reverse(), startsAt: "2026-10-12T08:00:00+02:00", endsAt: "2026-10-12T16:00:00+02:00" };
      expect(await h.bookingCommand(operation, fx.adminClient, canonical)).toEqual(original);
      const direct = await h.checkedBookingRpc(operation, fx.adminClient, canonical, fx.base.tenantA.id, fx.base.adminA.id);
      expect(direct.error).toBeNull(); expect(direct.data).toEqual(original.ok ? original.data : undefined);
      expect(await h.bookingCommand(operation, fx.adminClient, { ...input, description: "Changed canonical payload" })).toMatchObject({ ok: false, code: "COMMAND_CONFLICT" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
}

const invalidProofCases = [
  "missing", "forged_signature", "malformed_signature", "tenantId", "actorId", "operation", "commandId",
  "bookingId", "candidateDigest", "factDigest", "outputText", "engineVersion", "configVersion",
  "correlationId", "keyId", "issuedAt", "expiresAt",
] as const;
for (const field of invalidProofCases) {
  registerAuthorityScenario("proof", `[P0] AC11 finalize rejects ${field} proof with exact durable no-op and valid control`, async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const input = h.bookingInput([fx.ownProfile.id]);
      const snapshot = await b.snapshot(fx.adminClient, "create", input, crypto.randomUUID());
      const valid = await b.attest(snapshot, await b.detect(snapshot));
      let invalid: typeof valid | null;
      if (field === "missing") invalid = null;
      else if (field === "forged_signature") invalid = { ...valid, signature: (valid.signature[0] === "0" ? "1" : "0") + valid.signature.slice(1) };
      else if (field === "malformed_signature") invalid = { ...valid, signature: "not-a-proof" };
      else {
        const changes: Record<string, unknown> = {
          tenantId: fx.base.tenantB.id, actorId: fx.base.adminB.id, operation: "update", commandId: crypto.randomUUID(),
          bookingId: crypto.randomUUID(), candidateDigest: "0".repeat(64), factDigest: "f".repeat(64), outputText: "[]",
          engineVersion: "unsupported", configVersion: "unsupported", correlationId: crypto.randomUUID(), keyId: "unknown-local-key",
          issuedAt: "2099-10-06T08:00:00.123456Z", expiresAt: "2000-10-06T08:00:00.123456Z",
        };
        // Alter after signing: each authority field must invalidate exact HMAC bytes.
        invalid = field === "outputText" ? { ...valid, outputText: '{"forged":true}' }
          : { ...valid, snapshot: { ...valid.snapshot, [field]: changes[field] } };
      }
      const before = await h.bookingSnapshot(fx.tenantIds);
      expect(await b.finalize(fx.adminClient, input, invalid)).toMatchObject({ kind: "denied" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      expect(await b.finalize(fx.adminClient, input, valid)).toEqual({ kind: "committed", bookingId: snapshot.bookingId });
    });
  });
}

for (const malformed of ["duplicate_natural_key", "foreign_person", "foreign_booking", "invalid_type", "reversed_interval", "out_of_range", "accepted_metadata", "unsupported_version", "expired_signed"] as const) {
  registerAuthorityScenario("proof", `[P0] AC11 SQL rejects correctly signed ${malformed} output/claims past HMAC verification`, async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
      const input = h.bookingInput([fx.ownProfile.id]); const snapshot = await b.snapshot(fx.adminClient, "create", input, crypto.randomUUID());
      const detected = await b.detect(snapshot); const valid = await b.attest(snapshot, detected);
      expect(detected.length).toBeGreaterThan(0);
      let output: Record<string, unknown>[] = detected.map((row) => ({ ...row }));
      const claims: Record<string, unknown> = {};
      switch (malformed) {
        case "duplicate_natural_key": output = [...output, { ...output[0] }]; break;
        case "foreign_person": output[0].affected_person_profile_id = fx.foreignProfile.id; break;
        case "foreign_booking": output[0].booking_id = crypto.randomUUID(); break;
        case "invalid_type": output[0].conflict_type = "client_override"; break;
        case "reversed_interval": output[0].ends_at = output[0].starts_at; break;
        case "out_of_range": output[0].starts_at = "2099-10-12T06:00:00Z"; output[0].ends_at = "2099-10-12T14:00:00Z"; break;
        case "accepted_metadata": output[0].status = "accepted"; output[0].acceptance_reason = "Client-authored authority"; break;
        case "unsupported_version": claims.engineVersion = "unsupported"; break;
        case "expired_signed": claims.expiresAt = "2000-10-06T08:00:00.123456Z"; break;
      }
      const invalid = await b.signedVariant(valid, { ...claims, conflicts: output });
      const before = await h.bookingSnapshot(fx.tenantIds);
      expect(await b.finalize(fx.adminClient, input, invalid)).toMatchObject({ kind: "denied" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      expect(await b.finalize(fx.adminClient, input, valid)).toEqual({ kind: "committed", bookingId: snapshot.bookingId });
    });
  });
}

registerAuthorityScenario("proof", "[P0] AC11 checked snapshot/finalize deny Montör and cross-tenant/actor callers", async () => {
  const h = await harness(); const b = await h.loadConflictBindings();
  await h.withConflictFixture(async (fx) => {
    const input = h.bookingInput([fx.ownProfile.id]);
    const current = await b.snapshot(fx.adminClient, "create", input, crypto.randomUUID());
    const valid = await b.attest(current, await b.detect(current));
    const before = await h.bookingSnapshot(fx.tenantIds);
    for (const caller of [fx.montorClient, fx.foreignClient]) {
      await expect(b.snapshot(caller, "create", input, crypto.randomUUID(), { tenantId: fx.base.tenantA.id, actorId: fx.base.adminA.id })).rejects.toMatchObject({ code: "42501" });
      expect(await b.finalize(caller, input, valid)).toMatchObject({ kind: "denied" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    }
    await expect(b.snapshot(fx.adminClient, "create", input, crypto.randomUUID(), { tenantId: fx.base.tenantB.id, actorId: fx.base.adminA.id })).rejects.toMatchObject({ code: "42501" });
    await expect(b.snapshot(fx.adminClient, "create", input, crypto.randomUUID(), { tenantId: fx.base.tenantA.id, actorId: fx.base.adminB.id })).rejects.toMatchObject({ code: "42501" });
    expect(await h.bookingCommand("create", fx.montorClient, input)).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
    expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
  });
});

registerAuthorityScenario("proof", "[P0] AC11 fresh legacy RPC/private helper/direct DML cannot bypass detection", async () => {
  const h = await harness(); const b = await h.loadConflictBindings();
  const { createClient } = await import("@supabase/supabase-js");
  const env = await import("../../support/test-env");
  const anon = createClient(env.LOCAL_SUPABASE_URL, env.LOCAL_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await h.withConflictFixture(async (fx) => {
    const target = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
    const before = await h.bookingSnapshot(fx.tenantIds);
    for (const operation of ["create", "update"] as const) {
      const input = h.bookingInput([fx.ownProfile.id], { ...(operation === "update" ? { bookingId: target } : {}) });
      const denied = await h.checkedBookingRpc(operation, fx.adminClient, input, fx.base.tenantA.id, fx.base.adminA.id);
      expect(denied.error).not.toBeNull(); expect(denied.data).toBeNull();
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      // Client payload cannot add attestation, derived conflicts or workflow status.
      for (const field of ["proof", "conflicts", "acceptedState"]) {
        const result = await h.bookingCommand(operation, fx.adminClient, { ...input, [field]: "forged" });
        expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    }
    for (const helper of b.sqlInventory.private) {
      for (const client of [anon, fx.adminClient, fx.montorClient]) {
        const denied = await client.rpc(helper.name, helper.args);
        expect(denied.error).not.toBeNull(); expect(denied.data).toBeNull();
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    }
    for (const client of [anon, fx.adminClient, fx.montorClient]) {
      for (const table of ["bookings", "booking_assignees", "booking_conflicts"] as const) {
        const denied = await client.from(table).update({ tenant_id: fx.base.tenantB.id }).eq("tenant_id", fx.base.tenantA.id);
        expect(denied.error?.code).toBe("42501");
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    }
    // ACL and search-path evidence derives from bound real SQL signatures, not guesses.
    expect(b.sqlInventory.checked.length).toBeGreaterThanOrEqual(2);
    expect(b.sqlInventory.private.length).toBeGreaterThan(0);
    for (const [kind, functions] of [["checked", b.sqlInventory.checked], ["private", b.sqlInventory.private]] as const) {
      for (const fn of functions) {
        const [acl] = await h.adminQuery<{ anon: boolean; authenticated: boolean; public_execute: boolean; search_path: string[] }>(
          `select has_function_privilege('anon',p.oid,'EXECUTE') as anon,
            has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
            exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
              where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,p.proconfig as search_path
           from pg_proc p where p.oid=$1::regprocedure`, [fn.signature]);
        expect(acl).toMatchObject({ anon: false, authenticated: kind === "checked", public_execute: false });
        expect(acl.search_path).toContain('search_path=""');
      }
    }
  });
});

registerAuthorityScenario("proof", "[P0] AC11 own-assignment conflict read scope survives authoritative peer refresh", async () => {
  const h = await harness(); await h.loadConflictBindings();
  await h.withConflictFixture(async (fx) => {
    const own = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
    exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id, fx.coworkerProfile.id])));
    exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.coworkerProfile.id])));
    const durable = await h.bookingSnapshot(fx.tenantIds);
    const visibleIds = durable.bookings.filter((row) => durable.assignees.some((a) => a.booking_id === row.id && a.person_profile_id === fx.ownProfile.id)).map((row) => row.id);
    expect(visibleIds).toContain(own);
    const visibleConflicts = durable.conflicts.filter((row) => visibleIds.includes(String(row.booking_id)) && row.affected_person_profile_id === fx.ownProfile.id);
    expect(visibleConflicts.length).toBeGreaterThan(0);
    const read = await fx.montorClient.from("booking_conflicts").select("*").order("tenant_id").order("id");
    expect(read.error).toBeNull(); expect(read.data).toEqual(visibleConflicts);
    expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(durable);
  });
});




// Each authority row executes as its own test with a visible outcome.
for (const scenario of authorityScenarios) test(scenario.title, scenario.run);

test("[P0] AC11 Node/Postgres proof framing matches exact UTF-8 and microsecond claims", async () => {
  const h = await harness(); const b = await h.loadConflictBindings();
  const { canonicalConflictProofBytes, signConflictOutput } = await import("@/server/bookings/conflict-attestation");
  const { LOCAL_TEST_BOOKING_CONFLICT_SECRET } = await import("../../support/test-env");
  await h.withConflictFixture(async (fx) => {
    const input = h.bookingInput([fx.ownProfile.id]);
    const snapshot = await b.snapshot(fx.adminClient, "create", input, crypto.randomUUID());
    const text = '[{"synthetic":"Å:🔌"}]';
    const [vector] = await h.adminQuery<{ bytes: Buffer; signature: string }>(
      "select public.booking_conflict_proof_bytes_internal($1::jsonb,$2) as bytes,encode(extensions.hmac(public.booking_conflict_proof_bytes_internal($1::jsonb,$2),convert_to($3,'UTF8'),'sha256'),'hex') as signature",
      [snapshot, text, LOCAL_TEST_BOOKING_CONFLICT_SECRET]);
    // Boolean assertions keep proof bytes out of assertion diagnostics.
    expect(Buffer.from(canonicalConflictProofBytes(snapshot, text)).equals(vector.bytes)).toBe(true);
    expect(signConflictOutput(snapshot, text, LOCAL_TEST_BOOKING_CONFLICT_SECRET) === vector.signature).toBe(true);
    expect(snapshot.issuedAt).toMatch(/[.]\d{6}Z$/);
    expect(snapshot.expiresAt).toMatch(/[.]\d{6}Z$/);
  });
});

test("[P0] AC10 invitation expiry is checked after a gate/row wait at the current database instant", async () => {
  const h = await harness(); const b = await h.loadConflictBindings();
  const { setTimeout: pause } = await import("node:timers/promises");
  await h.withConflictFixture(async (fx) => {
    const writer = await b.prepareInvitationWriter(fx);
    const membershipId = writer.lockParams[0];
    await h.adminQuery("update public.tenant_memberships set invitation_expires_at=clock_timestamp()+interval '2 seconds' where id=$1", [membershipId]);
    const before = await h.bookingSnapshot(fx.tenantIds);
    await h.adminSession(async ({ query }) => {
      await query("begin"); let accept: ReturnType<typeof writer.invoke> | undefined;
      try {
        const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
        await query(writer.lockSql, writer.lockParams);
        accept = writer.invoke(); await h.waitForBlocked(owner.pid, 1);
        const [started] = await query<{ live_at_start: boolean }>(`select exists(select 1 from pg_stat_activity a,public.tenant_memberships m
          where m.id=$1 and $2=any(pg_blocking_pids(a.pid)) and a.query_start<m.invitation_expires_at) as live_at_start`, [membershipId, owner.pid]);
        expect(started.live_at_start).toBe(true);
        let expired = false;
        for (let attempt = 0; attempt < 100 && !expired; attempt++) {
          const [clock] = await query<{ expired: boolean }>("select invitation_expires_at<=clock_timestamp() as expired from public.tenant_memberships where id=$1", [membershipId]);
          expired = clock.expired; if (!expired) await pause(50);
        }
        expect(expired).toBe(true);
        await query("commit"); expect(await accept).toMatchObject({ data: false, error: null });
        const [member] = await h.adminQuery<{ status: string; user_id: string | null }>("select status,user_id from public.tenant_memberships where id=$1", [membershipId]);
        expect(member).toEqual({ status: "expired", user_id: null });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      } finally { await query("rollback"); if (accept) await accept; }
    });
  });
});

test("[P0] AC10 invitation expiry is checked after the operation-row lock wait before activation", async () => {
  const h = await harness(); const b = await h.loadConflictBindings();
  const { setTimeout: pause } = await import("node:timers/promises");
  await h.withConflictFixture(async (fx) => {
    const writer = await b.prepareInvitationWriter(fx); const membershipId = writer.lockParams[0];
    await h.adminQuery("update public.tenant_memberships set invitation_expires_at=clock_timestamp()+interval '2 seconds' where id=$1", [membershipId]);
    const before = await h.bookingSnapshot(fx.tenantIds);
    await h.adminSession(async ({ query }) => {
      await query("begin"); let accept: ReturnType<typeof writer.invoke> | undefined;
      try {
        const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
        await query("select id from public.membership_admin_operations where membership_id=$1 and superseded_at is null for update", [membershipId]);
        accept = writer.invoke(); await h.waitForBlocked(owner.pid, 1);
        const [started] = await query<{ live_at_start: boolean }>(`select exists(select 1 from pg_stat_activity a,public.tenant_memberships m
          where m.id=$1 and $2=any(pg_blocking_pids(a.pid)) and a.query_start<m.invitation_expires_at) as live_at_start`, [membershipId, owner.pid]);
        expect(started.live_at_start).toBe(true);
        let expired = false;
        for (let attempt = 0; attempt < 100 && !expired; attempt++) {
          const [clock] = await query<{ expired: boolean }>("select invitation_expires_at<=clock_timestamp() as expired from public.tenant_memberships where id=$1", [membershipId]);
          expired = clock.expired; if (!expired) await pause(50);
        }
        expect(expired).toBe(true); await query("commit");
        expect(await accept).toMatchObject({ data: false, error: null });
        expect(await h.adminQuery("select status,user_id from public.tenant_memberships where id=$1", [membershipId]))
          .toEqual([{ status: "expired", user_id: null }]);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      } finally { await query("rollback"); if (accept) await accept; }
    });
  });
});

test("[P0] AC8 every participant in four-booking daily capacity is retrievable and refreshed independently", async () => {
  const h = await harness();
  await h.withConflictFixture(async (fx) => {
    const schedule = await fx.adminClient.rpc("save_person_schedule_with_audit", {
      p_tenant_id: fx.base.tenantA.id, p_actor_user_id: fx.base.adminA.id, p_correlation_id: crypto.randomUUID(),
      p_person_profile_id: fx.ownProfile.id, p_schedule: [{ weekday: 1, start: "08:00", end: "10:00", breaks: [] }],
    });
    expect(schedule.error).toBeNull();
    const inputs = [6, 7, 8, 9].map((hour) => h.bookingInput([fx.ownProfile.id], {
      startsAt: `2026-10-12T${String(hour).padStart(2, "0")}:00:00Z`,
      endsAt: `2026-10-12T${String(hour + 1).padStart(2, "0")}:00:00Z`,
    }));
    const ids: string[] = [];
    for (const input of inputs) ids.push(exactSuccess(await h.bookingCommand("create", fx.adminClient, input)));
    const before = await h.bookingSnapshot(fx.tenantIds);
    const capacity = before.conflicts.filter((row) => row.conflict_type === "over_capacity");
    expect(capacity).toHaveLength(3); // one first-pair association plus each remaining participant
    expect([...new Set(capacity.flatMap((row) => [row.booking_id, row.related_booking_id]))].sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const read = await fx.montorClient.from("booking_conflicts").select("booking_id,related_booking_id,starts_at,ends_at,affected_person_profile_id")
        .eq("conflict_type", "over_capacity").or(`booking_id.eq.${id},related_booking_id.eq.${id}`);
      expect(read.error).toBeNull(); expect(read.data?.length).toBeGreaterThan(0);
      for (const row of read.data ?? []) expect(row).toMatchObject({
        affected_person_profile_id: fx.ownProfile.id, starts_at: "2026-10-11T22:00:00+00:00", ends_at: "2026-10-12T22:00:00+00:00",
      });
    }
    const anchor = capacity.find((row) => String(row.natural_key).startsWith("v1:"))!;
    await h.seedAcceptedConflict(String(anchor.id), fx.adminProfile.membershipId);
    const accepted = (await h.bookingSnapshot(fx.tenantIds)).conflicts;
    exactSuccess(await h.bookingCommand("update", fx.adminClient, { ...inputs[0], commandId: crypto.randomUUID(), bookingId: ids[0], description: "Same capacity identity" }));
    expect((await h.bookingSnapshot(fx.tenantIds)).conflicts).toEqual(accepted);
    const third = [...ids].sort()[2]; const index = ids.indexOf(third);
    exactSuccess(await h.bookingCommand("update", fx.adminClient, { ...inputs[index], commandId: crypto.randomUUID(), bookingId: third, status: "cancelled" }));
    const refreshed = (await h.bookingSnapshot(fx.tenantIds)).conflicts.filter((row) => row.conflict_type === "over_capacity");
    expect(refreshed).toHaveLength(2);
    expect([...new Set(refreshed.flatMap((row) => [row.booking_id, row.related_booking_id]))].sort()).toEqual(ids.filter((id) => id !== third).sort());
    expect(refreshed.every((row) => !capacity.some((old) => old.natural_key === row.natural_key))).toBe(true);
    workflowOpen(refreshed);
    const removed = await fx.montorClient.from("booking_conflicts").select("id").eq("conflict_type", "over_capacity")
      .or(`booking_id.eq.${third},related_booking_id.eq.${third}`);
    expect(removed.error).toBeNull(); expect(removed.data).toEqual([]);
  });
});

test("[P0] AC2 persisted dated absence and blocked time produce independent literal UTC warnings", async () => {
  const h = await harness();
  await h.withConflictFixture(async (fx) => {
    const [person] = await h.adminQuery<{ membership_id: string }>("select membership_id from public.person_profiles where id=$1", [fx.ownProfile.id]);
    const saved = await fx.adminClient.rpc("save_resource_profile_form_with_audit", {
      p_tenant_id: fx.base.tenantA.id, p_actor_user_id: fx.base.adminA.id, p_correlation_id: crypto.randomUUID(),
      p_membership_id: person.membership_id, p_work_role_id: null, p_employment_percentage: null,
      p_schedule: [{ weekday: 1, start: "08:00", end: "16:00", breaks: [] }],
      p_exceptions: [{ kind: "absence", date: "2026-10-12", start: "10:00", end: "11:00" },
        { kind: "blocked_time", date: "2026-10-12", start: "13:00", end: "14:00" }], p_calendar_day: null,
    });
    expect(saved.error).toBeNull();
    expect(await h.adminQuery("select exception_kind,local_date::text,starts_at::text,ends_at::text from public.person_work_hours where person_profile_id=$1 and entry_kind='exception' order by starts_at", [fx.ownProfile.id]))
      .toEqual([{ exception_kind: "absence", local_date: "2026-10-12", starts_at: "10:00:00", ends_at: "11:00:00" },
        { exception_kind: "blocked_time", local_date: "2026-10-12", starts_at: "13:00:00", ends_at: "14:00:00" }]);
    const id = exactSuccess(await h.bookingCommand("create", fx.adminClient, h.bookingInput([fx.ownProfile.id])));
    const warnings = (await h.bookingSnapshot(fx.tenantIds)).conflicts.map((row) => ({ type: row.conflict_type, start: row.starts_at, end: row.ends_at }));
    expect(warnings.sort((a, b) => String(a.start).localeCompare(String(b.start)))).toEqual([
      { type: "over_capacity", start: "2026-10-11T22:00:00+00:00", end: "2026-10-12T22:00:00+00:00" },
      { type: "outside_work_hours", start: "2026-10-12T08:00:00+00:00", end: "2026-10-12T09:00:00+00:00" },
      { type: "outside_work_hours", start: "2026-10-12T11:00:00+00:00", end: "2026-10-12T12:00:00+00:00" },
    ]);
    expect((await h.bookingSnapshot(fx.tenantIds)).conflicts.every((row) => row.booking_id === id && row.affected_person_profile_id === fx.ownProfile.id)).toBe(true);
  });
});

for (const windowKind of ["expired", "future", "oversized"] as const) {
  test(`[P0] AC11 correctly signed otherwise valid ${windowKind} proof isolates database clock and maximum lifetime`, async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    await h.withConflictFixture(async (fx) => {
      const input = h.bookingInput([fx.ownProfile.id]);
      const snapshot = await b.snapshot(fx.adminClient, "create", input, crypto.randomUUID());
      const valid = await b.attest(snapshot, await b.detect(snapshot));
      const timed = await b.signedVariant(valid, await proofWindow(windowKind));
      const before = await h.bookingSnapshot(fx.tenantIds);
      expect(await b.finalize(fx.adminClient, input, timed)).toMatchObject({ kind: windowKind === "expired" ? "stale" : "denied" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      expect(await b.finalize(fx.adminClient, input, valid)).toEqual({ kind: "committed", bookingId: snapshot.bookingId });
    });
  });
}

test("[P0] AC11 previous incomplete normalization version cannot authorize a fresh commit", async () => {
  const h = await harness(); const b = await h.loadConflictBindings();
  await h.withConflictFixture(async (fx) => {
    const input = h.bookingInput([fx.ownProfile.id]); const snapshot = await b.snapshot(fx.adminClient, "create", input, crypto.randomUUID());
    const valid = await b.attest(snapshot, await b.detect(snapshot));
    const previous = await b.signedVariant(valid, { engineVersion: "booking-conflicts-v1" });
    const before = await h.bookingSnapshot(fx.tenantIds);
    expect(await b.finalize(fx.adminClient, input, previous)).toMatchObject({ kind: "denied" });
    expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    expect(await b.finalize(fx.adminClient, input, valid)).toEqual({ kind: "committed", bookingId: snapshot.bookingId });
  });
});

for (const expiredAttempts of [1, 3] as const) {
  test(`[P0] AC10 actual save refreshes ${expiredAttempts} genuine signed expiries during gate waits under the same command UUID`, async () => {
    const h = await harness(); const b = await h.loadConflictBindings();
    const { parseDetectionSnapshot, conflictClaims } = await import("@/server/bookings/conflict-facts");
    const { setTimeout: pause } = await import("node:timers/promises");
    await h.withConflictFixture(async (fx) => {
      const input = h.bookingInput([fx.ownProfile.id]); const correlation = crypto.randomUUID();
      const before = await h.bookingSnapshot(fx.tenantIds);
      const commandIds: string[] = []; const kinds: string[] = [];
      let snapshot: ReturnType<typeof parseDetectionSnapshot> | undefined; let finalizations = 0;
      const client = new Proxy(fx.adminClient, { get(target, property) {
        if (property === "rpc") return async (name: string, args: Record<string, unknown>) => {
          if (name === "finalize_booking_conflicts") {
            finalizations++; expect(args.p_command_id).toBe(input.commandId);
            if (finalizations <= expiredAttempts) {
              if (!snapshot || snapshot.kind !== "snapshot") throw new Error("Actual save snapshot required");
              // Private test signer shortens the real DB-issued proof to two seconds;
              // actual SQL HMAC and validity verification are never bypassed.
              const [window] = await h.adminQuery<{ expiresAt: string }>("select to_char(($1::timestamptz+interval '2 seconds') at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as \"expiresAt\"", [snapshot.issuedAt]);
              const signed = await b.signedVariant({ snapshot, outputText: String(args.p_output), signature: String(args.p_signature) }, window);
              return h.adminSession(async ({ query }) => {
                await query("begin"); let pending: ReturnType<typeof Promise.resolve<Awaited<ReturnType<typeof target.rpc>>>> | undefined;
                try {
                  const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
                  await query("select pg_advisory_xact_lock(hashtextextended($1::text,0))", [fx.base.tenantA.id]);
                  pending = Promise.resolve(target.rpc(name, { ...args, p_claims: conflictClaims(signed.snapshot), p_signature: signed.signature }));
                  await h.waitForBlocked(owner.pid, 1);
                  let expired = false;
                  for (let attempt = 0; attempt < 100 && !expired; attempt++) {
                    const [clock] = await query<{ expired: boolean }>("select $1::timestamptz<=clock_timestamp() as expired", [window.expiresAt]);
                    expired = clock.expired; if (!expired) await pause(50);
                  }
                  expect(expired).toBe(true); await query("commit");
                  const reply = await pending; expect(reply.error).toBeNull();
                  expect(reply.data).toEqual({ kind: "stale" }); kinds.push("stale");
                  expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
                  return reply;
                } finally { await query("rollback"); if (pending) await pending; }
              });
            }
          }
          const reply = await target.rpc(name, args);
          if (name === "snapshot_booking_conflicts" && !reply.error) {
            snapshot = parseDetectionSnapshot(reply.data);
            if (snapshot.kind === "snapshot") commandIds.push(snapshot.commandId);
          }
          if (name === "finalize_booking_conflicts" && !reply.error) kinds.push((reply.data as { kind: string }).kind);
          return reply;
        };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
      const result = await h.bookingCommand("create", client, input, correlation);
      expect(commandIds).toEqual(Array(expiredAttempts === 1 ? 2 : 3).fill(input.commandId));
      if (expiredAttempts === 3) {
        expect(result).toMatchObject({ ok: false, code: "SERVER_ERROR" });
        expect(Object.keys(result).sort()).toEqual(["code", "message", "ok"]);
        expect(kinds).toEqual(["stale", "stale", "stale"]);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      } else {
        const id = exactSuccess(result); expect(kinds).toEqual(["stale", "committed"]);
        const after = await h.bookingSnapshot(fx.tenantIds);
        expect(after.bookings).toHaveLength(before.bookings.length + 1);
        expect(after.bookings.find((row) => row.id === id)?.create_command_id).toBe(input.commandId);
        expect(after.audit.filter((row) => row.correlation_id === correlation)).toEqual([expect.objectContaining({ target_id: id })]);
      }
    });
  });
}
