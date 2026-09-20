import { createHash } from "node:crypto";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";

const string = (form: FormData, key: string): string | null => {
  const value = form.get(key);
  return typeof value === "string" ? value : null;
};

/** Repeat previews of one canonical organisation retain a deterministic server
 * request identity, so an observed handoff is never a second create request. */
function requestIdForOrganisation(organisationNumber: string | null): string | null {
  if (typeof organisationNumber !== "string") return null;
  const normalized = organisationNumber.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(normalized)) return null;
  const hex = createHash("sha256").update(`operator-console:SE:${normalized}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Build the wizard's closed request shape. Baseline facts remain server-owned. */
export function requestFromOperatorConsoleForm(form: FormData): Record<string, unknown> | null {
  const baseline = findProvisioningBaseline("standard-se", 1);
  if (!baseline) return null;
  const organizationNumber = string(form, "organizationNumber");
  const requestId = requestIdForOrganisation(organizationNumber);
  const values = {
    schema_version: 1,
    request_id: requestId,
    legal_name: string(form, "legalName"),
    country_code: "SE",
    organization_number: organizationNumber,
    first_admin_name: string(form, "firstAdminName"),
    first_admin_email: string(form, "firstAdminEmail"),
    baseline_profile_id: baseline.id,
    baseline_profile_version: baseline.version,
    subscription_plan_id: "standard",
    subscription_status: "active",
    included_user_count: 5,
    additional_user_price_ore: 12500,
    contract_start_date: string(form, "contractStartDate"),
  };
  return Object.values(values).some((value) => value === null || value === "" || Number.isNaN(value)) ? null : values;
}
