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
import { existsSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Resolve the Vitest CLI via the pnpm-managed `.bin` shim rather than reaching
// into Vitest's internal entry file (`node_modules/vitest/vitest.mjs`), which is
// undocumented and could be relocated by a future Vitest release. The `.bin` shim
// is the stable, package-manager-managed contract (review fix 2026-06-26). On
// Windows the shim is `vitest.CMD` and must be launched through a shell.
const isWindows = process.platform === "win32";
const binDir = join(repoRoot, "node_modules", ".bin");
const vitestBin = join(binDir, isWindows ? "vitest.CMD" : "vitest");

/** Run a command, inheriting stdio; return its exit code (non-zero on failure). */
function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...opts,
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
//    unreachable (unless SUPABASE_TEST_REQUIRED=1). Launch the `.bin` shim
//    directly; on Windows the `.CMD` shim requires `shell: true`.
if (!existsSync(vitestBin)) {
  console.error(`Vitest CLI shim not found at ${vitestBin} — run \`pnpm install\`.`);
  process.exit(1);
}
const intCode = run(vitestBin, ["run"], { shell: isWindows });
process.exit(intCode);
