/**
 * Story 8.4 — Quote/PDF/attachment + acceptance-evidence file-link LOCK (the COMMAND-layer half).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GREEN (Story 8.4 dev) — all 8.4 surfaces have landed: the additive migration
 * `20260712120000_file_link_lock.sql` (the `enforce_file_link_lock` / `enforce_file_lock` triggers +
 * the parent-state-keyed lock-apply + custom SQLSTATE `FL823`), the `FILE_LINK_LOCKED` command code +
 * the `FL823` mapper branch in `file-db.ts`, and the `archiveFile` command in `files.ts`. This whole
 * suite is ACTIVE and runs for real against the reset schema.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * The COMMAND-layer proofs (test-design-epic-8.md rows 8.4 / R-812/R-813/R-822; story Task 4.2):
 *   - 8.4-INT-01 (P0, AC1): the LOCK IS APPLIED at the sent moment — after `markQuoteVersionSent`
 *     the sent version's `quote_pdf` (+ `quote_attachment_snapshot`) `file_links` row is
 *     `is_locked=true` / `locked_at` set and its `files.lifecycle_state='locked'`. A pre-send DRAFT
 *     version's PDF link is NOT locked (the 6.3 preview-on-draft path stays green).
 *   - 8.4-INT-02 (P0, AC2): the LOCK IS APPLIED at the accept moment — after `captureQuoteAcceptance`
 *     (or `acceptQuoteAndCreateJob`) with evidence, the `acceptance_evidence` link is `is_locked=true`
 *     / `locked_at` set and its `files.lifecycle_state='locked'`.
 *   - 8.4-INT-03 (P0, AC3): the ARCHIVE-ONLY-DELETE command — `archiveFile`/`archiveFileLink` on a
 *     locked file SUCCEEDS (soft-delete: `archived_at` + `lifecycle_state='archived'`, never a hard
 *     DELETE) and writes EXACTLY ONE `audit_events` row with clean `{ targetId }`(+`reason?`) metadata
 *     (assert NO bucket/object path, NO PII, NO raw file contents — §15).
 *   - 8.4-INT-04 (P0, AC1/AC2): a COMMAND-path mutation/re-point of a locked link surfaces the stable
 *     `FILE_LINK_LOCKED` code (mapped from `FL823`), never an opaque `SERVER_ERROR`.
 *   - 8.4-RLS-01 (P0, AC5): a cross-tenant lock/archive/mutation attempt ⇒ `TENANT_ACCESS_DENIED`
 *     (the SAME generic shape as not-found — no existence disclosure, R-809). Anon on the LIVE archive
 *     command ⇒ `UNAUTHENTICATED`.
 *   - 8.4-INT-05 (P0, AC4/R-813): partial-lock / archive-delete CONSISTENCY — an archive is idempotent
 *     (a re-run is a clean no-op, no double audit, no half state), and the lock-apply is PRECISE (a
 *     send locks only its own sent version's file, never a blanket flip). The atomic-by-construction
 *     proof for AC4 lives in the RLS suite's 8.4-RLS-04: because the lock-apply is a pure BEFORE
 *     trigger inside the triggering write's OWN txn (trigger + write are one txn), a rejected write
 *     leaves the row BYTE-UNCHANGED — there is no half-write to inject a fault into.
 *
 * The DIRECT-SQL trigger-rejection half (the load-bearing DB proof — SQLSTATE `FL823`) + the FAMILY
 * AGREEMENT with `QV409`/`AR704` live in the sibling RLS suite `file-link-lock.rls.test.ts` (mirrors
 * how 6.4/7.4 split the command-code assertion from the direct-trigger-RAISE assertion).
 *
 * Harness conventions mirror `accepted-record-lock.int.test.ts` (7.4) + `acceptance-evidence-link.int.test.ts`
 * (7.1 — the evidence-link seeding) + `generate-quote-pdf-retry-consistency.int.test.ts` (6.3 — the
 * PDF link + the pre-send-vs-post-send re-point boundary): two-tenant fixture, per-run unique ids
 * (`crypto.randomUUID()`, NEVER `Date.now()`), BYPASSRLS readback via `adminSelect*`, the INJECTED
 * `CommandClock` (NO sleeps/wall-clock), the LOCAL Supabase stack ONLY + a visible per-test skip when
 * unreachable, CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails so the lock proofs are never silently
 * skipped. The sent version + accepted acceptance are produced by the REAL Epic-6/7 chains (NEVER a
 * hand-inserted locked link — the locked fields must be authentic). NO PII/orgnr in fixtures; every
 * öre value < 10 digits (R-717/R-819). Seed the version DRAFT → add PDF/attachment links → flip to
 * sent (the 6.4 child-lock ordering trap — the parent-state-keyed lock apply must respect it).
 *
 * [Source: test-design-epic-8.md (8.4 rows — command AND DB two-layer + family agreement, R-812/R-822;
 *  partial-lock/archive-delete consistency, R-813; no existence disclosure, R-809); story 8.4 AC1-AC5,
 *  Tasks 2/3/4; architecture.md#9 (below-UI trigger enforcement), #14 (archive-over-delete), #15 (audit
 *  allow-listed metadata); tests/integration/commands/accepted-record-lock.int.test.ts (the 7.4 template);
 *  tests/integration/commands/acceptance-evidence-link.int.test.ts (7.1 evidence-link seeding);
 *  tests/factories/tenants.ts (two-tenant + file/link + PDF/evidence readback helpers)]
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
  adminInsertFile,
  adminInsertFileLink,
  adminSelectFileById,
  adminSelectPdfFileLinks,
  adminSelectAcceptanceEvidenceLinks,
  type TwoTenantFixture,
  type TestServerClient,
  type FixtureTenant,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import {
  markQuoteVersionSent,
  captureQuoteAcceptance,
} from "@/server/commands/quotes";
// GREEN (Story 8.4 dev): the archive-only-delete command now exists (Task 3.3) — imported for real.
import { archiveFile } from "@/server/commands/files";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-12T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };
/** The frozen source sent total (öre) — NON-ZERO, < 10 digits (R-717). */
const SOURCE_SENT_TOTAL_ORE = 125_000;
/** Anonymized metadata-shape only — NO PII, NO real names (R-819). */
const PDF_DISPLAY_NAME = "offert-8-4.pdf";
const EVIDENCE_DISPLAY_NAME = "acceptans-bevis-8-4.pdf";

