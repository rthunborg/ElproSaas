import { describe, expect, test } from "vitest";
import { canonicalizeProvisioningRequest, createProvisioningPreview } from "@/server/commands/provisioning/validation";
import { signProvisioningAttestation, type ProvisioningAttestation } from "@/server/provisioning/attestation";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";
import {
  acceptProvisionedFirstAdminForTest,
  cleanupPlatformOperatorFixture,
  createPlatformOperatorFixture,
  createStrictProvisioningRequest,
  executeApprovedProvisioning,
  executeConcurrentProvisioning,
  inspectProvisioningAuditForTest,
  makePlatformOperatorClient,
  previewProvisioningForTest,
  retryFirstAdminInviteForTest,
  type StrictProvisioningRequest,
} from "../../factories/platform-operators";
import { adminQuery, adminSession } from "../../factories/admin-sql";
import {
  isLocalStackReachable,
  LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID,
  LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET,
} from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

function approvedProvisioningPayload(input: StrictProvisioningRequest, actorUserId: string) {
  const canonical = canonicalizeProvisioningRequest(input);
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  if (!baseline) throw new Error("missing provisioning baseline");
  const preview = createProvisioningPreview(input, baseline);
  const issuedAt = new Date().toISOString();
  const attestation: ProvisioningAttestation = {
    action: "provision",
    actorUserId,
    requestId: input.request_id,
    requestHash: canonical.canonicalRequestHash,
    organizationNumber: canonical.normalizedOrganizationNumber,
    firstAdminEmail: canonical.firstAdminEmail,
    previewHash: preview.preview_hash,
    explicitApproval: true,
    baselineId: baseline.id,
    baselineVersion: baseline.version,
    baselineContentHash: baseline.contentHash,
    tokenHash: "0".repeat(64),
    reservationId: "",
    dispatchGeneration: 0,
    approvalGeneration: 1,
    outcome: "",
    keyId: LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID,
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + 120_000).toISOString(),
  };
  return {
    request: input,
    preview_hash: preview.preview_hash,
    explicit_approval: true,
    attestation,
    attestation_signature: signProvisioningAttestation(attestation, LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET),
  };
}

async function cleanupProvisionedRequest(requestId: string) {
  await adminSession(async ({ query }) => {
    await query("begin");
    try {
      const rows = await query<{ tenant_id: string }>(
        "select tenant_id from public.tenant_provisioning_requests where request_id=$1::uuid",
        [requestId],
      );
      const tenantId = rows[0]?.tenant_id;
      if (tenantId) {
        await query("set local session_replication_role = replica");
        await query("delete from public.audit_events where tenant_id=$1::uuid", [tenantId]);
        await query("set local session_replication_role = origin");
        await query("delete from public.tenant_provisioning_requests where request_id=$1::uuid", [requestId]);
        await query("delete from public.tenants where id=$1::uuid", [tenantId]);
      }
      await query("commit");
    } catch (error) {
      await query("rollback");
      throw error;
    }
  });
}

async function waitUntilBlockedBy(blockerPid: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [state] = await adminQuery<{ blocked: boolean }>(
      "select exists(select 1 from pg_catalog.pg_stat_activity where $1::integer = any(pg_catalog.pg_blocking_pids(pid))) as blocked",
      [blockerPid],
    );
    if (state?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("concurrent provisioning request did not block on the uncommitted winner");
}

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

  test("[P0] 12.1-INT-006-R1 concurrent same request ID with changed canonical content returns IDEMPOTENCY_CONFLICT", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createPlatformOperatorFixture();
    const input = await createStrictProvisioningRequest();
    const changed = { ...input, legal_name: `${input.legal_name} changed` };

    try {
      const loserClient = await makePlatformOperatorClient(fixture.operator);
      const winnerPayload = approvedProvisioningPayload(input, fixture.operator.id);
      const loserPayload = approvedProvisioningPayload(changed, fixture.operator.id);
      let winner: { tenantId?: string } | undefined;
      let loserPromise: Promise<Awaited<ReturnType<typeof loserClient.rpc>>> | undefined;

      await adminSession(async ({ query }) => {
        await query("begin");
        try {
          const [backend] = await query<{ pid: number }>("select pg_catalog.pg_backend_pid() as pid");
          await query("set local role authenticated");
          await query("select set_config('request.jwt.claim.sub', $1, true)", [fixture.operator.id]);
          await query(
            "select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)",
            [fixture.operator.id],
          );
          const [created] = await query<{ result: { tenantId?: string } }>(
            "select public.provision_tenant('provision', $1::jsonb) as result",
            [JSON.stringify(winnerPayload)],
          );
          winner = created?.result;
          loserPromise = Promise.resolve(
            loserClient.rpc("provision_tenant", {
              p_action: "provision",
              p_request: loserPayload,
            }),
          );
          if (!backend) throw new Error("missing provisioning blocker backend");
          await waitUntilBlockedBy(backend.pid);
          await query("commit");
        } catch (error) {
          await query("rollback");
          throw error;
        }
      });

      if (!loserPromise) throw new Error("concurrent provisioning request was not started");
      const loser = await loserPromise;

      expect(winner).toMatchObject({ tenantId: expect.any(String) });
      expect(loser.data).toBeNull();
      expect(loser.error?.message).toContain("IDEMPOTENCY_CONFLICT");
      expect(loser.error?.message).not.toContain("ALREADY_PROVISIONED");
    } finally {
      await cleanupProvisionedRequest(input.request_id);
      await cleanupPlatformOperatorFixture(fixture);
    }
  });

  test("[P0] 12.1-INT-008 explicit retry records requested/failed truthfully, rotates a fresh generation, and limits dispatch four", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    expect(
      await retryFirstAdminInviteForTest({ providerOutcome: "accepted" }),
    ).toMatchObject({
      provisioningState: "first_admin_invite_requested",
      providerCallCount: 1,
      attemptNumber: 1,
      deliveryClaimed: false,
      tokenRotated: true,
      previousTokenRevoked: true,
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

  test("[P0] 12.1-INT-009 timeout/lost response stays unknown, reconciliation never resends, and every explicit dispatch rotates a bound token", async (testCtx) => {
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
      tokenReused: false,
      tokenRotated: true,
      previousTokenRevoked: true,
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
