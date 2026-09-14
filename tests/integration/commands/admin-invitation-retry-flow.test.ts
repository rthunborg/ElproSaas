/**
 * Story 11.3 lifecycle regression: exercise the real invite command and server
 * action across the durable-operation retry boundary.  The database RPC and
 * Auth transport are mocked here; authenticated direct-RPC behaviour is covered
 * separately by the database-backed suite.
 */
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  type StoredOperation = { membershipId: string; outcome: string };
  const operations = new Map<string, StoredOperation>();
  let membershipNumber = 0;
  let failNextFinalize = false;
  let reconcileUnavailable = false;

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    const operationId = String(args.p_operation_id ?? "");
    if (name === "admin_prepare_membership_invitation") {
      const known = operations.get(operationId);
      if (known) return { data: { membershipId: known.membershipId, fresh: false, outcome: known.outcome }, error: null };
      const membershipId = `membership-${++membershipNumber}`;
      operations.set(operationId, { membershipId, outcome: "pending" });
      return { data: { membershipId, fresh: true, outcome: "pending" }, error: null };
    }
    if (name === "admin_finalize_membership_operation") {
      if (failNextFinalize) {
        failNextFinalize = false;
        return { data: null, error: new Error("write response lost") };
      }
      const known = operations.get(operationId);
      if (known) known.outcome = String(args.p_outcome);
      return { data: null, error: null };
    }
    if (name === "admin_reconcile_membership_operation") {
      if (reconcileUnavailable) return { data: null, error: new Error("reconciliation unavailable") };
      const known = operations.get(operationId);
      return { data: known ? { operationId, outcome: known.outcome } : null, error: null };
    }
    throw new Error(`unexpected RPC ${name}`);
  });
  const inviteUserByEmail = vi.fn(async () => ({ data: { user: { id: "auth-user" } }, error: null }));

  return {
    rpc,
    inviteUserByEmail,
    reset() {
      operations.clear(); membershipNumber = 0; failNextFinalize = false; reconcileUnavailable = false;
      rpc.mockClear(); inviteUserByEmail.mockClear();
    },
    failFinalizeOnce() { failNextFinalize = true; },
    setReconcileUnavailable(value: boolean) { reconcileUnavailable = value; },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/resolve-tenant-context", () => ({
  resolveTenantContext: async () => ({ ok: true, data: { tenantId: "tenant-a", userId: "admin-a" } }),
}));
vi.mock("@/server/db/supabase-server-client", () => ({
  createSupabaseServerClient: async () => ({ rpc: harness.rpc }),
}));
vi.mock("@/server/db/supabase-env", () => ({ getSupabasePublicEnv: () => ({ url: "http://supabase.test" }) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { inviteUserByEmail: harness.inviteUserByEmail }, signInWithOtp: vi.fn(), resetPasswordForEmail: vi.fn() } }),
}));

import { inviteAdminUserAction } from "@/features/admin-users/actions";
import { ADMIN_USERS_INITIAL, operationIdForAdminUsersSubmit } from "@/features/admin-users/action-state";

function inviteForm(operationId: string) {
  const form = new FormData();
  form.set("email", "electrician@example.test");
  form.append("roles", "montor");
  form.set("operationId", operationId);
  return form;
}

describe("admin invitation delivery recovery", () => {
  it("keeps an uncertain durable operation until reconciliation, then sends exactly one fresh retry", async () => {
    harness.reset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    const originalId = "operation-original";
    harness.failFinalizeOnce();
    const first = await inviteAdminUserAction(ADMIN_USERS_INITIAL, inviteForm(originalId));
    expect(first).toMatchObject({ status: "error" });
    expect(first.retryWithNewOperation).toBeUndefined();
    expect(harness.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(harness.rpc.mock.calls.filter(([name]) => name === "admin_prepare_membership_invitation")).toHaveLength(1);

    const observed = await inviteAdminUserAction(first, inviteForm(originalId));
    expect(observed).toMatchObject({ status: "error", retryWithNewOperation: true });
    expect(harness.rpc).toHaveBeenCalledWith("admin_reconcile_membership_operation", { p_operation_id: originalId });
    expect(harness.inviteUserByEmail).toHaveBeenCalledTimes(1);

    const freshId = operationIdForAdminUsersSubmit(observed, originalId, () => "operation-fresh");
    expect(freshId).toBe("operation-fresh");
    const succeeded = await inviteAdminUserAction(observed, inviteForm(freshId));
    expect(succeeded).toMatchObject({ status: "success" });
    expect(harness.rpc).toHaveBeenCalledWith("admin_prepare_membership_invitation", expect.objectContaining({ p_operation_id: freshId }));
    expect(harness.inviteUserByEmail).toHaveBeenCalledTimes(2);

    const successReplay = await inviteAdminUserAction(succeeded, inviteForm(freshId));
    expect(successReplay).toMatchObject({ status: "success" });
    expect(harness.inviteUserByEmail).toHaveBeenCalledTimes(2);
  });

  it("does not enable a new operation or delivery while reconciliation is unavailable", async () => {
    harness.reset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    const operationId = "operation-unavailable";

    // Prepare once so the action sees a replayable pending operation rather than
    // a new invitation it could legitimately deliver.
    harness.failFinalizeOnce();
    await inviteAdminUserAction(ADMIN_USERS_INITIAL, inviteForm(operationId));
    expect(harness.inviteUserByEmail).toHaveBeenCalledTimes(1);
    harness.setReconcileUnavailable(true);

    const unavailable = await inviteAdminUserAction(ADMIN_USERS_INITIAL, inviteForm(operationId));
    expect(unavailable).toMatchObject({ status: "error" });
    expect(unavailable.retryWithNewOperation).toBeUndefined();
    expect(operationIdForAdminUsersSubmit(unavailable, operationId, () => "must-not-be-used")).toBe(operationId);
    expect(harness.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(harness.rpc).toHaveBeenCalledWith("admin_reconcile_membership_operation", { p_operation_id: operationId });
  });
});
