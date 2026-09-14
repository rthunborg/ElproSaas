import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { createRuntimeAdminUserService } from "@/server/auth/admin-user-service";

const denied = { ok: false as const, code: "ADMIN_USER_ACTION_DENIED" as const, membershipId: "" };
const uncertain = (membershipId: string, operationId: string, reconciliation: "not_attempted" | "observed" | "unavailable") => ({ ok: false as const, code: "ADMIN_USER_ACTION_UNCERTAIN" as const, membershipId, operationId, reconciliation });
function redirectBase() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return `${configured.replace(/\/$/, "")}/auth/invite/confirm`;
  if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:3000/auth/invite/confirm";
  return null;
}

export async function inviteAdminUser(input: { email?: unknown; roles?: unknown; operationId?: unknown; actorId?: unknown; tenantId?: unknown }) {
  if (typeof input.email !== "string" || !Array.isArray(input.roles) || input.roles.some((role) => typeof role !== "string")) return denied;
  const context = await resolveTenantContext();
  if (!context.ok) return denied;
  const client = await createSupabaseServerClient();
  const attemptToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(attemptToken).digest("hex");
  const operationId = typeof input.operationId === "string" ? input.operationId : randomUUID();
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data, error } = await client.rpc("admin_prepare_membership_invitation", {
    p_tenant_id: context.data.tenantId, p_email: input.email, p_roles: input.roles,
    p_operation_id: operationId, p_token_hash: tokenHash, p_expiry: expiry,
  });
  const membershipId = data && typeof data === "object" && "membershipId" in data && typeof (data as { membershipId: unknown }).membershipId === "string" ? (data as { membershipId: string }).membershipId : "";
  const fresh = data && typeof data === "object" && "fresh" in data && (data as { fresh: unknown }).fresh === true;
  const outcome = data && typeof data === "object" && "outcome" in data && typeof (data as { outcome: unknown }).outcome === "string" ? (data as { outcome: string }).outcome : "";
  if (error || !membershipId) return denied;
  // A replay observes the durable operation. It must never deliver a new raw
  // token for the prior membership, because only the original token hash is
  // stored. An already-finalized operation can be acknowledged safely.
  if (!fresh) {
    if (outcome === "succeeded") return { ok: true as const, membershipId };
    // A repeated browser submission must inspect its durable operation before a
    // new attempt is allowed. Reconciliation has no mutation or delivery side effect.
    const { data: reconciled, error: reconcileError } = await client.rpc("admin_reconcile_membership_operation", { p_operation_id: operationId });
    const reconciledOutcome = !reconcileError && reconciled && typeof reconciled === "object" && "outcome" in reconciled && typeof (reconciled as { outcome?: unknown }).outcome === "string"
      ? (reconciled as { outcome: string }).outcome : "";
    return reconciledOutcome === "succeeded" ? { ok: true as const, membershipId } : uncertain(membershipId, operationId, reconcileError ? "unavailable" : "observed");
  }
  const redirect = redirectBase(); if (!redirect) return denied;
  const service = createRuntimeAdminUserService({
    invitationRedirectBase: redirect,
    prepareInvite: async () => ({ operationId, membershipId, attemptToken, delivery: "invite" }),
    finalizeOperation: async ({ outcome }) => { const { error: finalizeError } = await client.rpc("admin_finalize_membership_operation", { p_operation_id: operationId, p_outcome: outcome }); if (finalizeError) throw finalizeError; },
  });
  const result = await service.invite({ email: input.email });
  return result.outcome === "succeeded" ? { ok: true as const, membershipId } : uncertain(membershipId, operationId, "not_attempted");
}

/** Reissues an invited membership's opaque attempt without accepting client email input. */
export async function resendAdminUserInvitation(input: { membershipId?: unknown; operationId?: unknown }) {
  if (typeof input.membershipId !== "string") return denied;
  const context = await resolveTenantContext();
  if (!context.ok) return denied;
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("tenant_memberships")
      .select("invited_email, role, status").eq("id", input.membershipId).eq("tenant_id", context.data.tenantId).maybeSingle();
    if (error || !data || !["invited", "expired"].includes(data.status) || typeof data.invited_email !== "string" || typeof data.role !== "string") return denied;
    const { data: roleRows, error: roleError } = await client.from("membership_roles")
      .select("role").eq("membership_id", input.membershipId).eq("tenant_id", context.data.tenantId);
    if (roleError) return denied;
    const membershipRoles = roleRows.map((row) => row.role).filter((role): role is string => typeof role === "string");
    const membership = await inviteAdminUser({
      email: data.invited_email,
      roles: membershipRoles.length > 0 ? membershipRoles : [data.role],
      operationId: input.operationId,
    });
    return membership;
  } catch { return denied; }
}
