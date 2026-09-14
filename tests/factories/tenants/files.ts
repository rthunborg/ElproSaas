import { adminQuery } from "../admin-sql";
import { rethrowWithCode } from "./core";
export interface FileSeed {
  readonly tenant_id: string;
  /** An explicit file id (Story 6.3 — bind pdf_file_id to a known id); defaults to gen_random_uuid. */
  readonly id?: string;
  readonly display_name?: string;
  readonly bucket_id?: string;
  readonly object_path?: string;
  readonly mime_type?: string | null;
  readonly size_bytes?: number | null;
  readonly checksum?: string | null;
  readonly artifact_kind?: "quote_pdf" | null;
  readonly uploaded_by?: string | null;
  readonly lifecycle_state?:
    | "draft"
    | "linked"
    | "locked"
    | "archived"
    | "deleted";
}

/** A seed for a `file_links` row (parent file required, same tenant). */
export interface FileLinkSeed {
  readonly tenant_id: string;
  readonly file_id: string;
  readonly owner_type:
    | "customer"
    | "facility"
    | "contact"
    | "calculation"
    | "quote_version"
    | "quote_acceptance"
    | "job";
  readonly owner_id: string;
  readonly purpose?:
    | "calculation_attachment"
    | "quote_attachment_snapshot"
    | "quote_pdf"
    | "acceptance_evidence"
    | "job_evidence"
    | "crm_document";
}

/**
 * Seed ONE `files` row via the privileged superuser pg path (BYPASSRLS). Returns the
 * inserted id. THROWS (Postgres `code` preserved) on a DB error. The object_path
 * defaults to a SERVER-SHAPED `{tenant_id}/{uuid}/{name}` (tenant-first — the segment
 * `storage.objects` RLS keys on); a fresh uuid keeps the unique (bucket_id,
 * object_path) from colliding across seeds.
 */
export async function adminInsertFile(seed: FileSeed): Promise<string> {
  const fileId = seed.id ?? crypto.randomUUID();
  const displayName = seed.display_name ?? "tenant-file-seed.pdf";
  const objectPath =
    seed.object_path ?? `${seed.tenant_id}/${fileId}/${displayName}`;
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.files
         (id, tenant_id, bucket_id, object_path, display_name, mime_type,
          size_bytes, checksum, artifact_kind, uploaded_by, lifecycle_state)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        fileId,
        seed.tenant_id,
        seed.bucket_id ?? "tenant-files",
        objectPath,
        displayName,
        seed.mime_type ?? null,
        seed.size_bytes ?? null,
        seed.checksum ?? null,
        seed.artifact_kind ?? null,
        seed.uploaded_by ?? null,
        seed.lifecycle_state ?? "linked",
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertFile: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `file_links` row via the privileged superuser pg path (BYPASSRLS). Returns
 * the inserted id. THROWS (Postgres `code` preserved) on a DB error — including the
 * composite same-tenant FK `23503` if `file_id`'s tenant differs.
 */
export async function adminInsertFileLink(seed: FileLinkSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.file_links
         (tenant_id, file_id, owner_type, owner_id, purpose)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        seed.tenant_id,
        seed.file_id,
        seed.owner_type,
        seed.owner_id,
        seed.purpose ?? "crm_document",
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertFileLink: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Read ONE file/file_link row's label column back via the privileged superuser pg path
 * (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE negative
 * to prove the foreign row is UNCHANGED (its label was NOT overwritten by Tenant A's
 * denied UPDATE). `table`/`labelColumn` are a closed/inventory-supplied set
 * (files.display_name / file_links.purpose), never client input. Returns `null` if the
 * row does not exist.
 */
export async function adminSelectFileLabel(
  table: "files" | "file_links",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null } | null> {
  const rows = await adminQuery<{ id: string; label: string | null }>(
    `select id, ${labelColumn} as label from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote seed/read helpers (Story 6.1, Task 2/5) — ADDITIVE (B1: add ALONGSIDE the
// existing handles; the two-tenant fixture shape is unchanged).
//
// Seed REAL tenant_counters/quotes/quote_versions/quote_version_lines/
// quote_version_attachments/quote_events rows via the loopback-gated superuser `pg` pool
// (BYPASSRLS) so the cross-tenant/anon negatives can target a CONCRETE Tenant B quote row
// (never a non-existent id that would deny vacuously), and so the version/line/attachment/
// event spoof INSERTs have a real Tenant B parent to reference. Mirror `adminInsertFile`:
// THROW on a DB error with the Postgres `code` preserved.
//
// Quote tables are `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture`
// tenant-delete cascades the seeded rows away — no new teardown path is needed.
//
// Quote fixtures carry METADATA/DISPLAY SHAPE only — anonymized names, integer öre + bp,
// NO PII (no real name/address/personnummer/orgnr/secret).
// ─────────────────────────────────────────────────────────────────────────────

/** A seed for a `tenant_counters` row. */
