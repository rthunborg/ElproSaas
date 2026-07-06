/**
 * Story 7.1 — 7.1-INT-04 (P0, AC6, R-709/R-814): the acceptance-evidence link ACTIVATES the
 * `quote_acceptance` owner type + `acceptance_evidence` purpose on the EXISTING 8.1 file model —
 * it does NOT invent a competing evidence store.
 *
 * The proofs:
 *   - An already-uploaded, own-tenant evidence `file_id` links to a `quote_acceptance` owner via
 *     `createFileLink({ owner_type: "quote_acceptance", owner_id: <acceptance id>,
 *     purpose: "acceptance_evidence" })` — the owner-side R-802 check resolves the acceptance under
 *     own-tenant RLS (Task 5.2 registers `quote_acceptance → quote_acceptances` in `ownerTableFor`).
 *   - A FOREIGN (cross-tenant / non-existent) evidence file id ⇒ TENANT_ACCESS_DENIED (no existence
 *     disclosure); a FOREIGN owner (acceptance) id ⇒ TENANT_ACCESS_DENIED (the both-side gate).
 *   - Cross-tenant + anon access to the evidence FILE itself is rejected via the 8.1 signed-access
 *     funnel (reuse — the `file-signed-access.int.test.ts` pattern; NOT a second access path).
 *   - The EXTERNAL-reference path stores free text in `quote_acceptances.evidence_reference` with NO
 *     file link (the two evidence shapes are exclusive per capture).
 *
 * Mirrors `file-link-ownership.int.test.ts` / `file-signed-access.int.test.ts`: two-tenant fixture,
 * per-run unique ids, local Supabase stack only + visible skip. The evidence file is seeded via the
 * 8.1 factory; the acceptance row is created via the 7.1 `captureQuoteAcceptance` command on a real
 * sent version.
 *
 * ── GREEN as of Story 7.1 dev ─────────────────────────────────────────────────────────────────
 * `quote_acceptance` is ACTIVE in `ACTIVE_OWNER_TYPES`, `ownerTableFor` resolves it to
 * `quote_acceptances`, and the `quote_acceptances` table + `captureQuoteAcceptance` command have
 * landed. The real surfaces are imported and `.skip` is removed.
 *
 * [Source: test-design-epic-7.md#7.1-INT-04, R-709/R-814; story 7.1 Task 5 + AC6; testability note 8;
 *  src/server/commands/files/{validation,file-db,files}.ts (activation); accept.ts (evidence wiring)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminUpdateQuoteVersionStatus,
  adminInsertFile,
  adminUploadStorageObject,
  adminInsertQuoteAcceptance,
  adminSelectAcceptanceEvidenceLinks,
  adminSelectQuoteAcceptanceRow,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createFileLink, createSignedFileAccess } from "@/server/commands/files";
import { captureQuoteAcceptance } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-09T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };
const SOURCE_SENT_TOTAL_ORE = 125_000;

/** Seed a REAL sent version for `tenantId` (draft → flip to sent via BYPASSRLS). */
async function seedSentVersion(
  tenantId: string,
): Promise<{ quoteId: string; versionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `ev-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `ev-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "draft",
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
  });
  await adminUpdateQuoteVersionStatus(versionId, "sent");
  return { quoteId, versionId };
}

