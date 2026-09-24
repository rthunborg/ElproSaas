import assert from "node:assert/strict";
import { test } from "node:test";

test("Story 13.4 uses only one validated Vercel client-IP value for unsubscribe limiting", async () => {
  const { trustedUnsubscribeIp } = await import("@/server/email/unsubscribe-ip");
  assert.equal(trustedUnsubscribeIp("203.0.113.15"), "203.0.113.15");
  assert.equal(trustedUnsubscribeIp("2001:db8::1"), "2001:db8::1");
  assert.equal(trustedUnsubscribeIp("203.0.113.15, 198.51.100.8"), "unknown");
  assert.equal(trustedUnsubscribeIp("not-an-ip"), "unknown");
  assert.equal(trustedUnsubscribeIp(null), "unknown");
});
