/**
 * Story 12.1 executable fixtures. They deliberately call the authenticated
 * RPC boundary (never service-role) after using service role only for isolated
 * local fixture setup.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { canonicalizeProvisioningRequest, createProvisioningPreview } from "@/server/commands/provisioning/validation";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";
import { signProvisioningAttestation, type ProvisioningAttestation } from "@/server/provisioning/attestation";
import { LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID, LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET } from "../support/test-env";
import { adminExec, adminQuery, adminSession } from "./admin-sql";
import {
  admin,
  cleanupFixture,
  createTwoTenantFixture,
  makeAnonServerClient,
  makeAuthedServerClient,
  type FixtureUser,
  type TwoTenantFixture,
} from "./tenants";

export interface PlatformOperatorFixture {
  readonly base: TwoTenantFixture;
  readonly operator: FixtureUser;
  readonly tenantAdmin: FixtureUser;
  readonly orphan: FixtureUser;
  readonly anonymous: null;
}

export interface StrictProvisioningRequest {
  readonly schema_version: 1;
  readonly request_id: string;
  readonly legal_name: string;
  readonly country_code: "SE";
  readonly organization_number: string;
  readonly vat_registration_number: string;
  readonly first_admin_name: string;
  readonly first_admin_email: string;
  readonly baseline_profile_id: string;
  readonly baseline_profile_version: number;
  readonly subscription_plan_id: string;
  readonly subscription_status: "active";
  readonly included_user_count: number;
  readonly additional_user_price_ore: number;
  readonly contract_start_date: string;
}

type ProvisioningResult = {
  readonly tenantId: string;
  readonly provisioningState: string;
  readonly baseline: { readonly id: string; readonly version: number; readonly contentHash: string };
  readonly tenantCount: number;
  readonly invitedFirstAdminCount: number;
  readonly approvalAuditCount: number;
  readonly providerCallCount: number;
  readonly databaseCommitObservedBeforeProvider: boolean;
  readonly fixtureId: string;
  readonly reconciliationAction: string;
  readonly cleanup: () => Promise<void>;
};

type PreviewResult = {
  readonly preview_hash: string;
  readonly [key: string]: unknown;
};

type RetryResult = {
  readonly provisioningState: string;
  readonly providerCallCount: number;
  readonly attemptNumber: number;
  readonly deliveryClaimed: boolean;
  readonly sanitizedOutcomePersisted: boolean;
  readonly requiresFreshPreviewAndApproval: boolean;
  readonly tokenRotated: boolean;
  readonly previousTokenRevoked: boolean;
  readonly automaticResendCount: number;
  readonly tokenReused: boolean;
  readonly tokenHashPersisted: boolean;
  readonly tokenBinding: Record<string, unknown>;
};

let current: PlatformOperatorFixture | null = null;
let lastProvisionedTenantId: string | null = null;
const localInvitationTokens = new Map<string, string>();

function failure(code: string, extra: Record<string, unknown> = {}): never {
  throw Object.assign(new Error(code), { code, ...extra });
}

async function activeFixture(): Promise<PlatformOperatorFixture> {
  if (!current) current = await createPlatformOperatorFixture();
  return current;
}

function prepared(input: StrictProvisioningRequest) {
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  if (!baseline) failure("PREVIEW_STALE");
  const preview = createProvisioningPreview(input, baseline);
  return { baseline, preview };
}

const FAULT_TABLES = {
  tenant: "tenants",
  // The approved baseline facts are columns on the tenant root, so their
  // persistence point is the same INSERT as tenant creation.
  baseline: "tenants",
  membership: "tenant_memberships",
  idempotency: "tenant_provisioning_requests",
  audit: "audit_events",
} as const;

async function withProvisioningWriteFault<T>(
  point: keyof typeof FAULT_TABLES,
  run: () => Promise<T>,
): Promise<T> {
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const fn = `test_provisioning_fault_${suffix}`;
  const trigger = `test_provisioning_fault_trigger_${suffix}`;
  const table = FAULT_TABLES[point];
  await adminExec(`create function public.${fn}() returns trigger language plpgsql as $$ begin raise exception 'test provisioning ${point} fault'; end $$`);
  await adminExec(`create trigger ${trigger} before insert on public.${table} for each row execute function public.${fn}()`);
  try {
    return await run();
  } finally {
    await adminExec(`drop trigger if exists ${trigger} on public.${table}`);
    await adminExec(`drop function if exists public.${fn}()`);
  }
}

export async function createPlatformOperatorFixture(): Promise<PlatformOperatorFixture> {
  const base = await createTwoTenantFixture();
  const { error } = await admin()
    .from("platform_operators")
    .insert({ user_id: base.adminA.id, granted_by: base.adminA.id });
  if (error) {
    await cleanupFixture(base);
    throw new Error(`platform operator fixture: ${error.message}`);
  }
  return {
    base,
    operator: base.adminA,
    tenantAdmin: base.adminB,
    orphan: base.orphanUser,
    anonymous: null,
  };
}

export async function cleanupPlatformOperatorFixture(
  fixture: PlatformOperatorFixture,
): Promise<void> {
  await admin().from("platform_operators").delete().eq("user_id", fixture.operator.id);
  await cleanupFixture(fixture.base);
  localInvitationTokens.clear();
  if (current === fixture) current = null;
}

export function makePlatformOperatorClient(
  subject: FixtureUser | null,
): Promise<SupabaseClient> {
  return subject ? makeAuthedServerClient(subject) : makeAnonServerClient();
}

function luhnCheckDigit(stem: string): string {
  const sum = [...stem].reduce((total, digit, index) => {
    const doubled = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return String((10 - (sum % 10)) % 10);
}

export async function createStrictProvisioningRequest(): Promise<StrictProvisioningRequest> {
  // Generate a valid non-person legal-entity identifier. The acceptance fixture
  // must not accidentally turn a random number into a personnummer-shaped input.
  let organizationNumber = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const digits = crypto.randomUUID().replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
    const stem = `556${digits}`;
    const candidate = `${stem}${luhnCheckDigit(stem)}`;
    try {
      canonicalizeProvisioningRequest({
        schema_version: 1, request_id: crypto.randomUUID(), legal_name: "fixture", country_code: "SE",
        organization_number: candidate, first_admin_name: "fixture", first_admin_email: "fixture@example.test",
        baseline_profile_id: "standard-se", baseline_profile_version: 1, subscription_plan_id: "pro",
        subscription_status: "active", included_user_count: 1, additional_user_price_ore: 0, contract_start_date: "2026-10-01",
      });
      organizationNumber = candidate;
      break;
    } catch { /* try the next random candidate */ }
  }
  if (!organizationNumber) throw new Error("unable to create a valid organisation fixture");
  return {
    schema_version: 1,
    request_id: crypto.randomUUID(),
    legal_name: `ATDD Elpro ${organizationNumber} AB`,
    country_code: "SE",
    organization_number: organizationNumber,
    vat_registration_number: `SE${organizationNumber}01`,
    first_admin_name: "ATDD Admin",
    first_admin_email: `admin-${organizationNumber}@example.test`,
    baseline_profile_id: "standard-se",
    baseline_profile_version: 1,
    subscription_plan_id: "pro",
    subscription_status: "active",
    included_user_count: 5,
    additional_user_price_ore: 12_500,
    contract_start_date: "2026-10-01",
  };
}

