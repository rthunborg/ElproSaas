/** TEST-ONLY bindings to the real verifier/signer and actual booking commands.
 * The proxy observes RPCs and supplies deterministic barriers; it never fabricates
 * facts, detection, signatures, SQL replies or durable results.
 */
import { createHash } from "node:crypto";
import { parseDetectionSnapshot, snapshotBookingConflicts, previewBookingConflicts, conflictClaims,
  type BookingRpcArgs, type DetectionSnapshot as ProductionSnapshot, type BookingRpcClient } from "@/server/bookings/conflict-facts";
import { signConflictOutput } from "@/server/bookings/conflict-attestation";
import { validateCreateBooking, validateUpdateBooking, bookingPayload } from "@/server/commands/bookings/validation";
import { LOCAL_TEST_BOOKING_CONFLICT_KEY_ID, LOCAL_TEST_BOOKING_CONFLICT_SECRET, assertLocalStack } from "./test-env";
import { bookingCommand, type BookingInput, type DurableRow } from "./bookings-atdd";
import type { ConflictBindings, DetectionSnapshot, AttestedAttempt, DerivedConflict, Operation, FinalizeResult } from "./booking-conflicts-atdd";
import type { TestServerClient } from "../factories/tenants";

function payload(op: Operation, input: BookingInput) {
  const valid = op === "create" ? validateCreateBooking(input) : validateUpdateBooking(input);
  if (!valid.ok) throw new Error("Invalid test booking input");
  return bookingPayload(valid.data);
}
async function identity(client: TestServerClient) {
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new Error("Test actor missing");
  const membership = await client.from("tenant_memberships").select("tenant_id").eq("user_id", user.data.user.id).eq("status", "active").single();
  if (membership.error || !membership.data) throw new Error("Test tenant missing");
  return { tenantId: membership.data.tenant_id as string, actorId: user.data.user.id };
}
const normalizedRows = (rows: DurableRow[]): DerivedConflict[] => rows.map((row) => ({
  booking_id: String(row.booking_id), related_booking_id: row.related_booking_id === null ? null : String(row.related_booking_id),
  affected_person_profile_id: row.affected_person_profile_id === null ? null : String(row.affected_person_profile_id),
  conflict_type: String(row.conflict_type), starts_at: canonicalInstant(String(row.starts_at)), ends_at: canonicalInstant(String(row.ends_at)), natural_key: String(row.natural_key),
})).sort((a, b) => a.natural_key < b.natural_key ? -1 : a.natural_key > b.natural_key ? 1 : 0);
function canonicalInstant(value: string): string {
  const micros = (value.match(/[.](\d{1,6})/)?.[1] ?? "").padEnd(6, "0");
  return new Date(value).toISOString().replace(/[.]\d{3}Z$/, `.${micros}Z`);
}
function args(snapshot: DetectionSnapshot, input: BookingInput): BookingRpcArgs {
  return { p_tenant_id: snapshot.tenantId, p_actor_id: snapshot.actorId, p_correlation_id: snapshot.correlationId,
    p_command_id: input.commandId, ...(input.bookingId ? { p_booking_id: input.bookingId } : {}), p_payload: payload(input.bookingId ? "update" : "create", input) };
}

/** Direct checked RPC positive control; raw payload still reaches the SQL validator. */
export async function authoritativeBookingRpc(op: Operation, client: TestServerClient, input: BookingInput,
  tenantId: string, actorId: string | null, correlationId = crypto.randomUUID()) {
  const { commandId, bookingId, ...rawPayload } = input;
  const rpcArgs = { p_tenant_id: tenantId, p_actor_id: actorId, p_correlation_id: correlationId,
    p_command_id: commandId, p_booking_id: op === "update" ? bookingId : null, p_payload: rawPayload };
  const snapshot = await client.rpc("snapshot_booking_conflicts", { ...rpcArgs, p_key_id: LOCAL_TEST_BOOKING_CONFLICT_KEY_ID });
  if (snapshot.error) return snapshot;
  const parsed = parseDetectionSnapshot(snapshot.data);
  if (parsed.kind === "replay") return { data: parsed.result, error: null };
  const outputText = JSON.stringify(previewBookingConflicts(parsed));
  const signature = signConflictOutput(conflictClaims(parsed), outputText, LOCAL_TEST_BOOKING_CONFLICT_SECRET);
  const finalized = await client.rpc("finalize_booking_conflicts", { ...rpcArgs, p_claims: conflictClaims(parsed), p_output: outputText, p_signature: signature });
  if (finalized.error) return finalized;
  const result = finalized.data as { kind: string; bookingId: string };
  return result.kind === "committed" ? { data: { bookingId: result.bookingId }, error: null }
    : { data: null, error: { code: "BKSTALE" } };
}

