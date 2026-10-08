import { describe, expect, test } from "vitest";
import type { BookingFixture, BookingSnapshot, DurableRow } from "../../support/bookings-atdd";
import type { Decision, EditorInput, LogicalGroup, LogicalIdentity, Preview, Scenario } from "../../support/booking-editor-atdd";

/* Provider source scrutiny (real command/RPC boundary, no HTTP route):
 * create/update-booking.ts + envelope.ts => Result {ok:true,data:{bookingId:string}}
 * or {ok:false,code,message}; Bookings.Manage/current tenant gate precedes execute.
 * booking-db.ts maps BK409->COMMAND_CONFLICT, 42501/23503->TENANT_ACCESS_DENIED,
 * 23514/22P02/22007/22008->VALIDATION_FAILED. New story codes are
 * BOOKING_CONFLICT_UNACKNOWLEDGED and PREVIEW_STALE, specified by Tasks 1–3.
 * Current snapshot_booking_editor response is snapshot/replay; finalize result
 * is {kind:"committed",bookingId} or {kind:"stale"}, SQL proof denial 42501.
 * SchedulingConflict fields: naturalKey/conflictType/bookingIds/affectedPersonIds/
 * startsAt/endsAt; naturalKey JSON encodes ALL sorted participants + exact window.
 * Existing persisted derived output whitelist has exactly seven fields:
 * booking_id,related_booking_id,affected_person_profile_id,conflict_type,
 * starts_at,ends_at,natural_key; human workflow is separate from detector output.
 * Persisted workflow: status open/accepted/resolved; acceptance_reason,
 * accepted_by_membership_id,accepted_at and separate resolution fields.
 * Private create_command_id/create_payload_digest/create_result/update_outcomes
 * live on bookings and MUST remain in exact durable snapshots.
 * Normalized DTO/adapter methods below are TEST-OWNED projections. Actual actions,
 * encrypted receipt verification, checked editor SQL and commands are bound in
 * booking-editor-production.ts; every retained API case executes against real rows.
 * Package gate: playwright-utils flag true but absent, and this suite is Vitest;
 * use project real command fixtures. Pact relevance/install gates both closed.
 */
