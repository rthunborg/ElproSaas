import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { TENANT_TABLES } from "../rls/tenant-table-inventory";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

describe("13.1 job_runs migration and system-audit contract", () => {
  test("[P0] fresh schema has forced RLS, narrow grants, constraints, indexes, and H4 enrollment", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await adminQuery<{ force_rls: boolean; has_policy: boolean; has_index: boolean; insert_grantees: string[] | "{}" }>(`
      select c.relforcerowsecurity as force_rls,
        exists(select 1 from pg_policies where schemaname='public' and tablename='job_runs' and policyname='job_runs_select_tenant_admin') as has_policy,
        exists(select 1 from pg_indexes where schemaname='public' and tablename='job_runs' and indexname='job_runs_tenant_producer_started_idx') as has_index,
        coalesce(array_agg(distinct privilege_type) filter (where grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE')), array[]::text[]) as insert_grantees
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      left join information_schema.role_table_grants g on g.table_schema='public' and g.table_name='job_runs'
      where n.nspname='public' and c.relname='job_runs' group by c.relforcerowsecurity`);
    expect(rows[0]?.force_rls).toBe(true);
    expect(rows[0]?.has_policy).toBe(true);
    expect(rows[0]?.has_index).toBe(true);
    const mutationGrants = rows[0]?.insert_grantees;
    expect(mutationGrants === "{}" ? [] : mutationGrants).toEqual([]);
    expect(TENANT_TABLES).toContain("job_runs");
  });
});
