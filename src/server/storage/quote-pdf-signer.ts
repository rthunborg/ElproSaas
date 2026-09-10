import { createClient } from "@supabase/supabase-js";
import {
  isPermanentStorageDenial,
  resolveSignedUrlTtlSeconds,
  type SignedAccess,
} from "./signed-access";
import { getSupabasePublicEnv } from "@/server/db/supabase-env";

/**
 * SERVER-ONLY broker for the one quote-PDF exception to generic Files.View.
 *
 * The service credential is deliberately confined here because Storage signs only for
 * persistent `storage.objects` SELECT. A Säljare must never receive that persistent
 * policy: `createQuotePdfSignedAccess` first obtains the locked, exact quote-PDF target
 * from the checked database RPC, then this module signs only that returned path, and the
 * second checked RPC records the fixed audit event before the URL is returned. No caller
 * input, request cookies, or arbitrary storage path reaches this broker.
 *
 * This repository does not install the optional `server-only` marker package; placement
 * below `src/server/` plus the service-role containment and built-bundle guards are the
 * enforceable boundary. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is documented in
 * docs/process/local-setup.md. The integration proof exercises both its audited positive
 * path and the raw Säljare Storage denial; this module must never be imported by a client
 * component or generalized into a file signer.
 */
export async function signValidatedQuotePdfForAccess(opts: {
  readonly bucket: "tenant-files";
  readonly objectPath: string;
  readonly nowIso: string;
}): Promise<SignedAccess | null> {
  const { url } = getSupabasePublicEnv();
  const credential = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!credential) {
    throw new Error("Quote PDF signing is not configured");
  }

  const client = createClient(url, credential, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ttl = resolveSignedUrlTtlSeconds();
  const { data, error } = await client.storage
    .from(opts.bucket)
    .createSignedUrl(opts.objectPath, ttl);
  if (error) {
    if (isPermanentStorageDenial(error)) return null;
    throw new Error("Quote PDF signing is temporarily unavailable");
  }
  if (!data || typeof data.signedUrl !== "string") return null;
  return {
    signedUrl: data.signedUrl,
    expiresAt: new Date(new Date(opts.nowIso).getTime() + ttl * 1000).toISOString(),
  };
}
