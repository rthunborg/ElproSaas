import { adminQuery } from "../admin-sql";
import { rethrowWithCode } from "./core";
import { adminInsertStory106QuoteVersion, type QuoteVersionSeed } from "./quotes";
export interface QuoteAcceptanceSeed {
  readonly tenant_id: string;
  readonly quote_id: string;
  readonly quote_version_id: string;
  readonly channel?: string | null;
  readonly accepted_at?: string;
  readonly accepted_price_ore?: number;
  readonly source_sent_total_ore?: number;
  readonly adjustment_reason?: string | null;
  readonly evidence_file_id?: string | null;
  readonly evidence_reference?: string | null;
  readonly notes?: string | null;
}

/** A seed for a `quote_lost_reasons` row (Story 10.2; parent quote + version required, same tenant). */
export interface QuoteLostReasonSeed {
  readonly tenant_id: string;
  readonly quote_id: string;
  readonly quote_version_id: string;
  readonly outcome?: string;
  readonly category?: string;
  readonly note?: string | null;
}

/** A seed for a `jobs` row (source acceptance + version + customer required, same tenant). */
export interface JobSeed {
  readonly tenant_id: string;
  readonly quote_acceptance_id: string;
  readonly quote_version_id: string;
  readonly customer_id: string;
  readonly facility_id?: string | null;
  readonly contact_id?: string | null;
  readonly title?: string | null;
  readonly status?: string;
}

/** A seed for a `job_events` row (parent job required, same tenant). */
export interface JobEventSeed {
  readonly tenant_id: string;
  readonly job_id: string;
  readonly event_type?: string;
}

