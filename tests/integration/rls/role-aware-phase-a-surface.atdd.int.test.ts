/** Story 11.2 ATDD: real matrix, policy-catalog, RLS, command, and projection evidence. */
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TENANT_ROLES, type TenantRole } from "@/server/authz/roles";
import { resolveCapability } from "@/server/authz/permission-matrix";
import { resolvePhaseANavigation } from "@/server/authz/phase-a-surface";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { resolveTenantContextCore } from "@/server/auth/resolve-tenant-context-core";
import { runCommand } from "@/server/commands/envelope";
import { archiveCustomer } from "@/server/commands/crm/customers";
import { readQuotePipeline } from "@/server/read-models/quote-pipeline";
import { resolvePipelinePeriod } from "@/server/read-models/quote-pipeline-aggregate";
import {
  adminInsertCalculation,
  adminInsertCompanySettings,
  adminInsertCustomer,
  adminInsertFile,
  adminInsertJob,
  adminInsertQuote,
  adminInsertQuoteAcceptance,
  adminInsertQuoteEvent,
  adminInsertQuoteVersion,
  cleanupRoleAwarePhaseAFixture,
  createRoleAwarePhaseAFixture,
  makeAuthedServerClient,
  type RoleAwarePhaseAFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

type ModuleId = "foundation" | "dashboard" | "crm" | "settings" | "calculations" | "quotes" | "jobs" | "files";
type Target = {
  readonly module: ModuleId;
  readonly route: string | null;
  readonly table: string | null;
  readonly policy: string | null;
  readonly readCapability?: readonly [string, string];
  readonly writeCapability?: readonly [string, string];
};

const TARGETS: readonly Target[] = [
  { module: "foundation", route: null, table: "tenant_memberships", policy: "tenant_memberships_select_own" },
  { module: "dashboard", route: "/dashboard", table: null, policy: null, readCapability: ["dashboard", "Dashboard.View"] },
  { module: "crm", route: "/customers", table: "customers", policy: "customers_select_own", readCapability: ["crm", "Customers.View"], writeCapability: ["crm", "Customers.Edit"] },
  { module: "settings", route: "/settings", table: "company_settings", policy: "company_settings_select_own", readCapability: ["settings", "CompanySettings.View"], writeCapability: ["settings", "CompanySettings.Edit"] },
  { module: "calculations", route: "/calculations", table: "calculations", policy: "calculations_select_own", readCapability: ["calculations", "Calculations.View"], writeCapability: ["calculations", "Calculations.Edit"] },
  { module: "quotes", route: "/quotes", table: "quotes", policy: "quotes_select_own", readCapability: ["quotes", "Quotes.View"], writeCapability: ["quotes", "Quotes.Edit"] },
  { module: "jobs", route: "/jobs", table: "jobs", policy: "jobs_select_own", readCapability: ["jobs", "Jobs.ViewAll"], writeCapability: ["jobs", "Jobs.Edit"] },
  { module: "files", route: "/files", table: "files", policy: "files_select_own", readCapability: ["files", "Files.View"], writeCapability: ["files", "Files.Edit"] },
];

const PIPELINE_INSTANT = "2026-07-15T12:00:00.000Z";
const PIPELINE_WINDOW = resolvePipelinePeriod(PIPELINE_INSTANT);

let stackUp = false;
let fixture: RoleAwarePhaseAFixture;
let clients: Record<TenantRole, TestServerClient>;
let unionClient: TestServerClient;
let invitedClient: TestServerClient;
let disabledClient: TestServerClient;
let tenantBAdmin: TestServerClient;
let targetIds: Record<Exclude<ModuleId, "dashboard" | "foundation">, string>;

function granted(role: TenantRole, capability: Target["readCapability"] | Target["writeCapability"]): boolean {
  if (!capability) return false;
  return resolveCapability({ roles: [role], module: capability[0], capability: capability[1] }).granted;
}

function canRead(role: TenantRole, target: Target): boolean {
  return target.module === "foundation" || granted(role, target.readCapability);
}

function canWrite(role: TenantRole, target: Target): boolean {
  return granted(role, target.writeCapability);
}

async function selectTarget(client: TestServerClient, table: string, id: string) {
  return (client.from(table) as unknown as {
    select: (columns: string) => { eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { code?: string } | null }> };
  }).select("id").eq("id", id);
}

async function selectOwnMembership(client: TestServerClient, userId: string) {
  return (client.from("tenant_memberships") as unknown as {
    select: (columns: string) => { eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { code?: string } | null }> };
  }).select("id").eq("user_id", userId);
}

