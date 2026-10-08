import { expect } from "vitest";
import { adminQuery } from "../factories/admin-sql";

export type DmlPrivilege = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
const DML: readonly DmlPrivilege[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];
const ROLES = ["anon", "authenticated", "service_role"] as const;

/** Expected privileges are authored from migration/caller contracts by each test.
 * Effective checks include PUBLIC inheritance; no observed ACL chooses an oracle.
 */
export async function expectEffectiveTableDml(expectedAuthenticated: Readonly<Record<string, readonly DmlPrivilege[]>>): Promise<void> {
  const tables = Object.keys(expectedAuthenticated);
  const rows = await adminQuery<{ table_name: string; role_name: string; privilege: DmlPrivilege; allowed: boolean }>(`
    select table_name, role_name, privilege,
      has_table_privilege(role_name, format('public.%I', table_name), privilege) as allowed
    from unnest($1::text[]) as tables(table_name)
    cross join unnest($2::text[]) as roles(role_name)
    cross join unnest($3::text[]) as privileges(privilege)
    order by table_name, role_name, privilege
  `, [tables, ROLES, DML]);
  const expected = tables.sort().flatMap((table_name) => ROLES.flatMap((role_name) => [...DML].sort().map((privilege) => ({
    table_name, role_name, privilege,
    allowed: role_name === "service_role" || (role_name === "authenticated" && expectedAuthenticated[table_name]!.includes(privilege)),
  }))));
  expect(rows).toEqual(expected);
}
