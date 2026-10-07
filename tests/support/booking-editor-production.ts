/** Test adapters use real cookie-client actions, checked SQL, sole detector and signer.
 * Seed expectations use literal intervals/IDs, never the preview being asserted. */
import { createHash } from "node:crypto";
import { vi } from "vitest";
import { adminQuery, adminSession } from "../factories/admin-sql";
import { bookingInput, bookingCommand, bookingPublicColumns, seedBookingParents,
  type BookingFixture, type BookingInput, type DurableRow } from "./bookings-atdd";
import { waitForBlocked } from "./booking-conflicts-atdd";
import { LOCAL_TEST_BOOKING_CONFLICT_KEY_ID as keyId, LOCAL_TEST_BOOKING_CONFLICT_SECRET as secret } from "./test-env";
import { snapshotBookingConflicts, deriveBookingConflicts, conflictClaims,
  type BookingRpcClient, type BookingRpcArgs, type LogicalConflictGroup } from "@/server/bookings/conflict-facts";
import { openEditorReceipt, sealEditorReceipt, signEditorClaims, editorClaims, BOOKING_EDITOR_DOMAIN } from "@/server/bookings/editor-preview";
import { signConflictOutput } from "@/server/bookings/conflict-attestation";
import { proposedBookingIdentity } from "@/server/bookings/create-identity";
import { bookingPayload, canonicalBookingPayload, validateCreateBooking, validateUpdateBooking } from "@/server/commands/bookings/validation";
import { EMPTY_BOOKING_DECISION } from "@/features/resources/booking-editor-input";
import { runCommand } from "@/server/commands/envelope";
import { createBooking } from "@/server/commands/bookings/create-booking";
import { updateBooking } from "@/server/commands/bookings/update-booking";
import { previewBookingAction } from "@/features/resources/booking-actions";
import { readBookingHost } from "@/features/resources/bookings-read";
import * as clientFactory from "@/server/db/supabase-server-client";
import type { TestServerClient } from "../factories/tenants";
import type { Operation } from "./booking-conflicts-atdd";
import type { EditorBindings, EditorInput, LogicalGroup, Preview, Scenario } from "./booking-editor-atdd";

