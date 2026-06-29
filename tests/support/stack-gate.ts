/**
 * DX#6 (epic-2 hardening) — make the "local Supabase stack is down" condition a
 * VISIBLE skip, not a vacuous pass.
 *
 * The DB-backed INT/RLS suites historically opened every `it` with
 * `if (!stackUp) return;`. An early `return` makes Vitest report the test as PASSED
 * even though no assertion ran — a misleading vacuous green on a Docker-less dev
 * machine. This helper replaces that `return` with a REAL dynamic skip
 * (`ctx.skip()`), so a stack-down run reports the test as SKIPPED in the reporter
 * instead of green.
 *
 * The `SUPABASE_TEST_REQUIRED=1` hard-fail contract is preserved: when the stack is
 * REQUIRED (CI) a missing stack THROWS here (never skips), exactly as the global
 * setup already enforces — this keeps the gate from ever false-greening, and adds a
 * second, self-contained backstop inside the test body.
 *
 * Usage (inside an `it`/`test` body, taking the Vitest test context):
 *
 *   it("…", (ctx) => {
 *     if (skipUnlessStack(ctx, stackUp)) return; // visible SKIP when stack down
 *     …assertions…
 *   });
 *
 * Returns `true` when the caller should stop (the test was skipped). When the stack
 * IS up it returns `false` and the test proceeds normally.
 */
import { STACK_REQUIRED } from "./test-env";

/** The Vitest dynamic-skip surface we rely on (a subset of `TestContext`). */
export interface SkippableTestContext {
  skip: (note?: string) => void;
}

/**
 * Visibly SKIP the current test when the local stack is unreachable; HARD-FAIL when
 * the stack is required (CI). Returns `true` if the test should stop.
 *
 * @param ctx     the Vitest test context (the `it`/`test` callback argument).
 * @param stackUp whether `isLocalStackReachable()` returned true in `beforeAll`.
 */
export function skipUnlessStack(
  ctx: SkippableTestContext,
  stackUp: boolean,
): boolean {
  if (stackUp) return false;

  if (STACK_REQUIRED) {
    // CI contract: a missing stack must be a HARD failure, never a skip — so the
    // security/RLS gates can never false-green. Mirrors tests/support/global-setup.ts.
    throw new Error(
      "SUPABASE_TEST_REQUIRED=1 but the local Supabase stack is unreachable: this " +
        "DB-backed test MUST run, not skip. Start it first: `supabase start && " +
        "supabase db reset`.",
    );
  }

  // Local dev without Docker: report a VISIBLE skip (not a vacuous pass).
  ctx.skip("local Supabase stack unreachable — DB-backed test skipped (set up the " +
    "stack to run it; SUPABASE_TEST_REQUIRED=1 turns this into a hard failure)");
  return true;
}
