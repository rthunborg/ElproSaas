import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { adminInsertCalculation, adminInsertCustomer, adminInsertQuote, adminInsertQuoteVersion, adminUpdateQuoteVersionStatus, cleanupFixture, createTwoTenantFixture } from "../../factories/tenants";
import { isLocalStackReachable, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

const deps = () => ({ client: createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) });

async function seedDeliveryArtifact(tenantId: string): Promise<{ readonly outboxId: string; readonly quoteVersionId: string }> {
  const customerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: "Delivery fixture" });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const calculationId = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customerId });
  const quoteVersionId = await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: quoteId, calculation_id: calculationId, company_name: "Delivery fixture" });
  await adminUpdateQuoteVersionStatus(quoteVersionId, "sent");
  const bytes = "25504446";
  await adminQuery("update public.quote_versions set pdf_content_fingerprint=repeat('a',64) where id=$1", [quoteVersionId]);
  const outbox = (await adminQuery<{ id: string }>("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params,next_attempt_at) values ($1,repeat('a',64),'quote.delivery','quote_version',$2,current_date,'quote-delivery',1,'{}'::jsonb,now()-interval '1 minute') returning id", [tenantId, quoteVersionId]))[0]!;
  const artifact = (await adminQuery<{ id: string }>("insert into public.email_delivery_artifacts (tenant_id,outbox_id,quote_version_id,content_fingerprint,pdf_checksum_sha256,pdf_bytes) values ($1,$2,$3,repeat('a',64),encode(extensions.digest(decode($4,'hex'),'sha256'),'hex'),decode($4,'hex')) returning id", [tenantId, outbox.id, quoteVersionId, bytes]))[0]!;
  await adminQuery("update public.email_outbox set quote_version_id=$2, delivery_artifact_id=$3, recipient_normalized='delivery@example.test', recipient_source_type='customer', recipient_source_id=$4 where id=$1", [outbox.id, quoteVersionId, artifact.id, customerId]);
  return { outboxId: outbox.id, quoteVersionId };
}

