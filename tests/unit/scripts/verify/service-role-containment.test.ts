/**
 * ATDD RED-PHASE SCAFFOLD — Story 2.1, Task 5 + Task 6.3 (R-002).
 *
 * Proves the service-role client-path containment guard "bites": it must go RED when
 * `SUPABASE_SERVICE_ROLE_KEY` is `NEXT_PUBLIC_`-prefixed or referenced from a
 * browser/client path, and GREEN when it is not. This is the automated proof the
 * story owes for the deferred env-contract security rule (deferred-work.md →
 * "Env-contract security rules are prose-only"; epic-1-retro Technical Debt #2).
 *
 * The guard itself (Task 5) is implemented EITHER as:
 *   - a bare-Node `.mjs` script under `scripts/verify/` (mirroring
 *     `scripts/verify/check-lockfiles.mjs`), OR
 *   - an ESLint flat-config rule (no-restricted-syntax / no-restricted-imports).
 * This scaffold is written for the SCRIPT variant (the cited "lighter option that
 * genuinely bites" and consistent with the existing `verify:*` pattern). If the
 * implementer chooses the ESLint variant instead, port the three cases below into a
 * RuleTester fixture — the assertions (red on a planted leak, green when removed) are
 * the contract.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RED PHASE — marked `.skip`; the guard module does not exist yet. Implementer:
 *   1. Create the guard (`scripts/verify/check-service-role-containment.mjs` or the
 *      ESLint rule) and wire it into CI (and into `pnpm lint` if ESLint).
 *   2. Expose it test-importably (e.g. export a `scanForServiceRoleLeak(rootDir)`
 *      function from the .mjs, in addition to the `process.exit(1)` CLI behavior —
 *      mirror how a guard can be both a CLI and a function).
 *   3. Remove `.skip` and make GREEN.
 *
 * RUNNER STATUS: same as the sibling unit scaffold — `pnpm test` is still the
 * placeholder; the runner lands via TEA `testarch-framework`. Vitest-style API
 * (`describe`/`it`/`expect`) assumed; this file is the spec to port if the framework
 * decision differs. Do NOT stand up a runner as a side effect of this scaffold.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// import { scanForServiceRoleLeak } from "../../../../scripts/verify/check-service-role-containment.mjs";

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Scaffold placeholder for the guard's scan function (red phase). */
function scanForServiceRoleLeak(_rootDir: string): { violations: string[] } {
  throw new Error(
    "RED PHASE: scanForServiceRoleLeak is a scaffold placeholder. Implement the " +
      "Task 5 guard (scripts/verify/check-service-role-containment.mjs) and export it.",
  );
}

describe.skip("service-role containment guard (Story 2.1 Task 5 / R-002 — RED PHASE)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "elpro-svc-guard-"));
    mkdirSync(join(root, "src", "app", "(app)"), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("RED: flags a NEXT_PUBLIC_-prefixed service-role env var (key would ship to the browser bundle)", () => {
    writeFileSync(
      join(root, ".env.example"),
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=should-never-exist\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join("\n")).toContain(
      "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it("RED: flags a service-role key referenced from a \"use client\" (browser-reachable) module", () => {
    writeFileSync(
      join(root, "src", "app", "(app)", "leak.tsx"),
      '"use client";\n' +
        "export const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join("\n")).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("GREEN: a clean tree (service-role key only in server-only, non-NEXT_PUBLIC_ paths) yields zero violations", () => {
    // A legitimate server-only reference is allowed; the guard targets client-path /
    // NEXT_PUBLIC_ leakage, not all usage. Story 2.1 itself likely uses NO service
    // role at all (anon key + RLS) — this asserts the happy/clean baseline.
    mkdirSync(join(root, "src", "server", "db"), { recursive: true });
    writeFileSync(
      join(root, "src", "server", "db", "service-client.ts"),
      "// server-only, no 'use client'\n" +
        "export const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n",
    );

    const { violations } = scanForServiceRoleLeak(root);

    expect(violations).toEqual([]);
  });
});
