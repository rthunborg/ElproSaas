import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/server/db/supabase-env";

export type PreparedInvite = { operationId: string; membershipId: string; attemptToken: string; delivery: string };
export type ReconciledAdminUserOperation = { operationId: string; outcome: string; membershipMutationCount: number; delivery?: string };
export type AdminUserServiceDependencies = {
  prepareInvite?: (input: Record<string, unknown>) => Promise<PreparedInvite>;
  inviteUserByEmail: (email: string, options: { redirectTo: string }) => Promise<unknown>;
  signInWithOtp?: (input: { email: string; options: { shouldCreateUser: false; emailRedirectTo: string } }) => Promise<unknown>;
  resetPasswordForEmail?: (email: string, options: { redirectTo: string }) => Promise<unknown>;
  finalizeOperation?: (input: Record<string, unknown>) => Promise<void>;
  reconcileOperation?: (input: Record<string, unknown>) => Promise<ReconciledAdminUserOperation>;
  invitationRedirectBase?: string;
};

export function createAdminUserService(deps: AdminUserServiceDependencies) {
  const redirect = (prepared: PreparedInvite) => `${deps.invitationRedirectBase ?? "/auth/invite/confirm"}?membershipId=${encodeURIComponent(prepared.membershipId)}&attempt=${encodeURIComponent(prepared.attemptToken)}`;
  return {
    async invite(input: Record<string, unknown>) {
      if (!deps.prepareInvite) throw new Error("admin user operation unavailable");
      const prepared = await deps.prepareInvite(input);
      const email = String(input.email ?? "");
      const redirectTo = redirect(prepared);
      try {
        if (prepared.delivery === "magic_link") {
          if (!deps.signInWithOtp) throw new Error("admin user operation unavailable");
          await deps.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
        } else {
          try {
            await deps.inviteUserByEmail(email, { redirectTo });
          } catch (error) {
            // The Admin API rejects an already-confirmed Auth account. That
            // account must receive the standard sign-in link instead of a
            // second account invitation; unrelated provider failures remain
            // uncertain and never trigger a duplicate delivery attempt.
            const message = error instanceof Error ? error.message.toLowerCase() : "";
            if (!deps.signInWithOtp || !message.includes("already")) throw error;
            await deps.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
          }
        }
        await deps.finalizeOperation?.({ operationId: prepared.operationId, outcome: "succeeded" });
        return { operationId: prepared.operationId, membershipId: prepared.membershipId, outcome: "succeeded" as const };
      } catch {
        // The durable operation already exists. A response loss is deliberately
        // distinguishable from a later successful reconciliation, while callers
        // still receive no Auth-provider detail or delivery guarantee.
        await deps.finalizeOperation?.({ operationId: prepared.operationId, outcome: "uncertain" });
        return { operationId: prepared.operationId, membershipId: prepared.membershipId, outcome: "uncertain" as const };
      }
    },
    async reconcile(input: Record<string, unknown>): Promise<ReconciledAdminUserOperation> {
      if (!deps.reconcileOperation) throw new Error("admin user operation unavailable");
      return deps.reconcileOperation(input);
    },
    async reset(input: { email: string; operationId: string }) {
      if (!deps.resetPasswordForEmail) throw new Error("admin user operation unavailable");
      try {
        await deps.resetPasswordForEmail(input.email, { redirectTo: deps.invitationRedirectBase ?? "/auth/invite/confirm" });
        await deps.finalizeOperation?.({ operationId: input.operationId, outcome: "succeeded" });
        return { outcome: "succeeded" as const };
      } catch {
        await deps.finalizeOperation?.({ operationId: input.operationId, outcome: "uncertain" });
        return { outcome: "uncertain" as const };
      }
    },
  };
}

/** Server-only Supabase Auth administration adapter. It is never imported by a client path. */
export function createRuntimeAdminUserService(deps: Omit<AdminUserServiceDependencies, "inviteUserByEmail" | "signInWithOtp" | "resetPasswordForEmail">) {
  const { url } = getSupabasePublicEnv();
  const credential = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!credential) throw new Error("admin user operation unavailable");
  const auth = createClient(url, credential, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  return createAdminUserService({
    ...deps,
    inviteUserByEmail: async (email, options) => {
      const { error } = await auth.auth.admin.inviteUserByEmail(email, { redirectTo: options.redirectTo });
      if (error) throw error;
    },
    signInWithOtp: async (input) => {
      const { error } = await auth.auth.signInWithOtp(input);
      if (error) throw error;
    },
    resetPasswordForEmail: async (email, options) => {
      const { error } = await auth.auth.resetPasswordForEmail(email, { redirectTo: options.redirectTo });
      if (error) throw error;
    },
  });
}