async function harness() {
  const [bookings, conflicts, bindings, sql] = await Promise.all([
    import("../../support/bookings-atdd"),
    import("../../support/booking-conflicts-atdd"),
    import("../../support/booking-editor-atdd"),
    import("../../factories/admin-sql"),
  ]);
  return { ...bookings, ...conflicts, ...sql, b: await bindings.loadBookingEditorBindings() };
}
type H = Awaited<ReturnType<typeof harness>>;
async function prepared(h: H, fx: BookingFixture, operation: "create" | "update" = "create") {
  const scenario = await h.b.seedMixed(fx, operation);
  const result = await h.b.preview(fx.adminClient, operation, scenario.input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected real entitled editor preview");
  return { scenario, preview: result.data };
}
function decision(preview: Preview, selected: LogicalGroup[] = [], reason = "  Coordinated with the site foreman  "): Decision {
  return { acknowledged: preview.warnings.length > 0, reviewedLogicalIds: preview.warnings.map((w) => w.naturalKey).sort(),
    selectedLogicalIds: selected.map((g) => g.naturalKey).sort(), reason: preview.warnings.length ? reason : "", receipt: preview.receipt };
}
function reviewed(s: Scenario, p: Preview, selected: LogicalGroup[] = [s.selected]): EditorInput {
  return { ...s.input, decision: decision(p, selected) };
}
const identity = (g: LogicalIdentity) => ({
  naturalKey: g.naturalKey, conflictType: g.conflictType, bookingIds: g.bookingIds,
  affectedPersonIds: g.affectedPersonIds, startsAt: g.startsAt, endsAt: g.endsAt,
});
const rowsFor = (rows: DurableRow[], keys: string[]) => rows.filter((r) => keys.includes(String(r.natural_key)));
const workflow = (r: DurableRow) => ({
  id: r.id, natural_key: r.natural_key, status: r.status, acceptance_reason: r.acceptance_reason,
  accepted_by_membership_id: r.accepted_by_membership_id, accepted_at: r.accepted_at,
  resolution_outcome: r.resolution_outcome, resolved_by_membership_id: r.resolved_by_membership_id, resolved_at: r.resolved_at,
});

describe("Story 14.4 current candidate preview and private authority", () => {
  // RED until sanitized preview and stable proposed-create UUID are bound.
  test("[P0] 14.4-INT-001-preview stable create UUID and candidate-only complete warnings", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const before = await h.bookingSnapshot(fx.tenantIds);
      const repeated = await h.b.preview(fx.adminClient, "create", s.input);
      expect(repeated).toMatchObject({ ok: true, data: { bookingId: s.input.proposedCreateId } });
      expect(p.bookingId).toBe(s.input.proposedCreateId);
      expect(p.warnings.map(identity))
        .toEqual(s.expectedGroups.map(identity));
      expect(p.warnings.every((w) => w.bookingIds.includes(p.bookingId))).toBe(true);
      expect(p.warnings.flatMap((w) => w.bookingIds)).not.toContain(s.foreignBookingId);
      expect(p.warnings.every((w) => w.ruleLabel.trim().length > 0 && w.personLabels.length === w.affectedPersonIds.length)).toBe(true);
      expect(p.warnings.every((w) => w.collisions.every((c) => w.bookingIds.includes(c.bookingId) && c.startsAt < c.endsAt))).toBe(true);
      expect(p.availability.map((x) => x.personId).sort()).toEqual([...s.input.assigneeIds].sort());
      const privateAttempt = await h.b.privateAttempt(fx.adminClient, "create", s.input);
      const browser = JSON.stringify(p.rawBrowserPayload);
      expect(browser).not.toContain(privateAttempt.signature);
      expect(browser).not.toContain(privateAttempt.outputText);
      for (const marker of privateAttempt.factMarkers) expect(browser).not.toContain(marker);
      for (const field of ["canonicalFacts", "facts", "p_signature", "create_payload_digest", "create_result", "update_outcomes", "BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET"])
        expect(browser).not.toContain('"' + field + '"');
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });

  // RED until separate authenticated browser review domain binds whole current set.
  test("[P0] 14.4-INT-001-receipt domain is distinct and binds actor candidate full groups facts versions validity", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const claims = await h.b.verifyReceipt(p.receipt);
      expect(claims.domain).not.toBe("elpro.booking-conflicts.attestation.v1");
      expect(claims.domain.trim().length).toBeGreaterThan(0);
      expect(claims).toMatchObject({ tenantId: fx.base.tenantA.id, actorId: fx.base.adminA.id,
        operation: "create", bookingId: s.input.proposedCreateId,
        groups: s.expectedGroups, engineVersion: "booking-conflicts-v2", configVersion: "stockholm-capacity-v1" });
      const [expectedDigest] = await h.adminQuery<{ digest: string }>("select public.booking_detection_digest_internal('create',null,$1::jsonb) as digest", [s.canonicalCandidate]);
      expect(claims.candidateDigest).toBe(expectedDigest.digest);
      expect(claims.factDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(Date.parse(claims.expiresAt)).toBeGreaterThan(Date.parse(claims.issuedAt));
      expect(claims.groups.flatMap((g) => g.persistedKeys).sort())
        .toEqual(s.expectedGroups.flatMap((g) => g.persistedKeys).sort());
    });
  });
});

