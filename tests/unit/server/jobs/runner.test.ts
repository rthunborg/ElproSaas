import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeCursor, runDueProducers, sanitizeJobError, type JobRunRecord } from "@/server/jobs/runner";
import type { ProducerDeclaration } from "@/server/jobs/producers";
const producer = { id: "notifications.reminder", module: "notifications", category: "quote.reminder", schedule: "*/5 * * * *", essential: false };
const dueWindow = new Date("2026-09-23T12:00:00.000Z");
test("[P0] persists a cursor at a deterministic chunk and resumes tenant order", async () => {
  const writes: JobRunRecord[] = [];
  const deps = { listTenantIds: async () => ["tenant-a", "tenant-b", "tenant-c"], execute: async () => undefined, record: async (record: JobRunRecord) => { writes.push(record); } };
  const first = await runDueProducers(deps, { producers: [producer], chunkSize: 2, windowStartedAt: dueWindow });
  assert.equal(first.outcome, "partial"); assert.ok(first.cursor);
  const second = await runDueProducers(deps, { producers: [producer], cursor: first.cursor, chunkSize: 2, windowStartedAt: dueWindow });
  assert.equal(second.outcome, "completed"); assert.deepEqual(writes.filter((write) => write.producer === producer.id).map((write) => write.tenantId), ["tenant-a", "tenant-b", "tenant-c"]);
});
test("[P0] an injected deadline persists cursor zero before the first tenant work", async () => {
  const writes: JobRunRecord[] = [];
  let executeCalls = 0;
  const deadline = new Date("2026-09-23T12:00:00.000Z");
  const result = await runDueProducers({
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    execute: async () => { executeCalls += 1; },
    record: async (record: JobRunRecord) => { writes.push(record); },
    now: () => deadline,
  }, { producers: [producer], deadline });
  assert.deepEqual(result, { outcome: "partial", cursor: encodeCursor(0, 0, [producer.id]) });
  assert.equal(executeCalls, 0);
  assert.deepEqual(writes, [{
    tenantId: "tenant-a",
    producer: "jobs.runner",
    outcome: "partial",
    cursor: encodeCursor(0, 0, [producer.id]),
    windowStartedAt: "2026-09-23T12:00:00.000Z",
    startedAt: "2026-09-23T12:00:00.000Z",
    finishedAt: "2026-09-23T12:00:00.000Z",
  }]);
});
test("[P0] a non-empty registry with no tenants completes without creating an invalid run record", async () => {
  const writes: JobRunRecord[] = [];
  const result = await runDueProducers({
    listTenantIds: async () => [],
    execute: async () => { throw new Error("must not execute"); },
    record: async (record) => { writes.push(record); },
  }, { producers: [producer] });
  assert.deepEqual(result, { outcome: "completed" });
  assert.deepEqual(writes, []);
});
test("[P0] a failed producer still returns a resumable partial cursor when work remains", async () => {
  const writes: JobRunRecord[] = [];
  const result = await runDueProducers({
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    execute: async () => { throw new Error("producer failed"); },
    record: async (record) => { writes.push(record); },
  }, { producers: [producer], chunkSize: 1, windowStartedAt: dueWindow });
  assert.equal(result.outcome, "partial");
  assert.ok(result.cursor);
  assert.equal(writes.at(-1)?.outcome, "partial");
});
test("[P1] isolates a producer failure with a bounded sanitized summary", async () => {
  const writes: JobRunRecord[] = [];
  await runDueProducers({ listTenantIds: async () => ["tenant-a"], execute: async () => { throw new Error(`password=secret ${"x".repeat(400)}`); }, record: async (record) => { writes.push(record); } }, { producers: [producer], windowStartedAt: dueWindow });
  assert.equal(writes[0]?.outcome, "failed"); assert.match(writes[0]?.errorSummary ?? "", /password=\[redacted\]/); assert.ok((writes[0]?.errorSummary?.length ?? 0) <= 256);
  assert.equal((await runDueProducers({ listTenantIds: async () => ["tenant-a", "tenant-b"], execute: async (_producer, tenantId) => { if (tenantId === "tenant-a") throw new Error("Authorization: Bearer secret-token token=raw https://x.test/?api_key=raw"); }, record: async (record) => { writes.push(record); } }, { producers: [producer], windowStartedAt: dueWindow })).outcome, "failed");
  assert.doesNotMatch(writes.findLast((write) => write.outcome === "failed")?.errorSummary ?? "", /secret-token|token=raw|api_key=raw/);
  assert.equal(sanitizeJobError("secret=x"), "Background producer failed");
  assert.doesNotMatch(sanitizeJobError(new Error("postgres://user:password@example.test/db")), /user:password/);
});

