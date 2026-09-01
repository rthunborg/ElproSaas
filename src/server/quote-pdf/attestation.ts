// SERVER-ONLY. `node:crypto` is an enforceable Node-only import: Next cannot
// bundle this module into a client component. The attestation is intentionally
// independent from Story 10.8 reviewer authorization; it proves exact byte
// provenance and does not grant review authority.
import { createHmac, timingSafeEqual } from "node:crypto";

export const QUOTE_PDF_ATTESTATION_DOMAIN = "elpro.quote-pdf.attestation.v1";

export interface QuotePdfAttestationPayload {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly quoteVersionId: string;
  readonly renderFileId: string;
  /** Database-recomputed current quote-content fingerprint. */
  readonly contentFingerprint: string;
  readonly bucketId: string;
  readonly objectPath: string;
  readonly checksumSha256: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly correlationId: string;
  readonly keyId: string;
  /** Database-issued canonical UTC millisecond instants. */
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly generationStartedAt: string;
}

/**
 * Versioned, domain-separated canonical bytes shared with
 * `public.quote_pdf_attestation_payload`. Each UTF-8 field is length-prefixed
 * as ASCII decimal + `:`; this avoids JSON ordering/escaping differences between
 * Node and PostgreSQL and makes field boundaries unambiguous.
 */
export function canonicalQuotePdfAttestationBytes(
  payload: QuotePdfAttestationPayload,
): Uint8Array {
  const values = [
    QUOTE_PDF_ATTESTATION_DOMAIN,
    payload.tenantId,
    payload.actorUserId,
    payload.quoteVersionId,
    payload.renderFileId,
    payload.contentFingerprint,
    payload.bucketId,
    payload.objectPath,
    payload.checksumSha256,
    String(payload.sizeBytes),
    payload.mimeType,
    payload.correlationId,
    payload.keyId,
    payload.issuedAt,
    payload.expiresAt,
    payload.generationStartedAt,
  ];
  const encoder = new TextEncoder();
  const chunks = values.map((value) => {
    const encoded = encoder.encode(value);
    const prefix = encoder.encode(`${encoded.byteLength}:`);
    const chunk = new Uint8Array(prefix.byteLength + encoded.byteLength);
    chunk.set(prefix);
    chunk.set(encoded, prefix.byteLength);
    return chunk;
  });
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const canonical = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    canonical.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return canonical;
}

export function quotePdfAttestationSecretFromEnv(): { keyId: string; secret: string } {
  const keyId = process.env.QUOTE_PDF_ATTESTATION_KEY_ID;
  const secret = process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET;
  if (!keyId || !/^[A-Za-z0-9_-]{1,64}$/.test(keyId) || !secret) {
    throw new Error("quote PDF attestation is not configured");
  }
  return { keyId, secret };
}

export function signQuotePdfAttestation(
  payload: QuotePdfAttestationPayload,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(canonicalQuotePdfAttestationBytes(payload))
    .digest("hex");
}

/** Exported only for server-side golden-vector tests; never expose to a client. */
export function verifyQuotePdfAttestation(
  payload: QuotePdfAttestationPayload,
  secret: string,
  signature: string,
): boolean {
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Buffer.from(signQuotePdfAttestation(payload, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
}