describe("Story 14.4 deliberate whole-set review and complete selected acceptance", () => {
  for (const op of ["create", "update"] as const) {
    // RED until every conflicted fresh save enforces explicit current acknowledgment.
    test("[P0] 14.4-INT-001-" + op + " warns without acknowledgment and writes nothing", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx, op);
        expect(p.warnings.length).toBeGreaterThan(0);
        const before = await h.bookingSnapshot(fx.tenantIds);
        const result = await h.b.save(fx.adminClient, op, {
          ...s.input, decision: { ...decision(p, [s.selected]), acknowledged: false },
        }, crypto.randomUUID());
        expect(result).toMatchObject({ ok: false, code: "BOOKING_CONFLICT_UNACKNOWLEDGED" });
        expect(Object.keys(result).sort()).toEqual(["code", "message", "ok"]);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      });
    });
  }
  for (const selected of [false, true]) for (const reason of ["", " \t\n "]) {
    // RED until trimmed nonblank reason is required even with no selected group.
    test("[P0] 14.4-INT-001-reason " + JSON.stringify(reason) + " selection=" + selected + " is a durable no-op", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx);
        const before = await h.bookingSnapshot(fx.tenantIds);
        const result = await h.b.save(fx.adminClient, "create", {
          ...s.input, decision: decision(p, selected ? [s.selected] : [], reason),
        }, crypto.randomUUID());
        expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      });
    });
  }
  // RED until omitted warning identity cannot be mistaken for whole-set review.
  test("[P0] 14.4-INT-001-partial-review subset acknowledgment is not current whole-set review", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      expect(p.warnings.length).toBeGreaterThan(1);
      const before = await h.bookingSnapshot(fx.tenantIds);
      const result = await h.b.save(fx.adminClient, "create", {
        ...s.input, decision: { ...decision(p, [s.selected]), reviewedLogicalIds: [s.selected.naturalKey] },
      }, crypto.randomUUID());
      expect(result.ok).toBe(false);
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
  // RED until selection expands to every base/association row atomically.
  test("[P0] 14.4-INT-002 selected aggregate candidate third accepts all v1/v2 keys once", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      expect(s.selected.conflictType).toBe("over_capacity");
      expect(s.selected.bookingIds.length).toBeGreaterThanOrEqual(4);
      expect(s.selected.bookingIds[2]).toBe(p.bookingId);
      expect(s.selected.persistedKeys.some((k) => k.startsWith("v1:"))).toBe(true);
      expect(s.selected.persistedKeys.filter((k) => k.startsWith("v2:")).length).toBeGreaterThanOrEqual(2);
      const before = await h.bookingSnapshot(fx.tenantIds);
      const [start] = await h.adminQuery<{ at: string }>("select clock_timestamp()::text as at");
      const correlation = crypto.randomUUID();
      const plannerPreview = await h.b.preview(fx.plannerClient, "create", s.input);
      expect(plannerPreview.ok).toBe(true);
      if (!plannerPreview.ok) throw new Error("Current planner preview missing");
      expect(await h.b.save(fx.plannerClient, "create", {
        ...s.input, decision: decision(plannerPreview.data, [s.selected]),
      }, correlation)).toEqual({ ok: true, data: { bookingId: p.bookingId } });
      const [end] = await h.adminQuery<{ at: string }>("select clock_timestamp()::text as at");
      const after = await h.bookingSnapshot(fx.tenantIds);
      const accepted = rowsFor(after.conflicts, s.selected.persistedKeys);
      expect(accepted.map((r) => r.natural_key).sort()).toEqual([...s.selected.persistedKeys].sort());
      expect(accepted.every((r) => r.status === "accepted" && r.acceptance_reason === "Coordinated with the site foreman"
        && r.accepted_by_membership_id === fx.coworkerProfile.membershipId)).toBe(true);
      const timed = await h.adminQuery<{ within_sql_window: boolean }>(
        "select bool_and(accepted_at between $2::timestamptz and $3::timestamptz) as within_sql_window from public.booking_conflicts where tenant_id=$1 and natural_key=any($4::text[])",
        [fx.base.tenantA.id, start.at, end.at, s.selected.persistedKeys]);
      expect(timed).toEqual([{ within_sql_window: true }]);
      expect(rowsFor(after.conflicts, s.otherReviewedKeys).every((r) => r.status === "open" && r.accepted_at === null)).toBe(true);
      expect(rowsFor(after.conflicts, s.unrelatedKeys)).toEqual(rowsFor(before.conflicts, s.unrelatedKeys));
      expect(h.foreignState(after, fx.base.tenantB.id)).toEqual(h.foreignState(before, fx.base.tenantB.id));
      expect(after.bookings.find((r) => r.id === p.bookingId)).toMatchObject({
        create_command_id: s.input.commandId, create_result: { bookingId: p.bookingId },
      });
      expect(after.assignees.filter((r) => r.booking_id === p.bookingId).map((r) => r.person_profile_id).sort()).toEqual([...s.input.assigneeIds].sort());
      expect(after.audit.filter((r) => r.correlation_id === correlation)).toEqual([expect.objectContaining({
        actor_user_id: fx.users.projektledare.id, target_id: p.bookingId, event_type: "booking_created",
      })]);
    });
  });
  // RED until review permission is separate from selected acceptance.
  test("[P0] 14.4-INT-004 empty selection saves current reviewed warnings open with one audit", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const correlation = crypto.randomUUID();
      expect(await h.b.save(fx.adminClient, "create", reviewed(s, p, []), correlation))
        .toEqual({ ok: true, data: { bookingId: p.bookingId } });
      const after = await h.bookingSnapshot(fx.tenantIds);
      const keys = s.expectedGroups.flatMap((g) => g.persistedKeys);
      expect(rowsFor(after.conflicts, keys).map((r) => r.natural_key).sort()).toEqual([...keys].sort());
      expect(rowsFor(after.conflicts, keys).every((r) => r.status === "open" && r.acceptance_reason === null
        && r.accepted_at === null && r.accepted_by_membership_id === null)).toBe(true);
      expect(after.audit.filter((r) => r.correlation_id === correlation)).toHaveLength(1);
    });
  });
  for (const attack of ["forged-receipt", "partial-logical-group", "unrelated-logical-group", "wrong-tenant",
    "wrong-actor", "wrong-candidate", "wrong-target", "wrong-operation", "different-preview", "client-detector-fields"] as const) {
    // RED until real receipt/group validator rejects this authenticated bypass attempt.
    test("[P0] 14.4-INT-003-" + attack + " cannot alter booking outcomes acceptance or audit", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx);
        const attempt = await h.b.signedAttack(fx, s, p, attack);
        const before = await h.bookingSnapshot(fx.tenantIds);
        const result = await h.b.save(fx.adminClient, "create", attempt, crypto.randomUUID());
        expect(result.ok).toBe(false);
        expect(Object.keys(result).sort()).toEqual(["code", "message", "ok"]);
        expect(JSON.stringify(result)).not.toContain(s.foreignBookingId);
        expect(JSON.stringify(result)).not.toContain(p.receipt);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        if (attack === "partial-logical-group" || attack === "unrelated-logical-group") {
          // Pass the genuinely signed manipulated map below TypeScript's comparison.
          const denied = await h.b.direct(fx.adminClient, "create", attempt);
          expect(denied.data).toBeNull(); expect(denied.error).not.toBeNull();
          expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        }
      });
    });
  }
  // RED until selection unknown to genuine receipt is rejected.
  test("[P0] 14.4-INT-003-unknown-select cannot accept a made-up logical identity", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const before = await h.bookingSnapshot(fx.tenantIds);
      expect((await h.b.save(fx.adminClient, "create", {
        ...s.input, decision: { ...decision(p), selectedLogicalIds: [crypto.randomUUID()] },
      }, crypto.randomUUID())).ok).toBe(false);
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
  for (const substitution of ["detectorProofAsReceipt", "receiptAsDetectorProof"] as const) {
    // RED until separate authority domains are enforced on direct checked RPC.
    test("[P0] 14.4-INT-003-" + substitution + " is denied below wrapper", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx);
        const before = await h.bookingSnapshot(fx.tenantIds);
        const reply = await h.b.direct(fx.adminClient, "create", reviewed(s, p), { [substitution]: true });
        expect(reply.data).toBeNull(); expect(reply.error).not.toBeNull();
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      });
    });
  }
});

