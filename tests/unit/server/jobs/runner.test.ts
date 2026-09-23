import { test } from "node:test";
import assert from "node:assert/strict";
import { runDueProducers, sanitizeJobError, type JobRunRecord } from "@/server/jobs/runner";
const producer = { id: "notifications.reminder", module: "notifications", category: "quote.reminder", schedule: "*/5 * * * *", essential: false };
test("[P0] persists a cursor at a deterministic chunk and resumes tenant order", async () => {
  const writes: JobRunRecord[] = [];
  const deps = { listTenantIds: async () => ["tenant-a", "tenant-b", "tenant-c"], execute: async () => undefined, record: async (record: JobRunRecord) => { writes.push(record); } };
  const first = await runDueProducers(deps, { producers: [producer], chunkSize: 2 });
  assert.equal(first.outcome, "partial"); assert.ok(first.cursor);
  const second = await runDueProducers(deps, { producers: [producer], cursor: first.cursor, chunkSize: 2 });
  assert.equal(second.outcome, "completed"); assert.deepEqual(writes.filter((write) => write.producer === producer.id).map((write) => write.tenantId), ["tenant-a", "tenant-b", "tenant-c"]);
});
test("[P1] isolates a producer failure with a bounded sanitized summary", async () => {
  const writes: JobRunRecord[] = [];
  await runDueProducers({ listTenantIds: async () => ["tenant-a"], execute: async () => { throw new Error(`password=secret ${"x".repeat(400)}`); }, record: async (record) => { writes.push(record); } }, { producers: [producer] });
  assert.equal(writes[0]?.outcome, "failed"); assert.match(writes[0]?.errorSummary ?? "", /password=\[redacted\]/); assert.ok((writes[0]?.errorSummary?.length ?? 0) <= 256);
  assert.equal((await runDueProducers({ listTenantIds: async () => ["tenant-a", "tenant-b"], execute: async (_producer, tenantId) => { if (tenantId === "tenant-a") throw new Error("Authorization: Bearer secret-token token=raw https://x.test/?api_key=raw"); }, record: async (record) => { writes.push(record); } }, { producers: [producer] })).outcome, "failed");
  assert.doesNotMatch(writes.findLast((write) => write.outcome === "failed")?.errorSummary ?? "", /secret-token|token=raw|api_key=raw/);
  assert.equal(sanitizeJobError("secret=x"), "Background producer failed");
});
