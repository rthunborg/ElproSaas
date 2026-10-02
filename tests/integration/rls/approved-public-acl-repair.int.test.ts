/**
 * ADR-B012 — owner-approved inherited PUBLIC ACL repair.
 *
 * The data-driven anon and cross-tenant suites exercise every affected app path.
 * This regression checks effective PostgreSQL privileges so a future PUBLIC grant
 * cannot hide behind role-specific ACL inspection, and proves the retained
 * authenticated/service_role grants are direct rather than PUBLIC inheritance.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const APPROVED_TABLES = [
  "tenants",
  "tenant_memberships",
  "company_settings",
  "quote_terms",
  "work_roles",
  "articles",
  "calculations",
  "calculation_sections",
  "calculation_rows",
  "tenant_counters",
  "quotes",
  "quote_versions",
  "quote_version_lines",
  "quote_version_attachments",
  "quote_events",
  "quote_acceptances",
  "quote_lost_reasons",
  "jobs",
  "job_events",
  "files",
  "file_links",
  "membership_admin_operations",
] as const;

const TABLE_PRIVILEGES = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;

const APPROVED_HELPERS = [
  "is_active_tenant_member(uuid)",
  "is_tenant_admin(uuid)",
] as const;

let stackUp = false;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

describe("ADR-B012 approved PUBLIC/anon revokes retain only intended role paths", () => {
  it("[P0] denies every effective table privilege to anon for all 22 observed tables", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const rows = await adminQuery<{
      table_name: string;
      privilege: string;
      allowed: boolean;
    }>(`
      with approved_tables(table_name) as (
        values ${APPROVED_TABLES.map((table) => `('${table}')`).join(",\n        ")}
      ), privileges(privilege) as (
        values ${TABLE_PRIVILEGES.map((privilege) => `('${privilege}')`).join(", ")}
      )
      select
        approved_tables.table_name,
        privileges.privilege,
        has_table_privilege(
          'anon',
          format('public.%I', approved_tables.table_name),
          privileges.privilege
        ) as allowed
      from approved_tables
      cross join privileges
      order by approved_tables.table_name, privileges.privilege
    `);

    expect(rows).toHaveLength(APPROVED_TABLES.length * TABLE_PRIVILEGES.length);
    expect(rows.every((row) => row.allowed === false)).toBe(true);
  });

  it("[P0] retains direct authenticated and service_role table ACLs independently of PUBLIC", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const tableNames = APPROVED_TABLES.map((table) => `'${table}'`).join(", ");
    const rows = await adminQuery<{
      table_name: string;
      role_name: string;
      has_direct_acl: boolean;
    }>(`
      select
        relation.relname as table_name,
        role_name.rolname as role_name,
        exists (
          select 1
          from aclexplode(relation.relacl) as privilege
          where privilege.grantee = role_name.oid
        ) as has_direct_acl
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      cross join pg_catalog.pg_roles role_name
      where namespace.nspname = 'public'
        and relation.relname in (${tableNames})
        and role_name.rolname in ('authenticated', 'service_role')
      order by relation.relname, role_name.rolname
    `);

    expect(rows).toHaveLength(APPROVED_TABLES.length * 2);
    expect(rows.every((row) => row.has_direct_acl)).toBe(true);
  });

  it("[P0] denies anon helper execution while retaining direct authenticated and service_role grants", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const helperNames = APPROVED_HELPERS.map((helper) => `'${helper}'`).join(", ");
    const rows = await adminQuery<{
      helper_name: string;
      anon_execute: boolean;
      authenticated_direct_execute: boolean;
      service_role_direct_execute: boolean;
    }>(`
      select
        routine.helper_name,
        has_function_privilege('anon', format('public.%s', routine.helper_name), 'EXECUTE') as anon_execute,
        exists (
          select 1 from aclexplode(procedure.proacl) as privilege
          where privilege.grantee = authenticated_role.oid
            and privilege.privilege_type = 'EXECUTE'
        ) as authenticated_direct_execute,
        exists (
          select 1 from aclexplode(procedure.proacl) as privilege
          where privilege.grantee = service_role.oid
            and privilege.privilege_type = 'EXECUTE'
        ) as service_role_direct_execute
      from unnest(array[${helperNames}]::text[]) as routine(helper_name)
      join pg_catalog.pg_proc procedure on procedure.oid = to_regprocedure(format('public.%s', routine.helper_name))
      cross join (select oid from pg_catalog.pg_roles where rolname = 'authenticated') as authenticated_role
      cross join (select oid from pg_catalog.pg_roles where rolname = 'service_role') as service_role
      order by routine.helper_name
    `);

    expect(rows).toHaveLength(APPROVED_HELPERS.length);
    expect(rows).toEqual([
      {
        helper_name: "is_active_tenant_member(uuid)",
        anon_execute: false,
        authenticated_direct_execute: true,
        service_role_direct_execute: true,
      },
      {
        helper_name: "is_tenant_admin(uuid)",
        anon_execute: false,
        authenticated_direct_execute: true,
        service_role_direct_execute: true,
      },
    ]);
  });
});