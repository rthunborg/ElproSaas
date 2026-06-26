// Cross-platform `pnpm test` orchestrator (Story 2.2).
//
// Runs the unit suite (node --test) THEN the integration suite (Vitest), in
// order, in-process via `node` and the local `vitest` binary. A bare-Node `.mjs`
// (project convention) so it needs no extra dependency and does NOT re-shell
// `pnpm` from inside an npm script — which fails on Windows when the script shell
// (cmd.exe) does not have the pnpm install dir on PATH.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = join(
  repoRoot,
  "node_modules",
  "vitest",
  "vitest.mjs",
);

/** Run a command, inheriting stdio; return its exit code (non-zero on failure). */
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    // `shell: false` — pass argv directly so quoting is consistent cross-platform.
    shell: false,
  });
  if (result.error) {
    console.error(`Failed to launch: ${cmd} ${args.join(" ")}`);
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

// 1) Unit suite (pure logic, node --test + TS type-stripping).
const unitCode = run(process.execPath, [
  "--experimental-strip-types",
  "--import",
  "./tests/support/register.mjs",
  "--test",
  "tests/unit/**/*.test.ts",
]);
if (unitCode !== 0) process.exit(unitCode);

// 2) Integration suite (Vitest) — DB-backed; skips itself if the local stack is
//    unreachable (unless SUPABASE_TEST_REQUIRED=1).
const intCode = run(process.execPath, [vitestBin, "run"]);
process.exit(intCode);
