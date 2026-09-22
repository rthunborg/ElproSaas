import { describe, expect, test } from "vitest";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

describe("Story 12.3 onboarding migration schema", () => {
  test("[P0] 12.3-INT-008 local additive migration has only a nullable membership dismissal field and a self-only update policy", async (testCtx) => {
    if (skipUnlessStack(testCtx, await isLocalStackReachable())) return;
    const [row] = await adminQuery<{ column_present: boolean; nullable: boolean; policy_present: boolean; column_grant: boolean; trigger_present: boolean }>(`select
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenant_memberships' and column_name='onboarding_checklist_dismissed_at') as column_present,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenant_memberships' and column_name='onboarding_checklist_dismissed_at' and is_nullable='YES') as nullable,
      exists(select 1 from pg_policies where schemaname='public' and tablename='tenant_memberships' and policyname='tenant_memberships_update_own_onboarding_dismissal' and qual like '%provisioning_state%') as policy_present,
      has_column_privilege('authenticated','public.tenant_memberships','onboarding_checklist_dismissed_at','update') as column_grant,
      exists(select 1 from pg_trigger where tgrelid='public.tenant_memberships'::regclass and tgname='tenant_memberships_audit_onboarding_checklist_dismissal' and not tgisinternal) as trigger_present`);
    expect(row).toEqual({ column_present: true, nullable: true, policy_present: true, column_grant: true, trigger_present: true });
  });
});
