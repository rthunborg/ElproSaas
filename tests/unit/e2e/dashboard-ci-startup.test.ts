import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dashboardCIConfig from "../../e2e/dashboard/playwright.ci.config";

const configPath = fileURLToPath(new URL("../../e2e/dashboard/playwright.ci.config.ts", import.meta.url));
const configDirectory = path.dirname(configPath);
const repositoryRoot = path.resolve(configDirectory, "../../..");
const servers = Array.isArray(dashboardCIConfig.webServer)
  ? dashboardCIConfig.webServer : [dashboardCIConfig.webServer];

for (const [index, entryPoint] of [
  [0, "tests/e2e/dashboard/server-read-proxy.mjs"],
  [1, "node_modules/next/dist/bin/next"],
] as const) {
  test("dashboard CI resolves startup entry point from repository root: " + entryPoint, () => {
    const server = servers[index];
    assert.ok(server);
    // Playwright falls back to the nested configuration directory when cwd is omitted.
    const effectiveDirectory = path.resolve(configDirectory, server.cwd ?? ".");
    const entry = /^node\s+(\S+)/.exec(server.command)?.[1];
    assert.ok(entry, "startup command must name its actual Node entry point");
    const resolvedEntry = path.resolve(effectiveDirectory, entry);
    assert.equal(resolvedEntry, path.join(repositoryRoot, entryPoint));
    assert.ok(existsSync(resolvedEntry), "Node must be able to find the startup entry point");
  });
}
