import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
/** Consume an already running guard-owned production server; never raw-spawn webServer. */
export default defineConfig({
  testDir: path.join(process.cwd(), "tests/e2e"),
  testMatch: ["dashboard/dashboard-pipeline.e2e.spec.ts", "auth/role-aware-phase-a-surface.atdd.e2e.spec.ts", "onboarding/first-admin-checklist.e2e.spec.ts"],
  workers: 1, fullyParallel: false, retries: 0, timeout: 60000,
  expect: { timeout: 15000 }, reporter: [["list"]],
  globalSetup: path.join(process.cwd(), "tests/e2e/dashboard/setup.ts"),
  globalTeardown: path.join(process.cwd(), "tests/e2e/dashboard/teardown.ts"),
  use: { baseURL: "http://127.0.0.1:" + (process.env.E2E_PORT ?? "3100"),
    actionTimeout: 15000, navigationTimeout: 30000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
