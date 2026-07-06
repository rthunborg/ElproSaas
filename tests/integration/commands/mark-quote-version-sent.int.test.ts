/**
 * Story 6.4 — mark-sent lifecycle transition + BELOW-THE-UI sent immutability (R-605/R-608).
 *
 * The load-bearing correctness proofs of the story, at BOTH enforcement layers:
 *   - 6.4-INT-01 (P0, AC1): mark-sent records the sent timestamp (the EXPLICIT RPC parameter —
 *     asserted on the DETERMINISTIC injected clock, NO sleeps/wall-clock), the optional
 *     channel/reference, a `quote_events` `sent` row (`occurred_at` = the sent timestamp), an
 *     `audit_events` row (allow-listed `{ targetId }` metadata ONLY — NO PII/money/channel), and
 *     the immutable lifecycle state (`status` → `sent`).
 *   - 6.4-INT-02 (P0, AC2, R-605 LAYER 1 — command guard): after a version is SENT, a customer-
 *     visible mutation command (`updateDraftQuoteVersion`) against it ⇒ the stable typed
 *     `QUOTE_VERSION_LOCKED` (exact-code assertion; DISTINCT from 6.2's `QUOTE_VERSION_NOT_DRAFT`)
 *     and the row is byte-unchanged.
 *   - 6.4-INT-03 (P0, AC2, R-605 LAYER 2 — the DB below-the-command proof): a DIRECT own-tenant
 *     AUTHENTICATED (anon-key RLS client, NEVER BYPASSRLS) UPDATE of a customer-visible column on
 *     a SENT version ⇒ REJECTED by the sent-lock TRIGGER; AND the EXEMPT PDF-render columns
 *     (`pdf_status`/`pdf_file_id`/`pdf_generated_at`) are STILL mutable on a sent version (the 6.3
 *     retry path), and an allowed lifecycle transition (status → accepted) still succeeds. A test
 *     that only proves the UI disables the button is NOT evidence (architecture §9).
 *   - 6.4-INT-04 (P0, AC1 precondition, R-608): a DRAFT failing a BLOCKING readiness check cannot
 *     be marked sent — the send is gated by the SAME 5.4 classifier (no forked rule).
 *
 * Mirrors `update-draft-quote-version.int.test.ts` / `quote-version.int.test.ts`: per-run unique
 * ids (`crypto.randomUUID()`), raw pg readback via the BYPASSRLS admin helpers (bigint öre → STRING
 * + timestamptz → Date; coerce on readback), runs against the LOCAL Supabase stack only + visibly
 * skips when unreachable. AFTER a `supabase db reset` the runner polls `/auth/v1/health` to 200
 * before this suite (Kong→GoTrue 502 false-green — the 6-1 retro trap; these immutability proofs
 * are DB-backed so a silent skip would leave the CORE sent-lock unproven). CI
 * (`SUPABASE_TEST_REQUIRED=1`) hard-fails so the proofs are never silently skipped.
 *
 * ── ATDD RED PHASE ─────────────────────────────────────────────────────────────────────────
 * `markQuoteVersionSent`, the `QUOTE_VERSION_LOCKED` code, the `mark_quote_version_sent` RPC, and
 * the sent-lock trigger do NOT exist yet. The whole suite is `describe.skip("... [ATDD red phase]")`
 * so it COLLECTS without executing the not-yet-existent command/trigger; each body carries the real
 * proof outline + `expect.fail(...)` sentinels so a stray un-skip fails LOUD rather than vacuously
 * passing. GREEN handoff: land Task 1 (trigger) + Task 2 (RPC) + Task 3 (command + error code) →
 * import `markQuoteVersionSent` → un-skip the suite → delete the sentinels/placeholders.
 *
 * [Source: test-design-epic-6.md#6.4-INT-01/02/03/04, R-605/R-608; story 6.4 Task 6.2;
 *  architecture.md#9 (below-UI trigger enforcement) + #11 (customer-visible/attachment/PDF-source
 *  immutable once sent) + #12 (PDF render metadata derived — retry allowed on sent);
 *  tests/integration/commands/update-draft-quote-version.int.test.ts (the INT harness to mirror);
 *  tests/factories/tenants.ts (adminInsertQuoteVersion — status/pdf_status seed cols)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionLine,
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
import { updateDraftQuoteVersion } from "@/server/commands/quotes";
// GREEN PHASE: also import `markQuoteVersionSent` from "@/server/commands/quotes" (Task 3).
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-06T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** Seed a quote + one version of the given status for a tenant. Returns ids for the readback. */
async function seedQuoteVersion(
  tenantId: string,
  status: string,
): Promise<{ quoteId: string; versionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `sent-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `sent-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status,
    intro_text: "ursprunglig introtext",
  });
  return { quoteId, versionId };
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

