import assert from "node:assert/strict";
import test from "node:test";
import { activeNotificationCategories, notificationCategory } from "@/server/notifications/registry";

test("13.2 notification category registry derives active essential and non-essential quote categories", () => {
  assert.deepEqual(activeNotificationCategories(), [
    { category: "quote.follow_up_due", module: "quotes", defaultEnabled: true, essential: true },
    { category: "quote.accepted", module: "quotes", defaultEnabled: true, essential: false },
  ]);
  assert.deepEqual(notificationCategory("quote.follow_up_due"), { category: "quote.follow_up_due", module: "quotes", defaultEnabled: true, essential: true });
  assert.deepEqual(notificationCategory("quote.accepted"), { category: "quote.accepted", module: "quotes", defaultEnabled: true, essential: false });
});
test("13.2 notification category registry does not invent pending categories", () => assert.equal(notificationCategory("supplier.price_changed"), null));
