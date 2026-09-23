import assert from "node:assert/strict";
import test from "node:test";
import { activeNotificationCategories, notificationCategory } from "@/server/notifications/registry";

test("13.2 notification category registry derives the active essential quote category", () => {
  assert.deepEqual(activeNotificationCategories(), [
    { category: "quote.follow_up_due", module: "quotes", defaultEnabled: true, essential: true },
  ]);
  assert.deepEqual(notificationCategory("quote.follow_up_due"), { category: "quote.follow_up_due", module: "quotes", defaultEnabled: true, essential: true });
});
test("13.2 notification category registry does not invent pending categories", () => assert.equal(notificationCategory("supplier.price_changed"), null));
