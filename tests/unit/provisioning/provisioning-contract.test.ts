import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canMarkTenantProvisioningReady,
  canReserveProvisioningDispatch,
  canTransitionProvisioning,
  canonicalizeProvisioningRequest,
  createProvisioningPreview,
  decodeProvisioningRequest,
  normalizeSwedishOrganizationNumber,
} from "@/server/commands/provisioning/validation";
import { PERMISSION_MATRIX } from "@/server/authz/permission-matrix";
import {
  canonicalProvisioningAttestationBytes,
  signProvisioningAttestation,
  verifyProvisioningAttestation,
} from "@/server/provisioning/attestation";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";
import { provisioningCommandTestHooks } from "@/server/commands/provisioning/provision-tenant";

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
    { country_code: "NO", organization_number: "5561234567" }, { country_code: "SE", organization_number: "850101-1236" },
    { country_code: "SE", organization_number: "5561234568" }, { vat_registration_number: "SE556123456801" },
    { first_admin_email: "Ada Admin <ada@example.se>" }, { first_admin_email: "ada@example.se,other@example.se" },
    { first_admin_email: "ada@example.se/path" }, { first_admin_email: "ada@example.se:443" },
  ]) assert.throws(() => canonicalizeProvisioningRequest({ ...input, ...rejected }));
});

test("[P0] 12.1-UNIT-002 uses the Swedish third-digit discriminator without treating later organisation digits as a date", () => {
  assert.equal(normalizeSwedishOrganizationNumber("556 000-0001"), "5560000001");
  assert.equal(normalizeSwedishOrganizationNumber("556 677-0003"), "5566770003");
  assert.equal(normalizeSwedishOrganizationNumber("850101-1236"), null);
  assert.equal(normalizeSwedishOrganizationNumber("850215-1239"), null);
});

test("[P0] 12.1-UNIT-002 rejects coercible primitives and permits only the v1 nested request shapes", () => {
  const input = validRequest();
  for (const invalid of [
    { request_id: 42 }, { legal_name: true }, { baseline_profile_version: "1" },
    { included_user_count: 1.5 }, { additional_user_price_ore: -1 }, { contract_start_date: "2026-02-30" },
    { primary_email: "Ada <ada@example.se>" }, { address: [] }, { address: { unknown: "no" } },
    { commercial_overrides: { nested: { discount: 1 } } }, { module_ids: ["suppliers"] }, { feature_flags: ["beta"] },
  ]) assert.throws(() => canonicalizeProvisioningRequest({ ...input, ...invalid }));

  const canonical = canonicalizeProvisioningRequest({
    ...input,
    organization_number: "556 123-4567", first_admin_email: " Ada@EXAMPLE.SE ",
    address: { address_line1: "Storgatan 1", postal_code: "111 22", city: "Stockholm" },
    commercial_overrides: { agreed_discount_ore: 5000, special_terms: "Annual prepay" },
    module_ids: ["settings", "quotes"], feature_flags: [],
  });
  assert.deepEqual(canonical.address, { address_line1: "Storgatan 1", postal_code: "111 22", city: "Stockholm" });
  assert.equal(canonical.organization_number, "5561234567");
  assert.equal(canonical.first_admin_email, "ada@example.se");

  const first = canonicalizeProvisioningRequest({
    ...input,
    address: { city: "Stockholm", postal_code: "111 22", address_line1: "Storgatan 1" },
    commercial_overrides: { special_terms: "Annual prepay", agreed_discount_ore: 5000 },
  });
  const second = canonicalizeProvisioningRequest({
    ...input,
    address: { address_line1: "Storgatan 1", postal_code: "111 22", city: "Stockholm" },
    commercial_overrides: { agreed_discount_ore: 5000, special_terms: "Annual prepay" },
  });
  assert.equal(first.canonicalRequestHash, second.canonicalRequestHash);
});

