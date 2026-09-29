import { test } from "node:test";
import assert from "node:assert/strict";
import { producersFromManifest } from "@/server/jobs/producers";
const producer = { id: "notifications.reminder", module: "notifications", category: "quote.reminder", schedule: "*/5 * * * *", essential: false };
test("[P0] derives a typed producer only from an active module owning its category", () => {
  assert.deepEqual(producersFromManifest({ modules: [{ id: "notifications", status: "active", notificationCategories: ["quote.reminder"] }] }, [producer]), [producer]);
  assert.deepEqual(producersFromManifest({ modules: [{ id: "notifications", status: "pending", notificationCategories: ["quote.reminder"] }] }, [producer]), []);
});
test("[P0] rejects placeholder categories", () => assert.throws(() => producersFromManifest({ modules: [{ id: "notifications", status: "active", notificationCategories: ["placeholder"] }] }, [{ ...producer, category: "placeholder" }])));
