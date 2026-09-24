import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { createTwoTenantFixture, cleanupFixture } from "../../factories/tenants";
import { isLocalStackReachable, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

describe("Story 13.4 unsubscribe public capability and RLS", () => {
  test("[P0][13.4-RLS-001] keeps token records unreadable to anon while its token hash is scoped to one tenant", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const { createUnsubscribeToken } = await import("@/server/email/unsubscribe");
      const issued = createUnsubscribeToken(32);
      expect(issued.plaintextToken).toHaveLength(64);
      await adminQuery("insert into public.email_unsubscribe_tokens (tenant_id,token_hash,recipient_hash,category) values ($1,$2,repeat('a',64),'quote.delivery')", [fixture.tenantA.id, issued.tokenHash]);
      const anon = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
      expect((await anon.from("email_unsubscribe_tokens").select("*")).data ?? []).toEqual([]);
      expect((await anon.rpc("consume_email_unsubscribe_token", { p_token_hash: issued.tokenHash, p_ip_hash: hash("203.0.113.15"), p_reactivate: false })).data).toBe("unsubscribed");
      expect(await adminQuery("select tenant_id from public.email_suppressions where tenant_id=$1 and recipient_hash=repeat('a',64) and category='quote.delivery'", [fixture.tenantA.id])).toEqual([{ tenant_id: fixture.tenantA.id }]);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][13.4-RLS-002] returns uniform inactive for unknown or revoked tokens while active token/IP limits return limited", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    const anon = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    const ipHash = hash("203.0.113.15"); const revoked = hash(`revoked-${crypto.randomUUID()}`); const active = hash(`active-${crypto.randomUUID()}`);
    try {
      await adminQuery("insert into public.email_unsubscribe_tokens (tenant_id,token_hash,recipient_hash,category,revoked_at) values ($1,$2,repeat('b',64),'quote.delivery',now()),($1,$3,repeat('c',64),'quote.delivery',null)", [fixture.tenantA.id, revoked, active]);
      await adminQuery("insert into public.email_unsubscribe_rate_limits (tenant_id,token_hash,ip_hash,window_started_at,attempts) values ($1,$2,$3,date_trunc('hour',now()),10),($1,$4,$3,date_trunc('hour',now()),10)", [fixture.tenantA.id, revoked, ipHash, active]);
      expect((await anon.rpc("consume_email_unsubscribe_token", { p_token_hash: hash("unknown-token"), p_ip_hash: ipHash, p_reactivate: false })).data).toBe("inactive");
      expect((await anon.rpc("consume_email_unsubscribe_token", { p_token_hash: revoked, p_ip_hash: ipHash, p_reactivate: false })).data).toBe("inactive");
      expect((await anon.rpc("consume_email_unsubscribe_token", { p_token_hash: active, p_ip_hash: ipHash, p_reactivate: false })).data).toBe("limited");
      expect(await adminQuery("select attempts from public.email_unsubscribe_rate_limits where tenant_id=$1 and token_hash=$2", [fixture.tenantA.id, revoked])).toEqual([{ attempts: 10 }]);
    } finally { await cleanupFixture(fixture); }
  });
});
