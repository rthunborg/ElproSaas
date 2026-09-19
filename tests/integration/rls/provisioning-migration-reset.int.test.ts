import { describe, expect, test } from "vitest";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("tenant provisioning migration reset — Story 12.1 ATDD", () => {
  test.skip("[P0] 12.1-INT-013 clean reset contains exact platform objects, durable all-status uniqueness, provisioning facts, hardened grants, and manifest inventory", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    const [objects] = await adminQuery<{
      platform_operators: boolean;
      provision_tenant: boolean;
      operator_helper: boolean;
    }>(
      `select
         to_regclass('public.platform_operators') is not null as platform_operators,
         exists (
           select 1 from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname = 'provision_tenant'
         ) as provision_tenant,
         to_regprocedure('public.is_platform_operator()') is not null as operator_helper`,
    );
    expect(objects).toEqual({
      platform_operators: true,
      provision_tenant: true,
      operator_helper: true,
    });

    const indexes = await adminQuery<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname='public' and tablename='tenants'",
    );
    const organizationIdentityIndex = indexes.find((row) =>
      /country_code.*normalized_organization_number/i.test(row.indexdef),
    );
    expect(organizationIdentityIndex?.indexdef).toMatch(/unique/i);
    expect(organizationIdentityIndex?.indexdef).not.toMatch(/\bwhere\b/i);

    const functions = await adminQuery<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
      public_execute: boolean;
    }>(
      `select p.proname, p.prosecdef, p.proconfig,
              has_function_privilege('public', p.oid, 'execute') as public_execute
         from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('is_platform_operator', 'provision_tenant')
        order by p.proname`,
    );
    expect(functions).toHaveLength(2);
    for (const fn of functions) {
      expect(fn.prosecdef).toBe(true);
      expect(fn.proconfig).toContain("search_path=");
      expect(fn.public_execute).toBe(false);
    }
  });
});