test("[P0] 12.1-UNIT-003 permits only documented handoff states and ready's exact persisted predicate", () => {
  assert.equal(canTransitionProvisioning("pending_first_admin_invite", "first_admin_invite_unknown"), true);
  assert.equal(canTransitionProvisioning("pending_first_admin_invite", "invented_state"), false);
  const facts = { databaseCommitted: true, baselineRecorded: true, membershipActive: true, authUserId: crypto.randomUUID(), normalizedAuthEmail: "ada@example.se", normalizedInvitationEmail: "ada@example.se", unresolvedFailure: false };
  assert.equal(canMarkTenantProvisioningReady(facts), true);
  for (const incomplete of [{ databaseCommitted: false }, { baselineRecorded: false }, { membershipActive: false }, { authUserId: null }, { normalizedAuthEmail: "other@example.se" }, { unresolvedFailure: true }]) assert.equal(canMarkTenantProvisioningReady({ ...facts, ...incomplete }), false);
});

test("[P0] 12.1-UNIT-003 limits a preview approval to three dispatches and requires fresh approval for dispatch four", () => {
  assert.equal(canReserveProvisioningDispatch(0, false), true);
  assert.equal(canReserveProvisioningDispatch(2, false), true);
  assert.equal(canReserveProvisioningDispatch(3, false), false);
  assert.equal(canReserveProvisioningDispatch(3, true), true);
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

test("[P0] 12.1-UNIT-003 binds the provisioning attestation to actor, action, generation, and expiry", () => {
  const proof = {
    action: "reserve_dispatch", actorUserId: "00000000-0000-0000-0000-000000000001",
    requestId: "00000000-0000-0000-0000-000000000002", requestHash: "a".repeat(64), organizationNumber: "5561234567",
    previewHash: "b".repeat(64), firstAdminEmail: "ada@example.se", explicitApproval: true,
    baselineId: "standard-se", baselineVersion: 1, baselineContentHash: "c".repeat(64),
    tokenHash: "d".repeat(64), reservationId: "00000000-0000-0000-0000-000000000003", dispatchGeneration: 2,
    approvalGeneration: 1, outcome: "", keyId: "test_v1", issuedAt: "2026-09-19T10:00:00.000Z", expiresAt: "2026-09-19T10:02:00.000Z",
  } as const;
  const secret = "local-test-only-provisioning-attestation-secret-v1";
  const signature = signProvisioningAttestation(proof, secret);
  assert.ok(verifyProvisioningAttestation(proof, secret, signature));
  assert.ok(!verifyProvisioningAttestation({ ...proof, dispatchGeneration: 3 }, secret, signature));
  assert.ok(!verifyProvisioningAttestation({ ...proof, explicitApproval: false }, secret, signature));
  assert.notDeepEqual(canonicalProvisioningAttestationBytes(proof), canonicalProvisioningAttestationBytes({ ...proof, outcome: "unknown" }));
});

test("[P0] 12.1-UNIT-003 maps only documented RPC errors and rejects malformed durable retry facts", () => {
  assert.deepEqual(provisioningCommandTestHooks.documentedRpcFailure({ message: "PREVIEW_STALE" }), { ok: false, code: "PREVIEW_STALE" });
  assert.deepEqual(provisioningCommandTestHooks.documentedRpcFailure({ message: "database internals" }), { ok: false, code: "PROVISIONING_DENIED" });

  const tenantId = "00000000-0000-4000-8000-000000000001";
  const facts = {
    tenantId, requestId: "00000000-0000-4000-8000-000000000002", requestHash: "a".repeat(64),
    organizationNumber: "5561234567", previewHash: "b".repeat(64), baselineId: "standard-se",
    baselineVersion: 1, baselineContentHash: "c".repeat(64), approvalGeneration: 1, dispatchGeneration: 1,
  };
  assert.deepEqual(provisioningCommandTestHooks.durableRetryFacts(facts, tenantId), facts);
  assert.equal(provisioningCommandTestHooks.durableRetryFacts({ ...facts, requestHash: "not-a-hash" }, tenantId), null);
});

test("[P0] 12.1-UNIT-003 recognizes only a complete outstanding reservation for unknown reconciliation", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const facts = {
    tenantId, requestId: "00000000-0000-4000-8000-000000000002", requestHash: "a".repeat(64),
    organizationNumber: "5561234567", previewHash: "b".repeat(64), baselineId: "standard-se",
    baselineVersion: 1, baselineContentHash: "c".repeat(64), approvalGeneration: 1, dispatchGeneration: 1,
  };
  const outstanding = {
    ...facts, reservationId: "00000000-0000-4000-8000-000000000003", reservationOutcome: null,
    reservationDispatchGeneration: 1, reservationApprovalGeneration: 1, tokenHash: "d".repeat(64),
  };
  assert.deepEqual(provisioningCommandTestHooks.outstandingReservation(outstanding, facts), {
    reservationId: outstanding.reservationId, dispatchGeneration: 1, approvalGeneration: 1, tokenHash: outstanding.tokenHash,
  });
  assert.equal(provisioningCommandTestHooks.outstandingReservation({ ...outstanding, tokenHash: "bad" }, facts), null);
  assert.equal(provisioningCommandTestHooks.outstandingReservation({ ...outstanding, reservationOutcome: "requested" }, facts), null);
});

test("[P0] 12.1-UNIT-003 sends first-admin Auth callbacks to the configured public origin and retains the reserved membership attempt", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const previousAppUrl = environment.NEXT_PUBLIC_APP_URL;
  const previousNodeEnv = environment.NODE_ENV;
  environment.NEXT_PUBLIC_APP_URL = "https://app.example.test/";
  environment.NODE_ENV = "production";
  const reservation = {
    tenantId: "00000000-0000-4000-8000-000000000030", requestId: "00000000-0000-4000-8000-000000000031",
    requestHash: "a".repeat(64), organizationNumber: "5561234567", previewHash: "b".repeat(64), baselineId: "standard-se",
    baselineVersion: 1, baselineContentHash: "c".repeat(64), approvalGeneration: 1, dispatchGeneration: 1,
    normalizedEmail: "ada@example.se", membershipId: "member id", reservationId: "00000000-0000-4000-8000-000000000032",
  };
  try {
    let callbackUrl = "";
    const outcome = await provisioningCommandTestHooks.deliverInvitation(reservation, "attempt/value", (dependencies) => ({
      invite: async () => {
        const prepared = await dependencies.prepareInvite();
        const callback = new URL(dependencies.invitationRedirectBase);
        callback.searchParams.set("membershipId", prepared.membershipId);
        callback.searchParams.set("attempt", prepared.attemptToken);
        callbackUrl = callback.toString();
        return { outcome: "succeeded" };
      },
    }));
    assert.equal(outcome, "requested");
    const callback = new URL(callbackUrl);
    assert.equal(callback.origin, "https://app.example.test");
    assert.equal(callback.pathname, "/auth/invite/confirm");
    assert.equal(callback.searchParams.get("membershipId"), reservation.membershipId);
    assert.equal(callback.searchParams.get("attempt"), "attempt/value");
  } finally {
    if (previousAppUrl === undefined) delete environment.NEXT_PUBLIC_APP_URL;
    else environment.NEXT_PUBLIC_APP_URL = previousAppUrl;
    if (previousNodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousNodeEnv;
  }
});

test("[P0] 12.1-UNIT-003 refuses first-admin provider delivery without a production app origin", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const previousAppUrl = environment.NEXT_PUBLIC_APP_URL;
  const previousNodeEnv = environment.NODE_ENV;
  delete environment.NEXT_PUBLIC_APP_URL;
  environment.NODE_ENV = "production";
  const reservation = {
    tenantId: "00000000-0000-4000-8000-000000000040", requestId: "00000000-0000-4000-8000-000000000041",
    requestHash: "a".repeat(64), organizationNumber: "5561234567", previewHash: "b".repeat(64), baselineId: "standard-se",
    baselineVersion: 1, baselineContentHash: "c".repeat(64), approvalGeneration: 1, dispatchGeneration: 1,
    normalizedEmail: "ada@example.se", membershipId: "00000000-0000-4000-8000-000000000042", reservationId: "00000000-0000-4000-8000-000000000043",
  };
  try {
    const outcome = await provisioningCommandTestHooks.deliverInvitation(reservation, "attempt", () => {
      throw new Error("the Auth provider must not be constructed");
    });
    assert.equal(outcome, "unknown");
  } finally {
    if (previousAppUrl === undefined) delete environment.NEXT_PUBLIC_APP_URL;
    else environment.NEXT_PUBLIC_APP_URL = previousAppUrl;
    if (previousNodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousNodeEnv;
  }
});

test("[P0] 12.1-UNIT-004 executes the approved production command through its created-only reservation, provider, and outcome sequence", async () => {
  const input = validRequest();
  const canonical = canonicalizeProvisioningRequest(input);
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  assert.ok(baseline);
  const preview = createProvisioningPreview(input, baseline);
  const tenantId = "00000000-0000-4000-8000-000000000010";
  const actorUserId = "00000000-0000-4000-8000-000000000011";
  const calls: Array<{ action: string; payload: Record<string, unknown> }> = [];
  let providerOutcome: "requested" | "failed" | "unknown" = "requested";
  const previousKeyId = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
  const previousSecret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = "test_v1";
  process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = "local-test-only-provisioning-attestation-secret-v1";
  try {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: actorUserId } }, error: null }) },
      rpc: async (_name: string, args: { p_action: string; p_request: Record<string, unknown> }) => {
        calls.push({ action: args.p_action, payload: args.p_request });
        if (args.p_action === "provision") return { data: { tenantId, reconciliationAction: "created" }, error: null };
        if (args.p_action === "reconcile") return {
          data: {
            tenantId, requestId: canonical.request_id, requestHash: canonical.canonicalRequestHash,
            organizationNumber: canonical.normalizedOrganizationNumber, previewHash: preview.preview_hash,
            baselineId: baseline.id, baselineVersion: baseline.version, baselineContentHash: baseline.contentHash,
            approvalGeneration: 1, dispatchGeneration: 0,
          }, error: null,
        };
        if (args.p_action === "reserve_dispatch") return {
          data: {
            tenantId, normalizedEmail: canonical.firstAdminEmail,
            membershipId: "00000000-0000-4000-8000-000000000012",
            reservationId: "00000000-0000-4000-8000-000000000013",
            dispatchGeneration: 1,
          }, error: null,
        };
        if (args.p_action === "record_requested") return { data: { provisioningState: "first_admin_invite_requested" }, error: null };
        throw new Error(`unexpected action ${args.p_action}`);
      },
    };
    const result = await provisioningCommandTestHooks.provisionTenantWithDependencies(
      { request: input, previewHash: preview.preview_hash, explicitApproval: true },
      {
        client: client as never,
        deliverInvitation: async (reservation, rawToken) => {
          assert.equal(reservation.normalizedEmail, canonical.firstAdminEmail);
          assert.match(rawToken, /^[A-Za-z0-9_-]+$/);
          return providerOutcome;
        },
      },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(calls.map(({ action }) => action), ["provision", "reconcile", "reserve_dispatch", "record_requested"]);
    assert.equal(calls[0]?.payload.explicit_approval, true);
    assert.equal(calls[0]?.payload.preview_hash, preview.preview_hash);
    assert.match(String(calls[2]?.payload.token_hash), /^[a-f0-9]{64}$/);
    for (const outcome of ["failed", "unknown"] as const) {
      providerOutcome = outcome;
      calls.length = 0;
      const remapped = await provisioningCommandTestHooks.provisionTenantWithDependencies(
        { request: input, previewHash: preview.preview_hash, explicitApproval: true },
        { client: client as never, deliverInvitation: async () => providerOutcome },
      );
      assert.equal(remapped.ok, true);
      assert.deepEqual(calls.map(({ action }) => action), ["provision", "reconcile", "reserve_dispatch", `record_${outcome}`]);
    }
  } finally {
    if (previousKeyId === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
    else process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = previousKeyId;
    if (previousSecret === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
    else process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = previousSecret;
  }
});

