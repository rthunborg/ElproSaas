import { describe, expect, test, vi } from "vitest";
import { readOnboardingChecklist } from "@/server/read-models/onboarding-checklist";
import {
  adminInsertMembership,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type FixtureTenant,
  type FixtureUser,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const dependencies = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveTenantContext: vi.fn(),
}));

vi.mock("@/server/db/supabase-server-client", () => ({
  createSupabaseServerClient: dependencies.createClient,
}));
vi.mock("@/server/auth/resolve-tenant-context", () => ({
  resolveTenantContext: dependencies.resolveTenantContext,
}));

const ORGANIZATION_NUMBER = "5560160680";

function complete(item: string, result: Awaited<ReturnType<typeof readOnboardingChecklist>>): boolean {
  if (!result.visible) throw new Error("expected the ready tenant checklist to be visible");
  const found = result.checklist.items.find((candidate) => candidate.id === item);
  if (!found) throw new Error(`missing checklist item: ${item}`);
  return found.complete;
}

async function makeReadyWithCoreFacts(tenant: FixtureTenant): Promise<void> {
  await adminQuery(
    `update public.tenants
        set provisioning_state = 'ready', normalized_organization_number = $2
      where id = $1`,
    [tenant.id, ORGANIZATION_NUMBER],
  );
  await adminQuery(
    `insert into public.company_settings
       (tenant_id, company_name, org_nr, default_vat_display, vat_rate_bp)
     values ($1, 'Checklist fixture AB', $2, 'company_togglable', 2500)`,
    [tenant.id, ORGANIZATION_NUMBER],
  );
  await adminQuery(
    `insert into public.quote_terms (tenant_id, terms_text)
     values ($1, 'Fixture terms')`,
    [tenant.id],
  );
  await adminQuery(
    `insert into public.work_roles (tenant_id, display_name, cost_rate_ore, sell_rate_ore, is_active)
     values ($1, 'Elektriker', 10000, 15000, true)`,
    [tenant.id],
  );
}

async function insertMembership(params: {
  tenant: FixtureTenant;
  user: FixtureUser;
  status: "active" | "invited";
  expiresAt?: "past" | "future";
}): Promise<string> {
  const rows = await adminQuery<{ id: string }>(
    `insert into public.tenant_memberships
       (tenant_id, user_id, role, status, invited_email, invitation_expires_at)
     values (
       $1, $2, 'saljare', $3, lower($4),
       case $5 when 'past' then statement_timestamp() - interval '1 hour'
               when 'future' then statement_timestamp() + interval '1 hour'
               else null end
     )
     returning id`,
    [params.tenant.id, params.user.id, params.status, params.user.email, params.expiresAt ?? null],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("onboarding fixture membership was not created");
  return id;
}

async function assignRole(tenant: FixtureTenant, membershipId: string): Promise<void> {
  await adminQuery(
    `insert into public.membership_roles (tenant_id, membership_id, role)
     values ($1, $2, 'saljare')`,
    [tenant.id, membershipId],
  );
}

async function readAsTenantAdmin(tenant: FixtureTenant, user: FixtureUser) {
  dependencies.createClient.mockResolvedValue(await makeAuthedServerClient(user));
  dependencies.resolveTenantContext.mockResolvedValue({
    ok: true,
    data: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userId: user.id,
      role: "tenant_admin",
      status: "active",
      roles: ["tenant_admin"],
    },
  });
  return readOnboardingChecklist();
}

describe("Story 12.3 onboarding checklist read model", () => {
  test("[P0] an additional active membership is incomplete until it has a membership_roles assignment", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createTwoTenantFixture();
    try {
      await makeReadyWithCoreFacts(fixture.tenantA);
      const membershipId = await insertMembership({ tenant: fixture.tenantA, user: fixture.orphanUser, status: "active" });

      expect(complete("users", await readAsTenantAdmin(fixture.tenantA, fixture.adminA))).toBe(false);

      await assignRole(fixture.tenantA, membershipId);
      expect(complete("users", await readAsTenantAdmin(fixture.tenantA, fixture.adminA))).toBe(true);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0] a non-expired invited membership is incomplete until it has a membership_roles assignment", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createTwoTenantFixture();
    try {
      await makeReadyWithCoreFacts(fixture.tenantA);
      const membershipId = await insertMembership({
        tenant: fixture.tenantA,
        user: fixture.adminB,
        status: "invited",
        expiresAt: "future",
      });

      expect(complete("users", await readAsTenantAdmin(fixture.tenantA, fixture.adminA))).toBe(false);

      await assignRole(fixture.tenantA, membershipId);
      expect(complete("users", await readAsTenantAdmin(fixture.tenantA, fixture.adminA))).toBe(true);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0] an expired invited membership does not complete users even when it retains a role assignment", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createTwoTenantFixture();
    try {
      await makeReadyWithCoreFacts(fixture.tenantA);
      const membershipId = await insertMembership({
        tenant: fixture.tenantA,
        user: fixture.adminB,
        status: "invited",
        expiresAt: "past",
      });
      await assignRole(fixture.tenantA, membershipId);

      expect(complete("users", await readAsTenantAdmin(fixture.tenantA, fixture.adminA))).toBe(false);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  test("[P0] facts from another tenant administered by the caller cannot complete the resolved tenant checklist", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createTwoTenantFixture();
    try {
      // The same caller can read both tenants under RLS, so every fact query must retain
      // the resolver-selected tenant id rather than relying on RLS visibility alone.
      await adminInsertMembership({
        tenant_id: fixture.tenantB.id,
        user_id: fixture.adminA.id,
        role: "tenant_admin",
        status: "active",
      });
      await adminQuery(
        `update public.tenants
            set provisioning_state = 'ready', normalized_organization_number = $2
          where id = $1`,
        [fixture.tenantA.id, ORGANIZATION_NUMBER],
      );
      await makeReadyWithCoreFacts(fixture.tenantB);

      const result = await readAsTenantAdmin(fixture.tenantA, fixture.adminA);
      expect(complete("company", result)).toBe(false);
      expect(complete("terms", result)).toBe(false);
      expect(complete("pricing", result)).toBe(false);
      expect(complete("users", result)).toBe(false);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});
