/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { cleanupFixture, createTwoTenantFixture } from "../../factories/tenants";
import { isLocalStackReachable, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

describe("Story 13.3 email outbox database and dark-processor contracts", () => {
  test("[P0][AC1][13.3-INT-001] persists one tenant-scoped queued row and one queued event under concurrent dedupe", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { enqueueEmailOutbox } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      const request = outboxRequest(fixture.tenantA.id);
      const results = await Promise.all(Array.from({ length: 6 }, () => enqueueEmailOutbox(deps(), request)));
      expect(new Set(results.map((row: { id: string }) => row.id))).toHaveLength(1);
      expect(await adminQuery("select state, count(*)::int as count from public.email_outbox where tenant_id=$1 group by state", [fixture.tenantA.id])).toEqual([{ state: "queued", count: 1 }]);
      expect(await adminQuery("select event_type from public.email_delivery_events where outbox_id=$1", [results[0]!.id])).toEqual([{ event_type: "queued" }]);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0] keeps ordinary producer identity idempotent after sent, failed, or suppressed outcomes", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { enqueueEmailOutbox } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      for (const terminalState of ["sent", "failed", "suppressed"] as const) {
        const request = { ...outboxRequest(fixture.tenantA.id), subjectId: crypto.randomUUID() };
        const first = await enqueueEmailOutbox(deps(), request);
        if (terminalState === "suppressed") {
          await adminQuery("update public.email_outbox set state='suppressed' where id=$1", [first.id]);
        } else {
          await adminQuery("update public.email_outbox set state='sending',lease_owner='terminal-idempotency',lease_expires_at=now()+interval '15 minutes' where id=$1", [first.id]);
          await adminQuery(
            terminalState === "sent"
              ? "update public.email_outbox set state='sent',provider_message_id='terminal-idempotency',lease_owner=null,lease_expires_at=null where id=$1"
              : "update public.email_outbox set state='failed',lease_owner=null,lease_expires_at=null where id=$1",
            [first.id],
          );
        }
        const replayed = await enqueueEmailOutbox(deps(), request);
        expect(replayed.id).toBe(first.id);
        expect(await adminQuery<{ count: number; delivery_sequence: number }>(
          "select count(*) over ()::int as count,delivery_sequence from public.email_outbox where id=$1",
          [first.id],
        )).toEqual([{ count: 1, delivery_sequence: 1 }]);
      }
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC2][13.3-INT-002] uses PostgreSQL FOR UPDATE SKIP LOCKED for disjoint tenant-explicit claims and recovers one stale lease", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { claimEmailOutbox } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      await seedQueuedRows(fixture.tenantA.id, 2);
      const [one, two] = await Promise.all([claimEmailOutbox(deps(), { tenantId: fixture.tenantA.id, workerId: "one", limit: 1 }), claimEmailOutbox(deps(), { tenantId: fixture.tenantA.id, workerId: "two", limit: 1 })]);
      expect(one).toHaveLength(1); expect(two).toHaveLength(1); expect(one[0]?.id).not.toBe(two[0]?.id); expect(await eventCount(fixture.tenantA.id, "sending")).toBe(2);
      await expireLease(one[0]!.id);
      expect(await claimEmailOutbox(deps(), { tenantId: fixture.tenantA.id, workerId: "three", limit: 1 })).toContainEqual(expect.objectContaining({ id: one[0]!.id, state: "sending" }));
      expect(await deliveryAttemptCount(one[0]!.id)).toBe(0); expect(await eventCount(fixture.tenantA.id, "lease_recovered")).toBe(1);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC2][13.3-INT-003] records fixed retry deadlines and a sanitized terminal failure event", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { claimEmailOutbox, recordSyntheticDeliveryOutcome, EMAIL_RETRY_MINUTES } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      const row = await seedQueuedRow(fixture.tenantA.id);
      expect(EMAIL_RETRY_MINUTES).toEqual([5, 10, 20]);
      await claimEmailOutbox(deps(), { tenantId: fixture.tenantA.id, workerId: "retry-1" });
      await recordSyntheticDeliveryOutcome(deps(), { id: row.id, tenantId: fixture.tenantA.id, workerId: "retry-1", outcome: "retryable_failure", now: "2026-09-23T10:00:00.000Z" });
      expect(await nextAttemptAt(row.id)).toBe("2026-09-23T10:05:00.000Z"); await expect(recordSyntheticDeliveryOutcome(deps(), { id: row.id, tenantId: fixture.tenantA.id, workerId: "wrong", outcome: "retryable_failure", now: "2026-09-23T10:00:00.000Z" })).rejects.toThrow("Email outbox outcome failed");
      await claimEmailOutbox({ ...deps(), clock: { now: () => new Date("2026-09-23T10:05:00.000Z") } }, { tenantId: fixture.tenantA.id, workerId: "retry-2" });
      await recordSyntheticDeliveryOutcome(deps(), { id: row.id, tenantId: fixture.tenantA.id, workerId: "retry-2", outcome: "retryable_failure", now: "2026-09-23T10:05:00.000Z" });
      expect(await nextAttemptAt(row.id)).toBe("2026-09-23T10:15:00.000Z");
      await claimEmailOutbox({ ...deps(), clock: { now: () => new Date("2026-09-23T10:15:00.000Z") } }, { tenantId: fixture.tenantA.id, workerId: "retry-3" });
      await recordSyntheticDeliveryOutcome(deps(), { id: row.id, tenantId: fixture.tenantA.id, workerId: "retry-3", outcome: "retryable_failure", now: "2026-09-23T10:15:00.000Z" });
      expect(await outboxState(row.id)).toBe("failed");
      expect(await lastEvent(row.id)).toMatchObject({ event_type: "failed", failure_detail: "Delivery could not be completed." });
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC3][13.3-INT-004] atomically changes a matching suppressed queued row before any delivery seam", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processDarkEmailOutbox } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      const row = await seedQueuedRow(fixture.tenantA.id);
      await seedSuppression({ tenantId: fixture.tenantA.id, recipientHash: row.recipient_hash, category: row.category });
      await processDarkEmailOutbox(deps(), { tenantId: fixture.tenantA.id });
      expect(await outboxState(row.id)).toBe("suppressed");
      expect(await lastEvent(row.id)).toMatchObject({ event_type: "suppressed" });
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC4][13.3-INT-005] leaves unsuppressed work queued and writes no provider result, sent event, or delivery attempt", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processDarkEmailOutbox } = await loadOutbox();
    const fixture = await createTwoTenantFixture();
    try {
      const row = await seedQueuedRow(fixture.tenantA.id);
      await processDarkEmailOutbox(deps(), { tenantId: fixture.tenantA.id });
      expect(await outboxState(row.id)).toBe("queued");
      expect(await adminQuery("select * from public.email_delivery_events where outbox_id=$1 and event_type in ('sending','sent','failed')", [row.id])).toEqual([]);
      expect(await deliveryAttemptCount(row.id)).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });
});