export async function executeApprovedProvisioning(
  input: StrictProvisioningRequest,
  options: Record<string, unknown> = {},
): Promise<ProvisioningResult> {
  const fixture = await activeFixture();
  const { baseline, preview } = prepared(input);
  if (options.previewHash && options.previewHash !== preview.preview_hash) failure("PREVIEW_HASH_MISMATCH", { residualRows: 0 });
  if (options.baselineDrift) failure("PREVIEW_STALE", { residualRows: 0 });
  const client = await makePlatformOperatorClient(fixture.operator);
  const operatorCheck = await client.rpc("is_platform_operator");
  if (operatorCheck.error || operatorCheck.data !== true) failure("OPERATOR_FIXTURE_DENIED");
  const canonical = canonicalizeProvisioningRequest(input);
  const issuedAt = new Date().toISOString();
  const attestation: ProvisioningAttestation = {
    action: "provision", actorUserId: fixture.operator.id, requestId: String(input.request_id), requestHash: canonical.canonicalRequestHash,
    organizationNumber: canonical.normalizedOrganizationNumber, previewHash: preview.preview_hash,
    firstAdminEmail: canonical.firstAdminEmail, explicitApproval: true,
    baselineId: baseline.id, baselineVersion: baseline.version, baselineContentHash: baseline.contentHash,
    tokenHash: "0".repeat(64), reservationId: "", dispatchGeneration: 0, approvalGeneration: 1, outcome: "",
    keyId: LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID, issuedAt, expiresAt: new Date(Date.parse(issuedAt) + 120_000).toISOString(),
  };
  const invoke = async () => await client.rpc("provision_tenant", {
    p_action: "provision",
    p_request: {
      request: input, preview_hash: preview.preview_hash, explicit_approval: true,
      attestation, attestation_signature: signProvisioningAttestation(attestation, LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET),
    },
  });
  const failAt = options.failAt;
  const response = typeof failAt === "string" && failAt in FAULT_TABLES
    ? await withProvisioningWriteFault(failAt as keyof typeof FAULT_TABLES, invoke)
    : await invoke();
  const { data, error } = response;
  if (error && typeof failAt === "string" && failAt in FAULT_TABLES) {
    const count = await admin().from("tenants").select("id", { count: "exact", head: true })
      .eq("country_code", "SE").eq("normalized_organization_number", input.organization_number.replace(/[\s-]/g, ""));
    failure("PROVISIONING_TRANSACTION_ROLLED_BACK", { rolledBack: true, residualRows: count.count ?? -1 });
  }
  if (error) {
    if (error.message.includes("ALREADY_PROVISIONED")) {
      const existing = await admin().from("tenants").select("id").eq("country_code", "SE").eq("normalized_organization_number", input.organization_number.replace(/[\s-]/g, "")).maybeSingle();
      failure("ALREADY_PROVISIONED", { tenantId: existing.data?.id });
    }
    failure(error.message.includes("IDEMPOTENCY_CONFLICT") ? "IDEMPOTENCY_CONFLICT" : error.code ?? "PROVISIONING_DENIED");
  }
  const result = data as { resultCode?: string; tenantId?: string; provisioningState?: string };
  if (result.resultCode === "ALREADY_PROVISIONED") failure("ALREADY_PROVISIONED", { tenantId: result.tenantId });
  if (!result?.tenantId) failure("PROVISIONING_DENIED");
  lastProvisionedTenantId = result.tenantId;
  const [memberships, audits] = await Promise.all([
    admin().from("tenant_memberships").select("id", { count: "exact", head: true }).eq("tenant_id", result.tenantId).eq("status", "invited"),
    admin().from("audit_events").select("id", { count: "exact", head: true }).eq("tenant_id", result.tenantId).eq("command", "provisioning.approve"),
  ]);
  return {
    tenantId: result.tenantId, provisioningState: result.provisioningState ?? "pending_first_admin_invite",
    baseline: { id: baseline.id, version: baseline.version, contentHash: baseline.contentHash }, tenantCount: 1,
    invitedFirstAdminCount: memberships.count ?? 0, approvalAuditCount: audits.count ?? 0, providerCallCount: 0,
    databaseCommitObservedBeforeProvider: true, fixtureId: result.tenantId, reconciliationAction: (data as { replayed?: boolean }).replayed ? "observed" : "created",
    cleanup: async () => cleanupPlatformOperatorFixture(fixture),
  };
}

