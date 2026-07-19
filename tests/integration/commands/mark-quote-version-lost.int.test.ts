/**
 * Story 10.2 — ATDD RED-PHASE scaffold: the `markQuoteVersionLost` command + the narrow
 * `mark_quote_version_lost` RPC, the load-bearing correctness proofs at BOTH enforcement layers
 * (10.2-INT-01/02/03/05/06, P0, AC1/AC2/AC3/AC5, R-1010/R-1011/R-1012/R-1013).
 *
 *   - 10.2-INT-02 (P0, AC2): confirming a lost flip on a SENT version executes the narrow RPC in ONE
 *     transaction that (a) flips `quote_versions.status` → `lost` (the ONLY column touched on the
 *     version row), (b) appends exactly one `quote_events` row (`event_type='lost'`,
 *     `occurred_at` = the INJECTED clock — NO wall-clock), (c) inserts exactly one `quote_lost_reasons`
 *     row (outcome/category/note), and (d) writes exactly one `audit_events` row via the envelope with
 *     allow-listed `{ targetId }` metadata ONLY — NO outcome/category/note (free text / possible PII).
 *   - 10.2-INT-01 (P0, AC3, closes the [6-5] gap): a BEFORE/AFTER read of ALL customer-visible + PDF
 *     columns proves the flip is provably STATUS-ONLY — the sent snapshot (intro/terms/öre totals +
 *     the pdf_* render columns) is byte-identical across the flip; ONLY `status` changed. (The full
 *     sent-immutability regression suite is a SEPARATE re-run — see mark-quote-version-sent.int.test.ts;
 *     do NOT fork it.)
 *   - 10.2-INT-03 (P0, AC2, R-1011): an illegal lost transition is rejected at BOTH layers — the
 *     command guard (`isLegalLifecycleTransition(status,'lost')`) returns VALIDATION_FAILED BEFORE any
 *     write on a draft/accepted/superseded version; and the below-command RPC belt raises `QV409` →
 *     mapped to `QUOTE_VERSION_LOCKED` (proven via a double-lost: a second lost on an already-`lost`
 *     version — the RPC's `assert v_status='sent'` fires).
 *   - 10.2-INT-05 (P0, AC2, R-1013): a duplicate reason — incl. a `Promise.all` double-submit race —
 *     hits `unique (quote_version_id)` (23505) → mapped to VALIDATION_FAILED; exactly ONE reason row
 *     survives.
 *   - 10.2-INT-06 (P0, AC5): a cross-tenant lost attempt (adminA acting on a Tenant-B version id) →
 *     `TENANT_ACCESS_DENIED` (envelope ownership gate), generically (no cross-tenant existence signal);
 *     the Tenant-B row is untouched and the attempt is audited.
 *
 * ── WHY the top `describe` is skipped (RED PHASE) ─────────────────────────────────────────────────
 * `markQuoteVersionLost` + the RPC do NOT exist yet (Tasks 1.6 + 4 are the DEV phase). To keep the
 * file TYPE-CHECKING today WITHOUT importing a non-existent export, the command is a LOCAL RED-PHASE
 * placeholder and the reason readback is a LOCAL `adminQuery`; the whole suite is `describe.skip` so
 * neither is invoked. GREEN phase:
 *   1. replace the placeholder with `import { markQuoteVersionLost } from "@/server/commands/quotes";`
 *   2. (optional) move `adminSelectLostReasons` into `tests/factories/tenants.ts`;
 *   3. remove `.skip`. Assertions are the CONTRACT — do not weaken them.
 *
 * Mirrors `mark-quote-version-sent.int.test.ts` (6.4): per-run `crypto.randomUUID()` ids, raw pg
 * readback via BYPASSRLS admin helpers, deterministic injected clock, runs against the LOCAL Supabase
 * stack only + visibly skips when unreachable. CI (`SUPABASE_TEST_REQUIRED=1`) hard-fails.
 *
 * [Source: story 10.2 AC1/AC2/AC3/AC5 + Tasks 1.6/4 + Dev Notes "The mark_quote_version_lost RPC" /
 *  "Reuse — do NOT reinvent"; test-design-epic-10.md#10.2-INT-01/02/03/05/06, R-1010..R-1013;
 *  tests/integration/commands/mark-quote-version-sent.int.test.ts (the harness to mirror)]
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
  adminSelectQuoteVersionRow,
  adminSelectQuoteVersionPdfColumns,
  adminSelectQuoteEventsForVersion,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { markQuoteVersionSent } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-19T09:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

// ── RED-PHASE PLACEHOLDER (delete in green — see header) ──────────────────────────────────────
// GREEN: `import { markQuoteVersionLost } from "@/server/commands/quotes";`
// `never` is assignable to `runCommand`'s command param; the suite is skipped so it is never called.
const markQuoteVersionLost = null as unknown as never;

/** Local BYPASSRLS readback of the lost-reason row(s) for a version (green: move to factories). */
async function adminSelectLostReasons(
  versionId: string,
): Promise<{ outcome: string; category: string; note: string | null }[]> {
  return adminQuery(
    `select outcome, category, note from public.quote_lost_reasons where quote_version_id = $1`,
    [versionId],
  );
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});
afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/** Seed a quote + one version of the given status for a tenant. */
async function seedQuoteVersion(
  tenantId: string,
  status: string,
): Promise<{ quoteId: string; versionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `lost-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `lost-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status,
    intro_text: "ursprunglig introtext",
  });
  return { quoteId, versionId };
}

