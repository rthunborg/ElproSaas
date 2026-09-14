import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executableForPlatform, parseTimeBudgetArgs, runWithTimeBudget, treeTerminationCommand } from "../../../../scripts/verify/run-with-time-budget.mjs";

async function waitUntilStopped(pid: number, deadline = Date.now() + 1_000): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

test("time-budget runner parses a labelled command and rejects an incomplete budget", () => {
  assert.deepEqual(
    parseTimeBudgetArgs(["--label", "unit", "--max-seconds", "180", "--", "node", "--version"]),
    { label: "unit", maxSeconds: 180, command: ["node", "--version"] },
  );
  assert.throws(() => parseTimeBudgetArgs(["--label", "unit", "--", "node"]), /--max-seconds is required/);
  assert.throws(() => parseTimeBudgetArgs(["--label", "unit", "--max-seconds", "0", "--", "node"]), /positive integer/);
});

test("time-budget runner resolves the Windows pnpm shim without changing Linux CI", () => {
  assert.equal(executableForPlatform("pnpm", "win32"), "pnpm.cmd");
  assert.equal(executableForPlatform("pnpm", "linux"), "pnpm");
  assert.equal(executableForPlatform("node", "win32"), "node");
  assert.deepEqual(treeTerminationCommand(123, "win32"), { command: "taskkill", args: ["/pid", "123", "/t", "/f"] });
  assert.equal(treeTerminationCommand(123, "linux"), null);
});

test("time-budget runner preserves a child failure before its budget expires", async () => {
  const result = await runWithTimeBudget({
    command: process.execPath,
    args: ["-e", "process.exit(7)"],
    maxSeconds: 2,
  });

  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 7);
});

test("time-budget runner terminates a process that exceeds its ceiling", async () => {
  const result = await runWithTimeBudget({
    command: process.execPath,
    args: ["-e", "setTimeout(() => process.exit(0), 1000)"],
    maxSeconds: 0.05,
  });

  assert.equal(result.timedOut, true);
});

test("time-budget runner terminates a command tree, including a package-manager-style grandchild", async () => {
  // The local agent sandbox may prohibit taskkill even for a child it created.
  // CI runs the real descendant test on Linux; this Windows branch still pins
  // the portable taskkill /T contract above without leaking a test process.
  if (process.platform === "win32") return;
  const directory = await mkdtemp(join(tmpdir(), "elpro-time-budget-"));
  const pidFile = join(directory, "grandchild.pid");
  try {
    const parentProgram = [
      "const { spawn } = require('node:child_process');",
      "const { writeFileSync } = require('node:fs');",
      "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
      "writeFileSync(process.argv[1], String(child.pid));",
      "setInterval(() => {}, 1000);",
    ].join(" ");
    const result = await runWithTimeBudget({
      command: process.execPath,
      args: ["-e", parentProgram, pidFile],
      maxSeconds: 0.1,
    });
    const grandchildPid = Number((await readFile(pidFile, "utf8")).trim());

    assert.equal(result.timedOut, true);
    assert.equal(Number.isSafeInteger(grandchildPid), true);
    assert.equal(await waitUntilStopped(grandchildPid), true, "the grandchild must not outlive the timed-out command");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
