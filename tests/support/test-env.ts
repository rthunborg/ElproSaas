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

/**
 * The local stack's default API URL (CLI `API_URL`).
 *
 * Override ONLY via the dedicated `SUPABASE_TEST_*` names — NOT the conventional
 * `NEXT_PUBLIC_SUPABASE_URL`. A dev/CI shell may legitimately carry a REAL project
 * URL under the conventional name; honoring it here would silently point the
 * BYPASSRLS factories at a non-local project (review fix 2026-06-26). The
 * `assertLocalStack()` guard below is the hard fail-safe regardless of source.
 */
export const LOCAL_SUPABASE_URL =
  process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";

/**
 * The local stack's default legacy anon JWT (CLI `ANON_KEY`). supabase-js /
 * @supabase/ssr accept this JWT-format key. This is the universal local-demo anon
 * key, not a real secret. Override only via `SUPABASE_TEST_ANON_KEY`.
 */
export const LOCAL_SUPABASE_ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/**
 * Story 10.9 local-only quote-PDF attestation pair. These values must match the
 * idempotent Vault fixture in `supabase/seed.sql`; they are deliberately not a
 * production fallback. Vitest and Playwright import this one test authority so
 * their server-side HMAC configuration cannot drift apart.
 */
export const LOCAL_TEST_QUOTE_PDF_KEY_ID = "test_v1";
export const LOCAL_TEST_QUOTE_PDF_SECRET =
  "local-test-only-quote-pdf-attestation-secret-v1";

/**
 * The local stack's default legacy service-role JWT (CLI `SERVICE_ROLE_KEY`).
 * TEST-ONLY — bypasses RLS for fixture setup. Universal local-demo key. Override
 * only via `SUPABASE_TEST_SERVICE_ROLE_KEY` — NEVER the conventional
 * `SUPABASE_SERVICE_ROLE_KEY`, which may hold a real project's key (review fix
 * 2026-06-26). `assertLocalStack()` is the hard backstop.
 */
export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * Hard local-only guard (review fix 2026-06-26). The factories use a BYPASSRLS
 * service-role key and create/delete auth users; pointing them at anything but the
 * local stack would mutate a real project. This throws unless the resolved API URL
 * AND the direct Postgres connection both target loopback (`127.0.0.1`/`localhost`).
 * Called at the factory/admin-SQL entry boundary so no DB-backed path can run
 * against a non-local target — defense beyond convention. Idempotent / cheap.
 */
const LOOPBACK = /(?:127\.0\.0\.1|localhost|\[::1\]|(?<![\w.])::1(?![\w.]))/i;

export function assertLocalStack(): void {
  if (!LOOPBACK.test(LOCAL_SUPABASE_URL)) {
    throw new Error(
      `Refusing to run DB-backed tests/factories against a non-local Supabase URL: ` +
        `"${LOCAL_SUPABASE_URL}". The factories use a BYPASSRLS service-role key and ` +
        `create/delete auth users — they MUST target the local stack only. Set ` +
        `SUPABASE_TEST_URL to a 127.0.0.1/localhost address (or unset it for the default).`,
    );
  }
  if (!LOOPBACK.test(LOCAL_SUPABASE_DB_URL)) {
    throw new Error(
      `Refusing to run the admin SQL helper against a non-local Postgres URL. ` +
        `Set SUPABASE_TEST_DB_URL to a 127.0.0.1/localhost connection string ` +
        `(or unset it for the local-stack default).`,
    );
  }
}

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
 * Probe whether the local Supabase STORAGE service is reachable (Story 8.1, Task 8.6 —
 * retro-note R-2 gap). The existing `isLocalStackReachable()` probes ONLY
 * `/auth/v1/health`; a storage suite relying on it would FALSE-GREEN (skip silently)
 * when the DB is up but the Storage service is down. This dedicated probe hits the
 * storage bucket-list endpoint with the service-role key so a storage-down stack is a
 * VISIBLE skip locally (and a HARD failure under `SUPABASE_TEST_REQUIRED=1` via
 * `skipUnlessStorage`). Returns true only when the Storage service answers OK.
 */
export async function isLocalStorageReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/storage/v1/bucket`, {
      method: "GET",
      headers: {
        apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
      },
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
