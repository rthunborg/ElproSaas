/**
 * Story 2.1, Task 5 + Task 6.3 (R-002) — proves the service-role client-path containment
 * guard "bites": RED when `SUPABASE_SERVICE_ROLE_KEY` is `NEXT_PUBLIC_`-prefixed or
 * referenced from a browser/client (`"use client"`) path, GREEN when it is not. This is
 * the automated proof the story owes for the deferred env-contract security rule
 * (deferred-work.md → "Env-contract security rules are prose-only"; epic-1-retro
 * Technical Debt #2).
 *
 * GREEN PHASE (Story 2.1): the guard now exists
 * (`scripts/verify/check-service-role-containment.mjs`, exporting `scanForServiceRoleLeak`
 * and wired into CI via `verify:service-role-containment`). This suite was authored
 * red-phase against a Vitest-style API; it is ported to the platform `node --test` runner
 * (the dependency-free runner used for Story 2.1's pure-logic suites — no gated test
 * framework added; the assertions are the contract, per tests/README.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanForServiceRoleLeak } from "../../../../scripts/verify/check-service-role-containment.mjs";

function withTempRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "elpro-svc-guard-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("RED: flags a NEXT_PUBLIC_-prefixed service-role env var (would ship to the browser bundle)", () => {
  withTempRoot((root) => {
    writeFileSync(
      join(root, ".env.example"),
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=should-never-exist\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.ok(violations.length > 0, "expected at least one violation");
    assert.ok(
      violations.join("\n").includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
      "violation should name the offending NEXT_PUBLIC_ variable",
    );
  });
});

test('RED: flags a service-role key referenced from a "use client" (browser-reachable) module', () => {
  withTempRoot((root) => {
    mkdirSync(join(root, "src", "app", "(app)"), { recursive: true });
    writeFileSync(
      join(root, "src", "app", "(app)", "leak.tsx"),
      '"use client";\n' +
        "export const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.ok(violations.length > 0, "expected at least one violation");
    assert.match(violations.join("\n"), /SUPABASE_SERVICE_ROLE_KEY/);
  });
});

test('RED: flags the LOCAL_SUPABASE_SERVICE_ROLE_KEY re-export symbol referenced from a "use client" module (2-2 Round-2 LOW)', () => {
  withTempRoot((root) => {
    // The symbol the bare-name check missed: a client module that transitively
    // imported the test-env/factories would reference the ALIAS, not the literal
    // env-var name, and slip past the original guard (Story 2.4, Task 2.2).
    mkdirSync(join(root, "src", "app", "(app)"), { recursive: true });
    writeFileSync(
      join(root, "src", "app", "(app)", "leak-alias.tsx"),
      '"use client";\n' +
        'import { LOCAL_SUPABASE_SERVICE_ROLE_KEY } from "../../../../tests/support/test-env";\n' +
        "export const k = LOCAL_SUPABASE_SERVICE_ROLE_KEY;\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.ok(violations.length > 0, "expected at least one violation");
    assert.match(violations.join("\n"), /LOCAL_SUPABASE_SERVICE_ROLE_KEY/);
  });
});

test("GREEN: the test-env module DECLARING the re-export symbol (not a client module) is NOT flagged", () => {
  withTempRoot((root) => {
    // The legitimate source of the symbol: a server-only test module that EXPORTS
    // LOCAL_SUPABASE_SERVICE_ROLE_KEY. No "use client" → the guard targets client-path
    // leakage only, so this must stay green (it is exactly tests/support/test-env.ts).
    mkdirSync(join(root, "tests", "support"), { recursive: true });
    writeFileSync(
      join(root, "tests", "support", "test-env.ts"),
      "// server-only, no 'use client'\n" +
        "export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =\n" +
        '  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "demo";\n',
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.deepEqual(violations, []);
  });
});

test("GREEN: a server-only service-role reference (no use-client, not NEXT_PUBLIC_) yields zero violations", () => {
  withTempRoot((root) => {
    // A legitimate server-only reference is allowed; the guard targets client-path /
    // NEXT_PUBLIC_ leakage, not all usage. (Story 2.1 itself uses NO service role.)
    mkdirSync(join(root, "src", "server", "db"), { recursive: true });
    writeFileSync(
      join(root, "src", "server", "db", "service-client.ts"),
      "// server-only, no 'use client'\n" +
        "export const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.deepEqual(violations, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.4 Task 2.2 BROADENED scope — the newly-added scanned roots. The guard now
// walks an App-Router `app/**` tree OUTSIDE `src/` and the root `next.config.*`
// (build-time config that can inline `NEXT_PUBLIC_`/`env` values into the client
// bundle). The original suite only planted leaks under `src/**` and `.env.example`,
// so these broadened roots were untested — a regression dropping `app` or
// `next.config.*` from SCANNED_ROOTS/SCANNED_ROOT_FILES would pass silently.
// [deferred-work 2-1 review LOW: scanned-roots scope; this story's named broadening]
// ─────────────────────────────────────────────────────────────────────────────

test('RED: flags a service-role leak in an `app/**` tree OUTSIDE `src/` (broadened root)', () => {
  withTempRoot((root) => {
    // A valid Next.js layout keeps `app/` at the repo root (not under `src/`). The
    // guard must cover it too — Task 2.2 added `app` to SCANNED_ROOTS.
    mkdirSync(join(root, "app", "(app)"), { recursive: true });
    writeFileSync(
      join(root, "app", "(app)", "leak.tsx"),
      '"use client";\n' +
        "export const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.ok(violations.length > 0, "expected at least one violation");
    assert.match(violations.join("\n"), /app\/\(app\)\/leak\.tsx/);
  });
});

test('RED: flags a NEXT_PUBLIC_ service-role var inlined via `next.config.ts` (broadened root-file)', () => {
  withTempRoot((root) => {
    // `next.config.*` can push values into the client bundle through its `env` block,
    // so a NEXT_PUBLIC_ service-role name there is a leak. Task 2.2 added next.config.*
    // to SCANNED_ROOT_FILES.
    writeFileSync(
      join(root, "next.config.ts"),
      "export default {\n" +
        "  env: { NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.X },\n" +
        "};\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.ok(violations.length > 0, "expected at least one violation");
    assert.match(violations.join("\n"), /next\.config\.ts/);
    assert.match(violations.join("\n"), /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  });
});

test("GREEN: a server-only `next.config.ts` with no NEXT_PUBLIC_ service-role var is NOT flagged", () => {
  withTempRoot((root) => {
    // The broadened root must not over-fire on a benign config (no client leak).
    writeFileSync(
      join(root, "next.config.ts"),
      "export default { reactStrictMode: true };\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    assert.deepEqual(violations, []);
  });
});
