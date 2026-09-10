/**
 * `createJob` — STANDALONE job creation (owner decision 2026-07-14; spec
 * `spec-list-page-create-entry-points.md`).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → verify ownership of the target CUSTOMER → execute via the RLS client →
 * append-only envelope audit → typed Result). Mirrors `updateJob` / the CRM create commands — no
 * bespoke auth/error/audit mechanism.
 *
 * - The job is born with NULL source refs (`quote_acceptance_id` / `quote_version_id` are NOT in
 *   the input shape and NOT in the INSERT) — the 20260714 migration relaxed them to nullable, and
 *   the 7.4 `jobs_source_ref_lock` trigger keeps the tuple immutable (NULL→set is ALSO rejected:
 *   there is NO connect-standalone-to-quote-later mechanism; that is a future audited workflow).
 *   The 7.2 acceptance transaction remains the ONLY path that populates the refs.
 * - Ownership: the target customer must be visible under the caller's RLS (own tenant). A foreign /
 *   non-existent customer_id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (no existence
 *   disclosure). The composite same-tenant FK is the DB backstop.
 * - `tenant_id` is the RESOLVED tenant (`ctx.tenantContext.tenantId`) — a client-supplied
 *   tenant_id is rejected by the validator's closed key allow-list. `status` is ALWAYS 'created'
 *   (server-derived; the validator rejects a client-supplied status).
 * - ONE `job_events` 'created' lifecycle row is appended (occurred_at = the injected
 *   `ctx.clock.now()` — H1 determinism, never `Date.now()`), mirroring the 7.2 RPC's created event
 *   so a standalone job's history starts identically.
 * - ENVELOPE-auditable (unlike updateJob's conditional self-audit): a create is ALWAYS a real
 *   mutation, so the envelope writes exactly one `job.created` audit row. Metadata carries ONLY
 *   the allow-listed `{ targetId }` — NO PII / customer / title (audit-hygiene, R-710).
 */
import { defineCommand } from "../envelope";
import { executeJobAuditedMutation } from "./jobs-audit-db";
import { validateCreateJob, type CreateJobInput } from "./validation";
import type { JobCommandResult } from "./jobs";

const JOB_CREATE_COMMAND = "job.create";
const JOB_CREATE_EVENT = "job.created";
const JOB_TARGET_TYPE = "job";

export const createJob = defineCommand<CreateJobInput, JobCommandResult>({
  command: JOB_CREATE_COMMAND,
  // The checked RPC owns the insert, lifecycle event, and fixed audit row atomically.
  auditable: false,
  eventType: JOB_CREATE_EVENT,
  targetType: JOB_TARGET_TYPE,
  validateInput: validateCreateJob,
  // Ownership: the target CUSTOMER must be visible under the caller's RLS (own tenant). A
  // foreign / non-existent id → zero rows → TENANT_ACCESS_DENIED (envelope verify), BEFORE execute.
  ownership: (input) => ({ table: "customers", id: input.customer_id }),
  execute: async (ctx): Promise<JobCommandResult> => {
    const jobId = await executeJobAuditedMutation(ctx.db, "create_job_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId, p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId, p_customer_id: ctx.input.customer_id,
      p_title: ctx.input.title ?? null, p_planned_start_date: ctx.input.planned_start_date ?? null,
      p_planned_end_date: ctx.input.planned_end_date ?? null, p_occurred_at: ctx.clock.now().toISOString(),
    });

    /* Legacy direct-RLS implementation retained below only while this migration is
       being composed; the audited RPC above is the live path. */
    /*
    // tenant (never client-supplied); the own-tenant INSERT WITH CHECK + the composite same-tenant
    // customer FK keep it in-tenant. Source refs are OMITTED (born NULL — standalone).
    const { data, error } = await client
      .from("jobs")
      .insert({
        tenant_id: ctx.tenantContext.tenantId,
        customer_id: ctx.input.customer_id,
        status: "created",
        ...(ctx.input.title !== undefined ? { title: ctx.input.title } : {}),
        ...(ctx.input.planned_start_date !== undefined
          ? { planned_start_date: ctx.input.planned_start_date }
          : {}),
        ...(ctx.input.planned_end_date !== undefined
          ? { planned_end_date: ctx.input.planned_end_date }
          : {}),
      })
      .select("id");
    if (error) throwMappedJobWriteError(error);
    const jobId = (data?.[0] as { id?: unknown } | undefined)?.id;
    if (typeof jobId !== "string") {
      // Ownership proved the customer visible; a zero-row insert return here is an RLS/race
      // anomaly — deny rather than 500 (mirrors updateJob's zero-row posture).
      throw new CommandError("TENANT_ACCESS_DENIED");
    }

    // Append the ONE 'created' lifecycle row (mirrors the 7.2 RPC's created event). occurred_at =
    // the injected clock instant (H1). tenant_id = the resolved tenant; the composite same-tenant
    // FK to jobs keeps it in-tenant.
    const { error: eventError } = await client.from("job_events").insert({
      tenant_id: ctx.tenantContext.tenantId,
      job_id: jobId,
      event_type: "created",
      occurred_at: ctx.clock.now().toISOString(),
    });
    if (eventError) throwMappedJobWriteError(eventError);

    */
    return { targetId: jobId };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});
