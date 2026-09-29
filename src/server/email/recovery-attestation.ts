// SERVER-ONLY. This attests a failed quote-delivery command before the
// authenticated recovery RPC can append operational evidence. It reuses the
// approved quote-PDF HMAC root with a separate derivation domain and adds no
// credential or delivery authority.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const QUOTE_DELIVERY_RECOVERY_ATTESTATION_DOMAIN =
  "elpro.quote-delivery.recovery-attestation.v1";
export const QUOTE_DELIVERY_RECOVERY_KEY_DERIVATION_DOMAIN =
  "elpro.quote-delivery.recovery-key.v1";

export type QuoteDeliveryRecoveryStage = "artifact_preparation" | "finalization";

export interface QuoteDeliveryRecoveryAttestationPayload {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly quoteVersionId: string;
  readonly correlationId: string;
  readonly stage: QuoteDeliveryRecoveryStage;
  readonly rootFingerprint: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

const ATTESTATION_TTL_MS = 5 * 60 * 1000;
const HEX_SHA256_RE = /^[0-9a-f]{64}$/;

function canonicalLengthPrefixedBytes(values: readonly string[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks = values.map((value) => {
    const encoded = encoder.encode(value);
    const prefix = encoder.encode(`${encoded.byteLength}:`);
    const chunk = new Uint8Array(prefix.byteLength + encoded.byteLength);
    chunk.set(prefix);
    chunk.set(encoded, prefix.byteLength);
    return chunk;
  });
  const canonical = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    canonical.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return canonical;
}

/** Canonical bytes mirrored by the private PostgreSQL payload helper. */
export function canonicalQuoteDeliveryRecoveryAttestationBytes(
  payload: QuoteDeliveryRecoveryAttestationPayload,
): Uint8Array {
  return canonicalLengthPrefixedBytes([
    QUOTE_DELIVERY_RECOVERY_ATTESTATION_DOMAIN,
    payload.tenantId,
    payload.actorUserId,
    payload.quoteVersionId,
    payload.correlationId,
    payload.stage,
    payload.rootFingerprint,
    payload.issuedAt,
    payload.expiresAt,
  ]);
}

function deriveQuoteDeliveryRecoveryKey(rootSecret: string): Buffer {
  return createHmac("sha256", rootSecret)
    .update(QUOTE_DELIVERY_RECOVERY_KEY_DERIVATION_DOMAIN, "utf8")
    .digest();
}

export function signQuoteDeliveryRecoveryAttestation(
  payload: QuoteDeliveryRecoveryAttestationPayload,
  rootSecret: string,
): string {
  return createHmac("sha256", deriveQuoteDeliveryRecoveryKey(rootSecret))
    .update(canonicalQuoteDeliveryRecoveryAttestationBytes(payload))
    .digest("hex");
}

/** Exported for server-side tamper tests only. */
export function verifyQuoteDeliveryRecoveryAttestation(
  payload: QuoteDeliveryRecoveryAttestationPayload,
  rootSecret: string,
  signature: string,
): boolean {
  if (!HEX_SHA256_RE.test(signature)) return false;
  const expected = Buffer.from(signQuoteDeliveryRecoveryAttestation(payload, rootSecret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
}

/**
 * Load only the existing root secret. Recovery deliberately does not consume
 * the configured quote-PDF key id: an invalid key id is itself an honest
 * artifact-preparation failure that still needs durable recovery evidence.
 */
export function createQuoteDeliveryRecoveryAttestation(
  input: Omit<QuoteDeliveryRecoveryAttestationPayload, "rootFingerprint" | "issuedAt" | "expiresAt">,
  now: Date = new Date(),
): QuoteDeliveryRecoveryAttestationPayload & { readonly signature: string } {
  const rootSecret = process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET;
  if (!rootSecret) throw new Error("quote delivery recovery attestation is not configured");
  const issuedAt = now.toISOString();
  const payload: QuoteDeliveryRecoveryAttestationPayload = {
    ...input,
    rootFingerprint: createHash("sha256").update(rootSecret, "utf8").digest("hex"),
    issuedAt,
    expiresAt: new Date(now.getTime() + ATTESTATION_TTL_MS).toISOString(),
  };
  return { ...payload, signature: signQuoteDeliveryRecoveryAttestation(payload, rootSecret) };
}