test("[P0] producer checkpoints resume a large tenant while each invocation still advances later tenants", async () => {
  const writes: JobRunRecord[] = [];
  const latest = new Map<string, JobRunRecord>();
  const calls: string[] = [];
  const deps = {
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    loadProducerCursor: async (_producer: ProducerDeclaration, tenantId: string) => {
      const record = latest.get(tenantId);
      return record?.outcome === "partial" ? record.cursor : undefined;
    },
    execute: async (_producer: ProducerDeclaration, tenantId: string, cursor?: string) => {
      calls.push(`${tenantId}:${cursor ?? "start"}`);
      if (tenantId === "tenant-a" && cursor !== "page-2") return { cursor: cursor ? "page-2" : "page-1" };
    },
    record: async (record: JobRunRecord) => {
      writes.push(record);
      if (record.producer === producer.id) latest.set(record.tenantId, record);
    },
  };

  let cursor: string | undefined;
  for (let invocation = 0; invocation < 3; invocation += 1) {
    const result = await runDueProducers(deps, { producers: [producer], cursor, windowStartedAt: dueWindow });
    cursor = result.cursor;
  }

  assert.deepEqual(calls, [
    "tenant-a:start", "tenant-b:start",
    "tenant-a:page-1", "tenant-b:start",
    "tenant-a:page-2", "tenant-b:start",
  ]);
  assert.equal(writes.filter((record) => record.producer === producer.id && record.tenantId === "tenant-a" && record.outcome === "partial").length, 2);
  assert.equal(cursor, undefined);
});

test("[P0] a producer failure preserves its prior checkpoint while later tenants continue", async () => {
  const writes: JobRunRecord[] = [];
  const latest = new Map<string, JobRunRecord>();
  const calls: string[] = [];
  let tenantAFailed = false;
  const deps = {
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    loadProducerCursor: async (_producer: ProducerDeclaration, tenantId: string) => {
      const record = latest.get(tenantId);
      return (record?.outcome === "partial" || record?.outcome === "failed") ? record.cursor : undefined;
    },
    execute: async (_producer: ProducerDeclaration, tenantId: string, cursor?: string) => {
      calls.push(`${tenantId}:${cursor ?? "start"}`);
      if (tenantId !== "tenant-a") return;
      if (!cursor) return { cursor: "after-page-1" };
      if (!tenantAFailed) {
        tenantAFailed = true;
        throw new Error("later page aborted");
      }
    },
    record: async (record: JobRunRecord) => {
      writes.push(record);
      if (record.producer === producer.id) latest.set(record.tenantId, record);
    },
  };

  await runDueProducers(deps, { producers: [producer], windowStartedAt: dueWindow });
  await runDueProducers(deps, { producers: [producer], windowStartedAt: dueWindow });
  await runDueProducers(deps, { producers: [producer], windowStartedAt: dueWindow });

  assert.deepEqual(calls, [
    "tenant-a:start", "tenant-b:start",
    "tenant-a:after-page-1", "tenant-b:start",
    "tenant-a:after-page-1", "tenant-b:start",
  ]);
  const failure = writes.find((record) => record.producer === producer.id && record.outcome === "failed");
  assert.equal(failure?.cursor, "after-page-1");
  assert.equal(failure?.errorSummary, "later page aborted");
});

