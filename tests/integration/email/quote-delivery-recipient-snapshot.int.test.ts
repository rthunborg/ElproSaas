import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  adminInsertCalculation,
  adminInsertContact,
  adminInsertCustomer,
  adminInsertQuote,
  adminInsertQuoteVersion,
  cleanupFixture,
  cleanupRoleAwarePhaseAFixture,
  createRoleAwarePhaseAFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
} from "../../factories/tenants";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { establishCurrentQuotePdf } from "../../support/quote-pdf";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import {
  correctPendingQuoteDeliveryRecipient,
  markQuoteVersionSent,
} from "@/server/commands/quotes";
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

  test("[P0][AC6] cancels a tenant's queued delivery and creates a freshly audited recipient snapshot", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const client = await makeAuthedServerClient(fixture.adminA);
      const customerId = await adminInsertCustomer({
        tenant_id: fixture.tenantA.id,
        customer_type: "company",
        display_name: `Recipient correction ${crypto.randomUUID().slice(0, 8)}`,
      });
      await adminQuery("update public.customers set email=$2 where id=$1", [
        customerId,
        `original-${crypto.randomUUID().slice(0, 8)}@example.test`,
      ]);
      const contactId = await adminInsertContact({
        tenant_id: fixture.tenantA.id,
        customer_id: customerId,
        name: "Replacement recipient",
      });
      const replacementEmail = `replacement-${crypto.randomUUID().slice(0, 8)}@example.test`;
      await adminQuery("update public.contacts set email=$2 where id=$1", [contactId, replacementEmail]);
      const unrelatedCustomerId = await adminInsertCustomer({
        tenant_id: fixture.tenantA.id,
        customer_type: "company",
        display_name: `Unrelated recipient ${crypto.randomUUID().slice(0, 8)}`,
      });
      const unrelatedContactId = await adminInsertContact({
        tenant_id: fixture.tenantA.id,
        customer_id: unrelatedCustomerId,
        name: "Foreign recipient",
      });
      await adminQuery("update public.contacts set email=$2 where id=$1", [unrelatedContactId, `unrelated-${crypto.randomUUID().slice(0, 8)}@example.test`]);
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
      const initial = await runCommand(markQuoteVersionSent, {
        client: client as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: {
          quote_version_id: quoteVersionId,
          recipient_source_type: "customer",
          recipient_source_id: customerId,
        },
      });
      expect(initial.ok).toBe(true);
      if (!initial.ok) return;

      const unrelatedRecipient = await runCommand(correctPendingQuoteDeliveryRecipient, {
        client: client as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: {
          quote_version_id: quoteVersionId,
          recipient_source_type: "contact",
          recipient_source_id: unrelatedContactId,
        },
      });
      expect(unrelatedRecipient).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
      expect(await adminQuery("select state from public.email_outbox where tenant_id=$1 and quote_version_id=$2", [fixture.tenantA.id, quoteVersionId])).toEqual([{ state: "queued" }]);

      const foreignTenant = await runCommand(correctPendingQuoteDeliveryRecipient, {
        client: (await makeAuthedServerClient(fixture.adminB)) as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: {
          quote_version_id: quoteVersionId,
          recipient_source_type: "contact",
          recipient_source_id: contactId,
        },
      });
      expect(foreignTenant).toMatchObject({ ok: false, code: "TENANT_ACCESS_DENIED" });
      expect(await adminQuery("select state from public.email_outbox where tenant_id=$1 and quote_version_id=$2", [fixture.tenantA.id, quoteVersionId])).toEqual([{ state: "queued" }]);

      const correctionCorrelationId = crypto.randomUUID();
      const corrected = await runCommand(correctPendingQuoteDeliveryRecipient, {
        client: client as never,
        clock,
        correlationId: correctionCorrelationId,
        input: {
          quote_version_id: quoteVersionId,
          recipient_source_type: "contact",
          recipient_source_id: contactId,
        },
      });
      expect(corrected.ok).toBe(true);
      if (!corrected.ok) return;
      expect(corrected.data.targetId).toBe(quoteVersionId);
      expect(corrected.data.targetId).toBe(quoteVersionId);

      const rows = await adminQuery<{
        state: string;
        recipient_normalized: string;
        recipient_source_type: string;
        recipient_source_id: string;
        recovery_state: string;
        delivery_sequence: number;
      }>(
        `select o.state,o.recipient_normalized,o.recipient_source_type,o.recipient_source_id,o.delivery_sequence,a.recovery_state
           from public.email_outbox o
           join public.email_delivery_artifacts a on a.id=o.delivery_artifact_id and a.tenant_id=o.tenant_id
          where o.tenant_id=$1 and o.quote_version_id=$2 order by o.created_at`,
        [fixture.tenantA.id, quoteVersionId],
      );
      expect(rows).toEqual([
        expect.objectContaining({ state: "cancelled", recipient_source_type: "customer", recipient_source_id: customerId, recovery_state: "invalidated", delivery_sequence: 1 }),
        expect.objectContaining({ state: "queued", recipient_normalized: replacementEmail, recipient_source_type: "contact", recipient_source_id: contactId, recovery_state: "prepared", delivery_sequence: 2 }),
      ]);
      expect(await adminQuery(
        "select command,event_type,target_id from public.audit_events where correlation_id=$1",
        [correctionCorrelationId],
      )).toEqual([{
        command: "quote.delivery.correct_recipient",
        event_type: "quote.delivery.recipient_corrected",
        target_id: quoteVersionId,
      }]);

      await adminQuery(
        "update public.email_outbox set state='sending',lease_owner='claimed-correction-test',lease_expires_at=now()+interval '15 minutes' where tenant_id=$1 and quote_version_id=$2 and state='queued'",
        [fixture.tenantA.id, quoteVersionId],
      );
      const claimed = await runCommand(correctPendingQuoteDeliveryRecipient, {
        client: client as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: {
          quote_version_id: quoteVersionId,
          recipient_source_type: "customer",
          recipient_source_id: customerId,
        },
      });
      expect(claimed).toMatchObject({ ok: false, code: "QUOTE_VERSION_LOCKED" });
      expect(await adminQuery("select state, count(*)::int as count from public.email_outbox where tenant_id=$1 and quote_version_id=$2 group by state order by state", [fixture.tenantA.id, quoteVersionId])).toEqual([
        { state: "cancelled", count: 1 },
        { state: "sending", count: 1 },
      ]);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0][AC6] permits project managers and sales users to correct an eligible queued delivery through the Quotes.Send boundary", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createRoleAwarePhaseAFixture();
    try {
      const admin = await makeAuthedServerClient(fixture.base.adminA);
      const projectManager = await makeAuthedServerClient(fixture.users.projektledare);
      const seller = await makeAuthedServerClient(fixture.users.saljare);
      const customerId = await adminInsertCustomer({
        tenant_id: fixture.base.tenantA.id,
        customer_type: "company",
        display_name: `Role correction ${crypto.randomUUID().slice(0, 8)}`,
      });
      await adminQuery("update public.customers set email=$2 where id=$1", [customerId, `role-original-${crypto.randomUUID().slice(0, 8)}@example.test`]);
      const firstContactId = await adminInsertContact({ tenant_id: fixture.base.tenantA.id, customer_id: customerId, name: "Project manager recipient" });
      const secondContactId = await adminInsertContact({ tenant_id: fixture.base.tenantA.id, customer_id: customerId, name: "Sales recipient" });
      await adminQuery("update public.contacts set email=$2 where id=$1", [firstContactId, `role-pm-${crypto.randomUUID().slice(0, 8)}@example.test`]);
      await adminQuery("update public.contacts set email=$2 where id=$1", [secondContactId, `role-sales-${crypto.randomUUID().slice(0, 8)}@example.test`]);
      const calculationId = await adminInsertCalculation({ tenant_id: fixture.base.tenantA.id, customer_id: customerId });
      const quoteId = await adminInsertQuote({ tenant_id: fixture.base.tenantA.id, customer_id: customerId });
      const quoteVersionId = await adminInsertQuoteVersion({ tenant_id: fixture.base.tenantA.id, quote_id: quoteId, calculation_id: calculationId, status: "draft" });
      await establishCurrentQuotePdf({
        client: admin,
        tenantId: fixture.base.tenantA.id,
        quoteVersionId,
        actorUserId: fixture.base.adminA.id,
        occurredAt: clock.now().toISOString(),
      });
      const initial = await runCommand(markQuoteVersionSent, {
        client: admin as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: { quote_version_id: quoteVersionId, recipient_source_type: "customer", recipient_source_id: customerId },
      });
      expect(initial.ok).toBe(true);
      if (!initial.ok) return;

      const managerCorrection = await runCommand(correctPendingQuoteDeliveryRecipient, {
        client: projectManager as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: { quote_version_id: quoteVersionId, recipient_source_type: "contact", recipient_source_id: firstContactId },
      });
      expect(managerCorrection.ok).toBe(true);
      const sellerCorrection = await runCommand(correctPendingQuoteDeliveryRecipient, {
        client: seller as never,
        clock,
        correlationId: crypto.randomUUID(),
        input: { quote_version_id: quoteVersionId, recipient_source_type: "contact", recipient_source_id: secondContactId },
      });
      expect(sellerCorrection.ok).toBe(true);
      expect(await adminQuery<{ actor_user_id: string }>(
        "select actor_user_id from public.audit_events where tenant_id=$1 and command='quote.delivery.correct_recipient' and target_id=$2 order by created_at,id",
        [fixture.base.tenantA.id, quoteVersionId],
      )).toEqual([{ actor_user_id: fixture.users.projektledare.id }, { actor_user_id: fixture.users.saljare.id }]);
    } finally {
      await cleanupRoleAwarePhaseAFixture(fixture);
    }
  });
});
