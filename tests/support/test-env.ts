/**
 * Local-Supabase test environment contract (Story 2.2).
 *
 * The DB-backed INT/RLS suites and the two-tenant factories run against the LOCAL
 * Supabase CLI stack ONLY (`supabase start` / `supabase db reset`) — NEVER a
 * shared dev/staging/prod project (architecture §18; test-design Assumptions #3).
 *
 * The values below are the WELL-KNOWN, FIXED defaults the Supabase CLI emits for
 * every local stack (issuer `supabase-demo`). They are NOT secrets — they are the
 * same on every machine and are safe to commit as test config. Real project keys
 * never appear here. Each value is overridable via an env var so CI or a custom
 * local port mapping can point the suites at the running stack.
 *
 * The SERVICE-ROLE key is TEST-ONLY and confined to `tests/**` (the
 * `check-service-role-containment.mjs` guard scans `tests/` and would flag a leak
 * into a client path). It is used by the factories' admin path to create auth
 * users and seed memberships (B2) — it is never imported into `src/`/`app/`.
 */

/** The local stack's default API URL (CLI `API_URL`). */
export const LOCAL_SUPABASE_URL =
  process.env.SUPABASE_TEST_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";

/**
 * The local stack's default legacy anon JWT (CLI `ANON_KEY`). supabase-js /
 * @supabase/ssr accept this JWT-format key. This is the universal local-demo anon
 * key, not a real secret.
 */
export const LOCAL_SUPABASE_ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/**
 * The local stack's default legacy service-role JWT (CLI `SERVICE_ROLE_KEY`).
 * TEST-ONLY — bypasses RLS for fixture setup. Universal local-demo key.
 */
export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * Probe whether the local Supabase stack is reachable. The DB-backed suites call
 * this in a `beforeAll` and `skip` themselves when it returns false, so a developer
 * without Docker still gets a green `pnpm test:unit` and a cleanly-skipped
 * `pnpm test:int`, while CI (which runs `supabase db reset` first) executes them
 * for real. CI sets `SUPABASE_TEST_REQUIRED=1` to turn a missing stack into a
 * HARD failure instead of a silent skip (so the gate can never false-green).
 */
export async function isLocalStackReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: LOCAL_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(2_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Direct Postgres connection string to the LOCAL stack's database (CLI `DB_URL`).
 * TEST-ONLY — used by the admin SQL helper to introspect the schema and to plant
 * the adversarial search_path object in the R-006 negative. `postgres` is the
 * local superuser; this is the universal local-demo connection string.
 */
export const LOCAL_SUPABASE_DB_URL =
  process.env.SUPABASE_TEST_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** When set (CI), a missing local stack is a hard error, never a silent skip. */
export const STACK_REQUIRED = process.env.SUPABASE_TEST_REQUIRED === "1";
