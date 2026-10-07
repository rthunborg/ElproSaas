// SERVER-ONLY. The encrypted browser receipt and SQL review attestation use distinct domains.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { bookingConflictKeyFromEnv, canonicalConflictProofBytes } from "./conflict-attestation";
import { snapshotBookingConflicts, deriveBookingConflicts, conflictClaims, type BookingRpcArgs, type BookingRpcClient,
  type LogicalConflictGroup, type DetectionSnapshot } from "./conflict-facts";
import { CommandError } from "@/server/commands/command-errors";

export const BOOKING_EDITOR_DOMAIN = "elpro.booking-editor.review.v1";
export type EditorClaims = import("./conflict-attestation").ConflictClaims & { readonly groups: readonly LogicalConflictGroup[] };
const labels: Record<string, string> = { double_booking: "Dubbelbokning", over_capacity: "Över kapacitet",
  outside_work_hours: "Utanför arbetstid", outside_access_window: "Utanför tillträdestid", competence_missing: "Kompetens saknas" };
export function editorReviewBytes(claims: EditorClaims): Uint8Array {
  const base = canonicalConflictProofBytes(claims, JSON.stringify(claims.groups));
  return Buffer.concat([Buffer.from(`${Buffer.byteLength(BOOKING_EDITOR_DOMAIN)}:${BOOKING_EDITOR_DOMAIN}`), base]);
}
export function signEditorClaims(claims: EditorClaims, secret: string): string {
  return createHmac("sha256", secret).update(editorReviewBytes(claims)).digest("hex");
}
function receiptKey(secret: string): Buffer { return createHash("sha256").update(`${BOOKING_EDITOR_DOMAIN}\0${secret}`).digest(); }
export function sealEditorReceipt(claims: EditorClaims, secret: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", receiptKey(secret), iv);
  cipher.setAAD(Buffer.from(BOOKING_EDITOR_DOMAIN));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(claims), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function openEditorReceipt(receipt: string, secret: string): EditorClaims {
  try {
    const bytes = Buffer.from(receipt, "base64url");
    if (bytes.length < 29 || bytes.length > 750000) throw new Error();
    const cipher = createDecipheriv("aes-256-gcm", receiptKey(secret), bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28)); cipher.setAAD(Buffer.from(BOOKING_EDITOR_DOMAIN));
    const claims = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8")) as EditorClaims;
    if (!claims || typeof claims !== "object" || !Array.isArray(claims.groups)) throw new Error();
    return claims;
  } catch { throw new CommandError("TENANT_ACCESS_DENIED"); }
}
export function editorClaims(snapshot: DetectionSnapshot, groups: readonly LogicalConflictGroup[]): EditorClaims {
  return { ...conflictClaims(snapshot), groups };
}
export async function previewBookingEditor(client: BookingRpcClient, args: BookingRpcArgs) {
  const key = bookingConflictKeyFromEnv();
  const snapshot = await snapshotBookingConflicts(client, args, key.keyId);
  if (snapshot.kind === "replay") throw new CommandError("COMMAND_CONFLICT");
  const { groups } = deriveBookingConflicts(snapshot);
  return { receipt: sealEditorReceipt(editorClaims(snapshot, groups), key.secret), bookingId: snapshot.bookingId,
    warnings: groups.map(({ logicalId, personId, bookingIds, rule, startsAt, endsAt }) => ({ logicalId, personId, bookingIds,
      ruleLabel: labels[rule] ?? "Varning", startsAt, endsAt })),
    availability: snapshot.candidate.assigneeIds.map((personId) => ({ personId, available: !groups.some((g) => g.personId === personId) })) };
}