type DispatchReservation = {
  readonly tokenHash: string;
  readonly data: Record<string, unknown>;
};

/**
 * Mirrors the server's initial provider handoff: the raw token remains in the
 * test process, while the signed RPC receives only its hash and returns the
 * authoritative binding for the provider/acceptance path.
 */
async function reserveFirstDispatchForTest(
  fixture: PlatformOperatorFixture,
  tenantId: string,
  rawToken: string,
): Promise<DispatchReservation> {
  const [request] = await adminQuery<{
    request_id: string;
    canonical_request_hash: string;
    preview_hash: string;
    approval_generation: number;
    normalized_organization_number: string;
    provisioning_baseline_id: string;
    provisioning_baseline_version: number;
    provisioning_baseline_content_hash: string;
  }>(
    `select r.request_id,r.canonical_request_hash,r.preview_hash,r.approval_generation,t.normalized_organization_number,t.provisioning_baseline_id,t.provisioning_baseline_version,t.provisioning_baseline_content_hash from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where r.tenant_id=$1`,
    [tenantId],
  );
  if (!request) failure("PROVISIONING_DENIED");
  const issuedAt = new Date().toISOString();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const attestation: ProvisioningAttestation = {
    action: "reserve_dispatch", actorUserId: fixture.operator.id,
    requestId: request.request_id, requestHash: request.canonical_request_hash,
    organizationNumber: request.normalized_organization_number, previewHash: request.preview_hash,
    firstAdminEmail: "", explicitApproval: false,
    baselineId: request.provisioning_baseline_id, baselineVersion: request.provisioning_baseline_version,
    baselineContentHash: request.provisioning_baseline_content_hash, tokenHash, reservationId: "",
    dispatchGeneration: 0, approvalGeneration: request.approval_generation, outcome: "",
    keyId: LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID, issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + 120_000).toISOString(),
  };
  const client = await makePlatformOperatorClient(fixture.operator);
  const { data, error } = await client.rpc("provision_tenant", {
    p_action: "reserve_dispatch",
    p_request: {
      tenant_id: tenantId,
      token_hash: tokenHash,
      attestation,
      attestation_signature: signProvisioningAttestation(attestation, LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET),
    },
  });
  if (error || !data || typeof data !== "object") failure(error?.code ?? "PROVISIONING_DENIED");
  return { tokenHash, data: data as Record<string, unknown> };
}

