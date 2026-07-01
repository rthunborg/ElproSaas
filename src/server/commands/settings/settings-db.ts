/**
 * Settings write-surface helpers (Story 3.3, Task 2).
 *
 * The envelope's `CommandDbClient` declares only the read/ownership/audit surface
 * (`.from().select().eq().limit()` + `.rpc()`). The settings `execute` bodies also
 * need the WRITE surface of the SAME request-bound, RLS-protected client:
 *   - `company_settings` / `quote_terms` are ONE-row-per-tenant (a `unique
 *     (tenant_id)`), so the upsert is `.upsert(values, { onConflict: "tenant_id" })`
 *     — deterministic, never a duplicate.
 *   - `approveQuoteTerms` is an `.update(...).eq("id", ...)` by row id.
 *
 * This module narrows the real `@supabase/supabase-js` client to a small, typed
 * write view (`asSettingsWriteClient`) so the command bodies never cast inline, and
 * reuses the CRM error-mapping (`throwMappedWriteError`) so Postgres/PostgREST codes
 * map to the stable command codes.
 *
 * NO service-role client and NO direct table INSERT into `audit_events` are used —
 * mutations run through the request-bound RLS client (`ctx.db`), and audit goes
 * through the envelope's `writeAuditEvent` DEFINER path.
 */
import type { CommandDbClient } from "../envelope";

/** A PostgREST result envelope for a write returning the affected row(s). */
export type SettingsWriteResult = {
  readonly data: { id?: unknown }[] | null;
  readonly error: { readonly code?: string; readonly message?: string } | null;
};

/** The minimal settings write surface of the request-bound RLS client. */
export type SettingsWriteClient = {
  from(table: string): {
    /**
     * Upsert keyed on the tenant's unique (tenant_id) — `onConflict: "tenant_id"`.
     * Deterministic single-row-per-tenant: a second call UPDATES, never duplicates.
     */
    upsert(
      values: Record<string, unknown>,
      options: { onConflict: string },
    ): {
      select(columns: string): Promise<SettingsWriteResult>;
    };
    /** Update by id (approveQuoteTerms). */
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string,
      ): {
        select(columns: string): Promise<SettingsWriteResult>;
      };
    };
  };
};

/**
 * Narrow the envelope's `CommandDbClient` to the settings write surface. The real
 * Supabase client (and the test anon-key client) structurally satisfy this; the cast
 * is the single, documented place the write methods are surfaced.
 */
export function asSettingsWriteClient(db: CommandDbClient): SettingsWriteClient {
  return db as unknown as SettingsWriteClient;
}

// Re-export the CRM error mapper so the settings commands share ONE error-mapping
// discipline (23514→VALIDATION_FAILED, 42501/23503→TENANT_ACCESS_DENIED, else a
// plain throw → SERVER_ERROR). No bespoke settings error mechanism.
export { throwMappedWriteError } from "../crm/crm-db";
