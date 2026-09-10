import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

export async function reconcileAdminUserOperation(input: { operationId: string; tenantId?: unknown; actorId?: unknown }) {
  const context = await resolveTenantContext();
  if (!context.ok || typeof input.operationId !== "string") return { operationId: input.operationId, outcome: "failed" as const };
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("admin_reconcile_membership_operation", { p_operation_id: input.operationId });
    if (error || !data || typeof data !== "object") return { operationId: input.operationId, outcome: "failed" as const };
    const outcome = (data as { outcome?: unknown }).outcome;
    return { operationId: input.operationId, outcome: outcome === "succeeded" || outcome === "uncertain" ? outcome : "failed" as const };
  } catch { return { operationId: input.operationId, outcome: "failed" as const }; }
}
