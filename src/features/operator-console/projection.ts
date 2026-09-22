export type OperatorConsoleRow = {
  readonly tenantName: string;
  readonly canonicalOrganisationIdentity: string;
  readonly provisioningState: string;
  readonly createdAt: string;
  readonly firstAdminState: string;
};

/** Maps a fixed SQL row into the console's exact public allow-list. */
export function projectConsoleRow(row: Record<string, unknown>): OperatorConsoleRow | null {
  const tenantName = row.tenant_name;
  const canonicalOrganisationIdentity = row.canonical_organisation_identity;
  const provisioningState = row.provisioning_state;
  const createdAt = row.created_at;
  const firstAdminState = row.first_admin_state;
  if (typeof tenantName !== "string" || typeof canonicalOrganisationIdentity !== "string" || typeof provisioningState !== "string" || typeof createdAt !== "string" || typeof firstAdminState !== "string") return null;
  return { tenantName, canonicalOrganisationIdentity, provisioningState, createdAt, firstAdminState };
}

/** Exact approval allow-list; canonical hashes and protocol facts stay server-only. */
export function projectProvisioningConfirmation(preview: import("@/server/commands/provisioning/validation").ProvisioningPreview, renewal = false) {
  const values = preview.proposed_values;
  return {
    legalName: String(values.legal_name),
    normalizedIdentity: `${preview.normalized_identity.country_code}:${preview.normalized_identity.organization_number}`,
    contractStartDate: String(values.contract_start_date),
    subscriptionPlan: String(values.subscription_plan_id),
    subscriptionStatus: String(values.subscription_status),
    includedUsers: Number(values.included_user_count),
    additionalUserPriceOre: Number(values.additional_user_price_ore),
    firstAdminName: preview.first_admin.name,
    firstAdminEmail: preview.first_admin.normalized_email,
    baseline: { id: preview.baseline.id, version: preview.baseline.version, contentHash: preview.baseline.content_hash },
    proposedAction: renewal ? "RENEW_INVITATION" as const : preview.proposed_action,
    warnings: preview.warnings,
  };
}
