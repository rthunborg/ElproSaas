/**
 * Story 6.4 — mark-sent lifecycle transition + BELOW-THE-UI sent immutability (R-605/R-608).
 *
 * The load-bearing correctness proofs of the story, at BOTH enforcement layers:
 *   - 6.4-INT-01 (P0, AC1): mark-sent records database-owned lifecycle and audit timestamps;
 *     the fixed injected command clock is deliberately ignored. It preserves the optional
 *     channel/reference, writes a `quote_events` `sent` row, an
 *     `audit_events` row (allow-listed `{ targetId }` metadata ONLY — NO PII/money/channel), and
 *     the immutable lifecycle state (`status` → `sent`).
 *   - 6.4-INT-02 (P0, AC2, R-605 LAYER 1 — command guard): after a version is SENT, a customer-
 *     visible mutation command (`updateDraftQuoteVersion`) against it ⇒ the stable typed
 *     `QUOTE_VERSION_NOT_DRAFT`; a mark-sent RE-attempt against a sent version ⇒ the NEW stable
 *     `QUOTE_VERSION_LOCKED` (exact-code assertion; DISTINCT from 6.2's `QUOTE_VERSION_NOT_DRAFT`)
 *     and the row is byte-unchanged.
 *   - 6.4-INT-03 (P0, AC2, R-605 LAYER 2 — the DB below-the-command proof): a DIRECT own-tenant
 *     AUTHENTICATED (anon-key RLS client, NEVER BYPASSRLS) UPDATE of a customer-visible column on
 *     a SENT version ⇒ REJECTED by the sent-lock TRIGGER; AND the EXEMPT PDF-render columns
 *     (`pdf_status`/`pdf_file_id`/`pdf_generated_at`) are STILL mutable on a sent version (the 6.3
 *     retry path), and an allowed lifecycle transition (status → accepted) still succeeds. A test
 *     that only proves the UI disables the button is NOT evidence (architecture §9).
 *   - 6.4-INT-04 (P0, AC1 precondition, R-608): a DRAFT whose frozen readiness carries a BLOCKING
 *     issue cannot be marked sent — the send is gated by the SAME 5.4 classifier (no forked rule).
 *
 * Mirrors `update-draft-quote-version.int.test.ts` / `quote-version.int.test.ts`: per-run unique
 * ids (`crypto.randomUUID()`), raw pg readback via the BYPASSRLS admin helpers (bigint öre → STRING
 * + timestamptz → Date; coerce on readback), runs against the LOCAL Supabase stack only + visibly
 * skips when unreachable. AFTER a `supabase db reset` the runner polls `/auth/v1/health` to 200
 * before this suite (Kong→GoTrue 502 false-green — the 6-1 retro trap; these immutability proofs
 * are DB-backed so a silent skip would leave the CORE sent-lock unproven). CI
 * (`SUPABASE_TEST_REQUIRED=1`) hard-fails so the proofs are never silently skipped.
 *
 * [Source: test-design-epic-6.md#6.4-INT-01/02/03/04, R-605/R-608; story 6.4 Task 6.2;
 *  architecture.md#9 (below-UI trigger enforcement) + #11 (customer-visible/attachment/PDF-source
 *  immutable once sent) + #12 (PDF render metadata derived — retry allowed on sent);
 *  tests/integration/commands/update-draft-quote-version.int.test.ts (the INT harness to mirror);
 *  tests/factories/tenants.ts (adminInsertQuoteVersion — status/pdf_status/warnings_snapshot cols)]
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
  adminSelectQuoteVersionRow,
  adminSelectQuoteVersionLines,
  adminSelectQuoteEventsForVersion,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent, updateDraftQuoteVersion } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";
import { establishCurrentQuotePdf } from "../../support/quote-pdf";

const FIXED_ISO = "2026-07-06T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

async function readDatabaseNow(): Promise<Date> {
  const rows = await adminQuery<{ database_now: string | Date }>(
    `select statement_timestamp() as database_now`,
  );
  const value = rows[0]?.database_now;
  const timestamp = new Date(value instanceof Date ? value.toISOString() : String(value));
  expect(Number.isNaN(timestamp.getTime())).toBe(false);
  return timestamp;
}

function expectDatabaseOwnedTimestamp(
  value: unknown,
  before: Date,
  after: Date,
): void {
  const timestamp = new Date(value instanceof Date ? value.toISOString() : String(value));
  expect(Number.isNaN(timestamp.getTime())).toBe(false);
  // Both bounds are sampled from Postgres. The tiny scheduling margin avoids host-clock flakiness
  // while proving this mutation was timestamped by the database during the command.
  expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5_000);
  expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime() + 5_000);
  expect(timestamp.toISOString()).not.toBe(FIXED_ISO);
}

/** A frozen readiness snapshot carrying a BLOCKER (the send-gate must reject a send). */
const BLOCKED_WARNINGS = [
  {
    code: "MISSING_CUSTOMER",
    severity: "blocker",
    message: "Kalkylen saknar en kund.",
  },
] as const;

