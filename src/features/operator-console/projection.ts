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
