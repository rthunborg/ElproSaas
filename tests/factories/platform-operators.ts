/**
 * Story 12.1 red-phase fixtures.
 *
 * Identity setup is executable against the local stack. Command adapters are
 * deliberately red seams: Story 12.1 implementation must connect them to the
 * approved command boundary before the skipped acceptance tests are activated.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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

function redDriver<T>(name: string): Promise<T> {
  return Promise.reject(
    new Error(
      `Story 12.1 RED: connect tests/factories/platform-operators.ts#${name} to the implemented provisioning command boundary`,
    ),
  );
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
  const digits = crypto.randomUUID().replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
  const stem = `556${digits}`;
  const organizationNumber = `${stem}${luhnCheckDigit(stem)}`;
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

export function executeApprovedProvisioning(
  _input: StrictProvisioningRequest,
  _options: Record<string, unknown> = {},
): Promise<ProvisioningResult> {
  void _input;
  void _options;
  return redDriver("executeApprovedProvisioning");
}

export function previewProvisioningForTest(
  _input: StrictProvisioningRequest,
): Promise<PreviewResult> {
  void _input;
  return redDriver("previewProvisioningForTest");
}

export function executeConcurrentProvisioning(
  _input: StrictProvisioningRequest,
): Promise<Record<string, unknown>> {
  void _input;
  return redDriver("executeConcurrentProvisioning");
}

export function retryFirstAdminInviteForTest(
  _options: Record<string, unknown>,
): Promise<RetryResult> {
  void _options;
  return redDriver("retryFirstAdminInviteForTest");
}

export function inspectProvisioningAuditForTest(): Promise<Record<string, unknown>> {
  return redDriver("inspectProvisioningAuditForTest");
}

export function attemptProvisioningAsEveryUnauthorizedIdentity(): Promise<
  readonly Record<string, unknown>[]
> {
  return redDriver("attemptProvisioningAsEveryUnauthorizedIdentity");
}

export function assertProvisioningTenantIsolation(): Promise<Record<string, unknown>> {
  return redDriver("assertProvisioningTenantIsolation");
}
