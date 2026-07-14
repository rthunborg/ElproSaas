/**
 * `/jobs` (Jobb/Order) — the job/order list (Story 7.3, Task 2; architecture §4).
 *
 * A SERVER component over the RLS-scoped list read: it reads the tenant's ACTIVE jobs on the
 * per-request cookie-bound RLS client (anon key — NEVER service-role) and hands the rows to the
 * client `JobList` island. Each row links to `/jobs/[jobId]` — the detail is the heart of this
 * story; this list is a thin filterable index (customer / status / planned-date / source-quote).
 * Since 2026-07-14 (owner decision — standalone job creation) it ALSO fetches the active-customer
 * options for the island's "Skapa nytt jobb" create affordance (a job always needs a customer).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is the auth
 * boundary). This page adds NO auth mechanism and NO new nav item — "Jobb/Order" already exists in
 * the seven-item shell nav. SCOPE GUARD (AC2, R-711): NO deferred-module surface anywhere (the
 * `job-non-scope` guardrail enforces the exact forbidden token/route list).
 */
import { JobList } from "@/components/jobs/JobList";
import { readJobList } from "@/features/jobs/read";
import { readCustomerList } from "@/features/crm/read";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  // The list + the active-customer options for the create affordance — both on the RLS client.
  const [{ rows, error }, { rows: customers, error: customerError }] =
    await Promise.all([readJobList(), readCustomerList()]);
  const customerOptions = customers.map((c) => ({
    id: c.id,
    label: c.display_name,
  }));
  return (
    <JobList
      rows={rows}
      loadError={error}
      customerOptions={customerOptions}
      // A FAILED options read must not masquerade as "no customers exist" (the island shows
      // a neutral retry message and keeps submit disabled).
      optionsLoadError={customerError !== null}
    />
  );
}
