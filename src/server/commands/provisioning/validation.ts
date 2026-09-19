import { createHash } from "node:crypto";

export const PROVISIONING_STATES = [
  "pending_first_admin_invite", "first_admin_invite_unknown", "first_admin_invite_requested", "first_admin_invite_failed", "ready",
] as const;
type ProvisioningState = (typeof PROVISIONING_STATES)[number];

const REQUIRED = ["schema_version", "request_id", "legal_name", "country_code", "organization_number", "first_admin_name", "first_admin_email", "baseline_profile_id", "baseline_profile_version", "subscription_plan_id", "subscription_status", "included_user_count", "additional_user_price_ore", "contract_start_date"] as const;
const OPTIONAL = ["vat_registration_number", "address", "primary_email", "phone", "contract_end_date", "trial_end_date", "billing_reference", "commercial_overrides", "reply_to", "module_ids", "feature_flags"] as const;
const ALLOWED = new Set([...REQUIRED, ...OPTIONAL]);

export type ProvisioningRequest = Record<string, unknown>;

export type ProvisioningPreview = {
  readonly schema_version: 1;
  readonly request_id: string;
  readonly normalized_identity: { readonly country_code: "SE"; readonly organization_number: string; readonly vat_registration_number?: string };
  readonly validation: { readonly valid: true };
  readonly warnings: readonly string[];
  readonly proposed_action: "CREATE";
  readonly baseline: { readonly id: string; readonly version: number; readonly content_hash: string };
  readonly proposed_values: Record<string, unknown>;
  readonly first_admin: { readonly name: string; readonly normalized_email: string };
  readonly audit_events: readonly string[];
  readonly unsupported_fields: readonly [];
  readonly deferred_fields: readonly [];
  readonly preview_hash: string;
  readonly writes: 0;
  readonly authCalls: 0;
};

export function decodeProvisioningRequest(input: unknown): ProvisioningRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("UNSUPPORTED_FIELD");
  const request = input as Record<string, unknown>;
  if (request.schema_version !== 1) throw new Error("UNSUPPORTED_SCHEMA_VERSION");
  for (const key of Object.keys(request)) if (!ALLOWED.has(key as (typeof REQUIRED)[number] | (typeof OPTIONAL)[number])) throw new Error(`UNSUPPORTED_FIELD: ${key}`);
  for (const key of REQUIRED) if (request[key] === undefined || request[key] === "") throw new Error(`UNSUPPORTED_FIELD: ${key}`);
  return request;
}

function luhn(value: string) {
  return [...value].reduce((sum, char, index) => { const doubled = Number(char) * (index % 2 === 0 ? 2 : 1); return sum + (doubled > 9 ? doubled - 9 : doubled); }, 0) % 10 === 0;
}

function email(value: unknown): string {
  if (typeof value !== "string") throw new Error("INVALID_EMAIL");
  const normalized = value.trim().normalize("NFC");
  if (/[<>()\[\],;:\\"\s]/.test(normalized) || normalized.split("@").length !== 2) throw new Error("INVALID_EMAIL");
  const [local, domain] = normalized.split("@");
  if (!local || !domain || !/^[^@]+$/.test(local)) throw new Error("INVALID_EMAIL");
  try { return `${local.toLowerCase()}@${new URL(`http://${domain}`).hostname.toLowerCase()}`; } catch { throw new Error("INVALID_EMAIL"); }
}

export function canonicalizeProvisioningRequest(input: unknown): ProvisioningRequest & { normalizedOrganizationNumber: string; vatRegistrationNumber?: string; firstAdminEmail: string; canonicalRequestHash: string } {
  const request = decodeProvisioningRequest(input);
  if (request.country_code !== "SE") throw new Error("INVALID_ORGANIZATION_NUMBER");
  const number = String(request.organization_number).replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(number) || !luhn(number) || /^(?:\d{2})?(?:[0-3]\d|[4-9]\d)(?:0\d|1[0-2])/.test(number)) throw new Error("INVALID_ORGANIZATION_NUMBER");
  let vatRegistrationNumber: string | undefined;
  if (request.vat_registration_number !== undefined) {
    vatRegistrationNumber = String(request.vat_registration_number).trim().toUpperCase().replace(/\s/g, "");
    if (vatRegistrationNumber !== `SE${number}01`) throw new Error("INVALID_VAT_REGISTRATION_NUMBER");
  }
  const firstAdminEmail = email(request.first_admin_email);
  // Hash a canonical key order and normalized values. JSON object insertion order is
  // not a business property and must not turn an otherwise identical retry into a
  // conflict.
  const canonical = Object.fromEntries(Object.keys(request).sort().map((key) => [key, request[key]]));
  canonical.organization_number = number;
  canonical.country_code = "SE";
  canonical.first_admin_email = firstAdminEmail;
  if (vatRegistrationNumber) canonical.vat_registration_number = vatRegistrationNumber;
  return { ...request, normalizedOrganizationNumber: number, vatRegistrationNumber, firstAdminEmail, canonicalRequestHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex") };
}

/** Pure/stateless dry-run authority. Callers must not persist this result. */
export function createProvisioningPreview(input: unknown, baseline: { id: string; version: number; contentHash: string }): ProvisioningPreview {
  const request = canonicalizeProvisioningRequest(input);
  const previewPayload = { requestHash: request.canonicalRequestHash, baselineId: baseline.id, baselineVersion: baseline.version, baselineContentHash: baseline.contentHash };
  const preview_hash = createHash("sha256").update(JSON.stringify(previewPayload)).digest("hex");
  return {
    schema_version: 1,
    request_id: String(request.request_id),
    normalized_identity: { country_code: "SE", organization_number: request.normalizedOrganizationNumber, ...(request.vatRegistrationNumber ? { vat_registration_number: request.vatRegistrationNumber } : {}) },
    validation: { valid: true }, warnings: [], proposed_action: "CREATE",
    baseline: { id: baseline.id, version: baseline.version, content_hash: baseline.contentHash },
    proposed_values: { ...request, first_admin_email: request.firstAdminEmail },
    first_admin: { name: String(request.first_admin_name), normalized_email: request.firstAdminEmail },
    audit_events: ["tenant_provisioning_approved"], unsupported_fields: [], deferred_fields: [], preview_hash, writes: 0, authCalls: 0,
  };
}

const TRANSITIONS: Record<ProvisioningState, readonly ProvisioningState[]> = {
  pending_first_admin_invite: ["first_admin_invite_unknown", "first_admin_invite_requested", "first_admin_invite_failed"],
  first_admin_invite_unknown: ["first_admin_invite_requested", "first_admin_invite_failed"],
  first_admin_invite_requested: ["ready", "first_admin_invite_unknown", "first_admin_invite_failed"],
  first_admin_invite_failed: ["first_admin_invite_requested", "first_admin_invite_unknown"], ready: [],
};
export function canTransitionProvisioning(from: ProvisioningState, to: string) { return TRANSITIONS[from]?.includes(to as ProvisioningState) ?? false; }
export function canMarkTenantProvisioningReady(facts: { databaseCommitted: boolean; baselineRecorded: boolean; membershipActive: boolean; authUserId: string | null; normalizedAuthEmail: string | null; normalizedInvitationEmail: string; unresolvedFailure: boolean }) { return facts.databaseCommitted && facts.baselineRecorded && facts.membershipActive && !!facts.authUserId && facts.normalizedAuthEmail === facts.normalizedInvitationEmail && !facts.unresolvedFailure; }
