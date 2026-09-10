import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  FILE_SIGNED_ACCESS_ATTESTATION_DOMAIN,
  FILE_SIGNED_ACCESS_KEY_DERIVATION_DOMAIN,
  canonicalFileSignedAccessAttestationBytes,
  deriveFileSignedAccessAttestationKey,
  parseFileSignedAccessAuditChallenge,
  signFileSignedAccessAttestation,
  validateSignedStorageUrl,
  verifyFileSignedAccessAttestation,
  type FileSignedAccessAttestationPayload,
} from "@/server/storage/signed-access-attestation";

const ROOT_SECRET = "local-test-only-quote-pdf-attestation-secret-v1";
const ISSUED_AT = "2030-01-02T03:04:05.678Z";
const CHALLENGE_EXPIRES_AT = "2030-01-02T03:09:05.678Z";
const URL_EXPIRES_AT = "2030-01-02T03:09:06.000Z";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "00000000-0000-4000-8000-000000000002";
const FILE_ID = "00000000-0000-4000-8000-000000000003";
const CORRELATION_ID = "00000000-0000-4000-8000-000000000004";
const OBJECT_PATH = `${TENANT_ID}/${FILE_ID}/evidence.pdf`;

const payload: FileSignedAccessAttestationPayload = {
  tenantId: TENANT_ID,
  actorUserId: ACTOR_ID,
  fileId: FILE_ID,
  bucketId: "tenant-files",
  objectPath: OBJECT_PATH,
  correlationId: CORRELATION_ID,
  signedUrlSha256: "a".repeat(64),
  signedUrlExpiresAt: URL_EXPIRES_AT,
  keyId: "test_v1",
  issuedAt: ISSUED_AT,
  expiresAt: CHALLENGE_EXPIRES_AT,
};

function storageJwt(claims: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    Buffer.from("test-signature").toString("base64url"),
  ].join(".");
}

function signedUrl(overrides: Record<string, unknown> = {}): string {
  const token = storageJwt({
    url: `tenant-files/${OBJECT_PATH}`,
    exp: Date.parse(URL_EXPIRES_AT) / 1000,
    ...overrides,
  });
  return `https://example.supabase.co/storage/v1/object/sign/tenant-files/${OBJECT_PATH}?token=${token}`;
}

test("[11.2][P0] file signed-access canonical bytes and derived-key HMAC are stable", () => {
  const bytes = Buffer.from(
    canonicalFileSignedAccessAttestationBytes(payload),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "87586226a1a8a60b6512313e8008c932187ec8c44260897f822649f18d356ffb",
  );
  assert.equal(
    deriveFileSignedAccessAttestationKey(ROOT_SECRET).toString("hex"),
    "d6e0ba1afcc0d7b8d5b0151bd06f0d779147c3e8d5d5b6821e763a3f4ffda7ed",
  );
  assert.equal(
    signFileSignedAccessAttestation(payload, ROOT_SECRET),
    "e9b911994009945d5c197c18f913fb67e657b4a31d333d7c49f8f4a2a2e966d3",
  );
});

test("[11.2][P0] every actor/tenant/file/URL/correlation/time binding rejects tampering", () => {
  const signature = signFileSignedAccessAttestation(payload, ROOT_SECRET);
  assert.equal(
    verifyFileSignedAccessAttestation(payload, ROOT_SECRET, signature),
    true,
  );

  const mutations: FileSignedAccessAttestationPayload[] = [
    { ...payload, tenantId: "00000000-0000-4000-8000-000000000010" },
    { ...payload, actorUserId: "00000000-0000-4000-8000-000000000011" },
    {
      ...payload,
      fileId: "00000000-0000-4000-8000-000000000012",
      objectPath: `${TENANT_ID}/00000000-0000-4000-8000-000000000012/evidence.pdf`,
    },
    { ...payload, bucketId: "other-bucket" },
    { ...payload, objectPath: `${TENANT_ID}/${FILE_ID}/other.pdf` },
    { ...payload, correlationId: "00000000-0000-4000-8000-000000000013" },
    { ...payload, signedUrlSha256: "b".repeat(64) },
    { ...payload, signedUrlExpiresAt: "2030-01-02T03:09:07.000Z" },
    { ...payload, keyId: "test_v2" },
    {
      ...payload,
      issuedAt: "2030-01-02T03:04:04.678Z",
      expiresAt: "2030-01-02T03:09:04.678Z",
    },
    { ...payload, expiresAt: "2030-01-02T03:09:04.678Z" },
  ];
  for (const mutated of mutations) {
    assert.equal(
      verifyFileSignedAccessAttestation(mutated, ROOT_SECRET, signature),
      false,
    );
  }
  assert.equal(
    verifyFileSignedAccessAttestation(payload, `${ROOT_SECRET}-wrong`, signature),
    false,
  );
  assert.equal(verifyFileSignedAccessAttestation(payload, ROOT_SECRET, "0"), false);
});

