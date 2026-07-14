/**
 * PURE job/order view-model types + constants (Story 7.3) — NO server imports, so client islands
 * (`JobList`, `JobEditDialog`) can import the `JOB_STATUSES` runtime value + the row/detail types
 * WITHOUT pulling the server-only RLS client into the client bundle (`read.ts` re-exports these,
 * and imports the server client — which must never reach the browser). This mirrors the type/const
 * split other feature modules use to keep the server/client boundary clean.
 */

/** The closed Phase-A job status set (a MINIMAL order lifecycle — NOT field-worker states). */
export const JOB_STATUSES = [
  "created",
  "in_progress",
  "done",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** The Swedish label for each closed Phase-A order-lifecycle status (TEXT, never color alone —
 * WCAG 1.4.1). Shared by the list, detail, and edit surfaces (server + client). */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  created: "Skapad",
  in_progress: "Pågår",
  done: "Klar",
  cancelled: "Avbruten",
};

/** A job list row — the `/jobs` index projection (thin — the detail is the heart of the story). */
export interface JobListRow {
  readonly id: string;
  readonly title: string | null;
  readonly status: JobStatus;
  readonly plannedStartDate: string | null;
  readonly plannedEndDate: string | null;
  readonly customerId: string | null;
  /** The CURRENT customer display name (live-CRM join via jobs.customer_id). */
  readonly customerDisplayName: string | null;
  /** The source quote id (for the source-quote filter/link). */
  readonly quoteId: string | null;
  /** The source quote version id (immutable ref). */
  readonly quoteVersionId: string | null;
  /** The source quote number (from the version snapshot; display only). */
  readonly quoteNumber: number | null;
  readonly updatedAt: string;
}

/** Optional server-side list filters (AC2 — customer, status, planned-date range, source quote). */
export interface JobListFilters {
  readonly customerId?: string;
  readonly status?: JobStatus;
  readonly plannedFrom?: string;
  readonly plannedTo?: string;
  readonly quoteId?: string;
  readonly quoteVersionId?: string;
}

/** Result of the list read — rows OR a generic error message (never a leaked detail). */
export interface JobListReadResult {
  readonly rows: readonly JobListRow[];
  readonly error: string | null;
}

/** A linked file for the job-files surface (owner_type='job'). */
export interface JobFileRow {
  readonly id: string;
  readonly fileId: string;
  readonly displayName: string | null;
  readonly purpose: string | null;
}

/** A job lifecycle event (the append-friendly event log — READ only in 7.3). */
export interface JobEventRow {
  readonly id: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly channel: string | null;
  readonly reference: string | null;
}

/**
 * The assembled job/order detail view-model. Money + the frozen commitment names are DISPLAYED
 * from the IMMUTABLE `quote_acceptances`/`quote_versions` refs — never re-derived (R-708). Every
 * money value is a coerced JS number (öre).
 */
export interface JobDetail {
  readonly id: string;
  readonly title: string | null;
  readonly status: JobStatus;
  readonly plannedStartDate: string | null;
  readonly plannedEndDate: string | null;
  // Immutable source references (display-only). BOTH null for a STANDALONE job (owner decision
  // 2026-07-14 — created via `createJob`, never connected to a quote later); both set for an
  // acceptance-created job (the 7.2 transaction).
  readonly quoteAcceptanceId: string | null;
  readonly quoteVersionId: string | null;
  readonly quoteId: string | null;
  readonly quoteNumber: number | null;
  // The CURRENT (live-CRM) customer id + display name (the jobs.customer_id join — tracks a rename).
  readonly customerId: string | null;
  readonly currentCustomerName: string | null;
  // The FROZEN commitment customer/facility/contact display names (from the version snapshot).
  readonly commitmentCustomerName: string | null;
  readonly commitmentFacilityName: string | null;
  readonly commitmentContactName: string | null;
  // Accepted commitment money — DISPLAYED VERBATIM from the immutable acceptance row (integer
  // öre). NULL for a standalone job (no acceptance exists — never fabricate a 0 kr commitment).
  readonly acceptedPriceOre: number | null;
  readonly sourceSentTotalOre: number | null;
  readonly channel: string | null;
  readonly acceptedAt: string | null;
  readonly adjustmentReason: string | null;
  // Evidence: a linked file id OR an external reference (exclusive per capture).
  readonly evidenceFileId: string | null;
  readonly evidenceReference: string | null;
  readonly notes: string | null;
  // The linked job files (owner_type='job') + the job events history.
  readonly files: readonly JobFileRow[];
  readonly events: readonly JobEventRow[];
}

/** Result of the job-detail read — the detail OR null (not-found) + a generic error. */
export interface JobDetailReadResult {
  readonly detail: JobDetail | null;
  readonly error: string | null;
}
