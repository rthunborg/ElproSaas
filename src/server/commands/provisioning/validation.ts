import { createHash } from "node:crypto";
import { SCOPE_MANIFEST } from "@/scope/manifest";

export const PROVISIONING_STATES = [
  "pending_first_admin_invite", "first_admin_invite_unknown", "first_admin_invite_requested", "first_admin_invite_failed", "ready",
] as const;
/** One approved preview snapshot authorises the initial dispatch plus two resends. */
export const MAX_PROVIDER_DISPATCH_ATTEMPTS = 3;
type ProvisioningState = (typeof PROVISIONING_STATES)[number];

const REQUIRED = ["schema_version", "request_id", "legal_name", "country_code", "organization_number", "first_admin_name", "first_admin_email", "baseline_profile_id", "baseline_profile_version", "subscription_plan_id", "subscription_status", "included_user_count", "additional_user_price_ore", "contract_start_date"] as const;
const OPTIONAL = ["vat_registration_number", "address", "primary_email", "phone", "contract_end_date", "trial_end_date", "billing_reference", "commercial_overrides", "reply_to", "module_ids", "feature_flags"] as const;
const ALLOWED = new Set([...REQUIRED, ...OPTIONAL]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[+()\-\s\d]{5,32}$/;
const MAX_TEXT = 512;
const ACTIVE_TENANT_MODULE_IDS = new Set(
  SCOPE_MANIFEST.modules
    .filter((module) => module.status === "active" && (module.scope ?? "tenant") === "tenant")
    .map((module) => module.id),
);

export type ProvisioningRequest = Record<string, unknown>;

function text(value: unknown, max = MAX_TEXT): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function date(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function scalar(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

function optionalText(value: unknown, max = MAX_TEXT): boolean {
  return value === undefined || text(value, max);
}

function validateOptionalShapes(request: ProvisioningRequest) {
  if (request.vat_registration_number !== undefined && !text(request.vat_registration_number, 32)) throw new Error("INVALID_VAT_REGISTRATION_NUMBER");
  if (request.primary_email !== undefined) email(request.primary_email);
  if (request.reply_to !== undefined) email(request.reply_to);
  if (request.phone !== undefined && (typeof request.phone !== "string" || !PHONE.test(request.phone))) throw new Error("INVALID_PHONE");
  for (const field of ["contract_end_date", "trial_end_date"] as const) if (request[field] !== undefined && !date(request[field])) throw new Error("INVALID_DATE");
  if (request.billing_reference !== undefined && !text(request.billing_reference)) throw new Error("INVALID_BILLING_REFERENCE");

  if (request.address !== undefined) {
    if (!plainRecord(request.address)) throw new Error("INVALID_ADDRESS");
    const address = request.address;
    const fields = new Set(["address_line1", "address_line2", "postal_code", "city"]);
    if (Object.keys(address).length === 0 || Object.keys(address).some((key) => !fields.has(key)) || !Object.values(address).every((value) => optionalText(value))) throw new Error("INVALID_ADDRESS");
  }
  if (request.commercial_overrides !== undefined) {
    if (!plainRecord(request.commercial_overrides) || Object.keys(request.commercial_overrides).length > 32 || Object.keys(request.commercial_overrides).some((key) => !text(key, 64)) || !Object.values(request.commercial_overrides).every(scalar)) throw new Error("INVALID_COMMERCIAL_OVERRIDES");
  }
  if (request.module_ids !== undefined) {
    if (!Array.isArray(request.module_ids) || request.module_ids.some((value) => typeof value !== "string" || !ACTIVE_TENANT_MODULE_IDS.has(value)) || new Set(request.module_ids).size !== request.module_ids.length) throw new Error("INVALID_MODULE_IDS");
  }
  // There is no approved feature-flag registry in v1. An empty list is the only
  // representable value; accepting names here would turn caller input into policy.
  if (request.feature_flags !== undefined && (!Array.isArray(request.feature_flags) || request.feature_flags.length !== 0)) throw new Error("INVALID_FEATURE_FLAGS");
}

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
  if (!plainRecord(input)) throw new Error("UNSUPPORTED_FIELD");
  const request = input as Record<string, unknown>;
  if (request.schema_version !== 1) throw new Error("UNSUPPORTED_SCHEMA_VERSION");
  for (const key of Object.keys(request)) if (!ALLOWED.has(key as (typeof REQUIRED)[number] | (typeof OPTIONAL)[number])) throw new Error(`UNSUPPORTED_FIELD: ${key}`);
  for (const key of REQUIRED) if (request[key] === undefined || request[key] === "") throw new Error(`UNSUPPORTED_FIELD: ${key}`);
  if (!UUID.test(String(request.request_id)) || typeof request.request_id !== "string") throw new Error("INVALID_REQUEST_ID");
  for (const key of ["legal_name", "country_code", "organization_number", "first_admin_name", "first_admin_email", "baseline_profile_id", "subscription_plan_id", "subscription_status"] as const) if (!text(request[key])) throw new Error(`INVALID_${key.toUpperCase()}`);
  if (!Number.isSafeInteger(request.baseline_profile_version) || (request.baseline_profile_version as number) <= 0) throw new Error("INVALID_BASELINE_PROFILE_VERSION");
  if (!Number.isSafeInteger(request.included_user_count) || (request.included_user_count as number) < 0) throw new Error("INVALID_INCLUDED_USER_COUNT");
  if (!Number.isSafeInteger(request.additional_user_price_ore) || (request.additional_user_price_ore as number) < 0) throw new Error("INVALID_ADDITIONAL_USER_PRICE_ORE");
  if (!date(request.contract_start_date)) throw new Error("INVALID_CONTRACT_START_DATE");
  validateOptionalShapes(request);
  return request;
}

function luhn(value: string) {
  return [...value].reduce((sum, char, index) => { const doubled = Number(char) * (index % 2 === 0 ? 2 : 1); return sum + (doubled > 9 ? doubled - 9 : doubled); }, 0) % 10 === 0;
}

/** Canonical organization-number authority reused by persisted provisioning projections. */
export function normalizeSwedishOrganizationNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\s-]/g, "");
  return /^\d{10}$/.test(normalized) && luhn(normalized) && !/^(?:\d{2})?(?:[0-3]\d|[4-9]\d)(?:0\d|1[0-2])/.test(normalized)
    ? normalized : null;
}