describe("Story 13.4 activated email outbox delivery (ATDD RED)", () => {
  test("[P0][13.4-INT-001] sends one sandbox-eligible artifact-backed claim, stores only provider ID, and consumes the artifact", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processEmailOutbox } = await import(["@/server/email/outbox"].join(""));
    const fixture = await createTwoTenantFixture();
    const submit = vi.fn().mockResolvedValue({ providerMessageId: "sandbox-msg-13-4" });
    try {
      const row = await seedDeliveryArtifact(fixture.tenantA.id);
      expect(await adminQuery("select o.quote_version_id, o.delivery_artifact_id, qv.status, qv.pdf_content_fingerprint, a.recovery_state from public.email_outbox o join public.quote_versions qv on qv.id=o.quote_version_id join public.email_delivery_artifacts a on a.outbox_id=o.id where o.id=$1", [row.outboxId])).toEqual([{ quote_version_id: expect.any(String), delivery_artifact_id: expect.any(String), status: "sent", pdf_content_fingerprint: "a".repeat(64), recovery_state: "prepared" }]);
      await processEmailOutbox({ ...deps(), deliveryAdapter: { submit }, releaseControl: { mode: "sandbox" } }, { tenantId: fixture.tenantA.id, workerId: "worker-13-4" });
      expect(await adminQuery("select state, attempts from public.email_outbox where id=$1", [row.outboxId])).toEqual([{ state: "sent", attempts: 0 }]);
      expect(submit).toHaveBeenCalledOnce();
      expect(await adminQuery("select state, provider_message_id from public.email_outbox where id=$1", [row.outboxId])).toEqual([{ state: "sent", provider_message_id: "sandbox-msg-13-4" }]);
      expect(await adminQuery("select event_type from public.email_delivery_events where outbox_id=$1 order by created_at", [row.outboxId])).toEqual(expect.arrayContaining([{ event_type: "sent" }]));
      expect(await adminQuery("select recovery_state from public.email_delivery_artifacts where outbox_id=$1", [row.outboxId])).toEqual([{ recovery_state: "consumed" }]);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][13.4-INT-002] leaves eligible work queued and makes no adapter call while the release posture is closed", async (ctx) => {
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

  test("[P0][13.4-INT-003] suppresses matching non-essential email before rendering or provider submission", async (ctx) => {
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

  test("[P0][13.4-INT-009] sends a non-quote delivery without requiring a quote artifact", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processEmailOutbox } = await import(["@/server/email/outbox"].join(""));
    const fixture = await createTwoTenantFixture();
    const submit = vi.fn().mockResolvedValue({ providerMessageId: "sandbox-follow-up-13-4" });
    try {
      const row = (await adminQuery<{ id: string }>("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params,next_attempt_at) values ($1,repeat('e',64),'quote.follow_up_due','quote',gen_random_uuid(),'2026-09-24','quote-follow-up',1,'{}'::jsonb,now()-interval '1 minute') returning id", [fixture.tenantA.id]))[0]!;
      await processEmailOutbox({ ...deps(), deliveryAdapter: { submit }, releaseControl: { mode: "sandbox" } }, { tenantId: fixture.tenantA.id, workerId: "worker-13-4" });
      expect(submit).toHaveBeenCalledOnce();
      expect(await adminQuery("select state, provider_message_id from public.email_outbox where id=$1", [row.id])).toEqual([{ state: "sent", provider_message_id: "sandbox-follow-up-13-4" }]);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][13.4-INT-008] fails a claimed delivery without an artifact before provider submission and leaves recoverable queued state", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processEmailOutbox } = await import(["@/server/email/outbox"].join(""));
    const fixture = await createTwoTenantFixture();
    const submit = vi.fn();
    try {
      const row = (await adminQuery<{ id: string }>("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params,next_attempt_at) values ($1,repeat('d',64),'quote.delivery','quote',gen_random_uuid(),'2026-09-24','quote-delivery',1,'{}'::jsonb,now()-interval '1 minute') returning id", [fixture.tenantA.id]))[0]!;
      await processEmailOutbox({ ...deps(), deliveryAdapter: { submit }, releaseControl: { mode: "sandbox" } }, { tenantId: fixture.tenantA.id, workerId: "worker-13-4" });
      expect(submit).not.toHaveBeenCalled();
      expect(await adminQuery("select state, attempts from public.email_outbox where id=$1", [row.id])).toEqual([{ state: "queued", attempts: 1 }]);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][13.4-INT-010] rechecks a claimed quote delivery at the final provider boundary and blocks a newly terminal quote", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const { processEmailOutbox } = await import(["@/server/email/outbox"].join(""));
    const fixture = await createTwoTenantFixture();
    const submit = vi.fn();
    try {
      const row = await seedDeliveryArtifact(fixture.tenantA.id);
      const baseClient = deps().client;
      let transitionedAtValidation = false;
      const client = {
        from: baseClient.from.bind(baseClient),
        rpc: async (fn: string, args?: Record<string, unknown>, options?: unknown) => {
          if (fn === "validate_claimed_quote_email_delivery" && !transitionedAtValidation) {
            transitionedAtValidation = true;
            await adminUpdateQuoteVersionStatus(row.quoteVersionId, "rejected");
          }
          return (baseClient.rpc as unknown as (name: string, parameters?: Record<string, unknown>, requestOptions?: unknown) => PromiseLike<unknown>)(fn, args, options);
        },
      };

      await processEmailOutbox({ client: client as never, deliveryAdapter: { submit }, releaseControl: { mode: "sandbox" } }, { tenantId: fixture.tenantA.id, workerId: "worker-13-4-terminal-race" });

      expect(transitionedAtValidation).toBe(true);
      expect(submit).not.toHaveBeenCalled();
      expect(await adminQuery("select state, attempts from public.email_outbox where id=$1", [row.outboxId])).toEqual([{ state: "queued", attempts: 1 }]);
      expect(await adminQuery("select status from public.quote_versions where id=$1", [row.quoteVersionId])).toEqual([{ status: "rejected" }]);
      expect(await adminQuery("select recovery_state from public.email_delivery_artifacts where outbox_id=$1", [row.outboxId])).toEqual([{ recovery_state: "prepared" }]);
    } finally { await cleanupFixture(fixture); }
  });
});
