// SERVER-ONLY. The cookie-bound client snapshots and atomically finalizes; no privileged credentials.
import { bookingConflictKeyFromEnv, signConflictOutput } from "./conflict-attestation";
import { conflictClaims, previewBookingConflicts, snapshotBookingConflicts,
  type BookingRpcArgs, type BookingRpcClient, type DetectionSnapshot } from "./conflict-facts";
import { CommandError } from "@/server/commands/command-errors";

export type AttestedAttempt = { readonly snapshot: DetectionSnapshot; readonly outputText: string; readonly signature: string };
export type FinalizeResult = { readonly kind: "committed"; readonly bookingId: string } | { readonly kind: "stale" };
export async function finalizeBookingConflicts(client: BookingRpcClient, args: BookingRpcArgs, attempt: AttestedAttempt): Promise<FinalizeResult> {
  const { data, error } = await client.rpc("finalize_booking_conflicts", { ...args, p_booking_id: args.p_booking_id ?? null,
    p_claims: conflictClaims(attempt.snapshot), p_output: attempt.outputText, p_signature: attempt.signature });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("booking finalize invalid");
  const row = data as Record<string, unknown>;
  if (row.kind === "stale" && Object.keys(row).length === 1) return { kind: "stale" };
  if (row.kind === "committed" && typeof row.bookingId === "string" && Object.keys(row).length === 2) return row as FinalizeResult;
  throw new Error("booking finalize invalid");
}
export async function saveWithConflicts(client: BookingRpcClient, args: BookingRpcArgs): Promise<{ bookingId: string }> {
  // Replay snapshot can succeed without signing material: it returns historical
  // authority only after current SQL authorization, and never changes derived rows.
  const keyId = process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID ?? "unconfigured";
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = await snapshotBookingConflicts(client, args, keyId);
    if (snapshot.kind === "replay") return snapshot.result;
    const key = bookingConflictKeyFromEnv();
    if (snapshot.keyId !== key.keyId) throw new Error("booking proof configuration changed");
    const outputText = JSON.stringify(previewBookingConflicts(snapshot));
    const result = await finalizeBookingConflicts(client, args, { snapshot, outputText,
      signature: signConflictOutput(conflictClaims(snapshot), outputText, key.secret) });
    if (result.kind === "committed") return { bookingId: result.bookingId };
  }
  // SERVER_ERROR is the existing retryable code contract; no extra wire field.
  throw new CommandError("SERVER_ERROR");
}