/** Capture an own-tenant acceptance on a real sent version via the 7.1 command; return its id. */
async function captureAcceptance(
  client: TestServerClient,
  versionId: string,
): Promise<string> {
  const res = await runCommand(captureQuoteAcceptance, {
    client: client as never,
    input: {
      quote_version_id: versionId,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
      accepted_at: "2026-07-09T08:30:00.000Z",
    },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
  if (!res.ok) throw new Error(`captureAcceptance failed: ${res.code}`);
  return res.data.targetId;
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client
let anon: TestServerClient; // unauthenticated client

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  anon = await makeAnonServerClient();
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("acceptance-evidence link — quote_acceptance owner activation on the 8.1 model (AC6)", () => {
  it("[P0] 7.1-INT-04: an own-tenant evidence file links to a quote_acceptance owner (acceptance_evidence purpose)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id);
    const acceptanceId = await captureAcceptance(a, versionId);
    const fileId = await adminInsertFile({
      tenant_id: fixture.tenantA.id,
      display_name: "evidence-a.pdf",
      lifecycle_state: "linked",
    });

    const res = await runCommand(createFileLink, {
      client: a as never,
      input: {
        file_id: fileId,
        owner_type: "quote_acceptance",
        owner_id: acceptanceId,
        purpose: "acceptance_evidence",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);

    // Exactly ONE file_links row for the (acceptance, evidence file) pair.
    const links = await adminSelectAcceptanceEvidenceLinks(acceptanceId);
    expect(links.length).toBe(1);
    expect(links[0]?.file_id).toBe(fileId);
    expect(links[0]?.owner_type).toBe("quote_acceptance");
    expect(links[0]?.purpose).toBe("acceptance_evidence");
  });

  it("[P0] 7.1-INT-04: a FOREIGN (cross-tenant) evidence file id ⇒ TENANT_ACCESS_DENIED (no existence leak)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id);
    const acceptanceId = await captureAcceptance(a, versionId);
    const tenantBFileId = await adminInsertFile({
      tenant_id: fixture.tenantB.id,
      display_name: "evidence-b.pdf",
      lifecycle_state: "linked",
    });

    const res = await runCommand(createFileLink, {
      client: a as never, // adminA links a Tenant-B file to an own acceptance
      input: {
        file_id: tenantBFileId,
        owner_type: "quote_acceptance",
        owner_id: acceptanceId,
        purpose: "acceptance_evidence",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    expect(res.message).not.toMatch(/exist|tenant b|another/i);
    const links = await adminSelectAcceptanceEvidenceLinks(acceptanceId);
    expect(links.length).toBe(0);
  });

  it("[P0] 7.1-INT-04: a FOREIGN (cross-tenant) acceptance owner id ⇒ TENANT_ACCESS_DENIED (both-side ownership)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B acceptance (existing but A-invisible) + an own-tenant file.
    const { quoteId: bQuoteId, versionId: bVersionId } = await seedSentVersion(
      fixture.tenantB.id,
    );
    const bAcceptanceId = await adminInsertQuoteAcceptance({
      tenant_id: fixture.tenantB.id,
      quote_id: bQuoteId,
      quote_version_id: bVersionId,
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
      source_sent_total_ore: SOURCE_SENT_TOTAL_ORE,
    });
    const ownFileId = await adminInsertFile({
      tenant_id: fixture.tenantA.id,
      display_name: "own-evidence.pdf",
      lifecycle_state: "linked",
    });

    const res = await runCommand(createFileLink, {
      client: a as never, // adminA links an own file to a Tenant-B acceptance
      input: {
        file_id: ownFileId,
        owner_type: "quote_acceptance",
        owner_id: bAcceptanceId,
        purpose: "acceptance_evidence",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] 7.1-INT-04: cross-tenant + anon access to the evidence FILE is rejected via the 8.1 signed-access funnel", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a Tenant-A evidence file + a real storage object; then Tenant-B admin + anon request a
    // signed URL for it via the SAME 8.1 createSignedFileAccess funnel (no second access path).
    const fileId = crypto.randomUUID();
    const objectPath = `${fixture.tenantA.id}/${fileId}/evidence.pdf`;
    await adminInsertFile({
      tenant_id: fixture.tenantA.id,
      id: fileId,
      object_path: objectPath,
      display_name: "evidence.pdf",
      lifecycle_state: "linked",
    });
    await adminUploadStorageObject({
      bucket: "tenant-files",
      objectPath,
      body: new Uint8Array([1, 2, 3]),
    });

    const b = await makeAuthedServerClient(fixture.adminB);
    const bRes = await runCommand(createSignedFileAccess as never, {
      client: b as never,
      input: { file_id: fileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(bRes.ok).toBe(false);
    if (!bRes.ok) expect(bRes.code).toBe("TENANT_ACCESS_DENIED");

    const anonRes = await runCommand(createSignedFileAccess as never, {
      client: anon as never,
      input: { file_id: fileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(anonRes.ok).toBe(false);
  });

  it("[P1] 7.1-INT-04: an EXTERNAL reference stores free text in evidence_reference with NO file link", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedSentVersion(fixture.tenantA.id);
    const res = await runCommand(captureQuoteAcceptance, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        accepted_at: "2026-07-09T08:30:00.000Z",
        evidence_reference: "kundmail 2026-07-09, ärende 4711",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await adminSelectQuoteAcceptanceRow(res.data.targetId);
    expect(row?.evidence_reference).toBe("kundmail 2026-07-09, ärende 4711");
    expect(row?.evidence_file_id).toBeNull();
    // NO file_links row exists for an external-reference-only capture.
    const links = await adminSelectAcceptanceEvidenceLinks(res.data.targetId);
    expect(links.length).toBe(0);
  });
});
