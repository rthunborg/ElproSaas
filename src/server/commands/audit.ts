/**
 * Audit-write path (Story 2.3, AC3 / AC5; architecture §15, §6, ADR-A009).
 *
 * `writeAuditEvent` inserts EXACTLY ONE `audit_events` row for an auditable command
 * via the privileged `record_audit_event` SECURITY DEFINER Postgres function — NOT
 * a direct table INSERT (the app-runtime `authenticated` role has no INSERT grant on
 * `audit_events`, by design / append-only) and NOT a service-role client (which
 * would introduce a service-role path into the anon-key app runtime — a Stop
 * Condition / project-rule violation).
 *
 * The DEFINER function performs its OWN `is_active_tenant_member(p_tenant_id)` check
 * (so it can never write a cross-tenant audit row) and accepts the command
 * timestamp explicitly (H1 — the single captured instant governs `created_at`; the
 * function never calls `now()`).
 *
 * Metadata is sanitized through the allow-list (`sanitizeAuditMetadata`) BEFORE it
 * leaves the process, so forbidden content (secrets/.env/raw files/PII/full bodies)
 * can never reach the row (AC5 / R-010).
 */
import type { CommandExecuteContext } from "./envelope-core";
import { sanitizeAuditMetadata } from "./audit-metadata";
import { isUuid } from "./correlation";

/** The minimal DB surface the audit write needs: a PostgREST `.rpc(...)` caller. */
export type AuditDbClient = {
  rpc(
    fn: "record_audit_event",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

/** What an auditable command passes to `writeAuditEvent` (sanitized downstream). */
export type WriteAuditEventArgs = {
  readonly eventType: string;
  readonly targetType: string;
  readonly targetId: string | null;
  /** Raw caller metadata — sanitized to the allow-list before persistence. */
  readonly metadata?: unknown;
};

/**
 * Write one audit row using the resolved tenant/actor from `ctx`, the single command
 * timestamp from `ctx.clock`, and `ctx.correlationId`. THROWS on a DB/RPC error so
 * the envelope maps it to a transient `SERVER_ERROR` (fail closed — never report
 * success when the audit row was not persisted).
 */
export async function writeAuditEvent<I>(
  ctx: CommandExecuteContext<I, AuditDbClient>,
  command: string,
  args: WriteAuditEventArgs,
): Promise<void> {
  const { tenantContext, clock, correlationId, db } = ctx;
  const safeMetadata = sanitizeAuditMetadata(args.metadata);

  // `p_target_id` is `uuid` (nullable). A non-UUID-shaped target id (a client-derived
  // value) would make the DB cast throw `22P02` and collapse into an opaque
  // SERVER_ERROR. Apply the same UUID-shape guard as the correlation id: a non-UUID
  // target id is reduced to null (no single-row target) rather than forwarded raw.
  // [Review][Patch][High]
  const safeTargetId =
    typeof args.targetId === "string" && isUuid(args.targetId)
      ? args.targetId
      : null;

  const { error } = await db.rpc("record_audit_event", {
    p_tenant_id: tenantContext.tenantId,
    p_actor_user_id: tenantContext.userId,
    p_command: command,
    p_event_type: args.eventType,
    p_target_type: args.targetType,
    p_target_id: safeTargetId,
    p_correlation_id: correlationId,
    p_metadata: safeMetadata,
    // H1: the ONE command instant — never the DB's now().
    p_created_at: clock.now().toISOString(),
  });

  if (error) {
    // Surface as a throw; the envelope's try/catch maps it to SERVER_ERROR.
    // The message stays internal — it never crosses the typed Result boundary.
    throw new Error(`record_audit_event failed: ${error.message}`);
  }
}
