import assert from "node:assert/strict";
import { test } from "node:test";
import { hashEmailRecipient, processDarkEmailOutbox } from "@/server/email/outbox";

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
