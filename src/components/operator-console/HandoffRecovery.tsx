"use client";

import { useActionState } from "react";
import {
  reconcileOperatorFirstAdminInviteAction,
  retryOperatorFirstAdminInviteForTenantAction,
  retryReconciledOperatorFirstAdminInviteAction,
  type OperatorRecoveryState,
} from "@/features/operator-console/actions";
import { OPERATOR_CONSOLE_INITIAL } from "@/features/operator-console/action-state";

export function HandoffRecovery({ tenantId, requiresReconciliation }: { readonly tenantId: string; readonly requiresReconciliation: boolean }) {
  const [reconciled, reconcileAction, reconciling] = useActionState<OperatorRecoveryState, FormData>(reconcileOperatorFirstAdminInviteAction.bind(null, tenantId), OPERATOR_CONSOLE_INITIAL);
  const [retry, retryAction, retrying] = useActionState(retryOperatorFirstAdminInviteForTenantAction.bind(null, tenantId), OPERATOR_CONSOLE_INITIAL);
  const [reconciledRetry, reconciledRetryAction, reconciledRetrying] = useActionState<OperatorRecoveryState, FormData>(retryReconciledOperatorFirstAdminInviteAction, OPERATOR_CONSOLE_INITIAL);
  if (requiresReconciliation) return <section className="mt-4" aria-live="polite"><form action={reconcileAction}><button disabled={reconciling} type="submit">{reconciling ? "Kontrollerar…" : "Kontrollera status"}</button></form>{reconciled.status !== "idle" && <p role={reconciled.status === "error" ? "alert" : "status"}>{reconciled.message}</p>}{reconciled.reconciliationHandle && <form action={reconciledRetryAction}><input type="hidden" name="reconciliationHandle" value={reconciled.reconciliationHandle} /><button disabled={reconciledRetrying} type="submit">{reconciledRetrying ? "Skickar…" : "Försök igen"}</button></form>}{reconciledRetry.status !== "idle" && <p role={reconciledRetry.status === "error" ? "alert" : "status"}>{reconciledRetry.message}</p>}</section>;
  return <section className="mt-4" aria-live="polite"><form action={retryAction}><button disabled={retrying} type="submit">{retrying ? "Skickar…" : "Försök igen"}</button></form>{retry.status !== "idle" && <p role={retry.status === "error" ? "alert" : "status"}>{retry.message}</p>}</section>;
}
