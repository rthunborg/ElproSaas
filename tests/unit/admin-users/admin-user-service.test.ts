import assert from "node:assert/strict";
import { test } from "node:test";

test.skip("[P0] commits one durable invite operation and audit before invoking Supabase Auth", async () => {
    const { createAdminUserService } = await import("@/server/auth/admin-user-service");
    let prepared = false;
    let inviteArgs: unknown[] | undefined;
    const prepareInvite = async () => {
      prepared = true;
      return {
      operationId: "0ad1cd0c-fb67-4bf9-a0d4-ffac1cf53d93",
      membershipId: "aa15496b-1ca0-4fda-a126-47527539325e",
      attemptToken: "opaque-current-attempt",
      delivery: "invite",
      };
    };
    const inviteUserByEmail = async (...args: unknown[]) => {
      inviteArgs = args;
      return { data: { user: { id: "37eeec1b-093b-41b1-a455-b152f028d8fd" } }, error: null };
    };
    const service = createAdminUserService({
      prepareInvite,
      inviteUserByEmail,
      finalizeOperation: async () => undefined,
    });

    await service.invite({
      tenantId: "4e23bd3a-a589-4e53-9c08-9f6b62e59f36",
      actorId: "d318f567-126a-4ca0-b7d2-d57cba93295d",
      email: "shared.electrician@example.test",
      roles: ["tenant_admin"],
      operationId: "0ad1cd0c-fb67-4bf9-a0d4-ffac1cf53d93",
    });

    assert.equal(prepared, true);
    assert.equal(inviteArgs?.[0], "shared.electrician@example.test");
    assert.match(String((inviteArgs?.[1] as { redirectTo?: string }).redirectTo), /opaque-current-attempt/);
  });

test.skip("[P1] replays a known uncertain operation without a second membership mutation or duplicate-delivery claim", async () => {
    const { createAdminUserService } = await import("@/server/auth/admin-user-service");
    let reconciliationCalls = 0;
    const reconcileOperation = async () => {
      reconciliationCalls += 1;
      return {
      operationId: "0ad1cd0c-fb67-4bf9-a0d4-ffac1cf53d93",
      outcome: "uncertain",
      membershipMutationCount: 1,
      delivery: "not-guaranteed",
      };
    };
    const service = createAdminUserService({ reconcileOperation, inviteUserByEmail: async () => undefined });

    const result = await service.reconcile({
      tenantId: "4e23bd3a-a589-4e53-9c08-9f6b62e59f36",
      actorId: "d318f567-126a-4ca0-b7d2-d57cba93295d",
      operationId: "0ad1cd0c-fb67-4bf9-a0d4-ffac1cf53d93",
    });

    assert.equal(result.outcome, "uncertain");
    assert.equal(result.membershipMutationCount, 1);
    assert.equal(result.delivery, "not-guaranteed");
    assert.equal(reconciliationCalls, 1);
  });
