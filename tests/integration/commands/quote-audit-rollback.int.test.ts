/**
 * Story 10.8 — audit failure is a transaction failure, not merely an observability
 * failure. These local-only integration proofs activate the correlation-scoped
 * seed-installed test trigger on audit_events: every covered SECURITY DEFINER wrapper has already made
 * its internal lifecycle writes when record_audit_event reaches the trigger, so the
 * raised exception proves PostgreSQL rolls all of them back together.
 *
 * Activation is control-table DML rather than per-case trigger DDL, so parallel
 * suites cannot deadlock on an audit_events schema lock. The trigger never raises
 * unless the local Supabase stack passed the existing stack gate and a test has
 * inserted its exact random correlation id.
 */
import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertFile,
  adminInsertFileLink,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertRow,
  adminInsertSection,
  adminRemoveStorageObject,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TestServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminExec, adminQuery, closeAdminPool } from "../../factories/admin-sql";
import {
  establishCurrentQuotePdf,
  LOCAL_TEST_QUOTE_PDF_KEY_ID,
  quotePdfCompletionAttestation,
  startQuotePdfRender,
} from "../../support/quote-pdf";
import { buildQuoteReviewProof } from "../../support/quote-review-proof";
import { isLocalStackReachable, isLocalStorageReachable } from "../../support/test-env";
import {
  skipUnlessStack,
  skipUnlessStorage,
  type SkippableTestContext,
} from "../../support/stack-gate";
import type { CommandClock } from "@/server/commands/clock";
import { runCommand } from "@/server/commands/envelope";
import {
  createNewQuoteVersion,
  createQuoteVersionFromCalculation,
  markQuoteVersionSent,
  planQuoteFollowUp,
} from "@/server/commands/quotes";

const FIXED_ISO = "2026-08-31T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };
type RpcResult = { data: unknown; error: { code?: string } | null };

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let clientA: TestServerClient;

/**
 * Run one RPC/command while only its audit event is forced to fail. The test-only
 * seed trigger consults an unexposed correlation control table; cleanup is
 * unconditional so parallel/focused runs cannot contaminate a later case.
 */
async function withForcedAuditFailure<T>(
  correlationId: string,
  run: () => Promise<T>,
): Promise<T> {
  await adminExec(
    `insert into test_support.forced_audit_failures (correlation_id)
     values ($1::uuid) on conflict (correlation_id) do nothing`,
    [correlationId],
  );
  try {
    return await run();
  } finally {
    await adminExec(
      `delete from test_support.forced_audit_failures where correlation_id = $1::uuid`,
      [correlationId],
    );
  }
}

async function seedSource(label: string): Promise<{
  calculationId: string;
  quoteId: string;
  versionId: string;
}> {
  const customerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "company",
    display_name: `${label}-customer`,
  });
  const calculationId = await adminInsertCalculation({
    tenant_id: fixture.tenantA.id,
    customer_id: customerId,
    title: `${label}-calculation`,
  });
  const sectionId = await adminInsertSection({
    tenant_id: fixture.tenantA.id,
    calculation_id: calculationId,
    title: `${label}-section`,
  });
  await adminInsertRow({
    tenant_id: fixture.tenantA.id,
    section_id: sectionId,
    row_type: "labor",
    label: `${label}-labor`,
    quantity: 1,
    unit: "h",
    unit_sell_ore: 10_000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  const quoteId = await adminInsertQuote({
    tenant_id: fixture.tenantA.id,
    customer_id: customerId,
  });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: fixture.tenantA.id,
    quote_id: quoteId,
    calculation_id: calculationId,
    company_name: `${label}-company`,
  });
  return { calculationId, quoteId, versionId };
}

