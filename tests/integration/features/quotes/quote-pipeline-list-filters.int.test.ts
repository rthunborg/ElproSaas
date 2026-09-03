/**
 * Story 10.4 — ATDD RED-PHASE scaffold: list-filter consistency over a MIXED lifecycle fixture
 * (10.4-INT-02, P1, AC2; test-design-epic-10.md R-1043). The status filter (incl. Förlorad/Avböjd), the
 * `Förlustorsak` column, and the `Har uppföljning` / `Försenad uppföljning` follow-up filters already
 * work (shipped 10.2/10.3); this suite PROVES they still return the correct rows over a mixed
 * sent/accepted/lost + open/overdue two-tenant fixture after the 10.4 "render consistently" pass — it is
 * a consistency proof, NOT a filter rewrite (Task 3.2).
 *
 * The read projection (`readQuoteList`, `src/features/quotes/read.ts`) already surfaces per-row
 * `lost_reason` (10.2), `has_open_follow_up` + `overdue_follow_up` (10.3). This scaffold asserts those
 * flags are correct per lifecycle state so the (client-side) filters select the right subset — the
 * rendered-filter contract itself is proven by the E2E (10.4-E2E-01).
 *
 * ── GREEN (Story 10.4 implemented) ───────────────────────────────────────────────────────────────
 * `readQuoteList` gained a NON-behavioral `deps.client` seam (Task 3) so the harness binds tenant A's
 * RLS-scoped client; the mixed two-tenant fixture (a LOST version with a reason + a sent version with an
 * OPEN OVERDUE follow-up) is seeded in `beforeAll` via the existing factories, and the suite is
 * unskipped. Run against a freshly `supabase db reset` LOCAL stack (`SUPABASE_TEST_REQUIRED=1`). The
 * assertions are the CONTRACT.
 *
 * [Source: story 10.4 AC2 + Task 3.1/3.2 + Task 6.2; src/features/quotes/read.ts (readQuoteList — the
 *  lost_reason / has_open_follow_up / overdue_follow_up projection); test-design-epic-10.md#10.4-INT-02,
 *  R-1043]
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
  adminInsertLostQuoteVersionWithReason,
  adminInsertQuoteFollowUp,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../../factories/tenants";
import { isLocalStackReachable } from "../../../support/test-env";
import { skipUnlessStack } from "../../../support/stack-gate";
import { readQuoteList, type QuoteListRow } from "@/features/quotes/read";

/** Bind the RLS-scoped list read to a tenant's authed harness client (the Task 3 `deps.client` seam). */
async function readQuoteListAs(client: TestServerClient): Promise<readonly QuoteListRow[]> {
  const { rows } = await readQuoteList({ client });
  return rows;
}

/** The quote ids a `seedMixedLifecycle` call created — used by the cross-tenant proof to assert that
 * tenant B's seeded quotes never appear in tenant A's RLS-scoped list (and that A's own DO). */
interface MixedLifecycleIds {
  readonly lostQuoteId: string;
  readonly fuQuoteId: string;
  readonly rejectedQuoteId: string;
  readonly expiredQuoteId: string;
}

/** Seed a mixed lifecycle set for a tenant: a LOST quote (reason) + a sent quote with an OPEN OVERDUE
 * follow-up. Anonymized shape-only tokens (no PII). Returns the created quote ids so the cross-tenant
 * proof can assert genuine per-tenant visibility (not just that a list came back). */