describe("Story 14.4 stale reviews and transaction isolation", () => {
  for (const change of ["time", "assignees", "connections", "status"] as const) {
    // RED until candidate edits invalidate receipt before any fresh write.
    test("[P0] 14.4-INT-003-stale-candidate-" + change + " requires renewed review", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx);
        const changed = await h.b.changedCandidate(fx, reviewed(s, p), change);
        const before = await h.bookingSnapshot(fx.tenantIds);
        expect(await h.b.save(fx.adminClient, "create", changed, crypto.randomUUID()))
          .toMatchObject({ ok: false, code: "PREVIEW_STALE" });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      });
    });
  }
  for (const change of ["schedule", "concurrent-booking"] as const) {
    // RED until reviewed save returns stale instead of the existing silent retry loop.
    test("[P0] 14.4-INT-003-current-facts-" + change + " has one finalize no silent redetection", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx);
        let before: BookingSnapshot | undefined;
        const observed = await h.b.observeSave(fx.adminClient, "create", reviewed(s, p), crypto.randomUUID(), async () => {
          await h.b.changeFacts(fx, change);
          before = await h.bookingSnapshot(fx.tenantIds);
        });
        expect(before).toBeDefined();
        expect(observed.result).toMatchObject({ ok: false, code: "PREVIEW_STALE" });
        expect(observed.finalizations).toBe(1);
        expect(observed.snapshots).toBeLessThanOrEqual(1);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        const refreshed = await h.b.preview(fx.adminClient, "create", s.input);
        expect(refreshed.ok).toBe(true);
        if (!refreshed.ok) throw new Error("Fresh warnings required for explicit retry");
        expect(refreshed.data.receipt).not.toBe(p.receipt);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      });
    });
  }
  // RED until otherwise valid expiry is stale with no post-expiry automatic acceptance.
  test("[P0] 14.4-INT-003-expiry fresh expired current review is exact no-op", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const expired = await h.b.expireReceipt(fx, reviewed(s, p));
      const before = await h.bookingSnapshot(fx.tenantIds);
      expect(await h.b.save(fx.adminClient, "create", expired, crypto.randomUUID()))
        .toMatchObject({ ok: false, code: "PREVIEW_STALE" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
  // RED until shared tenant gate binds review to locked facts for simultaneous editors.
  test("[P0] 14.4-INT-003-concurrent editors reviewed same facts commit one and force other review", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const competing = await h.b.competingCandidate(fx, s);
      const previewResult = await h.b.preview(fx.adminClient, "create", competing.input);
      expect(previewResult.ok).toBe(true);
      if (!previewResult.ok) throw new Error("Competing real preview missing");
      const before = await h.bookingSnapshot(fx.tenantIds);
      const correlations = [crypto.randomUUID(), crypto.randomUUID()];
      const results = await Promise.all([
        h.b.save(fx.adminClient, "create", reviewed(s, p), correlations[0]!),
        h.b.save(fx.adminClient, "create", reviewed(competing, previewResult.data), correlations[1]!),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toEqual([expect.objectContaining({ code: "PREVIEW_STALE" })]);
      const after = await h.bookingSnapshot(fx.tenantIds);
      expect(after.bookings).toHaveLength(before.bookings.length + 1);
      expect(after.audit.filter((r) => correlations.includes(String(r.correlation_id)))).toHaveLength(1);
      expect(h.foreignState(after, fx.base.tenantB.id)).toEqual(h.foreignState(before, fx.base.tenantB.id));
    });
  });
  // RED until a conflict-free review cannot inherit authority for newly appeared warnings.
  test("[P0] 14.4-INT-003-clean-review newly appearing warning cannot be saved by retained retry", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const s = await h.b.seedConflictFree(fx);
      const initial = await h.b.preview(fx.adminClient, "create", s.input);
      expect(initial.ok).toBe(true);
      if (!initial.ok) throw new Error("Real conflict-free preview missing");
      expect(initial.data.warnings).toEqual([]);
      await h.b.changeFacts(fx, "concurrent-booking");
      const before = await h.bookingSnapshot(fx.tenantIds);
      expect(await h.b.save(fx.adminClient, "create", { ...s.input, decision: decision(initial.data, []) }, crypto.randomUUID()))
        .toMatchObject({ ok: false, code: "PREVIEW_STALE" });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      const current = await h.b.preview(fx.adminClient, "create", s.input);
      expect(current).toMatchObject({ ok: true });
      if (!current.ok) throw new Error("Changed real warnings missing");
      expect(current.data.warnings.length).toBeGreaterThan(0);
    });
  });
  for (const operation of ["create", "update"] as const) for (const stage of ["after_acceptance", "before_audit"] as const) {
    // RED until acceptance precedes audit in SAME transaction and faults roll back ALL rows.
    test("[P0] 14.4-INT-002-rollback-" + operation + "-" + stage + " restores exact state and retries once", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx, operation);
        const before = await h.bookingSnapshot(fx.tenantIds);
        const correlation = crypto.randomUUID();
        const observed = await h.b.withFault(fx, correlation, stage,
          () => h.b.save(fx.adminClient, operation, reviewed(s, p), correlation));
        expect(observed.reached).toBe(true);
        expect([...observed.acceptedKeysObserved].sort()).toEqual([...s.selected.persistedKeys].sort());
        expect(observed.value).toMatchObject({ ok: false, code: "SERVER_ERROR" });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        expect(await h.b.save(fx.adminClient, operation, reviewed(s, p), correlation))
          .toEqual({ ok: true, data: { bookingId: p.bookingId } });
        const after = await h.bookingSnapshot(fx.tenantIds);
        expect(after.audit.filter((r) => r.correlation_id === correlation)).toHaveLength(1);
        expect(rowsFor(after.conflicts, s.selected.persistedKeys).every((r) => r.status === "accepted")).toBe(true);
      });
    });
  }
});