/** Mark a freshly-seeded draft SENT via the real command (the legal precondition for a lost flip). */
async function seedSentVersion(tenantId: string): Promise<string> {
  const { versionId } = await seedQuoteVersion(tenantId, "draft");
  const sent = await runCommand(markQuoteVersionSent, {
    client: a as never,
    input: { quote_version_id: versionId },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
  expect(sent.ok).toBe(true);
  return versionId;
}

const LOST_INPUT = { outcome: "forlorad", category: "pris" } as const;

describe.skip("markQuoteVersionLost — the lost flip (RED — Story 10.2 not implemented)", () => {
  it("[P0] 10.2-INT-02: ONE txn flips status→lost, appends one lost event, inserts one reason, writes one audit ({ targetId } only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const versionId = await seedSentVersion(fixture.tenantA.id);
    const correlationId = crypto.randomUUID();

    const res = await runCommand(markQuoteVersionLost, {
      client: a as never,
      input: { quote_version_id: versionId, ...LOST_INPUT, note: "för dyrt" },
      clock: fixedClock,
      correlationId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // RED-PHASE cast: the `never` command placeholder widens res.data to unknown. GREEN phase (real
    // `markQuoteVersionLost` import) narrows it to `{ targetId }` and this cast becomes a no-op.
    expect((res.data as { targetId: string }).targetId).toBe(versionId);

    // status flipped to the new terminal token.
    const row = await adminSelectQuoteVersionRow(versionId);
    expect(row?.status).toBe("lost");

    // exactly one appended `lost` event, occurred_at = the injected clock.
    const events = await adminSelectQuoteEventsForVersion(versionId);
    const lostEvents = events.filter((e) => e.event_type === "lost");
    expect(lostEvents.length).toBe(1);
    expect(lostEvents[0]?.occurred_at).toBe(FIXED_ISO);

    // exactly one reason row carrying the outcome/category/note.
    const reasons = await adminSelectLostReasons(versionId);
    expect(reasons.length).toBe(1);
    expect(reasons[0]?.outcome).toBe("forlorad");
    expect(reasons[0]?.category).toBe("pris");

    // exactly one audit row; metadata is allow-listed `{}` — NO outcome/category/note leaked.
    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0]?.target_id).toBe(versionId);
    expect(audits[0]?.metadata).toEqual({});
    expect(JSON.stringify(audits[0]?.metadata)).not.toMatch(/forlorad|pris|för dyrt/i);
  });

  it("[P0] 10.2-INT-01: the flip is provably STATUS-ONLY — ALL customer-visible + PDF columns byte-unchanged (closes the 6-5 gap)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const versionId = await seedSentVersion(fixture.tenantA.id);
    const before = await adminSelectQuoteVersionRow(versionId);
    const pdfBefore = await adminSelectQuoteVersionPdfColumns(versionId);

    const res = await runCommand(markQuoteVersionLost, {
      client: a as never,
      input: { quote_version_id: versionId, ...LOST_INPUT },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);

    const after = await adminSelectQuoteVersionRow(versionId);
    const pdfAfter = await adminSelectQuoteVersionPdfColumns(versionId);
    // ONLY status changed: every customer-visible snapshot datum + every PDF-source column is unchanged.
    expect(after?.status).toBe("lost");
    expect(after?.intro_text).toBe(before?.intro_text);
    expect(String(after?.base_total_ore)).toBe(String(before?.base_total_ore));
    expect(after?.quote_id).toBe(before?.quote_id);
    expect(pdfAfter?.pdf_status).toBe(pdfBefore?.pdf_status);
    expect(pdfAfter?.pdf_file_id).toBe(pdfBefore?.pdf_file_id);
    expect(pdfAfter?.pdf_generated_at).toBe(pdfBefore?.pdf_generated_at);
  });

  it("[P0] 10.2-INT-03 (command layer): a lost flip on a DRAFT / ACCEPTED / SUPERSEDED version ⇒ VALIDATION_FAILED before any write", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const status of ["draft", "accepted", "superseded"] as const) {
      const { versionId } = await seedQuoteVersion(fixture.tenantA.id, status);
      const res = await runCommand(markQuoteVersionLost, {
        client: a as never,
        input: { quote_version_id: versionId, ...LOST_INPUT },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.code).toBe("VALIDATION_FAILED");
      // The command guard fired BEFORE any write — no status flip, no reason row.
      const row = await adminSelectQuoteVersionRow(versionId);
      expect(row?.status).toBe(status);
      expect((await adminSelectLostReasons(versionId)).length).toBe(0);
    }
  });

  it("[P0] 10.2-INT-03 (DB belt): a SECOND lost on an already-lost version ⇒ QV409 → QUOTE_VERSION_LOCKED (the RPC assert v_status='sent')", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const versionId = await seedSentVersion(fixture.tenantA.id);
    const first = await runCommand(markQuoteVersionLost, {
      client: a as never,
      input: { quote_version_id: versionId, ...LOST_INPUT },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);

    const res = await runCommand(markQuoteVersionLost, {
      client: a as never,
      input: { quote_version_id: versionId, outcome: "avbojd", category: "konkurrent" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("QUOTE_VERSION_LOCKED");
    expect(res.message).not.toMatch(/QV409|23514|status|stack/i);
    // Still exactly one reason (the second flip never wrote).
    expect((await adminSelectLostReasons(versionId)).length).toBe(1);
  });

  it("[P0] 10.2-INT-05: a duplicate reason (Promise.all double-submit race) ⇒ unique(quote_version_id) → VALIDATION_FAILED; ONE row survives", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const versionId = await seedSentVersion(fixture.tenantA.id);
    const submit = () =>
      runCommand(markQuoteVersionLost, {
        client: a as never,
        input: { quote_version_id: versionId, ...LOST_INPUT },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });

    const [r1, r2] = await Promise.all([submit(), submit()]);
    // Exactly one wins; the loser maps 23505 → VALIDATION_FAILED (or QUOTE_VERSION_LOCKED if it lost
    // the status race first) — never a 500/unmapped error.
    const oks = [r1, r2].filter((r) => r.ok).length;
    expect(oks).toBe(1);
    const loser = [r1, r2].find((r) => !r.ok);
    expect(["VALIDATION_FAILED", "QUOTE_VERSION_LOCKED"]).toContain(
      loser && !loser.ok ? loser.code : undefined,
    );
    expect((await adminSelectLostReasons(versionId)).length).toBe(1);
  });

  it("[P0] 10.2-INT-06: a cross-tenant lost attempt (Tenant-B version id) ⇒ TENANT_ACCESS_DENIED generically; Tenant-B row untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B sent version (existing but A-invisible) — never a non-existent id.
    const { versionId: bVersionId } = await seedQuoteVersion(fixture.tenantB.id, "sent");
    const before = await adminSelectQuoteVersionRow(bVersionId);

    const res = await runCommand(markQuoteVersionLost, {
      client: a as never, // adminA acting on a Tenant-B version id
      input: { quote_version_id: bVersionId, ...LOST_INPUT },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    expect(res.message).not.toMatch(/exist|tenant b|another|version/i);
    // The Tenant-B row is untouched — never flipped, no reason row.
    const after = await adminSelectQuoteVersionRow(bVersionId);
    expect(after?.status).toBe(before?.status);
    expect((await adminSelectLostReasons(bVersionId)).length).toBe(0);
  });
});
