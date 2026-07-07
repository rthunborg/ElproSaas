/**
 * Server-side entity-file reads for the UI (Story 8.2, Task 4.1) — the RLS-scoped read
 * path the entity file panels call. SERVER-ONLY (no `"use server"` action surface): plain
 * async functions invoked from server components.
 *
 * EVERY read runs on the per-request, cookie-bound RLS client (anon key — NEVER a
 * service-role key). RLS scopes every row to the caller's tenant with NO tenant id passed
 * (architecture §6); a cross-tenant owner id simply returns zero rows — the panel never
 * lists a cross-tenant file (R-810). A read fault degrades to a GENERIC error signal
 * (mirrors the CRM read-error posture), never a cross-tenant leak.
 *
 * CRITICAL (R-810): the projection NEVER returns the raw `object_path` / `bucket_id` to the
 * UI — only display-safe fields (display_name, mime_type, size_bytes, lifecycle_state,
 * created_at, file_id, link_id). A signed URL is minted separately through the 8.1
 * `createSignedFileAccess` funnel (Story 8.3 wires the panel's download), never here.
 *
 * The display name is resolved from the FILE itself (`files.display_name`), NOT from a
 * hard-coded owner_type filter — so an evidence file linked under any owner type shows its
 * real name (the epic-7 iter-2 label-degradation note, avoided here by construction).
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import type { ActiveOwnerType } from "@/server/commands/files/validation";

/** A display-safe entity file row (NO object_path / bucket_id — R-810). */
export interface EntityFileRow {
  readonly linkId: string;
  readonly fileId: string;
  readonly displayName: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly lifecycleState: string;
  readonly createdAt: string;
}

/** Result of an entity-file read — rows OR a generic error message (never a leaked detail). */
export interface EntityFilesReadResult {
  readonly files: readonly EntityFileRow[];
  readonly error: string | null;
}

const GENERIC_READ_ERROR =
  "Filerna kunde inte läsas in just nu. Försök igen om en stund.";

/** The raw joined shape PostgREST returns for a file_links → files embed. */
interface RawLinkRow {
  readonly id: string;
  readonly file_id: string;
  readonly created_at: string;
  readonly files: {
    readonly id: string;
    readonly display_name: string | null;
    readonly mime_type: string | null;
    readonly size_bytes: number | null;
    readonly lifecycle_state: string;
  } | null;
}

/**
 * Read the OWN-TENANT linked files for an entity (via `file_links` joined to `files`),
 * filtered to NON-ARCHIVED links. RLS scopes to the caller's tenant (no tenant id passed);
 * a cross-tenant owner id returns zero rows. On a query fault returns a GENERIC Swedish
 * message (never a leaked stack/SQL). NEVER returns `object_path`/`bucket_id`.
 */
export async function readEntityFiles(opts: {
  readonly ownerType: ActiveOwnerType;
  readonly ownerId: string;
}): Promise<EntityFilesReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("file_links")
      // Embed ONLY display-safe file columns — NEVER object_path / bucket_id (R-810).
      .select(
        "id, file_id, created_at, files!inner(id, display_name, mime_type, size_bytes, lifecycle_state)",
      )
      .eq("owner_type", opts.ownerType)
      .eq("owner_id", opts.ownerId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) return { files: [], error: GENERIC_READ_ERROR };

    const rows = ((data ?? []) as unknown as RawLinkRow[])
      // Drop archived/deleted files from the panel list (the link may still exist).
      .filter(
        (r) =>
          r.files !== null &&
          r.files.lifecycle_state !== "archived" &&
          r.files.lifecycle_state !== "deleted",
      )
      .map(
        (r): EntityFileRow => ({
          linkId: r.id,
          fileId: r.file_id,
          // Resolve the display name from the FILE itself (not an owner_type filter).
          displayName: r.files?.display_name ?? "Bifogad fil",
          mimeType: r.files?.mime_type ?? null,
          sizeBytes: r.files?.size_bytes ?? null,
          lifecycleState: r.files?.lifecycle_state ?? "linked",
          createdAt: r.created_at,
        }),
      );
    return { files: rows, error: null };
  } catch {
    return { files: [], error: GENERIC_READ_ERROR };
  }
}