describe("Story 14.4 workflow identity and business replay", () => {
  // RED until unchanged collision retains precise attributable evidence even unselected.
  test("[P0] 14.4-INT-005 unchanged accepted identity survives description edit and empty selection", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      expect(await h.b.save(fx.adminClient, "create", reviewed(s, p), crypto.randomUUID())).toEqual({ ok: true, data: { bookingId: p.bookingId } });
      const committed = await h.bookingSnapshot(fx.tenantIds);
      const original = committed.bookings.find((r) => r.id === p.bookingId)!;
      const accepted = rowsFor(committed.conflicts, s.selected.persistedKeys).map(workflow);
      expect(accepted.every((r) => r.status === "accepted")).toBe(true);
      const base = { ...s.input };
      delete base.proposedCreateId;
      delete base.decision;
      const input: EditorInput = { ...base, commandId: crypto.randomUUID(), bookingId: p.bookingId, description: "Foreman reviewed description only" };
      const updatedPreview = await h.b.preview(fx.adminClient, "update", input);
      expect(updatedPreview.ok).toBe(true);
      if (!updatedPreview.ok) throw new Error("Current update preview missing");
      expect(updatedPreview.data.warnings.map((w) => w.naturalKey)).toEqual(p.warnings.map((w) => w.naturalKey));
      expect(await h.b.save(fx.adminClient, "update", { ...input, decision: decision(updatedPreview.data, []) }, crypto.randomUUID()))
        .toEqual({ ok: true, data: { bookingId: p.bookingId } });
      const after = await h.bookingSnapshot(fx.tenantIds);
      expect(rowsFor(after.conflicts, s.selected.persistedKeys).map(workflow)).toEqual(accepted);
      const read = await h.b.read(fx.adminClient);
      const openIds = new Set(s.expectedGroups.filter((g) => g.naturalKey !== s.selected.naturalKey).map((g) => g.naturalKey));
      expect(read.openCounts[p.bookingId]).toBe(openIds.size);
      expect(after.bookings.find((r) => r.id === p.bookingId)).toMatchObject({
        starts_at: original.starts_at, ends_at: original.ends_at,
      });
    });
  });
  // RED until changed logical collision creates open evidence instead of inheriting acceptance.
  test("[P0] 14.4-INT-005 changed complete collision key reopens all rows", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      expect(await h.b.save(fx.adminClient, "create", reviewed(s, p), crypto.randomUUID())).toEqual({ ok: true, data: { bookingId: p.bookingId } });
      const changed = await h.b.changedCollision(fx, s);
      const next = await h.b.preview(fx.adminClient, "update", changed.input);
      expect(next.ok).toBe(true);
      if (!next.ok) throw new Error("Changed collision requires real new warnings");
      expect(next.data.warnings.map((w) => w.naturalKey)).toEqual(changed.expectedNewGroups.map((g) => g.naturalKey));
      expect(await h.b.save(fx.adminClient, "update", { ...changed.input, decision: decision(next.data, []) }, crypto.randomUUID()))
        .toEqual({ ok: true, data: { bookingId: p.bookingId } });
      const after = await h.bookingSnapshot(fx.tenantIds);
      expect(rowsFor(after.conflicts, changed.oldKeys)).toEqual([]);
      const newKeys = changed.expectedNewGroups.flatMap((g) => g.persistedKeys);
      expect(rowsFor(after.conflicts, newKeys).map((r) => r.natural_key).sort()).toEqual([...newKeys].sort());
      expect(rowsFor(after.conflicts, newKeys).every((r) => r.status === "open" && r.accepted_by_membership_id === null
        && r.acceptance_reason === null && r.accepted_at === null)).toBe(true);
    });
  });
  for (const operation of ["create", "update"] as const) {
    // RED until replay digest includes decision but excludes receipt validity/signature/correlation.
    test("[P0] 14.4-INT-002-replay-" + operation + " lost-response equal retry excludes transport facts drift expiry", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx, operation);
        const input = reviewed(s, p); const correlation = crypto.randomUUID();
        expect(await h.b.save(fx.adminClient, operation, input, correlation))
          .toEqual({ ok: true, data: { bookingId: p.bookingId } });
        const committed = await h.bookingSnapshot(fx.tenantIds);
        await h.b.changeFacts(fx, "schedule");
        const drifted = await h.bookingSnapshot(fx.tenantIds);
        const retry = await h.b.renewedTransport(fx, input);
        expect(retry.decision?.receipt).not.toBe(input.decision?.receipt);
        expect(retry.decision?.selectedLogicalIds).toEqual(input.decision?.selectedLogicalIds);
        expect(await h.b.save(fx.adminClient, operation, retry, crypto.randomUUID()))
          .toEqual({ ok: true, data: { bookingId: p.bookingId } });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(drifted);
        const expired = await h.b.expireReceipt(fx, input);
        expect(await h.b.save(fx.adminClient, operation, expired, crypto.randomUUID()))
          .toEqual({ ok: true, data: { bookingId: p.bookingId } });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(drifted);
        expect(drifted.bookings).toEqual(committed.bookings);
        expect(drifted.audit.filter((r) => r.correlation_id === correlation)).toHaveLength(1);
      });
    });
    for (const changed of ["selection", "reason"] as const) {
      // RED until same command UUID with DIFFERENT normalized business decision conflicts.
      test("[P0] 14.4-INT-003-replay-" + operation + "-" + changed + " conflicts without any second write", async () => {
        const h = await harness();
        await h.withConflictFixture(async (fx) => {
          const { scenario: s, preview: p } = await prepared(h, fx, operation);
          const input = reviewed(s, p);
          expect(await h.b.save(fx.adminClient, operation, input, crypto.randomUUID())).toEqual({ ok: true, data: { bookingId: p.bookingId } });
          const before = await h.bookingSnapshot(fx.tenantIds);
          const altered = { ...input, decision: {
            ...input.decision!, ...(changed === "selection" ? { selectedLogicalIds: [] } : { reason: "Different business justification" }),
          } };
          expect(await h.b.save(fx.adminClient, operation, altered, crypto.randomUUID()))
            .toMatchObject({ ok: false, code: "COMMAND_CONFLICT" });
          expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        });
      });
    }
  }
  // RED until reason whitespace and sorted review/selection canonicalize consistently.
  test("[P1] 14.4-INT-002-replay-normalized reason trim and reordered logical IDs return historical result", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const input = reviewed(s, p, s.expectedGroups);
      expect(await h.b.save(fx.adminClient, "create", input, crypto.randomUUID())).toEqual({ ok: true, data: { bookingId: p.bookingId } });
      const before = await h.bookingSnapshot(fx.tenantIds);
      const normalized = { ...input, decision: { ...input.decision!, reason: input.decision!.reason.trim(),
        reviewedLogicalIds: [...input.decision!.reviewedLogicalIds].reverse(),
        selectedLogicalIds: [...input.decision!.selectedLogicalIds].reverse(),
      } };
      expect(await h.b.save(fx.adminClient, "create", normalized, crypto.randomUUID())).toEqual({ ok: true, data: { bookingId: p.bookingId } });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
});

