import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderDarkTemplate, validateRecipientProjection, type EmailTemplate, type RecipientEntitlementProjection } from "./templates";
import { createEmailDeliveryAdapter, evaluateEmailReleaseControl, type DeliveryAdapter, type EmailReleaseControl } from "./provider";
import { assertQuoteDeliveryArtifact, type QuoteDeliveryArtifact } from "./quote-delivery";

export const EMAIL_RETRY_MINUTES = [5, 10, 20] as const;
export const EMAIL_LEASE_MINUTES = 15;
export const DARK_RENDER_BATCH_SIZE = 50;
export type EmailOutboxState = "queued" | "sending" | "sent" | "failed" | "suppressed" | "cancelled";
export type EnqueueEmailOutboxInput = {
  readonly tenantId: string;
  readonly category: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly period: string;
  readonly recipient: RecipientEntitlementProjection;
  readonly template: EmailTemplate;
};
export type EmailOutboxRow = { readonly id: string; readonly state: EmailOutboxState; readonly category?: string; readonly leaseExpiresAt?: string | null; readonly attempts?: number };
type Clock = { readonly now: () => Date };
type OutboxClient = Pick<SupabaseClient, "from" | "rpc">;
export type OutboxDependencies = { readonly client: OutboxClient; readonly clock?: Clock };

export function hashEmailRecipient(recipient: RecipientEntitlementProjection): string {
  return createHash("sha256").update(recipient.recipientUserId.trim().toLowerCase(), "utf8").digest("hex");
}

function asRow(row: Record<string, unknown>): EmailOutboxRow {
  return { id: String(row.id), state: row.state as EmailOutboxState, category: typeof row.category === "string" ? row.category : undefined, leaseExpiresAt: typeof row.lease_expires_at === "string" ? row.lease_expires_at : null, attempts: typeof row.attempts === "number" ? row.attempts : undefined };
}

export async function enqueueEmailOutbox(deps: OutboxDependencies, input: EnqueueEmailOutboxInput): Promise<EmailOutboxRow> {
  const params = validateRecipientProjection(input.template.params);
  if (params.recipientUserId !== input.recipient.recipientUserId) throw new Error("Email template recipient does not match enqueue recipient");
  const { data, error } = await deps.client.rpc("enqueue_email_outbox", {
    p_tenant_id: input.tenantId, p_recipient_hash: hashEmailRecipient(input.recipient), p_category: input.category,
    p_subject_type: input.subjectType, p_subject_id: input.subjectId, p_logical_period: input.period,
    p_template_key: input.template.key, p_template_version: input.template.version, p_template_params: params,
  });
  if (error || !data?.[0]) throw new Error("Email outbox enqueue failed");
  return asRow(data[0] as Record<string, unknown>);
}

export async function claimEmailOutbox(deps: OutboxDependencies, input: { readonly tenantId: string; readonly workerId: string; readonly limit?: number }): Promise<EmailOutboxRow[]> {
  const now = (deps.clock?.now ?? (() => new Date()))().toISOString();
  const { data, error } = await deps.client.rpc("claim_email_outbox", { p_tenant_id: input.tenantId, p_worker_id: input.workerId, p_now: now, p_limit: input.limit ?? 20 });
  if (error) throw new Error("Email outbox claim failed");
  return (data ?? []).map((row: unknown) => asRow(row as Record<string, unknown>));
}

export async function recordSyntheticDeliveryOutcome(deps: OutboxDependencies, input: { readonly id: string; readonly tenantId: string; readonly workerId: string; readonly outcome: "retryable_failure"; readonly now?: string }): Promise<void> {
  const now = input.now ?? (deps.clock?.now ?? (() => new Date()))().toISOString();
  const { error } = await deps.client.rpc("record_email_outbox_synthetic_failure", { p_outbox_id: input.id, p_tenant_id: input.tenantId, p_worker_id: input.workerId, p_now: now });
  if (error) throw new Error("Email outbox outcome failed");
}

