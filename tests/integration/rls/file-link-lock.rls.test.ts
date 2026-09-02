/**
 * Story 8.4 — file-link LOCK ENFORCEMENT at the DB layer (the load-bearing direct-SQL half) +
 * FAMILY AGREEMENT with direct-DML denial and file-lock enforcement (R-812/R-822).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GREEN (Story 8.4 dev) — the additive migration `20260712120000_file_link_lock.sql` has landed (the
 * `enforce_file_link_lock` / `enforce_file_lock` BEFORE UPDATE OR DELETE triggers + the parent-state-
 * keyed lock apply [`apply_file_link_lock` + the parent-transition triggers] + custom SQLSTATE
 * `FL823`), so this whole suite is ACTIVE and runs for real against the reset schema.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * This is the TWO-LAYER lock's DB half — a UI-only lock is a STOP (R-812; architecture §9). The
 * command-code + archive-command + audit half lives in the sibling `file-link-lock.int.test.ts`.
 *
 * The DB proofs (test-design-epic-8.md 8.4 rows; story Task 4.1/4.3):
 *   - 8.4-RLS-01 (P0, AC1): a DIRECT own-tenant AUTHENTICATED (anon-key RLS client, NEVER BYPASSRLS)
 *     UPDATE re-pointing a LOCKED `file_links.file_id`, mutating `owner_id`/`owner_type`/`purpose`, or
 *     flipping `is_locked=false`/`locked_at=null` back off ⇒ REJECTED with SQLSTATE `FL823`
 *     (row byte-unchanged). The re-point is the 6.3-retry hazard the lock must close post-send.
 *   - 8.4-RLS-02 (P0, AC1): a DIRECT own-tenant UPDATE of a LOCKED `files` row's
 *     `object_path`/`display_name`/`checksum`/`mime_type`/`bucket_id`/`size_bytes` ⇒ `FL823`.
 *   - 8.4-RLS-03 (P0, AC3): a DELETE of a locked link/file (via a privileged path — `authenticated`
 *     has no delete grant) ⇒ `FL823` (archive-over-delete belt-and-braces).
 *   - 8.4-RLS-04 (P0, AC3): the SANCTIONED `locked → archived` transition (`archived_at` +
 *     `lifecycle_state='archived'` on `files`, `archived_at` on `file_links`) is ALLOWED; a
 *     DISARMING transition (`locked → draft`/`linked`) is REJECTED (`FL823`).
 *   - 8.4-RLS-05 (P0, AC1/AC2 — the "pre-send DRAFT stays re-pointable" boundary): a DRAFT version's
 *     PDF link file_id re-point is ALLOWED (the 6.3 preview-on-draft path stays green); the SAME
 *     re-point AFTER the parent is sent is REJECTED (`FL823`). Locking activates exactly at the
 *     parent's lock moment.
 *   - 8.4-RLS-06 (P0, AC1/AC2 — FAMILY AGREEMENT, R-822, the load-bearing "not a fork" proof): on a
 *     SENT version direct DML is denied and the PDF-link's `FL823` lock is in force. On an ACCEPTED
 *     acceptance, authenticated direct DML is likewise denied before its accepted-lock trigger can
 *     run; a direct evidence-link mutation is rejected by the accepted-record parent lock (`AR704`),
 *     while its protected underlying `files` row remains independently enforced by `FL823`.
 *   - 8.4-RLS-07 (P0, AC5): a cross-tenant direct UPDATE of a tenant B locked link/file ⇒ zero rows
 *     affected (RLS-invisible, the trigger never sees it) — no error, no existence disclosure
 *     (R-809), row untouched. The `FL823` RAISE message is generic (like `QV409`/`AR704`).
 *
 * Harness conventions mirror `accepted-record-lock.int.test.ts` (7.4 — the direct-SQL
 * UPDATE-rejected-by-trigger structure) + `storage-object-isolation.rls.test.ts` (the file-plane
 * RLS negatives): two-tenant fixture, per-run unique ids (`crypto.randomUUID()`), the anon-key RLS
 * client for the direct-SQL attacks, BYPASSRLS readback via `adminSelect*` to prove byte-unchanged,
 * LOCAL Supabase stack ONLY + a visible per-test skip when unreachable, CI (`SUPABASE_TEST_REQUIRED=1`)
 * hard-fails. Seed the sent version DRAFT → add PDF/attachment links → flip to sent (the 6.4 child-lock
 * ordering trap — the parent-state-keyed apply must respect it). NO PII/orgnr; öre < 10 digits (R-717).
 *
 * [Source: test-design-epic-8.md (8.4 two-layer + family agreement, R-812/R-822; no existence
 *  disclosure, R-809; §5 "lock enforcement is two-layer, behavioral, and must join a FAMILY"); story
 *  8.4 AC1-AC5, Tasks 1/4; architecture.md#9 (below-UI trigger enforcement), #14 (archive-over-delete);
 *  supabase/migrations/20260707120000_quote_version_sent_lock.sql (QV409 — the child-lock parent-status
 *  lookup shape 8.4 mirrors); 20260711120000_accepted_record_lock.sql (AR704 — the exempt-then-tuple
 *  shape 8.4 mirrors); tests/integration/commands/accepted-record-lock.int.test.ts (the 7.4 template);
 *  tests/factories/tenants.ts (two-tenant + file/link + PDF/evidence readback helpers)]
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
  adminUpdateQuoteVersionStatus,
  adminInsertQuoteAcceptance,
  adminSelectQuoteAcceptanceRow,
  adminSelectAcceptanceEvidenceLinks,
  adminSelectFileById,
  adminSelectPdfFileLinks,
  type TwoTenantFixture,
  type TestServerClient,
  type FixtureTenant,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const SOURCE_SENT_TOTAL_ORE = 125_000;
const FIXED_ISO = "2026-07-12T09:00:00.000Z";

/** Authenticated DML denials plus the distinct file-lock trigger SQLSTATE. */
const FILE_LINK_LOCK_SQLSTATE = "FL823"; // 8.4 — FILE_LINK_LOCKED (assumed value; align with the migration)
const SENT_LOCK_SQLSTATE = "42501"; // 10.8 — direct quote-version DML is denied
const ACCEPTANCE_DML_DENIED_SQLSTATE = "42501"; // 10.8 — direct quote-acceptance DML is denied
const ACCEPTED_RECORD_LOCK_SQLSTATE = "AR704"; // 7.4 — accepted-record parent lock

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
 * Seed a SENT quote version + a `files` row + its `quote_pdf` link, driven through the DRAFT→children→sent
 * ordering (the 6.4 child-lock trap). Returns ids. The 8.4 parent-state-keyed apply must have locked the
 * link + file by the time the version is sent.
 */
