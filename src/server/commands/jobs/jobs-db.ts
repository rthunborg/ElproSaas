/**
 * Job command write-surface helpers (Story 7.3, Task 4; architecture §5).
 *
 * The envelope's `CommandDbClient` declares only the read/ownership/audit surface
 * (`.from().select().eq().limit()` + `.rpc()`). The `updateJob` execute body ALSO needs the WRITE
 * surface (`.update()` returning the affected rows) + a status-change lifecycle INSERT into
 * `job_events`, all on the SAME request-bound, RLS-protected client (`ctx.db`). This module narrows
 * the real `@supabase/supabase-js` client to a small typed write view (`asJobWriteClient`) so the
 * command body never casts inline, and maps Postgres/PostgREST error codes to the stable command
 * codes (mirroring `crm/crm-db.ts`).
 *
 * NO service-role client and NO direct table INSERT into `audit_events` — the UPDATE + the
 * `job_events` append run through the request-bound RLS client, and audit goes through the
 * envelope's `writeAuditEvent` DEFINER path.
 */
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";

/** A PostgREST result envelope for a write returning the affected rows. */
export type JobWriteResult = {
  readonly data: unknown[] | null;
  readonly error: { readonly code?: string; readonly message?: string } | null;
};

/** The minimal job write surface of the request-bound RLS client. */
export type JobWriteClient = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        limit(n: number): Promise<JobWriteResult>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        select(columns: string): Promise<JobWriteResult>;
      };
    };
    insert(values: Record<string, unknown>): Promise<{
      error: { code?: string; message?: string } | null;
    }>;
  };
};

/**
 * Narrow the envelope's `CommandDbClient` to the job write surface. The real Supabase client (and
 * the test anon-key client) structurally satisfy this; the cast is the single documented place the
 * write methods are surfaced.
 */
export function asJobWriteClient(db: CommandDbClient): JobWriteClient {
  return db as unknown as JobWriteClient;
}

/**
 * Load the job's CURRENT status under the caller's RLS (to decide whether a status change happened).
 * Returns the status string when the row is visible (own tenant), or `null` when not visible (a
 * race — ownership already proved visibility). A transient query ERROR re-throws → SERVER_ERROR.
 */
export async function loadJobStatus(
  db: CommandDbClient,
  id: string,
): Promise<string | null> {
  const client = asJobWriteClient(db);
  const { data, error } = await client
    .from("jobs")
    .select("status")
    .eq("id", id)
    .limit(1);
  if (error) {
    throw new Error(
      `loadJobStatus failed: ${(error as { code?: string }).code ?? "?"}`,
    );
  }
  const row = (data?.[0] ?? null) as { status?: unknown } | null;
  if (!row || typeof row.status !== "string") return null;
  return row.status;
}

/**
 * Postgres error codes a job mutation can surface that are DETERMINISTIC outcomes (not transient
 * infra faults):
 *   - `23503` foreign_key_violation — a composite same-tenant FK → TENANT_ACCESS_DENIED.
 *   - `42501` insufficient_privilege / RLS WITH CHECK violation → TENANT_ACCESS_DENIED.
 *   - `23505` unique_violation → VALIDATION_FAILED.
 *   - `23514` check_violation (status/event_type CHECK) → VALIDATION_FAILED.
 *   - `22P02` invalid_text_representation (malformed uuid/date) → VALIDATION_FAILED.
 * Any other error is a transient fault — re-thrown as a plain Error → SERVER_ERROR (retryable).
 */
export function throwMappedJobWriteError(error: {
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
      // Throw the CODE only — never the raw Postgres message (which can embed row detail).
      throw new Error(`job write failed: ${error.code ?? "?"}`);
  }
}