test("[P0] a deadline between producers resumes at the next producer instead of replaying earlier work", async () => {
  const secondProducer = { ...producer, id: "notifications.second" };
  const calls: string[] = [];
  const writes: JobRunRecord[] = [];
  const started = new Date("2026-09-27T12:00:00.000Z");
  let elapsedMs = 0;
  const dependencies = {
    listTenantIds: async () => ["tenant-a"],
    execute: async (candidate: ProducerDeclaration) => {
      calls.push(candidate.id);
      if (candidate.id === producer.id) elapsedMs = 100;
    },
    record: async (record: JobRunRecord) => { writes.push(record); },
    now: () => new Date(started.getTime() + elapsedMs),
  };

  const first = await runDueProducers(dependencies, {
    producers: [producer, secondProducer],
    deadline: new Date(started.getTime() + 50),
    windowStartedAt: started,
  });
  assert.equal(first.outcome, "partial");
  assert.deepEqual(calls, [producer.id]);

  elapsedMs = 0;
  const second = await runDueProducers(dependencies, {
    producers: [producer, secondProducer],
    cursor: first.cursor,
    deadline: new Date(started.getTime() + 1_000),
    windowStartedAt: started,
  });
  assert.equal(second.outcome, "completed");
  assert.deepEqual(calls, [producer.id, secondProducer.id]);
});

test("[P0] runs only injected-clock due producers and creates no producer or runner record on a fresh off-schedule tick", async () => {
  const hourly = { ...producer, id: "quotes.hourly", schedule: "0 * * * *" };
  const fiveMinute = { ...producer, id: "notifications.five-minute", schedule: "*/5 * * * *" };
  const offScheduleWrites: JobRunRecord[] = [];
  const offScheduleCalls: string[] = [];
  const offSchedule = await runDueProducers({
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    loadProducerCursor: async () => undefined,
    execute: async (candidate) => { offScheduleCalls.push(candidate.id); },
    record: async (record) => { offScheduleWrites.push(record); },
  }, { producers: [hourly], windowStartedAt: new Date("2026-09-27T12:05:00.000Z") });
  assert.deepEqual(offSchedule, { outcome: "completed" });
  assert.deepEqual(offScheduleCalls, []);
  assert.deepEqual(offScheduleWrites, []);

  const calls: string[] = [];
  await runDueProducers({
    listTenantIds: async () => ["tenant-a"],
    execute: async (candidate) => { calls.push(candidate.id); },
    record: async () => undefined,
  }, { producers: [hourly, fiveMinute], windowStartedAt: new Date("2026-09-27T12:00:00.000Z") });
  assert.deepEqual(calls, [hourly.id, fiveMinute.id]);
});

test("[P0] budgeted off-schedule scans resume until they reach a later producer checkpoint", async () => {
  const hourlyA = { ...producer, id: "quotes.hourly-a", schedule: "0 * * * *" };
  const hourlyB = { ...producer, id: "quotes.hourly-b", schedule: "0 * * * *" };
  const tenants = Array.from({ length: 4 }, (_, index) => `tenant-${index}`);
  const loads: string[] = [];
  const writes: JobRunRecord[] = [];
  const calls: string[] = [];
  let invocationStart = new Date("2026-09-27T12:05:00.000Z");
  let elapsedMs = 0;
  const deps = {
    listTenantIds: async () => tenants,
    loadProducerCursor: async (candidate: ProducerDeclaration, tenantId: string) => {
      loads.push(`${tenantId}:${candidate.id}`);
      elapsedMs += 10;
      return tenantId === "tenant-3" && candidate.id === hourlyB.id ? "saved-page" : undefined;
    },
    execute: async (candidate: ProducerDeclaration, tenantId: string, cursor?: string) => { calls.push(`${tenantId}:${candidate.id}:${cursor ?? "start"}`); },
    record: async (record: JobRunRecord) => { writes.push(record); },
    now: () => new Date(invocationStart.getTime() + elapsedMs),
  };
  const run = async (cursor?: string) => {
    elapsedMs = 0;
    const started = invocationStart;
    const result = await runDueProducers(deps, {
      producers: [hourlyA, hourlyB],
      cursor,
      windowStartedAt: started,
      deadline: new Date(started.getTime() + 25),
    });
    invocationStart = new Date(invocationStart.getTime() + 5 * 60_000);
    return result;
  };

  const first = await run();
  const second = await run(first.cursor);
  const third = await run(second.cursor);

  assert.deepEqual(first, { outcome: "partial", cursor: encodeCursor(1, 1) });
  assert.deepEqual(second, { outcome: "partial", cursor: encodeCursor(3, 0) });
  assert.deepEqual(third, { outcome: "completed" });
  assert.equal(loads.length, 8);
  assert.deepEqual(calls, ["tenant-3:quotes.hourly-b:saved-page"]);
  assert.deepEqual(writes.filter((record) => record.producer === "jobs.runner").map((record) => record.outcome), ["partial", "partial", "completed"]);
});

