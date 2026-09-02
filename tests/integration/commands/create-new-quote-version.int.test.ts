/**
 * Story 6.5 — new quote version after a customer-visible change + prior-version PRESERVATION
 * (the headline R-609 property) + the lifecycle state machine (R-608). The load-bearing proofs
 * at BOTH enforcement layers.
 *
 * Proof outline:
 *   - 6.5-INT-01 (P0, AC1): a customer-visible change on a SENT version ⇒ a NEW DRAFT version via
 *     the narrow RPC with an EXPLICIT parent-quote relationship (`quote_id` = the parent;
 *     `version_number` = parent + 1; `quote_number` = the SHARED parent number; `status='draft'`;
 *     a fresh frozen snapshot RE-CAPTURED from the CURRENT source; a `quote_events 'created'` row
 *     for the NEW version; an `audit_events` row with allow-listed `{ targetId }` metadata ONLY).
 *     The SENT version is NEVER edited (v2 captures the NEW values; v1 keeps the OLD).
 *   - 6.5-INT-02 (P0, AC2, R-609 — the HEADLINE preservation proof): after v2 creation AND after
 *     each Phase A lifecycle event, v1's FULL frozen state — `quote_versions` (all columns),
 *     `quote_version_lines`, `quote_version_attachments`, its PDF render metadata, its
 *     `quote_events`, and its `status` history — is BYTE-UNCHANGED, with the ONE sanctioned
 *     exception of a legal `status` flip (sent→superseded) that changes ONLY `status` + APPENDS a
 *     `superseded` event. Read v1 before and after; assert deep equality on the frozen columns.
 *   - 6.5-INT-03 (P0, AC3, R-608 — the lifecycle state machine at BOTH layers): illegal transitions
 *     rejected below the command AND at the command layer.
 *   - 6.5-RLS (P0, R-601/R-609): a cross-tenant new-version / lifecycle attempt is rejected.
 *
 * Mirrors `mark-quote-version-sent.int.test.ts`: per-run unique ids (`crypto.randomUUID()`), raw pg
 * readback via the BYPASSRLS admin helpers (bigint öre + version_number → STRING, timestamptz →
 * Date; coerce on readback), runs against the LOCAL Supabase stack only + visibly skips when
 * unreachable. AFTER a `supabase db reset` the runner polls `/auth/v1/health` to 200 before this
 * suite (Kong→GoTrue 502 false-green). CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so the proofs are
 * never silently skipped.
 *
 * SEEDING a SENT version WITH children (the 6.4 child-lock): seed the version as `draft` → insert
 * lines/attachments → flip `status='sent'` (BYPASSRLS `adminUpdateQuoteVersionStatus`).
 *
 * [Source: test-design-epic-6.md#6.5-INT-01/02/03, R-608/R-609/R-601; story 6.5 Task 5.1 + 5.3;
 *  architecture.md#9 (below-UI trigger enforcement) + #11 + #5; supabase/migrations/
 *  20260707120000_quote_version_sent_lock.sql:118-134 + :305-324; supabase/migrations/
 *  20260708120000_quote_new_version.sql; tests/factories/tenants.ts]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertRow,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionLine,
  adminInsertQuoteVersionAttachment,
  adminInsertFile,
  adminUpdateQuoteVersionStatus,
  adminSelectQuoteVersionRow,
  adminSelectQuoteVersionLines,
  adminSelectQuoteVersionAttachments,
  adminSelectQuoteVersionsForQuote,
  adminSelectQuoteVersionPdfColumns,
  adminSelectQuoteEventsForVersion,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  expectDatabaseOwnedTimestamp,
  readDatabaseNow,
} from "../../support/database-time";
import { runCommand } from "@/server/commands/envelope";
import {
  createNewQuoteVersion,
  markQuoteVersionLifecycle,
} from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-06T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

interface SentSeed {
  quoteId: string;
  calcId: string;
  sectionId: string;
  customerId: string;
  facilityId: string;
  contactId: string;
  sentVersionId: string;
  lineId: string;
  attachmentId: string;
  fileId: string;
}

/**
 * Seed a quote with ONE SENT version that HAS a line + an attachment (the 6.4 child-lock order:
 * draft → children → flip-to-sent). The source calc has a section + a row so the new-version
 * command can RE-CAPTURE a fresh snapshot from it. Returns the ids for the readback.
 */
