import { defineConfig } from "@playwright/test";
import path from "node:path";
import dashboardConfig from "./playwright.config";
import {
  LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_TEST_QUOTE_PDF_KEY_ID, LOCAL_TEST_QUOTE_PDF_SECRET,
  LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID, LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET,
  assertLocalStack,
} from "../../support/test-env";

// This config owns ephemeral GitHub-runner services. Local agents consume it through guarded resources.
assertLocalStack();
const port = Number(process.env.E2E_PORT ?? 3201);
const proxyPort = Number(process.env.DASHBOARD_PROXY_PORT ?? 37921);
if ([port, proxyPort].some(value => !Number.isInteger(value) || value < 1024 || value > 65535))
  throw new Error("Dashboard CI requires high loopback app/proxy ports");
const appURL = `http://127.0.0.1:${port}`;
const proxyURL = `http://127.0.0.1:${proxyPort}`;

export default defineConfig(dashboardConfig, {
  forbidOnly: true,
  retries: 0,
  reporter: [["html", { outputFolder: path.join(process.cwd(), "playwright-report/dashboard"), open: "never" }], ["list"],
    [path.join(process.cwd(), "tests/e2e/ci-duration-budget-reporter.ts"), { label: "Dashboard browser tests", maxMs: 300_000 }]],
  use: { baseURL: appURL },
  // Playwright otherwise starts commands from this nested configuration directory.
  webServer: [{
    cwd: process.cwd(),
    command: `node tests/e2e/dashboard/server-read-proxy.mjs --upstream ${LOCAL_SUPABASE_URL} --port ${proxyPort} --control-root tests/e2e/.auth/dashboard-control`,
    url: `${proxyURL}/auth/v1/health`, timeout: 60_000, reuseExistingServer: false,
  }, {
    cwd: process.cwd(),
    command: `node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
    url: appURL, timeout: 240_000, reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: proxyURL, NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: appURL, SUPABASE_SERVICE_ROLE_KEY: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
      QUOTE_PDF_ATTESTATION_KEY_ID: LOCAL_TEST_QUOTE_PDF_KEY_ID,
      QUOTE_PDF_ATTESTATION_HMAC_SECRET: LOCAL_TEST_QUOTE_PDF_SECRET,
      TENANT_PROVISIONING_ATTESTATION_KEY_ID: LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID,
      TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET: LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET,
      TENANT_PROVISIONING_ENABLED: "true",
    },
  }],
});
