import { provisioningCommandTestHooks } from "@/server/commands/provisioning/provision-tenant";
import { createHash } from "node:crypto";
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

  test("[P0] 12.1-INT-004-R1 fault injection completes while a parallel membership writer retains its table lock", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const input = await createStrictProvisioningRequest();
    await adminSession(async ({ query }) => {
      await query("begin");
      let pending: Promise<unknown> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // This is the lock an ordinary membership INSERT holds before checking
        // its tenants FK. It must coexist with the harness, including audit faults.
        await query("lock table public.tenant_memberships in row exclusive mode");
        pending = executeApprovedProvisioning(input, { failAt: "audit" }).then(
          () => { throw new Error("fault injection unexpectedly succeeded"); },
          (error: unknown) => error,
        );
        const result = await Promise.race([
          pending,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("fault injection blocked a parallel membership writer")), 5_000);
          }),
        ]);
        expect(result).toMatchObject({ rolledBack: true, residualRows: 0 });
      } finally {
        if (timer) clearTimeout(timer);
        await query("rollback");
        // Drain the request after releasing the blocker even on the timeout path.
        await pending;
      }
    });
    const controls = await adminQuery(
      "select request_id from test_support.forced_provisioning_failures where request_id=$1::uuid",
      [input.request_id],
    );
    expect(controls).toHaveLength(0);
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

describe("PR72 approved invitation recovery", () => {
  for (const scenario of ["dispatch four", "expired invitation"] as const) {
    test(`[P0] ${scenario} renews once, invalidates old links and accepts the new invitation`, async (testCtx) => {
      if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
      const fixture = await createPlatformOperatorFixture();
      const input = { ...await createStrictProvisioningRequest(), first_admin_email: fixture.orphan.email };
      const client = await makePlatformOperatorClient(fixture.operator);
      const firstAdmin = await makePlatformOperatorClient(fixture.orphan);
      const proof = approvedProvisioningPayload(input, fixture.operator.id);
      const previousKey = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
      const previousSecret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
      process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID;
      process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET;
      try {
        const created = await client.rpc("provision_tenant", { p_action: "provision", p_request: proof });
        expect(created.error).toBeNull();
        const tenantId = created.data.tenantId as string;
        const tokens: string[] = [];
        const dependencies = { client, deliverInvitation: async (_reservation: unknown, token: string) => { tokens.push(token); return scenario === "dispatch four" && tokens.length === 1 ? "failed" as const : "requested" as const; } };
        // Initial committed-but-undispatched state remains recoverable through the production command.
        expect((await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId }, dependencies)).ok).toBe(true);
        const [original] = await adminQuery<{ membership_id: string; token_hash: string; reservation_id: string }>("select membership_id,token_hash,reservation_id from public.tenant_provisioning_invites where tenant_id=$1", [tenantId]);
        const accept = (hash: string) => firstAdmin.rpc("admin_accept_membership_invitation", { p_membership_id: original.membership_id, p_token_hash: hash, p_user_id: fixture.orphan.id, p_email: fixture.orphan.email });
        if (scenario === "dispatch four") {
          // Three completed failed deliveries require a fresh approval for dispatch four.
          const failed = { client, deliverInvitation: async (_reservation: unknown, token: string) => { tokens.push(token); return "failed" as const; } };
          for (let index = 0; index < 2; index++) expect((await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId }, failed)).ok).toBe(true);
        } else {
          await adminQuery("update public.tenant_memberships set invitation_expires_at=now()-interval '1 hour' where id=$1", [original.membership_id]);
          await adminQuery("update public.tenant_provisioning_invites set expires_at=now()-interval '1 hour' where tenant_id=$1", [tenantId]);
          expect((await accept(original.token_hash)).data).toBe(false); // Epic 11 sets membership status=expired.
        }
        const before = tokens.length;
        expect(await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId }, dependencies)).toMatchObject({ ok: false, code: "PREVIEW_STALE" });
        expect(tokens).toHaveLength(before);
        const observed = await client.rpc("provision_tenant", { p_action: "reconcile", p_request: { tenant_id: tenantId } });
        expect(observed.error).toBeNull();
        const preview = createProvisioningPreview(observed.data.originalRequest, findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version)!);
        const renewal = { request: observed.data.originalRequest, previewHash: preview.preview_hash, expectedApprovalGeneration: observed.data.approvalGeneration };
        const concurrent = await Promise.all([
          provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId, renewal }, dependencies),
          provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId, renewal }, dependencies),
        ]);
        expect(concurrent.filter((result) => result.ok)).toHaveLength(1);
        expect(tokens).toHaveLength(before + 1);
        expect(await provisioningCommandTestHooks.retryFirstAdminInviteWithDependencies({ tenantId, renewal }, dependencies)).toMatchObject({ ok: false, code: "PREVIEW_STALE" });
        expect(tokens).toHaveLength(before + 1);
        const [renewed] = await adminQuery<{ token_hash: string; expires_match: boolean; unexpired: boolean; approval_generation: number; unsuperseded: number }>(
          `select i.token_hash, i.expires_at=m.invitation_expires_at as expires_match,
            i.expires_at>now() as unexpired, i.approval_generation,
            (select count(*)::integer from public.membership_admin_operations o where o.membership_id=m.id and o.superseded_at is null and o.outcome in ('pending','succeeded','uncertain')) as unsuperseded
            from public.tenant_provisioning_invites i join public.tenant_memberships m on m.id=i.membership_id where i.tenant_id=$1`, [tenantId]);
        expect(renewed).toMatchObject({ expires_match: true, unexpired: true, approval_generation: 2, unsuperseded: 1 });
        expect(renewed.token_hash).toBe(createHash("sha256").update(tokens.at(-1)!).digest("hex"));
        expect((await accept(original.token_hash)).data).toBe(false);
        expect((await accept(renewed.token_hash)).data).toBe(true);
      } finally {
        if (previousKey === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID; else process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID = previousKey;
        if (previousSecret === undefined) delete process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET; else process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET = previousSecret;
        await cleanupProvisionedRequest(input.request_id);
        await cleanupPlatformOperatorFixture(fixture);
      }
    });
  }
});