test("[P0] 12.1-UNIT-005 leaves idempotent replays provider-free", async () => {
  const input = validRequest();
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  assert.ok(baseline);
  const preview = createProvisioningPreview(input, baseline);
  const previousKeyId = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
  const previousSecret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = "test_v1";
  process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = "local-test-only-provisioning-attestation-secret-v1";
  try {
    const calls: string[] = [];
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000015" } }, error: null }) },
      rpc: async (_name: string, args: { p_action: string }) => {
        calls.push(args.p_action);
        return { data: { tenantId: "00000000-0000-4000-8000-000000000016", reconciliationAction: "observed" }, error: null };
      },
    };
    const result = await provisioningCommandTestHooks.provisionTenantWithDependencies(
      { request: input, previewHash: preview.preview_hash, explicitApproval: true },
      { client: client as never, deliverInvitation: async () => { throw new Error("a replay must not dispatch"); } },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["provision"]);
  } finally {
    if (previousKeyId === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
    else process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = previousKeyId;
    if (previousSecret === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
    else process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = previousSecret;
  }
});

test("[P0] 12.1-UNIT-005 returns a sanitized already-provisioned identity without provider work", async () => {
  const input = validRequest();
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  assert.ok(baseline);
  const preview = createProvisioningPreview(input, baseline);
  const tenantId = "00000000-0000-4000-8000-000000000017";
  const previousKeyId = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
  const previousSecret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = "test_v1";
  process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = "local-test-only-provisioning-attestation-secret-v1";
  try {
    let calls = 0;
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000018" } }, error: null }) },
      rpc: async () => {
        calls += 1;
        return { data: { resultCode: "ALREADY_PROVISIONED", tenantId, provisioningState: "first_admin_invite_requested" }, error: null };
      },
    };
    assert.deepEqual(
      await provisioningCommandTestHooks.provisionTenantWithDependencies(
        { request: input, previewHash: preview.preview_hash, explicitApproval: true },
        { client: client as never, deliverInvitation: async () => { throw new Error("must not deliver"); } },
      ),
      { ok: false, code: "ALREADY_PROVISIONED", tenantId, provisioningState: "first_admin_invite_requested" },
    );
    assert.equal(calls, 1);
  } finally {
    if (previousKeyId === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
    else process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = previousKeyId;
    if (previousSecret === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
    else process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = previousSecret;
  }
});

test("[P0] 12.1-UNIT-006 rejects unapproved or stale command envelopes before the provisioning RPC", async () => {
  const input = validRequest();
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  assert.ok(baseline);
  const preview = createProvisioningPreview(input, baseline);
  let calls = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000014" } }, error: null }) },
    rpc: async () => { calls += 1; return { data: null, error: null }; },
  };
  const dependencies = { client: client as never, deliverInvitation: async () => "requested" as const };
  assert.deepEqual(
    await provisioningCommandTestHooks.provisionTenantWithDependencies(
      { request: input, previewHash: preview.preview_hash, explicitApproval: false }, dependencies,
    ),
    { ok: false, code: "PROVISIONING_DENIED" },
  );
  assert.deepEqual(
    await provisioningCommandTestHooks.provisionTenantWithDependencies(
      { request: input, previewHash: "f".repeat(64), explicitApproval: true }, dependencies,
    ),
    { ok: false, code: "PROVISIONING_DENIED" },
  );
  assert.equal(calls, 0);
});

test("[P0] 12.1-UNIT-007 records a durable outstanding reservation as unknown without a fresh reservation or provider delivery", async () => {
  const tenantId = "00000000-0000-4000-8000-000000000020";
  const calls: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000021" } }, error: null }) },
    rpc: async (_name: string, args: { p_action: string }) => {
      calls.push(args.p_action);
      if (args.p_action === "reconcile") {
        return {
          data: {
            tenantId, requestId: "00000000-0000-4000-8000-000000000022", requestHash: "a".repeat(64),
            organizationNumber: "5561234567", previewHash: "b".repeat(64), baselineId: "standard-se",
            baselineVersion: 1, baselineContentHash: "c".repeat(64), approvalGeneration: 1, dispatchGeneration: 1,
            reservationId: "00000000-0000-4000-8000-000000000023", reservationOutcome: null,
            reservationDispatchGeneration: 1, reservationApprovalGeneration: 1, tokenHash: "d".repeat(64),
          },
          error: null,
        };
      }
      if (args.p_action === "record_unknown") return { data: { provisioningState: "first_admin_invite_unknown" }, error: null };
      throw new Error(`unexpected action ${args.p_action}`);
    },
  };

  const previousKeyId = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
  const previousSecret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = "test_v1";
  process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = "local-test-only-provisioning-attestation-secret-v1";
  try {
    assert.deepEqual(
      await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies(
        { tenantId },
        { client: client as never, deliverInvitation: async () => { throw new Error("must not deliver an outstanding reservation"); } },
      ),
      { ok: true, result: { provisioningState: "first_admin_invite_unknown" } },
    );
    assert.deepEqual(calls, ["reconcile", "record_unknown"]);
  } finally {
    if (previousKeyId === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
    else process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = previousKeyId;
    if (previousSecret === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
    else process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = previousSecret;
  }
});

test("[P0] 12.1-UNIT-008 rejects missing or content-mismatched fresh renewal at dispatch generation three before reservation or provider delivery", async () => {
  const input = validRequest();
  const canonical = canonicalizeProvisioningRequest(input);
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  assert.ok(baseline);
  const preview = createProvisioningPreview(input, baseline);
  const tenantId = "00000000-0000-4000-8000-000000000024";
  const calls: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000025" } }, error: null }) },
    rpc: async (_name: string, args: { p_action: string }) => {
      calls.push(args.p_action);
      if (args.p_action !== "reconcile") throw new Error(`unexpected action ${args.p_action}`);
      return {
        data: {
          tenantId, requestId: canonical.request_id, requestHash: canonical.canonicalRequestHash,
          organizationNumber: canonical.normalizedOrganizationNumber, previewHash: preview.preview_hash,
          baselineId: baseline.id, baselineVersion: baseline.version, baselineContentHash: baseline.contentHash,
          approvalGeneration: 1, dispatchGeneration: 3,
        },
        error: null,
      };
    },
  };
  const dependencies = {
    client: client as never,
    deliverInvitation: async () => { throw new Error("must not deliver before a fresh approved renewal"); },
  };

  const missing = await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId }, dependencies);
  assert.deepEqual(missing, { ok: false, code: "PREVIEW_STALE" });
  assert.deepEqual(calls, ["reconcile"]);

  calls.length = 0;
  const mismatched = await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies(
    { tenantId, renewal: { expectedApprovalGeneration: 1, request: { ...input, legal_name: "Changed legal name" }, previewHash: preview.preview_hash } },
    dependencies,
  );
  assert.deepEqual(mismatched, { ok: false, code: "PREVIEW_STALE" });
  assert.deepEqual(calls, ["reconcile"]);
});

