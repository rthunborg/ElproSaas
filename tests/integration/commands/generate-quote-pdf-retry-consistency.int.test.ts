/**
 * Story 6.3 — 6.3-INT-04 (P1, AC2/AC3): RETRY + CONSISTENCY (R-613).
 *
 * RETRY regenerates from the SAME immutable snapshot and MUST NOT change any customer-visible
 * snapshot data — it only produces a fresh PDF object + metadata. Retry is allowed for DRAFT
 * AND SENT versions (the PDF is DERIVED from the frozen snapshot, not customer-visible
 * commitment data — 6.3 does NOT introduce the 6.4 sent-lock trigger).
 *
 * CONSISTENCY: a mid-pipeline (render/storage/metadata) failure must NOT leave
 * `pdf_status='generated'` over a MISSING file — it sets `pdf_status='failed'` (retryable) and
 * returns a generic retryable `SERVER_ERROR` (never conflated with a not-authorized denial). A
 * double-submit retry must NOT duplicate the `file_links` row (find-or-create / re-point — R-814).
 *
 * ── GREEN (Story 6.3, Task 4.3) ──────────────────────────────────────────────────────
 * `generateQuotePdf` + its consistency/retry pipeline have landed. The mid-pipeline fault is
 * injected via a PROXY client whose `storage.upload` returns an error (a deterministic seam —
 * no mocking of internals). LOCAL stack + Storage only; visible-skip when down; CI hard-fails.
 *
 * [Source: test-design-epic-6.md#6.3-INT-04, R-613; story 6.3 Task 4.3 + Task 6.2;
 *  architecture.md#12; deferred-work.md#8-1 (file_links find-or-create R-814; no reclamation)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertRow,
  adminInsertQuoteTerms,
  adminSelectStoredPdfBytes,
  adminSelectQuoteVersionPdfColumns,
  adminSelectPdfFileLinks,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable, isLocalStorageReachable } from "../../support/test-env";
import {
  skipUnlessStack,
  skipUnlessStorage,
  type SkippableTestContext,
} from "../../support/stack-gate";
import { extractPdfText } from "../../support/pdf-text";
import { runCommand } from "@/server/commands/envelope";
import {
  createQuoteVersionFromCalculation,
  generateQuotePdf,
} from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-05T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;

function skipUnlessBoth(ctx: SkippableTestContext): boolean {
  if (skipUnlessStack(ctx, stackUp)) return true;
  return skipUnlessStorage(ctx, storageUp);
}

/**
 * Wrap the real RLS client so `storage.from(bucket).upload(...)` returns an error — a
 * deterministic mid-pipeline fault at the object-write seam. Every other surface delegates to
 * the real client so the auth/ownership gates still run for real.
 */
function withFailingUpload(client: TestServerClient): TestServerClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "storage") {
        const realStorage = Reflect.get(target, prop, receiver);
        return {
          from(bucket: string) {
            const realBucket = realStorage.from(bucket);
            return new Proxy(realBucket, {
              get(bt, bp, br) {
                if (bp === "upload") {
                  return async () => ({
                    data: null,
                    error: { message: "injected upload fault" },
                  });
                }
                return Reflect.get(bt, bp, br);
              },
            });
          },
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as TestServerClient;
}

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
  const created = await runCommand(createQuoteVersionFromCalculation, {
    client: a as never,
    input: { calculation_id: calcId },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
  if (!created.ok) throw new Error(`seed create version failed: ${created.code}`);
  return created.data.targetId;
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  storageUp = await isLocalStorageReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  await adminQuery(
    `insert into public.company_settings
       (tenant_id, company_name, org_nr, address_line1, postal_code, city, email, phone, default_vat_display, vat_rate_bp)
     values ($1,'Elpro Demo AB','556000-1234','Testgatan 1','12345','Teststad','info@example.test','070-0000000','company_togglable',2500)`,
    [fixture.tenantA.id],
  );
  await adminInsertQuoteTerms({
    tenant_id: fixture.tenantA.id,
    terms_text: "Villkor (platshållartext).",
  });
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("generateQuotePdf — retry + consistency (AC2/AC3, 6.3-INT-04)", () => {
  it("[P1] a RETRY regenerates from the same immutable snapshot WITHOUT changing customer-visible data", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);

    const first = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    const textBefore = await extractPdfText(
      (await adminSelectStoredPdfBytes(versionId)) as Uint8Array,
    );
    const versionRowBefore = await adminQuery(
      `select base_total_ore, accepted_price_ore, customer_display_name from public.quote_versions where id = $1`,
      [versionId],
    );

    const retry = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(retry.ok).toBe(true);
    const textAfter = await extractPdfText(
      (await adminSelectStoredPdfBytes(versionId)) as Uint8Array,
    );
    const versionRowAfter = await adminQuery(
      `select base_total_ore, accepted_price_ore, customer_display_name from public.quote_versions where id = $1`,
      [versionId],
    );

    // The PDF text is unchanged AND the frozen snapshot commitment columns are byte-identical
    // (retry touches ONLY the PDF-render columns pdf_status/pdf_file_id/pdf_generated_at).
    expect(textAfter).toBe(textBefore);
    expect(versionRowAfter).toEqual(versionRowBefore);
  });

  it("[P1] retry is allowed on a SENT version (PDF is derived, not commitment) — no sent-lock trigger in 6.3", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    // Flip the version to `sent` (6.3 introduces no sent-lock; retry must still succeed).
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
      versionId,
    ]);
    const gen = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(gen.ok).toBe(true);
    const cols = await adminSelectQuoteVersionPdfColumns(versionId);
    expect(cols?.pdf_status).toBe("generated");
    // The status stays 'sent' — only the render columns changed.
    const statusRow = await adminQuery<{ status: string }>(
      `select status from public.quote_versions where id = $1`,
      [versionId],
    );
    expect(statusRow[0].status).toBe("sent");
  });

  it("[P1] a mid-pipeline failure leaves a CONSISTENT retryable state (pdf_status='failed', no generated-over-missing-file)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);

    // Inject a storage-upload fault → the pipeline must fail-compensate to pdf_status='failed'.
    const failed = await runCommand(generateQuotePdf, {
      client: withFailingUpload(a) as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      // A transient infra fault → retryable SERVER_ERROR, NEVER a permanent access denial.
      expect(failed.code).toBe("SERVER_ERROR");
    }
    const cols = await adminSelectQuoteVersionPdfColumns(versionId);
    expect(cols?.pdf_status).toBe("failed"); // retryable, never 'generated' over a missing file
    expect(cols?.pdf_file_id).toBeNull();
    // No object was stored → the readback is null (no generated-over-missing-file).
    expect(await adminSelectStoredPdfBytes(versionId)).toBeNull();

    // A subsequent (real) retry SUCCEEDS from the same snapshot.
    const retry = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(retry.ok).toBe(true);
    const cols2 = await adminSelectQuoteVersionPdfColumns(versionId);
    expect(cols2?.pdf_status).toBe("generated");
    expect(cols2?.pdf_file_id).not.toBeNull();
  });

  it("[P1] a repeated retry does NOT duplicate a file_links row for the same version (R-814 find-or-create)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    for (let i = 0; i < 3; i += 1) {
      const gen = await runCommand(generateQuotePdf, {
        client: a as never,
        input: { quote_version_id: versionId },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(gen.ok).toBe(true);
    }
    // Exactly ONE live quote_pdf file_link per version+purpose (the link is re-pointed, not
    // duplicated — the superseded prior objects are left/archived, not reclaimed).
    const links = await adminSelectPdfFileLinks(versionId);
    expect(links.length).toBe(1);
  });
});
