import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertFile,
  adminInsertFileLink,
  adminInsertMembership,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionLine,
  adminRemoveStorageObject,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TestServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery, adminSession, closeAdminPool } from "../../factories/admin-sql";
import {
  isLocalStackReachable,
  isLocalStorageReachable,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
} from "../../support/test-env";
import { skipUnlessStack, skipUnlessStorage, type SkippableTestContext } from "../../support/stack-gate";
import {
  LOCAL_TEST_QUOTE_PDF_KEY_ID,
  quotePdfCompletionAttestation,
  quotePdfSendAttestation,
  startQuotePdfRender,
  type QuotePdfRenderProvenance,
} from "../../support/quote-pdf";
import { runCommand } from "@/server/commands/envelope";
import { createSignedFileAccess } from "@/server/commands/files";
import { createQuotePdfSignedAccess, generateQuotePdf, updateDraftQuoteVersion } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const STARTED_AT = "2026-08-31T12:00:00.000Z";
const FINISHED_AT = "2026-08-31T12:01:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FINISHED_AT) };
const TEST_KEY_ID = LOCAL_TEST_QUOTE_PDF_KEY_ID;

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let adminA: TestServerClient;
let adminB: TestServerClient;
let sellerA: TestServerClient;
let serviceStorage: TestServerClient;
const renderProvenance = new Map<string, QuotePdfRenderProvenance>();
const originalRuntimeSigningEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

type Draft = { quoteId: string; versionId: string };

async function seedDraft(tenantId: string, label: string): Promise<Draft> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `${label} customer`,
  });
  const calculationId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `${label} calculation`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calculationId,
    company_name: `${label} company`,
  });
  return { quoteId, versionId };
}

/**
 * Arrange a pre-10.6 V1 draft solely to exercise the legacy child-edit boundary.
 * Fresh V1 inserts are deliberately impossible in production; this mirrors an
 * already-existing historical row without weakening the V2 snapshot guard.
 */
async function seedLegacyDraft(label: string): Promise<Draft> {
  const v2 = await seedDraft(fixture.tenantA.id, `${label}-source`);
  const source = await adminQuery<{ calculation_id: string }>(
    `select calculation_id from public.quote_versions where id = $1`,
    [v2.versionId],
  );
  const calculationId = source[0]?.calculation_id;
  if (!calculationId) throw new Error("legacy draft seed has no calculation");

  const versionId = await adminSession(async ({ query }) => {
    await query("begin");
    try {
      await query("set local session_replication_role = replica");
      const rows = await query<{ id: string }>(
        `insert into public.quote_versions
           (tenant_id, quote_id, version_number, quote_number, status,
            calculation_id, captured_at, accepted_price_ore)
         values ($1, $2, 2, 999999, 'draft', $3, $4, 12500)
         returning id`,
        [fixture.tenantA.id, v2.quoteId, calculationId, STARTED_AT],
      );
      await query("commit");
      const id = rows[0]?.id;
      if (!id) throw new Error("legacy draft seed returned no id");
      return id;
    } catch (error) {
      await query("rollback");
      throw error;
    }
  });
  return { quoteId: v2.quoteId, versionId };
}

async function startRender(versionId: string, correlationId = crypto.randomUUID()): Promise<string> {
  const provenance = await startQuotePdfRender({
    client: adminA, tenantId: fixture.tenantA.id, quoteVersionId: versionId,
    actorUserId: fixture.adminA.id, correlationId, occurredAt: STARTED_AT,
  });
  renderProvenance.set(provenance.fileId, provenance);
  return provenance.fileId;
}

async function completeRender(versionId: string, fileId: string, correlationId?: string) {
  const proof = renderProvenance.get(fileId);
  if (!proof) {
    return adminA.rpc("complete_quote_pdf_render", {
      p_tenant_id: fixture.tenantA.id, p_quote_version_id: versionId, p_file_id: fileId,
      p_generated_at: FINISHED_AT, p_actor_user_id: fixture.adminA.id,
      p_correlation_id: crypto.randomUUID(), p_attestation_key_id: TEST_KEY_ID,
      p_attestation_issued_at: STARTED_AT, p_attestation_expires_at: FINISHED_AT,
      p_attestation_signature: "0".repeat(64),
    });
  }
  const actualCorrelation = correlationId ?? proof.correlationId;
  const bytes = new TextEncoder().encode(`quote-pdf:${fileId}`);
  const objectPath = `${fixture.tenantA.id}/${fileId}/quote.pdf`;
  return adminA.rpc("complete_quote_pdf_render", {
    p_tenant_id: fixture.tenantA.id,
    p_quote_version_id: versionId,
    p_file_id: fileId,
    p_generated_at: FINISHED_AT,
    p_actor_user_id: fixture.adminA.id,
    p_correlation_id: actualCorrelation,
    ...quotePdfCompletionAttestation({
      provenance: { ...proof, correlationId: actualCorrelation }, tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id, quoteVersionId: versionId, objectPath,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.byteLength,
    }),
  });
}

async function failRender(versionId: string, expectedFileId: string, correlationId?: string) {
  const proof = renderProvenance.get(expectedFileId);
  if (!proof) throw new Error("failRender requires start provenance");
  return adminA.rpc("fail_quote_pdf_render", {
    p_tenant_id: fixture.tenantA.id,
    p_quote_version_id: versionId,
    p_expected_file_id: expectedFileId,
    p_failed_at: FINISHED_AT,
    p_actor_user_id: fixture.adminA.id,
    p_correlation_id: correlationId ?? proof.correlationId,
  });
}

async function insertExpectedPdf(input: {
  expectedFileId: string;
  tenantId?: string;
  uploadedBy?: string;
  objectPath?: string;
  mimeType?: string;
  linked?: boolean;
  omitStorageObject?: boolean;
  storageMimeType?: string;
  sizeBytes?: number;
  checksum?: string | null;
}): Promise<string> {
  const tenantId = input.tenantId ?? fixture.tenantA.id;
  const objectPath = input.objectPath ?? `${tenantId}/${input.expectedFileId}/quote.pdf`;
  const bytes = new TextEncoder().encode(`quote-pdf:${input.expectedFileId}`);
  const checksum = input.checksum ?? createHash("sha256").update(bytes).digest("hex");
  // Metadata-first reservation freezes the intended file identity before the initial
  // object upload. The first upload is intentionally not an upsert.
  const fileId = await adminInsertFile({
    id: input.expectedFileId,
    tenant_id: tenantId,
    display_name: "quote.pdf",
    bucket_id: "tenant-files",
    object_path: objectPath,
    mime_type: input.mimeType ?? "application/pdf",
    size_bytes: input.sizeBytes ?? bytes.byteLength,
    checksum,
    artifact_kind: "quote_pdf",
    uploaded_by: input.uploadedBy ?? fixture.adminA.id,
    lifecycle_state: "draft",
  });
  if (!input.omitStorageObject && tenantId === fixture.tenantA.id && objectPath.startsWith(`${tenantId}/`)) {
    const upload = await adminA.storage
      .from("tenant-files")
      .upload(objectPath, bytes, {
        contentType: input.storageMimeType ?? "application/pdf",
        upsert: false,
      });
    expect(upload.error).toBeNull();
  }
  if (input.linked) {
    await adminInsertFileLink({
      tenant_id: tenantId,
      file_id: fileId,
      owner_type: "quote_version",
      owner_id: (await seedDraft(tenantId, "prelinked")).versionId,
      purpose: "quote_pdf",
    });
  }
  return fileId;
}

