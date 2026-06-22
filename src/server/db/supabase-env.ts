/**
 * Reads the documented Supabase env-var contract by its EXACT established names
 * (`.env.example`, architecture §6). Do NOT rename these — the NAMES are the contract
 * (project-context.md "Critical Don't-Miss Rules"; .env.example).
 *
 * Only the two `NEXT_PUBLIC_`-prefixed values are read here. They are browser-safe by
 * design: the anon key relies on RLS for tenant isolation and grants no privileged
 * access on its own. The SERVICE-ROLE key is intentionally NOT read anywhere in this
 * story — auth + membership reads run as the authenticated user under the anon key + RLS
 * (architecture §6). The Story 2.1 service-role containment guard
 * (`scripts/verify/check-service-role-containment.mjs`) enforces that it never reaches a
 * client path.
 */

type SupabasePublicEnv = {
  readonly url: string;
  readonly anonKey: string;
};

/**
 * Resolve the public Supabase config from env. Throws a generic configuration error if a
 * required value is missing — this is a server/deploy misconfiguration, never surfaced
 * verbatim to an end user (the protected-route boundary maps any failure to a user-safe
 * state). The message names only the missing variable, never a secret value.
 */
export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!anonKey) {
    throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}