async function seedSentVersionWithLockedPdfLink(
  tenant: FixtureTenant,
): Promise<{ versionId: string; quoteId: string; fileId: string; linkId: string }> {
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
    display_name: "offert-8-4.pdf",
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
  // Flip to sent AFTER the child link exists (the ordering the parent-state-keyed apply must handle).
  await adminUpdateQuoteVersionStatus(versionId, "sent");
  return { versionId, quoteId, fileId, linkId };
}

/** Seed an accepted acceptance + its `acceptance_evidence` link on a real sent version. */
async function seedAcceptedWithLockedEvidenceLink(
  tenant: FixtureTenant,
): Promise<{ acceptanceId: string; evidenceFileId: string; linkId: string }> {
  const { versionId, quoteId } = await seedSentVersionWithLockedPdfLink(tenant);
  const evidenceFileId = await adminInsertFile({
    tenant_id: tenant.id,
    display_name: "acceptans-bevis-8-4.pdf",
    mime_type: "application/pdf",
    lifecycle_state: "linked",
  });
  const acceptanceId = await adminInsertQuoteAcceptance({
    tenant_id: tenant.id,
    quote_id: quoteId,
    quote_version_id: versionId,
    accepted_at: FIXED_ISO,
    accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    channel: "verbal",
    evidence_file_id: evidenceFileId,
  } as never);
  const linkId = await adminInsertFileLink({
    tenant_id: tenant.id,
    file_id: evidenceFileId,
    owner_type: "quote_acceptance",
    owner_id: acceptanceId,
    purpose: "acceptance_evidence",
  });
  return { acceptanceId, evidenceFileId, linkId };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-RLS-01 (P0, AC1) — a DIRECT own-tenant UPDATE of a LOCKED file_links row ⇒ FL823
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-RLS-01: a locked file_links row is immutable at the DB — a direct own-tenant UPDATE ⇒ FL823 (AC1, R-812)", () => {
  const LOCKED_LINK_UPDATES: readonly { field: string; value: unknown }[] = [
    { field: "file_id", value: crypto.randomUUID() }, // the 6.3-retry re-point hazard
    { field: "owner_id", value: crypto.randomUUID() },
    { field: "owner_type", value: "job" },
    { field: "purpose", value: "job_evidence" },
    { field: "is_locked", value: false }, // an attempt to DISARM the lock
    { field: "locked_at", value: null }, // an attempt to DISARM the lock
  ];

  for (const { field, value } of LOCKED_LINK_UPDATES) {
    it(`[P0] 8.4-RLS-01: a DIRECT own-tenant UPDATE of a locked file_links.\`${field}\` is REJECTED by the trigger (FL823)`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const { versionId, linkId } = await seedSentVersionWithLockedPdfLink(fx.tenantA);
      const before = await adminSelectPdfFileLinks(versionId);

      const { error } = await clientA
        .from("file_links")
        .update({ [field]: value })
        .eq("id", linkId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe(FILE_LINK_LOCK_SQLSTATE);
      // Row byte-unchanged.
      const after = await adminSelectPdfFileLinks(versionId);
      expect(String(after[0]?.[field as keyof (typeof after)[number]])).toBe(
        String(before[0]?.[field as keyof (typeof before)[number]]),
      );
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-RLS-02 (P0, AC1) — a DIRECT own-tenant UPDATE of a LOCKED files row's identity/metadata ⇒ FL823
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-RLS-02: a locked files row's object identity/metadata is immutable — a direct UPDATE ⇒ FL823 (AC1, R-812)", () => {
  const LOCKED_FILE_UPDATES: readonly { field: string; value: unknown }[] = [
    { field: "object_path", value: `${crypto.randomUUID()}/tampered.pdf` },
    { field: "display_name", value: "tampered.pdf" },
    { field: "mime_type", value: "image/png" },
    { field: "bucket_id", value: "tampered-bucket" },
    { field: "size_bytes", value: 1 },
  ];

  for (const { field, value } of LOCKED_FILE_UPDATES) {
    it(`[P0] 8.4-RLS-02: a DIRECT own-tenant UPDATE of a locked files.\`${field}\` is REJECTED by the trigger (FL823)`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const { fileId } = await seedSentVersionWithLockedPdfLink(fx.tenantA);
      const before = await adminSelectFileById(fileId);
      expect(before?.lifecycle_state).toBe("locked"); // precondition — the parent-state apply locked it

      const { error } = await clientA
        .from("files")
        .update({ [field]: value })
        .eq("id", fileId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe(FILE_LINK_LOCK_SQLSTATE);
      const after = await adminSelectFileById(fileId);
      expect(String(after?.[field as keyof NonNullable<typeof after>])).toBe(
        String(before?.[field as keyof NonNullable<typeof before>]),
      );
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-RLS-03/04 (P0, AC3) — DELETE of a locked file ⇒ FL823; the SANCTIONED archive transition ⇒ ALLOWED
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-RLS-03/04: locked deletion is archive-only — a DELETE ⇒ FL823; locked→archived ⇒ ALLOWED; a disarming transition ⇒ FL823 (AC3, R-813)", () => {
  it("[P0] 8.4-RLS-04: the SANCTIONED locked→archived transition on files (archived_at + lifecycle_state='archived') is ALLOWED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId } = await seedSentVersionWithLockedPdfLink(fx.tenantA);

    const { error } = await clientA
      .from("files")
      .update({ archived_at: FIXED_ISO, lifecycle_state: "archived" })
      .eq("id", fileId)
      .select();

    // The exempt archive path is the ONLY sanctioned soft-delete for a locked file.
    expect(error).toBeNull();
    const after = await adminSelectFileById(fileId);
    expect(after?.lifecycle_state).toBe("archived");
  });

  it("[P0] 8.4-RLS-04: a DISARMING transition (locked→linked/draft) on files is REJECTED (FL823)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId } = await seedSentVersionWithLockedPdfLink(fx.tenantA);

    const { error } = await clientA
      .from("files")
      .update({ lifecycle_state: "linked" })
      .eq("id", fileId)
      .select();

    expect(error).not.toBeNull();
    expect(error?.code).toBe(FILE_LINK_LOCK_SQLSTATE);
    const after = await adminSelectFileById(fileId);
    expect(after?.lifecycle_state).toBe("locked");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-RLS-05 (P0, AC1/AC2) — the pre-send-vs-post-send re-point boundary (the 6.3-retry edge case)
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-RLS-05: pre-send DRAFT PDF link is re-pointable; the SAME re-point after send ⇒ FL823 (AC1, the 6.3-retry boundary)", () => {
  it("[P0] 8.4-RLS-05: a DRAFT version's quote_pdf link file_id re-point is ALLOWED (the 6.3 preview-on-draft retry path stays green)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a DRAFT version + PDF link (NOT flipped to sent) so the link is unlocked.
    const customerId = await adminInsertCustomer({
      tenant_id: fx.tenantA.id,
      customer_type: "company",
      display_name: `draft-customer-${crypto.randomUUID().slice(0, 8)}`,
    });
    const calcId = await adminInsertCalculation({
      tenant_id: fx.tenantA.id,
      customer_id: customerId,
      title: `draft-calc-${crypto.randomUUID().slice(0, 8)}`,
    });
    const quoteId = await adminInsertQuote({ tenant_id: fx.tenantA.id, customer_id: customerId });
    const versionId = await adminInsertQuoteVersion({
      tenant_id: fx.tenantA.id,
      quote_id: quoteId,
      calculation_id: calcId,
      status: "draft",
      accepted_price_ore: SOURCE_SENT_TOTAL_ORE,
    });
    const fileId = await adminInsertFile({
      tenant_id: fx.tenantA.id,
      display_name: "offert-draft.pdf",
      lifecycle_state: "draft",
    });
    const linkId = await adminInsertFileLink({
      tenant_id: fx.tenantA.id,
      file_id: fileId,
      owner_type: "quote_version",
      owner_id: versionId,
      purpose: "quote_pdf",
    });
    // A second own-tenant file the retry re-points to (mirrors generate-pdf.ts:266-275).
    const newFileId = await adminInsertFile({
      tenant_id: fx.tenantA.id,
      display_name: "offert-draft-v2.pdf",
      lifecycle_state: "draft",
    });

    const { error } = await clientA
      .from("file_links")
      .update({ file_id: newFileId })
      .eq("id", linkId)
      .select();

    // Parent is draft ⇒ the link is NOT locked ⇒ the re-point is allowed (6.3 retry preserved).
    expect(error).toBeNull();
    const after = await adminSelectPdfFileLinks(versionId);
    expect(after[0]?.file_id).toBe(newFileId);
  });

  it("[P0] 8.4-RLS-05: the SAME file_id re-point AFTER the parent is sent is REJECTED (FL823) — locking activates at the send moment", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, linkId } = await seedSentVersionWithLockedPdfLink(fx.tenantA);
    const newFileId = await adminInsertFile({
      tenant_id: fx.tenantA.id,
      display_name: "offert-post-send.pdf",
      lifecycle_state: "draft",
    });

    const { error } = await clientA
      .from("file_links")
      .update({ file_id: newFileId })
      .eq("id", linkId)
      .select();

    expect(error).not.toBeNull();
    expect(error?.code).toBe(FILE_LINK_LOCK_SQLSTATE);
    const after = await adminSelectPdfFileLinks(versionId);
    expect(after[0]?.file_id).not.toBe(newFileId);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-RLS-06 (P0, AC1/AC2) — family agreement with direct-DML denial + file locks
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-RLS-06: family agreement (R-822) — direct sent-version DML is denied and file locks remain enforced (AC1/AC2)", () => {
  it("[P0] 8.4-RLS-06: on a SENT version, direct mutation is denied and re-pointing its PDF link RAISEs FL823", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId, linkId } = await seedSentVersionWithLockedPdfLink(fx.tenantA);
    const newFileId = await adminInsertFile({
      tenant_id: fx.tenantA.id,
      display_name: "agree-v2.pdf",
      lifecycle_state: "draft",
    });

    // (a) Story 10.8 revokes direct quote-version DML before the older sent-lock trigger can run.
    const versionRes = await clientA
      .from("quote_versions")
      .update({ accepted_price_ore: 1 })
      .eq("id", versionId)
      .select();
    expect(versionRes.error).not.toBeNull();
    expect(versionRes.error?.code).toBe(SENT_LOCK_SQLSTATE);

    // (b) The PDF link's file-side lock (FL823) is in force — a re-point is rejected.
    const linkRes = await clientA
      .from("file_links")
      .update({ file_id: newFileId })
      .eq("id", linkId)
      .select();
    expect(linkRes.error?.code).toBe(FILE_LINK_LOCK_SQLSTATE);

    // The file-side lock remains a distinct enforcement boundary (R-822).
    expect(SENT_LOCK_SQLSTATE).not.toBe(FILE_LINK_LOCK_SQLSTATE);
  });

  it("[P0] 8.4-RLS-06: on an ACCEPTED acceptance, authenticated DML ⇒ 42501; evidence link ⇒ AR704; protected file ⇒ FL823", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { acceptanceId, evidenceFileId, linkId } = await seedAcceptedWithLockedEvidenceLink(fx.tenantA);
    const acceptanceBefore = await adminSelectQuoteAcceptanceRow(acceptanceId);
    const evidenceLinkBefore = await adminSelectAcceptanceEvidenceLinks(acceptanceId);
    const evidenceFileBefore = await adminSelectFileById(evidenceFileId);

    // (a) Story 10.8 revokes direct quote-acceptance DML before the accepted-lock
    // trigger can run. Read back through the privileged test helper to prove the
    // accepted value remains unchanged despite the denied authenticated attack.
    const acceptanceRes = await clientA
      .from("quote_acceptances")
      .update({ accepted_price_ore: 1 })
      .eq("id", acceptanceId)
      .select();
    expect(acceptanceRes.error).not.toBeNull();
    expect(acceptanceRes.error?.code).toBe(ACCEPTANCE_DML_DENIED_SQLSTATE);
    const acceptanceAfter = await adminSelectQuoteAcceptanceRow(acceptanceId);
    expect(String(acceptanceAfter?.accepted_price_ore)).toBe(String(acceptanceBefore?.accepted_price_ore));

    // (b) The accepted-record parent lock fires first for its evidence link.
    const linkRes = await clientA
      .from("file_links")
      .update({ file_id: crypto.randomUUID() })
      .eq("id", linkId)
      .select();
    expect(linkRes.error).not.toBeNull();
    expect(linkRes.error?.code).toBe(ACCEPTED_RECORD_LOCK_SQLSTATE);
    const evidenceLinkAfter = await adminSelectAcceptanceEvidenceLinks(acceptanceId);
    expect(evidenceLinkAfter).toEqual(evidenceLinkBefore);

    // (c) The protected underlying file is separately immutable at the file-lock layer.
    const fileRes = await clientA
      .from("files")
      .update({ display_name: "tampered-acceptance-evidence.pdf" })
      .eq("id", evidenceFileId)
      .select();
    expect(fileRes.error).not.toBeNull();
    expect(fileRes.error?.code).toBe(FILE_LINK_LOCK_SQLSTATE);
    const evidenceFileAfter = await adminSelectFileById(evidenceFileId);
    expect(evidenceFileAfter?.display_name).toBe(evidenceFileBefore?.display_name);

    // The RLS, accepted-record, and file-lock boundaries remain intentionally distinct.
    expect(ACCEPTANCE_DML_DENIED_SQLSTATE).not.toBe(ACCEPTED_RECORD_LOCK_SQLSTATE);
    expect(ACCEPTED_RECORD_LOCK_SQLSTATE).not.toBe(FILE_LINK_LOCK_SQLSTATE);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.4-RLS-07 (P0, AC5) — cross-tenant locked-file attack ⇒ zero rows (RLS-invisible, no disclosure)
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("8.4-RLS-07: cross-tenant attack on a locked link/file ⇒ zero rows affected (RLS-invisible, trigger never sees it, no existence disclosure) (AC5, R-809)", () => {
  it("[P0] 8.4-RLS-07: tenant A's direct UPDATE of a tenant B locked file_links.file_id ⇒ zero rows, row untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { linkId: bLinkId, versionId: bVersionId } = await seedSentVersionWithLockedPdfLink(fx.tenantB);
    const before = await adminSelectPdfFileLinks(bVersionId);

    // A foreign row is invisible under RLS ⇒ the UPDATE matches zero rows (the trigger never fires).
    // No error, no FL823 leak, no existence signal — identical to a not-found id.
    const { data, error } = await clientA
      .from("file_links")
      .update({ file_id: crypto.randomUUID() })
      .eq("id", bLinkId)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    const after = await adminSelectPdfFileLinks(bVersionId);
    expect(after[0]?.file_id).toBe(before[0]?.file_id);
  });

  it("[P0] 8.4-RLS-07: tenant A's direct UPDATE of a tenant B locked files.object_path ⇒ zero rows, row untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId: bFileId } = await seedSentVersionWithLockedPdfLink(fx.tenantB);
    const before = await adminSelectFileById(bFileId);

    const { data, error } = await clientA
      .from("files")
      .update({ object_path: `${crypto.randomUUID()}/tampered.pdf` })
      .eq("id", bFileId)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    const after = await adminSelectFileById(bFileId);
    expect(after?.object_path).toBe(before?.object_path);
  });
});