test("[P0] an off-schedule producer checkpoint found at the deadline resumes at the same tuple", async () => {
  const hourlyA = { ...producer, id: "quotes.hourly-a", schedule: "0 * * * *" };
  const hourlyB = { ...producer, id: "quotes.hourly-b", schedule: "0 * * * *" };
  const tenants = ["tenant-a", "tenant-b", "tenant-c", "tenant-d"];
  const writes: JobRunRecord[] = [];
  const calls: string[] = [];
  const started = new Date("2026-09-27T12:05:00.000Z");
  let elapsedMs = 0;
  const deps = {
    listTenantIds: async () => tenants,
    loadProducerCursor: async (candidate: ProducerDeclaration, tenantId: string) => {
      elapsedMs += 10;
      return tenantId === "tenant-b" && candidate.id === hourlyA.id ? "saved-page" : undefined;
    },
    execute: async (candidate: ProducerDeclaration, tenantId: string, cursor?: string) => {
      calls.push(`${tenantId}:${candidate.id}:${cursor ?? "start"}`);
    },
    record: async (record: JobRunRecord) => { writes.push(record); },
    now: () => new Date(started.getTime() + elapsedMs),
  };

  const first = await runDueProducers(deps, {
    producers: [hourlyA, hourlyB],
    windowStartedAt: started,
    deadline: new Date(started.getTime() + 25),
  });
  assert.deepEqual(first, { outcome: "partial", cursor: encodeCursor(1, 0) });
  assert.deepEqual(calls, []);
  assert.equal(writes.at(-1)?.producer, "jobs.runner");
  assert.equal(writes.at(-1)?.outcome, "partial");

  const second = await runDueProducers(deps, {
    producers: [hourlyA, hourlyB],
    cursor: first.cursor,
    windowStartedAt: new Date("2026-09-27T12:10:00.000Z"),
  });
  assert.deepEqual(second, { outcome: "completed" });
  assert.deepEqual(calls, ["tenant-b:quotes.hourly-a:saved-page"]);
  assert.equal(writes.at(-1)?.producer, "jobs.runner");
  assert.equal(writes.at(-1)?.outcome, "completed");
});

test("[P0] a newly due window restarts ahead of an explicit empty scan cursor", async () => {
  const hourly = { ...producer, id: "quotes.hourly", schedule: "0 * * * *" };
  const calls: string[] = [];
  const result = await runDueProducers({
    listTenantIds: async () => ["tenant-a", "tenant-b", "tenant-c", "tenant-d"],
    loadProducerCursor: async () => undefined,
    execute: async (_candidate, tenantId) => { calls.push(tenantId); },
    record: async () => undefined,
  }, {
    producers: [hourly],
    cursor: encodeCursor(2),
    windowStartedAt: new Date("2026-09-27T13:00:00.000Z"),
  });
  assert.deepEqual(result, { outcome: "completed" });
  assert.deepEqual(calls, ["tenant-a", "tenant-b", "tenant-c", "tenant-d"]);
});

