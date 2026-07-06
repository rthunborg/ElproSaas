/**
 * Story 6.3 — 6.3-INT-01 (P0, AC1): the CANONICAL Epic-6 negative — PDF SOURCE-OF-TRUTH.
 *
 * The single most important correctness proof of the story (R-606): PDF generation reads
 * ONLY the frozen snapshot rows (`quote_versions`/`quote_version_lines`/
 * `quote_version_attachments` + file metadata) — NEVER the mutable `customers`,
 * `company_settings`, `quote_terms`, `calculation_*`, `work_roles`, or `articles`.
 *
 * The proof is BEHAVIORAL: create a version, generate the PDF, then MUTATE every mutable
 * source class, REGENERATE, and assert the customer-visible PDF output (extracted text) is
 * UNCHANGED. A PDF that disagrees with the immutable commitment is the headline Epic-6 bug.
 *
 * ── GREEN (Story 6.3, Tasks 3/4) ─────────────────────────────────────────────────────
 * `generateQuotePdf`, the deterministic renderer, and the `pdfjs-dist` text extractor have
 * landed. Runs against the LOCAL Supabase stack + Storage only (after `supabase db reset` +
 * a `/auth/v1/health` 200 poll — the Kong 502 false-green trap); `skipUnlessStack` /
 * `skipUnlessStorage` visible-skip a stack-down run, and CI (`SUPABASE_TEST_REQUIRED=1`)
 * hard-fails so this core proof is never silently unproven.
 *
 * RAW pg READBACK COERCION: `bigint` öre returns as STRINGS + `timestamptz` as `Date` off the
 * raw superuser pool — coerce on readback. Per-run unique ids (`crypto.randomUUID()`).
 *
 * [Source: test-design-epic-6.md#6.3-INT-01, R-606; story 6.3 Task 4 + Task 6.2; architecture.md#12
 *  (PDF reads only the four snapshot sources); tests/integration/commands/quote-version.int.test.ts
 *  (the 6.1 fixture + envelope precedent this mirrors); epic-6 retro-notes#Story 6-1 (Kong 502 poll)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertRow,
  adminInsertWorkRole,
  adminInsertArticle,
  adminInsertQuoteTerms,
  adminSelectStoredPdfBytes,
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

/** Seed the FULL company identity for a tenant (all PDF fields). */
async function seedIdentity(tenantId: string, name: string): Promise<void> {
  await adminQuery(
    `insert into public.company_settings
       (tenant_id, company_name, org_nr, address_line1, address_line2, postal_code,
        city, email, phone, logo_url, default_vat_display, vat_rate_bp)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [tenantId, name, "556000-1234", "Testgatan 1", null, "12345", "Teststad",
      "info@example.test", "070-0000000", null, "company_togglable", 2500],
  );
}

/** Seed a REAL own-tenant customer→calc→section→rows source and create a frozen version. */
async function seedSnapshottedVersion(tenantId: string): Promise<string> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "private",
    display_name: "Kund Kundsson",
  });
  const facilityId = await adminInsertFacility({
    tenant_id: tenantId,
    customer_id: customerId,
    name: "Anlaggning A",
  });
  const contactId = await adminInsertContact({
    tenant_id: tenantId,
    customer_id: customerId,
    facility_id: facilityId,
    name: "Kontakt K",
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    facility_id: facilityId,
    contact_id: contactId,
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
  await seedIdentity(fixture.tenantA.id, "Elpro Demo AB");
  await adminInsertQuoteTerms({
    tenant_id: fixture.tenantA.id,
    terms_text: "Villkor (platshållartext) — ej godkänd",
  });
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("generateQuotePdf — PDF source-of-truth (AC1, 6.3-INT-01)", () => {
  it("[P0] mutating every mutable source AFTER the snapshot, then regenerating, leaves the PDF text UNCHANGED (R-606)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;

    // 1. Seed a REAL own-tenant snapshotted quote version (frozen snapshot rows).
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);

    // 2. Generate the PDF and capture the extracted text (the baseline commitment).
    const first = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    const bytesBefore = await adminSelectStoredPdfBytes(versionId);
    expect(bytesBefore).not.toBeNull();
    const textBefore = await extractPdfText(bytesBefore as Uint8Array);
    // Sanity: the baseline PDF carries the frozen customer identity + total.
    expect(textBefore).toContain("Kund Kundsson");
    expect(textBefore).toContain("Elpro Demo AB");

    // 3. MUTATE every mutable source class AFTER the snapshot.
    await adminQuery(
      `update public.company_settings set company_name = 'MUTATED AB', email = 'changed@example.test' where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    await adminQuery(
      `update public.customers set display_name = 'MUTATED CUSTOMER' where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    await adminQuery(
      `update public.facilities set name = 'MUTATED FACILITY' where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    await adminQuery(
      `update public.contacts set name = 'MUTATED CONTACT' where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    await adminQuery(
      `update public.quote_terms set terms_text = 'MUTATED TERMS' where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    await adminQuery(
      `update public.calculation_rows set unit_sell_ore = 99900000 where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    // work_roles / articles: seed then mutate (proves the PDF ignores live pricing too).
    await adminInsertWorkRole({
      tenant_id: fixture.tenantA.id,
      display_name: "MUTATED ROLE",
      cost_rate_ore: 99900000,
      sell_rate_ore: 99900000,
    });
    await adminInsertArticle({
      tenant_id: fixture.tenantA.id,
      name: "MUTATED ARTICLE",
      unit_price_ore: 99900000,
    });

    // 4. REGENERATE and assert the extracted text is TEXT-COMPARABLE to the baseline.
    const second = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(second.ok).toBe(true);
    const bytesAfter = await adminSelectStoredPdfBytes(versionId);
    const textAfter = await extractPdfText(bytesAfter as Uint8Array);

    // The PDF read ONLY the frozen snapshot — every mutation is INVISIBLE.
    expect(textAfter).toBe(textBefore);
    expect(textAfter).not.toContain("MUTATED");
  });

  it("[P0] every money/VAT/total value in the PDF is the FROZEN snapshot value (not a live recompute)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    const gen = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(gen.ok).toBe(true);
    const text = await extractPdfText(
      (await adminSelectStoredPdfBytes(versionId)) as Uint8Array,
    );

    // Mutate the live pricing to an absurd value; regenerate.
    await adminQuery(
      `update public.calculation_rows set unit_sell_ore = 12345600 where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    const regen = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(regen.ok).toBe(true);
    const text2 = await extractPdfText(
      (await adminSelectStoredPdfBytes(versionId)) as Uint8Array,
    );
    // The frozen öre total (2 h × 850,00 kr = 1700,00 kr net) still prints; the mutated
    // live price (123 456,00 kr) NEVER appears.
    expect(text2).toBe(text);
    expect(text2).toContain("1700,00");
    expect(text2).not.toContain("123456,00");
  });
});
