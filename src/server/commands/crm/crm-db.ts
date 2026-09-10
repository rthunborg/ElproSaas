/**
 * CRM write-surface helpers (Story 3.1, Task 2).
 *
 * The envelope's `CommandDbClient` declares the read/ownership/audit surface plus
 * `.rpc()`. Story 11.2 routes CRM mutations through command-specific checked RPCs
 * on that same request-bound client, and this module narrows only those RPC views
 * while mapping Postgres/PostgREST errors to stable command codes.
 *
 * NO service-role client and NO direct table INSERT into `audit_events` are used.
 * Mutations run through the request-bound client (`ctx.db`); each audited CRM
 * write uses a checked command RPC that binds its audit row.
 */
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";

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
 * Story 11.2 CRM lifecycle wrappers. Each name identifies one domain mutation;
 * the database wrapper fixes its command/event/target and appends its audit row
 * in the same transaction as the write. `p_patch` is accepted only by the two
 * matching update wrappers and is validated again by their SQL implementation.
 */
export type CrmAuditedMutationRpcName =
  | "update_customer_with_audit"
  | "archive_customer_with_audit"
  | "create_facility_with_audit"
  | "update_facility_with_audit"
  | "archive_facility_with_audit"
  | "create_contact_with_audit"
  | "update_contact_with_audit"
  | "archive_contact_with_audit";

export type CrmAuditedMutationRpcClient = {
  rpc(
    fn: CrmAuditedMutationRpcName,
    args: Record<string, unknown>,
  ): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message?: string } | null;
  }>;
};

export function asCrmAuditedMutationRpcClient(
  db: CommandDbClient,
): CrmAuditedMutationRpcClient {
  return db as unknown as CrmAuditedMutationRpcClient;
}

/** Execute a checked CRM write and require its UUID target result. */
export async function executeCrmAuditedMutation(
  db: CommandDbClient,
  fn: CrmAuditedMutationRpcName,
  args: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await asCrmAuditedMutationRpcClient(db).rpc(fn, args);
  if (error) throwMappedWriteError(error);
  if (typeof data !== "string") {
    throw new Error(`${fn}: no id returned`);
  }
  return data;
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
