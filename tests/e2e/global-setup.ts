/**
 * Playwright globalSetup — seed a two-tenant fixture + CRM rows for the E2E journeys.
 *
 * Reuses the existing local-stack factories (loopback-gated via `assertLocalStack`).
 * Writes the seeded credentials + the seeded CRM customer ids to
 * `tests/e2e/.auth/fixture.json` (gitignored) so the specs can sign in as real users
 * and assert on a populated list / detail. The full fixture is serialized so
 * `globalTeardown` can remove it (the CRM rows cascade with the tenant delete).
 *
 * adminA → active `tenant_admin` membership in tenantA (the happy path / G-2).
 * orphanUser → NO membership (the no-access path / AC2).
 *
 * CRM seed (Story 3.2): one COMPANY customer (org_nr) and one PRIVATE customer (with a
 * personnummer) in tenantA, so the CRM specs can assert: the list renders, search
 * narrows it, the private customer's personnummer is NEVER in the list payload, and the
 * detail shows it masked. A facility + contact are seeded under the company customer so
 * the detail sub-sections are populated.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  adminInsertArticle,
  adminInsertCalculation,
  adminInsertContact,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertRow,
  adminInsertSection,
  adminInsertWorkRole,
  createTwoTenantFixture,
} from "../factories/tenants";

export const FIXTURE_FILE = path.join(
  process.cwd(),
  "tests",
  "e2e",
  ".auth",
  "fixture.json",
);

/** A unique, recognizable token so specs can search/assert without ambiguity. */
function token(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default async function globalSetup() {
  const base = await createTwoTenantFixture();

  // Seed CRM rows in tenantA via the privileged (BYPASSRLS) factory path. These are
  // read back through the app's RLS path at runtime as adminA.
  const companyName = `Acme El AB ${token()}`;
  const companyOrgNr = "556677-8899";
  const privateName = `Anna Privat ${token()}`;
  const privatePnr = "199001011234"; // MUST NOT appear in the list payload (P0).

  const companyId = await adminInsertCustomer({
    tenant_id: base.tenantA.id,
    customer_type: "company",
    display_name: companyName,
    org_nr: companyOrgNr,
  });
  const privateId = await adminInsertCustomer({
    tenant_id: base.tenantA.id,
    customer_type: "private",
    display_name: privateName,
    personnummer: privatePnr,
  });
  const facilityId = await adminInsertFacility({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    name: `Huvudkontor ${token()}`,
  });
  await adminInsertContact({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
    name: `Erik Kontakt ${token()}`,
  });

  // Calc seed (Story 5.2): a calculation under the company customer, with ONE section that
  // has TWO rows, so the editor E2E can open a pre-existing calc (rather than clicking the
  // whole create flow) and assert the totals summary + destructive-confirm behaviour. Each
  // count-asserting spec seeds its OWN uniquely-named calc; this baseline calc is for the
  // open/render/totals journeys. A distinct calc title token lets a spec find it.
  const calcTitle = `Kalkyl E2E ${token()}`;
  const calcId = await adminInsertCalculation({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
    title: calcTitle,
    status: "draft",
  });
  const sectionId = await adminInsertSection({
    tenant_id: base.tenantA.id,
    calculation_id: calcId,
    title: `Sektion 1 ${token()}`,
    display_mode: "detailed",
    sort_order: 0,
  });
  // Row 1: 2 × 850,00 kr @ 25% VAT (a labor row). Row 2: 1 × 500,00 kr @ 25% (material).
  const rowAId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: sectionId,
    row_type: "labor",
    quantity: 2,
    unit: "h",
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  const rowBId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: sectionId,
    row_type: "material",
    quantity: 1,
    unit: "st",
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    sort_order: 1,
  });

  // Pricing-source seed (Story 5.3): ONE active work role (labor source) + ONE active
  // article (material source) in tenantA, so the row-editor source-selection E2E can pick a
  // deterministic source by its display name. Uniquely-named so parallel/repeated runs never
  // collide. Their names are exposed on the fixture for the spec's `selectOption({ label })`.
  // NOTE: use a DISTINCTIVE sell rate (845,00 kr) so the "850,00 kr/tim" the pricing E2E
  // saves for its OWN role never collides with this seeded role in the shared pricing editor
  // (a strict-mode getByText match must resolve to exactly one element).
  const workRoleName = `Elektriker ${token()}`;
  const workRoleId = await adminInsertWorkRole({
    tenant_id: base.tenantA.id,
    display_name: workRoleName,
    cost_rate_ore: 45000,
    sell_rate_ore: 84500,
  });
  const articleName = `Kabel 3G1.5 ${token()}`;
  const articleId = await adminInsertArticle({
    tenant_id: base.tenantA.id,
    name: articleName,
    unit_price_ore: 1250,
  });

  const fixture = {
    ...base,
    crm: {
      company: { id: companyId, displayName: companyName, orgNr: companyOrgNr },
      private: { id: privateId, displayName: privateName, personnummer: privatePnr },
      facilityId,
    },
    calc: {
      id: calcId,
      title: calcTitle,
      customerId: companyId,
      sectionId,
      rowIds: [rowAId, rowBId],
    },
    workRole: { id: workRoleId, displayName: workRoleName },
    article: { id: articleId, name: articleName },
  };

  mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true });
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixture, null, 2), "utf8");
}