test("[P0] a legacy global cursor still authorizes only its exact off-schedule tuple", async () => {
  const hourly = { ...producer, id: "quotes.hourly", schedule: "0 * * * *" };
  const calls: string[] = [];
  const legacyCursor = Buffer.from(JSON.stringify({ nextIndex: 1 }), "utf8").toString("base64url");
  const result = await runDueProducers({
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    loadProducerCursor: async () => undefined,
    execute: async (_candidate, tenantId, cursor) => { calls.push(`${tenantId}:${cursor ?? "start"}`); },
    record: async () => undefined,
  }, {
    producers: [hourly],
    cursor: legacyCursor,
    windowStartedAt: new Date("2026-09-27T12:05:00.000Z"),
  });
  assert.deepEqual(result, { outcome: "completed" });
  assert.deepEqual(calls, ["tenant-b:start"]);
});

test("[P0] global and producer checkpoints resume hourly work across an off-schedule minute without starving later tenants", async () => {
  const hourly = { ...producer, id: "quotes.hourly", schedule: "0 * * * *" };
  const writes: JobRunRecord[] = [];
  const latest = new Map<string, JobRunRecord>();
  const calls: string[] = [];
  let firstTenantPartial = true;
  const deps = {
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    loadProducerCursor: async (_candidate: ProducerDeclaration, tenantId: string) => {
      const record = latest.get(tenantId);
      return (record?.outcome === "partial" || record?.outcome === "failed") ? record.cursor : undefined;
    },
    execute: async (_candidate: ProducerDeclaration, tenantId: string, cursor?: string) => {
      calls.push(`${tenantId}:${cursor ?? "start"}`);
      if (tenantId === "tenant-a" && firstTenantPartial) {
        firstTenantPartial = false;
        return { cursor: "after-page-1" };
      }
    },
    record: async (record: JobRunRecord) => { writes.push(record); if (record.producer === hourly.id) latest.set(record.tenantId, record); },
  };
  const first = await runDueProducers(deps, { producers: [hourly], chunkSize: 1, windowStartedAt: new Date("2026-09-27T12:00:00.000Z") });
  const second = await runDueProducers(deps, { producers: [hourly], cursor: first.cursor, chunkSize: 1, windowStartedAt: new Date("2026-09-27T12:05:00.000Z") });
  const third = await runDueProducers(deps, { producers: [hourly], chunkSize: 1, windowStartedAt: new Date("2026-09-27T12:10:00.000Z") });
  assert.equal(first.outcome, "partial");
  assert.equal(second.outcome, "completed");
  assert.equal(third.outcome, "completed");
  assert.deepEqual(calls, ["tenant-a:start", "tenant-b:start", "tenant-a:after-page-1"]);
  assert.equal(writes.find((record) => record.tenantId === "tenant-a" && record.outcome === "completed")?.cursor, undefined);
});

test("[P0] a deadline during off-schedule global continuation retains the original due producer snapshot", async () => {
  const hourly = { ...producer, id: "quotes.hourly", schedule: "0 * * * *" };
  const calls: string[] = [];
  const writes: JobRunRecord[] = [];
  let clock = new Date("2026-09-27T12:00:00.000Z");
  const deps = {
    listTenantIds: async () => ["tenant-a"],
    execute: async (candidate: ProducerDeclaration) => { calls.push(candidate.id); },
    record: async (record: JobRunRecord) => { writes.push(record); },
    now: () => clock,
  };
  const first = await runDueProducers(deps, { producers: [hourly], windowStartedAt: clock, deadline: clock });
  clock = new Date("2026-09-27T12:05:00.000Z");
  const second = await runDueProducers(deps, { producers: [hourly], cursor: first.cursor, windowStartedAt: clock, deadline: clock });
  clock = new Date("2026-09-27T12:10:00.000Z");
  const third = await runDueProducers(deps, { producers: [hourly], cursor: second.cursor, windowStartedAt: clock });
  assert.equal(first.outcome, "partial");
  assert.equal(second.outcome, "partial");
  assert.equal(third.outcome, "completed");
  assert.deepEqual(calls, [hourly.id]);
  assert.equal(writes.filter((record) => record.producer === "jobs.runner" && record.outcome === "partial").length, 2);
});

