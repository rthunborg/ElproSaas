/**
 * Story 14.4 RED fixture contract. No browser/server launch occurs here.
 * library gate exception: playwright-utils flag=true, package absent.
 * Reuse the project's guarded resourcePage and per-run .auth/fixture.json.
 * These are planned test-owned bindings, not observed production APIs.
 * The default library framework workflow may establish playwright-utils later;
 * no missing dependency import is generated in this RED contract.
 */
import { test as base, expect } from "./resource-cdp-attachment";
import type { Page, TestInfo } from "@playwright/test";

export type Scenario = {
  readonly credentials: { readonly email: string; readonly password: string };
  readonly tenantIds: string[];
  readonly tenantId: string;
  readonly actorMembershipId: string;
  readonly actorUserId: string;
  readonly assigneeIds: readonly string[];
  readonly assigneeLabels: readonly string[];
  readonly description: string;
  readonly startsLocal: string;
  readonly endsLocal: string;
  readonly expectedStartsAt: string;
  readonly expectedEndsAt: string;
  readonly jobId: string;
  readonly customerId: string;
  readonly facilityId: string;
  readonly contactId: string;
  readonly workRoleId: string;
  readonly persistedBookingId: string;
  readonly expectedOpenLogicalCount: number;
  readonly expectedConflictRowCount: number;
  readonly expectedAcceptedRowCount: number;
  readonly expectedOpenRowCount: number;
  readonly selectedLogicalId: string;
  readonly olderWarning: { readonly text: string; readonly timelineName: string; readonly rule: string; readonly person: string; readonly window: string; readonly collision: string };
  readonly newerWarning: { readonly text: string; readonly timelineName: string; readonly rule: string; readonly person: string; readonly window: string; readonly collision: string };
};
export type SaveGate = {
  /** Actual matching request has reached the adapter's hold point. */
  readonly started: Promise<void>;
  readonly release: () => Promise<void>;
};
export type PreviewRace = {
  readonly olderStarted: Promise<void>;
  readonly newerStarted: Promise<void>;
  /** Release captured real production responses; never synthesize detector facts. */
  readonly releaseNewerAndWaitForRender: () => Promise<void>;
  readonly releaseOlderAndWaitForSettlement: () => Promise<void>;
};
export interface BookingEditorHarness {
  /**
   * Use scoped local adminQuery/adminExec helpers only at test execution.
   * Read credentials from tests/e2e/.auth/fixture.json; provision dedicated
   * per-test person/job/customer rows under that authenticated tenant.
   * Fixed Stockholm 2026-10-12 fixtures; no Date.now-derived booking boundaries.
   * Unique description and IDs per test; no broad seed/reset or unrelated edits.
   * Capture affected existing rows and restore only owned changes in dispose.
   */
  seed(mode: "conflict-free" | "conflicted" | "persisted-conflict-states"): Promise<Scenario>;
  /** Register actual production save observation BEFORE navigation/action. */
  observeNextConfirmedSave(): Promise<{ readonly confirmed: Promise<void> }>;
  /** Hold actual request before writes; release is idempotent and always cleaned. */
  holdNextSave(): Promise<SaveGate>;
  /** Observe a real transient SERVER_ERROR before any durable writes. */
  failNextSaveOnce(): Promise<{ readonly failed: Promise<void> }>;
  /**
   * Run real save to durable completion, then lose only its response.
   * committed resolves from actual SQL outcome/readback, not request sent/200 mock.
   * Retry must preserve original business command, create UUID and review decision.
   */
  loseNextCommittedSaveResponseOnce(): Promise<{ readonly committed: Promise<void> }>;
  /**
   * Capture first/second real preview responses for different candidates,
   * deliver newer then older, and acknowledge browser application settlement.
   * Binding must identify actual Next action transport, not guess an /api URL.
   */
  raceNextPreviews(): Promise<PreviewRace>;
  failNextPreviewOnce(): Promise<{ readonly failed: Promise<void> }>;
  /** Remove routes/holds/listeners and only per-test SQL rows; never stop browser. */
  dispose(): Promise<void>;
}

/**
 * Deliberately unbound: replace ONLY this function with actual production
 * transport + scoped SQL fixture wiring during development, before unskipping.
 * Do not install dependencies or add application endpoints to satisfy this test.
 * All durable assertions in the spec use existing bookingSnapshot directly.
 */
async function bindBookingEditorHarness(
  page: Page,
  testInfo: TestInfo,
): Promise<BookingEditorHarness> {
  void page;
  void testInfo;
  throw new Error(
    "ATDD_UNBOUND_BOOKING_EDITOR_BROWSER: bind real scoped .auth/fixture.json " +
    "SQL setup/cleanup and production preview/save transport before activation; " +
    "no browser selector or durable behavior has been verified by this scaffold",
  );
}

export const test = base.extend<{ bookingEditor: BookingEditorHarness }>({
  bookingEditor: async ({ resourcePage }, provide, testInfo) => {
    const harness = await bindBookingEditorHarness(resourcePage, testInfo);
    try { await provide(harness); }
    finally { await harness.dispose(); }
  },
});
export { expect };
