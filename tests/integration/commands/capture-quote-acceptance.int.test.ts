/**
 * Story 7.1 — the `captureQuoteAcceptance` command: the sent-state gate (AC3), the server-side
 * adjusted-price reason/evidence gate (AC2), and the öre-discipline + audit-hygiene persistence
 * (AC5). These are the load-bearing behavioral proofs of 7.1 — a UI mirror is NOT the guarantee
 * (the client cannot bypass the server re-validation).
 *
 *   - 7.1-INT-02 (P0, AC3, R-706/R-707): acceptance capture is legal ONLY on `status = 'sent'`
 *     (matrix FINALIZED against the landed Epic 6 state machine — draft/sent/accepted/rejected/
 *     expired/superseded). One negative per non-sent state PLUS a cross-tenant version. A non-sent
 *     state ⇒ a stable lifecycle rejection with a USER-SAFE message that does NOT leak the exact
 *     status (a generic VALIDATION_FAILED, or a 7.1-added lifecycle-specific code — assert on the
 *     EXACT stable code the green phase chooses; do NOT reuse QUOTE_VERSION_LOCKED, a different
 *     meaning). A cross-tenant / foreign version id ⇒ TENANT_ACCESS_DENIED BEFORE execute (the
 *     ownership gate; no existence disclosure).
 *   - 7.1-INT-03 (P0, AC2, R-705): an accepted price ≠ the frozen source sent total REQUIRES an
 *     explicit `adjustment_reason` (or evidence). Re-validated SERVER-SIDE: a missing reason ⇒
 *     VALIDATION_FAILED even if the client omitted it; WITH a reason ⇒ accepted and the delta is
 *     captured (the delta computed via the Task 3 pure module / @/lib/money, never ad hoc). An
 *     EQUAL accepted price needs no reason.
 *   - 7.1-INT-05 (P1, AC5, R-705/R-710): on a successful capture, `accepted_price_ore` AND
 *     `source_sent_total_ore` persist as integer öre (`bigint`, canonical guards), and a SINGLE
 *     `audit_events` row is written with ALLOW-LISTED metadata — `{ targetId }` ONLY, NO raw
 *     accepted price / channel / customer PII in the audit metadata.
 *
 * Persistence shape (7.1 Decision, prefer (a)): 7.1 persists `quote_acceptances` via an own-tenant
 * RLS-client INSERT in this command (a single-row write — NOT the 7.2 RPC; ADR-A009's RPC is for
 * the multi-record 7.2 transaction). `accepted_at` is an EXPLICIT input field (H1 determinism — no
 * wall-clock derivation of the accepted moment); the command clock (`ctx.clock.now()`) anchors only
 * the command instant. The resolved `ctx.tenantContext.tenantId` is the ONLY tenant authority.
 *
 * Mirrors `mark-quote-version-sent.int.test.ts` / `update-draft-quote-version.int.test.ts`: per-run
 * unique ids (`crypto.randomUUID()`), raw pg readback via the BYPASSRLS admin helpers (bigint öre →
 * STRING; timestamptz → Date; coerce on readback), runs against the LOCAL Supabase stack only +
 * visibly skips when unreachable. AFTER a `supabase db reset` the runner polls `/auth/v1/health` to
 * 200 before this suite (the Kong→GoTrue 502 false-green trap — epic-5/6 retros). CI
 * (`SUPABASE_TEST_REQUIRED=1`) hard-fails so these DB-backed proofs are never silently skipped.
 *
 * The REAL sent fixture is produced by driving the LANDED Epic-6 `mark_quote_version_sent` RPC (no
 * synthetic `sent` row): seed a version as `draft` → (add children if needed) → flip to `sent` via
 * the real command/RPC. The 6.4 child-lock forbids inserting children into an already-sent parent.
 *
 * ── RED PHASE (Story 7.1 not yet implemented) ─────────────────────────────────────────────────
 * `captureQuoteAcceptance`, the `quote_acceptances` table + its migration, and any 7.1-added stable
 * error code do NOT exist yet. Each describe block is authored with the REAL proof outline behind a
 * whole-suite `describe.skip("... [ATDD red phase — Story 7.1 not implemented]")`, and each body
 * carries an `expect.fail(...)` sentinel so a stray un-skip fails LOUD rather than passing vacuously.
 * The green phase: import `captureQuoteAcceptance`, delete the sentinels, uncomment the real
 * command calls + readback assertions, and remove the `.skip`.
 *
 * [Source: test-design-epic-7.md#7.1-INT-02/03/05, R-705/R-706/R-707/R-710; story 7.1 Task 4 +
 *  AC2/AC3/AC5; testability notes 6 (sent-eligibility finalized vs landed Epic 6) + 7 (server-side
 *  adjusted-price gate); src/server/commands/quotes/mark-sent.ts (the command pattern to copy);
 *  tests/integration/commands/mark-quote-version-sent.int.test.ts (the INT harness + real-sent
 *  fixture driver to mirror); src/lib/money/ore.ts (öre discipline); tests/factories/audit-events.ts]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
// GREEN PHASE — import these when un-skipping (they do not exist / are unused in the red phase):
//   import { captureQuoteAcceptance } from "@/server/commands/quotes";
//   import { runCommand } from "@/server/commands/envelope";
//   import { adminSelectAuditEvents } from "../../factories/audit-events";
//   import { adminInsertCustomer, adminInsertCalculation, adminInsertQuote,
//            adminInsertQuoteVersion, adminSelectQuoteAcceptanceRow } from "../../factories/tenants";
//   import type { CommandClock } from "@/server/commands/clock";
// The command instant is the injected clock; `accepted_at` is an EXPLICIT input (H1 determinism):
//   const fixedClock: CommandClock = { now: () => new Date("2026-07-09T09:00:00.000Z") };

/** The non-sent version states that acceptance MUST reject (AC3, matrix finalized vs Epic 6). */
const NON_SENT_STATES = ["draft", "accepted", "rejected", "expired", "superseded"] as const;