async function updateTarget(client: TestServerClient, table: string, id: string, tenantId: string) {
  return (client.from(table) as unknown as {
    update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { select: (columns: string) => Promise<{ data: unknown[] | null; error: { code?: string } | null }> } };
  }).update({ tenant_id: tenantId }).eq("id", id).select("id");
}

async function auditCount(): Promise<number> {
  // Full integration runs independent fixtures in parallel. This assertion is about
  // the role-aware fixture only, so unrelated tenants must not affect it.
  const rows = await adminQuery<{ count: string }>(
    "select count(*)::text as count from public.audit_events where tenant_id = $1",
    [fixture.base.tenantA.id],
  );
  return Number(rows[0]?.count ?? "0");
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;

  fixture = await createRoleAwarePhaseAFixture();
  clients = Object.fromEntries(
    await Promise.all(TENANT_ROLES.map(async (role) => [role, await makeAuthedServerClient(fixture.users[role])] as const)),
  ) as Record<TenantRole, TestServerClient>;
  [unionClient, invitedClient, disabledClient, tenantBAdmin] = await Promise.all([
    makeAuthedServerClient(fixture.roleUnionUser),
    makeAuthedServerClient(fixture.invitedUser),
    makeAuthedServerClient(fixture.disabledUser),
    makeAuthedServerClient(fixture.base.adminB),
  ]);

  const customerId = await adminInsertCustomer({ tenant_id: fixture.base.tenantA.id, customer_type: "company", display_name: `role-aware customer ${crypto.randomUUID()}` });
  const calculationId = await adminInsertCalculation({ tenant_id: fixture.base.tenantA.id, customer_id: customerId });
  const quoteId = await adminInsertQuote({ tenant_id: fixture.base.tenantA.id, customer_id: customerId });
  const quoteVersionId = await adminInsertQuoteVersion({ tenant_id: fixture.base.tenantA.id, quote_id: quoteId, calculation_id: calculationId, status: "accepted", accepted_price_ore: 125_000 });
  await adminInsertQuoteEvent({ tenant_id: fixture.base.tenantA.id, quote_id: quoteId, quote_version_id: quoteVersionId, event_type: "accepted", occurred_at: PIPELINE_INSTANT });
  const acceptanceId = await adminInsertQuoteAcceptance({ tenant_id: fixture.base.tenantA.id, quote_id: quoteId, quote_version_id: quoteVersionId, accepted_price_ore: 125_000, source_sent_total_ore: 125_000, accepted_at: PIPELINE_INSTANT });
  const [settingsId, jobId, fileId] = await Promise.all([
    adminInsertCompanySettings({ tenant_id: fixture.base.tenantA.id, company_name: `Role aware ${crypto.randomUUID()}` }),
    adminInsertJob({ tenant_id: fixture.base.tenantA.id, quote_acceptance_id: acceptanceId, quote_version_id: quoteVersionId, customer_id: customerId, title: "Role-aware job" }),
    adminInsertFile({ tenant_id: fixture.base.tenantA.id, display_name: "role-aware.pdf", object_path: `${fixture.base.tenantA.id}/${crypto.randomUUID()}/role-aware.pdf` }),
  ]);
  targetIds = { crm: customerId, settings: settingsId, calculations: calculationId, quotes: quoteId, jobs: jobId, files: fileId };
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupRoleAwarePhaseAFixture(fixture);
  if (stackUp) await closeAdminPool();
});

