/**
 * Story 7.3 — PURE projection/mapping coverage for the job read layer (`readJobList` +
 * `readJobDetail`, src/features/jobs/read.ts) driven through an INJECTED fake RLS client. This is
 * the fast, DB-INDEPENDENT companion to `job-source-of-truth.int.test.ts` (which proves the R-708
 * source-of-truth invariant against the REAL local stack and SKIPS when it is down). Those DB proofs
 * establish that the read pulls from the immutable refs; THIS spec pins the deterministic mapping
 * BELOW that — the shape normalization and coercion the DB tests never discriminate:
 *
 *   - `readJobList` had NO dedicated test at all (the INT source-of-truth suite exercises only
 *     `readJobDetail`). Here every branch of the list projection + the four AC2 filters is covered.
 *   - PostgREST returns an embedded to-one relationship as EITHER a single object OR a one-element
 *     ARRAY depending on the query; both `read.ts` normalizers (`Array.isArray(...) ? [0] : obj`) are
 *     exercised, so a PostgREST shape change is caught.
 *   - `bigint` öre + the quote number arrive as STRINGS from PostgREST — the `oreNumber`/`num`
 *     coercion at the read boundary (AC1 money HIGH) is asserted to yield JS numbers, with the
 *     `?? 0` default on a missing acceptance row.
 *   - the file-links projection asserts the `owner_type === "job"` guard (a same-UUID owner of a
 *     DIFFERENT owner_type could never surface on the job detail — R-711 surface hygiene) and the
 *     `file_id`-present filter.
 *   - the generic-error path (`readJobList` on a query error ⇒ `{ rows: [], error: GENERIC }`, never
 *     a leaked detail) and the not-found path (`readJobDetail` ⇒ null on an empty/foreign job row).
 *
 * Runs under Vitest because `read.ts` transitively imports `next/headers` (which the `node --test`
 * runner cannot resolve). It uses a hand-built fake client ONLY — NO local Supabase stack, NO DB,
 * NO PII/orgnr, NO clock — so it runs UNCONDITIONALLY in the `test:int` gate (it never skips).
 *
 * [Source: src/features/jobs/read.ts (readJobList / readJobDetail projection + coercion + filters);
 *  src/features/jobs/types.ts; story 7.3 AC1/AC2 + Task 1; test-design-epic-7.md#7.3-INT-01 (the
 *  mapping half the DB proof does not discriminate)]
 */
import { describe, it, expect } from "vitest";
import {
  readJobList,
  readJobDetail,
  type JobReadClient,
} from "@/features/jobs/read";

// ── Fake RLS client ──────────────────────────────────────────────────────────────────────────────
// A minimal, table-keyed builder that structurally satisfies `JobReadClient` (and the write-narrowed
// call chains `readJobDetail` uses). Each table maps to a canned `{ data, error }`. The builder
// records the terminal call so the mapping is exercised exactly as `read.ts` calls it — no DB.

type Canned = { data: unknown[] | null; error: unknown };

function makeFakeClient(byTable: Record<string, Canned>): JobReadClient {
  const resolve = (table: string): Promise<Canned> =>
    Promise.resolve(byTable[table] ?? { data: [], error: null });

  return {
    from(table: string) {
      const terminal = {
        limit: () => resolve(table),
        order: () => resolve(table),
      };
      return {
        select() {
          return {
            eq: () => terminal,
            is: () => ({ order: () => resolve(table) }),
          };
        },
      };
    },
  } as unknown as JobReadClient;
}