export async function actualConflictBindings(): Promise<ConflictBindings> {
  assertLocalStack();
  const emptyUuid = "00000000-0000-4000-8000-000000000000";
  const snapshotArgs = { p_tenant_id: emptyUuid, p_actor_id: emptyUuid, p_correlation_id: emptyUuid, p_command_id: emptyUuid,
    p_booking_id: null, p_payload: {}, p_key_id: "test_v1" };
  const helpers = [
    { name: "booking_detection_gate_internal", signature: "public.booking_detection_gate_internal(uuid,uuid)", args: { p_tenant_id: emptyUuid, p_actor_id: emptyUuid } },
    { name: "booking_detection_digest_internal", signature: "public.booking_detection_digest_internal(text,uuid,jsonb)", args: { p_operation: "create", p_booking_id: null, p_payload: {} } },
    { name: "booking_detection_replay_internal", signature: "public.booking_detection_replay_internal(uuid,uuid,uuid,uuid,jsonb)", args: { p_tenant_id: emptyUuid, p_actor_id: emptyUuid, p_command_id: emptyUuid, p_booking_id: null, p_payload: {} } },
    { name: "booking_detection_facts_internal", signature: "public.booking_detection_facts_internal(uuid)", args: { p_tenant_id: emptyUuid } },
    { name: "booking_conflict_proof_bytes_internal", signature: "public.booking_conflict_proof_bytes_internal(jsonb,text)", args: { p_claims: {}, p_output: "[]" } },
    { name: "booking_conflict_key_internal", signature: "public.booking_conflict_key_internal(text)", args: { p_key_id: "test_v1" } },
    { name: "booking_conflict_output_internal", signature: "public.booking_conflict_output_internal(uuid,uuid,jsonb,text)", args: { p_tenant_id: emptyUuid, p_booking_id: emptyUuid, p_payload: {}, p_output: "[]" } },
    { name: "booking_commit_conflicts_internal", signature: "public.booking_commit_conflicts_internal(uuid,uuid,uuid,uuid,uuid,jsonb,uuid,jsonb)", args: { p_tenant_id: emptyUuid, p_actor_id: emptyUuid, p_correlation_id: emptyUuid, p_command_id: emptyUuid, p_booking_id: null, p_payload: {}, p_proposed_id: emptyUuid, p_conflicts: [] } },
  ];
  return {
    sourceEvidence: ["src/server/bookings/conflict-facts.ts", "src/server/bookings/save-with-conflicts.ts", "src/server/bookings/conflict-attestation.ts"],
    async snapshot(client, op, input, correlationId, claimed) {
      const actor = await identity(client);
      const result = await snapshotBookingConflicts(client as unknown as BookingRpcClient, {
        p_tenant_id: claimed?.tenantId ?? actor.tenantId, p_actor_id: claimed?.actorId ?? actor.actorId,
        p_correlation_id: correlationId, p_command_id: input.commandId,
        ...(op === "update" ? { p_booking_id: input.bookingId } : {}), p_payload: payload(op, input),
      }, LOCAL_TEST_BOOKING_CONFLICT_KEY_ID);
      if (result.kind !== "snapshot") throw new Error("Fresh snapshot expected");
      return result;
    },
    async detect(snapshot) { return previewBookingConflicts(snapshot as ProductionSnapshot); },
    async preview(snapshot) { return previewBookingConflicts(snapshot as ProductionSnapshot); },
    async attest(snapshot, conflicts) {
      const outputText = JSON.stringify(conflicts);
      return { snapshot, outputText, signature: signConflictOutput(conflictClaims(snapshot), outputText, LOCAL_TEST_BOOKING_CONFLICT_SECRET) };
    },
    async signedVariant(attempt, change) {
      const { conflicts, ...claims } = change;
      const snapshot = { ...attempt.snapshot, ...claims } as DetectionSnapshot;
      const outputText = conflicts === undefined ? attempt.outputText : JSON.stringify(conflicts);
      return { snapshot, outputText, signature: signConflictOutput(conflictClaims(snapshot), outputText, LOCAL_TEST_BOOKING_CONFLICT_SECRET) };
    },
    async finalize(client, input, attempt) {
      if (!attempt) {
        const actor = await identity(client);
        const denied = await client.rpc("finalize_booking_conflicts", { p_tenant_id: actor.tenantId, p_actor_id: actor.actorId,
          p_correlation_id: crypto.randomUUID(), p_command_id: input.commandId, p_booking_id: input.bookingId ?? null,
          p_payload: payload(input.bookingId ? "update" : "create", input), p_claims: null, p_output: null, p_signature: null });
        if (denied.error) return { kind: "denied", code: denied.error.code ?? "SERVER_ERROR" };
        throw new Error("Missing proof unexpectedly accepted");
      }
      const { data, error } = await client.rpc("finalize_booking_conflicts", { ...args(attempt.snapshot, input), p_booking_id: input.bookingId ?? null,
        p_claims: conflictClaims(attempt.snapshot), p_output: attempt.outputText, p_signature: attempt.signature });
      return error ? { kind: "denied", code: error.code ?? "SERVER_ERROR" } : data as FinalizeResult;
    },
    async observeCommand(client, op, input, correlationId, afterSnapshot) {
      const snapshots: DetectionSnapshot[] = []; const finalizations: FinalizeResult[] = [];
      let snapshot: DetectionSnapshot | undefined;
      const proxy = new Proxy(client, { get(target, property) {
        if (property === "rpc") return async (name: string, rpcArgs: Record<string, unknown>) => {
          if (name === "finalize_booking_conflicts") {
            if (!snapshot) throw new Error("Actual command did not snapshot");
            const attempt: AttestedAttempt = { snapshot, outputText: String(rpcArgs.p_output), signature: String(rpcArgs.p_signature) };
            await afterSnapshot(attempt, snapshots.length - 1);
          }
          const response = await target.rpc(name, rpcArgs);
          if (name === "snapshot_booking_conflicts" && !response.error) {
            const parsed = parseDetectionSnapshot(response.data);
            if (parsed.kind === "snapshot") { snapshot = parsed; snapshots.push(parsed); }
          }
          if (name === "finalize_booking_conflicts" && !response.error) finalizations.push(response.data as FinalizeResult);
          return response;
        };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
      const result = await bookingCommand(op, proxy, input, correlationId);
      return { result, snapshots, finalizations };
    },
    normalizedRows,
    sqlInventory: { checked: [
      { name: "snapshot_booking_conflicts", signature: "public.snapshot_booking_conflicts(uuid,uuid,uuid,uuid,uuid,jsonb,text)", args: snapshotArgs },
      { name: "finalize_booking_conflicts", signature: "public.finalize_booking_conflicts(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,text)", args: { ...snapshotArgs, p_key_id: undefined, p_claims: {}, p_output: "[]", p_signature: "" } },
    ], private: helpers },
    async prepareInvitationWriter(fx) {
      const operationId = crypto.randomUUID(); const tokenHash = createHash("sha256").update(crypto.randomUUID()).digest("hex");
      const prepared = await fx.adminClient.rpc("admin_prepare_membership_invitation", { p_tenant_id: fx.base.tenantA.id,
        p_email: fx.base.adminB.email, p_roles: ["montor"], p_operation_id: operationId,
        p_token_hash: tokenHash, p_expiry: new Date(Date.now() + 3600_000).toISOString() });
      if (prepared.error) throw new Error("Invitation fixture prepare failed");
      const membershipId = (prepared.data as { membershipId: string }).membershipId;
      const completed = await fx.adminClient.rpc("admin_finalize_membership_operation", { p_operation_id: operationId, p_outcome: "succeeded" });
      if (completed.error) throw new Error("Invitation fixture finalize failed");
      return { lockSql: "select id from public.tenant_memberships where id=$1 for update", lockParams: [membershipId],
        invoke: async () => fx.foreignClient.rpc("admin_accept_membership_invitation", { p_membership_id: membershipId, p_token_hash: tokenHash,
          p_user_id: fx.base.adminB.id, p_email: fx.base.adminB.email }) };
    },
  };
}
