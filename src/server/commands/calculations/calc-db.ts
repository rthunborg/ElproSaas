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
