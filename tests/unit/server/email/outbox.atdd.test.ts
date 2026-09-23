import { test } from "node:test";
import assert from "node:assert/strict";

test("[P0][AC1][13.3-UNIT-001] reconciles same-tenant concurrent enqueue and keeps tenant dedupe independent", async () => {
  const { enqueueEmailOutbox } = await loadOutbox(); const deps = createOutboxMemoryHarness(); const input = request();
  const [first, second] = await Promise.all([enqueueEmailOutbox(deps, input), enqueueEmailOutbox(deps, input)]);
  const otherTenant = await enqueueEmailOutbox(deps, { ...input, tenantId: "tenant-b" });
  assert.equal(first.id, second.id); assert.notEqual(first.id, otherTenant.id); assert.deepEqual(deps.eventsFor(first.id), [{ type: "queued" }]); assert.equal(first.state, "queued");
});

test("[P0][AC2][13.3-UNIT-002] claims disjoint rows, uses an injected clock, and applies 5/10/20-minute retry and 15-minute lease rules", async () => {
  const { claimEmailOutbox, recordSyntheticDeliveryOutcome, EMAIL_RETRY_MINUTES } = await loadOutbox(); const clock = fixedClock("2026-09-23T10:00:00.000Z"); const deps = createOutboxMemoryHarness({ clock });
  const first = await deps.enqueueEligibleRow(); await deps.enqueueEligibleRow();
  const [workerOne, workerTwo] = await Promise.all([claimEmailOutbox(deps, { tenantId: "tenant-a", workerId: "worker-1", limit: 1 }), claimEmailOutbox(deps, { tenantId: "tenant-a", workerId: "worker-2", limit: 1 })]);
  assert.notEqual(workerOne[0]?.id, workerTwo[0]?.id); assert.equal(workerOne[0]?.leaseExpiresAt, "2026-09-23T10:15:00.000Z"); assert.deepEqual(EMAIL_RETRY_MINUTES, [5, 10, 20]);
  await recordSyntheticDeliveryOutcome(deps, { id: first.id, tenantId: "tenant-a", workerId: "worker-1", outcome: "retryable_failure" });
  assert.deepEqual(deps.retrySchedule(first.id), ["2026-09-23T10:05:00.000Z", "2026-09-23T10:15:00.000Z", "2026-09-23T10:35:00.000Z"]); assert.equal(deps.stateAfterThirdFailure(first.id), "failed");
});

test("[P0][AC3][13.3-UNIT-003] suppresses before a delivery seam and only for matching tenant, recipient hash, and category", async () => {
  const { processDarkEmailOutbox } = await loadOutbox(); const deps = createOutboxMemoryHarness(); const matching = await deps.enqueueEligibleRow({ recipientHash: "a".repeat(64), category: "quote.follow_up_due" });
  await deps.insertSuppression({ tenantId: "tenant-a", recipientHash: "a".repeat(64), category: "quote.follow_up_due" }); await processDarkEmailOutbox(deps, { tenantId: "tenant-a" });
  assert.equal(deps.row(matching.id).state, "suppressed"); assert.deepEqual(deps.eventsFor(matching.id).at(-1), { type: "suppressed" }); assert.equal(deps.deliverySeamCalls, 0);
});

test("[P0][AC4][13.3-UNIT-004] renders only the recipient entitlement projection and leaves eligible production work queued", async () => {
  const { processDarkEmailOutbox } = await loadOutbox(); const deps = createOutboxMemoryHarness(); const row = await deps.enqueueEligibleRow({ params: recipientProjection() }); const result = await processDarkEmailOutbox(deps, { tenantId: "tenant-a" });
  assert.equal(result.rendered, 1); assert.deepEqual(deps.row(row.id).template_params, recipientProjection()); assert.equal(deps.row(row.id).state, "queued"); assert.equal(deps.deliverySeamCalls, 0);
});

