/**
 * Server-side job/order reads for the list + detail (Story 7.3, Task 1) — the RLS-scoped read
 * path the `/jobs` pages call. SERVER-ONLY (no `"use server"` action surface): plain async
 * functions invoked from server components, mirroring `src/features/quotes/read.ts` VERBATIM.
 *
 * EVERY read runs on the per-request, cookie-bound RLS client (anon key — NEVER a service-role
 * key). RLS scopes every row to the caller's tenant with NO tenant id passed (architecture §6);
 * a cross-tenant/nonexistent id simply returns zero rows → a GENERIC not-found (the page NEVER
 * reveals whether the row exists in another tenant). NO direct write, NO service-role client.
 *
 * ── DISPLAY THE IMMUTABLE ACCEPTED REF — NEVER RE-DERIVE (R-708; AC1 Money HIGH) ───────────────
 * The accepted price + source sent total the detail surfaces are read VERBATIM from the FROZEN,
 * immutable `quote_acceptances` row the 7.2 transaction wrote — this read layer NEVER re-reads the
 * live calc/settings/pricing to re-derive a total (the copy-by-value freeze; R-708 is the 7.3
 * analog of 6.2's R-616). The FROZEN commitment customer/facility/contact DISPLAY names come from
 * the `quote_versions` snapshot (captured at send time), NEVER a live re-derive. The ONE value that
 * intentionally tracks the current CRM is the `currentCustomerName` join via `jobs.customer_id` (the
 * live-CRM link — distinct from the frozen commitment snapshot; per the 7.2 retro-note the
 * `jobs.customer_id` is the authoritative id for the live customer).
 *
 * `pg`/PostgREST returns `bigint` öre as STRINGS — coerce (`Number(...)`) at THIS read boundary so
 * displayed öre are numbers downstream; DB snake_case → TS camelCase happens here too.
 *
 * PRIVATE-DATA posture (inherited epic-3/epic-6): only DISPLAY names are selected — NEVER a
 * personnummer (the frozen version snapshot + the live customer join both surface display fields
 * only; no pnr is ever selected here).
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import type {
  JobDetail,
  JobDetailReadResult,
  JobEventRow,
  JobFileRow,
  JobListFilters,
  JobListReadResult,
  JobListRow,
  JobStatus,
} from "./types";

// Re-export the pure types + the JOB_STATUSES value from the boundary-clean `types.ts` so existing
// importers of `@/features/jobs/read` keep working, while client islands import them from `types.ts`
// directly (this module imports the server-only RLS client and must never reach the client bundle).
export type {
  JobDetail,
  JobDetailReadResult,
  JobEventRow,
  JobFileRow,
  JobListFilters,
  JobListReadResult,
  JobListRow,
  JobStatus,
} from "./types";
export { JOB_STATUSES } from "./types";

/** The minimal RLS-client read surface the job read layer drives (structurally satisfied by the
 * real `@supabase/ssr` server client AND the test anon-key client). */
export type JobReadClient = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        limit(n: number): Promise<{ data: unknown[] | null; error: unknown }>;
        order(
          column: string,
          opts: { ascending: boolean },
        ): Promise<{ data: unknown[] | null; error: unknown }>;
      };
      is(
        column: string,
        value: null,
      ): {
        order(
          column: string,
          opts: { ascending: boolean },
        ): Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
};

const GENERIC_READ_ERROR =
  "Ett tillfälligt fel inträffade. Försök igen om en stund.";

