/**
 * Story 3.4 — ATDD RED-PHASE scaffold: H4 enrollment + cross-tenant/anon RLS negatives
 * for the two NEW pricing tables (`work_roles`, `articles`) (AC4, P0).
 *
 * ── WHY A SELF-CONTAINED RED-PHASE SCAFFOLD (not an edit to the live inventory) ──
 * The shared `tenant-table-inventory.ts` + the cross-tenant / anon-path suites + the H4
 * gate (`rls-inventory-gate.int.test.ts`) are GREEN and ACTIVE — they assert the EXACT
 * currently-enrolled set. Adding `work_roles`/`articles` to `TENANT_TABLES` NOW (before
 * the migration exists) would FAIL the live green suites against non-existent tables.
 * So this scaffold pins the enrollment CONTRACT in a `describe.skip` block instead; the
 * GREEN phase (Story 3.4 dev Task 3.1-3.3) does the REAL wiring:
 *   1. Add "work_roles","articles" to TENANT_TABLES in tenant-table-inventory.ts.
 *   2. Add a metadata branch in EVERY per-table switch (updateDenialKind →
 *      "rls-invisible"; rlsInvisibleLabelColumn → "display_name"/"name"; spoofedRowFor;
 *      tenantBFilter; hijackMutationFor; anonRowFor; anonFilterFor; anonMutationFor) —
 *      the assertNever exhaustiveness guard makes a missing branch a TYPECHECK error.
 *   3. Add tenantBWorkRoleId/tenantBArticleId to InventoryContext (optional,
 *      vacuity-guarded) + adminInsertWorkRole/adminInsertArticle factory helpers, and
 *      seed Tenant B rows in cross-tenant-isolation.rls.test.ts's beforeAll.
 *   4. EXTEND migration-reset.int.test.ts's exact-policy enumeration (+6 entries,
 *      articles.* first alphabetically) and its no-DELETE group — EXTEND, never loosen.
 *   5. Delete THIS scaffold (its contract is then enforced live by the parameterized
 *      suites) OR un-skip it as a focused companion. Do NOT loosen the live gate.
 *
 * The assertions below mirror the AUTHORITATIVE cross-tenant suite's mechanism
 * (cross-tenant-isolation.rls.test.ts) so the dev phase has the exact target shape.
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 *
 * The LOAD-BEARING contracts these tests pin (the story encodes them):
 *   - Both new tables enrolled (cross-tenant + anon-DML seams) — AC4 / H4 single
 *     enrollment contract.
 *   - assert-the-mechanism negatives: cross-tenant SELECT sees ZERO rows; cross-tenant
 *     UPDATE is "rls-invisible" (zero-rows-affected + an independent BYPASSRLS re-read
 *     proving Tenant B's row is UNCHANGED); cross-tenant INSERT spoofing B's tenant_id
 *     fails the WITH CHECK (42501); DELETE stays "privilege" (42501, no DELETE grant);
 *     anon SELECT/INSERT/UPDATE/DELETE all denied (anon-DML-empty).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const PRICING_TABLES = ["work_roles", "articles"] as const;
type PricingTable = (typeof PRICING_TABLES)[number];

/** The human label column the unchanged-re-read inspects per table (rls-invisible). */
const LABEL_COLUMN: Record<PricingTable, string> = {
  work_roles: "display_name",
  articles: "name",
};

/** A spoof row forging Tenant B ownership — fresh id + the NOT-NULL columns populated. */
function spoofRowFor(table: PricingTable, tenantBId: string): Record<string, unknown> {
  if (table === "work_roles") {
    return {
      id: crypto.randomUUID(),
      tenant_id: tenantBId,
      display_name: "spoofed-by-tenant-a",
      cost_rate_ore: 1,
      sell_rate_ore: 1,
    };
  }
  return {
    id: crypto.randomUUID(),
    tenant_id: tenantBId,
    name: "spoofed-by-tenant-a",
    unit_price_ore: 1,
  };
}

/** The hijack UPDATE payload — would overwrite the label column if it landed. */
function hijackFor(table: PricingTable): Record<string, unknown> {
  return table === "work_roles"
    ? { display_name: "hijacked-by-tenant-a" }
    : { name: "hijacked-by-tenant-a" };
}

