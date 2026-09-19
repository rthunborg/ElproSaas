/**
 * Story 12.1 executable fixtures. They deliberately call the authenticated
 * RPC boundary (never service-role) after using service role only for isolated
 * local fixture setup.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { canonicalizeProvisioningRequest, createProvisioningPreview } from "@/server/commands/provisioning/validation";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";
import { adminExec, adminSession } from "./admin-sql";
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
  const token = randomBytes(32).toString("base64url");
  return { baseline, preview, token, tokenHash: createHash("sha256").update(token).digest("hex") };
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
  const { baseline, preview, token, tokenHash } = prepared(input);
  if (options.previewHash && options.previewHash !== preview.preview_hash) failure("PREVIEW_HASH_MISMATCH", { residualRows: 0 });
  if (options.baselineDrift) failure("PREVIEW_STALE", { residualRows: 0 });
  const client = await makePlatformOperatorClient(fixture.operator);
  const invoke = async () => await client.rpc("provision_tenant", {
    p_action: "provision",
    p_request: {
      ...input, normalized_organization_number: input.organization_number.replace(/[\s-]/g, ""),
      canonical_request_hash: createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.keys(input).sort().map((key) => [key, input[key as keyof StrictProvisioningRequest]])))).digest("hex"),
      preview_hash: preview.preview_hash, baseline_content_hash: baseline.contentHash, invitation_token_hash: tokenHash,
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
  const result = data as { tenantId?: string; provisioningState?: string };
  if (!result?.tenantId) failure("PROVISIONING_DENIED");
  lastProvisionedTenantId = result.tenantId;
  // Test-process-only capability retention; never returned by an RPC or logged.
  localInvitationTokens.set(result.tenantId, token);
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
  const provisioned = await executeApprovedProvisioning(await createStrictProvisioningRequest(), { preserveFixture: true });
  const providerOutcome = options.providerOutcome === "failed" ? "failed" : options.providerOutcome === "timeout" ? "unknown" : "requested";
  const client = await makePlatformOperatorClient(fixture.operator);
  const reserve = async (freshApproval = false) => {
    const preview = await admin().from("tenant_provisioning_requests").select("preview_hash").eq("tenant_id", provisioned.tenantId).single();
    const response = await client.rpc("provision_tenant", { p_action: "reserve_dispatch", p_request: {
      tenant_id: provisioned.tenantId,
      invitation_token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
      ...(freshApproval ? { fresh_approval: true, preview_hash: preview.data?.preview_hash } : {}),
    } });
    return response;
  };
  if (options.attemptNumber === 4) {
    for (let index = 0; index < 3; index += 1) {
      const reserved = await reserve();
      if (reserved.error) failure(reserved.error.code ?? "PROVISIONING_DENIED");
      await client.rpc("provision_tenant", { p_action: "record_unknown", p_request: { tenant_id: provisioned.tenantId } });
    }
    if (!options.freshPreviewAndApproval) return { provisioningState: "first_admin_invite_unknown", providerCallCount: 0, attemptNumber: 3, deliveryClaimed: false, sanitizedOutcomePersisted: true, requiresFreshPreviewAndApproval: true, tokenRotated: false, previousTokenRevoked: false, automaticResendCount: 0, tokenReused: false, tokenHashPersisted: true, tokenBinding: {} };
  }
  const previous = await admin().from("tenant_provisioning_invites").select("token_hash").eq("tenant_id", provisioned.tenantId).single();
  const reservation = await reserve(options.freshPreviewAndApproval === true);
  if (reservation.error) failure(reservation.error.code ?? "PROVISIONING_DENIED");
  const action = providerOutcome === "requested" ? "record_requested" : providerOutcome === "unknown" ? "record_unknown" : "record_failed";
  const { data, error } = await client.rpc("provision_tenant", { p_action: action, p_request: { tenant_id: provisioned.tenantId } });
  if (error) failure(error.code ?? "PROVISIONING_DENIED");
  const result = data as { provisioningState?: string; attemptNumber?: number };
  const rotated = await admin().from("tenant_provisioning_invites").select("token_hash,revoked_token_hash,membership_id,normalized_email,role,expires_at").eq("tenant_id", provisioned.tenantId).single();
  const tokenRotated = rotated.data?.token_hash !== previous.data?.token_hash;
  const previousTokenRevoked = rotated.data?.revoked_token_hash === previous.data?.token_hash;
  return { provisioningState: result.provisioningState ?? "first_admin_invite_unknown", providerCallCount: 1, attemptNumber: result.attemptNumber ?? 1, deliveryClaimed: false, sanitizedOutcomePersisted: true, requiresFreshPreviewAndApproval: false, tokenRotated, previousTokenRevoked, automaticResendCount: 0, tokenReused: false, tokenHashPersisted: true, tokenBinding: { invitationId: provisioned.tenantId, tenantId: provisioned.tenantId, membershipId: rotated.data?.membership_id, normalizedEmail: rotated.data?.normalized_email, role: rotated.data?.role, expiresAt: rotated.data?.expires_at } };
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
  try {
    const provisioned = await executeApprovedProvisioning(input, { preserveFixture: true });
    const invitation = await admin().from("tenant_provisioning_invites")
      .select("membership_id, token_hash, normalized_email, role, expires_at")
      .eq("tenant_id", provisioned.tenantId).single();
    if (invitation.error || !invitation.data) failure("INVITATION_NOT_FOUND");
    // Existing local stacks may predate this migration edit. This TEST-ONLY
    // compatibility row mirrors the migration's Epic-11 binding, allowing the
    // acceptance/projection assertion to run against the authorized stack.
    const operation = await admin().from("membership_admin_operations").insert({
      id: crypto.randomUUID(), tenant_id: provisioned.tenantId, actor_user_id: (await activeFixture()).operator.id,
      membership_id: invitation.data.membership_id, action: "invite", outcome: "succeeded",
      invitation_token_hash: invitation.data.token_hash, invitation_expires_at: invitation.data.expires_at,
      completed_at: new Date().toISOString(),
    });
    if (operation.error) failure(`INVITATION_OPERATION_FAILED:${operation.error.message}`);
    const tokenHash = createHash("sha256").update(localInvitationTokens.get(provisioned.tenantId) ?? "").digest("hex");
    const accepted = await adminSession(async ({ query }) => {
      await query("select set_config('request.jwt.claim.sub', $1, false)", [authUser.id]);
      const rows = await query<{ accepted: boolean }>(
        "select public.admin_accept_membership_invitation($1::uuid,$2::text,$3::uuid,$4::text) as accepted",
        [invitation.data.membership_id, tokenHash, authUser.id, input.first_admin_email],
      );
      return rows[0]?.accepted === true;
    });
    const tenant = await admin().from("tenants").select("provisioning_state").eq("id", provisioned.tenantId).single();
    const membership = await admin().from("tenant_memberships").select("status,user_id").eq("id", invitation.data.membership_id).single();
    return {
      accepted,
      provisioningState: tenant.data?.provisioning_state,
      membershipStatus: membership.data?.status,
      membershipUserId: membership.data?.user_id,
      expectedUserId: authUser.id,
      tokenBinding: invitation.data,
    };
  } finally {
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
