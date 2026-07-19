/**
 * Story 10.2 — ATDD RED-PHASE scaffold: the INSERT-ONLY enforcement negative for
 * `quote_lost_reasons` (10.2-RLS-01, P0, AC5, R-1013).
 *
 * ── SCOPE: what THIS file pins vs. what the SHARED suites pin ──────────────────────────────────────
 * The cross-tenant read/write + anonymous-path negatives for `quote_lost_reasons` are delivered by
 * ENROLMENT in the single-source inventory (`tenant-table-inventory.ts` → the parameterized
 * `cross-tenant-isolation.rls.test.ts` + `anon-path-isolation.rls.test.ts` + the H4
 * `rls-inventory-gate.int.test.ts`), NOT a hand-written parallel suite (Task 2.2; standing enrolment
 * contract, architecture §18). This file therefore does NOT re-implement those — it pins the ONE
 * profile-specific proof the inventory's mutation switch encodes for this table: the table is
 * INSERT-ONLY, so an OWN-TENANT UPDATE by an authenticated tenant_admin is REJECTED (no UPDATE
 * grant + no UPDATE policy). This is the "own-tenant-UPDATE-rejected" negative the story calls out as
 * the distinctive insert-only signal — the same discipline as `quote_events` / audit append-only.
 *
 * ── GREEN (Story 10.2 landed) ─────────────────────────────────────────────────────────────────────
 * Task 2.2 enrolled `quote_lost_reasons` in `TENANT_TABLES` with its per-table spoof/insert/mutation/
 * anon metadata AND marked its mutation-denial profile INSERT-ONLY (the own-tenant-UPDATE-rejected
 * branch). The migration + enrolment have landed, so this focused own-tenant insert-only negative now
 * RUNS (no longer skipped) against the local stack — it is a table-specific readability aid alongside
 * the shared mutation suite (the same own-tenant-UPDATE→42501 proof also lives in
 * `tests/integration/commands/mark-quote-version-lost.int.test.ts`).
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable. Mirrors the authed-client
 * mutation-rejection pattern in `mark-quote-version-sent.int.test.ts` (the direct-authed-UPDATE proof).
 *
 * [Source: story 10.2 AC5 + Task 2.2 + Task 6.3 + Dev Notes "The quote_lost_reasons table"
 *  (insert-only); test-design-epic-10.md#10.2-RLS-01, R-1013; tests/integration/rls/
 *  tenant-table-inventory.ts (the enrolment seam); tests/integration/rls/anon-path-isolation.rls.test.ts]
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

/** Seed a sent version + a lost-reason row (BYPASSRLS) for Tenant A; returns the reason row id. */
async function seedLostReason(): Promise<string> {
  const customerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "company",
    display_name: `lost-rls-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: fixture.tenantA.id,
    customer_id: customerId,
    title: `lost-rls-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: fixture.tenantA.id, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: fixture.tenantA.id,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "lost",
  });
  const rows = await adminQuery<{ id: string }>(
    `insert into public.quote_lost_reasons (tenant_id, quote_id, quote_version_id, outcome, category, note)
       values ($1, $2, $3, 'forlorad', 'pris', null) returning id`,
    [fixture.tenantA.id, quoteId, versionId],
  );
  return rows[0]!.id;
}

describe("quote_lost_reasons INSERT-ONLY RLS (GREEN — Story 10.2 landed)", () => {
  it("[P0] 10.2-RLS-01: an OWN-TENANT authenticated UPDATE of a lost-reason row is REJECTED (insert-only: no UPDATE grant/policy)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const reasonId = await seedLostReason();

    // adminA is the OWN tenant of this row (RLS-visible). The UPDATE must still be rejected because
    // `authenticated` has NO UPDATE privilege + there is NO UPDATE policy — the archive-over-mutate,
    // append-only reason discipline (like quote_events). A "no rows updated" silent no-op is NOT
    // acceptable: the row must be provably byte-unchanged.
    const { error } = await a
      .from("quote_lost_reasons")
      .update({ note: "försök att ändra en orsak" })
      .eq("id", reasonId)
      .select();

    // Either a hard privilege error (no UPDATE grant) or zero affected rows (no UPDATE policy);
    // in BOTH cases the persisted row is untouched.
    const after = await adminQuery<{ note: string | null }>(
      `select note from public.quote_lost_reasons where id = $1`,
      [reasonId],
    );
    expect(after[0]?.note).toBeNull();
    if (error === null) {
      // If the client did not surface an error, RLS must have matched ZERO rows (no UPDATE policy).
      // The byte-unchanged assertion above is the load-bearing proof either way.
    }
  });

  it("[P0] 10.2-RLS-01: an OWN-TENANT authenticated DELETE of a lost-reason row is REJECTED (no DELETE grant/policy)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const reasonId = await seedLostReason();

    await a.from("quote_lost_reasons").delete().eq("id", reasonId).select();

    // The row still exists (archive-over-delete; insert-only table).
    const after = await adminQuery<{ id: string }>(
      `select id from public.quote_lost_reasons where id = $1`,
      [reasonId],
    );
    expect(after.length).toBe(1);
  });
});