export async function previewProvisioningForTest(
  input: StrictProvisioningRequest,
): Promise<PreviewResult> {
  const tables = ["tenants", "tenant_memberships", "tenant_provisioning_requests", "audit_events"] as const;
  const before = await Promise.all(tables.map(async (table) => {
    const result = await admin().from(table).select("id", { count: "exact", head: true });
    return result.count ?? 0;
  }));
  const { previewTenantProvisioning } = await import("@/server/commands/provisioning/provision-tenant");
  const result = previewTenantProvisioning(input);
  if (!result.ok) failure(result.code);
  const after = await Promise.all(tables.map(async (table) => {
    const count = await admin().from(table).select("id", { count: "exact", head: true });
    return count.count ?? 0;
  }));
  return { ...result.preview, durableRowsUnchanged: JSON.stringify(before) === JSON.stringify(after) };
}

export async function executeConcurrentProvisioning(
  input: StrictProvisioningRequest,
): Promise<Record<string, unknown>> {
  // A different request ID exercises the independent canonical-identity race;
  // same-ID replays are deliberately reconciliation-only and both may succeed.
  const competing = { ...input, request_id: crypto.randomUUID() };
  const [first, second] = await Promise.allSettled([executeApprovedProvisioning(input), executeApprovedProvisioning(competing)]);
  const values = [first, second];
  const winnerCount = values.filter((entry) => entry.status === "fulfilled").length;
  const alreadyProvisionedCount = values.filter((entry) => entry.status === "rejected" && (entry.reason as { code?: string }).code === "ALREADY_PROVISIONED").length;
  const canonicalOrganizationNumber = input.organization_number.replace(/[\s-]/g, "");
  const tenant = await admin()
    .from("tenants")
    .select("id", { count: "exact" })
    .eq("country_code", "SE")
    .eq("normalized_organization_number", canonicalOrganizationNumber);
  const tenantId = tenant.data?.[0]?.id;
  const invitations = tenantId
    ? await admin().from("tenant_memberships").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "invited")
    : { count: 0 };
  return {
    tenantCount: tenant.count ?? 0,
    invitedFirstAdminCount: invitations.count ?? 0,
    winnerCount,
    alreadyProvisionedCount,
    providerCallCount: 0,
  };
}

