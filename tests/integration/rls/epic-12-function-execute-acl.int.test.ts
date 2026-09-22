import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { adminQuery, adminSession } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const privilegeQuery = `
  select function_name, role_name,
         has_function_privilege(role_name, function_name, 'EXECUTE') as can_execute
    from unnest(array[
      'public.is_platform_operator()',
      'public.audit_onboarding_checklist_dismissal()'
    ]) as functions(function_name)
   cross join unnest(array[
     'public', 'anon', 'authenticated', 'service_role', 'provisioning_function_owner'
   ]) as roles(role_name)
   order by function_name, role_name`;

type PrivilegeRow = {
  function_name: string;
  role_name: string;
  can_execute: boolean;
};

function expectIntendedPrivileges(rows: PrivilegeRow[]) {
  expect(rows).toHaveLength(10);
  for (const row of rows) {
    const allowed = row.function_name === "public.is_platform_operator()"
      && ["authenticated", "service_role", "provisioning_function_owner"].includes(row.role_name);
    expect(row.can_execute, `${row.role_name}: ${row.function_name}`).toBe(allowed);
  }
}

describe("Epic 12 effective function execution privileges", () => {
  test("anonymous execution is denied while operator and internal caller access is preserved", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    expectIntendedPrivileges(await adminQuery<PrivilegeRow>(privilegeQuery));
  });

  test("the additive migration repairs independent hosted role grants", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const migration = readFileSync(
      "supabase/migrations/20260922121240_epic_12_function_execute_acl.sql",
      "utf8",
    );
    await adminSession(async ({ query }) => {
      await query("begin");
      try {
        // Reproduce the hosted default ACLs without changing cluster defaults
        // or committing a permission change visible to other test workers.
        await query(`grant execute on function public.is_platform_operator(),
          public.audit_onboarding_checklist_dismissal()
          to anon, authenticated, service_role`);
        const before = await query<PrivilegeRow>(privilegeQuery);
        expect(before.filter((row) => row.role_name === "anon")
          .every((row) => row.can_execute)).toBe(true);
        await query(migration);
        expectIntendedPrivileges(await query<PrivilegeRow>(privilegeQuery));
      } finally {
        await query("rollback");
      }
    });
  });
});
