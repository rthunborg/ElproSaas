/**
 * File command DB-surface helpers (Story 8.1, Task 5/6; architecture §5, §14).
 *
 * The envelope's `CommandDbClient` declares only the read/ownership/audit surface
 * (`.from().select().eq().limit()` + the `record_audit_event` `.rpc()`). The file
 * `execute` bodies also need:
 *   - to LOAD a file row (object_path + bucket_id + lifecycle_state) under the caller's
 *     RLS (the metadata-first ownership + lifecycle gate — R-810);
 *   - to VERIFY an owner record belongs to the resolved tenant (an own-tenant RLS
 *     SELECT on the owner table — the R-802 both-side check);
 *   - to call the narrow atomic `create_file_with_link` RPC (ADR-A009).
 * All run through the SAME request-bound, RLS-protected client (`ctx.db`) — NO
 * service-role client, NO direct audit INSERT. Postgres/PostgREST error codes map to
 * the stable command codes (mirroring `calculations/calc-db.ts`).
 */
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";
import {
  isFileLifecycleState,
  type FileLifecycleState,
} from "@/server/storage/lifecycle";
import type { ActiveOwnerType } from "./validation";

/** A file row as loaded for the signing funnel (object identity + lifecycle). */
export interface FileAccessRow {
  readonly id: string;
  readonly bucket_id: string;
  readonly object_path: string;
  readonly lifecycle_state: FileLifecycleState;
}

/**
 * Load the target file's storage identity + lifecycle state under the caller's
 * request-bound RLS client. Returns the row when visible (own tenant), or `null` when
 * not visible (gone / cross-tenant — ownership already proved visibility, so `null`
 * here is a race). A transient query ERROR is re-thrown as a plain Error so the
 * envelope maps it to SERVER_ERROR (retryable) — never masked as an access decision.
 *
 * This is a READ on the envelope's own `.from().select().eq().limit()` surface (the
 * same surface `verifyOwnership` uses) — no write-surface cast, no service-role client.
 */
export async function loadFileForAccess(
  db: CommandDbClient,
  id: string,
): Promise<FileAccessRow | null> {
  const { data, error } = await db
    .from("files")
    .select("id, bucket_id, object_path, lifecycle_state")
    .eq("id", id)
    .limit(1);
  if (error) {
    throw new Error(
      `loadFileForAccess failed: ${(error as { code?: string }).code ?? "?"}`,
    );
  }
  if (!data || data.length === 0) return null;
  const row = data[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const lifecycle = row.lifecycle_state;
  if (
    typeof row.id !== "string" ||
    typeof row.bucket_id !== "string" ||
    typeof row.object_path !== "string" ||
    !isFileLifecycleState(lifecycle)
  ) {
    return null;
  }
  return {
    id: row.id,
    bucket_id: row.bucket_id,
    object_path: row.object_path,
    lifecycle_state: lifecycle,
  };
}

/**
 * Map an ACTIVE owner type to its owner table name (a CLOSED switch — never client
 * input, so the value is safe). Only the active owner types resolve today; the
 * deferred quote_version/quote_acceptance/job types are handled by the command BEFORE
 * this is called ("not-yet-available"), so they never reach here.
 */
export function ownerTableFor(ownerType: ActiveOwnerType): string {
  switch (ownerType) {
    case "customer":
      return "customers";
    case "facility":
      return "facilities";
    case "contact":
      return "contacts";
    case "calculation":
      return "calculations";
  }
}

/**
 * Verify the owner record belongs to the resolved tenant via an own-tenant RLS SELECT
 * on the owner table (the R-802 both-side check). Returns `true` when the owner row is
 * visible under the caller's RLS (own tenant), `false` when zero rows (cross-tenant /
 * non-existent → TENANT_ACCESS_DENIED at the caller). A transient query ERROR re-throws
 * as a plain Error → SERVER_ERROR (never masked as a denial).
 */
export async function ownerRecordVisible(
  db: CommandDbClient,
  ownerTable: string,
  ownerId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from(ownerTable)
    .select("id")
    .eq("id", ownerId)
    .limit(1);
  if (error) {
    throw new Error(
      `ownerRecordVisible failed: ${(error as { code?: string }).code ?? "?"}`,
    );
  }
  return Array.isArray(data) && data.length > 0;
}

/** The minimal RPC surface for the atomic create_file_with_link call. */
export type FileRpcClient = {
  rpc(
    fn: "create_file_with_link",
    args: {
      readonly p_tenant_id: string;
      readonly p_bucket_id: string;
      readonly p_object_path: string;
      readonly p_display_name: string;
      readonly p_mime_type: string | null;
      readonly p_size_bytes: number | null;
      readonly p_checksum: string | null;
      readonly p_uploaded_by: string | null;
      readonly p_lifecycle_state: string;
      readonly p_owner_type: string;
      readonly p_owner_id: string;
      readonly p_purpose: string;
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/** Narrow the envelope client to the file-RPC surface (single documented cast). */
export function asFileRpcClient(db: CommandDbClient): FileRpcClient {
  return db as unknown as FileRpcClient;
}

/**
 * Postgres error codes the file mutations can surface that are DETERMINISTIC outcomes
 * (not transient infra faults):
 *   - `23503` foreign_key_violation — the composite same-tenant FK rejected a
 *     cross-tenant / wrong-parent link → TENANT_ACCESS_DENIED.
 *   - `42501` insufficient_privilege / RLS WITH CHECK violation → TENANT_ACCESS_DENIED.
 *   - `23505` unique_violation (bucket_id, object_path collision) → VALIDATION_FAILED.
 *   - `23514` check_violation (owner_type / purpose / lifecycle CHECK) → VALIDATION_FAILED.
 * Any other error is a transient fault — re-thrown as a plain Error so the envelope maps
 * it to SERVER_ERROR (retryable).
 */
export function throwMappedFileWriteError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
    case "23503":
    case "42501":
      throw new CommandError("TENANT_ACCESS_DENIED");
    case "23505":
    case "23514":
    case "22P02":
      throw new CommandError("VALIDATION_FAILED");
    default:
      throw new Error(
        `file write failed: ${error.code ?? "?"} ${error.message ?? ""}`,
      );
  }
}
