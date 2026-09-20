import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { projectConsoleRow } from "@/features/operator-console/projection";
import { deriveWizardState } from "@/features/operator-console/wizard-state";
import { operatorPreviewGrantCryptoTestHooks, samePreviewGrantActor } from "@/server/provisioning/operator-preview-grant-crypto";
import { requestFromOperatorConsoleForm } from "@/features/operator-console/provisioning-request";
import { previewTenantProvisioning } from "@/server/commands/provisioning/provision-tenant";

type ConsoleDto = {
  readonly tenantName: string;
  readonly canonicalOrganisationIdentity: string;
  readonly provisioningState: string;
  readonly createdAt: string;
  readonly firstAdminState: string;
};

/**
 * Story 12.2 red-phase seam. Replace this typed placeholder with the public
 * read-model/wizard-state test hook as the named implementation task lands.
 */
const consoleTarget = { projectConsoleRow, deriveWizardState };

test("[P0] 12.2-UNIT-001 projects the exact safe console DTO and excludes nested, aliased, business, and protocol canaries", () => {
  // Given a backing row that contains both allowed fields and forbidden facts.
  const dto = consoleTarget.projectConsoleRow({
    tenant_name: "Canary El AB",
    canonical_organisation_identity: "556123-4567",
    provisioning_state: "first_admin_invite_unknown",
    created_at: "2026-09-20T10:00:00.000Z",
    first_admin_state: "unknown",
    customer_name: "CUSTOMER-CANARY-A",
    quote_total_ore: 912345,
    file_object_path: "files/canary.pdf",
    token_hash: "token-canary",
    preview_hash: "preview-canary",
    audit_metadata: { nested_canary: "AUDIT-CANARY" },
    alias: { contact_email: "secret@example.test" },
  });

  // Then only the contract allow-list remains in keys and serialized values.
  assert.deepEqual(dto, {
    tenantName: "Canary El AB",
    canonicalOrganisationIdentity: "556123-4567",
    provisioningState: "first_admin_invite_unknown",
    createdAt: "2026-09-20T10:00:00.000Z",
    firstAdminState: "unknown",
  });
  assert.deepEqual(Object.keys(dto).sort(), [
    "canonicalOrganisationIdentity",
    "createdAt",
    "firstAdminState",
    "provisioningState",
    "tenantName",
  ]);
  assert.doesNotMatch(
    JSON.stringify(dto),
    /CUSTOMER-CANARY-A|912345|canary\.pdf|token-canary|preview-canary|AUDIT-CANARY|secret@example/i,
  );
});

test("[P1] 12.2-UNIT-002 derives every wizard/resume affordance from durable server state", () => {
  // Given persisted states reconstructed in a fresh browser context.
  const fresh = consoleTarget.deriveWizardState({ lifecycle: "fresh" });
  const previewed = consoleTarget.deriveWizardState({ lifecycle: "preview_validated" });
  const unknown = consoleTarget.deriveWizardState({ lifecycle: "first_admin_invite_unknown", attempt: 2 });
  const failed = consoleTarget.deriveWizardState({ lifecycle: "first_admin_invite_failed", attempt: 3 });
  const replay = consoleTarget.deriveWizardState({ lifecycle: "already_provisioned" });

  // Then browser history never creates authority or a duplicate success.
  assert.deepEqual(fresh, { step: "company", canApprove: false });
  assert.deepEqual(previewed, { step: "baseline", canApprove: true });
  assert.deepEqual(unknown, { requiresReconciliation: true, canRetry: false });
  assert.deepEqual(failed, { canRetry: true, requiresFreshApprovalForAttempt: 4 });
  assert.deepEqual(replay, { duplicateCreateSuccess: false });
  assert.deepEqual(consoleTarget.deriveWizardState({ lifecycle: "first_admin_invite_requested" }), { step: "first-admin", canApprove: false });
});

