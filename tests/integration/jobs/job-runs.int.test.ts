import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { TENANT_TABLES } from "../rls/tenant-table-inventory";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

describe("13.1 job_runs migration and system-audit contract", () => {
  test("[P0] fresh schema has forced RLS, narrow grants, named checks, indexes, and H4 enrollment", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await adminQuery<{ force_rls: boolean; has_policy: boolean; has_index: boolean; has_authenticated_select: boolean; insert_grantees: string[] | "{}"; check_constraints: string[] | "{}" }>(`
      select c.relforcerowsecurity as force_rls,
        exists(select 1 from pg_policies where schemaname='public' and tablename='job_runs' and policyname='job_runs_select_tenant_admin') as has_policy,
        exists(select 1 from pg_indexes where schemaname='public' and tablename='job_runs' and indexname='job_runs_tenant_producer_started_idx') as has_index,
        exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name='job_runs' and grantee='authenticated' and privilege_type='SELECT') as has_authenticated_select,
        coalesce(array_agg(distinct privilege_type) filter (where grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE')), array[]::text[]) as insert_grantees,
        coalesce((select array_agg(con.conname::text order by con.conname) from pg_constraint con where con.conrelid=c.oid and con.contype='c'), array[]::text[]) as check_constraints
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      left join information_schema.role_table_grants g on g.table_schema='public' and g.table_name='job_runs'
      where n.nspname='public' and c.relname='job_runs' group by c.oid, c.relforcerowsecurity`);
    expect(rows[0]?.force_rls).toBe(true);
    expect(rows[0]?.has_policy).toBe(true);
    expect(rows[0]?.has_index).toBe(true);
    expect(rows[0]?.has_authenticated_select).toBe(true);
    const mutationGrants = rows[0]?.insert_grantees;
    expect(mutationGrants === "{}" ? [] : mutationGrants).toEqual([]);
    const checkConstraints = rows[0]?.check_constraints;
    const constraintNames = Array.isArray(checkConstraints) ? checkConstraints : [];
    expect(constraintNames).toEqual([
      "job_runs_check",
      "job_runs_cursor_check",
      "job_runs_cursor_outcome_check",
      "job_runs_error_summary_check",
      "job_runs_finished_after_started_check",
      "job_runs_outcome_check",
      "job_runs_producer_check",
    ]);
    expect(TENANT_TABLES).toContain("job_runs");
  });
});