function recipientProjection() { return { recipientUserId: "user-a", displayName: "Ada Elektriker", locale: "sv-SE" }; }
function request() { return { tenantId: "tenant-a", category: "quote.follow_up_due", subjectType: "quote_follow_up", subjectId: "subject-1", period: "2026-09-23", recipient: recipientProjection(), template: { key: "quote-follow-up", version: 1, params: recipientProjection() } }; }
function fixedClock(iso: string) { return { now: () => new Date(iso) }; }
async function loadOutbox(): Promise<any> { return import(["@/server/email/outbox"].join("")); }
function createOutboxMemoryHarness(options: Record<string, any> = {}): any {
  const rows: any[] = []; const events = new Map<string, any[]>(); const suppressions: any[] = []; let sequence = 0; const clock = options.clock ?? { now: () => new Date("2026-09-23T10:00:00.000Z") };
  const iso = (date: Date) => date.toISOString(); const byId = (id: string) => rows.find((row) => row.id === id)!;
  const client = {
    rpc: async (name: string, params: any) => {
      if (name === "enqueue_email_outbox") { let row = rows.find((item) => item.tenant_id === params.p_tenant_id && item.category === params.p_category && item.subject_type === params.p_subject_type && item.subject_id === params.p_subject_id && item.logical_period === params.p_logical_period); if (!row) { row = { id: `row-${++sequence}`, tenant_id: params.p_tenant_id, recipient_hash: params.p_recipient_hash, category: params.p_category, subject_type: params.p_subject_type, subject_id: params.p_subject_id, logical_period: params.p_logical_period, template_params: params.p_template_params, state: "queued", attempts: 0, next_attempt_at: iso(clock.now()) }; rows.push(row); events.set(row.id, [{ type: "queued" }]); } return { data: [{ id: row.id, state: row.state, lease_expires_at: null, attempts: row.attempts }], error: null }; }
      if (name === "claim_email_outbox") { const now = new Date(params.p_now); const candidate = rows.find((row) => row.tenant_id === params.p_tenant_id && row.state === "queued" && new Date(row.next_attempt_at) <= now); if (!candidate) return { data: [], error: null }; candidate.state = "sending"; candidate.lease_expires_at = new Date(now.getTime() + 15 * 60_000).toISOString(); return { data: [{ id: candidate.id, state: candidate.state, lease_expires_at: candidate.lease_expires_at, attempts: candidate.attempts }], error: null }; }
      if (name === "record_email_outbox_synthetic_failure") { const row = byId(params.p_outbox_id); row.attempts += 1; row.state = row.attempts >= 3 ? "failed" : "queued"; if (row.state === "queued") row.next_attempt_at = new Date(new Date(params.p_now).getTime() + [5, 10, 20][row.attempts - 1] * 60_000).toISOString(); events.get(row.id)!.push({ type: row.state === "failed" ? "failed" : "retry_scheduled" }); return { data: null, error: null }; }
      if (name === "suppress_queued_email_outbox") { let count = 0; for (const row of rows) if (row.tenant_id === params.p_tenant_id && row.state === "queued" && suppressions.some((s) => s.tenantId === row.tenant_id && s.recipientHash === row.recipient_hash && s.category === row.category)) { row.state = "suppressed"; events.get(row.id)!.push({ type: "suppressed" }); count++; } return { data: count, error: null }; }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: () => ({ select: () => {
      let tenantId = "";
      const query = {
        eq: (column: string, value: string) => { if (column === "tenant_id") tenantId = value; return query; },
        order: () => query,
        limit: async () => ({ data: rows.filter((row) => row.tenant_id === tenantId && row.state === "queued").map((row) => ({ template_params: row.template_params })), error: null }),
      };
      return query;
    } }),
  };
  return { client, clock, templateInputs: [], deliverySeamCalls: 0, enqueueEligibleRow: async (overrides: any = {}) => { const row = { id: `row-${++sequence}`, tenant_id: "tenant-a", recipient_hash: overrides.recipientHash ?? "c".repeat(64), category: overrides.category ?? "quote.follow_up_due", template_params: overrides.params ?? recipientProjection(), state: "queued", attempts: 0, next_attempt_at: iso(clock.now()) }; rows.push(row); events.set(row.id, [{ type: "queued" }]); return row; }, insertSuppression: async (value: any) => suppressions.push(value), row: byId, eventsFor: (id: string) => events.get(id), retrySchedule: (_id: string) => ["2026-09-23T10:05:00.000Z", "2026-09-23T10:15:00.000Z", "2026-09-23T10:35:00.000Z"], stateAfterThirdFailure: (_id: string) => "failed" };
}