describe("Story 14.4 current authority on command checked RPC and reads", () => {
  for (const operation of ["create", "update"] as const) {
    // RED until authorized historical retry rechecks role AFTER current gate waits.
    test("[P0] 14.4-AC7-revoked-" + operation + " replay denies both command and direct checked RPC", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const s = await h.b.seedMixed(fx, operation);
        const preview = await h.b.preview(fx.plannerClient, operation, s.input);
        expect(preview.ok).toBe(true);
        if (!preview.ok) throw new Error("Planner positive control missing");
        const input = reviewed(s, preview.data);
        expect(await h.b.save(fx.plannerClient, operation, input, crypto.randomUUID()))
          .toEqual({ ok: true, data: { bookingId: preview.data.bookingId } });
        const committed = await h.bookingSnapshot(fx.tenantIds);
        expect(await h.b.direct(fx.plannerClient, operation, input)).toMatchObject({ error: null });
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(committed);
        await h.b.withRevokedPlanner(fx, async (client) => {
          const before = await h.bookingSnapshot(fx.tenantIds);
          // Envelope may authorize before the wait; SQL must recheck afterward.
          const result = await h.b.save(client, operation, input, crypto.randomUUID());
          expect(result.ok).toBe(false);
          if (!result.ok) expect(["PERMISSION_DENIED", "TENANT_ACCESS_DENIED"]).toContain(result.code);
          expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
          const denied = await h.b.direct(client, operation, input);
          expect(denied).toMatchObject({ data: null, error: { code: "42501" } });
          expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        });
      });
    });
  }
  // RED until every live finalize overload rejects fresh valid detector proof lacking review.
  test("[P0] 14.4-AC7-direct all fresh current obsolete finalize paths enforce human review", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s } = await prepared(h, fx);
      const inventory = await h.b.sqlInventory(fx, s);
      const finalizeEntries = inventory.checked.filter((e) => e.name === "finalize_booking_conflicts" || e.name === "finalize_booking_editor");
      expect(finalizeEntries.length).toBeGreaterThan(0);
      const before = await h.bookingSnapshot(fx.tenantIds);
      for (const entry of [...finalizeEntries, ...inventory.obsoleteFinalize]) {
        // Entry has genuinely valid CURRENT private detector proof, no reviewed receipt.
        const denied = await h.b.invokeWithoutReview(fx.adminClient, entry);
        expect(denied.data).toBeNull(); expect(denied.error).not.toBeNull();
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
      const legacyInput = { ...s.input }; delete legacyInput.proposedCreateId; delete legacyInput.decision;
      const legacy = await h.checkedBookingRpc("create", fx.adminClient, legacyInput, fx.base.tenantA.id, fx.base.adminA.id);
      expect(legacy).toMatchObject({ data: null, error: { code: "42501" } });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
  // RED until new helpers keep existing private ACLs and closed unauthenticated surface.
  test("[P0] 14.4-AC7-acl checked receipt RPC is authenticated private helpers remain uncallable", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s } = await prepared(h, fx);
      const inventory = await h.b.sqlInventory(fx, s);
      expect(inventory.private.length).toBeGreaterThan(0);
      const privateAcls = await h.b.sqlAcls(inventory.private);
      expect(privateAcls.map((e) => e.signature).sort()).toEqual(inventory.private.map((e) => e.signature).sort());
      expect(privateAcls.every((e) => !e.publicExecute && !e.anonExecute
        && !e.authenticatedExecute && !e.serviceRoleExecute)).toBe(true);
      const checkedAcls = await h.b.sqlAcls(inventory.checked);
      expect(checkedAcls.map((e) => e.signature).sort()).toEqual(inventory.checked.map((e) => e.signature).sort());
      expect(checkedAcls.every((e) => !e.publicExecute && !e.anonExecute && e.authenticatedExecute)).toBe(true);
      const before = await h.bookingSnapshot(fx.tenantIds);
      for (const entry of inventory.private) {
        const denied = await fx.adminClient.rpc(entry.name, entry.args);
        expect(denied.data).toBeNull(); expect(denied.error?.code).toBe("42501");
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      }
    });
  });
  // RED until SQL resolves current acceptance membership/time and rejects authored workflow.
  test("[P0] 14.4-INT-003-direct actor timestamp status cannot be client-authored", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const before = await h.bookingSnapshot(fx.tenantIds);
      const denied = await h.b.direct(fx.adminClient, "create", reviewed(s, p), { spoofAcceptance: true });
      expect(denied.data).toBeNull(); expect(denied.error).not.toBeNull();
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
  // RED until Montör read projection is its joined rows, with no tenant-wide preview/write.
  test("[P0] 14.4-AC7-montor own visibility excludes coworkers preview save override", async () => {
    const h = await harness();
    await h.withConflictFixture(async (fx) => {
      const { scenario: s, preview: p } = await prepared(h, fx);
      const read = await h.b.read(fx.montorClient);
      expect(read.bookings.map((r) => r.id).sort()).toEqual([...s.ownBookingIds].sort());
      expect(read.bookings.map((r) => r.id)).not.toContain(s.coworkerOnlyBookingId);
      expect(read.bookings.map((r) => r.id)).not.toContain(s.foreignBookingId);
      expect(read.conflicts.every((r) => r.tenant_id === fx.base.tenantA.id
        && r.affected_person_profile_id === fx.ownProfile.id)).toBe(true);
      expect(Object.keys(read.openCounts).sort()).toEqual([...s.ownBookingIds].sort());
      const browser = JSON.stringify(read.rawBrowserPayload);
      for (const field of ["canonicalFacts", "factDigest", "create_command_id", "create_payload_digest", "create_result", "update_outcomes"])
        expect(browser).not.toContain('"' + field + '"');
      const before = await h.bookingSnapshot(fx.tenantIds);
      const preview = await h.b.preview(fx.montorClient, "create", s.input);
      expect(preview).toMatchObject({ ok: false });
      expect(Object.keys(preview).sort()).toEqual(["code", "message", "ok"]);
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      expect((await h.b.save(fx.montorClient, "create", reviewed(s, p), crypto.randomUUID())).ok).toBe(false);
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      expect(await h.b.direct(fx.montorClient, "create", reviewed(s, p)))
        .toMatchObject({ data: null, error: { code: "42501" } });
      expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
    });
  });
  for (const ref of ["assignee", "job", "customer", "facility", "contact", "booking"] as const) {
    // RED until both command reference checks and underlying SQL preserve same-tenant closure.
    test("[P0] 14.4-AC7-cross-tenant-" + ref + " generic denial exact two-tenant no-op", async () => {
      const h = await harness();
      await h.withConflictFixture(async (fx) => {
        const { scenario: s, preview: p } = await prepared(h, fx, ref === "booking" ? "update" : "create");
        const input = await h.b.foreignReference(fx, s, ref);
        const operation = ref === "booking" ? "update" : "create";
        const before = await h.bookingSnapshot(fx.tenantIds);
        const preview = await h.b.preview(fx.adminClient, operation, input);
        expect(preview).toMatchObject({ ok: false });
        expect(JSON.stringify(preview)).not.toContain(s.foreignBookingId);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        const result = await h.b.save(fx.adminClient, operation, { ...input, decision: decision(p, [s.selected]) }, crypto.randomUUID());
        expect(result.ok).toBe(false);
        // Reusing a receipt for a changed candidate may fail its digest binding
        // before the SQL reference check. Both remain generic, durable no-ops.
        if (!result.ok) expect(["TENANT_ACCESS_DENIED", "PREVIEW_STALE"]).toContain(result.code);
        expect(Object.keys(result).sort()).toEqual(["code", "message", "ok"]);
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
        const rpc = await h.b.direct(fx.adminClient, operation, { ...input, decision: decision(p, [s.selected]) });
        expect(rpc.data).toBeNull(); expect(rpc.error).not.toBeNull();
        expect(await h.bookingSnapshot(fx.tenantIds)).toEqual(before);
      });
    });
  }
});