/** Seed ONE `quote_acceptances` row via the privileged superuser pg path (BYPASSRLS). */
export async function adminInsertQuoteAcceptance(
  seed: QuoteAcceptanceSeed,
): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quote_acceptances
         (tenant_id, quote_id, quote_version_id, channel, accepted_at,
          accepted_price_ore, source_sent_total_ore, adjustment_reason,
          evidence_file_id, evidence_reference, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        seed.tenant_id,
        seed.quote_id,
        seed.quote_version_id,
        seed.channel ?? "email",
        seed.accepted_at ?? "2026-07-09T09:00:00.000Z",
        seed.accepted_price_ore ?? 125000,
        seed.source_sent_total_ore ?? 125000,
        seed.adjustment_reason ?? null,
        seed.evidence_file_id ?? null,
        seed.evidence_reference ?? null,
        seed.notes ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuoteAcceptance: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Seed ONE `quote_lost_reasons` row via the privileged superuser pg path (BYPASSRLS). Story 10.2. */
export async function adminInsertQuoteLostReason(
  seed: QuoteLostReasonSeed,
): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quote_lost_reasons
         (tenant_id, quote_id, quote_version_id, outcome, category, note)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        seed.tenant_id,
        seed.quote_id,
        seed.quote_version_id,
        seed.outcome ?? "forlorad",
        seed.category ?? "pris",
        seed.note ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuoteLostReason: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * A seed for a LOST `quote_versions` row PLUS its companion `quote_lost_reasons` row (Story 10.2).
 * Mirrors `QuoteVersionSeed` MINUS `status` (which is forced to 'lost' — that is the whole point of
 * this helper) PLUS the three reason columns.
 */
export type LostQuoteVersionSeed = Omit<QuoteVersionSeed, "status"> &
  Pick<QuoteLostReasonSeed, "outcome" | "category" | "note">;

/** The two ids a `adminInsertLostQuoteVersionWithReason` call created. */
export interface LostQuoteVersionIds {
  /** The inserted `quote_versions` row id (status='lost'). */
  readonly quoteVersionId: string;
  /** The inserted companion `quote_lost_reasons` row id. */
  readonly lostReasonId: string;
}

/**
 * Seed a complete V2 LOST `quote_versions` row AND its companion `quote_lost_reasons` row in one
 * dedicated transaction via the privileged superuser pg path (BYPASSRLS). Story 10.2.
 *
 * WHY ONE TRANSACTION: the migration
 * `20260719120000_quote_lost_reasons_and_lost_status.sql` installs the coherence guard
 * `enforce_lost_version_has_reason` — a DEFERRABLE INITIALLY DEFERRED constraint trigger on
 * `quote_versions` that raises QV422 at COMMIT when a row sits at status='lost' with NO
 * `quote_lost_reasons` row. That guard is load-bearing security (an own-tenant direct INSERT/UPDATE
 * through PostgREST could otherwise forge a 'lost' version, bypassing `mark_quote_version_lost` and
 * its required reason/event/audit writes), so it is NOT weakened in production. The fixture's
 * transaction-local replica role is scoped to arranging an already-terminal fixture state; it
 * inserts the V2 parent, any required economic line, and the reason before commit, so the resulting
 * rows are internally coherent even though no live lifecycle command is being exercised here.
 *
 * Defaults mirror `adminInsertQuoteVersion` for the version columns and `adminInsertQuoteLostReason`
 * for the reason columns (outcome 'forlorad', category 'pris', note null); every one is overridable.
 * Returns BOTH ids (the version id and the reason id) so callers that assert on either can use it.
 * THROWS (Postgres `code` preserved) on a DB error, mirroring `adminInsertQuoteVersion`.
 */
export async function adminInsertLostQuoteVersionWithReason(
  seed: LostQuoteVersionSeed,
): Promise<LostQuoteVersionIds> {
  try {
    const inserted = await adminInsertStory106QuoteVersion(
      { ...seed, status: "lost" },
      {
        outcome: seed.outcome ?? "forlorad",
        category: seed.category ?? "pris",
        note: seed.note ?? null,
      },
    );
    if (!inserted.lostReasonId) {
      throw new Error("adminInsertLostQuoteVersionWithReason: no ids returned");
    }
    return {
      quoteVersionId: inserted.quoteVersionId,
      lostReasonId: inserted.lostReasonId,
    };
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Read the `quote_lost_reasons` rows for a version back (BYPASSRLS). Story 10.2 readback helper. */
export async function adminSelectLostReasons(
  quoteVersionId: string,
): Promise<{ outcome: string; category: string; note: string | null }[]> {
  return adminQuery<{ outcome: string; category: string; note: string | null }>(
    `select outcome, category, note from public.quote_lost_reasons
      where quote_version_id = $1`,
    [quoteVersionId],
  );
}

/** A seed for a `quote_follow_ups` row (Story 10.3; parent quote + version required, same tenant). */
export interface QuoteFollowUpSeed {
  readonly tenant_id: string;
  readonly quote_id: string;
  readonly quote_version_id: string;
  readonly due_date?: string;
  readonly note?: string | null;
  readonly status?: "open" | "completed";
  readonly outcome?: string | null;
  readonly completed_at?: string | null;
}

/**
 * Seed ONE `quote_follow_ups` row via the privileged superuser pg path (BYPASSRLS). Story 10.3.
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error — including the
 * one-open partial-unique-index `23505` if a second OPEN row is seeded on the same quote. The
 * note carries an anonymized shape-only token; NO PII.
 */
export async function adminInsertQuoteFollowUp(
  seed: QuoteFollowUpSeed,
): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quote_follow_ups
         (tenant_id, quote_id, quote_version_id, due_date, note, status, outcome, completed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        seed.tenant_id,
        seed.quote_id,
        seed.quote_version_id,
        seed.due_date ?? "2026-08-01",
        seed.note ?? null,
        seed.status ?? "open",
        seed.outcome ?? null,
        seed.completed_at ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuoteFollowUp: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Read the `quote_follow_ups` rows for a quote back (BYPASSRLS, ordered). Story 10.3 readback helper. */
export async function adminSelectFollowUps(
  quoteId: string,
): Promise<
  {
    id: string;
    status: string;
    outcome: string | null;
    completed_at: string | null;
    note: string | null;
  }[]
> {
  const rows = await adminQuery<{
    id: string;
    status: string;
    outcome: string | null;
    completed_at: Date | string | null;
    note: string | null;
  }>(
    `select id, status, outcome, completed_at, note from public.quote_follow_ups
       where quote_id = $1 order by created_at`,
    [quoteId],
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    outcome: r.outcome ?? null,
    completed_at:
      r.completed_at === null || r.completed_at === undefined
        ? null
        : r.completed_at instanceof Date
          ? r.completed_at.toISOString()
          : String(r.completed_at),
    note: r.note ?? null,
  }));
}

/** Seed ONE `jobs` row via the privileged superuser pg path (BYPASSRLS). */
export async function adminInsertJob(seed: JobSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.jobs
         (tenant_id, quote_acceptance_id, quote_version_id, customer_id,
          facility_id, contact_id, title, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        seed.tenant_id,
        seed.quote_acceptance_id,
        seed.quote_version_id,
        seed.customer_id,
        seed.facility_id ?? null,
        seed.contact_id ?? null,
        seed.title ?? "tenant-b-job-seed",
        seed.status ?? "created",
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertJob: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Seed ONE `job_events` row via the privileged superuser pg path (BYPASSRLS). */
export async function adminInsertJobEvent(seed: JobEventSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.job_events (tenant_id, job_id, event_type)
       values ($1, $2, $3)
       returning id`,
      [seed.tenant_id, seed.job_id, seed.event_type ?? "created"],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertJobEvent: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Seed one Story 10.8 review authorization for inventory isolation proofs. */
export async function adminInsertQuoteReviewAuthorization(seed: {
  tenant_id: string;
  actor_user_id: string;
  quote_id: string;
  quote_version_id: string;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quote_review_authorizations
         (tenant_id, actor_user_id, purpose, quote_id, target_quote_version_id,
          source_revision, correlation_id, issued_at, expires_at)
       values ($1, $2, 'final_send', $3, $4, '{"seed":true}'::jsonb,
               gen_random_uuid(), '2026-08-31T10:00:00Z', '2026-08-31T10:15:00Z')
       returning id`,
      [seed.tenant_id, seed.actor_user_id, seed.quote_id, seed.quote_version_id],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuoteReviewAuthorization: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Read ONE acceptance/job-table row's label column back via the privileged superuser pg
 * path (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE
 * negative to prove the foreign row is UNCHANGED. `table`/`labelColumn` are a
 * closed/inventory-supplied set (never client input). Returns `null` if the row does not exist.
 */
export async function adminSelectAcceptanceLabel(
  table: "quote_acceptances" | "jobs" | "job_events",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null } | null> {
  const rows = await adminQuery<{ id: string; label: string | null }>(
    `select id, ${labelColumn}::text as label from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Read a full quote_acceptances row back (BYPASSRLS) for persistence proofs. */
export async function adminSelectQuoteAcceptanceRow(
  id: string,
): Promise<Record<string, unknown> | null> {
  const rows = await adminQuery<Record<string, unknown>>(
    `select * from public.quote_acceptances where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Read all quote_acceptances rows for a version back (BYPASSRLS) — for duplicate/count proofs. */
export async function adminSelectAcceptancesForVersion(
  quoteVersionId: string,
): Promise<Record<string, unknown>[]> {
  return adminQuery<Record<string, unknown>>(
    `select * from public.quote_acceptances where quote_version_id = $1`,
    [quoteVersionId],
  );
}

/**
 * Read a full jobs row back (BYPASSRLS) for source-ref / persistence proofs (Story 7.2). The
 * transaction (accept_quote_and_create_job) inserts it; this reads its immutable source refs +
 * carried customer/facility/contact + status back independent of the app/RLS path.
 */
export async function adminSelectJobRow(
  id: string,
): Promise<Record<string, unknown> | null> {
  const rows = await adminQuery<Record<string, unknown>>(
    `select * from public.jobs where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Read all jobs rows for a source acceptance back (BYPASSRLS) — the one-job-per-acceptance count proof. */
export async function adminSelectJobsForAcceptance(
  acceptanceId: string,
): Promise<Record<string, unknown>[]> {
  return adminQuery<Record<string, unknown>>(
    `select * from public.jobs where quote_acceptance_id = $1`,
    [acceptanceId],
  );
}

/**
 * Read the job_events rows for a job back (BYPASSRLS, ordered). Coerces the `occurred_at`
 * timestamptz (raw pg returns it as a Date) to an ISO string so a deterministic injected-instant
 * assertion compares by representation (mirrors adminSelectQuoteEventsForVersion).
 */
export async function adminSelectJobEventsForJob(
  jobId: string,
): Promise<{ id: string; event_type: string; occurred_at: string }[]> {
  const rows = await adminQuery<{
    id: string;
    event_type: string;
    occurred_at: Date | string;
  }>(
    `select id, event_type, occurred_at from public.job_events
      where job_id = $1 order by occurred_at asc`,
    [jobId],
  );
  return rows.map((r) => ({
    id: r.id,
    event_type: r.event_type,
    occurred_at:
      r.occurred_at instanceof Date
        ? r.occurred_at.toISOString()
        : String(r.occurred_at),
  }));
}

/** Read the `file_links` rows for a quote_acceptance evidence owner (BYPASSRLS). */
export async function adminSelectAcceptanceEvidenceLinks(
  acceptanceId: string,
): Promise<
  {
    id: string;
    file_id: string;
    owner_type: string;
    purpose: string;
    is_locked: boolean;
    locked_at: string | null;
  }[]
> {
  const rows = await adminQuery<{
    id: string;
    file_id: string;
    owner_type: string;
    purpose: string;
    is_locked: boolean;
    locked_at: Date | string | null;
  }>(
    `select id, file_id, owner_type, purpose, is_locked, locked_at
       from public.file_links
      where owner_type = 'quote_acceptance' and owner_id = $1
      order by id`,
    [acceptanceId],
  );
  return rows.map((r) => ({
    id: r.id,
    file_id: r.file_id,
    owner_type: r.owner_type,
    purpose: r.purpose,
    is_locked: r.is_locked,
    locked_at:
      r.locked_at === null || r.locked_at === undefined
        ? null
        : r.locked_at instanceof Date
          ? r.locked_at.toISOString()
          : String(r.locked_at),
  }));
}

/**
 * Seed ONE storage OBJECT under a server-shaped tenant path via the service-role
 * storage API (BYPASSRLS on `storage.objects`). Used by the storage-plane isolation
 * suite so the cross-tenant list/read/sign negatives target a CONCRETE Tenant-B object,
 * never a missing key. `objectPath` is `{tenant_id}/{fileId}/{name}` (tenant-first —
 * the segment `storage.objects` RLS keys on). THROWS on an upload error so a broken
 * seed fails loudly.
 */
