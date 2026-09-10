// SERVER-ONLY. `node:crypto` makes accidental client bundling fail at build time.
// This module attests the exact response returned by caller-RLS Storage signing;
// it does not issue URLs and does not grant file access.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { quotePdfAttestationSecretFromEnv } from "@/server/quote-pdf/attestation";
import { MAX_SIGNED_URL_TTL_SECONDS } from "./signed-access";

export const FILE_SIGNED_ACCESS_ATTESTATION_DOMAIN =
  "elpro.file-signed-access.audit-attestation.v1";
export const FILE_SIGNED_ACCESS_KEY_DERIVATION_DOMAIN =
  "elpro.file-signed-access.audit-key.v1";
export const FILE_SIGNED_ACCESS_COMMAND = "file.signedAccess.create";
export const FILE_SIGNED_ACCESS_EVENT = "file.signed_access.created";
export const FILE_SIGNED_ACCESS_TARGET_TYPE = "file";
export const FILE_SIGNED_ACCESS_PURPOSE =
  "record-success-after-storage-signing";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEX_SHA256_RE = /^[0-9a-f]{64}$/;
const KEY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_MILLIS_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const DB_CLOCK_SKEW_MS = 60 * 1000;
const URL_EXPIRY_SKEW_MS = 60 * 1000;
const MAX_SIGNED_URL_LENGTH = 16 * 1024;
const MAX_TOKEN_LENGTH = 12 * 1024;

