import assert from "node:assert/strict";
import { test } from "node:test";
import nextConfig from "../../next.config";

test("all application paths receive the conservative browser policy without replacing provider HSTS", async () => {
  const rules = await nextConfig.headers!();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/:path*");
  assert.equal(rules[0].has, undefined);
  const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["permissions-policy"], "camera=(), microphone=(), geolocation=()");
  assert.equal(headers["strict-transport-security"], undefined);
  assert.equal(headers["access-control-allow-origin"], undefined);
  assert.equal(headers["access-control-allow-credentials"], undefined);
  assert.equal(nextConfig.experimental?.serverActions, undefined);
});
