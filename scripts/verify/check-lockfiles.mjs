// Lockfile guard (Story 1.1, AC2).
// Fails when a non-pnpm lockfile is committed/present, enforcing the single
// package-manager decision (pnpm, AR2). Node-based so it runs cross-platform
// on the Windows host without a shell dependency.
// Story 1.2 wires this into CI via the `verify:lockfiles` script.
//
// Story 2.2 (Task 4.3) refactors the guard logic into an EXPORTED, pure
// `checkLockfiles(rootDir)` function so its failure path has a regression unit
// test (the epic-1 highest-priority deferred item) — mirroring the
// `scanForServiceRoleLeak` proof pattern. The CLI behavior (exit codes +
// messages) is unchanged: when run directly it scans the repo root and exits
// non-zero on any violation.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_LOCKFILES = [
  "package-lock.json", // npm
  "npm-shrinkwrap.json", // npm
  "yarn.lock", // yarn
  "bun.lockb", // bun (binary)
  "bun.lock", // bun (text)
  "deno.lock", // deno
];

const REQUIRED_LOCKFILE = "pnpm-lock.yaml";

/**
 * Pure check: inspect `rootDir` for lockfile violations. Returns human-readable
 * violation messages (empty array = clean). Mirrors `scanForServiceRoleLeak`'s
 * shape so it is unit-testable against a temp dir.
 *
 * Violations:
 *   1. any forbidden (non-pnpm) lockfile is present;
 *   2. the required `pnpm-lock.yaml` is missing;
 *   3. `pnpm-lock.yaml` is present but empty/invalid (no `lockfileVersion:`).
 *
 * @returns {{ violations: string[] }}
 */
export function checkLockfiles(rootDir) {
  const violations = [];

  const found = FORBIDDEN_LOCKFILES.filter((name) =>
    existsSync(join(rootDir, name)),
  );
  if (found.length > 0) {
    violations.push(
      `pnpm is the only allowed package manager (AR2). Found forbidden ` +
        `lockfile(s): ${found.join(", ")}. Remove them and use \`pnpm install\`.`,
    );
  }

  const requiredPath = join(rootDir, REQUIRED_LOCKFILE);
  if (!existsSync(requiredPath)) {
    violations.push(
      `expected \`${REQUIRED_LOCKFILE}\` at the root but it is missing. ` +
        `Run \`pnpm install\` to generate it.`,
    );
    // Without the file we cannot inspect its contents — return early.
    return { violations };
  }

  // Presence alone is not enough: an empty/truncated/corrupt lockfile (e.g. a bad
  // merge resolution or a partial checkout) cannot pin dependencies, yet would
  // still pass an existence-only check. Require it to be non-empty and to declare
  // a `lockfileVersion` so a false green can't slip past the guard.
  const contents = readFileSync(requiredPath, "utf8").trim();
  if (contents.length === 0 || !/^lockfileVersion:/m.test(contents)) {
    violations.push(
      `\`${REQUIRED_LOCKFILE}\` is present but empty or invalid (no ` +
        `\`lockfileVersion\`). Re-run \`pnpm install\` to regenerate it.`,
    );
  }

  return { violations };
}

// CLI behavior: when run directly (not imported by a test), scan the repo root
// and exit non-zero on any violation. Compare normalized paths so Windows
// back/forward slashes and drive-letter casing don't break the main-module check.
function normalize(p) {
  return String(p).replace(/\\/g, "/").toLowerCase();
}
const invokedDirectly =
  process.argv[1] &&
  normalize(fileURLToPath(import.meta.url)) === normalize(process.argv[1]);

if (invokedDirectly) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { violations } = checkLockfiles(repoRoot);
  if (violations.length > 0) {
    console.error(
      `❌ Lockfile guard failed:\n` +
        violations.map((v) => `   - ${v}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`✅ Lockfile guard passed: only \`${REQUIRED_LOCKFILE}\` is present.`);
}
