import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { resolveCapability } from "@/server/authz/permission-matrix";

export type EmailOutboxQueueItem = { readonly reference: string; readonly state: "queued" | "retry" | "failed" | "suppressed"; readonly attempts: number; readonly nextAttemptAt: string | null };

/** Admin operational projection. Recipient hashes, template params, and failure detail never leave this server read model. */
export async function readEmailOutboxQueue(options: { readonly roles?: readonly unknown[]; readonly client?: Awaited<ReturnType<typeof createSupabaseServerClient>> } = {}) {
  const context = await resolveTenantContext({ client: options.client });
  if (!context.ok) return { data: [] as EmailOutboxQueueItem[], error: { code: "FORBIDDEN" } };
  const roles = options.roles ?? context.data.roles ?? [context.data.role];
  if (!resolveCapability({ roles, module: "notifications", capability: "Notifications.View" }).granted) return { data: [] as EmailOutboxQueueItem[], error: { code: "FORBIDDEN" } };
  const db = options.client ?? await createSupabaseServerClient();
  const { data, error } = await db.rpc("read_email_outbox_queue", { p_tenant_id: context.data.tenantId });
  if (error) return { data: [] as EmailOutboxQueueItem[], error: { code: "UNAVAILABLE" } };
  const items: EmailOutboxQueueItem[] = (data ?? []).map((row: { subject_type: string; subject_id: string; logical_period: string; state: string; attempts: number; next_attempt_at: string | null }) => {
    const state = row.state === "suppressed" ? "suppressed" : row.state === "failed" ? "failed" : row.attempts > 0 ? "retry" : "queued";
    return { reference: `${row.subject_type}:${row.subject_id}:${row.logical_period}`, state, attempts: Number(row.attempts), nextAttemptAt: state === "failed" || state === "suppressed" ? null : row.next_attempt_at ?? null };
  });
  return { data: items, error: null };
}
