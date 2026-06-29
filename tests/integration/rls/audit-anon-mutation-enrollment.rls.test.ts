/**
 * GAP G-5 (P2) — `audit_events` anon UPDATE/DELETE data-driven enrollment
 * COMPLETENESS over the shared inventory.
 *
 * The consolidated foundation test design (`test-design-epic-2-foundation-
 * consolidated.md`, Gap G-5) asks: confirm all FOUR anonymous verbs
 * (SELECT/INSERT/UPDATE/DELETE) are data-driven over the shared `TENANT_TABLES`
 * inventory for `audit_events` too — not only SELECT/INSERT/EXECUTE. The functional
 * anon denial is already proven by `anon-path-isolation.rls.test.ts` (which iterates
 * `TENANT_TABLES` × 4 verbs). This file adds the standing ENUMERATION-COMPLETENESS
 * guard the gap names: it bites if a future refactor silently drops `audit_events`
 * from the inventory or leaves its anon UPDATE/DELETE metadata unwired, which would
 * make the anon mutation negatives skip `audit_events` unnoticed.
 *
 * Two layers:
 *   1. a PURE structural guard — `audit_events` is enrolled in `TENANT_TABLES` and its
 *      anon UPDATE/DELETE metadata helpers (`anonFilterFor`/`anonMutationFor`) resolve
 *      for it (no `assertNever`/throw), proving the data-driven anon UPDATE/DELETE seam
 *      reaches `audit_events`;
 *   2. a LIVE re-assertion that anon UPDATE and DELETE on `audit_events` are denied by
 *      the privilege MECHANISM (42501), driven through the SAME shared-inventory
 *      helpers the data-driven suite uses (so this guard and that suite share one
 *      enrollment source of truth).
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 *
 * COVERAGE: test-design-epic-2-foundation-consolidated.md Gap G-5; AC5; R-009.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAnonServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import {
  TENANT_TABLES,
  anonFilterFor,
  anonMutationFor,
  type InventoryContext,
} from "./tenant-table-inventory";

const AUDIT_TABLE = "audit_events";
const ANON_MUTATION_VERBS = ["UPDATE", "DELETE"] as const;

let stackUp = false;
let fixture: TwoTenantFixture;
let anon: TestServerClient;
let ctx: InventoryContext;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  anon = await makeAnonServerClient();
  ctx = { fixture, tenantBAuditId: crypto.randomUUID() };
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("audit_events anon UPDATE/DELETE enrollment completeness (Gap G-5)", () => {
  it("[P2] structural: audit_events is enrolled in the shared TENANT_TABLES inventory", () => {
    // The single source of truth must include audit_events; if a future edit drops it,
    // the data-driven anon (and cross-tenant) suites would silently stop covering it.
    expect((TENANT_TABLES as readonly string[]).includes(AUDIT_TABLE)).toBe(true);
  });

  it("[P2] structural: the anon UPDATE/DELETE metadata helpers resolve for audit_events (data-driven seam reaches it)", () => {
    // anonFilterFor/anonMutationFor route through a `switch (table) { … default:
    // assertNever }` — so if audit_events were ever removed from the metadata, these
    // would throw. Resolving cleanly proves the anon UPDATE/DELETE enumeration includes
    // audit_events, not just SELECT/INSERT/EXECUTE.
    const filter = anonFilterFor(AUDIT_TABLE, ctx);
    expect(typeof filter.column).toBe("string");
    expect(typeof filter.value).toBe("string");
    const mutation = anonMutationFor(AUDIT_TABLE);
    expect(mutation).toBeTypeOf("object");
    expect(Object.keys(mutation).length).toBeGreaterThan(0);
  });

  for (const verb of ANON_MUTATION_VERBS) {
    it(`[P2] live: an anonymous caller is denied ${verb} on audit_events via the privilege layer (42501), driven by the shared inventory helpers`, async () => {
      if (!stackUp) return;
      const { column, value } = anonFilterFor(AUDIT_TABLE, ctx);
      const builder = anon.from(AUDIT_TABLE);
      const { data, error } =
        verb === "UPDATE"
          ? await builder
              .update(anonMutationFor(AUDIT_TABLE))
              .eq(column, value)
              .select()
          : await builder.delete().eq(column, value).select();

      // anon has NO grant on audit_events → denied at the privilege layer (42501),
      // before RLS/any row match. Assert the MECHANISM, never a vacuous empty set.
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(data).toBeNull();
    });
  }
});
