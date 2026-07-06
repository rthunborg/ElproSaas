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
 * ── ATDD RED PHASE ──────────────────────────────────────────────────────────────────
 * The `generateQuotePdf` command (`src/server/commands/quotes/**`), its renderer, and the
 * text extractor do NOT exist yet. This suite is `describe.skip`'d with a red-phase note.
 * When Task 4 (command) + Task 3 (renderer) land: import the real command + the text
 * extractor, remove `.skip`, and flip GREEN. Runs against the LOCAL Supabase stack only
 * (after `supabase db reset` + a `/auth/v1/health` 200 poll — the Kong 502 false-green trap);
 * `skipUnlessStack` makes a stack-down run a VISIBLE skip, and CI (`SUPABASE_TEST_REQUIRED=1`)
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
  adminInsertQuoteTerms,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

// RED PHASE — wire these when Task 3/4 land:
//   import { runCommand } from "@/server/commands/envelope";
//   import { generateQuotePdf } from "@/server/commands/quotes";
//   import type { CommandClock } from "@/server/commands/clock";
//   import { extractPdfText } from "../../support/pdf-text";        // wraps the pinned devDependency extractor
//   import { adminSelectStoredPdfBytes } from "../../factories/tenants"; // read the uploaded object back
//
// Seed a REAL own-tenant snapshotted version (reuse seedQuoteSource + createQuoteVersion
// from the 6.1 fixture chain, OR seed a version directly with adminInsertQuoteVersion +
// lines/attachments), generate the PDF, extract its text, then mutate + regenerate.

const FIXED_ISO = "2026-07-05T12:00:00.000Z";

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  await adminInsertQuoteTerms({
    tenant_id: fixture.tenantA.id,
    terms_text: "Villkor (platshållartext) — ej godkänd",
  });
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("generateQuotePdf — PDF source-of-truth (AC1, 6.3-INT-01) [ATDD red phase: command not implemented]", () => {
  it("[P0] mutating every mutable source AFTER the snapshot, then regenerating, leaves the PDF text UNCHANGED (R-606)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    // 1. Seed a REAL own-tenant snapshotted quote version (frozen snapshot rows).
    //    const version = await seedSnapshottedVersion(fixture.tenantA.id, a);

    // 2. Generate the PDF and capture the extracted text (the baseline commitment).
    //    const first = await runCommand(generateQuotePdf, {
    //      client: a as never,
    //      input: { quote_version_id: version.id },
    //      clock: { now: () => new Date(FIXED_ISO) } as CommandClock,
    //      correlationId: crypto.randomUUID(),
    //    });
    //    expect(first.ok).toBe(true);
    //    const textBefore = extractPdfText(await adminSelectStoredPdfBytes(version.id));

    // 3. MUTATE every mutable source class AFTER the snapshot: customers, company_settings,
    //    quote_terms, calculation_*, work_roles, articles.
    //    await adminQuery(`update public.company_settings set company_name = 'MUTATED AB', email = 'changed@example.test' where tenant_id = $1`, [fixture.tenantA.id]);
    //    await adminQuery(`update public.customers set display_name = 'MUTATED CUSTOMER' where tenant_id = $1`, [fixture.tenantA.id]);
    //    await adminQuery(`update public.quote_terms set terms_text = 'MUTATED TERMS' where tenant_id = $1`, [fixture.tenantA.id]);
    //    ...calculation_rows / work_roles / articles price mutations...

    // 4. REGENERATE and assert the extracted text is BYTE/TEXT-COMPARABLE to the baseline.
    //    const textAfter = extractPdfText(await adminSelectStoredPdfBytes(version.id));
    //    expect(textAfter).toBe(textBefore); // the PDF read ONLY the snapshot — mutation invisible

    expect.fail("ATDD red phase: implement generateQuotePdf (story 6.3 Task 4) then wire this proof");
  });

  it("[P0] every money/VAT/total value in the PDF is the FROZEN snapshot value (not a live recompute)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Mutate the live pricing/calc totals after the snapshot; regenerate; assert the PDF still
    // prints the FROZEN öre totals (formatted via the single oreToKronorString), never the new
    // live numbers. Complements 6.3-UNIT-01 (which proves it purely) at the DB-backed level.
    expect.fail("ATDD red phase: implement generateQuotePdf (story 6.3 Task 4) then wire this proof");
  });
});
