import { describe, expect, test, vi } from "vitest";
import { runCommand } from "@/server/commands/envelope";
import { updateCompanySettings } from "@/server/commands/settings/company-settings";
import { updateQuoteTerms } from "@/server/commands/settings/quote-terms";
import { upsertWorkRole } from "@/server/commands/pricing/work-roles";
import { readOnboardingChecklist } from "@/server/read-models/onboarding-checklist";
import { adminQuery } from "../../factories/admin-sql";
import { createAcceptedProvisionedFirstAdminFixture } from "../../factories/platform-operators";
import { makeAuthedServerClient } from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const dependencies = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/server/db/supabase-server-client", () => ({
  createSupabaseServerClient: dependencies.createClient,
}));

type ProtectedRows = {
  tenants: unknown[];
  companySettings: unknown[];
  quoteTerms: unknown[];
  workRoles: unknown[];
  memberships: unknown[];
  membershipRoles: unknown[];
};

async function protectedRows(tenantId: string): Promise<ProtectedRows> {
  const [tenants, companySettings, quoteTerms, workRoles, memberships, membershipRoles] = await Promise.all([
    adminQuery("select id,name,provisioning_state,normalized_organization_number from public.tenants where id=$1", [tenantId]),
    adminQuery("select tenant_id,company_name,org_nr,default_vat_display,vat_rate_bp from public.company_settings where tenant_id=$1 order by id", [tenantId]),
    adminQuery("select tenant_id,terms_text,approved_at,approved_by from public.quote_terms where tenant_id=$1 order by id", [tenantId]),
    adminQuery("select tenant_id,display_name,cost_rate_ore,sell_rate_ore,is_active from public.work_roles where tenant_id=$1 order by id", [tenantId]),
    adminQuery("select id,tenant_id,user_id,role,status,invited_email,invitation_expires_at from public.tenant_memberships where tenant_id=$1 order by id", [tenantId]),
    adminQuery("select membership_id,tenant_id,role from public.membership_roles where tenant_id=$1 order by membership_id,role", [tenantId]),
  ]);
  return { tenants, companySettings, quoteTerms, workRoles, memberships, membershipRoles };
}

describe("12.3 first-admin onboarding lifecycle", () => {
  test("[P0] 12.3-INT-AC3 real operator approval through accepted first Admin reaches a reloaded working state without changing an existing tenant", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;

    let existingTenantBefore: ProtectedRows | null = null;
    const accepted = await createAcceptedProvisionedFirstAdminFixture({
      beforeProvisioning: async (base) => {
        existingTenantBefore = await protectedRows(base.tenantB.id);
      },
    });
    try {
      expect(existingTenantBefore).not.toBeNull();
      const firstAdminClient = await makeAuthedServerClient(accepted.firstAdmin);
      dependencies.createClient.mockResolvedValue(firstAdminClient);

      const [tenant] = await adminQuery<{ normalized_organization_number: string }>(
        "select normalized_organization_number from public.tenants where id=$1",
        [accepted.tenantId],
      );
      if (!tenant?.normalized_organization_number) throw new Error("provisioned tenant organization number missing");

      const companyIdentity = await runCommand(updateCompanySettings, {
        client: firstAdminClient as never,
        input: {
          company_name: "Lifecycle Electric AB",
          org_nr: tenant.normalized_organization_number,
          default_vat_display: "company_excl",
          vat_rate_bp: 2500,
        },
        correlationId: crypto.randomUUID(),
      });
      expect(companyIdentity.ok).toBe(true);

      const vat = await runCommand(updateCompanySettings, {
        client: firstAdminClient as never,
        input: {
          company_name: "Lifecycle Electric AB",
          org_nr: tenant.normalized_organization_number,
          default_vat_display: "company_togglable",
          vat_rate_bp: 2500,
        },
        correlationId: crypto.randomUUID(),
      });
      expect(vat.ok).toBe(true);

      const terms = await runCommand(updateQuoteTerms, {
        client: firstAdminClient as never,
        input: { terms_text: "Betalningsvillkor 30 dagar." },
        correlationId: crypto.randomUUID(),
      });
      expect(terms.ok).toBe(true);

      const role = await runCommand(upsertWorkRole as never, {
        client: firstAdminClient as never,
        input: { display_name: "Elektriker", cost_rate_ore: 45000, sell_rate_ore: 85000 },
        correlationId: crypto.randomUUID(),
      });
      expect(role.ok).toBe(true);

      const invite = await firstAdminClient.rpc("admin_prepare_membership_invitation", {
        p_tenant_id: accepted.tenantId,
        p_email: `invite-${crypto.randomUUID()}@example.test`,
        p_roles: ["montor"],
        p_operation_id: crypto.randomUUID(),
        p_token_hash: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
        p_expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      expect(invite.error).toBeNull();
      expect(invite.data).toMatchObject({ membershipId: expect.any(String), fresh: true });

      // A fresh production read-model invocation represents the reloaded dashboard.
      const reloaded = await readOnboardingChecklist();
      expect(reloaded).toMatchObject({ visible: true, checklist: { workingState: true } });
      if (reloaded.visible) {
        expect(reloaded.checklist.items).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "company", complete: true }),
          expect.objectContaining({ id: "vat", complete: true }),
          expect.objectContaining({ id: "terms", complete: true }),
          expect.objectContaining({ id: "pricing", complete: true }),
          expect.objectContaining({ id: "users", complete: true }),
        ]));
      }

      expect(await protectedRows(accepted.base.tenantB.id)).toEqual(existingTenantBefore);
    } finally {
      await accepted.cleanup();
    }
  });
});
