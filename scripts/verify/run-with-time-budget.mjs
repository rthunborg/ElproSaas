import { spawn } from "node:child_process";

function positiveSeconds(value) {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error("--max-seconds must be a positive integer.");
  return seconds;
}

/** Parse one labelled duration budget and the command which it must bound. */
export function parseTimeBudgetArgs(argv) {
  const separator = argv.indexOf("--");
  if (separator < 0) throw new Error("Supply a command after `--`.");
  const options = argv.slice(0, separator);
  const command = argv.slice(separator + 1);
  let label = null;
  let maxSeconds = null;
  for (let index = 0; index < options.length; index += 2) {
    const option = options[index];
    const value = options[index + 1];
    if (typeof value !== "string") throw new Error(`Missing value for ${option}.`);
    if (option === "--label") label = value;
    else if (option === "--max-seconds") maxSeconds = positiveSeconds(value);
    else throw new Error(`Unknown option ${option}.`);
  }
  if (!label) throw new Error("--label is required.");
  if (maxSeconds === null) throw new Error("--max-seconds is required.");
  if (command.length === 0) throw new Error("Supply a command after `--`.");
  return { label, maxSeconds, command };
}

/** Resolve the package-manager shim without changing the Linux CI command. */
export function executableForPlatform(command, platform = process.platform) {
  return platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
}

export function treeTerminationCommand(pid, platform = process.platform) {
  return platform === "win32"
    ? { command: "taskkill", args: ["/pid", String(pid), "/t", "/f"] }
    : null;
}

/**
 * CI commands such as `pnpm run test:int` have at least one descendant. On
 * Linux the detached child is the process-group leader, so a negative PID
 * signals every member. Windows has no POSIX process groups; taskkill /T owns
 * the equivalent descendant traversal for the shell that launches a .cmd shim.
 */
function terminateProcessTree(child, signal) {
  if (!child.pid) return;
  const windowsCommand = treeTerminationCommand(child.pid);
  if (windowsCommand) {
    const killer = spawn(windowsCommand.command, windowsCommand.args, {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.once("error", () => child.kill(signal));
    killer.once("close", (code) => {
      if (code !== 0) child.kill(signal);
    });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

/** Run a process with an elapsed wall-clock budget, returning a testable outcome. */
export async function runWithTimeBudget({ command, args, maxSeconds, cwd = process.cwd(), env = process.env }) {
  const startedAt = performance.now();
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const executable = executableForPlatform(command);
    const child = spawn(executable, args, {
      cwd,
      env,
      stdio: "inherit",
      // Windows needs cmd.exe to launch a .cmd shim. The CI command remains a
      // direct Linux child process, so shell parsing is never used there.
      shell: process.platform === "win32" && executable.endsWith(".cmd"),
      // The Linux CI child is a process-group leader so an overrun cannot leave
      // Vitest/Playwright descendants running after the package-manager dies.
      detached: process.platform !== "win32",
    });
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...outcome, elapsedMs: performance.now() - startedAt, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`::error::${command} exceeded its ${maxSeconds}s execution budget.`);
      terminateProcessTree(child, "SIGTERM");
      const forceKill = setTimeout(() => terminateProcessTree(child, "SIGKILL"), 5_000);
      forceKill.unref();
    }, maxSeconds * 1_000);
    child.once("error", (error) => finish({ exitCode: 1, error }));
    child.once("close", (code, signal) => finish({ exitCode: code ?? 1, signal }));
  });
}

const invokedDirectly = process.argv[1] && new URL(import.meta.url).pathname.replaceAll("/", "\\").endsWith(process.argv[1].replaceAll("/", "\\"));
if (invokedDirectly) {
  try {
    const parsed = parseTimeBudgetArgs(process.argv.slice(2));
    const [command, ...args] = parsed.command;
    const result = await runWithTimeBudget({ command, args, maxSeconds: parsed.maxSeconds });
    const elapsedSeconds = (result.elapsedMs / 1_000).toFixed(2);
    if (result.timedOut) {
      console.error(`${parsed.label} exceeded ${parsed.maxSeconds}s after ${elapsedSeconds}s.`);
      process.exitCode = 1;
    } else if (result.exitCode !== 0) {
      console.error(`${parsed.label} failed with exit code ${result.exitCode} after ${elapsedSeconds}s.`);
      process.exitCode = result.exitCode;
    } else {
      console.log(`${parsed.label} completed in ${elapsedSeconds}s (budget ${parsed.maxSeconds}s).`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
