/**
 * Story 10.3 — ATDD RED-PHASE scaffold: the plan / complete / annotate envelope commands + the
 * one-open partial-unique-index rule + the auto-complete-on-lost seam (10.3-INT-01/02/03, P0,
 * AC1/AC3/AC4; test-design-epic-10.md R-1030/R-1032, R-1015/R-1034).
 *
 *   - 10.3-INT-01 (P0, AC1, R-1030): planning an OPEN follow-up on a SENT version succeeds and appears
 *     as an open row; a SECOND open follow-up on the SAME quote is rejected with the CLEAR
 *     VALIDATION_FAILED message ("En öppen uppföljning finns redan för offerten.") — the partial unique
 *     index (23505) mapped to a clean message, never a raw DB error; a NEW open follow-up IS allowed
 *     once the prior is COMPLETED (planera nästa).
 *   - 10.3-INT-03 (P0, AC3): completing an open follow-up with an OUTCOME sets status='completed',
 *     outcome + completed_at (= the INJECTED clock) on the SAME row; a second complete on an
 *     already-completed row is a clean no-op-reject (VALIDATION_FAILED "Uppföljningen är redan
 *     avslutad."); annotate updates the note on an OPEN row only.
 *   - 10.3-INT-03 coupling (P0, AC3, the 10.3↔10.2 seam): the lost-from-follow-up jump — the shipped
 *     10.2 `markQuoteVersionLost` FIRST, then `completeQuoteFollowUp(follow_up_id, outcome=<the chosen
 *     förlorad/avböjd>)` — leaves NO open follow-up on the now-lost quote, and BOTH writes are audited.
 *   - 10.3-INT-02 (P0, AC4): each of plan / complete / annotate writes EXACTLY ONE audit row carrying
 *     `{ targetId }` metadata ONLY — never the note/outcome free text (possible PII).
 *   - cross-tenant (P0, AC4): adminA acting on a Tenant-B follow-up id ⇒ TENANT_ACCESS_DENIED
 *     generically (envelope ownership gate); the Tenant-B row is untouched.
 *
 * ── WHY the top `describe` is skipped (RED PHASE) ─────────────────────────────────────────────────
 * `planQuoteFollowUp` / `completeQuoteFollowUp` / `annotateQuoteFollowUp` + the `quote_follow_ups` table
 * do NOT exist yet (Tasks 1 + 3 are the DEV phase). To keep the file TYPE-CHECKING today WITHOUT
 * importing non-existent exports, the three commands are LOCAL red-phase placeholders (typed handles
 * whose config never runs) and the follow-up readback is a LOCAL `adminQuery`; the whole suite is
 * `describe.skip` so nothing is invoked. `markQuoteVersionLost` is the REAL shipped 10.2 command. GREEN:
 *   1. replace the placeholders with
 *      `import { planQuoteFollowUp, completeQuoteFollowUp, annotateQuoteFollowUp } from "@/server/commands/quotes";`
 *   2. (optional) move `adminSelectFollowUps` into `tests/factories/tenants.ts`;
 *   3. remove `.skip`. Assertions are the CONTRACT — do not weaken them.
 *
 * Mirrors `mark-quote-version-lost.int.test.ts` (10.2): per-run `crypto.randomUUID()` ids, BYPASSRLS
 * readback, deterministic injected clock, LOCAL Supabase only + visible skip when unreachable. CI
 * (`SUPABASE_TEST_REQUIRED=1`) hard-fails so these proofs are never silently skipped.
 *
 * [Source: story 10.3 AC1/AC3/AC4 + Tasks 1/3/5.5 + Dev Notes "The three commands" / "The
 *  auto-complete-on-lost seam"; test-design-epic-10.md#10.3-INT-01/02/03, R-1030/R-1032/R-1034]
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
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand, type Command } from "@/server/commands/envelope";
import { markQuoteVersionLost } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-19T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/**
 * RED-PHASE command placeholders — typed handles whose config is never executed (the suite is
 * `describe.skip`). GREEN: delete these and import the real commands from `@/server/commands/quotes`.
 */
