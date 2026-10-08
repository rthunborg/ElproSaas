import { test as base, expect } from "@playwright/test";

/** Dedicated guarded browser; Playwright's context fixture still isolates every test. */
export const test = process.env.E2E_DASHBOARD_CDP_URL
  ? base.extend({
    browser: [async ({ playwright }, use) => {
      const endpoint = new URL(process.env.E2E_DASHBOARD_CDP_URL!);
      if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1")
        throw new Error("Dashboard CDP browser must use guarded loopback");
      const browser = await playwright.chromium.connectOverCDP(endpoint.href);
      await use(browser);
      // The root guard owns browser lifetime. The worker exits after closing its own contexts.
    }, { scope: "worker" }],
  })
  : base;
export { expect };
