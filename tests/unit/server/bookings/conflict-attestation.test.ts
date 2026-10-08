import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalConflictProofBytes, CONFLICT_CLAIM_FIELDS, signConflictOutput, verifyConflictOutput,
  bookingConflictKeyFromEnv, BOOKING_CONFLICT_ENGINE_VERSION, type ConflictClaims } from "@/server/bookings/conflict-attestation";

const claims: ConflictClaims = { tenantId: "tenant", actorId: "actor", operation: "create", commandId: "command",
  bookingId: "booking", candidateDigest: "a".repeat(64), factDigest: "b".repeat(64), engineVersion: BOOKING_CONFLICT_ENGINE_VERSION,
  configVersion: "stockholm-capacity-v1", correlationId: "correlation", keyId: "synthetic",
  issuedAt: "2026-10-06T08:00:00.123456Z", expiresAt: "2026-10-06T08:02:00.123456Z" };
const output = '[{"note":"Å:🔌"}]';
const secret = "synthetic-unit-only-booking-key";
test("booking proof length prefixes UTF-8 and exact output bytes with domain separation", () => {
  const canonical = Buffer.from(canonicalConflictProofBytes(claims, output)).toString("utf8");
  assert.ok(canonical.startsWith("38:elpro.booking-conflicts.attestation.v1"));
  assert.ok(canonical.endsWith(`${Buffer.byteLength(output)}:${output}`));
  assert.equal(verifyConflictOutput(claims, output, secret, signConflictOutput(claims, output, secret)), true);
  assert.equal(verifyConflictOutput(claims, `${output} `, secret, signConflictOutput(claims, output, secret)), false);
});
for (const field of CONFLICT_CLAIM_FIELDS) test(`booking proof binds ${field}`, () => {
  const changed = { ...claims, [field]: `${claims[field]}changed` } as ConflictClaims;
  assert.equal(verifyConflictOutput(changed, output, secret, signConflictOutput(claims, output, secret)), false);
});
test("booking verifier rejects malformed signatures and a different key", () => {
  for (const signature of ["", "not-hex", "a".repeat(63), "A".repeat(64)]) assert.equal(verifyConflictOutput(claims, output, secret, signature), false);
  assert.equal(verifyConflictOutput(claims, output, "different", signConflictOutput(claims, output, secret)), false);
});
test("booking runtime signing configuration has no test fallback", () => {
  const id = process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID;
  const key = process.env.BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET;
  try {
    delete process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID; delete process.env.BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET;
    assert.throws(bookingConflictKeyFromEnv);
    process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID = "bad:key"; process.env.BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET = secret;
    assert.throws(bookingConflictKeyFromEnv);
    process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID = "unit";
    assert.deepEqual(bookingConflictKeyFromEnv(), { keyId: "unit", secret });
  } finally {
    if (id === undefined) delete process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID; else process.env.BOOKING_CONFLICT_ATTESTATION_KEY_ID = id;
    if (key === undefined) delete process.env.BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET; else process.env.BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET = key;
  }
});