function email(value: unknown): string {
  if (typeof value !== "string") throw new Error("INVALID_EMAIL");
  const normalized = value.trim().normalize("NFC");
  if (/[<>()\[\],;:\\"\s]/.test(normalized) || normalized.split("@").length !== 2) throw new Error("INVALID_EMAIL");
  const [local, domain] = normalized.split("@");
  if (!local || !domain || !/^[^@]+$/.test(local)) throw new Error("INVALID_EMAIL");
  // URL is used only for IDNA normalization. Its URL syntax must not expand
  // the email domain into a path, credential, query, fragment, or port.
  if (/[:/?#]/.test(domain)) throw new Error("INVALID_EMAIL");
  try {
    const parsed = new URL(`http://${domain}`);
    if (!parsed.hostname || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) throw new Error("INVALID_EMAIL");
    return `${local.toLowerCase()}@${parsed.hostname.toLowerCase()}`;
  } catch { throw new Error("INVALID_EMAIL"); }
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (plainRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJsonValue(value[key])]));
  return value;
}

export function canonicalizeProvisioningRequest(input: unknown): ProvisioningRequest & { normalizedOrganizationNumber: string; vatRegistrationNumber?: string; firstAdminEmail: string; canonicalRequestHash: string } {
  const request = decodeProvisioningRequest(input);
  if (request.country_code !== "SE") throw new Error("INVALID_ORGANIZATION_NUMBER");
  const number = request.organization_number as string;
  const normalizedNumber = normalizeSwedishOrganizationNumber(number);
  if (!normalizedNumber) throw new Error("INVALID_ORGANIZATION_NUMBER");
  let vatRegistrationNumber: string | undefined;
  if (request.vat_registration_number !== undefined) {
    vatRegistrationNumber = (request.vat_registration_number as string).trim().toUpperCase().replace(/\s/g, "");
    if (vatRegistrationNumber !== `SE${normalizedNumber}01`) throw new Error("INVALID_VAT_REGISTRATION_NUMBER");
  }
  const firstAdminEmail = email(request.first_admin_email);
  // Hash a canonical key order and normalized values. JSON object insertion order is
  // not a business property and must not turn an otherwise identical retry into a
  // conflict.
  const canonical = canonicalJsonValue(request) as Record<string, unknown>;
  canonical.organization_number = normalizedNumber;
  canonical.country_code = "SE";
  canonical.first_admin_email = firstAdminEmail;
  if (vatRegistrationNumber) canonical.vat_registration_number = vatRegistrationNumber;
  return {
    ...request,
    organization_number: normalizedNumber,
    first_admin_email: firstAdminEmail,
    ...(vatRegistrationNumber ? { vat_registration_number: vatRegistrationNumber } : {}),
    normalizedOrganizationNumber: normalizedNumber,
    vatRegistrationNumber,
    firstAdminEmail,
    canonicalRequestHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
  };
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
export function canReserveProvisioningDispatch(attemptCount: number, hasFreshPreviewApproval: boolean) {
  return attemptCount < MAX_PROVIDER_DISPATCH_ATTEMPTS || hasFreshPreviewApproval;
}
export function canMarkTenantProvisioningReady(facts: { databaseCommitted: boolean; baselineRecorded: boolean; membershipActive: boolean; authUserId: string | null; normalizedAuthEmail: string | null; normalizedInvitationEmail: string; unresolvedFailure: boolean }) { return facts.databaseCommitted && facts.baselineRecorded && facts.membershipActive && !!facts.authUserId && facts.normalizedAuthEmail === facts.normalizedInvitationEmail && !facts.unresolvedFailure; }
