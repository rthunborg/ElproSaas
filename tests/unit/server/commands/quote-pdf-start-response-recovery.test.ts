/** Pure contracts for ambiguous quote-PDF start-response recovery. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { startQuotePdfRenderWithRecovery } from "@/server/commands/quotes/generate-pdf";

const START_ARGS = {
  p_tenant_id: "10000000-0000-4000-8000-000000000001",
  p_quote_version_id: "20000000-0000-4000-8000-000000000002",
  p_actor_user_id: "30000000-0000-4000-8000-000000000003",
  p_correlation_id: "40000000-0000-4000-8000-000000000004",
  p_started_at: "2026-09-01T12:00:00.000Z",
  p_attestation_key_id: "test-v1",
} as const;

const START_ROW = {
  expected_file_id: "50000000-0000-4000-8000-000000000005",
  completed_file_id: null,
  render_fingerprint: "fingerprint",
  attestation_key_id: "test-v1",
  attestation_issued_at: "2026-09-01T12:00:00.000Z",
  attestation_expires_at: "2026-09-01T12:05:00.000Z",
  generation_started_at: "2026-09-01T12:00:00.000Z",
} as const;

function fakeRpc(responses: readonly (unknown | Error)[]) {
  let calls = 0;
  const rpc = {
    async rpc() {
      const response = responses[calls];
      calls += 1;
      if (response instanceof Error) throw response;
      return response;
    },
  };
  return { rpc, calls: () => calls };
}

test("[10.9][P0] a thrown first response replays the exact start once", async () => {
  const fake = fakeRpc([
    new Error("lost after commit"),
    { data: [START_ROW], error: null },
  ]);

  const recovered = await startQuotePdfRenderWithRecovery(fake.rpc as never, START_ARGS);

  assert.equal(fake.calls(), 2);
  assert.equal(recovered.expectedFileId, START_ROW.expected_file_id);
  assert.equal(recovered.contentFingerprint, START_ROW.render_fingerprint);
});

test("[10.9][P0] a malformed first response replays the exact start once", async () => {
  const fake = fakeRpc([
    { data: { unexpected: true }, error: null },
    { data: [START_ROW], error: null },
  ]);

  const recovered = await startQuotePdfRenderWithRecovery(fake.rpc as never, START_ARGS);

  assert.equal(fake.calls(), 2);
  assert.equal(recovered.expectedFileId, START_ROW.expected_file_id);
});

test("[10.9][P0] two malformed responses fail after the bounded replay", async () => {
  const fake = fakeRpc([
    { data: null, error: null },
    { data: { unexpected: true }, error: null },
  ]);

  await assert.rejects(
    startQuotePdfRenderWithRecovery(fake.rpc as never, START_ARGS),
    /RPC returned no expected file id/,
  );
  assert.equal(fake.calls(), 2);
});
