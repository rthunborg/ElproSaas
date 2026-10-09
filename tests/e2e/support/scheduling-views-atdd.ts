/** RED contract only. Bind to real production hosts before removing test.skip.
 * Utils gate exception: flag=true, package absent (epic-15 design §fixtures).
 * No selectors/action URLs for unimplemented scheduling surfaces are invented.
 */
import { test as base, expect } from "./resource-cdp-attachment";
import type { Locator } from "@playwright/test";
export type Host = "Schema" | "Resurser";
export type View = Host | "Team" | "Beläggning" | "Min kalender";
export type Interval = { startsLocal: string; endsLocal: string; startsAt: string; endsAt: string; assigneeIds: string[] };
export type DurableBooking = { id: string; startsAt: string; endsAt: string; assigneeIds: string[] };
export interface SchedulingViewsHarness {
  /** Dedicated local manager fixture, fixed Stockholm 2026-10-12, 501+ planned
   * rows with independent expected IDs; role/no-role, multi/inactive assignees.
   * Seed/cleanup owned rows only, using existing authorized fixture helpers.
   */
  seed(): Promise<void>;
  open(view: View, period?: "day" | "week" | "month"): Promise<void>;
  /** Apply one fixed AND filter set; expectation data must not use app projector. */
  applySharedFilters(): Promise<void>;
  expectedIds(view: View): string[];
  visibleIds(view: View): Promise<string[]>;
  emptySlot(host: Host, localTime: string, personId?: string): Locator;
  interval(host: Host, kind: "click" | "drag"): Interval;
  dragEndSlotLocal(host: Host): string; // Last included slot starts 30 minutes before endsLocal.
  rowPersonId(): string;
  editor: Locator;
  toolbarCreate(): Locator;
  intervalDialog(host: Host): Locator;
  openIntervalDialog(host: Host): Promise<Locator>;
  fillIntervalDialog(dialog: Locator, interval: Interval): Promise<void>;
  confirmIntervalDialog(dialog: Locator): Locator;
  /** Register actual Next action observation BEFORE save; resolve only after
   * real server success. Never synthesize 200 or infer save from request sent.
   */
  observeConfirmedSave(): Promise<{ confirmed: Promise<void> }>;
  fillRequiredEditorFields(): Promise<void>;
  sqlBookings(): Promise<DurableBooking[]>;
  reloadAndOpenBooking(id: string): Promise<void>;
  cancelEditor(): Promise<void>;
  /** Restore only this test-owned proposal fixture between accepted-save combinations. */
  resetProposalFixture(): Promise<void>;
  proposal(host: Host, operation: "move" | "resize"): Interval;
  gestureSource(host: Host, operation: "move" | "resize"): Locator;
  gestureTarget(host: Host, operation: "move" | "resize"): Locator;
  proposeByAlternative(host: Host, operation: "move" | "resize", mode: "keyboard" | "dialog"): Promise<Locator>;
  conflictedBookingId(): string;
  reviewRequired(): Locator;
  fixtureRoleLabel(): string;
  roleLane(role: string): Locator;
  expectedLaneIds(role: string): string[];
  laneIds(lane: Locator): Promise<string[]>;
  resourceRow(personId: string): Locator;
  expectedResourceIds(personId: string): string[];
  reassignmentLane(): Locator;
  expectedReassignmentIds(): string[];
  capacityNumbers(): Locator;
  agenda(): Locator;
  /** Story 15.1 Tasks & Acceptance: Min kalender day agenda, desktop week grid.
   * Confidence: expected behavior specified; concrete selector remains unverified/unbound.
   */
  personalWeekGrid(): Locator;
  phoneCapacitySummary(): Locator;
  failNextSaveOnce(): Promise<{ failed: Promise<void> }>;
  retrySave(): Locator;
  savedStatus(): Locator;
  /** Perform actual warning review and selected-conflict acceptance; no direct save bypass. */
  reviewAndAcceptCurrentProposal(): Promise<void>;
  originalOtherAssigneeIds(host: Host): string[];
  setToolbarPreference(): Promise<void>;
  toolbarState(): Promise<{ period: string; personIds: string[]; jobId: string | null }>;
  expectedChangedToolbar(): { period: string; personIds: string[]; jobId: string | null };
  expectedDefaultToolbar(): { period: string; personIds: string[]; jobId: string | null };
  switchFixtureIdentity(identity: "other-user" | "other-tenant" | "original"): Promise<void>;
  corruptScopedPreferences(): Promise<void>;
  denyStorage(): Promise<void>;
  resetToolbar(): Locator;
  resetNotice(): Locator;
  /** Register failure for final page of actual read before navigation; never use guessed URLs. */
  failNextFinalReadPage(): Promise<{ failed: Promise<void> }>;
  readFailure(): Locator;
  readRetry(): Locator;
  emptyState(): Locator;
  partialBookingList(): Locator;
  conflictCount(): Locator;
  capacityCase(kind: "zero-empty" | "zero-positive" | "overbooked"): {
    personId: string; localDay: string; demand: number; budget: number; balance: number;
    occupancy: string; colorMeaning: "no-capacity" | "overbooked"; fullDemandIds: string[];
  };
  capacityCell(personId: string, localDay: string): Locator;
  capacityCellNumbers(cell: Locator): Promise<{ demand: number; budget: number; balance: number; occupancy: string }>;
  capacityColorMeaning(cell: Locator): Promise<"no-capacity" | "overbooked">;
  drillCapacity(cell: Locator): Promise<void>;
  activeRestrictiveFilters(): Promise<string[]>;
  monthDensityDay(): Locator;
  expectedMonthDayIds(): string[];
  monthDayBookings(): Promise<string[]>;
  longMultiAssigneeBooking(): Locator;
  expectedLongLabel(): string;
  expectedMultiAssigneeLabels(): string[];
  /** Rendered interactive controls requiring 360x640 accessibility, excludes scrollable timeline content. */
  phoneControls(): Locator[];
  /** Future fixture binding must call dispose in finally, even on assertion failure. */
  dispose(): Promise<void>;
}
export const test = base.extend<{ schedulingViews: SchedulingViewsHarness }>({
  schedulingViews: async ({}, _use) => {
    throw new Error("15.1 ATDD UNBOUND: wire local authenticated fixture, real scheduling semantic locators, actual Next-action settlement and tenant-scoped SQL readback; no mock-green adapter permitted.");
  },
});
export { expect };




