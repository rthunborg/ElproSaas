"use server";

/**
 * Job-detail server actions (Story 7.3, Task 4.5) — the ONLY write path the job-detail UI uses.
 * This `"use server"` action wires the React 19 `useActionState` form pattern to the EXISTING
 * `updateJob` envelope command. The mutation goes through
 * `runCommand(updateJob, { client: createSupabaseServerClient(), input })`:
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY — NEVER a
 *     service-role key; the containment guards enforce this). It NEVER writes a job table directly
 *     — only the command writes, and only after the server-side validate → ownership gates.
 *   - `input` is the raw parsed form values (ONLY the four Phase-A-safe fields). The command's
 *     `validateInput` (which REJECTS any unknown/immutable field) is the authority; the client-side
 *     read-only rendering of the immutable refs is a UX nicety, not the guarantee.
 *
 * The typed `Result` is mapped to a `JobActionState`: `ok` revalidates the detail + list paths;
 * `VALIDATION_FAILED`/`TENANT_ACCESS_DENIED` are generic messages; a transient `SERVER_ERROR` is a
 * RETRYABLE failure. Since 2026-07-14 (owner decision) `createJobAction` adds the STANDALONE
 * create path (the `createJob` command — NULL source refs, no connect-later mechanism); delete /
 * archive still have NO surface. NO new auth/error/audit mechanism, NO direct table write.
 */
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { runCommand, type CommandDbClient } from "@/server/commands/envelope";
import { COMMAND_MESSAGES } from "@/server/commands/command-errors";
import { createJob, updateJob } from "@/server/commands/jobs";
import { createSignedFileAccess } from "@/server/commands/files";
import { JOB_ACTION_INITIAL, type JobActionState } from "./action-state";
import {
  JOB_EVIDENCE_PREVIEW_INITIAL,
  type JobEvidencePreviewState,
} from "./evidence-preview-state";

/** Read a string form field, treating a present-but-empty value as an explicit clear (null). */
function clearableText(form: FormData, name: string): string | null | undefined {
  const v = form.get(name);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The job allowed-edit action (React `useActionState` signature: (prevState, formData)). Wires the
 * job edit form to the `updateJob` command. ONLY the four Phase-A-safe fields are read from the form
 * — the immutable source/commitment fields are NEVER accepted (the command validator rejects them).
 */
export async function updateJobAction(
  _prev: JobActionState,
  form: FormData,
): Promise<JobActionState> {
  const jobId = form.get("id");
  const values: Record<string, string> = {};

  const input: Record<string, unknown> = { id: jobId };
  // Only carry a field the form actually submitted (an absent field = unchanged).
  if (form.has("title")) {
    const title = clearableText(form, "title");
    input.title = title;
    if (typeof title === "string") values.title = title;
  }
  if (form.has("status")) {
    const status = form.get("status");
    if (typeof status === "string" && status.length > 0) {
      input.status = status;
      values.status = status;
    }
  }
  if (form.has("planned_start_date")) {
    const start = clearableText(form, "planned_start_date");
    input.planned_start_date = start;
    if (typeof start === "string") values.planned_start_date = start;
  }
  if (form.has("planned_end_date")) {
    const end = clearableText(form, "planned_end_date");
    input.planned_end_date = end;
    if (typeof end === "string") values.planned_end_date = end;
  }

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(updateJob, { client, input });

  if (result.ok) {
    revalidatePath("/jobs");
    if (typeof jobId === "string" && jobId.length > 0) {
      revalidatePath(`/jobs/${jobId}`);
    }
    return {
      ...JOB_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...JOB_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
    values,
  };
}

/**
 * The standalone-create action (owner decision 2026-07-14; React `useActionState` signature) —
 * the ONLY write path the `/jobs` list's "Skapa nytt jobb" form uses. Wires the form to the
 * `createJob` envelope command: ONLY customer_id + the optional title/planned dates are read from
 * the form — source refs / status / tenant_id are NEVER accepted (the command validator hard-rejects
 * any unknown key; the resolved tenant is the only tenant authority). On success revalidates
 * `/jobs` and returns the new job id so the list island can `router.push('/jobs/{id}')`.
 */
export async function createJobAction(
  _prev: JobActionState,
  form: FormData,
): Promise<JobActionState> {
  const values: Record<string, string> = {};
  const input: Record<string, unknown> = { customer_id: form.get("customer_id") };
  const customerIdRaw = form.get("customer_id");
  if (typeof customerIdRaw === "string") values.customer_id = customerIdRaw;
  // Only carry a field the form actually submitted with a value (absent = born NULL).
  const title = clearableText(form, "title");
  if (typeof title === "string") {
    input.title = title;
    values.title = title;
  }
  const plannedStart = clearableText(form, "planned_start_date");
  if (typeof plannedStart === "string") {
    input.planned_start_date = plannedStart;
    values.planned_start_date = plannedStart;
  }
  const plannedEnd = clearableText(form, "planned_end_date");
  if (typeof plannedEnd === "string") {
    input.planned_end_date = plannedEnd;
    values.planned_end_date = plannedEnd;
  }

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(createJob, { client, input });

  if (result.ok) {
    // Revalidate the list AND the new detail route (the list+detail discipline the quote
    // actions follow) — the island lands the admin on `/jobs/{id}` right after.
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${result.data.targetId}`);
    return {
      ...JOB_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...JOB_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
    values,
  };
}

/**
 * The evidence preview action (React `useActionState` signature). Mints a SHORT-LIVED SIGNED URL
 * for the job's linked evidence file via the EXISTING `createSignedFileAccess` command (RLS-scoped
 * signing — a cross-tenant/anon caller is denied at the DB; never a public URL). Reuses the 8.1
 * signed-access funnel VERBATIM — 7.3 builds NO competing file/evidence store (R-814 STOP). Only
 * shown when the acceptance carries an evidence FILE (an external `evidence_reference` is plain text
 * and needs no signing). The signed URL lives only in the returned state (never logged).
 */
export async function previewJobEvidenceAction(
  _prev: JobEvidencePreviewState,
  form: FormData,
): Promise<JobEvidencePreviewState> {
  const fileId = form.get("file_id");
  const input: Record<string, unknown> = { file_id: fileId };

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(createSignedFileAccess, { client, input });

  if (result.ok) {
    return {
      ...JOB_EVIDENCE_PREVIEW_INITIAL,
      status: "success",
      signedUrl: result.data.signedUrl,
      expiresAt: result.data.expiresAt,
    };
  }

  return {
    ...JOB_EVIDENCE_PREVIEW_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}