describe.skip("markQuoteVersionSent — mark-sent transition (AC1) [ATDD red phase — Story 6.4 not implemented]", () => {
  it("[P0] 6.4-INT-01: records the sent timestamp (explicit RPC parameter), channel/reference, a `sent` event, an audit row, and status='sent'", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");
    const correlationId = crypto.randomUUID();

    // GREEN PHASE — replace this sentinel with the real command call:
    //   const res = await runCommand(markQuoteVersionSent, {
    //     client: a as never,
    //     input: { quote_version_id: versionId, channel: "email", reference: "REF-123" },
    //     clock: fixedClock,
    //     correlationId,
    //   });
    //   expect(res.ok).toBe(true);
    expect.fail("ATDD red phase: markQuoteVersionSent not implemented (Story 6.4 Task 3)");

    // The lifecycle state flipped to sent (the immutable transition).
    const row = await adminSelectQuoteVersionRow(versionId);
    expect(row?.status).toBe("sent");

    // A `sent` quote_event was written with occurred_at = the INJECTED clock (NO wall-clock).
    const events = await adminSelectQuoteEventsForVersion(versionId);
    expect(events.some((e) => e.event_type === "sent")).toBe(true);

    // An audit row with allow-listed `{ targetId }` metadata ONLY — NO PII/money/channel leak.
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    const audit = audits[0];
    expect(audit?.target_id).toBe(versionId);
    const metaKeys = Object.keys((audit?.metadata as Record<string, unknown>) ?? {});
    expect(metaKeys).toEqual(["targetId"]);
    expect(JSON.stringify(audit?.metadata)).not.toMatch(/email|REF-123|ore|kund/i);
  });

  it("[P0] 6.4-INT-01: the sent timestamp comes from the injected clock, not the wall clock", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");

    // GREEN PHASE: mark sent via the command with `fixedClock`, then assert the `sent` event's
    // occurred_at equals FIXED_ISO exactly (a wall-clock stamp would drift from FIXED_ISO).
    expect.fail("ATDD red phase: markQuoteVersionSent not implemented (Story 6.4 Task 3)");
    void versionId;
    void FIXED_ISO;
  });
});

