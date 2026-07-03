/**
 * `/calculations/[calculationId]` (Kalkyl) — the calculation editor (Story 5.2, Task 4.1).
 *
 * A SERVER component: it server-fetches the single calculation (header + ordered
 * sections/rows + customer context) by id via the per-request RLS client (anon key — NEVER
 * service-role). A foreign/other-tenant id is invisible under RLS → zero rows → a GENERIC
 * "not found / no access" state that NEVER reveals whether the calc exists in another tenant
 * (mirrors `customers/[customerId]/page.tsx`). A read error renders the generic failed state.
 *
 * `force-dynamic` because the route reads per-request auth/data; the `(app)` layout is the
 * auth boundary (this page adds no auth mechanism).
 */
import Link from "next/link";
import { CalculationEditor } from "@/components/calculations/CalculationEditor";
import { readCalculationDetail } from "@/features/calculations/read";

export const dynamic = "force-dynamic";

export default async function CalculationEditorPage({
  params,
}: {
  params: Promise<{ calculationId: string }>;
}) {
  const { calculationId } = await params;
  const { detail, error } = await readCalculationDetail(calculationId);

  if (error) {
    return (
      <section className="mx-auto max-w-3xl">
        <div
          role="alert"
          data-testid="calculation-detail-failed"
          className="rounded-lg border border-red-300 bg-red-50 p-6"
        >
          <p className="text-sm font-medium text-red-800">
            Kalkylen kunde inte läsas in.
          </p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <Link
            href="/calculations"
            className="mt-4 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Tillbaka till kalkyler
          </Link>
        </div>
      </section>
    );
  }

  if (!detail) {
    // Invisible under RLS (or genuinely absent) → GENERIC not-found, no leakage.
    return (
      <section className="mx-auto max-w-3xl">
        <div
          data-testid="calculation-not-found"
          className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center"
        >
          <p className="text-sm font-medium text-zinc-900">Kalkylen hittades inte</p>
          <p className="mt-1 text-sm text-zinc-600">
            Kalkylen finns inte eller så har du inte åtkomst till den.
          </p>
          <Link
            href="/calculations"
            className="mt-4 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Tillbaka till kalkyler
          </Link>
        </div>
      </section>
    );
  }

  return <CalculationEditor detail={detail} />;
}
