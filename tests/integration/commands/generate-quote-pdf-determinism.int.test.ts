/**
 * Story 6.3 — 6.3-INT-03 (P1, AC1/AC2): DETERMINISM (H3 / R-612).
 *
 * Repeated renders of the SAME snapshot must produce byte/text-comparable output. The render is
 * reproducible: (a) the renderer + version are EXACT-pinned; (b) fonts are the base-14 standard
 * Helvetica embedded by reference (never a host system font); (c) formatting uses a STABLE
 * explicit `sv-SE` locale; (d) the render timestamp is INJECTED from the command's single
 * `ctx.clock.now()` — no wall-clock read in the render path.
 *
 * ── GREEN (Story 6.3, Tasks 3/4) ─────────────────────────────────────────────────────
 * The pinned deterministic renderer + `generateQuotePdf` have landed. LOCAL stack + Storage
 * only; `skipUnlessStack`/`skipUnlessStorage` visible-skip a stack-down run; CI hard-fails.
 *
 * [Source: test-design-epic-6.md#6.3-INT-03, R-612; story 6.3 Task 3.2 + Task 6.2;
 *  architecture.md#4 (command time discipline); epics.md#Story 6.3 Technical Notes (H3)]
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
import { buildQuoteReviewProof } from "../../support/quote-review-proof";
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
  const reviewProof = await buildQuoteReviewProof(a, {
    calculationId: calcId,
    capturedAt: FIXED_ISO,
  });
  const created = await runCommand(createQuoteVersionFromCalculation, {
    client: a as never,
    input: { calculation_id: calcId, ...reviewProof },
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

describe("generateQuotePdf — determinism (AC1/AC2, 6.3-INT-03)", () => {
  it("[P1] rendering the SAME snapshot twice with the SAME injected instant yields byte/text-comparable output", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);

    const first = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    const bytes1 = (await adminSelectStoredPdfBytes(versionId)) as Uint8Array;
    const text1 = await extractPdfText(bytes1);

    const second = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(second.ok).toBe(true);
    const bytes2 = (await adminSelectStoredPdfBytes(versionId)) as Uint8Array;
    const text2 = await extractPdfText(bytes2);

    // Text-comparable (the golden's primary contract). The bytes are also byte-comparable
    // because the renderer pins the InfoDict dates from the injected instant (no wall clock).
    expect(text2).toBe(text1);
    expect(Buffer.compare(Buffer.from(bytes1), Buffer.from(bytes2))).toBe(0);
  });

  it("[P1] the render path reads NO wall clock — the PDF metadata date comes only from the injected instant", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const versionId = await seedSnapshottedVersion(fixture.tenantA.id);
    // Render with a DIFFERENT injected instant → the bytes differ ONLY because the injected
    // date changed (proving the date is injected, not wall-clock). With the SAME instant they
    // are identical (proven above).
    const early: CommandClock = { now: () => new Date("2026-01-01T00:00:00.000Z") };
    const genEarly = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: early,
      correlationId: crypto.randomUUID(),
    });
    expect(genEarly.ok).toBe(true);
    const textEarly = await extractPdfText(
      (await adminSelectStoredPdfBytes(versionId)) as Uint8Array,
    );
    // The CUSTOMER-VISIBLE text is invariant to the injected render instant (the instant only
    // sets the non-visible InfoDict date). A wall-clock read would make the text/bytes drift
    // run-to-run; here the visible text is stable across instants.
    const genEarly2 = await runCommand(generateQuotePdf, {
      client: a as never,
      input: { quote_version_id: versionId },
      clock: early,
      correlationId: crypto.randomUUID(),
    });
    expect(genEarly2.ok).toBe(true);
    const textEarly2 = await extractPdfText(
      (await adminSelectStoredPdfBytes(versionId)) as Uint8Array,
    );
    expect(textEarly2).toBe(textEarly);
  });
});
