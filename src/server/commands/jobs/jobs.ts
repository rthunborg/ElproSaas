/**
 * Job commands (Story 7.3, Task 4; architecture §5 command table).
 *
 * `updateJob` — the ONLY job mutation 7.3 exposes: the minimal Phase-A-safe allowed edit
 * (title / status / planned dates). A `defineCommand` through the EXISTING envelope (resolve user →
 * resolve active tenant_admin → validate typed input → verify ownership → execute via the RLS
 * client → append-only audit → typed Result). No bespoke auth/error/audit mechanism. Patterned on
 * `updateCustomer` / `updateFacility` (`crm/*`), FUSED with `acceptQuoteAndCreateJob`'s CONDITIONAL
 * self-audit (audit only on a REAL state change).
 *
 * There is NO create / delete / archive affordance from 7.3: a job is ONLY created by the 7.2
 * acceptance transaction, and delete is not granted (archive-over-delete; the DB withholds DELETE).
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the appended
 *   `job_events` row's `tenant_id`; a client-supplied tenant_id is ignored.
 * - Mutations run on the request-bound RLS client (`ctx.db`); the own-tenant UPDATE policy +
 *   `is_tenant_admin` WITH CHECK keep them in-tenant.
 * - The UPDATE touches ONLY the four Phase-A-safe columns, so the COMING 7.4 `jobs` immutability
 *   trigger does not fire on an allowed edit (same 6.1→6.4 additive pattern). The immutable
 *   commitment/source fields are not in the input shape (the validator rejects them) — a client
 *   cannot smuggle them.
 * - The empty-patch short-circuit (the epic-3/epic-5 deferral fix): an id-only call (no editable
 *   field) returns the target id unchanged WITHOUT any write AND WITHOUT an audit row (a no-op is
 *   not a mutation). The command is therefore NOT envelope-auditable — it writes its OWN audit row
 *   inside execute ONLY when a real UPDATE happened (mirrors acceptQuoteAndCreateJob's R-710 pattern).
 * - A status change appends ONE `job_events` lifecycle row (`event_type` = the new status,
 *   `occurred_at` = the injected `ctx.clock.now()` — H1 determinism, never `Date.now()`).
 * - Audit metadata carries ONLY the allow-listed `{ targetId }` — NO PII / price / customer / title
 *   (audit-hygiene, R-710).
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { writeAuditEvent } from "../audit";
import type { CommandExecuteContext } from "../envelope-core";
import type { CommandDbClient } from "../envelope";
import {
  asJobWriteClient,
  loadJobStatus,
  throwMappedJobWriteError,
} from "./jobs-db";
import { validateUpdateJob, type UpdateJobInput } from "./validation";

/** Every job command returns the affected row id under `targetId`. */
export interface JobCommandResult {
  readonly targetId: string;
}

const JOB_UPDATE_COMMAND = "job.update";
const JOB_UPDATE_EVENT = "job.updated";
const JOB_TARGET_TYPE = "job";

/** Build the UPDATE patch for a job (ONLY the supplied Phase-A-safe fields). */
function buildJobPatch(input: UpdateJobInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.status !== undefined) patch.status = input.status;
  if (input.planned_start_date !== undefined)
    patch.planned_start_date = input.planned_start_date;
  if (input.planned_end_date !== undefined)
    patch.planned_end_date = input.planned_end_date;
  return patch;
}

export const updateJob = defineCommand<UpdateJobInput, JobCommandResult>({
  command: JOB_UPDATE_COMMAND,
  // NOT envelope-auditable: the command writes its own audit row ITSELF, and ONLY when a real
  // UPDATE happened — an empty-patch no-op produces no state change and must write NO audit row.
  auditable: false,
  eventType: JOB_UPDATE_EVENT,
  targetType: JOB_TARGET_TYPE,
  validateInput: validateUpdateJob,
  // Ownership: the target job must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent id → zero rows → TENANT_ACCESS_DENIED (envelope verify), no existence disclosure.
  ownership: (input) => ({ table: "jobs", id: input.id }),
  execute: async (ctx): Promise<JobCommandResult> => {
    const db = ctx.db;
    const patch = buildJobPatch(ctx.input);

    // Empty-patch short-circuit: no editable field supplied ⇒ return the target id unchanged
    // WITHOUT any write or audit (the no-op guard prevents a `.update({})` false-deny AND keeps a
    // no-op out of the audit log).
    if (Object.keys(patch).length === 0) {
      return { targetId: ctx.input.id };
    }

    // Detect a status change (to decide whether to append a job_events lifecycle row). Read the
    // CURRENT status under the caller's RLS BEFORE the update. Ownership already proved visibility;
    // a null here is a race → deny.
    let statusChanged = false;
    if (ctx.input.status !== undefined) {
      const current = await loadJobStatus(db, ctx.input.id);
      if (current === null) throw new CommandError("TENANT_ACCESS_DENIED");
      statusChanged = current !== ctx.input.status;
    }

    const client = asJobWriteClient(db);
    const { data, error } = await client
      .from("jobs")
      .update(patch)
      .eq("id", ctx.input.id)
      .select("id");
    if (error) throwMappedJobWriteError(error);
    // Ownership already proved the row is visible; a zero-row update here would be a race (row
    // archived/removed between verify and update) → deny rather than 500.
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }

    // Append ONE job_events lifecycle row WHEN the status changed. occurred_at = the injected clock
    // instant (H1). tenant_id = the resolved tenant (never client-supplied); the own-tenant INSERT
    // WITH CHECK + the composite same-tenant FK to jobs keep it in-tenant.
    if (statusChanged && ctx.input.status !== undefined) {
      const { error: eventError } = await client.from("job_events").insert({
        tenant_id: ctx.tenantContext.tenantId,
        job_id: ctx.input.id,
        event_type: ctx.input.status,
        occurred_at: ctx.clock.now().toISOString(),
      });
      if (eventError) throwMappedJobWriteError(eventError);
    }

    // Write EXACTLY ONE append-only audit row for this real update. The job id is the audit row's
    // `target_id` column; the `metadata` is EMPTY-shaped ({}) — the sanitizer allow-list drops
    // everything not pre-approved, so NO PII / price / customer / title can reach the row (R-710).
    // A no-op returned above, so this fires ONLY on a genuine mutation.
    await writeAuditEvent(
      ctx as CommandExecuteContext<unknown, CommandDbClient>,
      JOB_UPDATE_COMMAND,
      {
        eventType: JOB_UPDATE_EVENT,
        targetType: JOB_TARGET_TYPE,
        targetId: ctx.input.id,
        metadata: {},
      },
    );

    return { targetId: ctx.input.id };
  },
});