async function quoteState(versionId: string): Promise<{
  status: string;
  quoteEvents: number;
  lostReasons: number;
  acceptances: number;
  jobs: number;
  openFollowUps: number;
  completedFollowUps: number;
}> {
  const rows = await adminQuery<{
    status: string;
    quote_events: string;
    lost_reasons: string;
    acceptances: string;
    jobs: string;
    open_follow_ups: string;
    completed_follow_ups: string;
  }>(
    `select qv.status,
       (select count(*)::text from public.quote_events qe where qe.quote_version_id = qv.id) as quote_events,
       (select count(*)::text from public.quote_lost_reasons qlr where qlr.quote_version_id = qv.id) as lost_reasons,
       (select count(*)::text from public.quote_acceptances qa where qa.quote_version_id = qv.id) as acceptances,
       (select count(*)::text from public.jobs j where j.quote_version_id = qv.id) as jobs,
       (select count(*) filter (where qfu.status = 'open')::text
          from public.quote_follow_ups qfu where qfu.quote_version_id = qv.id) as open_follow_ups,
       (select count(*) filter (where qfu.status = 'completed')::text
          from public.quote_follow_ups qfu where qfu.quote_version_id = qv.id) as completed_follow_ups
       from public.quote_versions qv where qv.id = $1`,
    [versionId],
  );
  const row = rows[0];
  if (!row) throw new Error("quote rollback fixture missing");
  return {
    status: row.status,
    quoteEvents: Number(row.quote_events),
    lostReasons: Number(row.lost_reasons),
    acceptances: Number(row.acceptances),
    jobs: Number(row.jobs),
    openFollowUps: Number(row.open_follow_ups),
    completedFollowUps: Number(row.completed_follow_ups),
  };
}

