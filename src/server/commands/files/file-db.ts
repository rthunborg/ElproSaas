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
  /** Reserved derived artifacts may apply stricter access rules while still draft. */
  readonly artifact_kind: string | null;
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
    .select("id, bucket_id, object_path, lifecycle_state, artifact_kind")
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
    artifact_kind: typeof row.artifact_kind === "string" ? row.artifact_kind : null,
  };
}

/**
 * Map an ACTIVE owner type to its owner table name (a CLOSED switch — never client
 * input, so the value is safe). Only the active owner types resolve today; the
 * deferred quote_version type is handled by the command BEFORE this is called
 * ("not-yet-available"), so it never reaches here.
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
    case "quote_acceptance":
      // Story 7.1 activation: the acceptance-evidence owner side resolves the acceptance under
      // own-tenant RLS (a foreign acceptance owner id ⇒ zero rows ⇒ TENANT_ACCESS_DENIED).
      return "quote_acceptances";
    case "job":
      // Story 7.3 activation: the job-evidence owner side resolves the job under own-tenant RLS
      // (a foreign job owner id ⇒ zero rows ⇒ TENANT_ACCESS_DENIED; R-802 both-side check).
      return "jobs";
    default:
      // Exhaustiveness guard (mirrors the codebase-standard assertNever discipline):
      // adding a 5th ACTIVE_OWNER_TYPES member without a branch here is a COMPILE
      // error, never a silent `db.from(undefined)` at runtime.
      return assertNeverOwnerType(ownerType);
  }
}

/** Compile-time exhaustiveness guard for {@link ownerTableFor}'s owner-type switch. */
function assertNeverOwnerType(ownerType: never): never {
  throw new Error(
    `ownerTableFor: no owner table for owner type ${JSON.stringify(ownerType)}.`,
  );
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

/**
 * The minimal WRITE surface the `uploadFile` command drives (Story 8.2, Task 3): the
 * direct explicit-id `files` insert + the `file_links` insert + the compensation UPDATE,
 * on the CALLER's request-bound RLS client (own-tenant WITH CHECK; NEVER service-role).
 * The `create_file_with_link` RPC self-allocates the id and cannot bind the object-path
 * id up front — 6.3 bypassed it for exactly this reason and did a direct explicit-id RLS
 * insert; 8.2 reuses THAT approach through this narrow write surface. A single documented
 * cast (`asFileWriteClient`) narrows the envelope client to it.
 */
export type FileWriteClient = {
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{
          data: { id: string } | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        select(columns: string): Promise<{
          data: unknown[] | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
  };
};

/** A file row as loaded for the archive-only-delete command (id + current lifecycle). */
export interface FileArchiveRow {
  readonly id: string;
  readonly lifecycle_state: FileLifecycleState;
}

/**
 * Load the target file's id + current lifecycle state under the caller's request-bound RLS
 * client (own tenant). Returns the row when visible, or `null` when not visible (gone /
 * cross-tenant — ownership already proved visibility, so `null` here is a race). Used by the
 * archive command to decide idempotency (an already-archived file is a clean no-op) BEFORE any
 * write. A transient query ERROR re-throws → SERVER_ERROR (never masked as an access decision).
 */
export async function loadFileForArchive(
  db: CommandDbClient,
  id: string,
): Promise<FileArchiveRow | null> {
  const { data, error } = await db
    .from("files")
    .select("id, lifecycle_state")
    .eq("id", id)
    .limit(1);
  if (error) {
    throw new Error(
      `loadFileForArchive failed: ${(error as { code?: string }).code ?? "?"}`,
    );
  }
  if (!data || data.length === 0) return null;
  const row = data[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const lifecycle = row.lifecycle_state;
  if (typeof row.id !== "string" || !isFileLifecycleState(lifecycle)) {
    return null;
  }
  return { id: row.id, lifecycle_state: lifecycle };
}

/** Narrow the envelope client to the file-write surface (single documented cast). */
export function asFileWriteClient(db: CommandDbClient): FileWriteClient {
  return db as unknown as FileWriteClient;
}

/** The minimal RPC surface for the narrow `link_existing_file` call. */
export type FileRpcClient = {
  rpc(
    fn: "link_existing_file",
    args: {
      readonly p_tenant_id: string;
      readonly p_file_id: string;
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
 *   - `FL823` — the Story 8.4 file-side lock trigger (`enforce_file_link_lock` /
 *     `enforce_file_lock`; a custom SQLSTATE, DISTINCT from the standard classes below and
 *     from 6.4's `QV409` / 7.4's `AR704`) → FILE_LINK_LOCKED. A mutation / re-point / hard-
 *     delete of a LOCKED commitment file-link (or a locked `files` row's object identity)
 *     is rejected below the command; the stable lock code must surface, not an opaque
 *     SERVER_ERROR. `FL823` → `FILE_LINK_LOCKED` is the THIRD scope of the shared lock-code
 *     FAMILY (sibling of `QV409` → `QUOTE_VERSION_LOCKED` and `AR704` → `ACCEPTED_RECORD_LOCKED`).
 *   - `23503` foreign_key_violation — the composite same-tenant FK rejected a
 *     cross-tenant / wrong-parent link → TENANT_ACCESS_DENIED.
 *   - `42501` insufficient_privilege / RLS WITH CHECK violation → TENANT_ACCESS_DENIED.
 *   - `23505` unique_violation (bucket_id, object_path collision) → VALIDATION_FAILED.
 *   - `23514` check_violation (owner_type / purpose / lifecycle CHECK) → VALIDATION_FAILED.
 *   - `22P02` invalid_text_representation (malformed uuid) → VALIDATION_FAILED.
 * Any other error is a transient fault — re-thrown as a plain Error so the envelope maps
 * it to SERVER_ERROR (retryable).
 */
export function throwMappedFileWriteError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
    // Story 10.6: acceptance evidence is part of the immutable acceptance capture. A late
    // append/relink therefore reports the accepted-record outcome, not a generic file lock.
    case "AR704":
      throw new CommandError("ACCEPTED_RECORD_LOCKED");
    // The Story 8.4 file-side lock RAISE — a distinguishable custom SQLSTATE the mapper
    // branches on FIRST, WITHOUT colliding with the standard classes or QV409/AR704.
    case "FL823":
      throw new CommandError("FILE_LINK_LOCKED");
    case "23503":
    case "42501":
      throw new CommandError("TENANT_ACCESS_DENIED");
    case "23505":
    case "23514":
    case "22P02":
      throw new CommandError("VALIDATION_FAILED");
    default:
      // Throw the CODE only — never the raw Postgres `error.message`, which can
      // embed the row's object_path / tenant_id (unique/exclusion/constraint detail
      // or a connection diagnostic quoting the failed statement). The code alone is
      // enough to classify/telemetry; the raw driver message must not cross the
      // boundary (mirrors the "never a raw storage error across the boundary"
      // discipline in signed-access.ts).
      throw new Error(`file write failed: ${error.code ?? "?"}`);
  }
}
