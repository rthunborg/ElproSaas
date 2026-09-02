/**
 * Vitest globalSetup (Story 2.2) — runs ONCE before the DB-backed INT/RLS suites.
 *
 * It only checks reachability of the LOCAL Supabase stack and decides the
 * skip-vs-fail policy:
 *   - Local dev without Docker: the stack is unreachable → individual suites skip
 *     themselves (they call `isLocalStackReachable()` in `beforeAll`). This keeps
 *     `pnpm test:int` green-but-skipped so a contributor without Docker is not
 *     blocked.
 *   - CI (sets `SUPABASE_TEST_REQUIRED=1`): an unreachable stack is a HARD failure
 *     here, so the gate can never silently pass without exercising RLS.
 *
 * It does NOT run `supabase db reset` — that is the caller's responsibility
 * (`pnpm test:db` locally, the CI job step). Keeping reset out of the runner means
 * the suites never assume they may wipe a database out from under a developer.
 */
import {
  isLocalStackReachable,
  LOCAL_TEST_QUOTE_PDF_KEY_ID,
  LOCAL_TEST_QUOTE_PDF_SECRET,
  STACK_REQUIRED,
} from "./test-env";

export default async function globalSetup(): Promise<void> {
  // Test-runner-only counterpart to the idempotent local Vault fixture in seed.sql.
  // Production never receives a fallback: generateQuotePdf fails closed when either
  // non-public attestation variable is absent.
  process.env.QUOTE_PDF_ATTESTATION_KEY_ID ??= LOCAL_TEST_QUOTE_PDF_KEY_ID;
  process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET ??= LOCAL_TEST_QUOTE_PDF_SECRET;
  const reachable = await isLocalStackReachable();

  if (!reachable && STACK_REQUIRED) {
    throw new Error(
      "SUPABASE_TEST_REQUIRED=1 but the local Supabase stack is not reachable. " +
        "Start it and reset the schema before the DB-backed suites:\n" +
        "  supabase start && supabase db reset\n" +
        "Tests run against the LOCAL stack only — never a shared dev/staging/prod project.",
    );
  }

  if (!reachable) {
    console.warn(
      "[vitest] Local Supabase stack not reachable — DB-backed INT/RLS suites will " +
        "SKIP. Run `supabase start && supabase db reset` to execute them locally.",
    );
  }
}
