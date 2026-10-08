/** Resource schema foundation is live; scheduling remains entirely pending. */
import assert from "node:assert/strict";
import { test } from "node:test";

const manifestModulePath = "../../../src/scope/manifest";

test("[P0] activates resources with its six tenant tables and leaves scheduling surface-free", async () => {
  const manifestModule = await import(manifestModulePath);
  const manifest = (manifestModule as { SCOPE_MANIFEST?: { modules?: readonly Record<string, unknown>[] } }).SCOPE_MANIFEST;
  const modules = manifest?.modules ?? [];
  const resources = modules.find((module) => module.id === "resources");
  const scheduling = modules.find((module) => module.id === "scheduling");

  assert.equal(resources?.status, "active");
  assert.ok(resources?.activatedAt);
  assert.deepEqual(resources?.tenantTables, [
    "person_profiles",
    "person_work_hours",
    "tenant_calendar_days", "bookings", "booking_assignees", "booking_conflicts",
  ]);
  assert.equal(scheduling?.status, "pending");
  assert.deepEqual(scheduling?.navItems, []);
  assert.deepEqual(scheduling?.tenantTables, []);
  assert.deepEqual(scheduling?.widgets, []);
  assert.deepEqual(scheduling?.notificationCategories, []);
  assert.deepEqual(scheduling?.publicSurfaces, []);
  assert.deepEqual(scheduling?.fileOwnerTypes, []);
});
