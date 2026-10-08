import { readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import globalSetup, { FIXTURE_FILE } from "../global-setup";
import {
  createTwoTenantFixture, cleanupFixture, adminInsertCustomer, adminInsertCalculation,
  adminInsertQuote, adminInsertQuoteVersion, adminInsertQuoteEvent, adminInsertQuoteAcceptance,
  adminInsertLostQuoteVersionWithReason, adminInsertMembership, type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { armReadPlan } from "./read-plan";

function orgNumber() {
  const stem = "556" + randomInt(100000, 999999);
  const sum = [...stem].reduce((total, digit, index) => {
    const doubled = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return stem + ((10 - sum % 10) % 10);
}
export default async function setup() {
  await globalSetup();
  const shared = JSON.parse(readFileSync(FIXTURE_FILE, "utf8"));
  const fixtures: TwoTenantFixture[] = [];
  const scenarios: Record<string, unknown> = {};
  const names = ["source-history", "seller-sentinel", "entitled-sentinel", "empty-entitled",
    "empty-withheld", "sent-only", "entitled-zero", "failure-isolation", "retry-recovery",
    "retry-failure", "revoke-quote", "revoke-money", "retry-session-lost",
    "layout-loading", "layout-error", "layout-empty", "layout-withheld",
    ...["success", "error"].flatMap(outcome => ["undismissed", "dismissed", "completed", "non-admin",
      "invisible", "read-failure"].map(state => "onboarding-" + state + "-" + outcome))];
  try {
    for (const name of names) {
      const base = await createTwoTenantFixture();
      fixtures.push(base);
      const tenantId = base.tenantA.id;
      const seller = /seller|withheld|non-admin/.test(name);
      if (seller) {
        await adminQuery("update public.tenant_memberships set role='saljare' where tenant_id=$1 and user_id=$2", [tenantId, base.adminA.id]);
        await adminQuery("delete from public.membership_roles where tenant_id=$1", [tenantId]);
        await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) select tenant_id,id,'saljare' from public.tenant_memberships where tenant_id=$1", [tenantId]);
      }
      const boundaryNow = new Date().toISOString();
      const empty = /empty/.test(name);
      const sentOnly = name === "sent-only" || name === "entitled-zero";
      const acceptedSentinelOre = empty || sentOnly ? 0 : 91827361;
      const frozenSentTotalOre = acceptedSentinelOre + 10000;
      if (!empty) {
        const customer = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: "Dashboard synthetic fixture" });
        const calculation = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customer });
        const quote = await adminInsertQuote({ tenant_id: tenantId, customer_id: customer });
        const version = await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: quote,
          calculation_id: calculation, status: sentOnly ? "sent" : "accepted", accepted_price_ore: frozenSentTotalOre });
        await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: quote, quote_version_id: version, event_type: "sent", occurred_at: boundaryNow });
        if (!sentOnly) {
          await adminInsertQuoteAcceptance({ tenant_id: tenantId, quote_id: quote, quote_version_id: version,
            accepted_price_ore: acceptedSentinelOre, source_sent_total_ore: frozenSentTotalOre,
            adjustment_reason: "Synthetic adjusted commitment", accepted_at: boundaryNow });
          await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: quote, quote_version_id: version, event_type: "accepted", occurred_at: boundaryNow });
        }
        if (name === "source-history") {
          await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: quote, quote_version_id: version, event_type: "sent", occurred_at: boundaryNow });
          const lostQuote = await adminInsertQuote({ tenant_id: tenantId, customer_id: customer });
          const lost = await adminInsertLostQuoteVersionWithReason({ tenant_id: tenantId, quote_id: lostQuote, calculation_id: calculation });
          await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: lostQuote, quote_version_id: lost.quoteVersionId, event_type: "sent", occurred_at: boundaryNow });
          await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: lostQuote, quote_version_id: lost.quoteVersionId, event_type: "lost", occurred_at: boundaryNow });
          await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: lostQuote, calculation_id: calculation, version_number: 2 });
        }
      }
      const onboarding = name.includes("onboarding-") || name === "failure-isolation";
      if (onboarding && !name.includes("-invisible-")) {
        const number = orgNumber();
        await adminQuery("update public.tenants set country_code='SE', normalized_organization_number=$2, provisioning_state='ready' where id=$1", [tenantId, number]);
        await adminQuery("insert into public.company_settings (tenant_id,company_name,org_nr,default_vat_display,vat_rate_bp) values ($1,'Dashboard fixture',$2,'company_togglable',2500)", [tenantId, number]);
        await adminQuery("insert into public.quote_terms (tenant_id,terms_text) values ($1,'Synthetic fixture terms')", [tenantId]);
        if (name.includes("-dismissed-"))
          await adminQuery("update public.tenant_memberships set onboarding_checklist_dismissed_at=now() where tenant_id=$1 and user_id=$2", [tenantId, base.adminA.id]);
        if (name.includes("-completed-")) {
          await adminQuery("insert into public.work_roles (tenant_id,display_name,cost_rate_ore,sell_rate_ore) values ($1,'Fixture role',0,0)", [tenantId]);
          await adminInsertMembership({ tenant_id: tenantId, user_id: base.orphanUser.id, role: "montor", status: "active" });
          await adminQuery("insert into public.membership_roles (tenant_id,membership_id,role) select tenant_id,id,'montor' from public.tenant_memberships where tenant_id=$1 and user_id=$2", [tenantId, base.orphanUser.id]);
        }
      }
      const tables: Record<string, { outcome: "pass" | "error"; hold?: boolean }[]> = {};
      if (/failure-isolation|retry-session-lost|layout-error/.test(name) || name.endsWith("-error"))
        tables.quote_events = [{ outcome: "error" }];
      if (name === "retry-recovery" || name === "retry-failure")
        tables.quote_events = [{ outcome: "error" }, { outcome: name === "retry-recovery" ? "pass" : "error", hold: true }];
      if (name.startsWith("revoke-"))
        tables.quote_events = [{ outcome: "pass" }, { outcome: "error" }, { outcome: "pass" }];
      if (name.includes("-read-failure-")) tables.quote_terms = [{ outcome: "error" }];
      const plan = armReadPlan(base.adminA.id, tables);
      scenarios[name] = { user: base.adminA, tenantId, boundaryNow, acceptedSentinelOre, frozenSentTotalOre, plan };
    }
    shared.dashboard19 = scenarios;
    shared.dashboard19Fixtures = fixtures;
    writeFileSync(FIXTURE_FILE, JSON.stringify(shared), { mode: 0o600 });
  } catch (error) {
    for (const fixture of fixtures) await cleanupFixture(fixture);
    throw error;
  }
}
