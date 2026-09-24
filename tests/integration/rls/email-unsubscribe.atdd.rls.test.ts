import { describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createTwoTenantFixture, cleanupFixture } from "../../factories/tenants";
import { LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";

describe("Story 13.4 unsubscribe public capability and RLS (ATDD RED)", () => {
  test.skip("[P0][13.4-RLS-001] hashes a 256-bit token, limits its scope, and prevents tenant-B reads or mutation through tenant-A authority", async () => {
    const fixture = await createTwoTenantFixture();
    try {
      const { issueUnsubscribeToken, consumeUnsubscribeToken } = await import(["@/server/email/unsubscribe"].join(""));
      const issued = await issueUnsubscribeToken({ tenantId: fixture.tenantA.id, recipientHash: "a".repeat(64), category: "quote.follow_up_due", entropyBytes: 32 });
      expect(issued.plaintextToken).toHaveLength(64);
      expect(issued.persisted).toMatchObject({ tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/), tenantId: fixture.tenantA.id, category: "quote.follow_up_due" });
      const outcome = await consumeUnsubscribeToken({ token: issued.plaintextToken, tenantId: fixture.tenantB.id });
      expect(outcome).toEqual({ state: "inactive" });
      const anon = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
      expect((await anon.from("email_unsubscribe_tokens").select("*")).data).toEqual([]);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][13.4-RLS-002] makes unknown and revoked tokens indistinguishable, returns 429 for token/IP fixed-window limits, and never emits tenant or recipient data", async () => {
    const { handleUnsubscribeRequest } = await import(["@/server/email/unsubscribe"].join(""));
    const unknown = await handleUnsubscribeRequest({ token: "0".repeat(64), ip: "203.0.113.15" });
    const revoked = await handleUnsubscribeRequest({ token: "1".repeat(64), ip: "203.0.113.15" });
    expect(unknown).toEqual(revoked);
    expect(unknown).toMatchObject({ status: 200, body: { state: "inactive" } });
    expect(JSON.stringify(unknown)).not.toMatch(/tenant|recipient|email/i);
    const limited = await handleUnsubscribeRequest({ token: "0".repeat(64), ip: "203.0.113.15", attemptsInWindow: 11 });
    expect(limited).toMatchObject({ status: 429, headers: { "retry-after": expect.any(String) } });
  });
});