async function auditCount(correlationId: string): Promise<number> {
  const rows = await adminQuery<{ count: string }>(
    `select count(*)::text as count from public.audit_events where correlation_id = $1`,
    [correlationId],
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Snapshot the rows the PDF lifecycle RPCs mutate before their terminal audit
 * insertion. Keeping this narrow makes every equality assertion a concrete proof
 * of transaction rollback, including an otherwise easy-to-miss file-link archive.
 */
async function quotePdfState(versionId: string, fileIds: readonly string[]): Promise<{
  version: {
    status: string;
    pdfStatus: string;
    pdfFileId: string | null;
    pdfRenderFileId: string | null;
    pdfContentFingerprint: string | null;
    pdfRenderFingerprint: string | null;
  };
  files: Array<{ id: string; lifecycleState: string; archivedAt: string | null }>;
  links: Array<{ id: string; fileId: string; archivedAt: string | null }>;
  quoteEvents: number;
}> {
  const versionRows = await adminQuery<{
    status: string;
    pdf_status: string;
    pdf_file_id: string | null;
    pdf_render_file_id: string | null;
    pdf_content_fingerprint: string | null;
    pdf_render_fingerprint: string | null;
  }>(
    `select status, pdf_status, pdf_file_id, pdf_render_file_id,
            pdf_content_fingerprint, pdf_render_fingerprint
       from public.quote_versions where id = $1`,
    [versionId],
  );
  const version = versionRows[0];
  if (!version) throw new Error("quote PDF rollback fixture missing");
  const files = await adminQuery<{
    id: string;
    lifecycle_state: string;
    archived_at: string | null;
  }>(
    `select id, lifecycle_state, archived_at::text
       from public.files where id = any($1::uuid[]) order by id`,
    [fileIds],
  );
  const links = await adminQuery<{
    id: string;
    file_id: string;
    archived_at: string | null;
  }>(
    `select id, file_id, archived_at::text
       from public.file_links
      where owner_type = 'quote_version' and owner_id = $1
        and file_id = any($2::uuid[])
      order by id`,
    [versionId, fileIds],
  );
  const eventRows = await adminQuery<{ count: string }>(
    `select count(*)::text as count from public.quote_events where quote_version_id = $1`,
    [versionId],
  );
  return {
    version: {
      status: version.status,
      pdfStatus: version.pdf_status,
      pdfFileId: version.pdf_file_id,
      pdfRenderFileId: version.pdf_render_file_id,
      pdfContentFingerprint: version.pdf_content_fingerprint,
      pdfRenderFingerprint: version.pdf_render_fingerprint,
    },
    files: files.map((file) => ({
      id: file.id,
      lifecycleState: file.lifecycle_state,
      archivedAt: file.archived_at,
    })),
    links: links.map((link) => ({
      id: link.id,
      fileId: link.file_id,
      archivedAt: link.archived_at,
    })),
    quoteEvents: Number(eventRows[0]?.count ?? 0),
  };
}

/**
 * Storage does not participate in the database transaction under test. Remove
 * only the exact local fixture object in `finally`, while fixture row cleanup is
 * still handled by the existing tenant cascade.
 */
async function deleteLocalTestStorageObject(objectPath: string): Promise<void> {
  await adminRemoveStorageObject({ bucket: "tenant-files", objectPath });
}

async function stageExpectedPdfObject(expectedFileId: string): Promise<{
  objectPath: string; checksum: string; sizeBytes: number;
}> {
  const bytes = new TextEncoder().encode(`audit-rollback-pdf:${expectedFileId}`);
  const objectPath = `${fixture.tenantA.id}/${expectedFileId}/audit-rollback.pdf`;
  await adminInsertFile({
    id: expectedFileId,
    tenant_id: fixture.tenantA.id,
    object_path: objectPath,
    display_name: "audit-rollback.pdf",
    mime_type: "application/pdf",
    size_bytes: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    artifact_kind: "quote_pdf",
    uploaded_by: fixture.adminA.id,
    lifecycle_state: "draft",
  });
  const upload = await clientA.storage.from("tenant-files").upload(objectPath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) {
    throw new Error(`audit rollback PDF Storage upload failed: ${upload.error.message}`);
  }
  return { objectPath, checksum: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.byteLength };
}

async function tenantEventCounts(): Promise<{ quoteEvents: number; jobEvents: number }> {
  const rows = await adminQuery<{ quote_events: string; job_events: string }>(
    `select
       (select count(*)::text from public.quote_events where tenant_id = $1) as quote_events,
       (select count(*)::text from public.job_events where tenant_id = $1) as job_events`,
    [fixture.tenantA.id],
  );
  return {
    quoteEvents: Number(rows[0]?.quote_events ?? 0),
    jobEvents: Number(rows[0]?.job_events ?? 0),
  };
}

async function authorizationState(correlationId: string): Promise<{
  count: number;
  consumed: number;
}> {
  const rows = await adminQuery<{ count: string; consumed: string }>(
    `select count(*)::text as count,
            count(*) filter (where consumed_at is not null)::text as consumed
       from public.quote_review_authorizations
      where correlation_id = $1`,
    [correlationId],
  );
  return {
    count: Number(rows[0]?.count ?? 0),
    consumed: Number(rows[0]?.consumed ?? 0),
  };
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  storageUp = await isLocalStorageReachable();
  fixture = await createTwoTenantFixture();
  clientA = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
  await closeAdminPool();
});

function skipUnlessStackAndStorage(testCtx: SkippableTestContext): boolean {
  if (skipUnlessStack(testCtx, stackUp)) return true;
  return skipUnlessStorage(testCtx, storageUp);
}

describe("Story 10.8 audit failure rolls back lifecycle transactions", () => {
  it("[P0] initial creation and successor creation leave no quote/version/counter mutation and do not consume their authority", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const initial = await seedSource(`audit-initial-${crypto.randomUUID()}`);
    const initialCorrelationId = crypto.randomUUID();
    const initialProof = await buildQuoteReviewProof(clientA, {
      calculationId: initial.calculationId,
      capturedAt: FIXED_ISO,
    });
    const beforeInitial = await adminQuery<{
      quotes: string;
      versions: string;
      counter: string;
      quote_events: string;
    }>(
      `select
         (select count(*)::text from public.quotes where tenant_id = $1) as quotes,
         (select count(*)::text from public.quote_versions where tenant_id = $1) as versions,
         coalesce((select current_value::text from public.tenant_counters
                    where tenant_id = $1 and counter_name = 'quote_number'), '0') as counter,
         (select count(*)::text from public.quote_events where tenant_id = $1) as quote_events`,
      [fixture.tenantA.id],
    );
    const initialResult = await withForcedAuditFailure(initialCorrelationId, () =>
      runCommand(createQuoteVersionFromCalculation, {
        client: clientA as never,
        input: { calculation_id: initial.calculationId, attachment_file_ids: [], ...initialProof },
        clock: fixedClock,
        correlationId: initialCorrelationId,
      }),
    );
    expect(initialResult.ok).toBe(false);
    if (!initialResult.ok) expect(initialResult.code).toBe("SERVER_ERROR");
    expect(await adminQuery<{
      quotes: string;
      versions: string;
      counter: string;
      quote_events: string;
    }>(
      `select
         (select count(*)::text from public.quotes where tenant_id = $1) as quotes,
         (select count(*)::text from public.quote_versions where tenant_id = $1) as versions,
         coalesce((select current_value::text from public.tenant_counters
                    where tenant_id = $1 and counter_name = 'quote_number'), '0') as counter,
         (select count(*)::text from public.quote_events where tenant_id = $1) as quote_events`,
      [fixture.tenantA.id],
    )).toEqual(beforeInitial);
    expect(await authorizationState(initialCorrelationId)).toEqual({ count: 1, consumed: 0 });
    expect(await auditCount(initialCorrelationId)).toBe(0);

    const predecessor = await seedSource(`audit-successor-${crypto.randomUUID()}`);
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
      predecessor.versionId,
    ]);
    const successorFollowUp = await runCommand(planQuoteFollowUp, {
      client: clientA as never,
      input: {
        quote_version_id: predecessor.versionId,
        due_date: new Date(Date.now() + 48 * 60 * 60 * 1_000).toISOString().slice(0, 10),
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(successorFollowUp.ok).toBe(true);
    const successorCorrelationId = crypto.randomUUID();
    const beforeSuccessor = await quoteState(predecessor.versionId);
    const beforeSuccessorEvents = await tenantEventCounts();
    const successorResult = await withForcedAuditFailure(successorCorrelationId, () =>
      runCommand(createNewQuoteVersion, {
        client: clientA as never,
        input: { quote_version_id: predecessor.versionId },
        clock: fixedClock,
        correlationId: successorCorrelationId,
      }),
    );
    expect(successorResult.ok).toBe(false);
    if (!successorResult.ok) expect(successorResult.code).toBe("SERVER_ERROR");
    expect(await quoteState(predecessor.versionId)).toEqual(beforeSuccessor);
    expect(await tenantEventCounts()).toEqual(beforeSuccessorEvents);
    expect(await authorizationState(successorCorrelationId)).toEqual({ count: 1, consumed: 0 });
    expect(await auditCount(successorCorrelationId)).toBe(0);
  });

  it("[P0] send rolls back the status/event and its one-time final-send authorization consumption", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const draft = await seedSource(`audit-send-${crypto.randomUUID()}`);
    await establishCurrentQuotePdf({
      client: clientA,
      tenantId: fixture.tenantA.id,
      quoteVersionId: draft.versionId,
      actorUserId: fixture.adminA.id,
      occurredAt: FIXED_ISO,
    });
    const correlationId = crypto.randomUUID();
    const before = await quoteState(draft.versionId);
    const result = await withForcedAuditFailure(correlationId, () =>
      runCommand(markQuoteVersionSent, {
        client: clientA as never,
        input: { quote_version_id: draft.versionId },
        clock: fixedClock,
        correlationId,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SERVER_ERROR");
    expect(await quoteState(draft.versionId)).toEqual(before);
    expect(await authorizationState(correlationId)).toEqual({ count: 1, consumed: 0 });
    expect(await auditCount(correlationId)).toBe(0);
  });

  it("[P0] PDF render start rolls back its generating state and database-issued render identity", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const draft = await seedSource(`audit-pdf-start-${crypto.randomUUID()}`);
    const correlationId = crypto.randomUUID();
    const before = await quotePdfState(draft.versionId, []);
    const result = await withForcedAuditFailure<RpcResult>(correlationId, async () =>
      await clientA.rpc("start_quote_pdf_render", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: draft.versionId,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: correlationId,
        p_started_at: FIXED_ISO,
        p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
      }),
    );
    expect(result.error?.code).toBe("P0001");
    expect(await quotePdfState(draft.versionId, [])).toEqual(before);
    expect(await auditCount(correlationId)).toBe(0);
  });

  it("[P0] PDF render completion rolls back the draft upload, active predecessor, link, version, event, and audit", async (testCtx) => {
    if (skipUnlessStackAndStorage(testCtx)) return;
    const draft = await seedSource(`audit-pdf-complete-${crypto.randomUUID()}`);
    const predecessor = await establishCurrentQuotePdf({
      client: clientA,
      tenantId: fixture.tenantA.id,
      quoteVersionId: draft.versionId,
      actorUserId: fixture.adminA.id,
      occurredAt: FIXED_ISO,
    });
    const correlationId = crypto.randomUUID();
    const provenance = await startQuotePdfRender({
      client: clientA, tenantId: fixture.tenantA.id, quoteVersionId: draft.versionId,
      actorUserId: fixture.adminA.id, correlationId, occurredAt: FIXED_ISO,
    });
    const expectedFileId = provenance.fileId;

    const staged = await stageExpectedPdfObject(expectedFileId);
    const predecessorPath = `${fixture.tenantA.id}/${predecessor.fileId}/current-quote.pdf`;
    try {
      const before = await quotePdfState(draft.versionId, [predecessor.fileId, expectedFileId]);
      const result = await withForcedAuditFailure<RpcResult>(correlationId, async () =>
        await clientA.rpc("complete_quote_pdf_render", {
          p_tenant_id: fixture.tenantA.id,
          p_quote_version_id: draft.versionId,
          p_file_id: expectedFileId,
          p_generated_at: FIXED_ISO,
          p_actor_user_id: fixture.adminA.id,
          p_correlation_id: correlationId,
          ...quotePdfCompletionAttestation({
            provenance, tenantId: fixture.tenantA.id, actorUserId: fixture.adminA.id,
            quoteVersionId: draft.versionId, objectPath: staged.objectPath,
            checksumSha256: staged.checksum, sizeBytes: staged.sizeBytes,
          }),
        }),
      );
      expect(result.error?.code).toBe("P0001");
      expect(await quotePdfState(draft.versionId, [predecessor.fileId, expectedFileId])).toEqual(before);
      // The render-start audit intentionally shares the correlated render identity;
      // only the completion audit must roll back under this injected failure.
      expect(await auditCount(correlationId)).toBe(1);
    } finally {
      try {
        await deleteLocalTestStorageObject(staged.objectPath);
      } finally {
        await deleteLocalTestStorageObject(predecessorPath);
      }
    }
  });

  it("[P0] PDF render failure rolls back the generating identity, file/link archive, version, event, and audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const draft = await seedSource(`audit-pdf-fail-${crypto.randomUUID()}`);
    const correlationId = crypto.randomUUID();
    const provenance = await startQuotePdfRender({
      client: clientA, tenantId: fixture.tenantA.id, quoteVersionId: draft.versionId,
      actorUserId: fixture.adminA.id, correlationId, occurredAt: FIXED_ISO,
    });
    const expectedFileId = provenance.fileId;
    await adminInsertFile({
      id: expectedFileId,
      tenant_id: fixture.tenantA.id,
      display_name: "audit-failed-render.pdf",
      mime_type: "application/pdf",
      artifact_kind: "quote_pdf",
      uploaded_by: fixture.adminA.id,
      // Seed the exact archival target directly: fail must retain the bytes but
      // archive both a previously-linked metadata row and its active link.
      lifecycle_state: "linked",
    });
    await adminInsertFileLink({
      tenant_id: fixture.tenantA.id,
      file_id: expectedFileId,
      owner_type: "quote_version",
      owner_id: draft.versionId,
      purpose: "quote_pdf",
    });
    const before = await quotePdfState(draft.versionId, [expectedFileId]);
    const result = await withForcedAuditFailure<RpcResult>(correlationId, async () =>
      await clientA.rpc("fail_quote_pdf_render", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: draft.versionId,
        p_expected_file_id: expectedFileId,
        p_failed_at: FIXED_ISO,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: correlationId,
      }),
    );
    expect(result.error?.code).toBe("P0001");
    expect(await quotePdfState(draft.versionId, [expectedFileId])).toEqual(before);
    // The matching start audit is durable; the failed lifecycle audit is not.
    expect(await auditCount(correlationId)).toBe(1);
  });

  it("[P0] lifecycle and lost wrappers leave sent state, events, reasons, and audit unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const lifecycle = await seedSource(`audit-lifecycle-${crypto.randomUUID()}`);
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
      lifecycle.versionId,
    ]);
    const lifecycleCorrelationId = crypto.randomUUID();
    const beforeLifecycle = await quoteState(lifecycle.versionId);
    const lifecycleResult = await withForcedAuditFailure<RpcResult>(lifecycleCorrelationId, async () =>
      await clientA.rpc("mark_quote_version_lifecycle", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: lifecycle.versionId,
        p_transition: "rejected",
        p_occurred_at: FIXED_ISO,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: lifecycleCorrelationId,
      }),
    );
    expect(lifecycleResult.error?.code).toBe("P0001");
    expect(await quoteState(lifecycle.versionId)).toEqual(beforeLifecycle);
    expect(await auditCount(lifecycleCorrelationId)).toBe(0);

    const lost = await seedSource(`audit-lost-${crypto.randomUUID()}`);
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [lost.versionId]);
    const lostCorrelationId = crypto.randomUUID();
    const beforeLost = await quoteState(lost.versionId);
    const lostResult = await withForcedAuditFailure<RpcResult>(lostCorrelationId, async () =>
      await clientA.rpc("mark_quote_version_lost", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: lost.versionId,
        p_outcome: "forlorad",
        p_category: "pris",
        p_note: "test-only rollback proof",
        p_occurred_at: FIXED_ISO,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: lostCorrelationId,
      }),
    );
    expect(lostResult.error?.code).toBe("P0001");
    expect(await quoteState(lost.versionId)).toEqual(beforeLost);
    expect(await auditCount(lostCorrelationId)).toBe(0);
  });

  it("[P0] accept-and-create-job rolls back acceptance, job, lifecycle events, and audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const sent = await seedSource(`audit-accept-${crypto.randomUUID()}`);
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [sent.versionId]);
    const acceptanceFollowUp = await runCommand(planQuoteFollowUp, {
      client: clientA as never,
      input: {
        quote_version_id: sent.versionId,
        due_date: new Date(Date.now() + 48 * 60 * 60 * 1_000).toISOString().slice(0, 10),
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(acceptanceFollowUp.ok).toBe(true);
    const payable = await adminQuery<{ payable_ore: string }>(
      `select payable_ore::text from public.quote_versions where id = $1`,
      [sent.versionId],
    );
    const sourceSentTotalOre = Number(payable[0]?.payable_ore);
    expect(Number.isSafeInteger(sourceSentTotalOre)).toBe(true);
    const correlationId = crypto.randomUUID();
    const before = await quoteState(sent.versionId);
    const beforeEvents = await tenantEventCounts();
    const result = await withForcedAuditFailure<RpcResult>(correlationId, async () =>
      await clientA.rpc("accept_quote_and_create_job", {
        p_tenant_id: fixture.tenantA.id,
        p_quote_version_id: sent.versionId,
        p_accepted_at: FIXED_ISO,
        p_accepted_price_ore: sourceSentTotalOre,
        p_source_sent_total_ore: sourceSentTotalOre,
        p_channel: null,
        p_adjustment_reason: null,
        p_evidence_file_id: null,
        p_evidence_reference: null,
        p_notes: null,
        p_planned_start_date: null,
        p_planned_end_date: null,
        p_title: null,
        p_fault_inject: null,
        p_actor_user_id: fixture.adminA.id,
        p_correlation_id: correlationId,
      }),
    );
    expect(result.error?.code).toBe("P0001");
    expect(await quoteState(sent.versionId)).toEqual(before);
    expect(await tenantEventCounts()).toEqual(beforeEvents);
    expect(await auditCount(correlationId)).toBe(0);
  });
});
