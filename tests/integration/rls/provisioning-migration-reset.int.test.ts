import { describe, expect, test } from "vitest";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("tenant provisioning migration reset — Story 12.1 ATDD", () => {
  test("[P0] 12.1-INT-013 clean reset contains exact platform objects, durable all-status uniqueness, provisioning facts, hardened grants, and manifest inventory", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    const [objects] = await adminQuery<{
      platform_operators: boolean;
      provision_tenant: boolean;
      operator_helper: boolean;
      request_payload: boolean;
      company_projection_trigger: boolean;
    }>(
      `select
         to_regclass('public.platform_operators') is not null as platform_operators,
         exists (
           select 1 from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname = 'provision_tenant'
         ) as provision_tenant,
         to_regprocedure('public.is_platform_operator()') is not null as operator_helper,
         exists (
           select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'tenant_provisioning_requests'
              and column_name = 'request_payload'
              and udt_name = 'jsonb'
         ) as request_payload,
         exists (
           select 1 from pg_trigger t
            where t.tgrelid = 'public.tenant_provisioning_requests'::regclass
              and t.tgname = 'tenant_provisioning_requests_apply_company_settings'
              and not t.tgisinternal
         ) as company_projection_trigger`,
    );
    expect(objects).toEqual({
      platform_operators: true,
      provision_tenant: true,
      operator_helper: true,
      request_payload: true,
      company_projection_trigger: true,
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
      expect(fn.proconfig?.some((setting) => setting.startsWith("search_path="))).toBe(true);
      expect(fn.public_execute).toBe(false);
    }
  });
});