/** Coerce a `bigint` öre that PostgREST may return as a STRING into a JS number (or null). */
function oreNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Coerce a plain numeric field (may arrive as a string) into a number (or null). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Job LIST projection (the `/jobs` Jobb/Order index).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the ACTIVE job list (`archived_at is null`), ordered by `updated_at` desc. RLS scopes to the
 * caller's tenant (NO tenant id passed). Projects the thin index columns + the joined CURRENT
 * customer display name (own-tenant `customers` embed) + the source quote number (via the version
 * embed). Optional filters are applied in-memory over the tenant-scoped rows (the index is thin —
 * the tenant's job count is small in Phase A). On a query error returns a GENERIC message.
 */
export async function readJobList(
  filters?: JobListFilters,
  injectedClient?: JobReadClient,
): Promise<JobListReadResult> {
  try {
    const client =
      injectedClient ??
      ((await createSupabaseServerClient()) as unknown as JobReadClient);
    const { data, error } = await client
      .from("jobs")
      .select(
        "id, title, status, planned_start_date, planned_end_date, customer_id, updated_at, quote_version_id, customers(display_name), quote_versions(quote_number, quote_id)",
      )
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) return { rows: [], error: GENERIC_READ_ERROR };
    let rows: JobListRow[] = ((data ?? []) as Record<string, unknown>[]).map(
      (r) => {
        const customer = Array.isArray(r.customers)
          ? (r.customers[0] as { display_name?: unknown } | undefined)
          : (r.customers as { display_name?: unknown } | null);
        const version = Array.isArray(r.quote_versions)
          ? (r.quote_versions[0] as
              | { quote_number?: unknown; quote_id?: unknown }
              | undefined)
          : (r.quote_versions as
              | { quote_number?: unknown; quote_id?: unknown }
              | null);
        return {
          id: String(r.id),
          title: str(r.title),
          status: (str(r.status) as JobStatus) ?? "created",
          plannedStartDate: str(r.planned_start_date),
          plannedEndDate: str(r.planned_end_date),
          customerId: str(r.customer_id),
          customerDisplayName: str(customer?.display_name) ?? null,
          quoteId: str(version?.quote_id) ?? null,
          quoteVersionId: str(r.quote_version_id),
          quoteNumber: version ? num(version.quote_number) : null,
          updatedAt: String(r.updated_at),
        };
      },
    );
    rows = applyJobFilters(rows, filters);
    return { rows, error: null };
  } catch {
    return { rows: [], error: GENERIC_READ_ERROR };
  }
}