for (const scenario of ["fourth dispatch", "expired invitation"] as const) {
  test(`[P0] PR72 valid approved ${scenario} reserves once and rejects a consumed generation`, async () => {
    const input = validRequest();
    const canonical = canonicalizeProvisioningRequest(input);
    const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version)!;
    const preview = createProvisioningPreview(input, baseline);
    const tenantId = crypto.randomUUID();
    const calls: string[] = [];
    let approvalGeneration = 1;
    let providerCalls = 0;
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: crypto.randomUUID() } }, error: null }) },
      rpc: async (_name: string, args: { p_action: string; p_request: Record<string, unknown> }) => {
        calls.push(args.p_action);
        if (args.p_action === "reconcile") return { data: {
          tenantId, requestId: input.request_id, requestHash: canonical.canonicalRequestHash, organizationNumber: canonical.normalizedOrganizationNumber,
          previewHash: preview.preview_hash, baselineId: baseline.id, baselineVersion: baseline.version, baselineContentHash: baseline.contentHash,
          approvalGeneration, dispatchGeneration: scenario === "fourth dispatch" ? 3 : 1, invitationExpired: scenario === "expired invitation",
        }, error: null };
        if (args.p_action === "reserve_dispatch") {
          assert.equal(args.p_request.explicit_approval, true);
          assert.equal((args.p_request.attestation as { approvalGeneration: number }).approvalGeneration, 2);
          approvalGeneration = 2;
          return { data: { tenantId, normalizedEmail: canonical.firstAdminEmail, membershipId: crypto.randomUUID(), reservationId: crypto.randomUUID(), dispatchGeneration: 1 }, error: null };
        }
        assert.equal(args.p_action, "record_requested");
        return { data: { tenantId, provisioningState: "first_admin_invite_requested" }, error: null };
      },
    };
    const oldKey = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
    const oldSecret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
    process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = "test_v1";
    process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = "local-test-only-provisioning-attestation-secret-v1";
    try {
      const dependencies = { client: client as never, deliverInvitation: async () => { providerCalls++; return "requested" as const; } };
      assert.deepEqual(await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId }, dependencies), { ok: false, code: "PREVIEW_STALE" });
      calls.length = 0;
      const renewal = { request: input, previewHash: preview.preview_hash, expectedApprovalGeneration: 1 };
      assert.equal((await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId, renewal }, dependencies)).ok, true);
      assert.deepEqual(calls, ["reconcile", "reserve_dispatch", "record_requested"]);
      assert.equal(providerCalls, 1);
      assert.deepEqual(await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId, renewal }, dependencies), { ok: false, code: "PREVIEW_STALE" });
      assert.equal(providerCalls, 1);
    } finally {
      if (oldKey === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID; else process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = oldKey;
      if (oldSecret === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET; else process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = oldSecret;
    }
  });
}

