import { chromium, expect, test as base, type Page } from "@playwright/test";

/** Test-runner-only. Never expose this endpoint through NEXT_PUBLIC_* variables. */
export const RESOURCE_E2E_CDP_ENDPOINT_ENV = "E2E_GUARD_CHROMIUM_CDP_ENDPOINT";

export function readResourceE2eCdpEndpoint(
  raw: string | undefined = process.env[RESOURCE_E2E_CDP_ENDPOINT_ENV],
): string | undefined {
  if (!raw) return undefined;
  const endpoint = new URL(raw);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(endpoint.protocol)) {
    throw new Error(`${RESOURCE_E2E_CDP_ENDPOINT_ENV} must use http(s) or ws(s)`);
  }
  if (!['127.0.0.1', '::1', 'localhost'].includes(endpoint.hostname)) {
    throw new Error(`${RESOURCE_E2E_CDP_ENDPOINT_ENV} must be a loopback endpoint`);
  }
  return endpoint.toString();
}

export function requireResourceE2eFailureSeamForCdp(
  endpoint: string | undefined,
  runtimeFlag: string | undefined = process.env.E2E_RESOURCE_SAVE_FAILURE_ENABLED,
): void {
  if (endpoint && runtimeFlag !== "true") {
    throw new Error(
      "E2E_RESOURCE_SAVE_FAILURE_ENABLED=true is required when E2E_GUARD_CHROMIUM_CDP_ENDPOINT is set",
    );
  }
}

type ResourcePageFixture = { readonly resourcePage: Page };
const cdpEndpoint = readResourceE2eCdpEndpoint();
requireResourceE2eFailureSeamForCdp(cdpEndpoint);

const normalTest = base.extend<ResourcePageFixture>({
  resourcePage: async ({ page }, use) => use(page),
});

const attachedTest = base.extend<ResourcePageFixture>({
  resourcePage: async ({}, use, testInfo) => {
    const browser = await chromium.connectOverCDP(cdpEndpoint!);
    const baseURL = testInfo.project.use.baseURL;
    const context = await browser.newContext(baseURL ? { baseURL } : {});
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await page.close();
      await context.close();
      // Do not close the attached Browser: the root guard owns its Chromium
      // lifecycle. The Playwright worker process releases the CDP transport.
    }
  },
});

/** Uses the root guard-owned Chromium only when the private loopback endpoint is set. */
export const test: typeof normalTest = cdpEndpoint ? attachedTest : normalTest;
export { expect };
