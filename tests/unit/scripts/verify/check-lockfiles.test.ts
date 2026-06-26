/**
 * Story 2.2, Task 4.3 — the highest-priority deferred unit test from the epic-1 retro:
 * the `scripts/verify/check-lockfiles.mjs` guard had NO automated self-test, so its
 * failure path could silently rot. This suite proves the guard "bites": RED when a
 * forbidden (non-pnpm) lockfile is planted or the required `pnpm-lock.yaml` is
 * missing/invalid, GREEN when only a valid `pnpm-lock.yaml` is present.
 *
 * Mirrors the `service-role-containment.test.ts` proof pattern: the guard logic is the
 * exported pure `checkLockfiles(rootDir)` function (refactored in this story so it is
 * import-testable), driven against a temp dir on the platform `node --test` runner
 * (dependency-free — no test framework added; the assertions are the contract).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLockfiles } from "../../../../scripts/verify/check-lockfiles.mjs";

function withTempRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "elpro-lockfile-guard-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const VALID_LOCKFILE = "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n";

test("GREEN: a sole, valid pnpm-lock.yaml yields zero violations", () => {
  withTempRoot((root) => {
    writeFileSync(join(root, "pnpm-lock.yaml"), VALID_LOCKFILE);
    const { violations } = checkLockfiles(root);
    assert.deepEqual(violations, []);
  });
});

test("RED: a planted npm package-lock.json is flagged (forbidden lockfile)", () => {
  withTempRoot((root) => {
    writeFileSync(join(root, "pnpm-lock.yaml"), VALID_LOCKFILE);
    writeFileSync(join(root, "package-lock.json"), "{}\n");
    const { violations } = checkLockfiles(root);
    assert.ok(violations.length > 0, "expected a violation for package-lock.json");
    assert.match(violations.join("\n"), /package-lock\.json/);
  });
});

test("RED: a planted yarn.lock is flagged", () => {
  withTempRoot((root) => {
    writeFileSync(join(root, "pnpm-lock.yaml"), VALID_LOCKFILE);
    writeFileSync(join(root, "yarn.lock"), "# yarn\n");
    const { violations } = checkLockfiles(root);
    assert.match(violations.join("\n"), /yarn\.lock/);
  });
});

test("RED: a planted bun.lock is flagged", () => {
  withTempRoot((root) => {
    writeFileSync(join(root, "pnpm-lock.yaml"), VALID_LOCKFILE);
    writeFileSync(join(root, "bun.lock"), "\n");
    const { violations } = checkLockfiles(root);
    assert.match(violations.join("\n"), /bun\.lock/);
  });
});

test("RED: a missing pnpm-lock.yaml is flagged", () => {
  withTempRoot((root) => {
    const { violations } = checkLockfiles(root);
    assert.ok(violations.length > 0, "expected a missing-lockfile violation");
    assert.match(violations.join("\n"), /missing|expected `pnpm-lock\.yaml`/i);
  });
});

test("RED: an empty pnpm-lock.yaml is flagged (presence is not enough)", () => {
  withTempRoot((root) => {
    writeFileSync(join(root, "pnpm-lock.yaml"), "   \n");
    const { violations } = checkLockfiles(root);
    assert.match(violations.join("\n"), /empty or invalid/i);
  });
});

test("RED: a pnpm-lock.yaml without a lockfileVersion line is flagged (corrupt/partial)", () => {
  withTempRoot((root) => {
    writeFileSync(join(root, "pnpm-lock.yaml"), "settings:\n  foo: bar\n");
    const { violations } = checkLockfiles(root);
    assert.match(violations.join("\n"), /empty or invalid|lockfileVersion/i);
  });
});

test("RED: multiple violations accumulate (forbidden lockfile + missing required)", () => {
  withTempRoot((root) => {
    writeFileSync(join(root, "package-lock.json"), "{}\n");
    const { violations } = checkLockfiles(root);
    // Both the forbidden file and the missing required file are reported.
    assert.ok(violations.length >= 2, "expected at least two violations");
    const joined = violations.join("\n");
    assert.match(joined, /package-lock\.json/);
    assert.match(joined, /missing|expected `pnpm-lock\.yaml`/i);
  });
});
