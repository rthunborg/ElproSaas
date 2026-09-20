import { createSupabaseServerClient } from "@/server/db/supabase-server-client";

export const OPERATOR_ACCESS_DENIED = "OPERATOR_ACCESS_DENIED" as const;

export type PlatformOperatorResolution =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly code: typeof OPERATOR_ACCESS_DENIED };

/**
 * Revalidates the cookie-bound identity and checks the database allow-list for
 * every platform entry. Metadata and JWT claims are deliberately not authority.
 */
export async function resolvePlatformOperator(): Promise<PlatformOperatorResolution> {
  try {
    const client = await createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return { ok: false, code: OPERATOR_ACCESS_DENIED };

    const { data, error } = await client.rpc("is_platform_operator");
    if (error || data !== true) return { ok: false, code: OPERATOR_ACCESS_DENIED };
    return { ok: true, userId: userData.user.id };
  } catch {
    return { ok: false, code: OPERATOR_ACCESS_DENIED };
  }
}
