import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
export type ReadStep = { readonly outcome: "pass" | "error"; readonly hold?: boolean };
const root = () => path.join(process.cwd(), "tests/e2e/.auth/dashboard-control");
/** Only trusted local test setup can arm a synthetic subject. */
export function armReadPlan(userId: string, tables: Record<string, readonly ReadStep[]>) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Expected synthetic fixture UUID");
  mkdirSync(root(), { recursive: true });
  const revision = randomUUID();
  writeFileSync(path.join(root(), userId + ".json"), JSON.stringify({ revision, tables }), { mode: 0o600 });
  return revision;
}
export function releaseRead(revision: string) {
  if (!/^[0-9a-f-]{36}$/i.test(revision)) throw new Error("Expected read-plan UUID");
  writeFileSync(path.join(root(), revision + ".release"), "release");
}
