import { createHash, randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { createRuntimeAdminUserService } from "@/server/auth/admin-user-service";
import { canonicalizeProvisioningRequest, createProvisioningPreview } from "./validation";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";

const denied = { ok: false as const, code: "PROVISIONING_DENIED" as const };

/** Platform-only server command. The browser never receives the invitation capability. */
export async function provisionTenant(input: unknown) {
  let request;
  try { request = canonicalizeProvisioningRequest(input); } catch { return denied; }
  const baseline = findProvisioningBaseline(String(request.baseline_profile_id), Number(request.baseline_profile_version));
  if (!baseline) return { ok: false as const, code: "PREVIEW_STALE" as const };
  const preview = createProvisioningPreview(input, baseline);
  const client = await createSupabaseServerClient();
  const previewHash = preview.preview_hash;
  const invitationToken = randomBytes(32).toString("base64url");
  const { data, error } = await client.rpc("provision_tenant", { p_action: "provision", p_request: {
    ...request, normalized_organization_number: request.normalizedOrganizationNumber,
    canonical_request_hash: request.canonicalRequestHash, preview_hash: previewHash,
    baseline_content_hash: baseline.contentHash,
    invitation_token_hash: createHash("sha256").update(invitationToken).digest("hex"),
  } });
  if (error || !data || typeof data !== "object") return denied;
  return { ok: true as const, previewHash, result: data };
}

/** Dry run is deliberately pure: it never initializes a database client. */
export function previewTenantProvisioning(input: unknown) {
  const request = canonicalizeProvisioningRequest(input);
  const baseline = findProvisioningBaseline(String(request.baseline_profile_id), Number(request.baseline_profile_version));
  if (!baseline) return { ok: false as const, code: "PREVIEW_STALE" as const };
  return { ok: true as const, preview: createProvisioningPreview(input, baseline) };
}

/** Explicit post-commit operation only; this is deliberately not called on replay. */
export async function retryFirstAdminInvite(input: { email: string; membershipId: string; tenantId: string; operationId: string }) {
  const client = await createSupabaseServerClient();
  // Reconciliation is an explicit no-provider operation and precedes every
  // dispatch. The RPC authorizes the platform operator again inside Postgres.
  const reconciliation = await client.rpc("provision_tenant", { p_action: "reconcile", p_request: { tenant_id: input.tenantId } });
  if (reconciliation.error || !reconciliation.data) return denied;
  const token = randomBytes(32).toString("base64url");
  const reservation = await client.rpc("provision_tenant", {
    p_action: "reserve_dispatch",
    p_request: {
      tenant_id: input.tenantId,
      invitation_token_hash: createHash("sha256").update(token).digest("hex"),
    },
  });
  if (reservation.error || !reservation.data) return { ok: false as const, code: "PREVIEW_STALE" as const };
  const service = createRuntimeAdminUserService({
    invitationRedirectBase: "/auth/invite/confirm",
    prepareInvite: async () => ({ operationId: input.operationId, membershipId: input.membershipId, attemptToken: token, delivery: "invite" }),
  });
  try {
    const result = await service.invite({ email: input.email });
    const outcome = result.outcome === "succeeded" ? "requested" : "unknown";
    return await recordFirstAdminInviteOutcome(input.tenantId, outcome);
  } catch {
    return await recordFirstAdminInviteOutcome(input.tenantId, "unknown");
  }
}

/** Maps only sanitized provider categories into the DB action allow-list. */
export async function recordFirstAdminInviteOutcome(tenantId: string, outcome: "requested" | "unknown" | "failed") {
  const client = await createSupabaseServerClient();
  const action = outcome === "requested" ? "record_requested" : outcome === "unknown" ? "record_unknown" : "record_failed";
  const { data, error } = await client.rpc("provision_tenant", { p_action: action, p_request: { tenant_id: tenantId } });
  return error ? denied : { ok: true as const, result: data };
}
