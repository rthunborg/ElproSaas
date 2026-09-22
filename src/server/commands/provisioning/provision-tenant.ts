import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRuntimeAdminUserService } from "@/server/auth/admin-user-service";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";
import { provisioningAttestationSecretFromEnv, signProvisioningAttestation, type ProvisioningAttestation } from "@/server/provisioning/attestation";
import { canonicalizeProvisioningRequest, createProvisioningPreview } from "./validation";

const denied = { ok: false as const, code: "PROVISIONING_DENIED" as const };
const emptyHash = "0".repeat(64);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hashPattern = /^[0-9a-f]{64}$/;

function documentedRpcFailure(error: unknown) {
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message.trim()
    : "";
  const code = (["PREVIEW_STALE", "IDEMPOTENCY_CONFLICT", "ALREADY_PROVISIONED"] as const)
    .find((candidate) => message === candidate);
  return code ? { ok: false as const, code } : denied;
}

function signed(action: string, actorUserId: string, facts: Record<string, unknown>) {
  const { keyId, secret } = provisioningAttestationSecretFromEnv();
  const issuedAt = new Date().toISOString();
  const attestation: ProvisioningAttestation = {
    action, actorUserId, requestId: String(facts.requestId ?? randomUUID()), requestHash: String(facts.requestHash ?? emptyHash), organizationNumber: String(facts.organizationNumber ?? ""), firstAdminEmail: String(facts.firstAdminEmail ?? ""), previewHash: String(facts.previewHash ?? emptyHash), explicitApproval: facts.explicitApproval === true, baselineId: String(facts.baselineId ?? ""), baselineVersion: Number(facts.baselineVersion ?? 0), baselineContentHash: String(facts.baselineContentHash ?? emptyHash), tokenHash: String(facts.tokenHash ?? emptyHash), reservationId: String(facts.reservationId ?? ""), dispatchGeneration: Number(facts.dispatchGeneration ?? 0), approvalGeneration: Number(facts.approvalGeneration ?? 0), outcome: String(facts.outcome ?? ""), keyId, issuedAt, expiresAt: new Date(Date.parse(issuedAt) + 120_000).toISOString(),
  };
  return { attestation, signature: signProvisioningAttestation(attestation, secret) };
}

async function serverClient() {
  const { createSupabaseServerClient } = await import("@/server/db/supabase-server-client");
  return createSupabaseServerClient();
}

async function actor(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

type CommandDependencies = {
  readonly client: SupabaseClient;
  readonly deliverInvitation: (reservation: Reservation, token: string) => Promise<"requested" | "unknown" | "failed">;
};

type ApprovedProvisioningInput = {
  readonly request: unknown;
  readonly previewHash: string;
  readonly explicitApproval: boolean;
};

type InvitationService = {
  invite(input: Record<string, unknown>): Promise<{ outcome?: unknown }>;
};

type InvitationServiceFactory = (dependencies: {
  invitationRedirectBase: string;
  prepareInvite: () => Promise<{ operationId: string; membershipId: string; attemptToken: string; delivery: string }>;
}) => InvitationService;

function invitationRedirectBase() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return `${configured.replace(/\/$/, "")}/auth/invite/confirm`;
  return process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:3000/auth/invite/confirm";
}

