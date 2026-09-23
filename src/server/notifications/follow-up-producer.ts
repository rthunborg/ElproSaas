import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCapability } from "@/server/authz/permission-matrix";

const TERMINAL_QUOTE_STATUSES = new Set(["accepted", "lost", "rejected", "expired", "superseded"]);
type MembershipProjection = {
  user_id: string;
  role: unknown;
  membership_roles: Array<{ role: unknown }> | null;
};

function quoteNotificationRecipientIds(memberships: readonly MembershipProjection[]): string[] {
  return memberships
    .filter((membership) => resolveCapability({
      roles: [membership.role, ...(membership.membership_roles?.map((entry) => entry.role) ?? [])],
      module: "quotes",
      capability: "Quotes.View",
    }).granted)
    .map((membership) => membership.user_id);
}

async function enabledRecipientIds(client: SupabaseClient, tenantId: string, category: "quote.follow_up_due" | "quote.accepted", recipientIds: readonly string[]): Promise<string[]> {
  if (recipientIds.length === 0) return [];
  const { data, error } = await client
    .from("notification_preferences")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("category", category)
    .eq("channel", "in_app")
    .eq("enabled", false)
    .in("user_id", recipientIds);
  if (error) throw new Error("Notification preference lookup failed");
  const disabled = new Set((data ?? []).map((row) => row.user_id));
  return recipientIds.filter((recipientId) => !disabled.has(recipientId));
}

/** Service-only producer. It uses a stored, conservative route and never projects money or customer details. */
export async function emitDueFollowUpNotifications(client: SupabaseClient, tenantId: string, period: string): Promise<void> {
  const { data: followUps, error } = await client.from("quote_follow_ups").select("id,quote_id").eq("tenant_id", tenantId).eq("status", "open").lte("due_date", period);
  if (error) throw new Error("Follow-up scan failed");
  const candidates = (followUps ?? []) as Array<{ id: string; quote_id: string }>;
  if (candidates.length === 0) return;

  const quoteIds = [...new Set(candidates.map((followUp) => followUp.quote_id))];
  const { data: versions, error: versionError } = await client.from("quote_versions").select("quote_id,version_number,status").eq("tenant_id", tenantId).in("quote_id", quoteIds);
  if (versionError) throw new Error("Quote status lookup failed");
  const latestStatus = new Map<string, { versionNumber: number; status: string }>();
  for (const version of (versions ?? []) as Array<{ quote_id: string; version_number: number; status: string }>) {
    const previous = latestStatus.get(version.quote_id);
    if (!previous || version.version_number > previous.versionNumber) latestStatus.set(version.quote_id, { versionNumber: version.version_number, status: version.status });
  }
  const eligible = candidates.filter((followUp) => !TERMINAL_QUOTE_STATUSES.has(latestStatus.get(followUp.quote_id)?.status ?? ""));
  if (eligible.length === 0) return;

  const { data: memberships, error: membershipError } = await client.from("tenant_memberships").select("user_id,role,membership_roles(role)").eq("tenant_id", tenantId).eq("status", "active");
  if (membershipError) throw new Error("Notification recipient lookup failed");
  const recipientIds = await enabledRecipientIds(client, tenantId, "quote.follow_up_due", quoteNotificationRecipientIds((memberships ?? []) as MembershipProjection[]));
  if (recipientIds.length === 0) return;

  const rows = eligible.flatMap((followUp) => recipientIds.map((recipientUserId) => ({ tenant_id: tenantId, recipient_user_id: recipientUserId, category: "quote.follow_up_due", title: "Uppföljning behöver hanteras", body: "En offertuppföljning är förfallen.", route: `/quotes/${followUp.quote_id}`, logical_subject_id: followUp.id, logical_period: period })));
  const { error: insertError } = await client.from("notifications").upsert(rows, { onConflict: "tenant_id,recipient_user_id,category,logical_subject_id,logical_period", ignoreDuplicates: true });
  if (insertError) throw new Error("Notification emission failed");
}

/** Emits a safe internal acceptance notice from the append-only quote event log. */
export async function emitAcceptedQuoteNotifications(client: SupabaseClient, tenantId: string): Promise<void> {
  const { data: events, error } = await client.from("quote_events").select("id,quote_id,occurred_at").eq("tenant_id", tenantId).eq("event_type", "accepted");
  if (error) throw new Error("Accepted quote scan failed");
  const { data: memberships, error: membershipError } = await client.from("tenant_memberships").select("user_id,role,membership_roles(role)").eq("tenant_id", tenantId).eq("status", "active");
  if (membershipError) throw new Error("Notification recipient lookup failed");
  const recipientIds = await enabledRecipientIds(client, tenantId, "quote.accepted", quoteNotificationRecipientIds((memberships ?? []) as MembershipProjection[]));
  const rows = ((events ?? []) as Array<{ id: string; quote_id: string; occurred_at: string }>).flatMap((event) => recipientIds.map((recipient_user_id) => ({ tenant_id: tenantId, recipient_user_id, category: "quote.accepted", title: "Offert accepterad", body: "En offert har accepterats.", route: `/quotes/${event.quote_id}`, logical_subject_id: event.id, logical_period: event.occurred_at.slice(0, 10) })));
  if (rows.length === 0) return;
  const { error: insertError } = await client.from("notifications").upsert(rows, { onConflict: "tenant_id,recipient_user_id,category,logical_subject_id,logical_period", ignoreDuplicates: true });
  if (insertError) throw new Error("Accepted quote notification emission failed");
}
