"use server";

import { revalidatePath } from "next/cache";
import { previewTenantProvisioning, previewFirstAdminInviteRenewal, provisionTenant, reconcileFirstAdminInvite, retryFirstAdminInvite } from "@/server/commands/provisioning/provision-tenant";
import { resolvePlatformOperator } from "@/server/auth/resolve-platform-operator";
import { takeOperatorPreviewGrant, writeOperatorPreviewGrant } from "@/server/provisioning/operator-preview-grant";
import { takeOperatorReconciliationGrant, writeOperatorReconciliationGrant } from "@/server/provisioning/operator-reconciliation-grant";
import { projectProvisioningConfirmation } from "./projection";
import type { OperatorConsoleActionState } from "./action-state";
import { requestFromOperatorConsoleForm } from "./provisioning-request";

export type OperatorPreviewState = OperatorConsoleActionState & {
  readonly confirmation?: ReturnType<typeof projectProvisioningConfirmation>;
  readonly approvalHandle?: string;
  readonly tenantId?: string;
};

export type OperatorRecoveryState = OperatorConsoleActionState & { readonly reconciliationHandle?: string };

const genericError = "Åtgärden kunde inte genomföras.";
const denied = (): OperatorConsoleActionState => ({ status: "error", message: "Åtkomst saknas." });

export async function previewOperatorProvisioningAction(_: OperatorPreviewState, form: FormData): Promise<OperatorPreviewState> {
  const access = await resolvePlatformOperator();
  if (!access.ok) return denied();
  const request = requestFromOperatorConsoleForm(form);
  if (!request) return { status: "error", message: "Kontrollera de obligatoriska uppgifterna." };
  const result = previewTenantProvisioning(request);
  if (!result.ok) return { status: "error", message: genericError };
  const approvalHandle = await writeOperatorPreviewGrant(access.userId, request, result.preview.preview_hash);
  if (!approvalHandle) return { status: "error", message: genericError };
  return {
    status: "success",
    message: "Förhandsgranskningen är klar.",
    confirmation: projectProvisioningConfirmation(result.preview),
    approvalHandle,
  };
}

export async function approveOperatorProvisioningAction(_: OperatorPreviewState, form: FormData): Promise<OperatorPreviewState> {
  const access = await resolvePlatformOperator();
  if (!access.ok) return denied();
  if (form.get("explicitApproval") !== "true") return { status: "error", message: genericError };
  const grant = await takeOperatorPreviewGrant(access.userId, form.get("approvalHandle"));
  if (!grant || grant.renewal) return { status: "error", message: genericError };
  const result = await provisionTenant({ request: grant.request, previewHash: grant.previewHash, explicitApproval: true });
  if (!result.ok) return { status: "error", message: result.code === "ALREADY_PROVISIONED" ? "Provisioneringen finns redan och har kontrollerats." : genericError };
  const resultRecord = result.result && typeof result.result === "object" && !Array.isArray(result.result)
    ? result.result as Record<string, unknown>
    : null;
  const tenantId = typeof resultRecord?.tenantId === "string" ? resultRecord.tenantId : undefined;
  revalidatePath("/operator");
  if (tenantId) revalidatePath(`/operator/${tenantId}`);
  return { status: "success", message: result.handoffNeedsRecovery ? "Tenanten har skapats, men inbjudan behöver återställas. Öppna provisioneringsstatus för att kontrollera och försöka igen." : "Provisioneringen har bekräftats.", ...(tenantId ? { tenantId } : {}) };
}

/** Detail actions are server-bound to a resolved tenant. No browser FormData
 * field supplies a retry identity. Unknown outcomes must receive this explicit
 * read-only reconciliation before their one-use retry grant is issued. */
export async function reconcileOperatorFirstAdminInviteAction(tenantId: string, _: OperatorRecoveryState, __: FormData): Promise<OperatorRecoveryState> {
  const access = await resolvePlatformOperator();
  if (!access.ok) return denied();
  const result = await reconcileFirstAdminInvite({ tenantId });
  if (!result.ok) return { status: "error", message: genericError };
  const reconciliationHandle = await writeOperatorReconciliationGrant(access.userId, tenantId);
  if (!reconciliationHandle) return { status: "error", message: genericError };
  revalidatePath(`/operator/${tenantId}`);
  return { status: "success", message: "Status har kontrollerats. Du kan nu begära ett nytt försök.", reconciliationHandle };
}

export async function retryReconciledOperatorFirstAdminInviteAction(_: OperatorRecoveryState, form: FormData): Promise<OperatorRecoveryState> {
  const access = await resolvePlatformOperator();
  if (!access.ok) return denied();
  const tenantId = await takeOperatorReconciliationGrant(access.userId, form.get("reconciliationHandle"));
  if (!tenantId) return { status: "error", message: genericError };
  const result = await retryFirstAdminInvite({ tenantId });
  if (!result.ok) return { status: "error", message: result.code === "PREVIEW_STALE" ? "En ny förhandsgranskning och ett nytt godkännande krävs." : genericError };
  // Invalidating the detail route here unmounts this action-state component as
  // soon as the durable state becomes requested, before its confirmed result
  // can reach the operator. The next navigation reads the persisted state.
  return { status: "success", message: "Inbjudan har hanterats." };
}

export async function retryOperatorFirstAdminInviteForTenantAction(tenantId: string, _: OperatorConsoleActionState, __: FormData): Promise<OperatorConsoleActionState> {
  const access = await resolvePlatformOperator();
  if (!access.ok) return denied();
  const result = await retryFirstAdminInvite({ tenantId });
  if (!result.ok) return { status: "error", message: result.code === "PREVIEW_STALE" ? "En ny förhandsgranskning och ett nytt godkännande krävs." : genericError };
  // Keep the action component mounted until it presents the confirmed result;
  // a fresh visit reconstructs the server-persisted handoff state.
  return { status: "success", message: "Inbjudan har hanterats." };
}

/** Fresh preview from durable facts, not a new create form. */
export async function previewOperatorInviteRenewalAction(tenantId: string, _: OperatorPreviewState, __: FormData): Promise<OperatorPreviewState> {
  const access = await resolvePlatformOperator();
  if (!access.ok) return denied();
  const result = await previewFirstAdminInviteRenewal(tenantId);
  if (!result) return { status: "error", message: genericError };
  const approvalHandle = await writeOperatorPreviewGrant(access.userId, result.request, result.preview.preview_hash, { tenantId, expectedApprovalGeneration: result.expectedApprovalGeneration });
  if (!approvalHandle) return { status: "error", message: genericError };
  return { status: "success", message: "Förhandsgranskningen är klar.", approvalHandle, confirmation: projectProvisioningConfirmation(result.preview, true) };
}

export async function approveOperatorInviteRenewalAction(_: OperatorPreviewState, form: FormData): Promise<OperatorPreviewState> {
  const access = await resolvePlatformOperator();
  if (!access.ok) return denied();
  if (form.get("explicitApproval") !== "true") return { status: "error", message: genericError };
  const grant = await takeOperatorPreviewGrant(access.userId, form.get("approvalHandle"));
  if (!grant?.renewal) return { status: "error", message: genericError };
  const result = await retryFirstAdminInvite({ tenantId: grant.renewal.tenantId, renewal: { request: grant.request, previewHash: grant.previewHash, expectedApprovalGeneration: grant.renewal.expectedApprovalGeneration } });
  if (!result.ok) return { status: "error", message: result.code === "PREVIEW_STALE" ? "En ny förhandsgranskning och ett nytt godkännande krävs." : genericError };
  return { status: "success", message: "Inbjudan har hanterats." };
}
