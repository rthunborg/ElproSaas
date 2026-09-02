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
import { createHash } from "node:crypto";

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
  adminSelectStoredPdfBytes,
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

/**
 * Make the completion RPC commit through the real client, then simulate a response lost after
 * PostgreSQL committed. Every other surface remains the real request-bound RLS client.
 */
function withLostCompletionResponse(client: TestServerClient): TestServerClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "rpc") {
        return async (fn: string, args: unknown) => {
          const result = await (target as unknown as {
            rpc(name: string, params: unknown): Promise<unknown>;
          }).rpc(fn, args);
          if (fn === "complete_quote_pdf_render") {
            throw new Error("injected completion response lost after commit");
          }
          return result;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as TestServerClient;
}

/** Record the real command's reservation/upload ordering without replacing either operation. */
function withPdfPipelineEventLog(
  client: TestServerClient,
  eventLog: string[],
): TestServerClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "rpc") {
        return async (fn: string, args: unknown) => {
          eventLog.push(`rpc:${fn}`);
          return (target as unknown as {
            rpc(name: string, params: unknown): Promise<unknown>;
          }).rpc(fn, args);
        };
      }
      if (prop === "storage") {
        const realStorage = Reflect.get(target, prop, receiver) as {
          from(bucket: string): object;
        };
        return {
          from(bucket: string) {
            const realBucket = realStorage.from(bucket);
            return new Proxy(realBucket, {
              get(bucketTarget, bucketProp, bucketReceiver) {
                if (bucketProp === "upload") {
                  return async (path: string, body: Uint8Array, options: { upsert?: boolean }) => {
                    eventLog.push(`storage.upload:${options.upsert === false ? "upsert:false" : "other"}`);
                    return Reflect.apply(
                      Reflect.get(bucketTarget, bucketProp, bucketReceiver) as (...args: unknown[]) => unknown,
                      bucketTarget,
                      [path, body, options],
                    );
                  };
                }
                return Reflect.get(bucketTarget, bucketProp, bucketReceiver);
              },
            });
          },
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as TestServerClient;
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
    const dbClockBefore = Date.now();
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
    expect(file?.artifact_kind).toBe("quote_pdf");
    const storedBytes = await adminSelectStoredPdfBytes(versionId);
    expect(storedBytes).not.toBeNull();
    expect(file?.checksum).toBe(
      createHash("sha256").update(storedBytes as Uint8Array).digest("hex"),
    );

    // A `file_links` row — owner_type='quote_version', owner_id=version, purpose='quote_pdf'.
    const links = await adminSelectPdfFileLinks(versionId);
    expect(links.length).toBe(1);
    expect(links[0].owner_type).toBe("quote_version");
    expect(links[0].purpose).toBe("quote_pdf");
    expect(links[0].file_id).toBe(fileId);

    // A `quote_events` row (pdf_generated).
    const events = await adminSelectQuoteEventsForVersion(versionId);
    expect(events.some((e) => e.event_type === "pdf_generated")).toBe(true);

    // The start and completion lifecycle RPCs share one correlation and expose no sensitive
    // metadata (no PII/money/object path/URL) through either audit row.
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits).toHaveLength(2);
    // Audit timestamps can tie, so normalize to the semantic lifecycle rather than
    // treating the storage-read order as proof of the render sequence.
    const lifecycleOrder = ["quote.pdf.render.start", "quote.pdf.render.complete"];
    expect(
      audits
        .map((audit) => ({ command: audit.command, eventType: audit.event_type }))
        .sort(
          (left, right) =>
            lifecycleOrder.indexOf(left.command) - lifecycleOrder.indexOf(right.command),
        ),
    )
      .toEqual([
        { command: "quote.pdf.render.start", eventType: "quote.pdf.render_started" },
        { command: "quote.pdf.render.complete", eventType: "quote.pdf.generated" },
      ]);
    for (const audit of audits) {
      expect(audit.target_id).toBe(versionId);
      const meta = JSON.stringify(audit.metadata ?? {});
      expect(meta).not.toContain("http"); // no signed URL logged
      expect(meta).not.toContain(file?.object_path ?? "OBJECT_PATH");
    }

    // The render columns: pdf_status='generated', pdf_file_id set, pdf_generated_at = injected.
    const cols = await adminSelectQuoteVersionPdfColumns(versionId);
    expect(cols?.pdf_status).toBe("generated");
    expect(cols?.pdf_file_id).toBe(fileId);
    expect(cols?.pdf_generated_at).not.toBe(FIXED_ISO);
    const generatedAt = Date.parse(cols?.pdf_generated_at ?? "");
    expect(generatedAt).toBeGreaterThanOrEqual(dbClockBefore - 1_000);
    expect(generatedAt).toBeLessThanOrEqual(Date.now() + 1_000);
  });

  it("[P0] reserves metadata before its first non-upserting Storage upload", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    const eventLog: string[] = [];
    const gen = await runCommand(generateQuotePdf, {
      client: withPdfPipelineEventLog(a, eventLog) as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(gen.ok).toBe(true);
    const reserveIndex = eventLog.indexOf("rpc:reserve_quote_pdf_file");
    const firstUploadIndex = eventLog.findIndex((event) => event.startsWith("storage.upload:"));
    expect(reserveIndex).toBeGreaterThanOrEqual(0);
    expect(firstUploadIndex).toBeGreaterThan(reserveIndex);
    expect(eventLog[firstUploadIndex]).toBe("storage.upload:upsert:false");
  });

  it("[P0] a lost completion response returns recovered success without archiving the current PDF", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    const result = await runCommand(generateQuotePdf, {
      client: withLostCompletionResponse(a) as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const columns = await adminSelectQuoteVersionPdfColumns(versionId);
    expect(columns?.pdf_status).toBe("generated");
    expect(columns?.pdf_file_id).toBe(result.data.fileId);
    expect(columns?.pdf_file_id).not.toBeNull();
    const currentFile = await adminSelectFileById(columns?.pdf_file_id as string);
    expect(currentFile?.lifecycle_state).toBe("linked");
    expect(currentFile?.artifact_kind).toBe("quote_pdf");
    expect(await adminSelectStoredPdfBytes(versionId)).not.toBeNull();
    const events = await adminSelectQuoteEventsForVersion(versionId);
    expect(events.some((event) => event.event_type === "pdf_failed")).toBe(false);
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
