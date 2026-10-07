import { readFileSync } from "node:fs";
import { FIXTURE_FILE } from "../global-setup";
import globalTeardown from "../global-teardown";
import { cleanupFixture, type TwoTenantFixture } from "../../factories/tenants";
export default async function teardown() {
  try {
    const data = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as { dashboard19Fixtures?: TwoTenantFixture[] };
    for (const fixture of data.dashboard19Fixtures ?? []) await cleanupFixture(fixture);
  } finally { await globalTeardown(); }
}
