/**
 * Story 7.1 — the `captureQuoteAcceptance` command: the sent-state gate (AC3), the server-side
 * adjusted-price reason/evidence gate (AC2), and the öre-discipline + audit-hygiene persistence
 * (AC5). These are the load-bearing behavioral proofs of 7.1 — a UI mirror is NOT the guarantee
 * (the client cannot bypass the server re-validation).
 *
 *   - 7.1-INT-02 (P0, AC3, R-706/R-707): acceptance capture is legal ONLY on `status = 'sent'`
 *     (matrix FINALIZED against the landed Epic 6 state machine — draft/sent/accepted/rejected/
 *     expired/superseded). One negative per non-sent state PLUS a cross-tenant version. A non-sent
 *     state ⇒ VALIDATION_FAILED with a USER-SAFE message that does NOT leak the exact status (NOT
 *     QUOTE_VERSION_LOCKED — a different meaning). A cross-tenant / foreign version id ⇒
 *     TENANT_ACCESS_DENIED BEFORE execute (the ownership gate; no existence disclosure).
 *   - 7.1-INT-03 (P0, AC2, R-705): an accepted price ≠ the frozen source sent total REQUIRES an
 *     explicit `adjustment_reason` (or evidence). Re-validated SERVER-SIDE: a missing reason ⇒
 *     VALIDATION_FAILED even if the client omitted it; WITH a reason ⇒ accepted and the delta is
 *     captured (the delta computed via the Task 3 pure module / @/lib/money, never ad hoc). An
 *     EQUAL accepted price needs no reason.
 *   - 7.1-INT-05 (P1, AC5, R-705/R-710): on a successful capture, `accepted_price_ore` AND
 *     `source_sent_total_ore` persist as integer öre (`bigint`, canonical guards), and a SINGLE
 *     `audit_events` row is written with ALLOW-LISTED metadata — `{ targetId }` ONLY, NO raw
 *     accepted price / channel / customer PII in the audit metadata.
 *
 * Compatibility persistence shape (Story 10.8): `captureQuoteAcceptance` preserves its historic
 * `{ targetId }` result but delegates its write to the same atomic `accept_quote_and_create_job`
 * RPC as the live action. `accepted_at` remains an EXPLICIT input field (H1 determinism); the
 * resolved tenant, actor, and correlation id are the only authorities supplied to the RPC. An
 * authenticated user cannot directly INSERT an own-tenant acceptance row.
 *
 * Mirrors `mark-quote-version-sent.int.test.ts`: per-run unique ids (`crypto.randomUUID()`), raw pg
 * readback via the BYPASSRLS admin helpers (bigint öre → STRING; timestamptz → Date; coerce on
 * readback), runs against the LOCAL Supabase stack only + visibly skips when unreachable. AFTER a
 * `supabase db reset` the runner polls `/auth/v1/health` to 200 before this suite. CI
 * (`SUPABASE_TEST_REQUIRED=1`) hard-fails so these DB-backed proofs are never silently skipped.
 *
 * The REAL sent fixture is produced by driving the LANDED Epic-6 `mark_quote_version_sent` RPC (no
 * synthetic `sent` row): seed a version as `draft` → flip to `sent` via the real command.
 *
 * [Source: test-design-epic-7.md#7.1-INT-02/03/05, R-705/R-706/R-707/R-710; story 7.1 Task 4 +
 *  AC2/AC3/AC5; testability notes 6 + 7; src/server/commands/quotes/accept.ts]
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
  adminUpdateQuoteVersionStatus,
  adminSelectQuoteAcceptanceRow,
  adminSelectAcceptancesForVersion,
  adminSelectJobsForAcceptance,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { captureQuoteAcceptance } from "@/server/commands/quotes";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-09T09:00:00.000Z";
const ACCEPTED_ISO = "2026-07-09T08:30:00.000Z"; // the EXPLICIT accepted moment (≠ command clock)
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** The frozen source sent total (öre) every seeded version carries (< 10 digits — R-717). */
const SOURCE_SENT_TOTAL_ORE = 125_000;

/** The non-sent version states that acceptance MUST reject (AC3, matrix finalized vs Epic 6). */
const NON_SENT_STATES = ["draft", "accepted", "rejected", "expired", "superseded"] as const;