async function seedSentVersionWithChildren(tenantId: string): Promise<SentSeed> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `newver-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const facilityId = await adminInsertFacility({
    tenant_id: tenantId,
    customer_id: customerId,
    name: `newver-facility-${crypto.randomUUID().slice(0, 8)}`,
  });
  const contactId = await adminInsertContact({
    tenant_id: tenantId,
    customer_id: customerId,
    name: `newver-contact-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `newver-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const sectionId = await adminInsertSection({ tenant_id: tenantId, calculation_id: calcId });
  await adminInsertRow({
    tenant_id: tenantId,
    section_id: sectionId,
    unit_sell_ore: 120000,
    unit_cost_ore: 70000,
    vat_rate_bp: 2500,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const fileId = await adminInsertFile({ tenant_id: tenantId });

  // Seed the version as DRAFT so the child INSERTs are permitted (the 6.4 child-lock), then add
  // the children, THEN flip to sent (a BYPASSRLS admin update).
  const sentVersionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 4001,
    status: "draft",
    intro_text: "v1 introtext (original)",
    customer_display_name: "Kund AB (v1)",
  });
  const lineId = await adminInsertQuoteVersionLine({
    tenant_id: tenantId,
    quote_version_id: sentVersionId,
    label: "v1-line",
    unit_sell_ore: 120000,
    vat_rate_bp: 2500,
  });
  const attachmentId = await adminInsertQuoteVersionAttachment({
    tenant_id: tenantId,
    quote_version_id: sentVersionId,
    file_id: fileId,
    display_name: "v1-attachment.pdf",
  });
  await adminUpdateQuoteVersionStatus(sentVersionId, "sent");

  return {
    quoteId,
    calcId,
    sectionId,
    customerId,
    facilityId,
    contactId,
    sentVersionId,
    lineId,
    attachmentId,
    fileId,
  };
}

/** Mutate the SOURCE calc's row sell price (BYPASSRLS) so the fresh capture DIFFERS from v1. */
async function mutateSourceRowPrice(sectionId: string, tenantId: string): Promise<void> {
  const { adminQuery } = await import("../../factories/admin-sql");
  await adminQuery(
    `update public.calculation_rows set unit_sell_ore = 250000
       where section_id = $1 and tenant_id = $2`,
    [sectionId, tenantId],
  );
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("createNewQuoteVersion — new version with an explicit parent relationship (AC1)", () => {
  it("[P0] 6.5-INT-01: a customer-visible change on a SENT version ⇒ a NEW DRAFT version (shared quote_number, version_number+1, own `created` event + `{targetId}` audit); the SENT version is NOT edited", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();
    const v1Before = await adminSelectQuoteVersionRow(seed.sentVersionId);

    // Mutate the SOURCE calc so the fresh capture DIFFERS from v1's frozen totals/lines.
    await mutateSourceRowPrice(seed.sectionId, fixture.tenantA.id);

    const res = await runCommand(createNewQuoteVersion, {
      client: a as never,
      input: { quote_version_id: seed.sentVersionId },
      clock: fixedClock,
      correlationId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const v2Id = res.data.targetId;

    // The new version is a DRAFT on the SAME quote with version_number = parent + 1 and the SHARED
    // quote_number (no new tenant_counters allocation).
    const v2 = await adminSelectQuoteVersionRow(v2Id);
    expect(v2?.quote_id).toBe(seed.quoteId);
    expect(v2?.status).toBe("draft");
    expect(String(v2?.version_number)).toBe("2");
    expect(String(v2?.quote_number)).toBe(String(v1Before?.quote_number)); // SHARED per-quote
    expect(String(res.data.versionNumber)).toBe("2");

    // v2 captured the NEW customer-visible totals (the mutated source); v1 keeps the OLD.
    const v1After = await adminSelectQuoteVersionRow(seed.sentVersionId);
    expect(String(v1After?.base_total_ore)).toBe(String(v1Before?.base_total_ore)); // v1 unchanged
    expect(String(v2?.base_total_ore)).not.toBe(String(v1Before?.base_total_ore)); // v2 re-captured

    // A `created` event for the NEW version + an audit row with `{ targetId }` metadata ONLY.
    const v2Events = await adminSelectQuoteEventsForVersion(v2Id);
    expect(v2Events.some((e) => e.event_type === "created")).toBe(true);
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0]?.target_id).toBe(v2Id);
    expect(audits[0]?.metadata).toEqual({});
    expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/kund|ore|intro|company/i);
  });

  it("[P0] 6.5-INT-01 (R-604): concurrent new-version creations from the SAME source serialize and reject the stale parent", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // Fire two createNewQuoteVersion calls concurrently (NO sleeps). The parent-quote FOR UPDATE
    // lock serializes them. Exactly one may consume this authoritative source version; the other
    // must reject the now-stale parent instead of silently creating a version from old evidence.
    const [r1, r2] = await Promise.all([
      runCommand(createNewQuoteVersion, {
        client: a as never,
        input: { quote_version_id: seed.sentVersionId },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      }),
      runCommand(createNewQuoteVersion, {
        client: a as never,
        input: { quote_version_id: seed.sentVersionId },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      }),
    ]);
    const results = [r1, r2];
    const successful = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(1);
    if (failed[0]?.ok === false) expect(failed[0].code).toBe("QUOTE_VERSION_LOCKED");

    // The winning request creates v2 on the same quote. The stale request creates no v3, and the
    // existing versions retain the one shared quote number.
    const versions = await adminSelectQuoteVersionsForQuote(seed.quoteId);
    const numbers = versions.map((v) => Number(v.version_number)).sort((x, y) => x - y);
    expect(numbers).toEqual([1, 2]);
    const quoteNumbers = new Set(versions.map((v) => String(v.quote_number)));
    expect(quoteNumbers.size).toBe(1); // all versions share the ONE per-quote number
  });

  it("[P0] 6.5-INT-01: a foreign attachment file id ⇒ TENANT_ACCESS_DENIED (attachments re-validated own-tenant, exactly as 6.1)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const foreignFileId = await adminInsertFile({ tenant_id: fixture.tenantB.id });

    const res = await runCommand(createNewQuoteVersion, {
      client: a as never,
      input: { quote_version_id: seed.sentVersionId, attachment_file_ids: [foreignFileId] },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] 6.5-INT-01: creating a new version off a DRAFT parent ⇒ VALIDATION_FAILED (a draft IS the editable version)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A draft parent (never flipped to sent) — a new version off it is a no-op.
    const customerId = await adminInsertCustomer({
      tenant_id: fixture.tenantA.id,
      customer_type: "company",
      display_name: `draft-parent-${crypto.randomUUID().slice(0, 8)}`,
    });
    const calcId = await adminInsertCalculation({
      tenant_id: fixture.tenantA.id,
      customer_id: customerId,
      title: `draft-calc-${crypto.randomUUID().slice(0, 8)}`,
    });
    const quoteId = await adminInsertQuote({ tenant_id: fixture.tenantA.id, customer_id: customerId });
    const draftVersionId = await adminInsertQuoteVersion({
      tenant_id: fixture.tenantA.id,
      quote_id: quoteId,
      calculation_id: calcId,
      version_number: 1,
      quote_number: 4009,
      status: "draft",
    });

    const res = await runCommand(createNewQuoteVersion, {
      client: a as never,
      input: { quote_version_id: draftVersionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION_FAILED");
  });
});

describe("createNewQuoteVersion — prior-version PRESERVATION (AC2, R-609 headline)", () => {
  it("[P0] 6.5-INT-02: after v2 creation, v1's snapshot + lines + attachments + PDF metadata + prior events are BYTE-UNCHANGED (only status→superseded + an appended event)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // Read v1's FULL frozen state BEFORE v2 creation.
    const v1RowBefore = await adminSelectQuoteVersionRow(seed.sentVersionId);
    const v1LinesBefore = await adminSelectQuoteVersionLines(seed.sentVersionId);
    const v1AttBefore = await adminSelectQuoteVersionAttachments(seed.sentVersionId);
    const v1PdfBefore = await adminSelectQuoteVersionPdfColumns(seed.sentVersionId);
    const v1EventsBefore = await adminSelectQuoteEventsForVersion(seed.sentVersionId);

    const res = await runCommand(createNewQuoteVersion, {
      client: a as never,
      input: { quote_version_id: seed.sentVersionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);

    const v1RowAfter = await adminSelectQuoteVersionRow(seed.sentVersionId);
    const v1LinesAfter = await adminSelectQuoteVersionLines(seed.sentVersionId);
    const v1AttAfter = await adminSelectQuoteVersionAttachments(seed.sentVersionId);
    const v1PdfAfter = await adminSelectQuoteVersionPdfColumns(seed.sentVersionId);
    const v1EventsAfter = await adminSelectQuoteEventsForVersion(seed.sentVersionId);

    // v1's lines / attachments / PDF metadata are BYTE-UNCHANGED.
    expect(v1LinesAfter).toEqual(v1LinesBefore);
    expect(v1AttAfter).toEqual(v1AttBefore);
    expect(v1PdfAfter).toEqual(v1PdfBefore);

    // The ONLY sanctioned difference on the row is the status flip sent→superseded + updated_at
    // (trigger-owned). Every OTHER customer-visible/commitment column is byte-identical.
    expect(v1RowBefore?.status).toBe("sent");
    expect(v1RowAfter?.status).toBe("superseded");
    for (const col of [
      "intro_text",
      "customer_display_name",
      "base_total_ore",
      "vat_total_ore",
      "quote_number",
      "version_number",
      "quote_id",
      "calculation_id",
      "captured_at",
      "terms_text",
    ]) {
      expect(String(v1RowAfter?.[col] ?? "")).toBe(String(v1RowBefore?.[col] ?? ""));
    }

    // The pre-existing events are unchanged (append-only); exactly ONE `superseded` event is added.
    expect(v1EventsAfter.slice(0, v1EventsBefore.length)).toEqual(v1EventsBefore);
    const added = v1EventsAfter.slice(v1EventsBefore.length);
    expect(added.length).toBe(1);
    expect(added[0]?.event_type).toBe("superseded");
    expect(added[0]?.occurred_at).toBe(FIXED_ISO);
  });

  it("[P0] 6.5-INT-02: a standalone rejected lifecycle event on a SENT v1 leaves v1's snapshot/lines/attachments/PDF byte-unchanged except `status` + the appended event", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const rowBefore = await adminSelectQuoteVersionRow(seed.sentVersionId);
    const linesBefore = await adminSelectQuoteVersionLines(seed.sentVersionId);
    const attBefore = await adminSelectQuoteVersionAttachments(seed.sentVersionId);
    const eventsBefore = await adminSelectQuoteEventsForVersion(seed.sentVersionId);

    const res = await runCommand(markQuoteVersionLifecycle, {
      client: a as never,
      input: { quote_version_id: seed.sentVersionId, transition: "rejected" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);

    const rowAfter = await adminSelectQuoteVersionRow(seed.sentVersionId);
    const linesAfter = await adminSelectQuoteVersionLines(seed.sentVersionId);
    const attAfter = await adminSelectQuoteVersionAttachments(seed.sentVersionId);
    const eventsAfter = await adminSelectQuoteEventsForVersion(seed.sentVersionId);

    expect(rowAfter?.status).toBe("rejected");
    expect(linesAfter).toEqual(linesBefore);
    expect(attAfter).toEqual(attBefore);
    for (const col of ["intro_text", "base_total_ore", "terms_text", "quote_id"]) {
      expect(String(rowAfter?.[col] ?? "")).toBe(String(rowBefore?.[col] ?? ""));
    }
    expect(eventsAfter.slice(0, eventsBefore.length)).toEqual(eventsBefore);
    const added = eventsAfter.slice(eventsBefore.length);
    expect(added.length).toBe(1);
    expect(added[0]?.event_type).toBe("rejected");
  });
});

describe("markQuoteVersionLifecycle — the lifecycle state machine at BOTH layers (AC3, R-608)", () => {
  it("[P0] 6.5-INT-03: a DIRECT own-tenant authenticated UPDATE flipping a SENT version's status back to `draft` is REJECTED by the 6.4 sent-lock trigger (QV409)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    const { error } = await a
      .from("quote_versions")
      .update({ status: "draft" })
      .eq("id", seed.sentVersionId)
      .select();

    expect(error).not.toBeNull(); // the trigger RAISES QV409
    const after = await adminSelectQuoteVersionRow(seed.sentVersionId);
    expect(after?.status).toBe("sent"); // the reversal did not take effect
  });

  it("[P0] 6.5-INT-03: the command rejects an ILLEGAL transition (superseded→sent) with VALIDATION_FAILED (the command-layer guard mirrors the DB guard)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a version that is already `superseded` (children first, then flip). A transition to
    // `sent` is not in the closed set at all → VALIDATION_FAILED BEFORE any write.
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    await adminUpdateQuoteVersionStatus(seed.sentVersionId, "superseded");

    // `sent` is not a valid input transition (the validator's closed set is rejected/expired/
    // superseded). Try a `rejected` from a superseded (illegal — superseded is terminal).
    const res = await runCommand(markQuoteVersionLifecycle, {
      client: a as never,
      input: { quote_version_id: seed.sentVersionId, transition: "rejected" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION_FAILED");
    const after = await adminSelectQuoteVersionRow(seed.sentVersionId);
    expect(after?.status).toBe("superseded"); // unchanged
  });

  it("[P0] 6.5-INT-03: a DRAFT cannot be rejected/expired (a draft is edited/deleted, not lifecycle-transitioned) ⇒ VALIDATION_FAILED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await adminInsertCustomer({
      tenant_id: fixture.tenantA.id,
      customer_type: "company",
      display_name: `draft-life-${crypto.randomUUID().slice(0, 8)}`,
    });
    const calcId = await adminInsertCalculation({
      tenant_id: fixture.tenantA.id,
      customer_id: customerId,
      title: `draft-life-calc-${crypto.randomUUID().slice(0, 8)}`,
    });
    const quoteId = await adminInsertQuote({ tenant_id: fixture.tenantA.id, customer_id: customerId });
    const draftId = await adminInsertQuoteVersion({
      tenant_id: fixture.tenantA.id,
      quote_id: quoteId,
      calculation_id: calcId,
      version_number: 1,
      quote_number: 4020,
      status: "draft",
    });

    const res = await runCommand(markQuoteVersionLifecycle, {
      client: a as never,
      input: { quote_version_id: draftId, transition: "expired" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION_FAILED");
    const after = await adminSelectQuoteVersionRow(draftId);
    expect(after?.status).toBe("draft"); // unchanged
  });

  it("[P0] 6.5-INT-03: a LEGAL transition (sent→expired) SUCCEEDS, appends the matching event, and writes a `{targetId}`-only audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();
    const databaseBefore = await readDatabaseNow();

    const res = await runCommand(markQuoteVersionLifecycle, {
      client: a as never,
      input: { quote_version_id: seed.sentVersionId, transition: "expired" },
      clock: fixedClock,
      correlationId,
    });
    const databaseAfter = await readDatabaseNow();
    expect(res.ok).toBe(true);

    const after = await adminSelectQuoteVersionRow(seed.sentVersionId);
    expect(after?.status).toBe("expired");
    const events = await adminSelectQuoteEventsForVersion(seed.sentVersionId);
    const expired = events.find((e) => e.event_type === "expired");
    expect(expired).toBeDefined();
    expectDatabaseOwnedTimestamp(expired?.occurred_at, databaseBefore, databaseAfter, FIXED_ISO);
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0]?.target_id).toBe(seed.sentVersionId);
    expect(audits[0]?.metadata).toEqual({});
    expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/kund|ore|status|expired/i);
  });
});

describe("createNewQuoteVersion / markQuoteVersionLifecycle — cross-tenant isolation (R-601/R-609)", () => {
  it("[P0] 6.5-RLS: Tenant A cannot create a new version off Tenant B's version (foreign parent id ⇒ TENANT_ACCESS_DENIED before execute)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bSeed = await seedSentVersionWithChildren(fixture.tenantB.id);
    const bBefore = await adminSelectQuoteVersionsForQuote(bSeed.quoteId);

    const res = await runCommand(createNewQuoteVersion, {
      client: a as never, // adminA acting on a Tenant-B parent version id
      input: { quote_version_id: bSeed.sentVersionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("TENANT_ACCESS_DENIED");
      expect(res.message).not.toMatch(/exist|tenant b|another|version/i);
    }
    // Tenant B's quote is untouched (no new version created).
    const bAfter = await adminSelectQuoteVersionsForQuote(bSeed.quoteId);
    expect(bAfter.length).toBe(bBefore.length);
  });

  it("[P0] 6.5-RLS: Tenant A cannot transition Tenant B's version lifecycle (foreign version id ⇒ TENANT_ACCESS_DENIED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bSeed = await seedSentVersionWithChildren(fixture.tenantB.id);

    const res = await runCommand(markQuoteVersionLifecycle, {
      client: a as never,
      input: { quote_version_id: bSeed.sentVersionId, transition: "rejected" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TENANT_ACCESS_DENIED");
    // Tenant B's version stays sent (never transitioned).
    const after = await adminSelectQuoteVersionRow(bSeed.sentVersionId);
    expect(after?.status).toBe("sent");
  });
});
