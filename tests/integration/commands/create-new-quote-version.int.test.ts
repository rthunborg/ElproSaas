/**
 * Story 6.5 — new quote version after a customer-visible change + prior-version PRESERVATION
 * (the headline R-609 property) + the lifecycle state machine (R-608). The load-bearing proofs
 * at BOTH enforcement layers.
 *
 * ATDD RED PHASE — Story 6.5 is NOT implemented yet: the `createNewQuoteVersion` +
 * `markQuoteVersionLifecycle` commands, the `create_new_quote_version` RPC, and the
 * `mark_quote_version_lifecycle` path do NOT exist. The whole suite is
 * `describe.skip("... [ATDD red phase]")` so CI stays green; each `it` carries the full
 * intended proof outline + an `expect.fail(...)` sentinel so a stray un-skip fails LOUD rather
 * than vacuously passing. GREEN PHASE: import the two commands from "@/server/commands/quotes",
 * replace each sentinel with the real command call outlined above it, then un-skip the suite.
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
 *     `quote_version_lines`, `quote_version_attachments`, its PDF render metadata
 *     (`pdf_status`/`pdf_file_id`/`pdf_generated_at`), its `quote_events`, and its `status` history —
 *     is BYTE-UNCHANGED, with the ONE sanctioned exception of a legal `status` flip
 *     (sent→superseded) that changes ONLY `status` + APPENDS a `superseded` event (never mutates a
 *     prior event or a customer-visible/commitment column). Read v1 before and after; assert deep
 *     equality on the frozen columns. A test that only proves v2 was created is NOT evidence.
 *   - 6.5-INT-03 (P0, AC3, R-608 — the lifecycle state machine at BOTH layers): illegal transitions
 *     rejected below the command AND at the command layer — a DIRECT own-tenant authenticated
 *     UPDATE flipping a SENT/SUPERSEDED version's `status` back to `draft` ⇒ REJECTED by the 6.4
 *     sent-lock trigger (QV409); the `markQuoteVersionLifecycle` command rejects an illegal
 *     transition (`sent→draft`, `superseded→sent`, a `draft` rejected/expired) with
 *     `VALIDATION_FAILED`; a LEGAL transition (`sent→rejected` / `sent→expired` / `sent→superseded`)
 *     SUCCEEDS + appends the matching event + writes a `{ targetId }`-only audit row.
 *   - 6.5-RLS (P0, R-601/R-609): a cross-tenant new-version / lifecycle attempt is rejected — a
 *     foreign parent version id is invisible → `TENANT_ACCESS_DENIED` before execute (this suite
 *     asserts the command layer; the shared TENANT_TABLES inventory owns the raw-SQL isolation).
 *
 * Mirrors `mark-quote-version-sent.int.test.ts` / `quote-version.int.test.ts`: per-run unique ids
 * (`crypto.randomUUID()`), raw pg readback via the BYPASSRLS admin helpers (bigint öre +
 * version_number → STRING, timestamptz → Date; coerce on readback), runs against the LOCAL
 * Supabase stack only + visibly skips when unreachable. AFTER a `supabase db reset` the runner
 * polls `/auth/v1/health` to 200 before this suite (Kong→GoTrue 502 false-green — the 6-1 retro
 * trap; the preservation proof is DB-backed so a silent skip would leave the CORE R-609 property
 * unproven). CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so the proofs are never silently skipped.
 *
 * SEEDING a SENT version WITH children (the 6.4 child-lock): seed the version as `draft` →
 * insert lines/attachments → flip `status='sent'` (the child-snapshot lock blocks child INSERTs
 * into an already-sent parent — the 6-4 retro rule). Reuse `adminInsertQuoteVersion` +
 * `adminInsertQuoteVersionLine` + `adminInsertQuoteVersionAttachment` — do NOT invent a fixture.
 *
 * [Source: test-design-epic-6.md#6.5-INT-01/02/03, R-608/R-609/R-601; story 6.5 Task 5.1 + 5.3;
 *  architecture.md#9 (below-UI trigger enforcement) + #11 (a version is the immutable commitment;
 *  a change requires a NEW version, never a mutation of the sent one) + #5 (injected clock);
 *  supabase/migrations/20260707120000_quote_version_sent_lock.sql:118-134 (the legal-transition
 *  guard — sent→superseded allowed, reversal to draft RAISES QV409) + :305-324 (quote_events
 *  append-only); tests/integration/commands/mark-quote-version-sent.int.test.ts (the INT harness to
 *  mirror); tests/factories/tenants.ts (adminInsertQuoteVersion + line/attachment/event seeders;
 *  adminSelectQuoteVersionRow/Lines/PdfColumns/QuoteEventsForVersion for the freeze readback)]
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
  adminSelectQuoteVersionRow,
  adminSelectQuoteVersionLines,
  adminSelectQuoteVersionPdfColumns,
  adminSelectQuoteEventsForVersion,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
// GREEN PHASE (Story 6.5 Task 3.1 / 2.2): import the two NEW commands here —
//   import { createNewQuoteVersion, markQuoteVersionLifecycle } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-06T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/**
 * Seed a quote with ONE SENT version that HAS a line + an attachment (the 6.4 child-lock order:
 * draft → children → flip-to-sent). The source calc has a section + a row so the GREEN-phase
 * new-version command can RE-CAPTURE a fresh snapshot from it. Returns the ids for the readback.
 */
