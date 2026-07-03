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
import { readArticles, readWorkRoles } from "@/features/pricing/read";
import {
  readCompanySettings,
  readQuoteTerms,
} from "@/features/settings/read";
import { toSourceOptions } from "@/features/calculations/source-options";
import { DEFAULT_TENANT_VAT_DISPLAY } from "@/features/calculations/vat-posture";

export const dynamic = "force-dynamic";

export default async function CalculationEditorPage({
  params,
}: {
  params: Promise<{ calculationId: string }>;
}) {
  const { calculationId } = await params;
  // Read the calc detail AND the ACTIVE pricing-source lists (Story 5.3) AND the tenant
  // company-settings (Story 5.4 — the VAT posture) AND the tenant quote-terms (Story 5.4 —
  // the pre-quote preview terms) in parallel — all on the per-request RLS client. REUSE the
  // existing readers (each returns RLS-scoped rows). The settings row is the tenant's OWN
  // single row (own-tenant RLS; no service-role, no new co-admin surface).
  const [{ detail, error }, workRolesRes, articlesRes, settingsRes, termsRes] =
    await Promise.all([
      readCalculationDetail(calculationId),
      readWorkRoles(),
      readArticles(),
      readCompanySettings(),
      readQuoteTerms(),
    ]);

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

  // The ACTIVE source lists offered for a NEW pick. A pricing read error degrades to an
  // EMPTY list (the editor still works with manual rows) — never a hard failure of the calc.
  const sources = toSourceOptions(
    workRolesRes.workRoles,
    articlesRes.articles,
  );

  // Story 5.4 — resolve the tenant VAT posture (the inherited 5.2 Med deferral). A settings
  // read FAULT or an absent row degrades GRACEFULLY: fall back to the conservative togglable
  // default and flag the posture as UNRESOLVED so the readiness classifier surfaces a
  // "VAT posture unresolved" warning (never a hard failure of the whole editor — mirrors the
  // 5.3 graceful-degradation posture for a pricing-read fault). `vatPostureResolved` is true
  // ONLY when the settings row read succeeded with a concrete display mode.
  const settingsOk = settingsRes.error === null;
  const defaultVatDisplay =
    settingsRes.settings?.default_vat_display ?? DEFAULT_TENANT_VAT_DISPLAY;
  const vatPostureResolved = settingsOk && settingsRes.settings !== null;

  // Story 5.4 — the tenant quote-terms for the pre-quote preview (AC2). A read fault or an
  // absent/null-approved row means the terms are NOT approved (the preview shows the
  // not-approved sign-off warning). Enforcement of the send-gate on `approved_at` is Epic 6.
  const quoteTerms =
    termsRes.error === null && termsRes.terms
      ? {
          termsText: termsRes.terms.terms_text,
          approved: termsRes.terms.approved_at !== null,
        }
      : null;

  return (
    <CalculationEditor
      detail={detail}
      sources={sources}
      defaultVatDisplay={defaultVatDisplay}
      vatPostureResolved={vatPostureResolved}
      quoteTerms={quoteTerms}
    />
  );
}