async function reserveExpectedPdf(input: {
  versionId: string;
  expectedFileId: string;
  omitStorageObject?: boolean;
}): Promise<string> {
  const objectPath = `${fixture.tenantA.id}/${input.expectedFileId}/quote.pdf`;
  const bytes = new TextEncoder().encode(`quote-pdf:${input.expectedFileId}`);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const reservation = await adminA.rpc("reserve_quote_pdf_file", {
    p_tenant_id: fixture.tenantA.id,
    p_quote_version_id: input.versionId,
    p_file_id: input.expectedFileId,
    p_object_path: objectPath,
    p_display_name: "quote.pdf",
    p_size_bytes: bytes.byteLength,
    p_checksum: checksum,
    p_actor_user_id: fixture.adminA.id,
  });
  expect(reservation.error).toBeNull();
  expect(reservation.data).toBe(input.expectedFileId);
  if (!input.omitStorageObject) {
    const upload = await adminA.storage
      .from("tenant-files")
      .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
    expect(upload.error).toBeNull();
  }
  return input.expectedFileId;
}

async function generatedDraft(label: string): Promise<Draft & { fileId: string }> {
  const draft = await seedDraft(fixture.tenantA.id, label);
  const expectedFileId = await startRender(draft.versionId);
  await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId });
  const completed = await completeRender(draft.versionId, expectedFileId);
  expect(completed.error).toBeNull();
  return { ...draft, fileId: expectedFileId };
}

async function sendDraft(input: Draft): Promise<{ error: { code?: string } | null }> {
  const correlationId = crypto.randomUUID();
  const authorization = await adminQuery<{ id: string }>(
    `insert into public.quote_review_authorizations (
       tenant_id, actor_user_id, purpose, quote_id, target_quote_version_id,
       source_revision, correlation_id, expires_at
     ) values (
       $1, $2, 'final_send', $3, $4,
       public.story_10_8_quote_version_source_revision($1, $4), $5,
       statement_timestamp() + interval '15 minutes'
     ) returning id`,
    [fixture.tenantA.id, fixture.adminA.id, input.quoteId, input.versionId, correlationId],
  );
  const authorizationId = authorization[0]?.id;
  if (!authorizationId) throw new Error("send authorization seed returned no id");
  const prepared = await adminA.rpc("prepare_quote_pdf_send_attestation", {
    p_tenant_id: fixture.tenantA.id,
    p_quote_version_id: input.versionId,
    p_actor_user_id: fixture.adminA.id,
    p_correlation_id: correlationId,
    p_attestation_key_id: TEST_KEY_ID,
  });
  if (prepared.error) return { error: prepared.error };
  const attestation = await quotePdfSendAttestation({
    client: adminA,
    tenantId: fixture.tenantA.id,
    quoteVersionId: input.versionId,
    actorUserId: fixture.adminA.id,
    correlationId,
    challengeData: prepared.data,
  });
  const result = await adminA.rpc("mark_quote_version_sent", {
    p_tenant_id: fixture.tenantA.id,
    p_quote_version_id: input.versionId,
    p_authorization_id: authorizationId,
    p_sent_at: FINISHED_AT,
    p_channel: null,
    p_reference: null,
    p_actor_user_id: fixture.adminA.id,
    p_correlation_id: correlationId,
    ...attestation,
  });
  return { error: result.error };
}

async function expectInvalidated(versionId: string) {
  const rows = await adminQuery<{
    pdf_status: string;
    pdf_file_id: string | null;
    pdf_content_fingerprint: string | null;
    pdf_render_fingerprint: string | null;
    pdf_render_file_id: string | null;
  }>(
    `select pdf_status, pdf_file_id, pdf_content_fingerprint, pdf_render_fingerprint, pdf_render_file_id
       from public.quote_versions where id = $1`,
    [versionId],
  );
  expect(rows[0]).toEqual({
    pdf_status: "not_generated",
    pdf_file_id: null,
    pdf_content_fingerprint: null,
    pdf_render_fingerprint: null,
    pdf_render_file_id: null,
  });
}

async function downloadBytes(client: TestServerClient, objectPath: string): Promise<Uint8Array> {
  const download = await client.storage.from("tenant-files").download(objectPath);
  expect(download.error).toBeNull();
  expect(download.data).not.toBeNull();
  return new Uint8Array(await download.data!.arrayBuffer());
}

async function seedLegacyActivePdfLink(input: {
  versionId: string;
  label: string;
}): Promise<{ fileId: string; objectPath: string; bytes: Uint8Array }> {
  const fileId = crypto.randomUUID();
  const objectPath = `${fixture.tenantA.id}/${fileId}/${input.label}.pdf`;
  const bytes = new TextEncoder().encode(`legacy quote PDF: ${input.label}`);
  await adminInsertFile({
    id: fileId,
    tenant_id: fixture.tenantA.id,
    display_name: `${input.label}.pdf`,
    object_path: objectPath,
    mime_type: "application/pdf",
    size_bytes: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    artifact_kind: "quote_pdf",
    uploaded_by: fixture.adminA.id,
    lifecycle_state: "draft",
  });
  const upload = await serviceStorage.storage
    .from("tenant-files")
    .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
  expect(upload.error).toBeNull();
  await adminQuery(
    `update public.files set lifecycle_state = 'linked' where id = $1 and lifecycle_state = 'draft'`,
    [fileId],
  );
  await adminInsertFileLink({
    tenant_id: fixture.tenantA.id,
    file_id: fileId,
    owner_type: "quote_version",
    owner_id: input.versionId,
    purpose: "quote_pdf",
  });
  return { fileId, objectPath, bytes };
}

function expectStorageImmutabilityDenied(error: unknown): void {
  expect(error).not.toBeNull();
  const flattened = JSON.stringify(error);
  // Storage preserves the PostgreSQL SQLSTATE on some local Storage versions.
  // Where it is surfaced, pin the trigger's domain-specific error rather than a
  // generic HTTP rejection; all versions must still identify the immutable guard.
  if (/PFD10/.test(flattened)) expect(flattened).toMatch(/PFD10/);
  expect(flattened).toMatch(/PFD10|immutable/i);
}

beforeAll(async () => {
  // The production-only broker intentionally reads the normal server env names. Bind
  // those names to the loopback test stack for this process only; the imported test
  // constants are fixed local demo credentials and never a hosted-project credential.
  process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_SUPABASE_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SUPABASE_SERVICE_ROLE_KEY;
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  storageUp = await isLocalStorageReachable();
  if (!storageUp) return;
  fixture = await createTwoTenantFixture();
  adminA = await makeAuthedServerClient(fixture.adminA);
  adminB = await makeAuthedServerClient(fixture.adminB);
  await adminInsertMembership({
    tenant_id: fixture.tenantA.id,
    user_id: fixture.orphanUser.id,
    role: "saljare",
    status: "active",
  });
  sellerA = await makeAuthedServerClient(fixture.orphanUser);
  serviceStorage = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as TestServerClient;
});

