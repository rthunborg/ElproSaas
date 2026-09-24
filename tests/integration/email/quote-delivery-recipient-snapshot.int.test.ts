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
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { establishCurrentQuotePdf } from "../../support/quote-pdf";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const clock: CommandClock = { now: () => new Date("2026-09-24T18:20:00.000Z") };
let stackUp = false;

afterAll(async () => { await closeAdminPool(); });
beforeAll(async () => { stackUp = await isLocalStackReachable(); });

describe("Story 13.4 quote delivery recipient snapshot", () => {
  test("[P0][AC6] freezes the selected customer address in the queued delivery when the CRM email later changes", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const client = await makeAuthedServerClient(fixture.adminA);
      const customerId = await adminInsertCustomer({
        tenant_id: fixture.tenantA.id,
        customer_type: "company",
        display_name: `Recipient snapshot ${crypto.randomUUID().slice(0, 8)}`,
      });
      const selectedAddress = `selected-${crypto.randomUUID().slice(0, 8)}@example.test`;
      await adminQuery("update public.customers set email=$2 where id=$1", [customerId, selectedAddress]);
      const calculationId = await adminInsertCalculation({ tenant_id: fixture.tenantA.id, customer_id: customerId });
      const quoteId = await adminInsertQuote({ tenant_id: fixture.tenantA.id, customer_id: customerId });
      const quoteVersionId = await adminInsertQuoteVersion({
        tenant_id: fixture.tenantA.id,
        quote_id: quoteId,
        calculation_id: calculationId,
        status: "draft",
      });
      await establishCurrentQuotePdf({
        client,
        tenantId: fixture.tenantA.id,
        quoteVersionId,
        actorUserId: fixture.adminA.id,
        occurredAt: clock.now().toISOString(),
      });

      const result = await runCommand(markQuoteVersionSent, {
        client: client as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: {
          quote_version_id: quoteVersionId,
          recipient_source_type: "customer",
          recipient_source_id: customerId,
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const before = await adminQuery<{ recipient_normalized: string; recipient_hash: string; recipient_source_type: string; recipient_source_id: string }>(
        "select recipient_normalized, recipient_hash, recipient_source_type, recipient_source_id from public.email_outbox where quote_version_id=$1",
        [quoteVersionId],
      );
      expect(before).toEqual([{
        recipient_normalized: selectedAddress,
        recipient_hash: expect.any(String),
        recipient_source_type: "customer",
        recipient_source_id: customerId,
      }]);

      await adminQuery("update public.customers set email=$2 where id=$1", [customerId, `edited-${crypto.randomUUID().slice(0, 8)}@example.test`]);
      const after = await adminQuery<{ recipient_normalized: string; recipient_hash: string; recipient_source_type: string; recipient_source_id: string }>(
        "select recipient_normalized, recipient_hash, recipient_source_type, recipient_source_id from public.email_outbox where quote_version_id=$1",
        [quoteVersionId],
      );
      expect(after).toEqual(before);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});
