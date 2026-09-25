import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

export async function POST() {
  const context = await resolveTenantContext();
  if (!context.ok) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const db = await createSupabaseServerClient();
  const { error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("tenant_id", context.data.tenantId).eq("recipient_user_id", context.data.userId).is("read_at", null);
  if (error) return NextResponse.json({ error: "Could not mark notifications as read" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
