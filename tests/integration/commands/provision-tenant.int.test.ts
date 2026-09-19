import { describe, expect, test } from "vitest";
import {
  acceptProvisionedFirstAdminForTest,
  createStrictProvisioningRequest,
  executeApprovedProvisioning,
  executeConcurrentProvisioning,
  inspectProvisioningAuditForTest,
  previewProvisioningForTest,
  retryFirstAdminInviteForTest,
} from "../../factories/platform-operators";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("provision_tenant command — Story 12.1 ATDD", () => {
  test("[P0] 12.1-INT-003 atomically persists canonical identity/request, exact baseline, tenant, invited first Admin, pending state, and audit before Auth", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const result = await executeApprovedProvisioning(
      await createStrictProvisioningRequest(),
    );

    expect(result).toMatchObject({
      tenantId: expect.any(String),
      provisioningState: "pending_first_admin_invite",
      baseline: {
        id: expect.any(String),
        version: expect.any(Number),
        contentHash: expect.any(String),
      },
      tenantCount: 1,
      invitedFirstAdminCount: 1,
      approvalAuditCount: 1,
      providerCallCount: 0,
      databaseCommitObservedBeforeProvider: true,
    });
  });

  test("[P0] 12.1-INT-004 injected failure at each transactional write point rolls back tenant, membership, idempotency, and audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    for (const failAt of [
      "tenant",
      "baseline",
      "membership",
      "idempotency",
      "audit",
    ] as const) {
      await expect(
        executeApprovedProvisioning(await createStrictProvisioningRequest(), {
          failAt,
        }),
      ).rejects.toMatchObject({
        rolledBack: true,
        residualRows: 0,
      });
    }
  });

  test("[P0] 12.1-INT-005 dry run is complete and zero-write; execution requires original request, request ID, hash, approval, and an unchanged immutable baseline", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const input = await createStrictProvisioningRequest();
    const preview = await previewProvisioningForTest(input);

    expect(preview).toMatchObject({
      schema_version: 1,
      request_id: input.request_id,
      normalized_identity: expect.any(Object),
      validation: expect.any(Object),
      warnings: expect.any(Array),
      proposed_action: "CREATE",
      baseline: expect.objectContaining({
        id: input.baseline_profile_id,
        version: input.baseline_profile_version,
        content_hash: expect.any(String),
      }),
      proposed_values: expect.any(Object),
      first_admin: expect.any(Object),
      audit_events: expect.any(Array),
      unsupported_fields: [],
      deferred_fields: [],
      preview_hash: expect.any(String),
      writes: 0,
      authCalls: 0,
      durableRowsUnchanged: true,
    });

    await expect(
      executeApprovedProvisioning(input, {
        previewHash: `${preview.preview_hash}-changed`,
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/MISMATCH/) });
    await expect(
      executeApprovedProvisioning(input, { baselineDrift: true }),
    ).rejects.toMatchObject({ code: "PREVIEW_STALE", residualRows: 0 });
  });

  test("[P0] 12.1-INT-006 same UUID/hash reconciles without provider work; conflicts and all-status same-identity replays cannot mutate or duplicate", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const input = await createStrictProvisioningRequest();
    const first = await executeApprovedProvisioning(input, {
      preserveFixture: true,
    });

    expect(
      await executeApprovedProvisioning(input, { fixtureId: first.fixtureId }),
    ).toMatchObject({
      tenantId: first.tenantId,
      providerCallCount: 0,
      reconciliationAction: expect.any(String),
    });
    await expect(
      executeApprovedProvisioning(
        { ...input, legal_name: "Changed AB" },
        { fixtureId: first.fixtureId },
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    for (const existingStatus of ["active", "inactive", "archived"] as const) {
      await expect(
        executeApprovedProvisioning(
          { ...input, request_id: crypto.randomUUID() },
          { fixtureId: first.fixtureId, existingStatus },
        ),
      ).rejects.toMatchObject({
        code: "ALREADY_PROVISIONED",
        tenantId: first.tenantId,
      });
    }
    await first.cleanup();
  });

  test("[P0] 12.1-INT-007 concurrent equal canonical identities produce one tenant and one effective invite intent", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const results = await executeConcurrentProvisioning(
      await createStrictProvisioningRequest(),
    );

    expect(results).toMatchObject({
      tenantCount: 1,
      invitedFirstAdminCount: 1,
      winnerCount: 1,
      alreadyProvisionedCount: 1,
      providerCallCount: 0,
    });
  });

  test("[P0] 12.1-INT-008 explicit retry records requested/failed truthfully, makes one provider call, preserves one invitation through attempt three, and limits attempt four", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    expect(
      await retryFirstAdminInviteForTest({ providerOutcome: "accepted" }),
    ).toMatchObject({
      provisioningState: "first_admin_invite_requested",
      providerCallCount: 1,
      attemptNumber: 1,
      deliveryClaimed: false,
    });
    expect(
      await retryFirstAdminInviteForTest({ providerOutcome: "failed" }),
    ).toMatchObject({
      provisioningState: "first_admin_invite_failed",
      providerCallCount: 1,
      sanitizedOutcomePersisted: true,
    });
    expect(await retryFirstAdminInviteForTest({ attemptNumber: 4 })).toMatchObject(
      {
        requiresFreshPreviewAndApproval: true,
        providerCallCount: 0,
        tokenRotated: false,
      },
    );
  });

  test("[P0] 12.1-INT-009 timeout/lost response stays unknown, reconciliation reuses the bound token, and fresh approval after attempt three rotates it without exposing the raw token", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const rawTokenCanary = `raw-token-canary-${crypto.randomUUID()}`;
    const result = await retryFirstAdminInviteForTest({
      providerOutcome: "timeout",
      rawTokenCanary,
    });

    expect(result).toMatchObject({
      provisioningState: "first_admin_invite_unknown",
      providerCallCount: 1,
      automaticResendCount: 0,
      tokenReused: true,
      tokenHashPersisted: true,
      tokenBinding: {
        invitationId: expect.any(String),
        tenantId: expect.any(String),
        membershipId: expect.any(String),
        normalizedEmail: expect.any(String),
        role: "tenant_admin",
        expiresAt: expect.any(String),
      },
    });
    expect(JSON.stringify(result)).not.toContain(rawTokenCanary);

    expect(
      await retryFirstAdminInviteForTest({
        attemptNumber: 4,
        freshPreviewAndApproval: true,
      }),
    ).toMatchObject({
      tokenRotated: true,
      previousTokenRevoked: true,
      providerCallCount: 1,
    });
  });

  test("[P0] 12.1-INT-012 writes correlated nonsecret audit transitions and leaves preview without any audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    expect(await inspectProvisioningAuditForTest()).toMatchObject({
      approverFromAuthUid: true,
      approvedAt: expect.any(String),
      requestId: expect.any(String),
      previewHash: expect.any(String),
      baselineId: expect.any(String),
      baselineVersion: expect.any(Number),
      baselineContentHash: expect.any(String),
      attemptNumber: expect.any(Number),
      reconciliationAction: expect.any(String),
      sanitizedOutcome: expect.any(String),
      containsRawInvitationToken: false,
      containsSecret: false,
      previewAuditRows: 0,
    });
  });

  test("[P0] 12.1-INT-010 real Epic 11 acceptance activates the bound first Admin and projects ready only after the exact identity predicate holds", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    expect(await acceptProvisionedFirstAdminForTest()).toMatchObject({
      accepted: true,
      provisioningState: "ready",
      membershipStatus: "active",
      membershipUserId: expect.any(String),
      expectedUserId: expect.any(String),
      tokenBinding: {
        normalized_email: expect.any(String), role: "tenant_admin", token_hash: expect.any(String),
      },
    });
  });
});
