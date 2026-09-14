import assert from "node:assert/strict";
import { test } from "node:test";

test("[P0] commits one durable invite operation and audit before invoking Supabase Auth", async () => {
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

test("[P1] replays a known uncertain operation without a second membership mutation or duplicate-delivery claim", async () => {
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

test("[P0] sends an existing Auth account a magic link after its durable invite operation is prepared", async () => {
  const { createAdminUserService } = await import("@/server/auth/admin-user-service");
  const finalized: unknown[] = [];
  let magicLinkInput: unknown;
  const service = createAdminUserService({
    prepareInvite: async () => ({
      operationId: "operation-id",
      membershipId: "membership-id",
      attemptToken: "current-attempt",
      delivery: "invite",
    }),
    inviteUserByEmail: async () => {
      throw new Error("User already registered");
    },
    signInWithOtp: async (input) => {
      magicLinkInput = input;
    },
    finalizeOperation: async (input) => {
      finalized.push(input);
    },
  });

  const result = await service.invite({ email: "existing@example.test" });

  assert.deepEqual(magicLinkInput, {
    email: "existing@example.test",
    options: {
      shouldCreateUser: false,
      emailRedirectTo: "/auth/invite/confirm?membershipId=membership-id&attempt=current-attempt",
    },
  });
  assert.equal(result.outcome, "succeeded");
  assert.deepEqual(finalized, [{ operationId: "operation-id", outcome: "succeeded" }]);
});

test("[P0] records an unrelated invite-provider failure as uncertain without issuing a second delivery", async () => {
  const { createAdminUserService } = await import("@/server/auth/admin-user-service");
  const finalized: unknown[] = [];
  let inviteCalls = 0; let magicLinkCalls = 0;
  const service = createAdminUserService({
    prepareInvite: async () => ({
      operationId: "operation-id",
      membershipId: "membership-id",
      attemptToken: "current-attempt",
      delivery: "invite",
    }),
    inviteUserByEmail: async () => {
      inviteCalls += 1;
      throw new Error("provider temporarily unavailable");
    },
    signInWithOtp: async () => {
      magicLinkCalls += 1;
    },
    finalizeOperation: async (input) => {
      finalized.push(input);
    },
  });

  const result = await service.invite({ email: "existing@example.test" });

  assert.equal(result.outcome, "uncertain");
  assert.equal(inviteCalls, 1);
  assert.equal(magicLinkCalls, 0);
  assert.deepEqual(finalized, [{ operationId: "operation-id", outcome: "uncertain" }]);
});

test("[P0] keeps a prepared invitation reconcilable when recording delivery success fails", async () => {
  const { createAdminUserService } = await import("@/server/auth/admin-user-service");
  const finalized: unknown[] = [];
  const service = createAdminUserService({
    prepareInvite: async () => ({ operationId: "prepared-operation", membershipId: "prepared-membership", attemptToken: "current", delivery: "invite" }),
    inviteUserByEmail: async () => undefined,
    finalizeOperation: async (input) => { finalized.push(input); throw new Error("database response lost"); },
  });

  const result = await service.invite({ email: "prepared@example.test" });

  assert.deepEqual(result, { operationId: "prepared-operation", membershipId: "prepared-membership", outcome: "uncertain" });
  assert.deepEqual(finalized, [{ operationId: "prepared-operation", outcome: "succeeded" }]);
});

test("[P0] keeps prepared context without throwing when both provider delivery and outcome recording fail", async () => {
  const { createAdminUserService } = await import("@/server/auth/admin-user-service");
  const finalized: unknown[] = [];
  const service = createAdminUserService({
    prepareInvite: async () => ({ operationId: "double-failure-operation", membershipId: "double-failure-membership", attemptToken: "current", delivery: "invite" }),
    inviteUserByEmail: async () => { throw new Error("provider unavailable"); },
    finalizeOperation: async (input) => { finalized.push(input); throw new Error("database response lost"); },
  });

  assert.deepEqual(await service.invite({ email: "prepared@example.test" }), { operationId: "double-failure-operation", membershipId: "double-failure-membership", outcome: "uncertain" });
  assert.deepEqual(finalized, [{ operationId: "double-failure-operation", outcome: "uncertain" }]);
});

test("[P0] finalizes password-reset delivery as succeeded or uncertain without surfacing provider details", async () => {
  const { createAdminUserService } = await import("@/server/auth/admin-user-service");
  const finalized: unknown[] = [];
  const service = createAdminUserService({
    inviteUserByEmail: async () => undefined,
    resetPasswordForEmail: async (email, options) => {
      if (email === "fails@example.test") throw new Error("provider temporarily unavailable");
      assert.equal(options.redirectTo, "/auth/invite/confirm");
    },
    finalizeOperation: async (input) => {
      finalized.push(input);
    },
  });

  assert.deepEqual(await service.reset({ email: "works@example.test", operationId: "successful-reset" }), { outcome: "succeeded" });
  assert.deepEqual(await service.reset({ email: "fails@example.test", operationId: "uncertain-reset" }), { outcome: "uncertain" });
  assert.deepEqual(finalized, [
    { operationId: "successful-reset", outcome: "succeeded" },
    { operationId: "uncertain-reset", outcome: "uncertain" },
  ]);
});