test("[P0] PR72 post-commit handoff failure preserves created tenant and reports recovery", async () => {
  const input = validRequest();
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version)!;
  const preview = createProvisioningPreview(input, baseline);
  const canonical = canonicalizeProvisioningRequest(input);
  const tenantId = crypto.randomUUID();
  const oldKey = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
  const oldSecret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = "test_v1";
  process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = "local-test-only-provisioning-attestation-secret-v1";
  try {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: crypto.randomUUID() } }, error: null }) },
      rpc: async (_name: string, args: { p_action: string }) => {
        if (args.p_action === "provision") return { data: { tenantId, reconciliationAction: "created", provisioningState: "pending_first_admin_invite" }, error: null };
        if (args.p_action === "reconcile") return { data: {
          tenantId, requestId: input.request_id, requestHash: canonical.canonicalRequestHash, organizationNumber: canonical.normalizedOrganizationNumber,
          previewHash: preview.preview_hash, baselineId: baseline.id, baselineVersion: baseline.version, baselineContentHash: baseline.contentHash,
          approvalGeneration: 1, dispatchGeneration: 0,
        }, error: null };
        assert.equal(args.p_action, "reserve_dispatch");
        return { data: null, error: { message: "transient reservation failure" } };
      },
    };
    const result = await provisioningCommandTestHooks.provisionTenantWithDependencies({ request: input, previewHash: preview.preview_hash, explicitApproval: true }, { client: client as never, deliverInvitation: async () => { throw new Error("provider must not run"); } });
    assert.ok(result.ok);
    assert.equal(result.handoffNeedsRecovery, true);
    assert.equal((result.result as { tenantId: string }).tenantId, tenantId);
  } finally {
    if (oldKey === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID; else process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = oldKey;
    if (oldSecret === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET; else process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = oldSecret;
  }
});
