/**
 * `/files` (Filer) — the LIMITED Phase-A file index (Story 8.5, Task 1.2; architecture §14).
 *
 * A SERVER component over the RLS-scoped index read: it reads the tenant's OWN non-archived files
 * linked to a Phase A owner type on the per-request cookie-bound RLS client (anon key — NEVER
 * service-role) and hands the rows to the client `FileIndexList` island. A LIMITED index — NOT a
 * broad document center (R-816 STOP): the flat list + a name/type search + an owner-category filter
 * over the seven Phase A categories only; NO deferred-module grouping, NO cross-module analytics.
 * Since 2026-07-14 (owner decision — list-page create entry points) it ALSO fetches the owner
 * option lists (customers / calculations / jobs) for the island's "Ladda upp fil" affordance
 * (the upload reuses `uploadFileAction` verbatim; the owner stays required — no orphan file).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is the auth
 * boundary). This page adds NO auth mechanism and NO new nav item — "Filer" already exists in the
 * seven-item shell nav (frozen — nav-items.ts is NOT touched).
 */
import { FileIndexList } from "@/components/files/FileIndexList";
import { readFileIndex } from "@/features/files/read";
import { readCustomerList } from "@/features/crm/read";
import { readCalculationList } from "@/features/calculations/read";
import { readJobList } from "@/features/jobs/read";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  // The index + the owner option lists for the upload affordance — all RLS reads.
  const [
    { rows, error },
    { rows: customers, error: customerError },
    { rows: calculations, error: calcError },
    { rows: jobs, error: jobError },
  ] = await Promise.all([
    readFileIndex(),
    readCustomerList(),
    readCalculationList(),
    readJobList(),
  ]);
  const uploadOwnerOptions = {
    customer: customers.map((c) => ({ id: c.id, label: c.display_name })),
    calculation: calculations.map((c) => ({
      id: c.id,
      label: c.customer_display_name
        ? `${c.title} — ${c.customer_display_name}`
        : c.title,
    })),
    // An untitled job falls back to customer name + a short id suffix so multiple untitled
    // jobs stay distinguishable in the picker (never a row of identical "Jobb" entries).
    job: jobs.map((j) => ({
      id: j.id,
      label:
        j.title ??
        `${j.customerDisplayName ?? "Jobb"} (${j.id.slice(0, 8)})`,
    })),
  };
  return (
    <FileIndexList
      rows={rows}
      loadError={error}
      uploadOwnerOptions={uploadOwnerOptions}
      // A FAILED owner-options read must not masquerade as "nothing to link to" (the upload
      // form shows a neutral retry message and keeps submit disabled).
      uploadOptionsLoadError={
        customerError !== null || calcError !== null || jobError !== null
      }
    />
  );
}
