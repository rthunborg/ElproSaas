/**
 * Vitest config — DB-backed INT/RLS suites ONLY (Story 2.2, Task 4.1).
 *
 * Runner decision (TEA `testarch-framework`, recorded in the Story 2.2 Dev Agent
 * Record): the project keeps TWO deliberately-separated runners.
 *   - `node --test` (dependency-free, Story 2.1) runs the PURE-LOGIC unit suites
 *     under `tests/unit/**` (`pnpm test:unit`). Subsuming them into Vitest would
 *     mean rewriting every `node:test`/`node:assert` import for no behavioural
 *     gain, so they stay on the established zero-dependency runner.
 *   - Vitest (this config) runs the DB-backed integration + RLS negative suites
 *     under `tests/integration/**` (`pnpm test:int`), which need a real runner,
 *     async lifecycle, and a live local Supabase stack.
 * `pnpm test` runs both in order. The `@/*` alias is resolved natively by Vite 8
 * (`resolve.tsconfigPaths`), superseding the `node --test` alias-hook (which is
 * retained ONLY for the unit runner).
 *
 * These suites require a LOCAL Supabase stack (`supabase start` + `supabase db
 * reset`) — never a shared dev/staging/prod project (architecture §18). They are
 * skipped automatically when the local stack is unreachable (see
 * tests/support/test-env.ts) so a developer without Docker still gets a green
 * unit run, while CI (which starts the stack) runs them for real.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite 8 native tsconfig `paths` resolution (`@/* -> ./src/*`).
    tsconfigPaths: true,
  },
  test: {
    // `*.int.test.ts` / `*.rls.test.ts` already end in `.test.ts`, so `*.test.ts`
    // matches them — no need for redundant `int.test`/`rls.test` alternatives
    // (review fix 2026-06-26).
    // Most suites isolate rows with unique fixture IDs and remain parallel. The
    // job-run rollback proof creates/drops a global audit_events trigger: its DDL
    // must run after every other worker releases shared-table transaction locks.
    fileParallelism: true,
    // Keep include patterns on each project: Vitest 4 concatenates inherited arrays.
    projects: [
      {
        extends: true,
        test: {
          name: "integration-parallel",
          include: ["tests/integration/**/*.{test,spec}.ts"],
          exclude: ["tests/integration/jobs/job-runs.int.test.ts"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "integration-audit-ddl",
          include: ["tests/integration/jobs/job-runs.int.test.ts"],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
    globalSetup: ["tests/support/global-setup.ts"],
    // Generous timeout: the first call in a worker may create auth users via the
    // admin API and establish sessions.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
