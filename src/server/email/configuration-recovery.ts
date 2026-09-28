import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/server/db/supabase-env";

/**
 * Server-only escape hatch for the one condition in which the normal recovery
 * attestation cannot exist: the quote-PDF HMAC is absent from this process.
 * The database grants this writer only to service_role; browser callers cannot
 * invoke it and the normal attested recovery RPC remains unchanged.
 */
export async function recordQuoteDeliveryConfigurationRecovery(input: {
  readonly tenantId: string;
  readonly quoteVersionId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
}): Promise<void> {
  const credential = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!credential) throw new Error("quote delivery configuration recovery is unavailable");
  const { url } = getSupabasePublicEnv();
  const client = createClient(url, credential, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.rpc("record_quote_email_delivery_configuration_recovery", {
    p_tenant_id: input.tenantId,
    p_quote_version_id: input.quoteVersionId,
    p_actor_user_id: input.actorUserId,
    p_correlation_id: input.correlationId,
  });
  if (error) throw new Error("quote delivery configuration recovery persistence failed");
}
