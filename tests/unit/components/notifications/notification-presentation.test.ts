/** Story 13.2 — 13.2-UNIT-002: deterministic, I/O-free notification presentation helpers. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterNotificationItems,
  formatNotificationScanStatus,
  formatUnreadNotificationCount,
  sortLatestNotificationItems,
  type NotificationPresentationItem,
} from "@/components/notifications/notification-presentation";

function item(overrides: Partial<NotificationPresentationItem> = {}): NotificationPresentationItem {
  return {
    id: "notification-1",
    category: "quote.follow_up_due",
    title: "Uppföljning",
    body: "Följ upp offerten",
    route: "/quotes/quote-1",
    readAt: null,
    createdAt: "2026-09-23T10:00:00.000Z",
    ...overrides,
  };
}

test("[P1] 13.2-UNIT-002: unread presentation counts unread rows and caps at 9+", () => {
  assert.equal(formatUnreadNotificationCount([]), "0");
  assert.equal(formatUnreadNotificationCount([item(), item({ id: "read", readAt: "2026-09-23T11:00:00.000Z" })]), "1");
  assert.equal(formatUnreadNotificationCount(Array.from({ length: 10 }, (_, index) => item({ id: `unread-${index}` }))), "9+");
});

test("[P1] 13.2-UNIT-002: latest rows sort descending by createdAt without changing the input", () => {
  const rows = [
    item({ id: "old", createdAt: "2026-09-20T10:00:00.000Z" }),
    item({ id: "latest", createdAt: "2026-09-23T10:00:00.000Z" }),
    item({ id: "middle", createdAt: "2026-09-22T10:00:00.000Z" }),
  ];
  assert.deepEqual(sortLatestNotificationItems(rows).map((row) => row.id), ["latest", "middle", "old"]);
  assert.deepEqual(rows.map((row) => row.id), ["old", "latest", "middle"]);
});

test("[P1] 13.2-UNIT-002: module/category, read-state, and from-date filters combine deterministically", () => {
  const rows = [
    item({ id: "unread-match", category: "quote.follow_up_due", createdAt: "2026-09-23T09:00:00.000Z" }),
    item({ id: "read-match", category: "quote.accepted", readAt: "2026-09-23T09:30:00.000Z", createdAt: "2026-09-23T09:00:00.000Z" }),
    item({ id: "other-module", category: "jobs.assigned", createdAt: "2026-09-23T09:00:00.000Z" }),
    item({ id: "before-date", category: "quote.follow_up_due", createdAt: "2026-09-20T09:00:00.000Z" }),
  ];
  assert.deepEqual(
    filterNotificationItems(rows, { moduleOrCategory: "quotes", readState: "unread", fromDate: "2026-09-22" }).map((row) => row.id),
    ["unread-match"],
  );
  assert.deepEqual(
    filterNotificationItems(rows, { moduleOrCategory: "quote.accepted", readState: "read", fromDate: "" }).map((row) => row.id),
    ["read-match"],
  );
});

test("[P1] 13.2-UNIT-002: scan-status copy is truthful for hidden, never, failed, and elapsed states", () => {
  assert.equal(formatNotificationScanStatus({ kind: "hidden" }), null);
  assert.equal(formatNotificationScanStatus({ kind: "never" }), "Ingen tidigare skanning.");
  assert.equal(formatNotificationScanStatus({ kind: "failed" }), "Senaste skanning misslyckades. Försök igen senare.");
  assert.equal(formatNotificationScanStatus({ kind: "elapsed", elapsedMinutes: 0 }), "Senaste skanning: Skannad för 1 tim sedan.");
  assert.equal(formatNotificationScanStatus({ kind: "elapsed", elapsedMinutes: 121 }), "Senaste skanning: Skannad för 2 tim sedan.");
});
