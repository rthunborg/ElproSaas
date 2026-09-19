import { describe, expect, test } from "vitest";

const VALIDATION_MODULE =
  "../../../src/server/commands/provisioning/validation";

describe("tenant provisioning v1 contract — Story 12.1 ATDD", () => {
  test.skip("[P0] 12.1-UNIT-001 strictly allow-lists v1 fields and rejects unsupported schema, SQL, secrets, raw rates, pending modules, and deferred fields", async () => {
    const { decodeProvisioningRequest } = await import(VALIDATION_MODULE);
    const validRequest = {
      schema_version: 1,
      request_id: crypto.randomUUID(),
      legal_name: "Elpro AB",
      country_code: "SE",
      organization_number: "5561234567",
      vat_registration_number: "SE556123456701",
      first_admin_name: "Ada",
      first_admin_email: "ada@example.se",
      baseline_profile_id: "standard-se",
      baseline_profile_version: 1,
      subscription_plan_id: "pro",
      subscription_status: "active",
      included_user_count: 5,
      additional_user_price_ore: 12_500,
      contract_start_date: "2026-10-01",
    };

    expect(() =>
      decodeProvisioningRequest({ ...validRequest, schema_version: 2 }),
    ).toThrow(/UNSUPPORTED_SCHEMA_VERSION/);

    for (const unsupported of [
      { arbitrary_sql: "select 1" },
      { fortnox_client_secret: "must-not-be-retained" },
      { raw_vat_rate: 0.25 },
      { pending_module_ids: ["supplier"] },
      { deferred_logo_upload: "later" },
    ]) {
      expect(() =>
        decodeProvisioningRequest({ ...validRequest, ...unsupported }),
      ).toThrow(/UNSUPPORTED_FIELD/);
    }
  });

  test.skip("[P0] 12.1-UNIT-002 canonicalizes Swedish organization/VAT/email identities and rejects personnummer, non-SE, bad checksums, mismatches, and invalid email syntax", async () => {
    const { canonicalizeProvisioningRequest } = await import(
      VALIDATION_MODULE
    );
    const input = {
      schema_version: 1,
      request_id: crypto.randomUUID(),
      legal_name: "Elpro AB",
      country_code: "SE",
      organization_number: "556 123-4567",
      vat_registration_number: " se556123456701 ",
      first_admin_name: "Ada",
      first_admin_email: " Ada+ops@EXAMPLE.SE ",
      baseline_profile_id: "standard-se",
      baseline_profile_version: 1,
      subscription_plan_id: "pro",
      subscription_status: "active",
      included_user_count: 5,
      additional_user_price_ore: 12_500,
      contract_start_date: "2026-10-01",
    };

    expect(canonicalizeProvisioningRequest(input)).toMatchObject({
      normalizedOrganizationNumber: "5561234567",
      vatRegistrationNumber: "SE556123456701",
      firstAdminEmail: "ada+ops@example.se",
    });

    for (const rejected of [
      { country_code: "NO", organization_number: "5561234567" },
      { country_code: "SE", organization_number: "850101-1234" },
      { country_code: "SE", organization_number: "5561234568" },
      { vat_registration_number: "SE556123456801" },
      { first_admin_email: "Ada Admin <ada@example.se>" },
      { first_admin_email: "ada@example.se,other@example.se" },
    ]) {
      expect(() =>
        canonicalizeProvisioningRequest({ ...input, ...rejected }),
      ).toThrow();
    }
  });

  test.skip("[P0] 12.1-UNIT-003 permits only documented handoff states and ready's exact persisted predicate", async () => {
    const { canTransitionProvisioning, canMarkTenantProvisioningReady } =
      await import(VALIDATION_MODULE);

    expect(
      canTransitionProvisioning(
        "pending_first_admin_invite",
        "first_admin_invite_unknown",
      ),
    ).toBe(true);
    expect(
      canTransitionProvisioning(
        "pending_first_admin_invite",
        "invented_state",
      ),
    ).toBe(false);

    const readyFacts = {
      databaseCommitted: true,
      baselineRecorded: true,
      membershipActive: true,
      authUserId: crypto.randomUUID(),
      normalizedAuthEmail: "ada@example.se",
      normalizedInvitationEmail: "ada@example.se",
      unresolvedFailure: false,
    };
    expect(canMarkTenantProvisioningReady(readyFacts)).toBe(true);

    for (const incomplete of [
      { databaseCommitted: false },
      { baselineRecorded: false },
      { membershipActive: false },
      { authUserId: null },
      { normalizedAuthEmail: "other@example.se" },
      { unresolvedFailure: true },
    ]) {
      expect(
        canMarkTenantProvisioningReady({ ...readyFacts, ...incomplete }),
      ).toBe(false);
    }
  });
});