describe("7.3 read-mapping: readJobList projection + filters (pure, injected client)", () => {
  // A tenant-scoped list row as PostgREST returns it: öre-as-string is not in the list projection,
  // but the quote_number arrives as a STRING, the embedded customer is an OBJECT and the embedded
  // version is a one-element ARRAY (both PostgREST embed shapes covered in one fixture).
  const listRows = [
    {
      id: "job-1",
      title: "Elinstallation",
      status: "in_progress",
      planned_start_date: "2026-08-01",
      planned_end_date: "2026-08-10",
      customer_id: "cust-1",
      updated_at: "2026-07-07T10:00:00.000Z",
      quote_version_id: "ver-1",
      customers: { display_name: "Kund AB" }, // embed as OBJECT
      quote_versions: [{ quote_number: "1042", quote_id: "quote-1" }], // embed as ARRAY, number-as-STRING
    },
    {
      id: "job-2",
      title: null,
      status: "created",
      planned_start_date: null,
      planned_end_date: null,
      customer_id: "cust-2",
      updated_at: "2026-07-06T10:00:00.000Z",
      quote_version_id: "ver-2",
      customers: [{ display_name: "Annan Kund" }], // embed as ARRAY
      quote_versions: { quote_number: 1043, quote_id: "quote-2" }, // embed as OBJECT, number-as-NUMBER
    },
  ];

  const client = makeFakeClient({ jobs: { data: listRows, error: null } });

  it("[P1] projects the thin index columns, normalizes BOTH embed shapes, and coerces the string quote_number to a number", async () => {
    const { rows, error } = await readJobList(undefined, client);
    expect(error).toBeNull();
    expect(rows).toHaveLength(2);

    const [r1, r2] = rows;
    // Row 1 — embed-as-object customer + embed-as-array version, quote_number arrived as "1042".
    expect(r1.id).toBe("job-1");
    expect(r1.title).toBe("Elinstallation");
    expect(r1.status).toBe("in_progress");
    expect(r1.customerDisplayName).toBe("Kund AB");
    expect(r1.quoteId).toBe("quote-1");
    expect(r1.quoteVersionId).toBe("ver-1");
    expect(r1.quoteNumber).toBe(1042); // STRING → number at the boundary
    expect(typeof r1.quoteNumber).toBe("number");

    // Row 2 — embed-as-array customer + embed-as-object version, null title/dates preserved.
    expect(r2.customerDisplayName).toBe("Annan Kund");
    expect(r2.quoteId).toBe("quote-2");
    expect(r2.quoteNumber).toBe(1043);
    expect(r2.title).toBeNull();
    expect(r2.plannedStartDate).toBeNull();
  });

  it("[P1] status defaults to 'created' when the raw status is absent (defensive projection)", async () => {
    const c = makeFakeClient({
      jobs: {
        data: [{ id: "j", updated_at: "2026-07-07T00:00:00.000Z", quote_version_id: "v" }],
        error: null,
      },
    });
    const { rows } = await readJobList(undefined, c);
    expect(rows[0].status).toBe("created");
    expect(rows[0].customerDisplayName).toBeNull();
    expect(rows[0].quoteNumber).toBeNull();
  });

  it("[P1] AC2 filter — customerId narrows to the matching rows", async () => {
    const { rows } = await readJobList({ customerId: "cust-1" }, client);
    expect(rows.map((r) => r.id)).toEqual(["job-1"]);
  });

  it("[P1] AC2 filter — status narrows to the matching rows", async () => {
    const { rows } = await readJobList({ status: "created" }, client);
    expect(rows.map((r) => r.id)).toEqual(["job-2"]);
  });

  it("[P1] AC2 filter — source quote (quoteId) narrows to the matching rows", async () => {
    const { rows } = await readJobList({ quoteId: "quote-2" }, client);
    expect(rows.map((r) => r.id)).toEqual(["job-2"]);
  });

  it("[P1] AC2 filter — planned-date range excludes rows with NO planned start (cannot match a bound)", async () => {
    // job-1 has a planned start of 2026-08-01; job-2 has none → excluded by any date-range filter.
    const inRange = await readJobList({ plannedFrom: "2026-07-01", plannedTo: "2026-08-31" }, client);
    expect(inRange.rows.map((r) => r.id)).toEqual(["job-1"]);
    const before = await readJobList({ plannedTo: "2026-07-31" }, client);
    expect(before.rows.map((r) => r.id)).toEqual([]); // job-1 starts 08-01 (after the bound), job-2 has no start
  });

  it("[P1] a query error returns the GENERIC message + zero rows (never a leaked detail)", async () => {
    const failing = makeFakeClient({
      jobs: { data: null, error: { code: "57014", message: "statement timeout on jobs" } },
    });
    const { rows, error } = await readJobList(undefined, failing);
    expect(rows).toEqual([]);
    expect(error).toBeTruthy();
    // Generic, user-safe — never the raw pg text.
    expect(error).not.toMatch(/57014|statement timeout|jobs/);
  });
});

