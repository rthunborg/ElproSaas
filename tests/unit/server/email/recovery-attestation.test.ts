import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuoteDeliveryRecoveryAttestation,
  signQuoteDeliveryRecoveryAttestation,
  verifyQuoteDeliveryRecoveryAttestation,
  type QuoteDeliveryRecoveryAttestationPayload,
} from "@/server/email/recovery-attestation";

const secret = "local-test-only-quote-pdf-attestation-secret-v1";
const payload: QuoteDeliveryRecoveryAttestationPayload = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  actorUserId: "00000000-0000-4000-8000-000000000002",
  quoteVersionId: "00000000-0000-4000-8000-000000000003",
  correlationId: "00000000-0000-4000-8000-000000000004",
  stage: "finalization",
  rootFingerprint: "a".repeat(64),
  issuedAt: "2030-01-02T03:04:05.678Z",
  expiresAt: "2030-01-02T03:09:05.678Z",
};

test("[13.4][P0] recovery attestation binds every failure-provenance field", () => {
  const signature = signQuoteDeliveryRecoveryAttestation(payload, secret);
  assert.equal(verifyQuoteDeliveryRecoveryAttestation(payload, secret, signature), true);
  for (const changed of [
    { ...payload, tenantId: "00000000-0000-4000-8000-000000000010" },
    { ...payload, actorUserId: "00000000-0000-4000-8000-000000000011" },
    { ...payload, quoteVersionId: "00000000-0000-4000-8000-000000000012" },
    { ...payload, correlationId: "00000000-0000-4000-8000-000000000013" },
    { ...payload, stage: "artifact_preparation" as const },
    { ...payload, rootFingerprint: "b".repeat(64) },
    { ...payload, issuedAt: "2030-01-02T03:04:06.678Z" },
    { ...payload, expiresAt: "2030-01-02T03:09:06.678Z" },
  ]) {
    assert.equal(verifyQuoteDeliveryRecoveryAttestation(changed, secret, signature), false);
  }
  assert.equal(verifyQuoteDeliveryRecoveryAttestation(payload, `${secret}-wrong`, signature), false);
});

test("[13.4][P0] recovery attestation reuses the root secret independently of a malformed PDF key id", () => {
  const previousSecret = process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET;
  const previousKeyId = process.env.QUOTE_PDF_ATTESTATION_KEY_ID;
  try {
    process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET = secret;
    process.env.QUOTE_PDF_ATTESTATION_KEY_ID = "invalid key id!";
    const signed = createQuoteDeliveryRecoveryAttestation({
      tenantId: payload.tenantId,
      actorUserId: payload.actorUserId,
      quoteVersionId: payload.quoteVersionId,
      correlationId: payload.correlationId,
      stage: "artifact_preparation",
    }, new Date(payload.issuedAt));
    assert.equal(signed.issuedAt, payload.issuedAt);
    assert.equal(signed.expiresAt, payload.expiresAt);
    assert.equal(verifyQuoteDeliveryRecoveryAttestation(signed, secret, signed.signature), true);
  } finally {
    if (previousSecret === undefined) delete process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET;
    else process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET = previousSecret;
    if (previousKeyId === undefined) delete process.env.QUOTE_PDF_ATTESTATION_KEY_ID;
    else process.env.QUOTE_PDF_ATTESTATION_KEY_ID = previousKeyId;
  }
});
