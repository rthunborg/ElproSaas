// Lockfile guard (Story 1.1, AC2).
// Fails when a non-pnpm lockfile is committed/present, enforcing the single
// package-manager decision (pnpm, AR2). Node-based so it runs cross-platform
// on the Windows host without a shell dependency.
// Story 1.2 wires this into CI via the `verify:lockfiles` script.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const forbiddenLockfiles = [
  "package-lock.json", // npm
  "npm-shrinkwrap.json", // npm
  "yarn.lock", // yarn
  "bun.lockb", // bun (binary)
  "bun.lock", // bun (text)
  "deno.lock", // deno
];

const requiredLockfile = "pnpm-lock.yaml";

const found = forbiddenLockfiles.filter((name) => existsSync(join(repoRoot, name)));

if (found.length > 0) {
  console.error(
    `❌ Lockfile guard failed: pnpm is the only allowed package manager (AR2).\n` +
      `   Found forbidden lockfile(s): ${found.join(", ")}\n` +
      `   Remove them and use \`pnpm install\` instead.`,
  );
  process.exit(1);
}

const requiredLockfilePath = join(repoRoot, requiredLockfile);

if (!existsSync(requiredLockfilePath)) {
  console.error(
    `❌ Lockfile guard failed: expected \`${requiredLockfile}\` at the repo root but it is missing.\n` +
      `   Run \`pnpm install\` to generate it.`,
  );
  process.exit(1);
}

// Presence alone is not enough: an empty/truncated/corrupt lockfile (e.g. a bad
// merge resolution or a partial checkout) cannot pin dependencies, yet would
// still pass an existence-only check. Require it to be non-empty and to declare
// a `lockfileVersion` so a false green can't slip past the guard.
const requiredLockfileContents = readFileSync(requiredLockfilePath, "utf8").trim();

if (
  requiredLockfileContents.length === 0 ||
  !/^lockfileVersion:/m.test(requiredLockfileContents)
) {
  console.error(
    `❌ Lockfile guard failed: \`${requiredLockfile}\` is present but empty or invalid (no \`lockfileVersion\`).\n` +
      `   Re-run \`pnpm install\` to regenerate a valid lockfile.`,
  );
  process.exit(1);
}

console.log(`✅ Lockfile guard passed: only \`${requiredLockfile}\` is present.`);
