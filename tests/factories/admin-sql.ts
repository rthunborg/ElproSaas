/**
 * TEST-ONLY admin SQL helper (Story 2.2). Direct `pg` connection to the LOCAL
 * Supabase Postgres as the `postgres` superuser — used for schema introspection
 * (migration-reset green test) and for planting the adversarial search_path
 * object in the SECURITY DEFINER hijack negative (R-006).
 *
 * Confined to `tests/factories/**` (the `check-service-role-containment.mjs`
 * guard scans `tests/`). NEVER imported into `src/`/`app/`/client paths — the app
 * runtime talks to Supabase over the anon key + RLS, never a raw superuser
 * connection.
 *
 * A single lazily-created pool is reused across the run and closed by the suites'
 * global teardown via `closeAdminPool()`.
 */
import { Pool, type QueryResultRow } from "pg";
import { assertLocalStack, LOCAL_SUPABASE_DB_URL } from "../support/test-env";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    // Hard local-only fail-safe BEFORE any superuser connection is opened — the
    // admin SQL helper runs raw DDL/DML as `postgres` and must never touch a
    // non-local database.
    assertLocalStack();
    pool = new Pool({
      connectionString: LOCAL_SUPABASE_DB_URL,
      // Small pool: the suites are not write-heavy and share one local DB.
      max: 4,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

/** Run a parameterized query and return the typed rows. */
export async function adminQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

/** Run a statement for its side effect (DDL/DML), ignoring the result set. */
export async function adminExec(
  sql: string,
  params: readonly unknown[] = [],
): Promise<void> {
  await getPool().query(sql, params as unknown[]);
}

/**
 * Run a sequence of statements on a SINGLE dedicated connection (so session-local
 * state like `set search_path` persists across them). Used by the R-006 hijack
 * negative, which must SET search_path and then call the helper on the same
 * session. The connection is always released.
 */
export async function adminSession<T>(
  run: (exec: {
    query: <R extends QueryResultRow = QueryResultRow>(
      sql: string,
      params?: readonly unknown[],
    ) => Promise<R[]>;
  }) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await run({
      query: async <R extends QueryResultRow = QueryResultRow>(
        sql: string,
        params: readonly unknown[] = [],
      ) => {
        const result = await client.query<R>(sql, params as unknown[]);
        return result.rows;
      },
    });
  } finally {
    // Reset ALL session-local state before returning the connection to the pool.
    // The R-006 hijack negative sets `search_path` and `request.jwt.claim.sub` on
    // this session; without a reset the pooled connection (max: 4) would hand that
    // tampered state to a later `adminQuery`/`adminExec`/`adminSession` caller,
    // causing non-deterministic cross-test contamination under parallelism
    // (review fix 2026-06-26). `discard all` also drops temp tables/prepared
    // statements planted by the adversarial-object setup.
    try {
      await client.query("discard all");
    } finally {
      client.release();
    }
  }
}

/** Close the shared pool (called from suite teardown). Safe to call repeatedly. */
export async function closeAdminPool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}
