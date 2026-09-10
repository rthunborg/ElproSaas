import { createHash } from "node:crypto";

type AcceptanceInput = {
  membershipId?: unknown;
  attemptToken?: unknown;
  // Compatibility-only fields from the red-phase test scaffold. Authority always
  // comes from the verified Auth session below, never from these values.
  tenantId?: unknown;
  authenticatedUserId?: unknown;
  authenticatedEmail?: unknown;
};
type AcceptanceDependencies = {
  currentUser: () => Promise<{ id: string; email?: string | null } | null>;
  accept: (input: { membershipId: string; tokenHash: string; userId: string; email: string }) => Promise<boolean>;
};

const denied = { ok: false as const, code: "INVITATION_NOT_ACCEPTABLE" as const };

async function runtimeDependencies(): Promise<AcceptanceDependencies> {
  const { createSupabaseServerClient } = await import("@/server/db/supabase-server-client");
  const client = await createSupabaseServerClient();
  return {
    async currentUser() {
      const { data } = await client.auth.getUser();
      return data.user ? { id: data.user.id, email: data.user.email } : null;
    },
    async accept(input) {
      const { data, error } = await client.rpc("admin_accept_membership_invitation", {
        p_membership_id: input.membershipId,
        p_token_hash: input.tokenHash,
        p_user_id: input.userId,
        p_email: input.email,
      });
      return !error && data === true;
    },
  };
}

/**
 * Invited access is granted only by the database procedure after the Auth session
 * is verified. The route callback supplies no tenant or user authority.
 */
export async function acceptInvitation(input: AcceptanceInput, dependencies?: AcceptanceDependencies) {
  if (typeof input.membershipId !== "string" || typeof input.attemptToken !== "string") return denied;
  const deps = dependencies ?? await runtimeDependencies();
  const user = await deps.currentUser();
  if (!user?.email) return denied;
  const tokenHash = createHash("sha256").update(input.attemptToken).digest("hex");
  try {
    const accepted = await deps.accept({ membershipId: input.membershipId, tokenHash, userId: user.id, email: user.email.toLowerCase() });
    return accepted ? { ok: true as const, status: "active" as const, membershipId: input.membershipId } : denied;
  } catch {
    return denied;
  }
}
