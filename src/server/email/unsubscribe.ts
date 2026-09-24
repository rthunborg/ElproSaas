import { createHash, randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
export { trustedUnsubscribeIp } from "./unsubscribe-ip";

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");


export function createUnsubscribeToken(entropyBytes = 32): { readonly plaintextToken: string; readonly tokenHash: string } {
  const plaintextToken = randomBytes(entropyBytes).toString("hex");
  return { plaintextToken, tokenHash: hash(plaintextToken) };
}

export async function issueUnsubscribeToken(input: { readonly tenantId: string; readonly recipientHash: string; readonly category: string; readonly entropyBytes?: number }) {
  const issued = createUnsubscribeToken(input.entropyBytes ?? 32);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("issue_email_unsubscribe_token", { p_tenant_id: input.tenantId, p_recipient_hash: input.recipientHash, p_category: input.category, p_token_hash: issued.tokenHash });
  if (error || typeof data !== "string") throw new Error("Could not issue unsubscribe token");
  return { plaintextToken: issued.plaintextToken, persisted: { id: data, tokenHash: issued.tokenHash, tenantId: input.tenantId, category: input.category } };
}

export async function revokeUnsubscribeToken(token: string): Promise<void> {
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("revoke_email_unsubscribe_token", { p_token_hash: hash(token) });
  if (error) throw new Error("Could not revoke unsubscribe token");
}

export async function handleUnsubscribeRequest(input: { readonly token: string; readonly ip: string; readonly reactivate?: boolean }) {
  if (!/^[a-f0-9]{64}$/i.test(input.token)) return { status: 200, body: { state: "inactive" as const } };
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("consume_email_unsubscribe_token", { p_token_hash: hash(input.token), p_ip_hash: hash(input.ip), p_reactivate: input.reactivate === true });
  if (error || data === "inactive") return { status: 200, body: { state: "inactive" as const } };
  if (data === "limited") return { status: 429, headers: { "retry-after": "3600" }, body: { state: "limited" as const } };
  return { status: 200, body: { state: data === "resubscribed" ? "resubscribed" as const : "unsubscribed" as const } };
}