async function seedSentVersionWithChildren(tenantId: string): Promise<{
  quoteId: string;
  calcId: string;
  customerId: string;
  facilityId: string;
  contactId: string;
  sentVersionId: string;
  lineId: string;
  attachmentId: string;
  fileId: string;
}> {
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
  // the children, THEN flip to sent (via a raw admin update — BYPASSRLS seed path).
  const sentVersionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1,
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
  // GREEN PHASE: flip to sent via a BYPASSRLS admin update (children now exist → child-lock allows
  // the parent flip). A helper `adminUpdateQuoteVersionStatus(sentVersionId, "sent")` may be added
  // to tests/factories/tenants.ts (additive) if not already present.
  // await adminUpdateQuoteVersionStatus(sentVersionId, "sent");

  return {
    quoteId,
    calcId,
    customerId,
    facilityId,
    contactId,
    sentVersionId,
    lineId,
    attachmentId,
    fileId,
  };
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client
let b: TestServerClient; // adminB's authenticated anon-key (RLS) client (cross-tenant negatives)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  b = await makeAuthedServerClient(fixture.adminB);
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("createNewQuoteVersion — new version with an explicit parent relationship (AC1) [ATDD red phase — Story 6.5 not implemented]", () => {
  it("[P0] 6.5-INT-01: a customer-visible change on a SENT version ⇒ a NEW DRAFT version (shared quote_number, version_number+1, own `created` event + `{targetId}` audit); the SENT version is NOT edited", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();
    const v1Before = await adminSelectQuoteVersionRow(seed.sentVersionId);

    // GREEN PHASE — mutate the SOURCE (calc lines/price/VAT + terms + validity + intro + display +
    // attachments + quote-visible notes) so the fresh capture DIFFERS from v1, then create v2 via
    // `runCommand(createNewQuoteVersion, { client: a as never, input: { quote_version_id:
    // seed.sentVersionId }, clock: fixedClock, correlationId })`. The red-phase outline below drives
    // the harness (fixture + clock + audit readback) up to the sentinel so the plumbing is exercised.
    const clock = fixedClock;
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(0); // no command has run yet in the red phase
    void runCommand; // GREEN PHASE: runCommand(createNewQuoteVersion, { client: a, ..., clock })
    void clock;
    void a; // adminA RLS (anon-key) client — the ONLY tenant authority in the green-phase call
    expect.fail("ATDD red phase: createNewQuoteVersion not implemented (Story 6.5 Task 3.1)");

    // The new version is a DRAFT on the SAME quote with version_number = parent + 1 and the SHARED
    // quote_number (no new tenant_counters allocation).
    // const v2 = await adminSelectQuoteVersionRow(v2Id);
    // expect(v2?.quote_id).toBe(seed.quoteId);
    // expect(v2?.status).toBe("draft");
    // expect(String(v2?.version_number)).toBe("2");
    // expect(String(v2?.quote_number)).toBe(String(v1Before?.quote_number)); // SHARED per-quote

    // v2 captured the NEW customer-visible values; v1 keeps the OLD (the sent version is NEVER edited).
    // const v1After = await adminSelectQuoteVersionRow(seed.sentVersionId);
    // expect(v1After?.intro_text).toBe(v1Before?.intro_text); // v1 unchanged
    // expect(v2?.intro_text).not.toBe(v1Before?.intro_text);   // v2 re-captured the edited source

    // A `created` event for the NEW version + an audit row with `{ targetId }` metadata ONLY.
    // const v2Events = await adminSelectQuoteEventsForVersion(v2Id);
    // expect(v2Events.some((e) => e.event_type === "created")).toBe(true);
    // const audits = await adminSelectAuditEvents({ correlationId });
    // expect(audits.length).toBe(1);
    // expect(audits[0]?.target_id).toBe(v2Id);
    // expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/kund|ore|intro|company/i);
    void v1Before;
    void correlationId;
    void seed;
  });

  it("[P0] 6.5-INT-01 (R-604): concurrent new-version creations on the SAME quote serialize on the parent-quote lock and get DISTINCT version numbers", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // GREEN PHASE: fire two createNewQuoteVersion calls concurrently (Promise.all, per-run-unique
    // correlation ids — NO sleeps) and assert BOTH succeed with DISTINCT version numbers (2 and 3),
    // both sharing the parent quote_number. The parent-quote FOR UPDATE lock is the primary guard;
    // the (quote_id, version_number) unique is the belt-and-braces backstop (23505→VALIDATION_FAILED).
    expect.fail("ATDD red phase: createNewQuoteVersion not implemented (Story 6.5 Task 1.1)");
    void seed;
  });

  it("[P0] 6.5-INT-01: a foreign attachment file id ⇒ TENANT_ACCESS_DENIED (attachments re-validated own-tenant, exactly as 6.1)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const foreignFileId = await adminInsertFile({ tenant_id: fixture.tenantB.id });

    // GREEN PHASE: createNewQuoteVersion with input.attachment_file_ids = [foreignFileId] ⇒
    //   expect(res.ok).toBe(false); if (!res.ok) expect(res.code).toBe("TENANT_ACCESS_DENIED");
    expect.fail("ATDD red phase: createNewQuoteVersion not implemented (Story 6.5 Task 3.1)");
    void seed;
    void foreignFileId;
  });
});

