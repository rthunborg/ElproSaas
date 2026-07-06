/**
 * Story 6.3 — 6.3-INT-04 (P1, AC2/AC3): RETRY + CONSISTENCY (R-613).
 *
 * RETRY regenerates from the SAME immutable snapshot and MUST NOT change any customer-visible
 * snapshot data — it only produces a fresh PDF object + metadata. Retry is allowed for DRAFT
 * AND SENT versions (the PDF is DERIVED from the frozen snapshot, not customer-visible
 * commitment data — 6.3 does NOT introduce the 6.4 sent-lock trigger).
 *
 * CONSISTENCY: the file object + `files`/`file_links` + `quote_events` + `audit_events` + the
 * `pdf_status='generated'`/`pdf_file_id` update are written CONSISTENTLY (transactional where
 * possible, else verified-compensated). A mid-pipeline (render/storage/metadata) failure must
 * NOT leave `pdf_status='generated'` over a MISSING file, nor a stored object with NO metadata
 * — it sets `pdf_status='failed'` so the state is RETRYABLE, and returns a generic retryable
 * `SERVER_ERROR` (never conflated with a "not authorized" denial).
 *
 * A double-submit retry must NOT silently duplicate a `file_links` row for the same version
 * (the 8.1 R-814 find-or-create seam — mirror 6.1's `exists(...)` guard, or archive the prior
 * object + re-link; archive-over-delete — 8.1 has no object reclamation).
 *
 * ── ATDD RED PHASE ──────────────────────────────────────────────────────────────────
 * `generateQuotePdf` + its consistency/retry pipeline do NOT exist yet. `describe.skip`'d
 * with a red-phase note. When Task 4.3 lands: wire the real command + a fault-injection seam
 * (a forced storage/metadata failure), remove `.skip`, and flip GREEN. LOCAL stack only;
 * `skipUnlessStack` visible-skips a stack-down run; CI hard-fails.
 *
 * [Source: test-design-epic-6.md#6.3-INT-04, R-613; story 6.3 Task 4.3 + Task 6.2;
 *  architecture.md#12 (retry for draft/sent without mutating snapshot; write
 *  files/file_links/quote_events/audit_events); deferred-work.md#8-1 (file_links find-or-create
 *  R-814; no object-reclamation), #6-1 (attachment exists(...) guard)]
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

// RED PHASE — wire when Task 4.3 lands:
//   import { runCommand } from "@/server/commands/envelope";
//   import { generateQuotePdf } from "@/server/commands/quotes";
//   import { extractPdfText } from "../../support/pdf-text";
//   import { adminSelectStoredPdfBytes, adminSelectFileLinks, adminSelectQuoteVersionRow } from "../../factories/tenants";

const FIXED_ISO = "2026-07-05T12:00:00.000Z";

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
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("generateQuotePdf — retry + consistency (AC2/AC3, 6.3-INT-04) [ATDD red phase: command not implemented]", () => {
  it("[P1] a RETRY regenerates from the same immutable snapshot WITHOUT changing customer-visible data", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Generate; retry (regenerate); assert the extracted PDF text is unchanged AND the frozen
    // snapshot rows (quote_versions/lines/attachments) are byte-identical (retry touches ONLY
    // the PDF-render columns pdf_status/pdf_file_id/pdf_generated_at, never commitment data).
    expect.fail("ATDD red phase: implement generateQuotePdf retry (story 6.3 Task 4.3)");
  });

  it("[P1] retry is allowed on a SENT version (PDF is derived, not commitment) — no sent-lock trigger in 6.3", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a SENT version; retry the PDF; assert it succeeds and updates ONLY the render columns.
    // (6.4's sent-immutability trigger, when it lands, MUST exempt these columns — recorded.)
    expect.fail("ATDD red phase: implement generateQuotePdf sent-retry (story 6.3 Task 1.3/4.3)");
  });

  it("[P1] a mid-pipeline failure leaves a CONSISTENT retryable state (pdf_status='failed', no generated-over-missing-file)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Inject a storage/metadata failure mid-pipeline; assert: pdf_status='failed' (retryable),
    // NO `generated` status pointing at a missing file, NO stored object with no metadata, and
    // a generic retryable SERVER_ERROR (never TENANT_ACCESS_DENIED). A subsequent retry succeeds.
    expect.fail("ATDD red phase: implement verified-compensated consistency (story 6.3 Task 4.3)");
  });

  it("[P1] a double-submit retry does NOT silently duplicate a file_links row for the same version (R-814 find-or-create)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Two rapid retries → assert exactly ONE live file_links row per version+purpose (exists(...)
    // find-or-create), OR an additional file version with the prior archived (archive-over-delete).
    expect.fail("ATDD red phase: implement the PDF-link retry semantics (story 6.3 Task 4.3)");
  });
});
