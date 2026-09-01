import {
  createHash,
} from "node:crypto";
import {
  signQuotePdfAttestation,
} from "@/server/quote-pdf/attestation";
import { extractQuotePdfSendAttestationChallenge } from "@/server/commands/quotes/quote-db";

import {
  type TestServerClient,
} from "../factories/tenants";

/** Matches the idempotent local-only Vault fixture in supabase/seed.sql. */
export const LOCAL_TEST_QUOTE_PDF_KEY_ID = "test_v1";
export const LOCAL_TEST_QUOTE_PDF_SECRET = "local-test-only-quote-pdf-attestation-secret-v1";

export interface QuotePdfRenderProvenance {
  readonly fileId: string;
  readonly correlationId: string;
  readonly contentFingerprint: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly generationStartedAt: string;
}

export interface QuotePdfSendAttestationRpcArgs {
  readonly p_attestation_key_id: string;
  readonly p_attestation_issued_at: string;
  readonly p_attestation_expires_at: string;
  readonly p_attestation_signature: string;
}

/**
 * Drive the real Story 10.9 final-send byte proof: request a DB-issued challenge,
 * download the current private object through the authenticated client, verify its
 * immutable digest/size, and sign the same canonical payload as production.
 */
export async function quotePdfSendAttestation(input: {
  readonly client: TestServerClient;
  readonly tenantId: string;
  readonly quoteVersionId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  /** Reuse a just-issued challenge when a test also needs to assert prepare errors. */
  readonly challengeData?: unknown;
}): Promise<QuotePdfSendAttestationRpcArgs> {
  let challengeData = input.challengeData;
  if (challengeData === undefined) {
    const prepared = await input.client.rpc("prepare_quote_pdf_send_attestation", {
      p_tenant_id: input.tenantId,
      p_quote_version_id: input.quoteVersionId,
      p_actor_user_id: input.actorUserId,
      p_correlation_id: input.correlationId,
      p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
    });
    if (prepared.error) {
      throw new Error(`quotePdfSendAttestation: prepare failed (${prepared.error.code ?? "?"})`);
    }
    challengeData = prepared.data;
  }
  const challenge = extractQuotePdfSendAttestationChallenge(challengeData);
  if (challenge === null || challenge.keyId !== LOCAL_TEST_QUOTE_PDF_KEY_ID) {
    throw new Error("quotePdfSendAttestation: incomplete challenge response");
  }
  const download = await input.client.storage
    .from(challenge.bucketId)
    .download(challenge.objectPath);
  if (download.error || download.data === null) {
    throw new Error("quotePdfSendAttestation: Storage download failed");
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== challenge.sizeBytes || checksum !== challenge.checksumSha256) {
    throw new Error("quotePdfSendAttestation: downloaded bytes do not match immutable metadata");
  }
  return {
    p_attestation_key_id: challenge.keyId,
    p_attestation_issued_at: challenge.issuedAt,
    p_attestation_expires_at: challenge.expiresAt,
    p_attestation_signature: signQuotePdfAttestation({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      quoteVersionId: input.quoteVersionId,
      renderFileId: challenge.fileId,
      contentFingerprint: challenge.contentFingerprint,
      bucketId: challenge.bucketId,
      objectPath: challenge.objectPath,
      checksumSha256: challenge.checksumSha256,
      sizeBytes: challenge.sizeBytes,
      mimeType: challenge.mimeType,
      correlationId: input.correlationId,
      keyId: challenge.keyId,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      generationStartedAt: challenge.generationStartedAt,
    }, LOCAL_TEST_QUOTE_PDF_SECRET),
  };
}

export async function startQuotePdfRender(input: {
  readonly client: TestServerClient;
  readonly tenantId: string;
  readonly quoteVersionId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}): Promise<QuotePdfRenderProvenance> {
  const started = await input.client.rpc("start_quote_pdf_render", {
    p_tenant_id: input.tenantId,
    p_quote_version_id: input.quoteVersionId,
    p_actor_user_id: input.actorUserId,
    p_correlation_id: input.correlationId,
    p_started_at: input.occurredAt,
    p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
  });
  if (started.error) throw new Error(`startQuotePdfRender: failed (${started.error.code ?? "?"})`);
  const row = (Array.isArray(started.data) ? started.data[0] : started.data) as Record<string, unknown> | null;
  if (!row || typeof row.expected_file_id !== "string" || typeof row.render_fingerprint !== "string"
      || typeof row.attestation_issued_at !== "string" || typeof row.attestation_expires_at !== "string"
      || typeof row.generation_started_at !== "string") {
    throw new Error("startQuotePdfRender: incomplete provenance response");
  }
  return {
    fileId: row.expected_file_id,
    correlationId: input.correlationId,
    contentFingerprint: row.render_fingerprint,
    issuedAt: row.attestation_issued_at,
    expiresAt: row.attestation_expires_at,
    generationStartedAt: row.generation_started_at,
  };
}