async function seedMixedLifecycle(tenantId: string): Promise<MixedLifecycleIds> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `pipeline-mix-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `pipeline-mix-calc-${crypto.randomUUID().slice(0, 8)}`,
  });

  // (a) A LOST quote — its latest version is `lost` and carries a Förlorad/Avböjd reason. Version +
  // reason are seeded in ONE statement/transaction (the writable-CTE factory helper): the 10.2
  // coherence trigger `enforce_lost_version_has_reason` is DEFERRABLE INITIALLY DEFERRED and checks at
  // COMMIT, so a two-statement seed would commit the lost version ALONE and be rejected (QV422).
  const lostQuoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const { quoteVersionId: lostVersionId } = await adminInsertLostQuoteVersionWithReason({
    tenant_id: tenantId,
    quote_id: lostQuoteId,
    calculation_id: calcId,
    outcome: "forlorad",
    category: "pris",
    note: null,
  });
  // 10.4 review: a stranded OPEN follow-up on this now-LOST quote must NOT surface in the list (a
  // decided deal stops escalating). Seed one on the lost version (factory bypasses the app's sent-only
  // gate) so the exclusion is proven against a real row, not just its absence.
  await adminInsertQuoteFollowUp({
    tenant_id: tenantId,
    quote_id: lostQuoteId,
    quote_version_id: lostVersionId,
    due_date: "2026-07-01",
    note: "stranded på förlorad offert",
    status: "open",
  });

  // (b) A sent quote with an OPEN OVERDUE follow-up (a fixed PAST due date → overdue at every run).
  const fuQuoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const fuVersionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: fuQuoteId,
    calculation_id: calcId,
    status: "sent",
  });
  await adminInsertQuoteFollowUp({
    tenant_id: tenantId,
    quote_id: fuQuoteId,
    quote_version_id: fuVersionId,
    due_date: "2026-07-01",
    note: "boka uppföljning",
    status: "open",
  });

  // (c) A REJECTED quote and (d) an EXPIRED quote — both EQUALLY-TERMINAL latest statuses reachable via
  // the Story 6.5 standalone lifecycle command. Each carries a stranded OPEN overdue follow-up that the
  // list must NOT escalate (iteration-2 integration review — rejected/expired are dead deals like lost).
  const seedTerminalWithStrandedFollowUp = async (status: "rejected" | "expired"): Promise<string> => {
    const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
    const versionId = await adminInsertQuoteVersion({
      tenant_id: tenantId,
      quote_id: quoteId,
      calculation_id: calcId,
      status,
    });
    await adminInsertQuoteFollowUp({
      tenant_id: tenantId,
      quote_id: quoteId,
      quote_version_id: versionId,
      due_date: "2026-07-01",
      note: `stranded på ${status} offert`,
      status: "open",
    });
    return quoteId;
  };
  const rejectedQuoteId = await seedTerminalWithStrandedFollowUp("rejected");
  const expiredQuoteId = await seedTerminalWithStrandedFollowUp("expired");

  return { lostQuoteId, fuQuoteId, rejectedQuoteId, expiredQuoteId };
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;
let aSeed: MixedLifecycleIds;
let bSeed: MixedLifecycleIds;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // Seed the mixed lifecycle on BOTH tenants — A's read must reflect ONLY A's rows (cross-tenant proof).
  // Capture each tenant's created quote ids so the isolation assertion can check concrete visibility.
  aSeed = await seedMixedLifecycle(fixture.tenantA.id);
  bSeed = await seedMixedLifecycle(fixture.tenantB.id);
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("10.4-INT-02: list-filter consistency over a mixed lifecycle fixture", () => {
  it("Förlorad/Avböjd rows carry a lost_reason (the Förlustorsak column source) and status 'lost'", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await readQuoteListAs(a);
    const lost = rows.filter((r) => r.lost_reason !== null);
    expect(lost.length).toBeGreaterThan(0);
    for (const r of lost) {
      expect(r.lost_reason).not.toBeNull();
      expect(["forlorad", "avbojd"]).toContain(r.lost_reason?.outcome);
    }
  });

  it("`Har uppföljning` filter → exactly the rows with an open follow-up", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await readQuoteListAs(a);
    const withFollowUp = rows.filter((r) => r.has_open_follow_up);
    // Every row the filter keeps genuinely has an open follow-up; every row it drops does not.
    for (const r of withFollowUp) expect(r.has_open_follow_up).toBe(true);
    for (const r of rows.filter((x) => !x.has_open_follow_up)) expect(r.has_open_follow_up).toBe(false);
  });

  it("`Försenad uppföljning` filter → only rows with an OVERDUE open follow-up (subset of Har uppföljning)", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await readQuoteListAs(a);
    const overdue = rows.filter((r) => r.overdue_follow_up);
    expect(overdue.length).toBeGreaterThan(0);
    // Overdue implies open — the escalation is a strict subset (10.3 date discipline).
    for (const r of overdue) expect(r.has_open_follow_up).toBe(true);
  });

  it("a decided quote (latest version lost) does NOT surface its stranded open follow-up (10.4 review)", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await readQuoteListAs(a);
    // The lost quote carries an OPEN follow-up row in the DB (seeded above), but its latest version is
    // `lost` — the list must EXCLUDE it from has_open_follow_up / overdue_follow_up so a decided deal
    // never keeps escalating a "Försenad uppföljning" badge.
    const lostRow = rows.find((r) => r.id === aSeed.lostQuoteId);
    expect(lostRow).toBeDefined();
    expect(lostRow?.latest_status).toBe("lost");
    expect(lostRow?.has_open_follow_up).toBe(false);
    expect(lostRow?.overdue_follow_up).toBe(false);
  });

  it("a decided quote (latest version rejected OR expired) does NOT surface its stranded open follow-up (iteration-2 review)", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await readQuoteListAs(a);
    // rejected/expired are equally-terminal latest statuses (Story 6.5 lifecycle command). Each quote
    // holds an OPEN overdue follow-up row in the DB, but a decided deal must stop escalating — the list
    // must exclude both from has_open_follow_up / overdue_follow_up exactly as it does for lost.
    for (const [quoteId, status] of [
      [aSeed.rejectedQuoteId, "rejected"],
      [aSeed.expiredQuoteId, "expired"],
    ] as const) {
      const row = rows.find((r) => r.id === quoteId);
      expect(row, `decided (${status}) quote row present`).toBeDefined();
      expect(row?.latest_status).toBe(status);
      expect(row?.has_open_follow_up, `${status}: has_open_follow_up excluded`).toBe(false);
      expect(row?.overdue_follow_up, `${status}: overdue_follow_up excluded`).toBe(false);
    }
  });

  it("cross-tenant: the mixed fixture on tenant B never appears in tenant A's list", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await readQuoteListAs(a);
    const rowIds = new Set(rows.map((r) => r.id));
    // GENUINE isolation proof: tenant B's concretely-seeded quotes are INVISIBLE in tenant A's
    // RLS-scoped list, while tenant A's OWN seeded quotes ARE present (proves the read returned real
    // rows, so the B-absence is isolation — not an empty/failed read). RLS scopes every row to A with
    // no tenant id passed; a leak would surface B's ids here.
    expect(rowIds.has(bSeed.lostQuoteId)).toBe(false);
    expect(rowIds.has(bSeed.fuQuoteId)).toBe(false);
    expect(rowIds.has(aSeed.lostQuoteId)).toBe(true);
    expect(rowIds.has(aSeed.fuQuoteId)).toBe(true);
  });

  it("multi-page: every current quote and latest status survives a page boundary", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const tenantId = fixture.tenantA.id;
    const customerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: `list-page-${crypto.randomUUID()}` });
    const calculationId = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customerId });
    const quoteIds: string[] = [];
    for (let index = 0; index < 501; index += 1) { // one more than RLS_PAGE_SIZE
      const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
      await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: quoteId, calculation_id: calculationId, status: "sent" });
      quoteIds.push(quoteId);
    }
    const rows = await readQuoteListAs(a);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(quoteIds.every((id) => byId.get(id)?.latest_status === "sent")).toBe(true);
  }, 60_000);
});
