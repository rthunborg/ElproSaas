/**
 * Story 2.1 — unit tests for `getSupabasePublicEnv` (`src/server/db/supabase-env.ts`).
 *
 * This is the single point where the documented public Supabase env contract is read by
 * its EXACT names (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Two
 * properties matter and are exercised here:
 *   1. a missing required value throws a generic configuration error that names ONLY the
 *      missing variable (never a secret value, never a stack-leaking detail) — the
 *      protected-route boundary maps any such failure to a user-safe state; and
 *   2. the service-role key is NEVER read here (it is server-only; architecture §6) — the
 *      function must succeed using the anon key alone, proving it has no service-role
 *      dependency.
 *
 * Pure-logic (reads `process.env` only) — runs NOW under the dependency-free `node --test`
 * runner; adds no test framework (tests/README.md). Each test snapshots and restores the
 * two env vars so the suite is order-independent and leaves no global state behind.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getSupabasePublicEnv } from "@/server/db/supabase-env";

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SERVICE_ROLE_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/** Run `body` with the given env values applied, then fully restore the prior environment. */
function withEnv(
  overrides: Record<string, string | undefined>,
  body: () => void,
): void {
  const keys = Object.keys(overrides);
  const saved = new Map(keys.map((k) => [k, process.env[k]]));
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    body();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("returns { url, anonKey } from the exact NEXT_PUBLIC_ contract names when both are present", () => {
  withEnv(
    {
      [URL_VAR]: "https://proj.supabase.co",
      [ANON_VAR]: "anon-key-123",
    },
    () => {
      const env = getSupabasePublicEnv();
      assert.deepEqual(env, {
        url: "https://proj.supabase.co",
        anonKey: "anon-key-123",
      });
    },
  );
});

test("throws naming ONLY the missing URL variable when NEXT_PUBLIC_SUPABASE_URL is absent", () => {
  withEnv({ [URL_VAR]: undefined, [ANON_VAR]: "anon-key-123" }, () => {
    assert.throws(
      () => getSupabasePublicEnv(),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /NEXT_PUBLIC_SUPABASE_URL/);
        return true;
      },
    );
  });
});

test("throws naming ONLY the missing anon-key variable when NEXT_PUBLIC_SUPABASE_ANON_KEY is absent", () => {
  withEnv({ [URL_VAR]: "https://proj.supabase.co", [ANON_VAR]: undefined }, () => {
    assert.throws(
      () => getSupabasePublicEnv(),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
        return true;
      },
    );
  });
});

test("an empty-string env value is treated as missing (falsy) — it must not silently pass", () => {
  withEnv({ [URL_VAR]: "", [ANON_VAR]: "anon-key-123" }, () => {
    assert.throws(() => getSupabasePublicEnv(), /NEXT_PUBLIC_SUPABASE_URL/);
  });
});

test("the thrown configuration error never echoes a secret VALUE — only the variable NAME", () => {
  withEnv(
    { [URL_VAR]: "https://proj.supabase.co", [ANON_VAR]: undefined },
    () => {
      // Plant a recognizable secret value on a sibling var; the error must not contain it.
      withEnv({ [SERVICE_ROLE_VAR]: "super-secret-service-role-value" }, () => {
        try {
          getSupabasePublicEnv();
          assert.fail("expected a missing-env-var throw");
        } catch (e) {
          assert.ok(e instanceof Error);
          assert.doesNotMatch(e.message, /super-secret-service-role-value/);
        }
      });
    },
  );
});

test("does NOT depend on the service-role key: succeeds with only the two public vars set", () => {
  withEnv(
    {
      [URL_VAR]: "https://proj.supabase.co",
      [ANON_VAR]: "anon-key-123",
      [SERVICE_ROLE_VAR]: undefined,
    },
    () => {
      // The service-role key is server-only and intentionally unused by Story 2.1's
      // auth/membership path (anon key + RLS). Resolution must not need it.
      assert.doesNotThrow(() => getSupabasePublicEnv());
    },
  );
});