/** Apply the optional AC2 filters over the tenant-scoped rows (thin index — in-memory is fine). */
function applyJobFilters(
  rows: readonly JobListRow[],
  filters?: JobListFilters,
): JobListRow[] {
  if (!filters) return [...rows];
  return rows.filter((row) => {
    if (filters.customerId && row.customerId !== filters.customerId) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.quoteId && row.quoteId !== filters.quoteId) return false;
    if (filters.quoteVersionId && row.quoteVersionId !== filters.quoteVersionId)
      return false;
    if (filters.plannedFrom || filters.plannedTo) {
      const start = row.plannedStartDate;
      // A row with no planned start is excluded from a date-range filter (cannot match a bound).
      if (!start) return false;
      if (filters.plannedFrom && start < filters.plannedFrom) return false;
      if (filters.plannedTo && start > filters.plannedTo) return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Job DETAIL projection (the `/jobs/[jobId]` view).
// ─────────────────────────────────────────────────────────────────────────────

const JOB_COLUMNS =
  "id, title, status, planned_start_date, planned_end_date, quote_acceptance_id, quote_version_id, customer_id, customers(display_name)";

const ACCEPTANCE_COLUMNS =
  "id, quote_id, accepted_price_ore, source_sent_total_ore, channel, accepted_at, adjustment_reason, evidence_file_id, evidence_reference, notes";

const VERSION_COLUMNS =
  "id, quote_id, quote_number, customer_display_name, facility_name, contact_name";

const FILE_LINK_COLUMNS = "id, file_id, owner_type, purpose, files(display_name)";

const JOB_EVENT_COLUMNS = "id, event_type, occurred_at, channel, reference";

/**
 * Read one job/order by id: the `jobs` row (RLS-scoped; foreign/nonexistent ⇒ null ⇒ page 404),
 * then — from the IMMUTABLE source references — the accepted `quote_acceptances` row (money +
 * evidence + channel + accepted moment) and the source `quote_versions` snapshot (quote number +
 * FROZEN commitment display names), plus the linked `file_links` (owner_type='job') + evidence file
 * and the `job_events` history. Money is coerced to numbers; the frozen values are never re-derived.
 *
 * The `injectedClient` form (used by the INT source-of-truth proof) lets a test pass its own
 * RLS-bound client; the page-facing form constructs the per-request cookie-bound RLS client.
 */
export async function readJobDetail(
  client: JobReadClient,
  jobId: string,
): Promise<JobDetail | null> {
  // The `jobs` row (own-tenant RLS; the current-customer display via the embedded relationship).
  const { data: jobRows, error: jobErr } = await client
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .limit(1);
  if (jobErr) throw new Error("readJobDetail: job read failed");
  const jobRaw = (jobRows?.[0] ?? null) as Record<string, unknown> | null;
  if (!jobRaw) return null; // invisible under RLS (or absent) → generic not-found, no leak

  const currentCustomer = Array.isArray(jobRaw.customers)
    ? (jobRaw.customers[0] as { display_name?: unknown } | undefined)
    : (jobRaw.customers as { display_name?: unknown } | null);

  const acceptanceId = String(jobRaw.quote_acceptance_id);
  const versionId = String(jobRaw.quote_version_id);

  // The immutable acceptance row (money/evidence/channel) + the frozen version snapshot (names),
  // the linked job files, and the job events — all own-tenant RLS, in parallel.
  const [acceptanceRes, versionRes, filesRes, eventsRes] = await Promise.all([
    client
      .from("quote_acceptances")
      .select(ACCEPTANCE_COLUMNS)
      .eq("id", acceptanceId)
      .limit(1),
    client
      .from("quote_versions")
      .select(VERSION_COLUMNS)
      .eq("id", versionId)
      .limit(1),
    client
      .from("file_links")
      .select(FILE_LINK_COLUMNS)
      .eq("owner_id", jobId)
      .order("id", { ascending: true }),
    client
      .from("job_events")
      .select(JOB_EVENT_COLUMNS)
      .eq("job_id", jobId)
      .order("occurred_at", { ascending: true }),
  ]);
  if (acceptanceRes.error) throw new Error("readJobDetail: acceptance read failed");
  if (versionRes.error) throw new Error("readJobDetail: version read failed");
  if (filesRes.error) throw new Error("readJobDetail: file_links read failed");
  if (eventsRes.error) throw new Error("readJobDetail: job_events read failed");

  const acceptance = (acceptanceRes.data?.[0] ?? {}) as Record<string, unknown>;
  const version = (versionRes.data?.[0] ?? {}) as Record<string, unknown>;

  const files: JobFileRow[] = ((filesRes.data ?? []) as Record<string, unknown>[])
    // Only surface job-owned links (the owner_id query is scoped to this job; also assert the
    // owner_type is `job` so a same-UUID owner of another type could never surface here).
    .filter((l) => str(l.file_id) !== null && str(l.owner_type) === "job")
    .map((l) => {
      const file = Array.isArray(l.files)
        ? (l.files[0] as { display_name?: unknown } | undefined)
        : (l.files as { display_name?: unknown } | null);
      return {
        id: String(l.id),
        fileId: String(l.file_id),
        displayName: str(file?.display_name) ?? null,
        purpose: str(l.purpose),
      };
    });

  const events: JobEventRow[] = (
    (eventsRes.data ?? []) as Record<string, unknown>[]
  ).map((e) => ({
    id: String(e.id),
    eventType: String(e.event_type),
    occurredAt: String(e.occurred_at),
    channel: str(e.channel),
    reference: str(e.reference),
  }));

  return {
    id: String(jobRaw.id),
    title: str(jobRaw.title),
    status: (str(jobRaw.status) as JobStatus) ?? "created",
    plannedStartDate: str(jobRaw.planned_start_date),
    plannedEndDate: str(jobRaw.planned_end_date),
    quoteAcceptanceId: acceptanceId,
    quoteVersionId: versionId,
    quoteId: str(acceptance.quote_id) ?? str(version.quote_id) ?? null,
    quoteNumber: num(version.quote_number),
    customerId: str(jobRaw.customer_id),
    currentCustomerName: str(currentCustomer?.display_name) ?? null,
    commitmentCustomerName: str(version.customer_display_name),
    commitmentFacilityName: str(version.facility_name),
    commitmentContactName: str(version.contact_name),
    acceptedPriceOre: oreNumber(acceptance.accepted_price_ore) ?? 0,
    sourceSentTotalOre: oreNumber(acceptance.source_sent_total_ore) ?? 0,
    channel: str(acceptance.channel),
    acceptedAt: str(acceptance.accepted_at),
    adjustmentReason: str(acceptance.adjustment_reason),
    evidenceFileId: str(acceptance.evidence_file_id),
    evidenceReference: str(acceptance.evidence_reference),
    notes: str(acceptance.notes),
    files,
    events,
  };
}

/**
 * Page-facing job-detail read: constructs the per-request cookie-bound RLS client and returns the
 * `{ detail, error }` result shape the `/jobs/[jobId]` server page consumes (a foreign/nonexistent
 * id ⇒ `detail: null` ⇒ `notFound()`; a transient failure ⇒ the generic FAILED message).
 */
export async function readJobDetailForPage(
  jobId: string,
): Promise<JobDetailReadResult> {
  try {
    const client = (await createSupabaseServerClient()) as unknown as JobReadClient;
    const detail = await readJobDetail(client, jobId);
    return { detail, error: null };
  } catch {
    return { detail: null, error: GENERIC_READ_ERROR };
  }
}
