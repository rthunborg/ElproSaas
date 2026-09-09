/**
 * CRM write-surface helpers (Story 3.1, Task 2).
 *
 * The envelope's `CommandDbClient` declares only the read/ownership/audit surface
 * (`.from().select().eq().limit()` + `.rpc()`). The CRM `execute` bodies also need
 * the WRITE surface (`.insert()` / `.update()` / checked RPC) of the SAME
 * request-bound client. This module narrows the real `@supabase/supabase-js`
 * client to small typed views so command bodies never cast inline, and maps
 * Postgres/PostgREST error codes to the stable command codes.
 *
 * NO service-role client and NO direct table INSERT into `audit_events` are used.
 * Mutations run through the request-bound client (`ctx.db`); audited writes use
 * either the envelope audit path or a checked command RPC that binds its audit row.
 */
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";

/** A PostgREST result envelope for a write returning the inserted/updated rows. */
export type WriteResult = {
  readonly data: unknown[] | null;
  readonly error: { readonly code?: string; readonly message?: string } | null;
};

/** The minimal CRM write surface of the request-bound RLS client. */
export type CrmWriteClient = {
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
};

/**
 * Narrow the envelope's `CommandDbClient` to the CRM write surface. The real
 * Supabase client (and the test anon-key client) structurally satisfy this; the
 * cast is the single, documented place the write methods are surfaced.
 */
export function asCrmWriteClient(db: CommandDbClient): CrmWriteClient {
  return db as unknown as CrmWriteClient;
}

/**
 * Story 11.2's first checked non-admin mutation wrapper. It performs customer
 * creation and the bound audit insert in one PostgreSQL transaction; the caller
 * cannot supply the audit command/event/target fields.
 */
export type CreateCustomerWithAuditRpcClient = {
  rpc(
    fn: "create_customer_with_audit",
    args: {
      readonly p_tenant_id: string;
      readonly p_actor_user_id: string;
      readonly p_correlation_id: string;
      readonly p_customer_type: string;
      readonly p_display_name: string;
      readonly p_personnummer: string | null;
      readonly p_org_nr: string | null;
      readonly p_contact_name: string | null;
      readonly p_email: string | null;
      readonly p_phone: string | null;
      readonly p_address_line1: string | null;
      readonly p_address_line2: string | null;
      readonly p_postal_code: string | null;
      readonly p_city: string | null;
    },
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
};

export function asCreateCustomerWithAuditRpcClient(
  db: CommandDbClient,
): CreateCustomerWithAuditRpcClient {
  return db as unknown as CreateCustomerWithAuditRpcClient;
}

/**
 * Postgres error codes a CRM mutation can surface that are DETERMINISTIC outcomes
 * (not transient infra faults):
 *   - `23503` foreign_key_violation — a composite same-tenant FK rejected a
 *     cross-tenant / wrong-customer parent link → TENANT_ACCESS_DENIED.
 *   - `23514` check_violation       — the identifier-by-type CHECK rejected the row
 *     (belt-and-braces; the command validator catches this first) → VALIDATION_FAILED.
 *   - `42501` insufficient_privilege / RLS WITH CHECK violation → TENANT_ACCESS_DENIED.
 * Any other error is a transient fault — re-thrown as a plain Error so the envelope
 * maps it to SERVER_ERROR (retryable).
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
        `crm write failed: ${error.code ?? "?"} ${error.message ?? ""}`,
      );
  }
}