test("[P0] 12.2-UNIT-003 encrypts the short-lived approval grant so request and preview hashes never enter browser UI state", () => {
  const encryptionKey = Buffer.alloc(32, 7);
  const rawRequest = { request_id: "6bc018da-ff18-4796-b0d7-742a3f5e8445", legal_name: "Canary El AB", first_admin_email: "canary@example.test" };
  const previewHash = "a".repeat(64);
  const encoded = operatorPreviewGrantCryptoTestHooks.encode({ actorUserId: "a5a1a4d3-8ad9-4374-9228-92c6b6e1fb43", request: rawRequest, previewHash, expiresAt: Date.now() + 30_000 }, encryptionKey);

  assert.ok(encoded);
  assert.doesNotMatch(encoded, /Canary El|canary@example|a{32}/i);
  assert.deepEqual(operatorPreviewGrantCryptoTestHooks.decode(encoded, encryptionKey), {
    actorUserId: "a5a1a4d3-8ad9-4374-9228-92c6b6e1fb43",
    request: rawRequest,
    previewHash,
    expiresAt: operatorPreviewGrantCryptoTestHooks.decode(encoded, encryptionKey)?.expiresAt,
  });
  assert.equal(operatorPreviewGrantCryptoTestHooks.decode(`${encoded}x`, encryptionKey), null);
  assert.equal(operatorPreviewGrantCryptoTestHooks.decode(operatorPreviewGrantCryptoTestHooks.encode({ actorUserId: "other", request: rawRequest, previewHash, expiresAt: Date.now() - 1 }, encryptionKey)!, encryptionKey), null);
  assert.equal(samePreviewGrantActor("operator-A", "operator-B"), false);
});

test("[P1] 12.2-UNIT-004 accepts the E2E console company identity through the closed zero-write preview request", () => {
  const form = new FormData();
  form.set("legalName", "E2E Operatör AB");
  // This is a valid organisation number and deliberately cannot look like a
  // Swedish personnummer to the shared provisioning validator.
  form.set("organizationNumber", "5566778899");
  form.set("contractStartDate", "2026-10-01");
  form.set("firstAdminName", "E2E Admin");
  form.set("firstAdminEmail", "e2e-admin@example.test");

  const request = requestFromOperatorConsoleForm(form);
  assert.ok(request);
  const preview = previewTenantProvisioning(request);
  assert.equal(preview.ok, true);
  if (preview.ok) assert.equal(preview.preview.writes, 0);
});

test("[P0] 12.2-UNIT-005 consumes both opaque grants at their /operator cookie path", () => {
  for (const file of ["operator-preview-grant.ts", "operator-reconciliation-grant.ts"]) {
    const source = readFileSync(path.join(process.cwd(), "src", "server", "provisioning", file), "utf8");
    assert.match(source, /store\.delete\(\{ (?:name: cookieName|name), path: "\/operator" \}\)/);
  }
});

test("[P0] 12.2-UNIT-006 builds a closed request and ignores browser attempts to override server-owned fields", () => {
  const clean = new FormData();
  clean.set("legalName", "Closed Form El AB");
  clean.set("organizationNumber", "5566778899");
  clean.set("contractStartDate", "2026-10-01");
  clean.set("firstAdminName", "Closed Admin");
  clean.set("firstAdminEmail", "closed-admin@example.test");

  const browserSupplied = new FormData();
  for (const [key, value] of clean) browserSupplied.set(key, value);
  browserSupplied.set("schema_version", "999");
  browserSupplied.set("request_id", "browser-chosen-id");
  browserSupplied.set("baseline_profile_id", "browser-baseline");
  browserSupplied.set("baseline_profile_version", "99");
  browserSupplied.set("subscription_plan_id", "enterprise");
  browserSupplied.set("subscription_status", "suspended");
  browserSupplied.set("included_user_count", "999");
  browserSupplied.set("additional_user_price_ore", "1");
  browserSupplied.set("country_code", "US");

  assert.deepEqual(requestFromOperatorConsoleForm(browserSupplied), requestFromOperatorConsoleForm(clean));
});

test("[P1] 12.2-UNIT-007 gives equivalent organisation formatting one request identity and a distinct canonical organisation another", () => {
  const request = (organizationNumber: string) => {
    const form = new FormData();
    form.set("legalName", "Identity El AB");
    form.set("organizationNumber", organizationNumber);
    form.set("contractStartDate", "2026-10-01");
    form.set("firstAdminName", "Identity Admin");
    form.set("firstAdminEmail", "identity-admin@example.test");
    return requestFromOperatorConsoleForm(form);
  };

  const canonical = request("5566778899");
  const formatted = request("5566-778899");
  const different = request("5566778800");

  assert.ok(canonical);
  assert.ok(formatted);
  assert.ok(different);
  assert.equal(canonical.request_id, formatted.request_id);
  assert.notEqual(canonical.request_id, different.request_id);
});

test("[P1] 12.2-UNIT-008 derives the complete wizard step from the durable ready state", () => {
  assert.deepEqual(consoleTarget.deriveWizardState({ lifecycle: "ready" }), { step: "complete" });
});