async function deliverInvitation(
  reservation: Reservation,
  token: string,
  createService: InvitationServiceFactory = createRuntimeAdminUserService,
) {
  const redirect = invitationRedirectBase();
  // A production deployment without its configured public origin must not
  // hand a relative callback to Auth. The reservation is reconciled as an
  // uncertain delivery without calling the provider.
  if (!redirect) return "unknown" as const;
  const service = createService({
    invitationRedirectBase: redirect,
    prepareInvite: async () => ({
      operationId: reservation.reservationId,
      membershipId: reservation.membershipId,
      attemptToken: token,
      delivery: "invite",
    }),
  });
  try {
    const provider = await service.invite({ email: reservation.normalizedEmail }) as { outcome?: unknown };
    // The adapter deliberately treats response loss as uncertain. It may
    // explicitly surface a definitive, already-sanitized failure category.
    return provider.outcome === "succeeded" ? "requested" : provider.outcome === "failed" ? "failed" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Platform-only command. Attestations and raw invitation tokens never leave server memory. */
async function provisionTenantWithDependencies(input: ApprovedProvisioningInput, dependencies: CommandDependencies) {
  let request;
  try { request = canonicalizeProvisioningRequest(input.request); } catch { return denied; }
  if (input.explicitApproval !== true || !hashPattern.test(input.previewHash)) return denied;
  const baseline = findProvisioningBaseline(String(request.baseline_profile_id), Number(request.baseline_profile_version));
  if (!baseline) return { ok: false as const, code: "PREVIEW_STALE" as const };
  const preview = createProvisioningPreview(input.request, baseline);
  if (input.previewHash !== preview.preview_hash) return denied;
  const { client } = dependencies;
  const actorUserId = await actor(client);
  if (!actorUserId) return denied;
  try {
    const proof = signed("provision", actorUserId, { requestId: request.request_id, requestHash: request.canonicalRequestHash, organizationNumber: request.normalizedOrganizationNumber, firstAdminEmail: request.firstAdminEmail, previewHash: preview.preview_hash, explicitApproval: true, baselineId: baseline.id, baselineVersion: baseline.version, baselineContentHash: baseline.contentHash });
    const { data, error } = await client.rpc("provision_tenant", { p_action: "provision", p_request: { request, preview_hash: preview.preview_hash, explicit_approval: true, attestation: proof.attestation, attestation_signature: proof.signature } });
    if (error) return documentedRpcFailure(error);
    if (!data || typeof data !== "object" || Array.isArray(data)) return denied;
    const result = data as Record<string, unknown>;
    if (result.resultCode === "ALREADY_PROVISIONED") {
      return typeof result.tenantId === "string"
        ? { ok: false as const, code: "ALREADY_PROVISIONED" as const, tenantId: result.tenantId, provisioningState: result.provisioningState }
        : denied;
    }
    const tenantId = result.tenantId;
    // The provider handoff begins only once, immediately after the database
    // transaction reports a newly-created tenant. Replays remain observation
    // only and never rotate a token or make a provider request.
    const handoff = result.reconciliationAction === "created" && typeof tenantId === "string" && uuidPattern.test(tenantId)
      ? await retryFirstAdminInviteWithDependencies({ tenantId }, dependencies)
      : undefined;
    return { ok: true as const, previewHash: preview.preview_hash, result: data, handoff, handoffNeedsRecovery: handoff?.ok === false };
  } catch { return denied; }
}

/** Platform-only command. Attestations and raw invitation tokens never leave server memory. */
export async function provisionTenant(input: ApprovedProvisioningInput) {
  return provisionTenantWithDependencies(input, {
    client: await serverClient(),
    deliverInvitation,
  });
}

/** Pure dry run: no database/Auth client is initialized. */
export function previewTenantProvisioning(input: unknown) {
  try {
    const request = canonicalizeProvisioningRequest(input);
    const baseline = findProvisioningBaseline(String(request.baseline_profile_id), Number(request.baseline_profile_version));
    return baseline ? { ok: true as const, preview: createProvisioningPreview(input, baseline) } : { ok: false as const, code: "PREVIEW_STALE" as const };
  } catch { return denied; }
}

type DurableRetryFacts = {
  tenantId: string;
  requestId: string;
  requestHash: string;
  organizationNumber: string;
  previewHash: string;
  baselineId: string;
  baselineVersion: number;
  baselineContentHash: string;
  approvalGeneration: number;
  dispatchGeneration: number;
};

type Reservation = DurableRetryFacts & {
  normalizedEmail: string;
  membershipId: string;
  reservationId: string;
};

type RetryRenewal = {
  /** Bound to the preview grant; a used approval cannot renew again. */
  expectedApprovalGeneration: number;
  /** The original request is revalidated and re-previewed by this server command. */
  request: unknown;
  /** The preview hash the operator explicitly approved for the renewal. */
  previewHash: string;
};

function durableRetryFacts(value: unknown, tenantId: string): DurableRetryFacts | null {
  if (!uuidPattern.test(tenantId) || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const facts = value as Record<string, unknown>;
  const text = (key: string) => typeof facts[key] === "string" && facts[key].length > 0 && facts[key].length <= 512 ? facts[key] : null;
  const whole = (key: string) => typeof facts[key] === "number" && Number.isInteger(facts[key]) && facts[key] >= 0 ? facts[key] : null;
  const requestId = text("requestId");
  const requestHash = text("requestHash");
  const organizationNumber = text("organizationNumber");
  const previewHash = text("previewHash");
  const baselineId = text("baselineId");
  const baselineVersion = whole("baselineVersion");
  const baselineContentHash = text("baselineContentHash");
  const approvalGeneration = whole("approvalGeneration");
  const dispatchGeneration = whole("dispatchGeneration");
  if (
    facts.tenantId !== tenantId || !requestId || !requestHash || !organizationNumber || !previewHash || !baselineId ||
    baselineVersion === null || !baselineContentHash || approvalGeneration === null || dispatchGeneration === null
    || !uuidPattern.test(requestId) || !hashPattern.test(requestHash) || !hashPattern.test(previewHash) || !hashPattern.test(baselineContentHash)
    || !/^\d{10}$/.test(organizationNumber)
  ) return null;
  return { tenantId, requestId, requestHash, organizationNumber, previewHash, baselineId, baselineVersion, baselineContentHash, approvalGeneration, dispatchGeneration };
}

function approvedRenewalFacts(renewal: RetryRenewal, durable: DurableRetryFacts): DurableRetryFacts | null {
  try {
    const request = canonicalizeProvisioningRequest(renewal.request);
    const baseline = findProvisioningBaseline(String(request.baseline_profile_id), Number(request.baseline_profile_version));
    if (!baseline) return null;
    const preview = createProvisioningPreview(renewal.request, baseline);
    if (
      renewal.expectedApprovalGeneration !== durable.approvalGeneration ||
      renewal.previewHash !== preview.preview_hash ||
      request.request_id !== durable.requestId ||
      request.canonicalRequestHash !== durable.requestHash ||
      request.normalizedOrganizationNumber !== durable.organizationNumber ||
      preview.preview_hash !== durable.previewHash ||
      baseline.id !== durable.baselineId || baseline.version !== durable.baselineVersion || baseline.contentHash !== durable.baselineContentHash
    ) return null;
    if (!Number.isSafeInteger(durable.approvalGeneration) || durable.approvalGeneration >= Number.MAX_SAFE_INTEGER) return null;
    return { ...durable, approvalGeneration: durable.approvalGeneration + 1, previewHash: preview.preview_hash };
  } catch { return null; }
}

type OutstandingReservation = {
  reservationId: string;
  dispatchGeneration: number;
  approvalGeneration: number;
  tokenHash: string;
};

function outstandingReservation(value: unknown, facts: DurableRetryFacts): OutstandingReservation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  // A completed outcome does not need reconciliation. A missing outcome is a
  // lost-response boundary and must become unknown before a new reservation.
  if (record.reservationOutcome !== null && record.reservationOutcome !== undefined) return null;
  const reservationId = record.reservationId;
  const dispatchGeneration = record.reservationDispatchGeneration ?? record.dispatchGeneration;
  const approvalGeneration = record.reservationApprovalGeneration ?? record.approvalGeneration;
  const tokenHash = record.tokenHash;
  if (
    typeof reservationId !== "string" || !uuidPattern.test(reservationId)
    || typeof dispatchGeneration !== "number" || !Number.isInteger(dispatchGeneration) || dispatchGeneration < 1
    || typeof approvalGeneration !== "number" || !Number.isInteger(approvalGeneration) || approvalGeneration !== facts.approvalGeneration
    || typeof tokenHash !== "string" || !hashPattern.test(tokenHash)
  ) return null;
  return { reservationId, dispatchGeneration, approvalGeneration, tokenHash };
}

/** Explicit post-commit resend. Provider identity comes only from the RPC reservation. */
async function retryFirstAdminInviteWithDependencies(input: { tenantId: string; renewal?: RetryRenewal }, dependencies: CommandDependencies) {
  if (!uuidPattern.test(input.tenantId)) return denied;
  const { client } = dependencies;
  try {
    const actorUserId = await actor(client);
    if (!actorUserId) return denied;
    // Reconciliation is read-only and returns only durable, non-secret facts.
    // It is the sole source for request and approval-generation attestations.
    const reconciled = await client.rpc("provision_tenant", { p_action: "reconcile", p_request: { tenant_id: input.tenantId } });
    if (reconciled.error) return documentedRpcFailure(reconciled.error);
    const durable = durableRetryFacts(reconciled.data, input.tenantId);
    if (!durable) return denied;
    if (input.renewal && input.renewal.expectedApprovalGeneration !== durable.approvalGeneration) return { ok: false as const, code: "PREVIEW_STALE" as const };

    const outstanding = outstandingReservation(reconciled.data, durable);
    if (outstanding) {
      const proof = signed("record_unknown", actorUserId, {
        ...durable,
        tokenHash: outstanding.tokenHash,
        reservationId: outstanding.reservationId,
        dispatchGeneration: outstanding.dispatchGeneration,
        approvalGeneration: outstanding.approvalGeneration,
        outcome: "unknown",
      });
      const recorded = await client.rpc("provision_tenant", { p_action: "record_unknown", p_request: {
        tenant_id: input.tenantId,
        reservation_id: outstanding.reservationId,
        dispatch_generation: outstanding.dispatchGeneration,
        attestation: proof.attestation,
        attestation_signature: proof.signature,
      } });
      if (recorded.error) return documentedRpcFailure(recorded.error);
      // An outstanding reservation may have had a provider call despite a lost
      // process response. Never allocate a second dispatch in that invocation.
      return { ok: true as const, result: recorded.data };
    }

    const renewing = durable.dispatchGeneration >= 3 || (reconciled.data as Record<string, unknown>).invitationExpired === true;
    if (renewing && !input.renewal) return { ok: false as const, code: "PREVIEW_STALE" as const };
    const facts = renewing ? approvedRenewalFacts(input.renewal!, durable) : durable;
    if (!facts) return { ok: false as const, code: "PREVIEW_STALE" as const };

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const reserve = signed("reserve_dispatch", actorUserId, { ...facts, tokenHash, explicitApproval: renewing });
    const reservation = await client.rpc("provision_tenant", { p_action: "reserve_dispatch", p_request: {
      tenant_id: input.tenantId,
      token_hash: tokenHash,
      preview_hash: facts.previewHash,
      // The server's successful fresh-preview check is the explicit approval.
      explicit_approval: renewing,
      attestation: reserve.attestation,
      attestation_signature: reserve.signature,
    } });
    if (reservation.error || !reservation.data) return reservation.error ? documentedRpcFailure(reservation.error) : denied;
    const reserved = reservation.data as Reservation;
    const expectedDispatchGeneration = renewing ? 1 : facts.dispatchGeneration + 1;
    if (
      reserved.tenantId !== input.tenantId || typeof reserved.normalizedEmail !== "string" || typeof reserved.membershipId !== "string" ||
      typeof reserved.reservationId !== "string" || reserved.dispatchGeneration !== expectedDispatchGeneration
    ) return denied;
    const outcome = await dependencies.deliverInvitation(reserved, token);
    const recorded = signed(`record_${outcome}`, actorUserId, { ...facts, tokenHash, reservationId: reserved.reservationId, dispatchGeneration: reserved.dispatchGeneration, outcome });
    const result = await client.rpc("provision_tenant", { p_action: `record_${outcome}`, p_request: { tenant_id: input.tenantId, reservation_id: reserved.reservationId, dispatch_generation: reserved.dispatchGeneration, attestation: recorded.attestation, attestation_signature: recorded.signature } });
    return result.error ? documentedRpcFailure(result.error) : { ok: true as const, result: result.data };
  } catch { return denied; }
}

/** Server-only renewal preview from the immutable original request, never browser identity. */
export async function previewFirstAdminInviteRenewal(tenantId: string) {
  if (!uuidPattern.test(tenantId)) return null;
  const client = await serverClient();
  if (!(await actor(client))) return null;
  const { data, error } = await client.rpc("provision_tenant", { p_action: "reconcile", p_request: { tenant_id: tenantId } });
  if (error) return null;
  const durable = durableRetryFacts(data, tenantId);
  if (!durable || data.provisioningState === "ready") return null;
  const request = data.originalRequest;
  const preview = previewTenantProvisioning(request);
  if (!preview.ok || !approvedRenewalFacts({ request, previewHash: preview.preview.preview_hash, expectedApprovalGeneration: durable.approvalGeneration }, durable)) return null;
  return { request: request as Record<string, unknown>, preview: preview.preview, expectedApprovalGeneration: durable.approvalGeneration };
}

/** Explicit post-commit resend. Provider identity comes only from the RPC reservation. */
export async function retryFirstAdminInvite(input: { tenantId: string; renewal?: RetryRenewal }) {
  return retryFirstAdminInviteWithDependencies(input, {
    client: await serverClient(),
    deliverInvitation,
  });
}

/** Read-only server reconciliation for an explicit operator acknowledgement.
 * Raw hashes and reservation identifiers remain inside this command boundary. */
export async function reconcileFirstAdminInvite(input: { tenantId: string }) {
  if (!uuidPattern.test(input.tenantId)) return denied;
  const client = await serverClient();
  if (!(await actor(client))) return denied;
  try {
    const { data, error } = await client.rpc("provision_tenant", { p_action: "reconcile", p_request: { tenant_id: input.tenantId } });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return error ? documentedRpcFailure(error) : denied;
    const result = data as Record<string, unknown>;
    return typeof result.tenantId === "string" && result.tenantId === input.tenantId
      ? { ok: true as const }
      : denied;
  } catch { return denied; }
}

/** Narrow test seam for guarded, non-I/O protocol parsing. */
export const provisioningCommandTestHooks = {
  documentedRpcFailure,
  durableRetryFacts,
  outstandingReservation,
  provisionTenantWithDependencies,
  retryFirstAdminInviteWithDependencies,
  deliverInvitation,
};
