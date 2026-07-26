/**
 * Story 10.3 — ATDD RED-PHASE scaffold: the distinctive UPDATABLE ("rls-invisible") mutation profile
 * for `quote_follow_ups` (10.3-RLS-01, P0, AC4; test-design-epic-10.md R-1034).
 *
 * ── SCOPE: what THIS file pins vs. what the SHARED suites pin ──────────────────────────────────────
 * The cross-tenant read/write + anonymous-path negatives for `quote_follow_ups` are delivered by
 * ENROLMENT in the single-source inventory (`tenant-table-inventory.ts` → the parameterized
 * `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts` + the H4
 * `rls-inventory-gate.int.test.ts`), NOT a hand-written parallel suite (Task 2.3; standing enrolment
 * contract, architecture §18). This file pins only the ONE profile-specific proof that is DIFFERENT
 * from 10.2's insert-only table: `quote_follow_ups` is UPDATE-able, so its mutation-denial profile is
 * `"rls-invisible"` (SETTLED DESIGN DECISION 1, mirror `quote_acceptances`) — meaning:
 *   - an OWN-TENANT authenticated UPDATE of a follow-up row is ALLOWED (open → completed / annotate is
 *     an UPDATE) — the load-bearing contrast with the insert-only `quote_lost_reasons`;
 *   - a CROSS-TENANT authenticated UPDATE matches ZERO rows under RLS `USING` (the foreign row is
 *     invisible) and leaves the target row byte-UNCHANGED — asserted via zero-rows-affected PLUS a
 *     BYPASSRLS re-read (never a vacuous empty set);
 *   - an OWN-TENANT authenticated DELETE is REJECTED (no DELETE grant/policy — archive-over-delete).
 *
 * Getting the profile wrong (using `"privilege"` as for 10.2) would make the cross-tenant UPDATE assert
 * the WRONG mechanism — hence this focused readability aid alongside the shared mutation suite.
 *
 * ── GREEN (Story 10.3 implemented) ────────────────────────────────────────────────────────────────
 * The `quote_follow_ups` table + its `TENANT_TABLES` enrolment (mutation profile `"rls-invisible"`) are
 * landed; this suite is unskipped and green, and the shared cross-tenant/anon suites also cover this
 * table via enrolment.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable. Mirrors the authed-client
 * mutation pattern in `quote-lost-reasons.rls.test.ts` (10.2) — inverted for the UPDATE-allowed profile.
 *
 * [Source: story 10.3 AC4 + Task 2.3 + Task 6.3 + Dev Notes "The quote_follow_ups table" (updatable) +
 *  SETTLED DESIGN DECISION 1; test-design-epic-10.md#10.3-RLS-01, R-1034; tests/integration/rls/
 *  tenant-table-inventory.ts (updateDenialKind — the enrolment seam)]
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
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

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

/** Seed a sent version + one OPEN follow-up (BYPASSRLS) for a tenant; returns the follow-up row id. */
async function seedOpenFollowUp(tenantId: string): Promise<string> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `fu-rls-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `fu-rls-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "sent",
  });
  const rows = await adminQuery<{ id: string }>(
    `insert into public.quote_follow_ups (tenant_id, quote_id, quote_version_id, due_date, note, status)
       values ($1, $2, $3, '2026-08-01', 'ursprunglig notering', 'open') returning id`,
    [tenantId, quoteId, versionId],
  );
  return rows[0]!.id;
}

describe("quote_follow_ups UPDATABLE RLS profile (rls-invisible) — own-tenant UPDATE allowed, cross-tenant hidden (AC4)", () => {
  it("[P0] 10.3-RLS-01: an OWN-TENANT authenticated UPDATE of a follow-up note is ALLOWED (updatable table)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const followUpId = await seedOpenFollowUp(fixture.tenantA.id);

    // adminA is the OWN tenant of this row (RLS-visible + UPDATE grant + UPDATE policy).
    const { error } = await a
      .from("quote_follow_ups")
      .update({ note: "annoterad av ägaren" })
      .eq("id", followUpId)
      .select();
    expect(error).toBeNull();

    const after = await adminQuery<{ note: string | null }>(
      `select note from public.quote_follow_ups where id = $1`,
      [followUpId],
    );
    expect(after[0]?.note).toBe("annoterad av ägaren");
  });

  it("[P0] 10.3-RLS-01: a CROSS-TENANT authenticated UPDATE matches ZERO rows and leaves the row UNCHANGED (rls-invisible)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B follow-up (existing but A-invisible under RLS USING).
    const bFollowUpId = await seedOpenFollowUp(fixture.tenantB.id);

    const { data, error } = await a
      .from("quote_follow_ups")
      .update({ note: "tampered-by-a" })
      .eq("id", bFollowUpId)
      .select();
    // UPDATE grant EXISTS, so no privilege error; RLS USING hides the foreign row → zero rows affected.
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);

    // BYPASSRLS re-read proves the Tenant-B row is byte-UNCHANGED (never a vacuous empty set).
    const after = await adminQuery<{ note: string | null }>(
      `select note from public.quote_follow_ups where id = $1`,
      [bFollowUpId],
    );
    expect(after[0]?.note).toBe("ursprunglig notering");
  });

  it("[P0] 10.3-RLS-01: an OWN-TENANT authenticated DELETE of a follow-up row is REJECTED (no DELETE grant/policy)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const followUpId = await seedOpenFollowUp(fixture.tenantA.id);

    await a.from("quote_follow_ups").delete().eq("id", followUpId).select();

    // The row still exists (archive-over-delete; NO delete grant even for the owner).
    const after = await adminQuery<{ id: string }>(
      `select id from public.quote_follow_ups where id = $1`,
      [followUpId],
    );
    expect(after.length).toBe(1);
  });
});