async function loadClaimedDeliveryAttachment(deps: OutboxDependencies, input: { readonly id: string; readonly tenantId: string; readonly workerId: string; readonly now: string }): Promise<readonly { readonly filename: string; readonly bytes: Uint8Array; readonly contentType: string }[]> {
  const { data, error } = await deps.client.rpc("read_claimed_email_delivery_artifact", { p_outbox_id: input.id, p_tenant_id: input.tenantId, p_worker_id: input.workerId, p_now: input.now });
  if (error) throw new Error("Email delivery artifact read failed");
  const row = (data as readonly { pdf_bytes?: string | Uint8Array; quote_version_id?: string; content_fingerprint?: string; pdf_checksum_sha256?: string }[] | null)?.[0];
  if (!row) throw new Error("Email delivery artifact is required");
  const bytes = typeof row.pdf_bytes === "string"
    ? Uint8Array.from(row.pdf_bytes.startsWith("\\x") ? Buffer.from(row.pdf_bytes.slice(2), "hex") : Buffer.from(row.pdf_bytes, "base64"))
    : row.pdf_bytes;
  if (!bytes || !row.quote_version_id || !row.pdf_checksum_sha256) throw new Error("Email delivery artifact is invalid");
  const { data: current, error: currentError } = await deps.client.rpc("validate_claimed_quote_email_delivery", { p_outbox_id: input.id, p_tenant_id: input.tenantId, p_worker_id: input.workerId, p_now: input.now, p_content_fingerprint: row.content_fingerprint });
  if (currentError || current !== true) throw new Error("Quote delivery artifact is no longer eligible");
  assertQuoteDeliveryArtifact({ outboxId: input.id, tenantId: input.tenantId, quoteVersionId: row.quote_version_id, contentFingerprint: row.content_fingerprint ?? "", pdfChecksumSha256: row.pdf_checksum_sha256, bytes });
  return [{ filename: `quote-${row.quote_version_id}.pdf`, bytes, contentType: "application/pdf" }];
}

/**
 * Production stays dark: suppression is evaluated before template rendering and
 * unsuppressed rows never transition out of queued state or invoke a transport.
 */
export async function processDarkEmailOutbox(deps: OutboxDependencies, input: { readonly tenantId: string; readonly workerId?: string }): Promise<{ readonly suppressed: number; readonly rendered: number }> {
  const { data, error } = await deps.client.rpc("suppress_queued_email_outbox", { p_tenant_id: input.tenantId });
  if (error) throw new Error("Email suppression evaluation failed");
  const { data: rows, error: queuedError } = await deps.client
    .from("email_outbox")
    .select("template_params")
    .eq("tenant_id", input.tenantId)
    .eq("state", "queued")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(DARK_RENDER_BATCH_SIZE);
  if (queuedError) throw new Error("Email outbox read failed");
  for (const row of rows ?? []) renderDarkTemplate({ key: "dark", version: 1, params: (row as { template_params: RecipientEntitlementProjection }).template_params });
  return { suppressed: typeof data === "number" ? data : 0, rendered: (rows ?? []).length };
}