/**
 * GREEN PHASE: produce a REAL `sent` version by driving the landed Epic-6 mark-sent path (seed a
 * mark-sendable draft → flip to `sent` via `markQuoteVersionSent`/the RPC). Returns the ids +
 * the frozen source sent total (öre) the acceptance delta is measured against. Do NOT synthesize a
 * `sent` row directly (the 6.4 lifecycle owns the transition; a synthetic row bypasses the freeze).
 */
// GREEN PHASE: fill this in using the real sent-fixture driver from
// mark-quote-version-sent.int.test.ts (seedQuoteVersion(draft) + markQuoteVersionSent), returning
// the ids + the frozen source sent total (öre) the acceptance delta is measured against. Do NOT
// synthesize a `sent` row directly (the 6.4 lifecycle owns the transition).
//   async function seedSentVersion(tenantId: string):
//     Promise<{ quoteId: string; versionId: string; sourceSentTotalOre: number }> { ... }

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client (used by the green-phase bodies)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});
// Reference `a` so the red-phase scaffold is lint-clean; the green-phase command calls consume it.
void (() => a);
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("captureQuoteAcceptance — sent-state gate (AC3) [ATDD red phase — Story 7.1 not implemented]", () => {
  for (const state of NON_SENT_STATES) {
    it(`[P0] 7.1-INT-02: a '${state}' (non-sent) version is rejected with a user-safe lifecycle error that does NOT leak the exact status`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      // Seed a version in this non-sent state (draft directly; the terminal states seeded via the
      // real lifecycle so the state is legitimate). Attempt capture → assert the EXACT stable code
      // the green phase chose (VALIDATION_FAILED or a 7.1 lifecycle code) AND that no acceptance row
      // was written. The message MUST be user-safe (no leaked status/existence).
      expect.fail("RED PHASE: captureQuoteAcceptance not implemented (Story 7.1)");
    });
  }

  it("[P0] 7.1-INT-02: a CROSS-TENANT / foreign quote version id ⇒ TENANT_ACCESS_DENIED before execute (no existence disclosure)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // adminA attempts to capture acceptance for a REAL Tenant-B sent version → the ownership gate
    // rejects with TENANT_ACCESS_DENIED before execute; no row is written; no existence leak.
    // (Mirror the TENANT_ACCESS_DENIED case in update-draft-quote-version.int.test.ts.)
    expect.fail("RED PHASE: captureQuoteAcceptance not implemented (Story 7.1)");
  });
});

describe.skip("captureQuoteAcceptance — adjusted-price server-side gate (AC2) [ATDD red phase — Story 7.1 not implemented]", () => {
  it("[P0] 7.1-INT-03: an accepted price EQUAL to the sent total is accepted with NO adjustment reason", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // capture({ accepted_price_ore: sourceSentTotalOre, adjustment_reason: undefined }) ⇒ OK.
    expect.fail("RED PHASE: captureQuoteAcceptance not implemented (Story 7.1)");
  });

  it("[P0] 7.1-INT-03: an accepted price ≠ the sent total with NO reason ⇒ VALIDATION_FAILED (server re-validates; client cannot bypass)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // capture({ accepted_price_ore: sourceSentTotalOre + 5_000, adjustment_reason: undefined }) ⇒
    // VALIDATION_FAILED, no acceptance row written. The rejection is SERVER-SIDE (the pure Task-3
    // module decided reasonRequired; the command enforces it) — omitting the reason client-side
    // does not bypass it.
    expect.fail("RED PHASE: captureQuoteAcceptance not implemented (Story 7.1)");
  });

  it("[P0] 7.1-INT-03: an accepted price ≠ the sent total WITH a reason ⇒ accepted and the delta is captured", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // capture({ accepted_price_ore: sourceSentTotalOre - 5_000, adjustment_reason: "kundrabatt" }) ⇒
    // OK; readback: accepted_price_ore + source_sent_total_ore persisted (öre), adjustment_reason
    // stored; the delta = accepted − sent (computed with @/lib/money, not re-derived).
    expect.fail("RED PHASE: captureQuoteAcceptance not implemented (Story 7.1)");
  });
});

describe.skip("captureQuoteAcceptance — öre persistence + audit hygiene (AC5) [ATDD red phase — Story 7.1 not implemented]", () => {
  it("[P1] 7.1-INT-05: accepted price + source sent total persist as integer öre (bigint); a SINGLE audit row with { targetId } only (no raw price / channel / PII)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // capture a valid acceptance → readback the quote_acceptances row: accepted_price_ore &
    // source_sent_total_ore are integer öre (bigint → STRING on raw readback), accepted_at = the
    // EXPLICIT input instant (NOT the injected command clock). Exactly ONE audit_events row for the
    // command, its metadata allow-listed to { targetId } — assert NO accepted price / channel /
    // customer value / evidence reference appears anywhere in the audit metadata (AC5 leak guard).
    expect.fail("RED PHASE: captureQuoteAcceptance not implemented (Story 7.1)");
  });
});
