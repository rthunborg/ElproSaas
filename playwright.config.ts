/**
 * Playwright E2E runner (TEA testarch-framework — Playwright/TypeScript).
 *
 * Drives the browser acceptance journeys under `tests/e2e/**` against the REAL app
 * wired to the LOCAL Supabase stack. The runner decision + rationale are recorded in
 * `_bmad-output/test-artifacts/framework-setup-progress.md`.
 *
 * - `webServer` boots the Next app on a dedicated E2E port with `NEXT_PUBLIC_SUPABASE_*`
 *   pointed at the local stack (the public local-demo keys; never a real project).
 * - `globalSetup` seeds a two-tenant fixture (adminA with an active membership, orphanUser
 *   with none) via the existing factories; `globalTeardown` removes it. Credentials are
 *   handed to the specs through `tests/e2e/.auth/fixture.json` (gitignored).
 * - Serial (`workers: 1`) — the specs share one seeded fixture and exercise login/logout.
 */
import { defineConfig, devices } from "@playwright/test";
import {
  LOCAL_SUPABASE_URL,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_TEST_QUOTE_PDF_KEY_ID,
  LOCAL_TEST_QUOTE_PDF_SECRET,
} from "./tests/support/test-env";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["list"]]
    : [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Run a PRODUCTION build + start (not `next dev`): under dev, the Turbopack/webpack
    // HMR WebSocket fails its handshake in headless Chromium and the client never
    // hydrates (no React fiber attaches → the login form native-GET-submits). A prod
    // build has no HMR socket, hydrates deterministically, and matches what ships.
    // Invoke Next via `node` + its JS bin (not `pnpm exec`/`npx`): Playwright spawns the
    // webServer through a shell whose PATH may lack the pnpm/npx shims (notably Windows);
    // `node` is always present. NEXT_PUBLIC_* (set below) are inlined at build time.
    command: `node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start --port ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE_ANON_KEY,
      // Admin email links must return to this actual production-mode test host.
      // The local Auth redirect allow-list has matching 3000 and 3100 entries.
      NEXT_PUBLIC_APP_URL: BASE_URL,
      // The server-only quote-PDF broker is deliberately the sole app path that
      // needs this local credential. It is not NEXT_PUBLIC_ and Next does not
      // inline it into browser bundles; tests prove Säljare still has no raw
      // Storage SELECT/list/download/sign capability.
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
      // Server-only local fixture values. Production has no fallback and must
      // provision its own matching Vault + environment configuration.
      QUOTE_PDF_ATTESTATION_KEY_ID: LOCAL_TEST_QUOTE_PDF_KEY_ID,
      QUOTE_PDF_ATTESTATION_HMAC_SECRET: LOCAL_TEST_QUOTE_PDF_SECRET,
    },
  },
});
