export type OperatorWizardState = {
  readonly step?: "company" | "baseline" | "first-admin" | "complete";
  readonly canApprove?: boolean;
  readonly canRetry?: boolean;
  readonly requiresReconciliation?: boolean;
  readonly requiresFreshApprovalForAttempt?: number;
  readonly requiresFreshApproval?: boolean;
  readonly duplicateCreateSuccess?: boolean;
};

/** Durable server state decides recovery affordances; browser history does not. */
export function deriveWizardState(state: Record<string, unknown>): OperatorWizardState {
  const lifecycle = state.lifecycle;
  const attempt = typeof state.attempt === "number" ? state.attempt : 0;
  if (lifecycle === "fresh") return { step: "company", canApprove: false };
  if (lifecycle === "preview_validated") return { step: "baseline", canApprove: true };
  if (lifecycle !== "ready" && state.invitationExpired === true) return { canRetry: false, requiresFreshApproval: true, requiresReconciliation: lifecycle === "first_admin_invite_unknown" || lifecycle === "pending_first_admin_invite" };
  if (lifecycle === "pending_first_admin_invite") return { requiresReconciliation: true, canRetry: false };
  if (lifecycle === "first_admin_invite_unknown" && attempt >= 3) return { requiresReconciliation: true, canRetry: false, requiresFreshApprovalForAttempt: 4 };
  if (lifecycle === "first_admin_invite_unknown") return { requiresReconciliation: true, canRetry: false };
  if (lifecycle === "first_admin_invite_failed") return { canRetry: true, ...(attempt >= 3 ? { requiresFreshApprovalForAttempt: 4 } : {}) };
  if (lifecycle === "already_provisioned") return { duplicateCreateSuccess: false };
  if (lifecycle === "first_admin_invite_requested") return { step: "first-admin", canApprove: false };
  if (lifecycle === "ready") return { step: "complete" };
  return { step: "first-admin", canApprove: false };
}
