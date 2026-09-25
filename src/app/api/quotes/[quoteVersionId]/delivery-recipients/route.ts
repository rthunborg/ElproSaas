import { NextResponse } from "next/server";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { resolveCapability } from "@/server/authz/permission-matrix";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";

type Candidate = { readonly sourceType: "customer" | "contact"; readonly sourceId: string; readonly label: string; readonly email: string };
type PendingDeliveryRpc = {
  rpc: (name: "has_pending_quote_email_delivery", args: { p_tenant_id: string; p_quote_version_id: string }) => Promise<{ data: boolean | null; error: unknown }>;
};

export async function GET(_: Request, { params }: { params: Promise<{ quoteVersionId: string }> }) {
  const context = await resolveTenantContext();
  if (!context.ok) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const roles = context.data.roles ?? [context.data.role];
  if (!resolveCapability({ roles, module: "quotes", capability: "Quotes.Send" }).granted) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { quoteVersionId } = await params;
  const db = await createSupabaseServerClient();
  const { data: version, error } = await db.from("quote_versions").select("quote_id").eq("tenant_id", context.data.tenantId).eq("id", quoteVersionId).limit(1);
  if (error || !version?.[0]?.quote_id) return NextResponse.json({ error: "Quote unavailable" }, { status: 404 });
  const { data: quote } = await db.from("quotes").select("customer_id").eq("tenant_id", context.data.tenantId).eq("id", version[0].quote_id).limit(1);
  const customerId = quote?.[0]?.customer_id;
  const pendingRequest = (db as unknown as PendingDeliveryRpc).rpc("has_pending_quote_email_delivery", {
    p_tenant_id: context.data.tenantId,
    p_quote_version_id: quoteVersionId,
  });
  if (!customerId) {
    const pending = await pendingRequest;
    return NextResponse.json({ candidates: [] satisfies Candidate[], pendingDelivery: pending.error === null && pending.data === true });
  }
  const [{ data: customer }, { data: contacts }, pending] = await Promise.all([
    db.from("customers").select("id,display_name,email").eq("tenant_id", context.data.tenantId).eq("id", customerId).is("archived_at", null).limit(1),
    db.from("contacts").select("id,name,email").eq("tenant_id", context.data.tenantId).eq("customer_id", customerId).is("archived_at", null),
    pendingRequest,
  ]);
  const candidates: Candidate[] = [];
  if (customer?.[0]?.email) candidates.push({ sourceType: "customer", sourceId: customer[0].id, label: customer[0].display_name, email: customer[0].email });
  for (const contact of contacts ?? []) if (contact.email) candidates.push({ sourceType: "contact", sourceId: contact.id, label: contact.name, email: contact.email });
  return NextResponse.json({
    candidates,
    pendingDelivery: pending.error === null && pending.data === true,
  });
}
