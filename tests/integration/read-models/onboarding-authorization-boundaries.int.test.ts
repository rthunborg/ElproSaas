import { describe, expect, test, vi } from "vitest";
import { ONBOARDING_ACTION_INITIAL, ONBOARDING_ACTION_INPUT_ERROR } from "@/features/onboarding/action-state";
import { setOnboardingChecklistDismissed } from "@/features/onboarding/actions";
import { readOnboardingChecklist } from "@/server/read-models/onboarding-checklist";
import {
  cleanupRoleAwarePhaseAFixture,
  createRoleAwarePhaseAFixture,
  makeAnonServerClient,
  makeAuthedServerClient,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const dependencies = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/db/supabase-server-client", () => ({
  createSupabaseServerClient: dependencies.createClient,
}));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));

type TenantMutationSnapshot = {
  readonly memberships: readonly {
    readonly id: string;
    readonly user_id: string | null;
    readonly role: string;
    readonly status: string;
    readonly onboarding_checklist_dismissed_at: string | null;
  }[];
  readonly checklistFacts: readonly {
    readonly provisioning_state: string;
    readonly normalized_organization_number: string | null;
    readonly company_name: string | null;
    readonly org_nr: string | null;
    readonly terms_text: string | null;
    readonly active_work_roles: number;
  }[];
  readonly auditEventCount: number;
};

async function snapshotTenantMutations(tenantId: string): Promise<TenantMutationSnapshot> {
  const [memberships, checklistFacts, auditCount] = await Promise.all([
    adminQuery<TenantMutationSnapshot["memberships"][number]>(
      `select id, user_id, role, status, onboarding_checklist_dismissed_at
         from public.tenant_memberships
        where tenant_id = $1
        order by id`,
      [tenantId],
    ),
    adminQuery<TenantMutationSnapshot["checklistFacts"][number]>(
      `select t.provisioning_state, t.normalized_organization_number,
              c.company_name, c.org_nr, q.terms_text,
              count(w.id) filter (where w.is_active)::int as active_work_roles
         from public.tenants t
         left join public.company_settings c on c.tenant_id = t.id
         left join public.quote_terms q on q.tenant_id = t.id
         left join public.work_roles w on w.tenant_id = t.id
        where t.id = $1
        group by t.id, c.company_name, c.org_nr, q.terms_text`,
      [tenantId],
    ),
    adminQuery<{ count: number }>(
      `select count(*)::int as count
         from public.audit_events
        where tenant_id = $1
          and event_type = 'onboarding_checklist_presentation_changed'`,
      [tenantId],
    ),
  ]);

  return { memberships, checklistFacts, auditEventCount: auditCount[0]?.count ?? 0 };
}

function dismissalForm(dismiss: boolean): FormData {
  const form = new FormData();
  form.set("dismiss", String(dismiss));
  return form;
}

async function invokeProductionBoundaries(client: TestServerClient) {
  dependencies.createClient.mockResolvedValue(client);
  const read = await readOnboardingChecklist();

  dependencies.createClient.mockResolvedValue(client);
  const dismiss = await setOnboardingChecklistDismissed(
    ONBOARDING_ACTION_INITIAL,
    dismissalForm(true),
  );

  dependencies.createClient.mockResolvedValue(client);
  const restore = await setOnboardingChecklistDismissed(
    ONBOARDING_ACTION_INITIAL,
    dismissalForm(false),
  );

  return { read, dismiss, restore };
}

describe("Story 12.3 onboarding authorization boundaries", () => {
  test("[P0] 12.3-INT-007 12.3-AC5 active non-admin and anonymous callers receive identical no-data responses without mutation", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const fixture = await createRoleAwarePhaseAFixture();
    try {
      await adminQuery(
        `update public.tenants
            set provisioning_state = 'ready', normalized_organization_number = '5560160680'
          where id = $1`,
        [fixture.base.tenantA.id],
      );
      const before = await snapshotTenantMutations(fixture.base.tenantA.id);

      const nonAdmin = await invokeProductionBoundaries(
        await makeAuthedServerClient(fixture.users.saljare),
      );
      const anonymous = await invokeProductionBoundaries(await makeAnonServerClient());

      const genericNoData = {
        read: { visible: false },
        dismiss: ONBOARDING_ACTION_INPUT_ERROR,
        restore: ONBOARDING_ACTION_INPUT_ERROR,
      };
      expect(nonAdmin).toEqual(genericNoData);
      expect(anonymous).toEqual(genericNoData);
      expect(nonAdmin).toEqual(anonymous);
      expect(await snapshotTenantMutations(fixture.base.tenantA.id)).toEqual(before);
      expect(dependencies.revalidatePath).not.toHaveBeenCalled();
    } finally {
      dependencies.createClient.mockReset();
      dependencies.revalidatePath.mockReset();
      await cleanupRoleAwarePhaseAFixture(fixture);
    }
  });
});
