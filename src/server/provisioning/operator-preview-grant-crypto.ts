import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

export type OperatorPreviewGrant = {
  readonly actorUserId: string;
  readonly request: Record<string, unknown>;
  readonly previewHash: string;
  readonly expiresAt: number;
};

export function encodeOperatorPreviewGrant(grant: OperatorPreviewGrant, encryptionKey: Buffer): string | null {
  const plaintext = Buffer.from(JSON.stringify(grant), "utf8");
  if (plaintext.byteLength > 2048) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decodeOperatorPreviewGrant(value: string, encryptionKey: Buffer): OperatorPreviewGrant | null {
  try {
    const payload = Buffer.from(value, "base64url");
    if (payload.byteLength < 12 + 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    const parsed = JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8")) as Record<string, unknown>;
    if (
      typeof parsed.actorUserId !== "string" || !parsed.request || typeof parsed.request !== "object" || Array.isArray(parsed.request)
      || typeof parsed.previewHash !== "string" || typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()
    ) return null;
    return { actorUserId: parsed.actorUserId, request: parsed.request as Record<string, unknown>, previewHash: parsed.previewHash, expiresAt: parsed.expiresAt };
  } catch { return null; }
}

/** Narrow crypto seam for the no-raw-browser-transport unit proof. */
export const operatorPreviewGrantCryptoTestHooks = { encode: encodeOperatorPreviewGrant, decode: decodeOperatorPreviewGrant };

export function samePreviewGrantActor(expected: string, actual: string): boolean {
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
