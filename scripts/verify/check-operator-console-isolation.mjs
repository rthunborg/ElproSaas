import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const targets = [
  "src/app/operator/layout.tsx",
  "src/app/operator/page.tsx",
  "src/app/operator/[tenantId]/page.tsx",
  "src/features/operator-console/actions.ts",
  "src/server/read-models/operator-console.ts",
];
const forbidden = [/components\/app-shell/i, /resolve-tenant-context/i, /phase-a-surface/i, /nav-registry/i];
const violations = [];
for (const file of targets) {
  const source = await readFile(resolve(root, file), "utf8");
  for (const pattern of forbidden) if (pattern.test(source)) violations.push(`${file}: forbidden tenant context import`);
  if ((file.endsWith("page.tsx") || file.endsWith("actions.ts") || file.endsWith("operator-console.ts")) && !/resolvePlatformOperator/.test(source)) violations.push(`${file}: missing resolvePlatformOperator gate`);
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
}