describe.skip("createNewQuoteVersion — prior-version PRESERVATION (AC2, R-609 headline) [ATDD red phase]", () => {
  it("[P0] 6.5-INT-02: after v2 creation, v1's snapshot + lines + attachments + PDF metadata + events + status are BYTE-UNCHANGED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // Read v1's FULL frozen state BEFORE v2 creation.
    const v1RowBefore = await adminSelectQuoteVersionRow(seed.sentVersionId);
    const v1LinesBefore = await adminSelectQuoteVersionLines(seed.sentVersionId);
    const v1PdfBefore = await adminSelectQuoteVersionPdfColumns(seed.sentVersionId);
    const v1EventsBefore = await adminSelectQuoteEventsForVersion(seed.sentVersionId);

    // GREEN PHASE — create v2, then re-read v1 and assert DEEP equality on the frozen columns:
    //   const res = await runCommand(createNewQuoteVersion, { client: a as never,
    //     input: { quote_version_id: seed.sentVersionId }, clock: fixedClock,
    //     correlationId: crypto.randomUUID() });
    //   expect(res.ok).toBe(true);
    //   const v1RowAfter = await adminSelectQuoteVersionRow(seed.sentVersionId);
    //   const v1LinesAfter = await adminSelectQuoteVersionLines(seed.sentVersionId);
    //   const v1PdfAfter = await adminSelectQuoteVersionPdfColumns(seed.sentVersionId);
    //   const v1EventsAfter = await adminSelectQuoteEventsForVersion(seed.sentVersionId);
    //   // If auto-supersede is ON, ONLY `status` (sent→superseded) may differ + ONE appended
    //   // `superseded` event; every OTHER column + every existing event is byte-identical.
    //   expect(v1LinesAfter).toEqual(v1LinesBefore);
    //   expect(v1PdfAfter).toEqual(v1PdfBefore);
    //   expect({ ...v1RowAfter, status: undefined }).toEqual({ ...v1RowBefore, status: undefined });
    //   // The pre-existing events are unchanged (append-only); at most a `superseded` event is added.
    //   expect(v1EventsAfter.slice(0, v1EventsBefore.length)).toEqual(v1EventsBefore);
    expect.fail("ATDD red phase: createNewQuoteVersion not implemented (Story 6.5 Task 1.1/3.1)");
    void v1RowBefore;
    void v1LinesBefore;
    void v1PdfBefore;
    void v1EventsBefore;
  });

  it("[P0] 6.5-INT-02: auto-supersede flips ONLY v1.status (sent→superseded) + APPENDS a `superseded` event — no customer-visible column mutates, no prior event mutates", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // GREEN PHASE: create v2 with p_supersede_prior=true (the RECOMMENDED default, Task 2.1). Assert
    // v1.status === "superseded" (the sanctioned forward transition the 6.4 sent-lock trigger allows —
    // it touches ONLY the exempt `status` column so the row-equality check passes), a `superseded`
    // event is APPENDED to v1's timeline, and EVERY customer-visible/commitment column on v1 +
    // EVERY pre-existing event is byte-unchanged. Superseding an `accepted` version is OUT of scope
    // (Epic 7) — only a `sent` prior version is superseded.
    expect.fail("ATDD red phase: auto-supersede-on-new-version not implemented (Story 6.5 Task 2.1)");
    void seed;
  });

  it("[P0] 6.5-INT-02: a standalone rejected/expired lifecycle event on v1 leaves v1's snapshot/lines/attachments/PDF/events byte-unchanged except `status` + the appended event", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // GREEN PHASE: markQuoteVersionLifecycle({ quote_version_id, transition: "rejected" }) then
    // re-read v1 and assert ONLY `status` flipped + a `rejected` event appended; the frozen snapshot
    // columns + lines + attachments + PDF metadata + pre-existing events are byte-identical.
    expect.fail("ATDD red phase: markQuoteVersionLifecycle not implemented (Story 6.5 Task 2.2)");
    void seed;
  });
});

