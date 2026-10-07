import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createReadProxy, resolveProxyTarget } from "../../e2e/dashboard/server-read-proxy.mjs";

const upstream = new URL("http://127.0.0.1:56421");
for (const requestTarget of ["http://example.invalid/secret", "https://example.invalid/secret",
  "http://127.0.0.1:56421/auth/v1/health", "//example.invalid/secret", "//127.0.0.1:56421/secret",
  "/\\example.invalid/secret", "/\t/example.invalid/secret", "auth/v1/health", "", undefined]) {
  test("proxy rejects non-origin-form target " + JSON.stringify(requestTarget), () => {
    assert.equal(resolveProxyTarget(requestTarget, upstream), null);
  });
}
test("ordinary path/query resolves only inside the configured upstream", () => {
  const result = resolveProxyTarget("/rest/v1/quote_events?select=id&redirect=http://example.invalid", upstream);
  assert.equal(result?.origin, upstream.origin);
  assert.equal(result?.pathname, "/rest/v1/quote_events");
});
test("the production handler refuses absolute/network targets before any forwarding", async () => {
  // Exercise the real request handler without listening or launching a resource.
  const server = createReadProxy({ upstream, control: "unused-denied-target-control" });
  const listener = server.listeners("request")[0] as (request: unknown, response: unknown) => Promise<void>;
  const original = http.request;
  let forwards = 0;
  http.request = (() => { forwards += 1; throw new Error("Rejected target reached upstream"); }) as typeof http.request;
  try {
    for (const url of ["http://example.invalid/secret", "//example.invalid/secret", "/\\example.invalid/secret"]) {
      let status = 0;
      let body = "";
      await listener({ url, headers: {} }, { writeHead: (value: number) => { status = value; }, end: (value: string) => { body = value; } });
      assert.equal(status, 400);
      assert.equal(body, "Unsupported request target");
    }
    assert.equal(forwards, 0);
  } finally { http.request = original; }
});
