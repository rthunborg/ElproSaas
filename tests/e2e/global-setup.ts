/**
 * Playwright globalSetup — seed a two-tenant fixture for the E2E journeys.
 *
 * Reuses the existing local-stack factories (loopback-gated via `assertLocalStack`).
 * Writes the seeded credentials to `tests/e2e/.auth/fixture.json` (gitignored) so the
 * specs can sign in as real users. The full fixture is serialized so `globalTeardown`
 * can remove it.
 *
 * adminA → active `tenant_admin` membership in tenantA (the happy path / G-2).
 * orphanUser → NO membership (the no-access path / AC2).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createTwoTenantFixture } from "../factories/tenants";

export const FIXTURE_FILE = path.join(
  process.cwd(),
  "tests",
  "e2e",
  ".auth",
  "fixture.json",
);

export default async function globalSetup() {
  const fixture = await createTwoTenantFixture();
  mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true });
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixture, null, 2), "utf8");
}