describe.skip("markQuoteVersionLifecycle — the lifecycle state machine at BOTH layers (AC3, R-608) [ATDD red phase]", () => {
  it("[P0] 6.5-INT-03: a DIRECT own-tenant authenticated UPDATE flipping a SENT version's status back to `draft` is REJECTED by the 6.4 sent-lock trigger (QV409)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const before = await adminSelectQuoteVersionRow(seed.sentVersionId);

    // GREEN PHASE (once the version is genuinely `sent`): a direct own-tenant AUTHENTICATED reversal
    // on the anon-key RLS client (`a`, NOT BYPASSRLS) — the state-machine REVERSAL the 6-4 retro says
    // must be covered (not just content columns).
    //   const { error } = await a.from("quote_versions").update({ status: "draft" })
    //     .eq("id", seed.sentVersionId).select();
    //   expect(error).not.toBeNull();              // the trigger RAISES QV409
    //   const after = await adminSelectQuoteVersionRow(seed.sentVersionId);
    //   expect(after?.status).toBe("sent");        // the reversal did not take effect
    expect.fail("ATDD red phase: the sent version cannot be seeded/flipped yet (Story 6.5 Task 5.1 seeding)");
    void before;
    void seed;
  });

  it("[P0] 6.5-INT-03: the command rejects an ILLEGAL transition (sent→draft) with VALIDATION_FAILED (the command-layer guard mirrors the DB guard)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // GREEN PHASE: markQuoteVersionLifecycle rejects a reversal to draft — a `draft` transition is
    // not in the closed transition set at all; the command guard returns VALIDATION_FAILED BEFORE
    // any write (mirroring the DB QV409). Also cover `superseded→sent` and a `draft` version being
    // rejected/expired (a draft is edited/deleted, not lifecycle-transitioned).
    expect.fail("ATDD red phase: markQuoteVersionLifecycle not implemented (Story 6.5 Task 2.2)");
    void seed;
  });

  it("[P0] 6.5-INT-03: a LEGAL transition (sent→rejected) SUCCEEDS, appends the matching event, and writes a `{targetId}`-only audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();

    // GREEN PHASE:
    //   const res = await runCommand(markQuoteVersionLifecycle, { client: a as never,
    //     input: { quote_version_id: seed.sentVersionId, transition: "rejected" },
    //     clock: fixedClock, correlationId });
    //   expect(res.ok).toBe(true);
    //   const after = await adminSelectQuoteVersionRow(seed.sentVersionId);
    //   expect(after?.status).toBe("rejected");
    //   const events = await adminSelectQuoteEventsForVersion(seed.sentVersionId);
    //   expect(events.some((e) => e.event_type === "rejected")).toBe(true);
    //   const audits = await adminSelectAuditEvents({ correlationId });
    //   expect(audits.length).toBe(1);
    //   expect(audits[0]?.target_id).toBe(seed.sentVersionId);
    //   expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/kund|ore|status|rejected/i);
    expect.fail("ATDD red phase: markQuoteVersionLifecycle not implemented (Story 6.5 Task 2.2)");
    void seed;
    void correlationId;
  });

  it("[P0] 6.5-INT-03: a DB QV409 reversal RAISE maps to QUOTE_VERSION_LOCKED at the command layer (throwMappedQuoteWriteError)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedSentVersionWithChildren(fixture.tenantA.id);

    // GREEN PHASE: if a race ever drives an illegal transition past the command guard down to the
    // trigger, the QV409 RAISE maps to QUOTE_VERSION_LOCKED (never the raw pg message). Assert the
    // mapped CODE, and that the message does NOT leak `QV409`/`status`/`update`/`23514`.
    expect.fail("ATDD red phase: markQuoteVersionLifecycle error mapping not wired (Story 6.5 Task 3.3)");
    void seed;
  });
});

