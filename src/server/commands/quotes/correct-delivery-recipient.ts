import { defineCommand } from "../envelope";
import {
  asMarkSentRpcClient,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  validateCorrectPendingQuoteDeliveryRecipient,
  type CorrectPendingQuoteDeliveryRecipientInput,
} from "./validation";

export interface CorrectPendingQuoteDeliveryRecipientResult {
  readonly targetId: string;
}

/**
 * Cancels exactly one tenant-scoped queued quote delivery and replaces it with
 * a new, audited recipient snapshot. The SQL function locks the pending row,
 * rejects claimed/terminal delivery, validates the linked CRM address, and
 * records its audit event atomically with the cancellation and reissue.
 */
export const correctPendingQuoteDeliveryRecipient = defineCommand<
  CorrectPendingQuoteDeliveryRecipientInput,
  CorrectPendingQuoteDeliveryRecipientResult
>({
  command: "quote.delivery.correct_recipient",
  auditable: false,
  eventType: "quote.delivery.recipient_corrected",
  targetType: "quote_version",
  validateInput: validateCorrectPendingQuoteDeliveryRecipient,
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx) => {
    const rpc = asMarkSentRpcClient(ctx.db);
    const { error } = await rpc.rpc("correct_pending_quote_email_delivery", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_quote_version_id: ctx.input.quote_version_id,
      p_recipient_source_type: ctx.input.recipient_source_type,
      p_recipient_source_id: ctx.input.recipient_source_id,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    if (error) throwMappedQuoteWriteError(error);
    return { targetId: ctx.input.quote_version_id };
  },
});
