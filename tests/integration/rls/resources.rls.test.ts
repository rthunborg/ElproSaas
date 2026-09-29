/** Story 14.1 ATDD red-phase RLS and H4 scaffold. */
import { expect, test } from "vitest";
import { TENANT_TABLES } from "./tenant-table-inventory";

const RESOURCE_TABLES = ["person_profiles", "person_work_hours", "tenant_calendar_days"] as const;
const migrationSuitePath = "./resource-tables-migration-reset.int";
const roleNegativesPath = "./resource-role-negatives.int";

test.skip("[P0] enrolls every resource table in H4's parameterized cross-tenant and anonymous negative suites", () => {
  for (const table of RESOURCE_TABLES) {
    expect(TENANT_TABLES as readonly string[]).toContain(table);
  }
});

test.skip("[P0] FORCE RLS and exact-policy enumeration block direct cross-tenant and anonymous resource reads and mutations", async () => {
  const migrationSuite = await import(migrationSuitePath) as {
    assertResourceTablePolicies?: (tableNames: readonly string[]) => Promise<void>;
  };
  await migrationSuite.assertResourceTablePolicies?.(RESOURCE_TABLES);
  expect(migrationSuite.assertResourceTablePolicies).toBeDefined();
});

test.skip("[P0] invited, disabled, and role-ineligible callers receive neither resource rows nor command mutation", async () => {
  const roleSuite = await import(roleNegativesPath) as {
    assertResourceRoleNegatives?: (tableNames: readonly string[]) => Promise<void>;
  };
  await roleSuite.assertResourceRoleNegatives?.(RESOURCE_TABLES);
  expect(roleSuite.assertResourceRoleNegatives).toBeDefined();
});
