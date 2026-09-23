import { test } from "node:test";
import assert from "node:assert/strict";

type RunResult = { outcome: "completed" | "partial" | "failed"; cursor?: string; errorSummary?: string };
type RunnerHarness = {
  run(input: Record<string, unknown>): Promise<RunResult>;
  scopes(): string[];
  writes(): unknown[];
};
const redPhaseRunnerHarness = (): RunnerHarness => {
  throw new Error("Story 13.1 runner harness is not implemented yet.");
};

test.skip("[P0] persists a sanitized cursor at an injected chunk or deadline and resumes without a full scan", async () => {
  const runner = redPhaseRunnerHarness();
  const first = await runner.run({
    now: new Date("2026-09-23T00:00:00.000Z"),
    tenants: ["tenant-a", "tenant-b", "tenant-c"],
    chunkSize: 2,
    deadline: new Date("2026-09-23T00:00:01.000Z"),
  });

  assert.equal(first.outcome, "partial");
  assert.ok(first.cursor);
  const resumed = await runner.run({ cursor: first.cursor, tenants: ["tenant-a", "tenant-b", "tenant-c"], chunkSize: 2 });
  assert.notEqual(resumed.cursor, first.cursor);
  assert.ok(runner.writes().length > 0);
});

test.skip("[P0] explicitly tenant-scopes every producer read and write and preserves round-robin fairness", async () => {
  const runner = redPhaseRunnerHarness();
  await runner.run({ tenants: ["tenant-a", "tenant-b"], chunkSize: 2 });

  assert.deepEqual(runner.scopes(), ["tenant-a", "tenant-a", "tenant-b", "tenant-b"]);
});

test.skip("[P1] isolates producer failure into an attributable failed or partial run with bounded sanitized error", async () => {
  const runner = redPhaseRunnerHarness();
  const result = await runner.run({
    tenants: ["tenant-a"],
    producerFailure: new Error(`password=secret ${"x".repeat(2_000)}`),
  });

  assert.match(result.outcome, /failed|partial/);
  assert.match(result.errorSummary ?? "", /\[redacted\]/);
  assert.ok((result.errorSummary?.length ?? 0) <= 256);
});