export async function processEmailOutbox(
  deps: OutboxDependencies & { readonly deliveryAdapter: DeliveryAdapter; readonly releaseControl: EmailReleaseControl },
  input: { readonly tenantId: string; readonly workerId: string },
): Promise<{ readonly sent: number; readonly suppressed: number; readonly closed: boolean }> {
  const { data: suppressed, error: suppressError } = await deps.client.rpc("suppress_queued_email_outbox", { p_tenant_id: input.tenantId });
  if (suppressError) throw new Error("Email suppression evaluation failed");
  const release = evaluateEmailReleaseControl(deps.releaseControl);
  if (!release.allowed) return { sent: 0, suppressed: typeof suppressed === "number" ? suppressed : 0, closed: true };
  const claims = await claimEmailOutbox(deps, input);
  let sent = 0;
  for (const claim of claims) {
    try {
      const now = (deps.clock?.now ?? (() => new Date()))().toISOString();
      const attachments = claim.category === "quote.delivery"
        ? await loadClaimedDeliveryAttachment(deps, { id: claim.id, tenantId: input.tenantId, workerId: input.workerId, now })
        : [];
      const adapter = createEmailDeliveryAdapter({ mode: "sandbox", submit: deps.deliveryAdapter.submit });
      const result = await adapter.deliver({ tenantId: input.tenantId, recipient: { kind: "synthetic", address: "sandbox-recipient@example.test" }, template: { key: "outbox", locale: "sv-SE", renderedBody: "" }, attachments });
      const { error } = await deps.client.rpc("record_email_outbox_delivery", { p_outbox_id: claim.id, p_tenant_id: input.tenantId, p_worker_id: input.workerId, p_provider_message_id: result.providerMessageId, p_now: now });
      if (error) throw new Error("Email delivery outcome failed");
      sent += 1;
    } catch {
      await recordSyntheticDeliveryOutcome(deps, { id: claim.id, tenantId: input.tenantId, workerId: input.workerId, outcome: "retryable_failure" });
    }
  }
  return { sent, suppressed: typeof suppressed === "number" ? suppressed : 0, closed: false };
}

export class QuotePdfUnavailableError extends Error {
  readonly code = "QUOTE_PDF_UNAVAILABLE";
  readonly recoverable = true;
}

export async function processQuoteDelivery(
  deps: {
    readonly releaseControl: EmailReleaseControl;
    readonly deliveryAdapter?: DeliveryAdapter;
    readonly loadCurrentAuthorizedPdf?: () => Promise<{ readonly bytes: Uint8Array; readonly snapshotId: string; readonly current?: boolean; readonly valid?: boolean; readonly artifact?: QuoteDeliveryArtifact } | null>;
    /** Revalidates the durable artifact's quote version and fingerprint immediately before sending. */
    readonly revalidateQuoteDeliveryArtifact?: (artifact: QuoteDeliveryArtifact) => Promise<boolean>;
  },
  input: { readonly tenantId: string; readonly quoteId: string; readonly kind?: "delivery" | "reminder"; readonly quoteStatus?: string },
): Promise<{ readonly outcome: "sent" | "not_eligible"; readonly providerMessageId?: string }> {
  if (input.kind === "reminder" && ["accepted", "rejected", "withdrawn", "superseded", "expired"].includes(input.quoteStatus ?? "")) return { outcome: "not_eligible" };
  if (!evaluateEmailReleaseControl(deps.releaseControl).allowed) return { outcome: "not_eligible" };
  const pdf = await deps.loadCurrentAuthorizedPdf?.();
  if (!pdf || pdf.bytes.byteLength === 0 || pdf.current === false || pdf.valid === false) throw new QuotePdfUnavailableError();
  try {
    if (!pdf.artifact) throw new Error("Quote delivery artifact is required");
    assertQuoteDeliveryArtifact(pdf.artifact);
    if (pdf.artifact.tenantId !== input.tenantId || !(await deps.revalidateQuoteDeliveryArtifact?.(pdf.artifact) ?? false)) {
      throw new Error("Quote delivery artifact is no longer current");
    }
  } catch {
    throw new QuotePdfUnavailableError();
  }
  if (!deps.deliveryAdapter) throw new QuotePdfUnavailableError();
  const result = await createEmailDeliveryAdapter({ mode: "sandbox", submit: deps.deliveryAdapter.submit }).deliver({
    tenantId: input.tenantId,
    recipient: { kind: "synthetic", address: "sandbox-recipient@example.test" },
    template: { key: "quote-delivery", locale: "sv-SE", renderedBody: "" },
    attachments: [{ filename: `quote-${input.quoteId}.pdf`, bytes: pdf.bytes, contentType: "application/pdf" }],
  });
  return { outcome: "sent", providerMessageId: result.providerMessageId };
}
