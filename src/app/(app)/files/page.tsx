/**
 * `/files` (Filer) — the LIMITED Phase-A file index (Story 8.5, Task 1.2; architecture §14).
 *
 * A SERVER component over the RLS-scoped index read: it reads the tenant's OWN non-archived files
 * linked to a Phase A owner type on the per-request cookie-bound RLS client (anon key — NEVER
 * service-role) and hands the rows to the client `FileIndexList` island. A LIMITED index — NOT a
 * broad document center (R-816 STOP): the flat list + a name/type search + an owner-category filter
 * over the seven Phase A categories only; NO deferred-module grouping, NO cross-module analytics.
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is the auth
 * boundary). This page adds NO auth mechanism and NO new nav item — "Filer" already exists in the
 * seven-item shell nav (frozen — nav-items.ts is NOT touched).
 */
import { FileIndexList } from "@/components/files/FileIndexList";
import { readFileIndex } from "@/features/files/read";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const { rows, error } = await readFileIndex();
  return <FileIndexList rows={rows} loadError={error} />;
}
