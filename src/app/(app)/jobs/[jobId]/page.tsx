/**
 * `/jobs/[jobId]` (Jobb/Order-detalj) — the job/order detail read UX (Story 7.3, Task 3).
 *
 * A SERVER component: it server-fetches the job detail (the `jobs` row + the immutable
 * `quote_acceptances`/`quote_versions` refs + linked files + events) by id via the per-request RLS
 * client (anon key — NEVER service-role). A foreign/other-tenant id is invisible under RLS → zero
 * rows → `notFound()` (a GENERIC not-found that NEVER reveals whether the job exists in another
 * tenant). A read error renders the generic failed state. Every money value + frozen commitment name
 * is DISPLAYED from the immutable reference — no recompute (R-708).
 *
 * `force-dynamic` because the route reads per-request auth/data; the `(app)` layout is the auth
 * boundary (this page adds no auth mechanism). This is the deep-link target the accepted quote
 * version points at (AC5 idempotency mirror).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobDetailView } from "@/components/jobs/JobDetailView";
import { readJobDetailForPage } from "@/features/jobs/read";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { detail, error } = await readJobDetailForPage(jobId);

  if (error) {
    return (
      <section className="mx-auto max-w-3xl">
        <div
          role="alert"
          data-testid="job-detail-failed"
          className="rounded-lg border border-red-300 bg-red-50 p-6"
        >
          <p className="text-sm font-medium text-red-800">
            Jobbet kunde inte läsas in.
          </p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <Link
            href="/jobs"
            className="mt-4 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Tillbaka till jobb
          </Link>
        </div>
      </section>
    );
  }

  if (!detail) {
    // Invisible under RLS (or genuinely absent) → GENERIC not-found, no leakage.
    notFound();
  }

  return <JobDetailView detail={detail} />;
}
