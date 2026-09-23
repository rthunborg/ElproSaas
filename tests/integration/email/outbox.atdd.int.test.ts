import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { cleanupFixture, createTwoTenantFixture } from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

describe("Story 13.3 email outbox database and dark-processor contracts (ATDD RED)", () => {
  test.skip("[P0][AC1][13.3-INT-001] persists one tenant-scoped queued row and one queued event under concurrent dedupe", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { enqueueEmailOutbox } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      const request = outboxRequest(fixture.tenantA.id);
      const results = await Promise.all(Array.from({ length: 6 }, () => enqueueEmailOutbox(request)));
      expect(new Set(results.map((row: { id: string }) => row.id))).toHaveLength(1);
      expect(await adminQuery("select state, count(*)::int as count from public.email_outbox where tenant_id=$1 group by state", [fixture.tenantA.id])).toEqual([{ state: "queued", count: 1 }]);
      expect(await adminQuery("select event_type from public.email_delivery_events where outbox_id=$1", [results[0]!.id])).toEqual([{ event_type: "queued" }]);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC2][13.3-INT-002] uses PostgreSQL FOR UPDATE SKIP LOCKED for disjoint tenant-explicit claims and recovers one stale lease", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { claimEmailOutbox } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      await seedQueuedRows(fixture.tenantA.id, 2);
      const [one, two] = await Promise.all([claimEmailOutbox({ tenantId: fixture.tenantA.id, workerId: "one" }), claimEmailOutbox({ tenantId: fixture.tenantA.id, workerId: "two" })]);
      expect(one.map((row: { id: string }) => row.id)).not.toEqual(two.map((row: { id: string }) => row.id));
      await expireLease(one[0]!.id);
      expect(await claimEmailOutbox({ tenantId: fixture.tenantA.id, workerId: "three" })).toContainEqual(expect.objectContaining({ id: one[0]!.id, state: "queued" }));
      expect(await deliveryAttemptCount(one[0]!.id)).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC2][13.3-INT-003] records fixed retry deadlines and a sanitized terminal failure event", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { recordSyntheticDeliveryOutcome } = await loadOutbox();
    const row = await seedQueuedRow("tenant-a", "2026-09-23T10:00:00.000Z");
    await recordSyntheticDeliveryOutcome({ id: row.id, outcome: "retryable_failure", now: "2026-09-23T10:00:00.000Z" });
    expect(await nextAttemptAt(row.id)).toBe("2026-09-23T10:05:00.000Z");
    await exhaustWithSyntheticFailures(row.id);
    expect(await outboxState(row.id)).toBe("failed");
    expect(await lastEvent(row.id)).toMatchObject({ event_type: "failed", failure_detail: expect.not.stringMatching(/token|password|recipient/i) });
  });

  test.skip("[P0][AC3][13.3-INT-004] atomically changes a matching suppressed queued row before any delivery seam", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processDarkEmailOutbox } = await loadOutbox();
    const row = await seedQueuedRow("tenant-a");
    await seedSuppression({ tenantId: "tenant-a", recipientHash: row.recipient_hash, category: row.category });
    await processDarkEmailOutbox({ tenantId: "tenant-a", deliveryEnabled: false });
    expect(await outboxState(row.id)).toBe("suppressed");
    expect(await lastEvent(row.id)).toMatchObject({ event_type: "suppressed" });
  });

  test.skip("[P0][AC4][13.3-INT-005] leaves unsuppressed work queued and writes no provider result, sent event, or delivery attempt", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processDarkEmailOutbox } = await loadOutbox();
    const row = await seedQueuedRow("tenant-a");
    await processDarkEmailOutbox({ tenantId: "tenant-a", deliveryEnabled: false });
    expect(await outboxState(row.id)).toBe("queued");
    expect(await adminQuery("select * from public.email_delivery_events where outbox_id=$1 and event_type in ('sending','sent','failed')", [row.id])).toEqual([]);
  });
});

function outboxRequest(tenantId: string) { return { tenantId, category: "quote.follow_up_due", subjectType: "quote_follow_up", subjectId: "subject-13-3", period: "2026-09-23", recipient: { recipientUserId: "user-13-3", displayName: "Ada", locale: "sv-SE" }, template: { key: "quote-follow-up", version: 1, params: { recipientUserId: "user-13-3", displayName: "Ada", locale: "sv-SE" } } }; }
async function loadOutbox(): Promise<any> { return import(["@/server/email/outbox"].join("")); }
async function seedQueuedRows(_tenantId: string, _count: number): Promise<void> { throw new Error("Story 13.3 RED fixture"); }
async function seedQueuedRow(_tenantId: string, _now?: string): Promise<any> { throw new Error("Story 13.3 RED fixture"); }
async function seedSuppression(_value: Record<string, string>): Promise<void> { throw new Error("Story 13.3 RED fixture"); }
async function expireLease(_id: string): Promise<void> { throw new Error("Story 13.3 RED fixture"); }
async function deliveryAttemptCount(_id: string): Promise<number> { throw new Error("Story 13.3 RED fixture"); }
async function nextAttemptAt(_id: string): Promise<string> { throw new Error("Story 13.3 RED fixture"); }
async function exhaustWithSyntheticFailures(_id: string): Promise<void> { throw new Error("Story 13.3 RED fixture"); }
async function outboxState(_id: string): Promise<string> { throw new Error("Story 13.3 RED fixture"); }
async function lastEvent(_id: string): Promise<Record<string, unknown>> { throw new Error("Story 13.3 RED fixture"); }
