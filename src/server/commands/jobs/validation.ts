/**
 * PURE job command input validators (Story 7.3, Task 4.1; architecture §5 step 4).
 *
 * `validateUpdateJob` returns a `ValidationResult<UpdateJobInput>` — the validated, narrowed value
 * or `VALIDATION_FAILED`. The raw invalid value is NEVER echoed (the envelope maps the failure to a
 * generic user-safe message). Pure (no I/O) so the Phase-A-safe field rules are exhaustively
 * unit-testable WITHOUT a database, mirroring `crm/validation.ts`.
 *
 * ── PHASE-A-SAFE EDIT SURFACE ONLY (AC4) ────────────────────────────────────────────────────────
 * The ONLY editable fields are `title`, `status` (within the CLOSED `created|in_progress|done|
 * cancelled` set), `planned_start_date`, `planned_end_date` (+ the target `id`). The IMMUTABLE
 * commitment/source fields (`quote_version_id` / `quote_acceptance_id` / `customer_id` /
 * `accepted_price_ore` / `evidence_*` / `accepted_at` / `channel` / `tenant_id`) are NOT part of the
 * input shape — a client cannot smuggle them: the validator REJECTS any key outside the allow-list
 * with `VALIDATION_FAILED` (a hard "unknown field" reject, not a silent ignore — AC4), and the
 * `execute` patch is built ONLY from the four allow-listed fields. Client-supplied `tenant_id` is
 * NEVER read (the resolved tenant is the only authority). Keeping the UPDATE to the four columns also
 * keeps the coming 7.4 `jobs` immutability trigger from firing on an allowed edit (same 6.1→6.4
 * additive pattern).
 */
import type { ValidationResult } from "../envelope-core";

/** The CLOSED allow-list of keys `updateJob` accepts (the target id + the four Phase-A-safe fields).
 * Any key outside this set is a smuggle attempt for an immutable/commitment field → VALIDATION_FAILED. */
const ALLOWED_KEYS = new Set([
  "id",
  "title",
  "status",
  "planned_start_date",
  "planned_end_date",
]);

/** The CLOSED Phase-A job status set (a MINIMAL order lifecycle — NOT field-worker states). */
export const JOB_STATUS_VALUES = [
  "created",
  "in_progress",
  "done",
  "cancelled",
] as const;
export type JobStatusValue = (typeof JOB_STATUS_VALUES)[number];

/** Validated `updateJob` input — `id` + the four Phase-A-safe fields (all optional). */
export interface UpdateJobInput {
  readonly id: string;
  readonly title?: string | null;
  readonly status?: JobStatusValue;
  readonly planned_start_date?: string | null;
  readonly planned_end_date?: string | null;
}

const fail = { ok: false as const, code: "VALIDATION_FAILED" as const };

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === "object";
}

/** A UUID-shape guard so an `id` the DB would reject (`22P02`) fails as VALIDATION. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(v: unknown): v is string {
  return typeof v === "string" && v.length <= 36 && UUID_RE.test(v);
}

/** An ISO calendar-date guard (`YYYY-MM-DD`) so a malformed date fails as VALIDATION, not `22P02`. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !ISO_DATE_RE.test(v)) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

/** Max length for the (defensively bounded) job title. */
const MAX_TITLE = 256;

/** True iff `v` is present (non-undefined, non-null). */
function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null;
}

export function validateUpdateJob(raw: unknown): ValidationResult<UpdateJobInput> {
  if (!isRecord(raw)) return fail;
  if (!isUuidLike(raw.id)) return fail;
  // Hard-reject any key outside the allow-list — an immutable/commitment field cannot be smuggled
  // (AC4). This is stricter than the CRM update validators (which ignore extras) BY DESIGN, because
  // the whole point of 7.3 is that no source/commitment field is editable via this command.
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) return fail;
  }

  // title: OPTIONAL. When present it must be a bounded string OR an explicit clear (empty → null).
  let title: string | null | undefined;
  if ("title" in raw && isPresent(raw.title)) {
    if (typeof raw.title !== "string" || raw.title.length > MAX_TITLE) return fail;
    const trimmed = raw.title.trim();
    title = trimmed.length > 0 ? trimmed : null;
  } else if ("title" in raw && raw.title === null) {
    title = null;
  }

  // status: OPTIONAL. When present it MUST be in the closed Phase-A set (any non-lifecycle /
  // field-worker state value is rejected here).
  let status: JobStatusValue | undefined;
  if ("status" in raw && isPresent(raw.status)) {
    if (
      typeof raw.status !== "string" ||
      !(JOB_STATUS_VALUES as readonly string[]).includes(raw.status)
    ) {
      return fail;
    }
    status = raw.status as JobStatusValue;
  }

  // planned dates: OPTIONAL. When present, an ISO calendar date OR an explicit clear (null).
  let plannedStart: string | null | undefined;
  if ("planned_start_date" in raw && isPresent(raw.planned_start_date)) {
    if (!isIsoDate(raw.planned_start_date)) return fail;
    plannedStart = raw.planned_start_date as string;
  } else if ("planned_start_date" in raw && raw.planned_start_date === null) {
    plannedStart = null;
  }

  let plannedEnd: string | null | undefined;
  if ("planned_end_date" in raw && isPresent(raw.planned_end_date)) {
    if (!isIsoDate(raw.planned_end_date)) return fail;
    plannedEnd = raw.planned_end_date as string;
  } else if ("planned_end_date" in raw && raw.planned_end_date === null) {
    plannedEnd = null;
  }

  // Cross-field ordering: when BOTH planned dates are present (non-null), the end must not precede
  // the start (an inverted range is a nonsensical planning window). ISO `YYYY-MM-DD` strings compare
  // lexicographically as calendar dates, so a plain string `>=` is a correct ordering check.
  if (
    typeof plannedStart === "string" &&
    typeof plannedEnd === "string" &&
    plannedEnd < plannedStart
  ) {
    return fail;
  }

  const value: UpdateJobInput = {
    id: raw.id as string,
    ...(title !== undefined ? { title } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(plannedStart !== undefined ? { planned_start_date: plannedStart } : {}),
    ...(plannedEnd !== undefined ? { planned_end_date: plannedEnd } : {}),
  };
  return { ok: true, data: value };
}
