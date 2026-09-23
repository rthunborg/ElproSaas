import { test } from "node:test";
import assert from "node:assert/strict";

type Producer = { id: string; module: string; category: string; schedule: string; essential: boolean };
const redPhaseRegistry = (): { fromManifest(input: unknown): Producer[] } => {
  throw new Error("Story 13.1 producer registry is not implemented yet.");
};

test.skip("[P0] derives typed producer entries only from active manifest modules and rejects placeholders", () => {
  const registry = redPhaseRegistry();
  const entries = registry.fromManifest({
    modules: [{ id: "notifications", status: "active", notificationCategories: [], tenantTables: ["job_runs"] }],
  });

  assert.deepEqual(entries, []);
  assert.throws(() =>
    registry.fromManifest({
      modules: [{ id: "notifications", status: "active", notificationCategories: ["placeholder"] }],
    }),
  );
});

test.skip("[P0] excludes pending-module producers and exposes no live category", () => {
  const registry = redPhaseRegistry();
  const entries = registry.fromManifest({
    modules: [{ id: "notifications", status: "pending", notificationCategories: ["job.reminder"] }],
  });

  assert.deepEqual(entries, []);
});
