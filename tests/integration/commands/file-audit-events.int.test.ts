/**
 * Story 8.5 — file lifecycle events are §15-clean `audit_events` rows (AC2/AC5, P1 — 8.5-INT-01/02,
 * architecture §15). Every file event (upload, link, signed-access creation, archive) already emits
 * through the command envelope's `writeAuditEvent` — 8.5 does NOT invent a new audit model; it VERIFIES
 * the §15 event set is COMPLETE and the metadata is ALLOW-LISTED ONLY (NO raw file contents, NO
 * bucket/object path, NO PII, NO service-role detail). The archive path is the one 8.5 newly surfaces
 * from the UI, so it is the freshly-asserted lifecycle event here; the upload/link/sign paths are
 * REFERENCE-confirmed (already audit-tested by 8.1/8.2/8.3 — this suite does not re-implement them).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD) — every test is gated behind `describe.skip`. The `archiveFileAction` server action
 * (Story 8.5 Task 2.3, wiring the panel/index archive control to the EXISTING `archiveFile` command)
 * does NOT exist yet, and this suite pins the §15-set-complete assertion as the 8.5 verification. The
 * COMMAND-level archive audit shape is already GREEN in `file-link-lock.int.test.ts` (8.4-INT-03) — this
 * suite is the 8.5 coverage-inversion re-verification that the archive UI path routes through the SAME
 * command (no divergent write path) + the §15-set completeness check. Remove `describe.skip` in
 * dev-story green phase once Task 2.3 lands; if dev exposes the archive only via `runCommand(archiveFile)`
 * (no separate action), keep the command-level assertions and drop the action-path note.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * The proofs (test-design-epic-8.md P1 "(8.5) File audit events with safe metadata"; §15):
 *   - 8.5-INT-01 (P1, AC2): a fresh `archiveFile` writes EXACTLY ONE `file.archived` audit row with
 *     clean `{ targetId, reason? }`-shaped metadata — assert NO object_path/bucket/PII/file-name in the
 *     JSON; an IDEMPOTENT re-archive writes NO second row (mirrors 8.4's conditional-audit shape).
 *   - 8.5-INT-02 (P1, AC2): the §15 file-event set is EXACTLY `file.uploaded`/`file.linked`/
 *     `file.signed_access.created`/`file.archived` — a closed set, REUSED verbatim (NO new event type,
 *     NO `file_events` table). A membership assertion on the eventType constants (the single source of
 *     truth) so a drift toward a new audit model fails loud.
 *   - 8.5-INT-03 (P1, AC5): a cross-tenant archive attempt ⇒ `TENANT_ACCESS_DENIED` (the SAME generic
 *     shape as not-found — no existence disclosure, R-809), writing NO audit row for the foreign target.
 *
 * Harness conventions mirror `file-link-lock.int.test.ts` (8.4 — the archive + audit template) +
 * `audit-metadata-hygiene-e2e.int.test.ts`: two-tenant fixture, per-run unique ids
 * (`crypto.randomUUID()`), the INJECTED `CommandClock` (NO sleeps/wall-clock), BYPASSRLS audit readback
 * via `adminSelectAuditEvents({ correlationId })`, LOCAL Supabase stack ONLY + a visible per-test skip,
 * CI (`SUPABASE_TEST_REQUIRED=1`) HARD-FAILS. The sent version + locked file are produced by the REAL
 * Epic-6 chain (`markQuoteVersionSent`), NEVER a hand-locked row. NO PII/orgnr; öre < 10 digits (R-717).
 *
 * [Source: story 8.5 AC2/AC5 + Task 2.3/3.2; architecture.md#15 (audit event set + metadata
 *  prohibitions); test-design-epic-8.md (P1 file-audit row, §15); src/server/commands/files/files.ts
 *  (eventType constants — file.uploaded/file.linked/file.signed_access.created/file.archived);
 *  tests/integration/commands/file-link-lock.int.test.ts (8.4-INT-03 — the archive+audit template);
 *  retro-notes/epic-8.md (coverage-inversion: re-verify the archive UI path hits the same command);
 *  tests/factories/audit-events.ts (adminSelectAuditEvents readback)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertFile,
  adminInsertFileLink,
  adminSelectFileById,
  type TwoTenantFixture,
  type TestServerClient,
  type FixtureTenant,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent } from "@/server/commands/quotes";
import { archiveFile } from "@/server/commands/files";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-13T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };
const SOURCE_SENT_TOTAL_ORE = 125_000;
/** Anonymized metadata-shape only — the audit metadata must NEVER echo this file name (§15). */
const PDF_DISPLAY_NAME = "offert-8-5.pdf";

/** The §15 closed file-event set — REUSED verbatim (no new event type, no new audit model). */
const EXPECTED_FILE_EVENT_TYPES = [
  "file.uploaded",
  "file.linked",
  "file.signed_access.created",
  "file.archived",
] as const;

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

