// SERVER-ONLY: Node crypto prevents browser bundling. Never log, persist or return proofs.
import { createHmac, timingSafeEqual } from "node:crypto";

export const BOOKING_CONFLICT_ATTESTATION_DOMAIN = "elpro.booking-conflicts.attestation.v1";
// v2 binds complete persisted associations for aggregate capacity participants.
export const BOOKING_CONFLICT_ENGINE_VERSION = "booking-conflicts-v2";
export type ConflictClaims = {
  readonly tenantId: string; readonly actorId: string; readonly operation: "create" | "update";
  readonly commandId: string; readonly bookingId: string; readonly candidateDigest: string;
  readonly factDigest: string; readonly engineVersion: string; readonly configVersion: string;
  readonly correlationId: string; readonly keyId: string; readonly issuedAt: string; readonly expiresAt: string;
};
export const CONFLICT_CLAIM_FIELDS = ["tenantId", "actorId", "operation", "commandId", "bookingId", "candidateDigest",
  "factDigest", "engineVersion", "configVersion", "correlationId", "keyId", "issuedAt", "expiresAt"] as const;
export function canonicalConflictProofBytes(claims: ConflictClaims, outputText: string): Uint8Array {
  const values = [BOOKING_CONFLICT_ATTESTATION_DOMAIN, ...CONFLICT_CLAIM_FIELDS.map((field) => claims[field]), outputText];
  return Buffer.concat(values.map((value) => {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([Buffer.from(`${bytes.byteLength}:`, "ascii"), bytes]);
  }));
}
export function bookingConflictKeyFromEnv(): { keyId: string; secret: string } {
  const keyId = process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID;
  const secret = process.env.BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET;
  if (!keyId || !/^[A-Za-z0-9_-]{1,64}$/.test(keyId) || !secret) throw new Error("booking detection is not configured");
  return { keyId, secret };
}
export function signConflictOutput(claims: ConflictClaims, outputText: string, secret: string): string {
  return createHmac("sha256", secret).update(canonicalConflictProofBytes(claims, outputText)).digest("hex");
}
export function verifyConflictOutput(claims: ConflictClaims, outputText: string, secret: string, signature: string): boolean {
  return /^[0-9a-f]{64}$/.test(signature) && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signConflictOutput(claims, outputText, secret), "hex"));
}