function redPhaseCommand<I, R>(): Command<I, R> {
  return { config: {} as never };
}
const planQuoteFollowUp = redPhaseCommand<
  { quote_version_id: string; due_date: string; note?: string | null },
  { targetId: string }
>();
const completeQuoteFollowUp = redPhaseCommand<
  { follow_up_id: string; outcome: string },
  { targetId: string }
>();
const annotateQuoteFollowUp = redPhaseCommand<
  { follow_up_id: string; note?: string | null },
  { targetId: string }
>();

type FollowUpRow = {
  id: string;
  status: string;
  outcome: string | null;
  completed_at: string | null;
  note: string | null;
};
/** GREEN: consider moving to tests/factories/tenants.ts (adminSelectFollowUps). */
async function adminSelectFollowUps(quoteId: string): Promise<FollowUpRow[]> {
  return adminQuery<FollowUpRow>(
    `select id, status, outcome, completed_at, note from public.quote_follow_ups
       where quote_id = $1 order by created_at`,
    [quoteId],
  );
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});
afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/** Seed a quote + one SENT version for a tenant (the legal anchor for a follow-up). */
async function seedSentQuoteVersion(tenantId: string): Promise<{ quoteId: string; versionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `followup-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `followup-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "sent",
    intro_text: "skickad offert",
  });
  return { quoteId, versionId };
}