export function quotePdfCompletionAttestation(input: {
  readonly provenance: QuotePdfRenderProvenance;
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly quoteVersionId: string;
  readonly objectPath: string;
  readonly checksumSha256: string;
  readonly sizeBytes: number;
  readonly mimeType?: string;
}): {
  readonly p_attestation_key_id: string;
  readonly p_attestation_issued_at: string;
  readonly p_attestation_expires_at: string;
  readonly p_attestation_signature: string;
} {
  const mimeType = input.mimeType ?? "application/pdf";
  return {
    p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
    p_attestation_issued_at: input.provenance.issuedAt,
    p_attestation_expires_at: input.provenance.expiresAt,
    p_attestation_signature: signQuotePdfAttestation({
      tenantId: input.tenantId, actorUserId: input.actorUserId,
      quoteVersionId: input.quoteVersionId, renderFileId: input.provenance.fileId,
      contentFingerprint: input.provenance.contentFingerprint, bucketId: "tenant-files",
      objectPath: input.objectPath, checksumSha256: input.checksumSha256,
      sizeBytes: input.sizeBytes, mimeType, correlationId: input.provenance.correlationId,
      keyId: LOCAL_TEST_QUOTE_PDF_KEY_ID, issuedAt: input.provenance.issuedAt,
      expiresAt: input.provenance.expiresAt, generationStartedAt: input.provenance.generationStartedAt,
    }, LOCAL_TEST_QUOTE_PDF_SECRET),
  };
}

/**
 * Establish a database-valid current PDF for integration tests whose subject is a
 * later quote transition, not rendering. The helper drives the real authenticated
 * Story 10.9 start/complete RPCs and creates an actual Storage object plus matching
 * metadata/checksum; PDF-byte tests continue to use `generateQuotePdf` itself.
 */
export async function establishCurrentQuotePdf(input: {
  readonly client: TestServerClient;
  readonly tenantId: string;
  readonly quoteVersionId: string;
  readonly actorUserId: string;
  readonly occurredAt: string;
  readonly correlationId?: string;
}): Promise<{ readonly fileId: string; readonly correlationId: string }> {
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const provenance = await startQuotePdfRender({
    client: input.client, tenantId: input.tenantId, quoteVersionId: input.quoteVersionId,
    actorUserId: input.actorUserId, correlationId, occurredAt: input.occurredAt,
  });
  const fileId = provenance.fileId;

  const bytes = new TextEncoder().encode("current-quote.pdf");
  const displayName = "current-quote.pdf";
  const objectPath = `${input.tenantId}/${fileId}/${displayName}`;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  // Mirror production ordering: reserve the exact identity and digest before the
  // first non-upserting Storage write, so no replacement window exists.
  const reserved = await input.client.rpc("reserve_quote_pdf_file", {
    p_tenant_id: input.tenantId,
    p_quote_version_id: input.quoteVersionId,
    p_file_id: fileId,
    p_object_path: objectPath,
    p_display_name: displayName,
    p_size_bytes: bytes.byteLength,
    p_checksum: checksum,
    p_actor_user_id: input.actorUserId,
  });
  if (reserved.error) {
    throw new Error(`establishCurrentQuotePdf: reservation failed (${reserved.error.code ?? "?"})`);
  }
  if (reserved.data !== fileId) {
    throw new Error("establishCurrentQuotePdf: reservation returned an unexpected file id");
  }
  const upload = await input.client.storage
    .from("tenant-files")
    .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
  if (upload.error) {
    throw new Error(`establishCurrentQuotePdf: Storage upload failed (${upload.error.message ?? "?"})`);
  }

  const completed = await input.client.rpc("complete_quote_pdf_render", {
    p_tenant_id: input.tenantId,
    p_quote_version_id: input.quoteVersionId,
    p_file_id: fileId,
    p_generated_at: input.occurredAt,
    p_actor_user_id: input.actorUserId,
    p_correlation_id: correlationId,
    ...quotePdfCompletionAttestation({
      provenance, tenantId: input.tenantId, actorUserId: input.actorUserId,
      quoteVersionId: input.quoteVersionId, objectPath, checksumSha256: checksum,
      sizeBytes: bytes.byteLength,
    }),
  });
  if (completed.error) {
    throw new Error(
      `establishCurrentQuotePdf: completion failed (${completed.error.code ?? "?"})`,
    );
  }
  return { fileId, correlationId };
}
