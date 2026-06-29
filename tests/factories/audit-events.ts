/**
 * TEST-ONLY audit-event factory helpers (Story 2.3) — additive to the two-tenant
 * factories (B1: add ALONGSIDE, do not reshape existing handles).
 *
 * Provides privileged seed/read/mutation-attempt helpers for `audit_events` against
 * the LOCAL Supabase Postgres (the `postgres` superuser via the shared `pg` pool in
 * `admin-sql.ts`). Used by the DB-backed audit suites to:
 *   - SEED a real audit row (so an app-path UPDATE/DELETE or a cross-tenant SELECT
 *     has a concrete target to be denied),
 *   - READ rows back independently of the app path (BYPASSRLS) to prove what was
 *     actually persisted / that a denied mutation changed nothing,
 *   - ATTEMPT a privileged UPDATE and prove the append-only trigger raises even for
 *     the privileged path (R-009 defense-in-depth).
 *
 * Confined to `tests/**` (the `check-service-role-containment.mjs` guard scans
 * `tests/`). NEVER imported into `src/`/`app/`. The pg pool is hard-gated to loopback
 * by `assertLocalStack()` inside `admin-sql.ts`.
 */
import { adminExec, adminQuery } from "./admin-sql";

/** A seed for one audit row (the exact snake_case columns of `audit_events`). */
export interface AuditEventSeed {
  readonly tenant_id: string;
  readonly actor_user_id: string;
  readonly command: string;
  readonly event_type: string;
  readonly target_type: string;
  readonly target_id: string | null;
  readonly correlation_id: string;
  readonly metadata: Record<string, unknown>;
}

/** A persisted audit row as read back (subset the suites assert on). */
export interface AuditEventRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly actor_user_id: string | null;
  readonly command: string;
  readonly event_type: string;
  readonly target_type: string;
  readonly target_id: string | null;
  readonly correlation_id: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

/**
 * Seed ONE audit row via the privileged pg path (BYPASSRLS). Returns the inserted id.
 * THROWS on DB error so a negative can `await expect(...).rejects`.
 */
async function insertAuditEvent(seed: AuditEventSeed): Promise<string> {
  const rows = await adminQuery<{ id: string }>(
    `insert into public.audit_events
       (tenant_id, actor_user_id, command, event_type, target_type, target_id, correlation_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     returning id`,
    [
      seed.tenant_id,
      seed.actor_user_id,
      seed.command,
      seed.event_type,
      seed.target_type,
      seed.target_id,
      seed.correlation_id,
      JSON.stringify(seed.metadata ?? {}),
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("adminInsertAuditEvent: no id returned");
  return id;
}

/**
 * Attempt a PRIVILEGED UPDATE of an audit row. Used to prove the append-only trigger
 * raises EVEN for the privileged path (R-009 defense-in-depth). THROWS (the trigger
 * raises `restrict_violation`), so the negative asserts `.rejects`.
 */
async function tryUpdate(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(patch);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await adminExec(
    `update public.audit_events set ${sets} where id = $1`,
    [id, ...keys.map((k) => patch[k])],
  );
}

/**
 * The audit seed helper, with an attached `.tryUpdate` for the privileged
 * append-only negative (matches the scaffold's `adminInsertAuditEvent.tryUpdate?`).
 */
export const adminInsertAuditEvent: ((seed: AuditEventSeed) => Promise<string>) & {
  tryUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
} = Object.assign(insertAuditEvent, { tryUpdate });

/** Read audit rows back via the privileged path, by id and/or correlation id. */
export async function adminSelectAuditEvents(filter: {
  readonly id?: string;
  readonly correlationId?: string;
}): Promise<AuditEventRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.id) {
    params.push(filter.id);
    clauses.push(`id = $${params.length}`);
  }
  if (filter.correlationId) {
    params.push(filter.correlationId);
    clauses.push(`correlation_id = $${params.length}`);
  }
  const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  return adminQuery<AuditEventRow>(
    `select id, tenant_id, actor_user_id, command, event_type, target_type,
            target_id, correlation_id, metadata, created_at
     from public.audit_events ${where}
     order by created_at desc`,
    params,
  );
}

/** Count audit rows for a tenant via the privileged path (for "no audit row" asserts). */
export async function adminCountAuditEvents(filter: {
  readonly tenantId: string;
}): Promise<number> {
  const rows = await adminQuery<{ n: string }>(
    `select count(*)::int as n from public.audit_events where tenant_id = $1`,
    [filter.tenantId],
  );
  return Number(rows[0]?.n ?? 0);
}
