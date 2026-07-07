/**
 * `/jobs` (Jobb/Order) — the job/order list (Story 7.3, Task 2; architecture §4).
 *
 * A SERVER component over the RLS-scoped list read: it reads the tenant's ACTIVE jobs on the
 * per-request cookie-bound RLS client (anon key — NEVER service-role) and hands the rows to the
 * client `JobList` island. Each row links to `/jobs/[jobId]` — the detail is the heart of this
 * story; this list is a thin filterable index (customer / status / planned-date / source-quote).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is the auth
 * boundary). This page adds NO auth mechanism and NO new nav item — "Jobb/Order" already exists in
 * the seven-item shell nav. SCOPE GUARD (AC2, R-711): NO deferred-module surface anywhere (the
 * `job-non-scope` guardrail enforces the exact forbidden token/route list).
 */
import { JobList } from "@/components/jobs/JobList";
import { readJobList } from "@/features/jobs/read";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { rows, error } = await readJobList();
  return <JobList rows={rows} loadError={error} />;
}