export interface FileSignedAccessAttestationPayload {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly fileId: string;
  readonly bucketId: string;
  readonly objectPath: string;
  readonly correlationId: string;
  readonly signedUrlSha256: string;
  readonly signedUrlExpiresAt: string;
  readonly keyId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface FileSignedAccessAuditChallenge {
  readonly bucketId: string;
  readonly objectPath: string;
  readonly keyId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface ValidatedSignedStorageUrl {
  readonly signedUrlSha256: string;
  /** The actual second-precision expiry carried by the Storage-signed JWT. */
  readonly expiresAt: string;
}

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
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const canonical = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    canonical.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return canonical;
}

/** Canonical bytes mirrored exactly by the private PostgreSQL payload helper. */
export function canonicalFileSignedAccessAttestationBytes(
  payload: FileSignedAccessAttestationPayload,
): Uint8Array {
  return canonicalLengthPrefixedBytes([
    FILE_SIGNED_ACCESS_ATTESTATION_DOMAIN,
    FILE_SIGNED_ACCESS_COMMAND,
    FILE_SIGNED_ACCESS_EVENT,
    FILE_SIGNED_ACCESS_TARGET_TYPE,
    FILE_SIGNED_ACCESS_PURPOSE,
    payload.tenantId,
    payload.actorUserId,
    payload.fileId,
    payload.bucketId,
    payload.objectPath,
    payload.correlationId,
    payload.signedUrlSha256,
    payload.signedUrlExpiresAt,
    payload.keyId,
    payload.issuedAt,
    payload.expiresAt,
  ]);
}

/** Derive a file-command-specific key from the already-approved quote-PDF root. */
export function deriveFileSignedAccessAttestationKey(
  rootSecret: string,
): Buffer {
  if (rootSecret.length === 0) {
    throw new Error("file signed-access attestation is not configured");
  }
  return createHmac("sha256", rootSecret)
    .update(FILE_SIGNED_ACCESS_KEY_DERIVATION_DOMAIN, "utf8")
    .digest();
}

export function signFileSignedAccessAttestation(
  payload: FileSignedAccessAttestationPayload,
  rootSecret: string,
): string {
  assertValidPayload(payload);
  return createHmac(
    "sha256",
    deriveFileSignedAccessAttestationKey(rootSecret),
  )
    .update(canonicalFileSignedAccessAttestationBytes(payload))
    .digest("hex");
}

/** Exported for server-side golden/tamper tests only. */
export function verifyFileSignedAccessAttestation(
  payload: FileSignedAccessAttestationPayload,
  rootSecret: string,
  signature: string,
): boolean {
  if (!HEX_SHA256_RE.test(signature)) return false;
  try {
    const expected = Buffer.from(
      signFileSignedAccessAttestation(payload, rootSecret),
      "hex",
    );
    const actual = Buffer.from(signature, "hex");
    return (
      expected.byteLength === actual.byteLength &&
      timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

/** Load no new credential: this closes over the existing quote-PDF HMAC root. */
export function fileSignedAccessAttestorFromEnv(): {
  readonly keyId: string;
  sign(payload: FileSignedAccessAttestationPayload): string;
} {
  const { keyId, secret } = quotePdfAttestationSecretFromEnv();
  return {
    keyId,
    sign: (payload) => signFileSignedAccessAttestation(payload, secret),
  };
}

function canonicalIsoMillis(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_MILLIS_RE.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const canonical = new Date(time).toISOString();
  return canonical === value ? canonical : null;
}

function isSafeObjectPath(
  objectPath: string,
  tenantId: string,
  fileId: string,
): boolean {
  if (
    objectPath.length === 0 ||
    Buffer.byteLength(objectPath, "utf8") > 1024 ||
    objectPath.startsWith("/") ||
    objectPath.includes("//") ||
    /[\u0000-\u001f\u007f]/.test(objectPath)
  ) {
    return false;
  }
  const segments = objectPath.split("/");
  return (
    segments.length === 3 &&
    segments[0] === tenantId &&
    segments[1] === fileId &&
    segments[2] !== "" &&
    segments.every((segment) => segment !== "." && segment !== "..")
  );
}

/**
 * Parse the one-row DB challenge and bind it back to the already-loaded file.
 * Malformed/expired challenges fail closed before Storage signing.
 */
export function parseFileSignedAccessAuditChallenge(
  data: unknown,
  expected: {
    readonly tenantId: string;
    readonly fileId: string;
    readonly bucketId: string;
    readonly objectPath: string;
    readonly keyId: string;
    readonly nowMs?: number;
  },
): FileSignedAccessAuditChallenge {
  const row = Array.isArray(data) ? data[0] : data;
  if (
    (Array.isArray(data) && data.length !== 1) ||
    !row ||
    typeof row !== "object"
  ) {
    throw new Error("file signed-access challenge is invalid");
  }
  const raw = row as Record<string, unknown>;
  const bucketId = raw.bucket_id;
  const objectPath = raw.object_path;
  const keyId = raw.attestation_key_id;
  const issuedAt = canonicalIsoMillis(raw.attestation_issued_at);
  const expiresAt = canonicalIsoMillis(raw.attestation_expires_at);
  if (
    bucketId !== expected.bucketId ||
    bucketId !== "tenant-files" ||
    objectPath !== expected.objectPath ||
    keyId !== expected.keyId ||
    typeof objectPath !== "string" ||
    typeof keyId !== "string" ||
    !KEY_ID_RE.test(keyId) ||
    !issuedAt ||
    !expiresAt ||
    !UUID_RE.test(expected.tenantId) ||
    !UUID_RE.test(expected.fileId) ||
    !isSafeObjectPath(objectPath, expected.tenantId, expected.fileId)
  ) {
    throw new Error("file signed-access challenge is invalid");
  }
  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  const nowMs = expected.nowMs ?? Date.now();
  if (
    expiresMs - issuedMs !== CHALLENGE_TTL_MS ||
    issuedMs > nowMs + DB_CLOCK_SKEW_MS ||
    expiresMs <= nowMs
  ) {
    throw new Error("file signed-access challenge is expired or invalid");
  }
  return { bucketId, objectPath, keyId, issuedAt, expiresAt };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  try {
    const decoded = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const value: unknown = JSON.parse(decoded);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Validate the exact Storage URL shape/path and read its JWT expiry. The token is
 * not treated as database-verifiable proof; the HMAC binds the hash of the whole
 * URL after this parser confirms it is the expected Storage response.
 */
export function validateSignedStorageUrl(
  signedUrl: string,
  expected: {
    readonly bucketId: string;
    readonly objectPath: string;
    readonly challengeIssuedAt: string;
    readonly computedExpiresAt: string;
    readonly nowMs?: number;
  },
): ValidatedSignedStorageUrl {
  if (
    typeof signedUrl !== "string" ||
    signedUrl.length === 0 ||
    signedUrl.length > MAX_SIGNED_URL_LENGTH
  ) {
    throw new Error("signed Storage URL is invalid");
  }
  let parsed: URL;
  try {
    parsed = new URL(signedUrl);
  } catch {
    throw new Error("signed Storage URL is invalid");
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("signed Storage URL is invalid");
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    throw new Error("signed Storage URL is invalid");
  }
  const expectedSuffix =
    `/storage/v1/object/sign/${expected.bucketId}/${expected.objectPath}`;
  if (!decodedPath.endsWith(expectedSuffix)) {
    throw new Error("signed Storage URL path is invalid");
  }

  const queryKeys = [...parsed.searchParams.keys()];
  const tokens = parsed.searchParams.getAll("token");
  if (
    queryKeys.length !== 1 ||
    queryKeys[0] !== "token" ||
    tokens.length !== 1 ||
    !tokens[0] ||
    tokens[0].length > MAX_TOKEN_LENGTH
  ) {
    throw new Error("signed Storage URL token is invalid");
  }
  const claims = decodeJwtPayload(tokens[0]);
  const expectedClaimPath = `${expected.bucketId}/${expected.objectPath}`;
  if (
    !claims ||
    claims.url !== expectedClaimPath ||
    typeof claims.exp !== "number" ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= 0
  ) {
    throw new Error("signed Storage URL token is invalid");
  }

  const issuedMs = Date.parse(expected.challengeIssuedAt);
  const computedExpiresMs = Date.parse(expected.computedExpiresAt);
  const expiresMs = claims.exp * 1000;
  const nowMs = expected.nowMs ?? Date.now();
  if (
    !Number.isFinite(issuedMs) ||
    !Number.isFinite(computedExpiresMs) ||
    expiresMs <= nowMs ||
    expiresMs <= issuedMs ||
    Math.abs(expiresMs - computedExpiresMs) > URL_EXPIRY_SKEW_MS ||
    expiresMs >
      issuedMs + MAX_SIGNED_URL_TTL_SECONDS * 1000 + URL_EXPIRY_SKEW_MS
  ) {
    throw new Error("signed Storage URL expiry is invalid");
  }

  return {
    signedUrlSha256: createHash("sha256").update(signedUrl, "utf8").digest("hex"),
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

function assertValidPayload(payload: FileSignedAccessAttestationPayload): void {
  const issuedAt = canonicalIsoMillis(payload.issuedAt);
  const expiresAt = canonicalIsoMillis(payload.expiresAt);
  const signedUrlExpiresAt = canonicalIsoMillis(payload.signedUrlExpiresAt);
  if (
    !UUID_RE.test(payload.tenantId) ||
    !UUID_RE.test(payload.actorUserId) ||
    !UUID_RE.test(payload.fileId) ||
    !UUID_RE.test(payload.correlationId) ||
    payload.bucketId !== "tenant-files" ||
    !isSafeObjectPath(payload.objectPath, payload.tenantId, payload.fileId) ||
    !HEX_SHA256_RE.test(payload.signedUrlSha256) ||
    !KEY_ID_RE.test(payload.keyId) ||
    !issuedAt ||
    !expiresAt ||
    !signedUrlExpiresAt ||
    Date.parse(expiresAt) - Date.parse(issuedAt) !== CHALLENGE_TTL_MS
  ) {
    throw new Error("file signed-access attestation payload is invalid");
  }
}
