import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readResourceE2eCdpEndpoint,
  requireResourceE2eFailureSeamForCdp,
} from "../../e2e/support/resource-cdp-attachment";

test("[14.1][P0] guarded resource CDP attachment is absent by default and loopback-only", () => {
  assert.equal(readResourceE2eCdpEndpoint(undefined), undefined);
  assert.equal(readResourceE2eCdpEndpoint("http://127.0.0.1:9222"), "http://127.0.0.1:9222/");
  assert.equal(readResourceE2eCdpEndpoint("ws://localhost:9222/devtools/browser/root"), "ws://localhost:9222/devtools/browser/root");
  assert.throws(() => readResourceE2eCdpEndpoint("ws://192.0.2.10:9222"), /loopback endpoint/);
});

test("[14.1][P0] guarded CDP attachment requires the runner failure-seam opt-in", () => {
  requireResourceE2eFailureSeamForCdp(undefined, undefined);
  requireResourceE2eFailureSeamForCdp("http://127.0.0.1:9222/", "true");
  assert.throws(
    () => requireResourceE2eFailureSeamForCdp("http://127.0.0.1:9222/", undefined),
    /E2E_RESOURCE_SAVE_FAILURE_ENABLED=true/,
  );
});
