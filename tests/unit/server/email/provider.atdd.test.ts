import assert from "node:assert/strict";
import { describe, test } from "node:test";

async function loadProvider(): Promise<any> {
  return import(["@/server/email/provider"].join(""));
}

describe("Story 13.4 provider release control (ATDD RED)", () => {
  test.skip("[P0][13.4-UNIT-001] permits only a synthetic sandbox envelope and persists one server-only provider outcome", async () => {
    const { createEmailDeliveryAdapter } = await loadProvider();
    const calls: unknown[] = [];
    const submit = async (envelope: unknown) => {
      calls.push(envelope);
      return { providerMessageId: "sandbox-msg-13-4" };
    };
    const adapter = createEmailDeliveryAdapter({ mode: "sandbox", submit });

    const result = await adapter.deliver({
      tenantId: "11111111-1111-4111-8111-111111111111",
      recipient: { kind: "synthetic", address: "sandbox-recipient@example.test" },
      template: { key: "quote-delivery", locale: "sv-SE", renderedBody: "Offert" },
      attachments: [],
    });

    assert.deepEqual(result, { outcome: "sent", providerMessageId: "sandbox-msg-13-4" });
    assert.equal(calls.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /sandbox-recipient@example\.test|Offert/);
  });

  test.skip("[P0][13.4-UNIT-002] treats missing, malformed, preview-only, and unapproved real-recipient release state as closed", async () => {
    const { evaluateEmailReleaseControl } = await loadProvider();
    for (const control of [undefined, { mode: "preview" }, { mode: "real", ownerApproval: false }, { mode: "real", ownerApproval: "malformed" }]) {
      const result = evaluateEmailReleaseControl(control);
      assert.equal(result.allowed, false);
      assert.equal(typeof result.reason, "string");
    }
  });
});
