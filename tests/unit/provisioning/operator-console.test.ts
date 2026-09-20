import assert from "node:assert/strict";
import { test } from "node:test";

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
const consoleTarget = undefined as unknown as {
  projectConsoleRow: (row: Record<string, unknown>) => ConsoleDto;
  deriveWizardState: (state: Record<string, unknown>) => Record<string, unknown>;
};

test.skip("[P0] 12.2-UNIT-001 projects the exact safe console DTO and excludes nested, aliased, business, and protocol canaries", () => {
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

test.skip("[P1] 12.2-UNIT-002 derives every wizard/resume affordance from durable server state", () => {
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
});
