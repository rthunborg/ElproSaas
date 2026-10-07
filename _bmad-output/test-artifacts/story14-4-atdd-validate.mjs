/** Bounded RED scaffold checks. No service/browser startup or database writes. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = "C:/DEV/ElproSaas";
const artifacts = path.join(root, "_bmad-output/test-artifacts");
const workerPaths = ["api", "e2e", "component"].map((kind) =>
  path.join(artifacts, `tea-atdd-${kind}-tests-14-4-2026-10-07.json`));
const workers = workerPaths.map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
for (const worker of workers) {
  if (!worker.success || worker.tdd_phase !== "RED") throw new Error("Invalid worker output");
  for (const test of worker.tests) {
    if (!test.expected_to_fail || !/test(?:\.skip\(|\([\s\S]*?skip: true)/.test(test.content)
      || /expect\(true\)\.toBe\(true\)|test\.only\(/.test(test.content)) {
      throw new Error(`Invalid RED scaffold: ${test.file}`);
    }
  }
}
const tests = workers.flatMap((worker) => worker.tests);
const fixtures = workers.flatMap((worker) => worker.fixture_files ?? []);
const files = [...tests, ...fixtures];
if (new Set(files.map((file) => file.file)).size !== files.length) throw new Error("Duplicate output ownership");

const mode = process.argv[2];
if (mode === "aggregate") {
  for (const file of files) {
    const target = path.resolve(root, file.file);
    if (!target.startsWith(path.resolve(root, "tests") + path.sep)) throw new Error("Output outside tests");
    if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing file: ${file.file}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content, "utf8");
  }
  const summary = { phase: "RED", totalScaffolds: workers.reduce((n, worker) => n + worker.test_count, 0),
    workers: workers.map((worker) => ({ name: worker.subagent, count: worker.test_count })),
    testFiles: tests.map((file) => ({ path: file.file, lines: file.content.split("\n").length,
      priorities: file.priority_coverage })), fixtureFiles: fixtures.map((file) => file.file),
    allSkipped: true, executed: 0, behavioralCoverage: false };
  fs.writeFileSync(path.join(artifacts, "tea-atdd-summary-14-4-2026-10-07.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary));
} else if (mode === "verify") {
  const env = { ...process.env };
  // Owner-approved existing PRIVATE local fixture; values never printed or argv.
  const fixturePath = "C:/Users/Rasmus/.codex/worktrees/epic14-scheduling/guard-compose-01a0ecb9-r4/.env.test";
  for (const line of fs.readFileSync(fixturePath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  env.SUPABASE_TEST_URL = "http://127.0.0.1:55421";
  env.SUPABASE_TEST_DB_URL = `postgresql://postgres:${encodeURIComponent(env.POSTGRES_PASSWORD ?? "")}@127.0.0.1:55422/postgres`;
  env.SUPABASE_TEST_ANON_KEY = env.ANON_KEY;
  env.SUPABASE_TEST_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
  env.SUPABASE_TEST_REQUIRED = "1";
  if (!env.POSTGRES_PASSWORD || !env.SUPABASE_TEST_ANON_KEY || !env.SUPABASE_TEST_SERVICE_ROLE_KEY
    || new URL(env.SUPABASE_TEST_URL).port !== "55421" || new URL(env.SUPABASE_TEST_DB_URL).port !== "55422") {
    throw new Error("Required isolated local test configuration is unavailable");
  }
  const checks = [
    ["registration-integration", ["node_modules/vitest/vitest.mjs", "run", "tests/integration/commands/booking-editor.int.test.ts", "tests/integration/components/booking-editor.test.ts"]],
    ["registration-unit", ["--experimental-strip-types", "--import", "./tests/support/register.mjs", "--test", "tests/unit/features/resources/booking-editor-input.test.ts", "tests/unit/scope/booking-editor-scope.test.ts"]],
    ["registration-browser", ["node_modules/@playwright/test/cli.js", "test", "tests/e2e/booking-editor.e2e.spec.ts", "--list"]],
    ["typecheck", ["node_modules/typescript/bin/tsc", "--noEmit"]],
    ["lint", ["node_modules/eslint/bin/eslint.js", ...files.map((file) => file.file)]],
  ];
  const results = [];
  for (const [name, args] of checks) {
    const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: "utf8", timeout: 120_000 });
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    fs.writeFileSync(path.join(artifacts, `story14-4-atdd-${name}.txt`), output, "utf8");
    console.log(name + " nativeExit=" + result.status + "\n" + output);
    results.push({ name, nativeExit: result.status, signal: result.signal, error: result.error?.code });
  }
  fs.writeFileSync(path.join(artifacts, "story14-4-atdd-check-results.json"), JSON.stringify(results, null, 2) + "\n");
  if (results.some((result) => result.nativeExit !== 0)) process.exitCode = 1;
} else if (mode === "probe") {
  const probes = [
    ["api", "const m=await import('./tests/support/booking-editor-atdd.ts');await m.loadBookingEditorBindings();"],
    ["component-input", "const m=await import('./tests/support/booking-editor-contract.ts');m.binding('Editor');"],
  ];
  const results = probes.map(([name, code]) => {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--import", "./tests/support/register.mjs", "--input-type=module", "-e", code],
      { cwd: root, env: process.env, encoding: "utf8", timeout: 10_000 });
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    fs.writeFileSync(path.join(artifacts, `story14-4-atdd-binding-probe-${name}.txt`), output, "utf8");
    const expected = result.status === 1 && output.includes("14.4 RED:");
    console.log(JSON.stringify({ name, nativeExit: result.status, expectedMissingBinding: expected }));
    return { name, nativeExit: result.status, expectedMissingBinding: expected };
  });
  fs.writeFileSync(path.join(artifacts, "story14-4-atdd-binding-probes.json"), JSON.stringify(results, null, 2) + "\n");
  if (results.some((result) => !result.expectedMissingBinding)) process.exitCode = 1;
} else throw new Error("Use aggregate, verify or probe");