describe("7.3 read-mapping: readJobDetail projection (pure, injected client)", () => {
  const jobRow = {
    id: "job-1",
    title: "Elinstallation",
    status: "done",
    planned_start_date: "2026-08-01",
    planned_end_date: "2026-08-10",
    quote_acceptance_id: "acc-1",
    quote_version_id: "ver-1",
    customer_id: "cust-1",
    customers: [{ display_name: "Nuvarande Kund" }], // live-CRM link (ARRAY embed)
  };
  const acceptanceRow = {
    id: "acc-1",
    quote_id: "quote-1",
    accepted_price_ore: "125000", // bigint-as-STRING from PostgREST
    source_sent_total_ore: "130000",
    channel: "verbal",
    accepted_at: "2026-07-10T08:30:00.000Z",
    adjustment_reason: null,
    evidence_file_id: null,
    evidence_reference: "Signerad PDF i DMS",
    notes: null,
  };
  const versionRow = {
    id: "ver-1",
    quote_id: "quote-1",
    quote_number: "1042",
    customer_display_name: "Frusen Kund (vid accept)", // FROZEN commitment name
    facility_name: "Anläggning 1",
    contact_name: "Kontakt A",
  };
  const fileLinkRows = [
    { id: "fl-1", file_id: "file-1", owner_type: "job", purpose: "job_evidence", files: { display_name: "evidence.pdf" } },
    // A same-owner_id link of a DIFFERENT owner_type must NOT surface (owner_type guard, R-711).
    { id: "fl-2", file_id: "file-2", owner_type: "quote_acceptance", purpose: "acceptance_evidence", files: [{ display_name: "leak.pdf" }] },
    // A link with a null file_id is dropped by the file_id-present filter.
    { id: "fl-3", file_id: null, owner_type: "job", purpose: "job_evidence", files: null },
  ];
  const eventRows = [
    { id: "ev-1", event_type: "created", occurred_at: "2026-07-10T09:00:00.000Z", channel: "system", reference: null },
    { id: "ev-2", event_type: "done", occurred_at: "2026-07-11T09:00:00.000Z", channel: null, reference: "ref-x" },
  ];

  function detailClient(overrides: Partial<Record<string, Canned>> = {}): JobReadClient {
    return makeFakeClient({
      jobs: { data: [jobRow], error: null },
      quote_acceptances: { data: [acceptanceRow], error: null },
      quote_versions: { data: [versionRow], error: null },
      file_links: { data: fileLinkRows, error: null },
      job_events: { data: eventRows, error: null },
      ...overrides,
    });
  }

  it("[P1] assembles the detail from the job + immutable refs, coercing öre STRINGS to numbers", async () => {
    const detail = await readJobDetail(detailClient(), "job-1");
    expect(detail).not.toBeNull();
    // Money: bigint-as-string coerced to a JS number at the boundary (AC1 money HIGH).
    expect(detail!.acceptedPriceOre).toBe(125000);
    expect(detail!.sourceSentTotalOre).toBe(130000);
    expect(typeof detail!.acceptedPriceOre).toBe("number");
    // The live-CRM link name vs the FROZEN commitment name are DISTINCT and both surfaced.
    expect(detail!.currentCustomerName).toBe("Nuvarande Kund");
    expect(detail!.commitmentCustomerName).toBe("Frusen Kund (vid accept)");
    expect(detail!.commitmentFacilityName).toBe("Anläggning 1");
    expect(detail!.commitmentContactName).toBe("Kontakt A");
    expect(detail!.quoteNumber).toBe(1042);
    expect(detail!.evidenceReference).toBe("Signerad PDF i DMS");
    expect(detail!.channel).toBe("verbal");
  });

  it("[P1] the file-links projection surfaces ONLY owner_type='job' links WITH a file_id (surface hygiene)", async () => {
    const detail = await readJobDetail(detailClient(), "job-1");
    expect(detail!.files).toHaveLength(1);
    expect(detail!.files[0].fileId).toBe("file-1");
    expect(detail!.files[0].displayName).toBe("evidence.pdf");
    // The quote_acceptance-owned link (fl-2) and the null-file_id link (fl-3) are excluded.
    expect(detail!.files.map((f) => f.fileId)).not.toContain("file-2");
  });

  it("[P1] the job_events history is mapped in order with nullable channel/reference preserved", async () => {
    const detail = await readJobDetail(detailClient(), "job-1");
    expect(detail!.events.map((e) => e.eventType)).toEqual(["created", "done"]);
    expect(detail!.events[0].channel).toBe("system");
    expect(detail!.events[1].channel).toBeNull();
    expect(detail!.events[1].reference).toBe("ref-x");
  });

  it("[P1] a missing (RLS-invisible/absent) job row returns null — a generic not-found, no existence leak", async () => {
    const detail = await readJobDetail(detailClient({ jobs: { data: [], error: null } }), "job-x");
    expect(detail).toBeNull();
  });

  it("[P1] a missing acceptance row defaults the money to 0 (the ?? 0 boundary), never NaN/undefined", async () => {
    const detail = await readJobDetail(detailClient({ quote_acceptances: { data: [], error: null } }), "job-1");
    expect(detail).not.toBeNull();
    expect(detail!.acceptedPriceOre).toBe(0);
    expect(detail!.sourceSentTotalOre).toBe(0);
  });

  it("[P1] a BROKEN immutable source ref (null quote_acceptance_id/quote_version_id) throws, never a fabricated 0 kr (epic-7 review fix)", async () => {
    // A jobs row whose immutable source refs are null is a data-integrity anomaly. It must surface
    // LOUDLY (the page-level generic failure) rather than coercing the id to the literal string
    // "null" — which would match zero rows on the dependent reads and fabricate a "0 kr" accepted
    // price + null names on a money-critical surface (R-708 "never re-derive, never mask").
    const brokenAcceptance = { ...jobRow, quote_acceptance_id: null };
    await expect(
      readJobDetail(detailClient({ jobs: { data: [brokenAcceptance], error: null } }), "job-1"),
    ).rejects.toThrow();

    const brokenVersion = { ...jobRow, quote_version_id: null };
    await expect(
      readJobDetail(detailClient({ jobs: { data: [brokenVersion], error: null } }), "job-1"),
    ).rejects.toThrow();
  });

  it("[P1] a query error on any dependent read throws (surfaced as the page-level generic failure)", async () => {
    await expect(
      readJobDetail(detailClient({ job_events: { data: null, error: { code: "57014" } } }), "job-1"),
    ).rejects.toThrow();
  });
});
