/**
 * `/settings/pricing` (Prissättning) — work roles + optional minimal articles (Story
 * 3.4, Task 4.1; architecture §4).
 *
 * A SERVER component over the RLS-scoped pricing reads: it reads the tenant's work roles
 * + articles on the per-request cookie-bound RLS client (anon key — NEVER service-role)
 * and hands the values to the client editor islands. A tenant with no rows yet renders
 * empty editors (the first save INSERTs a row via the 3.4 upsert command).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is
 * the auth boundary; only the `build` gate catches a missing one). This page adds NO
 * auth mechanism and NO new nav item — Prissättning lives UNDER the existing
 * Inställningar tree.
 */
import Link from "next/link";
import { WorkRolesEditor } from "@/components/pricing/WorkRolesEditor";
import { ArticlesEditor } from "@/components/pricing/ArticlesEditor";
import {
  readArchivedArticles,
  readArchivedWorkRoles,
  readArticles,
  readWorkRoles,
} from "@/features/pricing/read";

export const dynamic = "force-dynamic";

export default async function PricingSettingsPage() {
  const [
    { workRoles, error: workRolesError },
    { articles, error: articlesError },
    { workRoles: archivedWorkRoles, error: archivedWorkRolesError },
    { articles: archivedArticles, error: archivedArticlesError },
  ] = await Promise.all([
    readWorkRoles(),
    readArticles(),
    readArchivedWorkRoles(),
    readArchivedArticles(),
  ]);

  const error =
    workRolesError ??
    articlesError ??
    archivedWorkRolesError ??
    archivedArticlesError;

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/settings"
          className="text-sm text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          ← Inställningar
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900">Prissättning</h1>
        <p className="text-sm text-zinc-600">
          Arbetsroller och ett minimalt manuellt artikelregister med
          återanvändbara priser. Priser lagras i öre; ingen momsberäkning görs
          här.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <WorkRolesEditor
        workRoles={workRoles}
        archivedWorkRoles={archivedWorkRoles}
      />
      <ArticlesEditor
        articles={articles}
        archivedArticles={archivedArticles}
      />
    </div>
  );
}
