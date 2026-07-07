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
import {
  ACTIVE_OWNER_TYPES,
  type OwnerType,
} from "@/server/commands/files/validation";
import {
  ownerCategoryLabel,
  type FileIndexRow,
} from "./file-index";

export type { FileIndexRow } from "./file-index";

/** A display-safe entity file row (NO object_path / bucket_id — R-810). */
export interface EntityFileRow {
  readonly linkId: string;
  readonly fileId: string;
  readonly displayName: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly lifecycleState: string;
  /**
   * The AUTHORITATIVE applied lock from the DB (`file_links.is_locked`, set by the 8.4 trigger
   * `apply_file_link_lock`). The panel renders a lock notice + archive-only affordance when true —
   * a UX convenience over the DB truth, NEVER the guarantee (R-812; the command `FILE_LINK_LOCKED`
   * + the `FL823` trigger are).
   */
  readonly isLocked: boolean;
  readonly createdAt: string;
}

/** Result of an entity-file read — rows OR a generic error message (never a leaked detail). */
export interface EntityFilesReadResult {
  readonly files: readonly EntityFileRow[];
  readonly error: string | null;
}

/** Result of the limited file-index read — display-safe rows OR a generic error (never a leak). */
export interface FileIndexReadResult {
  readonly rows: readonly FileIndexRow[];
  readonly error: string | null;
}

const GENERIC_READ_ERROR =
  "Filerna kunde inte läsas in just nu. Försök igen om en stund.";

/** The raw joined shape PostgREST returns for a file_links → files embed. */
interface RawLinkRow {
  readonly id: string;
  readonly file_id: string;
  readonly is_locked: boolean | null;
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
  // A READ owner type — any Phase A owner type (reads are RLS-scoped regardless of command-layer
  // active-owner status; `quote_version` is read-only-listable here for the sent-quote lock panel).
  readonly ownerType: OwnerType;
  readonly ownerId: string;
}): Promise<EntityFilesReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("file_links")
      // Embed ONLY display-safe file columns — NEVER object_path / bucket_id (R-810). `is_locked` is
      // the LINK-side applied lock (8.4) — display-safe, needed for the panel lock notice (Task 2.1).
      .select(
        "id, file_id, is_locked, created_at, files!inner(id, display_name, mime_type, size_bytes, lifecycle_state)",
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
          // The applied lock is the LINK's is_locked (8.4 authoritative), OR the file being in the
          // 'locked' lifecycle state (the companion flip) — either is a locked commitment file.
          isLocked:
            r.is_locked === true || r.files?.lifecycle_state === "locked",
          createdAt: r.created_at,
        }),
      );
    return { files: rows, error: null };
  } catch {
    return { files: [], error: GENERIC_READ_ERROR };
  }
}

/** The raw joined shape PostgREST returns for the index file_links → files embed (cross owner types). */
interface RawIndexLinkRow {
  readonly id: string;
  readonly file_id: string;
  readonly owner_type: string;
  readonly owner_id: string;
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
 * The minimal RLS-client read surface the file-index read drives (structurally satisfied by the real
 * `@supabase/ssr` server client AND the test anon-key client) — so the INT/RLS suite can inject its
 * own authed anon-key client and exercise the REAL read (including the JS lifecycle-drop), mirroring
 * `readJobList`'s injectable form.
 */
export type FileIndexReadClient = {
  from(table: string): {
    select(columns: string): {
      in(
        column: string,
        values: readonly string[],
      ): {
        is(
          column: string,
          value: null,
        ): {
          order(
            column: string,
            opts: { ascending: boolean },
          ): Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
  };
};

/**
 * The LIMITED `Filer` index read (Story 8.5, Task 1.1; AC1/AC3; R-801/R-810/R-816) — a SIBLING of
 * `readEntityFiles`, NOT a new file/model (R-814). Reads the tenant's OWN non-archived
 * `file_links` → `files` across the Phase A owner types ONLY (`ACTIVE_OWNER_TYPES` — the single
 * source of truth), on the per-request cookie-bound RLS client (anon key — NEVER service-role).
 * RLS scopes every row to the caller's tenant with NO tenant id passed; a cross-tenant row is
 * simply never returned (architecture §6). Archived/deleted files are dropped (both the LINK's
 * `archived_at` at the SQL layer AND the FILE's `archived`/`deleted` lifecycle state in JS).
 *
 * Returns display-safe `FileIndexRow[]` (NEVER `object_path`/`bucket_id` — R-810) each mapped to a
 * fixed Swedish OWNER-CATEGORY label (over the ACTIVE set ONLY, never a deferred module — R-816). On
 * a query fault returns `{ rows: [], error: GENERIC_READ_ERROR }` (mirrors `readEntityFiles`).
 *
 * The `injectedClient` form (used by the INT/RLS isolation proof) lets a test pass its own authed
 * RLS-bound client; the page-facing form constructs the per-request cookie-bound RLS client.
 *
 * NOTE: filtering/search is CLIENT-SIDE in-memory over these server-fetched rows (the thin Phase-A
 * index pattern, mirroring `JobList`) — the read fetches the whole own-tenant set, RLS-scoped.
 */
export async function readFileIndex(
  injectedClient?: FileIndexReadClient,
): Promise<FileIndexReadResult> {
  try {
    const client =
      injectedClient ??
      ((await createSupabaseServerClient()) as unknown as FileIndexReadClient);
    const { data, error } = await client
      .from("file_links")
      // Display-safe projection ONLY — NEVER object_path / bucket_id (R-810).
      .select(
        "id, file_id, owner_type, owner_id, created_at, files!inner(id, display_name, mime_type, size_bytes, lifecycle_state)",
      )
      // The Phase A owner set ONLY — a cross-owner-type read filtered to the ACTIVE owner types (the
      // single source of truth). A deferred-module owner type can never appear (R-816).
      .in("owner_type", ACTIVE_OWNER_TYPES as unknown as string[])
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) return { rows: [], error: GENERIC_READ_ERROR };

    const rows = ((data ?? []) as unknown as RawIndexLinkRow[])
      // Drop archived/deleted files from the index (the link may still exist).
      .filter(
        (r) =>
          r.files !== null &&
          r.files.lifecycle_state !== "archived" &&
          r.files.lifecycle_state !== "deleted",
      )
      // Keep ONLY rows whose owner_type has a Phase A category label (fail-closed — a stray owner
      // type without a category is never surfaced; the .in() filter already scopes to the ACTIVE set).
      .map((r): FileIndexRow | null => {
        const category = ownerCategoryLabel(r.owner_type);
        if (category === null) return null;
        return {
          linkId: r.id,
          fileId: r.file_id,
          ownerType: r.owner_type,
          ownerId: r.owner_id,
          displayName: r.files?.display_name ?? "Bifogad fil",
          mimeType: r.files?.mime_type ?? null,
          sizeBytes: r.files?.size_bytes ?? null,
          ownerCategory: category,
          createdAt: r.created_at,
        };
      })
      .filter((r): r is FileIndexRow => r !== null);
    return { rows, error: null };
  } catch {
    return { rows: [], error: GENERIC_READ_ERROR };
  }
}