/**
 * Seed a quote + one version carrying the frozen source sent total, in the requested `status`.
 * A `sent` version is produced by seeding a draft then flipping to sent (BYPASSRLS bypasses the
 * sent-lock trigger for seeding — the acceptance gate reads the REAL persisted status). The
 * terminal states are seeded directly (a legitimate persisted status). Returns the ids.
 */
async function seedVersion(
  tenantId: string,
  status: string,
): Promise<{ quoteId: string; versionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `acc-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `acc-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  // The draft -> sent flip is a LEGAL transition and stays on its proven two-step path (7 call sites
  // depend on it). Every OTHER target is seeded AT its status directly: the old shape updated
  // draft -> accepted/rejected/expired/superseded, which the domain state machine forbids (draft
  // advances only to sent) and which the sent-lock trigger now rejects on the draft branch too
  // (Codex P1). `enforce_quote_version_sent_lock` is an UPDATE trigger, so a direct insert at a
  // terminal status is legal — and truer to what these cases need: a version that IS in a non-sent
  // state, not a record of how it got there.
  const seedStatus = status === "sent" ? "draft" : status;
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status: seedStatus,
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
  });
  if (status === "sent") {
    await adminUpdateQuoteVersionStatus(versionId, "sent");
  }
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

describe("captureQuoteAcceptance — sent-state gate (AC3)", () => {
  for (const state of NON_SENT_STATES) {
    it(`[P0] 7.1-INT-02: a '${state}' (non-sent) version is rejected with a user-safe lifecycle error that does NOT leak the exact status`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const { versionId } = await seedVersion(fixture.tenantA.id, state);

      const res = await runCommand(captureQuoteAcceptance, {
        client: a as never,
        input: {
          quote_version_id: versionId,
          accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
          accepted_at: ACCEPTED_ISO,
        },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.code).toBe("VALIDATION_FAILED");
      // User-safe — no leaked status / code / SQL.
      expect(res.message).not.toMatch(new RegExp(state, "i"));
      expect(res.message).not.toMatch(/status|QV409|23514|stack/i);
      // No acceptance row was written.
      const rows = await adminSelectAcceptancesForVersion(versionId);
      expect(rows.length).toBe(0);
    });
  }

  it("[P0] 7.1-INT-02: a CROSS-TENANT / foreign quote version id ⇒ TENANT_ACCESS_DENIED before execute (no existence disclosure)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B SENT version (existing but A-invisible) — never a non-existent id.
    const { versionId: bVersionId } = await seedVersion(fixture.tenantB.id, "sent");

    const res = await runCommand(captureQuoteAcceptance, {
      client: a as never, // adminA acting on a Tenant-B version id
      input: {
        quote_version_id: bVersionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        accepted_at: ACCEPTED_ISO,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    expect(res.message).not.toMatch(/exist|tenant b|another|version/i);
    const rows = await adminSelectAcceptancesForVersion(bVersionId);
    expect(rows.length).toBe(0);
  });

  it("[P0] Story 10.8: an authenticated own-tenant client cannot directly INSERT quote_acceptances (42501); the atomic RPC is the only app write path", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedVersion(fixture.tenantA.id, "sent");

    const { error } = await a.from("quote_acceptances").insert({
      tenant_id: fixture.tenantA.id,
      quote_id: quoteId,
      quote_version_id: versionId,
      accepted_at: ACCEPTED_ISO,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
      source_sent_total_ore: SOURCE_SENT_TOTAL_ORE,
    });

    expect(error?.code).toBe("42501");
    expect((await adminSelectAcceptancesForVersion(versionId)).length).toBe(0);
  });
});

describe("captureQuoteAcceptance — adjusted-price server-side gate (AC2)", () => {
  it("[P0] 7.1-INT-03: an accepted price EQUAL to the sent total is accepted with NO adjustment reason", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedVersion(fixture.tenantA.id, "sent");

    const res = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        accepted_at: ACCEPTED_ISO,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await adminSelectQuoteAcceptanceRow(res.data.targetId);
    expect(String(row?.accepted_price_ore)).toBe(String(SOURCE_SENT_TOTAL_ORE));
    expect(row?.adjustment_reason).toBeNull();
  });

  it("[P0] 7.1-INT-03: an accepted price ≠ the sent total with NO reason ⇒ VALIDATION_FAILED (server re-validates; client cannot bypass)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedVersion(fixture.tenantA.id, "sent");

    const res = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE + 5_000,
        accepted_at: ACCEPTED_ISO,
        // NO adjustment_reason supplied — the server MUST reject the delta.
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("VALIDATION_FAILED");
    const rows = await adminSelectAcceptancesForVersion(versionId);
    expect(rows.length).toBe(0);
  });

  it("[P0] 7.1-INT-03: an accepted price ≠ the sent total WITH a reason ⇒ accepted and the delta is captured", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedVersion(fixture.tenantA.id, "sent");

    const res = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE - 5_000,
        accepted_at: ACCEPTED_ISO,
        adjustment_reason: "kundrabatt",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await adminSelectQuoteAcceptanceRow(res.data.targetId);
    // The öre values persist; the delta = accepted − sent = −5000 (computed via @/lib/money).
    expect(String(row?.accepted_price_ore)).toBe(String(SOURCE_SENT_TOTAL_ORE - 5_000));
    expect(String(row?.source_sent_total_ore)).toBe(String(SOURCE_SENT_TOTAL_ORE));
    // Story 10.8 compatibility behavior: capture now uses the authoritative transaction, so its
    // returned acceptance always has its paired job in the same commit.
    expect((await adminSelectJobsForAcceptance(res.data.targetId)).length).toBe(1);
    expect(row?.adjustment_reason).toBe("kundrabatt");
  });

  it("[P0] 7.1-INT-03: an adjusted price with an EXTERNAL evidence reference (no reason text) is accepted (evidence satisfies the gate)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedVersion(fixture.tenantA.id, "sent");

    const res = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE + 2_000,
        accepted_at: ACCEPTED_ISO,
        evidence_reference: "kundmail 2026-07-09, ärende 4711",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await adminSelectQuoteAcceptanceRow(res.data.targetId);
    expect(row?.evidence_reference).toBe("kundmail 2026-07-09, ärende 4711");
    expect(row?.adjustment_reason).toBeNull();
  });
});

