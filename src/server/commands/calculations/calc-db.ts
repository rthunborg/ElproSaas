/**
 * Calculation write-surface helpers (Story 5.1, Task 3.1).
 *
 * The envelope's `CommandDbClient` declares only the read/ownership/audit surface
 * (`.from().select().eq().limit()` + the `record_audit_event` `.rpc()`). The calc
 * `execute` bodies also need the WRITE surface (`.insert()` / `.update()`) and the
 * narrow atomic reorder `.rpc("reorder_calculation_rows", …)` of the SAME
 * request-bound, RLS-protected client. This module narrows the real
 * `@supabase/supabase-js` client to a small, typed write view (`asCalcWriteClient`)
 * so the command bodies never cast inline, and maps Postgres/PostgREST error codes to
 * the stable command codes (mirroring `crm/crm-db.ts`).
 *
 * NO service-role client and NO direct table INSERT into `audit_events` are used —
 * mutations run through the request-bound RLS client (`ctx.db`), the atomic reorder
 * runs through the SECURITY INVOKER RPC (still under the caller's RLS), and audit goes
 * through the envelope's `writeAuditEvent` DEFINER path.
 */
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";
import { isCalcStatus, isRowType, type CalcStatus, type RowType } from "./validation";

/** A PostgREST result envelope for a write returning the inserted/updated rows. */
export type WriteResult = {
  readonly data: unknown[] | null;
  readonly error: { readonly code?: string; readonly message?: string } | null;
};

/** The minimal calc write + reorder-RPC surface of the request-bound RLS client. */
export type CalcWriteClient = {
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{
          data: { id?: unknown } | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        select(columns: string): Promise<WriteResult>;
      };
    };
  };
  rpc(
    fn: "reorder_calculation_rows",
    args: {
      readonly p_section_id: string;
      readonly p_ordered_row_ids: readonly string[];
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
  rpc(
    fn: "reorder_calculation_sections",
    args: {
      readonly p_calculation_id: string;
      readonly p_ordered_section_ids: readonly string[];
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/**
 * Narrow the envelope's `CommandDbClient` to the calc write surface. The real
 * Supabase client (and the test anon-key client) structurally satisfy this; the cast
 * is the single, documented place the write + reorder-RPC methods are surfaced.
 */
export function asCalcWriteClient(db: CommandDbClient): CalcWriteClient {
  return db as unknown as CalcWriteClient;
}

/**
 * Load the target calculation's REAL current lifecycle `status` from the DB, under the
 * caller's request-bound RLS client (findings 1 & 2). Returns the `CalcStatus` when the
 * row is visible, or `null` when the row is not visible under the caller's RLS (gone /
 * cross-tenant — ownership already proved visibility, so `null` here is a race).
 *
 * A transient query ERROR is re-thrown as a plain Error so the envelope maps it to
 * SERVER_ERROR (retryable) — never masked as an access decision. This is a READ on the
 * envelope's own `.from().select().eq().limit()` surface (the same surface `verifyOwnership`
 * uses) — no write-surface cast, no service-role client.
 */
export async function loadCalcStatus(
  db: CommandDbClient,
  id: string,
): Promise<CalcStatus | null> {
  const { data, error } = await db
    .from("calculations")
    .select("status")
    .eq("id", id)
    .limit(1);
  if (error) {
    throw new Error(
      `loadCalcStatus failed: ${
        (error as { code?: string }).code ?? "?"
      }`,
    );
  }
  if (!data || data.length === 0) return null;
  const row = data[0];
  const status =
    row && typeof row === "object"
      ? (row as { status?: unknown }).status
      : undefined;
  // The DB CHECK constrains status to the known set; guard defensively anyway.
  return isCalcStatus(status) ? status : null;
}

/**
 * Load the target calculation ROW's REAL persisted `row_type` from the DB, under the
 * caller's request-bound RLS client (integration review, iter-2). Returns the `RowType`
 * when the row is visible, or `null` when the row is not visible under the caller's RLS
 * (gone / cross-tenant — ownership already proved visibility, so `null` here is a race).
 *
 * Used by `updateRow` to re-run the `row_type ↔ source_kind` cross-check against the REAL
 * persisted type on a SOURCE-ONLY update (one that omits `row_type` from the payload) — the
 * pure `validateSourcePair` can only cross-check when `row_type` is in the SAME payload, so
 * a source-only update needs the authoritative type loaded here to close the crafted-write
 * gap (a work-role snapshot persisted on a material row, or vice-versa).
 *
 * A transient query ERROR is re-thrown as a plain Error so the envelope maps it to
 * SERVER_ERROR (retryable) — never masked as an access decision. This is a READ on the
 * envelope's own `.from().select().eq().limit()` surface (the same surface `verifyOwnership`
 * and `loadCalcStatus` use) — no write-surface cast, no service-role client.
 */
export async function loadRowType(
  db: CommandDbClient,
  id: string,
): Promise<RowType | null> {
  const { data, error } = await db
    .from("calculation_rows")
    .select("row_type")
    .eq("id", id)
    .limit(1);
  if (error) {
    throw new Error(
      `loadRowType failed: ${(error as { code?: string }).code ?? "?"}`,
    );
  }
  if (!data || data.length === 0) return null;
  const row = data[0];
  const rowType =
    row && typeof row === "object"
      ? (row as { row_type?: unknown }).row_type
      : undefined;
  return isRowType(rowType) ? rowType : null;
}

/**
 * Postgres error codes a calc mutation can surface that are DETERMINISTIC outcomes
 * (not transient infra faults):
 *   - `23503` foreign_key_violation — a composite same-tenant FK rejected a
 *     cross-tenant / wrong-parent link → TENANT_ACCESS_DENIED.
 *   - `23514` check_violation       — a DB CHECK rejected the row (row_type / quantity
 *     / öre non-negative), OR the reorder RPC rejected a bad payload → VALIDATION_FAILED
 *     (the command validator catches most of these first).
 *   - `42501` insufficient_privilege / RLS WITH CHECK violation → TENANT_ACCESS_DENIED.
 * Any other error is a transient fault — re-thrown as a plain Error so the envelope maps
 * it to SERVER_ERROR (retryable).
 */
export function throwMappedWriteError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
    case "23503":
    case "42501":
      throw new CommandError("TENANT_ACCESS_DENIED");
    case "23514":
      throw new CommandError("VALIDATION_FAILED");
    default:
      // Transient/unexpected — let the envelope map a plain throw to SERVER_ERROR.
      throw new Error(
        `calc write failed: ${error.code ?? "?"} ${error.message ?? ""}`,
      );
  }
}

/**
 * Error mapping for the atomic reorder RPC. The narrow RPC raises
 * `check_violation` (`23514`) when a supplied id is not a same-section row visible
 * under the caller's RLS (or the payload has a duplicate) — the whole reorder rolls
 * back (R-503). That is a bad request → VALIDATION_FAILED, NOT a transient fault. A
 * `42501` (RLS/privilege) is TENANT_ACCESS_DENIED; anything else is a transient fault
 * mapped to SERVER_ERROR by the envelope.
 */
export function throwMappedReorderError(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  switch (error.code) {
    case "23514":
      throw new CommandError("VALIDATION_FAILED");
    case "42501":
      throw new CommandError("TENANT_ACCESS_DENIED");
    default:
      throw new Error(
        `reorder failed: ${error.code ?? "?"} ${error.message ?? ""}`,
      );
  }
}
