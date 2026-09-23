import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

export type NotificationItem = { id: string; category: string; title: string; body: string; route: string; readAt: string | null; createdAt: string };

export async function readPersonalNotifications() {
  const context = await resolveTenantContext();
  if (!context.ok) return { items: [] as NotificationItem[], unreadCount: 0, unavailable: true };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("notifications").select("id,category,title,body,route,read_at,created_at").eq("tenant_id", context.data.tenantId).eq("recipient_user_id", context.data.userId).order("created_at", { ascending: false }).limit(100);
  if (error) return { items: [] as NotificationItem[], unreadCount: 0, unavailable: true };
  const items = (data ?? []).map((row) => ({ id: row.id, category: row.category, title: row.title, body: row.body, route: row.route, readAt: row.read_at, createdAt: row.created_at }));
  return { items, unreadCount: items.filter((item) => !item.readAt).length, unavailable: false };
}