export function productionInput(input: EditorInput) {
  const { proposedCreateId, decision, ...base } = input;
  const { receipt, ...human } = decision ?? { receipt: "" };
  return { ...base, ...(proposedCreateId ? { proposedBookingId: proposedCreateId } : {}),
    ...(decision ? { editorReview: { receipt, decision: human } } : {}) };
}
async function identity(client: TestServerClient) {
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new Error("Actual actor unavailable");
  const result = await client.from("tenant_memberships").select("tenant_id").eq("user_id", user.data.user.id).eq("status", "active").single();
  if (result.error || !result.data) throw new Error("Actual membership unavailable");
  return { tenantId: String(result.data.tenant_id), actorId: user.data.user.id };
}
async function rpcArgs(client: TestServerClient, op: Operation, input: EditorInput, correlation = crypto.randomUUID()): Promise<BookingRpcArgs> {
  const actor = await identity(client);
  const valid = op === "create" ? validateCreateBooking(productionInput(input)) : validateUpdateBooking(productionInput(input));
  if (!valid.ok) throw new Error("Adapter requested private facts for invalid input");
  return { p_tenant_id: actor.tenantId, p_actor_id: actor.actorId, p_correlation_id: correlation,
    p_command_id: input.commandId, p_payload: bookingPayload(valid.data),
    ...(op === "update" ? { p_booking_id: input.bookingId } : { p_proposed_id: input.proposedCreateId ?? input.proposedBookingId ?? proposedBookingIdentity(actor.tenantId,input.commandId) }) };
}
export async function currentAttempt(client: TestServerClient, op: Operation, input: EditorInput, correlation = crypto.randomUUID()) {
  const args = await rpcArgs(client, op, { ...input, decision: undefined }, correlation);
  const snapshot = await snapshotBookingConflicts(client as unknown as BookingRpcClient, args, keyId);
  if (snapshot.kind === "replay") return { args, snapshot };
  const derived = deriveBookingConflicts(snapshot);
  const outputText = JSON.stringify(derived.output);
  return { args, snapshot, derived, outputText, signature: signConflictOutput(conflictClaims(snapshot), outputText, secret) };
}
const fixtureReviews = new WeakMap<TestServerClient, Map<string, NonNullable<BookingInput["editorReview"]>>>();
const completedReviews = new WeakMap<TestServerClient,{ op:Operation;input:EditorInput }>();
const previewInputs = new Map<string,{ op:Operation;input:EditorInput }>();
/** Predecessor fixture's explicit current review; selected acceptance stays empty. */
export async function reviewedFixtureInput(client: TestServerClient, op: Operation, input: BookingInput, refresh = false): Promise<BookingInput> {
  const cache = fixtureReviews.get(client) ?? new Map(); fixtureReviews.set(client, cache);
  const valid = op === "create" ? validateCreateBooking(input) : validateUpdateBooking(input);
  if (!valid.ok) throw new Error("Invalid fixture review input");
  // Concurrent same-command contenders must retain their own canonical review;
  // a losing assignee set cannot overwrite the winning replay's decision.
  const cacheKey = JSON.stringify([op,valid.data.commandId,valid.data.proposedBookingId ?? null,canonicalBookingPayload(valid.data)]);
  const previous = cache.get(cacheKey);
  if (previous && !refresh) return { ...input, editorReview: previous };
  // Historical retry authorization uses snapshot's replay-only path, without inventing a decision.
  const attempt = await currentAttempt(client, op, input);
  if (attempt.snapshot.kind === "replay") return input;
  const ids = attempt.derived!.groups.map((g) => g.logicalId);
  const editorReview = { receipt: sealEditorReceipt(editorClaims(attempt.snapshot, attempt.derived!.groups), secret),
    decision: ids.length ? { acknowledged: true, reviewedLogicalIds: ids, selectedLogicalIds: [], reason: "Deliberately reviewed test fixture warnings" } : EMPTY_BOOKING_DECISION };
  cache.set(cacheKey, editorReview);
  return { ...input, editorReview };
}
function logical(group: LogicalConflictGroup): LogicalGroup {
  return { naturalKey: group.logicalId, conflictType: group.rule, bookingIds: [...group.bookingIds],
    affectedPersonIds: [group.personId], startsAt: group.startsAt, endsAt: group.endsAt, persistedKeys: [...group.keys] };
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const instant = (value: string) => {
  const micros = (value.match(/\.(\d{1,6})/)?.[1] ?? "").padEnd(6, "0");
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, `.${micros}Z`);
};
function expected(type: string, ids: string[], person: string, starts: string, ends: string): LogicalGroup {
  const bookingIds = [...ids].sort();
  const engineKey = JSON.stringify([type, bookingIds, [person], instant(starts), instant(ends)]);
  return { naturalKey: JSON.stringify([engineKey, person]), conflictType: type, bookingIds, affectedPersonIds: [person],
    startsAt: instant(starts), endsAt: instant(ends), persistedKeys: [`v1:${hash([engineKey, person])}`,
      ...bookingIds.slice(2).map((id) => `v2:${hash([engineKey, person, id])}`)].sort() };
}
const context = new WeakMap<BookingFixture, { peers: string[]; candidate: EditorInput; foreign: string; coworker: string; unrelated: string[] }>();
const START = "2026-10-12T06:00:00.123456Z", END = "2026-10-12T10:00:00.123456Z";
function candidateGroups(person: string, id: string, peers: string[], start = START, end = END) {
  const groups = peers.map((peer) => expected("double_booking", [id, peer], person,
    instant(start) > START ? start : START, instant(end) < END ? end : END));
  groups.push(expected("over_capacity", [...peers, id], person, "2026-10-11T22:00:00Z", "2026-10-12T22:00:00Z"));
  return groups.sort((a, b) => a.naturalKey < b.naturalKey ? -1 : a.naturalKey > b.naturalKey ? 1 : 0);
}
async function seed(fx: BookingFixture, op: Operation): Promise<Scenario> {
  // Random prefix isolates fixtures; ordinal suffix gives candidate-third exactly.
  const prefix = crypto.randomUUID().slice(0, 30);
  const ids = ["000001", "000002", "000003", "000004"].map((suffix) => prefix + suffix);
  const peers = [ids[0]!, ids[1]!, ids[3]!], candidateId = ids[2]!;
  const seedOne = async (client: TestServerClient, person: string, id: string, patch: Partial<BookingInput> = {}) => {
    const input = bookingInput([person], { startsAt: START, endsAt: END, ...patch });
    const b = await actualEditorBindings();
    const draft: EditorInput = { ...input, proposedCreateId: id };
    const preview = await b.preview(client, "create", draft);
    if (!preview.ok) throw new Error(`Real fixture preview denied: ${preview.code}`);
    const result = await b.save(client, "create", { ...draft, decision: reviewDecision(preview.data, []) }, crypto.randomUUID());
    if (!result.ok) throw new Error(`Real fixture command denied: ${result.code}`);
    return id;
  };
  for (const peer of peers) await seedOne(fx.adminClient, fx.ownProfile.id, peer);
  const coworker = crypto.randomUUID();
  await seedOne(fx.adminClient, fx.coworkerProfile.id, coworker, { startsAt: "2026-10-13T04:00:00Z", endsAt: "2026-10-13T05:00:00Z" });
  const foreign = crypto.randomUUID();
  await seedOne(fx.foreignClient, fx.foreignProfile.id, foreign, { startsAt: "2026-10-13T04:00:00Z", endsAt: "2026-10-13T05:00:00Z" });
  const input: EditorInput = bookingInput([fx.ownProfile.id], { startsAt: START, endsAt: END });
  if (op === "update") {
    await seedOne(fx.adminClient, fx.ownProfile.id, candidateId, { startsAt: "2026-10-14T06:00:00Z", endsAt: "2026-10-14T07:00:00Z" });
    input.bookingId = candidateId;
  } else input.proposedCreateId = candidateId;
  const groups = candidateGroups(fx.ownProfile.id, candidateId, peers);
  const unrelated = [expected("outside_work_hours", [coworker], fx.coworkerProfile.id, "2026-10-13T04:00:00Z", "2026-10-13T05:00:00Z").persistedKeys[0]!];
  context.set(fx, { peers, candidate: input, foreign, coworker, unrelated });
  const valid = op === "create" ? validateCreateBooking(productionInput(input)) : validateUpdateBooking(productionInput(input));
  if (!valid.ok) throw new Error("Literal fixture failed production validation");
  return { input, expectedGroups: groups, selected: groups.find((g) => g.conflictType === "over_capacity")!,
    unrelatedKeys: unrelated, otherReviewedKeys: groups.filter((g) => g.conflictType !== "over_capacity").flatMap((g) => g.persistedKeys),
    peerIds: peers, foreignBookingId: foreign, ownBookingIds: [...peers, ...(op === "update" ? [candidateId] : [])],
    coworkerOnlyBookingId: coworker, canonicalCandidate: bookingPayload(valid.data) as unknown as Record<string, unknown> };
}
function reviewDecision(p: Preview, selected: string[]) {
  return p.warnings.length ? { acknowledged: true, reviewedLogicalIds: p.warnings.map((w) => w.naturalKey).sort(),
    selectedLogicalIds: selected, reason: "Coordinated test fixture", receipt: p.receipt }
    : { ...EMPTY_BOOKING_DECISION, reviewedLogicalIds: [], selectedLogicalIds: [], receipt: p.receipt };
}
async function withClient<T>(client: TestServerClient, run: () => Promise<T>): Promise<T> {
  const stub = vi.spyOn(clientFactory, "createSupabaseServerClient").mockResolvedValue(client as never);
  try { return await run(); } finally { stub.mockRestore(); }
}
export async function actualEditorBindings(): Promise<EditorBindings> {
  const bindings: EditorBindings = {
    sourceEvidence: ["src/features/resources/booking-actions.ts", "src/server/bookings/editor-preview.ts", "src/server/bookings/save-with-conflicts.ts", "src/features/resources/bookings-read.ts"],
    seedMixed: (fx, op = "create") => seed(fx, op),
    async seedConflictFree(fx) {
      const input = { ...bookingInput([fx.ownProfile.id], { startsAt: "2026-10-12T06:00:00Z", endsAt: "2026-10-12T07:00:00Z" }), proposedCreateId: crypto.randomUUID() };
      context.set(fx, { peers: [], candidate: input, foreign: "", coworker: "", unrelated: [] });
      return { input };
    },
    async competingCandidate(fx, original) {
      const input = { ...original.input, commandId: crypto.randomUUID(), proposedCreateId: crypto.randomUUID() };
      const groups = candidateGroups(fx.ownProfile.id, input.proposedCreateId!, original.peerIds);
      return { ...original, input, expectedGroups: groups, selected: groups.find((g) => g.conflictType === "over_capacity")!,
        otherReviewedKeys: groups.filter((g) => g.conflictType !== "over_capacity").flatMap((g) => g.persistedKeys) };
    },
    async preview(client, op, input) {
      const result = await withClient(client, () => previewBookingAction(productionInput(input)));
      if (result.status === "error") return { ok: false, code: result.code, message: result.message };
      const p = result.preview;
      previewInputs.set(p.receipt,{op,input});
      return { ok: true, data: { bookingId: p.bookingId, receipt: p.receipt, rawBrowserPayload: result,
        warnings: p.warnings.map((w) => {
          const [engineKey] = JSON.parse(w.logicalId) as [string, string];
          const [type, ids, persons, starts, ends] = JSON.parse(engineKey) as [string, string[], string[], string, string];
          return { naturalKey: w.logicalId, conflictType: type, bookingIds: ids, affectedPersonIds: persons, startsAt: starts, endsAt: ends,
            ruleLabel: w.ruleLabel, personLabels: [w.personLabel],
            collisions: w.bookingIds.map((bookingId) => ({ bookingId, startsAt: w.startsAt, endsAt: w.endsAt })) };
        }), availability: p.availability.map((a) => ({ personId: a.personId, state: a.available ? "available" : "conflict" })) } };
    },
    async save(client, op, input, correlationId) {
      const owner = client;
      if (process.env.STORY144_DIAGNOSTIC === "1") {
        client = new Proxy(client, { get(target, property) {
          if (property === "rpc") return async (name: string, args: Record<string, unknown>) => {
            const reply = await target.rpc(name, args);
            if (reply.error) console.error("Editor RPC diagnostic", JSON.stringify({ name, code: reply.error.code, message: reply.error.message }));
            return reply;
          };
          const value = Reflect.get(target, property, target); return typeof value === "function" ? value.bind(target) : value;
        } });
      }
      const result = op === "create" ? await runCommand(createBooking, { client: client as never, input: productionInput(input), correlationId })
        : await runCommand(updateBooking, { client: client as never, input: productionInput(input), correlationId });
      if (result.ok) completedReviews.set(owner,{op,input});
      return result;
    },
    async verifyReceipt(receipt) {
      const claims = openEditorReceipt(receipt, secret);
      return { ...claims, domain: BOOKING_EDITOR_DOMAIN, groups: claims.groups.map(logical) };
    },
    async privateAttempt(client, op, input) {
      const attempt = await currentAttempt(client, op, input);
      if (attempt.snapshot.kind !== "snapshot") throw new Error("Fresh private proof required");
      return { proofTransport: JSON.stringify({ claims: conflictClaims(attempt.snapshot), output: attempt.outputText, signature: attempt.signature }),
        outputText: attempt.outputText!, signature: attempt.signature!, factMarkers: [attempt.snapshot.factDigest, attempt.snapshot.canonicalFacts] };
    },
    async renewedTransport(_fx, input) {
      if (!input.decision) throw new Error("Review required");
      const claims = openEditorReceipt(input.decision.receipt, secret);
      const [clock] = await adminQuery<{ now: string }>("select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as now");
      return { ...input, decision: { ...input.decision, receipt: sealEditorReceipt({ ...claims, issuedAt: clock.now,
        expiresAt: new Date(Date.parse(clock.now) + 60000).toISOString(), correlationId: crypto.randomUUID() }, secret) } };
    },
    async signedAttack(fx, s, p, attack) {
      const input: EditorInput = { ...s.input, decision: reviewDecision(p, [s.selected.naturalKey]) };
      const claims = { ...openEditorReceipt(p.receipt, secret) };
      if (attack === "forged-receipt") input.decision!.receipt = "invalid";
      else if (attack === "client-detector-fields") Object.assign(input, { conflicts: [], acceptedBy: fx.foreignProfile.membershipId });
      else {
        if (attack === "partial-logical-group") claims.groups = claims.groups.map((g) => g.logicalId === s.selected.naturalKey ? { ...g, keys: g.keys.slice(0, 1) } : g);
        if (attack === "unrelated-logical-group") claims.groups = [...claims.groups, { ...claims.groups[0]!, logicalId: "unrelated", keys: s.unrelatedKeys, bookingIds: [s.coworkerOnlyBookingId] }];
        if (attack === "wrong-tenant") claims.tenantId = fx.base.tenantB.id;
        if (attack === "wrong-actor") claims.actorId = fx.users.projektledare.id;
        if (attack === "wrong-candidate") claims.candidateDigest = "a".repeat(64);
        if (attack === "wrong-target") claims.bookingId = s.foreignBookingId;
        if (attack === "wrong-operation") claims.operation = "update";
        if (attack === "different-preview") claims.commandId = crypto.randomUUID();
        input.decision!.receipt = sealEditorReceipt(claims, secret);
      }
      return input;
    },
    async direct(client, op, input, options = {}) {
      const actor = await identity(client);
      const { commandId, bookingId, proposedCreateId, decision, ...payload } = input;
      // Use raw canonical-input fields below wrapper validation, SQL validates independently.
      const rawPayload = { ...payload, seriesId: null, occurrenceIndex: null, isException: false };
      const correlationId = crypto.randomUUID();
      const args = { p_tenant_id: actor.tenantId, p_actor_id: actor.actorId, p_correlation_id: correlationId,
        p_command_id: commandId, p_booking_id: op === "update" ? bookingId : null,
        p_proposed_id: proposedCreateId ?? input.proposedBookingId ?? proposedBookingIdentity(actor.tenantId,commandId), p_payload: rawPayload };
      const human = decision ? { acknowledged: decision.acknowledged, reviewedLogicalIds: decision.reviewedLogicalIds,
        selectedLogicalIds: decision.selectedLogicalIds, reason: decision.reason } : null;
      const snap = await client.rpc("snapshot_booking_editor", { ...args, p_key_id: keyId, p_decision: human });
      if (snap.error) return snap;
      let parsed = (await import("@/server/bookings/conflict-facts")).parseDetectionSnapshot(snap.data);
      if (parsed.kind === "replay") return { data: parsed.result, error: null };
      let derived: ReturnType<typeof deriveBookingConflicts>;
      try { derived = deriveBookingConflicts(parsed); }
      catch (error) {
        // Foreign assignees cannot obtain sole-engine output at all. Exercise
        // SQL with the genuine otherwise-valid reviewed candidate proof and the
        // changed raw payload, proving its independent binding rejects the edit.
        const original = decision && previewInputs.get(decision.receipt);
        if (!original) throw error;
        const attempt = await currentAttempt(client,original.op,original.input,correlationId);
        if (attempt.snapshot.kind !== "snapshot") throw error;
        parsed = attempt.snapshot; derived = attempt.derived!;
      }
      const outputText = JSON.stringify(derived.output);
      const privateClaims = conflictClaims(parsed);
      const review = decision ? openEditorReceipt(decision.receipt, secret) : editorClaims(parsed, derived.groups);
      return client.rpc("finalize_booking_editor", { ...args, p_claims: privateClaims,
        p_output: options.spoofAcceptance ? JSON.stringify(derived.output.map((row) => ({ ...row, status: "accepted", accepted_at: START, accepted_by_membership_id: actor.actorId }))) : outputText,
        p_signature: options.receiptAsDetectorProof ? signEditorClaims(review, secret) : signConflictOutput(privateClaims, outputText, secret),
        p_review_claims: options.omitDecision ? null : conflictClaims(review), p_review_groups: JSON.stringify(review.groups),
        p_review_signature: options.detectorProofAsReceipt ? signConflictOutput(conflictClaims(review), JSON.stringify(review.groups), secret) : signEditorClaims(review, secret),
        p_decision: options.omitDecision ? null : human });
    },
    async expireReceipt(_fx, input) {
      if (!input.decision) throw new Error("Signed review required");
      const claims = openEditorReceipt(input.decision.receipt, secret);
      const [clock] = await adminQuery<{ issued: string; expires: string }>(`select
        to_char((clock_timestamp()-interval '2 seconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as issued,
        to_char((clock_timestamp()-interval '1 second') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as expires`);
      // Genuine dedicated signer issues a valid one-second review, database clock proves expired.
      const receipt = sealEditorReceipt({ ...claims, issuedAt: clock.issued, expiresAt: clock.expires }, secret);
      const [proof] = await adminQuery<{ expired: boolean }>("select $1::timestamptz<clock_timestamp() as expired", [clock.expires]);
      if (!proof.expired) throw new Error("Database did not prove signed expiry");
      return { ...input, decision: { ...input.decision, receipt } };
    },
    async changeFacts(fx, kind) {
      if (kind === "schedule") {
        const result = await fx.adminClient.rpc("save_person_schedule_with_audit", { p_tenant_id: fx.base.tenantA.id, p_actor_user_id: fx.base.adminA.id,
          p_correlation_id: crypto.randomUUID(), p_person_profile_id: fx.ownProfile.id,
          p_schedule: [{ weekday: 1, start: "09:00", end: "16:00", breaks: [] }] });
        if (result.error) throw new Error("Real schedule writer failed");
      } else {
        const input = bookingInput([fx.ownProfile.id], { startsAt: "2026-10-12T06:00:00Z", endsAt: "2026-10-12T07:00:00Z" });
        const result = await bookingCommand("create", fx.adminClient, input);
        if (!result.ok) throw new Error(`Real concurrent booking failed: ${result.code}`);
      }
    },
    async changedCandidate(fx, input, kind) {
      if (kind === "time") return { ...input, endsAt: "2026-10-12T11:00:00.123456Z" };
      if (kind === "assignees") return { ...input, assigneeIds: [fx.coworkerProfile.id] };
      if (kind === "status") return { ...input, status: "cancelled" };
      const parents = await seedBookingParents(fx.base.tenantA.id);
      return { ...input, customerId: parents.customerId };
    },
    async observeSave(client, op, input, correlation, beforeFinalize) {
      let snapshots = 0, finalizations = 0; const finalizationKinds: string[] = [];
      const proxy = new Proxy(client, { get(target, property) {
        if (property === "rpc") return async (name: string, args: Record<string, unknown>) => {
          if (name === "finalize_booking_editor") { finalizations++; await beforeFinalize(); }
          const reply = await target.rpc(name, args);
          if (name === "snapshot_booking_editor" && !reply.error && reply.data?.kind === "snapshot") snapshots++;
          if (name === "finalize_booking_editor" && !reply.error) finalizationKinds.push(reply.data.kind);
          return reply;
        };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
      return { result: await bindings.save(proxy, op, input, correlation), snapshots, finalizations, finalizationKinds };
    },
    async withRevokedPlanner(fx, run) {
      const [original] = await adminQuery<{ role: string; status: string }>("select role,status from public.tenant_memberships where id=$1", [fx.coworkerProfile.membershipId]);
      const roles = await adminQuery<{ id: string; tenant_id: string; membership_id: string; role: string; created_at: string }>("select * from public.membership_roles where membership_id=$1", [fx.coworkerProfile.membershipId]);
      try {
        await adminSession(async ({ query }) => {
          await query("begin");
          let revocation: PromiseLike<unknown> | undefined;
          let attempt: Promise<Awaited<ReturnType<EditorBindings["direct"]>>> | undefined;
          try {
            const [owner] = await query<{ pid: number }>("select pg_backend_pid() as pid");
            await query("select id from public.tenant_memberships where id=$1 for update", [fx.coworkerProfile.membershipId]);
            revocation = Promise.resolve(fx.adminClient.rpc("admin_manage_membership", { p_tenant_id: fx.base.tenantA.id,
              p_membership_id: fx.coworkerProfile.membershipId, p_action: "re_role", p_roles: ["saljare"],
              p_reason: "Current editor replay authority test", p_operation_id: crypto.randomUUID() })).then((reply) => { if (reply.error) throw new Error("Real admin revocation failed"); });
            await waitForBlocked(owner.pid, 1);
            const committed = completedReviews.get(fx.plannerClient);
            if (!committed) throw new Error("Actual completed planner review needed for blocked replay");
            attempt = bindings.direct(fx.plannerClient,committed.op,committed.input);
            await waitForBlocked(owner.pid, 2);
            await query("commit");
            await revocation;
            const denied = await attempt;
            if (denied.data !== null || denied.error?.code !== "42501") throw new Error("Blocked actual replay retained revoked authority");
          } finally { await query("rollback"); if (revocation) await revocation; if (attempt) await attempt; }
        });
        await run(fx.plannerClient);
      } finally {
        await adminQuery("update public.tenant_memberships set role=$2,status=$3 where id=$1", [fx.coworkerProfile.membershipId, original.role, original.status]);
        await adminQuery("delete from public.membership_roles where membership_id=$1", [fx.coworkerProfile.membershipId]);
        for (const r of roles) await adminQuery("insert into public.membership_roles(id,tenant_id,membership_id,role,created_at) values($1,$2,$3,$4,$5)", [r.id,r.tenant_id,r.membership_id,r.role,r.created_at]);
      }
    },
    withFault: editorFault,
    async read(client) {
      const host = await withClient(client, () => readBookingHost());
      if (host.error) throw new Error("Actual browser host read failed");
      const [bookings, conflicts] = await Promise.all([
        client.from("bookings").select(bookingPublicColumns).order("id"),
        client.from("booking_conflicts").select("id,tenant_id,booking_id,related_booking_id,affected_person_profile_id,conflict_type,starts_at,ends_at,natural_key,status").order("id"),
      ]);
      if (bookings.error || conflicts.error) throw new Error("Real checked read failed");
      return { bookings: bookings.data as DurableRow[], conflicts: conflicts.data as DurableRow[],
        openCounts: Object.fromEntries(host.bookings.map((b) => [b.id, b.openConflictCount])), rawBrowserPayload: host };
    },
    normalizedConflicts(rows) { return rows.map((r) => ({ ...r, starts_at: instant(String(r.starts_at)), ends_at: instant(String(r.ends_at)) })); },
    async changedCollision(fx, s) {
      const id = s.input.proposedCreateId ?? s.input.bookingId!;
      const base = { ...s.input }; delete base.proposedCreateId; delete base.decision;
      // Move off the previous day as well: capacity's day identity must change too.
      const input = { ...base, bookingId: id, commandId: crypto.randomUUID(), startsAt: "2026-10-13T06:00:00.123456Z", endsAt: "2026-10-13T15:00:00.123456Z" };
      const expectedNewGroups = [expected("over_capacity", [id], fx.ownProfile.id, "2026-10-12T22:00:00Z", "2026-10-13T22:00:00Z"),
        expected("outside_work_hours", [id], fx.ownProfile.id, "2026-10-13T14:00:00Z", input.endsAt)].sort((a,b) => a.naturalKey < b.naturalKey ? -1 : 1);
      return { input, oldKeys: s.expectedGroups.flatMap((g) => g.persistedKeys), expectedNewGroups };
    },
    async foreignReference(fx, s, ref) {
      if (ref === "booking") return { ...s.input, bookingId: s.foreignBookingId };
      if (ref === "assignee") return { ...s.input, assigneeIds: [fx.foreignProfile.id] };
      const parents = await seedBookingParents(fx.base.tenantB.id);
      if (ref === "customer") return { ...s.input, customerId: parents.customerId };
      if (ref === "facility") return { ...s.input, facilityId: parents.facilityId };
      if (ref === "contact") return { ...s.input, contactId: parents.contactId };
      const made = await runCommand(parents.createJob, { client: fx.foreignClient as never,
        input: { customer_id: parents.customerId } });
      if (!made.ok) throw new Error("Real foreign job fixture failed");
      return { ...s.input, jobId: made.data.targetId };
    },
    async sqlInventory(fx, s) {
      const attempt = await currentAttempt(fx.adminClient, "create", s.input);
      if (attempt.snapshot.kind !== "snapshot") throw new Error("Fresh proof inventory required");
      const standard: Record<string, unknown> = { ...attempt.args, p_booking_id: null, p_key_id: keyId, p_decision: null,
        p_claims: conflictClaims(attempt.snapshot), p_output: attempt.outputText, p_signature: attempt.signature,
        p_review_claims: null, p_review_groups: null, p_review_signature: null, p_groups: [], p_conflicts: attempt.derived!.output,
        p_operation: "create", p_proposed_id: attempt.snapshot.bookingId };
      const entries = await adminQuery<{ signature: string; name: string; names: string[] }>(`select p.oid::regprocedure::text as signature,p.proname as name,p.proargnames as names
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
        and (p.proname like 'booking%internal' or p.proname in ('snapshot_booking_editor','snapshot_booking_conflicts','finalize_booking_editor','finalize_booking_conflicts','booking_editor_people')) order by p.oid::regprocedure::text`);
      const mapped = entries.map((e) => ({ signature: `public.${e.signature}`, name: e.name,
        args: Object.fromEntries(e.names.map((name) => [name, name in standard ? standard[name] : null])) }));
      return { checked: mapped.filter((e) => !e.name.endsWith("internal")),
        obsoleteFinalize: mapped.filter((e) => e.name === "finalize_booking_conflicts"), private: mapped.filter((e) => e.name.endsWith("internal")) };
    },
    async sqlAcls(entries) {
      return adminQuery(`select p.oid::regprocedure::text as raw_signature,
        'public.'||p.oid::regprocedure::text as signature,
        exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as "publicExecute",
        has_function_privilege('anon',p.oid,'execute') as "anonExecute",has_function_privilege('authenticated',p.oid,'execute') as "authenticatedExecute",
        has_function_privilege('service_role',p.oid,'execute') as "serviceRoleExecute"
        from pg_proc p where p.oid=any($1::regprocedure[]) order by p.oid::regprocedure::text`, [entries.map((e) => e.signature)]);
    },
    async invokeWithoutReview(client, entry) { return client.rpc(entry.name, entry.args); },
  };
  return bindings;
}

let faultReady: Promise<void> | undefined;
async function editorFault<T>(fx: BookingFixture, correlation: string, stage: "after_acceptance" | "before_audit", run: () => Promise<T>) {
  await (faultReady ??= adminQuery(`create schema if not exists test_support;
    create table if not exists test_support.editor_faults(correlation_id uuid primary key,stage text not null);
    revoke all on test_support.editor_faults from public,anon,authenticated,service_role;
    create or replace function test_support.fail_editor_transaction() returns trigger language plpgsql set search_path='' as $$
    declare v_keys jsonb;
    begin
      if exists(select 1 from test_support.editor_faults f where f.correlation_id=nullif(current_setting('app.booking_correlation_id',true),'')::uuid and f.stage=TG_ARGV[0]) then
        select jsonb_agg(natural_key order by natural_key) into v_keys from public.booking_conflicts
          where tenant_id=nullif(current_setting('app.editor_test_tenant',true),'')::uuid and status='accepted';
        -- Acceptance marker is sourced from actual rows in this same transaction.
        if v_keys is not null then raise exception 'forced editor transaction failure' using errcode='XX000',detail=v_keys::text; end if;
      end if;
      return null;
    end $$;
    revoke all on function test_support.fail_editor_transaction() from public,anon,authenticated,service_role;
    create or replace function test_support.mark_editor_tenant() returns trigger language plpgsql set search_path='' as $$
    begin perform set_config('app.editor_test_tenant',new.tenant_id::text,true); return new; end $$;
    revoke all on function test_support.mark_editor_tenant() from public,anon,authenticated,service_role;
    drop trigger if exists test_editor_tenant_marker on public.bookings;
    create trigger test_editor_tenant_marker before insert or update on public.bookings for each row execute function test_support.mark_editor_tenant();
    drop trigger if exists test_editor_after_acceptance on public.booking_conflicts;
    create trigger test_editor_after_acceptance after update on public.booking_conflicts for each statement execute function test_support.fail_editor_transaction('after_acceptance');
    drop trigger if exists test_editor_before_audit on public.audit_events;
    create trigger test_editor_before_audit before insert on public.audit_events for each statement execute function test_support.fail_editor_transaction('before_audit');`).then(() => undefined));
  await adminQuery("insert into test_support.editor_faults values($1,$2)", [correlation,stage]);
  const original = fx.adminClient; let reached = false; let acceptedKeysObserved: string[] = [];
  fx.adminClient = new Proxy(original,{ get(target,property) {
    if (property === "rpc") return async (name: string,args: Record<string,unknown>) => {
      const reply = await target.rpc(name,args);
      if (reply.error?.code === "XX000" && reply.error.message === "forced editor transaction failure") {
        reached = true; acceptedKeysObserved = JSON.parse(reply.error.details);
      }
      return reply;
    };
    const value = Reflect.get(target,property,target); return typeof value === "function" ? value.bind(target) : value;
  } });
  try { return { value: await run(), get reached() { return reached; }, get acceptedKeysObserved() { return acceptedKeysObserved; } }; }
  finally {
    fx.adminClient = original;
    await adminQuery("delete from test_support.editor_faults where correlation_id=$1", [correlation]);
    await adminQuery(`drop trigger if exists test_editor_tenant_marker on public.bookings;
      drop trigger if exists test_editor_after_acceptance on public.booking_conflicts;
      drop trigger if exists test_editor_before_audit on public.audit_events;
      drop function if exists test_support.mark_editor_tenant();
      drop function if exists test_support.fail_editor_transaction();`);
    faultReady = undefined;
  }
}
