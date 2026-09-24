import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { cleanupFixture, createTwoTenantFixture } from "../../factories/tenants";
import { isLocalStackReachable, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

const deps = () => ({ client: createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) });

describe("Story 13.4 activated email outbox delivery (ATDD RED)", () => {
  test.skip("[P0][13.4-INT-001] sends one sandbox-eligible claim, stores only provider ID, and appends sent exactly once", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processEmailOutbox } = await import(["@/server/email/outbox"].join(""));
    const fixture = await createTwoTenantFixture();
    const submit = vi.fn().mockResolvedValue({ providerMessageId: "sandbox-msg-13-4" });
    try {
      const row = (await adminQuery("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params,next_attempt_at) values ($1,repeat('a',64),'quote.delivery','quote',gen_random_uuid(),'2026-09-24','quote-delivery',1,'{}'::jsonb,now()-interval '1 minute') returning id", [fixture.tenantA.id]))[0]!;
      await processEmailOutbox({ ...deps(), deliveryAdapter: { submit }, releaseControl: { mode: "sandbox" } }, { tenantId: fixture.tenantA.id, workerId: "worker-13-4" });
      expect(submit).toHaveBeenCalledOnce();
      expect(await adminQuery("select state, provider_message_id from public.email_outbox where id=$1", [row.id])).toEqual([{ state: "sent", provider_message_id: "sandbox-msg-13-4" }]);
      expect(await adminQuery("select event_type from public.email_delivery_events where outbox_id=$1 order by created_at", [row.id])).toEqual(expect.arrayContaining([{ event_type: "sent" }]));
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][13.4-INT-002] leaves eligible work queued and makes no adapter call while the release posture is closed", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processEmailOutbox } = await import(["@/server/email/outbox"].join(""));
    const fixture = await createTwoTenantFixture();
    const submit = vi.fn();
    try {
      const row = (await adminQuery("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params,next_attempt_at) values ($1,repeat('b',64),'quote.delivery','quote',gen_random_uuid(),'2026-09-24','quote-delivery',1,'{}'::jsonb,now()-interval '1 minute') returning id", [fixture.tenantA.id]))[0]!;
      await processEmailOutbox({ ...deps(), deliveryAdapter: { submit }, releaseControl: { mode: "real", ownerApproval: false } }, { tenantId: fixture.tenantA.id, workerId: "worker-13-4" });
      expect(submit).not.toHaveBeenCalled();
      expect(await adminQuery("select state, provider_message_id from public.email_outbox where id=$1", [row.id])).toEqual([{ state: "queued", provider_message_id: null }]);
      expect(await adminQuery("select event_type from public.email_delivery_events where outbox_id=$1 and event_type='sent'", [row.id])).toEqual([]);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][13.4-INT-003] suppresses matching non-essential email before rendering or provider submission", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processEmailOutbox } = await import(["@/server/email/outbox"].join(""));
    const fixture = await createTwoTenantFixture();
    const submit = vi.fn();
    try {
      const row = (await adminQuery("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params,next_attempt_at) values ($1,repeat('c',64),'quote.follow_up_due','quote',gen_random_uuid(),'2026-09-24','quote-follow-up',1,'{}'::jsonb,now()-interval '1 minute') returning id,recipient_hash", [fixture.tenantA.id]))[0]!;
      await adminQuery("insert into public.email_suppressions (tenant_id,recipient_hash,category) values ($1,$2,'quote.follow_up_due')", [fixture.tenantA.id, row.recipient_hash]);
      await processEmailOutbox({ ...deps(), deliveryAdapter: { submit }, releaseControl: { mode: "sandbox" } }, { tenantId: fixture.tenantA.id, workerId: "worker-13-4" });
      expect(submit).not.toHaveBeenCalled();
      expect(await adminQuery("select state from public.email_outbox where id=$1", [row.id])).toEqual([{ state: "suppressed" }]);
    } finally { await cleanupFixture(fixture); }
  });
});