/**
 * Seed a quote + one version of the given status for a tenant. Returns ids for the readback.
 * An optional `warnings` snapshot seeds the frozen readiness (for the send-gate blocker proof).
 */
async function seedQuoteVersion(
  tenantId: string,
  status: string,
  warnings?: readonly { code: string; severity: string; message: string }[],
  acceptedPriceOre = 0,
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
    warnings_snapshot: warnings,
    accepted_price_ore: acceptedPriceOre,
  });
  return { quoteId, versionId };
}

/** Establish the authenticated Story 10.9 current-PDF proof required before final send. */
async function establishCurrentPdf(versionId: string): Promise<void> {
  await establishCurrentQuotePdf({
    client: a,
    tenantId: fixture.tenantA.id,
    quoteVersionId: versionId,
    actorUserId: fixture.adminA.id,
    occurredAt: FIXED_ISO,
  });
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

describe("markQuoteVersionSent — mark-sent transition (AC1)", () => {
  it("[P0] 6.4-INT-01: DB-owns sent lifecycle/audit timestamps while preserving channel/reference, event, audit row, and status='sent'", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");
    const correlationId = crypto.randomUUID();
    await establishCurrentPdf(versionId);
    const databaseBefore = await readDatabaseNow();

    const res = await runCommand(markQuoteVersionSent, {
      client: a as never,
      input: { quote_version_id: versionId, channel: "email", reference: "REF-123" },
      clock: fixedClock,
      correlationId,
    });
    const databaseAfter = await readDatabaseNow();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.targetId).toBe(versionId);

    // The lifecycle state flipped to sent (the immutable transition).
    const row = await adminSelectQuoteVersionRow(versionId);
    expect(row?.status).toBe("sent");
    expectDatabaseOwnedTimestamp(row?.updated_at, databaseBefore, databaseAfter);

    // A `sent` quote_event was written with a database-owned timestamp (the injected command
    // clock cannot backdate lifecycle evidence) plus the recorded channel/reference.
    const events = await adminSelectQuoteEventsForVersion(versionId);
    const sentEvent = events.find((e) => e.event_type === "sent");
    expect(sentEvent).toBeDefined();
    expectDatabaseOwnedTimestamp(sentEvent?.occurred_at, databaseBefore, databaseAfter);
    expect(sentEvent?.channel).toBe("email");
    expect(sentEvent?.reference).toBe("REF-123");

    // EXACTLY ONE append-only audit row: the target_id is the version id (the `{ targetId }`
    // allow-list is carried on the target_id COLUMN; metadata itself is `{}` — the same shape the
    // create/pdf commands write) — NO PII/money/channel value anywhere in the row.
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    const audit = audits[0];
    expect(audit?.target_id).toBe(versionId);
    expectDatabaseOwnedTimestamp(audit?.created_at, databaseBefore, databaseAfter);
    expect(audit?.metadata).toEqual({});
    expect(JSON.stringify(audit?.metadata)).not.toMatch(/email|REF-123|ore/i);
  });

  it("[P0] 6.4-INT-01: the DB owns the sent timestamp and ignores the injected clock (channel/reference optional)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");
    await establishCurrentPdf(versionId);
    const correlationId = crypto.randomUUID();
    const databaseBefore = await readDatabaseNow();

    // No channel/reference supplied — they are OPTIONAL recorded fields (null when absent).
    const res = await runCommand(markQuoteVersionSent, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId,
    });
    const databaseAfter = await readDatabaseNow();
    expect(res.ok).toBe(true);

    const events = await adminSelectQuoteEventsForVersion(versionId);
    const sentEvent = events.find((e) => e.event_type === "sent");
    expectDatabaseOwnedTimestamp(sentEvent?.occurred_at, databaseBefore, databaseAfter);
    expect(sentEvent?.channel).toBeNull();
    expect(sentEvent?.reference).toBeNull();
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits).toHaveLength(1);
    expectDatabaseOwnedTimestamp(audits[0]?.created_at, databaseBefore, databaseAfter);
  });
});

