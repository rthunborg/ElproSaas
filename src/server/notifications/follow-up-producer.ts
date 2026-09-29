import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCapability } from "@/server/authz/permission-matrix";
import { chunkValues } from "@/server/read-models/pagination";

const TERMINAL_QUOTE_STATUSES = new Set(["accepted", "lost", "rejected", "expired", "superseded"]);

// These are implementation containment bounds, not production throughput SLOs.
export const FOLLOW_UP_SCAN_BATCH_SIZE = 25;
export const FOLLOW_UP_RECIPIENT_BATCH_SIZE = 25;

type MembershipProjection = {
  user_id: string;
  role: unknown;
  membership_roles: Array<{ role: unknown }> | null;
};

type FollowUpProducerCursor = {
  readonly afterFollowUpId?: string;
  readonly afterMembershipUserId?: string;
};

type FollowUpProducerOptions = {
  readonly cursor?: string;
  readonly followUpBatchSize?: number;
  readonly recipientBatchSize?: number;
  readonly signal?: AbortSignal;
};

function boundedBatchSize(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : fallback;
}

function decodeProducerCursor(cursor?: string): FollowUpProducerCursor {
  if (!cursor) return {};
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    return {
      afterFollowUpId: typeof parsed.afterFollowUpId === "string" ? parsed.afterFollowUpId : undefined,
      afterMembershipUserId: typeof parsed.afterMembershipUserId === "string" ? parsed.afterMembershipUserId : undefined,
    };
  } catch {
    return {};
  }
}

function encodeProducerCursor(cursor: FollowUpProducerCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function quoteNotificationRecipientIds(memberships: readonly MembershipProjection[]): string[] {
  return memberships
    .filter((membership) => resolveCapability({
      roles: [membership.role, ...(membership.membership_roles?.map((entry) => entry.role) ?? [])],
      module: "quotes",
      capability: "Quotes.View",
    }).granted)
    .map((membership) => membership.user_id);
}

async function enabledRecipientIds(client: SupabaseClient, tenantId: string, category: "quote.follow_up_due", recipientIds: readonly string[], signal: AbortSignal): Promise<string[]> {
  if (recipientIds.length === 0) return [];
  const { data, error } = await client
    .from("notification_preferences")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("category", category)
    .eq("channel", "in_app")
    .eq("enabled", false)
    .in("user_id", recipientIds)
    .abortSignal(signal);
  if (error) throw new Error("Notification preference lookup failed");
  const disabled = new Set((data ?? []).map((row) => row.user_id));
  return recipientIds.filter((recipientId) => !disabled.has(recipientId));
}

async function loadLatestStatuses(client: SupabaseClient, tenantId: string, quoteIds: readonly string[], signal: AbortSignal): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  for (const quoteId of quoteIds) {
    const { data, error } = await client
      .from("quote_versions")
      .select("status")
      .eq("tenant_id", tenantId)
      .eq("quote_id", quoteId)
      .order("version_number", { ascending: false })
      .limit(1)
      .abortSignal(signal);
    if (error) throw new Error("Quote status lookup failed");
    const status = data?.[0]?.status;
    if (typeof status === "string") statuses.set(quoteId, status);
  }
  return statuses;
}

/**
 * Service-only producer. Each invocation processes one bounded rectangle of
 * follow-ups and eligible recipients. Its durable cursor resumes either the
 * next recipient page for the same follow-ups or the next follow-up page.
 */
export async function emitDueFollowUpNotifications(
  client: SupabaseClient,
  tenantId: string,
  period: string,
  options: FollowUpProducerOptions = {},
): Promise<{ readonly cursor?: string }> {
  const cursor = decodeProducerCursor(options.cursor);
  const followUpBatchSize = boundedBatchSize(options.followUpBatchSize, FOLLOW_UP_SCAN_BATCH_SIZE);
  const recipientBatchSize = boundedBatchSize(options.recipientBatchSize, FOLLOW_UP_RECIPIENT_BATCH_SIZE);
  const signal = options.signal ?? new AbortController().signal;

  const followUpBase = client
    .from("quote_follow_ups")
    .select("id,quote_id")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .lte("due_date", period);
  const followUpQuery = cursor.afterFollowUpId ? followUpBase.gt("id", cursor.afterFollowUpId) : followUpBase;
  const { data: followUpRows, error } = await followUpQuery
    .order("id", { ascending: true })
    .limit(followUpBatchSize + 1)
    .abortSignal(signal);
  if (error) throw new Error("Follow-up scan failed");
  const candidates = ((followUpRows ?? []) as Array<{ id: string; quote_id: string }>).slice(0, followUpBatchSize);
  if (candidates.length === 0) return {};
  const hasMoreFollowUps = (followUpRows ?? []).length > candidates.length;
  const nextFollowUpId = candidates.at(-1)!.id;

  const latestStatuses = await loadLatestStatuses(client, tenantId, [...new Set(candidates.map((followUp) => followUp.quote_id))], signal);
  const eligible = candidates.filter((followUp) => !TERMINAL_QUOTE_STATUSES.has(latestStatuses.get(followUp.quote_id) ?? ""));
  if (eligible.length === 0) {
    return hasMoreFollowUps ? { cursor: encodeProducerCursor({ afterFollowUpId: nextFollowUpId }) } : {};
  }

  const membershipBase = client
    .from("tenant_memberships")
    .select("user_id,role,membership_roles(role)")
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  const membershipQuery = cursor.afterMembershipUserId
    ? membershipBase.gt("user_id", cursor.afterMembershipUserId)
    : membershipBase;
  const { data: membershipRows, error: membershipError } = await membershipQuery
    .order("user_id", { ascending: true })
    .limit(recipientBatchSize + 1)
    .abortSignal(signal);
  if (membershipError) throw new Error("Notification recipient lookup failed");
  const memberships = ((membershipRows ?? []) as MembershipProjection[]).slice(0, recipientBatchSize);
  const hasMoreMemberships = (membershipRows ?? []).length > memberships.length;
  const recipientIds = await enabledRecipientIds(client, tenantId, "quote.follow_up_due", quoteNotificationRecipientIds(memberships), signal);

  const rows = eligible.flatMap((followUp) => recipientIds.map((recipientUserId) => ({
    tenant_id: tenantId,
    recipient_user_id: recipientUserId,
    category: "quote.follow_up_due",
    title: "Uppföljning behöver hanteras",
    body: "En offertuppföljning är förfallen.",
    route: `/quotes/${followUp.quote_id}`,
    logical_subject_id: followUp.id,
    logical_period: period,
  })));
  for (const rowBatch of chunkValues(rows)) {
    const { error: insertError } = await client
      .from("notifications")
      .upsert(rowBatch, { onConflict: "tenant_id,recipient_user_id,category,logical_subject_id,logical_period", ignoreDuplicates: true })
      .abortSignal(signal);
    if (insertError) throw new Error("Notification emission failed");
  }

  if (hasMoreMemberships) {
    return { cursor: encodeProducerCursor({
      afterFollowUpId: cursor.afterFollowUpId,
      afterMembershipUserId: memberships.at(-1)!.user_id,
    }) };
  }
  return hasMoreFollowUps ? { cursor: encodeProducerCursor({ afterFollowUpId: nextFollowUpId }) } : {};
}
