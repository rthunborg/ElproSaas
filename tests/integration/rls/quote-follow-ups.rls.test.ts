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
 * `"rls-invisible"` for reads, while Story 11.2 closes authenticated raw INSERT/UPDATE as an
 * unaudited bypass. Plan/complete/annotate now run through checked transactional RPCs that bind
 * their audit events. This suite keeps the schema and tenant-state proof at the database layer and
 * asserts that both own- and cross-tenant direct updates are denied.
 *
 * The table policies still express the lifecycle shape, but their raw authenticated
 * DML grants are deliberately closed. The shared command suite proves the checked
 * RPC behavior; this focused suite proves direct DML cannot bypass it.
 *
 * ── GREEN (Story 10.3 implemented) ────────────────────────────────────────────────────────────────
 * The `quote_follow_ups` table and its `TENANT_TABLES` enrolment are landed. This
 * suite is unskipped and the shared cross-tenant/anon suites retain read coverage.
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

describe("quote_follow_ups audited lifecycle boundary — direct mutation denied (AC4)", () => {
  it("[P0] 10.3-RLS-01: an OWN-TENANT authenticated raw UPDATE is denied before it can bypass the audit transaction", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const followUpId = await seedOpenFollowUp(fixture.tenantA.id);

    const { error } = await a
      .from("quote_follow_ups")
      .update({ note: "annoterad av ägaren" })
      .eq("id", followUpId)
      .select();
    expect(error?.code).toBe("42501");

    const after = await adminQuery<{ note: string | null }>(
      `select note from public.quote_follow_ups where id = $1`,
      [followUpId],
    );
    expect(after[0]?.note).toBe("ursprunglig notering");
  });

  it("[P0] 10.3-RLS-01: a CROSS-TENANT authenticated raw UPDATE is denied and leaves the row unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B follow-up (existing but A-invisible under RLS USING).
    const bFollowUpId = await seedOpenFollowUp(fixture.tenantB.id);

    const { data, error } = await a
      .from("quote_follow_ups")
      .update({ note: "tampered-by-a" })
      .eq("id", bFollowUpId)
      .select();
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();

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
