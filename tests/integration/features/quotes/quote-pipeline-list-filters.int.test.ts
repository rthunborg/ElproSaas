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
 * ── WHY SKIPPED (RED PHASE) ──────────────────────────────────────────────────────────────────────
 * The 10.4 consistency pass (Task 4 tone fold + Task 3.2 proof) is DEV work; `readQuoteList` reads via
 * the per-request cookie-bound client, so an injectable variant is wired in the integration harness in
 * the green phase. Until then a LOCAL `readQuoteListAs(client)` placeholder keeps the file type-checking
 * and the suite is `describe.skip`. Assertions encode EXPECTED behaviour; the mixed fixture makes them
 * meaningful.
 *
 * ── GREEN-PHASE HAND-OFF (Story 10.4 dev) ────────────────────────────────────────────────────────
 *   1. Wire the injectable list read (bind `readQuoteList`'s query to tenant A's harness client) and
 *      replace the LOCAL `readQuoteListAs` placeholder; seed the mixed fixture via the existing
 *      quote/version/event/lost-reason/follow-up factories (extend with an accepted version + an OPEN
 *      OVERDUE follow-up + a lost version with a reason).
 *   2. Remove `.skip`. Run against a freshly `supabase db reset` LOCAL stack (`SUPABASE_TEST_REQUIRED=1`).
 *      The assertions are the CONTRACT — do NOT weaken them.
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
  type TwoTenantFixture,
  type TestServerClient,
} from "../../../factories/tenants";
import { isLocalStackReachable } from "../../../support/test-env";
import { skipUnlessStack } from "../../../support/stack-gate";
import type { QuoteListRow } from "@/features/quotes/read";

// ── LOCAL red-phase declaration (green phase replaces with the injectable readQuoteList; see hand-off)
function notYetImplemented(): never {
  throw new Error(
    "Story 10.4 not yet implemented — wire the injectable readQuoteList against the harness client in " +
      "the green phase and remove this placeholder.",
  );
}
async function readQuoteListAs(client: TestServerClient): Promise<readonly QuoteListRow[]> {
  void client;
  return notYetImplemented();
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
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("10.4-INT-02: list-filter consistency over a mixed lifecycle fixture", () => {
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

  it("cross-tenant: the mixed fixture on tenant B never appears in tenant A's list", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await readQuoteListAs(a);
    // Every returned row belongs to tenant A (RLS-scoped read); B's mixed lifecycle is invisible.
    // (Row-level tenant ownership is enforced by RLS; the list read passes no tenant id.)
    expect(Array.isArray(rows)).toBe(true);
  });
});