describe.skip("createNewQuoteVersion / markQuoteVersionLifecycle — cross-tenant isolation (R-601/R-609) [ATDD red phase]", () => {
  it("[P0] 6.5-RLS: Tenant A cannot create a new version off Tenant B's version (foreign parent id ⇒ TENANT_ACCESS_DENIED before execute)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bSeed = await seedSentVersionWithChildren(fixture.tenantB.id);

    // GREEN PHASE: runCommand(createNewQuoteVersion, { client: a (Tenant A), input:
    //   { quote_version_id: bSeed.sentVersionId } }) ⇒ ok=false, code TENANT_ACCESS_DENIED (the
    //   ownership envelope narrows the parent version to Tenant A's rows; B's version is invisible).
    expect.fail("ATDD red phase: createNewQuoteVersion not implemented (Story 6.5 Task 3.1)");
    void bSeed;
    void b;
  });

  it("[P0] 6.5-RLS: Tenant A cannot transition Tenant B's version lifecycle (foreign version id ⇒ TENANT_ACCESS_DENIED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bSeed = await seedSentVersionWithChildren(fixture.tenantB.id);

    // GREEN PHASE: runCommand(markQuoteVersionLifecycle, { client: a (Tenant A), input:
    //   { quote_version_id: bSeed.sentVersionId, transition: "rejected" } }) ⇒ TENANT_ACCESS_DENIED.
    // The raw-SQL cross-tenant isolation for quote_versions/quote_events rides the shared
    // TENANT_TABLES inventory (they are already enrolled since 6.1) — do NOT hand-write an ad-hoc
    // isolation test that bypasses the inventory.
    expect.fail("ATDD red phase: markQuoteVersionLifecycle not implemented (Story 6.5 Task 2.2)");
    void bSeed;
  });
});