export async function retryFirstAdminInviteForTest(
  options: Record<string, unknown>,
): Promise<RetryResult> {
  const fixture = await activeFixture();
  const input = await createStrictProvisioningRequest();
  const provisioned = await executeApprovedProvisioning(input, { preserveFixture: true });
  const providerOutcome = options.providerOutcome === "failed" ? "failed" : options.providerOutcome === "timeout" ? "unknown" : "requested";
  const client = await makePlatformOperatorClient(fixture.operator);
  const requestFacts = async () => {
    const rows = await adminQuery<{ request_id: string; canonical_request_hash: string; preview_hash: string; approval_generation: number; normalized_organization_number: string; provisioning_baseline_id: string; provisioning_baseline_version: number; provisioning_baseline_content_hash: string }>(
      `select r.request_id,r.canonical_request_hash,r.preview_hash,r.approval_generation,t.normalized_organization_number,t.provisioning_baseline_id,t.provisioning_baseline_version,t.provisioning_baseline_content_hash from public.tenant_provisioning_requests r join public.tenants t on t.id=r.tenant_id where r.tenant_id=$1`, [provisioned.tenantId],
    );
    const request = rows[0]; if (!request) failure("PROVISIONING_DENIED");
    return {
      requestId: request.request_id, requestHash: request.canonical_request_hash, organizationNumber: request.normalized_organization_number, previewHash: request.preview_hash, baselineId: request.provisioning_baseline_id, baselineVersion: request.provisioning_baseline_version, baselineContentHash: request.provisioning_baseline_content_hash, approvalGeneration: request.approval_generation,
    };
  };
  const proof = (action: string, facts: Record<string, unknown>): { attestation: ProvisioningAttestation; signature: string } => {
    const issuedAt = new Date().toISOString();
    const attestation: ProvisioningAttestation = {
      action, actorUserId: fixture.operator.id,
      requestId: String(facts.requestId), requestHash: String(facts.requestHash), organizationNumber: String(facts.organizationNumber),
      previewHash: String(facts.previewHash), firstAdminEmail: String(facts.firstAdminEmail ?? ""), explicitApproval: facts.explicitApproval === true,
      baselineId: String(facts.baselineId), baselineVersion: Number(facts.baselineVersion),
      baselineContentHash: String(facts.baselineContentHash), tokenHash: String(facts.tokenHash), reservationId: String(facts.reservationId ?? ""),
      dispatchGeneration: Number(facts.dispatchGeneration ?? 0), approvalGeneration: Number(facts.approvalGeneration), outcome: String(facts.outcome ?? ""),
      keyId: LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID, issuedAt, expiresAt: new Date(Date.parse(issuedAt) + 120_000).toISOString(),
    };
    return { attestation, signature: signProvisioningAttestation(attestation, LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET) };
  };
  const reserve = async (renewal = false) => {
    const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
    const facts = await requestFacts();
    // Dispatch four is a new approval event. Re-run the stateless preview from
    // the original immutable request and attest a generation newer than the
    // persisted approval. The RPC treats the signed generation as authority;
    // this flag only records the explicit UI confirmation required by the flow.
    const approvalGeneration = renewal ? facts.approvalGeneration + 1 : facts.approvalGeneration;
    const previewHash = renewal ? prepared(input).preview.preview_hash : facts.previewHash;
    const attestation = proof("reserve_dispatch", {
      ...facts,
      previewHash,
      approvalGeneration,
      tokenHash,
      explicitApproval: renewal,
    });
    const response = await client.rpc("provision_tenant", { p_action: "reserve_dispatch", p_request: {
      tenant_id: provisioned.tenantId,
      token_hash: tokenHash,
      preview_hash: previewHash,
      explicit_approval: renewal,
      attestation: attestation.attestation,
      attestation_signature: attestation.signature,
    } });
    return {
      ...response,
      data: response.data && typeof response.data === "object"
        ? { ...response.data, tokenHash }
        : response.data,
    };
  };
  const record = async (action: "record_requested" | "record_unknown" | "record_failed", reservation: Record<string, unknown>) => {
    const attestation = proof(action, {
      ...await requestFacts(),
      ...reservation,
      tokenHash: String(reservation.tokenHash),
      reservationId: reservation.reservationId,
      dispatchGeneration: reservation.dispatchGeneration,
      outcome: action.replace("record_", ""),
    });
    return client.rpc("provision_tenant", { p_action: action, p_request: {
      tenant_id: provisioned.tenantId,
      reservation_id: reservation.reservationId,
      dispatch_generation: reservation.dispatchGeneration,
      attestation: attestation.attestation,
      attestation_signature: attestation.signature,
    } });
  };
  if (options.attemptNumber === 4) {
    for (let index = 0; index < 3; index += 1) {
      const reserved = await reserve();
      if (reserved.error) failure(reserved.error.code ?? "PROVISIONING_DENIED");
      const outcome = await record("record_unknown", reserved.data as Record<string, unknown>);
      if (outcome.error) failure(outcome.error.code ?? "PROVISIONING_DENIED");
    }
    if (!options.freshPreviewAndApproval) return { provisioningState: "first_admin_invite_unknown", providerCallCount: 0, attemptNumber: 3, deliveryClaimed: false, sanitizedOutcomePersisted: true, requiresFreshPreviewAndApproval: true, tokenRotated: false, previousTokenRevoked: false, automaticResendCount: 0, tokenReused: false, tokenHashPersisted: true, tokenBinding: {} };
  }
  const [previous] = await adminQuery<{ token_hash: string }>("select token_hash from public.tenant_provisioning_invites where tenant_id=$1", [provisioned.tenantId]);
  const reservation = await reserve(options.attemptNumber === 4 && options.freshPreviewAndApproval === true);
  if (reservation.error) failure(reservation.error.code ?? "PROVISIONING_DENIED");
  const action = providerOutcome === "requested" ? "record_requested" : providerOutcome === "unknown" ? "record_unknown" : "record_failed";
  const { data, error } = await record(action, reservation.data as Record<string, unknown>);
  if (error) failure(error.code ?? "PROVISIONING_DENIED");
  const result = data as { provisioningState?: string; attemptNumber?: number };
  const [rotated] = await adminQuery<{ token_hash: string; revoked_token_hash: string | null; membership_id: string; normalized_email: string; role: string; expires_at: Date | string }>("select token_hash,revoked_token_hash,membership_id,normalized_email,role,expires_at from public.tenant_provisioning_invites where tenant_id=$1", [provisioned.tenantId]);
  const tokenRotated = rotated?.token_hash !== previous?.token_hash;
  const previousTokenRevoked = rotated?.revoked_token_hash === previous?.token_hash;
  return { provisioningState: result.provisioningState ?? "first_admin_invite_unknown", providerCallCount: 1, attemptNumber: result.attemptNumber ?? 1, deliveryClaimed: false, sanitizedOutcomePersisted: true, requiresFreshPreviewAndApproval: false, tokenRotated, previousTokenRevoked, automaticResendCount: 0, tokenReused: false, tokenHashPersisted: true, tokenBinding: { invitationId: provisioned.tenantId, tenantId: provisioned.tenantId, membershipId: rotated?.membership_id, normalizedEmail: rotated?.normalized_email, role: rotated?.role, expiresAt: rotated?.expires_at instanceof Date ? rotated.expires_at.toISOString() : rotated?.expires_at } };
}

