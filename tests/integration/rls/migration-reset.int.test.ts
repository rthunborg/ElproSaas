/**
 * Story 2.2 — migration-reset green + required-objects-present (AC1 / R-007).
 *
 * Asserts that after `supabase db reset` (empty → migrate → seed) the
 * tenant_foundation objects exist with the expected constraints, RLS flags, and
 * search_path hardening. Runs against the LOCAL Supabase stack only; skips
 * cleanly when the stack is unreachable (CI sets SUPABASE_TEST_REQUIRED=1 to make
 * a missing stack a hard failure).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { assertSearchPathExactlyEmpty } from "../../support/search-path";

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

describe("Migration reset green — tenant_foundation objects present (AC1 / R-007)", () => {
  it("[P0] tables `tenants` and `tenant_memberships` exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public'
           and table_name in ('tenants', 'tenant_memberships')`,
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      "tenant_memberships",
      "tenants",
    ]);
  });

  it("[P0] helper functions `is_active_tenant_member(uuid)` and `is_tenant_admin(uuid)` exist", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ proname: string }>(
      `select proname from pg_proc
         where proname in ('is_active_tenant_member', 'is_tenant_admin')`,
    );
    expect(rows.map((r) => r.proname).sort()).toEqual([
      "is_active_tenant_member",
      "is_tenant_admin",
    ]);
  });

  it("[P0] both helpers are SECURITY DEFINER with an EXACTLY-EMPTY search_path (AC4 hardening)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select proname, prosecdef, proconfig from pg_proc
         where proname in ('is_active_tenant_member', 'is_tenant_admin')`,
    );
    expect(rows).toHaveLength(2);
    for (const fn of rows) {
      expect(fn.prosecdef).toBe(true); // SECURITY DEFINER
      // Parse the ACTUAL `search_path` proconfig entry and assert it is EXACTLY empty
      // (`search_path=` / `search_path=""`). A non-empty path (e.g. `pg_catalog`) MUST
      // FAIL — the prior loose `/search_path=("")?$/` would have admitted it. The R-006
      // behavioral hijack negative is the runtime proof; this is assertion-strength.
      // [G-8a, epic-2 hardening; supersedes the 2-2 over-fit deferral]
      assertSearchPathExactlyEmpty(fn.proname, fn.proconfig);
    }
  });

  it("[P0] `tenant_memberships.role` CHECK = 'tenant_admin' and `status` CHECK in (active,invited,disabled)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.tenant_memberships'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    expect(defs).toMatch(/role\s*=\s*'tenant_admin'/i);
    expect(defs).toMatch(/status[\s\S]*'active'[\s\S]*'invited'[\s\S]*'disabled'/i);
  });

  it("[P0] RLS is ENABLED and FORCED on both public tables", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Schema-qualify: an internal `_realtime.tenants` exists too — match only public.
    const rows = await adminQuery<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('tenants', 'tenant_memberships')
          and c.relkind = 'r'`,
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0] `tenants.name` is NOT NULL (deferred-work reconciliation)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ is_nullable: string }>(
      `select is_nullable from information_schema.columns
         where table_schema = 'public' and table_name = 'tenants'
           and column_name = 'name'`,
    );
    expect(rows[0]?.is_nullable).toBe("NO");
  });

  it("[P0] only SELECT policies exist (no write policy on the app path)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string }>(
      `select tablename, cmd from pg_policies where schemaname = 'public'`,
    );
    // Every public policy is SELECT — confirming INSERT/UPDATE/DELETE are
    // deny-by-default for the authenticated app path (AC3 foundation). Story 2.3
    // adds a third SELECT-only policy (`audit_events_select_own`) alongside the two
    // tenant_foundation ones (`tenants_select_own`, `tenant_memberships_select_own`);
    // no write policy is introduced on the app path.
    expect(rows.map((r) => `${r.tablename}.${r.cmd}`).sort()).toEqual([
      "audit_events.SELECT",
      "tenant_memberships.SELECT",
      "tenants.SELECT",
    ]);
    for (const r of rows) {
      expect(r.cmd).toBe("SELECT");
    }
  });
});

// Close this file's admin pool once all migration-reset assertions are done.
afterAll(async () => {
  await closeAdminPool();
});
