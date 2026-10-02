import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  getLastStackReachabilityDiagnostic,
  getLastStorageReachabilityDiagnostic,
  isLocalStackReachable,
  isLocalStorageReachable,
  resetReachabilityCachesForTest,
} from "../../support/test-env";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetReachabilityCachesForTest();
});

test("records only allowlisted details for an Auth HTTP failure", async () => {
  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;

  assert.equal(await isLocalStackReachable(), false);
  const diagnostic = getLastStackReachabilityDiagnostic();
  assert.deepEqual(
    {
      surface: diagnostic?.surface,
      method: diagnostic?.method,
      origin: diagnostic?.origin,
      status: diagnostic?.status,
      reason: diagnostic?.reason,
      attempts: diagnostic?.attempts,
    },
    {
      surface: "auth",
      method: "GET",
      origin: "http://127.0.0.1:54321",
      status: 503,
      reason: "http_status",
      attempts: 1,
    },
  );
  assert.equal(typeof diagnostic?.elapsed_ms, "number");
});

test("records a timeout reason without retaining an error payload", async () => {
  globalThis.fetch = (async () => {
    throw new DOMException("ignored", "TimeoutError");
  }) as typeof fetch;

  assert.equal(await isLocalStorageReachable(), false);
  const diagnostic = getLastStorageReachabilityDiagnostic();
  assert.deepEqual(
    {
      surface: diagnostic?.surface,
      method: diagnostic?.method,
      origin: diagnostic?.origin,
      status: diagnostic?.status,
      reason: diagnostic?.reason,
      attempts: diagnostic?.attempts,
    },
    {
      surface: "storage",
      method: "GET",
      origin: "http://127.0.0.1:54321",
      status: null,
      reason: "timeout",
      attempts: 2,
    },
  );
});

test("retries one transient timeout and caches only the subsequent success", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new DOMException("ignored", "TimeoutError");
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  assert.equal(await isLocalStackReachable(), true);
  assert.equal(await isLocalStackReachable(), true);
  assert.equal(calls, 2, "the first timeout retries once; the success is reusable");
  assert.equal(getLastStackReachabilityDiagnostic()?.reason, "ok");
  assert.equal(getLastStackReachabilityDiagnostic()?.attempts, 2);
});

test("does not cache a persistent timeout and remains fail-closed", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new DOMException("ignored", "TimeoutError");
  }) as typeof fetch;

  assert.equal(await isLocalStackReachable(), false);
  assert.equal(await isLocalStackReachable(), false);
  assert.equal(calls, 4, "each false result retries once and is never cached");
  assert.equal(getLastStackReachabilityDiagnostic()?.reason, "timeout");
  assert.equal(getLastStackReachabilityDiagnostic()?.attempts, 2);
});

test("does not retry an authorization failure after a transient timeout", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new DOMException("ignored", "TimeoutError");
    return new Response(null, { status: 401 });
  }) as typeof fetch;

  assert.equal(await isLocalStackReachable(), false);
  assert.equal(calls, 2, "the bounded retry ends on the authorization response");
  const diagnostic = getLastStackReachabilityDiagnostic();
  assert.equal(diagnostic?.status, 401);
  assert.equal(diagnostic?.reason, "http_status");
  assert.equal(diagnostic?.attempts, 2);
});
