import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { notificationCategory } from "@/server/notifications/registry";

export async function GET() {
  const context = await resolveTenantContext();
  if (!context.ok) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("notification_preferences").select("category,channel,enabled").eq("tenant_id", context.data.tenantId).eq("user_id", context.data.userId);
  if (error) return NextResponse.json({ error: "Could not load preferences" }, { status: 500 });
  return NextResponse.json({ preferences: data ?? [] });
}

export async function PUT(request: Request) {
  const context = await resolveTenantContext();
  if (!context.ok) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const input = await request.json().catch(() => null) as { category?: unknown; channel?: unknown; enabled?: unknown } | null;
  if (!input || typeof input.category !== "string" || (input.channel !== "in_app" && input.channel !== "email") || typeof input.enabled !== "boolean") return NextResponse.json({ error: "Invalid preference" }, { status: 400 });
  const category = notificationCategory(input.category);
  if (!category || (category.essential && !input.enabled)) return NextResponse.json({ error: "Required notifications cannot be disabled" }, { status: 422 });
  const db = await createSupabaseServerClient();
  const { error } = await db.from("notification_preferences").upsert({ tenant_id: context.data.tenantId, user_id: context.data.userId, category: input.category, channel: input.channel, enabled: input.enabled, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,user_id,category,channel" });
  if (error) return NextResponse.json({ error: "Could not save preference" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
