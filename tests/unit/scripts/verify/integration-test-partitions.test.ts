import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createVitest } from "vitest/node";
import integrationConfig from "../../../../vitest.config";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const ddlFile = "tests/integration/jobs/job-runs.int.test.ts";
const configPath = join(root, "vitest.config.ts");
const slash = (value: string) => value.replaceAll("\\", "/");

function integrationFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? integrationFiles(path)
      : /\.(test|spec)\.ts$/.test(entry.name) ? [slash(relative(root, path))] : [];
  }).sort();
}

function assertExactPartition(files: string[], expected: string[]): void {
  assert.equal(new Set(files).size, files.length, "a test file must not execute in both projects");
  assert.deepEqual([...files].sort(), expected, "every integration file must execute exactly once");
}

function assertOrdered(parallel: number, ddl: number): void {
  assert.ok(ddl > parallel, "global audit DDL must follow completion of the parallel group");
}

test("installed Vitest collects every integration file once and preserves required execution settings", async () => {
  // Collection does not execute globalSetup or reach a database. Inspect the actual
  // resolved runner config rather than reimplementing Vitest's glob/inheritance rules.
  const runner = await createVitest("test", { root, config: configPath, watch: false });
  try {
    const specs = await runner.globTestSpecifications();
    const files = specs.map((spec) => slash(relative(root, spec.moduleId)));
    assertExactPartition(files, integrationFiles(join(root, "tests/integration")));
    assert.equal(runner.projects.length, 2);
    const parallel = runner.projects.find((project) => project.name === "integration-parallel");
    const ddl = runner.projects.find((project) => project.name === "integration-audit-ddl");
    assert.ok(parallel && ddl);
    assert.equal((parallel.config as typeof parallel.config & { fileParallelism: boolean }).fileParallelism, true);
    assert.equal((ddl.config as typeof ddl.config & { fileParallelism: boolean }).fileParallelism, false);
    assertOrdered(parallel.config.sequence.groupOrder, ddl.config.sequence.groupOrder);
    assert.deepEqual(specs.filter((spec) => spec.project === ddl).map((spec) => slash(relative(root, spec.moduleId))), [ddlFile]);
    assert.ok(specs.filter((spec) => spec.project === parallel).every((spec) => slash(relative(root, spec.moduleId)) !== ddlFile));
    const setup = runner.config.globalSetup;
    assert.ok((Array.isArray(setup) ? setup : [setup]).some((path) => slash(path).endsWith("tests/support/global-setup.ts")));
    for (const project of runner.projects) {
      assert.equal(project.config.testTimeout, 30_000);
      assert.equal(project.config.hookTimeout, 30_000);
      assert.equal(project.config.retry ?? 0, 0);
      assert.equal(project.config.dangerouslyIgnoreUnhandledErrors, false);
      assert.equal(project.vite.config.resolve.tsconfigPaths, true);
    }
  } finally {
    await runner.close();
  }
});

test("coverage and ordering checks reject duplicate, missing, overlapping, or reversed batches", () => {
  const expected = ["tests/integration/example.int.test.ts", ddlFile].sort();
  assertExactPartition(expected, expected);
  assertOrdered(0, 1);
  assert.throws(() => assertExactPartition([...expected, ddlFile], expected), /both projects/);
  assert.throws(() => assertExactPartition([ddlFile], expected), /exactly once/);
  assert.throws(() => assertOrdered(0, 0), /follow completion/);
  assert.throws(() => assertOrdered(1, 0), /follow completion/);
});

test("installed Vitest finishes parallel teardown first and exposes reversed-group interference", () => {
  const temporary = mkdtempSync(join(tmpdir(), "elpro-integration-order-"));
  try {
    const eventsPath = join(temporary, "events.log");
    const eventsLiteral = JSON.stringify(slash(eventsPath));
    const moduleName = JSON.stringify(slash(join(root, "node_modules/vitest/dist/index.js")));
    for (const [name, delay] of [["parallel-a", 80], ["parallel-b", 20], ["audit-ddl", 0]] as const) {
      writeFileSync(join(temporary, name + ".test.js"), `import { test, afterAll } from ${moduleName};
import { appendFileSync, readFileSync } from "node:fs";
test(${JSON.stringify(name)}, async () => {
  appendFileSync(${eventsLiteral}, ${JSON.stringify(name + ":start\n")});
  if (${JSON.stringify(name)} === "audit-ddl") {
    const events = readFileSync(${eventsLiteral}, "utf8");
    for (const peer of ["parallel-a", "parallel-b"]) {
      if (!events.includes(peer + ":teardown:end")) throw new Error("overlapping audit DDL: " + peer);
    }
  }
  await new Promise(resolve => setTimeout(resolve, ${delay}));
  appendFileSync(${eventsLiteral}, ${JSON.stringify(name + ":end\n")});
});
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 40));
  appendFileSync(${eventsLiteral}, ${JSON.stringify(name + ":teardown:end\n")});
});`);
    }
    // Use the production partition's scheduling settings; replace only discovery
    // with synthetic files and omit its database setup in this scheduler-only probe.
    const projects = integrationConfig.test!.projects!.map((project) => {
      assert.equal(typeof project, "object");
      const entry = project as { test: { name: string; fileParallelism?: boolean; sequence: { groupOrder: number } } };
      return { test: { ...entry.test, maxWorkers: entry.test.fileParallelism === false ? 1 : 2,
        include: [entry.test.name === "integration-audit-ddl" ? "audit-ddl.test.js" : "parallel-*.test.js"] } };
    });
    // The runner loader keeps an OS-temp config from creating a bundle cache
    // above that directory (for example C:/node_modules/.vite-temp on Windows).
    const smokeConfig = join(temporary, "vitest.config.mjs");
    writeFileSync(smokeConfig, `export default ${JSON.stringify({ root: slash(temporary), test: { projects } })};`);
    execFileSync(process.execPath, [join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", smokeConfig, "--configLoader", "runner"],
      { cwd: root, timeout: 30_000, encoding: "utf8", windowsHide: true, stdio: "pipe" });
    const events = readFileSync(eventsPath, "utf8").trim().split("\n");
    const ddlStart = events.indexOf("audit-ddl:start");
    assert.ok(ddlStart >= 0);
    assert.ok(events.indexOf("parallel-a:teardown:end") < ddlStart);
    assert.ok(events.indexOf("parallel-b:teardown:end") < ddlStart);

    // A reversed nonzero order must expose the unavailable shared resource.
    // Nonzero groups avoid Vitest's fallback for a default single-worker group.
    writeFileSync(eventsPath, "");
    for (const project of projects) {
      project.test.sequence = { groupOrder: project.test.name === "integration-audit-ddl" ? 1 : 2 };
    }
    writeFileSync(smokeConfig, `export default ${JSON.stringify({ root: slash(temporary), test: { projects } })};`);
    assert.throws(() => execFileSync(process.execPath,
      [join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", smokeConfig, "--configLoader", "runner"],
      { cwd: root, timeout: 30_000, encoding: "utf8", windowsHide: true, stdio: "pipe" }),
    (error: unknown) => {
      const result = error as { status?: number; stdout?: string; stderr?: string };
      assert.equal(result.status, 1);
      assert.match((result.stdout ?? "") + (result.stderr ?? ""), /overlapping audit DDL/);
      return true;
    });
  } finally {
    assert.equal(dirname(temporary), tmpdir(), "cleanup must stay inside the temporary directory");
    assert.ok(temporary.includes("elpro-integration-order-"));
    rmSync(temporary, { recursive: true, force: true });
  }
});