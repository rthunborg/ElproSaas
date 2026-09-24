/** Story 13.4 finalization failure atomicity coverage. */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertQuote,
  adminInsertQuoteVersion,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
} from "../../factories/tenants";
import { adminExec, adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { establishCurrentQuotePdf } from "../../support/quote-pdf";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import type { CommandClock } from "@/server/commands/clock";
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent } from "@/server/commands/quotes";

const clock: CommandClock = { now: () => new Date("2026-09-24T18:20:00.000Z") };
let stackUp = false;

beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

async function withForcedAuditFailure<T>(correlationId: string, run: () => Promise<T>): Promise<T> {
  await adminExec(
    "insert into test_support.forced_audit_failures (correlation_id) values ($1::uuid) on conflict (correlation_id) do nothing",
    [correlationId],
  );
  try {
    return await run();
  } finally {
    await adminExec(
      "delete from test_support.forced_audit_failures where correlation_id = $1::uuid",
      [correlationId],
    );
  }
}

async function seedDraft(tenantId: string): Promise<{ customerId: string; quoteVersionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `finalization-${crypto.randomUUID()}`,
  });
  await adminQuery("update public.customers set email=$2 where id=$1", [
    customerId,
    `recipient-${crypto.randomUUID().slice(0, 8)}@example.test`,
  ]);
  const calculationId = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customerId });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const quoteVersionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calculationId,
    status: "draft",
  });
  return { customerId, quoteVersionId };
}

async function finalizationState(quoteVersionId: string) {
  const [row] = await adminQuery<{
    status: string;
    outbox_count: string;
    artifact_count: string;
    event_count: string;
  }>(
    `select
       (select status from public.quote_versions where id=$1) as status,
       (select count(*)::text from public.email_outbox where quote_version_id=$1) as outbox_count,
       (select count(*)::text from public.email_delivery_artifacts where quote_version_id=$1) as artifact_count,
       (select count(*)::text from public.email_delivery_events e join public.email_outbox o on o.id=e.outbox_id where o.quote_version_id=$1) as event_count`,
    [quoteVersionId],
  );
  return {
    status: row!.status,
    outboxCount: Number(row!.outbox_count),
    artifactCount: Number(row!.artifact_count),
    eventCount: Number(row!.event_count),
  };
}

describe("Story 13.4 quote delivery finalization failure atomicity", () => {
  test("[P0][AC8][13.4-INT-AC8-001] rejects malformed delivery bytes before any finalization write", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const client = await makeAuthedServerClient(fixture.adminA);
      const draft = await seedDraft(fixture.tenantA.id);
      const rpc = client as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>;
      };
      const result = await rpc.rpc("finalize_quote_email_delivery", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: draft.quoteVersionId,
        p_authorization_id: crypto.randomUUID(),
        p_sent_at: clock.now().toISOString(),
        p_channel: null,
        p_reference: null,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: crypto.randomUUID(),
        p_attestation_key_id: "test",
        p_attestation_issued_at: clock.now().toISOString(),
        p_attestation_expires_at: clock.now().toISOString(),
        p_attestation_signature: "invalid",
        p_recipient_source_type: "customer",
        p_recipient_source_id: draft.customerId,
        p_pdf_base64: "",
        p_content_fingerprint: "a".repeat(64),
        p_pdf_checksum_sha256: "b".repeat(64),
      });
      expect(result.error?.code).toBe("23514");
      expect(await finalizationState(draft.quoteVersionId)).toEqual({
        status: "draft",
        outboxCount: 0,
        artifactCount: 0,
        eventCount: 0,
      });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0][AC8][13.4-INT-AC8-002] audit failure rolls back finalized state, outbox, artifact, and queued event", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const client = await makeAuthedServerClient(fixture.adminA);
      const draft = await seedDraft(fixture.tenantA.id);
      await establishCurrentQuotePdf({
        client,
        tenantId: fixture.tenantA.id,
        quoteVersionId: draft.quoteVersionId,
        actorUserId: fixture.adminA.id,
        occurredAt: clock.now().toISOString(),
      });
      const correlationId = crypto.randomUUID();
      const result = await withForcedAuditFailure(correlationId, () =>
        runCommand(markQuoteVersionSent, {
          client: client as never,
          clock,
          correlationId,
          input: {
            quote_version_id: draft.quoteVersionId,
            recipient_source_type: "customer",
            recipient_source_id: draft.customerId,
          },
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("SERVER_ERROR");
      expect(await finalizationState(draft.quoteVersionId)).toEqual({
        status: "draft",
        outboxCount: 0,
        artifactCount: 0,
        eventCount: 0,
      });
    } finally {
      await cleanupFixture(fixture);
    }
  });
});
