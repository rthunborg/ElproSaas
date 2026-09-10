/** Quote-scoped signed access preserves generic Files.View boundaries. */
import { defineCommand, type CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";
import { fileSignedAccessAttestorFromEnv, parseFileSignedAccessAuditChallenge, validateSignedStorageUrl } from "@/server/storage/signed-access-attestation";
import { signValidatedQuotePdfForAccess } from "@/server/storage/quote-pdf-signer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface QuotePdfSignedAccessInput { readonly quote_version_id: string; readonly file_id: string; }
export interface QuotePdfSignedAccessResult { readonly targetId: string; readonly signedUrl: string; readonly expiresAt: string; }

type RpcClient = { rpc(name: string, values: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string } | null }>; };

function validateQuotePdfSignedAccess(raw: unknown): { readonly ok: true; readonly data: QuotePdfSignedAccessInput } | { readonly ok: false; readonly code: "VALIDATION_FAILED" } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "VALIDATION_FAILED" };
  const value = raw as Record<string, unknown>;
  if (typeof value.quote_version_id !== "string" || typeof value.file_id !== "string" || !UUID_RE.test(value.quote_version_id) || !UUID_RE.test(value.file_id)) return { ok: false, code: "VALIDATION_FAILED" };
  return { ok: true, data: { quote_version_id: value.quote_version_id, file_id: value.file_id } };
}

async function rpc(db: CommandDbClient, name: string, values: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await (db as unknown as RpcClient).rpc(name, values);
  if (error) {
    if (error.code === "42501") throw new CommandError("TENANT_ACCESS_DENIED");
    if (error.code === "FSA10") throw new CommandError("FILE_ACCESS_DENIED");
    throw new Error(`quote PDF signed access ${name} failed: ${error.code ?? "?"}`);
  }
  return data;
}

export const createQuotePdfSignedAccess = defineCommand<QuotePdfSignedAccessInput, QuotePdfSignedAccessResult>({
  command: "quote.pdf.signedAccess.create",
  auditable: false,
  eventType: "quote.pdf.signed_access.created",
  targetType: "quote_version",
  validateInput: validateQuotePdfSignedAccess,
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<QuotePdfSignedAccessResult> => {
    const attestor = fileSignedAccessAttestorFromEnv();
    const challengeData = await rpc(ctx.db, "prepare_quote_pdf_signed_access_audit_attestation", {
      p_tenant_id: ctx.tenantContext.tenantId, p_actor_user_id: ctx.tenantContext.userId,
      p_quote_version_id: ctx.input.quote_version_id, p_file_id: ctx.input.file_id,
      p_correlation_id: ctx.correlationId, p_attestation_key_id: attestor.keyId,
    });
    const raw = Array.isArray(challengeData) ? challengeData[0] : challengeData;
    const objectPath = raw && typeof raw === "object" ? (raw as Record<string, unknown>).object_path : undefined;
    if (typeof objectPath !== "string") throw new Error("quote PDF signed-access challenge is invalid");
    const challenge = parseFileSignedAccessAuditChallenge(challengeData, {
      tenantId: ctx.tenantContext.tenantId, fileId: ctx.input.file_id,
      bucketId: "tenant-files", objectPath, keyId: attestor.keyId,
    });
    // This is intentionally not the request-bound generic file signer. The database
    // challenge has already bound this exact generated, linked, non-archived quote PDF
    // to the caller; the server-only broker avoids granting Säljare persistent raw
    // storage SELECT/list/download/sign capability.
    const signed = await signValidatedQuotePdfForAccess({
      bucket: "tenant-files", objectPath: challenge.objectPath, nowIso: challenge.issuedAt,
    });
    if (signed === null) throw new CommandError("FILE_ACCESS_DENIED");
    const validatedUrl = validateSignedStorageUrl(signed.signedUrl, {
      bucketId: challenge.bucketId, objectPath: challenge.objectPath,
      challengeIssuedAt: challenge.issuedAt, computedExpiresAt: signed.expiresAt,
    });
    const attestation = {
      tenantId: ctx.tenantContext.tenantId, actorUserId: ctx.tenantContext.userId,
      fileId: ctx.input.file_id, bucketId: challenge.bucketId, objectPath: challenge.objectPath,
      correlationId: ctx.correlationId, signedUrlSha256: validatedUrl.signedUrlSha256,
      signedUrlExpiresAt: validatedUrl.expiresAt, keyId: challenge.keyId,
      issuedAt: challenge.issuedAt, expiresAt: challenge.expiresAt,
    } as const;
    await rpc(ctx.db, "record_quote_pdf_signed_access_audit_attested", {
      p_tenant_id: attestation.tenantId, p_actor_user_id: attestation.actorUserId,
      p_quote_version_id: ctx.input.quote_version_id, p_file_id: attestation.fileId,
      p_bucket_id: attestation.bucketId, p_object_path: attestation.objectPath,
      p_correlation_id: attestation.correlationId, p_signed_url_sha256: attestation.signedUrlSha256,
      p_signed_url_expires_at: attestation.signedUrlExpiresAt, p_attestation_key_id: attestation.keyId,
      p_attestation_issued_at: attestation.issuedAt, p_attestation_expires_at: attestation.expiresAt,
      p_attestation_signature: attestor.sign(attestation),
    });
    return { targetId: ctx.input.quote_version_id, signedUrl: signed.signedUrl, expiresAt: validatedUrl.expiresAt };
  },
});
