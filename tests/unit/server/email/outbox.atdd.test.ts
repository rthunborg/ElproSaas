import { test } from "node:test";
import assert from "node:assert/strict";

/** RED PHASE — Story 13.3 owns the dark email outbox contract. */
test.skip("[P0][AC1][13.3-UNIT-001] reconciles same-tenant concurrent enqueue and keeps tenant dedupe independent", async () => {
  const { enqueueEmailOutbox } = await loadOutbox();
  const deps = createOutboxMemoryHarness();
  const input = { tenantId: "tenant-a", category: "quote.follow_up_due", subjectType: "quote_follow_up", subjectId: "subject-1", period: "2026-09-23", recipient: recipientProjection(), template: { key: "quote-follow-up", version: 1, params: recipientProjection() } };
  const [first, second] = await Promise.all([enqueueEmailOutbox(deps, input), enqueueEmailOutbox(deps, input)]);
  const otherTenant = await enqueueEmailOutbox(deps, { ...input, tenantId: "tenant-b" });
  assert.equal(first.id, second.id);
  assert.notEqual(first.id, otherTenant.id);
  assert.deepEqual(deps.eventsFor(first.id), [{ type: "queued" }]);
  assert.equal(first.state, "queued");
});

test.skip("[P0][AC2][13.3-UNIT-002] claims disjoint rows, uses an injected clock, and applies 5/10/20-minute retry and 15-minute lease rules", async () => {
  const { claimEmailOutbox, recordSyntheticDeliveryOutcome } = await loadOutbox();
  const clock = fixedClock("2026-09-23T10:00:00.000Z");
  const deps = createOutboxMemoryHarness({ clock });
  const row = await deps.enqueueEligibleRow();
  const [workerOne, workerTwo] = await Promise.all([claimEmailOutbox(deps, { tenantId: "tenant-a", workerId: "worker-1" }), claimEmailOutbox(deps, { tenantId: "tenant-a", workerId: "worker-2" })]);
  assert.equal(new Set([workerOne?.id, workerTwo?.id]).size, 2);
  assert.equal(workerOne?.leaseExpiresAt, "2026-09-23T10:15:00.000Z");
  await recordSyntheticDeliveryOutcome(deps, { id: row.id, outcome: "retryable_failure" });
  assert.deepEqual(deps.retrySchedule(row.id), ["2026-09-23T10:05:00.000Z", "2026-09-23T10:15:00.000Z", "2026-09-23T10:35:00.000Z"]);
  assert.equal(deps.stateAfterThirdFailure(row.id), "failed");
});

test.skip("[P0][AC3][13.3-UNIT-003] suppresses before a delivery seam and only for matching tenant, recipient hash, and category", async () => {
  const { processDarkEmailOutbox } = await loadOutbox();
  const deps = createOutboxMemoryHarness({ deliveryEnabled: false });
  const matching = await deps.enqueueEligibleRow({ recipientHash: "a".repeat(64), category: "quote.follow_up_due" });
  await deps.insertSuppression({ tenantId: "tenant-a", recipientHash: "a".repeat(64), category: "quote.follow_up_due" });
  await processDarkEmailOutbox(deps, { tenantId: "tenant-a" });
  assert.equal(deps.row(matching.id).state, "suppressed");
  assert.deepEqual(deps.eventsFor(matching.id).at(-1), { type: "suppressed" });
  assert.equal(deps.deliverySeamCalls, 0);
});

test.skip("[P0][AC4][13.3-UNIT-004] renders only the recipient entitlement projection and leaves eligible production work queued", async () => {
  const { processDarkEmailOutbox } = await loadOutbox();
  const deps = createOutboxMemoryHarness({ deliveryEnabled: false });
  const row = await deps.enqueueEligibleRow({ params: recipientProjection() });
  await processDarkEmailOutbox(deps, { tenantId: "tenant-a" });
  assert.deepEqual(deps.templateInputs, [recipientProjection()]);
  assert.equal(deps.row(row.id).state, "queued");
  assert.equal(deps.deliverySeamCalls, 0);
});

function recipientProjection() { return { recipientUserId: "user-a", displayName: "Ada Elektriker", locale: "sv-SE" }; }
function fixedClock(iso: string) { return { now: () => new Date(iso) }; }
async function loadOutbox(): Promise<any> { return import(["@/server/email/outbox"].join("")); }
function createOutboxMemoryHarness(_options: Record<string, unknown> = {}): any { throw new Error("Story 13.3 RED fixture: implement with server-only outbox dependencies"); }