describe("Story 11.2 role-aware Phase A surface", () => {
  test("[P0] policy catalog, real role navigation, and RLS reads agree for every seeded role × active module", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const cases = TENANT_ROLES.flatMap((role) => TARGETS.map((target) => ({ role, target })));
    expect(cases).toHaveLength(TENANT_ROLES.length * TARGETS.length);
    const policies = await adminQuery<{ tablename: string; policyname: string; qual: string | null }>("select tablename, policyname, qual from pg_policies where schemaname = 'public'");
    for (const { role, target } of cases) {
      const visibleRoutes = resolvePhaseANavigation([role]).map((item) => item.href);
      if (target.route) expect(visibleRoutes.includes(target.route)).toBe(canRead(role, target));
      if (!target.table) continue;
      const read = target.module === "foundation"
        ? await selectOwnMembership(clients[role], fixture.users[role].id)
        : await selectTarget(clients[role], target.table, targetIds[target.module as Exclude<ModuleId, "dashboard" | "foundation">]);
      expect(read.error).toBeNull();
      expect((read.data ?? []).length > 0).toBe(canRead(role, target));
      const policy = policies.find((row) => row.tablename === target.table && row.policyname === target.policy);
      expect(policy, `${target.table}.${target.policy} must exist in the database catalog`).toBeDefined();
      expect(policy?.qual ?? "").toContain("has_tenant_role");
      if (target.readCapability) {
        for (const allowedRole of TENANT_ROLES.filter((candidate) => granted(candidate, target.readCapability))) {
          expect(policy?.qual ?? "").toContain(`'${allowedRole}'`);
        }
      }
    }
  });

  test("[P0] every denied catalog path has an authenticated RLS read and direct-write negative with no audit side effect", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    for (const role of TENANT_ROLES) for (const target of TARGETS.filter((item) => item.table !== null && item.module !== "foundation")) {
      const id = targetIds[target.module as Exclude<ModuleId, "dashboard" | "foundation">];
      if (!canRead(role, target)) {
        const read = await selectTarget(clients[role], target.table!, id);
        expect(read.error).toBeNull();
        expect(read.data ?? []).toEqual([]);
      }
      if (!canWrite(role, target)) {
        const writesBefore = await auditCount();
        const write = await updateTarget(clients[role], target.table!, id, fixture.base.tenantA.id);
        expect(write.data ?? []).toEqual([]);
        expect(await auditCount()).toBe(writesBefore);
      }
    }
  });

  test("[P0] an unentitled real command denies existing, missing, and cross-tenant targets before any audited mutation", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const before = await auditCount();
    for (const input of [{ id: targetIds.crm }, { id: crypto.randomUUID() }, { id: fixture.base.tenantB.id }]) {
      const result = await runCommand(archiveCustomer, { client: clients.saljare as never, input, correlationId: crypto.randomUUID() });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("PERMISSION_DENIED");
    }
    expect(await auditCount()).toBe(before);
  });

  test("[P0] legacy Admin and real child-role union resolve, while inactive, malformed, and cross-tenant contexts fail closed", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const [legacy, union, invited, disabled] = await Promise.all([
      resolveTenantContext({ client: clients.tenant_admin as never }), resolveTenantContext({ client: unionClient as never }),
      resolveTenantContext({ client: invitedClient as never }), resolveTenantContext({ client: disabledClient as never }),
    ]);
    expect(legacy.ok).toBe(true); expect(union.ok).toBe(true);
    if (union.ok) expect(union.data.roles).toEqual(expect.arrayContaining(["tenant_admin", "projektledare", "saljare"]));
    expect(invited.ok).toBe(false); expect(disabled.ok).toBe(false);
    for (const role of ["", "unknown", null, { role: "saljare" }] as const) {
      const invalid = resolveTenantContextCore({ user: { id: fixture.users.saljare.id, email: fixture.users.saljare.email }, membership: { tenant_id: fixture.base.tenantA.id, role: role as string, status: "active" } });
      expect(invalid.ok).toBe(false);
    }
    const foreign = await selectTarget(tenantBAdmin, "customers", targetIds.crm);
    expect(foreign.error).toBeNull(); expect(foreign.data ?? []).toEqual([]);
  });

  test("[P1] Säljare and Montör receive pipeline counts only where RLS permits and never the accepted-value aggregate", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const [seller, installer] = await Promise.all([
      readQuotePipeline(PIPELINE_WINDOW, { roles: ["saljare"] }, { client: clients.saljare as never }),
      readQuotePipeline(PIPELINE_WINDOW, { roles: ["montor"] }, { client: clients.montor as never }),
    ]);
    expect(seller.data.acceptedCount).toBeGreaterThan(0); expect(Object.hasOwn(seller.data, "acceptedValueOre")).toBe(false); expect(seller.entitlements.withheld).toContain("acceptedValueOre");
    expect(installer.data.acceptedCount).toBe(0); expect(Object.hasOwn(installer.data, "acceptedValueOre")).toBe(false); expect(installer.entitlements.withheld).toContain("acceptedValueOre");
  });

  test("[P1] Phase A does not infer job assignment access: only Jobs.ViewAll roles can read the seeded job", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    for (const role of TENANT_ROLES) {
      expect(resolveCapability({ roles: [role], module: "jobs", capability: "Jobs.ViewAssigned" }).granted).toBe(false);
      const result = await selectTarget(clients[role], "jobs", targetIds.jobs);
      expect(result.error).toBeNull(); expect((result.data ?? []).length > 0).toBe(granted(role, ["jobs", "Jobs.ViewAll"]));
    }
  });
});
