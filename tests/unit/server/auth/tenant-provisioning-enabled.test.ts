import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isTenantProvisioningEnabled } from "@/server/auth/tenant-provisioning-enabled";
import { resolvePlatformOperator } from "@/server/auth/resolve-platform-operator";

function environment(t: TestContext, nodeEnv: string | undefined, enabled: string | undefined) {
  const previous = { NODE_ENV: process.env.NODE_ENV, TENANT_PROVISIONING_ENABLED: process.env.TENANT_PROVISIONING_ENABLED };
  const env = process.env as Record<string, string | undefined>;
  for (const [key, value] of Object.entries({ NODE_ENV: nodeEnv, TENANT_PROVISIONING_ENABLED: enabled })) {
    if (value === undefined) delete env[key]; else env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key]; else env[key] = value;
    }
  });
}

for (const value of [undefined, "", "false", "TRUE", " true", "true ", "1"]) {
  test(`production denies provisioning for ${JSON.stringify(value) ?? "unset"} before client access`, async (t) => {
    environment(t, "production", value);
    assert.equal(isTenantProvisioningEnabled(), false);
    const client = new Proxy({}, { get() { assert.fail("disabled gate touched the client"); } }) as SupabaseClient;
    assert.deepEqual(await resolvePlatformOperator({ client }), { ok: false, code: "OPERATOR_ACCESS_DENIED" });
  });
}

for (const mode of [undefined, "development", "test"]) {
  test(`local/unit default remains enabled in ${mode ?? "unset mode"} but explicit false denies`, (t) => {
    environment(t, mode, undefined);
    assert.equal(isTenantProvisioningEnabled(), true);
    process.env.TENANT_PROVISIONING_ENABLED = "false";
    assert.equal(isTenantProvisioningEnabled(), false);
  });
}

test("production opt-in still requires verified identity and a literal DB allow-list success", async (t) => {
  environment(t, "production", "true");
  assert.equal(isTenantProvisioningEnabled(), true);
  for (const scenario of [
    { user: null, authError: null, allowed: true, rpcError: null, succeeds: false },
    { user: { id: "operator" }, authError: {}, allowed: true, rpcError: null, succeeds: false },
    ...[false, null, "true"].map((allowed) => ({ user: { id: "operator" }, authError: null, allowed, rpcError: null, succeeds: false })),
    { user: { id: "operator" }, authError: null, allowed: true, rpcError: {}, succeeds: false },
    { user: { id: "operator" }, authError: null, allowed: true, rpcError: null, succeeds: true },
  ]) {
    let calls = 0;
    const client = {
      auth: { getUser: async () => ({ data: { user: scenario.user }, error: scenario.authError }) },
      rpc: async (name: string) => { assert.equal(name, "is_platform_operator"); calls++; return { data: scenario.allowed, error: scenario.rpcError }; },
    } as unknown as SupabaseClient;
    assert.deepEqual(await resolvePlatformOperator({ client }), scenario.succeeds
      ? { ok: true, userId: "operator" }
      : { ok: false, code: "OPERATOR_ACCESS_DENIED" });
    assert.equal(calls, scenario.user && !scenario.authError ? 1 : 0);
  }
});

test("the gate is evaluated on each authorization, including after earlier successful access", async (t) => {
  environment(t, "production", "true");
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "operator" } }, error: null }) },
    rpc: async () => ({ data: true, error: null }),
  } as unknown as SupabaseClient;
  assert.equal((await resolvePlatformOperator({ client })).ok, true);
  process.env.TENANT_PROVISIONING_ENABLED = "false";
  assert.deepEqual(await resolvePlatformOperator({ client }), { ok: false, code: "OPERATOR_ACCESS_DENIED" });
});