/** Seed a DRAFT version + PDF link → mark sent so the PDF file is LOCKED (archivable) by construction. */
async function seedSentVersionWithLockedPdf(
  tenant: FixtureTenant,
): Promise<{ versionId: string; fileId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenant.id,
    customer_type: "company",
    display_name: `audit-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenant.id,
    customer_id: customerId,
    title: `audit-calc-${crypto.randomUUID().slice(0, 8)}`,
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
  await adminInsertFileLink({
    tenant_id: tenant.id,
    file_id: fileId,
    owner_type: "quote_version",
    owner_id: versionId,
    purpose: "quote_pdf",
  });
  const client = tenant.id === fx.tenantA.id ? clientA : await makeAuthedServerClient(fx.adminB);
  const sent = await runCommand(markQuoteVersionSent, {
    client: client as never,
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
    input: { quote_version_id: versionId },
  });
  expect(sent.ok).toBe(true);
  return { versionId, fileId };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.5-INT-01 (P1, AC2) — the archive path writes EXACTLY ONE §15-clean audit row; re-archive writes none
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe.skip("8.5-INT-01: the file archive path writes EXACTLY ONE file.archived audit row with allow-listed metadata; a re-archive writes none (AC2, §15)", () => {
  it("[P1] 8.5-INT-01: a fresh archive writes one file.archived row with clean { targetId, reason? } metadata (no object_path/bucket/PII/file-name)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId } = await seedSentVersionWithLockedPdf(fx.tenantA);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: fileId, reason: "superseded" },
    });
    expect(res.ok).toBe(true);

    const audits = await adminSelectAuditEvents({ correlationId });
    const archiveEvents = audits.filter((a) => a.event_type === "file.archived");
    expect(archiveEvents.length).toBe(1);
    const meta = JSON.stringify(archiveEvents[0]?.metadata ?? {});
    // Allow-listed { targetId, reason? } ONLY — never the object path / bucket / display name / bytes.
    expect(meta).not.toMatch(/object_path|bucket|offert-8-5|\.pdf/i);
  });

  it("[P1] 8.5-INT-01: an idempotent re-archive of the same file writes NO second audit row (conditional-audit shape)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId } = await seedSentVersionWithLockedPdf(fx.tenantA);

    const first = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
      input: { id: fileId, reason: "first" },
    });
    expect(first.ok).toBe(true);

    const retryCorrelationId = crypto.randomUUID();
    const retry = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId: retryCorrelationId,
      input: { id: fileId, reason: "retry" },
    });
    expect(retry.ok).toBe(true);

    const after = await adminSelectFileById(fileId);
    expect(after?.lifecycle_state).toBe("archived");
    const retryAudits = await adminSelectAuditEvents({ correlationId: retryCorrelationId });
    expect(retryAudits.filter((a) => a.event_type === "file.archived").length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.5-INT-02 (P1, AC2) — the §15 file-event set is the closed, REUSED-verbatim set (no new audit model)
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe.skip("8.5-INT-02: the §15 file-event set is EXACTLY the four REUSED event types — no new audit model / file_events table (AC2, §15)", () => {
  it("[P1] 8.5-INT-02: the archive emits its event under the §15-named `file.archived` type (a member of the closed set)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId } = await seedSentVersionWithLockedPdf(fx.tenantA);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: fileId },
    });
    expect(res.ok).toBe(true);

    const audits = await adminSelectAuditEvents({ correlationId });
    const fileEvents = audits.filter((a) => a.event_type.startsWith("file."));
    // Every emitted file event is a member of the §15 closed set — a drift to a novel event type fails.
    for (const ev of fileEvents) {
      expect(EXPECTED_FILE_EVENT_TYPES as readonly string[]).toContain(ev.event_type);
    }
    expect(fileEvents.some((e) => e.event_type === "file.archived")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.5-INT-03 (P1, AC5) — a cross-tenant archive ⇒ TENANT_ACCESS_DENIED, no audit row for the foreign id
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe.skip("8.5-INT-03: a cross-tenant archive attempt ⇒ TENANT_ACCESS_DENIED (no existence disclosure), no audit row written (AC5, R-809)", () => {
  it("[P1] 8.5-INT-03: tenant A archiving a tenant B locked file ⇒ TENANT_ACCESS_DENIED and NO file.archived audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId: bFileId } = await seedSentVersionWithLockedPdf(fx.tenantB);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(archiveFile, {
      client: clientA as never,
      clock: fixedClock,
      correlationId,
      input: { id: bFileId, reason: "cross-tenant" },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TENANT_ACCESS_DENIED");
    // A denied cross-tenant attempt writes NO audit row for the foreign target (no side-effect leak).
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.filter((a) => a.event_type === "file.archived").length).toBe(0);
  });
});
