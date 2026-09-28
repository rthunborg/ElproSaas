/** Story 13.4 finalization failure atomicity coverage. */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertQuote,
  adminInsertQuoteVersion,
  cleanupFixture,
  cleanupRoleAwarePhaseAFixture,
  createRoleAwarePhaseAFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
} from "../../factories/tenants";
import { adminExec, adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { establishCurrentQuotePdf } from "../../support/quote-pdf";
import {
  isLocalStackReachable,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
} from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import type { CommandClock } from "@/server/commands/clock";
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent } from "@/server/commands/quotes";

const clock: CommandClock = { now: () => new Date("2026-09-24T18:20:00.000Z") };
let stackUp = false;

const originalBrokerEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SUPABASE_SERVICE_ROLE_KEY;
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
  if (originalBrokerEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalBrokerEnv.url;
  if (originalBrokerEnv.anonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalBrokerEnv.anonKey;
  if (originalBrokerEnv.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalBrokerEnv.serviceRoleKey;
});

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
    recovery_count: string;
  }>(
    `select
       (select status from public.quote_versions where id=$1) as status,
       (select count(*)::text from public.email_outbox where quote_version_id=$1) as outbox_count,
       (select count(*)::text from public.email_delivery_artifacts where quote_version_id=$1) as artifact_count,
       (select count(*)::text from public.email_delivery_events e join public.email_outbox o on o.id=e.outbox_id where o.quote_version_id=$1) as event_count,
       (select count(*)::text from public.email_delivery_recoveries where quote_version_id=$1) as recovery_count`,
    [quoteVersionId],
  );
  return {
    status: row!.status,
    outboxCount: Number(row!.outbox_count),
    artifactCount: Number(row!.artifact_count),
    eventCount: Number(row!.event_count),
    recoveryCount: Number(row!.recovery_count),
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
        recoveryCount: 0,
      });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0][AC8][13.4-INT-AC8-002] finalization audit failure rolls back queue state and records invalidated recovery evidence", async (ctx) => {
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
        recoveryCount: 1,
      });
      expect(await adminQuery<{
        failure_stage: string;
        recovery_state: string;
        correlation_id: string;
        actor_user_id: string;
      }>(
        "select failure_stage, recovery_state, correlation_id, actor_user_id from public.email_delivery_recoveries where quote_version_id=$1",
        [draft.quoteVersionId],
      )).toEqual([{
        failure_stage: "finalization",
        recovery_state: "invalidated",
        correlation_id: correlationId,
        actor_user_id: fixture.adminA.id,
      }]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0][AC8][13.4-INT-AC8-003] malformed HMAC configuration preserves the draft and records attributable orphaned recovery evidence", async (ctx) => {
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
      const previousKeyId = process.env.QUOTE_PDF_ATTESTATION_KEY_ID;
      process.env.QUOTE_PDF_ATTESTATION_KEY_ID = "invalid key id!";
      let result;
      try {
        result = await runCommand(markQuoteVersionSent, {
          client: client as never,
          clock,
          correlationId,
          input: {
            quote_version_id: draft.quoteVersionId,
            recipient_source_type: "customer",
            recipient_source_id: draft.customerId,
          },
        });
      } finally {
        if (previousKeyId === undefined) delete process.env.QUOTE_PDF_ATTESTATION_KEY_ID;
        else process.env.QUOTE_PDF_ATTESTATION_KEY_ID = previousKeyId;
      }
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("SERVER_ERROR");
      expect(await finalizationState(draft.quoteVersionId)).toEqual({
        status: "draft",
        outboxCount: 0,
        artifactCount: 0,
        eventCount: 0,
        recoveryCount: 1,
      });
      expect(await adminQuery<{
        failure_stage: string;
        recovery_state: string;
        correlation_id: string;
        actor_user_id: string;
      }>(
        "select failure_stage, recovery_state, correlation_id, actor_user_id from public.email_delivery_recoveries where quote_version_id=$1",
        [draft.quoteVersionId],
      )).toEqual([{
        failure_stage: "artifact_preparation",
        recovery_state: "orphaned",
        correlation_id: correlationId,
        actor_user_id: fixture.adminA.id,
      }]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0][AC8][13.4-INT-AC8-003b] absent HMAC configuration uses the service-only recovery writer", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const client = await makeAuthedServerClient(fixture.adminA);
      const draft = await seedDraft(fixture.tenantA.id);
      await establishCurrentQuotePdf({ client, tenantId: fixture.tenantA.id, quoteVersionId: draft.quoteVersionId, actorUserId: fixture.adminA.id, occurredAt: clock.now().toISOString() });
      const correlationId = crypto.randomUUID();
      const previousSecret = process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET;
      delete process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET;
      let result;
      try {
        result = await runCommand(markQuoteVersionSent, {
          client: client as never, clock, correlationId,
          input: { quote_version_id: draft.quoteVersionId, recipient_source_type: "customer", recipient_source_id: draft.customerId },
        });
      } finally {
        if (previousSecret === undefined) delete process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET;
        else process.env.QUOTE_PDF_ATTESTATION_HMAC_SECRET = previousSecret;
      }
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("SERVER_ERROR");
      expect(await finalizationState(draft.quoteVersionId)).toMatchObject({ status: "draft", recoveryCount: 1 });
      expect(await adminQuery<{ actor_user_id: string; failure_stage: string; recovery_state: string }>(
        "select actor_user_id, failure_stage, recovery_state from public.email_delivery_recoveries where quote_version_id=$1", [draft.quoteVersionId],
      )).toEqual([{ actor_user_id: fixture.adminA.id, failure_stage: "artifact_preparation", recovery_state: "orphaned" }]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0][AC8][13.4-INT-AC8-004] recovery RPC rejects cross-tenant and spoofed-actor writes", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const client = await makeAuthedServerClient(fixture.adminA);
      const draft = await seedDraft(fixture.tenantA.id);
      const rpc = client as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>;
      };
      const invalidAttestation = {
        p_attestation_root_fingerprint: "a".repeat(64),
        p_attestation_issued_at: new Date().toISOString(),
        p_attestation_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        p_attestation_signature: "b".repeat(64),
      };

      const actorMismatch = await rpc.rpc("record_quote_email_delivery_recovery", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: draft.quoteVersionId,
        p_actor_user_id: fixture.adminB.id,
        p_correlation_id: crypto.randomUUID(),
        p_failure_stage: "artifact_preparation",
        ...invalidAttestation,
      });
      expect(actorMismatch.error?.code).toBe("42501");

      const crossTenant = await rpc.rpc("record_quote_email_delivery_recovery", {
        p_tenant_id: fixture.tenantB.id,
        p_quote_version_id: draft.quoteVersionId,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: crypto.randomUUID(),
        p_failure_stage: "artifact_preparation",
        ...invalidAttestation,
      });
      expect(crossTenant.error?.code).toBe("42501");

      const directForgery = await rpc.rpc("record_quote_email_delivery_recovery", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: draft.quoteVersionId,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: crypto.randomUUID(),
        p_failure_stage: "artifact_preparation",
        ...invalidAttestation,
      });
      expect(directForgery.error?.code).toBe("PFD10");
      const configurationFallback = await rpc.rpc("record_quote_email_delivery_configuration_recovery", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: draft.quoteVersionId,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: crypto.randomUUID(),
      });
      expect(configurationFallback.error?.code).toBe("42501");
      const serviceClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY);
      const serviceCrossTenant = await serviceClient.rpc("record_quote_email_delivery_configuration_recovery", {
        p_tenant_id: fixture.tenantB.id,
        p_quote_version_id: draft.quoteVersionId,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: crypto.randomUUID(),
      });
      expect(serviceCrossTenant.error?.code).toBe("42501");
      const serviceSpoofedActor = await serviceClient.rpc("record_quote_email_delivery_configuration_recovery", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: draft.quoteVersionId,
        p_actor_user_id: fixture.adminB.id,
        p_correlation_id: crypto.randomUUID(),
      });
      expect(serviceSpoofedActor.error?.code).toBe("42501");
      expect(await finalizationState(draft.quoteVersionId)).toMatchObject({ recoveryCount: 0 });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0][AC8][13.4-INT-AC8-005] every Quotes.Send role persists attributable recovery evidence", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createRoleAwarePhaseAFixture();
    try {
      const admin = await makeAuthedServerClient(fixture.base.adminA);

      for (const actor of [fixture.users.projektledare, fixture.users.saljare]) {
        const actorClient = await makeAuthedServerClient(actor);
        const draft = await seedDraft(fixture.base.tenantA.id);
        await establishCurrentQuotePdf({
          client: admin,
          tenantId: fixture.base.tenantA.id,
          quoteVersionId: draft.quoteVersionId,
          actorUserId: fixture.base.adminA.id,
          occurredAt: clock.now().toISOString(),
        });
        const correlationId = crypto.randomUUID();
        const result = await withForcedAuditFailure(correlationId, () =>
          runCommand(markQuoteVersionSent, {
            client: actorClient as never,
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
        if (!result.ok) expect(result.code, actor.email).toBe("SERVER_ERROR");
        expect(await finalizationState(draft.quoteVersionId)).toEqual({
          status: "draft",
          outboxCount: 0,
          artifactCount: 0,
          eventCount: 0,
          recoveryCount: 1,
        });
        expect(await adminQuery<{
          actor_user_id: string;
          correlation_id: string;
          failure_stage: string;
          recovery_state: string;
        }>(
          "select actor_user_id, correlation_id, failure_stage, recovery_state from public.email_delivery_recoveries where quote_version_id=$1",
          [draft.quoteVersionId],
        )).toEqual([{
          actor_user_id: actor.id,
          correlation_id: correlationId,
          failure_stage: "finalization",
          recovery_state: "invalidated",
        }]);
      }
    } finally {
      await cleanupRoleAwarePhaseAFixture(fixture);
    }
  });
});