function plan(versionId: string, over: { due_date?: string; note?: string | null } = {}) {
  return runCommand(planQuoteFollowUp, {
    client: a as never,
    input: { quote_version_id: versionId, due_date: over.due_date ?? "2026-08-01", note: over.note },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
}

describe.skip("quote follow-up commands — plan/complete/annotate + one-open + auto-complete-on-lost (AC1/AC3/AC4)", () => {
  it("[P0] 10.3-INT-01: planning an OPEN follow-up on a sent version creates exactly one open row + one audit ({ targetId } only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedSentQuoteVersion(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(planQuoteFollowUp, {
      client: a as never,
      input: { quote_version_id: versionId, due_date: "2026-08-01", note: "ring kund om beslut" },
      clock: fixedClock,
      correlationId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const rows = await adminSelectFollowUps(quoteId);
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("open");
    expect(res.data.targetId).toBe(rows[0]?.id);

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0]?.target_id).toBe(rows[0]?.id);
    expect(audits[0]?.metadata).toEqual({});
    // The planning note must NEVER leak into the audit metadata (allow-list discipline).
    expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/ring kund/i);
  });

  it("[P0] 10.3-INT-01: a SECOND open follow-up on the same quote is rejected with the CLEAR message (R-1030)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedSentQuoteVersion(fixture.tenantA.id);
    const first = await plan(versionId);
    expect(first.ok).toBe(true);

    const second = await plan(versionId);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("VALIDATION_FAILED");
    expect(second.message).toBe("En öppen uppföljning finns redan för offerten.");
    // The raw 23505 / index name must NOT leak.
    expect(second.message).not.toMatch(/23505|unique|index|constraint/i);
    // Still exactly one open row survived.
    const rows = await adminSelectFollowUps(quoteId);
    expect(rows.filter((r) => r.status === "open").length).toBe(1);
  });

  it("[P0] 10.3-INT-01: a NEW open follow-up IS allowed once the prior is COMPLETED (planera nästa)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedSentQuoteVersion(fixture.tenantA.id);
    const first = await plan(versionId);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const done = await runCommand(completeQuoteFollowUp, {
      client: a as never,
      input: { follow_up_id: first.data.targetId, outcome: "kund vill fundera vidare" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(done.ok).toBe(true);

    // With no OPEN row remaining, a fresh plan succeeds (the partial index only forbids a second OPEN).
    const next = await plan(versionId);
    expect(next.ok).toBe(true);
    const open = (await adminSelectFollowUps(quoteId)).filter((r) => r.status === "open");
    expect(open.length).toBe(1);
  });

  it("[P0] 10.3-INT-03: completing an open follow-up sets status/outcome/completed_at on the SAME row (injected clock)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedSentQuoteVersion(fixture.tenantA.id);
    const planned = await plan(versionId);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    const res = await runCommand(completeQuoteFollowUp, {
      client: a as never,
      input: { follow_up_id: planned.data.targetId, outcome: "beslut nästa vecka" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);

    const row = (await adminSelectFollowUps(quoteId))[0];
    expect(row?.status).toBe("completed");
    expect(row?.outcome).toBe("beslut nästa vecka");
    expect(row?.completed_at).toBe(FIXED_ISO);

    // A second complete on the already-completed row is a clean no-op-reject.
    const again = await runCommand(completeQuoteFollowUp, {
      client: a as never,
      input: { follow_up_id: planned.data.targetId, outcome: "igen" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.code).toBe("VALIDATION_FAILED");
    expect(again.message).toBe("Uppföljningen är redan avslutad.");
  });

  it("[P0] 10.3-INT-03: annotate updates the note on an OPEN row only; each command writes ONE audit ({ targetId } only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedSentQuoteVersion(fixture.tenantA.id);
    const planned = await plan(versionId, { note: "första notering" });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const correlationId = crypto.randomUUID();

    const res = await runCommand(annotateQuoteFollowUp, {
      client: a as never,
      input: { follow_up_id: planned.data.targetId, note: "uppdaterad notering" },
      clock: fixedClock,
      correlationId,
    });
    expect(res.ok).toBe(true);
    expect((await adminSelectFollowUps(quoteId))[0]?.note).toBe("uppdaterad notering");

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0]?.metadata).toEqual({});
    expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/notering/i);
  });

  it("[P0] 10.3-INT-03 (10.3↔10.2 seam): the lost-from-follow-up flow leaves NO open follow-up; both writes are audited", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedSentQuoteVersion(fixture.tenantA.id);
    const planned = await plan(versionId);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    // The action-layer orchestration: lost-flip FIRST (the irreversible commitment), then complete the
    // follow-up with the chosen förlorad/avböjd outcome. Both are individually audited (SETTLED DESIGN
    // DECISION 5). This INT models the two-command effect the extended action performs.
    const lostCorr = crypto.randomUUID();
    const lost = await runCommand(markQuoteVersionLost, {
      client: a as never,
      input: { quote_version_id: versionId, outcome: "forlorad", category: "pris" },
      clock: fixedClock,
      correlationId: lostCorr,
    });
    expect(lost.ok).toBe(true);

    const completeCorr = crypto.randomUUID();
    const complete = await runCommand(completeQuoteFollowUp, {
      client: a as never,
      input: { follow_up_id: planned.data.targetId, outcome: "forlorad" },
      clock: fixedClock,
      correlationId: completeCorr,
    });
    expect(complete.ok).toBe(true);

    // No open follow-up survives a lost flip taken from this surface.
    const open = (await adminSelectFollowUps(quoteId)).filter((r) => r.status === "open");
    expect(open.length).toBe(0);
    // Both writes are audited under their own correlation ids.
    expect((await adminSelectAuditEvents({ correlationId: lostCorr })).length).toBe(1);
    expect((await adminSelectAuditEvents({ correlationId: completeCorr })).length).toBe(1);
  });

  it("[P0] 10.3-INT (AC4): a cross-tenant complete (Tenant-B follow-up id) ⇒ TENANT_ACCESS_DENIED generically; row untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B open follow-up (existing but A-invisible) — never a non-existent id.
    const { quoteId: bQuoteId, versionId: bVersionId } = await seedSentQuoteVersion(fixture.tenantB.id);
    const bRows = await adminQuery<{ id: string }>(
      `insert into public.quote_follow_ups (tenant_id, quote_id, quote_version_id, due_date, status)
         values ($1, $2, $3, '2026-08-01', 'open') returning id`,
      [fixture.tenantB.id, bQuoteId, bVersionId],
    );
    const bFollowUpId = bRows[0]!.id;

    const res = await runCommand(completeQuoteFollowUp, {
      client: a as never, // adminA acting on a Tenant-B follow-up id
      input: { follow_up_id: bFollowUpId, outcome: "smuggling" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    expect(res.message).not.toMatch(/exist|tenant b|another|follow/i);
    // The Tenant-B row is untouched — still open, no outcome.
    const after = (await adminSelectFollowUps(bQuoteId))[0];
    expect(after?.status).toBe("open");
    expect(after?.outcome).toBeNull();
  });
});