test("[11.2][P0] file subkey/domain cannot validate a quote-domain HMAC", () => {
  const fileSignature = signFileSignedAccessAttestation(payload, ROOT_SECRET);
  const quoteDomainSignature = createHmac("sha256", ROOT_SECRET)
    .update(
      Buffer.concat([
        Buffer.from(`${FILE_SIGNED_ACCESS_ATTESTATION_DOMAIN.length}:`),
        Buffer.from(FILE_SIGNED_ACCESS_ATTESTATION_DOMAIN),
      ]),
    )
    .digest("hex");
  assert.notEqual(fileSignature, quoteDomainSignature);
  assert.notEqual(
    FILE_SIGNED_ACCESS_ATTESTATION_DOMAIN,
    FILE_SIGNED_ACCESS_KEY_DERIVATION_DOMAIN,
  );
});

test("[11.2][P0] challenge parser binds the one DB row to the loaded file and DB time", () => {
  const row = {
    bucket_id: "tenant-files",
    object_path: OBJECT_PATH,
    attestation_key_id: "test_v1",
    attestation_issued_at: ISSUED_AT,
    attestation_expires_at: CHALLENGE_EXPIRES_AT,
  };
  assert.deepEqual(
    parseFileSignedAccessAuditChallenge([row], {
      tenantId: TENANT_ID,
      fileId: FILE_ID,
      bucketId: "tenant-files",
      objectPath: OBJECT_PATH,
      keyId: "test_v1",
      nowMs: Date.parse(ISSUED_AT),
    }),
    {
      bucketId: "tenant-files",
      objectPath: OBJECT_PATH,
      keyId: "test_v1",
      issuedAt: ISSUED_AT,
      expiresAt: CHALLENGE_EXPIRES_AT,
    },
  );

  for (const invalid of [
    [],
    [row, row],
    [{ ...row, bucket_id: "other" }],
    [{ ...row, object_path: `${TENANT_ID}/../evidence.pdf` }],
    [{ ...row, attestation_key_id: "bad key" }],
    [{ ...row, attestation_issued_at: "2030-01-02 03:04:05Z" }],
    [{ ...row, attestation_expires_at: "2030-01-02T03:10:05.678Z" }],
  ]) {
    assert.throws(() =>
      parseFileSignedAccessAuditChallenge(invalid, {
        tenantId: TENANT_ID,
        fileId: FILE_ID,
        bucketId: "tenant-files",
        objectPath: OBJECT_PATH,
        keyId: "test_v1",
        nowMs: Date.parse(ISSUED_AT),
      }),
    );
  }
  assert.throws(() =>
    parseFileSignedAccessAuditChallenge([row], {
      tenantId: TENANT_ID,
      fileId: FILE_ID,
      bucketId: "tenant-files",
      objectPath: OBJECT_PATH,
      keyId: "test_v1",
      nowMs: Date.parse(CHALLENGE_EXPIRES_AT),
    }),
  );
});

test("[11.2][P0] URL parser binds path, token claim, exact URL hash, and actual expiry", () => {
  const url = signedUrl();
  assert.deepEqual(
    validateSignedStorageUrl(url, {
      bucketId: "tenant-files",
      objectPath: OBJECT_PATH,
      challengeIssuedAt: ISSUED_AT,
      computedExpiresAt: CHALLENGE_EXPIRES_AT,
      nowMs: Date.parse(ISSUED_AT),
    }),
    {
      signedUrlSha256: createHash("sha256").update(url).digest("hex"),
      expiresAt: URL_EXPIRES_AT,
    },
  );

  const wrongPath = signedUrl().replace("evidence.pdf", "other.pdf");
  const duplicateToken = `${signedUrl()}&token=${storageJwt({})}`;
  const expired = signedUrl({ exp: Date.parse(ISSUED_AT) / 1000 });
  const wrongClaim = signedUrl({ url: `tenant-files/${TENANT_ID}/${FILE_ID}/other.pdf` });
  const overlong = `https://example.supabase.co/${"x".repeat(17_000)}`;
  for (const invalid of [wrongPath, duplicateToken, expired, wrongClaim, overlong]) {
    assert.throws(() =>
      validateSignedStorageUrl(invalid, {
        bucketId: "tenant-files",
        objectPath: OBJECT_PATH,
        challengeIssuedAt: ISSUED_AT,
        computedExpiresAt: CHALLENGE_EXPIRES_AT,
        nowMs: Date.parse(ISSUED_AT),
      }),
    );
  }
});

function allTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) return allTypeScriptFiles(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

test("[11.2][P0] HMAC helper remains mechanically server-only and absent from client roots", () => {
  const modulePath = resolve(
    process.cwd(),
    "src/server/storage/signed-access-attestation.ts",
  );
  const source = readFileSync(modulePath, "utf8");
  assert.match(source, /from "node:crypto"/);
  assert.doesNotMatch(source, /"use client"/);

  for (const file of allTypeScriptFiles(resolve(process.cwd(), "src"))) {
    const candidate = readFileSync(file, "utf8");
    if (!/^\s*["']use client["'];/m.test(candidate)) continue;
    assert.doesNotMatch(
      candidate,
      /server\/storage\/signed-access-attestation/,
      `${file} must not import the server-only HMAC helper`,
    );
  }
});