describe("markQuoteVersionSent — command-layer immutability (AC2, R-605 layer 1)", () => {
  it("[P0] 6.4-INT-02: a re-send of an already-SENT version ⇒ QUOTE_VERSION_LOCKED (distinct from QUOTE_VERSION_NOT_DRAFT), row unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Mark a draft sent via the command (the real transition), then re-attempt the send.
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");
    await establishCurrentPdf(versionId);
    const first = await runCommand(markQuoteVersionSent, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    const before = await adminSelectQuoteVersionRow(versionId);

    const res = await runCommand(markQuoteVersionSent, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    // The NEW 6.4 code — DISTINCT from 6.2's QUOTE_VERSION_NOT_DRAFT.
    expect(res.code).toBe("QUOTE_VERSION_LOCKED");
    expect(res.message).not.toMatch(/update|select|status|stack|23514|QV409/i);
    // The row is byte-unchanged (the guard fired BEFORE any write).
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.intro_text).toBe(before?.intro_text);
    expect(after?.status).toBe("sent");
  });

  it("[P0] 6.4-INT-02: a customer-visible EDIT command against a SENT version ⇒ QUOTE_VERSION_NOT_DRAFT (the 6.2 draft-edit path), row unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    const before = await adminSelectQuoteVersionRow(versionId);

    // The 6.2 draft-edit path returns QUOTE_VERSION_NOT_DRAFT for a non-draft version (its own
    // draft-scope guard). This proves the TWO codes co-exist and are distinct (the edit-scope guard
    // vs the mark-sent immutability lock) — both reject the mutation BELOW the UI.
    const res = await runCommand(updateDraftQuoteVersion, {
      client: a as never,
      input: { quote_version_id: versionId, intro_text: "försök att ändra en skickad" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("QUOTE_VERSION_NOT_DRAFT");
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.intro_text).toBe(before?.intro_text);
    expect(after?.status).toBe("sent");
  });
});

describe("markQuoteVersionSent — DB-layer immutability BELOW the command (AC2, R-605 layer 2)", () => {
  it("[P0] 6.4-INT-03: a DIRECT own-tenant authenticated UPDATE of a customer-visible column on a SENT version is REJECTED by the trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    const before = await adminSelectQuoteVersionRow(versionId);

    // A DIRECT own-tenant AUTHENTICATED update on the anon-key RLS client (`a` IS the authed
    // SupabaseClient, NOT the BYPASSRLS admin pool) — the "below-the-command" attack the sent-lock
    // trigger must block (architecture §9). It targets a customer-visible commitment column
    // (`intro_text`) on an OWN-TENANT (RLS-visible) sent row, so the trigger RAISE — not RLS
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

  it("[P0] 6.4-INT-03: a DIRECT UPDATE of a money commitment column (base_total_ore) on a SENT version is REJECTED by the trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    const before = await adminSelectQuoteVersionRow(versionId);

    const { error } = await a
      .from("quote_versions")
      .update({ base_total_ore: 999999 })
      .eq("id", versionId)
      .select();

    expect(error).not.toBeNull();
    const after = await adminSelectQuoteVersionRow(versionId);
    // bigint öre reads back as a STRING via raw pg — compare by representation.
    expect(String(after?.base_total_ore)).toBe(String(before?.base_total_ore));
  });

  it("[P0] 10.8/10.9: direct authenticated PDF render-state DML is denied; narrow render RPCs are the only allowed path", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");

    // Derived PDF state remains allowed only through the attributable start/complete RPCs; direct
    // authenticated table DML is no longer a provenance bypass.
    const { error } = await a
      .from("quote_versions")
      .update({ pdf_status: "generating" })
      .eq("id", versionId)
      .select();

    expect(error?.code).toBe("42501");
  });

  it("[P0] 10.8: direct authenticated lifecycle DML is denied; lifecycle transitions require their narrow RPC", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");

    // A status UPDATE used to be trigger-permitted. It is now denied at the table
    // boundary so callers cannot bypass review provenance.
    const { error } = await a
      .from("quote_versions")
      .update({ status: "accepted" })
      .eq("id", versionId)
      .select();

    expect(error?.code).toBe("42501");
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.status).toBe("sent");
  });

  it("[P0] 6.4-INT-03: a direct authenticated UPDATE of a customer-visible line on a SENT version is REJECTED (attachment/line snapshot immutable)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a DRAFT version + its line (the child-lock allows writes to a draft parent), then flip
    // the parent to SENT via the command — the line is now frozen.
    const { versionId } = await seedQuoteVersion(
      fixture.tenantA.id,
      "draft",
      undefined,
      85_000,
    );
    expect((await adminSelectQuoteVersionRow(versionId))?.status).toBe("draft");
    await establishCurrentPdf(versionId);
    const sent = await runCommand(markQuoteVersionSent, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(sent.ok, JSON.stringify(sent)).toBe(true);
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

  it("[P0] 10.8: a direct authenticated DRAFT mutation is denied; the command/RPC path is required", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");

    // Provenance hardening removes direct quote_versions DML even while draft.
    const { error } = await a
      .from("quote_versions")
      .update({ intro_text: "draft edit still allowed" })
      .eq("id", versionId)
      .select();

    expect(error?.code).toBe("42501");
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.intro_text).not.toBe("draft edit still allowed");
  });

  it("[P0] 6.4-INT-03: a line INSERT into a SENT version is REJECTED (a crafted new line cannot be smuggled into a frozen snapshot)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");

    // The child-lock trigger fires on INSERT too — a new line cannot be added to a sent version.
    const { error } = await a
      .from("quote_version_lines")
      .insert({
        tenant_id: fixture.tenantA.id,
        quote_version_id: versionId,
        row_type: "line",
        label: "smuggled line",
        unit_sell_ore: 100000,
        sort_order: 99,
      })
      .select();

    expect(error).not.toBeNull();
    const after = await adminSelectQuoteVersionLines(versionId);
    expect(after.length).toBe(0);
  });

  it("[P0] 6.4-INT-03: a DIRECT own-tenant status REVERSAL (sent → draft) is REJECTED by the trigger (immutability cannot be disarmed)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Review finding: `status` is exempt so the lifecycle can advance, but a REVERSAL back to
    // 'draft' would disarm both the sent-lock (its old.status='draft' early-return) and the
    // child-lock (which keys off parent status <> 'draft'), re-opening every frozen column. The
    // legal-transition guard must reject any move OUT of a non-draft state back to 'draft'.
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");

    const { error } = await a
      .from("quote_versions")
      .update({ status: "draft" })
      .eq("id", versionId)
      .select();

    expect(error).not.toBeNull();
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.status).toBe("sent");
  });

  it("[P0] 6.4-INT-03: a DIRECT own-tenant RE-PARENT (quote_id → another own-tenant quote) of a SENT version is REJECTED by the trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Review finding: quote_id was in neither the exempt list nor the locked comparison tuple, so a
    // valid own-tenant re-parent (moving a sent commitment to a DIFFERENT own-tenant quote — passes
    // the composite same-tenant FK + RLS WITH CHECK) slipped past the trigger. quote_id (and the
    // other identity columns) are now in the locked tuple, so the re-parent RAISES.
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    const before = await adminSelectQuoteVersionRow(versionId);
    // A SECOND own-tenant quote to re-parent onto (same tenant → passes the same-tenant FK + RLS).
    const otherCustomerId = await adminInsertCustomer({
      tenant_id: fixture.tenantA.id,
      customer_type: "company",
      display_name: `reparent-customer-${crypto.randomUUID().slice(0, 8)}`,
    });
    const otherQuoteId = await adminInsertQuote({
      tenant_id: fixture.tenantA.id,
      customer_id: otherCustomerId,
    });

    const { error } = await a
      .from("quote_versions")
      .update({ quote_id: otherQuoteId })
      .eq("id", versionId)
      .select();

    expect(error).not.toBeNull();
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.quote_id).toBe(before?.quote_id);
    expect(after?.status).toBe("sent");
  });
});

