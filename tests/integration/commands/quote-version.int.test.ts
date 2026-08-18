/**
 * Story 6.1 — `createQuoteVersionFromCalculation` command + the narrow atomic RPC
 * (AC2/AC3, P0 — 6.1-INT-02..06 / R-602/603/604).
 *
 * The headline behavioral proofs of the story, exercised through the EXISTING
 * `defineCommand`/`runCommand` envelope (architecture §5 steps 1-9):
 *   6.1-INT-02  cross-tenant SOURCE rejection — a Tenant-A create that supplies a
 *               Tenant-B calculation_id OR a Tenant-B attachment/file id is DENIED with
 *               the stable typed `TENANT_ACCESS_DENIED`; no raw throw/stack/SQL/tenant-
 *               existence signal crosses the boundary.
 *   6.1-INT-03  snapshot completeness — the created version captures the FULL §11
 *               checklist incl. FULL company identity + terms sign-off state + warnings.
 *   6.1-INT-04  BEHAVIORAL FREEZE — mutate every source class AFTER creation → the
 *               persisted snapshot is BYTE-UNCHANGED (field-exists assertions insufficient).
 *   6.1-INT-05  numbering race-safety — concurrent creations allocate UNIQUE tenant-scoped
 *               numbers inside the RPC txn (Promise.all, sleep-free); tenant B independent.
 *   6.1-INT-06  audit — a version-creation writes an append-only row with { targetId } only.
 *
 * RAW pg READBACK COERCION: `bigint` öre returns as STRINGS and `timestamptz` as `Date`
 * off the raw superuser pool — coerce (`Number(...)` / `.toISOString()`) or a `.toBe`
 * fails on representation despite byte-correct storage. Per-run unique ids for counts.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  adminInsertQuoteTerms,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertRow,
  adminInsertFile,
  adminSelectQuoteVersionRow,
  adminSelectQuoteVersionLines,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { buildQuoteReviewProof } from "../../support/quote-review-proof";
import { runCommand } from "@/server/commands/envelope";
import { createQuoteVersionFromCalculation } from "@/server/commands/quotes";
import {
  attachmentsToPayload,
  buildFreshQuoteSnapshot,
  linesToPayload,
  snapshotToPayload,
} from "@/server/commands/quotes/snapshot-build";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-05T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** A REAL own-tenant calc + a full identity/terms/customer context, for the happy path. */
interface SeededQuoteSource {
  readonly customerId: string;
  readonly facilityId: string;
  readonly contactId: string;
  readonly calcId: string;
  readonly sectionId: string;
  readonly rowIds: readonly string[];
}

/**
 * Seed a REAL Tenant-A customer(+facility+contact) → calc → section → rows + full
 * company_settings identity + a quote_terms row (BYPASSRLS). The snapshot source.
 */
async function seedQuoteSource(tenantId: string): Promise<SeededQuoteSource> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "private",
    display_name: "tenant-a-quote-customer",
  });
  const facilityId = await adminInsertFacility({
    tenant_id: tenantId,
    customer_id: customerId,
    name: "tenant-a-facility",
  });
  const contactId = await adminInsertContact({
    tenant_id: tenantId,
    customer_id: customerId,
    facility_id: facilityId,
    name: "tenant-a-contact",
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    facility_id: facilityId,
    contact_id: contactId,
    title: "tenant-a-quote-calc",
  });
  const sectionId = await adminInsertSection({
    tenant_id: tenantId,
    calculation_id: calcId,
    title: "Arbete",
  });
  const rowIds: string[] = [];
  rowIds.push(
    await adminInsertRow({
      tenant_id: tenantId,
      section_id: sectionId,
      row_type: "labor",
      quantity: 2,
      unit: "h",
      unit_cost_ore: 45000,
      unit_sell_ore: 85000,
      vat_rate_bp: 2500,
      sort_order: 0,
    }),
  );
  rowIds.push(
    await adminInsertRow({
      tenant_id: tenantId,
      section_id: sectionId,
      row_type: "material",
      quantity: 3,
      unit: "st",
      unit_cost_ore: 10000,
      unit_sell_ore: 20000,
      vat_rate_bp: 2500,
      sort_order: 1,
    }),
  );
  return { customerId, facilityId, contactId, calcId, sectionId, rowIds };
}

