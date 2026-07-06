/**
 * Story 6.3 — 6.3-INT-03 (P1, AC1/AC2): DETERMINISM (H3 / R-612).
 *
 * Repeated renders of the SAME snapshot must produce byte/text-comparable output. The render
 * MUST be reproducible: (a) the renderer + version are EXACT-pinned; (b) fonts are
 * embedded/pinned (a base-14 PDF font or a bundled file — never a host system font);
 * (c) date/number/currency formatting uses a STABLE explicit `sv-SE` locale (never the host
 * default); (d) the render timestamp is INJECTED from the command's single `ctx.clock.now()`
 * — NO wall-clock read in the render path (strip/pin any renderer `/CreationDate`).
 *
 * A non-deterministic render breaks BOTH the text-extraction golden AND retry semantics.
 *
 * ── ATDD RED PHASE ──────────────────────────────────────────────────────────────────
 * The pinned renderer + `generateQuotePdf` do NOT exist yet. `describe.skip`'d with a
 * red-phase note. When Task 3 (renderer + pin) + Task 4 (command) land: wire the real render
 * path, remove `.skip`, and flip GREEN. LOCAL stack only; `skipUnlessStack` visible-skips a
 * stack-down run; CI hard-fails.
 *
 * [Source: test-design-epic-6.md#6.3-INT-03, R-612; story 6.3 Task 3.2 + Task 6.2;
 *  architecture.md#4 (command time discipline — a single injected timestamp, no sleeps);
 *  epics.md#Story 6.3 Technical Notes (H3 determinism)]
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

// RED PHASE — wire when Task 3/4 land:
//   import { runCommand } from "@/server/commands/envelope";
//   import { generateQuotePdf } from "@/server/commands/quotes";
//   import { extractPdfText } from "../../support/pdf-text";
//   import { adminSelectStoredPdfBytes } from "../../factories/tenants";

const FIXED_ISO = "2026-07-05T12:00:00.000Z"; // the SINGLE injected render instant

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

describe.skip("generateQuotePdf — determinism (AC1/AC2, 6.3-INT-03) [ATDD red phase: renderer not implemented]", () => {
  it("[P1] rendering the SAME snapshot twice with the SAME injected instant yields byte/text-comparable output", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed a snapshotted version; generate the PDF twice with the SAME injected clock (FIXED_ISO);
    // extract text from both; assert equal (pinned renderer/fonts/locale + injected timestamp).
    //   const t1 = extractPdfText(bytesFromFirstRender);
    //   const t2 = extractPdfText(bytesFromSecondRender);
    //   expect(t2).toBe(t1);
    expect.fail("ATDD red phase: implement the pinned deterministic renderer (story 6.3 Task 3)");
  });

  it("[P1] the render path reads NO wall clock — the render timestamp comes only from the injected instant", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Assert the PDF's rendered-at metadata / any embedded date equals FIXED_ISO (the injected
    // instant), never a Date.now() wall-clock read (which would vary run-to-run and break the
    // golden + retry). Any renderer /CreationDate is set from the injected instant or omitted.
    expect.fail("ATDD red phase: implement injected-timestamp render discipline (story 6.3 Task 3.2)");
  });
});
