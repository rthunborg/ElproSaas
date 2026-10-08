// SERVER-ONLY. The cookie-bound client snapshots and atomically finalizes; no privileged credentials.
import { bookingConflictKeyFromEnv, signConflictOutput } from "./conflict-attestation";
import { conflictClaims, previewBookingConflicts, snapshotBookingConflicts,
  type BookingRpcArgs, type BookingRpcClient, type DetectionSnapshot } from "./conflict-facts";
import { CommandError } from "@/server/commands/command-errors";
import { deriveBookingConflicts } from "./conflict-facts";
import { editorClaims, openEditorReceipt, signEditorClaims, type EditorClaims } from "./editor-preview";
import { EMPTY_BOOKING_DECISION, type BookingDecision, type BookingEditorReview } from "@/features/resources/booking-editor-input";
import { proposedBookingIdentity } from "./create-identity";

export type AttestedAttempt = { readonly snapshot: DetectionSnapshot; readonly outputText: string; readonly signature: string };
export type FinalizeResult = { readonly kind: "committed"; readonly bookingId: string } | { readonly kind: "stale" };
export async function finalizeBookingConflicts(client: BookingRpcClient, args: BookingRpcArgs, attempt: AttestedAttempt,
  review?: { claims: EditorClaims; decision: BookingDecision; signature: string }): Promise<FinalizeResult> {
  const { data, error } = await client.rpc(review ? "finalize_booking_editor" : "finalize_booking_conflicts", { ...args,
    ...(review ? { p_proposed_id: args.p_proposed_id ?? proposedBookingIdentity(args.p_tenant_id, args.p_command_id), p_review_claims: conflictClaims(review.claims),
      p_review_groups: JSON.stringify(review.claims.groups), p_review_signature: review.signature, p_decision: review.decision } : {}),
    p_booking_id: args.p_booking_id ?? null, p_claims: conflictClaims(attempt.snapshot), p_output: attempt.outputText, p_signature: attempt.signature });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("booking finalize invalid");
  const row = data as Record<string, unknown>;
  if (row.kind === "stale" && Object.keys(row).length === 1) return { kind: "stale" };
  if (row.kind === "committed" && typeof row.bookingId === "string" && Object.keys(row).length === 2) return row as FinalizeResult;
  throw new Error("booking finalize invalid");
}
export async function saveWithConflicts(client: BookingRpcClient, args: BookingRpcArgs, review?: BookingEditorReview): Promise<{ bookingId: string }> {
  // Replay snapshot can succeed without signing material: it returns historical
  // authority only after current SQL authorization, and never changes derived rows.
  const keyId = process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID ?? "unconfigured";
  for (let attempt = 0; attempt < (review ? 1 : 3); attempt++) {
    const decision = review?.decision ?? EMPTY_BOOKING_DECISION;
    const snapshot = await snapshotBookingConflicts(client, args, keyId, review ? decision : null);
    if (snapshot.kind === "replay") return snapshot.result;
    const key = bookingConflictKeyFromEnv();
    if (snapshot.keyId !== key.keyId) throw new Error("booking proof configuration changed");
    const derived = deriveBookingConflicts(snapshot);
    const reviewed = review ? openEditorReceipt(review.receipt, key.secret) : editorClaims(snapshot, derived.groups);
    if (reviewed.tenantId !== args.p_tenant_id || reviewed.actorId !== args.p_actor_id || reviewed.operation !== snapshot.operation ||
      reviewed.commandId !== args.p_command_id || reviewed.bookingId !== snapshot.bookingId)
      throw new CommandError("TENANT_ACCESS_DENIED");
    if (review && (reviewed.candidateDigest !== snapshot.candidateDigest || reviewed.factDigest !== snapshot.factDigest || Date.parse(reviewed.expiresAt) <= Date.now())) throw new CommandError("PREVIEW_STALE");
    const currentIds = derived.groups.map((group) => group.logicalId);
    if (currentIds.length > 0 && !review) throw new CommandError("BOOKING_CONFLICT_UNACKNOWLEDGED");
    if (currentIds.length > 0 && (!decision.acknowledged || !decision.reason)) throw new CommandError("BOOKING_CONFLICT_UNACKNOWLEDGED");
    if (JSON.stringify(decision.reviewedLogicalIds) !== JSON.stringify(currentIds) ||
      JSON.stringify(reviewed.groups) !== JSON.stringify(derived.groups)) throw new CommandError("PREVIEW_STALE");
    const outputText = JSON.stringify(previewBookingConflicts(snapshot));
    const result = await finalizeBookingConflicts(client, args, { snapshot, outputText,
      signature: signConflictOutput(conflictClaims(snapshot), outputText, key.secret) },
      { claims: reviewed, decision, signature: signEditorClaims(reviewed, key.secret) });
    if (result.kind === "committed") return { bookingId: result.bookingId };
    if (review) throw new CommandError("PREVIEW_STALE");
  }
  // SERVER_ERROR is the existing retryable code contract; no extra wire field.
  throw new CommandError("SERVER_ERROR");
}
