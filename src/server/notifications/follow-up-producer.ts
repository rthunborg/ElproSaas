import type { SupabaseClient } from "@supabase/supabase-js";

/** Service-only producer. It uses a stored, conservative route and never projects money or customer details. */
export async function emitDueFollowUpNotifications(client: SupabaseClient, tenantId: string, period: string): Promise<void> {
  const { data: followUps, error } = await client.from("quote_follow_ups").select("id,quote_id,due_date,status,quote_versions!inner(status)").eq("tenant_id", tenantId).eq("status", "open").lte("due_date", period);
  if (error) throw new Error("Follow-up scan failed");
  const eligible = (followUps ?? []).filter((row: { quote_versions?: { status?: string } | { status?: string }[] }) => {
    const version = Array.isArray(row.quote_versions) ? row.quote_versions[0] : row.quote_versions;
    return !["accepted", "lost", "rejected", "expired", "superseded"].includes(version?.status ?? "");
  });
  for (const followUp of eligible as Array<{ id: string; quote_id: string }>) {
    const { data: recipients, error: recipientError } = await client.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId).eq("status", "active");
    if (recipientError) throw new Error("Notification recipient lookup failed");
    const rows = (recipients ?? []).map((recipient: { user_id: string }) => ({ tenant_id: tenantId, recipient_user_id: recipient.user_id, category: "quote.follow_up_due", title: "Uppföljning behöver hanteras", body: "En offertuppföljning är förfallen.", route: `/quotes/${followUp.quote_id}`, logical_subject_id: followUp.id, logical_period: period }));
    if (rows.length === 0) continue;
    const { error: insertError } = await client.from("notifications").upsert(rows, { onConflict: "tenant_id,recipient_user_id,category,logical_subject_id,logical_period", ignoreDuplicates: true });
    if (insertError) throw new Error("Notification emission failed");
  }
}
