import { randomInt } from "node:crypto";
import { adminQuery } from "../factories/admin-sql";
import type { TwoTenantFixture } from "../factories/tenants";

type SeedEpic12BrowserFixturesOptions = {
  readonly base: TwoTenantFixture;
  readonly token: () => string;
};

export type Epic12BrowserFixtures = {
  readonly operatorConsole: {
    readonly handoffTenantId: string;
    readonly provisioningOrganisationNumber: string;
  };
};

function validOrganisationNumber(): string {
  // Keep a random suffix behind a fixed non-date-like company prefix. The seed
  // runs repeatedly against one local database, so a timestamp suffix can
  // collide with a fixture from an interrupted prior run.
  const stem = `556${randomInt(0, 1_000_000).toString().padStart(6, "0")}`;
  const sum = [...stem].reduce((total, digit, index) => {
    const doubled = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return `${stem}${(10 - (sum % 10)) % 10}`;
}

/** Seeds the existing Epic 12 browser states; global teardown owns `base` cleanup. */
export async function seedEpic12BrowserFixtures({
  base,
  token,
}: SeedEpic12BrowserFixturesOptions): Promise<Epic12BrowserFixtures> {
  // Story 12.3 owns a separate ready tenant so the operator handoff fixture on tenant A remains unchanged.
  const onboardingOrganisationNumber = validOrganisationNumber();
  await adminQuery("update public.tenants set country_code='SE', normalized_organization_number=$2, provisioning_state='ready' where id=$1", [base.tenantB.id, onboardingOrganisationNumber]);
  await adminQuery(`insert into public.company_settings (tenant_id, company_name, org_nr, default_vat_display, vat_rate_bp) values ($1,'Onboarding E2E AB',$2,'company_togglable',2500)`, [base.tenantB.id, onboardingOrganisationNumber]);
  await adminQuery(`insert into public.quote_terms (tenant_id, terms_text) values ($1,'Onboarding fixture terms')`, [base.tenantB.id]);
  await adminQuery(`insert into public.work_roles (tenant_id, display_name, cost_rate_ore, sell_rate_ore) values ($1,'Onboarding role',0,0)`, [base.tenantB.id]);

  const operatorHandoffOrganisationNumber = `990${Date.now().toString().slice(-7)}`;
  const operatorProvisioningOrganisationNumber = validOrganisationNumber();
  await adminQuery(
    "insert into public.platform_operators (user_id, granted_by) values ($1, $2), ($3, $2)",
    [base.adminB.id, base.adminA.id, base.orphanUser.id],
  );
  // Story 12.2 needs a durable, server-rendered handoff state. Keep it on the
  // existing fixture tenant so global teardown remains the sole scoped cleanup
  // owner. The browser receives only this safe route handle, never invite data.
  const operatorHandoffEmail = `operator-handoff-${token()}@example.test`;
  const operatorHandoffMembershipId = crypto.randomUUID();
  await adminQuery(
    `insert into public.tenant_memberships
       (id,tenant_id,user_id,role,status,invited_email,invited_at,invitation_expires_at)
     values ($1,$2,null,'tenant_admin','invited',$3,statement_timestamp(),statement_timestamp() + interval '24 hours')`,
    [operatorHandoffMembershipId, base.tenantA.id, operatorHandoffEmail],
  );
  const [operatorHandoffBaseline] = await adminQuery<{ baseline_id: string; version: number; content_hash: string }>(
    "select baseline_id,version,content_hash from public.tenant_provisioning_baselines where baseline_id='standard-se' order by version desc limit 1",
  );
  if (!operatorHandoffBaseline) throw new Error("Story 12.2 browser fixture has no provisioning baseline");
  const operatorHandoffRequestId = crypto.randomUUID();
  await adminQuery(
    `update public.tenants
     set country_code='SE', normalized_organization_number=$2, provisioning_state='first_admin_invite_unknown',
         provisioning_baseline_id=$3, provisioning_baseline_version=$4, provisioning_baseline_content_hash=$5
     where id=$1`,
    [base.tenantA.id, operatorHandoffOrganisationNumber, operatorHandoffBaseline.baseline_id, operatorHandoffBaseline.version, operatorHandoffBaseline.content_hash],
  );
  await adminQuery(
    `insert into public.tenant_provisioning_invites
       (tenant_id,membership_id,token_hash,normalized_email,role,outcome)
     values ($1,$2,'', $3,'tenant_admin','unknown')`,
    [base.tenantA.id, operatorHandoffMembershipId, operatorHandoffEmail],
  );
  await adminQuery(
    `insert into public.tenant_provisioning_requests
       (request_id,canonical_request_hash,tenant_id,actor_user_id,preview_hash,baseline_content_hash,provisioning_state,approval_generation)
     values ($1,repeat('a',64),$2,$3,repeat('b',64),$4,'first_admin_invite_unknown',1)`,
    [operatorHandoffRequestId, base.tenantA.id, base.adminB.id, operatorHandoffBaseline.content_hash],
  );

  return {
    operatorConsole: {
      handoffTenantId: base.tenantA.id,
      provisioningOrganisationNumber: operatorProvisioningOrganisationNumber,
    },
  };
}
