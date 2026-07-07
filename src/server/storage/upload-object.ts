/**
 * The SHARED object-byte upload helper (Story 8.2, Task 3.3; the 6.3→8.2 shared-helper
 * reconcile; architecture §6, §12; R-807/R-811/R-814).
 *
 * Extracts the 6.3 PDF pipeline's PROVEN "id-up-front → object write → verified-compensated
 * metadata" ordering into ONE reusable seam BOTH the generic `uploadFile` command (this
 * story) and — later, optionally — the 6.3 PDF path can share. 6.3 broke ground on the
 * object-byte upload via a DIRECT explicit-id RLS insert (because `create_file_with_link`
 * self-allocates the id and does no MIME/size validation, so it cannot bind the object-path
 * id up front). 8.2 reuses THAT approach — this helper is the extracted shape, NOT a new
 * mechanism.
 *
 * ── ORDERING (the 6.3 canonical sequence, verbatim) ──────────────────────────────────
 *   (a) the file id is generated UP FRONT (by the caller) so the object path binds to it;
 *   (b) `deriveObjectPath({ tenantId, fileId, displayName })` — tenant-first, sanitized,
 *       NEVER a client path;
 *   (c) `.storage.from(bucket).upload(objectPath, bytes, { contentType, upsert:true })` on
 *       the CALLER's request-bound RLS client (NEVER service-role) — a storage fault is a
 *       TRANSIENT SERVER_ERROR (retryable), never a permanent denial;
 *   (d) INSERT the `files` metadata row with the EXPLICIT id + object_path + lifecycle
 *       'linked' (the caller supplies the row via `insertFileRow`);
 *   (e) INSERT the `file_links` row (the caller supplies it via `insertLinkRow`).
 *
 * ── VERIFIED-COMPENSATED CONSISTENCY (AC4, R-807 storage side) ────────────────────────
 * A metadata-write failure AFTER a successful object upload must NOT leave a usable
 * `files`/`file_links` row over the object (nor a stored object silently usable with no
 * metadata). On such a fault this helper best-effort compensates — the ARCHIVE-over-delete
 * discipline stands: 8.1 has NO object-reclamation path, so the orphaned OBJECT is
 * left/archived, never hard-deleted; a `files` row (if it was written before a LATER
 * failure) is archived (`lifecycle_state='archived'`) so no committed-usable row points at
 * it. The original error is re-thrown so the caller surfaces a retryable SERVER_ERROR
 * (never a false success). A subsequent retry writes a FRESH id/path and succeeds.
 */
import { deriveObjectPath } from "@/server/storage/object-path";

/** The private bucket every Phase A file lives in (single private bucket). */
export const TENANT_FILES_BUCKET = "tenant-files";

/** The minimal storage-write surface the helper drives on the caller's RLS client. */
export interface UploadStorageClient {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        options: { contentType?: string; upsert?: boolean },
      ): Promise<{ data: unknown; error: { message?: string } | null }>;
    };
  };
}

/** The outcome of a successful object+metadata write. */
export interface UploadObjectResult {
  readonly fileId: string;
  readonly objectPath: string;
  readonly linkId: string;
}

/** Input to {@link uploadObjectWithMetadata}. */
export interface UploadObjectInput<Client extends UploadStorageClient> {
  /** The caller's request-bound RLS client (anon key — NEVER service-role). */
  readonly client: Client;
  /** The RESOLVED tenant id (ctx.tenantContext.tenantId) — NEVER client input. */
  readonly tenantId: string;
  /** The server-generated file id (bound to the object path). */
  readonly fileId: string;
  /** The presentational display name (sanitized into the path's third segment). */
  readonly displayName: string;
  /** The validated MIME type (on the Task-1 allow-list). */
  readonly mimeType: string;
  /** The upload bytes. */
  readonly bytes: Uint8Array;
  /**
   * Insert the `files` metadata row with the EXPLICIT id + object_path (own-tenant RLS
   * WITH CHECK). Returns nothing on success; THROWS a mapped CommandError / plain Error on
   * failure (the helper will compensate + re-throw). The caller owns the exact columns +
   * error mapping (so the domain command keeps its `throwMappedFileWriteError` wiring).
   */
  readonly insertFileRow: (objectPath: string) => Promise<void>;
  /**
   * Insert (or find-or-create) the `file_links` row pointing at the verified file. Returns
   * the created/existing link id; THROWS on failure.
   */
  readonly insertLinkRow: (fileId: string) => Promise<string>;
  /**
   * Best-effort ARCHIVE of a `files` row that WAS written before a LATER failure (so no
   * committed-usable row survives). Called only in the compensation path; must swallow its
   * own secondary faults. The orphaned OBJECT is left/archived — 8.1 has no reclamation.
   */
  readonly archiveFileRow?: (fileId: string) => Promise<void>;
}

/**
 * Write the private object then persist its metadata + link with verified-compensated
 * consistency. The file id is passed in (generated up front so the object path binds it).
 *
 * On ANY fault after the object write, best-effort compensates (archives a written `files`
 * row so no usable orphan remains; the object is left/archived — archive-over-delete) and
 * re-throws the ORIGINAL error so the caller maps it to a retryable SERVER_ERROR — never a
 * false success, never a permanent denial for a transient fault.
 */
export async function uploadObjectWithMetadata<Client extends UploadStorageClient>(
  input: UploadObjectInput<Client>,
): Promise<UploadObjectResult> {
  const objectPath = deriveObjectPath({
    tenantId: input.tenantId,
    fileId: input.fileId,
    displayName: input.displayName,
  });

  // (c) Upload the private object on the caller's RLS client. `upsert:true` so a retry
  // re-writing the same (fresh-id) path is idempotent. storage.objects RLS re-checks the
  // tenant path prefix — a cross-tenant / spoof path is denied at the DB.
  const upload = await input.client.storage
    .from(TENANT_FILES_BUCKET)
    .upload(objectPath, input.bytes, {
      contentType: input.mimeType,
      upsert: true,
    });
  if (upload.error) {
    // A storage fault is TRANSIENT — surface as a plain Error (→ SERVER_ERROR, retryable),
    // never a permanent denial. Nothing has been persisted yet, so nothing to compensate.
    throw new Error(`file upload failed: ${upload.error.message ?? "?"}`);
  }

  // The object is now stored. From here a metadata failure must leave a CONSISTENT,
  // retryable state — NO committed-usable files/file_links row over the object.
  let fileRowWritten = false;
  try {
    // (d) INSERT the files metadata row (explicit id = the object-path segment).
    await input.insertFileRow(objectPath);
    fileRowWritten = true;
    // (e) INSERT (or find-or-create) the file_links row pointing at the verified file.
    const linkId = await input.insertLinkRow(input.fileId);
    return { fileId: input.fileId, objectPath, linkId };
  } catch (error) {
    // VERIFIED-COMPENSATED: the files row was written (link insert failed) → ARCHIVE it so
    // no usable row points at the object. The orphaned OBJECT is left/archived (8.1 has no
    // reclamation — a retention story owns cleanup). Best-effort; swallow a secondary fault.
    if (fileRowWritten && input.archiveFileRow) {
      try {
        await input.archiveFileRow(input.fileId);
      } catch {
        // Swallow: the ORIGINAL error is what the caller must see (never a false success).
      }
    }
    throw error;
  }
}