test("[P0] an irrelevant cursor lookup cannot clear carried due work for a later tenant", async () => {
  const hourlyA = { ...producer, id: "quotes.hourly-a", schedule: "0 * * * *" };
  const hourlyB = { ...producer, id: "quotes.hourly-b", schedule: "0 * * * *" };
  const calls: string[] = [];
  const writes: JobRunRecord[] = [];
  let clock = new Date("2026-09-27T12:05:00.000Z");
  const deps = {
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    loadProducerCursor: async (candidate: ProducerDeclaration) => {
      if (candidate.id === hourlyB.id) clock = new Date(clock.getTime() + 30);
      return undefined;
    },
    execute: async (candidate: ProducerDeclaration, tenantId: string) => { calls.push(`${tenantId}:${candidate.id}`); },
    record: async (record: JobRunRecord) => { writes.push(record); },
    now: () => clock,
  };

  const first = await runDueProducers(deps, {
    producers: [hourlyA, hourlyB],
    cursor: encodeCursor(0, 0, [hourlyA.id]),
    windowStartedAt: clock,
    deadline: new Date(clock.getTime() + 25),
  });
  assert.deepEqual(first, { outcome: "partial", cursor: encodeCursor(1, 0, [hourlyA.id]) });
  assert.deepEqual(calls, ["tenant-a:quotes.hourly-a"]);

  clock = new Date("2026-09-27T12:10:00.000Z");
  const second = await runDueProducers(deps, {
    producers: [hourlyA, hourlyB],
    cursor: first.cursor,
    windowStartedAt: clock,
  });
  assert.deepEqual(second, { outcome: "completed" });
  assert.deepEqual(calls, ["tenant-a:quotes.hourly-a", "tenant-b:quotes.hourly-a"]);
  assert.equal(writes.at(-1)?.outcome, "completed");
});

test("[P0] failed and partial hourly checkpoints both retry off-schedule while later tenants continue", async () => {
  const hourly = { ...producer, id: "quotes.hourly", schedule: "0 * * * *" };
  const writes: JobRunRecord[] = [];
  const latest = new Map<string, JobRunRecord>([
    ["tenant-a", { tenantId: "tenant-a", producer: hourly.id, outcome: "failed", cursor: "retry-a", windowStartedAt: "", startedAt: "", finishedAt: "" }],
    ["tenant-b", { tenantId: "tenant-b", producer: hourly.id, outcome: "partial", cursor: "retry-b", windowStartedAt: "", startedAt: "", finishedAt: "" }],
  ]);
  const calls: string[] = [];
  const result = await runDueProducers({
    listTenantIds: async () => ["tenant-a", "tenant-b"],
    loadProducerCursor: async (_candidate, tenantId) => latest.get(tenantId)?.cursor,
    execute: async (_candidate, tenantId, cursor) => {
      calls.push(`${tenantId}:${cursor}`);
      if (tenantId === "tenant-a") throw new Error("retry still failing");
    },
    record: async (record) => { writes.push(record); },
  }, { producers: [hourly], windowStartedAt: new Date("2026-09-27T12:05:00.000Z") });
  assert.equal(result.outcome, "failed");
  assert.deepEqual(calls, ["tenant-a:retry-a", "tenant-b:retry-b"]);
  assert.equal(writes.find((record) => record.tenantId === "tenant-a" && record.outcome === "failed")?.cursor, "retry-a");
});

test("[P0] rejects unsupported producer schedules before tenant work can create misleading records", async () => {
  const writes: JobRunRecord[] = [];
  await assert.rejects(
    runDueProducers({ listTenantIds: async () => ["tenant-a"], execute: async () => undefined, record: async (record) => { writes.push(record); } }, {
      producers: [{ ...producer, schedule: "every hour" }],
      windowStartedAt: new Date("2026-09-27T12:00:00.000Z"),
    }),
    /Unsupported producer schedule/,
  );
  assert.deepEqual(writes, []);
});
