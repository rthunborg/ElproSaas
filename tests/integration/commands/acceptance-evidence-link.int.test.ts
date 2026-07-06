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
 *     disclosure); a FOREIGN owner (acceptance) id ⇒ TENANT_ACCESS_DENIED (the both-side ownership
 *     gate, mirroring the 8.1 `file-link-ownership.int.test.ts` cases).
 *   - Cross-tenant + anon access to the evidence FILE itself is rejected via the 8.1 signed-access
 *     funnel (reuse — the `file-signed-access.int.test.ts` pattern; NOT a second access path).
 *   - The EXTERNAL-reference path stores free text in `quote_acceptances.evidence_reference` with NO
 *     file link (no `file_links` row) — the two evidence shapes are exclusive per capture.
 *   - `file_links` has NO dedupe uniqueness (8.1 deferral): 7.1 does a SINGLE link on capture (no
 *     idempotent retry in 7.1), so one row is the documented, tested choice — a re-link would create
 *     a second row (accept-duplicate), which 7.1 does not exercise because capture is single-shot.
 *   - NO competing evidence-storage model is created (R-814 STOP) — the link goes through
 *     `files`/`file_links` ONLY. Upload UX / MIME-size validation is Epic 8.2 (out of scope here).
 *
 * Mirrors `file-link-ownership.int.test.ts` / `file-signed-access.int.test.ts`: two-tenant fixture,
 * per-run unique ids, local Supabase stack only + visible skip, `/auth/v1/health` 200 poll after
 * reset. The evidence file is seeded via the 8.1 factory; the acceptance row is seeded via the (7.1
 * green-phase) `captureQuoteAcceptance` command or a factory insert of a valid `quote_acceptances`
 * row on a real sent version.
 *
 * ── RED PHASE (Story 7.1 not yet implemented) ─────────────────────────────────────────────────
 * `quote_acceptance` is present-but-INACTIVE in `ACTIVE_OWNER_TYPES`, `ownerTableFor` does not yet
 * resolve it, and the `quote_acceptances` table does not exist. The whole describe block is
 * `describe.skip("... [ATDD red phase — Story 7.1 not implemented]")`; each body carries an
 * `expect.fail(...)` sentinel. GREEN: add `"quote_acceptance"` to `ACTIVE_OWNER_TYPES`
 * (validation.ts) + register its table (file-db.ts), remove the `.skip`, replace the sentinels with
 * real `createFileLink` calls + readbacks.
 *
 * [Source: test-design-epic-7.md#7.1-INT-04, R-709/R-814; story 7.1 Task 5 + AC6; testability note 8
 *  (evidence-link reuses 8.1; file_links has no dedupe — test the chosen semantics);
 *  src/server/commands/files/{validation,file-db,files}.ts (ACTIVE_OWNER_TYPES / ownerTableFor /
 *  createFileLink to activate); tests/integration/commands/file-link-ownership.int.test.ts +
 *  file-signed-access.int.test.ts (the INT harness + both-side ownership + signed-access to mirror)]
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
// GREEN PHASE — import when un-skipping (unavailable / unused in the red phase):
//   import { createFileLink } from "@/server/commands/files";
//   import { runCommand } from "@/server/commands/envelope";
//   import type { CommandClock } from "@/server/commands/clock";
//   const fixedClock: CommandClock = { now: () => new Date("2026-07-09T12:00:00.000Z") };

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client (used by the green-phase bodies)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});
// Reference `a` so the red-phase scaffold is lint-clean; the green-phase link calls consume it.
void (() => a);
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("acceptance-evidence link — quote_acceptance owner activation on the 8.1 model (AC6) [ATDD red phase — Story 7.1 not implemented]", () => {
  it("[P0] 7.1-INT-04: an own-tenant evidence file links to a quote_acceptance owner (acceptance_evidence purpose)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a real sent version → capture an acceptance (own tenant) → seed an own-tenant evidence
    // file → createFileLink({ file_id, owner_type: "quote_acceptance", owner_id: acceptanceId,
    // purpose: "acceptance_evidence" }) ⇒ OK; readback: exactly ONE file_links row for the pair.
    expect.fail("RED PHASE: quote_acceptance owner type not activated (Story 7.1)");
  });

  it("[P0] 7.1-INT-04: a FOREIGN (cross-tenant) evidence file id ⇒ TENANT_ACCESS_DENIED (no existence leak)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // adminA links a Tenant-B file id to an own-tenant acceptance ⇒ TENANT_ACCESS_DENIED.
    expect.fail("RED PHASE: quote_acceptance owner type not activated (Story 7.1)");
  });

  it("[P0] 7.1-INT-04: a FOREIGN (cross-tenant) acceptance owner id ⇒ TENANT_ACCESS_DENIED (both-side ownership)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // adminA links an own file to a Tenant-B acceptance id ⇒ TENANT_ACCESS_DENIED (the R-802
    // owner-side check via ownerRecordVisible resolves nothing across tenants).
    expect.fail("RED PHASE: quote_acceptance owner type not activated (Story 7.1)");
  });

  it("[P0] 7.1-INT-04: cross-tenant + anon access to the evidence FILE is rejected via the 8.1 signed-access funnel", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Reuse the 8.1 signed-access path: Tenant-B admin + anon requesting a signed URL for Tenant-A's
    // evidence file ⇒ rejected. NO second access path is introduced (R-814).
    expect.fail("RED PHASE: quote_acceptance owner type not activated (Story 7.1)");
  });

  it("[P1] 7.1-INT-04: an EXTERNAL reference stores free text in evidence_reference with NO file link", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // capture with evidence_reference = "kundmail 2026-07-09, ärende 4711" and no evidence_file_id ⇒
    // the quote_acceptances row carries evidence_reference; NO file_links row exists for it.
    expect.fail("RED PHASE: captureQuoteAcceptance not implemented (Story 7.1)");
  });
});
