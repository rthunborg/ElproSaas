// Lockfile guard (Story 1.1, AC2).
// Fails when a non-pnpm lockfile is committed/present, enforcing the single
// package-manager decision (pnpm, AR2). Node-based so it runs cross-platform
// on the Windows host without a shell dependency.
// Story 1.2 wires this into CI via the `verify:lockfiles` script.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const forbiddenLockfiles = [
  "package-lock.json", // npm
  "npm-shrinkwrap.json", // npm
  "yarn.lock", // yarn
  "bun.lockb", // bun (binary)
  "bun.lock", // bun (text)
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

if (!existsSync(join(repoRoot, requiredLockfile))) {
  console.error(
    `❌ Lockfile guard failed: expected \`${requiredLockfile}\` at the repo root but it is missing.\n` +
      `   Run \`pnpm install\` to generate it.`,
  );
  process.exit(1);
}

console.log(`✅ Lockfile guard passed: only \`${requiredLockfile}\` is present.`);
