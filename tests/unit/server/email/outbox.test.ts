import assert from "node:assert/strict";
import { test } from "node:test";
import { enqueueEmailOutbox, hashEmailRecipient, processDarkEmailOutbox } from "@/server/email/outbox";

const projection = { recipientUserId: "user-a", displayName: "Ada", locale: "sv-SE" };

test("[P0][AC4] dark processing renders only the recipient projection and leaves queued work untouched", async () => {
  let suppressionCalled = false;
  const client = {
    rpc: async (name: string) => { suppressionCalled = name === "suppress_queued_email_outbox"; return { data: 0, error: null }; },
    from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [{ template_params: projection }], error: null }) }) }) }),
  } as never;
  const result = await processDarkEmailOutbox({ client }, { tenantId: "tenant-a" });
  assert.deepEqual(result, { suppressed: 0, rendered: 1 });
  assert.equal(suppressionCalled, true);
});

test("[P0][AC3] recipient hash is deterministic and never exposes the source projection", () => {
  assert.equal(hashEmailRecipient(projection), hashEmailRecipient({ ...projection, displayName: "Different name" }));
  assert.match(hashEmailRecipient(projection), /^[0-9a-f]{64}$/);
});

test("[P0][AC1][AC4][13.3-UNIT-PROJECTION-001] enqueue rejects a mismatched template recipient and projects only recipient-safe template params into the RPC", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return { data: [{ id: "outbox-1", state: "queued", lease_expires_at: null, attempts: 0 }], error: null };
    },
  } as never;
  const input = {
    tenantId: "tenant-a", category: "quote", subjectType: "quote", subjectId: "quote-a", period: "2026-09", recipient: projection,
    template: { key: "quote-ready", version: 1, params: { ...projection, rawRecipientEmail: "ada@example.test", administratorOnly: true } as never },
  };

  await assert.rejects(
    enqueueEmailOutbox({ client }, { ...input, template: { ...input.template, params: { ...projection, recipientUserId: "user-b" } } }),
    /Email template recipient does not match enqueue recipient/,
  );
  assert.equal(calls.length, 0);

  await enqueueEmailOutbox({ client }, input);
  assert.deepEqual(calls, [{
    name: "enqueue_email_outbox",
    params: {
      p_tenant_id: "tenant-a", p_recipient_hash: hashEmailRecipient(projection), p_category: "quote",
      p_subject_type: "quote", p_subject_id: "quote-a", p_logical_period: "2026-09",
      p_template_key: "quote-ready", p_template_version: 1,
      p_template_params: { recipientUserId: "user-a", displayName: "Ada", locale: "sv-SE" },
    },
  }]);
});