afterAll(async () => {
  if (originalRuntimeSigningEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalRuntimeSigningEnv.url;
  if (originalRuntimeSigningEnv.anonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalRuntimeSigningEnv.anonKey;
  if (originalRuntimeSigningEnv.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalRuntimeSigningEnv.serviceRoleKey;
  if (fixture) await cleanupFixture(fixture);
  await closeAdminPool();
});

function skipUnlessBoth(testCtx: SkippableTestContext): boolean {
  if (skipUnlessStack(testCtx, stackUp)) return true;
  return skipUnlessStorage(testCtx, storageUp);
}

describe("Story 10.9 quote PDF validity RPCs", () => {
  it("[P0][11.2] a Säljare can generate only through the attested reserved-PDF path; arbitrary tenant-prefix upload and foreign render remain denied", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "seller-export");
    const generated = await runCommand(generateQuotePdf, {
      client: sellerA as never,
      input: { quote_version_id: draft.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    // Quotes.Export gives the active generated quote artifact only. The generic file
    // command remains behind Files.View and therefore cannot widen seller access.
    const genericFileAccess = await runCommand(createSignedFileAccess, {
      client: sellerA as never,
      input: { file_id: generated.data.fileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(genericFileAccess.ok).toBe(false);
    if (!genericFileAccess.ok) expect(genericFileAccess.code).toBe("PERMISSION_DENIED");

    const correlationId = crypto.randomUUID();
    const quotePdfAccess = await runCommand(createQuotePdfSignedAccess, {
      client: sellerA as never,
      input: { quote_version_id: draft.versionId, file_id: generated.data.fileId },
      clock: fixedClock,
      correlationId,
    });
    expect(quotePdfAccess.ok).toBe(true);
    if (!quotePdfAccess.ok) return;
    const obtained = await fetch(quotePdfAccess.data.signedUrl);
    expect(obtained.ok).toBe(true);
    expect((await obtained.arrayBuffer()).byteLength).toBeGreaterThan(0);
    const audit = await adminQuery<{
      command: string; event_type: string; target_type: string; target_id: string; actor_user_id: string;
    }>(
      `select command, event_type, target_type, target_id::text, actor_user_id::text
         from public.audit_events where correlation_id = $1::uuid`,
      [correlationId],
    );
    expect(audit).toEqual([{
      command: "quote.pdf.signedAccess.create", event_type: "quote.pdf.signed_access.created",
      target_type: "quote_version", target_id: draft.versionId, actor_user_id: fixture.orphanUser.id,
    }]);

    // No persistent Storage SELECT is granted to Säljare. These raw SDK operations
    // exercise the same policy that list/download/createSignedUrl would otherwise use;
    // only the narrow, audited quote broker above may return this exact PDF URL.
    const objectPath = `${fixture.tenantA.id}/${generated.data.fileId}/quote.pdf`;
    const rawList = await sellerA.storage.from("tenant-files").list(
      `${fixture.tenantA.id}/${generated.data.fileId}`,
    );
    expect(rawList.error).toBeNull();
    expect(rawList.data ?? []).toEqual([]);
    const rawDownload = await sellerA.storage.from("tenant-files").download(objectPath);
    expect(rawDownload.data).toBeNull();
    expect(rawDownload.error).not.toBeNull();
    const rawSign = await sellerA.storage.from("tenant-files").createSignedUrl(objectPath, 60);
    expect(rawSign.data).toBeNull();
    expect(rawSign.error).not.toBeNull();

    const arbitrary = await sellerA.storage.from("tenant-files").upload(
      `${fixture.tenantA.id}/${crypto.randomUUID()}/unreserved.pdf`,
      new TextEncoder().encode("not a reserved PDF"),
      { contentType: "application/pdf", upsert: false },
    );
    expect(arbitrary.error).not.toBeNull();

    const foreign = await adminB.rpc("start_quote_pdf_render", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: draft.versionId,
      p_actor_user_id: fixture.adminB.id,
      p_correlation_id: crypto.randomUUID(),
      p_started_at: STARTED_AT,
      p_attestation_key_id: TEST_KEY_ID,
    });
    expect(foreign.error?.code).toBe("42501");
  });

  it("[P0][11.2] a Säljare cannot bind one generated quote PDF to a different same-tenant quote version", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const firstDraft = await seedDraft(fixture.tenantA.id, "seller-bound-source");
    const secondDraft = await seedDraft(fixture.tenantA.id, "seller-bound-target");
    const firstGenerated = await runCommand(generateQuotePdf, {
      client: sellerA as never,
      input: { quote_version_id: firstDraft.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    const secondGenerated = await runCommand(generateQuotePdf, {
      client: sellerA as never,
      input: { quote_version_id: secondDraft.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(firstGenerated.ok).toBe(true);
    expect(secondGenerated.ok).toBe(true);
    if (!firstGenerated.ok || !secondGenerated.ok) return;

    const correlationId = crypto.randomUUID();
    const mismatchedAccess = await runCommand(createQuotePdfSignedAccess, {
      client: sellerA as never,
      input: { quote_version_id: firstDraft.versionId, file_id: secondGenerated.data.fileId },
      clock: fixedClock,
      correlationId,
    });

    expect(mismatchedAccess.ok).toBe(false);
    if (!mismatchedAccess.ok) expect(mismatchedAccess.code).toBe("TENANT_ACCESS_DENIED");
    const audit = await adminQuery<{ id: string }>(
      `select id::text from public.audit_events where correlation_id = $1::uuid`,
      [correlationId],
    );
    expect(audit).toEqual([]);
  });

  it("[P0] DB issues a fresh render identity and rejects arbitrary, foreign, prelinked, wrong-path, and wrong-uploader completions", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;

    const arbitrary = await seedDraft(fixture.tenantA.id, "arbitrary");
    const arbitraryExpected = await startRender(arbitrary.versionId);
    const identity = await adminQuery<{ pdf_render_file_id: string; pdf_status: string }>(
      `select pdf_render_file_id, pdf_status from public.quote_versions where id = $1`,
      [arbitrary.versionId],
    );
    expect(identity[0]).toEqual({ pdf_render_file_id: arbitraryExpected, pdf_status: "generating" });
    const arbitraryResult = await completeRender(arbitrary.versionId, crypto.randomUUID());
    expect(arbitraryResult.error?.code).toBe("PFD10");

    const cases: Array<{ name: string; setup: (expectedFileId: string) => Promise<void> }> = [
      {
        name: "foreign file",
        setup: async (expectedFileId) => {
          await insertExpectedPdf({ expectedFileId, tenantId: fixture.tenantB.id });
        },
      },
      {
        name: "prelinked file",
        setup: async (expectedFileId) => {
          await insertExpectedPdf({ expectedFileId, linked: true });
        },
      },
      {
        name: "wrong object path",
        setup: async (expectedFileId) => {
          await insertExpectedPdf({ expectedFileId, objectPath: `wrong/${expectedFileId}/quote.pdf` });
        },
      },
      {
        name: "wrong uploader",
        setup: async (expectedFileId) => {
          await insertExpectedPdf({ expectedFileId, uploadedBy: fixture.adminB.id });
        },
      },
    ];
    for (const scenario of cases) {
      const draft = await seedDraft(fixture.tenantA.id, scenario.name);
      const expectedFileId = await startRender(draft.versionId);
      await scenario.setup(expectedFileId);
      const completion = await completeRender(draft.versionId, expectedFileId);
      expect(completion.error?.code, scenario.name).toBe("PFD10");
      const state = await adminQuery<{ pdf_status: string; pdf_file_id: string | null }>(
        `select pdf_status, pdf_file_id from public.quote_versions where id = $1`,
        [draft.versionId],
      );
      expect(state[0], scenario.name).toEqual({ pdf_status: "generating", pdf_file_id: null });
    }
  });

  it("[P0] a tenant-B administrator cannot start, reserve, complete, or fail tenant-A PDF renders", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "cross-tenant-render");
    const deniedStart = await adminB.rpc("start_quote_pdf_render", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: draft.versionId,
      p_actor_user_id: fixture.adminB.id,
      p_correlation_id: crypto.randomUUID(),
      p_started_at: STARTED_AT,
      p_attestation_key_id: TEST_KEY_ID,
    });
    expect(deniedStart.error?.code).toBe("42501");

    const expectedFileId = await startRender(draft.versionId);
    const bytes = new TextEncoder().encode(`quote-pdf:${expectedFileId}`);
    const shared = {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: draft.versionId,
      p_file_id: expectedFileId,
      p_actor_user_id: fixture.adminB.id,
    };
    const deniedReservation = await adminB.rpc("reserve_quote_pdf_file", {
      ...shared,
      p_object_path: `${fixture.tenantA.id}/${expectedFileId}/quote.pdf`,
      p_display_name: "quote.pdf",
      p_size_bytes: bytes.byteLength,
      p_checksum: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(deniedReservation.error?.code).toBe("42501");
    const deniedCompletion = await adminB.rpc("complete_quote_pdf_render", {
      ...shared,
      p_generated_at: FINISHED_AT,
      p_correlation_id: crypto.randomUUID(),
      p_attestation_key_id: TEST_KEY_ID,
      p_attestation_issued_at: STARTED_AT,
      p_attestation_expires_at: FINISHED_AT,
      p_attestation_signature: "0".repeat(64),
    });
    expect(deniedCompletion.error?.code).toBe("42501");
    const deniedFailure = await adminB.rpc("fail_quote_pdf_render", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: draft.versionId,
      p_expected_file_id: expectedFileId,
      p_failed_at: FINISHED_AT,
      p_actor_user_id: fixture.adminB.id,
      p_correlation_id: crypto.randomUUID(),
    });
    expect(deniedFailure.error?.code).toBe("42501");
  });

  it("[P0] raw completion rejects missing, forged, malformed, wrong-key, changed-field, expired and replayed attestations", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const startAttempt = async (label: string) => {
      const draft = await seedDraft(fixture.tenantA.id, `attestation-${label}`);
      const fileId = await startRender(draft.versionId);
      await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId: fileId });
      const proof = renderProvenance.get(fileId)!;
      const bytes = new TextEncoder().encode(`quote-pdf:${fileId}`);
      const common = {
        p_tenant_id: fixture.tenantA.id, p_quote_version_id: draft.versionId,
        p_file_id: fileId, p_generated_at: "1999-01-01T00:00:00.000Z",
        p_actor_user_id: fixture.adminA.id, p_correlation_id: proof.correlationId,
      };
      const attestation = quotePdfCompletionAttestation({
        provenance: proof, tenantId: fixture.tenantA.id, actorUserId: fixture.adminA.id,
        quoteVersionId: draft.versionId, objectPath: `${fixture.tenantA.id}/${fileId}/quote.pdf`,
        checksumSha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.byteLength,
      });
      return { draft, common, attestation };
    };

    for (const mutate of [
      (a: ReturnType<typeof quotePdfCompletionAttestation>) => ({ ...a, p_attestation_signature: "0".repeat(64) }),
      (a: ReturnType<typeof quotePdfCompletionAttestation>) => ({ ...a, p_attestation_signature: "malformed" }),
      (a: ReturnType<typeof quotePdfCompletionAttestation>) => ({ ...a, p_attestation_key_id: "wrong_key" }),
    ]) {
      const attempt = await startAttempt("forged");
      const result = await adminA.rpc("complete_quote_pdf_render", { ...attempt.common, ...mutate(attempt.attestation) });
      expect(result.error?.code).toBe("PFD10");
    }

    const expired = await startAttempt("expired");
    const expiredTimes = await adminQuery<{ expires_at: string }>(
      `update public.quote_versions
          set pdf_render_attestation_expires_at = statement_timestamp() - interval '1 second',
              pdf_render_lease_expires_at = statement_timestamp() - interval '1 second'
        where id = $1
        returning to_char(pdf_render_attestation_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as expires_at`,
      [expired.draft.versionId],
    );
    const expiredAttestation = quotePdfCompletionAttestation({
      provenance: { ...renderProvenance.get(expired.common.p_file_id)!, expiresAt: expiredTimes[0]!.expires_at },
      tenantId: fixture.tenantA.id, actorUserId: fixture.adminA.id, quoteVersionId: expired.draft.versionId,
      objectPath: `${fixture.tenantA.id}/${expired.common.p_file_id}/quote.pdf`,
      checksumSha256: createHash("sha256").update(new TextEncoder().encode(`quote-pdf:${expired.common.p_file_id}`)).digest("hex"),
      sizeBytes: new TextEncoder().encode(`quote-pdf:${expired.common.p_file_id}`).byteLength,
    });
    expect((await adminA.rpc("complete_quote_pdf_render", { ...expired.common, ...expiredAttestation })).error?.code).toBe("PFD10");

    const missing = await startAttempt("missing");
    const missingResult = await adminA.rpc("complete_quote_pdf_render", missing.common);
    expect(missingResult.error).not.toBeNull();

    const replay = await startAttempt("replay");
    expect((await adminA.rpc("complete_quote_pdf_render", { ...replay.common, ...replay.attestation })).error).toBeNull();
    expect((await adminA.rpc("complete_quote_pdf_render", { ...replay.common, ...replay.attestation })).error?.code).toBe("PFD10");
    const timestamps = await adminQuery<{ pdf_generated_at: string; event_at: string }>(
      `select qv.pdf_generated_at::text, qe.occurred_at::text as event_at
         from public.quote_versions qv join public.quote_events qe on qe.quote_version_id = qv.id
        where qv.id = $1 and qe.event_type = 'pdf_generated'`,
      [replay.draft.versionId],
    );
    expect(timestamps[0]?.pdf_generated_at).not.toContain("1999-01-01");
    expect(timestamps[0]?.event_at).not.toContain("1999-01-01");

    const missingVault = await adminA.rpc("start_quote_pdf_render", {
      p_tenant_id: fixture.tenantA.id, p_quote_version_id: (await seedDraft(fixture.tenantA.id, "missing-vault")).versionId,
      p_actor_user_id: fixture.adminA.id, p_correlation_id: crypto.randomUUID(), p_started_at: STARTED_AT,
      p_attestation_key_id: "missing_local_vault_key",
    });
    expect(missingVault.error?.code).toBe("PFD10");
  });

  it("[P0] a Storage-backed reserved quote-PDF draft cannot be signed after completion is rejected", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "reserved-signing-denial");
    const expectedFileId = await startRender(draft.versionId);
    // This is the real metadata-first reservation and first Storage upload path.
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId });
    // A foreign completion attempt is rejected but leaves the own-tenant reservation in draft.
    const rejectedCompletion = await adminB.rpc("complete_quote_pdf_render", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: draft.versionId,
      p_file_id: expectedFileId,
      p_generated_at: FINISHED_AT,
      p_actor_user_id: fixture.adminB.id,
      p_correlation_id: crypto.randomUUID(),
      p_attestation_key_id: TEST_KEY_ID,
      p_attestation_issued_at: STARTED_AT,
      p_attestation_expires_at: FINISHED_AT,
      p_attestation_signature: "0".repeat(64),
    });
    expect(rejectedCompletion.error?.code).toBe("42501");
    const reserved = await adminQuery<{ lifecycle_state: string; artifact_kind: string | null }>(
      `select lifecycle_state, artifact_kind from public.files where id = $1`,
      [expectedFileId],
    );
    expect(reserved[0]).toEqual({ lifecycle_state: "draft", artifact_kind: "quote_pdf" });

    const signed = await runCommand(createSignedFileAccess, {
      client: adminA as never,
      input: { file_id: expectedFileId },
      clock: { now: () => new Date(FINISHED_AT) },
      correlationId: crypto.randomUUID(),
    });
    expect(signed.ok).toBe(false);
    if (!signed.ok) expect(signed.code).toBe("FILE_ACCESS_DENIED");
  });

  it("[P0] an ordinary draft file retains normal signing eligibility", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const fileId = crypto.randomUUID();
    const objectPath = `${fixture.tenantA.id}/${fileId}/ordinary.pdf`;
    await adminInsertFile({
      id: fileId,
      tenant_id: fixture.tenantA.id,
      display_name: "ordinary.pdf",
      object_path: objectPath,
      uploaded_by: fixture.adminA.id,
      lifecycle_state: "draft",
    });
    const uploaded = await adminA.storage
      .from("tenant-files")
      .upload(objectPath, new TextEncoder().encode("ordinary draft"), {
        contentType: "application/pdf",
        upsert: false,
      });
    expect(uploaded.error).toBeNull();

    const signed = await runCommand(createSignedFileAccess, {
      client: adminA as never,
      input: { file_id: fileId },
      clock: { now: () => new Date(FINISHED_AT) },
      correlationId: crypto.randomUUID(),
    });
    expect(signed.ok).toBe(true);
  });

  it("[P0] authenticated direct DML cannot mint or add the durable quote_pdf discriminator", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const directId = crypto.randomUUID();
    const directInsert = await adminA
      .from("files")
      .insert({
        id: directId,
        tenant_id: fixture.tenantA.id,
        bucket_id: "tenant-files",
        object_path: `${fixture.tenantA.id}/${directId}/direct.pdf`,
        display_name: "direct.pdf",
        mime_type: "application/pdf",
        size_bytes: 1,
        checksum: "a".repeat(64),
        artifact_kind: "quote_pdf",
        uploaded_by: fixture.adminA.id,
        lifecycle_state: "draft",
      })
      .select("id");
    expect(directInsert.error?.code).toBe("42501");

    const ordinaryId = await adminInsertFile({
      tenant_id: fixture.tenantA.id,
      display_name: "ordinary.pdf",
      uploaded_by: fixture.adminA.id,
      lifecycle_state: "draft",
    });
    const retag = await adminA
      .from("files")
      .update({ artifact_kind: "quote_pdf" })
      .eq("id", ordinaryId)
      .select("id");
    expect(retag.error?.code).toBe("42501");
  });

  it("[P0] current completion supersedes by archiving the old file and retaining an archived historical link", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "retention");
    const first = await startRender(draft.versionId);
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId: first });
    expect((await completeRender(draft.versionId, first)).error).toBeNull();

    const second = await startRender(draft.versionId);
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId: second });
    expect((await completeRender(draft.versionId, second)).error).toBeNull();

    const old = await adminQuery<{ lifecycle_state: string; archived_at: string | null; link_archived_at: string | null }>(
      `select f.lifecycle_state, f.archived_at::text,
              (select fl.archived_at::text from public.file_links fl
                where fl.file_id = f.id and fl.owner_id = $2 and fl.purpose = 'quote_pdf'
                order by fl.created_at limit 1) as link_archived_at
         from public.files f where f.id = $1`,
      [first, draft.versionId],
    );
    const current = await adminQuery<{ pdf_status: string; pdf_file_id: string; live_link_count: string }>(
      `select qv.pdf_status, qv.pdf_file_id,
              (select count(*)::text from public.file_links fl where fl.owner_id = qv.id
                and fl.purpose = 'quote_pdf' and fl.archived_at is null) as live_link_count
         from public.quote_versions qv where qv.id = $1`,
      [draft.versionId],
    );
    expect(old[0]?.lifecycle_state).toBe("archived");
    expect(old[0]?.archived_at).not.toBeNull();
    expect(old[0]?.link_archived_at).not.toBeNull();
    expect(current[0]).toEqual({ pdf_status: "generated", pdf_file_id: second, live_link_count: "1" });
  });

  it("[P0] a production draft edit invalidates a generated PDF, archives its access metadata, and requires regeneration before send", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "command-invalidation");
    const generated = await runCommand(generateQuotePdf, {
      client: adminA as never,
      input: { quote_version_id: draft.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const oldFileId = generated.data.fileId;
    const oldPathRows = await adminQuery<{ object_path: string }>(
      `select object_path from public.files where id = $1`,
      [oldFileId],
    );
    const oldObjectPath = oldPathRows[0]?.object_path;
    expect(oldObjectPath).toBeTruthy();
    const originalBytes = await downloadBytes(serviceStorage, oldObjectPath as string);

    const updated = await runCommand(updateDraftQuoteVersion, {
      client: adminA as never,
      input: { quote_version_id: draft.versionId, customer_notes: "A customer-visible revision" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(updated.ok).toBe(true);
    await expectInvalidated(draft.versionId);

    const archived = await adminQuery<{
      lifecycle_state: string;
      archived_at: string | null;
      link_archived_at: string | null;
    }>(
      `select f.lifecycle_state, f.archived_at::text,
              (select fl.archived_at::text from public.file_links fl
                where fl.owner_id = $2 and fl.file_id = f.id and fl.purpose = 'quote_pdf'
                order by fl.created_at limit 1) as link_archived_at
         from public.files f where f.id = $1`,
      [oldFileId, draft.versionId],
    );
    expect(archived[0]).toMatchObject({ lifecycle_state: "archived" });
    expect(archived[0]?.archived_at).not.toBeNull();
    expect(archived[0]?.link_archived_at).not.toBeNull();
    expect(await downloadBytes(serviceStorage, oldObjectPath as string)).toEqual(originalBytes);

    const signedOld = await runCommand(createSignedFileAccess, {
      client: adminA as never,
      input: { file_id: oldFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(signedOld).toMatchObject({ ok: false, code: "FILE_ACCESS_DENIED" });
    expect((await sendDraft(draft)).error?.code).toBe("PFD10");

    const regenerated = await runCommand(generateQuotePdf, {
      client: adminA as never,
      input: { quote_version_id: draft.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(regenerated.ok).toBe(true);
    if (!regenerated.ok) return;
    expect(regenerated.data.fileId).not.toBe(oldFileId);
    expect((await sendDraft(draft)).error).toBeNull();
  });

  it("[P0] completion replaces a legacy active quote-PDF link even when pdf_file_id is NULL", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "legacy-active-link");
    const old = await seedLegacyActivePdfLink({ versionId: draft.versionId, label: "legacy" });
    const legacyReference = await adminQuery<{ pdf_file_id: string | null; active_links: string }>(
      `select qv.pdf_file_id,
              (select count(*)::text from public.file_links fl
                where fl.owner_id = qv.id and fl.purpose = 'quote_pdf' and fl.archived_at is null) as active_links
         from public.quote_versions qv where qv.id = $1`,
      [draft.versionId],
    );
    expect(legacyReference[0]).toEqual({ pdf_file_id: null, active_links: "1" });

    const expectedFileId = await startRender(draft.versionId);
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId });
    expect((await completeRender(draft.versionId, expectedFileId)).error).toBeNull();

    const replacement = await adminQuery<{
      pdf_file_id: string | null;
      active_links: string;
      old_state: string;
      old_link_archived_at: string | null;
    }>(
      `select qv.pdf_file_id,
              (select count(*)::text from public.file_links fl
                where fl.owner_id = qv.id and fl.purpose = 'quote_pdf' and fl.archived_at is null) as active_links,
              (select lifecycle_state from public.files where id = $2) as old_state,
              (select archived_at::text from public.file_links
                where owner_id = qv.id and file_id = $2 and purpose = 'quote_pdf'
                order by created_at limit 1) as old_link_archived_at
         from public.quote_versions qv where qv.id = $1`,
      [draft.versionId, old.fileId],
    );
    expect(replacement[0]).toEqual({
      pdf_file_id: expectedFileId,
      active_links: "1",
      old_state: "archived",
      old_link_archived_at: expect.any(String),
    });
    expect(await downloadBytes(serviceStorage, old.objectPath)).toEqual(old.bytes);
    const oldSigned = await runCommand(createSignedFileAccess, {
      client: adminA as never,
      input: { file_id: old.fileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(oldSigned).toMatchObject({ ok: false, code: "FILE_ACCESS_DENIED" });
  });

  it("[P0] parent and child edits archive legacy active quote-PDF links with NULL version references", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const parent = await seedDraft(fixture.tenantA.id, "legacy-parent-invalidation");
    const parentPdf = await seedLegacyActivePdfLink({ versionId: parent.versionId, label: "parent-legacy" });
    const parentUpdate = await runCommand(updateDraftQuoteVersion, {
      client: adminA as never,
      input: { quote_version_id: parent.versionId, intro_text: "Customer-visible change" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(parentUpdate.ok).toBe(true);

    const child = await seedLegacyDraft("legacy-child-invalidation");
    const lineId = await adminInsertQuoteVersionLine({
      tenant_id: fixture.tenantA.id,
      quote_version_id: child.versionId,
      label: "before child edit",
    });
    const childPdf = await seedLegacyActivePdfLink({ versionId: child.versionId, label: "child-legacy" });
    await adminQuery(`update public.quote_version_lines set label = 'after child edit' where id = $1`, [lineId]);

    for (const entry of [parentPdf, childPdf]) {
      const metadata = await adminQuery<{ lifecycle_state: string; link_archived_at: string | null }>(
        `select f.lifecycle_state,
                (select fl.archived_at::text from public.file_links fl
                  where fl.file_id = f.id and fl.purpose = 'quote_pdf'
                  order by fl.created_at limit 1) as link_archived_at
           from public.files f where f.id = $1`,
        [entry.fileId],
      );
      expect(metadata[0]).toEqual({ lifecycle_state: "archived", link_archived_at: expect.any(String) });
      expect(await downloadBytes(serviceStorage, entry.objectPath)).toEqual(entry.bytes);
      const signed = await runCommand(createSignedFileAccess, {
        client: adminA as never,
        input: { file_id: entry.fileId },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(signed).toMatchObject({ ok: false, code: "FILE_ACCESS_DENIED" });
    }
  });

  it("[P0] a sent quote cannot regenerate its PDF and preserves its version, link, file, and bytes", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "sent-regeneration");
    const initial = await runCommand(generateQuotePdf, {
      client: adminA as never,
      input: { quote_version_id: draft.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect((await sendDraft(draft)).error).toBeNull();

    const before = await adminQuery<{
      status: string;
      pdf_status: string;
      pdf_file_id: string;
      pdf_content_fingerprint: string;
      lifecycle_state: string;
      active_links: string;
      object_path: string;
    }>(
      `select qv.status, qv.pdf_status, qv.pdf_file_id, qv.pdf_content_fingerprint,
              f.lifecycle_state, f.object_path,
              (select count(*)::text from public.file_links fl
                where fl.owner_id = qv.id and fl.file_id = f.id and fl.purpose = 'quote_pdf'
                  and fl.archived_at is null) as active_links
         from public.quote_versions qv join public.files f on f.id = qv.pdf_file_id
        where qv.id = $1`,
      [draft.versionId],
    );
    expect(before).toHaveLength(1);
    const bytes = await downloadBytes(serviceStorage, before[0]!.object_path);

    const rejected = await runCommand(generateQuotePdf, {
      client: adminA as never,
      input: { quote_version_id: draft.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(rejected).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });

    const after = await adminQuery<{
      status: string;
      pdf_status: string;
      pdf_file_id: string;
      pdf_content_fingerprint: string;
      lifecycle_state: string;
      active_links: string;
      object_path: string;
    }>(
      `select qv.status, qv.pdf_status, qv.pdf_file_id, qv.pdf_content_fingerprint,
              f.lifecycle_state, f.object_path,
              (select count(*)::text from public.file_links fl
                where fl.owner_id = qv.id and fl.file_id = f.id and fl.purpose = 'quote_pdf'
                  and fl.archived_at is null) as active_links
         from public.quote_versions qv join public.files f on f.id = qv.pdf_file_id
        where qv.id = $1`,
      [draft.versionId],
    );
    expect(after).toEqual(before);
    expect(await downloadBytes(serviceStorage, before[0]!.object_path)).toEqual(bytes);
  });

  it("[P0] completion rejects metadata-only uploads and Storage MIME/size/checksum mismatches", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const cases: Array<{
      name: string;
      setup: (expectedFileId: string) => Promise<unknown>;
    }> = [
      {
        name: "missing Storage object",
        setup: async (expectedFileId) => insertExpectedPdf({ expectedFileId, omitStorageObject: true }),
      },
      {
        name: "Storage MIME mismatch",
        setup: async (expectedFileId) => insertExpectedPdf({
          expectedFileId,
          storageMimeType: "application/octet-stream",
        }),
      },
      {
        name: "Storage size mismatch",
        setup: async (expectedFileId) => insertExpectedPdf({ expectedFileId, sizeBytes: 0 }),
      },
      {
        name: "non-SHA-256 metadata checksum",
        setup: async (expectedFileId) => insertExpectedPdf({ expectedFileId, checksum: "not-a-sha256" }),
      },
    ];
    for (const scenario of cases) {
      const draft = await seedDraft(fixture.tenantA.id, scenario.name);
      const expectedFileId = await startRender(draft.versionId);
      await scenario.setup(expectedFileId);
      expect((await completeRender(draft.versionId, expectedFileId)).error?.code, scenario.name).toBe("PFD10");
    }
  });

  it("[P0] customer-visible parent, line, attachment, and child reparent edits cancel in-flight renders", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const parent = await seedDraft(fixture.tenantA.id, "parent-edit");
    await startRender(parent.versionId);
    await adminQuery(`update public.quote_versions set intro_text = 'edited' where id = $1`, [parent.versionId]);
    await expectInvalidated(parent.versionId);

    const line = await seedLegacyDraft("line-edit");
    const lineId = await adminInsertQuoteVersionLine({
      tenant_id: fixture.tenantA.id,
      quote_version_id: line.versionId,
      label: "before",
    });
    await startRender(line.versionId);
    await adminQuery(`update public.quote_version_lines set label = 'after' where id = $1`, [lineId]);
    await expectInvalidated(line.versionId);

    const attachment = await seedLegacyDraft("attachment-edit");
    const attachmentFile = await adminInsertFile({
      tenant_id: fixture.tenantA.id,
      display_name: "attachment.pdf",
      lifecycle_state: "linked",
    });
    await startRender(attachment.versionId);
    await adminQuery(
      `insert into public.quote_version_attachments
         (tenant_id, quote_version_id, file_id, display_name, sort_order)
       values ($1, $2, $3, 'attachment.pdf', 0)`,
      [fixture.tenantA.id, attachment.versionId, attachmentFile],
    );
    await expectInvalidated(attachment.versionId);

    // V2 children are frozen immediately after their atomic creation. Reparenting
    // therefore uses historical V1 drafts, whose editable-child behavior remains
    // supported and is the actual invalidation boundary under test.
    const source = await seedLegacyDraft("reparent-source");
    const target = await seedLegacyDraft("reparent-target");
    const movingLine = await adminInsertQuoteVersionLine({
      tenant_id: fixture.tenantA.id,
      quote_version_id: source.versionId,
      label: "move me",
    });
    await Promise.all([startRender(source.versionId), startRender(target.versionId)]);
    await adminQuery(`update public.quote_version_lines set quote_version_id = $2 where id = $1`, [
      movingLine,
      target.versionId,
    ]);
    await Promise.all([expectInvalidated(source.versionId), expectInvalidated(target.versionId)]);
  });

  it("[P0] stale completion cannot activate a correctly uploaded but invalidated render identity", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "stale-complete");
    const expectedFileId = await startRender(draft.versionId);
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId });
    await adminQuery(`update public.quote_versions set customer_notes = 'changed while rendering' where id = $1`, [
      draft.versionId,
    ]);
    const completion = await completeRender(draft.versionId, expectedFileId);
    expect(completion.error?.code).toBe("PFD10");
    await expectInvalidated(draft.versionId);
  });

  it("[P0] a failed unlinked reservation stays archived as quote_pdf and cannot be mutated or revived", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "failed-reservation");
    const expectedFileId = await startRender(draft.versionId);
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId });
    expect((await failRender(draft.versionId, expectedFileId)).error).toBeNull();

    const before = await adminQuery<{
      artifact_kind: string | null;
      lifecycle_state: string;
      archived_at: string | null;
      object_path: string;
    }>(
      `select artifact_kind, lifecycle_state, archived_at::text, object_path from public.files where id = $1`,
      [expectedFileId],
    );
    expect(before[0]).toMatchObject({ artifact_kind: "quote_pdf", lifecycle_state: "archived" });
    expect(before[0]?.archived_at).not.toBeNull();

    const identityMutation = await adminA
      .from("files")
      .update({ object_path: `${fixture.tenantA.id}/${expectedFileId}/tampered.pdf` })
      .eq("id", expectedFileId)
      .select();
    expect(identityMutation.error?.code).toBe("42501");
    const revival = await adminA
      .from("files")
      .update({ lifecycle_state: "draft", archived_at: null })
      .eq("id", expectedFileId)
      .select();
    expect(revival.error?.code).toBe("42501");
    const after = await adminQuery<{
      artifact_kind: string | null;
      lifecycle_state: string;
      archived_at: string | null;
      object_path: string;
    }>(
      `select artifact_kind, lifecycle_state, archived_at::text, object_path from public.files where id = $1`,
      [expectedFileId],
    );
    expect(after[0]).toEqual(before[0]);
  });

  it("[P0] invalidating a reserved render archives its identity and blocks mutation, revival, and Storage upsert", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "invalidated-reservation");
    const expectedFileId = await startRender(draft.versionId);
    // Seed the initial immutable bytes before invalidation so the late-upsert proof
    // can verify that archival retains, but cannot replace, the existing object.
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId });
    await adminQuery(`update public.quote_versions set customer_notes = 'invalidate reservation' where id = $1`, [
      draft.versionId,
    ]);
    await expectInvalidated(draft.versionId);

    const before = await adminQuery<{ artifact_kind: string | null; lifecycle_state: string; object_path: string }>(
      `select artifact_kind, lifecycle_state, object_path from public.files where id = $1`,
      [expectedFileId],
    );
    expect(before[0]).toEqual({
      artifact_kind: "quote_pdf",
      lifecycle_state: "archived",
      object_path: `${fixture.tenantA.id}/${expectedFileId}/quote.pdf`,
    });
    const identityMutation = await adminA
      .from("files")
      .update({ checksum: "a".repeat(64) })
      .eq("id", expectedFileId)
      .select();
    expect(identityMutation.error?.code).toBe("42501");
    const revival = await adminA
      .from("files")
      .update({ lifecycle_state: "linked", archived_at: null })
      .eq("id", expectedFileId)
      .select();
    expect(revival.error?.code).toBe("42501");
    const objectPath = `${fixture.tenantA.id}/${expectedFileId}/quote.pdf`;
    const original = await adminA.storage.from("tenant-files").download(objectPath);
    expect(original.error).toBeNull();
    expect(original.data).not.toBeNull();
    const originalBytes = new Uint8Array(await original.data!.arrayBuffer());
    const upsert = await adminA.storage
      .from("tenant-files")
      .upload(objectPath, new TextEncoder().encode("late upload"), {
        contentType: "application/pdf",
        upsert: true,
      });
    expect(upsert.error).not.toBeNull();
    const retained = await adminA.storage.from("tenant-files").download(objectPath);
    expect(retained.error).toBeNull();
    expect(new Uint8Array(await retained.data!.arrayBuffer())).toEqual(originalBytes);
    const after = await adminQuery<{ artifact_kind: string | null; lifecycle_state: string; object_path: string }>(
      `select artifact_kind, lifecycle_state, object_path from public.files where id = $1`,
      [expectedFileId],
    );
    expect(after[0]).toEqual(before[0]);
  });

  it("[P0] invalidation before reservation rejects the reservation RPC and creates no file row", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "invalidated-before-reservation");
    const expectedFileId = await startRender(draft.versionId);
    await adminQuery(`update public.quote_versions set customer_notes = 'invalidate first' where id = $1`, [draft.versionId]);
    const bytes = new TextEncoder().encode(`quote-pdf:${expectedFileId}`);
    const reservation = await adminA.rpc("reserve_quote_pdf_file", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: draft.versionId,
      p_file_id: expectedFileId,
      p_object_path: `${fixture.tenantA.id}/${expectedFileId}/quote.pdf`,
      p_display_name: "quote.pdf",
      p_size_bytes: bytes.byteLength,
      p_checksum: createHash("sha256").update(bytes).digest("hex"),
      p_actor_user_id: fixture.adminA.id,
    });
    expect(reservation.error?.code).toBe("PFD10");
    const rows = await adminQuery<{ id: string }>(`select id from public.files where id = $1`, [expectedFileId]);
    expect(rows).toEqual([]);
  });

  it("[P0] send refuses missing, stale, archived-file, archived-link, and missing-Storage PDF states", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const missing = await seedDraft(fixture.tenantA.id, "missing-send");
    const missingResult = await sendDraft(missing);
    expect(missingResult.error?.code).toBe("PFD10");

    const stale = await generatedDraft("stale-send");
    await adminQuery(`update public.quote_versions set pdf_content_fingerprint = 'stale' where id = $1`, [stale.versionId]);
    const staleResult = await sendDraft(stale);
    expect(staleResult.error?.code).toBe("PFD10");

    const archivedFile = await generatedDraft("archived-file-send");
    await adminQuery(`update public.files set lifecycle_state = 'archived', archived_at = statement_timestamp() where id = $1`, [
      archivedFile.fileId,
    ]);
    const archivedFileResult = await sendDraft(archivedFile);
    expect(archivedFileResult.error?.code).toBe("PFD10");

    const archivedLink = await generatedDraft("archived-link-send");
    await adminQuery(
      `update public.file_links set archived_at = statement_timestamp()
        where owner_id = $1 and file_id = $2 and purpose = 'quote_pdf' and archived_at is null`,
      [archivedLink.versionId, archivedLink.fileId],
    );
    const archivedLinkResult = await sendDraft(archivedLink);
    expect(archivedLinkResult.error?.code).toBe("PFD10");

    const missingStorage = await generatedDraft("missing-storage-send");
    const missingStoragePath = `${fixture.tenantA.id}/${missingStorage.fileId}/quote.pdf`;
    await adminRemoveStorageObject({ bucket: "tenant-files", objectPath: missingStoragePath });
    const missingStorageResult = await sendDraft(missingStorage);
    expect(missingStorageResult.error?.code).toBe("PFD10");
  });

  it("[P0] Storage object replacement is denied after PDF completion and after send", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const completed = await generatedDraft("immutable-after-complete");
    const completedPath = `${fixture.tenantA.id}/${completed.fileId}/quote.pdf`;
    const overwriteCompleted = await adminA.storage
      .from("tenant-files")
      .upload(completedPath, new TextEncoder().encode("replacement"), {
        contentType: "application/pdf",
        upsert: true,
      });
    expect(overwriteCompleted.error).not.toBeNull();

    const sent = await generatedDraft("immutable-after-send");
    expect((await sendDraft(sent)).error).toBeNull();
    const sentPath = `${fixture.tenantA.id}/${sent.fileId}/quote.pdf`;
    const overwriteSent = await adminA.storage
      .from("tenant-files")
      .upload(sentPath, new TextEncoder().encode("replacement"), {
        contentType: "application/pdf",
        upsert: true,
      });
    expect(overwriteSent.error).not.toBeNull();
  });

  it("[P0] a linked quote-PDF row with no object cannot receive a late first upload", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const fileId = crypto.randomUUID();
    const objectPath = `${fixture.tenantA.id}/${fileId}/late.pdf`;
    const bytes = new TextEncoder().encode("late quote PDF bytes");
    await adminInsertFile({
      id: fileId,
      tenant_id: fixture.tenantA.id,
      display_name: "late.pdf",
      object_path: objectPath,
      mime_type: "application/pdf",
      size_bytes: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      artifact_kind: "quote_pdf",
      uploaded_by: fixture.adminA.id,
      lifecycle_state: "linked",
    });

    const lateUpload = await adminA.storage
      .from("tenant-files")
      .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
    expectStorageImmutabilityDenied(lateUpload.error);
    const absent = await serviceStorage.storage.from("tenant-files").download(objectPath);
    expect(absent.error).not.toBeNull();
    expect(absent.data).toBeNull();
  });

  it("[P0] final send rejects a forged PDF-byte HMAC without consuming review authority", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await generatedDraft("forged-send-hmac");
    const correlationId = crypto.randomUUID();
    const authorization = await adminQuery<{ id: string }>(
      `insert into public.quote_review_authorizations (
         tenant_id, actor_user_id, purpose, quote_id, target_quote_version_id,
         source_revision, correlation_id, expires_at
       ) values (
         $1, $2, 'final_send', $3, $4,
         public.story_10_8_quote_version_source_revision($1, $4), $5,
         statement_timestamp() + interval '15 minutes'
       ) returning id`,
      [fixture.tenantA.id, fixture.adminA.id, draft.quoteId, draft.versionId, correlationId],
    );
    const authorizationId = authorization[0]?.id;
    if (!authorizationId) throw new Error("send authorization seed returned no id");
    const valid = await quotePdfSendAttestation({
      client: adminA,
      tenantId: fixture.tenantA.id,
      quoteVersionId: draft.versionId,
      actorUserId: fixture.adminA.id,
      correlationId,
    });
    const rejected = await adminA.rpc("mark_quote_version_sent", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: draft.versionId,
      p_authorization_id: authorizationId,
      p_sent_at: FINISHED_AT,
      p_channel: null,
      p_reference: null,
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: correlationId,
      ...valid,
      p_attestation_signature: "0".repeat(64),
    });
    expect(rejected.error?.code).toBe("PFD10");
    const unchanged = await adminQuery<{ status: string; consumed_at: string | null }>(
      `select qv.status, qra.consumed_at::text
         from public.quote_versions qv
         join public.quote_review_authorizations qra on qra.id = $2
        where qv.id = $1`,
      [draft.versionId, authorizationId],
    );
    expect(unchanged).toEqual([{ status: "draft", consumed_at: null }]);
  });

  it("[P0] the Storage immutability trigger rejects privileged upsert:true for reserved and completed quote PDFs without changing bytes", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const reservedDraft = await seedDraft(fixture.tenantA.id, "service-upsert-reserved");
    const reservedFileId = await startRender(reservedDraft.versionId);
    await reserveExpectedPdf({ versionId: reservedDraft.versionId, expectedFileId: reservedFileId });

    const completed = await generatedDraft("service-upsert-completed");
    for (const fileId of [reservedFileId, completed.fileId]) {
      const objectPath = `${fixture.tenantA.id}/${fileId}/quote.pdf`;
      const original = await downloadBytes(serviceStorage, objectPath);
      const replaced = await serviceStorage.storage
        .from("tenant-files")
        .upload(objectPath, new TextEncoder().encode(`privileged replacement:${fileId}`), {
          contentType: "application/pdf",
          upsert: true,
        });
      expectStorageImmutabilityDenied(replaced.error);
      expect(await downloadBytes(serviceStorage, objectPath)).toEqual(original);
    }
  });

  it("[P0] metadata reservation denies a Storage overwrite before completion", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await seedDraft(fixture.tenantA.id, "reserved-identity");
    const expectedFileId = await startRender(draft.versionId);
    await reserveExpectedPdf({ versionId: draft.versionId, expectedFileId });
    const objectPath = `${fixture.tenantA.id}/${expectedFileId}/quote.pdf`;
    const overwrite = await adminA.storage
      .from("tenant-files")
      .upload(objectPath, new TextEncoder().encode("replacement"), {
        contentType: "application/pdf",
        upsert: true,
      });
    expect(overwrite.error).not.toBeNull();
    expect((await completeRender(draft.versionId, expectedFileId)).error).toBeNull();
  });

  it("[P0] completed-but-unsent quote PDFs cannot be mutated, retagged, hard-deleted, or lost from Storage", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const draft = await generatedDraft("locked-identity");
    const before = await adminQuery<{
      object_path: string;
      checksum: string | null;
      artifact_kind: string | null;
      lifecycle_state: string;
    }>(
      `select object_path, checksum, artifact_kind, lifecycle_state from public.files where id = $1`,
      [draft.fileId],
    );
    expect(before[0]?.lifecycle_state).toBe("linked");
    expect(before[0]?.artifact_kind).toBe("quote_pdf");

    const objectPathMutation = await adminA
      .from("files")
      .update({ object_path: `${fixture.tenantA.id}/${draft.fileId}/tampered.pdf` })
      .eq("id", draft.fileId)
      .select();
    expect(objectPathMutation.error?.code).toBe("42501");

    const checksumMutation = await adminA
      .from("files")
      .update({ checksum: "a".repeat(64) })
      .eq("id", draft.fileId)
      .select();
    expect(checksumMutation.error?.code).toBe("42501");

    const artifactKindMutation = await adminA
      .from("files")
      .update({ artifact_kind: null })
      .eq("id", draft.fileId)
      .select();
    expect(artifactKindMutation.error?.code).toBe("42501");

    // The privileged SQL path bypasses app RLS, so this proves the BEFORE DELETE trigger
    // itself (rather than only the authenticated no-DELETE policy) rejects hard deletion.
    const hardDeleteError = await adminQuery(
      `delete from public.files where id = $1`,
      [draft.fileId],
    ).then(
      () => null,
      (error: unknown) => error as { code?: string },
    );
    expect(hardDeleteError?.code).toBe("FL823");

    const after = await adminQuery<{
      object_path: string;
      checksum: string | null;
      artifact_kind: string | null;
      lifecycle_state: string;
    }>(
      `select object_path, checksum, artifact_kind, lifecycle_state from public.files where id = $1`,
      [draft.fileId],
    );
    expect(after[0]).toEqual(before[0]);
    const retained = await adminA.storage.from("tenant-files").download(
      `${fixture.tenantA.id}/${draft.fileId}/quote.pdf`,
    );
    expect(retained.error).toBeNull();
    expect(retained.data).not.toBeNull();
  });

  it("[P0] start, completion, and failure lifecycle/audit timestamps are DB-owned", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const completeDraft = await seedDraft(fixture.tenantA.id, "audit-complete");
    const startCorrelation = crypto.randomUUID();
    const expectedFileId = await startRender(completeDraft.versionId, startCorrelation);
    await reserveExpectedPdf({ versionId: completeDraft.versionId, expectedFileId });
    const completeCorrelation = startCorrelation;
    expect((await completeRender(completeDraft.versionId, expectedFileId, completeCorrelation)).error).toBeNull();

    const failDraft = await seedDraft(fixture.tenantA.id, "audit-fail");
    const failCorrelation = crypto.randomUUID();
    const failStart = await startRender(failDraft.versionId, failCorrelation);
    expect((await failRender(failDraft.versionId, failStart)).error).toBeNull();

    const audit = await adminQuery<{
      correlation_id: string;
      actor_user_id: string;
      command: string;
      event_type: string;
       timestamp_policy: boolean;
    }>(
      `select correlation_id::text, actor_user_id::text, command, event_type,
              created_at <> all(array[$4::timestamptz, $5::timestamptz])
                and created_at >= statement_timestamp() - interval '5 minutes'
                and created_at <= statement_timestamp() + interval '1 second' as timestamp_policy
         from public.audit_events
        where correlation_id = any($1::uuid[])
          and actor_user_id = $2::uuid and target_id = any($3::uuid[])
        order by command, correlation_id`,
      [[startCorrelation, completeCorrelation, failCorrelation], fixture.adminA.id, [completeDraft.versionId, failDraft.versionId], STARTED_AT, FINISHED_AT],
    );
    expect(audit).toEqual(expect.arrayContaining([
      { correlation_id: startCorrelation, actor_user_id: fixture.adminA.id, command: "quote.pdf.render.start", event_type: "quote.pdf.render_started", timestamp_policy: true },
      { correlation_id: completeCorrelation, actor_user_id: fixture.adminA.id, command: "quote.pdf.render.complete", event_type: "quote.pdf.generated", timestamp_policy: true },
      { correlation_id: failCorrelation, actor_user_id: fixture.adminA.id, command: "quote.pdf.render.start", event_type: "quote.pdf.render_started", timestamp_policy: true },
      { correlation_id: failCorrelation, actor_user_id: fixture.adminA.id, command: "quote.pdf.render.fail", event_type: "quote.pdf.failed", timestamp_policy: true },
    ]));
    expect(audit).toHaveLength(4);
  });
});