/** Seed the FULL company identity for a tenant (all PDF fields). */
async function seedFullIdentity(tenantId: string): Promise<void> {
  // company_settings is one-row-per-tenant; seed the full identity via a raw upsert.
  await adminQuery(
    `insert into public.company_settings
       (tenant_id, company_name, org_nr, address_line1, address_line2, postal_code,
        city, email, phone, logo_url, default_vat_display, vat_rate_bp)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      tenantId,
      "Elpro Demo AB",
      "556000-1234",
      "Testgatan 1",
      "Plan 2",
      "12345",
      "Teststad",
      "info@example.test",
      "070-0000000",
      "logo.png",
      "company_togglable",
      2500,
    ],
  );
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let b: TestServerClient; // adminB's authenticated anon-key client
let tenantBCalcId: string; // a REAL Tenant B calc (cross-tenant source target)
let tenantBFileId: string; // a REAL Tenant B file (cross-tenant attachment target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  b = await makeAuthedServerClient(fixture.adminB);
  await seedFullIdentity(fixture.tenantA.id);
  await adminInsertQuoteTerms({
    tenant_id: fixture.tenantA.id,
    terms_text: "Villkor (platshållartext) — ej godkänd",
  });

  // A REAL Tenant B calc + file (existing but A-invisible) so the cross-tenant negatives
  // point at concrete targets — never a non-existent id that would deny vacuously.
  const bCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantB.id,
    customer_type: "company",
    display_name: "tenant-b-own-customer",
    org_nr: "556000-2222",
  });
  tenantBCalcId = await adminInsertCalculation({
    tenant_id: fixture.tenantB.id,
    customer_id: bCustomerId,
    title: "tenant-b-calc",
  });
  tenantBFileId = await adminInsertFile({
    tenant_id: fixture.tenantB.id,
    display_name: "tenant-b-file.pdf",
    lifecycle_state: "linked",
  });
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("createQuoteVersionFromCalculation — cross-tenant source rejection (AC2, 6.1-INT-02)", () => {
  it("[P0] a foreign calculation_id → TENANT_ACCESS_DENIED (envelope ownership gate)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const reviewProof = await buildQuoteReviewProof(b, {
      calculationId: tenantBCalcId,
      capturedAt: FIXED_ISO,
    });
    const res = await runCommand(createQuoteVersionFromCalculation, {
      client: a as never,
      input: {
        calculation_id: tenantBCalcId,
        attachment_file_ids: [],
        ...reviewProof,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    // No raw pg error / stack / SQL / tenant-existence signal — a generic user-safe message.
    expect(res.message).not.toMatch(/23503|42501|select|insert|stack|calculation/i);
  });

  it("[P0] a foreign attachment/file id → TENANT_ACCESS_DENIED (re-validated) with NO orphaned quote/version/number", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const src = await seedQuoteSource(fixture.tenantA.id);
    const beforeCount = await countQuoteVersions(fixture.tenantA.id);
    const beforeCounter = await counterValue(fixture.tenantA.id);
    const reviewProof = await buildQuoteReviewProof(a, {
      calculationId: src.calcId,
      capturedAt: FIXED_ISO,
    });
    const res = await runCommand(createQuoteVersionFromCalculation, {
      client: a as never,
      // An A-owned calc, but a Tenant-B file id as an attachment → re-validated denial.
      input: {
        calculation_id: src.calcId,
        attachment_file_ids: [tenantBFileId],
        ...reviewProof,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    // No orphaned quote/version/number — the denial precedes the RPC (nothing persisted).
    expect(await countQuoteVersions(fixture.tenantA.id)).toBe(beforeCount);
    expect(await counterValue(fixture.tenantA.id)).toBe(beforeCounter);
  });
});

describe("createQuoteVersionFromCalculation — snapshot completeness (AC2, 6.1-INT-03)", () => {
  it("[P0] captures the full §11 checklist incl. FULL company identity + terms sign-off + warnings + source refs", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const src = await seedQuoteSource(fixture.tenantA.id);
    const reviewProof = await buildQuoteReviewProof(a, {
      calculationId: src.calcId,
      capturedAt: FIXED_ISO,
    });
    const res = await runCommand(createQuoteVersionFromCalculation, {
      client: a as never,
      input: {
        calculation_id: src.calcId,
        attachment_file_ids: [],
        ...reviewProof,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const versionId = res.data.targetId;
    const row = await adminSelectQuoteVersionRow(versionId);
    expect(row).not.toBeNull();
    if (!row) return;

    // Source refs.
    expect(row.calculation_id).toBe(src.calcId);
    expect((row.captured_at as Date).toISOString()).toBe(FIXED_ISO);

    // FULL company identity — NOT the identity-partial variant (org_nr/address/etc all set).
    expect(row.company_name).toBe("Elpro Demo AB");
    expect(row.company_org_nr).toBe("556000-1234");
    expect(row.company_address_line1).toBe("Testgatan 1");
    expect(row.company_postal_code).toBe("12345");
    expect(row.company_city).toBe("Teststad");
    expect(row.company_email).toBe("info@example.test");
    expect(row.company_phone).toBe("070-0000000");
    expect(row.company_logo_url).toBe("logo.png");

    // Customer/facility/contact display (display fields ONLY — no pnr).
    expect(row.customer_display_name).toBe("tenant-a-quote-customer");
    expect(row.customer_type).toBe("private");
    expect(row.facility_name).toBe("tenant-a-facility");
    expect(row.contact_name).toBe("tenant-a-contact");

    // Terms text + sign-off state VERBATIM (approved_at NULL = not-approved).
    expect(row.terms_text).toBe("Villkor (platshållartext) — ej godkänd");
    expect(row.terms_approved_at).toBeNull();

    // Totals in integer öre — base = 2h*85000 + 3st*20000 = 170000+60000 = 230000; VAT 25%.
    expect(Number(row.base_total_ore)).toBe(230000);
    expect(Number(row.vat_total_ore)).toBe(57500);
    expect(Number(row.accepted_price_ore)).toBe(287500);

    // VAT/tax assumptions (bp) + the standing sign-off marker.
    expect(Number(row.vat_rate_bp)).toBe(2500);
    expect(row.requires_sign_off).toBe(true);

    // Warnings-at-snapshot (a non-empty disclosure array; e.g. REQUIRED_FILES_DEFERRED).
    const warnings = row.warnings_snapshot as Array<{ code: string }>;
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.some((w) => w.code === "REQUIRED_FILES_DEFERRED")).toBe(true);

    // The line snapshots carry the customer-visible fields (NO cost/internal columns exist).
    const lines = await adminSelectQuoteVersionLines(versionId);
    expect(lines.length).toBe(2);
    const laborLine = lines.find((l) => l.row_type === "labor");
    expect(laborLine).toBeTruthy();
    expect(Number(laborLine?.unit_sell_ore)).toBe(85000);
    expect(Number(laborLine?.line_net_ore)).toBe(170000);
  });
});

describe("createQuoteVersionFromCalculation — BEHAVIORAL FREEZE (AC2, 6.1-INT-04)", () => {
  it("[P0] mutating calc rows / settings / terms / CRM AFTER creation leaves the snapshot BYTE-UNCHANGED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const src = await seedQuoteSource(fixture.tenantA.id);
    const reviewProof = await buildQuoteReviewProof(a, {
      calculationId: src.calcId,
      capturedAt: FIXED_ISO,
    });
    const res = await runCommand(createQuoteVersionFromCalculation, {
      client: a as never,
      input: {
        calculation_id: src.calcId,
        attachment_file_ids: [],
        ...reviewProof,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const versionId = res.data.targetId;

    // Snapshot the persisted state BEFORE mutating any source (coerce bigint→Number,
    // timestamptz→ISO so the equality is representation-stable).
    const before = normalize(await adminSelectQuoteVersionRow(versionId));
    const beforeLines = (await adminSelectQuoteVersionLines(versionId)).map(normalize);

    // MUTATE every source class AFTER creation.
    await adminQuery(
      `update public.calculation_rows set unit_sell_ore = 999999, label = 'MUTATED' where id = $1`,
      [src.rowIds[0]],
    );
    await adminQuery(
      `update public.customers set display_name = 'MUTATED-CUSTOMER' where id = $1`,
      [src.customerId],
    );
    await adminQuery(
      `update public.company_settings set company_name = 'MUTATED-CO', org_nr = '000000-0000' where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    await adminQuery(
      `update public.quote_terms set terms_text = 'MUTATED-TERMS', approved_at = now() where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    await adminQuery(
      `update public.facilities set name = 'MUTATED-FACILITY' where id = $1`,
      [src.facilityId],
    );

    // Re-read the SAME snapshot — it must be BYTE-IDENTICAL to `before` (the freeze proof).
    const after = normalize(await adminSelectQuoteVersionRow(versionId));
    const afterLines = (await adminSelectQuoteVersionLines(versionId)).map(normalize);
    expect(after).toEqual(before);
    expect(afterLines).toEqual(beforeLines);

    // The freeze proof MUST be non-vacuous: the mutation actually happened at the source.
    const mutatedRow = await adminQuery<{ label: string; unit_sell_ore: string }>(
      `select label, unit_sell_ore from public.calculation_rows where id = $1`,
      [src.rowIds[0]],
    );
    expect(mutatedRow[0]?.label).toBe("MUTATED");
    expect(Number(mutatedRow[0]?.unit_sell_ore)).toBe(999999);
    // But the snapshot's captured line sell öre is UNCHANGED (still the 85000 at capture).
    const snapLabor = beforeLines.find((l) => l.row_type === "labor");
    expect(Number(snapLabor?.unit_sell_ore)).toBe(85000);
    // And the frozen company name is the capture-time value, not the mutated one.
    expect(after.company_name).toBe("Elpro Demo AB");
  });
});

describe("createQuoteVersionFromCalculation — numbering race-safety (AC3, 6.1-INT-05)", () => {
  it("[P0] concurrent creations within one tenant allocate UNIQUE quote numbers (Promise.all, sleep-free)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed N distinct A-owned calcs so each create has its own source (a fresh quote each).
    const N = 8;
    const calcIds: string[] = [];
    for (let i = 0; i < N; i += 1) {
      const src = await seedQuoteSource(fixture.tenantA.id);
      calcIds.push(src.calcId);
    }
    const reviewedInputs = await Promise.all(
      calcIds.map(async (calcId) => ({
        calculation_id: calcId,
        attachment_file_ids: [],
        ...(await buildQuoteReviewProof(a, {
          calculationId: calcId,
          capturedAt: FIXED_ISO,
        })),
      })),
    );
    // Fire all N creations CONCURRENTLY (NO sleep/timing).
    const results = await Promise.all(
      reviewedInputs.map((input) =>
        runCommand(createQuoteVersionFromCalculation, {
          client: a as never,
          input,
          clock: fixedClock,
          correlationId: crypto.randomUUID(),
        }),
      ),
    );
    const numbers = results.map((r) =>
      r.ok ? (r.data as { quoteNumber: number }).quoteNumber : -1,
    );
    expect(numbers.every((n) => n > 0)).toBe(true);
    // All numbers are DISTINCT — the increment + insert share ONE RPC txn (row lock).
    expect(new Set(numbers).size).toBe(N);
  });

  it("[P0] tenant B's quote-number sequence is INDEPENDENT of tenant A's", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await seedFullIdentity(fixture.tenantB.id);
    // A B-owned calc.
    const bCustomerId = await adminInsertCustomer({
      tenant_id: fixture.tenantB.id,
      customer_type: "company",
      display_name: "tenant-b-quote-customer",
      org_nr: "556000-7777",
    });
    const bCalcId = await adminInsertCalculation({
      tenant_id: fixture.tenantB.id,
      customer_id: bCustomerId,
      title: "tenant-b-quote-calc",
    });
    const bSectionId = await adminInsertSection({
      tenant_id: fixture.tenantB.id,
      calculation_id: bCalcId,
    });
    await adminInsertRow({
      tenant_id: fixture.tenantB.id,
      section_id: bSectionId,
      row_type: "labor",
      unit_sell_ore: 50000,
      vat_rate_bp: 2500,
    });
    // B's FIRST allocation should be its OWN counter value (independent of A's sequence,
    // which is already advanced by the concurrency test above) — B starts fresh at its own
    // counter. We assert B's number is small (its own sequence), not continued from A's.
    const bBefore = await counterValue(fixture.tenantB.id);
    const reviewProof = await buildQuoteReviewProof(b, {
      calculationId: bCalcId,
      capturedAt: FIXED_ISO,
    });
    const res = await runCommand(createQuoteVersionFromCalculation, {
      client: b as never,
      input: {
        calculation_id: bCalcId,
        attachment_file_ids: [],
        ...reviewProof,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const bNumber = (res.data as { quoteNumber: number }).quoteNumber;
    // B's allocated number equals B's own (prior + 1), NOT A's much-larger sequence.
    expect(bNumber).toBe(bBefore + 1);
  });

  it("[P0] a failure mid-RPC rolls back the WHOLE txn — no orphaned number, no partial version", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Drive the RPC DIRECTLY (bypassing the command validator) with a canonical reviewed V2
    // payload except for an invalid presentational timestamp. The source/tax assertions pass,
    // then the quote-version insert's timestamptz cast raises AFTER the counter increment and
    // quote insert — proving the WHOLE txn rolls back atomically. Ensure the counter row exists
    // first so the "did NOT advance" assert is meaningful. The RPC runs under adminA's RLS client.
    const src = await seedQuoteSource(fixture.tenantA.id);
    // Seed / read the current counter value (create the row if absent via a no-op create).
    const beforeCounter = await counterValue(fixture.tenantA.id);
    const beforeCount = await countQuoteVersions(fixture.tenantA.id);
    const reviewed = await buildFreshQuoteSnapshot(a as never, {
      calculationId: src.calcId,
      attachmentFileIds: [],
      capturedAt: FIXED_ISO,
    });
    const malformedSnapshot = {
      ...snapshotToPayload(reviewed.snapshot),
      validUntil: "not-a-timestamp",
    };

    const { error } = await a.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: src.calcId,
      p_captured_at: FIXED_ISO,
      p_customer_id: reviewed.customerId,
      p_facility_id: reviewed.facilityId,
      p_contact_id: reviewed.contactId,
      p_snapshot: malformedSnapshot,
      p_lines: linesToPayload(reviewed.snapshot),
      p_attachments: attachmentsToPayload(reviewed.snapshot),
      p_reviewed_snapshot_digest: reviewed.currentReviewDigest,
      p_reviewed_quote_capture_date: reviewed.quoteCaptureDate,
      p_reviewed_calculation_status: reviewed.reviewedCalculationStatus,
      p_reviewed_readiness_rows: reviewed.reviewedReadinessRows,
    });
    // The RPC reached the version insert and raised on its timestamptz cast.
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22007");
    expect(error?.message).toMatch(/timestamp/i);
    // No orphaned number (the counter did NOT advance) and no partial version persisted.
    expect(await counterValue(fixture.tenantA.id)).toBe(beforeCounter);
    expect(await countQuoteVersions(fixture.tenantA.id)).toBe(beforeCount);
  });
});

describe("createQuoteVersionFromCalculation — audit (AC2/AC3, 6.1-INT-06)", () => {
  it("[P0/P1] writes EXACTLY ONE append-only audit row with allow-listed { targetId } metadata only", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const src = await seedQuoteSource(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();
    const reviewProof = await buildQuoteReviewProof(a, {
      calculationId: src.calcId,
      capturedAt: FIXED_ISO,
    });
    const res = await runCommand(createQuoteVersionFromCalculation, {
      client: a as never,
      input: {
        calculation_id: src.calcId,
        attachment_file_ids: [],
        ...reviewProof,
      },
      clock: fixedClock,
      correlationId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const rows = await adminSelectAuditEvents({ correlationId });
    expect(rows).toHaveLength(1);
    const audit = rows[0];
    expect(audit.event_type).toBe("quote.version.created");
    expect(audit.target_type).toBe("quote_version");
    expect(audit.target_id).toBe(res.data.targetId);
    // Metadata carries NO PII / money / customer values — it is empty-shaped (the
    // sanitizer drops everything not on the allow-list).
    expect(audit.metadata).toEqual({});
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────
async function countQuoteVersions(tenantId: string): Promise<number> {
  const rows = await adminQuery<{ n: string }>(
    `select count(*)::int as n from public.quote_versions where tenant_id = $1`,
    [tenantId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function counterValue(tenantId: string): Promise<number> {
  const rows = await adminQuery<{ current_value: string }>(
    `select current_value from public.tenant_counters
       where tenant_id = $1 and counter_name = 'quote_number'`,
    [tenantId],
  );
  return rows[0] ? Number(rows[0].current_value) : 0;
}

/** Coerce a raw pg row to a representation-stable shape (bigint→Number, Date→ISO). */
function normalize(row: Record<string, unknown> | null): Record<string, unknown> {
  if (!row) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "bigint") out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}
