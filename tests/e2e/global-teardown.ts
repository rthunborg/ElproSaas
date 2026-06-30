/**
 * Playwright globalTeardown — remove the seeded two-tenant fixture.
 *
 * Reads the fixture serialized by globalSetup and runs `cleanupFixture` (which purges
 * audit-bearing tenants via the TEST-ONLY privileged path). Best-effort: a teardown
 * failure must not fail the run (CI uses a fresh `supabase db reset` per run anyway).
 * The `.auth` dir is always removed so credentials never linger.
 */
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { cleanupFixture, type TwoTenantFixture } from "../factories/tenants";
import { FIXTURE_FILE } from "./global-setup";

export default async function globalTeardown() {
  try {
    const fixture = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as TwoTenantFixture;
    await cleanupFixture(fixture);
  } catch (e) {
    console.warn(
      `e2e teardown: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    rmSync(path.dirname(FIXTURE_FILE), { recursive: true, force: true });
  }
}
