/**
 * Playwright globalSetup — seed a two-tenant fixture + CRM rows for the E2E journeys.
 *
 * Reuses the existing local-stack factories (loopback-gated via `assertLocalStack`).
 * Writes the seeded credentials + the seeded CRM customer ids to
 * `tests/e2e/.auth/fixture.json` (gitignored) so the specs can sign in as real users
 * and assert on a populated list / detail. The full fixture is serialized so
 * `globalTeardown` can remove it (the CRM rows cascade with the tenant delete).
 *
 * adminA → active `tenant_admin` membership in tenantA (the happy path / G-2).
 * orphanUser → NO membership (the no-access path / AC2).
 *
 * CRM seed (Story 3.2): one COMPANY customer (org_nr) and one PRIVATE customer (with a
 * personnummer) in tenantA, so the CRM specs can assert: the list renders, search
 * narrows it, the private customer's personnummer is NEVER in the list payload, and the
 * detail shows it masked. A facility + contact are seeded under the company customer so
 * the detail sub-sections are populated.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  adminInsertArticle,
  adminInsertCalculation,
  adminInsertContact,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertFile,
  adminInsertFileLink,
  adminInsertQuote,
  adminInsertQuoteEvent,
  adminInsertQuoteFollowUp,
  adminInsertLostQuoteVersionWithReason,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionLine,
  adminInsertRow,
  adminInsertSection,
  adminInsertWorkRole,
  adminUploadStorageObject,
  createTwoTenantFixture,
  makeAuthedServerClient,
} from "../factories/tenants";
import { adminQuery } from "../factories/admin-sql";

export const FIXTURE_FILE = path.join(
  process.cwd(),
  "tests",
  "e2e",
  ".auth",
  "fixture.json",
);

/** A unique, recognizable token so specs can search/assert without ambiguity. */
function token(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Complete no-deduction V2 input used by quote-capable E2E calculations. */
function noDeductionTaxInput(
  documentVatType: "STANDARD_VAT_25" | "REVERSE_CHARGE_CONSTRUCTION" = "STANDARD_VAT_25",
  buyerVatNumber: string | null = null,
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: 2,
    documentVatType,
    buyerVatNumber,
    deductionChoice: "NONE",
    paymentDate: null,
    finalPaymentDate: null,
    personAllowanceSlots: [],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
    fixedPriceRowIds: null,
  };
}

