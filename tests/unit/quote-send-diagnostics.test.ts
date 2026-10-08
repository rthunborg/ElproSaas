import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestServerClient } from "../factories/tenants";
import { observeQuoteSendRpcs } from "../support/quote-send-diagnostics";

function fixture(result: unknown, rejected?: Error) {
  let executions = 0;
  let single = false;
  const query = {
    single() { single = true; return this; },
    throwOnError() { return this; },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) {
      executions++;
      return (rejected ? Promise.reject(rejected) : Promise.resolve(result)).then(onFulfilled, onRejected);
    },
  };
  const client = { rpc() { return query; } } as unknown as TestServerClient;
  return { client, query, executions: () => executions, single: () => single };
}

test("send observer preserves lazy fluent query, response identity, and sanitized diagnostics", async () => {
  const result = { data: null, error: { code: "23514", message: "sensitive proof MUST NOT be emitted" } };
  const original = fixture(result);
  const emitted: unknown[] = [];
  const observed = observeQuoteSendRpcs(original.client, (diagnostic) => emitted.push(diagnostic));
  assert.equal(observeQuoteSendRpcs(observed.client), observed);
  const query = observed.client.rpc("authorize_quote_final_send", {}).single().throwOnError();
  assert.equal(query, original.query);
  assert.equal(original.executions(), 0);
  assert.equal(await query, result);
  assert.equal(original.executions(), 1);
  assert.equal(original.single(), true);
  assert.deepEqual(emitted, [{ rpc: "authorize_quote_final_send", code: "23514", message: "command RPC failed" }]);
});

test("send observer leaves unrelated RPCs untouched and preserves rejection identity", async () => {
  const unrelated = fixture({ data: "unchanged", error: null });
  const observed = observeQuoteSendRpcs(unrelated.client);
  assert.equal(observed.client.rpc("unrelated_command", {}), unrelated.query);
  const failure = new Error("original rejection");
  const rejected = fixture(null, failure);
  await assert.rejects(
    async () => { await observeQuoteSendRpcs(rejected.client).client.rpc("authorize_quote_final_send", {}).throwOnError(); },
    (error) => error === failure,
  );
});
