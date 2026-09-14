/**
 * Quote/file fixtures that are unrelated to the baseline user-management setup.
 * Keeping them isolated makes the global setup facade easier to audit and keeps
 * each support file below the test registry ceiling.
 */
import {
  adminInsertFile,
  adminInsertFileLink,
  adminInsertLostQuoteVersionWithReason,
  adminInsertQuote,
  adminInsertQuoteEvent,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionLine,
  adminUploadStorageObject,
  type TestServerClient,
  type TwoTenantFixture,
} from "../factories/tenants";
import { adminQuery } from "../factories/admin-sql";

export type QuoteFileFixtureSeeds = {
  readonly pipelineLostQuoteId: string;
  readonly pipelineLostVersionId: string;
  readonly sentLockQuoteId: string;
  readonly sentLockVersionId: string;
  readonly sentPdfFileId: string;
  readonly evidenceQuoteId: string;
  readonly evidenceVersionId: string;
  readonly evidenceFileId: string;
  readonly evidenceAcceptanceId: string | null;
  readonly pdfQuoteId: string;
  readonly notGeneratedVersionId: string;
  readonly generatedVersionId: string;
  readonly failedVersionId: string;
};

export async function seedQuoteFileFixtures({
  base,
  adminAClient,
  companyId,
  facilityId,
  calcId,
  companyName,
  token,
}: {
  readonly base: TwoTenantFixture;
  readonly adminAClient: TestServerClient;
  readonly companyId: string;
  readonly facilityId: string;
  readonly calcId: string;
  readonly companyName: string;
  readonly token: () => string;
}): Promise<QuoteFileFixtureSeeds> {  // Story 10.4 — a DEDICATED already-LOST quote (latest version status='lost' + a Förlorad reason), so
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
    // The quote-specific signed-access binding requires the generated artifact marker in
    // addition to the current version/file/link/object identity proof.
    artifact_kind: "quote_pdf",
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

  return {
    pipelineLostQuoteId,
    pipelineLostVersionId,
    sentLockQuoteId,
    sentLockVersionId,
    sentPdfFileId,
    evidenceQuoteId,
    evidenceVersionId,
    evidenceFileId,
    evidenceAcceptanceId,
    pdfQuoteId,
    notGeneratedVersionId,
    generatedVersionId,
    failedVersionId,
  };
}
