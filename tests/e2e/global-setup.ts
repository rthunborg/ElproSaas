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
  adminInsertContact,
  adminInsertCustomer,
  adminInsertFacility,
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

  const fixture = {
    ...base,
    crm: {
      company: { id: companyId, displayName: companyName, orgNr: companyOrgNr },
      private: { id: privateId, displayName: privateName, personnummer: privatePnr },
      facilityId,
    },
  };

  mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true });
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixture, null, 2), "utf8");
}
