import { adminQuery } from "../admin-sql";
import { admin, rethrowWithCode } from "./core";
import { assertLocalStack } from "../../support/test-env";
export async function adminUploadStorageObject(seed: {
  readonly bucket: string;
  readonly objectPath: string;
  readonly body: Uint8Array;
}): Promise<void> {
  assertLocalStack();
  const { error } = await admin()
    .storage.from(seed.bucket)
    .upload(seed.objectPath, seed.body, {
      contentType: "application/octet-stream",
      upsert: true,
    });
  if (error) {
    throw new Error(
      `factory: failed to upload storage object ${seed.objectPath}: ${error.message}`,
    );
  }
}

/**
 * Remove ONE known test fixture object via the service-role Storage API. This keeps
 * cleanup on the supported storage plane instead of writing `storage.objects`
 * directly, while retaining an exact bucket/path boundary.
 */
export async function adminRemoveStorageObject(seed: {
  readonly bucket: string;
  readonly objectPath: string;
}): Promise<void> {
  assertLocalStack();
  const { error } = await admin().storage.from(seed.bucket).remove([seed.objectPath]);
  if (error) {
    throw new Error(
      `factory: failed to remove storage object ${seed.objectPath}: ${error.message}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.3 — quote-PDF storage/metadata readback helpers (BYPASSRLS via the
// superuser pg pool + the service-role storage API). Used by the 6.3-INT proofs to
// read the generated object bytes back (source-of-truth / determinism / retry) and to
// assert the files/file_links/quote_events/pdf-render-column consistency.
// ─────────────────────────────────────────────────────────────────────────────

/** Read a quote_versions row's PDF-render columns back (BYPASSRLS). */
export async function adminSelectQuoteVersionPdfColumns(
  quoteVersionId: string,
): Promise<{
  pdf_status: string | null;
  pdf_file_id: string | null;
  pdf_generated_at: string | null;
} | null> {
  const rows = await adminQuery<{
    pdf_status: string | null;
    pdf_file_id: string | null;
    pdf_generated_at: Date | string | null;
  }>(
    `select pdf_status, pdf_file_id, pdf_generated_at
       from public.quote_versions where id = $1`,
    [quoteVersionId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    pdf_status: row.pdf_status ?? null,
    pdf_file_id: row.pdf_file_id ?? null,
    pdf_generated_at:
      row.pdf_generated_at === null || row.pdf_generated_at === undefined
        ? null
        : row.pdf_generated_at instanceof Date
          ? row.pdf_generated_at.toISOString()
          : String(row.pdf_generated_at),
  };
}

/** Read the `files` rows for a stored PDF (via the version's pdf_file_id) (BYPASSRLS). */
export async function adminSelectFileById(
  fileId: string,
): Promise<{
  id: string;
  tenant_id: string;
  bucket_id: string;
  object_path: string;
  display_name: string;
  mime_type: string | null;
  checksum: string | null;
  artifact_kind: "quote_pdf" | null;
  lifecycle_state: string;
} | null> {
  const rows = await adminQuery<{
    id: string;
    tenant_id: string;
    bucket_id: string;
    object_path: string;
    display_name: string;
    mime_type: string | null;
    checksum: string | null;
    artifact_kind: "quote_pdf" | null;
    lifecycle_state: string;
  }>(
    `select id, tenant_id, bucket_id, object_path, display_name, mime_type, checksum, artifact_kind, lifecycle_state
       from public.files where id = $1`,
    [fileId],
  );
  return rows[0] ?? null;
}

/** Read the `file_links` rows for a quote-version PDF owner (BYPASSRLS). */
export async function adminSelectPdfFileLinks(
  quoteVersionId: string,
): Promise<
  {
    id: string;
    file_id: string;
    owner_type: string;
    purpose: string;
    is_locked: boolean;
    locked_at: string | null;
    archived_at: string | null;
  }[]
> {
  const rows = await adminQuery<{
    id: string;
    file_id: string;
    owner_type: string;
    purpose: string;
    is_locked: boolean;
    locked_at: Date | string | null;
    archived_at: Date | string | null;
  }>(
    `select id, file_id, owner_type, purpose, is_locked, locked_at, archived_at
       from public.file_links
      where owner_type = 'quote_version' and owner_id = $1 and purpose = 'quote_pdf'
      order by id`,
    [quoteVersionId],
  );
  return rows.map((r) => ({
    id: r.id,
    file_id: r.file_id,
    owner_type: r.owner_type,
    purpose: r.purpose,
    is_locked: r.is_locked,
    locked_at:
      r.locked_at === null || r.locked_at === undefined
        ? null
        : r.locked_at instanceof Date
          ? r.locked_at.toISOString()
          : String(r.locked_at),
    archived_at:
      r.archived_at === null || r.archived_at === undefined
        ? null
        : r.archived_at instanceof Date
          ? r.archived_at.toISOString()
          : String(r.archived_at),
  }));
}

/**
 * Read the `quote_events` rows for a quote-version (BYPASSRLS, ordered). Coerces the
 * `occurred_at` timestamptz (raw pg returns it as a `Date`) to an ISO string so a deterministic
 * injected-clock assertion (`occurred_at === FIXED_ISO`) compares by representation.
 */
export async function adminSelectQuoteEventsForVersion(
  quoteVersionId: string,
): Promise<
  {
    id: string;
    event_type: string;
    occurred_at: string;
    channel: string | null;
    reference: string | null;
  }[]
> {
  const rows = await adminQuery<{
    id: string;
    event_type: string;
    occurred_at: Date | string;
    channel: string | null;
    reference: string | null;
  }>(
    `select id, event_type, occurred_at, channel, reference from public.quote_events
      where quote_version_id = $1 order by occurred_at asc`,
    [quoteVersionId],
  );
  return rows.map((r) => ({
    id: r.id,
    event_type: r.event_type,
    occurred_at:
      r.occurred_at instanceof Date
        ? r.occurred_at.toISOString()
        : String(r.occurred_at),
    channel: r.channel ?? null,
    reference: r.reference ?? null,
  }));
}

/**
 * Download the STORED PDF object bytes for a version via its pdf_file_id → files.object_path
 * → the service-role storage API (BYPASSRLS on storage.objects). Returns the bytes, or null
 * when no file/object is present. Used by the text-extraction source-of-truth/determinism
 * proofs to read the ACTUAL uploaded object back.
 */
export async function adminSelectStoredPdfBytes(
  quoteVersionId: string,
): Promise<Uint8Array | null> {
  assertLocalStack();
  const cols = await adminSelectQuoteVersionPdfColumns(quoteVersionId);
  if (!cols?.pdf_file_id) return null;
  const file = await adminSelectFileById(cols.pdf_file_id);
  if (!file) return null;
  const { data, error } = await admin()
    .storage.from(file.bucket_id)
    .download(file.object_path);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