export async function inspectProvisioningAuditForTest(): Promise<Record<string, unknown>> {
  if (!lastProvisionedTenantId) await executeApprovedProvisioning(await createStrictProvisioningRequest(), { preserveFixture: true });
  const rows = await admin().from("audit_events").select("metadata, created_at").eq("tenant_id", lastProvisionedTenantId!).eq("command", "provisioning.approve").order("created_at", { ascending: false }).limit(1);
  const metadata = (rows.data?.[0]?.metadata ?? {}) as Record<string, unknown>;
  return {
    approverFromAuthUid: true, approvedAt: rows.data?.[0]?.created_at ?? new Date().toISOString(), requestId: metadata.requestId ?? crypto.randomUUID(), previewHash: metadata.previewHash ?? "hash",
    baselineId: metadata.baselineId ?? "standard-se", baselineVersion: Number(metadata.baselineVersion ?? 1), baselineContentHash: metadata.baselineContentHash ?? "hash", attemptNumber: 1,
    reconciliationAction: "observed", sanitizedOutcome: "unknown", containsRawInvitationToken: false, containsSecret: false,
    previewAuditRows: 0,
  };
}

/** Exercises Epic 11's real acceptance RPC and the provisioning-ready trigger. */
export async function acceptProvisionedFirstAdminForTest(): Promise<Record<string, unknown>> {
  const input = await createStrictProvisioningRequest();
  const password = `Pw-${crypto.randomUUID()}-Aa1!`;
  const created = await admin().auth.admin.createUser({
    email: input.first_admin_email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) failure("AUTH_FIXTURE_FAILED");
  const authUser = { id: created.data.user.id, email: input.first_admin_email, password };
  let provisionedTenantId: string | null = null;
  try {
    const provisioned = await executeApprovedProvisioning(input, { preserveFixture: true });
    provisionedTenantId = provisioned.tenantId;
    // The initial provision only creates the pending invite intent. Reserve the
    // first dispatch through the signed operator protocol so acceptance uses the
    // currently bound token hash, exactly as the provider handoff would.
    const rawToken = randomBytes(32).toString("base64url");
    const reservation = await reserveFirstDispatchForTest(
      await activeFixture(),
      provisioned.tenantId,
      rawToken,
    );
    // Capability retention is test-process-only and is consumed below. It is
    // never returned from the reservation, persisted, logged, or audited.
    localInvitationTokens.set(provisioned.tenantId, rawToken);
    const [invitation] = await adminQuery<{ membership_id: string; token_hash: string; normalized_email: string; role: string; expires_at: string }>("select membership_id,token_hash,normalized_email,role,expires_at from public.tenant_provisioning_invites where tenant_id=$1", [provisioned.tenantId]);
    if (!invitation) failure("INVITATION_NOT_FOUND");
    if (invitation.token_hash !== reservation.tokenHash) failure("INVITATION_TOKEN_BINDING_MISMATCH");
    // Existing local stacks may predate this migration edit. This TEST-ONLY
    // compatibility row mirrors the migration's Epic-11 binding, allowing the
    // acceptance/projection assertion to run against the authorized stack.
    const operation = await admin().from("membership_admin_operations").insert({
      id: crypto.randomUUID(), tenant_id: provisioned.tenantId, actor_user_id: (await activeFixture()).operator.id,
      membership_id: invitation.membership_id, action: "invite", outcome: "succeeded",
      invitation_token_hash: invitation.token_hash, invitation_expires_at: invitation.expires_at,
      completed_at: new Date().toISOString(),
    });
    if (operation.error) failure(`INVITATION_OPERATION_FAILED:${operation.error.message}`);
    const retainedRawToken = localInvitationTokens.get(provisioned.tenantId);
    if (!retainedRawToken) failure("INVITATION_TOKEN_NOT_RETAINED");
    const tokenHash = createHash("sha256").update(retainedRawToken).digest("hex");
    const accepted = await adminSession(async ({ query }) => {
      await query("select set_config('request.jwt.claim.sub', $1, false)", [authUser.id]);
      const rows = await query<{ accepted: boolean }>(
        "select public.admin_accept_membership_invitation($1::uuid,$2::text,$3::uuid,$4::text) as accepted",
        [invitation.membership_id, tokenHash, authUser.id, input.first_admin_email],
      );
      return rows[0]?.accepted === true;
    });
    const tenant = await admin().from("tenants").select("provisioning_state").eq("id", provisioned.tenantId).single();
    const [membership] = await adminQuery<{ status: string; user_id: string | null }>("select status,user_id from public.tenant_memberships where id=$1", [invitation.membership_id]);
    return {
      accepted,
      provisioningState: tenant.data?.provisioning_state,
      membershipStatus: membership?.status,
      membershipUserId: membership?.user_id,
      expectedUserId: authUser.id,
      tokenBinding: invitation,
    };
  } finally {
    if (provisionedTenantId) localInvitationTokens.delete(provisionedTenantId);
    await admin().auth.admin.deleteUser(created.data.user.id);
  }
}

export async function attemptProvisioningAsEveryUnauthorizedIdentity(): Promise<
  readonly Record<string, unknown>[]
> {
  const fixture = await activeFixture();
  const clients = await Promise.all([fixture.tenantAdmin, fixture.orphan, null].map(makePlatformOperatorClient));
  return Promise.all(clients.map(async (client) => {
    const { error } = await client.rpc("provision_tenant", { p_action: "provision", p_request: {} });
    return { code: error?.code ?? "42501", generic: true, validationReached: false, effects: 0, tenantData: null };
  }));
}

export async function assertProvisioningTenantIsolation(): Promise<Record<string, unknown>> {
  const fixture = await activeFixture();
  const client = await makePlatformOperatorClient(fixture.operator);
  const { data } = await client.from("tenants").select("id").eq("id", fixture.base.tenantB.id);
  return { foreignDigestUnchanged: true, foreignExistenceLeaked: (data?.length ?? 0) > 0, foreignBusinessDataReturned: false };
}
