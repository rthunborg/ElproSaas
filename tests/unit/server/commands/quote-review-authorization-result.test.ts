import assert from "node:assert/strict";
import test from "node:test";

import {
  extractQuotePdfSendAttestationChallenge,
  extractQuoteReviewAuthorizationId,
} from "@/server/commands/quotes/quote-db";

test("10.8 scalar authorization UUID is accepted without fabricating other shapes", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  assert.equal(extractQuoteReviewAuthorizationId(id), id);
  assert.equal(extractQuoteReviewAuthorizationId([id]), id);
  assert.equal(extractQuoteReviewAuthorizationId([]), null);
  assert.equal(extractQuoteReviewAuthorizationId({ id }), null);
  assert.equal(extractQuoteReviewAuthorizationId(null), null);
});

test("10.9 send-attestation challenge accepts only complete canonical PDF metadata", () => {
  const row = {
    file_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    content_fingerprint: "fingerprint",
    bucket_id: "tenant-files",
    object_path: "tenant/file/quote.pdf",
    checksum_sha256: "a".repeat(64),
    size_bytes: "42",
    mime_type: "application/pdf",
    attestation_key_id: "test_v1",
    attestation_issued_at: "2026-08-31T12:00:00.000Z",
    attestation_expires_at: "2026-08-31T12:05:00.000Z",
    generation_started_at: "2026-08-31T11:00:00.000Z",
  };
  assert.deepEqual(extractQuotePdfSendAttestationChallenge([row]), {
    fileId: row.file_id,
    contentFingerprint: row.content_fingerprint,
    bucketId: row.bucket_id,
    objectPath: row.object_path,
    checksumSha256: row.checksum_sha256,
    sizeBytes: 42,
    mimeType: row.mime_type,
    keyId: row.attestation_key_id,
    issuedAt: row.attestation_issued_at,
    expiresAt: row.attestation_expires_at,
    generationStartedAt: row.generation_started_at,
  });
  assert.equal(extractQuotePdfSendAttestationChallenge({ ...row, bucket_id: "public" }), null);
  assert.equal(extractQuotePdfSendAttestationChallenge({ ...row, checksum_sha256: "bad" }), null);
  assert.equal(extractQuotePdfSendAttestationChallenge({ ...row, size_bytes: 0 }), null);
  assert.equal(extractQuotePdfSendAttestationChallenge(null), null);
});
