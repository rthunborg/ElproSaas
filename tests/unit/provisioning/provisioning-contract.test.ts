import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canMarkTenantProvisioningReady,
  canTransitionProvisioning,
  canonicalizeProvisioningRequest,
  createProvisioningPreview,
  decodeProvisioningRequest,
} from "@/server/commands/provisioning/validation";
import { PERMISSION_MATRIX } from "@/server/authz/permission-matrix";

function validRequest() {
  return {
    schema_version: 1, request_id: crypto.randomUUID(), legal_name: "Elpro AB",
    country_code: "SE", organization_number: "5561234567", first_admin_name: "Ada",
    first_admin_email: "ada@example.se", baseline_profile_id: "standard-se",
    baseline_profile_version: 1, subscription_plan_id: "pro", subscription_status: "active",
    included_user_count: 5, additional_user_price_ore: 12_500, contract_start_date: "2026-10-01",
  };
}

test("[P0] 12.1-UNIT-001 strictly allow-lists v1 fields and rejects unsupported schema, SQL, secrets, raw rates, pending modules, and deferred fields", () => {
  const input = validRequest();
  assert.throws(() => decodeProvisioningRequest({ ...input, schema_version: 2 }), /UNSUPPORTED_SCHEMA_VERSION/);
  for (const unsupported of [
    { arbitrary_sql: "select 1" }, { fortnox_client_secret: "must-not-be-retained" },
    { raw_vat_rate: 0.25 }, { pending_module_ids: ["supplier"] }, { deferred_logo_upload: "later" },
  ]) assert.throws(() => decodeProvisioningRequest({ ...input, ...unsupported }), /UNSUPPORTED_FIELD/);
});

test("[P0] 12.1-UNIT-002 canonicalizes Swedish organization/VAT/email identities and rejects personnummer, non-SE, bad checksums, mismatches, and invalid email syntax", () => {
  const input = { ...validRequest(), organization_number: "556 123-4567", vat_registration_number: " se556123456701 ", first_admin_email: " Ada+ops@EXAMPLE.SE " };
  assert.deepEqual(
    (({ normalizedOrganizationNumber, vatRegistrationNumber, firstAdminEmail }) => ({ normalizedOrganizationNumber, vatRegistrationNumber, firstAdminEmail }))(canonicalizeProvisioningRequest(input)),
    { normalizedOrganizationNumber: "5561234567", vatRegistrationNumber: "SE556123456701", firstAdminEmail: "ada+ops@example.se" },
  );
  for (const rejected of [
    { country_code: "NO", organization_number: "5561234567" }, { country_code: "SE", organization_number: "850101-1234" },
    { country_code: "SE", organization_number: "5561234568" }, { vat_registration_number: "SE556123456801" },
    { first_admin_email: "Ada Admin <ada@example.se>" }, { first_admin_email: "ada@example.se,other@example.se" },
  ]) assert.throws(() => canonicalizeProvisioningRequest({ ...input, ...rejected }));
});

test("[P0] 12.1-UNIT-003 permits only documented handoff states and ready's exact persisted predicate", () => {
  assert.equal(canTransitionProvisioning("pending_first_admin_invite", "first_admin_invite_unknown"), true);
  assert.equal(canTransitionProvisioning("pending_first_admin_invite", "invented_state"), false);
  const facts = { databaseCommitted: true, baselineRecorded: true, membershipActive: true, authUserId: crypto.randomUUID(), normalizedAuthEmail: "ada@example.se", normalizedInvitationEmail: "ada@example.se", unresolvedFailure: false };
  assert.equal(canMarkTenantProvisioningReady(facts), true);
  for (const incomplete of [{ databaseCommitted: false }, { baselineRecorded: false }, { membershipActive: false }, { authUserId: null }, { normalizedAuthEmail: "other@example.se" }, { unresolvedFailure: true }]) assert.equal(canMarkTenantProvisioningReady({ ...facts, ...incomplete }), false);
});

test("[P0] 12.1-UNIT-003 preview is hash-bound and declares its stateless zero-write boundary", () => {
  const preview = createProvisioningPreview(validRequest(), { id: "standard-se", version: 1, contentHash: "baseline-hash" });
  assert.equal(preview.writes, 0);
  assert.equal(preview.authCalls, 0);
  assert.equal(preview.proposed_action, "CREATE");
  assert.match(preview.preview_hash, /^[a-f0-9]{64}$/);
});

test("[P0] 12.1-UNIT-003 classifies Platform.Operator.Access without making it tenant-grantable", () => {
  assert.deepEqual(PERMISSION_MATRIX.provisioning["Platform.Operator.Access"], {
    roles: [], scope: "platform", tenantGrantable: false, tenantRoles: [],
  });
});