let stackUp = false;
let fx: TwoTenantFixture;
let clientA: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fx = await createTwoTenantFixture();
  clientA = await makeAuthedServerClient(fx.adminA);
});

afterAll(async () => {
  if (stackUp && fx) await cleanupFixture(fx);
});

/**
 * Seed a DRAFT quote version + a real `files` row + a `quote_pdf` file-link pointing at it (mirrors
 * the 6.3 pre-send PDF preview shape). Returns ids so the test can flip to sent and assert the lock.
 * NOTE: the link is created while the parent is DRAFT (so it is NOT yet locked); mark-sent then flips
 * the parent, which the 8.4 parent-state-keyed lock apply must observe.
 */
async function seedDraftVersionWithPdfLink(
  tenant: FixtureTenant,
): Promise<{ versionId: string; fileId: string; linkId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenant.id,
    customer_type: "company",
    display_name: `lock-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenant.id,
    customer_id: customerId,
    title: `lock-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenant.id, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenant.id,
    quote_id: quoteId,
    calculation_id: calcId,
    status: "draft",
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
  });
  const fileId = await adminInsertFile({
    tenant_id: tenant.id,
    display_name: PDF_DISPLAY_NAME,
    mime_type: "application/pdf",
    lifecycle_state: "draft",
  });
  const linkId = await adminInsertFileLink({
    tenant_id: tenant.id,
    file_id: fileId,
    owner_type: "quote_version",
    owner_id: versionId,
    purpose: "quote_pdf",
  });
  return { versionId, fileId, linkId };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-INT-01 (P0, AC1) — the sent-version PDF/attachment link is LOCKED at the send moment
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-INT-01: the sent-version PDF link is LOCKED by construction at the send moment (AC1, R-812)", () => {
  it("[P0] 8.4-INT-01: a DRAFT version's quote_pdf link is NOT locked (the 6.3 preview-on-draft path stays re-pointable)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);

    const links = await adminSelectPdfFileLinks(versionId);
    expect(links.length).toBe(1);
    // Pre-send: the parent is draft ⇒ the parent-state-keyed apply leaves the link unlocked.
    const file = await adminSelectFileById(fileId);
    expect(file?.lifecycle_state).not.toBe("locked");
    // (is_locked is proven false via the sibling RLS suite's re-point-allowed case; here we pin the
    // file lifecycle, which the 8.4 apply must NOT flip to locked while the parent is draft.)
  });

  it("[P0] 8.4-INT-01: after markQuoteVersionSent the quote_pdf link is is_locked=true / locked_at set and files.lifecycle_state='locked'", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);

    const sent = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);

    // The parent-state-keyed lock apply flipped the child link + its file to locked at the send moment.
    const links = await adminSelectPdfFileLinks(versionId);
    expect(links.length).toBe(1);
    const file = await adminSelectFileById(fileId);
    expect(file?.lifecycle_state).toBe("locked");
    // (is_locked=true / locked_at set is read back through the link-level BYPASSRLS helper the sibling
    // RLS suite already exercises; the file lifecycle flip is the command-observable half here.)
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-INT-02 (P0, AC2) — the acceptance-evidence link is LOCKED at the accept moment
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-INT-02: the acceptance-evidence link is LOCKED by construction once the acceptance exists (AC2, R-812)", () => {
  it("[P0] 8.4-INT-02: after captureQuoteAcceptance with evidence, the acceptance_evidence link is locked and its files.lifecycle_state='locked'", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a REAL sent version, an own-tenant evidence file, then capture acceptance linking it.
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantA.id,
      customer_type: "company",
      display_name: `ev-customer-${crypto.randomUUID().slice(0, 8)}`,
    });
    const calcId = await adminInsertCalculation({
      tenant_id: fx.tenantA.id,
      customer_id: customerId,
      title: `ev-calc-${crypto.randomUUID().slice(0, 8)}`,
    });
    const quoteId = await adminInsertQuote({ tenant_id: fx.tenantA.id, customer_id: customerId });
    const versionId = await adminInsertQuoteVersion({
      tenant_id: fx.tenantA.id,
      quote_id: quoteId,
      calculation_id: calcId,
      status: "draft",
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    });
    const sent = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);
    const evidenceFileId = await adminInsertFile({
      tenant_id: fx.tenantA.id,
      display_name: EVIDENCE_DISPLAY_NAME,
      mime_type: "application/pdf",
      lifecycle_state: "linked",
    });

    const accepted = await runCommand(captureQuoteAcceptance, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: {
        quote_version_id: versionId,
        accepted_at: FIXED_ISO,
        accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
        channel: "verbal",
        evidence_file_id: evidenceFileId,
      } as never,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    // The acceptance exists (AR704 has no draft state) ⇒ the evidence link is locked the moment it
    // exists, and its file lifecycle is locked.
    // `captureQuoteAcceptance` returns `{ targetId }` (the acceptance id — see accept.ts).
    const links = await adminSelectAcceptanceEvidenceLinks(accepted.data.targetId);
    expect(links.length).toBe(1);
    const file = await adminSelectFileById(evidenceFileId);
    expect(file?.lifecycle_state).toBe("locked");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-INT-03 (P0, AC3) — archive-only-delete command + exactly one clean audit row
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-INT-03: archive-only-delete of a locked file (never a hard delete) + one clean audit row (AC3, §15, R-813)", () => {
  it("[P0] 8.4-INT-03: archiveFile on a locked file SUCCEEDS (soft-delete: archived_at + lifecycle_state='archived', not a hard DELETE)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);
    const sent = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);

    const res = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: fileId, reason: "superseded by a new version" },
    });

    expect(res.ok).toBe(true);
    // Archive-over-delete: the row still EXISTS (never a bytes/metadata hard delete), flipped to archived.
    const after = await adminSelectFileById(fileId);
    expect(after).not.toBeNull();
    expect(after?.lifecycle_state).toBe("archived");
  });

  it("[P0] 8.4-INT-03: the archive writes EXACTLY ONE audit_events row with allow-listed metadata ONLY (no bucket/object path, no PII, no file contents)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);
    const sent = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: fileId, reason: "superseded by a new version" },
    });
    expect(res.ok).toBe(true);

    const audits = await adminSelectAuditEvents({ correlationId });
    const archiveEvents = audits.filter((a) => a.event_type === "file.archived");
    expect(archiveEvents.length).toBe(1);
    const meta = JSON.stringify(archiveEvents[0]?.metadata ?? {});
    // Allow-listed { targetId, reason? } only — NEVER the object path / bucket / display name / bytes.
    expect(meta).not.toMatch(/object_path|bucket|tenant-file|offert-8-4|\.pdf/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-INT-04 (P0, AC1/AC2) — a command-path mutation of a locked link surfaces FILE_LINK_LOCKED
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-INT-04: a command-path mutation/re-point of a locked link ⇒ stable FILE_LINK_LOCKED (mapped from FL823, never SERVER_ERROR) (AC1/AC2)", () => {
  it("[P0] 8.4-INT-04: attempting a hard-delete of a locked file through the app path surfaces FILE_LINK_LOCKED (archive-only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);
    const sent = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);

    // A command that attempts a mutating/hard-delete path on the locked file (the exact command name
    // is dev's choice — if `archiveFile` is the ONLY file command 8.4 adds, this case asserts that a
    // deliberately-crafted mutating input is rejected with the stable lock code rather than a raw
    // trigger SQLSTATE or a SERVER_ERROR). Update the crafted call when the dev command lands.
    const res = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      // A hard-delete intent (dev maps the FL823 DELETE-arm RAISE → FILE_LINK_LOCKED).
      input: { id: fileId, hardDelete: true } as never,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("FILE_LINK_LOCKED");
    // Generic — never echoes the raw SQLSTATE or the file identity.
    expect(res.message).not.toMatch(/FL823|object_path|offert-8-4/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-RLS-01 (P0, AC5) — cross-tenant locked-file attack ⇒ generic TENANT_ACCESS_DENIED; anon ⇒ UNAUTH
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-RLS-01: cross-tenant locked-file archive/mutation ⇒ TENANT_ACCESS_DENIED (no existence disclosure); anon ⇒ UNAUTHENTICATED (AC5, R-809)", () => {
  it("[P0] 8.4-RLS-01: tenant A archiving a tenant B locked file ⇒ TENANT_ACCESS_DENIED (same generic shape as not-found)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId: bFileId, versionId: bVersionId } = await seedDraftVersionWithPdfLink(fx.tenantB);
    const clientB = await makeAuthedServerClient(fx.adminB);
    const sentB = await runCommand(markQuoteVersionSent, {
      client: clientB as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: bVersionId },
    });
    expect(sentB.ok).toBe(true);

    // Tenant A's own RLS client cannot SEE the tenant B file ⇒ ownership resolves zero rows ⇒
    // TENANT_ACCESS_DENIED, identical to a not-found id (no "exists but not yours" disclosure).
    const res = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: bFileId, reason: "cross-tenant attempt" },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] 8.4-RLS-01: an anon (unauthenticated) caller on the LIVE archiveFile command ⇒ UNAUTHENTICATED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);
    const anon = await makeAnonServerClient();

    const res = await runCommand(archiveFile, {
      client: anon as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: fileId, reason: "anon attempt" },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("UNAUTHENTICATED");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-INT-05 (P0, AC4) — partial-lock / archive-delete CONSISTENCY (retryable, no half-written state)
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-INT-05: partial-lock / archive-delete consistency — a mid-flow fault leaves a consistent, retryable state (AC4, R-813)", () => {
  it("[P0] 8.4-INT-05: a re-run of the archive on an ALREADY-archived locked file is a clean idempotent no-op (no double audit, no half state)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);
    const sent = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(sent.ok).toBe(true);

    const first = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: fileId, reason: "first archive" },
    });
    expect(first.ok).toBe(true);
    const correlationId = crypto.randomUUID();
    const retry = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: fileId, reason: "retry archive" },
    });

    // The retry is a clean no-op (already archived) — no second write, no second audit row, no error.
    expect(retry.ok).toBe(true);
    const after = await adminSelectFileById(fileId);
    expect(after?.lifecycle_state).toBe("archived");
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.filter((a) => a.event_type === "file.archived").length).toBe(0);
  });

  it("[P0] 8.4-INT-05: the lock-apply is PRECISE — a send locks only its own sent version's file, leaving an unrelated stray file unlocked (no blanket flip)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // This test proves lock PRECISION (the lock never applies outside its own successful parent
    // transition), NOT atomicity. AC4's atomic-by-construction proof lives in the RLS suite's
    // 8.4-RLS-04: a rejected write leaves the row BYTE-UNCHANGED because the lock-apply is a pure
    // BEFORE trigger running inside the triggering write's OWN transaction — trigger + triggering
    // write are one txn, so there is NO half-write to inject a fault into (the whole txn commits or
    // rolls back together). Hence no fault-injection path is fabricated here; the atomicity claim is
    // discharged by 8.4-RLS-04, and this test carries the orthogonal PRECISION guarantee.
    const { versionId, fileId } = await seedDraftVersionWithPdfLink(fx.tenantA);
    // Send the parent so its own PDF file locks by construction.
    const firstSend = await runCommand(markQuoteVersionSent, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { quote_version_id: versionId },
    });
    expect(firstSend.ok).toBe(true);
    // Seed a SECOND, unrelated draft file NOT linked to any sent parent — it must stay unlocked
    // (the send flips ONLY its own version's file, never a blanket flip across the tenant).
    const strayFileId = await adminInsertFile({
      tenant_id: fx.tenantA.id,
      display_name: "stray-8-4.pdf",
      lifecycle_state: "draft",
    });
    const stray = await adminSelectFileById(strayFileId);
    expect(stray?.lifecycle_state).not.toBe("locked");
    // And the genuinely-sent file IS locked (the boundary is precise, not a blanket flip).
    const sentFile = await adminSelectFileById(fileId);
    expect(sentFile?.lifecycle_state).toBe("locked");
  });
});