describe("markQuoteVersionSent — send gated by the 5.4 readiness classifier (AC1, R-608)", () => {
  it("[P0] 6.4-INT-04: a draft whose frozen readiness carries a BLOCKER cannot be marked sent (same 5.4 classifier — no forked rule)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a draft version whose frozen warnings_snapshot carries a BLOCKER (the 5.4 classifier
    // codes+severities the 6.1 create path captures). The send must be REJECTED (VALIDATION_FAILED)
    // — a blocked draft is unsendable, gated by the SAME classification logic (no forked rule).
    const { versionId } = await seedQuoteVersion(
      fixture.tenantA.id,
      "draft",
      BLOCKED_WARNINGS,
    );

    const res = await runCommand(markQuoteVersionSent, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("VALIDATION_FAILED");
    // The version stayed DRAFT (the blocked send never flipped it) — no leaked blocker detail
    // (the generic message never echoes a code/severity/customer value).
    expect(res.message).not.toMatch(/blocker|MISSING_CUSTOMER/i);
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.status).toBe("draft");
  });

  it("[P0] 6.4-INT-04: a draft with only WARNINGS (no blocker) IS sendable only on the explicit demo track", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const previousTrack = process.env.ELPRO_QUOTE_SEND_TRACK;
    process.env.ELPRO_QUOTE_SEND_TRACK = "demo";
    try {
      const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft", [
        { code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "…" },
        { code: "MISSING_FACILITY", severity: "warning", message: "…" },
      ]);
      await establishCurrentPdf(versionId);

      const res = await runCommand(markQuoteVersionSent, {
        client: a as never,
        input: { quote_version_id: versionId },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });

      expect(res.ok).toBe(true);
      const after = await adminSelectQuoteVersionRow(versionId);
      expect(after?.status).toBe("sent");
    } finally {
      if (previousTrack === undefined) delete process.env.ELPRO_QUOTE_SEND_TRACK;
      else process.env.ELPRO_QUOTE_SEND_TRACK = previousTrack;
    }
  });

  it("[P0] Story 10.6: unresolved tax sign-off rejects the same warning-only draft on the real-customer track", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const previousTrack = process.env.ELPRO_QUOTE_SEND_TRACK;
    process.env.ELPRO_QUOTE_SEND_TRACK = "real_customer";
    try {
      const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft", [
        { code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "…" },
        { code: "MISSING_FACILITY", severity: "warning", message: "…" },
      ]);
      await establishCurrentPdf(versionId);

      const res = await runCommand(markQuoteVersionSent, {
        client: a as never,
        input: { quote_version_id: versionId },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.code).toBe("VALIDATION_FAILED");
      const after = await adminSelectQuoteVersionRow(versionId);
      expect(after?.status).toBe("draft");
    } finally {
      if (previousTrack === undefined) delete process.env.ELPRO_QUOTE_SEND_TRACK;
      else process.env.ELPRO_QUOTE_SEND_TRACK = previousTrack;
    }
  });
});

describe("markQuoteVersionSent — cross-tenant rejection (AC3)", () => {
  it("[P0] 6.4-RLS-01: a foreign-tenant (Tenant B) version id → TENANT_ACCESS_DENIED (ownership gate), Tenant-B row untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B draft version (existing but A-invisible) — never a non-existent id.
    const { versionId: bVersionId } = await seedQuoteVersion(fixture.tenantB.id, "draft");
    const before = await adminSelectQuoteVersionRow(bVersionId);

    const res = await runCommand(markQuoteVersionSent, {
      client: a as never, // adminA acting on a Tenant-B version id
      input: { quote_version_id: bVersionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    // No cross-tenant existence signal (same message shape as a not-found id).
    expect(res.message).not.toMatch(/exist|tenant b|another|version/i);
    // The Tenant-B row is untouched (never sent, no `sent` event).
    const after = await adminSelectQuoteVersionRow(bVersionId);
    expect(after?.status).toBe(before?.status);
    expect(after?.status).toBe("draft");
    const events = await adminSelectQuoteEventsForVersion(bVersionId);
    expect(events.some((e) => e.event_type === "sent")).toBe(false);
  });
});
