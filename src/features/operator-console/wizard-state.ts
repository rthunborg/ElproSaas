export type OperatorWizardState = {
  readonly step?: "company" | "baseline" | "first-admin" | "complete";
  readonly canApprove?: boolean;
  readonly canRetry?: boolean;
  readonly requiresReconciliation?: boolean;
  readonly requiresFreshApprovalForAttempt?: number;
  readonly duplicateCreateSuccess?: boolean;
};

/** Durable server state decides recovery affordances; browser history does not. */
export function deriveWizardState(state: Record<string, unknown>): OperatorWizardState {
  const lifecycle = state.lifecycle;
  const attempt = typeof state.attempt === "number" ? state.attempt : 0;
  if (lifecycle === "fresh") return { step: "company", canApprove: false };
  if (lifecycle === "preview_validated") return { step: "baseline", canApprove: true };
  if (lifecycle === "first_admin_invite_unknown") return { requiresReconciliation: true, canRetry: false };
  if (lifecycle === "first_admin_invite_failed") return { canRetry: true, ...(attempt >= 3 ? { requiresFreshApprovalForAttempt: 4 } : {}) };
  if (lifecycle === "already_provisioned") return { duplicateCreateSuccess: false };
  if (lifecycle === "first_admin_invite_requested") return { step: "first-admin", canApprove: false };
  if (lifecycle === "ready") return { step: "complete" };
  return { step: "first-admin", canApprove: false };
}
