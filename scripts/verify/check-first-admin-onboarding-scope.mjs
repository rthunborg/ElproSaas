import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const sources = [
  "src/features/onboarding/checklist-state.ts",
  "src/features/onboarding/actions.ts",
  "src/server/read-models/onboarding-checklist.ts",
  "src/components/onboarding/OnboardingChecklist.tsx",
  "src/components/onboarding/OnboardingReminder.tsx",
  "src/app/(app)/dashboard/page.tsx",
].map((path) => ({ path, content: readFileSync(resolve(root, path), "utf8") }));
const forbidden = ["service_role", "createBrowserClient", "signup", "registration"];
const failures = [];
for (const source of sources) for (const token of forbidden) if (source.content.toLowerCase().includes(token)) failures.push(`${source.path}: forbidden ${token}`);
const migration = resolve(root, "supabase/migrations/20260920110000_first_admin_onboarding_dismissal.sql");
if (!existsSync(migration)) failures.push("missing dismissal migration");
else {
  const content = readFileSync(migration, "utf8").toLowerCase();
  if (!content.includes("add column if not exists onboarding_checklist_dismissed_at")) failures.push("dismissal migration lacks the only permitted presentation column");
  if (content.includes("create table")) failures.push("dismissal migration must not create an onboarding table");
}
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log("first-admin-onboarding scope check passed");
