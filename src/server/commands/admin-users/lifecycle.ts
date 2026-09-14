import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { createRuntimeAdminUserService } from "@/server/auth/admin-user-service";

const denied = { ok: false as const, code: "ADMIN_USER_ACTION_DENIED" as const };
const uncertain = (operationId: string, reconciliation: "not_attempted" | "observed" | "unavailable", retryWithNewOperation = false) => ({
  ok: false as const,
  code: "ADMIN_USER_ACTION_UNCERTAIN" as const,
  operationId,
  reconciliation,
  retryWithNewOperation,
});
const actions = new Set(["revoke", "reset", "disable", "reactivate", "re_role", "end"]);
const roles = new Set(["tenant_admin", "projektledare", "montor", "saljare", "ekonomi"]);
function redirectBase() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return `${configured.replace(/\/$/, "")}/auth/invite/confirm`;
  return process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:3000/auth/invite/confirm";
}

/** All membership changes enter the tenant-serialized database wrapper. */
export async function changeMembershipLifecycle(input: {
  membershipId?: unknown; membershipUserId?: unknown; action?: unknown; roles?: unknown; reason?: unknown; operationId?: unknown;
  actorId?: unknown; tenantId?: unknown;
}) {
  if (typeof input.membershipId !== "string" || typeof input.action !== "string" || !actions.has(input.action)) return denied;
  const selected = Array.isArray(input.roles) && input.roles.every((role) => typeof role === "string" && roles.has(role))
    ? [...new Set(input.roles)] : [];
  if (input.action === "re_role" && (selected.length === 0 || typeof input.reason !== "string" || input.reason.trim() === "")) return denied;
  const context = await resolveTenantContext();
  if (!context.ok) return denied;
  try {
    const client = await createSupabaseServerClient();
    const operationId = typeof input.operationId === "string" ? input.operationId : randomUUID();
    const { data, error } = await client.rpc("admin_manage_membership", {
      p_tenant_id: context.data.tenantId, p_membership_id: input.membershipId, p_action: input.action,
      p_roles: selected, p_reason: typeof input.reason === "string" ? input.reason : null,
      p_operation_id: operationId,
    });
    const outcome = data && typeof data === "object" && "outcome" in data && typeof (data as { outcome?: unknown }).outcome === "string" ? (data as { outcome: string }).outcome : "";
    const replayed = data && typeof data === "object" && "replayed" in data && (data as { replayed?: unknown }).replayed === true;
    if (error || !data || !outcome) return denied;
    if (input.action !== "reset") return { ok: true as const };
    // A replay is always reconciliation-only. Only a newly-created pending
    // operation can reach the provider, so repeated browser submissions never
    // duplicate a reset delivery.
    if (replayed) {
      const { data: reconciled, error: reconcileError } = await client.rpc("admin_reconcile_membership_operation", { p_operation_id: operationId });
      const reconciledOutcome = !reconcileError && reconciled && typeof reconciled === "object" && "outcome" in reconciled && typeof (reconciled as { outcome?: unknown }).outcome === "string"
        ? (reconciled as { outcome: string }).outcome : "";
      if (reconciledOutcome === "succeeded") return { ok: true as const };
      return uncertain(operationId, reconcileError ? "unavailable" : "observed", reconciledOutcome === "uncertain" || reconciledOutcome === "pending");
    }
    if (outcome !== "pending") return denied;
    const { data: member, error: memberError } = await client.from("tenant_memberships")
      .select("invited_email").eq("id", input.membershipId).maybeSingle();
    if (memberError || !member || typeof member.invited_email !== "string") return denied;
    const redirect = redirectBase(); if (!redirect) return denied;
    const reset = await createRuntimeAdminUserService({
      invitationRedirectBase: redirect,
      finalizeOperation: async ({ outcome }) => { const { error: finalizeError } = await client.rpc("admin_finalize_membership_operation", { p_operation_id: operationId, p_outcome: outcome }); if (finalizeError) throw finalizeError; },
    }).reset({ email: member.invited_email, operationId });
    return reset.outcome === "succeeded" ? { ok: true as const } : uncertain(operationId, "not_attempted");
  } catch { return denied; }
}
