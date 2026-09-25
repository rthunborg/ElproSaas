import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/server/db/supabase-env";

/** The service credential is intentionally confined to src/server/jobs. */
export function createJobsServiceClient(): SupabaseClient {
  const credential = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!credential) throw new Error("Background runner is not configured");
  const { url } = getSupabasePublicEnv();
  return createClient(url, credential, { auth: { autoRefreshToken: false, persistSession: false } });
}
