"use client";

import { useActionState } from "react";
import {
  previewOperatorInviteRenewalAction,
  approveOperatorInviteRenewalAction,
  type OperatorPreviewState,
  reconcileOperatorFirstAdminInviteAction,
  retryOperatorFirstAdminInviteForTenantAction,
  retryReconciledOperatorFirstAdminInviteAction,
  type OperatorRecoveryState,
} from "@/features/operator-console/actions";
import { ProvisioningConfirmation } from "./ProvisioningConfirmation";
import { OPERATOR_CONSOLE_INITIAL } from "@/features/operator-console/action-state";

export function HandoffRecovery({ tenantId, requiresReconciliation, canRetry, requiresFreshApproval = false }: { readonly tenantId: string; readonly requiresReconciliation: boolean; readonly canRetry: boolean; readonly requiresFreshApproval?: boolean }) {
  const [reconciled, reconcileAction, reconciling] = useActionState<OperatorRecoveryState, FormData>(reconcileOperatorFirstAdminInviteAction.bind(null, tenantId), OPERATOR_CONSOLE_INITIAL);
  const [retry, retryAction, retrying] = useActionState(retryOperatorFirstAdminInviteForTenantAction.bind(null, tenantId), OPERATOR_CONSOLE_INITIAL);
  const [reconciledRetry, reconciledRetryAction, reconciledRetrying] = useActionState<OperatorRecoveryState, FormData>(retryReconciledOperatorFirstAdminInviteAction, OPERATOR_CONSOLE_INITIAL);
  const [preview, previewAction, previewing] = useActionState<OperatorPreviewState, FormData>(previewOperatorInviteRenewalAction.bind(null, tenantId), OPERATOR_CONSOLE_INITIAL);
  const [approval, approvalAction, approving] = useActionState<OperatorPreviewState, FormData>(approveOperatorInviteRenewalAction, OPERATOR_CONSOLE_INITIAL);
  // Cookie consumption refreshes server props; retain this approval result until navigation.
  if (requiresFreshApproval || preview.approvalHandle) return <section className="mt-4 grid gap-2" aria-live="polite">
    <p>En ny förhandsgranskning och ett nytt godkännande krävs för att förnya inbjudan.</p>
    {requiresReconciliation && <form action={reconcileAction}><button disabled={reconciling}>Kontrollera status</button></form>}
    {(!requiresReconciliation || reconciled.reconciliationHandle) && <form action={previewAction}><button disabled={previewing}>Förhandsgranska ny inbjudan</button></form>}
    {preview.confirmation && preview.approvalHandle && <><ProvisioningConfirmation confirmation={preview.confirmation} /><form action={approvalAction}><input type="hidden" name="approvalHandle" value={preview.approvalHandle} /><button disabled={approving} name="explicitApproval" value="true">Godkänn ny inbjudan</button></form></>}
    {[reconciled, preview, approval].map((result, index) => result.status !== "idle" && <p key={index} role={result.status === "error" ? "alert" : "status"}>{result.message}</p>)}
  </section>;
  if (requiresReconciliation) return <section className="mt-4" aria-live="polite"><form action={reconcileAction}><button disabled={reconciling} type="submit">{reconciling ? "Kontrollerar…" : "Kontrollera status"}</button></form>{reconciled.status !== "idle" && <p role={reconciled.status === "error" ? "alert" : "status"}>{reconciled.message}</p>}{reconciled.reconciliationHandle && <form action={reconciledRetryAction}><input type="hidden" name="reconciliationHandle" value={reconciled.reconciliationHandle} /><button disabled={reconciledRetrying} type="submit">{reconciledRetrying ? "Skickar…" : "Försök igen"}</button></form>}{reconciledRetry.status !== "idle" && <p role={reconciledRetry.status === "error" ? "alert" : "status"}>{reconciledRetry.message}</p>}</section>;
  if (canRetry) return <section className="mt-4" aria-live="polite"><form action={retryAction}><button disabled={retrying} type="submit">{retrying ? "Skickar…" : "Försök igen"}</button></form>{retry.status !== "idle" && <p role={retry.status === "error" ? "alert" : "status"}>{retry.message}</p>}</section>;
  return <section className="mt-4" aria-live="polite">{reconciledRetry.status !== "idle" && <p role={reconciledRetry.status === "error" ? "alert" : "status"}>{reconciledRetry.message}</p>}{retry.status !== "idle" && <p role={retry.status === "error" ? "alert" : "status"}>{retry.message}</p>}</section>;
}
