/** Story 11.1 follow-up — grants must not depend on hosted default ACLs. */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminQuery, adminSession, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const migration = readFileSync(new URL(
  "../../../supabase/migrations/20260907161230_role_storage_explicit_grants.sql",
  import.meta.url,
), "utf8");

// aclexplode also catches less common privileges (TRIGGER, TRUNCATE, REFERENCES,
// and MAINTAIN on newer Postgres) without assuming a particular server version.
const aclQuery = `
  with objects as (
    select 'table' as object, relacl as acl
      from pg_class where oid = 'public.membership_roles'::regclass
    union all
    select 'function', proacl
      from pg_proc where oid = 'public.has_tenant_role(uuid,text[])'::regprocedure
  ), roles as (
    select 0::oid as oid, 'PUBLIC' as name
    union all
    select oid, rolname from pg_roles
      where rolname in ('anon', 'authenticated', 'service_role')
  )
  select o.object, r.name as role,
         coalesce(array_agg(a.privilege_type order by a.privilege_type)
           filter (where a.privilege_type is not null), '{}'::text[]) as privileges,
         coalesce(bool_or(a.is_grantable), false) as grantable
    from objects o cross join roles r
    left join lateral aclexplode(o.acl) a on a.grantee = r.oid
   group by o.object, r.name order by o.object, r.name`;

const expectedAcl = [
  { object: "function", role: "PUBLIC", privileges: [], grantable: false },
  { object: "function", role: "anon", privileges: [], grantable: false },
  { object: "function", role: "authenticated", privileges: ["EXECUTE"], grantable: false },
  { object: "function", role: "service_role", privileges: ["EXECUTE"], grantable: false },
  { object: "table", role: "PUBLIC", privileges: [], grantable: false },
  { object: "table", role: "anon", privileges: [], grantable: false },
  { object: "table", role: "authenticated", privileges: ["SELECT"], grantable: false },
  { object: "table", role: "service_role", privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"], grantable: false },
];

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

describe("11.1 explicit role-storage grants", () => {
  it("[P0] reset leaves exactly the intended API grants", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    expect(await adminQuery(aclQuery)).toEqual(expectedAcl);
  });

  it("[P0] repairs explicit hosted grants idempotently and denies unauthorized calls", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await adminSession(async (session) => {
      await session.query("begin");
      try {
        await session.query("set local lock_timeout = '5s'");
        // Recreate the resulting hosted ACLs, not the cluster-wide defaults.
        // Every change remains invisible to other workers and is rolled back.
        await session.query(`grant all privileges on public.membership_roles
          to public, anon, authenticated, service_role`);
        await session.query(`grant execute on function public.has_tenant_role(uuid,text[])
          to public, anon, authenticated, service_role`);
        expect(await session.query(`select
          has_table_privilege('authenticated', 'public.membership_roles', 'INSERT') as can_write,
          has_function_privilege('anon', 'public.has_tenant_role(uuid,text[])', 'EXECUTE') as can_execute`))
          .toEqual([{ can_write: true, can_execute: true }]);

        await session.query(migration);
        expect(await session.query(aclQuery)).toEqual(expectedAcl);
        await session.query(migration);
        expect(await session.query(aclQuery)).toEqual(expectedAcl);

        await session.query("savepoint denied_call");
        await session.query("set local role anon");
        await expect(session.query(
          "select public.has_tenant_role('00000000-0000-0000-0000-000000000000', array['admin'])",
        )).rejects.toMatchObject({ code: "42501" });
        await session.query("rollback to savepoint denied_call");

        await session.query("set local role authenticated");
        // A zero-row insert cannot change fixture data even if the grant regresses.
        await expect(session.query(`insert into public.membership_roles (tenant_id, membership_id, role)
          select null::uuid, null::uuid, 'admin' where false`))
          .rejects.toMatchObject({ code: "42501" });
        await session.query("rollback to savepoint denied_call");
      } finally {
        await session.query("rollback");
      }
    });
    expect(await adminQuery(aclQuery)).toEqual(expectedAcl);
  });
});