export default async function globalSetup() {
  const base = await createTwoTenantFixture();
  const adminAClient = await makeAuthedServerClient(base.adminA);

  // Seed CRM rows in tenantA via the privileged (BYPASSRLS) factory path. These are
  // read back through the app's RLS path at runtime as adminA.
  const companyName = `Acme El AB ${token()}`;
  const companyOrgNr = "556677-8899";
  const privateName = `Anna Privat ${token()}`;
  const privatePnr = "199001011234"; // MUST NOT appear in the list payload (P0).

  const companyId = await adminInsertCustomer({
    tenant_id: base.tenantA.id,
    customer_type: "company",
    display_name: companyName,
    org_nr: companyOrgNr,
  });
  const privateId = await adminInsertCustomer({
    tenant_id: base.tenantA.id,
    customer_type: "private",
    display_name: privateName,
    personnummer: privatePnr,
  });
  const facilityId = await adminInsertFacility({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    name: `Huvudkontor ${token()}`,
  });
  await adminInsertContact({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
    name: `Erik Kontakt ${token()}`,
  });

  // Story 8.3: seed ONE own-tenant file linked to the COMPANY customer (owner_type='customer',
  // purpose='crm_document' — matching the customer detail page's primary EntityFilePanel) with a
  // REAL storage object at its server-derived path, so the panel lists a file and clicking its
  // preview affordance mints a SIGNED URL through the 8.1 funnel (8.3-E2E-02). `crypto.randomUUID`
  // (not Date.now) for uniqueness — the epic-3 flake lesson.
  const crmFileId = crypto.randomUUID();
  const crmFileName = `Kunddokument ${token()}.pdf`;
  const crmObjectPath = `${base.tenantA.id}/${crmFileId}/${crmFileName}`;
  // A tiny real PDF object so createSignedUrl can sign a reachable key (minimal %PDF header).
  await adminUploadStorageObject({
    bucket: "tenant-files",
    objectPath: crmObjectPath,
    body: new TextEncoder().encode("%PDF-1.7\n%crm-stub\n"),
  });
  await adminInsertFile({
    tenant_id: base.tenantA.id,
    id: crmFileId,
    display_name: crmFileName,
    bucket_id: "tenant-files",
    object_path: crmObjectPath,
    mime_type: "application/pdf",
    lifecycle_state: "linked",
  });
  await adminInsertFileLink({
    tenant_id: base.tenantA.id,
    file_id: crmFileId,
    owner_type: "customer",
    owner_id: companyId,
    purpose: "crm_document",
  });

  // Calc seed (Story 5.2): a calculation under the company customer, with ONE section that
  // has TWO rows, so the editor E2E can open a pre-existing calc (rather than clicking the
  // whole create flow) and assert the totals summary + destructive-confirm behaviour. Each
  // count-asserting spec seeds its OWN uniquely-named calc; this baseline calc is for the
  // open/render/totals journeys. A distinct calc title token lets a spec find it.
  const calcTitle = `Kalkyl E2E ${token()}`;
  const calcId = await adminInsertCalculation({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
    title: calcTitle,
    status: "draft",
    // Story 10.6 makes a complete V2 tax input mandatory for fresh quote capture. Keep the
    // long-lived healthy baseline quote-capable without changing its historic money facts.
    tax_input_snapshot: noDeductionTaxInput(),
  });
  const sectionId = await adminInsertSection({
    tenant_id: base.tenantA.id,
    calculation_id: calcId,
    title: `Sektion 1 ${token()}`,
    display_mode: "detailed",
    sort_order: 0,
  });
  // Row 1: 2 × 850,00 kr @ 25% VAT (a labor row). Row 2: 1 × 500,00 kr @ 25% (material).
  const rowAId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: sectionId,
    row_type: "labor",
    quantity: 2,
    unit: "h",
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  const rowBId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: sectionId,
    row_type: "material",
    quantity: 1,
    unit: "st",
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    sort_order: 1,
  });

  // Story 10.6: dedicated, order-independent fixtures. The first calculation carries TWO
  // explicit VAT categories: 1 000,00 kr standard (250,00 kr VAT) + 2 000,00 kr reverse charge
  // (0,00 kr seller VAT) = net 3 000,00, VAT 250,00, gross/payable 3 250,00. The document has
  // explicitly selected reverse charge with the required buyer VAT number. The database rejects
  // incomplete VAT/document postures, while the E2E journey proves the form rejects clearing it.
  const reverseChargeBuyerVatNumber = "SE556677889901";
  const reverseChargeCalcTitle = `Kalkyl omvänd moms ${token()}`;
  const reverseChargeCalcId = await adminInsertCalculation({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
    title: reverseChargeCalcTitle,
    status: "draft",
    tax_input_snapshot: noDeductionTaxInput(
      "REVERSE_CHARGE_CONSTRUCTION",
      reverseChargeBuyerVatNumber,
    ),
  });
  const reverseChargeSectionId = await adminInsertSection({
    tenant_id: base.tenantA.id,
    calculation_id: reverseChargeCalcId,
    title: `Standard och omvänd moms ${token()}`,
    display_mode: "detailed",
    sort_order: 0,
  });
  const reverseChargeStandardRowId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: reverseChargeSectionId,
    row_type: "material",
    quantity: 1,
    unit: "st",
    unit_sell_ore: 100000,
    vat_rate_bp: 2500,
    vat_type: "STANDARD_VAT_25",
    deduction_classification: "NONE",
    included_in_invoice_total: true,
    label: "Standardmomsarbete E2E",
    sort_order: 0,
  });
  const reverseChargeConstructionRowId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: reverseChargeSectionId,
    row_type: "subcontractor",
    quantity: 1,
    unit: "st",
    unit_sell_ore: 200000,
    vat_rate_bp: 2500,
    vat_type: "REVERSE_CHARGE_CONSTRUCTION",
    deduction_classification: "NONE",
    included_in_invoice_total: true,
    label: "Byggtjänst med omvänd moms E2E",
    sort_order: 1,
  });

  // The second calculation pins the three independent row facts. Its subject row is hidden,
  // economically included, and ROT-classified at the same time. A separate 500,00 kr standard
  // row remains included, so toggling ONLY the subject's inclusion moves gross from 1 875,00 kr
  // to 625,00 kr while visibility/classification stay untouched.
  const independentPropertiesCalcTitle = `Kalkyl oberoende radfakta ${token()}`;
  const independentPropertiesCalcId = await adminInsertCalculation({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
    title: independentPropertiesCalcTitle,
    status: "draft",
    tax_input_snapshot: noDeductionTaxInput(),
  });
  const independentPropertiesSectionId = await adminInsertSection({
    tenant_id: base.tenantA.id,
    calculation_id: independentPropertiesCalcId,
    title: `Oberoende radfakta ${token()}`,
    display_mode: "detailed",
    sort_order: 0,
  });
  const independentPropertiesSubjectRowId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: independentPropertiesSectionId,
    row_type: "labor",
    quantity: 1,
    unit: "h",
    unit_sell_ore: 100000,
    vat_rate_bp: 2500,
    vat_type: "STANDARD_VAT_25",
    deduction_classification: "ROT_LABOR",
    included_in_invoice_total: true,
    is_hidden: true,
    label: "Dold men inkluderad ROT-rad E2E",
    sort_order: 0,
  });
  const independentPropertiesControlRowId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: independentPropertiesSectionId,
    row_type: "material",
    quantity: 1,
    unit: "st",
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    vat_type: "STANDARD_VAT_25",
    deduction_classification: "NONE",
    included_in_invoice_total: true,
    is_hidden: false,
    label: "Synlig kontrollrad E2E",
    sort_order: 1,
  });

  // Readiness-blocker seed (Story 5.4): a SEPARATE calc under the company customer whose only
  // row has an OVERFLOWING line total (unit_sell_ore at the öre ceiling × a large quantity), so
  // `computeCalcTotal` returns {ok:false} → the readiness classifier raises the TOTAL_UNCOMPUTABLE
  // BLOCKER → the create-quote affordance is GATED/disabled (5.4-E2E-01). The healthy baseline
  // calc above (valid rows) shows the affordance ENABLED — the two calcs prove both gate states
  // without an in-test mutation. Seeded via the BYPASSRLS raw path (no command validation) so the
  // overflow value persists directly.
  const blockerCalcTitle = `Kalkyl blockerad ${token()}`;
  const blockerCalcId = await adminInsertCalculation({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
    title: blockerCalcTitle,
    status: "draft",
  });
  const blockerSectionId = await adminInsertSection({
    tenant_id: base.tenantA.id,
    calculation_id: blockerCalcId,
    title: `Sektion blockerad ${token()}`,
    display_mode: "detailed",
    sort_order: 0,
  });
  // unit_sell_ore at Number.MAX_SAFE_INTEGER × quantity 1000 → the line net overflows the öre
  // ceiling → an engine {ok:false} total → the TOTAL_UNCOMPUTABLE blocker.
  const blockerRowId = await adminInsertRow({
    tenant_id: base.tenantA.id,
    section_id: blockerSectionId,
    row_type: "material",
    quantity: 1000,
    unit: "st",
    unit_sell_ore: Number.MAX_SAFE_INTEGER,
    vat_rate_bp: 2500,
    sort_order: 0,
  });

  // Pricing-source seed (Story 5.3): ONE active work role (labor source) + ONE active
  // article (material source) in tenantA, so the row-editor source-selection E2E can pick a
  // deterministic source by its display name. Uniquely-named so parallel/repeated runs never
  // collide. Their names are exposed on the fixture for the spec's `selectOption({ label })`.
  // NOTE: use a DISTINCTIVE sell rate (845,00 kr) so the "850,00 kr/tim" the pricing E2E
  // saves for its OWN role never collides with this seeded role in the shared pricing editor
  // (a strict-mode getByText match must resolve to exactly one element).
  const workRoleName = `Elektriker ${token()}`;
  const workRoleId = await adminInsertWorkRole({
    tenant_id: base.tenantA.id,
    display_name: workRoleName,
    cost_rate_ore: 45000,
    sell_rate_ore: 84500,
  });
  const articleName = `Kabel 3G1.5 ${token()}`;
  const articleId = await adminInsertArticle({
    tenant_id: base.tenantA.id,
    name: articleName,
    unit_price_ore: 1250,
  });

  // Quote seed (Story 6.2): a quote under the company customer with TWO versions — a SENT
  // version 1 (read-only branch) + a DRAFT version 2 (editable branch) — so the detail E2E can
  // prove the read-only-vs-editable split, the version timeline, and the draft-edit path against
  // a REAL multi-version quote. The versions carry frozen presentational + total fields. Seeded
  // via the BYPASSRLS raw path (no command validation), read back through the app's RLS path at
  // runtime as adminA.
  const quoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  // Seed the SENT version as a DRAFT first, add its frozen line (the Story 6.4 child-lock trigger
  // only allows child writes while the parent is a draft), THEN flip it to `sent` — a status-only
  // draft→sent UPDATE the sent-lock trigger allows. This produces the same read-only sent fixture
  // without hitting the immutability trigger during the line seed.
  const sentVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: quoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1001,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Skickad version – introtext",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: sentVersionId,
    label: `Elarbete ${token()}`,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  await adminQuery(
    `update public.quote_versions set status = 'sent' where id = $1`,
    [sentVersionId],
  );
  const draftVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: quoteId,
    calculation_id: calcId,
    version_number: 2,
    quote_number: 1001,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Utkast – introtext",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: draftVersionId,
    label: `Materialrad ${token()}`,
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: quoteId,
    quote_version_id: sentVersionId,
    event_type: "created",
  });

  // Story 6.4: a SEPARATE quote with a single mark-SENDABLE draft that the mark-sent FLIP E2E
  // consumes on its own — clicking "Markera som skickad" PERMANENTLY sends it, so it lives on its
  // OWN quote (never touching the 6.2 quote above, which stays EXACTLY two versions for the 6.2
  // timeline-count spec). Its frozen warnings_snapshot carries NO blocker, so the send gate passes.
  const markSendQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const markSendableVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: markSendQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1003,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Utkast att skicka – introtext",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: markSendableVersionId,
    label: `Skickbar rad ${token()}`,
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });

  // Story 6.5: a DEDICATED quote whose ONLY version is a SENT v1, consumed by the "create a new
  // version" flow E2E (creating a v2 permanently) so it does NOT mutate the shared 6.2/6.4 quote
  // the read-only-messaging + timeline tests rely on. Seeded draft → child → flip-to-sent per the
  // 6.4 child-lock. Its source calc is the baseline calc (so the fresh re-capture succeeds).
  const newVersionQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const newVersionSentVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: newVersionQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1004,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Skickad version för ny-version-flödet",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: newVersionSentVersionId,
    label: `Ny-version-rad ${token()}`,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  await adminQuery(
    `update public.quote_versions set status = 'sent' where id = $1`,
    [newVersionSentVersionId],
  );
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: newVersionQuoteId,
    quote_version_id: newVersionSentVersionId,
    event_type: "created",
  });

  // Story 7.2: a DEDICATED quote whose ONLY version is a SENT v1, consumed by the accept-and-
  // create-job FLOW E2E (confirming acceptance PERMANENTLY flips it to `accepted` + creates a job),
  // so it does NOT mutate the shared 6.2/7.1 quote the acceptance-FORM tests rely on (those need the
  // version to stay `sent`). Seeded draft → child → flip-to-sent per the 6.4 child-lock, carrying a
  // NON-ZERO frozen `accepted_price_ore` (the source sent total the adjusted-price gate measures).
  const acceptQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const acceptSentVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: acceptQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1005,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Skickad version för accept-och-skapa-jobb-flödet",
    accepted_price_ore: 125000,
  });
  await adminQuery(
    `update public.quote_versions set status = 'sent' where id = $1`,
    [acceptSentVersionId],
  );
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: acceptQuoteId,
    quote_version_id: acceptSentVersionId,
    event_type: "created",
  });

  // Story 7.3: a DEDICATED already-ACCEPTED quote whose sent version has ALREADY been driven through
  // the REAL `accept_quote_and_create_job` transaction at seed time — producing an authentic
  // acceptance + ONE job. The 7.3 detail/list/deep-link E2E consume this fixture's KNOWN `jobId`
  // (the traceability detail + the accepted-version deep link). Kept OFF the 7.2 `acceptQuote` quote
  // (which the 7.2 flow accepts at runtime) so 7.3 does not depend on 7.2's serial ordering. Seeded
  // draft → child → flip-to-sent per the 6.4 child-lock, carrying a NON-ZERO frozen
  // `accepted_price_ore` (the source sent total the job detail displays).
  const acceptedJobQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const acceptedJobVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: acceptedJobQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1006,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Accepterad version för jobb-traceability-flödet (7.3)",
    accepted_price_ore: 125000,
  });
  await adminQuery(
    `update public.quote_versions set status = 'sent' where id = $1`,
    [acceptedJobVersionId],
  );
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: acceptedJobQuoteId,
    quote_version_id: acceptedJobVersionId,
    event_type: "created",
  });
  // Drive the REAL attributable 7.2/10.8 transaction through an authenticated tenant-admin
  // session. The RPC records the acceptance, flips sent → accepted, creates the ONE job, and
  // atomically records actor/correlation provenance. `p_accepted_at` is an EXPLICIT instant (H1).
  const acceptRpc = await adminAClient.rpc("accept_quote_and_create_job", {
    p_tenant_id: base.tenantA.id,
    p_quote_version_id: acceptedJobVersionId,
    p_accepted_at: "2026-07-10T08:30:00.000Z",
    p_accepted_price_ore: 125000,
    p_source_sent_total_ore: 125000,
    p_channel: "verbal",
    p_adjustment_reason: null,
    p_evidence_file_id: null,
    p_evidence_reference: "Signerad orderbekräftelse (referens #A-7003)",
    p_notes: "Accepterat via telefon 2026-07-10",
    p_planned_start_date: "2026-08-01",
    p_planned_end_date: "2026-08-20",
    p_title: "Jobb från accepterad offert 1006",
    p_fault_inject: null,
    p_actor_user_id: base.adminA.id,
    p_correlation_id: crypto.randomUUID(),
  });
  if (acceptRpc.error) {
    throw new Error(`globalSetup: accepted-job RPC failed (${acceptRpc.error.code ?? "?"})`);
  }
  const acceptRpcRows = (acceptRpc.data ?? []) as Array<{
    acceptance_id: string;
    job_id: string;
  }>;
  const acceptedJobId = acceptRpcRows[0]?.job_id ?? null;

  // Story 10.2 — a DEDICATED quote whose ONLY version is a SENT v1, consumed by the Förlorad/Avböjd
  // dialog E2E (confirming the flip PERMANENTLY marks it lost), kept OFF the shared 6.2/7.1 quotes
  // (whose sent version other tests need to stay `sent`). Seeded draft → child → flip-to-sent per the
  // 6.4 child-lock. The mark-lost affordance appears on this SENT version alongside the accept form.
  const markLostQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const markLostSentVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: markLostQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1009,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Skickad version för förlorad/avböjd-flödet (10.2)",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: markLostSentVersionId,
    label: `Förlorad-rad ${token()}`,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  await adminQuery(
    `update public.quote_versions set status = 'sent' where id = $1`,
    [markLostSentVersionId],
  );
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: markLostQuoteId,
    quote_version_id: markLostSentVersionId,
    event_type: "created",
  });

  // Story 10.3 — three DEDICATED sent quotes for the follow-up E2E, each on its own quote so the
  // tests are order-independent (the one-open-per-quote rule + the completion mutation would otherwise
  // couple them). Seeded draft -> child -> flip-to-sent per the 6.4 child-lock. Follow-up notes are
  // anonymized shape-only (no PII).
  //   (a) planFollowUpQuote — sent v1 with NO follow-up → the "Planera uppföljning" plan flow.
  //   (b) overdueFollowUpQuote — sent v1 + an OVERDUE OPEN follow-up (past due date) → the overdue chip
  //       + the list overdue badge/filters. Never completed by any test (read-only).
  //   (c) completeFollowUpQuote — sent v1 + an OPEN follow-up → the "Klarmarkera" completion flow + jumps.
  async function seedSentFollowUpQuote(
    quoteNumber: number,
    intro: string,
  ): Promise<{ quoteId: string; sentVersionId: string }> {
    const quoteId = await adminInsertQuote({
      tenant_id: base.tenantA.id,
      customer_id: companyId,
      facility_id: facilityId,
    });
    const sentVersionId = await adminInsertQuoteVersion({
      tenant_id: base.tenantA.id,
      quote_id: quoteId,
      calculation_id: calcId,
      version_number: 1,
      quote_number: quoteNumber,
      status: "draft",
      company_name: `Elpro Demo AB ${token()}`,
      customer_display_name: companyName,
      intro_text: intro,
    });
    await adminInsertQuoteVersionLine({
      tenant_id: base.tenantA.id,
      quote_version_id: sentVersionId,
      label: `Uppföljningsrad ${token()}`,
      unit_sell_ore: 85000,
      vat_rate_bp: 2500,
      sort_order: 0,
    });
    await adminQuery(
      `update public.quote_versions set status = 'sent' where id = $1`,
      [sentVersionId],
    );
    await adminInsertQuoteEvent({
      tenant_id: base.tenantA.id,
      quote_id: quoteId,
      quote_version_id: sentVersionId,
      event_type: "created",
    });
    return { quoteId, sentVersionId };
  }

  const planFollowUp = await seedSentFollowUpQuote(
    1010,
    "Skickad version för planera-uppföljning-flödet (10.3)",
  );
  const overdueFollowUp = await seedSentFollowUpQuote(
    1011,
    "Skickad version med försenad uppföljning (10.3)",
  );
  // An OVERDUE OPEN follow-up (a fixed PAST due date, so it is overdue at every future run).
  const overdueFollowUpId = await adminInsertQuoteFollowUp({
    tenant_id: base.tenantA.id,
    quote_id: overdueFollowUp.quoteId,
    quote_version_id: overdueFollowUp.sentVersionId,
    due_date: "2026-07-01",
    note: "ring kund om beslut",
    status: "open",
  });
  const completeFollowUp = await seedSentFollowUpQuote(
    1012,
    "Skickad version för klarmarkera-flödet (10.3)",
  );
  // An OPEN follow-up to complete (a fixed future due date — not overdue; the test completes it).
  const completeFollowUpId = await adminInsertQuoteFollowUp({
    tenant_id: base.tenantA.id,
    quote_id: completeFollowUp.quoteId,
    quote_version_id: completeFollowUp.sentVersionId,
    due_date: "2026-12-01",
    note: "boka uppföljningssamtal",
    status: "open",
  });

  // Story 10.4 — a DEDICATED already-LOST quote (latest version status='lost' + a Förlorad reason), so
  // the pipeline render-consistency E2E (10.4-E2E-01) has a DETERMINISTIC lost row in the list
  // (Förlorad/Avböjd filter → quote-list-lost-row + the Förlustorsak column) independent of the 10.2
  // runtime mark-lost flip's ordering. Seeded directly at status='lost' (BYPASSRLS) TOGETHER WITH its
  // reason row in ONE statement/transaction (the writable-CTE factory helper): the 10.2 coherence
  // trigger `enforce_lost_version_has_reason` is DEFERRABLE INITIALLY DEFERRED and checks at COMMIT, so
  // a two-statement seed would commit the lost version ALONE and be rejected (QV422). Its
  // overdue-follow-up counterpart is the existing 10.3 overdueFollowUpQuote (chip + list overdue badge).
  const pipelineLostQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const { quoteVersionId: pipelineLostVersionId } =
    await adminInsertLostQuoteVersionWithReason({
      tenant_id: base.tenantA.id,
      quote_id: pipelineLostQuoteId,
      calculation_id: calcId,
      version_number: 1,
      quote_number: 1013,
      company_name: `Elpro Demo AB ${token()}`,
      customer_display_name: companyName,
      intro_text: "Förlorad version för pipeline-render-konsistens (10.4)",
      outcome: "forlorad",
      category: "pris",
      note: null,
    });
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: pipelineLostQuoteId,
    quote_version_id: pipelineLostVersionId,
    event_type: "lost",
  });

  // Story 8.5 — a DEDICATED SENT quote whose ONLY version is a SENT v1 carrying a LOCKED quote_pdf
  // file, so the 8.4/8.5 file-lock-panel E2E can assert the sent-quote lock notice + archive-only
  // affordance on the quote detail's default (latest = sent) version. Seed the PDF file (draft) +
  // its quote_pdf link WHILE the version is still draft (the 6.4 child-lock only allows child writes
  // on a draft parent), THEN flip the version to sent — the parent-transition trigger
  // `quote_versions_apply_file_lock` locks the PDF link + file BY CONSTRUCTION. `crypto.randomUUID`
  // (never Date.now) for uniqueness — the epic-3 flake lesson.
  const sentLockQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const sentLockVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: sentLockQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1007,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Skickad version med låst PDF (8.5 file-lock-panel)",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: sentLockVersionId,
    label: `Låst-PDF-rad ${token()}`,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  const sentPdfFileId = crypto.randomUUID();
  const sentPdfObjectPath = `${base.tenantA.id}/${sentPdfFileId}/offert-1007.pdf`;
  await adminUploadStorageObject({
    bucket: "tenant-files",
    objectPath: sentPdfObjectPath,
    body: new TextEncoder().encode("%PDF-1.7\n%sent-lock-stub\n"),
  });
  await adminInsertFile({
    tenant_id: base.tenantA.id,
    id: sentPdfFileId,
    display_name: "offert-1007.pdf",
    bucket_id: "tenant-files",
    object_path: sentPdfObjectPath,
    mime_type: "application/pdf",
    lifecycle_state: "linked",
  });
  await adminInsertFileLink({
    tenant_id: base.tenantA.id,
    file_id: sentPdfFileId,
    owner_type: "quote_version",
    owner_id: sentLockVersionId,
    purpose: "quote_pdf",
  });
  // Flip the version to sent — this fires quote_versions_apply_file_lock, locking the PDF link+file.
  await adminQuery(
    `update public.quote_versions set status = 'sent' where id = $1`,
    [sentLockVersionId],
  );
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: sentLockQuoteId,
    quote_version_id: sentLockVersionId,
    event_type: "created",
  });

  // Story 8.5 — a DEDICATED ACCEPTED quote whose acceptance carries a LOCKED acceptance_evidence
  // file, so the file-lock-panel E2E can assert the evidence lock notice on the accepted section.
  // Seed a sent version and its evidence file, then drive the REAL accept transaction with that
  // exact file captured immutably. The RPC creates the acceptance_evidence link atomically;
  // `apply_file_link_lock` locks the link+file immediately (AR704 has no draft state).
  const evidenceQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const evidenceVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: evidenceQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1008,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    intro_text: "Accepterad version med låst underlag (8.5 file-lock-panel)",
    accepted_price_ore: 125000,
  });
  await adminQuery(
    `update public.quote_versions set status = 'sent' where id = $1`,
    [evidenceVersionId],
  );
  await adminInsertQuoteEvent({
    tenant_id: base.tenantA.id,
    quote_id: evidenceQuoteId,
    quote_version_id: evidenceVersionId,
    event_type: "created",
  });
  const evidenceFileId = crypto.randomUUID();
  const evidenceObjectPath = `${base.tenantA.id}/${evidenceFileId}/underlag-1008.pdf`;
  await adminUploadStorageObject({
    bucket: "tenant-files",
    objectPath: evidenceObjectPath,
    body: new TextEncoder().encode("%PDF-1.7\n%evidence-lock-stub\n"),
  });
  await adminInsertFile({
    tenant_id: base.tenantA.id,
    id: evidenceFileId,
    display_name: "underlag-1008.pdf",
    bucket_id: "tenant-files",
    object_path: evidenceObjectPath,
    mime_type: "application/pdf",
    lifecycle_state: "linked",
  });
  const evidenceAcceptRpc = await adminAClient.rpc("accept_quote_and_create_job", {
    p_tenant_id: base.tenantA.id,
    p_quote_version_id: evidenceVersionId,
    p_accepted_at: "2026-07-11T08:30:00.000Z",
    p_accepted_price_ore: 125000,
    p_source_sent_total_ore: 125000,
    p_channel: "verbal",
    p_adjustment_reason: null,
    p_evidence_file_id: evidenceFileId,
    p_evidence_reference: null,
    p_notes: "Accepterat via telefon 2026-07-11",
    p_planned_start_date: "2026-08-01",
    p_planned_end_date: "2026-08-20",
    p_title: "Jobb från accepterad offert 1008",
    p_fault_inject: null,
    p_actor_user_id: base.adminA.id,
    p_correlation_id: crypto.randomUUID(),
  });
  if (evidenceAcceptRpc.error) {
    throw new Error(
      `globalSetup: evidence-acceptance RPC failed (${evidenceAcceptRpc.error.code ?? "?"})`,
    );
  }
  const evidenceAcceptRpcRows = (evidenceAcceptRpc.data ?? []) as Array<{
    acceptance_id: string;
    job_id: string;
  }>;
  const evidenceAcceptanceId = evidenceAcceptRpcRows[0]?.acceptance_id ?? null;

  // PDF render-state seed (Story 6.3): a SEPARATE quote (so the 6.2 quote above keeps EXACTLY
  // two versions) with THREE versions exercising the render states DETERMINISTICALLY without a
  // real generation:
  //   - a `not_generated` version (v1, the default) → the Generate-PDF action;
  //   - a `generated` version (v2) with a STUB PDF file + link + a stored storage object → the
  //     preview/download (signed-access) affordances;
  //   - a `failed` version (v3) → the retry affordance.
  const pdfQuoteId = await adminInsertQuote({
    tenant_id: base.tenantA.id,
    customer_id: companyId,
    facility_id: facilityId,
  });
  const notGeneratedVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: pdfQuoteId,
    calculation_id: calcId,
    version_number: 1,
    quote_number: 1002,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    pdf_status: "not_generated",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: notGeneratedVersionId,
    label: `Ogenererad rad ${token()}`,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });

  const pdfFileId = crypto.randomUUID();
  const pdfObjectPath = `${base.tenantA.id}/${pdfFileId}/offert-1002.pdf`;
  // A tiny real PDF object so createSignedUrl can sign a reachable key (minimal %PDF header).
  await adminUploadStorageObject({
    bucket: "tenant-files",
    objectPath: pdfObjectPath,
    body: new TextEncoder().encode("%PDF-1.7\n%stub\n"),
  });
  // The stub `files` row with the KNOWN id so pdf_file_id can reference it (id-in-path parity).
  await adminInsertFile({
    tenant_id: base.tenantA.id,
    id: pdfFileId,
    display_name: "offert-1002.pdf",
    bucket_id: "tenant-files",
    object_path: pdfObjectPath,
    mime_type: "application/pdf",
    lifecycle_state: "linked",
  });
  const generatedVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: pdfQuoteId,
    calculation_id: calcId,
    version_number: 2,
    quote_number: 1002,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    pdf_status: "generated",
    pdf_file_id: pdfFileId,
    pdf_generated_at: "2026-07-05T12:00:00.000Z",
  });
  // The `quote_pdf` file_link (owner = the generated version).
  await adminInsertFileLink({
    tenant_id: base.tenantA.id,
    file_id: pdfFileId,
    owner_type: "quote_version",
    owner_id: generatedVersionId,
    purpose: "quote_pdf",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: generatedVersionId,
    label: `Genererad rad ${token()}`,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  const failedVersionId = await adminInsertQuoteVersion({
    tenant_id: base.tenantA.id,
    quote_id: pdfQuoteId,
    calculation_id: calcId,
    version_number: 3,
    quote_number: 1002,
    status: "draft",
    company_name: `Elpro Demo AB ${token()}`,
    customer_display_name: companyName,
    pdf_status: "failed",
  });
  await adminInsertQuoteVersionLine({
    tenant_id: base.tenantA.id,
    quote_version_id: failedVersionId,
    label: `Misslyckad rad ${token()}`,
    unit_sell_ore: 50000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });

  // Keep the 6.2 quote the MOST-RECENTLY-UPDATED so the quote list (ordered updated_at desc)
  // still surfaces it as the first row (the 6.2 list→detail spec clicks `.first()`), even though
  // the 6.3 pdfQuote above was seeded later.
  await adminQuery(`update public.quotes set updated_at = now() where id = $1`, [
    quoteId,
  ]);

  const fixture = {
    ...base,
    crm: {
      company: { id: companyId, displayName: companyName, orgNr: companyOrgNr },
      private: { id: privateId, displayName: privateName, personnummer: privatePnr },
      facilityId,
      // Story 8.3 — the own-tenant file linked to the company customer (its preview affordance
      // in the primary EntityFilePanel mints a signed URL).
      fileId: crmFileId,
      fileName: crmFileName,
    },
    calc: {
      id: calcId,
      title: calcTitle,
      customerId: companyId,
      sectionId,
      rowIds: [rowAId, rowBId],
    },
    blockerCalc: {
      id: blockerCalcId,
      title: blockerCalcTitle,
      sectionId: blockerSectionId,
      rowId: blockerRowId,
    },
    // Story 10.6 — the two dedicated tax-answer journeys and their deterministic frozen facts.
    taxAnswer: {
      reverseChargeCalc: {
        id: reverseChargeCalcId,
        title: reverseChargeCalcTitle,
        sectionId: reverseChargeSectionId,
        rowIds: [reverseChargeStandardRowId, reverseChargeConstructionRowId],
        buyerVatNumber: reverseChargeBuyerVatNumber,
        expectedOre: { net: 300000, vat: 25000, gross: 325000 },
      },
      independentPropertiesCalc: {
        id: independentPropertiesCalcId,
        title: independentPropertiesCalcTitle,
        sectionId: independentPropertiesSectionId,
        subjectRowId: independentPropertiesSubjectRowId,
        controlRowId: independentPropertiesControlRowId,
        expectedGrossOre: { bothIncluded: 187500, controlOnly: 62500 },
      },
    },
    workRole: { id: workRoleId, displayName: workRoleName },
    article: { id: articleId, name: articleName },
    quote: {
      id: quoteId,
      sentVersionId,
      draftVersionId,
    },
    // Story 6.4 — a dedicated single-draft quote the mark-sent FLIP E2E sends on its own (kept off
    // the 6.2 quote so its timeline stays exactly two versions).
    markSendQuote: {
      id: markSendQuoteId,
      draftVersionId: markSendableVersionId,
    },
    // Story 6.5 — a dedicated single-SENT-version quote the create-new-version FLOW E2E consumes
    // (creating a v2 permanently), kept off the shared 6.2/6.4 quote.
    newVersionQuote: {
      id: newVersionQuoteId,
      sentVersionId: newVersionSentVersionId,
    },
    // Story 10.2 — a dedicated single-SENT-version quote the Förlorad/Avböjd dialog E2E marks lost
    // (permanently flipping it to `lost`), kept off the shared quotes whose sent version other tests
    // need to stay `sent`.
    markLostQuote: {
      id: markLostQuoteId,
      sentVersionId: markLostSentVersionId,
    },
    // Story 10.4 — a dedicated already-LOST quote (latest version status='lost' + a Förlorad reason)
    // so the pipeline render-consistency E2E has a deterministic lost row + Förlustorsak column cell.
    pipelineLostQuote: {
      id: pipelineLostQuoteId,
      lostVersionId: pipelineLostVersionId,
    },
    // Story 10.3 — three dedicated sent quotes for the follow-up E2E (plan / overdue / complete), each
    // on its own quote so the tests are order-independent.
    followUpQuote: {
      id: planFollowUp.quoteId,
      sentVersionId: planFollowUp.sentVersionId,
    },
    overdueFollowUpQuote: {
      id: overdueFollowUp.quoteId,
      sentVersionId: overdueFollowUp.sentVersionId,
      followUpId: overdueFollowUpId,
    },
    completeFollowUpQuote: {
      id: completeFollowUp.quoteId,
      sentVersionId: completeFollowUp.sentVersionId,
      followUpId: completeFollowUpId,
    },
    // Story 7.2 — a dedicated single-SENT-version quote the accept-and-create-job FLOW E2E consumes
    // (confirming acceptance permanently flips it to `accepted` + creates a job), kept off the
    // shared 6.2/7.1 quote whose sent version the acceptance-FORM tests need to stay `sent`.
    acceptQuote: {
      id: acceptQuoteId,
      sentVersionId: acceptSentVersionId,
    },
    // Story 7.3 — a dedicated ALREADY-accepted quote whose one job was created at seed time via the
    // REAL 7.2 transaction. The 7.3 detail/list/deep-link E2E read this KNOWN jobId (self-contained,
    // no dependence on the 7.2 runtime accept).
    acceptedJob: {
      quoteId: acceptedJobQuoteId,
      sentVersionId: acceptedJobVersionId,
      jobId: acceptedJobId,
    },
    // Story 6.3 — a SEPARATE quote whose versions exercise the PDF render states.
    pdfQuote: {
      id: pdfQuoteId,
      notGeneratedVersionId,
      generatedVersionId,
      failedVersionId,
    },
    // Story 8.5 — a dedicated SENT quote whose latest version carries a LOCKED quote_pdf file (the
    // file-lock-panel E2E asserts the sent-quote lock notice + archive-only affordance).
    sentQuote: {
      quoteId: sentLockQuoteId,
      sentVersionId: sentLockVersionId,
      pdfFileId: sentPdfFileId,
    },
    // Story 8.5 — a dedicated ACCEPTED quote whose acceptance carries a LOCKED acceptance_evidence
    // file (the file-lock-panel E2E asserts the evidence lock notice on the accepted section).
    acceptedAcceptance: {
      quoteId: evidenceQuoteId,
      acceptanceId: evidenceAcceptanceId,
      evidenceFileId,
    },
  };

  mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true });
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixture, null, 2), "utf8");
}