function deps() { return { client: createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) }; }
function outboxRequest(tenantId: string) { return { tenantId, category: "quote.follow_up_due", subjectType: "quote_follow_up", subjectId: "11111111-1111-4111-8111-111111111111", period: "2026-09-23", recipient: { recipientUserId: "user-13-3", displayName: "Ada", locale: "sv-SE" }, template: { key: "quote-follow-up", version: 1, params: { recipientUserId: "user-13-3", displayName: "Ada", locale: "sv-SE" } } }; }
async function loadOutbox(): Promise<any> { return import(["@/server/email/outbox"].join("")); }
async function seedQueuedRows(tenantId: string, count: number): Promise<void> { await Promise.all(Array.from({ length: count }, () => seedQueuedRow(tenantId))); }
async function seedQueuedRow(tenantId: string): Promise<any> { return (await adminQuery("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params,next_attempt_at) values ($1,repeat('a',64),'quote.follow_up_due','quote_follow_up',gen_random_uuid(),'2026-09-23','dark',1,'{\"recipientUserId\":\"user\",\"displayName\":\"Ada\",\"locale\":\"sv-SE\"}'::jsonb,now()-interval '1 minute') returning id,recipient_hash,category", [tenantId]))[0]!; }
async function seedSuppression(value: Record<string, string>): Promise<void> { await adminQuery("insert into public.email_suppressions (tenant_id,recipient_hash,category) values ($1,$2,$3)", [value.tenantId, value.recipientHash, value.category]); }
async function expireLease(id: string): Promise<void> { await adminQuery("update public.email_outbox set lease_expires_at=now()-interval '1 minute' where id=$1", [id]); }
async function deliveryAttemptCount(id: string): Promise<number> { return Number((await adminQuery<{ attempts: number }>("select attempts from public.email_outbox where id=$1", [id]))[0]?.attempts); }
async function nextAttemptAt(id: string): Promise<string> { return new Date((await adminQuery<{ next_attempt_at: string }>("select next_attempt_at from public.email_outbox where id=$1", [id]))[0]!.next_attempt_at).toISOString(); }
async function outboxState(id: string): Promise<string> { return (await adminQuery<{ state: string }>("select state from public.email_outbox where id=$1", [id]))[0]!.state; }
async function lastEvent(id: string): Promise<Record<string, unknown>> { return (await adminQuery("select event_type,failure_detail from public.email_delivery_events where outbox_id=$1 order by created_at desc,id desc limit 1", [id]))[0]!; }async function eventCount(tenantId: string, eventType: string): Promise<number> { return Number((await adminQuery<{ count: string }>("select count(*)::text as count from public.email_delivery_events where tenant_id=$1 and event_type=$2", [tenantId, eventType]))[0]!.count); }
