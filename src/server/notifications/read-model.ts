import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { resolveCapability } from "@/server/authz/permission-matrix";

export type NotificationItem = { id: string; category: string; title: string; body: string; route: string; readAt: string | null; createdAt: string };
export type NotificationScanStatus = { kind: "hidden" } | { kind: "never" } | { kind: "failed" } | { kind: "elapsed"; elapsedMinutes: number };

export async function readPersonalNotifications() {
  const context = await resolveTenantContext();
  if (!context.ok) return { items: [] as NotificationItem[], unreadCount: 0, unavailable: true, scanStatus: { kind: "hidden" } as NotificationScanStatus };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("notifications").select("id,category,title,body,route,read_at,created_at").eq("tenant_id", context.data.tenantId).eq("recipient_user_id", context.data.userId).order("created_at", { ascending: false }).limit(100);
  if (error) return { items: [] as NotificationItem[], unreadCount: 0, unavailable: true, scanStatus: { kind: "hidden" } as NotificationScanStatus };
  const items = (data ?? []).map((row) => ({ id: row.id, category: row.category, title: row.title, body: row.body, route: row.route, readAt: row.read_at, createdAt: row.created_at }));
  const canViewRuns = resolveCapability({ roles: context.data.roles ?? [context.data.role], module: "notifications", capability: "Notifications.View" }).granted;
  if (!canViewRuns) return { items, unreadCount: items.filter((item) => !item.readAt).length, unavailable: false, scanStatus: { kind: "hidden" } as NotificationScanStatus };
  const { data: run, error: runError } = await db.from("job_runs").select("finished_at,outcome").eq("tenant_id", context.data.tenantId).eq("producer", "quotes.follow-up-reminders").order("finished_at", { ascending: false }).limit(1).maybeSingle();
  if (runError) return { items, unreadCount: items.filter((item) => !item.readAt).length, unavailable: false, scanStatus: { kind: "hidden" } as NotificationScanStatus };
  const scanStatus: NotificationScanStatus = run?.outcome === "failed"
    ? { kind: "failed" }
    : run?.finished_at ? { kind: "elapsed", elapsedMinutes: Math.max(0, Math.floor((Date.now() - new Date(run.finished_at).getTime()) / 60_000)) } : { kind: "never" };
  return { items, unreadCount: items.filter((item) => !item.readAt).length, unavailable: false, scanStatus };
}