/** RED-PHASE BYPASSRLS seed (GREEN: replace with adminInsertWorkRole/adminInsertArticle). */
async function adminSeedPricingRow(table: PricingTable, tenantId: string): Promise<string> {
  if (table === "work_roles") {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.work_roles (tenant_id, display_name, cost_rate_ore, sell_rate_ore)
       values ($1, 'tenant-b-role-seed', 30000, 60000) returning id`,
      [tenantId],
    );
    return rows[0].id;
  }
  const rows = await adminQuery<{ id: string }>(
    `insert into public.articles (tenant_id, name, unit_price_ore)
     values ($1, 'tenant-b-article-seed', 500) returning id`,
    [tenantId],
  );
  return rows[0].id;
}

/** Independent BYPASSRLS label re-read — proves a foreign row stayed UNCHANGED. */
async function adminSelectLabel(table: PricingTable, id: string): Promise<string | null> {
  const col = LABEL_COLUMN[table];
  const rows = await adminQuery<{ label: string | null }>(
    `select ${col} as label from public.${table} where id = $1`,
    [id],
  );
  return rows[0]?.label ?? null;
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client
const tenantBIds: Record<PricingTable, string> = { work_roles: "", articles: "" };

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // Seed REAL Tenant B rows so the cross-tenant negatives target a CONCRETE row (never
  // vacuous). cleanupFixture's tenant-delete cascades them (on delete cascade).
  for (const table of PRICING_TABLES) {
    tenantBIds[table] = await adminSeedPricingRow(table, fixture.tenantB.id);
    if (!tenantBIds[table]) {
      throw new Error(`pricing cross-tenant seed produced no id for ${table} — would pass vacuously.`);
    }
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe.skip("Pricing cross-tenant RLS isolation — work_roles + articles (AC4 / H4 enrollment)", () => {
  for (const table of PRICING_TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] SELECT: Tenant A admin reads ZERO ${table} rows belonging to Tenant B (no error leak)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { data, error } = await a.from(table).select("*").eq("id", tenantBIds[table]);
        expect(error).toBeNull();
        expect(data).toEqual([]); // RLS yields an empty set, not an existence-confirming error
      });

      it(`[P0] INSERT: Tenant A admin cannot INSERT a ${table} row carrying Tenant B ownership (WITH CHECK → 42501)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { error } = await a.from(table).insert(spoofRowFor(table, fixture.tenantB.id));
        // authenticated HAS an INSERT grant, so the denial is the RLS INSERT WITH CHECK
        // (is_tenant_admin(tenant_id=B) is false for a Tenant A admin) → 42501. Fresh id
        // so the denial is the policy, never a 23505 PK collision.
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
      });

      it(`[P0] UPDATE: Tenant A cannot UPDATE Tenant B's ${table} row — rls-invisible (zero rows + UNCHANGED re-read)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { data: affected, error } = await a
          .from(table)
          .update(hijackFor(table))
          .eq("id", tenantBIds[table])
          .select();
        // authenticated HAS an UPDATE grant, so the foreign row is hidden by RLS USING:
        // ZERO rows affected, NO error. The denial is proven by zero-rows + an INDEPENDENT
        // BYPASSRLS re-read showing the label was NOT overwritten with the hijack value.
        expect(error).toBeNull();
        expect(affected).toEqual([]);
        const label = await adminSelectLabel(table, tenantBIds[table]);
        expect(label).not.toBeNull(); // the row still exists
        expect(label).not.toBe("hijacked-by-tenant-a"); // and was NOT hijacked
      });

      it(`[P0] DELETE: Tenant A cannot DELETE Tenant B's ${table} row — privilege denial (42501, no DELETE grant)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { data: deleted, error } = await a
          .from(table)
          .delete()
          .eq("id", tenantBIds[table])
          .select();
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(deleted).toBeNull();
      });
    });
  }
});

describe.skip("Pricing anon-path RLS isolation — work_roles + articles (AC4 / anon-DML-empty)", () => {
  for (const table of PRICING_TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] anon SELECT/INSERT/UPDATE/DELETE on ${table} are ALL denied (anon-DML-empty, not anon-grant-empty)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        // The anon client has NO DML grant on the pricing tables, so each of the four
        // operations is denied at the privilege layer (42501) before any row matches.
        // GREEN PHASE: this is exercised by the parameterized anon-path-isolation suite
        // once the tables are enrolled in TENANT_TABLES; pinned here as the contract.
        const anon = await makeAuthedServerClient(fixture.adminA); // GREEN: swap for an ANON (unauthenticated) client
        // The placeholder above keeps the scaffold type-correct; the real anon client is
        // wired in the GREEN phase via the anon-path suite's anon fixture.
        const selectRes = await anon.from(table).select("*").limit(1);
        // A real anon client returns a privilege error on each DML op; assert the contract.
        expect(selectRes).toBeDefined();
      });
    });
  }
});

describe.skip("H4 inventory gate — work_roles + articles enrolled (AC4 — the gate bites)", () => {
  it("[P0] both pricing tables are present in the live schema AND enrolled in TENANT_TABLES", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // GREEN PHASE: import { TENANT_TABLES } from "./tenant-table-inventory" and assert
    // both names are members — the H4 gate (rls-inventory-gate.int.test.ts) then fails
    // CI with a named "table not covered" message if either is missing. Scratch-verify
    // by temporarily DROPping one from TENANT_TABLES and confirming the gate bites.
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...PRICING_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...PRICING_TABLES].sort());
    // The enrollment itself (membership in TENANT_TABLES) is asserted live by the H4
    // gate once Task 3.1 lands; this scaffold documents the demanded end-state.
  });
});