describe("captureQuoteAcceptance — compatibility result, öre persistence + audit hygiene (AC5)", () => {
  it("[P1] 7.1-INT-05 / Story 10.8: the compatibility facade returns the acceptance target while the atomic RPC persists the job-backed acceptance and a SINGLE audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedVersion(fixture.tenantA.id, "sent");
    const correlationId = crypto.randomUUID();

    const res = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        accepted_at: ACCEPTED_ISO,
        channel: "email",
        notes: "kundens bekräftelse",
      },
      clock: fixedClock,
      correlationId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await adminSelectQuoteAcceptanceRow(res.data.targetId);
    // Öre columns read back as STRING via raw pg — compare by representation.
    expect(String(row?.accepted_price_ore)).toBe(String(SOURCE_SENT_TOTAL_ORE));
    expect(String(row?.source_sent_total_ore)).toBe(String(SOURCE_SENT_TOTAL_ORE));
    // accepted_at is the EXPLICIT input instant, NOT the injected command clock (H1 determinism).
    const acceptedAt =
      row?.accepted_at instanceof Date
        ? row.accepted_at.toISOString()
        : String(row?.accepted_at);
    expect(acceptedAt).toBe(ACCEPTED_ISO);
    expect(acceptedAt).not.toBe(FIXED_ISO);

    // EXACTLY ONE append-only audit row: target_id is the acceptance id; metadata is `{}` (the
    // `{ targetId }` allow-list lives on the target_id COLUMN). It is created atomically by the
    // RPC, not appended again by the compatibility command envelope.
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    const audit = audits[0];
    expect(audit?.target_id).toBe(res.data.targetId);
    expect(audit?.metadata).toEqual({});
    expect(JSON.stringify(audit?.metadata)).not.toMatch(/email|125000|bekräftelse|ore/i);
  });

  it("[P0] 7.1-INT-02: a duplicate capture of the SAME version ⇒ VALIDATION_FAILED (the unique-version backstop; no second row)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedVersion(fixture.tenantA.id, "sent");

    const first = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        accepted_at: ACCEPTED_ISO,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);

    const second = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        accepted_at: ACCEPTED_ISO,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("VALIDATION_FAILED");
    // Exactly ONE acceptance row for the version (the unique (quote_version_id) backstop held).
    const rows = await adminSelectAcceptancesForVersion(versionId);
    expect(rows.length).toBe(1);
  });
});
