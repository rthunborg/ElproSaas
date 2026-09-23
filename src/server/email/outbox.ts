import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderDarkTemplate, validateRecipientProjection, type EmailTemplate, type RecipientEntitlementProjection } from "./templates";

export const EMAIL_RETRY_MINUTES = [5, 10, 20] as const;
export const EMAIL_LEASE_MINUTES = 15;
export const DARK_RENDER_BATCH_SIZE = 50;
export type EmailOutboxState = "queued" | "sending" | "sent" | "failed" | "suppressed";
export type EnqueueEmailOutboxInput = {
  readonly tenantId: string;
  readonly category: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly period: string;
  readonly recipient: RecipientEntitlementProjection;
  readonly template: EmailTemplate;
};
export type EmailOutboxRow = { readonly id: string; readonly state: EmailOutboxState; readonly leaseExpiresAt?: string | null; readonly attempts?: number };
type Clock = { readonly now: () => Date };
type OutboxClient = Pick<SupabaseClient, "from" | "rpc">;
export type OutboxDependencies = { readonly client: OutboxClient; readonly clock?: Clock };

export function hashEmailRecipient(recipient: RecipientEntitlementProjection): string {
  return createHash("sha256").update(recipient.recipientUserId.trim().toLowerCase(), "utf8").digest("hex");
}

function asRow(row: Record<string, unknown>): EmailOutboxRow {
  return { id: String(row.id), state: row.state as EmailOutboxState, leaseExpiresAt: typeof row.lease_expires_at === "string" ? row.lease_expires_at : null, attempts: typeof row.attempts === "number" ? row.attempts : undefined };
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
