/**
 * Story 6.3 — 6.3-INT-02 (P0, AC3): PDF STORAGE PRIVACY through the 8.1 file foundation.
 *
 * The generated PDF is a PRIVATE customer-facing document (HIGH security impact). This proves:
 *   - it is stored via the 8.1 foundation (private `tenant-files` bucket, SERVER-derived
 *     tenant-first object path via `deriveObjectPath` — no client path trusted);
 *   - a `files` metadata row + a `file_links` row (`owner_type='quote_version'`,
 *     `owner_id=<quote_version_id>`, `purpose='quote_pdf'`) are written, PLUS a `quote_events`
 *     lifecycle row + an `audit_events` row (allow-listed `{ targetId }` only);
 *   - a CROSS-TENANT and an ANON attempt to access the PDF file/metadata is REJECTED
 *     (generic access-denied — no cross-tenant existence leak); NO public URL surface;
 *   - the upload + signing run on the per-request RLS client (anon key — NEVER service-role);
 *   - a foreign quote_version_id → TENANT_ACCESS_DENIED before any render/upload.
 *
 * ── GREEN (Story 6.3, Task 4) ─────────────────────────────────────────────────────────
 * `generateQuotePdf` + its upload/metadata pipeline have landed. LOCAL stack + Storage only
 * (db reset + health poll); `skipUnlessStack`/`skipUnlessStorage` visible-skip a stack-down run;
 * CI hard-fails (SUPABASE_TEST_REQUIRED=1).
 *
 * [Source: test-design-epic-6.md#6.3-INT-02, R-611/R-614; story 6.3 Task 4.2/4.3 + Task 6.2;
 *  architecture.md#12/#14; src/server/storage/{object-path,signed-access}.ts;
 *  supabase/migrations/20260704120000_file_storage_foundation.sql;
 *  tests/integration/commands/file-signed-access.int.test.ts (the 8.1 storage-privacy precedent)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertRow,
  adminInsertQuoteTerms,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionLine,
  adminSelectQuoteVersionPdfColumns,
  adminSelectFileById,
  adminSelectPdfFileLinks,
  adminSelectQuoteEventsForVersion,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable, isLocalStorageReachable } from "../../support/test-env";
import {
  skipUnlessStack,
  skipUnlessStorage,
  type SkippableTestContext,
} from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { generateQuotePdf } from "@/server/commands/quotes";
import { createSignedFileAccess } from "@/server/commands/files";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-05T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // Tenant A admin (the generator)
let b: TestServerClient; // Tenant B admin (the cross-tenant intruder)
let anon: TestServerClient; // unauthenticated client

function skipUnlessBoth(ctx: SkippableTestContext): boolean {
  if (skipUnlessStack(ctx, stackUp)) return true;
  return skipUnlessStorage(ctx, storageUp);
}

/** Seed a REAL own-tenant frozen version (customer→calc→rows→version) for Tenant A. */
async function seedSnapshottedVersion(tenantId: string): Promise<string> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "private",
    display_name: "Kund Kundsson",
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: "PDF-kalkyl",
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    quote_number: 1001,
    customer_display_name: "Kund Kundsson",
    company_name: "Elpro Demo AB",
  });
  const sectionId = await adminInsertSection({
    tenant_id: tenantId,
    calculation_id: calcId,
    title: "Arbete",
  });
  await adminInsertRow({
    tenant_id: tenantId,
    section_id: sectionId,
    row_type: "labor",
    quantity: 2,
    unit: "h",
    unit_cost_ore: 45000,
    unit_sell_ore: 85000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  // Seed a line snapshot so the PDF has customer-visible content.
  await adminInsertQuoteVersionLine({
    tenant_id: tenantId,
    quote_version_id: versionId,
    row_type: "labor",
    label: "Elarbete",
    quantity: 2,
    unit: "h",
    unit_sell_ore: 85000,
    line_net_ore: 170000,
    vat_rate_bp: 2500,
    sort_order: 0,
  });
  return versionId;
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  storageUp = await isLocalStorageReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  b = await makeAuthedServerClient(fixture.adminB);
  anon = await makeAnonServerClient();
  await adminInsertQuoteTerms({
    tenant_id: fixture.tenantA.id,
    terms_text: "Villkor (platshållartext).",
  });
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("generateQuotePdf — storage privacy (AC3, 6.3-INT-02)", () => {
  it("[P0] the PDF is stored via the 8.1 foundation with files/file_links + quote_event + audit, all consistent", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();
    const gen = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId,
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    const fileId = gen.data.fileId;

    // A `files` row — mime='application/pdf', private bucket, server-derived tenant-first path.
    const file = await adminSelectFileById(fileId);
    expect(file).not.toBeNull();
    expect(file?.mime_type).toBe("application/pdf");
    expect(file?.bucket_id).toBe("tenant-files");
    expect(file?.object_path.startsWith(`${fixture.tenantA.id}/${fileId}/`)).toBe(true);
    expect(file?.tenant_id).toBe(fixture.tenantA.id);

    // A `file_links` row — owner_type='quote_version', owner_id=version, purpose='quote_pdf'.
    const links = await adminSelectPdfFileLinks(versionId);
    expect(links.length).toBe(1);
    expect(links[0].owner_type).toBe("quote_version");
    expect(links[0].purpose).toBe("quote_pdf");
    expect(links[0].file_id).toBe(fileId);

    // A `quote_events` row (pdf_generated).
    const events = await adminSelectQuoteEventsForVersion(versionId);
    expect(events.some((e) => e.event_type === "pdf_generated")).toBe(true);

    // An `audit_events` row with allow-listed metadata ONLY ({ targetId }; no PII/money/URL).
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0].target_id).toBe(versionId);
    const meta = JSON.stringify(audits[0].metadata ?? {});
    expect(meta).not.toContain("http"); // no signed URL logged
    expect(meta).not.toContain(file?.object_path ?? "OBJECT_PATH");

    // The render columns: pdf_status='generated', pdf_file_id set, pdf_generated_at = injected.
    const cols = await adminSelectQuoteVersionPdfColumns(versionId);
    expect(cols?.pdf_status).toBe("generated");
    expect(cols?.pdf_file_id).toBe(fileId);
    expect(cols?.pdf_generated_at).toBe(FIXED_ISO);
  });

  it("[P0] a CROSS-TENANT caller cannot read the PDF file/metadata (generic access-denied, no existence leak)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    const gen = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    // Tenant B attempts createSignedFileAccess on A's file id → generic denial (no existence leak).
    const denied = await runCommand(createSignedFileAccess, {
      client: b as never,
      input: { file_id: gen.data.fileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("TENANT_ACCESS_DENIED");
      // No SQL / tenant-existence / object-path signal in the user-facing message.
      expect(denied.message).not.toContain(fixture.tenantA.id);
      expect(denied.message).not.toContain("23503");
    }
  });

  it("[P0] an ANON caller cannot read the PDF file/metadata; there is NO public URL surface", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    const gen = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    // An unauthenticated client is rejected (no active membership → not authorized).
    const anonRes = await runCommand(createSignedFileAccess, {
      client: anon as never,
      input: { file_id: gen.data.fileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(anonRes.ok).toBe(false);

    // The owning caller CAN mint a SHORT-LIVED SIGNED URL (never a public URL).
    const signed = await runCommand(createSignedFileAccess, {
      client: a as never,
      input: { file_id: gen.data.fileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(signed.ok).toBe(true);
    if (signed.ok) {
      // A signed URL carries a token/expiry query — it is NOT a bare public object URL.
      expect(signed.data.signedUrl).toMatch(/token=|sign|Expires/i);
    }
  });

  it("[P0] a foreign quote_version_id → TENANT_ACCESS_DENIED before any render/upload (envelope ownership gate)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    // A REAL Tenant B version (existing but A-invisible) — never a non-existent id.
    const bVersionId = await seedSnapshottedVersion(fixture.tenantB.id);
    const res = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: bVersionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TENANT_ACCESS_DENIED");
    // Nothing was rendered/uploaded/persisted for the foreign version under A.
    const cols = await adminSelectQuoteVersionPdfColumns(bVersionId);
    expect(cols?.pdf_status).toBe("not_generated");
    expect(cols?.pdf_file_id).toBeNull();
  });
});