describe.skip("markQuoteVersionSent — command-layer immutability (AC2, R-605 layer 1) [ATDD red phase]", () => {
  it("[P0] 6.4-INT-02: a customer-visible mutation command against a SENT version ⇒ QUOTE_VERSION_LOCKED (distinct from QUOTE_VERSION_NOT_DRAFT), row unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a version and mark it sent (via the command in green phase). For the red phase this
    // outline seeds status='sent' directly to describe the intended assertion.
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    const before = await adminSelectQuoteVersionRow(versionId);

    const res = await runCommand(updateDraftQuoteVersion, {
      client: a as never,
      input: { quote_version_id: versionId, intro_text: "försök att ändra en skickad" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    // NOTE (green phase): the 6.2 draft-edit path returns QUOTE_VERSION_NOT_DRAFT for a sent
    // version. This 6.4-INT-02 proof pins the NEW `QUOTE_VERSION_LOCKED` code on the mark-sent /
    // customer-visible mutation command path (Story 6.4 Task 3). Once the code lands, replace the
    // sentinel below with:
    //   if (res.ok) return;
    //   expect(res.code).toBe("QUOTE_VERSION_LOCKED"); // distinct from QUOTE_VERSION_NOT_DRAFT
    //   expect(res.message).not.toMatch(/update|select|status|stack|23514/i);
    //   const after = await adminSelectQuoteVersionRow(versionId);
    //   expect(after?.intro_text).toBe(before?.intro_text);
    //   expect(after?.status).toBe("sent");
    expect.fail("ATDD red phase: QUOTE_VERSION_LOCKED not introduced yet (Story 6.4 Task 3.1)");
    void before;
  });
});

describe.skip("markQuoteVersionSent — DB-layer immutability BELOW the command (AC2, R-605 layer 2) [ATDD red phase]", () => {
  it("[P0] 6.4-INT-03: a DIRECT own-tenant authenticated UPDATE of a customer-visible column on a SENT version is REJECTED by the trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    const before = await adminSelectQuoteVersionRow(versionId);

    // A DIRECT own-tenant AUTHENTICATED update on the anon-key RLS client (`a` IS the authed
    // SupabaseClient, NOT the BYPASSRLS admin pool) — this is the "below-the-command" attack the
    // sent-lock trigger must block (architecture §9). It targets a customer-visible commitment
    // column (`intro_text`) on an OWN-TENANT (RLS-visible) sent row, so the trigger RAISE — not RLS
    // invisibility — is what rejects it.
    const { error } = await a
      .from("quote_versions")
      .update({ intro_text: "direct-sql bypass attempt" })
      .eq("id", versionId)
      .select();

    // The trigger RAISES → the UPDATE fails with a (non-null) error; the row is byte-unchanged.
    expect(error).not.toBeNull();
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.intro_text).toBe(before?.intro_text);
    expect(after?.status).toBe("sent");
  });

  it("[P0] 6.4-INT-03: the EXEMPT PDF-render columns (pdf_status/pdf_file_id/pdf_generated_at) are STILL mutable on a SENT version (the 6.3 retry path)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");

    // A direct own-tenant authenticated UPDATE of an EXEMPT PDF-render column must SUCCEED — a sent
    // version's PDF stays regenerable/retryable (deferred-work 6-3 → owner 6.4; architecture §12).
    const { error } = await a
      .from("quote_versions")
      .update({ pdf_status: "generating" })
      .eq("id", versionId)
      .select();

    expect(error).toBeNull();
    const cols = await adminSelectQuoteVersionPdfColumns(versionId);
    expect(cols?.pdf_status).toBe("generating");
  });

  it("[P0] 6.4-INT-03: an allowed lifecycle transition (status → accepted) on a SENT version still succeeds (append-only lifecycle keeps working)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");

    // The trigger must EXEMPT the allowed status transitions (accepted/rejected/expired/superseded)
    // + archived_at + updated_at so the append-only lifecycle machinery keeps working.
    const { error } = await a
      .from("quote_versions")
      .update({ status: "accepted" })
      .eq("id", versionId)
      .select();

    expect(error).toBeNull();
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.status).toBe("accepted");
  });

  it("[P0] 6.4-INT-03: a direct authenticated UPDATE of a customer-visible line on a SENT version is REJECTED (attachment/line snapshot immutable)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    await adminInsertQuoteVersionLine({
      tenant_id: fixture.tenantA.id,
      quote_version_id: versionId,
      label: "rad-1",
      unit_sell_ore: 85000,
      sort_order: 0,
    });
    const before = await adminSelectQuoteVersionLines(versionId);

    // The child snapshot tables (quote_version_lines / quote_version_attachments) are ALSO immutable
    // once the parent version is non-draft (architecture §11 "selected attachments are immutable").
    const { error } = await a
      .from("quote_version_lines")
      .update({ label: "changed-after-send" })
      .eq("id", before[0]?.id as string)
      .select();

    expect(error).not.toBeNull();
    const after = await adminSelectQuoteVersionLines(versionId);
    expect(after[0]?.label).toBe(before[0]?.label);
  });

  it("[P0] 6.4-INT-03: the sent-lock trigger does NOT fire on a DRAFT row (a draft is still fully mutable + the draft→sent transition is allowed)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");

    // A DRAFT row is still fully mutable — the trigger only fires when OLD.status <> 'draft'.
    const { error } = await a
      .from("quote_versions")
      .update({ intro_text: "draft edit still allowed" })
      .eq("id", versionId)
      .select();

    expect(error).toBeNull();
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.intro_text).toBe("draft edit still allowed");
  });
});

describe.skip("markQuoteVersionSent — send gated by the 5.4 readiness classifier (AC1, R-608) [ATDD red phase]", () => {
  it("[P0] 6.4-INT-04: a draft failing a BLOCKING readiness check cannot be marked sent (same 5.4 classifier — no forked rule)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a draft version whose re-derived readiness has a BLOCKER (e.g. its source calc has no
    // customer / an uncomputable total). The send must be REJECTED via the SAME classifyReadiness
    // rule table the 5.4 preview + 6.1 create used (VALIDATION_FAILED — a blocked draft is unsendable).
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");

    // GREEN PHASE:
    //   const res = await runCommand(markQuoteVersionSent, { client: a as never,
    //     input: { quote_version_id: versionId }, clock: fixedClock, correlationId: crypto.randomUUID() });
    //   expect(res.ok).toBe(false);
    //   if (!res.ok) expect(res.code).toBe("VALIDATION_FAILED");
    //   // The version stayed DRAFT (the blocked send never flipped it).
    //   expect((await adminSelectQuoteVersionRow(versionId))?.status).toBe("draft");
    expect.fail("ATDD red phase: markQuoteVersionSent send-gate not implemented (Story 6.4 Task 3/4)");
    void versionId;
  });
});
