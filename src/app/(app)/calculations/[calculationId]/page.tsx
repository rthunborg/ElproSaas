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
import { EntityFilePanel } from "@/components/files/EntityFilePanel";
import { readCalculationDetail } from "@/features/calculations/read";
import { readEntityFiles } from "@/features/files/read";
import { readArticles, readWorkRoles } from "@/features/pricing/read";
import {
  readCompanySettings,
  readQuoteTerms,
} from "@/features/settings/read";
import { toSourceOptions } from "@/features/calculations/source-options";
import { DEFAULT_TENANT_VAT_DISPLAY } from "@/features/calculations/vat-posture";
import { buildQuoteReviewDigest } from "@/server/commands/quotes/review-token";
import { stockholmBusinessDate } from "@/lib/datetime/business-date";

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

  // Story 8.2 — the calc's own-tenant attachments for the entity file panel (RLS-scoped).
  const filesRead = await readEntityFiles({
    ownerType: "calculation",
    ownerId: calculationId,
  });

  // The reviewed token covers every semantic source that can enter the fresh
  // customer-visible quote. Confirmation re-reads the same sources and rejects
  // when any child/customer/settings/tax fact changed after this render.
  const previewQuoteCaptureDate = stockholmBusinessDate(new Date());
  const reviewedSnapshotDigest = buildQuoteReviewDigest({
    quoteCaptureDate: previewQuoteCaptureDate,
    calculation: {
      id: detail.header.id,
      status: detail.header.status,
      customerId: detail.header.customer_id,
      facilityId: detail.header.facility_id,
      contactId: detail.header.contact_id,
      taxInput: detail.header.tax_input_snapshot,
    },
    sections: detail.sections.map((section) => ({
      id: section.id,
      title: section.title,
      displayMode: section.display_mode,
      sortOrder: section.sort_order,
    })),
    rows: detail.sections.flatMap((section) => section.rows.map((row) => ({
      id: row.id,
      sectionId: row.section_id,
      rowType: row.row_type,
      quantity: row.quantity,
      unit: row.unit,
      unitSellOre: row.unit_sell_ore,
      vatRateBp: row.vat_rate_bp,
      includedInInvoiceTotal: row.included_in_invoice_total,
      deductionClassification: row.deduction_classification,
      vatType: row.vat_type,
      isHidden: row.is_hidden,
      isOptional: row.is_optional,
      isSelected: row.is_selected,
      label: row.label,
      description: row.description,
      quoteNote: row.quote_note,
      sortOrder: row.sort_order,
    }))),
    customer: {
      displayName: detail.customer.customer_display_name,
      customerType: detail.customer.customer_type,
      facilityName: detail.customer.facility_name,
      contactName: detail.customer.contact_name,
    },
    company: settingsRes.settings === null ? null : {
      companyName: settingsRes.settings.company_name,
      orgNr: settingsRes.settings.org_nr,
      addressLine1: settingsRes.settings.address_line1,
      addressLine2: settingsRes.settings.address_line2,
      postalCode: settingsRes.settings.postal_code,
      city: settingsRes.settings.city,
      email: settingsRes.settings.email,
      phone: settingsRes.settings.phone,
      logoUrl: settingsRes.settings.logo_url,
      defaultVatDisplay: settingsRes.settings.default_vat_display,
      vatRateBp: settingsRes.settings.vat_rate_bp,
    },
    terms: termsRes.terms === null ? null : {
      text: termsRes.terms.terms_text,
      approvedAt: termsRes.terms.approved_at,
      approvedBy: termsRes.terms.approved_by,
    },
    attachments: [],
  });

  return (
    <CalculationEditor
      detail={detail}
      sources={sources}
      defaultVatDisplay={defaultVatDisplay}
      vatPostureResolved={vatPostureResolved}
      quoteTerms={quoteTerms}
      previewQuoteCaptureDate={previewQuoteCaptureDate}
      reviewedSnapshotDigest={reviewedSnapshotDigest}
      filesPanel={
        <EntityFilePanel
          ownerType="calculation"
          ownerId={calculationId}
          purpose="calculation_attachment"
          ownerLabel={detail.header.title}
          files={filesRead.files}
          readError={filesRead.error}
        />
      }
    />
  );
}
